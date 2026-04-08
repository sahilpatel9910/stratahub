@AGENTS.md

# StrataHub — Claude Code Context

## Project Overview

StrataHub is an Australian apartment/strata property management SaaS. It allows property managers to manage multiple buildings, track residents (owners & tenants), handle rent collection, maintenance requests, visitor logs, parcel tracking, keys/access, announcements, and strata financials.

**Target users:** Building managers, reception staff, property owners, tenants, and super-admins managing multiple organisations.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS v4 |
| UI Components | shadcn/ui (via `shadcn` CLI) |
| Auth | Supabase Auth (SSR via `@supabase/ssr`) |
| Database | PostgreSQL (hosted on Supabase) |
| ORM | Prisma 7 (`prisma-client` generator, output → `src/generated/prisma`) |
| API Layer | tRPC v11 + TanStack Query v5 |
| State Management | Zustand v5 (building context/switcher only) |
| Data Transformer | SuperJSON (tRPC serialisation) |
| Date Handling | date-fns v4 |
| Charts | Recharts v3 |
| Email | Resend |
| Toast | Sonner |
| Icons | Lucide React |
| Package Manager | npm |

### Critical: Prisma 7 Generator

The Prisma generator uses the new `prisma-client` provider (not the old `prisma-client-js`).

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}
```

All Prisma imports come from `@/generated/prisma`, NOT from `@prisma/client`.

```ts
import { PrismaClient } from "@/generated/prisma";
import type { UserRole } from "@/generated/prisma";
```

---

## Project Structure

```
strata-hub/
├── prisma/
│   └── schema.prisma           # Full data model — source of truth
├── src/
│   ├── app/
│   │   ├── (auth)/             # Public auth pages (no sidebar)
│   │   │   ├── layout.tsx      # Centered card layout
│   │   │   ├── login/page.tsx       ✅ wired to Supabase auth
│   │   │   ├── register/page.tsx    ✅ wired to Supabase auth
│   │   │   └── forgot-password/page.tsx ✅
│   │   ├── (dashboard)/        # Protected pages (sidebar + topbar)
│   │   │   ├── layout.tsx           ✅ async server component, fetches real buildings
│   │   │   ├── manager/
│   │   │   │   ├── page.tsx         ✅ wired to tRPC (getStats, maintenance, announcements)
│   │   │   │   ├── residents/page.tsx ✅ wired to tRPC
│   │   │   │   ├── units/page.tsx        ✅ wired to tRPC (list, create, occupancy tabs)
│   │   │   │   ├── rent/page.tsx         ✅ wired to tRPC (rent roll, payments, record payment)
│   │   │   │   ├── keys/            ❌ page not created
│   │   │   │   ├── maintenance/page.tsx  ✅ wired to tRPC (list, create, status transitions)
│   │   │   │   ├── visitors/        ❌ page not created
│   │   │   │   ├── parcels/         ❌ page not created
│   │   │   │   ├── announcements/   ❌ page not created
│   │   │   │   ├── documents/       ❌ page not created
│   │   │   │   ├── messages/        ❌ page not created
│   │   │   │   ├── strata/          ❌ page not created
│   │   │   │   ├── financials/      ❌ page not created
│   │   │   │   └── analytics/       ❌ page not created
│   │   │   └── super-admin/
│   │   │       ├── organisations/page.tsx ✅ wired to tRPC
│   │   │       ├── buildings/       ❌ page not created
│   │   │       └── users/           ❌ page not created
│   │   ├── api/trpc/[trpc]/route.ts # tRPC HTTP handler
│   │   ├── globals.css
│   │   ├── layout.tsx               # Root layout
│   │   └── page.tsx                 # Root → redirects to /manager
│   ├── components/
│   │   ├── layout/
│   │   │   ├── app-sidebar.tsx      # Role-aware sidebar nav
│   │   │   ├── building-switcher.tsx # Dropdown to pick active building
│   │   │   └── topbar.tsx           # Top bar with building switcher + search
│   │   └── ui/                      # Full shadcn/ui component set
│   ├── hooks/
│   │   ├── use-building-context.ts  # Zustand store: selectedBuildingId/Name
│   │   └── use-mobile.ts
│   ├── lib/
│   │   ├── constants.ts             # Labels, formatCurrency, state lists
│   │   ├── supabase/
│   │   │   ├── client.ts            # Browser Supabase client
│   │   │   ├── server.ts            # Server Supabase client (async, uses cookies)
│   │   │   └── middleware.ts        # Session refresh + route protection logic
│   │   └── trpc/
│   │       ├── client.ts            # `trpc = createTRPCReact<AppRouter>()`
│   │       └── provider.tsx         # TRPCProvider (QueryClient + httpBatchLink)
│   ├── middleware.ts                # Next.js middleware: calls updateSession
│   ├── server/
│   │   ├── db/client.ts            # Prisma singleton (global for dev HMR)
│   │   └── trpc/
│   │       ├── trpc.ts             # Context, middleware, procedure factories
│   │       ├── router.ts           # AppRouter — combines all sub-routers
│   │       └── routers/
│   │           ├── organisations.ts
│   │           ├── buildings.ts    # Includes getStats procedure
│   │           ├── units.ts
│   │           ├── residents.ts
│   │           ├── rent.ts
│   │           ├── keys.ts
│   │           ├── maintenance.ts
│   │           ├── visitors.ts
│   │           ├── parcels.ts
│   │           ├── announcements.ts
│   │           └── messaging.ts
│   └── types/
│       └── auth.ts                 # AuthUser, SessionContext types
└── generated/prisma/               # Prisma-generated client (never edit)
```

---

## Authentication Flow

1. **Middleware** (`src/middleware.ts`) runs on every request, calls `updateSession()` from `src/lib/supabase/middleware.ts`
2. `updateSession` refreshes the Supabase session via cookies, then:
   - Redirects unauthenticated users → `/login?redirect=<path>`
   - Redirects authenticated users away from `/login`, `/register` → `/manager`
3. **Login page** calls `supabase.auth.signInWithPassword()` directly (client-side Supabase)
4. **tRPC context** (`src/server/trpc/trpc.ts`): On each API call, calls `supabase.auth.getUser()` server-side, then looks up the Prisma `User` record via `supabaseAuthId`. Attaches `ctx.user`, `ctx.db`, `ctx.supabase`.
5. **Dashboard layout** (`src/app/(dashboard)/layout.tsx`): Async server component. Calls Supabase server client + Prisma directly to fetch the user's assigned buildings and passes them to the `Topbar`.

### Important: Two User Records

- **Supabase `auth.users`**: Managed by Supabase Auth. Has a UUID (`supabaseUser.id`).
- **Prisma `users` table**: Application user record. Links via `supabaseAuthId` field.

When a new user registers, a Prisma user record must be created (this flow is not yet fully implemented — the register page exists but doesn't create the Prisma record).

---

## Role System

Roles are defined in the `UserRole` enum:

```
SUPER_ADMIN → full access to all orgs/buildings
BUILDING_MANAGER → manages assigned buildings
RECEPTION → front desk ops (visitors, parcels, keys)
OWNER → unit owner self-service
TENANT → tenant self-service
```

Roles are stored in two places:
- `OrganisationMembership.role` — what role the user has within an org
- `BuildingAssignment.role` — what role the user has within a specific building

### tRPC Procedure Guards

| Procedure | Allowed roles |
|---|---|
| `publicProcedure` | Anyone |
| `protectedProcedure` | Any authenticated user with a Prisma record |
| `tenantOrAboveProcedure` | TENANT and above |
| `managerProcedure` | SUPER_ADMIN, BUILDING_MANAGER, RECEPTION |
| `ownerProcedure` | SUPER_ADMIN, BUILDING_MANAGER, OWNER |
| `superAdminProcedure` | SUPER_ADMIN only |

---

## Routing Structure

### Auth routes (no sidebar, centered card layout)
- `/login` — email/password login
- `/register` — registration
- `/forgot-password` — password reset request

### Manager routes (`/manager/**`) — sidebar shows "Property Management" nav
- `/manager` — dashboard (stats, recent maintenance, announcements)
- `/manager/residents` — residents table (owners + tenants)
- `/manager/units` — ❌ not built
- `/manager/rent` — ❌ not built
- `/manager/keys` — ❌ not built
- `/manager/maintenance` — ❌ not built
- `/manager/visitors` — ❌ not built
- `/manager/parcels` — ❌ not built
- `/manager/announcements` — ❌ not built
- `/manager/documents` — ❌ not built
- `/manager/messages` — ❌ not built
- `/manager/strata` — ❌ not built
- `/manager/financials` — ❌ not built
- `/manager/analytics` — ❌ not built

### Super-admin routes (`/super-admin/**`) — sidebar shows "Administration" nav + "Property Management" nav
- `/super-admin/organisations` — list/create/deactivate orgs
- `/super-admin/buildings` — ❌ not built
- `/super-admin/users` — ❌ not built

---

## Building Context (Zustand)

The building switcher in the topbar lets users select which building they're working in. The selected building is persisted to `localStorage` via Zustand `persist` middleware.

```ts
// src/hooks/use-building-context.ts
const { selectedBuildingId, selectedBuildingName, setSelectedBuilding } = useBuildingContext();
```

**All building-scoped tRPC queries use `skipToken`** when no building is selected:

```ts
import { skipToken } from "@tanstack/react-query";

const query = trpc.residents.listByBuilding.useQuery(
  selectedBuildingId ? { buildingId: selectedBuildingId } : skipToken
);
```

Pages should show a "select a building" prompt when `selectedBuildingId` is null.

---

## tRPC Router Reference

All routers are in `src/server/trpc/routers/`. The combined `AppRouter` is in `src/server/trpc/router.ts`.

### `organisations`
| Procedure | Type | Auth | Description |
|---|---|---|---|
| `list` | query | SUPER_ADMIN | All orgs with `_count.buildings` and `_count.members` |
| `getById` | query | protected | Single org with buildings and members |
| `create` | mutation | SUPER_ADMIN | Create org (name, abn?, state) |
| `update` | mutation | SUPER_ADMIN | Update any field including isActive |
| `delete` | mutation | SUPER_ADMIN | Hard delete |

### `buildings`
| Procedure | Type | Auth | Description |
|---|---|---|---|
| `list` | query | protected | Buildings visible to user (all for SUPER_ADMIN, assigned for others). Includes `_count.units`, `_count.assignments` |
| `getById` | query | protected | Full building detail with units, floors, strata info |
| `create` | mutation | SUPER_ADMIN | Create building under an org |
| `update` | mutation | manager | Update building fields |
| `delete` | mutation | SUPER_ADMIN | Hard delete |
| `getStats` | query | protected | Stats for a building: totalUnits, occupiedUnits, residentCount, openMaintenanceCount, pendingParcelCount, overdueRentCount, rentCollectedThisMonthCents, occupancyRate |

### `units`
| Procedure | Type | Auth | Description |
|---|---|---|---|
| `listByBuilding` | query | protected | All units with ownerships, tenancies, parking, storage |
| `getById` | query | protected | Full unit detail |
| `create` | mutation | manager | Create unit in building |
| `update` | mutation | manager | Update unit (including isOccupied) |
| `delete` | mutation | manager | Hard delete |

### `residents`
| Procedure | Type | Auth | Description |
|---|---|---|---|
| `listByBuilding` | query | protected | Active building assignments with user detail. Inputs: buildingId, role?, search?. Returns users with `buildingRole`, `ownerships`, `tenancies`, `emergencyContacts` |
| `getById` | query | protected | Full resident profile |
| `addEmergencyContact` | mutation | manager | Add emergency contact to a user |
| `removeEmergencyContact` | mutation | manager | Remove emergency contact |

### `rent`
| Procedure | Type | Auth | Description |
|---|---|---|---|
| `listByBuilding` | query | manager | Rent payments for building, optionally filtered by status |
| `listByTenancy` | query | protected | Rent history for a tenancy |
| `recordPayment` | mutation | manager | Mark a payment as paid (full or partial) |
| `generateSchedule` | mutation | manager | Generate monthly/weekly/fortnightly payment schedule |
| `getRentRoll` | query | manager | Rent roll: all active tenancies with overdue payment counts |

### `keys`
Full CRUD for key records (physical keys, fobs, access codes, remotes, swipe cards) with key log history.

### `maintenance`
| Procedure | Type | Auth | Description |
|---|---|---|---|
| `listByBuilding` | query | protected | Maintenance requests filtered by status/priority |
| `getById` | query | protected | Full request with images and comments |
| `create` | mutation | tenantOrAbove | Submit new request |
| `updateStatus` | mutation | manager | Change status (sets completedDate on COMPLETED) |
| `assign` | mutation | manager | Assign to a person |
| `addComment` | mutation | protected | Add comment to a request |

### `visitors`
CRUD for visitor entries with pre-approval, arrival/departure times, vehicle plates.

### `parcels`
CRUD for parcel tracking — received, notified, collected, returned statuses.

### `announcements`
| Procedure | Type | Auth | Description |
|---|---|---|---|
| `listByBuilding` | query | protected | Non-expired announcements for a building |
| `create` | mutation | manager | Create announcement with scope (BUILDING/FLOOR/ALL_BUILDINGS) |
| `delete` | mutation | manager | Delete announcement |

### `messaging`
Direct messaging between users (sender/recipient model with thread support).

---

## Data Model Summary

Key relationships:

```
Organisation
  └── Building (many)
        ├── Unit (many)
        │     ├── Ownership (→ User)
        │     ├── Tenancy (→ User)
        │     │     └── RentPayment (many)
        │     └── MaintenanceRequest (many)
        ├── BuildingAssignment (→ User, role)
        ├── VisitorEntry (many)
        ├── Parcel (many)
        ├── KeyRecord (many)
        ├── Announcement (many)
        ├── Document (many)
        └── StrataInfo (one)
              ├── StrataLevy (many)
              ├── StrataBylaw (many)
              └── StrataMeeting (many)

User
  ├── OrganisationMembership (→ Organisation, role)
  ├── BuildingAssignment (→ Building, role)
  ├── Ownership (→ Unit)
  ├── Tenancy (→ Unit)
  └── EmergencyContact (many)
```

All monetary values are stored in **cents** as integers (e.g. `rentAmountCents`, `amountCents`). Use `formatCurrency(cents)` from `src/lib/constants.ts` to display.

All Australian states use the `AustralianState` enum: NSW, VIC, QLD, SA, WA, TAS, NT, ACT.

---

## Environment Variables

Required in `.env`:
```
DATABASE_URL=               # PostgreSQL connection string (Supabase)
NEXT_PUBLIC_SUPABASE_URL=   # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY= # Supabase anon/public key
NEXT_PUBLIC_APP_URL=        # e.g. http://localhost:3000 (used in tRPC provider for SSR)
```

---

## What Is and Isn't Wired Up

### ✅ Wired to real data (tRPC + Prisma)
- **Dashboard layout** — fetches real buildings from DB for the building switcher
- **Manager dashboard** (`/manager`) — `buildings.getStats`, `maintenance.listByBuilding`, `announcements.listByBuilding`
- **Residents page** (`/manager/residents`) — `residents.listByBuilding` with search and role filter
- **Units page** (`/manager/units`) — `units.listByBuilding` + `units.create`; occupancy tabs, unit type, resident name shown
- **Rent page** (`/manager/rent`) — `rent.getRentRoll` + `rent.listByBuilding`; two tabs (Rent Roll / Payments); record payment dialog calls `rent.recordPayment`
- **Maintenance page** (`/manager/maintenance`) — `maintenance.listByBuilding` + `maintenance.create` + `maintenance.updateStatus`; status/priority filters, status transition dropdown per row
- **Organisations page** (`/super-admin/organisations`) — `organisations.list` + `organisations.create` + `organisations.update` (deactivate/reactivate)

### ❌ Not yet built (pages missing entirely)
Every sidebar nav item below has a tRPC router ready but no UI page:
- `/manager/keys` — router: `keys`
- `/manager/visitors` — router: `visitors`
- `/manager/parcels` — router: `parcels`
- `/manager/announcements` — router: `announcements`
- `/manager/documents` — router: none yet
- `/manager/messages` — router: `messaging`
- `/manager/strata` — router: none yet
- `/manager/financials` — router: none yet (FinancialRecord model exists)
- `/manager/analytics` — router: none yet
- `/super-admin/buildings` — router: `buildings`
- `/super-admin/users` — router: none yet

### ⚠️ Partially implemented / known gaps
- **User registration** — The register page exists and calls `supabase.auth.signUp()`, but it does NOT create the Prisma `User` record or `OrganisationMembership`. New users will fail tRPC auth until a Prisma user is created. This needs a Supabase webhook or an after-signup API route.
- **Building-context auto-select** — If a user has only one building, it is NOT auto-selected. The user must manually pick from the switcher. Consider auto-selecting on first load.
- **Keys to Rotate stat** — The dashboard quick-action card shows "—" for keys to rotate. The `keys` router is not yet called from the dashboard.
- **Register page** — Does not onboard user into an organisation. Full onboarding flow is needed.

---

## Architectural Decisions

1. **Server component layout + client pages**: `(dashboard)/layout.tsx` is an async server component that fetches buildings directly from Prisma (bypassing the HTTP tRPC layer for efficiency). Page components that need Zustand state (building context) are client components.

2. **`skipToken` pattern for optional queries**: All building-scoped queries use `skipToken` from `@tanstack/react-query` when no building is selected, rather than passing an empty string or using `enabled: false`.

3. **Cents for money**: All monetary values stored as integers in cents to avoid floating-point issues. `formatCurrency(cents)` in `constants.ts` formats as AUD.

4. **Supabase + Prisma dual-layer auth**: Supabase handles session management and cookie refresh; Prisma stores the application user with role data. The link is `User.supabaseAuthId = supabase auth user UUID`.

5. **Building switcher state in Zustand + localStorage**: `useBuildingContext` (Zustand with persist) stores which building is active. This survives page refreshes but is client-only.

6. **tRPC v11 + React Query v5**: Uses the `httpBatchLink` with SuperJSON transformer. Query client has `staleTime: 5 minutes` and `refetchOnWindowFocus: false`. Cache invalidation after mutations uses `utils.routerName.procedureName.invalidate()`.

7. **shadcn/ui**: Components are installed into `src/components/ui/` via the `shadcn` CLI. Never edit these files directly — re-run the CLI to update. Installed: button, input, label, card, table, tabs, badge, avatar, dropdown-menu, dialog, select, textarea, separator, sheet, sidebar, skeleton, sonner, tooltip.

---

## Running the Project

```bash
cd strata-hub
npm run dev        # Start dev server (http://localhost:3000)
npm run build      # Type-check + build
npm run lint       # ESLint
npx prisma generate  # Re-generate Prisma client after schema changes
npx prisma db push   # Push schema changes to DB
npx prisma studio    # Open Prisma Studio GUI
```
