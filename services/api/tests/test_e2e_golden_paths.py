"""End-to-end golden paths for the demo, driven over the real HTTP/WebSocket API.

Each test exercises a complete demo journey against the FastAPI app with the
providers the demo will actually run on (recorded fixtures or injected-failure
primaries), asserting the terminal state a presenter depends on: a COMPLETE
verdict with validated citations, a persisted public claim page, and exactly
one push notification to the paired phone.
"""

import json
from itertools import count
from pathlib import Path

from app import main
from app.cross_device import CrossDeviceCoordinator, FakePushAdapter
from app.providers.evidence import (
    FallbackEvidenceCollector,
    GradientEvidenceCollector,
    RecordedEvidenceProvider,
    SafePageFetcher,
    SearchEvidenceCollector,
)
from app.providers.live import DeepgramSttAdapter, FallbackSttAdapter, RecordedSttAdapter


ROOT = Path(__file__).parents[3]
HERO_DRAFT = json.loads((ROOT / "fixtures/hero-demo/phase3-evidence.json").read_text())["drafts"][0]
CHUNK_METADATA = {
    "stream_id": "e2e-stream",
    "duration_ms": 1000,
    "mime_type": "audio/webm;codecs=opus",
    "sample_rate": 48000,
    "channels": 1,
}


def create_session(client, key):
    response = client.post("/v1/sessions", json={"idempotency_key": key})
    assert response.status_code == 201
    return response.json()


def pair_phone(client, session_id):
    """Pair a device and register a push subscription, returning the fake push sink."""
    push = FakePushAdapter()
    main.cross_device = CrossDeviceCoordinator(secret="e2e-golden", push=push)
    pairing = client.post("/v1/pairings", json={"session_id": session_id}).json()
    device = client.post("/v1/pairings/redeem", json={"code": pairing["code"], "device_label": "Demo iPhone"}).json()
    subscription = client.post("/v1/push-subscriptions", json={
        "device_id": device["device_id"],
        "device_token": device["device_token"],
        "endpoint": "https://push.example/e2e",
        "p256dh": "p" * 32,
        "auth": "a" * 16,
    })
    assert subscription.status_code == 201
    return push


def send(ws, session_id, sequence, event_type, payload):
    ws.send_json({"type": event_type, "schema_version": "2", "session_id": session_id, "sequence": sequence, "payload": payload})


def send_chunk(ws, session_id, sequence, chunk_sequence):
    body = b"opus"
    metadata = {**CHUNK_METADATA, "chunk_sequence": chunk_sequence, "captured_at_ms": chunk_sequence * 1000, "byte_length": len(body)}
    send(ws, session_id, sequence, "audio_chunk", metadata)
    ws.send_bytes(body)


def drain_until(ws, events, *types, limit=200):
    for _ in range(limit):
        event = ws.receive_json()
        events.append(event)
        if event["type"] in types:
            return event
    raise AssertionError(f"never received {types}; saw {[item['type'] for item in events]}")


def start_live(client, ws, session_id, sequence, dispatch_mode="server"):
    events = []
    send(ws, session_id, next(sequence), "start_live", {"stream_id": "e2e-stream", "dispatch_mode": dispatch_mode})
    drain_until(ws, events, "ack", limit=5)
    assert any(item["type"] == "capture_state" and item["payload"]["state"] == "LISTENING" for item in events)
    return events


def assert_hero_verdict(claim):
    assert claim["state"] == "COMPLETE"
    assert claim["verdict"]["label"] == "Misleading"
    assert 2 <= len(claim["verdict"]["citation_ids"]) <= 3
    cited = {item["id"]: item for item in claim["evidence"]}
    assert all(citation in cited for citation in claim["verdict"]["citation_ids"])
    stances = {cited[citation]["stance"] for citation in claim["verdict"]["citation_ids"]}
    assert "counter" in stances, "the demo verdict must surface counterevidence"


def test_live_demo_reaches_verdict_and_notifies_the_paired_phone(client):
    """The main demo: live capture -> transcripts -> claim -> validated verdict -> push."""
    session = create_session(client, "e2e-live-server")
    push = pair_phone(client, session["id"])
    sequence = count(1)
    with client.websocket_connect(f'/v1/sessions/{session["id"]}/stream?credential={session["credential"]}') as ws:
        events = start_live(client, ws, session["id"], sequence)
        send_chunk(ws, session["id"], next(sequence), 0)
        send_chunk(ws, session["id"], next(sequence), 1)
        final = drain_until(ws, events, "verdict_complete")
        claim = final["payload"]["claim"]
        assert_hero_verdict(claim)
        assert claim["fixture_mode"] is True, "recorded STT must disclose fixture mode"
        transcripts = [item["payload"]["text"] for item in events if item["type"] == "transcript_final"]
        assert "Electric vehicles produce no carbon emissions." in transcripts
        send(ws, session["id"], next(sequence), "stop_live", {})
        drain_until(ws, events, "ack")

    persisted = client.get(f'/v1/claims/{claim["public_id"]}').json()
    assert persisted["state"] == "COMPLETE"
    assert persisted["verdict"]["citation_ids"] == claim["verdict"]["citation_ids"]
    assert len(push.deliveries) == 1
    notification = push.deliveries[0][1]
    assert notification["public_id"] == claim["public_id"]
    assert notification["notification_id"] == f'claim:{claim["public_id"]}'


