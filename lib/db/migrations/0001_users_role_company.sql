-- Safe role migration for production (PostgreSQL)
-- Goal: ensure users.role supports at least admin/company without breaking old data.

BEGIN;

-- 1) If role column is text/varchar, normalize unexpected legacy values.
UPDATE users
SET role = 'company'
WHERE role IS NULL OR role NOT IN ('admin', 'company', 'user', 'supervisor');

-- 2) Ensure default for new non-admin users is company.
ALTER TABLE users
  ALTER COLUMN role SET DEFAULT 'company';

-- 3) Add/replace CHECK constraint to include company/admin and keep backward-compatible roles.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'company', 'user', 'supervisor'));

COMMIT;
