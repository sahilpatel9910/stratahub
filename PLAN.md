# StrataHub — Full Project Plan

> Last updated: 2026-04-18
> Status key: ✅ Done · 🔄 In Progress · ⬜ Pending

---

## What We're Building

StrataHub is an Australian property management SaaS for strata buildings. It lets property managers, reception staff, owners, and tenants manage everything about a building — from rent and maintenance to parcels, keys, announcements, and strata financials.

---

## Branch-by-Branch Roadmap

### ✅ Branch 1 — `feat/resident-messaging`
**Goal:** Give residents a messages page so they can contact building staff.

- Created `/resident/messages/page.tsx` — thread list + message view + compose dialog
- Recipients filtered to BUILDING_MANAGER + RECEPTION roles only (residents cannot message each other)
- Building ID resolved via `resident.getMyBuilding` (not `useBuildingContext`)
- Added unread badge to resident sidebar; polls `messaging.unreadCount` every 30s (capped at `99+`)
- **Merged to main** ✅

---

### ✅ Branch 2 — `feat/notification-completeness`
**Goal:** Fill in the missing in-app notification triggers so all key events notify the right people.

| Event | Who Gets Notified | Type | Gotcha |
|---|---|---|---|
| `maintenance.create` | All BUILDING_MANAGER + RECEPTION in the building | `MAINTENANCE_CREATED` | Fire-and-forget via `buildingAssignment.findMany` |
| `parcels.create` | Active owners + tenants matched by `unitNumber` string | `PARCEL_RECEIVED` | ⚠️ String match, not FK — unitNumber must match exactly |
| `announcements.create` | All active building owners + tenants | `ANNOUNCEMENT_PUBLISHED` | Uses `createMany` directly (bulk), not the `createNotification` helper |
| `users.createInvite` | Invited user only if they already have a Prisma User record | `INVITE_SENT` | Existing users only — new invitees get email only |

- **Merged to main** ✅

---

### ✅ Branch 3 — `feat/maintenance-images`
**Goal:** Allow residents and managers to attach photos to maintenance requests.

**Backend:**
- New API route: `POST /api/storage/maintenance-upload-url`
  - Auth: Supabase session required
  - Verifies caller owns/tenants the unit or has building management access
  - Creates signed PUT URL in a new `maintenance` Supabase Storage bucket (private)
  - Path: `{buildingId}/{requestId}/{userId}/{timestamp}-{safeName}`
- New tRPC procedure: `maintenance.addImage`
  - Input: `{ maintenanceRequestId, fileUrl, storagePath, filename, mimeType, fileSize }`
  - Auth: protected — verifies caller owns the request or has building management access
  - Creates `MaintenanceImage` record
- New tRPC procedure: `maintenance.deleteImage`
  - Input: `{ id }`
  - Auth: protected — verifies ownership
  - Deletes DB record (client calls `DELETE /api/storage/delete` for the file)

**Frontend:**
- Manager maintenance detail view — image gallery + upload button + delete
- Resident maintenance page — image upload when creating/viewing a request

**Schema change needed:**
```prisma
model MaintenanceImage {
  id                   String             @id @default(cuid())
  maintenanceRequestId String
  maintenanceRequest   MaintenanceRequest @relation(fields: [maintenanceRequestId], references: [id], onDelete: Cascade)
  uploadedById         String
  uploadedBy           User               @relation(fields: [uploadedById], references: [id])
  fileUrl              String
  storagePath          String
  filename             String
  mimeType             String
  fileSize             Int
  createdAt            DateTime           @default(now())
}
```

**Supabase bucket:** Create `maintenance` bucket (private) in Supabase dashboard before testing.

---

### ⬜ Branch 4 — `feat/bond-tracking`
**Goal:** Track rental bonds — lodgement, reference numbers, and status.

