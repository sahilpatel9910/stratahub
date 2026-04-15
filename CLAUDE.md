@AGENTS.md

# StrataHub — Claude Code Context

> **Last updated: 2026-04-11** — Phase 2 complete. Phase 3 in progress: bug fixes from live testing session. See "Next Session Work" section at bottom for priority list.

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
| Email | Resend v6 (`src/lib/email/`) — levy notices, maintenance updates, invite emails |
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
│   │   │   ├── resident/            # Resident self-service portal
│   │   │   │   ├── layout.tsx           # Uses ResidentSidebar + Topbar (buildings=[])
│   │   │   │   ├── page.tsx             # Dashboard: stats + recent announcements
│   │   │   │   ├── levies/page.tsx      # Read-only levy history for owned units
│   │   │   │   ├── maintenance/page.tsx # Submit + track maintenance requests
│   │   │   │   ├── documents/page.tsx   # Public building documents (download only)
│   │   │   │   └── announcements/page.tsx
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
│   │   │   ├── resident-sidebar.tsx  # Resident portal sidebar (Home, Levies, Maintenance, Docs, Announcements)
│   │   │   ├── building-switcher.tsx
│   │   │   └── topbar.tsx            # Polls notifications.unreadCount every 30s; bell opens dropdown
│   │   └── ui/                 # shadcn/ui components (never edit directly)
│   ├── hooks/
│   │   ├── use-building-context.ts
│   │   └── use-mobile.ts
│   ├── lib/
│   │   ├── constants.ts
│   │   ├── email/
│   │   │   ├── resend.ts       # Lazy Resend client (getResend() to avoid build-time throw)
│   │   │   └── send.ts         # sendLevyNoticeEmail, sendMaintenanceUpdateEmail, sendWelcomeInviteEmail
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
│   │       ├── lib/
│   │       │   └── create-notification.ts  # Fire-and-forget helper called from mutations
│   │       └── routers/        # 17 domain routers
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
- `/forgot-password` — `supabase.auth.resetPasswordForEmail()` with `redirectTo: '/api/auth/callback?type=recovery'`
- `/reset-password` — `supabase.auth.updateUser({ password })`, auto-redirects to `/manager` on success

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
- `/manager/strata` — `strata.getByBuilding` + `strata.upsertInfo` + `strata.createMeeting` + `strata.deleteMeeting` + `strata.listLevies` + `strata.createLevy` + `strata.bulkCreateLevies` + `strata.updateLevyStatus` + `strata.deleteLevy`
- `/manager/financials` — `financials.listByBuilding` + `financials.getSummary` + `financials.create` + `financials.delete`
- `/manager/analytics` — `buildings.getStats` + `maintenance.listByBuilding` + `parcels.listByBuilding` + Recharts

### Resident routes (`/resident/**`)
Uses `ResidentSidebar`. Data is scoped to the user's own units/building — no building switcher.
- `/resident` — dashboard: welcome card, outstanding levy total, open maintenance count, recent announcements
- `/resident/levies` — `resident.getMyLevies` (read-only, filter by status)
- `/resident/maintenance` — `resident.getMyMaintenanceRequests` + `resident.createMaintenanceRequest` (unit ownership verified server-side)
- `/resident/documents` — `resident.getMyDocuments` (isPublic=true only, download links)
- `/resident/announcements` — `resident.getMyAnnouncements` (non-expired, read-only)

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

### `GET /api/auth/callback`
- **Auth:** Public
- **Query params:** `code`, `type` (e.g. `recovery`), `next`
- **Behaviour:** Exchanges Supabase PKCE code for a session via `exchangeCodeForSession(code)`. If `type=recovery` redirects to `/reset-password`, otherwise redirects to `next` (default `/manager`). On failure redirects to `/login?error=invalid_link`.
- **Used by:** Password reset emails, email verification links. Must be in Supabase "Redirect URLs" allowlist.

### `POST /api/storage/upload-url`
- **Auth:** Requires Supabase session
- **Body:** `{ filename: string, contentType: string, buildingId: string }`
- **Returns:** `{ signedUrl, path, publicUrl }`
- **Behaviour:** Uses service role key to create a signed PUT URL in the `documents` Supabase Storage bucket. Path: `{buildingId}/{userId}/{timestamp}-{safeName}`. Client PUTs the file directly to `signedUrl` — bytes never go through Next.js.

