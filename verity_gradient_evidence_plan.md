# Gradient Evidence Replacement — Implementation Plan

Replace the standalone search+fetch pipeline with one DigitalOcean Gradient agent
(PDF knowledge base primary, web-search tool fallback, recorded evidence demo fallback),
while keeping the extension, PWA, WebSocket contracts, and public API unchanged.

## Ground truth: what already exists on `main`

The high-level plan's Phases 4–5 describe machinery that is already implemented and
tested. Do not rebuild it.

| Plan requirement | Existing implementation |
|---|---|
| Immutable evidence IDs | `build_evidence` → `ev-{sha256(claim, url, excerpt)[:16]}` (`domain/evidence.py`) |
| Merge + deduplicate evidence | `select_evidence` (URL + content-hash dedup, tier-ordered) |
| Verify citations/excerpts/labels/confidence | `validate_draft` (unknown/duplicate citations, excerpt-in-captured-text, 2–3 citations, ≥2 independent credible sources, conflict→Disputed rule, confidence-vs-uncertainty, lexical support checks) |
| `INSUFFICIENT_EVIDENCE` on validation failure | `EvidencePipeline._insufficient` fail-closed verdict |
| Persist verdict before notification | `_complete`: `repository.complete_claim(...)` then `on_complete` → `cross_device.notify` |
| Timeout, retry, idempotency | `stage_timeout`/`synthesis_timeout`, `_search_with_retry`, 2-attempt synthesis, `running` set, notify-once per claim/subscription |
| Cached evidence demo fallback | `RecordedEvidenceProvider` + `fixtures/hero-demo/phase3-evidence.json` |

Consequence: the entire project is **one new provider class + one seam + config**,
plus Gradient console work. Verdict synthesis (`ReasoningModel` / `VerdictDraft`)
stays exactly as-is — the Gradient agent replaces *retrieval only*. This keeps the
deterministic validator between the agent and the verdict, which is the whole point:
the agent is untrusted input; `validate_draft` remains the gate.

## Architecture

```
ClassificationResult (queries)                    ┌─ unchanged ─────────────────┐
        │                                         │ select_evidence             │
        ▼                                         │ credible_independent_count  │
EvidenceCollector.collect(claim, classification)  │ ReasoningModel.synthesize   │
  ├── GradientEvidenceCollector   (new)           │ validate_draft              │
  │     ├── support Gradient agent  ┐ concurrent  │ complete_claim → notify     │
  │     └── counter Gradient agent  ┘             └─────────────────────────────┘
  ├── SearchEvidenceCollector     (extracted from today's `_evidence`)
  └── RecordedEvidenceProvider    (disclosed fallback, unchanged)
```

`EvidencePipeline._evidence()` is the only consumer of `SearchAdapter` + `PageFetcher`.
Introduce a 3-line protocol and move the existing body behind it:

```python
class EvidenceCollector(Protocol):
    name: str
    async def collect(self, claim: Claim, classification: ClassificationResult) -> list[EvidenceRecord]: ...
```

Everything downstream of `collect()` is untouched.

## Anti-hallucination invariant (the key design decision)

An agent-returned evidence item is accepted **only if its `exact_excerpt` is verified
against text the backend obtained independently of the model's prose**:

- **KB items**: request `include_retrieval_info: true`; Gradient returns the actual
  retrieved chunks server-side. `captured_text` = concatenated retrieval chunks for
  that document. Excerpt must satisfy the existing `excerpt_is_captured` check.
- **Web items**: re-fetch the cited URL with the existing `SafePageFetcher`
  (SSRF guards, size limits, redirect caps — all free). `captured_text` = fetched page.
- Items that fail verification are silently dropped; if fewer than 2 credible
  independent items survive, the existing gate yields `INSUFFICIENT_EVIDENCE`.

This makes "backend checks that the citations are real" literal, and it reuses
`validate_draft`'s `excerpt_mismatch` check unchanged at verdict time.

## Phase 1 — Evidence prep (console, no code)

- Target claim (already the hero fixture): *"Electric vehicles produce no carbon emissions."*
- Two authoritative, text-based PDFs with public canonical URLs:
  1. **EPA "Electric Vehicle Myths"** (epa.gov → `SourceTier.primary`) — direct support
     for zero *tailpipe* emissions + explicit qualification about grid electricity.
  2. **ICCT lifecycle-emissions report** (theicct.org → already in `RESEARCH_DOMAINS`)
     — manufacturing/battery lifecycle qualification (counterevidence).
- Record each PDF's **public https URL and title** in a small manifest checked into
  `fixtures/gradient-kb.json`; the agent will be instructed to return these exact URLs
  as `url` for KB citations. This is what lets the existing `Evidence.canonical_url`,
  `source_tier`, and `independent_key` work with **zero model changes**.
- Create one Gradient Knowledge Base, upload both PDFs, index.
- Exit test (console/curl): support query retrieves the tailpipe passage; counter query
  retrieves the lifecycle-qualification passage, reliably (5/5).

## Phase 2 — Configure one Gradient agent (console, no code)

- Attach the KB; add the web-search tool.
- System prompt (versioned `gradient-evidence-v1`), core rules:
  1. Search the knowledge base first; use web search only when the KB lacks coverage,
     conflicts internally, or the claim is time-sensitive.
  2. Return **JSON only**: `{"items":[{"source_type":"kb|web","title":...,"url":...,
     "page":...,"exact_excerpt":...,"publisher":...,"published_at":...}]}` — max 3 items.
  3. `exact_excerpt` must be verbatim from the retrieved passage; never paraphrase,
     never cite model knowledge. For KB documents use the exact URL/title from the
     document metadata (the Phase 1 manifest values).
  4. The requested role (find **supporting** vs **contradicting/qualifying** evidence)
     arrives in the user message.
