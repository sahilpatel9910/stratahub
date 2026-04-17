# StrataHub — tRPC Router Reference

All routers in `src/server/trpc/routers/`. Combined in `src/server/trpc/router.ts`.

## Procedure Guards

| Procedure | Allowed roles |
|---|---|
| `publicProcedure` | Anyone |
| `protectedProcedure` | Any authenticated user with a Prisma record |
| `tenantOrAboveProcedure` | TENANT, OWNER, RECEPTION, BUILDING_MANAGER, SUPER_ADMIN |
| `managerProcedure` | RECEPTION, BUILDING_MANAGER, SUPER_ADMIN |
| `buildingManagerProcedure` | BUILDING_MANAGER, SUPER_ADMIN |
| `ownerProcedure` | OWNER, BUILDING_MANAGER, SUPER_ADMIN |
| `superAdminProcedure` | SUPER_ADMIN only |

---

## `organisations`
| Procedure | Type | Auth | Input | Description |
|---|---|---|---|---|
| `list` | query | SUPER_ADMIN | — | All orgs with `_count.buildings`, `_count.members` |
| `getById` | query | protected | `id` | Single org with buildings and members |
| `create` | mutation | SUPER_ADMIN | `name, abn?, state` | Create org |
| `update` | mutation | SUPER_ADMIN | `id, name?, abn?, state?, isActive?` | Update fields |
| `delete` | mutation | SUPER_ADMIN | `id` | Hard delete |

## `buildings`
| Procedure | Type | Auth | Input | Description |
|---|---|---|---|---|
| `list` | query | protected | — | SUPER_ADMIN gets all; others get assigned only |
| `getById` | query | protected | `id` | Full detail with units, floors, strataInfo |
| `create` | mutation | SUPER_ADMIN | `organisationId, name, address, suburb, state, postcode, totalFloors, totalUnits, strataSchemeNo?` | Create building |
| `update` | mutation | buildingManager | `id, ...fields` | Update fields |
| `delete` | mutation | SUPER_ADMIN | `id` | Hard delete |
| `getStats` | query | manager | `buildingId` | `totalUnits, occupiedUnits, residentCount, openMaintenanceCount, pendingParcelCount, overdueRentCount, keysToRotate, rentCollectedThisMonthCents, occupancyRate` |
| `getTrends` | query | buildingManager | `buildingId` | Last 6 months: `month, maintenanceRequests, parcelsReceived, rentCollectedCents, newResidents` |

## `units`
Unit types: `APARTMENT, STUDIO, PENTHOUSE, TOWNHOUSE, COMMERCIAL, STORAGE, PARKING`

| Procedure | Type | Auth | Input | Description |
|---|---|---|---|---|
| `listByBuilding` | query | protected | `buildingId` | Units with ownerships, tenancies, parking, storage |
| `getById` | query | protected | `id` | Full unit with 12-month rent history |
| `create` | mutation | buildingManager | `buildingId, unitNumber, unitType, bedrooms?, bathrooms?, parkingSpaces, storageSpaces, squareMetres?, lotNumber?, unitEntitlement?, ownerFirstName, ownerLastName, ownerEmail, ownerPhone` | Creates unit + owner link or owner invite |
| `assignResident` | mutation | buildingManager | `unitId, residentUserId, role, purchaseDate?, leaseStartDate?, leaseEndDate?, rentAmountCents?, rentFrequency?, bondAmountCents?, moveInDate?` | Assign owner or tenant to unit |
| `update` | mutation | buildingManager | `id, ...fields` | Update unit |
| `delete` | mutation | buildingManager | `id` | Hard delete |

## `residents`
| Procedure | Type | Auth | Input | Description |
|---|---|---|---|---|
| `listByBuilding` | query | protected | `buildingId, role?, search?` | Active assignments with user detail |
| `getById` | query | protected | `id` | Full profile with ownerships, tenancies, emergency contacts |
| `addEmergencyContact` | mutation | buildingManager | `userId, name, relationship, phone, email?` | Add contact |
| `removeEmergencyContact` | mutation | buildingManager | `id` | Remove contact |

