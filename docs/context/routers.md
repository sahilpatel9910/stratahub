# tRPC Routers Context

All routers in `src/server/trpc/routers/`. Combined in `src/server/trpc/router.ts`.

## users
- `getMe` — protectedProcedure — returns current user with orgMemberships + buildingAssignments + supabaseAuthId + avatarUrl.
- `updateMe` — protectedProcedure — update firstName, lastName, phone (phone nullable). onSuccess must call `setDraft(null)` + `utils.users.getMe.invalidate()`.
- `assignToBuilding` — superAdminProcedure
- `createInvite` / `createManagerInvite` / `listInvites` / `revokeInvite` / `resendInvite`
- `deactivateAssignments` — superAdminProcedure

## avatar (Branch 10)
- `setUrl` — protectedProcedure — input: `{ url: string | null }` — saves/clears `User.avatarUrl`. Client uploads file directly to Supabase Storage bucket `avatars` at path `{supabaseAuthId}.{ext}`, then calls this to persist the public URL.

## notificationPreferences (Branch 10)
- `list` — protectedProcedure — returns all 8 `NotificationType` values for current user. Missing DB rows default to `enabled: true` (opt-out model).
- `update` — protectedProcedure — input: `{ type: NotificationType, enabled: boolean }` — upserts preference using `@@unique([userId, type])` key.

## resident
All procedures use `tenantOrAboveProcedure`. Never accept a buildingId input — resolve building from ownership/tenancy/assignment chain (ownership → tenancy → buildingAssignment priority order). All ownership/tenancy queries use `isActive: true`.

- `getMyProfile` — full user with ownerships + tenancies + buildingAssignments (all `isActive: true`)
- `getMyBuilding` — primary building (ownership first, then tenancy, then assignment)
- `getMyLevies` — input: `{ status? }` — levies for owned units only
- `getMyMaintenanceRequests` — input: `{ status? }` — requests submitted by this user
- `createMaintenanceRequest` — input: `{ unitId, title, description, category, priority }` — verifies caller owns/rents the unit (`isActive: true`)
- `getMyDocuments` — input: `{ category? }` — public docs for resident's building
- `getMyAnnouncements` — announcements for resident's building (non-expired)
- `getMyCommonAreas` — active common areas for resident's building
- `getMyBookings` — this resident's bookings (most recent 50)
- `getMyTenancy` — returns caller's single active `Tenancy` (including `unitId`, `unit { unitNumber, building { name, suburb } }`), or `null` if no active tenancy. Never throws for non-tenants. Used by `/resident/rent`, `ResidentSidebar` (My Rent gate), and `/resident/inspections` (`tenancy.unitId` → `inspection.listByUnit`).

## maintenance
- `getById` — protectedProcedure — input: `{ id }` — includes images (with signed `displayUrl`) + comments. Allows access if caller is the requester OR has building operations access. Used by both manager and resident detail pages.
- `addComment` — protectedProcedure — input: `{ maintenanceRequestId, content }` — allows request owner to comment (verified server-side)
- `addImage` / `deleteImage` — protectedProcedure
- `listByBuilding` — managerProcedure — with filters
- `getStats` — managerProcedure — input: `{ buildingId }` — returns counts by status
- `updateStatus` — buildingManagerProcedure — input: `{ id, status }` — only advances to valid next statuses
- `assign` — buildingManagerProcedure — input: `{ id, assignedTo, notes? }` — sets assignedTo field; only sets status → ACKNOWLEDGED if current status is SUBMITTED (otherwise leaves status unchanged)
- **Notification gotcha:** `MAINTENANCE_CREATED` notifies `buildingAssignment` users with roles `SUPER_ADMIN`, `BUILDING_MANAGER`, or `RECEPTION` (not org-level only).

## commonAreas
- `list` — managerProcedure — input: `{ buildingId }` — all areas for a building
- `create` / `update` / `toggleActive` — buildingManagerProcedure
- `getBookings` — managerProcedure — input: `{ commonAreaId, from?, to? }`
- `createBooking` — tenantOrAboveProcedure — input: `{ commonAreaId, startTime, endTime, notes? }`
- `cancelBooking` — protectedProcedure — caller must own the booking or be a manager
- `getAvailability` — tenantOrAboveProcedure

**Gotcha:** `hasBuildingManagementAccess` helper used in commonAreas router — checks BOTH orgMemberships AND buildingAssignments for the given buildingId. Never skip this check.

## notifications
- `unreadCount` — protectedProcedure — returns number (used for bell badge). Not polled — invalidated by `useRealtimeMessages` hook on new message INSERT.
- `listRecent` — protectedProcedure — input: `{ limit }` — fetched only when bell is open
- `markRead` — protectedProcedure — input: `{ id }`
- `markAllRead` — protectedProcedure
- `listPaginated` — protectedProcedure — input: `{ type?: NotificationType, cursor?: string, limit }` — returns `{ items, nextCursor }` for `/manager/notifications` page
- **Gotcha:** ALL notifications must go through `createNotification()` in `src/server/trpc/lib/create-notification.ts` — this checks `NotificationPreference` before inserting. Never use `db.notification.createMany` directly (bypasses preferences).