### `DELETE /api/storage/delete`
- **Auth:** Requires Supabase session
- **Body:** `{ path: string }`
- **Returns:** `{ ok: true }`
- **Behaviour:** Uses service role key to remove a file from the `documents` Storage bucket. Called automatically when a document is deleted from the UI.

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
| `getStats` | query | protected | `buildingId` | `totalUnits, occupiedUnits, residentCount, openMaintenanceCount, pendingParcelCount, overdueRentCount, keysToRotate, rentCollectedThisMonthCents, occupancyRate` |

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
Levy types: `ADMIN_FUND`, `CAPITAL_WORKS`, `SPECIAL_LEVY`
Payment statuses: `PENDING`, `PAID`, `OVERDUE`, `PARTIAL`, `WAIVED`

| Procedure | Type | Auth | Input | Description |
|---|---|---|---|---|
| `getByBuilding` | query | protected | `buildingId` | StrataInfo with levies, bylaws, meetings |
| `upsertInfo` | mutation | manager | `buildingId, strataPlanNumber, strataManagerName?, strataManagerEmail?, strataManagerPhone?, adminFundBalance?, capitalWorksBalance?, insurancePolicyNo?, insuranceExpiry?, nextAgmDate?` | Create or update |
| `createMeeting` | mutation | manager | `buildingId, title, meetingDate, location?, notes?` | Requires StrataInfo to exist first |
| `deleteMeeting` | mutation | manager | `id` | Hard delete |
| `listLevies` | query | protected | `buildingId, status?, levyType?` | Levies with `unitNumber` joined from units table |
| `createLevy` | mutation | manager | `buildingId, unitId, levyType, amountCents, quarterStart, dueDate` | Single unit levy |
| `bulkCreateLevies` | mutation | manager | `buildingId, levyType, amountCents, quarterStart, dueDate` | Creates one levy per unit in the building |
| `updateLevyStatus` | mutation | manager | `id, status, paidDate?` | Updates status; auto-sets `paidDate=now` when status=PAID |
| `deleteLevy` | mutation | manager | `id` | Hard delete |

### `documents`
Categories: `LEASE_AGREEMENT`, `BUILDING_RULES`, `STRATA_MINUTES`, `FINANCIAL_REPORT`, `INSURANCE`, `COMPLIANCE`, `NOTICE`, `OTHER`

File upload flow: client calls `POST /api/storage/upload-url` → PUTs file to `signedUrl` → calls `documents.create` with `publicUrl` + `storagePath`.

| Procedure | Type | Auth | Input | Description |
|---|---|---|---|---|
| `listByBuilding` | query | protected | `buildingId, category?` | Filtered by category |
| `create` | mutation | manager | `buildingId, title, description?, category, fileUrl, storagePath?, fileSize, mimeType, isPublic?` | Create record |
| `delete` | mutation | manager | `id` | Hard delete (storage file deleted via `DELETE /api/storage/delete` on client) |

### `users` (super-admin)
| Procedure | Type | Auth | Input | Description |
|---|---|---|---|---|
| `list` | query | SUPER_ADMIN | `search?` | All users with orgMemberships + active buildingAssignments |
| `assignToBuilding` | mutation | SUPER_ADMIN | `userId, organisationId, buildingId, role` | Upserts OrgMembership + BuildingAssignment |
| `createInvite` | mutation | SUPER_ADMIN | `email, organisationId, buildingId?, role` | Creates Invitation (7-day expiry) + fires invite email via Resend |
| `listInvites` | query | SUPER_ADMIN | `organisationId?` | Pending (non-expired, non-accepted) invites |
| `revokeInvite` | mutation | SUPER_ADMIN | `id` | Hard delete |
| `deactivateAssignments` | mutation | SUPER_ADMIN | `userId` | Sets all BuildingAssignments `isActive=false` |

### `notifications`
| Procedure | Type | Auth | Input | Description |
|---|---|---|---|---|
| `listRecent` | query | protected | `limit?` (default 20) | Latest notifications for current user, newest first |
| `unreadCount` | query | protected | — | Count of `isRead: false` for current user; polled every 30s by topbar |
| `markRead` | mutation | protected | `id` | Sets single notification `isRead: true` (only if owned by caller) |
| `markAllRead` | mutation | protected | — | Marks all unread notifications as read for current user |

