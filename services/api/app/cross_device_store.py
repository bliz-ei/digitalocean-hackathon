import hashlib
import hmac
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Callable, Protocol
from uuid import uuid4

from app.cross_device import (
    Challenge,
    Device,
    PairingRedeem,
    PairedDeviceView,
    Subscription,
    SubscriptionCreate,
    SubscriptionView,
    now,
)


HashFn = Callable[[str], str]


@dataclass
class MemoryCrossDeviceStore:
    challenges: dict[str, Challenge]
    devices: dict[str, Device]
    subscriptions: dict[str, Subscription]
    outcomes: set[tuple[str, str]]

    @classmethod
    def empty(cls) -> "MemoryCrossDeviceStore":
        return cls(challenges={}, devices={}, subscriptions={}, outcomes=set())

    def cleanup(self) -> None:
        cutoff = now()
        self.challenges = {
            key: value
            for key, value in self.challenges.items()
            if value.expires_at > cutoff and not value.redeemed_device_id
        }

    def save_challenge(self, challenge: Challenge) -> None:
        self.challenges[challenge.id] = challenge

    def redeem(self, body: PairingRedeem, hash_value: HashFn) -> PairedDeviceView:
        match = next(
            (
                item
                for item in self.challenges.values()
                if (body.code and hmac.compare_digest(item.code_hash, hash_value(body.code)))
                or (
                    body.redemption_token
                    and hmac.compare_digest(item.token_hash, hash_value(body.redemption_token))
                )
            ),
            None,
        )
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
        self.devices[device_id] = Device(device_id, hash_value(device_token), body.device_label, match.session_id)
        match.redeemed_device_id = device_id
        return PairedDeviceView(
            device_id=device_id,
            device_token=device_token,
            device_label=body.device_label,
            session_id=match.session_id,
        )

    def register(self, body: SubscriptionCreate, hash_value: HashFn) -> SubscriptionView:
        device = self.devices.get(body.device_id)
        if not device or device.revoked_at or not hmac.compare_digest(device.token_hash, hash_value(body.device_token)):
            raise ValueError("invalid device")
        existing = next(
            (
                item
                for item in self.subscriptions.values()
                if item.device_id == body.device_id and item.endpoint == str(body.endpoint)
            ),
            None,
        )
        if existing:
            existing.p256dh, existing.auth, existing.active = body.p256dh, body.auth, True
            return SubscriptionView(subscription_id=existing.id, device_id=existing.device_id, active=True)
        subscription = Subscription(secrets.token_urlsafe(18), body.device_id, str(body.endpoint), body.p256dh, body.auth)
        self.subscriptions[subscription.id] = subscription
        return SubscriptionView(subscription_id=subscription.id, device_id=subscription.device_id, active=True)

    def revoke(self, subscription_id: str, device_token: str, hash_value: HashFn) -> None:
        subscription = self.subscriptions.get(subscription_id)
        device = self.devices.get(subscription.device_id) if subscription else None
        if not subscription or not device or not hmac.compare_digest(device.token_hash, hash_value(device_token)):
            raise ValueError("subscription not found")
        subscription.active = False

    def active_subscriptions(self, session_id: str) -> list[Subscription]:
        return [
            item
            for item in self.subscriptions.values()
            if item.active and self.devices[item.device_id].session_id == session_id
        ]

    def outcome_exists(self, public_id: str, subscription_id: str) -> bool:
        return (public_id, subscription_id) in self.outcomes

    def record_outcome(
        self,
        public_id: str,
        subscription_id: str,
        status: str,
        provider_category: str,
    ) -> bool:
        key = (public_id, subscription_id)
        if key in self.outcomes:
            return False
        self.outcomes.add(key)
        return True

    def deactivate_subscription(self, subscription_id: str) -> None:
        subscription = self.subscriptions.get(subscription_id)
        if subscription:
            subscription.active = False


