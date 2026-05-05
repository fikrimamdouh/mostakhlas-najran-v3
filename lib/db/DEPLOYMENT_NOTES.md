# DB deployment notes (users.role)

## Production migration
Run the SQL migration below once on production DB:

- `lib/db/migrations/0001_users_role_company.sql`

Example (psql):

```bash
psql "$DATABASE_URL" -f lib/db/migrations/0001_users_role_company.sql
```

## What it does
- normalizes unknown/legacy roles to `company`
- sets `users.role` default to `company`
- enforces allowed roles via CHECK constraint:
  - `admin`
  - `company`
  - `user`
  - `supervisor`

## Notes
- Existing admin users remain unchanged.
- New non-admin users should be created as:
  - `role = company`
  - `status = pending`
