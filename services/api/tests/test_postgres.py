import asyncio
import os
from uuid import uuid4

import pytest

from app.persistence.repository import PostgresRepository
from app.domain.models import Claim, ClaimState, ClassificationResult, TranscriptSegment, utcnow
from app.pipeline.hero import run_hero
from app.providers.fakes import FakeProviders


@pytest.mark.skipif(not os.getenv("TEST_DATABASE_URL"), reason="PostgreSQL not configured")
def test_postgres_persists_canonical_hero_claim():
    repository = PostgresRepository(os.environ["TEST_DATABASE_URL"])
    try:
        session_id = repository.create_session("postgres-test", str(uuid4()))
        claim = asyncio.run(
            run_hero(session_id, repository, FakeProviders(), lambda _: _noop())
        )
        assert repository.get_claim(claim.public_id) == claim
        segment = TranscriptSegment(segment_id="phase2-final", speaker="A", text="A final sentence.", start_ms=1, end_ms=2)
        assert repository.save_transcript(session_id, segment)
        assert not repository.save_transcript(session_id, segment)
        live_claim = Claim(
            public_id=f"phase2-{uuid4()}", session_id=session_id, speaker_label="Speaker A",
            exact_text="A final sentence.", normalized_text="A final sentence", start_ms=1, end_ms=2,
            classification="factual_claim", state=ClaimState.CHECKING, created_at=utcnow(), fixture_mode=False,
        )
        result = ClassificationResult(
            candidate_id="candidate", classification="factual_claim", normalized_claim="A final sentence",
            neutral_queries=["neutral"], support_queries=["support"], counter_queries=["counter"],
        )
        assert repository.create_claim(live_claim, result)
        assert not repository.create_claim(live_claim, result)
    finally:
        repository.close()


async def _noop():
    return None
