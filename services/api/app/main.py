import json
import os
from datetime import timedelta
from pathlib import Path
from uuid import uuid4

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import ValidationError

from app.domain.models import (
    AudioChunkMetadata,
    Claim,
    ClassificationResult,
    Pairing,
    PushSubscription,
    SessionCreate,
    SessionCreated,
    Verdict,
    WsEnvelope,
    utcnow,
)
from app.persistence.repository import MemoryRepository, PostgresRepository, SQLiteRepository
from app.pipeline.hero import run_hero
from app.pipeline.live import LiveSession
from app.providers.fakes import FakeProviders
from app.providers.live import RecordedSttAdapter, configured_fast_classifier


mode = os.getenv("VERITY_REPOSITORY", "memory")
repo = (
    MemoryRepository()
    if mode == "memory"
    else PostgresRepository(os.environ["VERITY_DATABASE_URL"])
    if mode == "postgres"
    else SQLiteRepository(Path(os.getenv("VERITY_SQLITE", "verity.db")))
)
providers = FakeProviders()
live_sessions: dict[str, LiveSession] = {}
team_classifier = configured_fast_classifier()
app = FastAPI(title="Verity API", version="0.2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_origin_regex=r"chrome-extension://.*",
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["content-type"],
)


@app.get("/healthz")
def health():
    return {"status": "ok"}


@app.get("/readyz")
def ready():
    return {"status": "ready", "stt": "recorded", "classifier": team_classifier.name}


@app.post("/v1/sessions", response_model=SessionCreated, status_code=201)
def session(body: SessionCreate):
    sid = repo.create_session(body.idempotency_key, str(uuid4()))
    return SessionCreated(id=sid, credential=f"demo-{sid}", fixture_mode=body.fixture_mode)


@app.post("/v1/sessions/{session_id}/claims", response_model=Claim)
async def hero(session_id: str):
    return await run_hero(session_id, repo, providers, lambda _: __import__("asyncio").sleep(0))


@app.get("/v1/claims/{public_id}", response_model=Claim)
def claim(public_id: str):
    found = repo.get_claim(public_id)
    if not found:
        raise HTTPException(404, "claim not found")
    return found


@app.post("/v1/claims/{public_id}/verdict", response_model=Claim)
def verdict(public_id: str, body: Verdict):
    found = repo.get_claim(public_id)
    if not found:
        raise HTTPException(404, "claim not found")
    try:
        candidate = found.model_copy(deep=True)
        candidate.verdict = body
        found = Claim.model_validate(candidate.model_dump())
    except ValidationError as error:
        raise HTTPException(422, str(error)) from error
    repo.save_claim(found)
    return found


@app.post("/v1/pairings", response_model=Pairing)
def pairing():
    return Pairing(expires_at=utcnow() + timedelta(minutes=10))


@app.post("/v1/push-subscriptions", status_code=201)
def subscribe(body: PushSubscription):
    return {"id": body.device_id, "status": "registered"}


@app.delete("/v1/push-subscriptions/{subscription_id}", status_code=204)
def unsubscribe(subscription_id: str):
    return None


def _authenticated(ws: WebSocket, session_id: str) -> bool:
    return repo.has_session(session_id) and ws.query_params.get("credential") == f"demo-{session_id}"


@app.websocket("/v1/sessions/{session_id}/stream")
async def stream(ws: WebSocket, session_id: str):
    await ws.accept()
    server_sequence = 0
    client_sequence = -1

    async def send(event_type: str, payload: dict, sequence: int | None = None):
        nonlocal server_sequence
        server_sequence += 1
        await ws.send_json(
            {
                "type": event_type,
                "schema_version": "2",
                "session_id": session_id,
                "sequence": server_sequence if sequence is None else sequence,
                "payload": payload,
            }
        )

    runtime = live_sessions.get(session_id)
    if runtime:
        runtime.emit = send
    try:
        while True:
            message = await ws.receive()
            if message["type"] == "websocket.disconnect":
                break
            if message.get("text") is None:
                await send("error", {"code": "unexpected_binary"})
                continue
            try:
                env = WsEnvelope.model_validate(json.loads(message["text"]))
            except (json.JSONDecodeError, ValidationError):
                await send("error", {"code": "invalid_envelope"})
                continue
            if env.session_id != session_id:
                await send("error", {"code": "invalid_session"}, env.sequence)
                continue
            if env.sequence <= client_sequence:
                await send("error", {"code": "non_monotonic_sequence"}, env.sequence)
                continue
            client_sequence = env.sequence
            if env.type == "start_fixture":
                await send("ack", {"watermark": env.sequence}, env.sequence)

                async def emit_fixture(value: Claim):
                    await send("claim_state", {"public_id": value.public_id, "state": value.state})

                await run_hero(session_id, repo, providers, emit_fixture)
                continue
            if not _authenticated(ws, session_id):
                await send("error", {"code": "unauthorized"}, env.sequence)
                continue
            if env.type == "heartbeat":
                await send("heartbeat_ack", {}, env.sequence)
            elif env.type == "start_live":
                stream_id = str(env.payload.get("stream_id", ""))
                if not stream_id:
                    await send("error", {"code": "missing_stream_id"}, env.sequence)
                    continue
                runtime = live_sessions.get(session_id)
                if not runtime or runtime.closed:
                    runtime = LiveSession(
                        session_id=session_id,
                        repository=repo,
                        stt_adapter=RecordedSttAdapter(),
                        classifier=None if env.payload.get("dispatch_mode") == "client" else team_classifier,
                        emit=send,
                    )
                    live_sessions[session_id] = runtime
                else:
                    runtime.emit = send
                await runtime.start(stream_id)
                await send("ack", {"watermark": runtime.ledger.watermark}, env.sequence)
            elif env.type == "audio_chunk":
                if not runtime:
                    await send("error", {"code": "capture_not_started"}, env.sequence)
                    continue
                try:
                    metadata = AudioChunkMetadata.model_validate(env.payload)
                    audio_message = await ws.receive()
                    binary = audio_message.get("bytes")
                    if binary is None:
                        raise ValueError("audio metadata must be followed by one binary frame")
                    watermark = await runtime.audio(metadata, binary)
                    await send("audio_ack", {"watermark": watermark}, env.sequence)
                except (ValidationError, ValueError) as error:
                    await send("error", {"code": "invalid_audio", "detail": str(error)[:160]}, env.sequence)
            elif env.type == "classification_result":
                if not runtime:
                    await send("error", {"code": "capture_not_started"}, env.sequence)
                    continue
                try:
                    await runtime.classification(ClassificationResult.model_validate(env.payload))
                except ValidationError:
                    await send("error", {"code": "invalid_classification"}, env.sequence)
            elif env.type == "stop_live":
                if runtime:
                    await runtime.stop()
                    live_sessions.pop(session_id, None)
                await send("ack", {"watermark": env.sequence}, env.sequence)
            else:
                await send("error", {"code": "unknown_event"}, env.sequence)
    except WebSocketDisconnect:
        pass