**Notification types:** `LEVY_CREATED`, `MAINTENANCE_STATUS_UPDATED`, `MAINTENANCE_CREATED`, `ANNOUNCEMENT_PUBLISHED`, `PARCEL_RECEIVED`, `INVITE_SENT`

**Where notifications are created (fire-and-forget via `createNotification()` helper):**
- `strata.createLevy` → notifies active unit owners: `LEVY_CREATED`
- `strata.bulkCreateLevies` → notifies all active owners in building via `createMany`: `LEVY_CREATED`
- `maintenance.updateStatus` → notifies requester on status `ACKNOWLEDGED/IN_PROGRESS/SCHEDULED/COMPLETED/CANCELLED`: `MAINTENANCE_STATUS_UPDATED`

### `resident`
All procedures use `tenantOrAboveProcedure`. Data scoped to the calling user's units — no `buildingId` input.

| Procedure | Type | Auth | Input | Description |
|---|---|---|---|---|
| `getMyProfile` | query | tenantOrAbove | — | User with active ownerships, tenancies, building assignments |
| `getMyBuilding` | query | tenantOrAbove | — | Primary building (ownership → tenancy → assignment fallback) |
| `getMyLevies` | query | tenantOrAbove | `status?` | Levies for owned units only; tenants get empty array |
| `getMyMaintenanceRequests` | query | tenantOrAbove | `status?` | Requests where `requestedById = caller` |
| `createMaintenanceRequest` | mutation | tenantOrAbove | `unitId, title, description, category, priority?` | Verifies caller owns/tenants the unit before creating |
| `getMyDocuments` | query | tenantOrAbove | `category?` | `isPublic: true` documents for caller's building |
| `getMyAnnouncements` | query | tenantOrAbove | — | Non-expired announcements for caller's building |

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

Notification
  Fields: userId (→ User), type (NotificationType), title, body?, linkUrl?, isRead, createdAt
  Indexes: [userId, isRead], [userId, createdAt]
  Created by: createNotification() helper in src/server/trpc/lib/create-notification.ts
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

