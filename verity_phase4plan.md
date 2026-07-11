# Verity Phase 4 Plan — Cross-Device Completion

## Phase outcome

Complete the desktop-to-phone hero loop. A desktop session must pair with the installed iPhone PWA, register and manage a real Web Push subscription, continue processing while the YouTube tab is unfocused, send exactly one completion notification after verdict commit, and open the same canonical verdict through an unguessable public claim URL.

This phase adds delivery and navigation only. It does not duplicate claim state, verdict generation, or evidence logic in the PWA or notification payload.

## Entry criteria

- Phase 3 produces a validated canonical verdict and stable public read response.
- Verdict completion creates an idempotent post-commit notification-needed record/event.
- The target PWA is installable on the actual demo iPhone over HTTPS, as proven in Phase 0.
- VAPID public/private keys can be injected from secure runtime configuration; no key is stored in source control.
- The extension remains connected and the backend pipeline continues during tab backgrounding.

## Scope

### Included

- Short-lived six-digit pairing and QR/deep-link redemption.
- Device association, expiry, one-time redemption, replay/rate-limit protection, and unpair behavior.
- iPhone Home Screen install guidance and user-gesture notification permission flow.
- Push subscription registration, refresh, revocation, deletion, invalid-endpoint cleanup, and device labeling.
- VAPID Web Push delivery after verdict commit, idempotent notification outcomes, and safe retries.
- Minimal notification payload containing a canonical high-entropy claim URL and display-safe summary.
- PWA navigation/fetch of canonical verdict, pending/offline/error behavior, and desktop/PWA parity.
- Background-tab, locked-phone, network, and real-device verification.

### Excluded

- Native iOS app, silent/background processing in the PWA, remote notification analytics beyond delivery outcomes, accounts, multi-user sharing permissions, notification preferences beyond MVP enable/disable, and production deployment hardening reserved for Phase 5.

## Cross-device data flow

1. The authenticated desktop session requests a short-lived pairing challenge.
2. The API returns a six-digit human code and QR/deep-link containing an opaque redemption token; neither grants public claim access by itself.
3. The installed PWA redeems once, creating or associating a device record with the desktop session/userless demo scope.
4. After an explicit `Enable notifications` tap, the PWA requests browser permission and creates a push subscription using the configured VAPID public key.
5. The PWA registers the subscription for the paired device; endpoint/key material is never exposed through public APIs.
6. Phase 3 commits the canonical verdict and notification-needed record.
7. A post-commit notification service sends once per claim/subscription and records the outcome.
8. Tapping the notification opens `/claims/{public_id}`; the PWA fetches canonical data from the API rather than trusting payload verdict text.

## Pairing contract and threat model

- Six-digit codes are display conveniences, short-lived, single-use, rate-limited, and scoped to a server-side high-entropy challenge.
- QR/deep links use an opaque random redemption token with equivalent expiry and one-use semantics.
- Store only a keyed hash of redeemable secrets where practical; never log full code/token values.
- Redemption is atomic. Replays return a stable already-used/expired response without associating another device.
- Limit active challenges per desktop session and failed attempts per IP/session/device signal.
- A paired device can be listed by safe label and revoked from desktop or PWA.
- Pairing authorizes push association and private session operations; it is not required merely to read a deliberately shareable high-entropy claim URL.
- No speaker/user identity is inferred or synchronized.

## Workstream 4A — Pairing persistence and API

**Owner:** Arnav.

1. Finalize Pairing Challenge and Device records with challenge ID, hashed secret/token, desktop session scope, created/expires/redeemed timestamps, attempt counters, and safe device label.
2. Implement challenge creation with secure randomness and configurable short expiry.
3. Implement atomic code or token redemption, attempt limits, single-use enforcement, and idempotent success for safe client retries.
4. Associate the redeemed device with the intended session scope without exposing internal IDs.
5. Add list/revoke behavior only to the extent needed for the MVP and deletion flow.
6. Expire challenges server-side and reject clock-skewed or already-used input consistently.
7. Emit sanitized audit events for creation, redemption outcome, expiry, and revocation.
8. Keep endpoint shapes within the minimal `/v1/pairings` surface, using explicit action/request schemas rather than hidden semantics.

**Acceptance:** valid code/QR redemption pairs exactly one device; expired, guessed, replayed, over-attempt, and cross-session challenges cannot pair.

## Workstream 4B — PWA installation and pairing UX

**Owners:** Tri owns UX; Arnav owns integration.

