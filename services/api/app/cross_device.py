import hashlib
import hmac
import os
import secrets
import threading
import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Protocol
from uuid import uuid4

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


class CrossDeviceStore(Protocol):
    def create_challenge(self, challenge: Challenge) -> None: ...
    def redeem(self, code_hash: str | None, token_hash: str | None, label: str, device_id: str, device_token_hash: str) -> Device: ...
    def upsert_subscription(self, body: SubscriptionCreate, device_token_hash: str) -> Subscription: ...
    def revoke_subscription(self, subscription_id: str, device_token_hash: str) -> None: ...
    def eligible_subscriptions(self, session_id: str) -> list[Subscription]: ...
    def reserve_outcome(self, public_id: str, subscription_id: str) -> bool: ...
    def finish_outcome(self, public_id: str, subscription_id: str, status: str) -> None: ...
    def deactivate_subscription(self, subscription_id: str) -> None: ...
    def cleanup(self, cutoff: datetime) -> None: ...


class MemoryCrossDeviceStore:
    def __init__(self):
        self.challenges: dict[str, Challenge] = {}
        self.devices: dict[str, Device] = {}
        self.subscriptions: dict[str, Subscription] = {}
        self.outcomes: set[tuple[str, str]] = set()
        self.lock = threading.RLock()

    def create_challenge(self, challenge: Challenge) -> None:
        with self.lock:
            self.challenges[challenge.id] = challenge

    def redeem(self, code_hash: str | None, token_hash: str | None, label: str, device_id: str, device_token_hash: str) -> Device:
        with self.lock:
            match = next((item for item in self.challenges.values() if
                (code_hash and hmac.compare_digest(item.code_hash, code_hash)) or
                (token_hash and hmac.compare_digest(item.token_hash, token_hash))), None)
            if not match:
                raise ValueError("pairing not found")
            if match.expires_at <= now():
                raise ValueError("pairing expired")
            if match.redeemed_device_id:
                raise ValueError("pairing already redeemed")
            match.attempts += 1
            if match.attempts > 5:
                raise ValueError("pairing attempt limit exceeded")
            device = Device(device_id, device_token_hash, label, match.session_id)
            self.devices[device_id] = device
            match.redeemed_device_id = device_id
            return device

    def upsert_subscription(self, body: SubscriptionCreate, device_token_hash: str) -> Subscription:
        with self.lock:
            device = self.devices.get(body.device_id)
            if not device or device.revoked_at or not hmac.compare_digest(device.token_hash, device_token_hash):
                raise ValueError("invalid device")
            existing = next((item for item in self.subscriptions.values() if item.device_id == body.device_id), None)
            if existing:
                existing.endpoint, existing.p256dh, existing.auth, existing.active = str(body.endpoint), body.p256dh, body.auth, True
                return existing
            subscription = Subscription(str(uuid4()), body.device_id, str(body.endpoint), body.p256dh, body.auth)
            self.subscriptions[subscription.id] = subscription
            return subscription

    def revoke_subscription(self, subscription_id: str, device_token_hash: str) -> None:
        with self.lock:
            subscription = self.subscriptions.get(subscription_id)
            device = self.devices.get(subscription.device_id) if subscription else None
            if not subscription or not device or not hmac.compare_digest(device.token_hash, device_token_hash):
                raise ValueError("subscription not found")
            subscription.active = False

    def eligible_subscriptions(self, session_id: str) -> list[Subscription]:
        with self.lock:
            return [item for item in self.subscriptions.values() if item.active and self.devices[item.device_id].session_id == session_id]

    def reserve_outcome(self, public_id: str, subscription_id: str) -> bool:
        with self.lock:
            key = (public_id, subscription_id)
            if key in self.outcomes:
                return False
            self.outcomes.add(key)
            return True

    def finish_outcome(self, public_id: str, subscription_id: str, status: str) -> None:
        return None

    def deactivate_subscription(self, subscription_id: str) -> None:
        with self.lock:
            if subscription_id in self.subscriptions:
                self.subscriptions[subscription_id].active = False

    def cleanup(self, cutoff: datetime) -> None:
        with self.lock:
            expired = [key for key, value in self.challenges.items() if value.expires_at <= cutoff or value.redeemed_device_id]
            for key in expired:
                del self.challenges[key]


