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
| UI Components | shadcn/ui via `shadcn` CLI (backed by `@base-ui/react`, NOT `@radix-ui`) |
| Auth | Supabase Auth (SSR via `@supabase/ssr`) |
| Database | PostgreSQL (hosted on Supabase) |
| ORM | Prisma 7 (`prisma-client` generator, output → `src/generated/prisma`) |
| API Layer | tRPC v11 + TanStack Query v5 |
| State Management | Zustand v5 (building context/switcher only) |
| Data Transformer | SuperJSON (tRPC serialisation) |
| Date Handling | date-fns v4 |
| Charts | Recharts v3 |
| Email | Resend (installed, not yet implemented) |
| Toast | Sonner |
| Icons | Lucide React |
| Package Manager | npm |

---

## Critical: Prisma 7 Patterns

### Generator + datasource

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
  // ⚠️ No `url` field — Prisma 7 reads it from prisma.config.ts
}
```

### prisma.config.ts (root of project)

```ts
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: process.env["DATABASE_URL"] },
});
```

### Driver adapter (required in Prisma 7)

`new PrismaClient()` with no args is a **type error** in Prisma 7. Must use a driver adapter:

```ts
// src/server/db/client.ts
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };
export const db = globalForPrisma.prisma ?? createPrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
```

### Import paths

All Prisma imports come from `@/generated/prisma/client` (note the `/client` suffix):

```ts
import { PrismaClient } from "@/generated/prisma/client";
import type { UserRole } from "@/generated/prisma/client";
```

---

## Critical: Base UI Patterns

The shadcn/ui components use `@base-ui/react` (not `@radix-ui/react-*`). Two breaking differences from Radix:

### 1. No `asChild` — use `render` prop

```tsx
// ❌ Wrong (Radix pattern)
<DialogTrigger asChild>
  <Button disabled={!selectedBuildingId}>New</Button>
</DialogTrigger>

// ✅ Correct (Base UI pattern)
<DialogTrigger render={<Button disabled={!selectedBuildingId} />}>
  New
</DialogTrigger>

// Same for DropdownMenuTrigger, SidebarMenuButton, Button with Link:
<Button render={<Link href="/register" />}>Create Account</Button>
<SidebarMenuButton render={<Link href={item.href} />} isActive={...}>
  <Icon /> <span>{item.title}</span>
</SidebarMenuButton>
```

### 2. Select `onValueChange` receives `null`

```tsx
// ❌ Wrong — type error, setState only accepts string
<Select onValueChange={setFormStatus}>

