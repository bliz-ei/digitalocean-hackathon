# Verity Phase 1 Plan — Contract-First Walking Skeleton

## Phase outcome

Create the monorepo, canonical domain contracts, database schema, generated frontend types, fake provider adapters, and the complete fixture-driven overlay-to-phone flow. One explicit start action must advance a synthetic session through every canonical state and render the same persisted verdict on desktop and mobile without any live external provider.

Phase 1 establishes the seams that later phases fill. The implementation must remain a modular monolith with typed pipeline functions, not a microservice or agent-framework architecture.

## Entry criteria

- Phase 0 has selected viable audio, STT, BYOK, and push approaches and recorded their normalized constraints.
- The hero fixture inventory and exact target claim are frozen.
- The team agrees on one Python dependency definition, one TypeScript workspace/lockfile, and supported runtime versions.
- No unresolved Phase 0 risk invalidates the proposed architecture.

## Scope

### Included

- Repository/workspace scaffolding for extension, PWA, API, contracts, shared UI, infrastructure, and hero fixtures.
- Pydantic source-of-truth models, OpenAPI generation, TypeScript client/types, database migrations, and the claim state machine.
- Minimal REST/WebSocket surface from `IMPLEMENTATION_PLAN.md`.
- Fake STT, search, LLM, and push adapters behind production-shaped interfaces.
- Fixture-driven extension overlay, canonical API persistence, PWA verdict route, and simulated notification handoff.
- Automated contract, domain, API integration, and UI smoke tests.

### Excluded

- Live tab audio, STT, model calls, search/extraction, Web Push delivery, production deployment, real pairing, and real BYOK key handling.
- Redis, task queues, microservices, Kubernetes, billing, pgvector similarity lookup, or generalized platform support.

## Target repository layout

Use the structure in `IMPLEMENTATION_PLAN.md` and make ownership boundaries explicit:

- `apps/extension`: MV3 service worker, offscreen shell, content script, overlay, settings placeholder.
- `apps/pwa`: installability shell, simulated pairing/push opt-in, canonical verdict page.
- `services/api/app/api`: REST and WebSocket transports only.
- `services/api/app/domain`: models, enums, state machine, validation, errors.
- `services/api/app/pipeline`: orchestration stages expressed as typed async functions.
- `services/api/app/providers`: protocols and fake adapters.
- `services/api/app/persistence`: SQL models, repositories, migrations, transactions.
- `packages/contracts`: generated OpenAPI TypeScript output and generation checks.
- `packages/ui`: verdict-only shared components and design tokens with no runtime orchestration.
- `fixtures/hero-demo`: versioned disclosed inputs and expected outputs.
- `infra`: later deployment specification and environment documentation; no deployment yet.

Avoid sharing extension-specific runtime code with the PWA. Share only stable API contracts and truly common verdict presentation.

## Contract baseline

### Domain enums

- Claim classification: `opinion`, `factual_claim`, `unverifiable`.
- Claim state: `CAPTURING`, `TRANSCRIBING`, `CLAIM_CANDIDATE`, `CHECKING`, `EVIDENCE_READY`, `SYNTHESIZING`, `COMPLETE`, `INSUFFICIENT_EVIDENCE`, `FAILED`.
- Verdict label: `Supported`, `Misleading`, `Disputed`, `Unsupported`, `Insufficient evidence`.
- Evidence stance: support, counter, context.
- Source tier: a small documented enum ordered by the source-quality policy.

### Canonical models

Define the Claim, Evidence Item, Verdict, Session, Push Subscription, and Usage Ledger fields from `IMPLEMENTATION_PLAN.md`. Add only fields required for identity, timestamps, optimistic/idempotent processing, or retention. Every timestamp is UTC; every duration is integer milliseconds; public IDs are high-entropy and distinct from internal database IDs.

### WebSocket envelope

Every event includes `type`, `schema_version`, `session_id`, `sequence`, and `payload`. Define events for session state, final transcript segment, claim candidate/classification request, checking state, evidence ready, synthesis request, verdict completion, recoverable error, and terminal failure. Direction and acknowledgement behavior must be documented. Unknown event types or schema versions fail clearly.

### REST behavior

Plan and implement exactly the minimal endpoints in `IMPLEMENTATION_PLAN.md`. Specify authentication expectations, public/private identifier usage, idempotency keys, status codes, error envelopes, and retry safety before endpoint handlers are built.