class PostgresCrossDeviceStore:
    def __init__(self, database_url: str):
        self.database_url = database_url

    def _connect(self):
        import psycopg
        return psycopg.connect(self.database_url)

    def create_challenge(self, challenge: Challenge) -> None:
        with self._connect() as db:
            db.execute("""INSERT INTO pairing_challenges(id,session_id,code_hash,token_hash,attempts,expires_at)
                VALUES(%s,%s,%s,%s,%s,%s)""", (challenge.id, challenge.session_id, challenge.code_hash, challenge.token_hash, challenge.attempts, challenge.expires_at))

    def redeem(self, code_hash: str | None, token_hash: str | None, label: str, device_id: str, device_token_hash: str) -> Device:
        with self._connect() as db, db.transaction():
            if code_hash:
                row = db.execute("""SELECT id,session_id,expires_at,attempts,redeemed_device_id
                    FROM pairing_challenges WHERE code_hash=%s FOR UPDATE""", (code_hash,)).fetchone()
            else:
                row = db.execute("""SELECT id,session_id,expires_at,attempts,redeemed_device_id
                    FROM pairing_challenges WHERE token_hash=%s FOR UPDATE""", (token_hash,)).fetchone()
            if not row:
                raise ValueError("pairing not found")
            challenge_id, session_id, expires_at, attempts, redeemed = row
            if expires_at <= now():
                raise ValueError("pairing expired")
            if redeemed:
                raise ValueError("pairing already redeemed")
            attempts += 1
            if attempts > 5:
                db.execute("UPDATE pairing_challenges SET attempts=%s WHERE id=%s", (attempts, challenge_id))
                raise ValueError("pairing attempt limit exceeded")
            db.execute("INSERT INTO paired_devices(id,session_id,token_hash,label) VALUES(%s,%s,%s,%s)", (device_id, session_id, device_token_hash, label))
            db.execute("UPDATE pairing_challenges SET attempts=%s,redeemed_at=now(),redeemed_device_id=%s WHERE id=%s", (attempts, device_id, challenge_id))
            return Device(device_id, device_token_hash, label, str(session_id))

    def upsert_subscription(self, body: SubscriptionCreate, device_token_hash: str) -> Subscription:
        with self._connect() as db, db.transaction():
            device = db.execute("SELECT token_hash,revoked_at FROM paired_devices WHERE id=%s FOR UPDATE", (body.device_id,)).fetchone()
            if not device or device[1] or not hmac.compare_digest(device[0], device_token_hash):
                raise ValueError("invalid device")
            subscription_id = str(uuid4())
            row = db.execute("""INSERT INTO push_subscriptions(id,device_id,device_ref,endpoint,p256dh,auth_secret,active)
                VALUES(%s,%s,%s,%s,%s,%s,true)
                ON CONFLICT(device_id) DO UPDATE SET endpoint=EXCLUDED.endpoint,p256dh=EXCLUDED.p256dh,
                auth_secret=EXCLUDED.auth_secret,active=true,updated_at=now() RETURNING id::text""",
                (subscription_id, body.device_id, body.device_id, str(body.endpoint), body.p256dh, body.auth)).fetchone()
            return Subscription(row[0], body.device_id, str(body.endpoint), body.p256dh, body.auth, True)

    def revoke_subscription(self, subscription_id: str, device_token_hash: str) -> None:
        with self._connect() as db, db.transaction():
            row = db.execute("""SELECT d.token_hash FROM push_subscriptions s JOIN paired_devices d ON d.id=s.device_ref
                WHERE s.id=%s FOR UPDATE""", (subscription_id,)).fetchone()
            if not row or not hmac.compare_digest(row[0], device_token_hash):
                raise ValueError("subscription not found")
            db.execute("UPDATE push_subscriptions SET active=false,updated_at=now() WHERE id=%s", (subscription_id,))

    def eligible_subscriptions(self, session_id: str) -> list[Subscription]:
        with self._connect() as db:
            rows = db.execute("""SELECT s.id::text,s.device_ref,s.endpoint,s.p256dh,s.auth_secret,s.active
                FROM push_subscriptions s JOIN paired_devices d ON d.id=s.device_ref
                WHERE d.session_id=%s AND d.revoked_at IS NULL AND s.active=true""", (session_id,)).fetchall()
        return [Subscription(*row) for row in rows]

    def reserve_outcome(self, public_id: str, subscription_id: str) -> bool:
        with self._connect() as db, db.transaction():
            row = db.execute("""INSERT INTO notification_outcomes(claim_id,subscription_id,status,attempt_count,attempted_at)
                SELECT id,%s,'attempting',1,now() FROM claims WHERE public_id=%s
                ON CONFLICT(claim_id,subscription_id) DO NOTHING RETURNING claim_id""", (subscription_id, public_id)).fetchone()
            return row is not None

    def finish_outcome(self, public_id: str, subscription_id: str, status: str) -> None:
        with self._connect() as db:
            db.execute("""UPDATE notification_outcomes SET status=%s,provider_category=%s
                WHERE subscription_id=%s AND claim_id=(SELECT id FROM claims WHERE public_id=%s)""", (status, status, subscription_id, public_id))

    def deactivate_subscription(self, subscription_id: str) -> None:
        with self._connect() as db:
            db.execute("UPDATE push_subscriptions SET active=false,updated_at=now() WHERE id=%s", (subscription_id,))

    def cleanup(self, cutoff: datetime) -> None:
        with self._connect() as db:
            db.execute("DELETE FROM pairing_challenges WHERE expires_at<=%s OR redeemed_at IS NOT NULL", (cutoff,))


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
        for attempt in range(2):
            try:
                webpush(
                    subscription_info={"endpoint": subscription.endpoint, "keys": {"p256dh": subscription.p256dh, "auth": subscription.auth}},
                    data=json.dumps(payload), vapid_private_key=self.private_key,
                    vapid_claims={"sub": self.subject}, ttl=60,
                )
                return "accepted"
            except WebPushException as error:
                status = getattr(getattr(error, "response", None), "status_code", None)
                if status in (404, 410):
                    return "expired"
                if attempt or status not in (429, 500, 502, 503, 504):
                    raise
                time.sleep(0.2)
        return "failed"


