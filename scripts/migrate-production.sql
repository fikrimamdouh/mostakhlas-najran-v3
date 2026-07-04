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

-- ============================================================
-- P0 Stability Migration — idempotency + explicit columns + storage versioning
-- Safe to run multiple times.
-- ============================================================

-- ─── A. submitted_extracts: أعمدة idempotency والأعمدة الصريحة ─────────────
ALTER TABLE submitted_extracts ADD COLUMN IF NOT EXISTS idempotency_key   text;
ALTER TABLE submitted_extracts ADD COLUMN IF NOT EXISTS admin_office_part text;
ALTER TABLE submitted_extracts ADD COLUMN IF NOT EXISTS source_module     text;
ALTER TABLE submitted_extracts ADD COLUMN IF NOT EXISTS review_scope      text;

-- ─── B. Backfill الأعمدة الصريحة من extract_data (best-effort, per-row) ─────
-- يتجاوز الصفوف ذات JSON التالف بدل إفشال الهجرة كاملة.
DO $$
DECLARE r RECORD; d jsonb; nested jsonb; part text; src text; scope text;
BEGIN
  FOR r IN SELECT id, extract_data FROM submitted_extracts
           WHERE extract_type = 'admin_offices' AND admin_office_part IS NULL AND extract_data IS NOT NULL
  LOOP
    BEGIN
      d := r.extract_data::jsonb;
      nested := CASE WHEN jsonb_typeof(d->'najran_admin_offices_submit_meta_v1') = 'string'
                     THEN (d->>'najran_admin_offices_submit_meta_v1')::jsonb
                     WHEN jsonb_typeof(d->'najran_admin_offices_submit_meta_v1') = 'object'
                     THEN d->'najran_admin_offices_submit_meta_v1'
                     ELSE '{}'::jsonb END;
      part := COALESCE(
        NULLIF(d->>'adminOfficePart',''), NULLIF(d->>'draftPart',''), NULLIF(d->>'submittedPart',''),
        NULLIF(nested->>'submittedPart',''), NULLIF(nested->>'savedPart',''),
        CASE WHEN d->>'adminOfficeConsumables' = 'true' THEN 'consumables' END,
        CASE WHEN d->>'adminOfficeLabor' = 'true' THEN 'labor' END,
        CASE d->>'reviewScope' WHEN 'admin_offices_consumables_only' THEN 'consumables' WHEN 'admin_offices_labor_only' THEN 'labor' END,
        CASE d->>'sourceModule' WHEN 'admin_offices_consumables' THEN 'consumables' WHEN 'admin_offices_attendance' THEN 'labor' END
      );
      part := CASE WHEN part IN ('consumables','labor') THEN part ELSE NULL END;
      src := COALESCE(NULLIF(d->>'sourceModule',''),
                      CASE part WHEN 'consumables' THEN 'admin_offices_consumables' WHEN 'labor' THEN 'admin_offices_attendance' END);
      scope := COALESCE(NULLIF(d->>'reviewScope',''),
                        CASE part WHEN 'consumables' THEN 'admin_offices_consumables_only' WHEN 'labor' THEN 'admin_offices_labor_only' END);
      UPDATE submitted_extracts SET admin_office_part = part, source_module = src, review_scope = scope WHERE id = r.id;
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'skip backfill for extract % (invalid JSON)', r.id;
    END;
  END LOOP;
END $$;

-- ─── C. unique index جزئي — لا يفشل على المكررات القديمة (NULL keys) ─────────
-- السجلات القديمة تبقى idempotency_key = NULL ولا تدخل في القيد.
-- كل رفع جديد يحصل على مفتاح ويُحمى بالقيد. لا حاجة لتنظيف مسبق.
CREATE UNIQUE INDEX IF NOT EXISTS submitted_extracts_idempotency_key
  ON submitted_extracts (idempotency_key);

-- (اختياري — تشغيل يدوي بعد مراجعة المكررات القديمة):
-- كشف المكررات التاريخية قبل أي backfill لمفاتيحها:
--   SELECT user_id, extract_type, hospital_name, period_month, count(*)
--   FROM submitted_extracts GROUP BY 1,2,3,4 HAVING count(*) > 1;

-- ─── D. hospital_storage: عمود version لكشف التعارض ─────────────────────────
ALTER TABLE hospital_storage ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