- Secrets: `VERITY_GRADIENT_SUPPORT_ENDPOINT`, `VERITY_GRADIENT_SUPPORT_KEY`,
  `VERITY_GRADIENT_COUNTER_ENDPOINT`, and `VERITY_GRADIENT_COUNTER_KEY` as App
  Platform secrets. Legacy `VERITY_GRADIENT_AGENT_*` still applies both roles when split
  values are unset.
- Exit: three curl transcripts checked into `phase0/results/`: PDF hit, web fallback
  (claim outside KB), and honest empty `{"items":[]}` for an unsupportable claim.

## Phase 3 — `GradientEvidenceCollector` (~130 lines, `providers/evidence.py`)

- Transport: stdlib `urllib` in `asyncio.to_thread`, matching the house
  `OpenAICompatible*` style (no SDK, no new dependency). POST
  `{endpoint}/api/v1/chat/completions`, `Authorization: Bearer {key}`,
  body includes `include_retrieval_info: true`, `temperature: 0`, size-capped reads,
  errors sanitized to `ValueError("evidence_provider_unavailable")`.
- `collect()` = `asyncio.gather` of two role calls (support, counter), 8s timeout +
  one retry each (mirrors `_search_with_retry`); a failed role degrades to the other
  role's results rather than failing the claim.
- Normalization into the existing `Evidence` model (no schema change):

  | Plan field | Mapping |
  |---|---|
  | `evidence_id` | existing `ev-{digest}` derivation |
  | `source_type` | `source_tier` via URL host (KB PDFs land on primary/research by construction) |
  | `url_or_document_id` | `canonical_url` (KB items use manifest URL) |
  | `page_or_location` | appended to `title` as `" (p. N)"` — avoids contract churn |
  | `exact_excerpt` | `excerpt` (validated against `captured_text`) |
  | `stance` | `support`/`counter` from the role; `query_role` likewise |
  | `retrieved_at`, `content_hash` | `utcnow()`, sha256 of `captured_text` |

- Extract today's `_evidence()` body into `SearchEvidenceCollector` (pure move);
  `EvidencePipeline` gains a `collector` field and `_evidence` becomes one line.
- `configured_evidence_providers()` → returns `(collector, reasoner)`:
  - Gradient env set → `FallbackEvidenceCollector(GradientEvidenceCollector(...),
    RecordedEvidenceCollector(...))` — same 15-line composition pattern as
    `FallbackSttAdapter`, name tracks outcome for `/readyz` + disclosure.
  - `VERITY_EVIDENCE=recorded` kill-switch (mirrors `VERITY_STT`).
  - No env → current behavior, bit-for-bit.
- Exit: `CHECKING → EVIDENCE_READY` served by Gradient only; unit tests with a fake
  transport (house style: injected `_request`, no network).

## Phase 4 — Verdict validation (~10 lines)

Almost everything is reused. Only deltas:

- Add `iea.org` (or whichever second publisher is chosen) to `RESEARCH_DOMAINS` if its
  host isn't already tiered — otherwise the ≥2-credible gate can't pass on KB-only runs.
- Confirm `relevant_excerpt` is **not** applied to agent items (the agent supplies the
  excerpt; the backend only verifies capture). `build_evidence` stays for the search
  collector; Gradient items construct `Evidence` directly.
- Exit: one live verdict citing 2–3 validated PDF/web citations end-to-end.

## Phase 5 — Demo hardening (mostly tests)

Persistence-before-notify, idempotency, and retries already exist. Remaining work:

- Test matrix (unit + one Playwright pass):
  1. PDF-only success (KB items ≥2 credible independent) → `COMPLETE`
  2. Web fallback (KB miss, web items verified via `SafePageFetcher`) → `COMPLETE`
  3. Unsupported claim (agent returns no items) → `INSUFFICIENT_EVIDENCE`
  4. Gradient down (connect/timeout) → fallback collector → disclosed recorded evidence
  5. `VERITY_EVIDENCE=recorded` kill-switch rehearsal path
- `/readyz` reports the active evidence collector name (wired via `readiness.py` merge).
- Release gate: three consecutive end-to-end runs (live capture → verdict → overlay +
  push) without manual intervention.

## Effort summary

| Work item | Size |
|---|---|
| Gradient console (KB, agent, secrets) | ops, ~1–2 h |
| `EvidenceCollector` seam + `SearchEvidenceCollector` extraction | ~30 lines moved |
| `GradientEvidenceCollector` + normalization + verification | ~130 lines |
| `FallbackEvidenceCollector` + `configured_evidence_providers` rework | ~30 lines |
| Domain deltas (tier domains) | ~2 lines |
| Tests | ~150 lines |

## Open decisions

1. **Second PDF publisher** — ICCT (already tiered) vs IEA (needs 1-line tier addition).
2. **Page locations** — title suffix (zero contract churn, recommended) vs optional
   `location` field on `Evidence` (cleaner, but touches `openapi.json`/contracts).
3. **Web-item verification strictness** — drop unfetchable web items (recommended,
   fail-closed) vs accept with `source_tier=other` (they then don't count toward the
   credible gate anyway).

## Out of scope (unchanged from the high-level plan)

Multiple agents beyond support/counter split, Gradient ADK, custom vector DB, user uploads, dynamic KB management,
broad autonomous research, production source governance.
