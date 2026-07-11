import asyncio
from time import perf_counter

from app.domain.models import Claim, ClaimState, ClassificationResult, VerdictDraft, utcnow
from app.persistence.repository import MemoryRepository
from app.pipeline.evidence import EvidencePipeline
from app.providers.evidence import CachingSearchAdapter, RecordedEvidenceProvider, SearchEvidenceCollector


def base_claim(public_id: str = "claim-phase3") -> Claim:
    return Claim(
        public_id=public_id,
        session_id="session",
        speaker_label="Speaker B",
        exact_text="Electric vehicles produce no carbon emissions.",
        normalized_text="Electric vehicles produce no carbon emissions",
        start_ms=12_000,
        end_ms=15_400,
        classification="factual_claim",
        state=ClaimState.CHECKING,
        created_at=utcnow(),
        fixture_mode=True,
    )


def classification() -> ClassificationResult:
    return ClassificationResult(
        candidate_id="candidate",
        classification="factual_claim",
        normalized_claim="Electric vehicles produce no carbon emissions",
        neutral_queries=["electric vehicle lifecycle emissions"],
        support_queries=["electric vehicle direct emissions"],
        counter_queries=["electric vehicle production emissions"],
    )


def test_recorded_pipeline_completes_with_valid_independent_citations():
    async def run():
        repo = MemoryRepository()
        claim = base_claim()
        repo.save_claim(claim)
        events = []
        provider = RecordedEvidenceProvider()
        pipeline = EvidencePipeline(repo, SearchEvidenceCollector(provider, provider), provider, lambda kind, payload: capture(events, kind, payload))
        completed = await pipeline.run(claim, classification())
        assert completed.state == ClaimState.COMPLETE
        assert completed.verdict and completed.verdict.label == "Misleading"
        assert len(completed.verdict.citation_ids) == 3
        assert len({item.independent_key for item in completed.evidence}) == 3
        assert completed.public_id in repo.notification_jobs
        assert [kind for kind, _ in events] == ["pipeline_state", "pipeline_state", "verdict_complete"]
        assert not repo.complete_claim(completed)
    asyncio.run(run())


def test_one_source_fails_closed_without_synthesis():
    async def run():
        repo = MemoryRepository()
        claim = base_claim("claim-one-source")
        repo.save_claim(claim)
        provider = RecordedEvidenceProvider()
        provider.data["search"]["neutral"] = []
        provider.data["search"]["counter"] = []
        pipeline = EvidencePipeline(repo, SearchEvidenceCollector(provider, provider), provider, noop)
        completed = await pipeline.run(claim, classification())
        assert completed.state == ClaimState.INSUFFICIENT_EVIDENCE
        assert completed.verdict and completed.verdict.label == "Insufficient evidence"
        assert provider.attempt == 0
    asyncio.run(run())


def test_client_draft_gets_one_retry_then_fails_closed():
    async def run():
        repo = MemoryRepository()
        claim = base_claim("claim-client")
        repo.save_claim(claim)
        events = []
        provider = RecordedEvidenceProvider()
        pipeline = EvidencePipeline(repo, SearchEvidenceCollector(provider, provider), None, lambda kind, payload: capture(events, kind, payload))
        pending = await pipeline.run(claim, classification())
        assert pending.state == ClaimState.SYNTHESIZING
        invalid = VerdictDraft(
            claim_public_id=claim.public_id,
            label="Supported",
            confidence=.8,
            explanation="Invalid draft.",
            uncertainty="Unknown.",
            counterevidence_summary="None.",
            citation_ids=[pending.evidence[0].id],
            model_provider="client",
            model_name="reasoning",
        )
        assert (await pipeline.accept_draft(invalid)).state == ClaimState.SYNTHESIZING
        completed = await pipeline.accept_draft(invalid)
        assert completed and completed.state == ClaimState.INSUFFICIENT_EVIDENCE
        assert sum(kind == "synthesis_request" for kind, _ in events) == 2
    asyncio.run(run())


def test_three_recorded_hero_runs_finish_inside_phase_budget():
    async def run():
        started = perf_counter()
        for index in range(3):
            repo = MemoryRepository()
            claim = base_claim(f"claim-performance-{index}")
            repo.save_claim(claim)
            provider = RecordedEvidenceProvider()
            completed = await EvidencePipeline(repo, SearchEvidenceCollector(provider, provider), provider, noop).run(claim, classification())
            assert completed.state == ClaimState.COMPLETE
        assert perf_counter() - started < 30
    asyncio.run(run())


def test_search_cache_is_role_scoped_and_returns_copies():
    async def run():
        provider = RecordedEvidenceProvider()
        cached = CachingSearchAdapter(provider)
        first = await cached.search("electric vehicle emissions", "support", 3)
        first[0].title = "mutated"
        second = await cached.search("electric vehicle emissions", "support", 3)
        counter = await cached.search("electric vehicle emissions", "counter", 3)
        assert second[0].title != "mutated"
        assert second[0].role == "support"
        assert counter[0].role == "counter"
    asyncio.run(run())


async def capture(events, kind, payload):
    events.append((kind, payload))


async def noop(kind, payload):
    return None