## messaging
- `listThreads` — protectedProcedure — returns thread list with `hasUnread` flag
- `getThread` — protectedProcedure — input: `{ threadId }` — returns all messages in thread
- `send` — protectedProcedure — input: `{ recipientId, content, subject?, threadId? }` — creates message + notification
- `markRead` — protectedProcedure — input: `{ threadId }`
- `unreadCount` — protectedProcedure — returns number of unread threads
- **Realtime:** Both manager and resident message pages mount `useRealtimeMessages(me?.id)` hook (`src/hooks/use-realtime-messages.ts`) which subscribes to `postgres_changes` INSERT on `messages` table and invalidates the above queries live.

## buildings
- `getById` / `list` / `create` / `update`
- Manager procedures — buildingId resolved from user's assignments

## announcements
- `listByBuilding` — protectedProcedure + `assertBuildingAccess` — returns non-expired announcements. `protectedProcedure` is intentional: residents need read access too; `assertBuildingAccess` validates they belong to that building.
- `create` — buildingManagerProcedure + `assertBuildingManagementAccess` — notifies all active owners + tenants via `createNotification()` (respects preferences).
- `delete` — buildingManagerProcedure + resolves buildingId from record.

## customBills (Branch 12)
Router key: `customBills`. **Never trust caller-supplied buildingId on update/delete** — always resolve from the DB record.

- `listByBuilding` — managerProcedure + `assertBuildingOperationsAccess` — input: `{ buildingId, status?, category?, unitId? }` — returns bills with `unitNumber` and `recipientName` attached
- `create` — managerProcedure + `assertBuildingOperationsAccess` — input: `{ buildingId, unitId, recipientType, recipientId, title, description?, category, amountCents, dueDate, paymentMode }` — validates recipientId is active owner/tenant of unit; fires `CUSTOM_BILL_CREATED` notification via `createNotification()` + `sendCustomBillEmail`. **Uses `assertBuildingOperationsAccess` (not Management) so RECEPTION can raise bills.**
- `updateStatus` — managerProcedure — input: `{ id, status, paidDate? }` — resolves buildingId from bill record; sets paidDate to now() when status=PAID
- `delete` — buildingManagerProcedure — input: `{ id }` — resolves buildingId from bill record; hard delete
- `createCheckoutSession` — protectedProcedure — input: `{ billId }` — validates `bill.recipientId === ctx.user.id`, paymentMode=ONLINE, status=PENDING/OVERDUE. **Reuses existing open Stripe session if `bill.stripeSessionId` is set** (prevents double-click overwriting). Creates Stripe Checkout (AUD), saves `stripeSessionId`, returns `{ url }`.
- `getMyBills` — tenantOrAboveProcedure — input: `{ status? }` — returns all bills where `recipientId === ctx.user.id`, ordered by dueDate desc

## strata
- `createCheckoutSession` — ownerProcedure — input: `{ levyId: string }` — validates caller owns the unit and levy is PENDING/OVERDUE. **Reuses existing open Stripe session if `levy.stripeSessionId` is set** (prevents double-click overwriting). Creates Stripe Checkout (AUD, test mode), saves `stripeSessionId` to levy, returns `{ url: string }`.
- `createLevy` — buildingManagerProcedure — notifies all active unit owners via `createNotification()` (respects preferences).
- Plus: bylaws CRUD, meetings, strata info

## Stripe webhook (`/api/stripe/webhook`)
- **Auth bypass:** `/api/stripe/` is in `isPublicAuthPath()` in `src/lib/auth/redirects.ts` — middleware must not redirect Stripe's unauthenticated POST.
- Handles `checkout.session.completed`:
  1. Look up `strataLevy` by `stripeSessionId` → if found and not PAID → mark PAID + `sendPaymentReceiptEmail` → early return
  2. Otherwise look up `customBill` by `stripeSessionId` → if found and not PAID → mark PAID + `sendCustomBillReceiptEmail`
- Idempotent: skips update if already PAID.

## Email helpers (`src/lib/email/send.ts`)
- `sendLevyNoticeEmail` — new levy raised (to owner)
- `sendPaymentReceiptEmail` — levy paid via Stripe (to owner)
- `sendCustomBillEmail` — new custom bill created (to recipient)
- `sendCustomBillReceiptEmail` — custom bill paid via Stripe (to recipient) — **separate from creation email**
- `sendMaintenanceUpdateEmail` — maintenance status changed
- `sendWelcomeInviteEmail` — invite accepted

## units
- `listByBuilding` — managerProcedure — returns units with `ownerships` + `tenancies` (both `isActive: true`) including user names. **Used by the New Bill dialog to derive recipient options — no separate `getResidents` call needed.**
- `getResidents` — managerProcedure — input: `{ unitId }` — returns `{ ownerships, tenancies }` with `user { id, firstName, lastName }` for active records. Available but the manager New Bill dialog uses `listByBuilding` data instead to avoid extra queries.
- `assignResident` — buildingManagerProcedure — input includes `scheduleMonths (default 12)`. For TENANT role: creates Tenancy + auto-generates RentPayment schedule in the same transaction (identical behaviour to `tenancy.create`). For OWNER role: creates Ownership, sets `isOccupied: true`. **Both paths now behave identically to the Rent page creation dialogs.**

