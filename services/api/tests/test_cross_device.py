from datetime import timedelta

import pytest

from app.cross_device import (
    CrossDeviceCoordinator,
    FakePushAdapter,
    PairingRedeem,
    SubscriptionCreate,
    now,
)


def pair(service: CrossDeviceCoordinator):
    challenge = service.create_pairing("session-1")
    return service.redeem(PairingRedeem(code=challenge.code, device_label="Demo iPhone"))


def test_pairing_is_single_use_and_expiring():
    service = CrossDeviceCoordinator(secret="test", ttl_seconds=60)
    challenge = service.create_pairing("session-1")
    device = service.redeem(PairingRedeem(redemption_token=challenge.redemption_token))
    assert device.session_id == "session-1"
    with pytest.raises(ValueError, match="already redeemed"):
        service.redeem(PairingRedeem(code=challenge.code))

    expired = service.create_pairing("session-2")
    assert service.memory_store is not None
    service.memory_store.challenges[expired.challenge_id].expires_at = now() - timedelta(seconds=1)
    with pytest.raises(ValueError, match="expired"):
        service.redeem(PairingRedeem(code=expired.code))


def test_subscription_rotation_revoke_and_idempotent_push():
    push = FakePushAdapter()
    service = CrossDeviceCoordinator(secret="test", push=push)
    device = pair(service)
    body = SubscriptionCreate(
        device_id=device.device_id,
        device_token=device.device_token,
        endpoint="https://push.example/subscription",
        p256dh="p" * 32,
        auth="a" * 16,
    )
    first = service.register(body)
    second = service.register(body.model_copy(update={"p256dh": "q" * 32}))
    assert first.subscription_id == second.subscription_id
    assert service.notify("session-1", "claim-high-entropy", "A nuanced verdict") == 1
    assert service.notify("session-1", "claim-high-entropy", "A nuanced verdict") == 0
    assert len(push.deliveries) == 1
    service.revoke(first.subscription_id, device.device_token)
    assert service.notify("session-1", "another-claim", "No delivery") == 0


def test_wrong_device_token_cannot_register_or_revoke():
    service = CrossDeviceCoordinator(secret="test")
    device = pair(service)
    body = SubscriptionCreate(
        device_id=device.device_id,
        device_token="wrong-token-that-is-long-enough",
        endpoint="https://push.example/subscription",
        p256dh="p" * 32,
        auth="a" * 16,
    )
    with pytest.raises(ValueError, match="invalid device"):
        service.register(body)
