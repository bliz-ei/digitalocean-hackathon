# Phase 0 probe protocol

This protocol governs the runnable boundary probes and their required manual
device/provider steps. Local execution alone does not pass a gate. Credentials
stay outside the repository, audio stays transient unless explicitly approved,
and only sanitized metadata enters a run record.

## Common protocol

1. Freeze the hero URL, time range, neutral labels A/B, exact claim, and fixture
   review owner in a local copy of the demo manifest. Until then, all gates are
   blocked.
2. Create a run record before the attempt. Identify actual device model,
   OS/browser version, network description, provider/API mode, owner, and UTC
   start/end times.
3. Use synthetic high-entropy session and claim identifiers. Never record a key,
   authorization header, raw provider body, raw audio, push endpoint, or
   subscription key.
4. Record the shared event timestamps when applicable: capture start, first audio
   chunk, first final transcript, claim finalization, push send, push receipt,
   and notification open.
5. Record observed failure modes and evidence paths. Mark `passed` only after the
   boundary-specific criteria are checked from measured evidence.
6. Repeat as specified, including one clean restart or forced reconnect. Redact
   and validate records before review.

Latency is calculated as later event minus earlier event. Negative intervals are
invalid. Sequence analysis reports missing, duplicate, and out-of-order chunk
numbers; it must not infer events that were not recorded.

## 0A — Baseline

Freeze the exact clip and fallback checkpoints. Use the manifest and run/decision
templates. The PRD example is not the selected clip unless the team explicitly
freezes it. Gate: manifest fields are complete and test data is non-sensitive.

## 0B — MV3 tab audio

From an explicit extension gesture, obtain the tab stream in an offscreen
document, route it through an audio output, and emit one-second Opus chunks with
monotonic sequence numbers. Exercise unfocused tab for at least two minutes,
window minimization, pause/resume, navigation, content/service-worker idling or
restart, forced transport disconnect/reconnect, explicit stop, and tab close.
Observe audibility, timing drift, dropped/duplicate chunks, CPU, reconnection,
and released tracks/nodes. Run three hero attempts including a clean restart.

Gate: all three preserve audible playback, ordered chunks, two minutes of
background continuity, one reconnect without duplicate sequence numbers, and a
clean stop. If offscreen capture is unreliable, record a no-go; do not continue
integration on an assumed browser constraint.

## 0C — Managed STT and diarization

Feed each serious candidate the exact captured encoding, not a converted proxy.
Retain only permitted provider metadata and normalized final segments shaped as
`{speaker,text,start_ms,end_ms}`. Test three cold connections and one mid-stream
reconnect. Observe target-claim intelligibility, punctuation, A/B stability,
final latency, reconnect support, keepalive/header/finalization requirements,
speaker hints, and cost.

Gate: three consecutive runs assign an intelligible target claim consistently to
the correct A/B speaker and finalize it within five seconds. Timing fields must
come from the provider/measurement; never invent them.

## 0D — Direct extension-origin BYOK

Test DigitalOcean and exactly one OpenAI-compatible provider independently from
the unpacked extension using explicit minimal host permissions. For each, test
connection, three compact classification requests, three synthesis-shaped
requests with synthetic evidence IDs, invalid JSON detection, a sanitized
failure, and key deletion. Observe HTTPS endpoint shape, required non-secret
headers, extension-origin behavior, structured-output mode, exact model, warm
and cold latency, token usage, timeout/retry behavior, and safe errors.

Gate: both candidates pass connection, classification, synthesis, failure, and
delete-key checks. Reject an endpoint if the key must transit Verity, extension
calls are incompatible, or required structure is unreliable. Never weaken the
gate or advertise an unverified provider.

## 0E — iPhone Home Screen PWA push

Use an App Platform-compatible HTTPS deployment and the physical demo iPhone.
Install the PWA to Home Screen; request permission only from a visible tap.
Subscribe with externally stored VAPID material, send to a synthetic unguessable
claim route, and measure send/receive/open. Exercise locked phone, closed PWA and
browser, Wi-Fi/cellular if available, denied permission, revoked/expired
subscription, and deletion without logging subscription material.

Gate: three locked-phone notifications arrive and open the matching route;
revocation prevents later delivery and exposes a recoverable state. Prepare a
second device or a visibly disclosed on-screen fallback.

## 0F — Fallback checkpoints

Review final transcript segments, classification plus queries, search/extracted
evidence, validated verdict, and simulated push outcome against the schemas.
Fallback activates only through an explicit demo toggle or bounded provider
failure and must visibly say `Demo fallback`. A named owner must revalidate
retained citations before the demo.

Gate: one full inventory review confirms every external stage has a checkpoint,
the shapes/state transitions match live adapters, and no placeholder is presented
as a measured provider/device result.
