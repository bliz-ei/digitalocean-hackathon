"""Release-gate rehearsal: consecutive end-to-end demo runs against a live API.

Automates the runbook's "three consecutive runs" gate against a local or deployed
deployment: readiness matrix, a full fixture claim to COMPLETE with validated
citations inside a time budget, canonical persistence, and a live WebSocket
heartbeat through whatever proxy fronts the API.

    VERITY_HEALTH_URL=https://<app-url> npm run demo:rehearsal
"""

import argparse
import asyncio
import json
import os
import sys
import time
import uuid
from urllib.request import Request, urlopen


def call(method: str, url: str, body: dict | None = None) -> dict:
    data = json.dumps(body).encode() if body is not None else None
    request = Request(url, data=data, headers={"content-type": "application/json"}, method=method)
    with urlopen(request, timeout=30) as response:
        return json.loads(response.read())


async def heartbeat(base: str, session: dict) -> None:
    from websockets.asyncio.client import connect

    ws_base = base.replace("https:", "wss:", 1).replace("http:", "ws:", 1)
    url = f"{ws_base}/v1/sessions/{session['id']}/stream?credential={session['credential']}"
    async with connect(url) as socket:
        await socket.send(json.dumps({
            "type": "heartbeat", "schema_version": "2",
            "session_id": session["id"], "sequence": 1, "payload": {},
        }))
        reply = json.loads(await asyncio.wait_for(socket.recv(), timeout=10))
    if reply["type"] != "heartbeat_ack":
        raise AssertionError(f"expected heartbeat_ack, received {reply['type']}")


def rehearse(base: str, run: int, budget: float) -> None:
    started = time.monotonic()
    session = call("POST", f"{base}/v1/sessions", {"idempotency_key": f"rehearsal-{uuid.uuid4()}"})
    claim = call("POST", f"{base}/v1/sessions/{session['id']}/claims")
    elapsed = time.monotonic() - started
    if claim["state"] != "COMPLETE":
        raise AssertionError(f"claim finished in state {claim['state']}")
    citations = claim["verdict"]["citation_ids"]
    if not 2 <= len(citations) <= 3:
        raise AssertionError(f"expected 2-3 citations, found {len(citations)}")
    evidence_ids = {item["id"] for item in claim["evidence"]}
    if not set(citations) <= evidence_ids:
        raise AssertionError("verdict cites evidence that was not persisted")
    persisted = call("GET", f"{base}/v1/claims/{claim['public_id']}")
    if persisted["verdict"]["citation_ids"] != citations:
        raise AssertionError("public claim page diverges from the pipeline result")
    if elapsed > budget:
        raise AssertionError(f"run took {elapsed:.1f}s, budget is {budget:.0f}s")
    asyncio.run(heartbeat(base, session))
    print(f"run {run}: COMPLETE '{claim['verdict']['label']}' with {len(citations)} citations in {elapsed:.1f}s")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default=os.getenv("VERITY_HEALTH_URL", "http://127.0.0.1:8000"))
    parser.add_argument("--runs", type=int, default=3)
    parser.add_argument("--budget", type=float, default=20.0, help="seconds allowed per run")
    args = parser.parse_args()
    base = args.url.rstrip("/")

    readiness = call("GET", f"{base}/readyz")
    print("readiness: " + ", ".join(f"{key}={value}" for key, value in sorted(readiness.items())))
    if readiness.get("status") != "ready":
        print("API is not ready", file=sys.stderr)
        return 1

    for run in range(1, args.runs + 1):
        try:
            rehearse(base, run, args.budget)
        except Exception as error:
            print(f"run {run} FAILED: {error}", file=sys.stderr)
            return 1
    print(f"release gate: {args.runs} consecutive runs passed against {base}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
