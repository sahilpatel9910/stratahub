# StrataHub — Data Model

Source of truth: `prisma/schema.prisma`

## Relationships

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
        ├── Parcel (many)          ← uses loggedAt, not createdAt
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
```

## Role System

Roles live in junction tables — NOT on the `users` row.

| Table | Key columns |
|---|---|
| `organisation_memberships` | `userId`, `organisationId`, `role`, `isActive` |
| `building_assignments` | `userId`, `buildingId`, `role`, `isActive` |

```
SUPER_ADMIN      → full access, all orgs/buildings
BUILDING_MANAGER → manages assigned buildings
RECEPTION        → front desk (visitors, parcels, keys)
OWNER            → unit owner self-service
TENANT           → tenant self-service
```

Role rank (for never-downgrade logic): TENANT(0) < OWNER(1) < RECEPTION(2) < BUILDING_MANAGER(3) < SUPER_ADMIN(4)

## Key field notes

- All monetary values stored as **cents** (integers). Use `formatCurrency(cents)` from `src/lib/constants.ts`.
- `Parcel` uses `loggedAt` for its timestamp (not `createdAt`).
- `User.supabaseAuthId` links to Supabase `auth.users.id`.
- `BuildingAssignment.isActive` — set to false by "Deactivate User" action.
- `Unit.isOccupied` — updated when ownership/tenancy records are created or deactivated.
