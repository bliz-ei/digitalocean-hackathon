# Verity Phase 2 Plan — Live Transcript and Claim Detection

## Phase outcome

Replace the walking skeleton's audio, transcription, and fast-model classification fakes with a reliable live path. The extension must capture the selected YouTube tab, preserve audible playback, stream ordered audio, display stable two-speaker final transcripts, assemble complete sentences, and detect the hero factual claim exactly once with the correct speaker and timestamp.

The Phase 1 fixture path remains available as a regression tool and disclosed fallback. Search, evidence, synthesis, and push remain fake in this phase so failures can be isolated to the live transcript/claim boundary.

## Entry criteria

- Phase 1 passes its complete fake-provider hero flow and contract-generation gate.
- Phase 0 audio/STT/BYOK compatibility decisions are current on the actual demo devices.
- Audio, transcript, classification, session, and WebSocket schemas are frozen or versioned for a deliberate migration.
- The selected STT provider and fast model are configured through secret-safe local environments.
- The hero clip URL, target time range, exact expected claim, and A/B speaker expectation are frozen.

## Scope

### Included

- Production-shaped MV3 tab capture in the offscreen runtime.
- One-second encoded audio chunks, WebSocket backpressure, acknowledgements, heartbeat, reconnect, and ordered replay policy.
- Managed streaming STT adapter with two-speaker diarization normalization.
- Final transcript persistence/broadcast, speaker-label continuity, and sentence assembly.
- BYOK fast-model classification from the extension plus backend team-key fallback through the same logical contract.
- Classification validation, exact claim normalization, query planning, claim deduplication, and immediate `CHECKING` transition.
- Live/fake mode observability and targeted automated/real-device tests.

### Excluded

- Live search/page extraction, reasoning-model verdict synthesis, real pairing/Web Push, production deployment, multi-speaker support, semantic cache, and generalized transcript correction UI.

## Contract refinements to freeze before implementation

### Audio upload payload

Document session ID, stream ID, monotonic chunk sequence, capture timestamp, duration, encoding/container, sample rate/channels, and binary payload framing. Define maximum chunk size, maximum buffered duration, acknowledgement watermark, late/duplicate handling, and end-of-stream signal.

### Final transcript segment

Keep the canonical shape `{speaker, text, start_ms, end_ms}` and add only provider segment ID/finality metadata if needed for idempotency. Provider-native labels never cross the adapter boundary. Times are session-relative monotonic milliseconds.

### Classification request/response

The request includes a stable candidate ID, exact assembled sentence, speaker label, start/end times, and minimal adjacent context. The structured response contains classification, normalized exact claim when factual, and bounded neutral/support/counter query lists. It must not contain a UI verdict.

### Idempotency keys

- Audio identity: session plus stream plus sequence.
- Transcript identity: session plus provider/final-segment identity or deterministic content/time key.
- Candidate identity: session plus normalized speaker/time/text digest.
- Claim identity: session plus normalized claim digest within the configured temporal window.

## Workstream 2A — Extension capture lifecycle

**Owner:** Tri, reviewed by Moh.

1. Start capture only from an explicit extension user gesture and only for the active supported YouTube tab.
2. Create/reuse one offscreen document; the service worker coordinates but does not own the media stream.
3. Consume the tab stream ID in the offscreen document and route the stream back through `AudioContext` so normal playback remains audible.
4. Encode provider-compatible one-second chunks without retaining raw audio beyond the bounded send buffer.
5. Associate capture with one session/stream identity and emit strictly increasing sequence numbers.
6. Implement start, pause/video silence, resume, stop, tab close, navigation, extension reload, and unexpected track-ended behavior.
7. Display actionable state when tab capture permission, offscreen creation, encoder setup, or supported-Chrome checks fail.
8. Release tracks, audio nodes, timers, sockets, and buffers after stop; prevent concurrent capture sessions unless deliberately supported.

**Acceptance:** the hero clip remains audible and produces correctly timed chunks for at least two minutes while focused, backgrounded, and minimized; start/stop is repeatable without leaked capture indicators or duplicate offscreen runtimes.

## Workstream 2B — Audio WebSocket reliability

**Owners:** Tri for client; Arnav for gateway.

