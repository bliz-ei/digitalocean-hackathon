import hashlib
import hmac
import os
import secrets
import threading
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import TYPE_CHECKING, Protocol

from pydantic import BaseModel, Field, HttpUrl

if TYPE_CHECKING:
    from app.cross_device_store import CrossDeviceStore


def now() -> datetime:
    return datetime.now(timezone.utc)


class PairingCreate(BaseModel):
    session_id: str


class PairingChallengeView(BaseModel):
    challenge_id: str
    code: str
    redemption_token: str
    expires_at: datetime


class PairingRedeem(BaseModel):
    code: str | None = Field(default=None, pattern=r"^\d{6}$")
    redemption_token: str | None = Field(default=None, min_length=32, max_length=200)
    device_label: str = Field(default="iPhone", min_length=1, max_length=60)


class PairedDeviceView(BaseModel):
    device_id: str
    device_token: str
    device_label: str
    session_id: str


class SubscriptionCreate(BaseModel):
    device_id: str
    device_token: str
    endpoint: HttpUrl
    p256dh: str = Field(min_length=16, max_length=256)
    auth: str = Field(min_length=8, max_length=128)


class SubscriptionView(BaseModel):
    subscription_id: str
    device_id: str
    active: bool


@dataclass
class Challenge:
    id: str
    session_id: str
    code_hash: str
    token_hash: str
    expires_at: datetime
    attempts: int = 0
    redeemed_device_id: str | None = None


@dataclass
class Device:
    id: str
    token_hash: str
    label: str
    session_id: str
    revoked_at: datetime | None = None


@dataclass
class Subscription:
    id: str
    device_id: str
    endpoint: str
    p256dh: str
    auth: str
    active: bool = True


class PushAdapter(Protocol):
    def send(self, subscription: Subscription, payload: dict) -> str: ...


@dataclass
class FakePushAdapter:
    deliveries: list[tuple[str, dict]] = field(default_factory=list)

    def send(self, subscription: Subscription, payload: dict) -> str:
        self.deliveries.append((subscription.id, payload))
        return "accepted"


class WebPushAdapter:
    def __init__(self, private_key: str, subject: str):
        self.private_key = private_key
        self.subject = subject

    def send(self, subscription: Subscription, payload: dict) -> str:
        import json

        from pywebpush import WebPushException, webpush

        try:
            webpush(
                subscription_info={
                    "endpoint": subscription.endpoint,
                    "keys": {"p256dh": subscription.p256dh, "auth": subscription.auth},
                },
                data=json.dumps(payload),
                vapid_private_key=self.private_key,
                vapid_claims={"sub": self.subject},
                ttl=60,
            )
            return "accepted"
        except WebPushException as error:
            status = getattr(getattr(error, "response", None), "status_code", None)
            if status in (404, 410):
                subscription.active = False
                return "expired"
            raise


class CrossDeviceCoordinator:
    def __init__(
        self,
        secret: str | None = None,
        push: PushAdapter | None = None,
        ttl_seconds: int = 600,
        store: "CrossDeviceStore | None" = None,
    ):
        from app.cross_device_store import MemoryCrossDeviceStore

        self.secret = (secret or os.getenv("VERITY_PAIRING_SECRET") or secrets.token_hex(32)).encode()
        self.push = push or FakePushAdapter()
        self.ttl_seconds = ttl_seconds
        self.store = store or MemoryCrossDeviceStore.empty()
        self.lock = threading.RLock()

    @property
    def memory_store(self):
        from app.cross_device_store import MemoryCrossDeviceStore

        return self.store if isinstance(self.store, MemoryCrossDeviceStore) else None

    def _hash(self, value: str) -> str:
        return hmac.new(self.secret, value.encode(), hashlib.sha256).hexdigest()

    def create_pairing(self, session_id: str) -> PairingChallengeView:
        with self.lock:
            self.store.cleanup()
            code = f"{secrets.randbelow(1_000_000):06d}"
            token = secrets.token_urlsafe(32)
            challenge_id = secrets.token_urlsafe(18)
            expires = now() + timedelta(seconds=self.ttl_seconds)
            challenge = Challenge(
                challenge_id,
                session_id,
                self._hash(code),
                self._hash(token),
                expires,
            )
            self.store.save_challenge(challenge)
        return PairingChallengeView(
            challenge_id=challenge_id,
            code=code,
            redemption_token=token,
            expires_at=expires,
        )

    def cleanup(self) -> None:
        with self.lock:
            self.store.cleanup()

    def redeem(self, body: PairingRedeem) -> PairedDeviceView:
        if not body.code and not body.redemption_token:
            raise ValueError("code or redemption token is required")
        with self.lock:
            return self.store.redeem(body, self._hash)

    def register(self, body: SubscriptionCreate) -> SubscriptionView:
        with self.lock:
            return self.store.register(body, self._hash)

    def revoke(self, subscription_id: str, device_token: str) -> None:
        with self.lock:
            self.store.revoke(subscription_id, device_token, self._hash)

    def notify(self, session_id: str, public_id: str, summary: str) -> int:
        sent = 0
        with self.lock:
            eligible = self.store.active_subscriptions(session_id)
            for subscription in eligible:
                if self.store.outcome_exists(public_id, subscription.id):
                    continue
                payload = {
                    "schema_version": "1",
                    "notification_id": f"claim:{public_id}",
                    "public_id": public_id,
                    "title": "Verity found context",
                    "body": summary[:120],
                }
                result = self.push.send(subscription, payload)
                recorded = self.store.record_outcome(public_id, subscription.id, result, result)
                if result == "expired":
                    self.store.deactivate_subscription(subscription.id)
                if recorded and result == "accepted":
                    sent += 1
        return sent


def configured_cross_device() -> CrossDeviceCoordinator:
    from app.cross_device_store import PostgresCrossDeviceStore

    private_key = os.getenv("VAPID_PRIVATE_KEY")
    subject = os.getenv("VAPID_SUBJECT")
    adapter = WebPushAdapter(private_key, subject) if private_key and subject else FakePushAdapter()
    secret = os.getenv("VERITY_PAIRING_SECRET")
    if os.getenv("VERITY_REPOSITORY") == "postgres":
        database_url = os.environ["VERITY_DATABASE_URL"]
        return CrossDeviceCoordinator(secret=secret, push=adapter, store=PostgresCrossDeviceStore(database_url))
    return CrossDeviceCoordinator(secret=secret, push=adapter)
