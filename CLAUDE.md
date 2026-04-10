@AGENTS.md

# StrataHub — Claude Code Context

> **Last updated: 2026-04-10** — Database live on Supabase, all TypeScript errors resolved, seed script working. App fully runnable end-to-end.

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

### Critical: Prisma 7 Generator + Driver Adapter

The Prisma generator uses the new `prisma-client` provider (not the old `prisma-client-js`).

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
  // ⚠️ No `url` field here — Prisma 7 reads it from prisma.config.ts
}
```

The connection URL lives in `prisma.config.ts` (root of project), not in the schema:

```ts
// prisma.config.ts
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: process.env["DATABASE_URL"] },
});
```

**Prisma 7 requires a driver adapter** — `new PrismaClient()` with no args is a type error. Use `@prisma/adapter-pg`:

```ts
// src/server/db/client.ts
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  return new PrismaClient({ adapter });
}
```

All Prisma imports come from `@/generated/prisma/client` (note the `/client` suffix), NOT from `@prisma/client` or `@/generated/prisma`.

```ts
import { PrismaClient } from "@/generated/prisma/client";
import type { UserRole } from "@/generated/prisma/client";
```

---

## Project Structure

```
strata-hub/
├── prisma/
│   ├── schema.prisma           # Full data model — source of truth
│   └── seed.ts                 # Seed script: creates super-admin + demo org/building
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
│   │   │   │   ├── keys/page.tsx         ✅ wired to tRPC (list, create, issue, return, deactivate)
│   │   │   │   ├── maintenance/page.tsx  ✅ wired to tRPC (list, create, status transitions)
│   │   │   │   ├── visitors/page.tsx     ✅ wired to tRPC (list by date, create, log arrival/departure)
│   │   │   │   ├── parcels/page.tsx      ✅ wired to tRPC (list, create, notify/collect/return)
│   │   │   │   ├── announcements/page.tsx ✅ wired to tRPC (list, create, delete; priority/scope badges)
│   │   │   │   ├── documents/page.tsx    ✅ wired to tRPC (list by category, create with URL, delete)
│   │   │   │   ├── messages/page.tsx     ✅ wired to tRPC (thread list, conversation view, send/reply)
│   │   │   │   ├── strata/page.tsx       ✅ wired to tRPC (info, meetings, bylaws, levies tabs)
│   │   │   │   ├── financials/page.tsx   ✅ wired to tRPC (income/expense records, summary cards)
│   │   │   │   └── analytics/page.tsx    ✅ wired to tRPC (KPI cards + recharts bar/pie charts)
│   │   │   └── super-admin/
│   │   │       ├── organisations/page.tsx ✅ wired to tRPC
│   │   │       ├── buildings/page.tsx    ✅ wired to tRPC (list all, create under org, delete)
│   │   │       └── users/page.tsx        ✅ wired to tRPC (list all users, roles, deactivate)
│   │   ├── api/
│   │   │   ├── auth/create-user/route.ts     # POST: creates Prisma User after Supabase signUp
│   │   │   ├── invite/[token]/route.ts        # GET: public fetch of invite details by token
│   │   │   ├── invite/accept/route.ts         # POST: accept invite → OrgMembership + BuildingAssignment
│   │   │   └── trpc/[trpc]/route.ts           # tRPC HTTP handler
│   │   ├── invite/
│   │   │   └── [token]/
│   │   │       ├── page.tsx                   # Public invite acceptance page (server component)
│   │   │       └── accept-invite-button.tsx   # Client button: calls /api/invite/accept then redirects
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
│   │           ├── messaging.ts
│   │           ├── financials.ts   # listByBuilding, getSummary, create, delete
│   │           ├── strata.ts       # getByBuilding, upsertInfo, createMeeting, deleteMeeting
│   │           ├── documents.ts    # listByBuilding, create, delete
│   │           └── users.ts        # list, deactivateAssignments (SUPER_ADMIN only)
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

When a new user registers, the register page calls `supabase.auth.signUp()` and then, **if the session is immediately available** (no email verification required), calls `POST /api/auth/create-user` to create the Prisma record. If the user arrived via an invite link (`?invite=<token>`), it also calls `POST /api/invite/accept` to create their `OrganisationMembership` and `BuildingAssignment`, then redirects to `/manager`.

