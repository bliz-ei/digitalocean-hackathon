# Verity Phase 5 Plan — BYOK, Resilience, and Deployment

## Phase outcome

Turn the integrated hero flow into a repeatable deployable demo. Complete safe BYOK settings and budget controls, team-demo fallback, provider timeouts and idempotent recovery, disclosed fixture fallback, redacted observability, health/readiness, retention, DigitalOcean App Platform deployment, and a clean-profile runbook. The release gate is three consecutive end-to-end rehearsals with no manual intervention after start.

This phase hardens the single-instance MVP; it does not broaden product scope or add production-scale infrastructure.

## Entry criteria

- Phases 0–4 pass on the exact demo laptop, Chrome version, iPhone, clip, and primary providers.
- All public REST/WebSocket and provider-neutral contracts are stable.
- The full fake/fixture test path remains deterministic and visible when selected.
- DigitalOcean project, App Platform permissions, managed PostgreSQL, verified domains/HTTPS, provider team keys, and VAPID secrets are available through authorized secret management.
- A main demo branch and deployment owner are named.

## Scope

### Included

- Complete extension BYOK settings for DigitalOcean and one verified OpenAI-compatible provider.
- Local key lifecycle, connection test, model configuration, client-side monthly estimate/guard, and delete-key behavior.
- Clearly disclosed, server-metered team-demo key fallback.
- External-call timeouts, bounded retries, WebSocket reconnect/backpressure, idempotency, cancellation, and stage deadlines.
- Explicit disclosed hero fixture fallback using production contracts/state transitions.
- Structured redacted logging, correlation IDs, metrics, liveness/readiness, safe error UX, and operational runbook.
- Retention/TTL cleanup for claim-linked data and deletion of push/key-related state.
- Container/build configuration and single-instance deployment to DigitalOcean App Platform plus managed PostgreSQL.
- Migration/release/rollback process, clean-profile setup, smoke tests, and three unattended rehearsals.

### Excluded

- Redis, Kafka, Celery, Kubernetes, multi-instance WebSocket fan-out, durable distributed queue, organization accounts, billing, production credential custody, broad browser/platform/provider support, automated moderation, and semantic pgvector cache lookup.

## Workstream 5A — BYOK settings and storage

**Owner:** Tri, with Jun validating model choices and Arnav reviewing security.

1. Provide settings for provider selection, validated base URL from the Phase 0 allow-list/pattern, API key, fast model, reasoning model, monthly spending limit, current local estimate, connection test, save, and delete.
2. Store the prototype key only in `chrome.storage.local`; never sync it, render it after save, include it in telemetry, or send it to Verity's backend.
3. Keep keys and provider configuration out of content-script/page context. Direct requests originate only from the offscreen/extension context with explicit minimal host permissions.
4. Treat pasted URLs and provider error messages as untrusted. Permit only HTTPS verified endpoints and sanitize user-visible/provider error detail.
5. Mask the key field, prevent accidental autofill where practical, and require deliberate replacement/deletion actions.
6. On delete, remove key and derived sensitive configuration, cancel queued direct model work, clear transient authorization material, and update UI immediately.
7. Detect missing/invalid/deleted configuration before a pipeline request and offer explicit reconfiguration or disclosed demo fallback.
8. Document prototype limitations: local extension storage is not production-grade encrypted custody.

**Acceptance:** key save/use/restart/replace/delete behavior works without any key appearing in backend requests, persistence, logs, page DOM, exported diagnostics, or error reports.

## Workstream 5B — Connection test and provider compatibility guard

**Owners:** Tri and Jun.

1. Run the minimum authenticated request needed to validate endpoint reachability, authentication, chosen fast/reasoning models, and structured-output compatibility.
2. Distinguish DNS/network, authentication, permission/CORS, rate limit, model missing, structured-output incompatibility, timeout, and generic provider errors.
3. Return concise safe guidance without showing raw bodies, headers, or key fragments.
4. Save provider/model configuration only after syntactic validation; show whether the last live test passed and when.
5. Do not advertise or auto-select a provider/model combination that did not pass the Phase 0 compatibility matrix.
6. Revalidate when endpoint/provider/model changes; a test result for one combination cannot bless another.
7. Rate-limit repeated tests locally and count their estimated usage.

## Workstream 5C — Client-side usage ledger and budget guard

**Owners:** Tri owns enforcement/UX; Jun owns estimates.

