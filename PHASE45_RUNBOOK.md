# Verity release and demo runbook

## Deployment inputs

- The App Platform development PostgreSQL database declared in `infra/app.yaml` (or replace its
  `${db.DATABASE_URL}` binding with a production database URL).
- `VERITY_PAIRING_SECRET`: at least 32 random characters.
- `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`: one matching Web Push key pair.
- `VAPID_SUBJECT`: a `mailto:` or HTTPS contact.
- `VERITY_STT_API_KEY`: a Deepgram key required by the production deploy command. At runtime,
  missing or failed Deepgram connectivity degrades to the disclosed recorded fixture;
  `VERITY_STT_MODEL` overrides the default `nova-3`.
- `VERITY_STT=recorded` (demo kill-switch: forces the recorded fixture even when the Deepgram key is set. With a key set and no kill-switch, a failed Deepgram connect degrades to the recorded fixture automatically; `/readyz` then reports `"stt": "recorded"` and claims carry `fixture_mode=true`.)
- `VERITY_GRADIENT_AGENT_ENDPOINT` and `VERITY_GRADIENT_AGENT_KEY`: the Gradient agent
  endpoint URL and access key. When set, evidence collection uses the agent (PDF knowledge
  base first, web-search tool fallback) with automatic degrade to the recorded fixture on
  failure; `/readyz` reports the active collector under `"evidence"`. The agent's knowledge
  base documents are listed in `fixtures/gradient-kb.json`.
- `VERITY_EVIDENCE=recorded` (demo kill-switch: forces recorded evidence even when the
  Gradient agent is configured.)

The App Platform spec binds the public app URL into both `VITE_API_URL` and
`VERITY_ALLOWED_ORIGINS`. Its pre-deploy job applies each migration exactly once and rejects
edited migrations that have already been applied.

## Deploy

1. Merge the release PRs to `main`, grant DigitalOcean's GitHub app access to this repository once,
   and install `doctl`.
2. Set `DIGITALOCEAN_ACCESS_TOKEN`, then run:
   `./scripts/deploy.ps1 -VapidSubject mailto:<team-contact>`.
3. Save the printed app ID as `VERITY_APP_ID`; rerunning the command then updates the same app.
4. Confirm the `migrate` pre-deploy job succeeds before the API and PWA become healthy.

The command generates and locally persists one stable pairing secret and VAPID key pair under the
gitignored `.verity/` directory, renders a secret-bearing spec there, deploys it, builds the Chrome
extension against the deployed URL, and runs the strict release preflight. Never rotate or delete
`.verity/deploy-secrets.json` after users subscribe unless you intend to pair them again.

## Three-run demo rehearsal

Before the manual phone rehearsal, run the automated gate against the deployment
(three consecutive end-to-end fixture runs plus a live WebSocket heartbeat):

```sh
VERITY_HEALTH_URL=https://<app-url> npm run demo:rehearsal
```

For each manual run, create a fresh session and use a fresh claim:

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
