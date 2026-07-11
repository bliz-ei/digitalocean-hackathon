# Verity MVP — through Phase 3

Contract-first fixture walking skeleton with a FastAPI service, shared TypeScript contracts/UI, an installable PWA, and an MV3 extension shell.

## Local fixture demo

Requires Python 3.11+ and Node 20+.

The npm verification commands are cross-platform. On Windows, create the environment with `python -m venv .venv` and use `.venv\Scripts\python.exe` wherever the examples below show `.venv/bin/python`.

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -e '.[test]'
npm install
docker compose up -d --wait postgres
VERITY_DATABASE_URL=postgresql://verity:verity@localhost:54329/verity .venv/bin/python scripts/migrate.py
uvicorn app.main:app --app-dir services/api --reload
npm run dev -w @verity/pwa
```

Open `http://localhost:5173` and choose **Start fixture demo**. Nothing starts automatically: that explicit action creates a session, runs only the checked-in fake providers, persists the canonical claim, and opens `/claims/{public_id}`. The extension uses the same explicit action in its popup; build it with `npm run build -w @verity/extension` and load `apps/extension/dist` as an unpacked extension.

No live credentials or network providers are used. Fixture mode does not accept or retain audio. Do not put credentials, raw provider responses, or private user data in fixtures or logs.

## Phase 2 live transcript path

Build and reload the unpacked extension, open a YouTube video, then choose **Start live listening**. The offscreen runtime preserves audible tab playback, sends bounded one-second WebM/Opus chunks with acknowledgements and short reconnect replay, and renders canonical final transcript/checking events in the overlay.

The checked-in server uses the disclosed recorded STT/classifier adapters so CI and local demos need no credentials. A user-key classifier can be supplied through the extension-local `verityProvider` configuration (`baseUrl`, `apiKey`, and `model`); the key is used only by the offscreen provider request and is never sent to the Verity backend. The managed live STT adapter remains gated on a Phase 0 provider/device decision and must not be represented as verified until the three real-device hero runs pass.

## Phase 3 evidence and verdict path

Every live factual claim now runs bounded neutral/support/counter searches concurrently, validates URLs, extracts captured page text, clusters duplicate sources, applies stance-independent source tiers, and selects at most six evidence passages. The reasoning model sees only this immutable evidence bundle. Its draft is accepted only after deterministic citation ownership, excerpt, independence, label, confidence, and support checks; one invalid retry is allowed before the claim fails closed.

Without provider configuration, the disclosed `phase3-evidence.json` search, page, and reasoning recordings run through the same validators. To use a compatible live server-side provider, set all of:

```sh
VERITY_SEARCH_URL=https://search.example/v1/search
VERITY_SEARCH_API_KEY=...
VERITY_REASONING_BASE_URL=https://provider.example
VERITY_REASONING_API_KEY=...
VERITY_REASONING_MODEL=...
```

The search adapter accepts a compact `{results:[{title,url,publisher,published_at,snippet}]}` response. URLs and redirects to local, private, link-local, credentialed, unsupported-scheme, or unsupported-port destinations are rejected. API keys, full page text, complete prompts, authorization headers, and provider bodies are not logged. Extension BYOK reasoning uses the same `verityProvider` key directly from the offscreen context; only its structured verdict draft is returned to Verity.

## Live Gradient evidence

Production uses a DigitalOcean Gradient agent with the checked-in knowledge-base manifest and web-search fallback. Set both server-side values before deployment:

```sh
VERITY_GRADIENT_AGENT_ENDPOINT=https://your-agent-endpoint
VERITY_GRADIENT_AGENT_KEY=...
```

`scripts/deploy.ps1` requires these values, runs three live agent/KB smoke attempts, and release preflight fails unless `/readyz` reports `evidence: gradient`. Each smoke attempt must return verified support and counterevidence from at least two independent sources. The endpoint is configuration; the access key is rendered only into the ignored `.verity/app.yaml` deployment spec and is never committed.

## Verification

```sh
pytest
npm run contracts:generate
npm run contracts:check
npm test
npm run typecheck
npm run build
TEST_DATABASE_URL=postgresql://verity:verity@localhost:54329/verity .venv/bin/pytest services/api/tests/test_postgres.py
npm run test:browser
pytest phase0/tests
```

`packages/contracts/openapi.json` is exported deterministically from FastAPI. Run `npm run contracts:generate` after a backend contract change; the check command fails when its committed output is stale.
