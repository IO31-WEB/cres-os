-- Run this once in Neon's SQL Editor (console.neon.tech -> your project ->
-- SQL Editor) to build out CRES Solutions OS from the standalone scorecard
-- tool. Safe to re-run — every statement is idempotent.
--
-- Order matters: users first (everything references it), then the entities
-- with no FK dependencies, then the ones that reference each other, and
-- finally the `reports` -> `scorecard_analyses` rename at the end so the
-- existing scorecard tool keeps working right up until this runs.

-- ─── users ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  image_url TEXT,
  role TEXT NOT NULL DEFAULT 'agent',
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

-- ─── companies ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS companies (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  industry TEXT,
  website TEXT,
  phone TEXT,
  address TEXT,
  notes TEXT,
  created_by_user_id TEXT REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

-- ─── contacts ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contacts (
  id SERIAL PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  whatsapp TEXT,
  preferred_language TEXT NOT NULL DEFAULT 'en',
  company_id INTEGER REFERENCES companies(id),
  contact_type TEXT NOT NULL DEFAULT 'other',
  lead_score TEXT NOT NULL DEFAULT 'nurture',
  lead_score_reason TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  assigned_to_user_id TEXT REFERENCES users(id),
  tags JSONB NOT NULL DEFAULT '[]',
  last_contacted_at TIMESTAMP,
  anniversary_date TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS contacts_email_idx ON contacts (email);
CREATE INDEX IF NOT EXISTS contacts_phone_idx ON contacts (phone);
CREATE INDEX IF NOT EXISTS contacts_lead_score_idx ON contacts (lead_score);

-- ─── properties ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS properties (
  id SERIAL PRIMARY KEY,
  address TEXT NOT NULL,
  formatted_address TEXT NOT NULL,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  county TEXT,
  property_type TEXT NOT NULL DEFAULT 'retail',
  default_business_profile TEXT NOT NULL DEFAULT 'general',
  owner_contact_id INTEGER REFERENCES contacts(id),
  listing_status TEXT NOT NULL DEFAULT 'off_market',
  sqft INTEGER,
  notes TEXT,
  created_by_user_id TEXT REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS properties_location_idx ON properties (lat, lng);

-- ─── listings ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS listings (
  id SERIAL PRIMARY KEY,
  property_id INTEGER NOT NULL REFERENCES properties(id),
  listing_type TEXT NOT NULL,
  asking_price DOUBLE PRECISION,
  price_per_sqft DOUBLE PRECISION,
  status TEXT NOT NULL DEFAULT 'active',
  exclusivity_notes TEXT,
  listed_at TIMESTAMP NOT NULL DEFAULT now(),
  expires_at TIMESTAMP,
  created_by_user_id TEXT REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

-- ─── deals ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS deals (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  pipeline TEXT NOT NULL,
  stage TEXT NOT NULL,
  contact_id INTEGER REFERENCES contacts(id),
  company_id INTEGER REFERENCES companies(id),
  property_id INTEGER REFERENCES properties(id),
  listing_id INTEGER REFERENCES listings(id),
  value DOUBLE PRECISION,
  probability INTEGER,
  nda_status TEXT NOT NULL DEFAULT 'not_applicable',
  expected_close_date TIMESTAMP,
  assigned_to_user_id TEXT REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'open',
  lost_reason TEXT,
  last_activity_at TIMESTAMP NOT NULL DEFAULT now(),
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS deals_pipeline_stage_idx ON deals (pipeline, stage);
CREATE INDEX IF NOT EXISTS deals_status_idx ON deals (status);
CREATE INDEX IF NOT EXISTS deals_last_activity_idx ON deals (last_activity_at);

-- ─── documents ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documents (
  id SERIAL PRIMARY KEY,
  deal_id INTEGER REFERENCES deals(id),
  contact_id INTEGER REFERENCES contacts(id),
  property_id INTEGER REFERENCES properties(id),
  type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  requested_at TIMESTAMP,
  sent_at TIMESTAMP,
  signed_at TIMESTAMP,
  uploaded_by_user_id TEXT REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

-- ─── tasks ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  deal_id INTEGER REFERENCES deals(id),
  contact_id INTEGER REFERENCES contacts(id),
  property_id INTEGER REFERENCES properties(id),
  priority TEXT NOT NULL DEFAULT 'medium',
  assigned_to_user_id TEXT REFERENCES users(id),
  due_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tasks_due_at_idx ON tasks (due_at);

-- ─── notes ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notes (
  id SERIAL PRIMARY KEY,
  content TEXT NOT NULL,
  deal_id INTEGER REFERENCES deals(id),
  contact_id INTEGER REFERENCES contacts(id),
  property_id INTEGER REFERENCES properties(id),
  author_user_id TEXT REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

-- ─── communications ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS communications (
  id SERIAL PRIMARY KEY,
  contact_id INTEGER REFERENCES contacts(id),
  deal_id INTEGER REFERENCES deals(id),
  channel TEXT NOT NULL,
  direction TEXT NOT NULL,
  body TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'en',
  ai_summary TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS communications_contact_idx ON communications (contact_id);

-- ─── lead_intakes ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lead_intakes (
  id SERIAL PRIMARY KEY,
  source TEXT NOT NULL,
  raw_payload JSONB NOT NULL,
  deduped_contact_id INTEGER REFERENCES contacts(id),
  status TEXT NOT NULL DEFAULT 'new',
  ai_classification JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

-- ─── commissions ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS commissions (
  id SERIAL PRIMARY KEY,
  deal_id INTEGER NOT NULL REFERENCES deals(id),
  expected_amount DOUBLE PRECISION NOT NULL,
  invoiced_amount DOUBLE PRECISION,
  collected_amount DOUBLE PRECISION,
  split_details JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'expected',
  due_date TIMESTAMP,
  invoiced_at TIMESTAMP,
  collected_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

-- ─── daily_priorities ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS daily_priorities (
  id SERIAL PRIMARY KEY,
  for_user_id TEXT NOT NULL REFERENCES users(id),
  day TEXT NOT NULL,
  category TEXT NOT NULL,
  reason TEXT NOT NULL,
  contact_id INTEGER REFERENCES contacts(id),
  deal_id INTEGER REFERENCES deals(id),
  document_id INTEGER REFERENCES documents(id),
  commission_id INTEGER REFERENCES commissions(id),
  draft_message TEXT,
  dismissed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS daily_priorities_user_day_category_idx
  ON daily_priorities (for_user_id, day, category, contact_id, deal_id);

-- ─── reports -> scorecard_analyses ──────────────────────────────────────
-- Renames the existing table in place (keeps every past analysis) and adds
-- the three new linkage/attribution columns. If `reports` doesn't exist
-- (fresh database) this block is skipped and scorecard_analyses is created
-- fresh instead.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'reports')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'scorecard_analyses') THEN
    ALTER TABLE reports RENAME TO scorecard_analyses;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS scorecard_analyses (
  id SERIAL PRIMARY KEY,
  property_id INTEGER REFERENCES properties(id),
  deal_id INTEGER REFERENCES deals(id),
  input_address TEXT NOT NULL,
  formatted_address TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  lat_rounded DOUBLE PRECISION NOT NULL,
  lng_rounded DOUBLE PRECISION NOT NULL,
  county TEXT,
  state_fips TEXT,
  county_fips TEXT,
  tract_fips TEXT,
  business_profile TEXT NOT NULL DEFAULT 'general',
  overall_score DOUBLE PRECISION NOT NULL,
  overall_grade TEXT NOT NULL,
  category_scores JSONB NOT NULL,
  raw_data JSONB NOT NULL,
  narrative JSONB,
  created_by_user_id TEXT REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  expires_at TIMESTAMP NOT NULL
);

ALTER TABLE scorecard_analyses ADD COLUMN IF NOT EXISTS property_id INTEGER REFERENCES properties(id);
ALTER TABLE scorecard_analyses ADD COLUMN IF NOT EXISTS deal_id INTEGER REFERENCES deals(id);
ALTER TABLE scorecard_analyses ADD COLUMN IF NOT EXISTS created_by_user_id TEXT REFERENCES users(id);

DROP INDEX IF EXISTS reports_location_idx;
CREATE INDEX IF NOT EXISTS scorecard_location_idx
  ON scorecard_analyses (lat_rounded, lng_rounded, business_profile);
CREATE INDEX IF NOT EXISTS scorecard_property_idx ON scorecard_analyses (property_id);
