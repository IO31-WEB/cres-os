-- Run this once in Neon's SQL Editor, after 0002_crm_core.sql.
-- Adds per-agent data visibility: an assignment column on properties
-- (contacts and deals already had one) and a deal_collaborators table for
-- sharing a specific deal with a helper agent.

ALTER TABLE properties ADD COLUMN IF NOT EXISTS assigned_to_user_id TEXT REFERENCES users(id);

CREATE TABLE IF NOT EXISTS deal_collaborators (
  id SERIAL PRIMARY KEY,
  deal_id INTEGER NOT NULL REFERENCES deals(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  added_by_user_id TEXT REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS deal_collaborators_deal_user_idx
  ON deal_collaborators (deal_id, user_id);

-- One-time backfill: any contact/property/deal already created before this
-- migration has no assignee, which under the new rule makes it visible to
-- owners only. Since Isaiah was the only user during initial testing, this
-- assigns everything untouched so far to the current owner — safe to skip
-- if you'd rather leave older test data unassigned and re-assign by hand.
-- UPDATE contacts SET assigned_to_user_id = (SELECT id FROM users WHERE role = 'owner' LIMIT 1) WHERE assigned_to_user_id IS NULL;
-- UPDATE properties SET assigned_to_user_id = (SELECT id FROM users WHERE role = 'owner' LIMIT 1) WHERE assigned_to_user_id IS NULL;
-- UPDATE deals SET assigned_to_user_id = (SELECT id FROM users WHERE role = 'owner' LIMIT 1) WHERE assigned_to_user_id IS NULL;
