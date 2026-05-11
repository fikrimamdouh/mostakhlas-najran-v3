-- ============================================================
-- Production DB Migration Script — نظام المستخلصات
-- Run this on the production database to fix 500 errors
-- Safe to run multiple times (uses IF NOT EXISTS / IF NOT EXISTS)
-- ============================================================

-- ─── 1. users table — add any missing columns ───────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS allowed_modules text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_page text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_page_at timestamp;
ALTER TABLE users ADD COLUMN IF NOT EXISTS contract_company text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS supervised_hospital text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS hospitals text;

-- ─── 2. submitted_extracts ──────────────────────────────────
CREATE TABLE IF NOT EXISTS submitted_extracts (
  id               serial PRIMARY KEY,
  user_id          integer NOT NULL REFERENCES users(id),
  extract_type     text NOT NULL,
  company_name     text,
  contract_number  text,
  hospital_name    text,
  period_month     text,
  total_amount     numeric(18,2),
  status           text NOT NULL DEFAULT 'submitted',
  notes            text,
  admin_notes      text,
  approved_by      text,
  approved_at      timestamp,
  created_at       timestamp NOT NULL DEFAULT now(),
  updated_at       timestamp NOT NULL DEFAULT now(),
  revision_count   integer NOT NULL DEFAULT 0,
  revised_at       timestamp,
  extract_data     text
);

-- ─── 3. extract_revisions ───────────────────────────────────
CREATE TABLE IF NOT EXISTS extract_revisions (
  id               serial PRIMARY KEY,
  extract_id       integer NOT NULL REFERENCES submitted_extracts(id),
  changed_by       text NOT NULL,
  changed_by_role  text,
  previous_status  text,
  new_status       text,
  notes            text,
  created_at       timestamp NOT NULL DEFAULT now()
);

-- ─── 4. audit_log ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id          serial PRIMARY KEY,
  user_id     integer REFERENCES users(id),
  user_email  text,
  user_name   text,
  action      text NOT NULL,
  details     text,
  ip_address  text,
  created_at  timestamp NOT NULL DEFAULT now()
);

-- ─── 5. user_storage ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_storage (
  id             serial PRIMARY KEY,
  user_id        integer NOT NULL REFERENCES users(id),
  storage_key    text NOT NULL,
  storage_value  text NOT NULL,
  updated_at     timestamp NOT NULL DEFAULT now(),
  UNIQUE(user_id, storage_key)
);

-- ─── 6. hospital_storage ────────────────────────────────────
CREATE TABLE IF NOT EXISTS hospital_storage (
  id                  serial PRIMARY KEY,
  hospital_name       text NOT NULL,
  storage_key         text NOT NULL,
  storage_value       text NOT NULL,
  updated_at          timestamp NOT NULL DEFAULT now(),
  updated_by_user_id  integer REFERENCES users(id),
  UNIQUE(hospital_name, storage_key)
);

-- ─── 7. scheduled_backups ───────────────────────────────────
CREATE TABLE IF NOT EXISTS scheduled_backups (
  id           serial PRIMARY KEY,
  created_at   timestamp NOT NULL DEFAULT now(),
  triggered_by text NOT NULL DEFAULT 'scheduler',
  counts       json,
  backup_json  text NOT NULL,
  email_sent   boolean NOT NULL DEFAULT false
);

-- ─── 8. system_settings ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS system_settings (
  id          serial PRIMARY KEY,
  key         text NOT NULL,
  value       text NOT NULL,
  updated_at  timestamp NOT NULL DEFAULT now(),
  updated_by  text,
  UNIQUE(key)
);

-- ─── 9. visit_requests ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS visit_requests (
  id                    serial PRIMARY KEY,
  user_id               integer NOT NULL REFERENCES users(id),
  rep_name              text NOT NULL,
  site_location         text NOT NULL,
  rep_id                text NOT NULL,
  visit_date            date NOT NULL,
  rep_mobile            text NOT NULL,
  system_name           text NOT NULL,
  main_contractor       text NOT NULL,
  sub_contractor        text NOT NULL,
  rep_id_photo          text,
  status                text NOT NULL DEFAULT 'pending',
  admin_notes           text,
  submitted_by_name     text,
  submitted_by_hospital text,
  created_at            timestamp NOT NULL DEFAULT now(),
  updated_at            timestamp NOT NULL DEFAULT now()
);

-- ─── Done ───────────────────────────────────────────────────
SELECT 'Migration complete ✓' AS result;
