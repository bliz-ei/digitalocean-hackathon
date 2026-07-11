import hashlib
import hmac
import os
import secrets
import threading
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Protocol

from pydantic import BaseModel, Field, HttpUrl


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
                subscription_info={"endpoint": subscription.endpoint, "keys": {"p256dh": subscription.p256dh, "auth": subscription.auth}},
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
    def __init__(self, secret: str | None = None, push: PushAdapter | None = None, ttl_seconds: int = 600):
        self.secret = (secret or os.getenv("VERITY_PAIRING_SECRET") or secrets.token_hex(32)).encode()
        self.push = push or FakePushAdapter()
        self.ttl_seconds = ttl_seconds
        self.challenges: dict[str, Challenge] = {}
        self.devices: dict[str, Device] = {}
        self.subscriptions: dict[str, Subscription] = {}
        self.outcomes: set[tuple[str, str]] = set()
        self.lock = threading.RLock()

    def _hash(self, value: str) -> str:
        return hmac.new(self.secret, value.encode(), hashlib.sha256).hexdigest()

    def create_pairing(self, session_id: str) -> PairingChallengeView:
        self.cleanup()
        code = f"{secrets.randbelow(1_000_000):06d}"
        token = secrets.token_urlsafe(32)
        challenge_id = secrets.token_urlsafe(18)
        expires = now() + timedelta(seconds=self.ttl_seconds)
        with self.lock:
            self.challenges[challenge_id] = Challenge(challenge_id, session_id, self._hash(code), self._hash(token), expires)
        return PairingChallengeView(challenge_id=challenge_id, code=code, redemption_token=token, expires_at=expires)

    def cleanup(self) -> None:
        cutoff = now()
        with self.lock:
            self.challenges = {key: value for key, value in self.challenges.items() if value.expires_at > cutoff and not value.redeemed_device_id}

    def redeem(self, body: PairingRedeem) -> PairedDeviceView:
        if not body.code and not body.redemption_token:
            raise ValueError("code or redemption token is required")
        with self.lock:
            match = next((item for item in self.challenges.values() if
                (body.code and hmac.compare_digest(item.code_hash, self._hash(body.code))) or
                (body.redemption_token and hmac.compare_digest(item.token_hash, self._hash(body.redemption_token)))), None)
            if not match:
                raise ValueError("pairing not found")
            if match.expires_at <= now():
                raise ValueError("pairing expired")
            if match.redeemed_device_id:
                raise ValueError("pairing already redeemed")
            match.attempts += 1
            if match.attempts > 5:
                raise ValueError("pairing attempt limit exceeded")
            device_id = secrets.token_urlsafe(18)
            device_token = secrets.token_urlsafe(32)
            self.devices[device_id] = Device(device_id, self._hash(device_token), body.device_label, match.session_id)
            match.redeemed_device_id = device_id
            return PairedDeviceView(device_id=device_id, device_token=device_token, device_label=body.device_label, session_id=match.session_id)

    def register(self, body: SubscriptionCreate) -> SubscriptionView:
        with self.lock:
            device = self.devices.get(body.device_id)
            if not device or device.revoked_at or not hmac.compare_digest(device.token_hash, self._hash(body.device_token)):
                raise ValueError("invalid device")
            existing = next((item for item in self.subscriptions.values() if item.device_id == body.device_id and item.endpoint == str(body.endpoint)), None)
            if existing:
                existing.p256dh, existing.auth, existing.active = body.p256dh, body.auth, True
                return SubscriptionView(subscription_id=existing.id, device_id=existing.device_id, active=True)
            subscription = Subscription(secrets.token_urlsafe(18), body.device_id, str(body.endpoint), body.p256dh, body.auth)
            self.subscriptions[subscription.id] = subscription
            return SubscriptionView(subscription_id=subscription.id, device_id=subscription.device_id, active=True)

    def revoke(self, subscription_id: str, device_token: str) -> None:
        with self.lock:
            subscription = self.subscriptions.get(subscription_id)
            device = self.devices.get(subscription.device_id) if subscription else None
            if not subscription or not device or not hmac.compare_digest(device.token_hash, self._hash(device_token)):
                raise ValueError("subscription not found")
            subscription.active = False

    def notify(self, session_id: str, public_id: str, summary: str) -> int:
        sent = 0
        with self.lock:
            eligible = [item for item in self.subscriptions.values() if item.active and self.devices[item.device_id].session_id == session_id]
            for subscription in eligible:
                key = (public_id, subscription.id)
                if key in self.outcomes:
                    continue
                payload = {"schema_version": "1", "notification_id": f"claim:{public_id}", "public_id": public_id, "title": "Verity found context", "body": summary[:120]}
                result = self.push.send(subscription, payload)
                self.outcomes.add(key)
                if result == "accepted": sent += 1
        return sent


def configured_cross_device() -> CrossDeviceCoordinator:
    private_key = os.getenv("VAPID_PRIVATE_KEY")
    subject = os.getenv("VAPID_SUBJECT")
    adapter = WebPushAdapter(private_key, subject) if private_key and subject else FakePushAdapter()
    return CrossDeviceCoordinator(push=adapter)