class PostgresCrossDeviceStore:
    def __init__(self, database_url: str):
        import psycopg

        self.db = psycopg.connect(database_url)

    def close(self) -> None:
        self.db.close()

    def cleanup(self) -> None:
        with self.db.transaction():
            self.db.execute(
                "DELETE FROM pairing_challenges WHERE expires_at <= now() OR redeemed_at IS NOT NULL"
            )

    def save_challenge(self, challenge: Challenge) -> None:
        with self.db.transaction():
            self.db.execute(
                """INSERT INTO pairing_challenges
                   (id, session_id, code_hash, token_hash, expires_at, attempts)
                   VALUES (%s, %s::uuid, %s, %s, %s, 0)""",
                (challenge.id, challenge.session_id, challenge.code_hash, challenge.token_hash, challenge.expires_at),
            )

    def redeem(self, body: PairingRedeem, hash_value: HashFn) -> PairedDeviceView:
        if body.code:
            column, lookup_hash = "code_hash", hash_value(body.code)
        else:
            column, lookup_hash = "token_hash", hash_value(body.redemption_token or "")
        with self.db.transaction():
            row = self.db.execute(
                f"""SELECT id, session_id::text, attempts, expires_at, redeemed_at
                   FROM pairing_challenges
                   WHERE {column} = %s
                   FOR UPDATE""",
                (lookup_hash,),
            ).fetchone()
            if not row:
                raise ValueError("pairing not found")
            challenge_id, session_id, attempts, expires_at, redeemed_at = row
            if redeemed_at is not None:
                raise ValueError("pairing already redeemed")
            if expires_at <= datetime.now(timezone.utc):
                raise ValueError("pairing expired")
            attempts += 1
            if attempts > 5:
                self.db.execute(
                    "UPDATE pairing_challenges SET attempts = %s WHERE id = %s",
                    (attempts, challenge_id),
                )
                raise ValueError("pairing attempt limit exceeded")
            device_id = secrets.token_urlsafe(18)
            device_token = secrets.token_urlsafe(32)
            self.db.execute(
                """INSERT INTO paired_devices (id, session_id, token_hash, label)
                   VALUES (%s, %s::uuid, %s, %s)""",
                (device_id, session_id, hash_value(device_token), body.device_label),
            )
            self.db.execute(
                """UPDATE pairing_challenges
                   SET attempts = %s, redeemed_at = now()
                   WHERE id = %s""",
                (attempts, challenge_id),
            )
        return PairedDeviceView(
            device_id=device_id,
            device_token=device_token,
            device_label=body.device_label,
            session_id=session_id,
        )

    def register(self, body: SubscriptionCreate, hash_value: HashFn) -> SubscriptionView:
        with self.db.transaction():
            device = self.db.execute(
                """SELECT id, token_hash, revoked_at
                   FROM paired_devices
                   WHERE id = %s""",
                (body.device_id,),
            ).fetchone()
            if not device or device[2] or not hmac.compare_digest(device[1], hash_value(body.device_token)):
                raise ValueError("invalid device")
            existing = self.db.execute(
                """SELECT id::text FROM push_subscriptions
                   WHERE device_ref = %s AND endpoint = %s""",
                (body.device_id, str(body.endpoint)),
            ).fetchone()
            if existing:
                subscription_id = existing[0]
                self.db.execute(
                    """UPDATE push_subscriptions
                       SET p256dh = %s, auth_secret = %s, active = true, updated_at = now()
                       WHERE id = %s::uuid""",
                    (body.p256dh, body.auth, subscription_id),
                )
                return SubscriptionView(subscription_id=subscription_id, device_id=body.device_id, active=True)
            subscription_id = str(uuid4())
            self.db.execute(
                """INSERT INTO push_subscriptions
                   (id, device_id, endpoint, device_ref, p256dh, auth_secret, active)
                   VALUES (%s::uuid, %s, %s, %s, %s, %s, true)""",
                (subscription_id, body.device_id, str(body.endpoint), body.device_id, body.p256dh, body.auth),
            )
            return SubscriptionView(subscription_id=subscription_id, device_id=body.device_id, active=True)

    def revoke(self, subscription_id: str, device_token: str, hash_value: HashFn) -> None:
        with self.db.transaction():
            row = self.db.execute(
                """SELECT ps.id
                   FROM push_subscriptions ps
                   JOIN paired_devices pd ON pd.id = ps.device_ref
                   WHERE ps.id = %s::uuid AND pd.token_hash = %s AND ps.active = true""",
                (subscription_id, hash_value(device_token)),
            ).fetchone()
            if not row:
                raise ValueError("subscription not found")
            self.db.execute(
                "UPDATE push_subscriptions SET active = false, updated_at = now() WHERE id = %s::uuid",
                (subscription_id,),
            )

    def active_subscriptions(self, session_id: str) -> list[Subscription]:
        rows = self.db.execute(
            """SELECT ps.id::text, ps.device_ref, ps.endpoint, ps.p256dh, ps.auth_secret, ps.active
               FROM push_subscriptions ps
               JOIN paired_devices pd ON pd.id = ps.device_ref
               WHERE pd.session_id = %s::uuid AND ps.active = true AND pd.revoked_at IS NULL""",
            (session_id,),
        ).fetchall()
        return [
            Subscription(row[0], row[1], row[2], row[3], row[4], row[5])
            for row in rows
        ]

    def outcome_exists(self, public_id: str, subscription_id: str) -> bool:
        row = self.db.execute(
            """SELECT 1 FROM notification_outcomes no
               JOIN claims c ON c.id = no.claim_id
               WHERE c.public_id = %s AND no.subscription_id = %s::uuid""",
            (public_id, subscription_id),
        ).fetchone()
        return row is not None

    def record_outcome(
        self,
        public_id: str,
        subscription_id: str,
        status: str,
        provider_category: str,
    ) -> bool:
        with self.db.transaction():
            claim = self.db.execute(
                "SELECT id FROM claims WHERE public_id = %s",
                (public_id,),
            ).fetchone()
            if not claim:
                return False
            row = self.db.execute(
                """INSERT INTO notification_outcomes
                   (claim_id, subscription_id, status, attempt_count, attempted_at, provider_category)
                   VALUES (%s, %s::uuid, %s, 1, now(), %s)
                   ON CONFLICT DO NOTHING
                   RETURNING claim_id""",
                (claim[0], subscription_id, status, provider_category),
            ).fetchone()
            if row:
                self.db.execute(
                    """UPDATE notification_jobs
                       SET status = CASE WHEN %s = 'accepted' THEN 'sent' ELSE 'failed' END
                       WHERE claim_id = %s""",
                    (status, claim[0]),
                )
            return row is not None

    def deactivate_subscription(self, subscription_id: str) -> None:
        with self.db.transaction():
            self.db.execute(
                "UPDATE push_subscriptions SET active = false, updated_at = now() WHERE id = %s::uuid",
                (subscription_id,),
            )


class CrossDeviceStore(Protocol):
    def cleanup(self) -> None: ...
    def save_challenge(self, challenge: Challenge) -> None: ...
    def redeem(self, body: PairingRedeem, hash_value: HashFn) -> PairedDeviceView: ...
    def register(self, body: SubscriptionCreate, hash_value: HashFn) -> SubscriptionView: ...
    def revoke(self, subscription_id: str, device_token: str, hash_value: HashFn) -> None: ...
    def active_subscriptions(self, session_id: str) -> list[Subscription]: ...
    def outcome_exists(self, public_id: str, subscription_id: str) -> bool: ...
    def record_outcome(
        self, public_id: str, subscription_id: str, status: str, provider_category: str
    ) -> bool: ...
    def deactivate_subscription(self, subscription_id: str) -> None: ...