def test_byok_client_dispatch_round_trip_completes_the_verdict(client):
    """The BYOK demo: server requests classification and synthesis; the client answers."""
    session = create_session(client, "e2e-live-client")
    sequence = count(1)
    with client.websocket_connect(f'/v1/sessions/{session["id"]}/stream?credential={session["credential"]}') as ws:
        events = start_live(client, ws, session["id"], sequence, dispatch_mode="client")
        send_chunk(ws, session["id"], next(sequence), 0)
        send_chunk(ws, session["id"], next(sequence), 1)

        answered = 0
        while answered < 2:
            request = drain_until(ws, events, "classification_request")["payload"]
            if "electric vehicles produce no carbon emissions" in request["normalized_text"].casefold():
                result = {
                    "candidate_id": request["candidate_id"],
                    "classification": "factual_claim",
                    "normalized_claim": "Electric vehicles produce no carbon emissions",
                    "neutral_queries": ["electric vehicle lifecycle carbon emissions"],
                    "support_queries": ["electric vehicle zero direct emissions"],
                    "counter_queries": ["electric vehicle manufacturing lifecycle emissions"],
                }
            else:
                result = {"candidate_id": request["candidate_id"], "classification": "opinion"}
            send(ws, session["id"], next(sequence), "classification_result", result)
            answered += 1

        synthesis = drain_until(ws, events, "synthesis_request")["payload"]
        by_publisher = {item["publisher"]: item["id"] for item in synthesis["evidence"]}
        draft = {
            key: value for key, value in HERO_DRAFT.items() if key != "citation_publishers"
        } | {
            "claim_public_id": synthesis["claim"]["public_id"],
            "citation_ids": [by_publisher[name] for name in HERO_DRAFT["citation_publishers"] if name in by_publisher],
            "model_provider": "client",
            "model_name": "byok-e2e",
        }
        send(ws, session["id"], next(sequence), "verdict_draft", draft)
        final = drain_until(ws, events, "verdict_complete")
        claim = final["payload"]["claim"]
        assert_hero_verdict(claim)
        assert claim["verdict"]["model_name"] == "byok-e2e"

    persisted = client.get(f'/v1/claims/{claim["public_id"]}').json()
    assert persisted["state"] == "COMPLETE"


def test_deepgram_outage_degrades_the_live_demo_to_the_disclosed_fixture(client, monkeypatch):
    """Deepgram down on stage: capture still starts, transcripts flow, disclosure holds."""
    async def unreachable(url, additional_headers):
        raise OSError("deepgram unreachable")

    monkeypatch.setattr(
        main, "stt_adapter",
        FallbackSttAdapter(DeepgramSttAdapter("bad-key", connector=unreachable), RecordedSttAdapter()),
    )
    session = create_session(client, "e2e-stt-failover")
    sequence = count(1)
    with client.websocket_connect(f'/v1/sessions/{session["id"]}/stream?credential={session["credential"]}') as ws:
        events = start_live(client, ws, session["id"], sequence)
        capture = next(item for item in events if item["type"] == "capture_state")
        assert capture["payload"]["provider"] == "recorded"
        send_chunk(ws, session["id"], next(sequence), 0)
        drain_until(ws, events, "transcript_final")
    assert client.get("/readyz").json()["stt"] == "recorded"


def test_gradient_outage_still_completes_the_verdict_on_recorded_evidence(client, monkeypatch):
    """Gradient down on stage: evidence degrades to the recorded fixture, verdict completes."""
    recorded = RecordedEvidenceProvider()
    collector = FallbackEvidenceCollector(
        GradientEvidenceCollector("https://127.0.0.1:9", "bad-key", SafePageFetcher(), timeout=0.5),
        SearchEvidenceCollector(recorded, recorded),
    )
    monkeypatch.setattr(main, "evidence_collector", collector)
    session = create_session(client, "e2e-evidence-failover")
    sequence = count(1)
    with client.websocket_connect(f'/v1/sessions/{session["id"]}/stream?credential={session["credential"]}') as ws:
        events = start_live(client, ws, session["id"], sequence)
        send_chunk(ws, session["id"], next(sequence), 0)
        send_chunk(ws, session["id"], next(sequence), 1)
        final = drain_until(ws, events, "verdict_complete")
        assert_hero_verdict(final["payload"]["claim"])
    assert collector.name == "recorded"
    assert client.get("/readyz").json()["evidence"] == "recorded"


def test_three_consecutive_demo_runs_stay_deterministic(client):
    """The runbook release gate: three fresh sessions, identical canonical outcomes."""
    outcomes = []
    for index in range(3):
        session = create_session(client, f"e2e-consecutive-{index}")
        sequence = count(1)
        with client.websocket_connect(f'/v1/sessions/{session["id"]}/stream?credential={session["credential"]}') as ws:
            events = start_live(client, ws, session["id"], sequence)
            send_chunk(ws, session["id"], next(sequence), 0)
            send_chunk(ws, session["id"], next(sequence), 1)
            claim = drain_until(ws, events, "verdict_complete")["payload"]["claim"]
            send(ws, session["id"], next(sequence), "stop_live", {})
            drain_until(ws, events, "ack")
        assert_hero_verdict(claim)
        outcomes.append((claim["verdict"]["label"], len(claim["verdict"]["citation_ids"]), claim["normalized_text"]))
        main.live_sessions.clear()
    assert len(set(outcomes)) == 1, f"demo runs diverged: {outcomes}"