If email verification is required, the Prisma user will not exist until they verify and re-visit the invite link, at which point they can click "Accept Invite" while logged in.

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
- `/register` — registration; reads `?invite=<token>` to auto-accept an invite after signup
- `/forgot-password` — password reset request

### Public routes (no auth required, no sidebar)
- `/invite/[token]` — invite acceptance page; whitelisted in middleware (`/invite/**`)

### Manager routes (`/manager/**`) — sidebar shows "Property Management" nav
- `/manager` — dashboard (stats, recent maintenance, announcements)
- `/manager/residents` — residents table (owners + tenants)
- `/manager/units` — units list, create, occupancy tabs
- `/manager/rent` — rent roll + payments tabs, record payment
- `/manager/keys` — key records, issue/return/deactivate
- `/manager/maintenance` — requests with status transitions
- `/manager/visitors` — date-filtered visitor log, arrive/depart
- `/manager/parcels` — parcel lifecycle (received→notified→collected/returned)
- `/manager/announcements` — create/delete notices with priority + scope
- `/manager/documents` — file library with category filter + external link
- `/manager/messages` — threaded messaging, send/reply
- `/manager/strata` — strata plan info, meetings, bylaws, levies tabs
- `/manager/financials` — income/expense ledger with summary cards
- `/manager/analytics` — KPI cards + 4 live Recharts charts

### Super-admin routes (`/super-admin/**`) — sidebar shows "Administration" nav + "Property Management" nav
- `/super-admin/organisations` — list/create/deactivate orgs
- `/super-admin/buildings` — list all buildings, create under org, delete
- `/super-admin/users` — list all users, roles, building assignments, deactivate

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

| Procedure | Type | Auth | Description |
|---|---|---|---|
| `listThreads` | query | protected | All threads the current user is part of (distinct by threadId) |
| `getThread` | query | protected | All messages in a thread ordered by createdAt asc |
| `send` | mutation | protected | Send message; auto-generates threadId if not provided |
| `markRead` | mutation | protected | Mark all unread messages in a thread as read |
| `unreadCount` | query | protected | Count of unread messages for current user |

### `financials`
| Procedure | Type | Auth | Description |
|---|---|---|---|
| `listByBuilding` | query | manager | FinancialRecords filtered by type (INCOME/EXPENSE) and date range |
| `getSummary` | query | manager | Aggregate totalIncome, totalExpense, net for a building |
| `create` | mutation | manager | Create record (type, category, description, amountCents, date) |
| `delete` | mutation | manager | Hard delete |

### `strata`
| Procedure | Type | Auth | Description |
|---|---|---|---|
| `getByBuilding` | query | protected | StrataInfo with levies, bylaws, meetings included |
| `upsertInfo` | mutation | manager | Create or update StrataInfo for a building |
| `createMeeting` | mutation | manager | Add a StrataMeeting (requires StrataInfo to exist first) |
| `deleteMeeting` | mutation | manager | Hard delete a meeting |

### `documents`
| Procedure | Type | Auth | Description |
|---|---|---|---|
| `listByBuilding` | query | protected | Documents filtered by category (DocCategory enum) |
| `create` | mutation | manager | Create document record (title, fileUrl, category, isPublic) |
| `delete` | mutation | manager | Hard delete |

### `users` (super-admin)
| Procedure | Type | Auth | Description |
|---|---|---|---|
| `list` | query | SUPER_ADMIN | All users with orgMemberships + active buildingAssignments; searchable |
| `assignToBuilding` | mutation | SUPER_ADMIN | Upserts OrgMembership + creates/updates BuildingAssignment for an existing user |
| `createInvite` | mutation | SUPER_ADMIN | Creates an Invitation record (7-day expiry); returns invite with token |
| `listInvites` | query | SUPER_ADMIN | All pending (non-expired, non-accepted) invitations |
| `revokeInvite` | mutation | SUPER_ADMIN | Hard deletes an invitation |
| `deactivateAssignments` | mutation | SUPER_ADMIN | Set all BuildingAssignments for a user to isActive=false |

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
# Supabase session pooler URL (use session pooler, not direct — direct requires IPv6)
# Format: postgresql://postgres.PROJECT_REF:PASSWORD@aws-X-REGION.pooler.supabase.com:5432/postgres
# Encode special chars in password: @ → %40, # → %23, $ → %24
DATABASE_URL=

