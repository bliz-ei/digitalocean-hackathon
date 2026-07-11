# Verity Phase 4/5 runbook

## Required runtime secrets

- `VERITY_DATABASE_URL`
- `VERITY_PAIRING_SECRET` (32+ random bytes)
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT` (a `mailto:` or HTTPS contact)
- `VERITY_ALLOWED_ORIGINS` (exact PWA origins, comma-separated)

Build the PWA and extension with `VITE_API_URL=https://<api-host>`.

## Cross-device rehearsal

1. Install the PWA from Safari using Add to Home Screen and launch that installed app.
2. Start fixture or live mode in the desktop extension.
3. Enter the six-digit overlay code on the phone.
4. Tap **Enable notifications**. Permission is never requested before this gesture.
5. Lock the phone. Complete a fixture verdict; Phase 3 must call `cross_device.notify(...)` after its live verdict commit.
6. Tap the notification and confirm `/claims/{public_id}` matches the desktop canonical result.
7. Repeat three times and verify only one notification per claim/subscription.

## Release preflight

```sh
npm ci
npm test
npm run typecheck
npm run build
npm run contracts:check
npm run preflight
```

Run migrations through `003_cross_device.sql`, deploy one API instance, then verify `/healthz` and `/readyz`. The API must remain single-instance while live WebSocket state is in memory.

## Explicit limitations

- Phase 3 is not on `main`; the live pipeline currently stops at `CHECKING`. Fixture completion exercises the notification hook today.
- Pairing/push coordinator state is in-process until the repository adapter is switched to the migration-backed tables. A restart invalidates active pairings in this branch.
- Real iPhone delivery requires HTTPS, a Home Screen PWA, valid VAPID keys, and a real-device rehearsal.
- BYOK keys use local extension storage as a prototype safeguard, not production encrypted custody.
