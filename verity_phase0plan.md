# Verity Phase 0 Plan — Prove the Risky Edges

## Phase outcome

Prove every external boundary on the actual demo hardware and network before committing the MVP architecture to provider-specific implementation. This phase is complete only when Chrome tab audio, managed streaming transcription with two-speaker diarization, direct extension-origin BYOK requests, and iPhone Home Screen Web Push each work independently and leave reproducible evidence.

This is a risk-retirement phase. Its outputs are compatibility decisions, measurements, fixtures, and narrow disposable probes; it does not build the integrated product.

## Source requirements

- Primary plan: `IMPLEMENTATION_PLAN.md`, Phase 0 and platform constraints.
- Product behavior: `PRD.md`, especially the hero demo, BYOK safety, and demo fallback.
- Supported target: Chrome 116 or newer, one selected two-person YouTube clip, one physical demo iPhone, DigitalOcean App Platform-compatible services.
- Non-goals: production UI, permanent abstractions, broad provider coverage, more than two speakers, infrastructure scaling, and an end-to-end application.

## Entry criteria

- The hero YouTube video, exact time range, and expected target claim are frozen.
- The primary Chrome laptop and physical iPhone are available.
- Candidate STT, search, model, and push providers have test credentials stored outside the repository.
- A team member is assigned to each boundary using the ownership in `IMPLEMENTATION_PLAN.md`.
- Test data contains no sensitive audio or credentials.

## Decisions this phase must close

1. Which managed realtime STT provider meets accuracy and latency needs on the hero clip.
2. Which two model endpoints are safe to advertise for direct BYOK use from an extension origin.
3. Which audio encoding, chunk duration, sample rate, and reconnect behavior become the Phase 1 contract assumptions.
4. Whether the selected iPhone/iOS version and venue-like network reliably support Home Screen PWA push.
5. Which disclosed fixture checkpoints are required to preserve the hero state transitions during provider failure.

Record each decision in a short decision log with date, owner, alternatives tested, measured evidence, decision, and rollback option. Never record secrets, authorization headers, full provider request bodies, or raw audio.

## Workstream 0A — Demo baseline and measurement harness

**Owner:** Arnav coordinates; all owners contribute.

1. Freeze the hero clip URL, timestamps, expected two speaker identities as neutral labels A/B, exact claim text, and expected verdict fixture.
2. Define a common run sheet with device model, OS/browser version, network, provider, start/end timestamps, failure mode, and pass/fail notes.
3. Define shared timestamps for capture start, first audio chunk, first final transcript, claim sentence finalization, push send, push receipt, and notification open.
4. Create a sanitized artifact location for compatibility results and disclosed hero fixtures; keep probe-only assets clearly separated from future production modules.
5. Establish the latency targets used during spikes: one-second audio chunks, first useful final transcript within five seconds of speech completion, direct model classification within two seconds when warm, and push receipt/open within the overall 45-second hero budget.
6. Run each boundary at least three times, including one clean restart, so a single lucky result is not accepted.

**Deliverables:** frozen demo manifest, measurement template, sanitized run results, and an initial fallback checkpoint list.

## Workstream 0B — MV3 tab audio and background continuity

**Owner:** Tri, with Moh validating audio suitability.

1. Use an explicit extension user gesture to obtain the tab-capture stream ID from the service worker and consume it in an offscreen document.
2. Route the captured stream through an `AudioContext` to an output so YouTube remains audible while capture is active.
3. Verify the offscreen runtime remains responsible for capture while the content script and service worker are idle or restarted.
4. Produce one-second Opus chunks with monotonic sequence numbers and measure timing drift, dropped chunks, and CPU use over the hero segment.
5. Exercise tab backgrounding, window minimization, YouTube navigation boundaries, pause/resume, capture stop, extension reload, WebSocket disconnect, and reconnect.
6. Confirm capture stops cleanly and all media tracks/audio nodes are released after the user stops or the tab closes.
7. Retain only a short, non-sensitive test recording if required for STT comparison; otherwise keep audio transient and document deletion.

**Pass criteria:** three hero-segment runs preserve audible playback, produce ordered chunks, continue for at least two minutes while the tab is unfocused, and recover from one forced transport disconnect without duplicating sequence numbers.

**Failure decision:** if offscreen capture is unreliable on the target Chrome build, stop the phase and resolve the browser/version constraint before integrated work begins.

## Workstream 0C — Managed streaming STT and diarization

**Owner:** Moh.

1. Feed the exact captured encoding into each serious STT candidate using its realtime API; avoid comparing a different prerecorded format.
2. Capture only provider metadata and final transcript fixtures needed for evaluation.
3. Evaluate final-segment latency, punctuation, word accuracy around the target claim, speaker change detection, label stability, reconnect support, and usage cost.
4. Verify the provider can normalize output to `{speaker, text, start_ms, end_ms}` without inventing timing data.
5. Test the selected clip from a cold connection three times and with one mid-stream reconnect.
6. Document any provider-specific requirement for keepalives, audio headers, finalization signals, or speaker-count hints.
7. Select one primary provider and one fallback approach. The fallback may be the disclosed cached transcript rather than a second live vendor.

