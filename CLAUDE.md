# CLAUDE.md

## Commands

```bash
npm run dev           # Start dev server (localhost:3000)
npm run build         # Production build + type-check
npm run lint          # ESLint
npx prisma db push    # Push schema to Supabase (never migrate dev)
npx prisma generate   # Regenerate client after schema changes
npm run db:seed       # Seed super-admin only
npm run db:seed:demo  # Full demo dataset (org, building, 30 units, 12 accounts)
npm run db:seed:wipe  # Wipe demo data only
```

**Demo accounts (`Demo1234!`):** `manager@demo.com`, `reception@demo.com`, `owner1-5@demo.com`, `tenant1-5@demo.com`

---

## Stack

- **Next.js 16** App Router — portals at `/manager/*`, `/resident/*`, `/super-admin/*`, `/(auth)/*`
- **Supabase** Auth (cookie-based via `@supabase/ssr`) + Postgres
- **Prisma 7** — import from `@/generated/prisma/client`, NOT `@prisma/client`; uses `PrismaPg` adapter
- **tRPC v11** — routers in `src/server/trpc/routers/`; context: `{ db, supabase, supabaseUser, user }`
- **TanStack Query v5** — server state; **Zustand v5** — UI state; use `skipToken` for conditional queries
- **Tailwind v4** — no config file; theme in `src/app/globals.css` via `@theme inline {}`
- **`@base-ui/react` v1.3.0** — headless UI; uses `render={}` prop, NOT `asChild`
- **shadcn** components in `src/components/ui/`; no Checkbox — use `<input type="checkbox">`

---

## Auth & Roles

Every layout: `supabase.auth.getUser()` → `db.user.findUnique({ supabaseAuthId })` → role check → redirect.

| Procedure | Allowed roles |
|---|---|
| `superAdminProcedure` | SUPER_ADMIN |
| `buildingManagerProcedure` | SUPER_ADMIN, BUILDING_MANAGER |
| `managerProcedure` | SUPER_ADMIN, BUILDING_MANAGER, RECEPTION |
| `tenantOrAboveProcedure` | All roles |

**Never trust a caller-supplied `buildingId` — always resolve from the accessed record.**  
`supabaseAuthId` is nullable — invited-but-not-activated users have no Supabase Auth ID.

---

## Key Patterns

- **RSC pages** only do prefetch + `HydrationBoundary`; all hooks/mutations live in `_client.tsx`
- **`createServerTRPC`** returns `{ trpc, HydrateClient, ctx, caller }` — use `caller` for dependent queries




- **Lazy dialogs** — heavy dialogs in `_<name>-dialog.tsx`, imported via `dynamic(..., { ssr: false })`
- **Sidebar conditional nav** — runtime-gated items rendered separately with explicit query guard
- **`resident.getMyTenancy`** — returns `null` for non-tenants, never throws
- **Select `onValueChange`** — needs null guard: `(v) => v !== null && setState(v)`
- **Rent schedules** — ONLY via `buildRentScheduleEntries` in `src/server/lib/rent-schedule.ts` (52 wk / 26 fn / 12 mo per year); never re-implement per router
- **One action, one page** — Record Payment lives on `/manager/rent` only; tenancy detail is read-only history + Generate Schedule; cross-link instead of duplicating
- **Sidebar gating** — resident sidebar uses `resident.getMyAccess` ({hasOwnership, hasTenancy}); levies nav label is role-aware ("My Levies" vs "My Bills")

---

## Completed Branches (1–20)

Auth → Manager dashboard/residents/units → Maintenance → Levies/docs/announcements/parcels/visitors/keys → Messaging/notifications/financials/analytics/strata → Common areas/bookings → Resident settings → Resident maintenance detail → Manager notifications → Real-time messages/avatar upload → Stripe levy payments → Custom billing → Performance/SSR/skeletons → Resident rent view → Manager maintenance detail → Tenancy management → Inspections → Owner financial dashboard → Tenant Stripe rent payments → Invite workflow overhaul + rent schedule fixes

---

