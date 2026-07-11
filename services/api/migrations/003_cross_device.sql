CREATE TABLE pairing_challenges (
  id text PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES sessions(id),
  code_hash text NOT NULL,
  token_hash text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  redeemed_at timestamptz,
  redeemed_device_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX pairing_challenges_expiry_idx ON pairing_challenges(expires_at);

CREATE TABLE paired_devices (
  id text PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES sessions(id),
  token_hash text NOT NULL,
  label text NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE push_subscriptions
  ADD COLUMN device_ref text REFERENCES paired_devices(id),
  ADD COLUMN p256dh text,
  ADD COLUMN auth_secret text,
  ADD COLUMN active boolean NOT NULL DEFAULT true,
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE notification_outcomes
  ADD COLUMN attempt_count integer NOT NULL DEFAULT 0,
  ADD COLUMN attempted_at timestamptz,
  ADD COLUMN provider_category text;
