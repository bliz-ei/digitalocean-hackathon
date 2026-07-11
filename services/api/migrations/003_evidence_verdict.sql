ALTER TABLE evidence ADD COLUMN IF NOT EXISTS query_role text NOT NULL DEFAULT 'neutral';
ALTER TABLE evidence ADD COLUMN IF NOT EXISTS independent_key text NOT NULL DEFAULT 'legacy';
ALTER TABLE evidence ADD COLUMN IF NOT EXISTS captured_text text NOT NULL DEFAULT '';

CREATE TABLE notification_jobs (
  claim_id uuid PRIMARY KEY REFERENCES claims(id),
  public_id text UNIQUE NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
