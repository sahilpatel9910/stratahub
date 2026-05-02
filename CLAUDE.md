# CLAUDE.md

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

Next.js 16 App Router with portals behind `src/app/(dashboard)/`:

- **`/manager/*`** — Building managers, reception, strata owners. Full admin capabilities.
- **`/resident/*`** — Owners and tenants. Read-heavy portal with maintenance, levies, documents, settings.
- **`/super-admin/*`** — Platform admins. Manages organisations and buildings.
- **`/(auth)/*`** — Login, register, forgot/reset password, invite acceptance.

Root `page.tsx` redirects users to the correct portal based on their role.

### Auth Flow

1. Supabase Auth (cookie-based via `@supabase/ssr`) handles sessions.
2. `src/lib/supabase/server.ts` — server-side Supabase client.
3. `/api/auth/callback` — exchanges code for session; `type=recovery` → `/reset-password`.
4. Every layout: `supabase.auth.getUser()` → `db.user.findUnique({ where: { supabaseAuthId } })` → role check → redirect if unauthorized.

### tRPC

- Context in `src/server/trpc/trpc.ts`: `{ db, supabase, supabaseUser, user }`.
- Routers in `src/server/trpc/routers/`, combined in `src/server/trpc/router.ts`.
- Client: `src/lib/trpc/client.ts` + `src/lib/trpc/provider.tsx`.
- Serializer: superjson (handles Dates automatically).

**Procedure guards:**

| Procedure | Roles allowed |
|---|---|
| `publicProcedure` | Anyone |
| `protectedProcedure` | Any authenticated user |
| `superAdminProcedure` | SUPER_ADMIN |
| `managerProcedure` | SUPER_ADMIN, BUILDING_MANAGER, RECEPTION |
| `buildingManagerProcedure` | SUPER_ADMIN, BUILDING_MANAGER |
| `ownerProcedure` | SUPER_ADMIN, BUILDING_MANAGER, OWNER |
| `tenantOrAboveProcedure` | All roles incl. OWNER and TENANT |

Role checking uses both `orgMemberships.role` and `buildingAssignments.role`.

**Building auth gotcha:** Never trust a caller-supplied `buildingId`. Always resolve from the record being accessed.

### Prisma 7

- Import from `@/generated/prisma/client` — **not** `@prisma/client`.
- Uses `PrismaPg` adapter (`@prisma/adapter-pg`).
- Use `prisma db push` not `migrate dev` (Supabase managed Postgres).
- Pool: max 2 connections, 10s idle timeout.

### UI Components

- **`@base-ui/react`** (v1.3.0) — headless. Uses `render={}` prop, **not** `asChild`:
  ```tsx
  <Dialog.Close render={<Button variant="outline" />}>Close</Dialog.Close>
  ```
- **`shadcn`** wraps into `src/components/ui/`. No `Checkbox` component — use styled `<input type="checkbox">`.
- **`lucide-react`** icons, **`sonner`** toasts, **`recharts`** charts.
- Select `onValueChange` needs null guard: `(v) => v !== null && setState(v)`.

### Tailwind v4

- No `tailwind.config.ts` — config in `src/app/globals.css` via `@theme inline {}`.
- Colors use oklch CSS variables. Dark mode: `@custom-variant dark (&:is(.dark *))`.

### State Management

- **TanStack Query v5** — all server state via tRPC hooks.
- **Zustand v5** — client-side UI state (selected building, modals, filters).
- Use `skipToken` from `@tanstack/react-query` for conditional queries.

---

## Completed Branches

