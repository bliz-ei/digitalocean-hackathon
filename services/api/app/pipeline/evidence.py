import asyncio
from collections.abc import Awaitable, Callable, Sequence
from dataclasses import dataclass, field

from app.domain.evidence import (
    UnsafeUrl,
    build_evidence,
    canonicalize_url,
    credible_independent_count,
    select_evidence,
    validate_draft,
)
from app.domain.models import (
    Claim,
    ClaimState,
    ClassificationResult,
    EvidenceRecord,
    SearchResult,
    SearchRole,
    Verdict,
    VerdictDraft,
    VerdictLabel,
    utcnow,
)
from app.persistence.repository import Repository
from app.providers.evidence import PageFetcher, ReasoningModel, SearchAdapter
from app.domain.state import transition


EventSink = Callable[[str, dict], Awaitable[None]]


@dataclass
class PendingSynthesis:
    claim: Claim
    evidence: list[EvidenceRecord]
    attempts: int = 0


@dataclass
class EvidencePipeline:
    repository: Repository
    search: SearchAdapter
    fetcher: PageFetcher
    reasoner: ReasoningModel | None
    emit: EventSink
    stage_timeout: float = 10.0
    synthesis_timeout: float = 7.0
    pending: dict[str, PendingSynthesis] = field(default_factory=dict)
    running: set[str] = field(default_factory=set)

    async def run(self, claim: Claim, classification: ClassificationResult) -> Claim:
        if claim.public_id in self.running:
            return self.repository.get_claim(claim.public_id) or claim
        self.running.add(claim.public_id)
        try:
            records = await asyncio.wait_for(self._evidence(classification, claim), timeout=self.stage_timeout)
            selected = select_evidence(records)
            claim.evidence = [item.evidence for item in selected]
            if credible_independent_count(selected) < 2:
                return await self._insufficient(claim, selected, "Fewer than two credible independent sources were available.")
            claim.state = transition(claim.state, ClaimState.EVIDENCE_READY)
            if not self.repository.save_claim_if_active(claim):
                return self.repository.get_claim(claim.public_id) or claim
            await self._state(claim)
            claim.state = transition(claim.state, ClaimState.SYNTHESIZING)
            if not self.repository.save_claim_if_active(claim):
                return self.repository.get_claim(claim.public_id) or claim
            await self._state(claim)
            pending = PendingSynthesis(claim=claim, evidence=selected)
            self.pending[claim.public_id] = pending
            if self.reasoner is None:
                await self._request_client(pending, ())
                return claim
            return await self._server_synthesis(pending)
        except TimeoutError:
            return await self._terminal_failure(claim, "Evidence collection exceeded its deadline.")
        except Exception:
            return await self._terminal_failure(claim, "Evidence providers were unavailable.")
        finally:
            self.running.discard(claim.public_id)

    async def accept_draft(self, draft: VerdictDraft) -> Claim | None:
        pending = self.pending.get(draft.claim_public_id)
        if not pending:
            return None
        pending.attempts += 1
        validation = validate_draft(pending.claim, pending.evidence, draft)
        if validation.verdict:
            return await self._complete(pending.claim, validation.verdict, pending.evidence)
        if pending.attempts < 2:
            await self._request_client(pending, validation.errors)
            return pending.claim
        return await self._insufficient(
            pending.claim,
            pending.evidence,
            "The reasoning response failed citation validation.",
        )

    async def _server_synthesis(self, pending: PendingSynthesis) -> Claim:
        errors: Sequence[str] = ()
        assert self.reasoner
        for _ in range(2):
            pending.attempts += 1
            try:
                draft = await asyncio.wait_for(
                    self.reasoner.synthesize(pending.claim, pending.evidence, errors),
                    timeout=self.synthesis_timeout,
                )
            except (TimeoutError, ValueError):
                errors = ("invalid_or_timeout",)
                continue
            validation = validate_draft(pending.claim, pending.evidence, draft)
            if validation.verdict:
                return await self._complete(pending.claim, validation.verdict, pending.evidence)
            errors = validation.errors
        return await self._insufficient(
            pending.claim,
            pending.evidence,
            "The reasoning response failed deterministic citation validation.",
        )

    async def _evidence(self, classification: ClassificationResult, claim: Claim) -> list[EvidenceRecord]:
        queries = [
            (SearchRole.neutral, item) for item in classification.neutral_queries[:2]
        ] + [
            (SearchRole.support, item) for item in classification.support_queries[:2]
        ] + [
            (SearchRole.counter, item) for item in classification.counter_queries[:2]
        ]
        groups = await asyncio.gather(
            *(self._search_with_retry(query, role) for role, query in queries),
            return_exceptions=True,
        )
        candidates: list[SearchResult] = []
        seen: set[str] = set()
        for group in groups:
            if isinstance(group, BaseException):
                continue
            for item in group:
                try:
                    url = canonicalize_url(str(item.url))
                except UnsafeUrl:
                    continue
                if url not in seen:
                    seen.add(url)
                    candidates.append(item.model_copy(update={"url": url}))
        fetched = await asyncio.gather(
            *(self._fetch(item, claim) for item in candidates[:9]),
            return_exceptions=True,
        )
        return [item for item in fetched if isinstance(item, EvidenceRecord)]

    async def _search_with_retry(self, query: str, role: SearchRole) -> list[SearchResult]:
        for attempt in range(2):
            try:
                return await asyncio.wait_for(self.search.search(query, role, 3), timeout=4)
            except (TimeoutError, ValueError):
                if attempt:
                    raise
                await asyncio.sleep(0.05)
        return []

    async def _fetch(self, result: SearchResult, claim: Claim) -> EvidenceRecord:
        page = await asyncio.wait_for(self.fetcher.fetch(str(result.url)), timeout=5)
        return build_evidence(claim, result, page)

    async def _request_client(self, pending: PendingSynthesis, errors: Sequence[str]) -> None:
        await self.emit(
            "synthesis_request",
            {
                "claim": pending.claim.model_dump(mode="json", exclude={"evidence", "verdict"}),
                "evidence": [item.evidence.model_dump(mode="json") for item in pending.evidence],
                "validation_errors": list(errors),
                "attempt": pending.attempts + 1,
                "prompt_version": "phase3-v1",
            },
        )

    async def _complete(self, claim: Claim, verdict: Verdict, evidence: list[EvidenceRecord]) -> Claim:
        claim.verdict = verdict
        claim.state = transition(claim.state, ClaimState.COMPLETE)
        claim.completed_at = utcnow()
        if self.repository.complete_claim(claim, evidence):
            await self._state(claim)
        self.pending.pop(claim.public_id, None)
        return self.repository.get_claim(claim.public_id) or claim

    async def _insufficient(
        self, claim: Claim, evidence: Sequence[EvidenceRecord], reason: str
    ) -> Claim:
        claim.evidence = [item.evidence for item in evidence]
        claim.verdict = Verdict(
            label=VerdictLabel.InsufficientEvidence,
            confidence=0,
            explanation="Verity could not establish a sufficiently independent evidence base. No factual conclusion is presented.",
            uncertainty=reason,
            counterevidence_summary="No validated counterevidence conclusion is available.",
            citation_ids=[item.evidence.id for item in evidence[:3]],
            model_provider="deterministic",
            model_name="fail-closed-policy",
            prompt_version="phase3-v1",
        )
        claim.state = transition(claim.state, ClaimState.INSUFFICIENT_EVIDENCE)
        claim.completed_at = utcnow()
        if self.repository.complete_claim(claim, list(evidence)):
            await self._state(claim)
        self.pending.pop(claim.public_id, None)
        return self.repository.get_claim(claim.public_id) or claim

    async def _terminal_failure(self, claim: Claim, reason: str) -> Claim:
        if claim.evidence:
            records = [EvidenceRecord(evidence=item, captured_text=item.excerpt) for item in claim.evidence]
            return await self._insufficient(claim, records, reason)
        claim.state = transition(claim.state, ClaimState.FAILED)
        claim.completed_at = utcnow()
        if self.repository.complete_claim(claim):
            await self._state(claim)
        return self.repository.get_claim(claim.public_id) or claim

    async def _state(self, claim: Claim) -> None:
        await self.emit(
            "verdict_complete" if claim.state in {ClaimState.COMPLETE, ClaimState.INSUFFICIENT_EVIDENCE, ClaimState.FAILED} else "pipeline_state",
            {"public_id": claim.public_id, "state": claim.state, "claim": claim.model_dump(mode="json")},
        )
