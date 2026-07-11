<p align="center">
  <img src="apps/pwa/public/verity-icon.svg" alt="Verity" width="96">
</p>
<h1 align="center">Verity</h1>
<p align="center">
  Real-time, citation-verified fact-checking for YouTube, in your browser and on your phone.
</p>
<p align="center">
  <a href="PHASE45_RUNBOOK.md">Runbook</a> ·
  <a href="verity_gradient_evidence_plan.md">Architecture plans</a> ·
  <a href="https://github.com/bliz-ei/digitalocean-hackathon/issues">Issues</a>
</p>
<p align="center">
  <a href="https://github.com/bliz-ei/digitalocean-hackathon/actions/workflows/ci.yml">
    <img src="https://github.com/bliz-ei/digitalocean-hackathon/actions/workflows/ci.yml/badge.svg" alt="CI">
  </a>
</p>

## Overview

Verity helps viewers judge factual claims the moment they are spoken in a video, without
leaving the page or trusting an unaccountable AI summary.

It solves:

- **Unverifiable AI answers:** every verdict cites 2–3 sources whose excerpts are
  machine-verified against independently captured text before anything is shown.
- **Fact-checks that arrive too late:** claims are detected and checked live from the
  tab's audio, and the verdict lands as a video overlay plus an iPhone notification.
- **Demos that die on stage:** every AI stage has a disclosed recorded fallback, so the
  pipeline completes end to end with zero credentials and degrades gracefully when a
  provider fails.

## Key features

- **Live claim detection:** tab audio streams to Deepgram; an LLM classifies sentences as
  opinion, factual claim, or unverifiable; no truth-judging at this stage.
- **Grounded evidence, not model memory:** one DigitalOcean Gradient agent retrieves
  support *and* counterevidence: curated PDF knowledge base first, web-search tool as
  controlled fallback. Excerpts that don't match the agent's own retrieval chunks (or an
  SSRF-guarded page re-fetch) are dropped.
- **Deterministic verdict validation:** drafts must cite known evidence IDs from ≥2
  independent credible sources and pass label/confidence/support checks, or the claim
  fails closed to *Insufficient evidence*.
- **Cross-device delivery:** verdicts persist to PostgreSQL before an exactly-once Web
  Push notification reaches a paired iPhone (6-digit pairing, installable PWA).
- **Honest fallbacks:** `/readyz` reports the live provider per stage; fixture-mode claims
  are flagged as such. Kill-switches force the deterministic path without unsetting keys.

## Quick start

### Prerequisites

- Python 3.11+, Node 20+, Docker, Chrome 116+
- No credentials needed for the fixture demo

### Install

```sh
git clone https://github.com/bliz-ei/digitalocean-hackathon.git
cd digitalocean-hackathon
python3 -m venv .venv
.venv/bin/python -m pip install -e '.[test]'
npm install
```

On Windows use `python -m venv .venv` and `.venv\Scripts\python.exe` wherever the examples
show `.venv/bin/python`.

### Configure

The fixture demo needs only the local database. Live providers are optional and
independent: each stage falls back to its disclosed recorded fixture when unset.

| Stage | Enable with | Fallback |
|---|---|---|
| STT | `VERITY_STT_API_KEY` (Deepgram) | recorded transcript |
| Classifier | `VERITY_FAST_BASE_URL` / `_API_KEY` / `_MODEL` | recorded (hero claim only) |
| Evidence | `VERITY_GRADIENT_AGENT_ENDPOINT` / `_KEY` | recorded evidence |
| Reasoner | `VERITY_REASONING_BASE_URL` / `_API_KEY` / `_MODEL` | recorded drafts |
| Push | `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | notifications no-op |

Gradient serverless inference (`https://inference.do-ai.run`) serves both model stages
with one key. Kill-switches: `VERITY_STT=recorded`, `VERITY_EVIDENCE=recorded`. The
agent's knowledge base is described by [fixtures/gradient-kb.json](fixtures/gradient-kb.json).

### Run

```sh
docker compose up -d --wait postgres
export VERITY_DATABASE_URL=postgresql://verity:verity@localhost:54329/verity
.venv/bin/python scripts/migrate.py
VERITY_REPOSITORY=postgres .venv/bin/python -m uvicorn app.main:app --app-dir services/api --reload
npm run dev -w @verity/pwa        # second terminal
```

