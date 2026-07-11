# Verity Phase 3 Plan — Evidence and Verdict

## Phase outcome

Replace the search, extraction, and reasoning-model fakes with a bounded evidence pipeline that produces a deterministic, citation-valid canonical verdict. The hero claim must reach a trustworthy terminal state with 2–3 working credible citations in under 30 seconds total, while weak or conflicting evidence fails closed as `Insufficient evidence` or `Disputed`.

This phase completes the core truth workflow and shared verdict presentation. Pairing and real Web Push remain deferred to Phase 4.

## Entry criteria

- Phase 2 creates the hero canonical claim once with exact text, stable speaker/timestamp, and validated neutral/support/counter queries.
- Phase 1 fake search/model adapters and failure fixtures remain available for CI and disclosed fallback.
- Search, extraction, reasoning-model, evidence, verdict-draft, and canonical-read contracts are versioned.
- A source-quality policy has named reviewers and no rule depends on speaker identity or viewpoint.
- The hero evidence fixture has been manually reviewed for citation accuracy and source independence.

## Scope

### Included

- Concurrent neutral/support/counter search planning execution.
- Safe page retrieval, canonicalization, content extraction, passage selection, source-tier scoring, deduplication, and evidence persistence.
- Bounded evidence bundle with immutable IDs.
- Direct BYOK and team-key reasoning-model synthesis using one versioned structured contract.
- Deterministic verdict, citation, excerpt, source-count, confidence, common-ground, and disagreement validation.
- One safe synthesis retry followed by fail-closed terminal behavior.
- Shared extension/PWA rendering of complete, disputed, insufficient, and failed results.
- Latency, trust, privacy, contract, integration, and manual citation verification.

### Excluded

- General web crawling, paywall bypass, unbounded RAG, autonomous research loops, source ideology scoring, speaker reputation, real push/pairing, horizontal scaling, and pgvector semantic lookup.

## Evidence policy to freeze first

### Source preference

Prefer primary sources, peer-reviewed research, government data, and established nonpartisan institutions. Define a small source-tier rubric based on provenance, editorial/research quality, relevance, recency needs, and accessibility. Domain reputation is a signal, not an automatic truth label.

### Viewpoint neutrality

Queries and ranking cannot use the speaker's identity, affiliation, perceived politics, or inferred intent. Always include support/context and contradiction/limitation roles. Preserve credible disagreement rather than selecting a debate winner.

### Independence

Two URLs repeating one original report are not independent. Track canonical URL, publisher, content hash, cited upstream source where identifiable, and duplicate clusters. The default final gate requires at least two credible independent sources.

### Freshness

Determine whether the claim is time-sensitive. Record publication and retrieval times, and penalize stale material only when the claim requires current evidence. Never invent missing dates.

### Fail-closed rules

- Fewer than two credible independent sources: `Insufficient evidence`.
- Credible sources materially disagree: `Disputed`.
- Excerpt cannot be verified in captured page text: remove the citation/evidence item from the usable bundle.
- Draft cites an unknown ID, violates structure, or overstates available support: retry synthesis once with validation errors, then fail closed.
- Common ground lacks direct support in the bundle: omit it.
- No verdict appears without evidence citations, except the explicit insufficient-evidence representation that explains the search limitation and shows any usable sources according to the contract.

## Workstream 3A — Search execution

**Owner:** Jun.

1. Consume only validated queries attached to the canonical claim; do not ask the reasoning model to improvise new searches inside synthesis.
2. Execute neutral/support and counter/limitation roles concurrently with per-query timeout, global stage deadline, and one retry with jitter only for retry-safe errors.
3. Limit query count and result count according to the classification contract and latency budget.
4. Normalize result title, URL, publisher/domain, date when available, snippet, rank, query role, and provider metadata behind the existing search protocol.
5. Deduplicate obvious URL variants before page fetching and reject unsupported URL schemes.
6. Continue when one query role partially fails, but preserve that limitation for uncertainty and the fail-closed decision.
7. Stop acquiring candidates after enough credible independent sources exist or the stage deadline is reached.
8. Cache search candidates by normalized claim/query hash with retrieval time; fixture fallback remains explicit and visibly disclosed.

