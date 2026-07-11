# Verity Phase 1

Contract-first fixture walking skeleton with a FastAPI service, shared TypeScript contracts/UI, an installable PWA, and an MV3 extension shell.

## Local fixture demo

Requires Python 3.11+ and Node 20+.

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
