import os
from datetime import timedelta
from uuid import uuid4
from fastapi import FastAPI,HTTPException,WebSocket,WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import ValidationError
from app.domain.models import *
from app.persistence.repository import MemoryRepository,PostgresRepository,SQLiteRepository
from app.providers.fakes import FakeProviders
from app.pipeline.hero import run_hero
mode=os.getenv("VERITY_REPOSITORY","memory")
repo=(MemoryRepository() if mode=="memory" else PostgresRepository(os.environ["VERITY_DATABASE_URL"]) if mode=="postgres" else SQLiteRepository(__import__("pathlib").Path(os.getenv("VERITY_SQLITE","verity.db"))))
providers=FakeProviders(); app=FastAPI(title="Verity API",version="0.1.0")
app.add_middleware(CORSMiddleware,allow_origins=["http://localhost:5173","http://127.0.0.1:5173"],allow_origin_regex=r"chrome-extension://.*",allow_methods=["GET","POST","DELETE"],allow_headers=["content-type"])
@app.get("/healthz")
def health(): return {"status":"ok"}
@app.get("/readyz")
def ready(): return {"status":"ready","providers":"fake"}
@app.post("/v1/sessions",response_model=SessionCreated,status_code=201)
def session(body:SessionCreate):
    sid=repo.create_session(body.idempotency_key,str(uuid4())); return SessionCreated(id=sid,credential=f"demo-{sid}")
@app.post("/v1/sessions/{session_id}/claims",response_model=Claim)
async def hero(session_id:str): return await run_hero(session_id,repo,providers,lambda _: __import__("asyncio").sleep(0))
@app.get("/v1/claims/{public_id}",response_model=Claim)
def claim(public_id:str):
    found=repo.get_claim(public_id)
    if not found: raise HTTPException(404,"claim not found")
    return found
@app.post("/v1/claims/{public_id}/verdict",response_model=Claim)
def verdict(public_id:str,body:Verdict):
    found=repo.get_claim(public_id)
    if not found: raise HTTPException(404,"claim not found")
    try:
        candidate=found.model_copy(deep=True); candidate.verdict=body; found=Claim.model_validate(candidate.model_dump())
    except ValidationError as error: raise HTTPException(422,str(error)) from error
    repo.save_claim(found); return found
@app.post("/v1/pairings",response_model=Pairing)
def pairing(): return Pairing(expires_at=utcnow()+timedelta(minutes=10))
@app.post("/v1/push-subscriptions",status_code=201)
def subscribe(body:PushSubscription): return {"id":body.device_id,"status":"registered"}
@app.delete("/v1/push-subscriptions/{subscription_id}",status_code=204)
def unsubscribe(subscription_id:str): return None
@app.websocket("/v1/sessions/{session_id}/stream")
async def stream(ws:WebSocket,session_id:str):
    await ws.accept(); last=-1
    try:
        while True:
            env=WsEnvelope.model_validate(await ws.receive_json())
            if env.session_id!=session_id or env.sequence<=last: await ws.send_json({"type":"error","detail":"invalid session or non-monotonic sequence"}); continue
            last=env.sequence; await ws.send_json({"type":"ack","schema_version":"1","session_id":session_id,"sequence":last,"payload":{}})
            if env.type=="start_fixture":
                async def emit(c): await ws.send_json({"type":"claim_state","schema_version":"1","session_id":session_id,"sequence":last,"payload":{"public_id":c.public_id,"state":c.state}})
                await run_hero(session_id,repo,providers,emit)
    except WebSocketDisconnect: pass