Open `http://localhost:5173` and choose **Start fixture demo**: nothing starts without
that explicit action. For live mode, build the extension (`npm run build -w
@verity/extension`), load `apps/extension/dist` unpacked at `chrome://extensions`, open a
YouTube video, and choose **Start live listening**. Check `http://localhost:8000/readyz`
to see which provider serves each stage. Without `VERITY_REPOSITORY=postgres` the API
runs on in-memory storage.

## How it works

```text
YouTube tab audio
  → Chrome extension (MV3 offscreen capture, 1s WebM/Opus chunks over WebSocket)
  → STT adapter (Deepgram | recorded)
  → fast classifier (LLM): opinion / factual claim / unverifiable
  → evidence collector (Gradient agent: PDF KB + web search | recorded)
  → verdict synthesis (LLM) → deterministic validation (validate_draft)
  → PostgreSQL → browser overlay + iPhone Web Push
```

Two principles organize the codebase. First, **every AI stage sits behind a `Protocol`
seam** with an env-var factory, a real adapter, and a recorded fallback, so swapping a
provider never touches the pipeline. Second, **models propose, deterministic code
disposes**: all model output is validated against independently captured text before it
can reach a user. For detailed architecture and phase history, see the
[`verity_*plan.md`](verity_gradient_evidence_plan.md) documents.

## Repository structure

```text
services/api/        FastAPI backend: domain logic, pipelines, provider adapters, persistence
apps/extension/      MV3 Chrome extension: capture, transport, overlay, optional BYOK
apps/pwa/            Installable React PWA: pairing, notifications, public claim pages
packages/contracts/  Shared TypeScript types + deterministic OpenAPI export
packages/ui/         Shared verdict/status components and tokens
fixtures/            Hero-demo recordings and the Gradient knowledge-base manifest
infra/ scripts/      App Platform spec, one-command deploy, migrate/preflight/smoke checks
verity_*plan.md      Phase design documents
phase0/              Early feasibility probes (historical)
```

## Development

```sh
.venv/bin/python -m pytest      # backend suite, no network, fakes throughout
npm test                        # workspace unit tests
npm run typecheck
npm run build
npm run contracts:check         # fails if the committed OpenAPI export is stale
npm run test:browser            # Playwright fixture flow
```

Run `npm run contracts:generate` after any backend contract change. The Postgres
integration test runs with `TEST_DATABASE_URL=postgresql://verity:verity@localhost:54329/verity`.

## Deployment

One command deploys the API, PWA, database, and migrations to DigitalOcean App Platform,
generates and reuses stable VAPID/pairing secrets under the gitignored `.verity/`
directory, runs live Gradient smoke checks, and finishes with a release preflight that
fails unless `/readyz` reports the real providers:

```sh
export DIGITALOCEAN_ACCESS_TOKEN=... VERITY_STT_API_KEY=...
export VERITY_GRADIENT_AGENT_ENDPOINT=https://<agent-id>.agents.do-ai.run VERITY_GRADIENT_AGENT_KEY=...
pwsh ./scripts/deploy.ps1 -VapidSubject mailto:<team-contact>
```

Keep the API at **one instance**: WebSocket session state is process-local. For the full
input list, demo rehearsal protocol, and secret-handling rules, see
[PHASE45_RUNBOOK.md](PHASE45_RUNBOOK.md).

## Security and privacy

- Never commit secrets; deployment secrets render only into the gitignored `.verity/`.
- Fixture mode accepts and retains no audio. BYOK keys stay in the extension and never
  reach the Verity backend.
- API keys, page text, prompts, authorization headers, and raw provider bodies are never
  logged. Fetches and redirects to local, private, credentialed, or unusual-port
  destinations are rejected.
- Report vulnerabilities privately via
  [GitHub security advisories](https://github.com/bliz-ei/digitalocean-hackathon/security/advisories).

## Project status

**Active development.** A DigitalOcean hackathon project built for a live demo. The
fixture path is deterministic and CI-covered; live providers are demo-hardened with
automatic fallbacks, not production-scale.

## Contributing

Team workflow: branch from `main`, keep changes behind the existing provider seams, run
the Development commands above, and open a pull request. Bugs and questions go to
[Issues](https://github.com/bliz-ei/digitalocean-hackathon/issues).

## License

No open-source license has been granted; all rights reserved by the team. (Add a LICENSE
file before any public release.)