1. Authenticate the socket with the short-lived session credential established in Phase 1.
2. Maintain a heartbeat and surface connection health separately from pipeline state.
3. Use server acknowledgement watermarks to release buffered chunks and bound memory.
4. On reconnect, resume only unacknowledged chunks still inside the configured short buffer; never replay an entire session.
5. Reject or ignore duplicate/late chunks deterministically at the gateway and record counts.
6. Apply backpressure: discard stale partial transcript display events before final transcript or canonical state events; do not silently discard final audio without transitioning to a recoverable error.
7. Define maximum retry window and terminal handling when STT continuity can no longer be trusted.
8. Restore overlay/session state from the server after content-script remount or service-worker wakeup.

**Acceptance:** a forced short disconnect during the hero segment reconnects without duplicate final transcripts or duplicate claims, and bounded buffering prevents unbounded client/server memory growth.

## Workstream 2C — Managed realtime STT adapter

**Owner:** Moh.

1. Implement the Phase 0-selected provider behind the existing STT protocol; provider SDK/types remain confined to the adapter.
2. Configure the proven encoding, language, punctuation/finalization, two-speaker hint, and diarization options.
3. Normalize provider results into partial display updates and canonical final transcript segments; persist only finals.
4. Map provider speaker identities to session-stable A/B labels. Ignore model identity guesses and do not attach personal attributes.
5. Handle provider connection warmup, keepalive, rate limit, timeout, malformed event, server close, and clean end-of-stream.
6. Preserve session-relative timestamps and ensure reconnect does not reset or overlap the timeline.
7. Record provider name, segment latency, finalization latency, reconnect count, and sanitized error code; never log audio bytes.
8. Retain a recorded-response adapter for CI and the hero transcript fixture for fallback.

**Acceptance:** in three consecutive live runs, the target sentence is intelligible, final, aligned to the correct A/B speaker, and available within the five-second transcript budget.

## Workstream 2D — Sentence assembly

**Owner:** Moh, with Jun defining classification-ready boundaries.

1. Consume only canonical final segments for claim triggering; partials are display-only.
2. Accumulate adjacent segments from the same speaker until punctuation/finality or a bounded silence/length rule closes the sentence.
3. Close the current sentence on speaker change, while avoiding one-word backchannels becoming claim candidates.
4. Preserve exact transcript text and start/end time while creating a separately normalized classification string.
5. Cap context length and sentence duration; split pathological run-ons without losing traceability.
6. Deduplicate repeated provider finals and corrections using stable segment/candidate identities.
7. Emit candidate events in order and record candidate-finalization latency.
8. Add deterministic test vectors for punctuation, speaker switches, interrupted speech, repeated finals, short acknowledgements, and the exact hero sentence.

**Acceptance:** the hero claim is assembled once with exact traceable text, correct speaker, and timestamp; opinion/control sentences produce stable candidate boundaries without corrupting the transcript.

## Workstream 2E — Fast-model dispatch modes

**Owners:** Tri owns direct BYOK; Arnav owns team-key fallback; Jun owns prompt/schema.

1. Keep one provider-neutral classification contract and versioned prompt regardless of dispatch mode.
2. In user-key mode, the backend emits a classification request event; the offscreen runtime calls only the selected verified provider and returns the structured result through the authenticated session.
3. In team-demo mode, the backend invokes its model adapter using environment-managed secrets and visibly marks the session `Demo key`.
4. Never send a user key, model authorization header, or raw provider error body to the backend.
5. Apply strict per-call timeout, one retry only for a retry-safe transient failure, response-size limit, and schema validation.
6. Include only the candidate sentence and bounded adjacent context; do not send the full transcript by default.
7. Record provider/model, prompt version, latency, token/usage counts where available, and sanitized error category.
8. Keep fake classification selectable for deterministic CI and explicit demo fallback.

**Acceptance:** direct BYOK and team-key fallback both return contract-identical classification results on the hero candidate, while invalid, timed-out, or disconnected client results fail safely.

## Workstream 2F — Classification policy and claim creation

**Owner:** Jun.

1. Version a compact prompt that defines `opinion`, `factual_claim`, and `unverifiable`, prohibits verdict generation, and requires neutral query planning only for factual claims.
2. Validate enum values, exact/normalized claim constraints, query counts/lengths, and absence of unsupported fields.
3. Route opinion and unverifiable results to a non-checking terminal candidate outcome without creating canonical claims.
4. For factual results, create the canonical claim in one idempotent operation using exact transcript text, normalized text, A/B speaker, and session-relative times.
5. Broadcast `CHECKING` immediately after successful creation; never wait for downstream evidence.
6. Deduplicate exact/rephrased repeats within a documented session window using deterministic normalization first. Avoid semantic/pgvector deduplication in the critical path.
7. If classification results arrive after the candidate/session is closed, ignore them deterministically and record a stale-result metric.
8. Bound concurrent outstanding candidates so rapid transcript flow cannot create uncontrolled model spend.