1. Detect and explain that iPhone push requires opening the site in Safari and adding the PWA to the Home Screen.
2. Separate install guidance, pairing, and notification permission into clear steps with resumable state.
3. Allow code entry and QR/deep-link redemption; show expiry and a straightforward request-new-code path.
4. Confirm the paired desktop/session using only safe display details such as video title or session label.
5. Persist only opaque device/session identifiers needed to restore paired state.
6. Handle expired/redeemed/wrong code, lost network, already-paired device, and revocation with actionable messages.
7. Make the flow usable on the target iPhone viewport with large tap targets, readable focus/contrast, and screen-reader labels.
8. Keep a rehearsal checklist that verifies Home Screen launch rather than an ordinary Safari tab.

## Workstream 4C — Notification permission and subscription lifecycle

**Owner:** Arnav, with Tri for UX.

1. Request notification permission only after the user taps a clearly labeled `Enable notifications` control.
2. Explain why permission is needed before the prompt and distinguish `default`, `granted`, and `denied` states.
3. Create the subscription through the PWA service worker with the VAPID public key and register it only for a paired device.
4. Persist endpoint and encrypted browser subscription keys as sensitive operational data; never return them from list/public endpoints or log them.
5. Make registration idempotent by device/endpoint identity and update rotated subscription data safely.
6. Implement disable/delete: unsubscribe in the browser when possible and delete/revoke server data even if browser unsubscribe fails.
7. On push-service invalid/expired responses, mark the subscription inactive and stop retrying until the client re-enables it.
8. Provide recovery instructions for denied permissions and OS/browser notification settings without repeatedly prompting.

**Acceptance:** enable, refresh, duplicate registration, disable, revoke, denied permission, and expired endpoint tests produce one correct server-side active state and no secret leakage.

## Workstream 4D — Post-commit Web Push delivery

**Owner:** Arnav.

1. Process only committed notification-needed records for terminal verdicts; never send from inside the verdict transaction.
2. Build the notification from canonical safe fields: a short neutral title/body, claim `public_id` URL, notification ID/tag, and schema version. Do not embed evidence, full transcript, credentials, or mutable verdict state.
3. Use a stable tag/idempotency key per claim and subscription so retries cannot create multiple visible notifications.
4. Apply a short send timeout and a bounded retry for retry-safe transient failures. Do not retry permanent invalid/expired subscription responses.
5. Record queued, attempted, accepted/failed, attempt count, provider response category, and timestamps without recording endpoint/key material.
6. Mark the subscription inactive when required and preserve a visible desktop status if delivery could not be attempted.
7. Isolate push failure from the canonical verdict: verdict stays complete and accessible even if delivery fails.
8. Provide a fake push adapter for CI and explicit simulator behavior for local development.

**Acceptance:** one verdict completion causes at most one visible notification per active paired subscription despite duplicate completion events or a transient retry.

## Workstream 4E — PWA service worker and canonical navigation

**Owners:** Arnav owns service worker/data; Tri owns presentation.

1. Validate push payload schema and display a generic safe message if optional display fields are missing.
2. On notification click, focus an existing PWA window at the matching canonical route or open a new Home Screen PWA window.
3. Resolve URL paths against the trusted PWA origin; never navigate directly to an arbitrary payload URL.
4. Fetch `/v1/claims/{public_id}` on open and render the shared canonical verdict components.
5. If the claim is still pending due to notification timing/network race, poll with a small bounded strategy or offer refresh; do not synthesize locally.
6. Handle offline open using a previously cached canonical response only when clearly marked with its last-updated time. Never cache sensitive pairing/subscription responses.
7. Handle not found, expired, failed, insufficient evidence, disputed, and revoked device states honestly.
8. Ensure service-worker updates do not discard an active subscription unexpectedly; test upgrade behavior.

**Acceptance:** notification click always resolves to the correct same-origin claim route and displayed verdict matches a fresh desktop canonical response.

## Workstream 4F — Background desktop continuity

**Owners:** Tri for extension; Arnav for backend; Moh/Jun verify stages.

1. Confirm the offscreen runtime, not the content script, owns audio capture and WebSocket state.
2. Confirm backend orchestration does not depend on the YouTube DOM or tab focus after audio/candidate messages arrive.
3. Preserve heartbeats and reconnect behavior while the tab is backgrounded, window is minimized, and service worker sleeps/wakes.
4. Restore overlay state from the canonical session when the user returns.
5. Ensure the server can finish evidence/synthesis and deliver push if the content script disconnects after claim creation. Document whether closing the entire browser is supported; do not imply it if capture/client BYOK is still required.
6. In direct BYOK mode, keep the offscreen runtime alive for any outstanding reasoning request; surface a clear failure/fallback path if it disappears.
7. Test focus loss before, during, and after target claim detection.