class CrossDeviceCoordinator:
    def __init__(self, secret: str | None = None, push: PushAdapter | None = None, ttl_seconds: int = 600, store: CrossDeviceStore | None = None):
        self.secret = (secret or os.getenv("VERITY_PAIRING_SECRET") or secrets.token_hex(32)).encode()
        self.push = push or FakePushAdapter()
        self.ttl_seconds = ttl_seconds
        self.store = store or MemoryCrossDeviceStore()
        # Backward-compatible inspection handles for deterministic tests.
        self.challenges = getattr(self.store, "challenges", {})
        self.devices = getattr(self.store, "devices", {})
        self.subscriptions = getattr(self.store, "subscriptions", {})

    def _hash(self, value: str) -> str:
        return hmac.new(self.secret, value.encode(), hashlib.sha256).hexdigest()

    def create_pairing(self, session_id: str) -> PairingChallengeView:
        self.cleanup()
        code, token = f"{secrets.randbelow(1_000_000):06d}", secrets.token_urlsafe(32)
        challenge = Challenge(secrets.token_urlsafe(18), session_id, self._hash(code), self._hash(token), now() + timedelta(seconds=self.ttl_seconds))
        self.store.create_challenge(challenge)
        return PairingChallengeView(challenge_id=challenge.id, code=code, redemption_token=token, expires_at=challenge.expires_at)

    def cleanup(self) -> None:
        self.store.cleanup(now())

    def redeem(self, body: PairingRedeem) -> PairedDeviceView:
        if not body.code and not body.redemption_token:
            raise ValueError("code or redemption token is required")
        device_id, device_token = secrets.token_urlsafe(18), secrets.token_urlsafe(32)
        device = self.store.redeem(self._hash(body.code) if body.code else None, self._hash(body.redemption_token) if body.redemption_token else None, body.device_label, device_id, self._hash(device_token))
        return PairedDeviceView(device_id=device.id, device_token=device_token, device_label=device.label, session_id=device.session_id)

    def register(self, body: SubscriptionCreate) -> SubscriptionView:
        subscription = self.store.upsert_subscription(body, self._hash(body.device_token))
        return SubscriptionView(subscription_id=subscription.id, device_id=subscription.device_id, active=subscription.active)

    def revoke(self, subscription_id: str, device_token: str) -> None:
        self.store.revoke_subscription(subscription_id, self._hash(device_token))

    def notify(self, session_id: str, public_id: str, summary: str) -> int:
        sent = 0
        for subscription in self.store.eligible_subscriptions(session_id):
            if not self.store.reserve_outcome(public_id, subscription.id):
                continue
            payload = {
                "schema_version": "1",
                "notification_id": f"claim:{public_id}",
                "public_id": public_id,
                "title": "Verity found missing context",
                "body": "Tap to inspect 3 sources.",
            }
            try:
                result = self.push.send(subscription, payload)
            except Exception:
                self.store.finish_outcome(public_id, subscription.id, "failed")
                continue
            self.store.finish_outcome(public_id, subscription.id, result)
            if result == "expired":
                self.store.deactivate_subscription(subscription.id)
            elif result == "accepted":
                sent += 1
        return sent


def configured_cross_device() -> CrossDeviceCoordinator:
    private_key, subject = os.getenv("VAPID_PRIVATE_KEY"), os.getenv("VAPID_SUBJECT")
    adapter = WebPushAdapter(private_key, subject) if private_key and subject else FakePushAdapter()
    database_url = os.getenv("VERITY_DATABASE_URL") if os.getenv("VERITY_REPOSITORY") == "postgres" else None
    store = PostgresCrossDeviceStore(database_url) if database_url else MemoryCrossDeviceStore()
    return CrossDeviceCoordinator(push=adapter, store=store)