## `rent`
| Procedure | Type | Auth | Input | Description |
|---|---|---|---|---|
| `listByBuilding` | query | buildingManager | `buildingId, status?` | Payments filtered by status |
| `listByTenancy` | query | protected | `tenancyId` | Rent history for tenancy |
| `recordPayment` | mutation | buildingManager | `id, amountCents, paidDate, paymentMethod?, notes?` | Mark paid (PAID or PARTIAL) |
| `generateSchedule` | mutation | buildingManager | `tenancyId, months?` | Generate payment schedule |
| `getRentRoll` | query | buildingManager | `buildingId` | `unitNumber, tenantName, rentAmountCents, rentFrequency, leaseEnd, overduePayments, nextDue` |

## `keys`
Key types: `PHYSICAL_KEY, FOB, ACCESS_CODE, REMOTE, SWIPE_CARD`

| Procedure | Type | Auth | Input | Description |
|---|---|---|---|---|
| `listByBuilding` | query | protected | `buildingId, keyType?` | All keys with latest log |
| `getById` | query | protected | `id` | Full key with log history |
| `create` | mutation | manager | `buildingId, unitId?, keyType, identifier, issuedTo?, issuedDate?, rotationDue?, notes?` | Creates CREATED log entry |
| `issue` | mutation | manager | `id, issuedTo` | Sets issuedDate=now, creates ISSUED log |
| `returnKey` | mutation | manager | `id, notes?` | Sets returnedDate=now, creates RETURNED log |
| `deactivate` | mutation | manager | `id, notes?` | Sets isActive=false, creates DEACTIVATED log |

## `maintenance`
Categories: `PLUMBING, ELECTRICAL, HVAC, STRUCTURAL, APPLIANCE, PEST_CONTROL, CLEANING, SECURITY, LIFT, COMMON_AREA, OTHER`
Priorities: `LOW, MEDIUM, HIGH, URGENT`
Statuses: `SUBMITTED, ACKNOWLEDGED, IN_PROGRESS, AWAITING_PARTS, SCHEDULED, COMPLETED, CLOSED, CANCELLED`

| Procedure | Type | Auth | Input | Description |
|---|---|---|---|---|
| `listByBuilding` | query | protected | `buildingId, status?, priority?` | Filtered requests |
| `getById` | query | protected | `id` | Full request with images and comments |
| `create` | mutation | tenantOrAbove | `unitId, title, description, category, priority?` | Submit request |
| `updateStatus` | mutation | manager | `id, status` | Auto-sets `completedDate` if status=COMPLETED |
| `assign` | mutation | manager | `id, assignedTo` | Assign + set status=ACKNOWLEDGED |
| `addComment` | mutation | protected | `maintenanceRequestId, content` | Adds comment as current user |

## `visitors`
Purposes: `PERSONAL, DELIVERY, TRADESPERSON, REAL_ESTATE, INSPECTION, OTHER`

| Procedure | Type | Auth | Input | Description |
|---|---|---|---|---|
| `listByBuilding` | query | protected | `buildingId, date?` | Entries, includes registeredBy user |
| `create` | mutation | tenantOrAbove | `buildingId, visitorName, visitorPhone?, visitorCompany?, purpose, unitToVisit?, preApproved?, vehiclePlate?, deliveryInstructions?, notes?` | Create entry |
| `logArrival` | mutation | manager | `id` | Sets `arrivalTime` to now |
| `logDeparture` | mutation | manager | `id` | Sets `departureTime` to now |

## `parcels`
Statuses: `RECEIVED, NOTIFIED, COLLECTED, RETURNED`
**Note:** Parcel model uses `loggedAt` (not `createdAt`) for timestamp.

| Procedure | Type | Auth | Input | Description |
|---|---|---|---|---|
| `listByBuilding` | query | protected | `buildingId, status?` | Filtered parcels |
| `create` | mutation | manager | `buildingId, unitNumber, recipientName, carrier?, trackingNumber?, storageLocation?, notes?` | Status auto-set to RECEIVED |
| `markNotified` | mutation | manager | `id` | Status → NOTIFIED |
| `markCollected` | mutation | manager | `id, collectedBy` | Status → COLLECTED, sets collectedAt |
| `markReturned` | mutation | manager | `id, notes?` | Status → RETURNED |