### Deterministic invariants

- State transitions follow only the canonical directed sequence; terminal states cannot reopen.
- One session/claim idempotency key cannot create duplicate claims.
- Completed verdicts require an allowed label, confidence within the agreed range, an explanation, uncertainty, 2–3 valid citations except for insufficient evidence, and citation IDs belonging to that claim.
- Evidence IDs are immutable after they enter a verdict bundle.
- Public reads return only the canonical persisted representation and safe fields.
- Push is requested only after the verdict transaction commits and at most once per claim/subscription outcome.

## Workstream 1A — Workspace and quality foundation

**Owner:** Arnav coordinates.

1. Establish runtime versions, workspace commands, formatting/linting/type-checking, unit-test conventions, environment templates, and local database startup documentation.
2. Add a single root workflow for install, generate contracts, lint, type-check, unit test, integration test, and build.
3. Make generated artifacts reproducible and add a check that fails when OpenAPI output is stale.
4. Define configuration classes with safe development defaults and explicit failure for missing secrets in live modes.
5. Add a repository-wide secret/logging policy and ignore rules before fixtures are committed.
6. Keep CI provider-independent; no live API credential may be required.

**Acceptance:** a clean checkout can install and run all fake-mode checks using documented commands and one local PostgreSQL instance.

## Workstream 1B — Domain, schema, and persistence

**Owner:** Arnav, reviewed by Jun for evidence/verdict fields.

1. Write Pydantic models first and use them as the OpenAPI source of truth.
2. Model state transitions as domain rules independent from transport and database code.
3. Create initial migrations with uniqueness, foreign-key, enum/check, timestamp, and idempotency constraints.
4. Define repository operations around domain actions rather than leaking ORM objects.
5. Make verdict completion atomic: evidence validation, verdict insert/update, claim terminal transition, and notification-outcome creation occur in one transaction; actual push happens after commit.
6. Include a retention-ready completion timestamp and indexes for public ID, session sequence, normalized claim hash, claim state, and subscription device.
7. Enable the pgvector extension only if the managed/local database supports it cleanly; do not put vectors in the critical path.

**Acceptance:** migration up/down testing, transition unit tests, database constraint tests, and canonical round-trip serialization all pass.

## Workstream 1C — API and WebSocket session gateway

**Owner:** Arnav.

1. Implement session creation and a short-lived demo session credential suitable for the walking skeleton.
2. Create one WebSocket gateway that validates envelopes, enforces per-session monotonic sequencing, sends acknowledgements where required, and applies bounded buffering.
3. Route messages into pipeline/domain functions; transport handlers contain no provider or verdict logic.
4. Implement canonical public claim reads using `public_id`, with stable not-found and not-yet-complete responses.
5. Add pairing and subscription endpoint shapes using fake behavior so Phase 4 can replace internals without changing clients.
6. Add liveness and readiness semantics; readiness checks database access and configured fake providers.

**Acceptance:** reconnect/replay tests do not duplicate a claim, malformed envelopes fail safely, and REST/OpenAPI output matches generated client assumptions.

## Workstream 1D — Fake adapter pipeline

**Owners:** Moh owns fake STT shape; Jun owns fake search/model shapes; Arnav owns fake push.

1. Define narrow provider protocols for streaming STT, search, page extraction, fast-model classification, reasoning-model synthesis, and push delivery.
2. Implement deterministic fake adapters driven by hero fixtures and configurable per-stage delay/failure.
3. Build pipeline stages as typed async functions coordinated by the canonical state machine.
4. Exercise support and counterevidence tasks concurrently even in fake mode so orchestration timing matches the later architecture.
5. Assign immutable evidence IDs before synthesis and require fake verdict citations to reference only those IDs.
6. Validate the fake verdict with the same deterministic rules planned for live output.
7. Record stage timestamps and sanitized correlation IDs to prove observability fields early.

**Acceptance:** one fixture session reaches a persisted terminal verdict, and injected failure at any stage produces the expected visible state without partial/corrupt persistence.

## Workstream 1E — Extension walking skeleton

**Owner:** Tri.