**Acceptance:** support/context and counter/limitation candidates are gathered concurrently, bounded, traceable to their query roles, and deterministic under recorded provider responses.

## Workstream 3B — Safe retrieval and extraction

**Owner:** Jun, with Arnav reviewing network safety.

1. Validate and canonicalize URLs before fetch. Block localhost, private/link-local networks, credentials in URLs, unsupported ports/schemes, and redirect chains that cross into blocked destinations.
2. Apply strict connect/read/total timeouts, response-size cap, redirect cap, content-type allow-list, and identifiable user agent.
3. Do not bypass authentication, paywalls, robots/access controls, or anti-bot restrictions; a blocked page is an unavailable source.
4. Extract main article text, title, publisher, author/date when reliable, and stable paragraph boundaries. Preserve sanitized captured text for exact excerpt validation and audit retention.
5. Select claim-relevant passages with deterministic lexical ranking plus bounded model help only if contractually necessary; provenance always remains the fetched page.
6. Keep excerpts short enough for UI and audit, and record location/offset or a normalized matching strategy.
7. Hash normalized page content and canonical URL for deduplication/freshness checks.
8. Treat malformed, empty, script-only, inaccessible, or oversized pages as explicit extraction failures, not fabricated evidence.

**Acceptance:** every persisted evidence excerpt can be found in its captured normalized page text and has a safe canonical HTTP(S) URL.

## Workstream 3C — Quality ranking and evidence selection

**Owner:** Jun.

1. Apply the documented source-tier rules independently of stance.
2. Score relevance to the normalized claim, directness of evidence, provenance quality, independence, and appropriate recency.
3. Cluster duplicate URLs/content and derivative coverage; select the strongest representative rather than inflating source count.
4. Preserve at least the strongest credible counter/limitation passage when one exists.
5. Select at most six passages for synthesis and target 2–3 final citations.
6. Assign immutable evidence IDs only after extraction and validation; include those IDs in the compact bundle.
7. Persist rejected/failed candidate metadata only to the privacy-safe extent needed for diagnostics; do not expose it as evidence.
8. If the independent-source gate is not met, transition toward insufficient evidence without asking the model to manufacture certainty.

**Acceptance:** the hero bundle contains relevant, independent support/context and counterevidence, uses no duplicate source to meet the count, and remains within the size/latency cap.

## Workstream 3D — Evidence concurrency and orchestration

**Owner:** Arnav coordinates pipeline behavior; Jun owns stage results.

1. Transition the canonical claim to `CHECKING`, then run evidence and counterevidence roles concurrently using typed async functions.
2. Share a single stage deadline/cancellation policy so late tasks cannot mutate a claim after it advances.
3. Persist valid selected evidence and transition to `EVIDENCE_READY` atomically.
4. Emit progress events that describe state, not speculative verdicts or unvalidated snippets.
5. Ensure retry/reconnect/idempotency cannot create duplicate evidence records or launch parallel synthesis for the same claim version.
6. Mark provider failures with sanitized error categories and preserve whether each search role completed.
7. Use cached hero evidence only through explicit fixture/fallback mode and the same evidence validation path.
8. Track search, fetch, extraction, ranking, and total evidence-stage duration independently.

## Workstream 3E — Reasoning-model synthesis

**Owners:** Jun owns prompt/contract; Tri owns direct BYOK dispatch; Arnav owns backend fallback.

