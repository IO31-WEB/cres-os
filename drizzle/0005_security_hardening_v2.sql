-- Run this once in Neon's SQL Editor, after 0004_security_hardening.sql.
-- Part of the full security-hardening pass (race conditions, IDOR,
-- database integrity, pending-upload tracking, audit log). Every
-- statement is written to be safe to re-run.

-- ─── helper: idempotent ADD CONSTRAINT ─────────────────────────────────
-- Postgres has no `ADD CONSTRAINT IF NOT EXISTS`, so CHECK constraints
-- below go through this guard instead of failing on a second run.
CREATE OR REPLACE FUNCTION _add_constraint_if_missing(p_table text, p_constraint text, p_definition text)
RETURNS void AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = p_constraint
  ) THEN
    EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I %s', p_table, p_constraint, p_definition);
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ─── 1. First-owner race condition ──────────────────────────────────────
-- At most one row can ever have role = 'owner', enforced by Postgres
-- itself (a partial unique index), not by application-level "check then
-- insert" logic that can race across concurrent/serverless instances.
-- See lib/user-provisioning.ts for the insert-and-retry logic this backs.
SELECT _add_constraint_if_missing('users', 'users_role_check', $$CHECK (role in ('owner', 'agent'))$$);

CREATE UNIQUE INDEX IF NOT EXISTS users_single_owner_idx ON users (role) WHERE role = 'owner';

-- If more than one owner already exists in this database (shouldn't
-- happen, but this migration would fail to apply the index above if it
-- does) — surface it instead of silently skipping:
DO $$
DECLARE owner_count integer;
BEGIN
  SELECT count(*) INTO owner_count FROM users WHERE role = 'owner';
  IF owner_count > 1 THEN
    RAISE EXCEPTION 'Found % existing owner rows — resolve manually before this migration can add the single-owner constraint (demote all but one to agent).', owner_count;
  END IF;
END $$;

-- ─── 2. Enum-style CHECK constraints (defense in depth below app validation) ───
SELECT _add_constraint_if_missing('contacts', 'contacts_contact_type_check',
  $$CHECK (contact_type in ('business_buyer','business_seller','tenant','landlord','property_buyer','property_seller','past_client','other'))$$);
SELECT _add_constraint_if_missing('contacts', 'contacts_lead_score_check',
  $$CHECK (lead_score in ('hot','warm','nurture','unqualified'))$$);
SELECT _add_constraint_if_missing('contacts', 'contacts_source_check',
  $$CHECK (source in ('website','email','facebook','whatsapp','bizbuysell','manual','referral'))$$);
SELECT _add_constraint_if_missing('contacts', 'contacts_preferred_language_check',
  $$CHECK (preferred_language in ('en','es'))$$);

SELECT _add_constraint_if_missing('properties', 'properties_property_type_check',
  $$CHECK (property_type in ('retail','office','industrial','land','multifamily','business','mixed_use'))$$);
SELECT _add_constraint_if_missing('properties', 'properties_listing_status_check',
  $$CHECK (listing_status in ('off_market','active','under_contract','sold','leased','withdrawn'))$$);

SELECT _add_constraint_if_missing('listings', 'listings_listing_type_check',
  $$CHECK (listing_type in ('sale','lease','business_sale'))$$);
SELECT _add_constraint_if_missing('listings', 'listings_status_check',
  $$CHECK (status in ('active','pending','sold','leased','withdrawn','expired'))$$);

SELECT _add_constraint_if_missing('deals', 'deals_pipeline_check',
  $$CHECK (pipeline in ('business_brokerage','tenant_rep','landlord_rep','seller_rep','buyer_rep'))$$);
SELECT _add_constraint_if_missing('deals', 'deals_status_check',
  $$CHECK (status in ('open','won','lost'))$$);
SELECT _add_constraint_if_missing('deals', 'deals_nda_status_check',
  $$CHECK (nda_status in ('nda_required','nda_sent','nda_signed','not_applicable'))$$);

SELECT _add_constraint_if_missing('documents', 'documents_type_check',
  $$CHECK (type in ('nda','loi','psa','lease','financials','other'))$$);