# Email (Resend) — required for transactional emails
RESEND_API_KEY="re_..."                    # Resend dashboard → API Keys
RESEND_FROM_EMAIL="noreply@yourdomain.com" # Verified sender; falls back to onboarding@resend.dev on free tier
```

**Resend free tier:** 3,000 emails/month, 100/day. Until a domain is verified in Resend, all emails must come from `onboarding@resend.dev` (set as fallback). Add `RESEND_API_KEY` and `RESEND_FROM_EMAIL` to Vercel env vars for production.

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
1. Set all env vars in `.env` (6 core + 2 Resend for emails)
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

- **Analytics page** — Placeholder exists at `/manager/analytics`. Has basic Recharts setup but no real trend data (only point-in-time stats).
- **Middleware deprecation** — Next.js 16 prefers `proxy` over `middleware` convention. Low priority — still functional, just a build warning.
- **Email verification + invite flow** — If Supabase requires email confirmation, Prisma user is auto-created on first login. Invite acceptance is deferred — user must visit `/invite/[token]` while logged in.
- **Supabase Storage bucket** — Must exist in Supabase dashboard with bucket name `documents`, set to **private**. Reads should happen through signed URLs created server-side after authorization checks.
- **Resend domain verification** — Until a custom domain is verified in Resend, emails send from `onboarding@resend.dev`. Add RESEND_API_KEY + RESEND_FROM_EMAIL to Vercel env vars for production.
- **Resident portal role redirect** — OWNER/TENANT who land on `/manager` are not automatically redirected to `/resident`. They see the manager UI. Phase 3 should add role detection + redirect.

### Completed (no longer gaps)
- ✅ `/reset-password` page + `/api/auth/callback` route — password reset flow fully working
- ✅ Keys to Rotate dashboard stat — wired to `buildings.getStats` (active KeyRecords where `rotationDue <= now`)
- ✅ Document file upload — drag-and-drop to Supabase Storage via signed URL; `storagePath` stored for cleanup on delete
- ✅ Strata levies — full UI: bulk raise, individual levy, mark paid/overdue, summary cards, delete
- ✅ Root layout metadata — updated to "StrataHub — Property Management"
- ✅ Transactional emails — Resend integration: levy notices, maintenance status updates, invite emails (fire-and-forget, HTML-escaped)
- ✅ Notification bell — `Notification` model, `notifications` tRPC router, topbar polls every 30s, dropdown with mark-read
- ✅ Resident self-service portal — `/resident/**` pages: dashboard, levies, maintenance, documents, announcements

---

## ⚡ Next Session — Priority Bug List (Phase 3)

> Start here in the next session. Work through these in order. Do not move to new features until all bugs are fixed.

### 🔴 CRITICAL — Fix First

**1. Resident portal: double topbar + wrong topbar content**
- **Root cause:** `(dashboard)/resident/layout.tsx` is nested inside `(dashboard)/layout.tsx`. Both render a `<Topbar>`. This causes TWO topbars to stack.
- **Fix:** Remove `<Topbar>` from `src/app/(dashboard)/resident/layout.tsx` entirely. The dashboard layout's topbar is shared.
- **Also:** In `src/components/layout/topbar.tsx`, hide the building switcher on `/resident/**` routes (same pattern as `/super-admin/**`). Add `|| pathname.startsWith("/resident")` to the `isSuperAdminPage` check (or rename the variable to `hideSwitcher`).
- **File:** `src/app/(dashboard)/resident/layout.tsx` and `src/components/layout/topbar.tsx`

**2. Building selector shows raw CUID instead of building name**
- **Root cause:** When `buildings=[]` is passed to `BuildingSwitcher` (resident topbar passes empty array) but a `selectedBuildingId` is stored in Zustand/localStorage, `itemToStringLabel` can't find the building in the empty array and falls back to returning the raw CUID.
- **Fix:** This goes away once fix #1 is done (resident portal won't show building switcher at all). But also add a guard in `BuildingSwitcher`: if `buildings.length === 0`, render nothing.
- **File:** `src/components/layout/building-switcher.tsx`

### 🔴 CRITICAL — Access Control (Manager Role)

**3. Manager can see all buildings, should only see assigned buildings**
- **Current behaviour:** The topbar building switcher shows ALL buildings a user is assigned to. A manager assigned to "Harbour View Apartments" should ONLY see that building in the switcher — not other buildings in the org.
- **Current code in `(dashboard)/layout.tsx`:** For non-super-admin, it fetches `buildingAssignment.findMany({ where: { userId, isActive: true } })` — this is already correct (only assigned buildings).
- **Actual issue:** The `buildings.list` tRPC query (used in super-admin pages) returns all buildings for super-admin, but for managers it should return only their assigned ones. Check `src/server/trpc/routers/buildings.ts` `list` procedure — it already scopes to user's assignments for non-SUPER_ADMIN. Verify this is working end-to-end.
- **Also verify:** When a manager logs in, the building switcher should auto-select their single assigned building and NOT show buildings from other orgs.

**4. Role-based redirect on login**
- **Current behaviour:** OWNER and TENANT users who log in land on `/manager` (the building manager dashboard). They should be redirected to `/resident` automatically.
- **Fix:** In `src/app/page.tsx` (root redirect) or middleware, detect if the user's highest role is OWNER or TENANT and redirect to `/resident` instead of `/manager`.
- **How to detect role:** In the root page or middleware, fetch the Prisma user's `orgMemberships` and check the highest role. If max role is TENANT or OWNER → `/resident`. Otherwise → `/manager`.

### 🟡 IMPORTANT — UI/UX Issues

**5. Resident portal frontend design**
- The resident portal UI is described by the user as very poor. Needs a full redesign of:
  - `/resident/page.tsx` — dashboard
  - `/resident/levies/page.tsx`
  - `/resident/maintenance/page.tsx`
  - `/resident/documents/page.tsx`
  - `/resident/announcements/page.tsx`
- Design goals: clean card-based layout, better spacing, proper empty states, consistent with manager portal style but simpler/friendlier for residents.

**6. "Remove from All Buildings" button label is misleading**
- Label says "Remove from All Buildings" but it now also deactivates `User.isActive`. Consider renaming to "Deactivate User" to be accurate.
- **File:** `src/app/(dashboard)/super-admin/users/page.tsx`

### 🟡 IMPORTANT — Testing Remaining Pages

After fixing the above bugs, continue testing these manager pages that were not yet verified:
- `/manager/residents` — residents list, role filter
- `/manager/rent` — rent roll, record payment
- `/manager/keys` — key list, issue/return/deactivate
- `/manager/maintenance` — maintenance requests, status update
- `/manager/visitors` — visitor log, arrival/departure
- `/manager/parcels` — parcel tracking
- `/manager/announcements` — create/delete announcements
- `/manager/documents` — upload/delete documents
- `/manager/strata` — strata info, levies, meetings
- `/manager/financials` — income/expense records
- `/manager/messages` — messaging threads
- Resident portal pages — levies, maintenance, documents, announcements

### 🟢 NICE TO HAVE

**7. Resident portal role redirect on login**
- Middleware should redirect OWNER/TENANT to `/resident` and BUILDING_MANAGER/RECEPTION to `/manager` automatically after login.

**8. Manager dashboard showing "0 residents"**
- The resident user (Sahil Patel, Owner) assigned to StrataHub Demo Org has no unit assignment, so resident count shows 0. Need to assign the user to a unit for accurate stats.

---

### Commits made this session (for reference)
- `ae64c67` — Fix TypeScript error: itemToStringLabel must return string
- `9fc84eb` — Building switcher: group by org, hide on super-admin pages
- `5624cb9` — Replace building switcher with two separate org + building selects
- `30b74cf` — Also set User.isActive=false when removing user from all buildings
- `368fef1` — Fix invite acceptance: block wrong-account, role-based redirect after accept

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

9. **Supabase Storage upload pattern** — Files never go through Next.js. Flow: `POST /api/storage/upload-url` (service role creates signed URL after building-management authorization) → client `PUT` directly to Supabase → tRPC saves DB record with `storagePath`. Reads use a short-lived signed URL from `documents.getDownloadUrl`. Bucket: `documents` (private).

10. **Building-scoped authorization pattern** — Do not trust caller-supplied `buildingId` or record IDs by role alone. Resolve the building from the target record and enforce either building access (read) or building management access (write/admin) before querying or mutating.

11. **`prisma db push` not `migrate dev`** — Schema was bootstrapped with `db push`, not migrations. The `migrations/` folder has drift. Always use `npx prisma db push` to apply schema changes, then `npx prisma generate`.

12. **Fire-and-forget for emails and notifications** — Email sends and notification creates are called with `void` inside mutations. Failures are caught and logged server-side but never surfaced to the client. This means the primary mutation (create levy, update status) always succeeds even if Resend is down. All user-controlled strings are HTML-escaped before insertion into email templates.

13. **Lazy Resend client** — `new Resend(key)` throws at module load if the key is missing. The client is wrapped in `getResend()` which initialises lazily on first call, using `"re_placeholder"` as fallback. This prevents build-time failures. Set `RESEND_API_KEY` in `.env` and Vercel env vars for emails to actually send.

14. **Resident router uses unit membership to scope data** — The `resident.*` procedures do NOT accept a `buildingId` input. Building and unit IDs are derived server-side from the caller's active `Ownership` or `Tenancy` records. `createMaintenanceRequest` verifies `unitId` against the caller's active memberships before creating to prevent IDOR.

15. **Notification topbar polling** — `notifications.unreadCount` is polled every 30 seconds via `refetchInterval`. The `listRecent` query is only fetched when the bell dropdown is open (`enabled: bellOpen`). Both are invalidated after `markRead` and `markAllRead`.



# updated this with codex agent

Updated the frontend on `codex/frontendimprovement` with a shared visual refresh across auth, dashboard chrome, and core manager/resident landing pages.

Main UI changes:
- Reworked global design tokens in [globals.css](/Users/sahil/Desktop/calude code vs/Project 1/strata-hub/src/app/globals.css): new light neutral/blue palette, softer cards, shared panel utilities, toned-down workspace backdrop, and sidebar styling utilities.
- Switched typography in [layout.tsx](/Users/sahil/Desktop/calude code vs/Project 1/strata-hub/src/app/layout.tsx) from Geist to `Plus Jakarta Sans` + `JetBrains Mono`, and fixed font-token wiring in `globals.css`.
- Redesigned auth shell in [src/app/(auth)/layout.tsx](/Users/sahil/Desktop/calude code vs/Project 1/strata-hub/src/app/(auth)/layout.tsx) and [login/page.tsx](/Users/sahil/Desktop/calude code vs/Project 1/strata-hub/src/app/(auth)/login/page.tsx) with a more polished split layout and updated sign-in card.
- Updated shared dashboard shell in [src/app/(dashboard)/layout.tsx](/Users/sahil/Desktop/calude code vs/Project 1/strata-hub/src/app/(dashboard)/layout.tsx) and [src/app/(dashboard)/resident/layout.tsx](/Users/sahil/Desktop/calude code vs/Project 1/strata-hub/src/app/(dashboard)/resident/layout.tsx) to use the shared app shell/backdrop classes.
- Reworked top navigation in [topbar.tsx](/Users/sahil/Desktop/calude code vs/Project 1/strata-hub/src/components/layout/topbar.tsx): improved search, notifications dropdown, and mobile building-switcher presentation.
- Restyled [building-switcher.tsx](/Users/sahil/Desktop/calude code vs/Project 1/strata-hub/src/components/layout/building-switcher.tsx) and removed the lint-triggering sync effect by deriving selected org from state/building context.
- Redesigned [app-sidebar.tsx](/Users/sahil/Desktop/calude code vs/Project 1/strata-hub/src/components/layout/app-sidebar.tsx) and [resident-sidebar.tsx](/Users/sahil/Desktop/calude code vs/Project 1/strata-hub/src/components/layout/resident-sidebar.tsx) into a floating, more modern sidebar with cleaner nav states; later removed extra “workspace / mode” info cards and fixed section-label alignment so labels do not wrap awkwardly.
- Rebuilt [manager/page.tsx](/Users/sahil/Desktop/calude code vs/Project 1/strata-hub/src/app/(dashboard)/manager/page.tsx) into a more editorial operations dashboard with hero summary, stat panels, priority actions, announcements, and maintenance sections.
- Rebuilt [resident/page.tsx](/Users/sahil/Desktop/calude code vs/Project 1/strata-hub/src/app/(dashboard)/resident/page.tsx) to match the new design language with cleaner status cards and announcements.

Non-visual code changes made to keep checks passing:
- Fixed React 19 `set-state-in-effect` lint issues in [manager/settings/page.tsx](/Users/sahil/Desktop/calude code vs/Project 1/strata-hub/src/app/(dashboard)/manager/settings/page.tsx) by removing effect-based form seeding and using draft state derived from loaded user data.
- Fixed the same pattern in [manager/strata/page.tsx](/Users/sahil/Desktop/calude code vs/Project 1/strata-hub/src/app/(dashboard)/manager/strata/page.tsx) by moving dialog form seeding into the dialog open handler instead of `useEffect`.

Git/branch notes:
- Deleted old conflicting `codex` branch so requested branch name could exist.
- All work was committed and pushed only to `codex/frontendimprovement`.
- Latest visible polish commits included backdrop tuning, sidebar/typography refresh, sidebar simplification, and section-label alignment fixes.

Verification notes:
- `npm run lint -- .` passes with warnings only; remaining warnings are pre-existing unrelated files.
- `npm run build` was blocked in sandbox because `next/font/google` could not fetch fonts over restricted network, not because of app code errors.

# updated this with codex agent - security hardening

Implemented a first-pass security hardening sweep across authz, storage, and document access.

Security changes:
- Added shared building access and building management authorization helpers so building-scoped tRPC routes no longer trust caller-supplied IDs by role alone.
- Hardened building-scoped routers including maintenance, strata, documents, buildings, units, visitors, parcels, keys, financials, announcements, rent, and residents against cross-building access.
- Updated the tRPC auth context to load only active memberships and assignments.
- Locked down storage service-role routes so upload URLs require building-management access and document deletion no longer accepts arbitrary storage paths.
- Moved document delivery away from public URLs to short-lived signed URLs returned by `documents.getDownloadUrl`.
- Reduced public invite token exposure by removing unnecessary fields from the invite API response.
- Added [docs/supabase-security.md](/Users/sahil/Desktop/calude code vs/Project 1/strata-hub/docs/supabase-security.md) to document the current security model, RLS posture, private storage bucket requirement, and the safe pattern for new building-scoped features.

Verification notes:
- `npx tsc --noEmit` passes.
- `npm run lint` passes with warnings only; remaining warnings are pre-existing unrelated files.

# updated this with codex agent - phase 1 verification fixes

Closed the first round of workflow blockers found during the verification sweep while keeping the app free-tier friendly and preserving the existing security hardening.

Verification fixes:
- Secured `messaging.getThread` so thread reads are limited to the current thread participants instead of trusting a raw `threadId`.
- Hardened `messaging.send` so replies cannot be attached to unrelated threads and users cannot message themselves.
- Fixed manager messaging UI in [src/app/(dashboard)/manager/messages/page.tsx](/Users/sahil/Desktop/calude code vs/Project 1/strata-hub/src/app/(dashboard)/manager/messages/page.tsx) so:
  - reply routing targets the actual other participant
  - thread previews show the correct counterpart instead of often showing the current user
  - new message compose uses a selected-building resident picker instead of a raw user ID input
- Fixed the resident maintenance request flow in [src/app/(dashboard)/resident/maintenance/page.tsx](/Users/sahil/Desktop/calude code vs/Project 1/strata-hub/src/app/(dashboard)/resident/maintenance/page.tsx) so residents with exactly one unit can submit requests without being blocked by a hidden unit selector.
- Fixed the units create dialog in [src/app/(dashboard)/manager/units/page.tsx](/Users/sahil/Desktop/calude code vs/Project 1/strata-hub/src/app/(dashboard)/manager/units/page.tsx) to expose the existing `storageSpaces` field in the UI instead of silently submitting the default value.

Verification notes:
- Changes were implemented without adding any paid services or paid-tier dependencies.
- This session focused on code-level fixes only; no new infra, storage products, or external integrations were introduced.

# updated this with codex agent - notification and form usability fixes

Fixed the shared notification overlay and the most fragile modal form patterns that were causing clipped panels, hidden actions, and cramped fields across the manager and resident workspace.

UI/system fixes:
- Moved the notification dropdown in [src/components/layout/topbar.tsx](/Users/sahil/Desktop/calude code vs/Project 1/strata-hub/src/components/layout/topbar.tsx) into a portal-backed fixed overlay so it is no longer clipped under page content or layout containers.
- Upgraded the shared dialog shell in [src/components/ui/dialog.tsx](/Users/sahil/Desktop/calude code vs/Project 1/strata-hub/src/components/ui/dialog.tsx) with:
  - a safer viewport-aware max height
  - a flex column layout for long forms
  - a stronger bordered header
  - a persistent footer area that stays visible instead of visually falling out of the modal
- Strengthened shared form controls in:
  - [src/components/ui/input.tsx](/Users/sahil/Desktop/calude code vs/Project 1/strata-hub/src/components/ui/input.tsx)
  - [src/components/ui/textarea.tsx](/Users/sahil/Desktop/calude code vs/Project 1/strata-hub/src/components/ui/textarea.tsx)
  - [src/components/ui/select.tsx](/Users/sahil/Desktop/calude code vs/Project 1/strata-hub/src/components/ui/select.tsx)
  so fields now read as active controls on white/light surfaces instead of fading into the background.

Form/layout fixes:
- Reworked the manager document upload, manager message compose, and manager announcement publish dialogs so they use a wider modal, stronger spacing, larger controls, and action buttons that stay visible.
- Updated the manager messages reply area so the send action is a full labeled button (`Send reply`) instead of a tiny icon-only button that can disappear visually.
- Shifted the split-form breakpoint from `lg` to `xl` on the modal-heavy pages so guidance sidebars no longer squeeze primary fields on common laptop widths. This was applied to:
  - manager documents
  - manager messages
  - manager announcements
  - manager maintenance
  - manager visitors
  - manager parcels
  - manager financials
  - manager units
  - resident maintenance

Verification notes:
- `npx tsc --noEmit` passes.
- `npm run lint` still passes with only the same three older warnings in `manager/rent/page.tsx` and `server/trpc/routers/users.ts`.
- No paid-tier features or new external services were introduced; all fixes remain free-tier friendly.