**Pass criteria:** the target claim is transcribed intelligibly, assigned consistently to the correct A/B speaker, and finalized within the five-second stage budget in three consecutive runs.

**Recorded decision:** provider, API mode, encoding parameters, speaker-label mapping behavior, timeouts, retry boundary, expected cost, and fixture format.

## Workstream 0D — Direct extension-origin BYOK compatibility

**Owner:** Tri validates browser behavior; Jun validates structured model outputs.

Test DigitalOcean and exactly one OpenAI-compatible provider separately.

1. Confirm the extension can call the provider over HTTPS using explicit, minimal host permissions.
2. Test authentication, endpoint shape, required headers, CORS/extension-origin behavior, supported structured-output mode, model selection, timeout behavior, and sanitized error responses.
3. Run one compact claim-classification request and one verdict-synthesis-shaped request using synthetic evidence IDs.
4. Verify model responses can be schema-validated and that invalid JSON can be identified without exposing the key.
5. Confirm the key exists only in extension-local storage during the test, is sent only to the chosen provider host, and is removed by the delete operation.
6. Measure warm/cold latency and token usage for representative fast and reasoning models.
7. Reject and do not advertise any provider that needs the key to transit Verity's backend, lacks an extension-compatible endpoint, or cannot reliably return the required structure.

**Pass criteria:** both advertised providers pass connection, classification, synthesis, failure, and delete-key checks from the unpacked extension on the demo laptop.

**Recorded decision:** verified base URL pattern, compatible model names, permissions, request mode, timeout, retry policy, safe user-facing errors, and any known limitations.

## Workstream 0E — iPhone Home Screen PWA and Web Push

**Owner:** Arnav.

1. Serve a minimal HTTPS PWA from a deployment shape compatible with App Platform.
2. Install it to the demo iPhone Home Screen and record device/iOS prerequisites.
3. Request notification permission only after a visible user tap.
4. Create a VAPID subscription, send a notification with a synthetic unguessable claim URL, and verify the notification opens the intended route.
5. Exercise locked phone, PWA closed, browser closed, Wi-Fi and cellular if available, expired/revoked subscription, and notification denied.
6. Confirm endpoint and encrypted subscription keys can be stored and deleted without logging them.
7. Prepare a second subscribed device or disclosed on-screen fallback for venue-network risk.

**Pass criteria:** three notifications sent after the phone is locked arrive and open the matching synthetic verdict route; revocation prevents later delivery and leaves a clear recoverable state.

## Workstream 0F — Fallback fixture boundaries

**Owner:** Jun and Arnav.

1. Identify the minimum disclosed fixture set: final transcript segments, classification result plus queries, search results and extracted evidence, validated verdict, and simulated push outcome.
2. Ensure fixtures use the same planned contracts and state transitions as live adapters.
3. Define when fallback may activate: explicit demo toggle or a bounded provider failure, never silent substitution.
4. Define visible `Demo fallback` labeling for extension and PWA.
5. Verify fixture URLs and excerpts are stable and legally safe to retain.
6. Document freshness checks and the owner responsible for revalidating citations before the demo.

## Security and privacy checks

- No API key, raw audio, authorization header, push private key, or full provider body is committed or logged.
- Probe logs use synthetic session/claim identifiers and redact known secret fields.
- Captured audio is deleted after the comparison unless explicitly approved as the disclosed demo fixture.
- Host permissions are limited to verified model endpoints and required YouTube origins.
- Public claim-route tests use high-entropy identifiers and contain no private user data.

## Phase verification matrix

| Boundary | Required evidence | Repetitions | Gate |
|---|---|---:|---|
| Tab capture | Ordered chunk log, audible playback, background run, clean stop | 3 | No unhandled stop or duplicate sequence |
| STT | Final segment fixture with A/B labels and timings | 3 | Correct target claim and speaker within budget |
| BYOK provider A | Sanitized compatibility record | 3 per request type | Structured responses and safe key lifecycle |
| BYOK provider B | Sanitized compatibility record | 3 per request type | Structured responses and safe key lifecycle |
| iPhone push | Send/receive/open timestamps | 3 locked-phone runs | Correct route opens each time |
| Fallback | Contract-shaped fixture inventory | 1 full review | Every external stage has an explicit checkpoint |

## Exit review

Phase 0 passes only when:

- Every external boundary works independently on the actual demo devices.
- Provider and protocol decisions are recorded with measured evidence.
- The primary and fallback choices are explicit.
- Audio, key, and logging privacy checks pass.
- Open critical risks have an owner and a go/no-go decision; none are deferred implicitly into Phase 1.

## Handoff to Phase 1

Provide the selected provider assumptions, normalized transcript contract, audio parameters, BYOK compatibility matrix, push prerequisites, fixture inventory, latency measurements, and unresolved non-critical limitations. Phase 1 must consume these as adapter contracts while still using fakes for the walking skeleton.
