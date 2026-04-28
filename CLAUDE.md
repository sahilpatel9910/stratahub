# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Commands

```bash
npm run dev           # Start dev server (localhost:3000)
npm run build         # Production build (also type-checks)
npm run lint          # ESLint
npm run test          # Run tests (tsx --test)
npm run db:seed       # Seed super-admin only (prisma/seed.ts)
npm run db:seed:demo  # Seed full demo dataset — org, building, 30 units, 12 accounts (seed/demo.ts)
npm run db:seed:wipe  # Wipe demo data only, leaves super-admin intact (seed/wipe.ts)
npx prisma db push    # Push schema changes to DB (no migrate dev — Prisma 7 + Supabase)
npx prisma generate   # Regenerate Prisma client after schema changes
```

**Demo accounts (password: `Demo1234!`):** `manager@demo.com`, `reception@demo.com`, `owner1-5@demo.com`, `tenant1-5@demo.com`

---

## Architecture

### App Structure

Next.js 16 App Router with two portals behind `src/app/(dashboard)/`:

- **`/manager/*`** — Building managers, reception, strata owners. Full admin capabilities.
- **`/resident/*`** — Owners and tenants. Read-heavy portal with maintenance, levies, documents, settings.
- **`/super-admin/*`** — Platform admins. Manages organisations and buildings.
- **`/(auth)/*`** — Login, register, forgot/reset password, invite acceptance.

Root `page.tsx` redirects users to the correct portal based on their role.

### Auth Flow

1. Supabase Auth (cookie-based via `@supabase/ssr`) handles sessions.
2. `src/lib/supabase/server.ts` — server-side Supabase client (used in layouts and API routes).
3. `/api/auth/callback` — exchanges Supabase code for session; handles email verification and password recovery (`type=recovery` → `/reset-password`).
4. Every layout does: `supabase.auth.getUser()` → `db.user.findUnique({ where: { supabaseAuthId } })` → role check → redirect if unauthorized.

### tRPC

- Context built in `src/server/trpc/trpc.ts`: provides `{ db, supabase, supabaseUser, user }`.
- All routers in `src/server/trpc/routers/`, combined in `src/server/trpc/router.ts`.
- Client: `src/lib/trpc/client.ts` + `src/lib/trpc/provider.tsx` (wraps app in `TRPCProvider` + `QueryClientProvider`).
- Serializer: superjson (handles Dates automatically).

**Procedure guards** — pick the tightest one that fits:

| Procedure | Roles allowed |
|---|---|
| `publicProcedure` | Anyone |
| `protectedProcedure` | Any authenticated user |
| `superAdminProcedure` | SUPER_ADMIN |
| `managerProcedure` | SUPER_ADMIN, BUILDING_MANAGER, RECEPTION |
| `buildingManagerProcedure` | SUPER_ADMIN, BUILDING_MANAGER |
| `ownerProcedure` | SUPER_ADMIN, BUILDING_MANAGER, OWNER |
| `tenantOrAboveProcedure` | All roles incl. OWNER and TENANT |

Role checking uses both `orgMemberships.role` and `buildingAssignments.role` — a user can satisfy the check via either.

