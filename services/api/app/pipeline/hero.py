import asyncio
from datetime import datetime
from app.domain.models import Claim,ClaimState,Evidence,Verdict
from app.domain.state import transition
async def run_hero(session_id,repo,providers,emit):
    data=await providers.hero(); c=Claim.model_validate({**data["claim"],"session_id":session_id,"state":"CAPTURING","evidence":[],"verdict":None})
    repo.save_claim(c); await emit(c)
    for state in [ClaimState.TRANSCRIBING,ClaimState.CLAIM_CANDIDATE,ClaimState.CHECKING]: c.state=transition(c.state,state); repo.save_claim(c); await emit(c)
    support,counter=await asyncio.gather(asyncio.sleep(0,result=data["evidence"][:2]),asyncio.sleep(0,result=data["evidence"][2:]))
    c.evidence=[Evidence.model_validate(x) for x in support+counter]; c.state=transition(c.state,ClaimState.EVIDENCE_READY); repo.save_claim(c); await emit(c)
    c.state=transition(c.state,ClaimState.SYNTHESIZING); repo.save_claim(c); await emit(c)
    c.verdict=Verdict.model_validate(data["verdict"]); c.state=transition(c.state,ClaimState.COMPLETE); c.completed_at=datetime.fromisoformat(data["completed_at"]); c=Claim.model_validate(c.model_dump()); repo.save_claim(c); await providers.push(c.public_id); await emit(c); return c
