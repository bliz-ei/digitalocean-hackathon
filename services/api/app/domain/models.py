from datetime import datetime, timezone
from enum import StrEnum
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, model_validator


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Classification(StrEnum):
    opinion = "opinion"
    factual_claim = "factual_claim"
    unverifiable = "unverifiable"


class ClaimState(StrEnum):
    CAPTURING = "CAPTURING"
    TRANSCRIBING = "TRANSCRIBING"
    CLAIM_CANDIDATE = "CLAIM_CANDIDATE"
    CHECKING = "CHECKING"
    EVIDENCE_READY = "EVIDENCE_READY"
    SYNTHESIZING = "SYNTHESIZING"
    COMPLETE = "COMPLETE"
    INSUFFICIENT_EVIDENCE = "INSUFFICIENT_EVIDENCE"
    FAILED = "FAILED"


class VerdictLabel(StrEnum):
    Supported = "Supported"
    Misleading = "Misleading"
    Disputed = "Disputed"
    Unsupported = "Unsupported"
    InsufficientEvidence = "Insufficient evidence"


class Stance(StrEnum):
    support = "support"
    counter = "counter"
    context = "context"


class SourceTier(StrEnum):
    primary = "primary"
    research = "research"
    established = "established"
    other = "other"


class SearchRole(StrEnum):
    neutral = "neutral"
    support = "support"
    counter = "counter"


