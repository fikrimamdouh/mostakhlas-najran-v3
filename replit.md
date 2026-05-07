# نظام إدارة المستخلصات

## Overview

Full-stack Arabic RTL construction extracts management system with Clerk authentication, PostgreSQL database, and email notifications via Resend. Built for تجمع نجران الصحي — وحدة الصيانة العامة.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Auth**: Clerk (Replit-managed)
- **Email**: Resend (via Replit connector)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite, Tailwind v4, Wouter, RTL Arabic

## Architecture

- `artifacts/api-server` — Express API server with Clerk auth
- `artifacts/mustaklassat` — React+Vite frontend, full Arabic RTL UI
- `lib/api-spec/openapi.yaml` — OpenAPI contract (source of truth)
- `lib/api-client-react` — Generated React Query hooks
- `lib/api-zod` — Generated Zod schemas
- `lib/db` — Drizzle ORM schema + DB connection

## Database Tables

- `users` — clerkId, email, name, role (admin/supervisor/user), status (pending/approved/rejected), phone, hospital, jobTitle, contractNumber, lastLoginAt
- `projects` — name, description, location, contractValue, startDate, endDate, status
- `extracts` — extractNumber, projectId, status, amount, description, submittedBy, approvedBy

## Key Features

- Landing page with video background (`/original/pattern-1.mp4`)
- New user profile completion form (phone, hospital, jobTitle, contractNumber) shown before sync
- User registration → admin notified by email → approval → user notified
- Dashboard shows full user info (phone, hospital, jobTitle, contractNumber, last login)
- مذكرة دعم (support ticket) page at `/support`
- Roles: admin / supervisor / user — supervisor can view audit log + users read-only
- PendingPage and RejectedPage both have sign-out buttons
- `/original/index.html` redirects to `/dashboard`
- Admin email: `rorofikri@gmail.com` (hardcoded in email.ts + support.ts)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks/Zod schemas
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev)
- `pnpm --filter @workspace/db run push-force` — push without confirmation prompt

## User Flow

1. Clerk sign-up → ProfileCompletionForm (phone/hospital/jobTitle/contractNumber)
2. POST `/api/users/sync` with all fields → status=pending
3. Welcome email → admin notification email (rorofikri@gmail.com)
4. Admin approves at `/admin/users` → approval email sent
5. Approved user sees full dashboard + all modules

## Admin Setup

```sql
UPDATE users SET role = 'admin', status = 'approved' WHERE email = 'your@email.com';
```
