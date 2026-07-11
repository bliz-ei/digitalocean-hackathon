from datetime import datetime, timezone
from enum import StrEnum
from typing import Any
from pydantic import BaseModel, Field, HttpUrl, model_validator

def utcnow() -> datetime: return datetime.now(timezone.utc)

class Classification(StrEnum): opinion="opinion"; factual_claim="factual_claim"; unverifiable="unverifiable"
class ClaimState(StrEnum):
    CAPTURING="CAPTURING"; TRANSCRIBING="TRANSCRIBING"; CLAIM_CANDIDATE="CLAIM_CANDIDATE"; CHECKING="CHECKING"; EVIDENCE_READY="EVIDENCE_READY"; SYNTHESIZING="SYNTHESIZING"; COMPLETE="COMPLETE"; INSUFFICIENT_EVIDENCE="INSUFFICIENT_EVIDENCE"; FAILED="FAILED"
class VerdictLabel(StrEnum): Supported="Supported"; Misleading="Misleading"; Disputed="Disputed"; Unsupported="Unsupported"; InsufficientEvidence="Insufficient evidence"
class Stance(StrEnum): support="support"; counter="counter"; context="context"
class SourceTier(StrEnum): primary="primary"; research="research"; established="established"

class Evidence(BaseModel):
    id: str; stance: Stance; title: str; canonical_url: HttpUrl; publisher: str; published_at: datetime; retrieved_at: datetime; excerpt: str; source_tier: SourceTier; content_hash: str
class Verdict(BaseModel):
    label: VerdictLabel; confidence: float=Field(ge=0,le=1); explanation: str; uncertainty: str; counterevidence_summary: str; common_ground: str|None=None; citation_ids:list[str]; model_provider:str="fake"; model_name:str="hero-fixture"; prompt_version:str="phase1"
class Claim(BaseModel):
    public_id:str; session_id:str; speaker_label:str; exact_text:str=Field(min_length=1); normalized_text:str=Field(min_length=1); start_ms:int=Field(ge=0); end_ms:int=Field(ge=0); classification:Classification; state:ClaimState; created_at:datetime; completed_at:datetime|None=None; evidence:list[Evidence]=Field(default_factory=list); verdict:Verdict|None=None; fixture_mode:bool=True
    @model_validator(mode="after")
    def validate_verdict(self):
        if self.end_ms < self.start_ms: raise ValueError("end_ms must be greater than or equal to start_ms")
        if self.verdict:
            owned={e.id for e in self.evidence}
            if not set(self.verdict.citation_ids)<=owned: raise ValueError("citation does not belong to claim")
            if self.verdict.label != VerdictLabel.InsufficientEvidence and not 2 <= len(self.verdict.citation_ids) <= 3: raise ValueError("completed verdict requires 2-3 citations")
        return self
class SessionCreate(BaseModel): video_url:str="https://youtube.com/watch?v=hero"; video_title:str="Hero demo"; idempotency_key:str=Field(min_length=1,max_length=128)
class SessionCreated(BaseModel): id:str; credential:str; fixture_mode:bool=True
class Pairing(BaseModel): code:str="123456"; expires_at:datetime
class PushSubscription(BaseModel): device_id:str; endpoint:str="fake://local"
class WsEnvelope(BaseModel): type:str; schema_version:str="1"; session_id:str; sequence:int=Field(ge=0); payload:dict[str,Any]=Field(default_factory=dict)
class ErrorEnvelope(BaseModel): error:str; detail:str
