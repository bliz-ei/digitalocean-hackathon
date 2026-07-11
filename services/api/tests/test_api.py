from app.domain.models import ClaimState

def create_session(client, key="same-key"):
    response = client.post("/v1/sessions", json={"idempotency_key": key})
    assert response.status_code == 201
    return response.json()

def test_health_and_public_not_found(client):
    assert client.get("/healthz").json() == {"status": "ok"}
    response = client.get("/v1/claims/missing")
    assert response.status_code == 404

def test_session_creation_is_idempotent(client):
    first = create_session(client)
    second = create_session(client)
    assert first["id"] == second["id"]
    assert first["credential"] == second["credential"]

def test_session_validation(client):
    response = client.post("/v1/sessions", json={"idempotency_key": ""})
    assert response.status_code == 422

def test_fixture_pipeline_and_public_read(client):
    session = create_session(client, "pipeline")
    completed = client.post(f'/v1/sessions/{session["id"]}/claims')
    assert completed.status_code == 200
    body = completed.json()
    assert body["state"] == "COMPLETE"
    assert len(body["evidence"]) == 3
    assert body["verdict"]["citation_ids"] == ["epa-1", "doe-1", "icct-1"]
    assert client.get(f'/v1/claims/{body["public_id"]}').json() == body

def test_websocket_emits_all_pipeline_states_and_replay_does_not_duplicate(client):
    session = create_session(client, "socket")
    with client.websocket_connect(f'/v1/sessions/{session["id"]}/stream') as ws:
        message = {"type":"start_fixture", "session_id":session["id"], "sequence":1, "payload":{}}
        ws.send_json(message)
        assert ws.receive_json()["type"] == "ack"
        states = [ws.receive_json()["payload"]["state"] for _ in range(7)]
        assert states == [state.value for state in list(ClaimState)[:7]]
        ws.send_json(message)
        assert ws.receive_json()["type"] == "error"

def test_verdict_validation_rejects_foreign_citation(client):
    session = create_session(client, "verdict")
    claim = client.post(f'/v1/sessions/{session["id"]}/claims').json()
    verdict = {**claim["verdict"], "citation_ids": ["missing", "doe-1"]}
    response = client.post(f'/v1/claims/{claim["public_id"]}/verdict', json=verdict)
    assert response.status_code == 422
    persisted = client.get(f'/v1/claims/{claim["public_id"]}').json()
    assert persisted["verdict"]["citation_ids"] == claim["verdict"]["citation_ids"]