1. Define a versioned local pricing/estimation table or conservative per-request estimator for the supported fast and reasoning models.
2. Before each call, estimate input/output cost from bounded prompt/bundle sizes and reject when the configured monthly ceiling would be exceeded.
3. Record local estimated usage by calendar month, provider, model, request type, tokens when reported, estimated cost, and success/failure category without prompt contents.
4. Reconcile estimates with provider-reported usage when available but clearly label values as estimates, not billing truth.
5. Make budget updates and request reservation atomic enough to prevent concurrent candidates from overspending the local limit.
6. Release or adjust reservations after failed/completed requests using a documented conservative policy.
7. Provide reset behavior only for a new calendar month or an explicit user action with clear warning; deleting the key removes derived key/provider configuration but retention of anonymous usage preference is a documented product choice.
8. The guard is a safety aid, not a substitute for provider-side billing caps.

**Acceptance:** boundary, concurrent-request, retry, month rollover, unknown pricing, and deleted-key tests never initiate a call after the local budget gate rejects it.

## Workstream 5D — Team-demo key fallback and server metering

**Owner:** Arnav, with Jun for prompts/models and Tri for disclosure UX.

1. Store team provider keys only in App Platform encrypted secrets and inject them into the backend provider adapters.
2. Use the same versioned classification/verdict schemas, prompts, and validators as direct BYOK mode.
3. Mark sessions and all relevant UI clearly as `Demo key`; never silently switch from BYOK because of authentication, budget, or provider failure.
4. Require an explicit initial mode choice or explicit fallback consent consistent with the demo UX.
5. Enforce server-side per-session and global request/token/cost ceilings, concurrency limits, and rate limits.
6. Meter provider/model, request type, usage, cost estimate, outcome, and correlation ID without key/prompt/body leakage.
7. Fail safely when the limit is reached and keep fixture fallback a separate, visibly disclosed mode.
8. Include team-provider readiness without making liveness depend on optional external services.

**Acceptance:** server limits stop excess calls, demo-key state is visible, and neither client nor public APIs can retrieve or infer the team key.

## Workstream 5E — Timeouts, retries, cancellation, and idempotency

**Owner:** Arnav coordinates; each provider owner implements its adapter policy.

Define a matrix for STT, classification, search, page fetch, synthesis, database, and push containing connect/operation/global deadline, retryable errors, max attempts, jitter, cancellation semantics, idempotency key, and user-visible failure.

1. Bound every external call; use at most one jittered retry where safe.
2. Share phase deadlines so nested retries cannot exceed the 30-second backend or 45-second product budget.
3. Cancel late sibling tasks after enough evidence or terminal failure; late results cannot mutate terminal claims.
4. Preserve audio/WebSocket backpressure and short replay from Phase 2.
5. Enforce uniqueness/idempotency for session create, claim create, evidence insertion, verdict completion, pairing redemption, subscription registration, and push outcome.
6. Distinguish transient, permanent, user-configuration, trust-validation, and internal failures with stable error codes.
7. Retry synthesis only once after deterministic validation feedback; never retry a content/policy failure blindly.
8. Test process restart at each durable boundary and document which in-memory work is intentionally lost in the single-instance MVP.

**Acceptance:** failure injection cannot produce duplicate claims/verdicts/notifications, unbounded work, invalid terminal state transitions, or a latency runaway.

## Workstream 5F — Disclosed fixture fallback

**Owners:** Jun owns factual fixtures; Arnav owns orchestration; Tri owns disclosure.

1. Finalize versioned hero transcript, classification/query, evidence/page-text, validated verdict, and push-simulation fixtures.
2. Validate fixture structure through the same Pydantic/contracts and deterministic trust checks as live results.
3. Activate fallback only by explicit demo-mode selection or a documented bounded provider-failure choice; never silently present cached data as live.
4. Display `Demo fallback` persistently in extension and PWA, including the stage(s) replaced.
5. Preserve canonical state transitions, timings that feel responsive but do not misrepresent live measurement, persistence, URL, and notification behavior.
6. Record fixture version in the session/verdict audit data.
7. Reopen and manually verify every fixture citation shortly before release; record retrieval/review date and replace broken sources.
8. Provide operator controls to return to live mode for a fresh session without mixing live and fixture artifacts unintentionally.

**Acceptance:** each single external dependency can be failed in a test and replaced through the declared mode while the result remains contract-valid, traceable, and visibly labeled.

