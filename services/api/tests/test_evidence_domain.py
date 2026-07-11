from datetime import datetime, timezone

import pytest

from app.domain.evidence import (
    UnsafeUrl,
    canonicalize_url,
    credible_independent_count,
    excerpt_is_captured,
    select_evidence,
    validate_draft,
)
from app.domain.models import Claim, Evidence, EvidenceRecord, VerdictDraft, utcnow


def claim() -> Claim:
    return Claim(
        public_id="claim-1234567890abcdef",
        session_id="session",
        speaker_label="Speaker A",
        exact_text="Electric vehicles produce no carbon emissions.",
        normalized_text="Electric vehicles produce no carbon emissions",
        start_ms=1,
        end_ms=2,
        classification="factual_claim",
        state="SYNTHESIZING",
        created_at=utcnow(),
        fixture_mode=True,
    )


def record(identifier: str, publisher: str, url: str, stance: str, content_hash: str | None = None) -> EvidenceRecord:
    excerpt = "Electric vehicles have zero direct emissions but lifecycle emissions can remain."
    return EvidenceRecord(
        evidence=Evidence(
            id=identifier,
            stance=stance,
            title=publisher,
            canonical_url=url,
            publisher=publisher,
            retrieved_at=utcnow(),
            excerpt=excerpt,
            source_tier="primary" if url.endswith(".gov/page") else "research",
            content_hash=content_hash or identifier,
            query_role="counter" if stance == "counter" else "support",
            independent_key=publisher.casefold(),
        ),
        captured_text=f"Header. {excerpt} Footer.",
    )


def test_url_canonicalization_and_private_network_blocking():
    assert canonicalize_url("https://Example.com/a/?utm_source=x&b=2#section") == "https://example.com/a?b=2"
    for value in ("http://127.0.0.1/a", "http://169.254.169.254/", "http://[::1]/", "file:///tmp/a"):
        with pytest.raises(UnsafeUrl):
            canonicalize_url(value)


def test_exact_excerpt_and_duplicate_clusters_do_not_inflate_independence():
    first = record("a", "Agency", "https://agency.gov/page", "support", "same")
    duplicate = record("b", "Syndicate", "https://research.example/page", "support", "same")
    counter = record("c", "Institute", "https://theicct.org/page", "counter")
    selected = select_evidence([duplicate, first, counter])
    assert {item.evidence.id for item in selected} == {"a", "c"}
    assert credible_independent_count(selected) == 2
    assert excerpt_is_captured(first.evidence.excerpt, first.captured_text)
    first.captured_text = "Different page text."
    draft = valid_draft(["a", "c"])
    assert "excerpt_mismatch" in validate_draft(claim(), [first, counter], draft).errors


def test_validator_rejects_foreign_ids_and_omits_unsupported_common_ground():
    support = record("support", "Agency", "https://agency.gov/page", "support")
    counter = record("counter", "Institute", "https://theicct.org/page", "counter")
    foreign = valid_draft(["support", "missing"])
    assert "unknown_citation" in validate_draft(claim(), [support, counter], foreign).errors
    draft = valid_draft(["support", "counter"])
    draft.common_ground = "Completely unrelated lunar geology statement."
    result = validate_draft(claim(), [support, counter], draft)
    assert result.verdict and result.verdict.common_ground is None


def test_validator_rejects_unsupported_interpretation():
    support = record("support", "Agency", "https://agency.gov/page", "support")
    counter = record("counter", "Institute", "https://theicct.org/page", "counter")
    draft = valid_draft(["support", "counter"])
    draft.explanation = "Mars has oceans populated by intelligent purple whales."
    assert "unsupported_explanation" in validate_draft(claim(), [support, counter], draft).errors


def test_validator_rejects_duplicate_sources_and_unjustified_certainty():
    first = record("a", "Agency", "https://agency.gov/page", "support")
    derivative = record("b", "Agency", "https://other.gov/page", "support")
    draft = valid_draft(["a", "b"])
    assert "insufficient_independent_sources" in validate_draft(claim(), [first, derivative], draft).errors
    draft.confidence = 0.99
    draft.uncertainty = "Major uncertainty remains."
    assert "confidence_overstates_uncertainty" in validate_draft(claim(), [first, derivative], draft).errors


def valid_draft(ids: list[str]) -> VerdictDraft:
    return VerdictDraft(
        claim_public_id="claim-1234567890abcdef",
        label="Misleading",
        confidence=0.8,
        explanation="Direct emissions can be zero. Lifecycle emissions can remain.",
        uncertainty="Totals vary by electricity mix.",
        counterevidence_summary="Lifecycle production creates emissions.",
        common_ground="Electric vehicles have zero direct emissions.",
        citation_ids=ids,
        model_provider="recorded",
        model_name="test",
    )