**Acceptance:** the target claim creates exactly one canonical claim and one `CHECKING` transition; selected opinions do not trigger checks; replay and reconnect do not duplicate it.

## Workstream 2G — Overlay transcript and checking UX

**Owner:** Tri.

1. Render partial transcript optimistically but visually distinguish it from canonical final text.
2. Maintain stable A/B speaker labels and allow only the planned one-time manual A/B swap for the demo if the product design includes it.
3. Show connection and Listening states without covering essential YouTube controls.
4. Show Checking with exact claim/speaker/timestamp from the canonical claim, not from a local approximation.
5. Render opinion/unverifiable behavior non-disruptively; do not label people or imply that opinions are false.
6. Preserve state after the tab loses focus, YouTube performs client-side navigation, or the content script remounts.
7. Provide explicit retry/stop instructions for permission, socket, STT, and classification failures.
8. Keep fixture/demo-key/fallback labeling visible and accessible.

## Verification plan

### Automated

- Unit: audio sequencing, acknowledgement/replay, transcript normalization, speaker mapping, sentence assembly, claim normalization/deduplication, schema validation, stale result, concurrency cap.
- Contract: recorded STT responses and both fast-model dispatch modes against Pydantic/JSON Schema.
- Integration: simulated ordered audio through recorded STT to one persisted claim and fake downstream verdict.
- Browser: unpacked extension on a controlled video page, background/minimize approximation, content-script remount, forced socket reconnect, and exact one-claim assertion.
- Regression: the full Phase 1 fixture flow remains green and requires no live credentials in normal CI.

### Real-device hero runs

Run at least three consecutive cold-start sessions on the selected laptop/browser and actual YouTube clip. Record capture start, first chunk, first final segment, candidate finalization, classification return, canonical claim creation, and `CHECKING` display. Include one background-tab run and one short forced reconnect run.

### Negative cases

- Unsupported Chrome or denied tab permission.
- Video paused/silent and tab closed mid-capture.
- Duplicate/out-of-order chunk and transcript final.
- STT timeout/rate limit/malformed event.
- Provider returns opinion, unverifiable, invalid JSON, extra query count, or slow result.
- BYOK client disappears while a classification request is outstanding.
- Repeated target sentence within and outside the deduplication window.

## Performance and privacy gates

- Audio chunks are approximately one second and raw bytes are transient only.
- Transcript finalization remains within the five-second stage budget on the hero run.
- Fast classification completes within the two-second target when warm; deviations are measured and do not silently expand timeouts.
- Only claim-relevant final transcript is retained according to the current MVP policy; no full raw audio persistence exists.
- Logs contain correlation IDs, sequence ranges, durations, provider/model, usage, and error codes but no audio, keys, headers, or complete prompts/bodies.
- Client buffers, outstanding candidates, retries, and provider costs are bounded.

## Recommended implementation order

1. Freeze payloads, idempotency identities, and recorded-response fixtures.
2. Implement capture/audio playback and prove clean lifecycle locally.
3. Implement WebSocket acknowledgements, buffering, reconnect, and gateway deduplication.
4. Integrate STT adapter and normalize final transcript/speaker/timestamps.
5. Implement/test sentence assembly.
6. Add BYOK and team-key classification dispatch with validation.
7. Add deterministic claim creation/deduplication and Checking broadcast.
8. Finish overlay recovery/error UX, automated tests, then three real-device runs.

## Phase exit gate

Phase 2 passes only when:

1. The actual YouTube hero segment remains audible while live capture continues in a background tab.
2. Final transcript displays two stable speakers and the target sentence with a correct timestamp.
3. The target factual claim is detected and persisted exactly once.
4. Opinion and unverifiable controls do not create claims.
5. A short reconnect does not duplicate transcript segments or claims.
6. Transcript plus classification fit the combined stage budget in three consecutive runs.
7. The fake evidence/verdict continuation still completes the end-to-end walking skeleton.

## Handoff to Phase 3

Provide the canonical live claim record, validated neutral/support/counter queries, classification prompt version, normalized transcript/candidate fixtures, measured stage latency, and any provider limitations. Phase 3 consumes only canonical factual claims and query plans; it must not depend on raw audio, partial transcripts, or provider-native STT details.