1. Create a minimum MV3 manifest with service worker, offscreen document, content script, extension UI, and only permissions needed by the fake flow.
2. Require an explicit start/stop action and keep session ownership in the service worker/offscreen boundary.
3. Mount exactly one Shadow DOM host on supported YouTube pages and recover cleanly across client-side navigation.
4. Render Listening, transcript/speaker, Checking, Completed, Insufficient evidence, and Failed states from server events; the content script performs no orchestration.
5. Add a fixture-mode indicator and a direct link to the canonical claim page.
6. Restore the current session after content-script remount or service-worker wakeup.
7. Meet basic accessibility: keyboard activation, readable focus, semantic status announcements, non-color-only state cues, and overlay dismissal.

**Acceptance:** in a controlled local video page, one click starts the fixture flow, state changes appear in order, remount does not duplicate the overlay, and the final card links to the canonical verdict.

## Workstream 1F — PWA and shared verdict presentation

**Owners:** Arnav owns PWA data flow; Tri owns shared presentation.

1. Create an installable PWA shell and routes for pairing, notification opt-in placeholder, and `/claims/{public_id}`.
2. Fetch the canonical verdict from the API; never synthesize or maintain a second verdict representation.
3. Build shared verdict components for exact claim/speaker/timestamp, label, confidence, two-sentence explanation, uncertainty, 2–3 sources with excerpts and stance, counterevidence, and common ground.
4. Clearly distinguish source excerpts from model interpretation and render working external links safely.
5. Handle loading, pending, insufficient evidence, expired/not found, failed, and offline states.
6. Simulate a notification action in fake mode that opens the same canonical claim URL.
7. Verify responsive layout and accessibility on the target iPhone viewport and desktop overlay constraints.

**Acceptance:** desktop and PWA render equivalent canonical data, and fixture notification navigation opens the correct persisted claim.

## Workstream 1G — Fixtures and automated verification

**Owner:** all, with Jun accountable for factual integrity.

1. Version fixtures for final transcript segments, factual classification plus queries, evidence/counterevidence, extracted page text hashes, verdict draft, validated canonical verdict, and fake push receipt.
2. Include opinion and unverifiable negative cases, insufficient-source cases, disputed-source cases, nonexistent citations, excerpt mismatch, duplicate URL, reconnect replay, and push failure.
3. Add contract tests for all provider responses and generated client decoding.
4. Add state-machine, citation, excerpt, source-count, confidence, and idempotency unit tests.
5. Add an API integration test that drives a complete fixture session through PostgreSQL and fake push.
6. Add a Playwright extension smoke test against a controlled local video page and a PWA verdict-route test.
7. Ensure tests make no live network requests and use deterministic clocks/IDs where assertions require them.

## Security, privacy, and observability gates

- No raw audio is accepted or persisted in this phase's fixture flow unless it is a disclosed, intentionally retained test asset.
- Logging includes correlation ID, state change, stage duration, provider=fake, source domain, and error code, but excludes secret-like fields and complete provider bodies.
- Public claim response is allow-listed and does not expose internal IDs, session credentials, subscription data, or usage details.
- Settings/key UI is explicitly non-functional or synthetic until Phase 5; no misleading key persistence is introduced early.
- Fixture mode is visible in both extension and PWA.

## Recommended implementation order

1. Workspace/tooling and domain enums/models.
2. State machine, migrations, repositories, and invariant tests.
3. OpenAPI export and generated TypeScript contracts.
4. Fake adapters and backend pipeline integration test.
5. WebSocket gateway and REST canonical reads.
6. Shared verdict components and PWA route.
7. Extension state rendering and full fixture-driven browser smoke test.
8. Failure injection, reconnect/idempotency, accessibility, and documentation pass.

This order keeps contracts and fixtures ahead of UI and prevents any client from inventing a parallel schema.

## Phase exit gate

Phase 1 passes only when, from a clean local environment:

1. One explicit extension action creates a session and drives the entire hero fixture through every expected state.
2. The claim and verdict are canonical and persisted in PostgreSQL.
3. Extension and PWA render the same verdict and claim URL.
4. Fake push navigation opens that URL.
5. Failure, insufficient-evidence, reconnect, duplicate-message, and invalid-citation cases fail closed.
6. Contract generation is current and all lint, type, unit, integration, and browser smoke checks pass.
7. No live provider or secret is needed.

## Handoff to Phase 2

Freeze the audio message envelope, final transcript segment, classification request/response, session lifecycle, state events, and idempotency behavior. Provide the hero fixture, generated client, fake-adapter conformance tests, latency instrumentation, and known UI limitations. Phase 2 replaces only tab/STT/classification fakes while preserving the full fixture route for regression and fallback.
