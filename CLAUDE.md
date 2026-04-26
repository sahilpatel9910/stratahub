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

**Notification gotcha:** Always create notifications via `createNotification()` in `src/server/trpc/lib/create-notification.ts` — never `db.notification.createMany` directly. The helper checks `NotificationPreference` first; bypassing it silently ignores user opt-outs.

**Stripe webhook gotcha:** `/api/stripe/` must remain in `isPublicAuthPath()` (`src/lib/auth/redirects.ts`). The auth middleware 307-redirects unauthenticated POSTs, which breaks webhook delivery silently (Stripe retries, all fail).

**Stripe checkout gotcha:** Both `strata.createCheckoutSession` and `customBills.createCheckoutSession` reuse an existing `open` Stripe session if `stripeSessionId` is already set on the record. Don't remove this check — without it, double-clicking Pay Now overwrites the session ID and the webhook can't find the record.

**Custom bill access gotcha:** `customBills.create` uses `assertBuildingOperationsAccess` (not Management) so RECEPTION staff can raise bills. The procedure guard is `managerProcedure` but the building-level check must also allow RECEPTION.

**Email gotcha:** `sendCustomBillEmail` is the creation notice (new bill raised). `sendCustomBillReceiptEmail` is the payment confirmation. They are different functions — the webhook must call the receipt one, not the creation one.

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

## ⬜ Next Priorities
