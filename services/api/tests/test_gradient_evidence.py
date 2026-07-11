import asyncio
import json

import pytest

from app.domain.evidence import credible_independent_count
from app.domain.models import (
    Claim,
    ClaimState,
    ClassificationResult,
    ExtractedPage,
    SearchRole,
    VerdictDraft,
    utcnow,
)
from app.persistence.repository import MemoryRepository
from app.pipeline.evidence import EvidencePipeline
from app.providers.evidence import (
    FallbackEvidenceCollector,
    GradientEvidenceCollector,
    RecordedEvidenceProvider,
    SearchEvidenceCollector,
    configured_evidence_providers,
    GRADIENT_OUTPUT_INSTRUCTIONS,
)


EPA_URL = "https://www.epa.gov/greenvehicles/electric-vehicle-myths"
ICCT_URL = "https://theicct.org/publication/a-global-comparison-of-the-life-cycle-greenhouse-gas-emissions-of-combustion-engine-and-electric-passenger-cars"
WEB_URL = "https://apnews.com/article/ev-fact-check"
SUPPORT_EXCERPT = "Electric vehicles produce zero direct tailpipe emissions while driving on the road."
COUNTER_EXCERPT = "Manufacturing electric vehicle batteries generates significant carbon emissions during production."


def claim(public_id: str = "claim-gradient") -> Claim:
    return Claim(
        public_id=public_id,
        session_id="session",
        speaker_label="Speaker B",
        exact_text="Electric vehicles produce no carbon emissions.",
        normalized_text="Electric vehicles produce no carbon emissions",
        start_ms=12_000,
        end_ms=15_400,
        classification="factual_claim",
        state=ClaimState.CHECKING,
        created_at=utcnow(),
        fixture_mode=False,
    )


def classification() -> ClassificationResult:
    return ClassificationResult(
        candidate_id="candidate",
        classification="factual_claim",
        normalized_claim="Electric vehicles produce no carbon emissions",
        neutral_queries=["electric vehicle lifecycle emissions"],
        support_queries=["electric vehicle direct emissions"],
        counter_queries=["electric vehicle production emissions"],
    )


def agent_body(items: list[dict], chunks: list[str | dict], fenced: bool = False) -> dict:
    content = json.dumps({"items": items})
    if fenced:
        content = f"```json\n{content}\n```"
    return {
        "choices": [{"message": {"content": content}}],
        "retrieval": {"retrieved_data": [
            chunk if isinstance(chunk, dict) else {
                "page_content": chunk,
                "filename": "epa-electric-vehicle-myths.pdf" if chunk == SUPPORT_EXCERPT else "icct-lifecycle-ghg-passenger-cars.pdf",
                "metadata": {},
            }
            for chunk in chunks
        ]},
    }


def kb_collector(responses: dict) -> GradientEvidenceCollector:
    collector = GradientEvidenceCollector("https://agent.example", "secret", fetcher=FailingFetcher())
    collector._request = lambda claim, role, queries: responses[role]  # type: ignore[method-assign]
    return collector


class FailingFetcher:
    name = "failing"

    async def fetch(self, url: str) -> ExtractedPage:
        raise ValueError("page_unavailable")


class FakeFetcher:
    name = "fake"

    def __init__(self, pages: dict[str, ExtractedPage]):
        self.pages = pages

    async def fetch(self, url: str) -> ExtractedPage:
        page = self.pages.get(url)
        if not page:
            raise ValueError("page_unavailable")
        return page


def test_gradient_verifies_kb_items_against_retrieval_chunks():
    asyncio.run(gradient_verifies_kb_items_against_retrieval_chunks())


def test_gradient_prompt_requires_machine_verifiable_exact_excerpts():
    assert '"source_type":"kb|web"' in GRADIENT_OUTPUT_INSTRUCTIONS
    assert '"exact_excerpt"' in GRADIENT_OUTPUT_INSTRUCTIONS
    assert "Never invent, paraphrase, or combine excerpts" in GRADIENT_OUTPUT_INSTRUCTIONS