**Backend:**
- New tRPC router: `bond`
  - `getByTenancy` — query, manager, `tenancyId`
  - `upsert` — mutation, manager — `tenancyId, amountCents, lodgementDate?, lodgementAuthority?, referenceNumber?, status`
  - `release` — mutation, manager — `tenancyId, releasedDate, releaseReason?`

**Schema change needed:**
```prisma
model BondRecord {
  id                  String          @id @default(cuid())
  tenancyId           String          @unique
  tenancy             Tenancy         @relation(fields: [tenancyId], references: [id])
  amountCents         Int
  status              BondStatus      @default(HELD)
  lodgementDate       DateTime?
  lodgementAuthority  String?         // e.g. "NSW Fair Trading"
  referenceNumber     String?
  releasedDate        DateTime?
  releaseReason       String?
  createdAt           DateTime        @default(now())
  updatedAt           DateTime        @updatedAt
}

enum BondStatus { HELD LODGED RELEASED DISPUTED }
```

**Frontend:**
- Add Bond tab/section to `/manager/rent` page — shows bond status per tenancy
- Use `BOND_LODGEMENT_AUTHORITIES` and `BOND_LODGEMENT_DEADLINES_DAYS` from `constants.ts` for display

---

### ⬜ Branch 5 — `feat/strata-bylaws`
**Goal:** Let managers create and manage strata bylaws (rules of the building).

**Backend:**
- `strata.createBylaw` — mutation, manager — `buildingId, title, content, bylawNumber?, category?`
- `strata.updateBylaw` — mutation, manager — `id, title?, content?, bylawNumber?, category?`
- `strata.deleteBylaw` — mutation, manager — `id`
- `strata.getByBuilding` already returns `bylaws` — verify it's included in the select

**Frontend:**
- Add Bylaws tab to `/manager/strata` page
- Table of bylaws with number, title, category chip
- Inline edit dialog + delete
- Read-only view for residents on `/resident` or a new `/resident/bylaws` page

**Schema:** `StrataBylaw` already exists in Prisma schema (has `bylawNumber`, `title`, `content`, `category`, `strataInfoId`). No migration needed — just wire up the missing procedures and UI.

---

### ⬜ Branch 6 — `feat/common-areas`
**Goal:** Track common area facilities (gym, pool, rooftop etc.) and allow residents to book them.

**Backend:**
- New tRPC router: `commonAreas`
  - `listByBuilding` — query, protected, `buildingId`
  - `create` — mutation, manager — `buildingId, name, description?, capacity?, bookingRequired, operatingHours?`
  - `update` — mutation, manager — `id, ...fields`
  - `delete` — mutation, manager — `id`
  - `createBooking` — mutation, tenantOrAbove — `commonAreaId, startTime, endTime, notes?`
  - `listBookings` — query, protected — `commonAreaId, date?`
  - `cancelBooking` — mutation, protected — `id` (own bookings only; managers can cancel any)

**Schema change needed:**
```prisma
model CommonArea {
  id               String             @id @default(cuid())
  buildingId       String
  building         Building           @relation(fields: [buildingId], references: [id])
  name             String
  description      String?
  capacity         Int?
  bookingRequired  Boolean            @default(false)
  operatingHours   String?
  isActive         Boolean            @default(true)
  bookings         CommonAreaBooking[]
  createdAt        DateTime           @default(now())
}

model CommonAreaBooking {
  id           String     @id @default(cuid())
  commonAreaId String
  commonArea   CommonArea @relation(fields: [commonAreaId], references: [id])
  userId       String
  user         User       @relation(fields: [userId], references: [id])
  startTime    DateTime
  endTime      DateTime
  notes        String?
  status       BookingStatus @default(CONFIRMED)
  createdAt    DateTime   @default(now())
}

enum BookingStatus { CONFIRMED CANCELLED }
```

**Frontend:**
- New page: `/manager/common-areas` — list + create/edit/delete facilities
- New page: `/resident/common-areas` — browse facilities + create/cancel bookings

