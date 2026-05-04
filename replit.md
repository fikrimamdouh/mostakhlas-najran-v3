# نظام إدارة المستخلصات

## Overview

Full-stack Arabic RTL construction extracts management system with Clerk authentication, PostgreSQL database, and email notifications via Resend.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Auth**: Clerk (Replit-managed)
- **Email**: Resend (via Replit connector)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite, Tailwind v4, Wouter, RTL Arabic

## Architecture

- `artifacts/api-server` — Express API server with Clerk auth, routes for users/projects/extracts/stats
- `artifacts/mustaklassat` — React+Vite frontend, full Arabic RTL UI
- `lib/api-spec/openapi.yaml` — OpenAPI contract (source of truth)
- `lib/api-client-react` — Generated React Query hooks
- `lib/api-zod` — Generated Zod schemas
- `lib/db` — Drizzle ORM schema and DB connection

## Database Tables

- `users` — clerkId, email, name, role (admin/user), status (pending/approved/rejected)
- `projects` — name, description, location, contractValue, startDate, endDate, status
- `extracts` — extractNumber, projectId, status (current/completed/previous), amount, description, submittedBy, approvedBy

## Key Features

- User registration → admin approval → email notification via Resend
- Full extracts management (current/completed/previous)
- Projects management
- Dashboard with statistics
- Admin user management panel

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

## User Flow

1. User registers via Clerk sign-up
2. App calls POST `/api/users/sync` to store user in DB with status=pending
3. Welcome email sent via Resend
4. Admin goes to `/admin/users` to approve/reject pending users
5. Approval email sent to user
6. Approved user can access dashboard, extracts, projects

## Admin Setup

To make a user admin, run SQL:
```sql
UPDATE users SET role = 'admin', status = 'approved' WHERE email = 'your@email.com';
```