## `announcements`
Scopes: `BUILDING, FLOOR, ALL_BUILDINGS`

| Procedure | Type | Auth | Input | Description |
|---|---|---|---|---|
| `listByBuilding` | query | protected | `buildingId` | Non-expired announcements |
| `create` | mutation | manager | `buildingId, title, content, priority?, scope?, targetFloors?, expiresAt?` | Sets `authorId`, `publishedAt` |
| `delete` | mutation | manager | `id` | Hard delete |

## `messaging`
| Procedure | Type | Auth | Input | Description |
|---|---|---|---|---|
| `listThreads` | query | protected | — | Distinct threads (sender or recipient) with latest message |
| `getThread` | query | protected | `threadId` | All messages ordered by `createdAt` asc — scoped to participants only |
| `send` | mutation | protected | `recipientId, subject?, content, threadId?` | Auto-generates `threadId` if not provided |
| `markRead` | mutation | protected | `threadId` | Marks all unread messages in thread as read |
| `unreadCount` | query | protected | — | Count of unread threads for current user |

## `financials`
Types: `INCOME, EXPENSE`

| Procedure | Type | Auth | Input | Description |
|---|---|---|---|---|
| `listByBuilding` | query | buildingManager | `buildingId, type?, from?, to?` | Records with date range filter |
| `getSummary` | query | buildingManager | `buildingId` | `totalIncome, totalExpense, net` (all cents) |
| `create` | mutation | buildingManager | `buildingId, type, category, description, amountCents, date, receiptUrl?` | Create record |
| `delete` | mutation | buildingManager | `id` | Hard delete |

## `strata`
Levy types: `ADMIN_FUND, CAPITAL_WORKS, SPECIAL_LEVY`
Payment statuses: `PENDING, PAID, OVERDUE, PARTIAL, WAIVED`

| Procedure | Type | Auth | Input | Description |
|---|---|---|---|---|
| `getByBuilding` | query | buildingManager | `buildingId` | StrataInfo with levies, bylaws, meetings |
| `upsertInfo` | mutation | buildingManager | `buildingId, strataPlanNumber, strataManagerName?, strataManagerEmail?, strataManagerPhone?, adminFundBalance?, capitalWorksBalance?, insurancePolicyNo?, insuranceExpiry?, nextAgmDate?` | Create or update |
| `createMeeting` | mutation | buildingManager | `buildingId, title, meetingDate, location?, notes?` | Requires StrataInfo to exist first |
| `deleteMeeting` | mutation | buildingManager | `id` | Hard delete |
| `listLevies` | query | buildingManager | `buildingId, status?, levyType?` | Levies with `unitNumber` joined from units table |
| `createLevy` | mutation | buildingManager | `buildingId, unitId, levyType, amountCents, quarterStart, dueDate` | Single unit levy |
| `bulkCreateLevies` | mutation | buildingManager | `buildingId, levyType, amountCents, quarterStart, dueDate` | Creates one levy per unit in the building |
| `updateLevyStatus` | mutation | buildingManager | `id, status, paidDate?` | Updates status; auto-sets `paidDate=now` when status=PAID |
| `deleteLevy` | mutation | buildingManager | `id` | Hard delete |

## `documents`
Categories: `LEASE_AGREEMENT, BUILDING_RULES, STRATA_MINUTES, FINANCIAL_REPORT, INSURANCE, COMPLIANCE, NOTICE, OTHER`

Upload flow: client calls `POST /api/storage/upload-url` → PUTs file to `signedUrl` → calls `documents.create` with `publicUrl` + `storagePath`. Downloads use `documents.getDownloadUrl` (short-lived signed URL).

| Procedure | Type | Auth | Input | Description |
|---|---|---|---|---|
| `listByBuilding` | query | protected | `buildingId, category?` | Filtered by category |
| `create` | mutation | buildingManager | `buildingId, title, description?, category, fileUrl, storagePath?, fileSize, mimeType, isPublic?` | Create record |
| `getDownloadUrl` | query | protected | `id` | Returns short-lived signed URL after authorization |
| `delete` | mutation | buildingManager | `id` | Hard delete (storage file deleted via `DELETE /api/storage/delete` on client) |

