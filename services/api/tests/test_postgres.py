import asyncio
import os
from uuid import uuid4

import pytest

from app.persistence.repository import PostgresRepository
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
    finally:
        repository.close()


async def _noop():
    return None
