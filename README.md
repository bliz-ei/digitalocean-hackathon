# Verity — real-time fact-checking for YouTube

Verity watches a YouTube video with you. A Chrome extension captures the tab's audio, the
backend transcribes it, an AI flags factual claims, one DigitalOcean Gradient agent gathers
supporting and contradicting evidence (curated PDF knowledge base first, web search as
fallback), and a deterministically validated verdict — with verified citations — appears as
an overlay on the video and as a push notification on a paired iPhone.

```
YouTube tab audio ─▶ Chrome extension (MV3, offscreen capture, WebM/Opus chunks)
        │ WebSocket
        ▼
FastAPI backend ─▶ STT (Deepgram) ─▶ claim classifier (LLM) ─▶ evidence retrieval
        │                     (Gradient agent: PDF knowledge base + web-search tool)
        ▼
verdict synthesis (LLM) ─▶ deterministic validation ─▶ PostgreSQL
        │
        ├─▶ browser overlay (React in shadow DOM on youtube.com)
        └─▶ iPhone Web Push (6-digit pairing, installable PWA)
```

Two principles run through the codebase:

1. **Every AI stage is a swappable provider with a disclosed fixture fallback.** STT,
   classification, evidence, and synthesis each sit behind a `Protocol`, an env-var factory,
   and a checked-in "recorded" adapter. With zero credentials the entire demo runs end to
   end on fixtures; real providers degrade to fixtures automatically on failure, and
   `/readyz` plus the `fixture_mode` claim flag disclose which mode actually ran.
2. **Models propose, deterministic code disposes.** Evidence excerpts must appear verbatim
   in independently captured text (knowledge-base retrieval chunks, or an SSRF-guarded page
   re-fetch). Verdict drafts must cite 2–3 known evidence IDs from at least two independent
   credible sources and pass label/confidence/support checks (`validate_draft`), otherwise
   the claim fails closed to `INSUFFICIENT_EVIDENCE`. Verdicts persist before notifications
   fire; delivery is exactly-once per claim and subscription.

## Repository layout

```
services/api/           FastAPI backend (Python 3.11+, pydantic v2, stdlib HTTP clients)
  app/domain/           Pure logic: models, claim state machine, evidence validation, URL safety
  app/pipeline/         Orchestration: LiveSession (audio→claims), EvidencePipeline (claims→verdicts)
  app/providers/        Adapters: Deepgram/recorded STT, LLM classifier/reasoner,
                        Gradient/search/recorded evidence collectors with fallback wrappers
  app/persistence/      Memory / SQLite / PostgreSQL repositories
  app/cross_device.py   iPhone pairing (HMAC-hashed codes) and Web Push subscriptions
  migrations/           Numbered SQL, applied exactly once by the pre-deploy job
apps/extension/         MV3 extension: tabCapture → offscreen MediaRecorder → WS transport,
                        overlay content script, optional BYOK client-side classification
apps/pwa/               Installable React PWA: pairing, notifications, public claim pages
packages/contracts/     Shared TypeScript types + deterministic OpenAPI export
packages/ui/            Shared VerdictCard/StatusCard components and tokens
fixtures/               Hero-demo recordings and the Gradient knowledge-base manifest
infra/ + scripts/       App Platform spec, one-command deploy, migrate/preflight/smoke checks
verity_*plan.md         Phase design documents, including the Gradient evidence plan
phase0/                 Early feasibility probes and schemas (historical)
```

## Quick start — fixture demo, no credentials

Requires Python 3.11+, Node 20+, and Docker. On Windows use `python -m venv .venv` and
`.venv\Scripts\python.exe` wherever the examples show `.venv/bin/python`.

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -e '.[test]'
npm install
docker compose up -d --wait postgres
export VERITY_DATABASE_URL=postgresql://verity:verity@localhost:54329/verity
.venv/bin/python scripts/migrate.py
VERITY_REPOSITORY=postgres .venv/bin/python -m uvicorn app.main:app --app-dir services/api --reload
npm run dev -w @verity/pwa       # second terminal
```

Open `http://localhost:5173` and choose **Start fixture demo**. Nothing starts
automatically: that explicit action creates a session, runs the checked-in recorded
providers, persists the canonical claim, and opens `/claims/{public_id}`. Without
`VERITY_REPOSITORY=postgres` the API runs on in-memory storage.

