# Next Phase Design — Branches 16–18

**Date:** 2026-04-29  
**Goal:** Complete the product by filling the three largest remaining gaps — manager-side tenancy management, property inspections, and owner financial reporting.

---

## Approach

Three sequential branches, each independently shippable:

| Branch | Feature | Depends on |
|--------|---------|------------|
| 16 | Manager Rent/Tenancy Management | — |
| 17 | Inspections & Condition Reports | — |
| 18 | Owner Financial Dashboard | Branch 16 (tenancy data) |

---

## Branch 16 — Manager Rent/Tenancy Management

### Pages & Routing

- New **Tenancies** tab on `/manager/residents` (alongside existing Residents/Units tabs)
- `/manager/tenancies/[id]` — tenancy detail page (full-page pattern, same as maintenance detail)

### Features

- **Create tenancy:** select unit + resident user, set lease start/end dates, rent amount + frequency, bond amount. Unit must not have an existing active tenancy (enforced server-side).
- **Edit lease terms:** update dates, rent amount, frequency, bond on an existing tenancy.
- **End tenancy:** soft-close — sets `isActive: false`, records end date. History preserved.
- **Record payment:** log a rent payment against a tenancy — amount, date paid, payment method, status (PAID / PARTIAL / WAIVED).
- **Mark overdue:** bulk-update PENDING payments past their due date to OVERDUE.
- **Tenancy detail page:** lease summary panel + full payment schedule table with action buttons (same data the resident sees in `/resident/rent`, but editable).

### tRPC

**`tenancy` router** (all `buildingManagerProcedure`):
- `create` — create new tenancy for a unit
- `update` — edit lease terms
- `end` — soft-close tenancy
- `listByBuilding` — all tenancies for a building (with filters: active/ended)
- `getById` — full tenancy detail + payment schedule

**`rent` router** (extend existing):
- `recordPayment` — already exists on resident side; expose to manager
- `markOverdue` — new: bulk-set PENDING payments past due date → OVERDUE

### Access

All write procedures: `buildingManagerProcedure` (BUILDING_MANAGER only).  
Read procedures: `managerProcedure` (BUILDING_MANAGER + RECEPTION can view).

---

## Branch 17 — Inspections & Condition Reports

### Pages & Routing

- **Manager:** new **Inspections** nav item → `/manager/inspections` (list) + `/manager/inspections/[id]` (detail/report)
- **Resident:** `/resident/inspections` — read-only view of upcoming and past inspections for their unit

### Features

- **Schedule inspection:** select unit, type (ROUTINE / ENTRY / EXIT / EMERGENCY), date/time, optional notes. Triggers in-app notification + email to resident on creation.
- **Condition report:** structured checklist attached to an inspection. Manager adds rooms freeform (e.g. Kitchen, Bathroom 1). Each room has items with status (PASS / FAIL / NA), optional note, and optional photo. Photos use the same two-step Supabase Storage upload as maintenance images.
- **Complete inspection:** manager finalises the report and marks inspection COMPLETED. Completed report appears in resident's `/resident/documents`.
- **Cancel inspection:** soft-cancel with reason; resident notified.

### Schema

```prisma
model Inspection {
  id            String    @id @default(cuid())
  unitId        String
  type          InspectionType
  status        InspectionStatus @default(SCHEDULED)
  scheduledAt   DateTime
  completedAt   DateTime?
  notes         String?
  inspectedById String
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  unit          Unit      @relation(fields: [unitId], references: [id])
  inspectedBy   User      @relation(fields: [inspectedById], references: [id])
  rooms         InspectionRoom[]
  images        InspectionImage[]
}

model InspectionRoom {
  id           String   @id @default(cuid())
  inspectionId String
  name         String
  order        Int      @default(0)
  inspection   Inspection @relation(fields: [inspectionId], references: [id], onDelete: Cascade)
  items        InspectionItem[]
}

model InspectionItem {
  id      String             @id @default(cuid())
  roomId  String
  label   String
  status  InspectionItemStatus @default(NA)
  note    String?
  room    InspectionRoom @relation(fields: [roomId], references: [id], onDelete: Cascade)
}

model InspectionImage {
  id           String   @id @default(cuid())
  inspectionId String
  storagePath  String
  caption      String?
  createdAt    DateTime @default(now())
  inspection   Inspection @relation(fields: [inspectionId], references: [id], onDelete: Cascade)
}

enum InspectionType   { ROUTINE ENTRY EXIT EMERGENCY }
enum InspectionStatus { SCHEDULED COMPLETED CANCELLED }
enum InspectionItemStatus { PASS FAIL NA }
```

### tRPC

**`inspection` router** (all `managerProcedure` — BUILDING_MANAGER + RECEPTION):
- `create`, `update`, `cancel`, `complete`
- `listByBuilding`, `getById`
- `addRoom`, `updateRoom`, `deleteRoom`
- `updateItem`
- `addImage`, `deleteImage`

### Access

All procedures: `managerProcedure` — BUILDING_MANAGER and RECEPTION have identical full access.

---

## Branch 18 — Owner Financial Dashboard

### Pages & Routing

New **Financial Summary** tab added to existing `/resident/levies` page (no new route). Owners see the tab; non-owners do not.

### Features

- **Summary cards:** total levies paid, outstanding levy balance, custom bills owing, rent income received (if unit has active tenancy where caller is the owner).
- **Transaction history table:** unified chronological view — levy payments, custom bills, rent payments received — filterable by type (Levies / Bills / Rent).
- **CSV export:** download full transaction history as CSV (date, type, description, amount, status). No PDF library needed.
- **Rent income:** owners whose unit has an active tenancy see the rent schedule and payments received. Read-only — cannot edit tenancy terms.

### tRPC

**`owner` router** (new, `ownerProcedure`):
- `getFinancialSummary` — returns levy totals, custom bill totals, and tenancy payment history for the calling user's owned units in a single response

### Access

`ownerProcedure` (SUPER_ADMIN, BUILDING_MANAGER, OWNER). Managers already have their own views for this data.

---

## Known Tech Debt (address opportunistically per branch)

- `NEXT_STATUSES` duplicated in maintenance list + detail clients → consolidate into `src/lib/constants.ts`
- `assignInput` useEffect clobbers mid-edit text on refetch (maintenance detail)
- Cache invalidation gap: maintenance `updateStatusMutation` on detail page doesn't invalidate `listByBuilding` / `getStats`
- `confirmUpload` catch block doesn't call `cancelPendingFile` — leaves Add Photo button disabled after failed upload