1. Version a compact prompt that receives the exact claim metadata and the bounded evidence bundle with immutable IDs.
2. Require structured output containing allowed label, confidence, two-sentence explanation, uncertainty, counterevidence summary, optional supported common ground, citation IDs, model/provider/name, and prompt version.
3. Instruct the model to use only supplied evidence, cite only supplied IDs, preserve source disagreement, avoid speaker/intent judgments, and choose uncertainty rather than extrapolate.
4. Use the same provider-neutral request/response in direct extension BYOK and team-key backend modes.
5. Treat evidence text as untrusted data and delimit it from instructions to resist prompt injection.
6. Apply timeout, bounded output, one retry only after deterministic validation feedback, and a global synthesis deadline.
7. Do not accept prose outside the schema as the canonical verdict.
8. Record model/provider, prompt version, latency, token usage, and sanitized failure category.

**Acceptance:** recorded and live hero bundles produce schema-valid drafts that cite only evidence IDs, and deliberately injected malicious page instructions do not alter the contract or tool behavior.

## Workstream 3F — Deterministic verdict validation

**Owner:** Jun, reviewed by Arnav.

Validation runs after every synthesis attempt and before persistence/broadcast:

1. Validate required fields, enums, confidence range/precision, text length, and citation count.
2. Verify every citation ID exists, belongs to the current claim/bundle, and is not duplicated.
3. Verify each cited excerpt exactly or canonically matches captured page text; remove unusable evidence before any retry.
4. Recheck credible independent source count after citation selection.
5. Enforce label consistency: material credible conflict maps to `Disputed`; inadequate evidence maps to `Insufficient evidence`; high certainty cannot survive explicit major uncertainty.
6. Ensure explanation, uncertainty, counterevidence, and common ground do not assert facts absent from cited evidence using deterministic reference checks plus conservative policy.
7. Omit unsupported common ground rather than failing the whole verdict when all other fields are valid.
8. Return machine-readable validation errors for the single permitted synthesis retry.
9. After the retry fails, persist a safe terminal `INSUFFICIENT_EVIDENCE` or `FAILED` result according to whether usable evidence exists; never show the invalid draft.

**Acceptance:** tests reject nonexistent citations, cross-claim IDs, excerpt mismatch, duplicate/derivative source inflation, invalid labels/confidence, unsupported common ground, and unjustified certainty.

## Workstream 3G — Atomic completion and canonical reads

**Owner:** Arnav.

1. Within one transaction, persist the final validated verdict, its evidence references, completion timestamp, terminal claim state, and an idempotent notification-needed record for Phase 4.
2. Broadcast completion only after commit; clients subsequently fetch the canonical claim response.
3. Ensure concurrent/retried synthesis attempts cannot overwrite a terminal verdict.
4. Return a stable public response shape for completed, disputed, insufficient, pending, failed, expired, and not-found claims.
5. Apply retention fields and public safe-field allow-list.
6. Record the transition, total claim latency, label, confidence, cited domains, validation attempts, and correlation ID without logging full provider bodies.

## Workstream 3H — Trustworthy shared UI

**Owner:** Tri.

1. Render exact claim, A/B speaker, timestamp, verdict label, confidence, and a concise two-sentence explanation.
2. Visibly separate evidence excerpts and source metadata from model interpretation.
3. Render 2–3 sources with title, canonical URL, date when known, publisher, excerpt, and stance; links open safely.
4. Give uncertainty and strongest counterevidence equal visual discoverability to the headline verdict.
5. Render common ground only when present and supported.
6. Use distinct honest states for Disputed, Insufficient evidence, Failed, pending, and expired; never convert them into a generic negative verdict.
7. Extension and PWA fetch/render the same canonical response and show fixture/demo-key mode clearly.
8. Verify mobile responsiveness, keyboard/screen-reader behavior, readable contrast, and non-color-only labels.

## Verification plan

### Automated contract and unit tests