Build the extension with `npm run build -w @verity/extension`, then load
`apps/extension/dist` as an unpacked extension at `chrome://extensions` (Developer mode).

## Live mode

Open a YouTube video and choose **Start live listening** in the extension popup. The
offscreen runtime preserves audible playback, streams bounded one-second WebM/Opus chunks
with acknowledgements and short reconnect replay, and the overlay renders transcripts,
claim states, and the final verdict card. `http://localhost:8000/readyz` reports which
provider serves each stage.

| Stage | Enable with | Fallback when unset or failing |
|---|---|---|
| STT | `VERITY_STT_API_KEY` (Deepgram; `VERITY_STT_MODEL` overrides `nova-3`) | recorded transcript, automatic |
| Claim classifier | `VERITY_FAST_BASE_URL` / `VERITY_FAST_API_KEY` / `VERITY_FAST_MODEL` | recorded (recognizes the hero claim only) |
| Evidence | `VERITY_GRADIENT_AGENT_ENDPOINT` / `VERITY_GRADIENT_AGENT_KEY` | recorded evidence, automatic |
| Verdict reasoner | `VERITY_REASONING_BASE_URL` / `VERITY_REASONING_API_KEY` / `VERITY_REASONING_MODEL` | recorded drafts |
| Push | `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | notifications no-op |

Kill-switches for rehearsal and stage day: `VERITY_STT=recorded` and
`VERITY_EVIDENCE=recorded` force the deterministic fixtures without unsetting any keys.
Both model stages speak the OpenAI-compatible chat-completions protocol; DigitalOcean
Gradient serverless inference (`https://inference.do-ai.run`) serves both with one model
access key. A legacy generic search API remains available via `VERITY_SEARCH_URL` /
`VERITY_SEARCH_API_KEY` when the Gradient agent is not configured.

The Gradient agent's knowledge base is described by `fixtures/gradient-kb.json`; the agent
must cite those exact URLs so backend canonicalization, source tiers, and independence keys
apply unchanged. Agent output is never trusted: knowledge-base excerpts must match the
returned retrieval chunks and web excerpts must match an SSRF-guarded re-fetch, or the item
is dropped.

Extension BYOK: a user-supplied key (`verityProvider` in extension storage — `baseUrl`,
`apiKey`, `model`) moves classification and synthesis into the offscreen context with a
monthly budget guard. The key never reaches the Verity backend; only structured results do.

## Verification

```sh
.venv/bin/python -m pytest          # backend suite (no network; fakes throughout)
npm test                            # workspace unit tests (extension, PWA, contracts, UI)
npm run typecheck
npm run build
npm run contracts:check             # fails if packages/contracts/openapi.json is stale
npm run test:browser                # Playwright fixture flow
TEST_DATABASE_URL=postgresql://verity:verity@localhost:54329/verity \
  .venv/bin/python -m pytest services/api/tests/test_postgres.py
```

`packages/contracts/openapi.json` is exported deterministically from FastAPI; run
`npm run contracts:generate` after any backend contract change.

## Deployment

One command deploys API, PWA, database, and migrations to DigitalOcean App Platform and
builds the extension against the deployed URL:

```sh
export DIGITALOCEAN_ACCESS_TOKEN=...   VERITY_STT_API_KEY=...
export VERITY_GRADIENT_AGENT_ENDPOINT=https://<agent-id>.agents.do-ai.run
export VERITY_GRADIENT_AGENT_KEY=...
pwsh ./scripts/deploy.ps1 -VapidSubject mailto:<team-contact>
```

The script generates and reuses stable VAPID/pairing secrets under the gitignored
`.verity/` directory (never rotate them after devices subscribe), renders the
secret-bearing spec, runs live Gradient smoke checks, deploys via `doctl`, and finishes
with a strict release preflight that fails unless `/readyz` reports the real providers.
See `PHASE45_RUNBOOK.md` for the full input list, the three-run demo rehearsal, and the
single-instance constraint (WebSocket session state is process-local — keep the API at one
instance).

## Security and privacy

Fixture mode accepts and retains no audio. API keys, full page text, complete prompts,
authorization headers, and raw provider bodies are never logged. Fetched URLs and redirects
to local, private, link-local, credentialed, or unusual-port destinations are rejected.
Do not commit credentials, raw provider responses, or private user data to fixtures or logs.
