# Phase 0 runbook

Read `PROBE_PROTOCOL.md` first. Create an ignored record for every attempt, fill it with observed UTC timestamps only, then validate and summarize it:

```sh
npm run phase0:new-run -- --boundary tab_capture --owner Tri
npm run phase0:summarize -- phase0/results/<run>.json
python3 phase0/harness.py validate --include-results
```

Never record credentials, authorization headers, provider bodies, raw audio, push endpoints, or subscription keys.

## 0A — Freeze the demo

Copy `templates/demo-manifest.example.json` to ignored `phase0/local/demo-manifest.json`. Fill the exact YouTube URL/range, neutral labels A/B, target claim, and fixture owner. The PRD example is not the selected clip unless the team explicitly freezes it. Keep all gates blocked until entry criteria are met.

## 0B — Tab audio and reconnect

1. Run `npm run phase0:relay`.
2. Load `phase0/probes/extension` unpacked from `chrome://extensions` in Chrome 116+.
3. In the frozen YouTube tab, click the probe toolbar action. That direct gesture obtains the stream ID and starts the offscreen runtime; the dashboard then opens.
4. Set `ws://127.0.0.1:8787` for the next capture. Confirm playback remains audible.
5. Exercise two minutes unfocused, minimized window, pause/resume, YouTube navigation, service-worker termination, **Force transport disconnect**, stop, tab close, and extension reload.
6. Export the browser JSONL and run `npm run phase0:summarize-log -- <file>`. Record Chrome Task Manager CPU manually because extension APIs do not expose reliable per-extension CPU time.
7. Repeat three times including a clean restart. Accept only ordered unique generated sequence IDs, reconnect recovery, audible playback, and released tracks/audio context.

Audio is transient by default. For an approved short STT comparison only, start the relay with `PHASE0_RETAIN_AUDIO=1`; delete the resulting ignored WebM/Opus after comparison unless fixture retention is explicitly approved.

## 0C — STT and diarization

Select candidates first. Copy `probes/relay/stt-adapter.example.mjs` into ignored `phase0/local/`, implement its narrow interface, and read credentials from environment variables. Start it with:

```sh
PHASE0_STT_ADAPTER=phase0/local/<adapter>.mjs npm run phase0:relay
```

Use the exact captured WebM/Opus stream. Run three cold attempts and one reconnect. Retain only final normalized `{speaker,text,start_ms,end_ms}` segments and permitted metadata. Do not invent missing timing. Record target-claim intelligibility, A/B stability, latency, headers/finalization/keepalive needs, reconnect, timeouts, cost, primary choice, and disclosed cached-transcript fallback.

## 0D — Direct BYOK

Open **BYOK probe** from the extension dashboard. Test DigitalOcean Serverless Inference and exactly the checked-in OpenAI-compatible candidate (OpenAI) separately. Enter the exact model and response mode, save the key locally, then run the suite: one connection, three classification, three synthesis, and one deliberate invalid-key request. Exported results contain only status, timing, validation, retry count, and usage totals.

Delete the key and require `absent_after_delete: true`. Repeat after an extension reload for cold behavior. A rejected response mode or CORS failure is compatibility evidence; do not silently advertise or weaken an endpoint that fails.

The checked-in allowed origins are `https://inference.do-ai.run` and `https://api.openai.com`. Choosing another compatible provider requires an intentional manifest/code change and a fresh review of the exact host permission.

## 0E — iPhone Web Push

1. Run `npm run phase0:vapid` and generate a separate random admin token outside Git.
2. Deploy `probes/push/Dockerfile` from the repository root behind App Platform HTTPS. Set the variables listed in `probes/push/.env.example`.
3. On the physical iPhone, add the site to the Home Screen, launch the installed app, and tap **Enable notifications**. Permission is requested only within that tap.
4. Record the displayed non-secret subscription ID, lock the phone, and send:

   ```sh
   node phase0/probes/push/send.mjs \
     --origin https://your-probe.example \
     --subscription <id> \
     --token "$PUSH_ADMIN_TOKEN"
   ```

5. Tap the notification. Copy the sanitized send/receive/open record and confirm the `claim_<32 hex>` route matches.
6. Repeat three locked-phone runs. Also test PWA/browser closed, Wi-Fi/cellular if available, denied permission, revoke, and a send after revoke. The disposable server holds subscriptions in memory, so a restart requires resubscription.

## 0F — Fallback and exit review

Review every file in `fixtures/hero-demo` against its schema. Complete `templates/fallback-review.example.json`; require explicit/bounded activation, visible **Demo fallback**, contract-equivalent states, and a named citation revalidation owner. Placeholder files remain non-measured until replaced with reviewed, legally safe fixtures.

Copy `templates/decision.example.md` per boundary and cite only sanitized run IDs. Complete `templates/exit-review.example.md`, then run:

```sh
python3 -m unittest discover -s phase0/tests -v
npm run phase0:test-node
npm run phase0:validate
git status --short --branch
```

The phase passes only after all external boundaries meet their required repetitions on actual devices and every critical risk has an explicit owner and go/no-go decision.