**Acceptance:** leaving/minimizing the YouTube tab after the target claim does not interrupt completion or notification in three consecutive hero runs.

## Workstream 4G — Cross-device privacy and retention

**Owner:** Arnav.

1. Classify pairing secrets, device identifiers, endpoints, and push encryption keys as sensitive operational data.
2. Apply least-privilege API response schemas and structured-log redaction.
3. Define deletion semantics for subscription, device association, expired challenge, session, and retained claim data.
4. Ensure public claim pages contain only intended shareable verdict fields and high-entropy identifiers; prevent indexing if appropriate for the demo.
5. Apply cache controls that prevent pairing/subscription responses from shared caching.
6. Add retention cleanup hooks/queries even if scheduled automation is completed in Phase 5.

## Verification plan

### Automated

- Pairing randomness/expiry/single-use, redemption races, attempt limits, replay, cross-session misuse, and safe logging.
- Subscription registration idempotency, key rotation, deletion, invalid endpoint handling, and response allow-lists.
- Notification-needed transaction boundary, duplicate completion events, retry classification, at-most-once visible tag, and verdict independence from push failure.
- Service-worker payload validation, same-origin URL resolution, focus/open behavior, pending/offline routes, and canonical response rendering.
- Existing Phase 1–3 contract, fixture, browser, and evidence trust tests remain green.

### Actual iPhone matrix

Run on the installed Home Screen PWA, not merely a Safari tab:

| Scenario | Expected result |
|---|---|
| Fresh code pairing | One device becomes paired |
| QR/deep-link pairing | Correct challenge redeems once |
| Permission grant from tap | Active subscription registers |
| Phone locked, PWA closed | Notification arrives and opens correct claim |
| YouTube tab minimized | Processing and notification continue |
| Duplicate completion/retry | One visible notification |
| Subscription disabled | No send; server record revoked/inactive |
| Network unavailable on tap | Honest offline/retry view, no wrong verdict |
| Stale/invalid endpoint | Subscription deactivates without affecting verdict |

### Timing

Record claim completion commit, push attempt, push-service acceptance, device display observation, notification tap, route open, and canonical data render. The whole hero loop remains under 45 seconds from claim completion target context, with the backend pipeline still targeting 30 seconds.

## Demo runbook additions

1. Confirm target iPhone/iOS and PWA Home Screen installation.
2. Confirm notifications are enabled at both PWA and OS level.
3. Confirm current active subscription and VAPID configuration through a safe readiness indicator.
4. Send a synthetic test notification before judging, then clear it.
5. Pair the intended desktop session and verify video/session label.
6. Lock the phone and place it visibly without exposing pairing codes or secrets.
7. Keep a second subscribed device and disclosed on-screen fallback available for venue-network failure.

## Recommended implementation order

1. Freeze pairing/device/subscription/notification contracts and threat model.
2. Implement pairing persistence/API and race/security tests.
3. Build install/pair UX and real device redemption.
4. Implement permission/subscription lifecycle and deletion.
5. Add post-commit delivery, outcomes, retry/idempotency, and fake adapter tests.
6. Implement service-worker click navigation and canonical route/offline behavior.
7. Harden background-tab continuity and state restoration.
8. Run the actual-iPhone matrix and three consecutive locked-phone hero rehearsals.

## Phase exit gate

Phase 4 passes only when:

1. The demo iPhone pairs securely and holds one active revocable subscription.
2. The locked phone receives exactly one notification for the completed hero claim.
3. Tapping it opens the matching high-entropy public claim URL in the PWA.
4. Mobile and desktop display the same canonical verdict; notification data is not treated as canonical.
5. Processing continues when the YouTube tab loses focus/minimizes.
6. Expired pairing, duplicate events, denied permission, revoked/invalid subscription, and push failure behave safely.
7. Three consecutive real-device hero runs succeed within the 45-second product target.

## Handoff to Phase 5

Provide the paired demo device checklist, active subscription/readiness semantics, VAPID secret requirements, notification outcome metrics, public claim route, cross-device test evidence, and documented network fallback. Phase 5 operationalizes these pieces without changing their public contracts.