- Search normalization, URL canonicalization, duplicate clustering, source tiers, relevance/independence/freshness rules.
- SSRF/private-network blocking, redirects, size/type/time limits, extraction failure, and exact excerpt matching.
- Evidence selection caps, immutable IDs, query-role preservation, and insufficient-source gates.
- Synthesis schema, prompt-injection fixture, citation ownership, confidence/label consistency, common-ground omission, retry-once behavior, and fail-closed result.
- Atomic completion, idempotent synthesis, terminal-state immutability, and canonical public serialization.

### Integration tests

1. Recorded search and page fixtures produce the expected evidence bundle and validated verdict.
2. Credible conflict produces `Disputed`.
3. One credible source produces `Insufficient evidence`.
4. Invalid first draft plus valid retry completes once.
5. Two invalid drafts never appear to clients and produce the correct terminal state.
6. Live transcript/claim plus live evidence/synthesis reaches persisted canonical output while push remains fake.

### Manual trust review

For the hero result, a reviewer opens every final URL, confirms title/publisher/date, locates the displayed excerpt, verifies independence, checks the stance, and confirms the explanation/counterevidence/common ground do not overstate the pages. Record reviewer/date and recheck shortly before the demo.

### Performance runs

Measure at least three consecutive hero runs from sentence finalization through verdict commit. Search and extraction target ten seconds, synthesis seven seconds, validation/persistence within the remaining budget, and total capture-to-complete below 30 seconds p95 target for rehearsed conditions.

## Failure and fallback behavior

- Search partial failure: use remaining roles only if trust gates pass; otherwise insufficient evidence.
- Page fetch/extraction failure: exclude that source and continue within the deadline.
- Model timeout/invalid output: one bounded retry; then fail closed.
- Client BYOK disconnect: allow explicit team-demo fallback only when selected/disclosed; never silently route a user key.
- Cached fixture activation: same contracts and validators, visible fallback label, freshness-reviewed citations.
- Late external result: ignore after terminal commit and record as late; never mutate the published verdict.

## Security, privacy, and observability gates

- Fetcher blocks private network access and unsafe redirects.
- Evidence page text is treated as untrusted; no embedded instruction can alter system behavior.
- Logs exclude API keys, authorization headers, full page text, complete prompts, and provider bodies.
- Persist only claim-relevant transcript, selected evidence/provenance, verdict, and minimal diagnostics under the retention policy.
- Metrics include evidence-stage latency, source domains/tiers, independent-source count, insufficient/disputed rates, citation validation failures, retries, model usage, and total completion latency.

## Recommended implementation order

1. Freeze source policy, failure rules, bundle/draft contracts, and recorded fixtures.
2. Implement safe URL handling, search normalization, page fetch/extraction, and security tests.
3. Add quality/independence ranking, deduplication, evidence IDs, and selection caps.
4. Add concurrent orchestration, persistence, progress states, and cached fixture path.
5. Implement synthesis prompt/dispatch and strict schema parsing.
6. Implement deterministic validators and retry-once/fail-closed state handling.
7. Make completion atomic and update canonical public reads.
8. Finish shared UI, automated integration/performance tests, then manual citation review.

## Phase exit gate

Phase 3 passes only when:

1. The live hero claim produces a canonical verdict in under 30 seconds in three consecutive rehearsed runs.
2. The verdict has 2–3 working, credible, independent citations with excerpts verifiable at their captured pages.
3. Counterevidence and uncertainty are visible; common ground appears only when supported.
4. Weak and conflicting fixture cases become `Insufficient evidence` and `Disputed` respectively.
5. Hallucinated IDs, quotes, unsupported certainty, duplicates, and unsafe URLs are rejected deterministically.
6. Extension and PWA render the same canonical response.
7. All contract, security, integration, UI, and manual trust checks pass.

## Handoff to Phase 4

Provide a committed canonical verdict event/record, stable high-entropy public claim URL, idempotent notification-needed record, completion timestamp, PWA verdict route, and exact mobile-safe response contract. Phase 4 may deliver and navigate to this result but must not duplicate or regenerate verdict logic.