## inspection (Branch 17)
All procedures use `managerProcedure` (SUPER_ADMIN, BUILDING_MANAGER, RECEPTION). `listByUnit` uses `protectedProcedure` so residents can also call it. Building access verified via `assertBuildingOperationsAccess`.

- `listByBuilding` — input: `{ buildingId, status? }` — returns inspections with unit (unitNumber), inspectedBy, `_count.rooms/_count.images`
- `listByUnit` — protectedProcedure — input: `{ unitId }` — residents must own/rent the unit; managers pass through. Returns inspections with inspectedBy + `_count.rooms`
- `getById` — input: `{ id }` — full inspection with rooms+items (ordered), images with signed `displayUrl` (1h TTL, bucket: `inspections`)
- `create` — input: `{ unitId, type, scheduledAt, notes? }` — sets `inspectedById = ctx.user.id`; notifies active owners + tenants of the unit via `createNotification` (type: `MAINTENANCE_STATUS_UPDATED`, linkUrl: `/resident/inspections`)
- `update` — input: `{ id, scheduledAt?, notes?, type? }`
- `cancel` — sets status `CANCELLED`
- `complete` — sets status `COMPLETED`, `completedAt = now()`
- `addRoom` — input: `{ inspectionId, name, order? }`
- `updateRoom` — input: `{ id, name?, order? }`
- `deleteRoom` — cascades to items
- `addItem` — input: `{ roomId, label }` — default status `NA`
- `updateItem` — input: `{ id, status?, note?, label? }`
- `deleteItem`
- `addImage` — input: `{ inspectionId, storagePath, caption? }`
- `deleteImage` — also removes file from Supabase Storage

**Upload flow:** POST `/api/storage/inspection-upload-url` → returns `{ signedUrl, path }` → PUT to signedUrl → call `inspection.addImage` with path.

## tenancy (Branch 16)
All write procedures: `buildingManagerProcedure`. Reads: `managerProcedure`. Building access always verified via `assertBuildingManagementAccess` — never trust caller-supplied IDs.

- `listByBuilding` — input: `{ buildingId, activeOnly: boolean default true }` — returns tenancies with user (id/firstName/lastName/email), unit (unitNumber), `_count.rentPayments`, first PENDING/OVERDUE payment
- `getById` — input: `{ id }` — full tenancy with user, unit+building (name/suburb), all rentPayments (desc), bondRecord
- `create` — input: `{ unitId, userId, leaseStartDate, leaseEndDate?, rentAmountCents, rentFrequency, bondAmountCents, moveInDate?, generateSchedule (default true), scheduleMonths 1–24 (default 12) }` — enforces one active tenancy per unit (CONFLICT error); creates tenancy + payment schedule in a transaction; `moveInDate` defaults to `leaseStartDate`
- `update` — input: `{ id, leaseStartDate?, leaseEndDate?, rentAmountCents?, rentFrequency?, bondAmountCents?, moveInDate? }` — patch lease terms only (no re-generating schedule)
- `end` — input: `{ id, moveOutDate? }` — soft-close: sets `isActive: false`, `moveOutDate = now()` if omitted. History preserved.

## Other routers
- `documents` — upload/list/delete building documents. Storage path validated with `${buildingId}/` prefix.
- `parcels` — parcel intake + notification to unit residents (active owners + tenants, deduplicated)
- `visitors` — visitor log; `create` uses `tenantOrAboveProcedure` + `assertBuildingAccess`
- `keys` — key/fob/access card records
- `rent` — `listByBuilding`, `listByTenancy`, `recordPayment`, `generateSchedule`, `completeTenancySetup`, `getRentRoll`, `listPendingSetupByBuilding`, `markOverdue` (Branch 16: buildingManagerProcedure, bulk-sets PENDING past-due payments on active tenancies to OVERDUE). `generateSchedule` is wired to a "Generate Schedule" button on the tenancy detail page — only shown when `rentPayments.length === 0`.
- `financials` — income/expense records
- `organisations` — superAdminProcedure CRUD
- `residents` — `listByBuilding` (managerProcedure, input: `{ buildingId }`) — returns residents with role/unit info + `isActivated: !!supabaseAuthId`. Pre-created users (invited but not yet activated) have `isActivated: false` and appear with an amber "Invited" badge in the UI.
- `bond` — bond records for tenancies

## Auth middleware
- File: `src/proxy.ts` (Next.js middleware entry) → calls `updateSession` from `src/lib/supabase/middleware.ts`
- Public paths: `src/lib/auth/redirects.ts` → `isPublicAuthPath()`
- Allowed without auth: `/`, `/login`, `/register`, `/forgot-password`, `/reset-password`, `/api/webhooks*`, `/api/stripe/*`, `/api/auth/*`, `/invite/*`
