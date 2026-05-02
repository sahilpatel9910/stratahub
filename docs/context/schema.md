# Schema Context

Prisma 7, PostgreSQL via Supabase. Import from `@/generated/prisma/client`.

## Key Relationships

### Organisation
- Has many `Building[]`
- Has many `OrganisationMembership[]` (links Users with roles)

### Building
- Belongs to `Organisation`
- Has many `Floor[]`, `Unit[]`, `CommonArea[]`, `Announcement[]`, `Document[]`, `VisitorEntry[]`, `Parcel[]`, `CustomBill[]`
- Users assigned via `BuildingAssignment[]`

### User
- `supabaseAuthId String? @unique` — **nullable**. Null = manager pre-created the user at invite time but they haven't activated their account yet. Set when they accept the invite and sign up. Never assume supabaseAuthId is always present.
- Roles via `orgMemberships` (OrganisationMembership) AND `buildingAssignments` (BuildingAssignment)
- Resident relationships: `ownerships` (Ownership[]), `tenancies` (Tenancy[])
- Both Ownership and Tenancy are independent — same unit can have an owner AND a tenant simultaneously
- `avatarUrl String?` — public URL to Supabase Storage `avatars/{supabaseAuthId}.{ext}`
- `notificationPreferences NotificationPreference[]` reverse relation
- `inspectionsCreated Inspection[]` @relation("InspectionsCreated") — inspections this user scheduled

### Unit
- Belongs to `Building` (via `Floor`)
- `Ownership[]` — always filter with `isActive: true`
- `Tenancy[]` — always filter with `isActive: true`
- `Inspection[]` — all inspections for this unit (Branch 17)
- `MaintenanceRequest[]`, `StrataLevy[]`, `RentPayment[]`, `BondRecord[]`, `CustomBill[]`

### StrataLevy
- `stripeSessionId String?` — Stripe Checkout Session ID; set when `createCheckoutSession` is called. Webhook looks up levy by this on `checkout.session.completed`. **Reused if still open (prevents double-session bug).**
- `status PaymentStatus` — set to `PAID` by the webhook (idempotent — skips if already PAID)
- `paidDate DateTime?` — set to `now()` by the webhook on successful payment

### CommonArea
- Belongs to `Building`
- `isActive: Boolean` — always filter with `isActive: true`
- `CommonAreaBooking[]` — BookingStatus enum: CONFIRMED | CANCELLED

### MaintenanceRequest
- `requestedById` → User
- `unitId` → Unit
- `MaintenanceImage[]` (storagePath = Supabase storage path, not public URL)
- `MaintenanceComment[]` (authorId → User, content, createdAt)
- Status: SUBMITTED → ACKNOWLEDGED → IN_PROGRESS → AWAITING_PARTS → SCHEDULED → COMPLETED → CLOSED | CANCELLED

### CustomBill (Branch 12)
- Ad-hoc per-resident charges raised by managers/reception (separate from StrataLevy)
- `buildingId`, `unitId`, `recipientType` (OWNER|TENANT), `recipientId` → User
- `title String`, `description String?`, `category CustomBillCategory`, `amountCents Int`
- `dueDate DateTime`, `status PaymentStatus` (default PENDING), `paymentMode` (ONLINE|MANUAL)
- `stripeSessionId String?` — set on checkout creation; webhook looks up by this. **Reused if still open.**
- `createdById` → User (audit: who raised the bill)
- Named relations: `recipient User @relation("CustomBillRecipient")`, `createdBy User @relation("CustomBillCreator")`
- Indexes: `stripeSessionId`, `buildingId`, `[unitId, recipientId]`

### Inspection (Branch 17)
- `unitId` → Unit, `inspectedById` → User (relation name: `"InspectionsCreated"`)
- `type InspectionType` (ROUTINE|ENTRY|EXIT|EMERGENCY), `status InspectionStatus` (SCHEDULED|COMPLETED|CANCELLED, default SCHEDULED)
- `scheduledAt DateTime`, `completedAt DateTime?`, `notes String?`
- `rooms InspectionRoom[]` (ordered by `order` asc), `images InspectionImage[]`
- Photos stored in Supabase Storage bucket `inspections` (private). `storagePath` = `{inspectionId}/{timestamp}-{safeName}`. Signed URLs generated server-side (1h TTL) in `getById`.
- Cascade delete: deleting a room deletes its items; deleting an inspection deletes rooms, items, and images (but NOT storage files — those must be deleted separately via `deleteImage`)

### Tenancy (Branch 16)
- Belongs to `Unit` (via `unitId`) and `User` (via `userId` — the tenant)
- `isActive Boolean` — always filter with `isActive: true` for current tenancies; soft-ended tenancies keep history
- `leaseStartDate DateTime`, `leaseEndDate DateTime?` (null = periodic/rolling)
- `rentAmountCents Int`, `rentFrequency RentFrequency` (WEEKLY|FORTNIGHTLY|MONTHLY)
- `bondAmountCents Int`, `moveInDate DateTime?`, `moveOutDate DateTime?`
- `rentPayments RentPayment[]`, `bondRecord BondRecord?`
- **One active tenancy per unit** enforced in `tenancy.create` (CONFLICT error if violated)
- Both Ownership and Tenancy are independent — same unit can have an owner AND a tenant simultaneously

