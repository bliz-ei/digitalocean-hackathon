# Verity release and demo runbook

## Deployment inputs

- The App Platform development PostgreSQL database declared in `infra/app.yaml` (or replace its
  `${db.DATABASE_URL}` binding with a production database URL).
- `VERITY_PAIRING_SECRET`: at least 32 random characters.
- `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`: one matching Web Push key pair.
- `VAPID_SUBJECT`: a `mailto:` or HTTPS contact.
- `VERITY_STT_API_KEY` (optional Deepgram key; live STT falls back to the recorded fixture when unset. `VERITY_STT_MODEL` overrides the default `nova-3`.)
- `VERITY_STT=recorded` (demo kill-switch: forces the recorded fixture even when the Deepgram key is set. With a key set and no kill-switch, a failed Deepgram connect degrades to the recorded fixture automatically; `/readyz` then reports `"stt": "recorded"` and claims carry `fixture_mode=true`.)

The App Platform spec binds the public app URL into both `VITE_API_URL` and
`VERITY_ALLOWED_ORIGINS`. Its pre-deploy job applies each migration exactly once and rejects
edited migrations that have already been applied.

## Deploy

1. Merge the release PR to `main`.
2. Create or update the App Platform app from `infra/app.yaml` and provide the four secrets/settings above.
3. Confirm the `migrate` pre-deploy job succeeds before the API and PWA become healthy.
4. Set `VERITY_HEALTH_URL` to the deployed app URL and run `npm run preflight:release`.
5. Build the unpacked Chrome extension with the same app URL:
   `VITE_API_URL=https://<app-host> npm run build -w @verity/extension`.

## Three-run demo rehearsal

For each run, create a fresh session and use a fresh claim:

1. Open YouTube and start Verity from the extension.
2. Pair the iPhone by entering the six-digit code in the Home Screen-installed PWA.
3. Tap **Enable notifications**. Verify iOS reports permission granted.
4. Lock the iPhone, run the fixture, and wait for the verdict notification.
5. Tap it and confirm the public claim page matches the desktop verdict and citations.
6. Confirm exactly one notification arrived. Save a screen recording and the claim URL.

Run once in deterministic fixture mode, once with BYOK enabled, and once from a clean browser/PWA
session. Keep the best deterministic run as the recorded three-minute demo; use live mode only as
an additional proof point.

## Known architectural constraint

Keep the API at one instance for the hackathon. Claims, pairing, subscriptions, verdicts, and push
outcomes are durable in PostgreSQL, but active WebSocket session coordination is process-local.
Real iPhone delivery requires HTTPS, a Home Screen PWA, valid VAPID keys, and a physical-device test.