- ✅ **Branch 1** — Auth foundation (login, register, Supabase callback, invite flow)
- ✅ **Branch 2** — Manager dashboard + residents + units
- ✅ **Branch 3** — Maintenance requests (manager + resident submit)
- ✅ **Branch 4** — Levies, documents, announcements, parcels, visitors, keys
- ✅ **Branch 5** — Messaging, notifications, financials, analytics, strata
- ✅ **Branch 6** — Common areas + booking system
- ✅ **Branch 7** — Resident settings + maintenance comment form; avatar → settings
- ✅ **Branch 8** — Resident maintenance detail (`/resident/maintenance/[id]`): timeline, photos, comments; label maps → `src/lib/constants.ts`
- ✅ **Branch 9** — Manager notifications centre: filter pills, cursor pagination, mark read, unread badge
- ✅ **Branch 10** — Real-time messages, avatar upload to Supabase Storage, notification preference toggles
- ✅ **Branch 11** — Stripe levy payments (Checkout test mode, webhook → PAID, Resend receipt)
- ✅ **Branch 12** — Custom billing: ad-hoc bills, ONLINE/MANUAL payment, in-app + email notification, manager Custom Bills tab, resident Pay Now / pay at reception
- ✅ **Branch 13** — Performance & SSR: `loading.tsx` skeletons, server prefetch + `HydrationBoundary` on 5 pages, Recharts lazy-loaded, heavy dialogs lazy-loaded
- ✅ **Branch 14** — Resident rent view (`/resident/rent`): lease summary, payment schedule; "My Rent" nav shown only for active tenants
- ✅ **Branch 15** — Manager maintenance detail (`/manager/maintenance/[id]`): full-page view, comments, contractor assign, timeline, photo upload/delete
- ✅ **Branch 16** — Tenancy management: `tenancy` router, Create/Edit dialogs, Tenancies tab on `/manager/rent`, `/manager/tenancies/[id]` detail + Record Payment
- ✅ **Branch 17** — Inspections: Prisma models (Inspection, Room, Item, Image), `inspection` router, `/manager/inspections` list + `[id]` editor, `/resident/inspections` read-only
- ✅ **Branch 18** — Owner Financial Dashboard: `owner.getFinancialSummary` tRPC query (`tenantOrAboveProcedure`), Financial Summary tab on `/resident/levies` (owners only), stat cards + transaction table + CSV export
- ✅ **Branch 19** — Tenant rent payments via Stripe: `stripeSessionId` on `RentPayment`, `rent.createPaymentSession` tRPC mutation (tenant-gated), Stripe webhook handles rent case, "Next Payment Due" action banner + Pay Now buttons on `/resident/rent`, receipt email via Resend
- ✅ **Branch 20** — Invite workflow overhaul + rent schedule fixes:
  - Invite flow: manager provides first name + last name + email + role (no unit). User row + BuildingAssignment + OrgMembership created immediately at invite time. Residents page shows them with amber "Invited" badge (`isActivated: !!supabaseAuthId`). Unit assignment stays separate.
  - `supabaseAuthId` is now `String?` (nullable). Invite accept links it to the pre-created row.
  - `assignResident` (Units page) now generates RentPayment schedule for TENANT assignments — same as `tenancy.create` router. Both paths are now identical.
  - Tenancy detail page: "Generate Schedule" button shown when `rentPayments.length === 0`; empty state row in table.
  - Units page display: tenant shown over owner when active tenancy exists.
  - Seed: tenancies now seeded with 12-month RentPayment schedules.

---

## Patterns & Gotchas

**RSC prefetch: `caller` vs `trpc`** — `trpc` from `createHydrationHelpers` only exposes `.prefetch()`. When query B depends on query A, call A via `caller` directly:
```ts
const tenancy = await caller.resident.getMyTenancy();
await Promise.all([
  trpc.resident.getMyTenancy.prefetch(),
  tenancy ? trpc.rent.listByTenancy.prefetch({ tenancyId: tenancy.id }) : Promise.resolve(),
]);
```
`createServerTRPC` returns `{ trpc, HydrateClient, ctx, caller }`.

**`_client.tsx` convention** — RSC pages only do prefetch + `HydrationBoundary`; all hooks/mutations live in the `_client.tsx` sibling.

**Lazy dialog pattern** — heavy dialogs extracted to `_<name>-dialog.tsx`, imported with `dynamic(..., { ssr: false })`. Create dialogs own their trigger + open state; edit dialogs are controlled (`open`/`onOpenChange`) and sync form fields from prop via `useEffect`.

**Sidebar conditional nav** — items gated on runtime data must NOT go in the static nav array. Render separately with an explicit query guard (e.g. "My Rent" checks `resident.getMyTenancy`).

**`resident.getMyTenancy` returns `null` for non-tenants** — never throws. Uses `tenantOrAboveProcedure` (no tenant-only guard exists).

**`RentPayment.amountCents` is overwritten on PARTIAL payments** — no `originalAmountCents`. Summing PARTIAL rows gives amount paid, not amount owed.

**`NEXT_STATUSES` transition map is duplicated** in `manager/maintenance/_client.tsx` and `manager/maintenance/[id]/_client.tsx`. Update both if transitions change.

**Cache invalidation gap in maintenance** — detail page `updateStatusMutation` only invalidates `getById`; list page version only invalidates `listByBuilding` + `getStats`. Both should invalidate all three.

**`assignInput` useEffect clobbers mid-edit text** — syncs from `req.assignedTo` on every refetch, overwriting in-progress input. Fix with a `hasInitialized` ref.

**Two-step photo upload** (`/api/storage/maintenance-upload-url` → PUT → `addImage` tRPC): failed upload leaves Add Photo disabled until user manually cancels (`confirmUpload` catch block doesn't call `cancelPendingFile`).

**`owner.getFinancialSummary` uses `tenantOrAboveProcedure`** — not `ownerProcedure`, because it's called on `/resident/levies` which tenants also access. Returns `{ hasOwnerships: false }` for non-owners; tab is hidden when `hasOwnerships` is false.

**`supabaseAuthId` is nullable** — pre-created users (invited but not activated) have no Supabase Auth ID. Never assume it's always set. Auth context (`getUser`) will not find them until they activate. The invite accept route finds the pre-created row by email and links the ID.

**Invite workflow (Branch 20)** — Invitation no longer carries a `unitId`. Manager invites → user created immediately → shown on Residents page. Unit assignment (Units page → Assign) is the only place tenancy/ownership is created. `assignResident` generates the RentPayment schedule; do not create a tenancy without also generating the schedule.

**Units page: tenant display priority** — `unit.tenancies[0]` shown over `unit.ownerships[0]` in the Resident column. A unit can simultaneously have an ownership AND an active tenancy — always prioritise the tenant in occupancy-facing UI.