// ✅ Correct — guard against null
<Select onValueChange={(v) => v !== null && setFormStatus(v)}>
```

---

## Project Structure

```
strata-hub/
├── prisma/
│   ├── schema.prisma           # Full data model — source of truth
│   └── seed.ts                 # Seed: creates super-admin + demo org/building
├── prisma.config.ts            # Prisma 7 config: connection URL for migrations
├── src/
│   ├── app/
│   │   ├── (auth)/             # Public auth pages (no sidebar)
│   │   │   ├── layout.tsx      # Centered card layout (max-w-md, bg-gray-50)
│   │   │   ├── login/page.tsx
│   │   │   ├── register/page.tsx    # Wrapped in <Suspense> (uses useSearchParams)
│   │   │   └── forgot-password/page.tsx
│   │   ├── (dashboard)/        # Protected pages (sidebar + topbar)
│   │   │   ├── layout.tsx           # Async server component — fetches buildings from Prisma directly
│   │   │   ├── manager/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── residents/page.tsx
│   │   │   │   ├── units/page.tsx
│   │   │   │   ├── rent/page.tsx
│   │   │   │   ├── keys/page.tsx
│   │   │   │   ├── maintenance/page.tsx
│   │   │   │   ├── visitors/page.tsx
│   │   │   │   ├── parcels/page.tsx
│   │   │   │   ├── announcements/page.tsx
│   │   │   │   ├── documents/page.tsx
│   │   │   │   ├── messages/page.tsx
│   │   │   │   ├── strata/page.tsx
│   │   │   │   ├── financials/page.tsx
│   │   │   │   └── analytics/page.tsx
│   │   │   └── super-admin/
│   │   │       ├── organisations/page.tsx
│   │   │       ├── buildings/page.tsx
│   │   │       └── users/page.tsx
│   │   ├── api/
│   │   │   ├── auth/create-user/route.ts   # POST: creates Prisma User after Supabase signUp
│   │   │   ├── invite/[token]/route.ts     # GET: public fetch of invite details by token
│   │   │   ├── invite/accept/route.ts      # POST: accept invite → OrgMembership + BuildingAssignment
│   │   │   └── trpc/[trpc]/route.ts        # tRPC HTTP handler (GET + POST)
│   │   ├── invite/
│   │   │   └── [token]/
│   │   │       ├── page.tsx                # Public invite page (server component)
│   │   │       └── accept-invite-button.tsx
│   │   ├── globals.css
│   │   ├── layout.tsx          # Root layout — Geist fonts, html lang="en"
│   │   └── page.tsx            # Root → redirect("/manager")
│   ├── components/
│   │   ├── layout/
│   │   │   ├── app-sidebar.tsx
│   │   │   ├── building-switcher.tsx
│   │   │   └── topbar.tsx
│   │   └── ui/                 # shadcn/ui components (never edit directly)
│   ├── hooks/
│   │   ├── use-building-context.ts
│   │   └── use-mobile.ts
│   ├── lib/
│   │   ├── constants.ts
│   │   ├── supabase/
│   │   │   ├── client.ts       # createBrowserClient (client-side)
│   │   │   ├── server.ts       # createServerClient with cookie handlers (server-side)
│   │   │   └── middleware.ts   # updateSession + route protection logic
│   │   └── trpc/
│   │       ├── client.ts       # trpc = createTRPCReact<AppRouter>()
│   │       └── provider.tsx    # TRPCProvider: QueryClient + httpBatchLink + superjson
│   ├── middleware.ts            # Next.js entry — calls updateSession()
│   ├── server/
│   │   ├── db/client.ts        # Prisma singleton with PrismaPg adapter
│   │   └── trpc/
│   │       ├── trpc.ts         # Context, procedure factories, role guards
│   │       ├── router.ts       # AppRouter — combines all sub-routers
│   │       └── routers/        # 15 domain routers
│   └── types/
│       └── auth.ts             # AuthUser, SessionContext types
└── src/generated/prisma/       # Generated Prisma client (gitignored, never edit)
```

---

## Authentication Flow

### Two user records

- **Supabase `auth.users`** — managed by Supabase Auth. UUID is `supabaseUser.id`
- **Prisma `users` table** — application record. Links via `User.supabaseAuthId`

### Registration flow

1. `supabase.auth.signUp({ email, password, options: { data: { first_name, last_name } } })`
2. **If session returned immediately** (no email verification):
   - `POST /api/auth/create-user` → creates Prisma user
   - If `?invite=<token>`: `POST /api/invite/accept` → creates memberships → redirect `/manager`
3. **If email verification required** (session is null):
   - Redirect to `/login?registered=true` or `/invite/<token>`
   - On first login after verification, Prisma user is **auto-created** in both:
     - `createTRPCContext()` in `src/server/trpc/trpc.ts`
     - Dashboard layout in `src/app/(dashboard)/layout.tsx`
   - Uses `supabaseUser.user_metadata.first_name` / `first_name` stored at signup

### Login flow

`supabase.auth.signInWithPassword()` → middleware refreshes session via cookies → redirect `/manager`

### tRPC context (every API call)

```ts
// src/server/trpc/trpc.ts — createTRPCContext()
supabase.auth.getUser()                    // verify session server-side
db.user.findUnique({ supabaseAuthId })     // fetch Prisma user + memberships
// auto-creates Prisma user if missing (email verification fallback)
return { db, supabase, supabaseUser, user }
```

### Middleware route protection

**File:** `src/lib/supabase/middleware.ts`

Public (no auth required):
- `/`, `/login`, `/register`, `/forgot-password`
- `/api/webhooks/**`
- `/invite/**`

Protected: everything else → unauthenticated users redirected to `/login?redirect=<path>`

Auth pages (`/login`, `/register`): authenticated users redirected to `/manager`

---

## Role System

```
SUPER_ADMIN      → full access, all orgs/buildings
BUILDING_MANAGER → manages assigned buildings
RECEPTION        → front desk (visitors, parcels, keys)
OWNER            → unit owner self-service
TENANT           → tenant self-service
```

Roles are stored in **two junction tables** — NOT on the `users` row:

| Table | Key columns |
|---|---|
| `organisation_memberships` | `userId`, `organisationId`, `role`, `isActive` |
| `building_assignments` | `userId`, `buildingId`, `role`, `isActive` |

Role is read in tRPC via `user.orgMemberships.map(m => m.role)`.

### tRPC Procedure Guards

| Procedure | Allowed roles |
|---|---|
| `publicProcedure` | Anyone |
| `protectedProcedure` | Any authenticated user with a Prisma record |
| `tenantOrAboveProcedure` | TENANT, OWNER, RECEPTION, BUILDING_MANAGER, SUPER_ADMIN |
| `managerProcedure` | RECEPTION, BUILDING_MANAGER, SUPER_ADMIN |
| `ownerProcedure` | OWNER, BUILDING_MANAGER, SUPER_ADMIN |
| `superAdminProcedure` | SUPER_ADMIN only |

---

## Routing Structure

### Auth routes (no sidebar)
- `/login` — `supabase.auth.signInWithPassword()`
- `/register` — signup + optional invite acceptance
- `/forgot-password` — `supabase.auth.resetPasswordForEmail()` with `redirectTo: '/reset-password'`

### Public routes
- `/invite/[token]` — invite acceptance page (whitelisted in middleware)

### Manager routes (`/manager/**`)
- `/manager` — dashboard: `buildings.getStats`, `maintenance.listByBuilding`, `announcements.listByBuilding`
- `/manager/residents` — `residents.listByBuilding` (search, role filter)
- `/manager/units` — `units.listByBuilding` + `units.create`
- `/manager/rent` — `rent.getRentRoll` + `rent.listByBuilding` + `rent.recordPayment`
- `/manager/keys` — `keys.listByBuilding` + `keys.create` + `keys.issue` + `keys.returnKey` + `keys.deactivate`
- `/manager/maintenance` — `maintenance.listByBuilding` + `maintenance.create` + `maintenance.updateStatus`
- `/manager/visitors` — `visitors.listByBuilding` + `visitors.create` + `visitors.logArrival` + `visitors.logDeparture`
- `/manager/parcels` — `parcels.listByBuilding` + `parcels.create` + `parcels.markNotified` + `parcels.markCollected` + `parcels.markReturned`
- `/manager/announcements` — `announcements.listByBuilding` + `announcements.create` + `announcements.delete`
- `/manager/documents` — `documents.listByBuilding` + `documents.create` + `documents.delete`
- `/manager/messages` — `messaging.listThreads` + `messaging.getThread` + `messaging.send` + `messaging.markRead`
- `/manager/strata` — `strata.getByBuilding` + `strata.upsertInfo` + `strata.createMeeting` + `strata.deleteMeeting`
- `/manager/financials` — `financials.listByBuilding` + `financials.getSummary` + `financials.create` + `financials.delete`
- `/manager/analytics` — `buildings.getStats` + `maintenance.listByBuilding` + `parcels.listByBuilding` + Recharts

### Super-admin routes (`/super-admin/**`)
- `/super-admin/organisations` — `organisations.list` + `organisations.create` + `organisations.update`
- `/super-admin/buildings` — `buildings.list` + `buildings.create` + `buildings.delete`
- `/super-admin/users` — `users.list` + `users.assignToBuilding` + `users.createInvite` + `users.listInvites` + `users.revokeInvite` + `users.deactivateAssignments`

---

## API Routes

### `POST /api/auth/create-user`
- **Auth:** Requires Supabase session (`supabase.auth.getUser()`)
- **Body:** `{ firstName: string, lastName: string }`
- **Returns:** `{ user }` (201) or `{ error }` (400/401)
- **Behaviour:** Idempotent — returns existing record if already created. Called from register page when session is available immediately after signup.

### `GET /api/invite/[token]`
- **Auth:** Public
- **Returns:** `{ id, email, role, expiresAt, acceptedAt, organisation, building, expired, accepted }`
- **Note:** Fetches org + building names in parallel via `Promise.all`. Used by the invite page.

### `POST /api/invite/accept`
- **Auth:** Requires Supabase session
- **Body:** `{ token: string }`
- **Returns:** `{ success: true }` or `{ error }` (401/404/409/410)
- **Behaviour:** Upserts `OrganisationMembership`, creates `BuildingAssignment` (if buildingId set), marks `Invitation.acceptedAt`. Validates: exists, not already accepted, not expired.

### `GET|POST /api/trpc/[trpc]`
- **Handler:** `fetchRequestHandler` from `@trpc/server/adapters/fetch`
- **Router:** `appRouter` from `src/server/trpc/router.ts`

---

## tRPC Router Reference

All routers in `src/server/trpc/routers/`. Combined in `src/server/trpc/router.ts`.

### `organisations`
| Procedure | Type | Auth | Input | Description |
|---|---|---|---|---|
| `list` | query | SUPER_ADMIN | — | All orgs with `_count.buildings`, `_count.members` |
| `getById` | query | protected | `id` | Single org with buildings and members |
| `create` | mutation | SUPER_ADMIN | `name, abn?, state` | Create org |
| `update` | mutation | SUPER_ADMIN | `id, name?, abn?, state?, isActive?` | Update fields |
| `delete` | mutation | SUPER_ADMIN | `id` | Hard delete |

### `buildings`
| Procedure | Type | Auth | Input | Description |
|---|---|---|---|---|
| `list` | query | protected | — | SUPER_ADMIN gets all; others get assigned only |
| `getById` | query | protected | `id` | Full detail with units, floors, strataInfo |
| `create` | mutation | SUPER_ADMIN | `organisationId, name, address, suburb, state, postcode, totalFloors, totalUnits, strataSchemeNo?` | Create building |
| `update` | mutation | manager | `id, ...fields` | Update fields |
| `delete` | mutation | SUPER_ADMIN | `id` | Hard delete |
| `getStats` | query | protected | `buildingId` | `totalUnits, occupiedUnits, residentCount, openMaintenanceCount, pendingParcelCount, overdueRentCount, rentCollectedThisMonthCents, occupancyRate` |

### `units`
| Procedure | Type | Auth | Input | Description |
|---|---|---|---|---|
| `listByBuilding` | query | protected | `buildingId` | Units with ownerships, tenancies, parking, storage |
| `getById` | query | protected | `id` | Full unit with 12-month rent history |
| `create` | mutation | manager | `buildingId, unitNumber, unitType, bedrooms?, bathrooms?, parkingSpaces, storageSpaces, squareMetres?, lotNumber?, unitEntitlement?` | Create unit |
| `update` | mutation | manager | `id, ...fields` | Update unit |
| `delete` | mutation | manager | `id` | Hard delete |

Unit types: `APARTMENT`, `STUDIO`, `PENTHOUSE`, `TOWNHOUSE`, `COMMERCIAL`, `STORAGE`, `PARKING`

### `residents`
| Procedure | Type | Auth | Input | Description |
|---|---|---|---|---|
| `listByBuilding` | query | protected | `buildingId, role?, search?` | Active assignments with user detail |
| `getById` | query | protected | `id` | Full profile with ownerships, tenancies, emergency contacts |
| `addEmergencyContact` | mutation | manager | `userId, name, relationship, phone, email?` | Add contact |
| `removeEmergencyContact` | mutation | manager | `id` | Remove contact |

### `rent`
| Procedure | Type | Auth | Input | Description |
|---|---|---|---|---|
| `listByBuilding` | query | manager | `buildingId, status?` | Payments filtered by status |
| `listByTenancy` | query | protected | `tenancyId` | Rent history for tenancy |
| `recordPayment` | mutation | manager | `id, amountCents, paidDate, paymentMethod?, notes?` | Mark paid (PAID or PARTIAL) |
| `generateSchedule` | mutation | manager | `tenancyId, months?` | Generate payment schedule |
| `getRentRoll` | query | manager | `buildingId` | `unitNumber, tenantName, rentAmountCents, rentFrequency, leaseEnd, overduePayments, nextDue` |

### `keys`
Key types: `PHYSICAL_KEY`, `FOB`, `ACCESS_CODE`, `REMOTE`, `SWIPE_CARD`

| Procedure | Type | Auth | Input | Description |
|---|---|---|---|---|
| `listByBuilding` | query | protected | `buildingId, keyType?` | All keys with latest log |
| `getById` | query | protected | `id` | Full key with log history |
| `create` | mutation | manager | `buildingId, unitId?, keyType, identifier, issuedTo?, issuedDate?, rotationDue?, notes?` | Creates CREATED log entry |
| `issue` | mutation | manager | `id, issuedTo` | Sets issuedDate=now, creates ISSUED log |
| `returnKey` | mutation | manager | `id, notes?` | Sets returnedDate=now, creates RETURNED log |
| `deactivate` | mutation | manager | `id, notes?` | Sets isActive=false, creates DEACTIVATED log |

### `maintenance`
Categories: `PLUMBING`, `ELECTRICAL`, `HVAC`, `STRUCTURAL`, `APPLIANCE`, `PEST_CONTROL`, `CLEANING`, `SECURITY`, `LIFT`, `COMMON_AREA`, `OTHER`
Priorities: `LOW`, `MEDIUM`, `HIGH`, `URGENT`
Statuses: `SUBMITTED`, `ACKNOWLEDGED`, `IN_PROGRESS`, `AWAITING_PARTS`, `SCHEDULED`, `COMPLETED`, `CLOSED`, `CANCELLED`

| Procedure | Type | Auth | Input | Description |
|---|---|---|---|---|
| `listByBuilding` | query | protected | `buildingId, status?, priority?` | Filtered requests |
| `getById` | query | protected | `id` | Full request with images and comments |
| `create` | mutation | tenantOrAbove | `unitId, title, description, category, priority?` | Submit request |
| `updateStatus` | mutation | manager | `id, status` | Auto-sets `completedDate` if status=COMPLETED |
| `assign` | mutation | manager | `id, assignedTo` | Assign + set status=ACKNOWLEDGED |
| `addComment` | mutation | protected | `maintenanceRequestId, content` | Adds comment as current user |

### `visitors`
Purposes: `PERSONAL`, `DELIVERY`, `TRADESPERSON`, `REAL_ESTATE`, `INSPECTION`, `OTHER`

| Procedure | Type | Auth | Input | Description |
|---|---|---|---|---|
| `listByBuilding` | query | protected | `buildingId, date?` | Entries, includes registeredBy user |
| `create` | mutation | tenantOrAbove | `buildingId, visitorName, visitorPhone?, visitorCompany?, purpose, unitToVisit?, preApproved?, vehiclePlate?, deliveryInstructions?, notes?` | Create entry |
| `logArrival` | mutation | manager | `id` | Sets `arrivalTime` to now |
| `logDeparture` | mutation | manager | `id` | Sets `departureTime` to now |

### `parcels`
Statuses: `RECEIVED`, `NOTIFIED`, `COLLECTED`, `RETURNED`

| Procedure | Type | Auth | Input | Description |
|---|---|---|---|---|
| `listByBuilding` | query | protected | `buildingId, status?` | Filtered parcels |
| `create` | mutation | manager | `buildingId, unitNumber, recipientName, carrier?, trackingNumber?, storageLocation?, notes?` | Status auto-set to RECEIVED |
| `markNotified` | mutation | manager | `id` | Status → NOTIFIED |
| `markCollected` | mutation | manager | `id, collectedBy` | Status → COLLECTED, sets collectedAt |
| `markReturned` | mutation | manager | `id, notes?` | Status → RETURNED |

### `announcements`
Scopes: `BUILDING`, `FLOOR`, `ALL_BUILDINGS`

| Procedure | Type | Auth | Input | Description |
|---|---|---|---|---|
| `listByBuilding` | query | protected | `buildingId` | Non-expired announcements |
| `create` | mutation | manager | `buildingId, title, content, priority?, scope?, targetFloors?, expiresAt?` | Sets `authorId`, `publishedAt` |
| `delete` | mutation | manager | `id` | Hard delete |

### `messaging`
| Procedure | Type | Auth | Input | Description |
|---|---|---|---|---|
| `listThreads` | query | protected | — | Distinct threads (sender or recipient) with latest message |
| `getThread` | query | protected | `threadId` | All messages ordered by `createdAt` asc |
| `send` | mutation | protected | `recipientId, subject?, content, threadId?` | Auto-generates `threadId` if not provided |
| `markRead` | mutation | protected | `threadId` | Marks all unread messages in thread as read |
| `unreadCount` | query | protected | — | Count of unread messages for current user |

### `financials`
Types: `INCOME`, `EXPENSE`

| Procedure | Type | Auth | Input | Description |
|---|---|---|---|---|
| `listByBuilding` | query | manager | `buildingId, type?, from?, to?` | Records with date range filter |
| `getSummary` | query | manager | `buildingId` | `totalIncome, totalExpense, net` (all cents) |
| `create` | mutation | manager | `buildingId, type, category, description, amountCents, date, receiptUrl?` | Create record |
| `delete` | mutation | manager | `id` | Hard delete |

### `strata`
| Procedure | Type | Auth | Input | Description |
|---|---|---|---|---|
| `getByBuilding` | query | protected | `buildingId` | StrataInfo with levies, bylaws, meetings |
| `upsertInfo` | mutation | manager | `buildingId, strataPlanNumber, strataManagerName?, strataManagerEmail?, strataManagerPhone?, adminFundBalance?, capitalWorksBalance?, insurancePolicyNo?, insuranceExpiry?, nextAgmDate?` | Create or update |
| `createMeeting` | mutation | manager | `buildingId, title, meetingDate, location?, notes?` | Requires StrataInfo to exist first |
| `deleteMeeting` | mutation | manager | `id` | Hard delete |

### `documents`
Categories: `LEASE_AGREEMENT`, `BUILDING_RULES`, `STRATA_MINUTES`, `FINANCIAL_REPORT`, `INSURANCE`, `COMPLIANCE`, `NOTICE`, `OTHER`

| Procedure | Type | Auth | Input | Description |
|---|---|---|---|---|
| `listByBuilding` | query | protected | `buildingId, category?` | Filtered by category |
| `create` | mutation | manager | `buildingId, title, description?, category, fileUrl, fileSize, mimeType, isPublic?` | Create record |
| `delete` | mutation | manager | `id` | Hard delete |

### `users` (super-admin)
| Procedure | Type | Auth | Input | Description |
|---|---|---|---|---|
| `list` | query | SUPER_ADMIN | `search?` | All users with orgMemberships + active buildingAssignments |
| `assignToBuilding` | mutation | SUPER_ADMIN | `userId, organisationId, buildingId, role` | Upserts OrgMembership + BuildingAssignment |
| `createInvite` | mutation | SUPER_ADMIN | `email, organisationId, buildingId?, role` | Creates Invitation (7-day expiry), returns with token |
| `listInvites` | query | SUPER_ADMIN | `organisationId?` | Pending (non-expired, non-accepted) invites |
| `revokeInvite` | mutation | SUPER_ADMIN | `id` | Hard delete |
| `deactivateAssignments` | mutation | SUPER_ADMIN | `userId` | Sets all BuildingAssignments `isActive=false` |

---

## Building Context (Zustand)

```ts
// src/hooks/use-building-context.ts
// Persisted to localStorage key: "strata-hub-building"
const {
  selectedBuildingId,   // string | null
  selectedBuildingName, // string | null
  setSelectedBuilding,  // (id: string, name: string) => void
  clearSelectedBuilding // () => void
} = useBuildingContext();
```

**Auto-select:** `BuildingSwitcher` auto-selects when user has exactly one building (via `useEffect` on mount).

**`skipToken` pattern** — all building-scoped queries:

```ts
import { skipToken } from "@tanstack/react-query";

const query = trpc.residents.listByBuilding.useQuery(
  selectedBuildingId ? { buildingId: selectedBuildingId } : skipToken
);
```

Pages show a "select a building" prompt when `selectedBuildingId` is null.

---

## tRPC Client Config

```ts
// src/lib/trpc/provider.tsx
QueryClient config:
  staleTime: 5 * 60 * 1000  // 5 minutes
  refetchOnWindowFocus: false

tRPC link:
  httpBatchLink({ url: `${process.env.NEXT_PUBLIC_APP_URL}/api/trpc` })
  transformer: superjson
```

Cache invalidation after mutations: `utils.routerName.procedureName.invalidate()`

---

## Constants (`src/lib/constants.ts`)

```ts
APP_NAME                    // "StrataHub"
AUSTRALIAN_STATES           // [{ value, label }] for NSW, VIC, QLD, SA, WA, TAS, NT, ACT
USER_ROLE_LABELS            // Record<UserRole, string>
UNIT_TYPE_LABELS            // Record<UnitType, string>
MAINTENANCE_CATEGORY_LABELS // Record<MaintenanceCategory, string>
PRIORITY_LABELS             // Record<Priority, string>
BOND_LODGEMENT_AUTHORITIES  // Record<AustralianState, string>
BOND_LODGEMENT_DEADLINES_DAYS // Record<AustralianState, number>

formatCurrency(cents: number) // → "$1,234.56" AUD via Intl.NumberFormat
centsToDollars(cents: number) // → "$X.XX" string
dollarsToCents(dollars: number) // → integer cents
```

All monetary values stored as **cents** (integers) in DB. Always use `formatCurrency(cents)` for display.

---

## Data Model Summary

```
Organisation
  └── Building (many)
        ├── Unit (many)
        │     ├── Ownership (→ User)
        │     ├── Tenancy (→ User)
        │     │     └── RentPayment (many)
        │     ├── MaintenanceRequest (many)
        │     ├── ParkingSpot (many)
        │     └── StorageUnit (many)
        ├── BuildingAssignment (→ User, role)
        ├── VisitorEntry (many)
        ├── Parcel (many)
        ├── KeyRecord (many) → KeyLog (many)
        ├── Announcement (many)
        ├── Document (many)
        ├── FinancialRecord (many)
        └── StrataInfo (one)
              ├── StrataLevy (many)
              ├── StrataBylaw (many)
              └── StrataMeeting (many)

User
  ├── OrganisationMembership (→ Organisation, role)
  ├── BuildingAssignment (→ Building, role)
  ├── Ownership (→ Unit)
  ├── Tenancy (→ Unit)
  ├── EmergencyContact (many)
  ├── MaintenanceRequest (many, as requester)
  ├── MaintenanceComment (many)
  ├── Message (many, as sender)
  ├── Message (many, as recipient)
  ├── VisitorEntry (many, as registeredBy)
  ├── Parcel (many, as loggedBy)
  ├── Announcement (many, as author)
  ├── Document (many, as uploadedBy)
  └── KeyLog (many, as performedBy)

Invitation (standalone — no Prisma relations to org/building)
  Fields: email, organisationId, buildingId?, unitId?, role, token, expiresAt, acceptedAt
```

---

## Environment Variables

```bash
# Supabase session pooler URL (IPv4-safe — direct connection requires IPv6 or paid add-on)
# Username format: postgres.PROJECT_REF (not just postgres)
# Encode special chars in password: @ → %40, # → %23, $ → %24
DATABASE_URL="postgresql://postgres.PROJECT_REF:PASSWORD@aws-X-REGION.pooler.supabase.com:5432/postgres"

NEXT_PUBLIC_SUPABASE_URL="https://PROJECT_REF.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="..."   # Settings → API → anon/public key
SUPABASE_SERVICE_ROLE_KEY="..."       # Settings → API → service_role key (server-side only)

NEXT_PUBLIC_APP_URL="http://localhost:3000"  # Full URL — used in tRPC httpBatchLink for SSR
NEXT_PUBLIC_APP_NAME="StrataHub"
```

---

## Running the Project

```bash
cd strata-hub
npm run dev          # http://localhost:3000
npm run build        # type-check + production build
npm run lint         # ESLint
npm run db:seed      # Create super-admin + demo org/building (run once)

npx prisma generate  # Re-generate client after schema changes
npx prisma db push   # Push schema to Supabase (reads URL from prisma.config.ts)
npx prisma studio    # Prisma Studio GUI
```

### First-time setup
1. Set all 6 env vars in `.env`
2. `npx prisma generate`
3. `npx prisma db push`
4. `npm run db:seed`
5. `npm run dev`
6. Login: `admin@stratahub.com.au` / `Admin1234!`

### Seed account (local dev)
| | |
|---|---|
| Email | `admin@stratahub.com.au` |
| Password | `Admin1234!` |
| Role | `SUPER_ADMIN` |
| Org | StrataHub Demo Org |
| Building | Harbour View Apartments, Sydney NSW |

---

## Deployment (Vercel)

- **Root directory in Vercel:** set to `strata-hub` (app is in a subdirectory)
- **Build command:** default (`npm run build`) — Vercel runs `npm install` first which triggers `postinstall: prisma generate`
- **Generated client** (`src/generated/prisma`) is gitignored — regenerated on every deploy via postinstall
- **Add all 6 env vars** in Vercel → Settings → Environment Variables
- **After first deploy:** update `NEXT_PUBLIC_APP_URL` to the live Vercel URL, and set the same URL as Site URL in Supabase → Auth → URL Configuration

---

## Known Gaps / Remaining Work

- **`/reset-password` page missing** — `forgot-password` page calls `resetPasswordForEmail` with `redirectTo: '/reset-password'` but that page doesn't exist yet. Password reset emails will 404 on click.
- **Keys to Rotate stat** — Dashboard shows "—". The `keys` router is not called from the dashboard page.
- **Document file upload** — Documents page accepts a manually pasted URL. No Supabase Storage integration yet.
- **Strata levies** — Levies tab is a placeholder. `StrataLevy` model exists but no UI or router procedures manage it.
- **Notification bell** — Topbar shows a hardcoded "3" badge. No real notification system yet.
- **Root layout metadata** — `title` and `description` in `src/app/layout.tsx` are still the Next.js boilerplate defaults ("Create Next App"). Should be updated to StrataHub.
- **Email not implemented** — Resend is installed but never called. No transactional emails (parcel notifications, maintenance updates, etc.) are sent yet.
- **Middleware deprecation** — Next.js 16 prefers `proxy` over `middleware` convention. Low priority — still functional, just a build warning.
- **Email verification fallback** — If Supabase requires email confirmation, Prisma user is auto-created on first login using Supabase `user_metadata`. Invite acceptance in this flow is deferred — user must visit `/invite/[token]` while logged in to complete it.

---

## Architectural Decisions

1. **Server component layout + client pages** — `(dashboard)/layout.tsx` fetches buildings directly from Prisma (no HTTP tRPC layer). Page components that need Zustand state are client components.

2. **`skipToken` for conditional queries** — All building-scoped queries use `skipToken` (not `enabled: false`) when no building is selected.

3. **Cents for money** — All monetary values stored as integers in cents. `formatCurrency(cents)` formats as AUD.

4. **Dual-layer auth** — Supabase manages sessions + cookie refresh. Prisma stores app user with role data. Link: `User.supabaseAuthId = supabase auth UUID`.

5. **Zustand + localStorage for building context** — Survives page refresh. Auto-selects when exactly one building exists.

6. **Auto-create Prisma user** — On first tRPC call or dashboard load after email verification, both `createTRPCContext()` and the dashboard layout auto-create the Prisma user from Supabase metadata. Idempotent.

7. **Base UI render prop** — shadcn uses Base UI (`@base-ui/react`). Use `render={<Component />}` instead of `asChild`. Select `onValueChange` guards against `null`.

8. **Prisma 7 + driver adapter** — Connection URL in `prisma.config.ts` (for migrations). `PrismaPg` adapter passed to `PrismaClient` constructor (for queries). `postinstall: prisma generate` in `package.json` for Vercel.
