ALTER TABLE notification_outcomes DROP COLUMN provider_category, DROP COLUMN attempted_at, DROP COLUMN attempt_count;
ALTER TABLE push_subscriptions DROP COLUMN updated_at, DROP COLUMN active, DROP COLUMN auth_secret, DROP COLUMN p256dh, DROP COLUMN device_ref;
DROP TABLE paired_devices;
DROP TABLE pairing_challenges;