---

### ⬜ Branch 7 — `feat/invite-e2e-hardening`
**Goal:** Make the invite flow bulletproof and add integration test coverage.

- Add Supabase RLS policies to the `documents` and `maintenance` buckets (already documented in `docs/supabase-security.md`)
- Add integration tests for:
  - Root role redirect (`OWNER`/`TENANT` → `/resident`, manager → `/manager`, super-admin → `/super-admin/organisations`)
  - Building assignment scoping (user cannot access another building's data)
  - Document signed-download authorization
  - Messaging thread read/write authorization
  - Invite acceptance with wrong account shows error
  - Invite acceptance with expired token shows error
- Add `invite.resend` tRPC procedure — regenerates token + resends email (super-admin only)
- Validate invite token expiry is surfaced clearly in the UI (currently shows generic error)

---

### ⬜ Branch 8 — `feat/production-polish`
**Goal:** Final pass before production deploy.

- Error boundaries — wrap all major pages with React error boundaries so one failing query doesn't crash the whole page
- Loading skeletons — add skeleton loaders to all data-heavy tables (currently some pages flash empty states)
- Metadata — ensure all pages have proper `<title>` and `<meta description>` via Next.js `generateMetadata`
- Analytics page — replace the placeholder `/manager/analytics` with real trend charts:
  - Rent collected per month (last 6 months)
  - Maintenance requests by category and status
  - Occupancy rate over time
- Seed more realistic demo data so all summary cards and analytics surfaces show real numbers
- Final build verification:
  - `npm run build` passes with 0 errors
  - `npm run lint` passes with 0 warnings (fix pre-existing warnings)
  - `npm test` passes with all tests green
- Vercel deploy:
  - Set all env vars
  - Confirm `NEXT_PUBLIC_APP_URL` matches deployed URL
  - Confirm Supabase URL config matches
  - Confirm `documents` and `maintenance` Storage buckets exist (private)
  - Confirm Resend domain or fallback sender is configured

---

## Architecture Decisions (summary)

| Decision | What we chose | Why |
|---|---|---|
| Money | Cents (integers) in DB | Avoid floating point errors; `formatCurrency(cents)` for display |
| Auth | Supabase Auth + Prisma User record | Supabase handles sessions; Prisma holds app roles |
| Building context | Zustand + localStorage | Survives page refresh; auto-selects single building |
| Conditional queries | `skipToken` (not `enabled: false`) | TanStack Query v5 recommended pattern |
| Notification delivery | Fire-and-forget (`void` + `.catch`) | Primary mutation always succeeds even if notification fails |
| File uploads | Signed URL → direct S3 PUT | Files never go through Next.js server; Supabase Storage handles it |
| Component library | Base UI (`@base-ui/react`) not Radix | shadcn CLI chose Base UI — use `render={<Component />}` not `asChild` |
| Schema changes | `prisma db push` not `migrate dev` | Schema was bootstrapped with push; migrations folder has drift |
| Resident data scoping | No `buildingId` input on `resident.*` | Building resolved server-side from caller's memberships — prevents IDOR |

---

## Key Files

| File | Purpose |
|---|---|
| `CLAUDE.md` | Full technical reference — patterns, routers, routing, auth, stack |
| `PLAN.md` | This file — feature roadmap and branch tracking |
| `docs/supabase-security.md` | Security model, RLS posture, storage bucket setup |
| `prisma/schema.prisma` | Source of truth for data model |
| `src/server/trpc/router.ts` | AppRouter — combines all sub-routers |
| `src/server/trpc/trpc.ts` | Context + procedure guards |
| `src/server/auth/building-access.ts` | `assertBuildingAccess` / `assertBuildingManagementAccess` |
| `src/server/trpc/lib/create-notification.ts` | Fire-and-forget notification helper |
| `src/lib/constants.ts` | Labels, formatters, Australian state data |
