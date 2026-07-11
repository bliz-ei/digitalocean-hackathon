from app.domain.models import Claim, ClaimState, ClassificationResult
from app.domain.state import transition
from app.pipeline.evidence import EvidencePipeline
from app.providers.evidence import RecordedEvidenceProvider, SearchEvidenceCollector


async def run_hero(session_id, repository, providers, emit):
    data = await providers.hero()
    claim = Claim.model_validate(
        {
            **data["claim"],
            "session_id": session_id,
            "state": ClaimState.CAPTURING,
            "evidence": [],
            "verdict": None,
            "fixture_mode": True,
        }
    )
    repository.save_claim(claim)
    await emit(claim)
    for state in (ClaimState.TRANSCRIBING, ClaimState.CLAIM_CANDIDATE, ClaimState.CHECKING):
        claim.state = transition(claim.state, state)
        repository.save_claim(claim)
        await emit(claim)

    async def relay(_kind: str, payload: dict) -> None:
        value = payload.get("claim")
        if value:
            await emit(Claim.model_validate(value))

    recorded = RecordedEvidenceProvider()
    result = ClassificationResult(
        candidate_id="hero-fixture",
        classification="factual_claim",
        normalized_claim=claim.normalized_text,
        neutral_queries=["electric vehicle lifecycle carbon emissions"],
        support_queries=["electric vehicle zero direct emissions"],
        counter_queries=["electric vehicle manufacturing lifecycle emissions"],
    )
    completed = await EvidencePipeline(repository, SearchEvidenceCollector(recorded, recorded), recorded, relay).run(claim, result)
    await providers.push(completed.public_id)
    return completed
