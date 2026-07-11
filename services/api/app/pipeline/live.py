import asyncio
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from uuid import uuid4

from app.domain.live import AudioLedger, ClaimDeduplicator, SentenceAssembler, digest
from app.domain.models import (
    AudioChunkMetadata,
    Claim,
    ClaimCandidate,
    ClaimState,
    Classification,
    ClassificationResult,
    TranscriptSegment,
    utcnow,
)
from app.persistence.repository import Repository
from app.pipeline.evidence import EvidencePipeline
from app.providers.live import FastClassifier, SttAdapter, SttSession


EventSink = Callable[[str, dict], Awaitable[None]]


@dataclass
class LiveSession:
    session_id: str
    repository: Repository
    stt_adapter: SttAdapter
    classifier: FastClassifier | None
    emit: EventSink
    evidence_pipeline: EvidencePipeline | None = None
    max_candidates: int = 4
    ledger: AudioLedger = field(default_factory=AudioLedger)
    assembler: SentenceAssembler = field(default_factory=SentenceAssembler)
    deduplicator: ClaimDeduplicator = field(default_factory=ClaimDeduplicator)
    stt: SttSession | None = None
    stream_id: str | None = None
    closed: bool = False
    candidates: dict[str, ClaimCandidate] = field(default_factory=dict)
    tasks: set[asyncio.Task] = field(default_factory=set)

    async def start(self, stream_id: str) -> None:
        if self.stt and self.stream_id != stream_id:
            raise ValueError("a capture stream is already active")
        if not self.stt:
            self.stream_id = stream_id
            self.stt = await self.stt_adapter.connect(self.session_id, self.on_transcript)
            await self.emit("capture_state", {"state": "LISTENING", "provider": self.stt_adapter.name})

    async def audio(self, metadata: AudioChunkMetadata, body: bytes) -> int:
        if self.closed or not self.stt or metadata.stream_id != self.stream_id:
            raise ValueError("audio stream is not active")
        if len(body) != metadata.byte_length:
            raise ValueError("audio byte length does not match metadata")
        accepted, watermark = self.ledger.accept(metadata.chunk_sequence)
        if accepted:
            await self.stt.send(body, metadata.chunk_sequence)
        return watermark

    async def on_transcript(self, segment: TranscriptSegment) -> None:
        if self.closed or not self.repository.save_transcript(self.session_id, segment):
            return
        await self.emit("transcript_final", segment.model_dump(mode="json"))
        for candidate in self.assembler.add(segment):
            await self._schedule(candidate)

    async def _schedule(self, candidate: ClaimCandidate) -> None:
        if len(self.candidates) >= self.max_candidates:
            await self.emit("candidate_skipped", {"candidate_id": candidate.candidate_id, "reason": "capacity"})
            return
        self.candidates[candidate.candidate_id] = candidate
        await self.emit("classification_request", candidate.model_dump(mode="json"))
        if self.classifier is None:
            return
        task = asyncio.create_task(self._classify(candidate))
        self.tasks.add(task)
        task.add_done_callback(self.tasks.discard)

    async def _classify(self, candidate: ClaimCandidate) -> None:
        try:
            result = await asyncio.wait_for(self.classifier.classify(candidate), timeout=4)
            await self.classification(result)
        except (TimeoutError, ValueError):
            self.candidates.pop(candidate.candidate_id, None)
            await self.emit("classification_failed", {"candidate_id": candidate.candidate_id, "reason": "invalid_or_timeout"})

    async def classification(self, result: ClassificationResult) -> Claim | None:
        candidate = self.candidates.pop(result.candidate_id, None)
        if self.closed or not candidate:
            await self.emit("classification_stale", {"candidate_id": result.candidate_id})
            return None
        if result.classification != Classification.factual_claim:
            await self.emit(
                "candidate_classified",
                {"candidate_id": candidate.candidate_id, "classification": result.classification.value},
            )
            return None
        assert result.normalized_claim
        if not self.deduplicator.accept(result.normalized_claim, candidate.end_ms):
            await self.emit("candidate_duplicate", {"candidate_id": candidate.candidate_id})
            return None
        public_id = f"claim-{digest(self.session_id, result.normalized_claim)}"
        claim = Claim(
            public_id=public_id,
            session_id=self.session_id,
            speaker_label=f"Speaker {candidate.speaker}",
            exact_text=candidate.exact_text,
            normalized_text=result.normalized_claim,
            start_ms=candidate.start_ms,
            end_ms=candidate.end_ms,
            classification=result.classification,
            state=ClaimState.CHECKING,
            created_at=utcnow(),
            fixture_mode=self.stt_adapter.name == "recorded",
        )
        created = self.repository.create_claim(claim, result)
        if not created:
            await self.emit("candidate_duplicate", {"candidate_id": candidate.candidate_id})
            return self.repository.get_claim(public_id)
        await self.emit(
            "claim_state",
            {"public_id": claim.public_id, "state": claim.state, "claim": claim.model_dump(mode="json")},
        )
        if self.evidence_pipeline:
            task = asyncio.create_task(self.evidence_pipeline.run(claim.model_copy(deep=True), result))
            self.tasks.add(task)
            task.add_done_callback(self.tasks.discard)
        return claim

    async def stop(self) -> None:
        if self.closed:
            return
        for candidate in self.assembler.flush():
            await self._schedule(candidate)
        if self.tasks:
            await asyncio.gather(*self.tasks, return_exceptions=True)
        self.closed = True
        if self.stt:
            await self.stt.close()
        await self.emit("capture_state", {"state": "STOPPED"})


def new_stream_id() -> str:
    return str(uuid4())