## `users` (super-admin)
| Procedure | Type | Auth | Input | Description |
|---|---|---|---|---|
| `list` | query | SUPER_ADMIN | `search?` | All users with orgMemberships + active buildingAssignments |
| `getMe` | query | protected | — | Current user profile with orgMemberships |
| `updateMe` | mutation | protected | `firstName?, lastName?, phone?` | Update own profile |
| `assignToBuilding` | mutation | SUPER_ADMIN | `userId, organisationId, buildingId, role` | Upserts OrgMembership + BuildingAssignment |
| `createInvite` | mutation | SUPER_ADMIN | `email, organisationId, buildingId?, unitId?, role` | Creates Invitation (7-day expiry) + fires invite email via Resend |
| `listInvites` | query | SUPER_ADMIN | `organisationId?` | Full invite history with pending / accepted / expired / revoked status |
| `revokeInvite` | mutation | SUPER_ADMIN | `id` | Sets `revokedAt` |
| `resendInvite` | mutation | SUPER_ADMIN | `id` | Revokes the still-pending prior link and creates a fresh invite |
| `deactivateAssignments` | mutation | SUPER_ADMIN | `userId` | Sets all BuildingAssignments `isActive=false` + `User.isActive=false` |

## `notifications`
Types: `LEVY_CREATED, MAINTENANCE_STATUS_UPDATED, MAINTENANCE_CREATED, ANNOUNCEMENT_PUBLISHED, PARCEL_RECEIVED, INVITE_SENT`

| Procedure | Type | Auth | Input | Description |
|---|---|---|---|---|
| `listRecent` | query | protected | `limit?` (default 20) | Latest notifications for current user |
| `unreadCount` | query | protected | — | Count of unread; polled every 30s by topbar |
| `markRead` | mutation | protected | `id` | Sets single notification `isRead: true` |
| `markAllRead` | mutation | protected | — | Marks all unread as read |

**Where notifications are created (fire-and-forget):**
- `strata.createLevy` → `LEVY_CREATED` → active unit owners
- `strata.bulkCreateLevies` → `LEVY_CREATED` → all active owners in building
- `maintenance.updateStatus` → `MAINTENANCE_STATUS_UPDATED` → requester (on ACKNOWLEDGED/IN_PROGRESS/SCHEDULED/COMPLETED/CANCELLED)

## `resident`
All procedures use `tenantOrAboveProcedure`. Data scoped to caller's units — no `buildingId` input.
Building lookup priority: ownership → tenancy → buildingAssignment.

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

## API Routes

### `POST /api/invite/accept`
- **Auth:** Requires Supabase session
- **Body:** `{ token: string }`
- **Behaviour:** Finds or creates Prisma user from Supabase metadata. Upserts OrgMembership + BuildingAssignment (never downgrades role). For unit-linked OWNER invites: deactivates existing ownership/tenancy, upserts Ownership, marks unit occupied. For unit-linked TENANT invites: creates an active tenancy placeholder. Validates invite exists/not-accepted/not-expired/not-revoked/email-match.

### `GET /api/invite/[token]`
- **Auth:** Public — returns invite details by token

### `GET /api/auth/callback`
- **Behaviour:** Exchanges PKCE code for session. If `type=recovery` → `/reset-password`. Otherwise → `next` param (default `/manager`). Must be in Supabase redirect URL allowlist.

### `GET /api/auth/signout`
- **Behaviour:** Signs out via Supabase. Redirects to `redirect` param — **only relative paths accepted** (security).

### `POST /api/storage/upload-url`
- **Auth:** Requires session + building-management access
- **Body:** `{ filename, contentType, buildingId }`
- **Returns:** `{ signedUrl, path, publicUrl }` — client PUTs directly to Supabase, bytes never go through Next.js

### `DELETE /api/storage/delete`
- **Auth:** Requires session
- **Body:** `{ path: string }` — removes file from `documents` bucket
