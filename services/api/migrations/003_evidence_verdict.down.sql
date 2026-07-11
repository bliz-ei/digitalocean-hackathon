DROP TABLE IF EXISTS notification_jobs;
ALTER TABLE evidence DROP COLUMN IF EXISTS captured_text;
ALTER TABLE evidence DROP COLUMN IF EXISTS independent_key;
ALTER TABLE evidence DROP COLUMN IF EXISTS query_role;
