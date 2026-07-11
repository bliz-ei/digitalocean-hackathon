# Verity — MVP Product Requirements

## Product

**Verity fact-checks online conversations in real time and delivers cited context across devices.**

It listens to a two-person YouTube discussion, identifies checkable factual claims, gathers evidence and counterevidence, and returns a transparent verdict with uncertainty and common ground.

## Problem

Online debates often mix fact, opinion, and rhetoric. Viewers lack a fast, credible way to verify factual claims without leaving the conversation.

## Social impact

Verity helps people pause, inspect evidence, and find shared facts before disagreement escalates. It does not decide who is “right”; it makes the factual basis of a discussion easier to examine.

## MVP user

A viewer watching a two-person debate or interview on YouTube desktop who wants trustworthy context without interrupting playback.

## Hero demo

1. The user opens a two-speaker YouTube video with the Verity extension enabled.
2. Verity labels speakers and displays a live transcript.
3. A speaker says: **“Electric vehicles produce no carbon emissions.”**
4. The overlay classifies it as a factual claim and shows: **“Verity is checking…”**
5. The user leaves or minimizes the tab; checking continues.
6. The visible iPhone receives: **“Verity found missing context — tap to inspect 3 sources.”**
7. The mobile PWA opens a verdict page:
   - **Verdict:** Misleading
   - **Why:** EVs have no tailpipe emissions, but lifecycle emissions remain.
   - Confidence and uncertainty
   - Three cited sources with short supporting excerpts
   - Strongest counterevidence
   - Common ground
8. Close: **“Verity follows the claim—not the platform.”**

## MVP requirements

### Must work

- Chrome Manifest V3 extension over YouTube.
- Capture video-tab audio and stream it to the backend.
- Track exactly two speakers consistently within one session.
- Separate factual claims from opinions; only factual claims trigger checks.
- Show a non-blocking “checking” state in the video overlay.
- Run evidence and counterevidence searches using credible, linkable sources.
- Return one of: **Supported, Misleading, Disputed, Unsupported, or Insufficient evidence**.
- Show confidence, uncertainty, citations, evidence excerpts, counterevidence, and common ground.
- Continue processing after the YouTube tab loses focus.
- Send a Web Push notification to an installed iPhone PWA when the verdict completes.
- Open the same verdict on desktop and mobile through a shareable claim URL.
- Provide BYOK settings for DigitalOcean and one OpenAI-compatible provider.

### BYOK safety

- Store prototype keys locally in extension storage.
- Send a key only to the selected provider.
- Never persist or log keys on the backend.
- Include connection test, monthly-limit field, and **Delete key**.
- Use a team demo key only as a clearly disclosed fallback.
- Production requires encrypted or short-lived credentials.

## Verdict contract

Every completed check must contain:

```text
Exact claim + speaker + timestamp
Fact/opinion classification
Verdict + confidence
Two-sentence explanation
2–3 sources with title, URL, date, excerpt, and stance
Strongest counterevidence
Uncertainty / missing information
One sentence of common ground
```

No verdict may appear without citations. Low-quality or conflicting evidence must produce **Insufficient evidence** or **Disputed**, not false certainty.

## Minimal system

- **Extension:** React + TypeScript + Vite, Manifest V3
- **Realtime backend:** FastAPI + WebSockets, Docker
- **Pipeline:** audio → transcription → speaker assignment → claim detection → evidence/counterevidence search → synthesis → verdict
- **AI:** fast model for transcript/claim detection; reasoning model for evidence synthesis
- **Retrieval:** Search API plus a small curated source-quality policy; PostgreSQL/pgvector only for claim, source, and verdict records
- **Mobile:** PWA verdict page + Web Push/VAPID
- **Hosting:** DigitalOcean App Platform

## Trust rules

- Describe Verity as **evidence-grounded and transparent**, not perfectly unbiased.
- Prefer primary sources, peer-reviewed research, government data, and established nonpartisan institutions.
- Keep source selection independent from a speaker’s identity or viewpoint.
- Visibly distinguish source evidence from model interpretation.
- Preserve disagreement when credible sources conflict.
- Do not score people, infer intent, or fact-check opinions.

## Success criteria

The demo succeeds if, in one uninterrupted run:

- Two speakers remain correctly labeled for the selected segment.
- The target factual claim is detected without an opinion triggering a check.
- A cited verdict appears within **45 seconds**.
- The verdict contains at least two working credible sources and counterevidence or an explicit statement that none was found.
- The iPhone receives the completion notification and opens the correct verdict.
- A judge can explain Verity’s social value in one sentence: **“It adds transparent evidence to online disagreements while they are happening.”**

## Non-goals for the hackathon

- Native iOS app or overlays inside TikTok/Instagram/YouTube on iPhone
- More than two speakers
- Emotion, sarcasm, satire, or intent detection
- Universal political neutrality or a proprietary truth score
- Automated moderation, censorship, debate winners, or user reputation scores
- Full RAG knowledge platform, organization accounts, billing, or production-grade key custody

## Build order

1. Prove one prerecorded YouTube segment end to end.
2. Make the overlay and mobile verdict feel live and trustworthy.
3. Add tab-background processing and push notification.
4. Add BYOK settings and demo fallback.
5. Only then improve generality, latency, and speaker tracking.

## Team ownership

- **Tri:** extension, overlay, BYOK settings, UI/UX
- **Moh:** audio capture, transcription, two-speaker tracking
- **Jun:** search, source quality, citations, verdict pipeline
- **Arnav:** backend orchestration, PWA, push, deployment

## Demo fallback

Use a known video segment and pre-warm its transcript and source results. If live transcription, search, or push fails, preserve the same UI flow with cached intermediate results and disclose that the demo is running in fallback mode.