async def gradient_verifies_kb_items_against_retrieval_chunks():
    responses = {
        SearchRole.support: agent_body(
            [
                {"source_type": "kb", "title": "Electric Vehicle Myths", "url": EPA_URL, "page": 2, "exact_excerpt": SUPPORT_EXCERPT, "publisher": "US EPA"},
                {"source_type": "kb", "title": "Hallucinated", "url": EPA_URL, "exact_excerpt": "Electric cars emit absolutely nothing at any point in their entire lifecycle.", "publisher": "US EPA"},
            ],
            [SUPPORT_EXCERPT],
        ),
        SearchRole.counter: agent_body(
            [
                {"source_type": "kb", "title": "Lifecycle GHG of Passenger Cars", "url": ICCT_URL, "page": 11, "exact_excerpt": COUNTER_EXCERPT, "publisher": "ICCT"},
                {"source_type": "kb", "title": "Unsafe", "url": "http://localhost/secret", "exact_excerpt": COUNTER_EXCERPT, "publisher": "Nope"},
            ],
            [COUNTER_EXCERPT],
            fenced=True,
        ),
    }
    records = await kb_collector(responses).collect(claim(), classification())
    assert [(item.evidence.stance, item.evidence.source_tier) for item in records] == [
        ("support", "primary"),
        ("counter", "research"),
    ]
    assert records[0].evidence.title == "Electric Vehicle Myths (p. 2)"
    assert records[1].evidence.title == "Lifecycle GHG of Passenger Cars (p. 11)"
    assert all(item.evidence.id.startswith("ev-") for item in records)
    assert records[0].captured_text == SUPPORT_EXCERPT
    assert credible_independent_count(records) == 2


def test_gradient_binds_kb_excerpt_to_its_actual_retrieved_document():
    async def scenario():
        responses = {
            SearchRole.support: agent_body(
                [{"source_type": "kb", "title": "Electric Vehicle Myths", "url": EPA_URL,
                  "exact_excerpt": COUNTER_EXCERPT, "publisher": "US EPA"}],
                [{
                    "page_content": COUNTER_EXCERPT,
                    "filename": "icct-lifecycle-ghg-passenger-cars.pdf",
                    "metadata": {"item_name": ICCT_URL},
                }],
            ),
            SearchRole.counter: agent_body([], []),
        }
        records = await kb_collector(responses).collect(claim(), classification())
        assert records == []

    asyncio.run(scenario())


def test_gradient_verifies_web_items_by_refetching():
    asyncio.run(gradient_verifies_web_items_by_refetching())


async def gradient_verifies_web_items_by_refetching():
    page = ExtractedPage(
        canonical_url=WEB_URL,
        title="EV emissions fact check",
        publisher="apnews.com",
        retrieved_at=utcnow(),
        text=f"Context paragraph.\n\n{SUPPORT_EXCERPT}\n\nMore context.",
        content_hash="0" * 64,
    )
    collector = GradientEvidenceCollector("https://agent.example", "secret", fetcher=FakeFetcher({WEB_URL: page}))
    collector._request = lambda claim, role, queries: agent_body(  # type: ignore[method-assign]
        [
            {"source_type": "web", "title": "Agent title", "url": WEB_URL, "exact_excerpt": SUPPORT_EXCERPT, "publisher": "Agent publisher"},
            {"source_type": "web", "title": "Dead link", "url": "https://unreachable.example/x", "exact_excerpt": SUPPORT_EXCERPT},
        ]
        if role == SearchRole.support
        else [],
        [],
    )
    records = await collector.collect(claim(), classification())
    assert len(records) == 1
    assert records[0].evidence.title == "EV emissions fact check"
    assert records[0].evidence.publisher == "apnews.com"
    assert records[0].evidence.source_tier == "established"
    assert records[0].captured_text == page.text


def test_gradient_survives_one_failed_role_and_fallback_covers_total_failure():
    asyncio.run(gradient_survives_one_failed_role_and_fallback_covers_total_failure())