## Workstream 5G — Logging, metrics, and safe diagnostics

**Owner:** Arnav, with all owners defining stage metrics.

1. Generate one correlation ID per session and claim and propagate it through WebSocket, pipeline, database, and push logs.
2. Emit structured events for state transitions, stage durations, provider/model, usage counts, source domains/tiers, validation outcomes, reconnects, and push results.
3. Install a global redaction filter for API key, authorization, cookie, subscription endpoint/keys, pairing code/token, audio bytes, and common secret-field names.
4. Never log full provider requests/responses, full prompts, raw audio, complete captured page text, or entire authorization headers.
5. Track claim detection latency, verdict completion latency, insufficient/disputed rate, citation-validation failure, provider error/timeout, fallback use, reconnect, and push outcome.
6. Define a safe diagnostic export containing versions/config modes/error codes but no sensitive values.
7. Add sampling/retention limits so successful high-volume partial transcript events do not overwhelm logs.
8. Verify redaction using seeded canary secrets and automated log-capture tests before deployment.

## Workstream 5H — Health, readiness, retention, and operations

**Owner:** Arnav.

1. Keep `/healthz` a fast process liveness check with no external dependency.
2. Make `/readyz` check database access, migration compatibility, required runtime configuration, and essential adapter initialization; report safe component states without secrets.
3. Treat optional/direct BYOK providers as session-level readiness rather than failing the whole service.
4. Add startup/shutdown hooks that close sockets/provider clients and stop accepting new work cleanly.
5. Implement automatic TTL cleanup for expired pairing challenges, revoked/stale subscriptions as policy allows, and claim-linked transcript/evidence/verdict data before public testing.
6. Ensure raw audio has no persistence path and temporary buffers disappear on stop/restart.
7. Document backup/restore expectations for the demo database and a data deletion procedure.
8. Create operator checks for database capacity/connections, error rate, latency, provider quotas, push subscription health, and fixture freshness.

## Workstream 5I — DigitalOcean App Platform deployment

**Owner:** Arnav.

1. Produce a reproducible API container and static frontend builds with pinned runtime/dependency versions and no secrets baked into images.
2. Define `infra/app.yaml` for one API instance, PWA/static delivery as selected, HTTPS routes, health checks, environment variables/secrets, and managed PostgreSQL binding.
3. Keep the API single-instance for the hackathon because WebSocket orchestration is in memory; document this constraint prominently.
4. Store all canonical state in PostgreSQL because App Platform filesystems are ephemeral.
5. Run database migrations as a controlled release step that is backward-compatible with the immediately previous application version.
6. Generate extension production configuration for the deployed HTTPS origins and keep host/CSP permissions minimal.
7. Configure allowed origins precisely for extension/PWA behavior; do not use broad permissive CORS as a shortcut.
8. Verify WebSocket upgrade/idle behavior, request/body limits, database TLS/connections, service worker scope, PWA manifest, VAPID origin assumptions, and public claim deep links.
9. Keep fixture assets versioned in the build or durable store; never depend on ephemeral runtime writes.
10. Record deployed commit, migration version, environment mode, fixture version, provider/model/prompt versions, and release timestamp.

## Workstream 5J — Release, rollback, and rehearsal automation

**Owner:** Arnav coordinates; all owners sign off.

1. Define the main demo branch release workflow: validate, build, migrate, deploy, readiness wait, API smoke, PWA smoke, extension package/config verification, synthetic push, then hero rehearsal.
2. Fail release immediately on stale generated contracts, migration mismatch, secret scan, unit/integration/browser failure, readiness failure, or broken fixture citations.
3. Define rollback to the last known application build and compatible schema. Never use destructive database rollback without a tested data-preserving plan.
4. Rehearse provider outage, search timeout, invalid synthesis, WebSocket reconnect, push failure, and fixture-mode selection.
5. Create a clean Chrome profile checklist: correct Chrome version, unpack/install extension, permissions, provider mode/key or demo mode, target YouTube URL, no stale session/storage, and overlay test.
6. Create an iPhone checklist: installed Home Screen PWA, current pairing, granted OS/PWA notifications, active subscription, network, battery/focus mode, and synthetic test push.
7. Automate safe preflight checks where possible and produce a concise pass/fail summary without secrets.
8. Run three consecutive hero demos from explicit capture start with no manual intervention after start; reset only through documented user controls between runs.

