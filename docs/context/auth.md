# StrataHub — Auth Flow

## Two user records

- **Supabase `auth.users`** — managed by Supabase Auth. UUID is `supabaseUser.id`
- **Prisma `users` table** — application record. Links via `User.supabaseAuthId`

The Prisma user is created inside `POST /api/invite/accept` — it reads `authUser.user_metadata` (first_name, last_name set at signup) to populate the record.

## Invite-only registration flow

1. Super-admin creates an invite via `users.createInvite` → Resend fires invite email
   - Super-admin invites can now target `SUPER_ADMIN`, `BUILDING_MANAGER`, `RECEPTION`, `OWNER`, or `TENANT`.
   - `SUPER_ADMIN` invites stay organisation-scoped with no building or unit attached.
   - `OWNER` and `TENANT` invites must target a specific building + unit.
   - `Invitation.revokedAt` tracks revoked links; invites are no longer hard-deleted.
   - `users.resendInvite` creates a fresh invite row and revokes the still-pending original link before sending the replacement email.
2. User visits `/invite/[token]` — sees invite details
3. **Not yet registered:** clicks "Create Invited Account" → `/register?invite=token`
   - `register-form.tsx` signs up via `supabase.auth.signUp`
   - If `session` returned immediately (no email verification): calls `POST /api/invite/accept` → creates Prisma user + memberships → redirect `/`
   - If email verification required (session null): redirect to `/invite/[token]?created=1` (shows "check your email" message)
   - After clicking email link → `/api/auth/callback?next=/invite/token` → redirect to invite page → user clicks "Accept Invite" → `POST /api/invite/accept`
4. **Already registered:** clicks "Sign In & Accept" → login → redirect to `/invite/[token]` → Accept button → `POST /api/invite/accept`

## Unit-scoped resident invites

- Building managers can invite only `OWNER` or `TENANT`, only for their own selected building, and now only for a specific unit.
- Super-admins can also invite `OWNER` or `TENANT`, but those invites must also include the target unit.
- Owner invite acceptance creates / reactivates the ownership for that unit.
- Tenant invite acceptance creates an active tenancy placeholder for that unit with zeroed financial defaults; managers should review and update tenancy details afterward in Units or Rent.

## Login flow

`supabase.auth.signInWithPassword()` → middleware refreshes session via cookies → redirect to `/` → `app/page.tsx` handles role-based redirect.

## Root redirect logic (`src/app/page.tsx`)

1. No Supabase session → `/login`
2. No Prisma user → check for pending invite → `/invite/[token]` or `/access-required`
3. User has no active memberships → check for pending invite → `/invite/[token]` or role-based path
4. Has roles → `getDefaultDashboardPath(roles)`:
   - SUPER_ADMIN → `/super-admin/organisations`
   - BUILDING_MANAGER → `/manager`
   - RECEPTION → `/manager/visitors`
   - OWNER / TENANT → `/resident`
   - No roles → `/access-required`

`src/lib/auth/redirects.ts` now contains the pure redirect helpers used by both the root route and auth/proxy regression tests.

## Manager vs reception split

- `BUILDING_MANAGER` keeps building-administration access.
- `RECEPTION` is now an operations-only role.
- Reception can use only the operational manager pages: dashboard, visitors, parcels, keys, maintenance, messages, and settings.
- Reception is blocked from resident admin, unit management, rent, financials, strata admin, announcements publishing, document management, and resident invite workflows.
- Server-side auth now distinguishes building operations access from building management access; reception no longer passes `assertBuildingManagementAccess`.

## tRPC context (every API call)

```ts
// src/server/trpc/trpc.ts — createTRPCContext()
supabase.auth.getUser()                    // verify session server-side
db.user.findUnique({ supabaseAuthId })     // fetch Prisma user + active memberships
// returns { db, supabase, supabaseUser, user }
// user = null if no Supabase session or no Prisma record
```

## Proxy route protection (`src/lib/supabase/middleware.ts` + `src/proxy.ts`)

**Public (no auth required):**
- `/`, `/login`, `/register`, `/forgot-password`, `/reset-password`
- `/api/webhooks/**`
- `/invite/**`
- `/api/auth/**`

**Protected:** everything else → unauthenticated users redirected to `/login?redirect=<path>`

**Auth pages** (`/login`): authenticated users redirected to `/manager`

`/access-required` is intentionally protected. It only renders after a signed-in user reaches the root redirect path without an active Prisma assignment.

## Password reset flow

1. `/forgot-password` → `supabase.auth.resetPasswordForEmail({ redirectTo: '/api/auth/callback?type=recovery' })`
2. User clicks email link → `/api/auth/callback?type=recovery` → exchanges PKCE code → redirect to `/reset-password`
3. `/reset-password` → `supabase.auth.updateUser({ password })` → redirect to `/manager`