async def gradient_survives_one_failed_role_and_fallback_covers_total_failure():
    def half_failing(claim, role, queries):
        if role == SearchRole.support:
            raise ValueError("agent_http_500")
        return agent_body(
            [{"source_type": "kb", "title": "Lifecycle", "url": ICCT_URL, "exact_excerpt": COUNTER_EXCERPT, "publisher": "ICCT"}],
            [COUNTER_EXCERPT],
        )

    partial = GradientEvidenceCollector("https://agent.example", "secret", fetcher=FailingFetcher())
    partial._request = half_failing  # type: ignore[method-assign]
    records = await partial.collect(claim(), classification())
    assert [item.evidence.stance for item in records] == ["counter"]

    def failing(claim, role, queries):
        raise ValueError("evidence_provider_unavailable")

    broken = GradientEvidenceCollector("https://agent.example", "secret", fetcher=FailingFetcher())
    broken._request = failing  # type: ignore[method-assign]
    with pytest.raises(ValueError):
        await broken.collect(claim(), classification())
    recorded = RecordedEvidenceProvider()
    fallback = FallbackEvidenceCollector(broken, SearchEvidenceCollector(recorded, recorded))
    assert fallback.name == "gradient"
    records = await fallback.collect(claim("claim-phase3"), classification())
    assert records and fallback.name == "recorded"


class FakeReasoner:
    name = "fake"

    async def synthesize(self, claim, evidence, errors=()):
        return VerdictDraft(
            claim_public_id=claim.public_id,
            label="Misleading",
            confidence=0.8,
            explanation="Electric vehicles produce zero direct tailpipe emissions while driving, but manufacturing batteries generates significant carbon emissions.",
            uncertainty="Grid electricity mix varies by region.",
            counterevidence_summary="Manufacturing electric vehicle batteries generates significant carbon emissions during production.",
            citation_ids=[item.evidence.id for item in evidence[:2]],
            model_provider="fake",
            model_name="test-reasoner",
            prompt_version="phase3-v1",
        )


def test_gradient_pipeline_completes_end_to_end():
    asyncio.run(gradient_pipeline_completes_end_to_end())


async def gradient_pipeline_completes_end_to_end():
    responses = {
        SearchRole.support: agent_body(
            [{"source_type": "kb", "title": "Electric Vehicle Myths", "url": EPA_URL, "page": 2, "exact_excerpt": SUPPORT_EXCERPT, "publisher": "US EPA"}],
            [SUPPORT_EXCERPT],
        ),
        SearchRole.counter: agent_body(
            [{"source_type": "kb", "title": "Lifecycle GHG of Passenger Cars", "url": ICCT_URL, "page": 11, "exact_excerpt": COUNTER_EXCERPT, "publisher": "ICCT"}],
            [COUNTER_EXCERPT],
        ),
    }
    repo = MemoryRepository()
    target = claim()
    repo.save_claim(target)
    events = []

    async def capture(kind, payload):
        events.append(kind)

    pipeline = EvidencePipeline(repo, kb_collector(responses), FakeReasoner(), capture)
    completed = await pipeline.run(target, classification())
    assert completed.state == ClaimState.COMPLETE
    assert completed.verdict and completed.verdict.label == "Misleading"
    assert len(completed.verdict.citation_ids) == 2
    assert completed.public_id in repo.notification_jobs
    assert events == ["pipeline_state", "pipeline_state", "verdict_complete"]


def test_configured_evidence_selects_collector_from_environment(monkeypatch):
    for key in ("VERITY_GRADIENT_AGENT_ENDPOINT", "VERITY_GRADIENT_AGENT_KEY", "VERITY_EVIDENCE", "VERITY_SEARCH_URL", "VERITY_SEARCH_API_KEY"):
        monkeypatch.delenv(key, raising=False)
    collector, _ = configured_evidence_providers()
    assert isinstance(collector, SearchEvidenceCollector) and collector.name == "recorded"
    monkeypatch.setenv("VERITY_GRADIENT_AGENT_ENDPOINT", "https://agent.example")
    monkeypatch.setenv("VERITY_GRADIENT_AGENT_KEY", "secret")
    collector, _ = configured_evidence_providers()
    assert isinstance(collector, FallbackEvidenceCollector) and collector.name == "gradient"
    assert isinstance(collector.primary, GradientEvidenceCollector)
    monkeypatch.setenv("VERITY_EVIDENCE", "recorded")
    collector, _ = configured_evidence_providers()
    assert isinstance(collector, SearchEvidenceCollector) and collector.name == "recorded"