SELECT _add_constraint_if_missing('documents', 'documents_status_check',
  $$CHECK (status in ('draft','sent','viewed','signed','expired'))$$);

SELECT _add_constraint_if_missing('tasks', 'tasks_priority_check',
  $$CHECK (priority in ('low','medium','high'))$$);

SELECT _add_constraint_if_missing('communications', 'communications_channel_check',
  $$CHECK (channel in ('email','sms','whatsapp','facebook','manual','call'))$$);
SELECT _add_constraint_if_missing('communications', 'communications_direction_check',
  $$CHECK (direction in ('inbound','outbound'))$$);

SELECT _add_constraint_if_missing('lead_intakes', 'lead_intakes_status_check',
  $$CHECK (status in ('new','processing','converted','discarded'))$$);

SELECT _add_constraint_if_missing('commissions', 'commissions_status_check',
  $$CHECK (status in ('expected','invoiced','overdue','collected'))$$);

-- ─── 3. FK cascade/orphan behavior ──────────────────────────────────────
-- "who did this" references: preserve the record, drop the attribution,
-- rather than blocking (or cascading away) real business records when a
-- Clerk user is deleted. This also fixes a real bug — the user.deleted
-- webhook handler calls a bare DELETE FROM users, which previously had no
-- ON DELETE behavior at all (implicit NO ACTION) and would simply fail
-- with an FK-violation error for any user who'd ever touched a record.
ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_assigned_to_user_id_fkey;
ALTER TABLE companies ADD CONSTRAINT companies_assigned_to_user_id_fkey FOREIGN KEY (assigned_to_user_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_created_by_user_id_fkey;
ALTER TABLE companies ADD CONSTRAINT companies_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_assigned_to_user_id_fkey;
ALTER TABLE contacts ADD CONSTRAINT contacts_assigned_to_user_id_fkey FOREIGN KEY (assigned_to_user_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_company_id_fkey;
ALTER TABLE contacts ADD CONSTRAINT contacts_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL;

ALTER TABLE properties DROP CONSTRAINT IF EXISTS properties_assigned_to_user_id_fkey;
ALTER TABLE properties ADD CONSTRAINT properties_assigned_to_user_id_fkey FOREIGN KEY (assigned_to_user_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE properties DROP CONSTRAINT IF EXISTS properties_created_by_user_id_fkey;
ALTER TABLE properties ADD CONSTRAINT properties_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE properties DROP CONSTRAINT IF EXISTS properties_owner_contact_id_fkey;
ALTER TABLE properties ADD CONSTRAINT properties_owner_contact_id_fkey FOREIGN KEY (owner_contact_id) REFERENCES contacts(id) ON DELETE SET NULL;

ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_property_id_fkey;
ALTER TABLE listings ADD CONSTRAINT listings_property_id_fkey FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE;
ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_created_by_user_id_fkey;
ALTER TABLE listings ADD CONSTRAINT listings_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE deals DROP CONSTRAINT IF EXISTS deals_contact_id_fkey;
ALTER TABLE deals ADD CONSTRAINT deals_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL;
ALTER TABLE deals DROP CONSTRAINT IF EXISTS deals_company_id_fkey;
ALTER TABLE deals ADD CONSTRAINT deals_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL;
ALTER TABLE deals DROP CONSTRAINT IF EXISTS deals_property_id_fkey;
ALTER TABLE deals ADD CONSTRAINT deals_property_id_fkey FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE SET NULL;
ALTER TABLE deals DROP CONSTRAINT IF EXISTS deals_listing_id_fkey;
ALTER TABLE deals ADD CONSTRAINT deals_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE SET NULL;
ALTER TABLE deals DROP CONSTRAINT IF EXISTS deals_assigned_to_user_id_fkey;
ALTER TABLE deals ADD CONSTRAINT deals_assigned_to_user_id_fkey FOREIGN KEY (assigned_to_user_id) REFERENCES users(id) ON DELETE SET NULL;

-- deal_collaborators: a membership row is meaningless without either side.
ALTER TABLE deal_collaborators DROP CONSTRAINT IF EXISTS deal_collaborators_deal_id_fkey;
ALTER TABLE deal_collaborators ADD CONSTRAINT deal_collaborators_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE;
ALTER TABLE deal_collaborators DROP CONSTRAINT IF EXISTS deal_collaborators_user_id_fkey;
ALTER TABLE deal_collaborators ADD CONSTRAINT deal_collaborators_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE deal_collaborators DROP CONSTRAINT IF EXISTS deal_collaborators_added_by_user_id_fkey;
ALTER TABLE deal_collaborators ADD CONSTRAINT deal_collaborators_added_by_user_id_fkey FOREIGN KEY (added_by_user_id) REFERENCES users(id) ON DELETE SET NULL;

-- documents: unlink rather than delete or block — the row (and its R2
-- object) stays; deleteDocument() is the only path that removes either.
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_deal_id_fkey;
ALTER TABLE documents ADD CONSTRAINT documents_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE SET NULL;
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_contact_id_fkey;
ALTER TABLE documents ADD CONSTRAINT documents_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL;
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_property_id_fkey;
ALTER TABLE documents ADD CONSTRAINT documents_property_id_fkey FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE SET NULL;
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_uploaded_by_user_id_fkey;
ALTER TABLE documents ADD CONSTRAINT documents_uploaded_by_user_id_fkey FOREIGN KEY (uploaded_by_user_id) REFERENCES users(id) ON DELETE SET NULL;

-- tasks & notes: activity tied to a record has no meaning once that
-- record is gone, so these cascade (unlike documents above).
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_deal_id_fkey;
ALTER TABLE tasks ADD CONSTRAINT tasks_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE;
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_contact_id_fkey;
ALTER TABLE tasks ADD CONSTRAINT tasks_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE;
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_property_id_fkey;
ALTER TABLE tasks ADD CONSTRAINT tasks_property_id_fkey FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE;
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_assigned_to_user_id_fkey;
ALTER TABLE tasks ADD CONSTRAINT tasks_assigned_to_user_id_fkey FOREIGN KEY (assigned_to_user_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE notes DROP CONSTRAINT IF EXISTS notes_deal_id_fkey;
ALTER TABLE notes ADD CONSTRAINT notes_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE;
ALTER TABLE notes DROP CONSTRAINT IF EXISTS notes_contact_id_fkey;
ALTER TABLE notes ADD CONSTRAINT notes_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE;
ALTER TABLE notes DROP CONSTRAINT IF EXISTS notes_property_id_fkey;
ALTER TABLE notes ADD CONSTRAINT notes_property_id_fkey FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE;
ALTER TABLE notes DROP CONSTRAINT IF EXISTS notes_author_user_id_fkey;
ALTER TABLE notes ADD CONSTRAINT notes_author_user_id_fkey FOREIGN KEY (author_user_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE communications DROP CONSTRAINT IF EXISTS communications_contact_id_fkey;
ALTER TABLE communications ADD CONSTRAINT communications_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE;
ALTER TABLE communications DROP CONSTRAINT IF EXISTS communications_deal_id_fkey;
ALTER TABLE communications ADD CONSTRAINT communications_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE;

ALTER TABLE lead_intakes DROP CONSTRAINT IF EXISTS lead_intakes_deduped_contact_id_fkey;
ALTER TABLE lead_intakes ADD CONSTRAINT lead_intakes_deduped_contact_id_fkey FOREIGN KEY (deduped_contact_id) REFERENCES contacts(id) ON DELETE SET NULL;

-- commissions: deliberately left as-is (RESTRICT / NO ACTION) — a
-- financial record shouldn't silently disappear because a deal was
-- deleted. deleteDeal() now checks for this and returns a friendly error
-- instead of letting the raw FK-violation surface to the client.

ALTER TABLE scorecard_analyses DROP CONSTRAINT IF EXISTS scorecard_analyses_property_id_fkey;
ALTER TABLE scorecard_analyses ADD CONSTRAINT scorecard_analyses_property_id_fkey FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE SET NULL;
ALTER TABLE scorecard_analyses DROP CONSTRAINT IF EXISTS scorecard_analyses_deal_id_fkey;
ALTER TABLE scorecard_analyses ADD CONSTRAINT scorecard_analyses_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE SET NULL;
ALTER TABLE scorecard_analyses DROP CONSTRAINT IF EXISTS scorecard_analyses_created_by_user_id_fkey;
ALTER TABLE scorecard_analyses ADD CONSTRAINT scorecard_analyses_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL;

-- daily_priorities is a disposable, cron-regenerated cache — cascade
-- everything so it never holds a dangling reference.
ALTER TABLE daily_priorities DROP CONSTRAINT IF EXISTS daily_priorities_for_user_id_fkey;
ALTER TABLE daily_priorities ADD CONSTRAINT daily_priorities_for_user_id_fkey FOREIGN KEY (for_user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE daily_priorities DROP CONSTRAINT IF EXISTS daily_priorities_contact_id_fkey;
ALTER TABLE daily_priorities ADD CONSTRAINT daily_priorities_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE;
ALTER TABLE daily_priorities DROP CONSTRAINT IF EXISTS daily_priorities_deal_id_fkey;
ALTER TABLE daily_priorities ADD CONSTRAINT daily_priorities_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE;
ALTER TABLE daily_priorities DROP CONSTRAINT IF EXISTS daily_priorities_document_id_fkey;
ALTER TABLE daily_priorities ADD CONSTRAINT daily_priorities_document_id_fkey FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE;
ALTER TABLE daily_priorities DROP CONSTRAINT IF EXISTS daily_priorities_commission_id_fkey;
ALTER TABLE daily_priorities ADD CONSTRAINT daily_priorities_commission_id_fkey FOREIGN KEY (commission_id) REFERENCES commissions(id) ON DELETE CASCADE;

-- ─── 4. Rate limiting — atomic upsert needs a real unique constraint ────
-- Collapse any pre-existing duplicate (ip, day) rows first (the old
-- select-then-write logic could produce them under a race), keeping the
-- highest count, before the unique index can be created.
DO $$
BEGIN
  IF EXISTS (
    SELECT ip, day FROM rate_limits GROUP BY ip, day HAVING count(*) > 1
  ) THEN
    DELETE FROM rate_limits a USING rate_limits b
    WHERE a.ip = b.ip AND a.day = b.day
      AND (a.count < b.count OR (a.count = b.count AND a.id < b.id));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS rate_limits_ip_day_idx ON rate_limits (ip, day);

-- ─── 5. documents.object_key must be unique ─────────────────────────────
-- Belt-and-suspenders alongside the pending_uploads table below: two
-- document rows should never be able to point at the same R2 object.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'documents_object_key_unique') THEN
    ALTER TABLE documents ADD CONSTRAINT documents_object_key_unique UNIQUE (object_key);
  END IF;
END $$;

-- ─── 6. Pending uploads ──────────────────────────────────────────────────
-- Bridges "server issued a presigned PUT URL" and "client says they
-- uploaded something" so createDocumentRecord never has to trust a bare
-- client-supplied object key / content type / file name.
CREATE TABLE IF NOT EXISTS pending_uploads (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  object_key TEXT NOT NULL UNIQUE,
  declared_file_name TEXT NOT NULL,
  declared_content_type TEXT NOT NULL,
  declared_size_bytes INTEGER NOT NULL,
  deal_id INTEGER REFERENCES deals(id) ON DELETE CASCADE,
  contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
  property_id INTEGER REFERENCES properties(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMP NOT NULL,
  finalized_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT pending_uploads_status_check CHECK (status in ('pending','finalized','expired'))
);
CREATE INDEX IF NOT EXISTS pending_uploads_user_idx ON pending_uploads (user_id);

-- ─── 7. Audit log ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  actor_label TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_logs_entity_idx ON audit_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS audit_logs_user_idx ON audit_logs (user_id);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs (created_at);

DROP FUNCTION IF EXISTS _add_constraint_if_missing(text, text, text);
