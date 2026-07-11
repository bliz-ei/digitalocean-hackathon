# Verity Phase 0 probes

This directory contains the isolated, disposable probes and sanitized evidence tooling authorized by `verity_phase0plan.md`. It does not integrate the Verity product or claim any provider/device gate has passed.

## Included

- `harness.py`, schemas, templates, and tests for run creation, redaction, validation, timing, sequence analysis, and fallback inventory.
- `probes/extension`: plain-JavaScript Chrome 116+ MV3 audio and direct BYOK probes. Audio stays in the offscreen runtime unless explicitly streamed to the loopback relay.
- `probes/relay`: a credential-free loopback WebSocket receiver with ACK/deduplication, optional approved audio retention, and a local STT-adapter seam.
- `probes/push`: a minimal HTTPS-ready Home Screen PWA and VAPID sender with explicit permission, revocation, and synthetic high-entropy claim routes.
- `fixtures/hero-demo`: non-measured placeholders for the five disclosed fallback checkpoints. They are not deployable evidence.

## Commands

The artifact harness uses only the Python standard library. The relay and push probes intentionally add only `ws` and `web-push`.

```sh
npm ci
python3 -m unittest discover -s phase0/tests -v
npm run phase0:test-node
npm run phase0:validate
npm run phase0:new-run -- --boundary tab_capture --owner Tri
npm run phase0:summarize -- phase0/results/<run>.json
npm run phase0:summarize-log -- phase0/results/<events>.jsonl
```

Generate VAPID keys with `npm run phase0:vapid`; keep them in deployment environment variables. Start the local audio relay with `npm run phase0:relay`. See `RUNBOOK.md` for device/provider execution.

## Gate status

Local tests verify probe logic and sanitized contract shape only. Phase 0 remains a no-go until the frozen clip exists and every required repetition is measured on the actual Chrome laptop, managed providers, venue-like network, and locked iPhone. No unmeasured template may be marked passed.

## Safety defaults

- Results, local adapters, credentials, and audio are Git-ignored.
- Audio retention is off unless `PHASE0_RETAIN_AUDIO=1` is set deliberately.
- The relay accepts loopback clients only and never accepts credentials.
- Provider response bodies, authorization headers, keys, push endpoints, and subscription keys are not logged.
- Push subscriptions are held in memory only and removed on revoke or permanent delivery failure.