NEXT_PUBLIC_SUPABASE_URL=      # e.g. https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY= # anon/public key from Supabase dashboard → Settings → API
SUPABASE_SERVICE_ROLE_KEY=     # service_role key — only used server-side (seed script, admin ops)

NEXT_PUBLIC_APP_URL=           # e.g. http://localhost:3000
NEXT_PUBLIC_APP_NAME=          # e.g. StrataHub
```

### Supabase connection note
Supabase's direct connection (port 5432 on `db.*.supabase.co`) requires IPv6. On a standard IPv4 network (home/office), use the **Session Pooler** URL from Settings → Database → "Session pooler". The pooler host looks like `aws-1-ap-southeast-2.pooler.supabase.com` and the username is `postgres.PROJECT_REF`.

---

## What Is and Isn't Wired Up

### ✅ Wired to real data (tRPC + Prisma)
- **Dashboard layout** — fetches real buildings from DB for the building switcher; auto-selects if only one building
- **Manager dashboard** (`/manager`) — `buildings.getStats`, `maintenance.listByBuilding`, `announcements.listByBuilding`
- **Residents page** (`/manager/residents`) — `residents.listByBuilding` with search and role filter
- **Units page** (`/manager/units`) — `units.listByBuilding` + `units.create`; occupancy tabs, unit type, resident name shown
- **Rent page** (`/manager/rent`) — `rent.getRentRoll` + `rent.listByBuilding`; two tabs (Rent Roll / Payments); record payment dialog calls `rent.recordPayment`
- **Maintenance page** (`/manager/maintenance`) — `maintenance.listByBuilding` + `maintenance.create` + `maintenance.updateStatus`; status/priority filters, status transition dropdown per row
- **Keys page** (`/manager/keys`) — `keys.listByBuilding` + `keys.create` + `keys.issue` + `keys.returnKey` + `keys.deactivate`; rotation-due warning banner; type filter; issue/return/deactivate via dropdown
- **Visitors page** (`/manager/visitors`) — `visitors.listByBuilding` (date-filtered, defaults to today) + `visitors.create` + `visitors.logArrival` + `visitors.logDeparture`; Expected/Present/Departed status badges; inline Arrive/Depart action buttons
- **Parcels page** (`/manager/parcels`) — `parcels.listByBuilding` + `parcels.create` + `parcels.markNotified` + `parcels.markCollected` + `parcels.markReturned`; Pending/All/Collected/Returned tabs; Mark Collected dialog captures collected-by name
- **Announcements page** (`/manager/announcements`) — `announcements.listByBuilding` + `announcements.create` + `announcements.delete`; priority colour badges (Low/Medium/High/Urgent), scope badges, expiry date
- **Documents page** (`/manager/documents`) — `documents.listByBuilding` + `documents.create` + `documents.delete`; category filter dropdown, external link button, staff/public visibility toggle
- **Messages page** (`/manager/messages`) — `messaging.listThreads` + `messaging.getThread` + `messaging.send` + `messaging.markRead`; split-pane thread list + message view; Enter to send
- **Strata page** (`/manager/strata`) — `strata.getByBuilding` + `strata.upsertInfo` + `strata.createMeeting` + `strata.deleteMeeting`; four tabs: Info, Meetings, Levies, Bylaws
- **Financials page** (`/manager/financials`) — `financials.listByBuilding` + `financials.getSummary` + `financials.create` + `financials.delete`; All/Income/Expense tabs; live summary cards (income, expenses, net)
- **Analytics page** (`/manager/analytics`) — `buildings.getStats` + `maintenance.listByBuilding` + `parcels.listByBuilding`; KPI cards + 4 Recharts charts (occupancy pie, maintenance-by-priority pie, maintenance-by-status bar, parcels bar)
- **Organisations page** (`/super-admin/organisations`) — `organisations.list` + `organisations.create` + `organisations.update` (deactivate/reactivate)
- **Buildings page** (`/super-admin/buildings`) — `buildings.list` + `buildings.create` (linked to org) + `buildings.delete`; search by name/suburb/org
- **Users page** (`/super-admin/users`) — `users.list` + `users.assignToBuilding` + `users.createInvite` + `users.listInvites` + `users.revokeInvite` + `users.deactivateAssignments`; two tabs (Users / Pending Invites); "Assign to Building" and "Invite User" dialogs
- **Invite page** (`/invite/[token]`) — public server-component page; shows org/building/role details; Accept button if logged in, Register/Sign In buttons if not; `AcceptInviteButton` client component calls `/api/invite/accept` then redirects to `/manager`

### ❌ Not yet built
- Nothing — all sidebar nav items and onboarding flows have pages.

### ⚠️ Known gaps / remaining work
- **Email verification fallback** — If Supabase requires email confirmation before login, the Prisma user and invite acceptance are deferred until the user verifies their email and visits `/invite/[token]` again while logged in. A Supabase webhook on `SIGNED_IN` could automate this.
- **Keys to Rotate stat** — Dashboard quick-action card shows "—" for keys to rotate. The `keys` router is not yet called from the dashboard page.
- **Document file upload** — The documents page accepts a file URL manually pasted by the user. There is no Supabase Storage upload integration yet.
- **Strata levies** — The levies tab on the strata page shows a placeholder. The `StrataLevy` model exists in the schema but no UI or router procedures manage levies yet.
- **Middleware deprecation** — Next.js 16 deprecated the `middleware` file convention in favour of `proxy`. Low priority — still functional, just shows a warning in the build output.

---

## Architectural Decisions

1. **Server component layout + client pages**: `(dashboard)/layout.tsx` is an async server component that fetches buildings directly from Prisma (bypassing the HTTP tRPC layer for efficiency). Page components that need Zustand state (building context) are client components.

2. **`skipToken` pattern for optional queries**: All building-scoped queries use `skipToken` from `@tanstack/react-query` when no building is selected, rather than passing an empty string or using `enabled: false`.

3. **Cents for money**: All monetary values stored as integers in cents to avoid floating-point issues. `formatCurrency(cents)` in `constants.ts` formats as AUD.

4. **Supabase + Prisma dual-layer auth**: Supabase handles session management and cookie refresh; Prisma stores the application user with role data. The link is `User.supabaseAuthId = supabase auth user UUID`.

5. **Building switcher state in Zustand + localStorage**: `useBuildingContext` (Zustand with persist) stores which building is active. This survives page refreshes but is client-only. `BuildingSwitcher` auto-selects when the user has exactly one building (via `useEffect` on mount).

6. **tRPC v11 + React Query v5**: Uses the `httpBatchLink` with SuperJSON transformer. Query client has `staleTime: 5 minutes` and `refetchOnWindowFocus: false`. Cache invalidation after mutations uses `utils.routerName.procedureName.invalidate()`.

7. **shadcn/ui with Base UI**: The installed shadcn components use `@base-ui/react` (not the older `@radix-ui/react-*` packages). This has two key API differences from what older examples show:
   - **No `asChild`** — use the `render` prop instead: `<DialogTrigger render={<Button />}>label</DialogTrigger>`
   - **`Select.onValueChange` receives `null`** — always guard: `onValueChange={(v) => v !== null && setState(v)}`

   Components are in `src/components/ui/`. Never edit generated shadcn files — re-run the CLI to update. Installed: button, input, label, card, table, tabs, badge, avatar, dropdown-menu, dialog, select, textarea, separator, sheet, sidebar, skeleton, sonner, tooltip.

---

## Running the Project

```bash
cd strata-hub
npm run dev        # Start dev server (http://localhost:3000)
npm run build      # Type-check + build
npm run lint       # ESLint
npm run db:seed    # Seed super-admin account + demo org/building (run once)

npx prisma generate  # Re-generate Prisma client after schema changes
npx prisma db push   # Push schema changes to Supabase (uses prisma.config.ts for URL)
npx prisma studio    # Open Prisma Studio GUI
```

### First-time setup checklist
1. Copy `.env` values: `DATABASE_URL` (session pooler), `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
2. `npx prisma generate` — generate the client
3. `npx prisma db push` — create all tables in Supabase
4. `npm run db:seed` — create the super-admin user and demo data
5. `npm run dev` — start the app
6. Log in at http://localhost:3000 with `admin@stratahub.com.au` / `Admin1234!`

### Seed account credentials (local dev only)
| Field | Value |
|---|---|
| Email | `admin@stratahub.com.au` |
| Password | `Admin1234!` |
| Role | `SUPER_ADMIN` |
| Org | StrataHub Demo Org |
| Building | Harbour View Apartments, Sydney NSW |