**Building auth gotcha:** Never trust a caller-supplied `buildingId`. Always resolve the building from the record being accessed (e.g. look up the unit's buildingId, then check the caller has access to that building).

### Prisma 7

- Import from `@/generated/prisma/client` — **not** `@prisma/client`.
- Uses `PrismaPg` adapter (`@prisma/adapter-pg`) — native Postgres driver, no ORM connection overhead.
- Schema output: `prisma/schema.prisma` → `src/generated/prisma/`.
- Use `prisma db push` not `migrate dev` (Supabase managed Postgres).
- Pool: max 2 connections, 10s idle timeout (Vercel serverless + Supabase free tier constraints).

### UI Components

- **`@base-ui/react`** (v1.3.0) — headless unstyled components. Uses `render={}` prop, **not** `asChild`:
  ```tsx
  <Dialog.Close render={<Button variant="outline" />}>Close</Dialog.Close>
  ```
- **`shadcn`** wraps these into `src/components/ui/`.
- **`lucide-react`** for icons, **`sonner`** for toasts, **`recharts`** for charts.
- Select `onValueChange` needs a null guard: `(v) => v !== null && setState(v)`.

### Tailwind v4

- No `tailwind.config.ts` — config lives in `src/app/globals.css` via `@theme inline {}`.
- Colors use oklch color space as CSS variables.
- Dark mode: `@custom-variant dark (&:is(.dark *))`.

### State Management

- **TanStack Query v5** — all server state via tRPC hooks.
- **Zustand v5** — client-side UI state (selected building, modals, filters).
- Use `skipToken` from `@tanstack/react-query` for conditional tRPC queries.

---

## Completed Branches

- ✅ **Branch 1** — Auth foundation (login, register, Supabase callback, invite flow)
- ✅ **Branch 2** — Manager dashboard + residents + units
- ✅ **Branch 3** — Maintenance requests (manager + resident submit)
- ✅ **Branch 4** — Levies, documents, announcements, parcels, visitors, keys
- ✅ **Branch 5** — Messaging, notifications, financials, analytics, strata
- ✅ **Branch 6** — Common areas + booking system
- ✅ **Branch 7** — Resident settings page + maintenance comment form; avatar button → settings
- ✅ **Branch 8** — Resident maintenance detail page (`/resident/maintenance/[id]`) — status timeline, photos (two-step upload), comments thread; label maps consolidated into `src/lib/constants.ts`
- ✅ **Branch 9** — Manager notifications centre (`/manager/notifications`) — type filter pills, cursor pagination, mark read/all read, unread badge in sidebar
- ✅ **Branch 10** — Real-time messages (Supabase postgres_changes on messages table), avatar upload to Supabase Storage (manager settings), per-type notification preference toggles (DB-backed, both manager + resident settings pages)
- ✅ **Branch 11** — Stripe levy payments (Stripe Checkout test mode, webhook marks PAID, Resend receipt email, resident levies Pay Now button)
- ✅ **Branch 12** — Custom billing: managers/reception raise ad-hoc bills against individual owners or tenants; ONLINE (Stripe Checkout) or MANUAL payment mode; `CUSTOM_BILL_CREATED` in-app notification + Resend email on creation; manager Custom Bills tab on `/manager/strata` (5th tab) with filter pills, full table, Mark Overdue/Mark Paid/Delete actions; resident Custom Bills section on `/resident/levies` with Pay Now (online) or "Pay at reception" (manual); webhook extended to mark custom bills PAID.
- ✅ **Branch 13** — Performance & SSR sprint: `loading.tsx` skeletons for all 17+ routes; server-side prefetch via `createCallerFactory` + `HydrationBoundary` for 5 priority pages (manager dashboard, residents, maintenance, resident dashboard, resident levies); Recharts lazy-loaded with `next/dynamic`; Suspense boundaries on manager dashboard, resident dashboard, analytics; heavy dialogs extracted and lazy-loaded.
- ✅ **Branch 14** — Resident rent view (`/resident/rent`): tenant-only page showing lease summary, 3 stat cards, full payment schedule table; `resident.getMyTenancy` tRPC query; "My Rent" nav item conditionally shown in sidebar only for active tenants.
- ✅ **Branch 15** — Manager maintenance detail page (`/manager/maintenance/[id]`): replaces the read-only dialog with a full-page view; adds comment compose form, contractor assign (`maintenance.assign`), status timeline, two-step photo upload/delete; list rows now navigate instead of opening a dialog.

### Branch 13 — SSR/Performance patterns (non-obvious gotchas)

**RSC + tRPC prefetch pattern** (`src/lib/trpc/server.ts` exports `createServerTRPC`):
```ts
const { trpc, HydrateClient, ctx, caller } = await createServerTRPC();
await trpc.someRouter.someProc.prefetch({ ... });
return <HydrateClient><ClientComponent /></HydrateClient>;
```
- `ctx.user?.buildingAssignments` is how server pages resolve the default buildingId — only works when user has exactly 1 assignment; fall back to client fetch otherwise.
- Pages converted to RSC: `/manager`, `/manager/residents`, `/manager/maintenance`, `/resident`, `/resident/levies`, `/resident/rent`. Their interactive parts live in `_client.tsx` siblings.
- **`caller` vs `trpc` in RSC pages:** `trpc` from `createHydrationHelpers` only has `.prefetch()` — it does NOT have `.fetch()`. When query B depends on the result of query A (sequential dependency), use `caller` directly to get the data, then `prefetch` both into the cache. Example in `/resident/rent/page.tsx`:
  ```ts
  const tenancy = await caller.resident.getMyTenancy();      // direct call, returns data
  await Promise.all([
    trpc.resident.getMyTenancy.prefetch(),                   // populate cache for client
    tenancy ? trpc.rent.listByTenancy.prefetch({ tenancyId: tenancy.id }) : Promise.resolve(),
  ]);
  ```
  `createServerTRPC` now returns `{ trpc, HydrateClient, ctx, caller }` — use `caller` for dependent prefetches.

**Dynamic import pattern for dialogs** — dialogs with significant form content are extracted to `_<name>-dialog.tsx` siblings and imported with `dynamic(..., { ssr: false })` at module level in the parent. Current examples:
- `super-admin/buildings/page.tsx` → `_create-dialog.tsx`, `_edit-dialog.tsx`
- `manager/residents/_client.tsx` → `_invite-dialog.tsx`
- The create dialog owns its own trigger button and open state; edit/invite dialogs are controlled (receive `open`/`onOpenChange` props).
- Edit dialog syncs form fields from a `building` prop via `useEffect` — not pre-populated by the parent.

**`_client.tsx` convention** — pages that are RSC wrappers delegate all interactivity to a `_client.tsx` sibling. The RSC page only does prefetch + `HydrationBoundary`; the client file has `"use client"` and all hooks/mutations.

### Branch 14 — Resident rent view (non-obvious gotchas)

**`RentPayment.amountCents` is mutable for PARTIAL payments.** When `rent.recordPayment` is called with an amount less than scheduled, the row's `amountCents` is overwritten with the paid amount and status set to `PARTIAL`. There is no `originalAmountCents` field — the original scheduled amount is lost. Any UI summing `amountCents` for PARTIAL rows is summing what was actually paid, not what was owed. Do not assume `amountCents` always equals the scheduled rent amount.

**Sidebar conditional nav pattern.** `residentNavItems` is the static array mapped in `ResidentSidebar`. Items that are conditional on user data (role, tenancy, etc.) must NOT go in this array — they fall through the map unconditionally. Render them separately with an explicit query/condition guard. "My Rent" is rendered outside the map using `trpc.resident.getMyTenancy.useQuery()` — appears only when the result is truthy.

**`resident.getMyTenancy` returns null for non-tenants** — never throws. Owners, managers, and admins calling it get `null`. The page handles this with an explicit empty state. The procedure uses `tenantOrAboveProcedure` (tightest guard that includes TENANT) because no tenant-only guard exists.

## ⬜ Next Priorities
