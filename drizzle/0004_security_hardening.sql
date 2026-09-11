-- Run this once in Neon's SQL Editor, after 0003_agent_visibility.sql.
-- Part of the security/production-hardening pass: documents move from a
-- public R2 URL to a private object key (served only via signed,
-- permission-checked download links), and companies get the same
-- per-agent assignment column as contacts/properties/deals.

ALTER TABLE documents RENAME COLUMN file_url TO object_key;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_size_bytes INTEGER;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS content_type TEXT;

ALTER TABLE companies ADD COLUMN IF NOT EXISTS assigned_to_user_id TEXT REFERENCES users(id);

-- Existing document rows (if any) currently hold a full public R2 URL in
-- what's now object_key. Since the bucket is about to be made private,
-- those old public links will stop working regardless — this just strips
-- the URL down to the trailing key path so the column is at least
-- structurally correct going forward. Re-upload anything important that
-- was stored before this migration.
UPDATE documents
SET object_key = regexp_replace(object_key, '^https?://[^/]+/', '')
WHERE object_key LIKE 'http%';