class SearchResult(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str = Field(min_length=1, max_length=300)
    url: HttpUrl
    publisher: str = Field(min_length=1, max_length=160)
    published_at: datetime | None = None
    snippet: str = Field(default="", max_length=1_000)
    rank: int = Field(ge=0)
    query: str = Field(min_length=1, max_length=240)
    role: SearchRole
    provider: str = Field(min_length=1, max_length=80)


class ExtractedPage(BaseModel):
    model_config = ConfigDict(extra="forbid")
    canonical_url: HttpUrl
    title: str = Field(min_length=1, max_length=300)
    publisher: str = Field(min_length=1, max_length=160)
    published_at: datetime | None = None
    retrieved_at: datetime
    text: str = Field(min_length=1, max_length=500_000)
    content_hash: str = Field(min_length=16, max_length=128)


class Evidence(BaseModel):
    id: str
    stance: Stance
    title: str
    canonical_url: HttpUrl
    publisher: str
    published_at: datetime | None = None
    retrieved_at: datetime
    excerpt: str
    source_tier: SourceTier
    content_hash: str
    query_role: SearchRole = SearchRole.neutral
    independent_key: str = Field(default="legacy", min_length=1, max_length=200)


class EvidenceRecord(BaseModel):
    evidence: Evidence
    captured_text: str = Field(min_length=1, max_length=500_000)


class Verdict(BaseModel):
    label: VerdictLabel
    confidence: float = Field(ge=0, le=1)
    explanation: str
    uncertainty: str
    counterevidence_summary: str
    common_ground: str | None = None
    citation_ids: list[str]
    model_provider: str = "fake"
    model_name: str = "hero-fixture"
    prompt_version: str = "phase1"


class VerdictDraft(BaseModel):
    model_config = ConfigDict(extra="forbid")
    claim_public_id: str
    label: VerdictLabel
    confidence: float = Field(ge=0, le=1)
    explanation: str = Field(min_length=1, max_length=700)
    uncertainty: str = Field(min_length=1, max_length=500)
    counterevidence_summary: str = Field(min_length=1, max_length=500)
    common_ground: str | None = Field(default=None, max_length=400)
    citation_ids: list[str] = Field(min_length=1, max_length=3)
    model_provider: str = Field(min_length=1, max_length=80)
    model_name: str = Field(min_length=1, max_length=120)
    prompt_version: Literal["phase3-v1"] = "phase3-v1"


class Claim(BaseModel):
    public_id: str
    session_id: str
    speaker_label: str
    exact_text: str = Field(min_length=1)
    normalized_text: str = Field(min_length=1)
    start_ms: int = Field(ge=0)
    end_ms: int = Field(ge=0)
    classification: Classification
    state: ClaimState
    created_at: datetime
    completed_at: datetime | None = None
    evidence: list[Evidence] = Field(default_factory=list)
    verdict: Verdict | None = None
    fixture_mode: bool = True

    @model_validator(mode="after")
    def validate_verdict(self):
        if self.end_ms < self.start_ms:
            raise ValueError("end_ms must be greater than or equal to start_ms")
        if self.verdict:
            owned = {e.id for e in self.evidence}
            if not set(self.verdict.citation_ids) <= owned:
                raise ValueError("citation does not belong to claim")
            if len(self.verdict.citation_ids) != len(set(self.verdict.citation_ids)):
                raise ValueError("citations must be unique")
            if self.verdict.label != VerdictLabel.InsufficientEvidence and not 2 <= len(self.verdict.citation_ids) <= 3:
                raise ValueError("completed verdict requires 2-3 citations")
        if self.state == ClaimState.COMPLETE and not self.verdict:
            raise ValueError("complete claims require a verdict")
        return self


class SessionCreate(BaseModel):
    video_url: str = "https://youtube.com/watch?v=hero"
    video_title: str = "Hero demo"
    idempotency_key: str = Field(min_length=1, max_length=128)
    fixture_mode: bool = True


class SessionCreated(BaseModel):
    id: str
    credential: str
    fixture_mode: bool = True


class Pairing(BaseModel):
    code: str = "123456"
    expires_at: datetime


class PushSubscription(BaseModel):
    device_id: str
    endpoint: str = "fake://local"


class WsEnvelope(BaseModel):
    type: str
    schema_version: str = "2"
    session_id: str
    sequence: int = Field(ge=0)
    payload: dict[str, Any] = Field(default_factory=dict)


class AudioChunkMetadata(BaseModel):
    stream_id: str = Field(min_length=1, max_length=128)
    chunk_sequence: int = Field(ge=0)
    captured_at_ms: int = Field(ge=0)
    duration_ms: int = Field(gt=0, le=2_000)
    mime_type: str = Field(pattern=r"^audio/webm(?:;codecs=opus)?$")
    sample_rate: int = Field(gt=0, le=96_000)
    channels: int = Field(ge=1, le=2)
    byte_length: int = Field(gt=0, le=256_000)


class TranscriptSegment(BaseModel):
    segment_id: str = Field(min_length=1, max_length=160)
    speaker: str = Field(pattern=r"^[A-Z]$")
    text: str = Field(min_length=1, max_length=2_000)
    start_ms: int = Field(ge=0)
    end_ms: int = Field(ge=0)
    is_final: bool = True

    @model_validator(mode="after")
    def validate_times(self):
        if self.end_ms < self.start_ms:
            raise ValueError("end_ms must be greater than or equal to start_ms")
        return self


class ClaimCandidate(BaseModel):
    candidate_id: str
    speaker: str = Field(pattern=r"^[A-Z]$")
    exact_text: str = Field(min_length=1, max_length=2_000)
    normalized_text: str = Field(min_length=1, max_length=2_000)
    start_ms: int = Field(ge=0)
    end_ms: int = Field(ge=0)
    context_before: str = Field(default="", max_length=500)


class ClassificationResult(BaseModel):
    model_config = ConfigDict(extra="forbid")
    candidate_id: str
    classification: Classification
    normalized_claim: str | None = Field(default=None, max_length=500)
    neutral_queries: list[str] = Field(default_factory=list, max_length=3)
    support_queries: list[str] = Field(default_factory=list, max_length=3)
    counter_queries: list[str] = Field(default_factory=list, max_length=3)
    prompt_version: Literal["phase2-v1"] = "phase2-v1"
    provider: str = Field(default="recorded", max_length=80)
    model: str = Field(default="deterministic", max_length=120)

    @model_validator(mode="after")
    def validate_factual_shape(self):
        query_lists = (self.neutral_queries, self.support_queries, self.counter_queries)
        if any(len(query) > 240 or not query.strip() for queries in query_lists for query in queries):
            raise ValueError("queries must be non-empty and at most 240 characters")
        if self.classification == Classification.factual_claim:
            if not self.normalized_claim or not all(query_lists):
                raise ValueError("factual claims require a normalized claim and all query roles")
        elif self.normalized_claim is not None or any(query_lists):
            raise ValueError("non-factual results cannot include claims or search queries")
        return self


class ErrorEnvelope(BaseModel):
    error: str
    detail: str