## Verification and release matrix

### Required automated gates

- Formatting/linting, Python/TypeScript type checks, generated-contract freshness, unit tests, contract tests, migration tests, API integration, extension Playwright smoke, PWA/service-worker tests, secret/log-redaction tests, and production builds.
- Recorded adapter tests with live network disabled in standard CI.
- Failure injection for each external dependency and idempotency at every create/complete/deliver boundary.
- Security checks for URL fetch restrictions, CORS/CSP/extension permissions, public response allow-list, pairing abuse, secret storage, and log redaction.

### Deployment smoke gates

1. `/healthz` and `/readyz` pass with safe responses.
2. Migration version matches the deployed application.
3. Session creation and WebSocket connection work over public HTTPS/WSS.
4. Canonical public claim deep link loads directly and on refresh.
5. Extension production build connects only to configured origins.
6. PWA installs/updates and its service worker handles a synthetic push.
7. Database persistence survives application restart/redeploy.
8. No secret or sensitive payload appears in sampled logs or browser/backend network paths outside the selected provider.

### Final hero release gate

For three consecutive runs on a clean Chrome profile and installed iPhone PWA:

1. Explicit capture starts on the chosen two-person YouTube debate.
2. Audio stays audible and two-speaker transcript remains stable.
3. The target factual claim triggers once; opinion controls do not.
4. The tab is backgrounded and processing continues.
5. A validated verdict with 2–3 working sources, uncertainty, counterevidence, and supported common ground when available completes within 30 seconds target and no later than 45 seconds.
6. The locked phone receives one notification and opens the same canonical verdict.
7. No user key, team key, raw audio, push secret, or authorization data appears in backend persistence or logs.
8. No operator intervention occurs after the user starts capture.

If any run fails, classify the cause, correct or deliberately choose the disclosed fallback, reset via the documented procedure, and restart the count at one.

## Demo-day runbook

### Before venue/day

- Freeze the deployed commit, extension build, fixture version, prompt/model versions, and provider configuration.
- Verify all citations, quota/billing caps, TLS/domain expiry, VAPID keys, database health, and rollback build.
- Keep a second subscribed phone and a local copy of install/recovery instructions.

### Before judging

- Run automated preflight and one synthetic health/push check.
- Confirm the clean browser profile, hero URL/timestamp, capture permission, provider mode, active phone pairing/subscription, network, and visible fallback indicator behavior.
- Clear old notifications and use a fresh session; do not expose API keys or pairing secrets on screen.

### During demo

- Start through the same explicit user gesture used in rehearsal.
- Let canonical visible states communicate progress; do not manually manipulate intermediate data.
- If an external dependency fails, use only the documented, disclosed fallback path and state that fallback is active.

### After demo

- Stop capture, verify audio resources release, revoke temporary pairings/subscriptions if required, and follow data retention/deletion policy.
- Preserve sanitized correlation IDs and outcome timings for retrospective review.

## Residual risks accepted for MVP

- One API instance means no horizontal failover or cross-instance WebSocket fan-out.
- In-flight in-memory provider work may be lost on process restart, though canonical committed state remains in PostgreSQL.
- Client-side BYOK storage and cost estimates are prototype safeguards, not production credential/billing guarantees.
- Push acceptance does not guarantee device display under every iOS/network/focus condition; a second device and disclosed fallback mitigate the demo.
- Hero fixture coverage is deliberately narrow and cannot be presented as general claim-checking reliability.

## Phase exit gate and MVP definition of done

Phase 5 and the MVP pass only when:

- BYOK save/test/use/budget/delete and explicit team-demo mode meet their security and disclosure requirements.
- Every external dependency is bounded, observable, and has an honest failure/fallback path.
- Deployment is reproducible, healthy, single-instance, and persists canonical state in managed PostgreSQL.
- All automated, security, migration, browser, PWA, citation, and real-device gates pass.
- Three consecutive clean-profile, locked-phone hero rehearsals complete without manual intervention.
- The seven product criteria in `IMPLEMENTATION_PLAN.md` Definition of Done are satisfied.

## Post-MVP handoff

Record the deployed release, run results, known limitations, costs/quotas, retention policy, rollback instructions, risk register, and prioritized defects. Do not begin queues, Redis fan-out, multi-instance scaling, semantic cache, new platforms, extra speakers, or governance expansion until the hero loop remains reliable and user demand justifies those changes.
