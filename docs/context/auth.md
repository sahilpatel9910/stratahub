# StrataHub — Auth Flow

## Two user records

- **Supabase `auth.users`** — managed by Supabase Auth. UUID is `supabaseUser.id`
- **Prisma `users` table** — application record. Links via `User.supabaseAuthId`

The Prisma user is created inside `POST /api/invite/accept` — it reads `authUser.user_metadata` (first_name, last_name set at signup) to populate the record.

## Invite-only registration flow

1. Super-admin creates an invite via `users.createInvite` → Resend fires invite email
2. User visits `/invite/[token]` — sees invite details
3. **Not yet registered:** clicks "Create Invited Account" → `/register?invite=token`
   - `register-form.tsx` signs up via `supabase.auth.signUp`
   - If `session` returned immediately (no email verification): calls `POST /api/invite/accept` → creates Prisma user + memberships → redirect `/`
   - If email verification required (session null): redirect to `/invite/[token]?created=1` (shows "check your email" message)
   - After clicking email link → `/api/auth/callback?next=/invite/token` → redirect to invite page → user clicks "Accept Invite" → `POST /api/invite/accept`
4. **Already registered:** clicks "Sign In & Accept" → login → redirect to `/invite/[token]` → Accept button → `POST /api/invite/accept`

## Login flow

`supabase.auth.signInWithPassword()` → middleware refreshes session via cookies → redirect to `/` → `app/page.tsx` handles role-based redirect.

## Root redirect logic (`src/app/page.tsx`)

1. No Supabase session → `/login`
2. No Prisma user → check for pending invite → `/invite/[token]` or `/access-required`
3. User has no active memberships → check for pending invite → `/invite/[token]` or role-based path
4. Has roles → `getDefaultDashboardPath(roles)`:
   - SUPER_ADMIN → `/super-admin/organisations`
   - BUILDING_MANAGER / RECEPTION → `/manager`
   - OWNER / TENANT → `/resident`
   - No roles → `/access-required`

## tRPC context (every API call)

```ts
// src/server/trpc/trpc.ts — createTRPCContext()
supabase.auth.getUser()                    // verify session server-side
db.user.findUnique({ supabaseAuthId })     // fetch Prisma user + active memberships
// returns { db, supabase, supabaseUser, user }
// user = null if no Supabase session or no Prisma record
```

## Middleware route protection (`src/lib/supabase/middleware.ts`)

**Public (no auth required):**
- `/`, `/login`, `/forgot-password`
- `/api/webhooks/**`
- `/invite/**`
- `/access-required`

**Protected:** everything else → unauthenticated users redirected to `/login?redirect=<path>`

**Auth pages** (`/login`): authenticated users redirected to `/manager`

## Password reset flow

1. `/forgot-password` → `supabase.auth.resetPasswordForEmail({ redirectTo: '/api/auth/callback?type=recovery' })`
2. User clicks email link → `/api/auth/callback?type=recovery` → exchanges PKCE code → redirect to `/reset-password`
3. `/reset-password` → `supabase.auth.updateUser({ password })` → redirect to `/manager`
