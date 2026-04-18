@AGENTS.md

# StrataHub — Claude Code Context

> **Last updated: 2026-04-17** — Phase 3 active on `feat/phase3-features`.

## Project Overview

Australian strata/apartment property management SaaS for building managers, reception, owners, tenants, and super-admins.
Live: `stratahub-six.vercel.app`

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
│   │   │   │   ├── announcements/page.tsx
│   │   │   │   └── messages/page.tsx    # Thread list + view + compose; staff-only recipients
│   │   │   └── super-admin/
│   │   │       ├── organisations/page.tsx
│   │   │       ├── buildings/page.tsx
│   │   │       └── users/page.tsx
│   │   ├── api/
│   │   │   ├── auth/create-user/route.ts   # POST: creates Prisma User after Supabase signUp
│   │   │   ├── invite/[token]/route.ts     # GET: public fetch of invite details by token
│   │   │   ├── invite/accept/route.ts      # POST: accept invite → OrgMembership + BuildingAssignment (+ Ownership for unit-linked owner invites)
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
│   │   │   ├── resident-sidebar.tsx  # Resident portal sidebar (Home, Levies, Maintenance, Docs, Announcements, Messages with unread badge)
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
- `/resident/messages` — `messaging.listThreads` + `messaging.getThread` + `messaging.send` + `messaging.markRead`; recipients filtered client-side to BUILDING_MANAGER + RECEPTION roles only (residents cannot message each other); building ID resolved via `resident.getMyBuilding` (not `useBuildingContext`); unread badge in sidebar polls `messaging.unreadCount` every 30s

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
- **Behaviour:** Upserts `OrganisationMembership`, creates `BuildingAssignment` (if buildingId set), activates `Ownership` when the invite is a unit-linked owner invite, then marks `Invitation.acceptedAt`. Validates: exists, not already accepted, not expired.

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

### `POST /api/storage/maintenance-upload-url`
- **Auth:** Requires Supabase session
- **Body:** `{ filename: string, contentType: string, maintenanceRequestId: string }`
- **Returns:** `{ signedUrl, path }`
- **Behaviour:** Verifies caller owns the maintenance request OR has building management access for the building. Creates signed PUT URL in the `maintenance` bucket. Path: `{buildingId}/{requestId}/{timestamp}-{safeName}`. ⚠️ Bucket `maintenance` must exist in Supabase dashboard (private).

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
| `create` | mutation | manager | `buildingId, unitNumber, unitType, bedrooms?, bathrooms?, parkingSpaces, storageSpaces, squareMetres?, lotNumber?, unitEntitlement?, ownerFirstName, ownerLastName, ownerEmail, ownerPhone` | Create unit with mandatory owner details; links an existing owner immediately or creates a unit-scoped owner invite |
| `assignResident` | mutation | manager | `unitId, residentUserId, role, purchaseDate?, leaseStartDate?, leaseEndDate?, rentAmountCents?, rentFrequency?, bondAmountCents?, moveInDate?` | Assign a specific unit to an owner or tenant; tenant assignment requires lease details |
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
| `listByBuilding` | query | protected | `buildingId, status?, priority?` | Filtered requests with `_count.images` |
| `getById` | query | protected | `id` | Full request with images (signed URLs in `displayUrl`) and comments |
| `create` | mutation | tenantOrAbove | `unitId, title, description, category, priority?` | Submit request |
| `updateStatus` | mutation | manager | `id, status` | Auto-sets `completedDate` if status=COMPLETED |
| `assign` | mutation | manager | `id, assignedTo` | Assign + set status=ACKNOWLEDGED |
| `addComment` | mutation | protected | `maintenanceRequestId, content` | Adds comment as current user |
| `addImage` | mutation | protected | `maintenanceRequestId, storagePath, caption?` | Saves image record; caller must own request or be building manager |
| `deleteImage` | mutation | protected | `id` | Removes from Supabase Storage + deletes DB record |

**Image upload flow:**
1. Client POSTs to `POST /api/storage/maintenance-upload-url` (`{ filename, contentType, maintenanceRequestId }`) → receives `{ signedUrl, path }`
2. Client PUTs file directly to `signedUrl`
3. Client calls `maintenance.addImage` with `{ maintenanceRequestId, storagePath: path }`

**Image display:** `getById` generates signed 1-hour URLs via `adminClient.storage.from('maintenance').createSignedUrls()` and returns them as `image.displayUrl`. Bucket: `maintenance` (private). ⚠️ Create this bucket in Supabase dashboard before testing.