### RentPayment (Branch 14)
- Belongs to `Tenancy`
- `amountCents Int` — **mutable**: when `rent.recordPayment` is called, this field is overwritten with the amount actually paid. For `PARTIAL` rows, `amountCents` = what was received, NOT the original scheduled amount. There is no `originalAmountCents` — the original is lost. Never assume `amountCents` equals the scheduled rent for PARTIAL rows.
- `status PaymentStatus` — set by `recordPayment`: `PAID` if paid amount ≥ scheduled, `PARTIAL` if less.
- `paidDate DateTime?`, `paymentMethod String?`, `notes String?` — set on payment recording.

### Notifications
- `NotificationType` enum: `LEVY_CREATED`, `MAINTENANCE_STATUS_UPDATED`, `MAINTENANCE_CREATED`, `ANNOUNCEMENT_PUBLISHED`, `PARCEL_RECEIVED`, `INVITE_SENT`, `MESSAGE_RECEIVED`, `CUSTOM_BILL_CREATED`
- `isRead`, `linkUrl` (optional deep-link), `userId` → User
- **Always create via `createNotification()` helper** — never `db.notification.createMany` directly. The helper checks `NotificationPreference` first.

### NotificationPreference (Branch 10)
- `@@unique([userId, type])` — one row per user per type
- `enabled Boolean @default(true)` — opt-out model: missing row = notification sent
- Checked in `src/server/trpc/lib/create-notification.ts` before every notification insert
- Managed via `notificationPreferences.list` + `notificationPreferences.update` tRPC procedures

## Enums Summary

| Enum | Values |
|---|---|
| UserRole | SUPER_ADMIN, BUILDING_MANAGER, RECEPTION, OWNER, TENANT |
| MaintenanceStatus | SUBMITTED, ACKNOWLEDGED, IN_PROGRESS, AWAITING_PARTS, SCHEDULED, COMPLETED, CLOSED, CANCELLED |
| MaintenanceCategory | PLUMBING, ELECTRICAL, HVAC, STRUCTURAL, APPLIANCE, PEST_CONTROL, CLEANING, SECURITY, LIFT, COMMON_AREA, OTHER |
| Priority | LOW, MEDIUM, HIGH, URGENT |
| PaymentStatus | PENDING, PAID, OVERDUE, PARTIAL, WAIVED |
| ParcelStatus | RECEIVED, NOTIFIED, COLLECTED, RETURNED |
| BookingStatus | CONFIRMED, CANCELLED |
| DocCategory | LEASE_AGREEMENT, BUILDING_RULES, STRATA_MINUTES, FINANCIAL_REPORT, INSURANCE, COMPLIANCE, NOTICE, OTHER |
| LevyType | ADMIN_FUND, CAPITAL_WORKS, SPECIAL_LEVY |
| AustralianState | NSW, VIC, QLD, SA, WA, TAS, NT, ACT |
| BillRecipientType | OWNER, TENANT |
| BillPaymentMode | ONLINE, MANUAL |
| InspectionType | ROUTINE, ENTRY, EXIT, EMERGENCY |
| InspectionStatus | SCHEDULED, COMPLETED, CANCELLED |
| InspectionItemStatus | PASS, FAIL, NA |
| RentFrequency | WEEKLY, FORTNIGHTLY, MONTHLY |
| BondStatus | PENDING, LODGED, PARTIALLY_RELEASED, FULLY_RELEASED, DISPUTED |
| CustomBillCategory | WATER_USAGE, PARKING_FINE, DAMAGE, CLEANING, MAINTENANCE_CHARGEBACK, MOVE_IN_FEE, MOVE_OUT_FEE, KEY_REPLACEMENT, DOCUMENT_FEE, ADMIN_FEE, OTHER |

## Building Access Helpers (`src/server/auth/building-access.ts`)

| Helper | Allowed roles |
|--------|---------------|
| `assertBuildingOperationsAccess` | SUPER_ADMIN, BUILDING_MANAGER, RECEPTION — throws if denied |
| `hasBuildingOperationsAccess` | Same roles — returns boolean, does not throw |
| `assertBuildingManagementAccess` | SUPER_ADMIN, BUILDING_MANAGER — throws if denied |
| `assertBuildingAccess` | Any of the above + unit owners/tenants of that building |
| `isSuperAdmin(user)` | Checks orgMemberships for SUPER_ADMIN role |

**Critical rule:** Role checks must use BOTH `orgMemberships` AND `buildingAssignments`. A user satisfies a check via either. Never check only one.
