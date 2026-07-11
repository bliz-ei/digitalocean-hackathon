import asyncio
import os
from uuid import uuid4

import pytest

from app.persistence.repository import PostgresRepository
from app.domain.models import Claim, ClaimState, ClassificationResult, TranscriptSegment, utcnow
from app.pipeline.hero import run_hero
from app.pipeline.evidence import EvidencePipeline
from app.providers.evidence import RecordedEvidenceProvider
from app.providers.fakes import FakeProviders
from app.cross_device import CrossDeviceCoordinator, FakePushAdapter, PairingRedeem, PostgresCrossDeviceStore, SubscriptionCreate


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
            exact_text="Electric vehicles produce no carbon emissions.", normalized_text="Electric vehicles produce no carbon emissions", start_ms=1, end_ms=2,
            classification="factual_claim", state=ClaimState.CHECKING, created_at=utcnow(), fixture_mode=False,
        )
        result = ClassificationResult(
            candidate_id="candidate", classification="factual_claim", normalized_claim="Electric vehicles produce no carbon emissions",
            neutral_queries=["electric vehicle lifecycle emissions"], support_queries=["electric vehicle direct emissions"], counter_queries=["electric vehicle production emissions"],
        )
        assert repository.create_claim(live_claim, result)
        assert not repository.create_claim(live_claim, result)
        evidence = RecordedEvidenceProvider()
        completed = asyncio.run(EvidencePipeline(repository, evidence, evidence, evidence, lambda *_: _noop()).run(live_claim, result))
        assert completed.state == ClaimState.COMPLETE
        assert repository.db.execute("SELECT count(*) FROM evidence WHERE claim_id=(SELECT id FROM claims WHERE public_id=%s)", (live_claim.public_id,)).fetchone()[0] == 3
        assert repository.db.execute("SELECT count(*) FROM notification_jobs WHERE public_id=%s", (live_claim.public_id,)).fetchone()[0] == 1
        push = FakePushAdapter()
        cross_device = CrossDeviceCoordinator(secret="postgres-test-secret", push=push, store=PostgresCrossDeviceStore(os.environ["TEST_DATABASE_URL"]))
        challenge = cross_device.create_pairing(session_id)
        device = cross_device.redeem(PairingRedeem(code=challenge.code, device_label="CI iPhone"))
        subscription = cross_device.register(SubscriptionCreate(
            device_id=device.device_id, device_token=device.device_token,
            endpoint="https://push.example/subscription", p256dh="p" * 32, auth="a" * 16,
        ))
        assert repository.db.execute("SELECT count(*) FROM paired_devices WHERE session_id=%s AND revoked_at IS NULL", (session_id,)).fetchone()[0] == 1
        assert repository.db.execute("SELECT count(*) FROM push_subscriptions WHERE device_ref=%s AND active=true", (device.device_id,)).fetchone()[0] == 1
        assert len(cross_device.store.eligible_subscriptions(session_id)) == 1
        assert cross_device.notify(session_id, live_claim.public_id, "CI verdict") == 1
        assert cross_device.notify(session_id, live_claim.public_id, "CI verdict") == 0
        assert len(push.deliveries) == 1
        cross_device.revoke(subscription.subscription_id, device.device_token)
        assert repository.db.execute("SELECT active FROM push_subscriptions WHERE id=%s", (subscription.subscription_id,)).fetchone()[0] is False
    finally:
        repository.close()


async def _noop():
    return None