**`MaintenanceImage.imageUrl`** stores the same value as `storagePath` (required field, semantic: storage path not a public URL).

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
- `strata.createLevy` → active unit owners: `LEVY_CREATED`
- `strata.bulkCreateLevies` → all active owners in building via `createMany`: `LEVY_CREATED`
- `maintenance.updateStatus` → requester on `ACKNOWLEDGED/IN_PROGRESS/SCHEDULED/COMPLETED/CANCELLED`: `MAINTENANCE_STATUS_UPDATED`
- `maintenance.create` → all `BUILDING_MANAGER` + `RECEPTION` assignments for the building: `MAINTENANCE_CREATED`
- `parcels.create` → active owners + tenants matched by `unitNumber` string (not FK): `PARCEL_RECEIVED` ⚠️ unitNumber is a string match, not a relation
- `announcements.create` → all active building owners + tenants via `createMany` directly (not helper, bulk): `ANNOUNCEMENT_PUBLISHED`
- `users.createInvite` → invited user only if they already have a Prisma User record: `INVITE_SENT`

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
- **Automated regression coverage** — Core flows have been manually iterated on, but the repo still lacks meaningful first-party test coverage around auth redirects, building access scoping, document delivery, and messaging permissions.
- **End-to-end verification pass** — Manager, resident, and super-admin surfaces are present and visually refreshed, but several flows still need a structured QA sweep in a realistic seeded environment.

### Completed (no longer gaps)
- ✅ Resident messaging page (`/resident/messages`) — thread list, message view, compose dialog; recipients filtered to staff only; unread badge in sidebar with 30s polling
- ✅ Notification completeness — `maintenance.create` → BUILDING_MANAGER/RECEPTION; `parcels.create` → unit residents (string unitNumber match); `announcements.create` → all building residents (bulk createMany); `users.createInvite` → existing users only (INVITE_SENT)
- ✅ `/reset-password` page + `/api/auth/callback` route — password reset flow fully working
- ✅ Keys to Rotate dashboard stat — wired to `buildings.getStats` (active KeyRecords where `rotationDue <= now`)
- ✅ Document file upload — drag-and-drop to Supabase Storage via signed URL; `storagePath` stored for cleanup on delete
- ✅ Strata levies — full UI: bulk raise, individual levy, mark paid/overdue, summary cards, delete
- ✅ Root layout metadata — updated to "StrataHub — Property Management"
- ✅ Transactional emails — Resend integration: levy notices, maintenance status updates, invite emails (fire-and-forget, HTML-escaped)
- ✅ Notification bell — `Notification` model, `notifications` tRPC router, topbar polls every 30s, dropdown with mark-read
- ✅ Resident self-service portal — `/resident/**` pages: dashboard, levies, maintenance, documents, announcements
- ✅ Root-level role redirect — `OWNER`/`TENANT` users are redirected to `/resident`, manager roles to `/manager`, and super-admins to `/super-admin/organisations`
- ✅ Building access hardening — building-scoped tRPC routes now verify access from resolved records instead of trusting caller-supplied IDs
- ✅ Private document delivery — documents now download through short-lived signed URLs after authorization checks
- ✅ Phase 1 workspace polish — dashboard shell, topbar, sidebars, dialog ergonomics, form controls, and manager/resident landing experiences have been refreshed on `phase1/ui-stabilization`

---

## Current Phase

### Phase 3 completions
- ✅ Maintenance image attachments — `addImage`, `deleteImage`, signed URL display via private `maintenance` bucket; both manager and resident pages have click-to-detail dialog with photo gallery + upload/delete
- ✅ Analytics 6-month trend charts via `buildings.getTrends`
- ✅ "Deactivate User" rename
- ✅ `/api/auth/signout` open redirect fix
- ✅ Resident docs/announcements fallback fix
- ✅ Invite lifecycle now uses `revokedAt` instead of hard deletes, with resend support and status/history UI
- ✅ Super-admin UI can now invite other `SUPER_ADMIN` users
- ✅ Resident invites are unit-scoped; owner accepts create ownership and tenant accepts create tenancy placeholders
- ✅ `RECEPTION` is now separated from `BUILDING_MANAGER`: reception is operations-only (`assertBuildingOperationsAccess`), managers keep admin/control workflows (`assertBuildingManagementAccess`)
- ✅ Rent now includes a “Complete Tenant Setup” flow for invite-created tenancy placeholders
- ✅ Auth redirect decisions extracted into `src/lib/auth/redirects.ts` with tests
- ✅ Next.js warning cleanup: `src/proxy.ts` replaces `src/middleware.ts`, and `next.config.ts` sets `turbopack.root`

Next priorities:
- Live invite-only E2E verification against Supabase email flow
- Route/API coverage for invite acceptance behavior
- Manual Supabase hardening: disable open signup in dashboard

## Quick Start

```bash
cd strata-hub
npx prisma generate
npx prisma db push
npm run dev
```

Seed account: `admin@stratahub.com.au` / `Admin1234!` (SUPER_ADMIN)

## Reference Docs

Read only the relevant doc:
- `docs/context/routers.md` — tRPC procedure inputs/outputs and API routes
- `docs/context/schema.md` — data model and field names
- `docs/context/auth.md` — invite-only auth flow, redirects, proxy behavior
- `docs/context/structure.md` — project layout and routing map
- `docs/context/architecture.md` — app patterns like `skipToken` and building auth
- `docs/context/deployment.md` — env vars, Vercel, production checklist
- `docs/supabase-security.md` — security model, RLS posture, storage setup
