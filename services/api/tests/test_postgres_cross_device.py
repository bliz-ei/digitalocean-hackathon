import os
from uuid import uuid4

import pytest

from app.cross_device import CrossDeviceCoordinator, FakePushAdapter, PairingRedeem, SubscriptionCreate
from app.cross_device_store import PostgresCrossDeviceStore
from app.domain.models import Claim, ClaimState, ClassificationResult, utcnow
from app.persistence.repository import PostgresRepository


def _service(database_url: str) -> tuple[CrossDeviceCoordinator, PostgresCrossDeviceStore, PostgresRepository]:
    repository = PostgresRepository(database_url)
    store = PostgresCrossDeviceStore(database_url)
    service = CrossDeviceCoordinator(secret="postgres-test-secret", push=FakePushAdapter(), store=store)
    return service, store, repository


@pytest.mark.skipif(not os.getenv("TEST_DATABASE_URL"), reason="PostgreSQL not configured")
def test_postgres_cross_device_survives_new_coordinator_instance():
    database_url = os.environ["TEST_DATABASE_URL"]
    session_id = str(uuid4())
    bootstrap = PostgresRepository(database_url)
    try:
        bootstrap.create_session("cross-device-test", session_id)
    finally:
        bootstrap.close()

    service, store, repository = _service(database_url)
    public_id = f"claim-{uuid4().hex}"
    try:
        challenge = service.create_pairing(session_id)
        device = service.redeem(PairingRedeem(code=challenge.code, device_label="Demo iPhone"))
        subscription = service.register(
            SubscriptionCreate(
                device_id=device.device_id,
                device_token=device.device_token,
                endpoint="https://push.example/subscription",
                p256dh="p" * 32,
                auth="a" * 16,
            )
        )
        live_claim = Claim(
            public_id=public_id,
            session_id=session_id,
            speaker_label="Speaker A",
            exact_text="Example claim.",
            normalized_text="Example claim.",
            start_ms=1,
            end_ms=2,
            classification="factual_claim",
            state=ClaimState.COMPLETE,
            created_at=utcnow(),
            completed_at=utcnow(),
            fixture_mode=True,
        )
        result = ClassificationResult(
            candidate_id="candidate",
            classification="factual_claim",
            normalized_claim="Example claim.",
            neutral_queries=["example"],
            support_queries=["example support"],
            counter_queries=["example counter"],
        )
        assert repository.create_claim(live_claim, result)
        assert repository.complete_claim(live_claim)
        assert service.notify(session_id, public_id, "A nuanced verdict") == 1
        assert service.notify(session_id, public_id, "A nuanced verdict") == 0
    finally:
        repository.close()
        store.close()

    restarted, restarted_store, restarted_repository = _service(database_url)
    try:
        assert restarted.notify(session_id, public_id, "A nuanced verdict") == 0
        row = restarted_repository.db.execute(
            """SELECT count(*) FROM notification_outcomes no
               JOIN claims c ON c.id = no.claim_id
               WHERE c.public_id = %s""",
            (public_id,),
        ).fetchone()
        assert row[0] == 1
        subscription_row = restarted_repository.db.execute(
            "SELECT active FROM push_subscriptions WHERE id = %s::uuid",
            (subscription.subscription_id,),
        ).fetchone()
        assert subscription_row[0] is True
    finally:
        restarted_repository.close()
        restarted_store.close()
