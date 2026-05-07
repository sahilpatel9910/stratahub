# StrataHub — Test Surface Map

> Generated: 2026-05-07 | Branch: testing/full-qa-audit | QA audit of Branches 1–20

---

## 1. AUTH ROUTES

### `/login`
- **Purpose**: Email/password sign-in via Supabase Auth
- **Fields**: Email (required, type=email), Password (required, type=password)
- **Buttons**: "Sign In" (submit) → `supabase.auth.signInWithPassword` → redirects to `?redirect` param or `/`
- **Links**: "Forgot password?" → `/forgot-password`
- **States**: Loading ("Signing in..."), Error (red banner with Supabase error message), Success (redirect)
- **Validation**: HTML5 `required` on both fields; normalises email to lowercase before submit
- **Test IDs**: `getByLabel('Email')`, `getByLabel('Password')`, `getByRole('button', { name: /sign in/i })`

### `/forgot-password`
- **Purpose**: Request password reset email via Supabase
- **Fields**: Email (required, type=email)
- **Buttons**: "Send Reset Link" (submit) → `supabase.auth.resetPasswordForEmail` with redirect to `/api/auth/callback?type=recovery`
- **Links**: "Back to sign in" → `/login`
- **States**: Form view, Success view ("Check your email")

### `/register?invite=<token>`
- **Purpose**: Accept an invitation and set a password
- **Without token**: Shows "Invitation Required" card
- **With invalid token**: Shows "Invite Not Found" card
- **With expired token**: Shows "Invite Expired" card
- **With revoked token**: Shows "Invite Revoked" card
- **With accepted token**: Shows "Invite Already Used" card + link to login
- **With valid token**: Shows `RegisterForm` with pre-filled email, org name, building name

### `/reset-password`
- **Purpose**: Set a new password after email link click
- **Fields**: New Password, Confirm Password
- **Buttons**: Submit → `supabase.auth.updateUser`

### `/api/auth/callback`
- Server-side only: exchanges Supabase code for session; `type=recovery` → redirects to `/reset-password`

### `/invite/[token]`
- **Purpose**: Activate pre-created user account (Branch 20 flow)
- Finds user row by token, links supabaseAuthId, redirects to `/login`

---

## 2. ROOT PAGE & REDIRECTS

### `/` (`src/app/page.tsx`)
- **Purpose**: Role-based portal redirect gate
- **Logic**: `getUser()` → `db.user.findUnique` → redirect by role:
  - SUPER_ADMIN → `/super-admin/organisations`
  - BUILDING_MANAGER → `/manager`
  - RECEPTION → `/manager/visitors` ← **BUG: redirects to `/` in current tests**
  - OWNER, TENANT → `/resident`
- Unauthenticated → `/login`

---

## 3. MANAGER PORTAL (`/manager/*`)

### `/manager` — Dashboard
- **Key queries**: `buildings.getStats`, `maintenance.listByBuilding`, `announcements.listByBuilding`
- **Stat cards**: Open maintenance, Overdue rent, Pending parcels, Keys to rotate
- **Panels**: Recent maintenance (last 4), Recent announcements (last 4), Building health (occupancy %)
- **No actions/buttons** on the dashboard itself — all cards are navigation links
- **Loading**: Skeleton while building is loading; "Choose a building" empty state without building selection
- **Sidebar**: Full 17-item manager nav (see Sidebar section)

### `/manager/residents`
- **Key queries**: `residents.listByBuilding`
- **Tabs**: All, Owners, Tenants (with counts)
- **Search**: Real-time filter by name or email
- **Buttons**: "Invite Resident" → opens `InviteResidentDialog` (lazy loaded)
- **Table columns**: Avatar, Name, Unit, Role badge, Status (Invited/Active amber/green), Email, Phone
- **Invite Dialog fields**: First Name, Last Name, Email, Role (Owner/Tenant) — no unit assignment at invite time (Branch 20)
- **Invite validation**: All fields required; email format; role required
- **Invite mutation**: `residents.invite` → creates User + BuildingAssignment + OrgMembership

### `/manager/units`
- **Key queries**: `units.listByBuilding`
- **Table/cards**: Unit number, Floor, Bedrooms, Owner, Tenant, Status
- **Buttons**: "Add Unit" → dialog; "Assign" per row → assigns resident; unit display prioritises tenant over owner (Branch 20)
- **Assign mutation**: `units.assignResident` — also generates RentPayment schedule for TENANT

### `/manager/rent`
- **Key queries**: `tenancy.listByBuilding`, rent stats
- **Tabs**: Overview, Tenancies
- **Tenancies table**: Tenant name, Unit, Start/End date, Rent amount, Status
- **Buttons**: "Create Tenancy" → dialog (Branch 16)
- **Row links**: Navigate to `/manager/tenancies/[id]`
- **Stats**: Overdue rent count

### `/manager/tenancies/[id]`
- **Key queries**: `tenancy.getById`, `rent.listByTenancy`
- **Sections**: Lease summary (tenant, unit, dates, amount), Payment schedule table
- **Buttons**: "Record Payment" → dialog; "Generate Schedule" (shown only when `rentPayments.length === 0`)
- **Table**: Month, Amount, Due date, Status (PENDING/PAID/OVERDUE/PARTIAL)
- **Edit button**: "Edit Tenancy" → edit dialog

### `/manager/keys`
- **Key queries**: `keys.listByBuilding`
- **Table**: Key tag, Unit, Assigned to, Issue date, Return date, Status
- **Buttons**: "Add Key" → dialog; per-row: "Return" action

### `/manager/maintenance`
- **Key queries**: `maintenance.listByBuilding`
- **Tabs**: All, Active, Completed, Cancelled
- **Filters**: Priority (ALL/LOW/MEDIUM/HIGH/URGENT), search by title
- **Table**: ID, Title, Unit, Category, Priority badge, Status badge, Date, Actions (⋮ menu)
- **Row menu actions**: View → `/manager/maintenance/[id]`; Status transitions via dialog
- **Status update dialog**: Inline transition select + optional note → `maintenance.updateStatus`
- **Loading**: Skeleton per row

### `/manager/maintenance/[id]`
- **Key queries**: `maintenance.getById`
- **Sections**: Request details, Status/Priority select, Assign contractor field, Timeline, Photos, Comments
- **Buttons**: "Update Status" → `maintenance.updateStatus`; "Add Photo" → two-step upload (`/api/storage/maintenance-upload-url` → PUT → `maintenance.addImage`); "Add Comment" form
- **Known bug**: `assignInput` useEffect clobbers mid-edit text on refetch
- **Known bug**: failed photo upload leaves "Add Photo" disabled
- **Known bug**: `updateStatus` only invalidates `getById`, not `listByBuilding + getStats`

### `/manager/inspections`
- **Key queries**: `inspection.listByBuilding`
- **Table**: ID, Unit, Inspector, Date, Status, Rooms count
- **Buttons**: "Create Inspection" → dialog
- **Row links**: → `/manager/inspections/[id]`

### `/manager/inspections/[id]`
- **Key queries**: `inspection.getById`
- **Structure**: Inspection metadata, Rooms accordion (with Items), Add Room button, per-item: Condition select + Notes textarea + Photos
- **Mutations**: `inspection.addRoom`, `inspection.addItem`, `inspection.updateItem`, `inspection.addImage`

### `/manager/visitors`
- **Key queries**: `visitors.listByBuilding`
- **Table**: Name, Unit visiting, Host, Check-in, Check-out (if logged), Purpose
- **Buttons**: "Log Visitor" → dialog

### `/manager/parcels`
- **Key queries**: `parcels.listByBuilding`
- **Table**: Tracking, Carrier, Unit, Received, Status
- **Buttons**: "Log Parcel" → dialog; per-row "Mark Collected" → `parcels.markCollected`

### `/manager/announcements`
- **Key queries**: `announcements.listByBuilding`
- **List/table**: Title, Category, Date, Author
- **Buttons**: "Create Announcement" → dialog; per-row edit/delete
- **Dialog fields**: Title, Body, Category (General/Safety/Maintenance/Event)

### `/manager/documents`
- **Key queries**: `documents.listByBuilding`
- **Table/list**: Name, Category, Uploaded by, Date, Download link
- **Buttons**: "Upload Document" → dialog; per-doc delete (if owner)

### `/manager/messages`
- **Key queries**: `messaging.listConversations`; `messaging.getMessages` per conversation
- **Layout**: Conversation list (left) + Message thread (right)
- **Real-time**: Supabase Realtime subscription (Branch 10)
- **Compose**: Textarea + Enter/Send → `messaging.sendMessage`
- **Unread badge**: Shows unread count in resident sidebar

### `/manager/notifications`
- **Key queries**: `notifications.listByUser` (cursor pagination)
- **Filter pills**: All, Maintenance, Levy, Announcement, etc.
- **Buttons**: "Mark all read"; per-notification "Mark read" → `notifications.markRead`
- **Pagination**: Cursor-based (Branch 9) — "Load more" or infinite scroll
- **Unread badge**: In sidebar

### `/manager/strata`
- **Tabs**: Overview, Levies, Custom Bills (Tab 5 — Branch 12), Reports, …
- **Levies tab**: Table of levies; "Create Levy" → dialog; per-row edit/delete
- **Custom Bills tab**: Table of ad-hoc bills; "New Bill" → dialog
- **Custom Bill dialog fields**: Recipient (from units.listByBuilding), Description, Amount, Due date, Payment mode (ONLINE/MANUAL)
- **Custom Bill mutations**: `customBills.create` (RECEPTION can create — uses `assertBuildingOperationsAccess`)
- **Stripe double-session guard**: Both levy and custom bill checkout check for existing `open` session

### `/manager/common-areas`
- **Key queries**: `commonAreas.listByBuilding`, `commonAreas.listBookings`
- **Areas list**: Room name, Capacity, Status, Amenities
- **Bookings calendar/list**: Resident, Area, Date/time, Status
- **Buttons**: "Add Common Area" → dialog; "Add Booking" → dialog

### `/manager/financials`
- **Key queries**: `financials.getSummary`
- **Charts**: Revenue, Expenses, Collections rate (Recharts, lazy-loaded Branch 13)
- **Table**: Transaction history

### `/manager/analytics`
- **Key queries**: `buildings.getAnalytics`
- **Charts**: Occupancy trend, Maintenance trend, Revenue trend (Recharts, lazy-loaded)

### `/manager/settings`
- **Key queries**: `users.getProfile`
- **Form fields**: First name, Last name, Phone
- **Avatar section**: File input + upload → `avatar.upload` (Supabase Storage → `avatars` bucket, Branch 10)
- **Notification preferences**: Per-type toggles → `notificationPreferences.update` (Branch 10)
- **Mutations**: `users.updateProfile`

---

## 4. RESIDENT PORTAL (`/resident/*`)

### `/resident` — My Home Dashboard
- **Key queries**: `resident.getProfile`, building stats, `maintenance.myRequests`
- **Sections**: Welcome header, Quick stats (levy balance, open maintenance), Recent announcements
- **Sidebar**: My Home, My Levies, [My Rent — conditional on active tenancy], Maintenance, Common Areas, Documents, Inspections, Announcements, Settings, Messages + Sign Out

### `/resident/levies`
- **Key queries**: `strata.getMyLevies`, `customBills.listForResident`, `owner.getFinancialSummary` (owners only)
- **Tabs**: My Levies, Custom Bills, Financial Summary (owners only — Branch 18)
- **My Levies**: Table of levy schedules; "Pay Now" → `strata.createCheckoutSession` → Stripe Checkout (Branch 11)
- **Custom Bills**: Bills with ONLINE/MANUAL mode; "Pay Now" or "Pay at reception" (Branch 12)
- **Financial Summary tab**: Stat cards (levy income, distributions, balance), transaction table, "Export CSV" button (Branch 18)
- **Outstanding balance**: Sums `levyUnpaidTotal + billUnpaidTotal` — both sources required

### `/resident/maintenance`
- **Key queries**: `maintenance.listByResident`
- **Buttons**: "Submit Request" → dialog
- **Dialog fields**: Title (required), Description (required), Category (select), Priority (select), Photos (optional)
- **Table**: Status, Title, Category, Date submitted
- **Row links**: → `/resident/maintenance/[id]`

### `/resident/maintenance/[id]`
- **Key queries**: `maintenance.getById`
- **Sections**: Request details, Status timeline, Photos gallery, Comments
- **Comment form**: Textarea + "Add Comment" → `maintenance.addComment`

### `/resident/rent` — My Rent (tenants only — Branch 14/19)
- **Key queries**: `resident.getMyTenancy`, `rent.listByTenancy`
- **Sections**: Lease summary (tenant, unit, dates, weekly amount, bond), Payment stat cards (Next Due, Total Paid, Overdue)
- **"Next Payment Due" action banner**: "Pay Now" → `rent.createPaymentSession` → Stripe Checkout (Branch 19)
- **Payment schedule table**: Month, Amount, Due date, Status, Pay button per row
- **Sidebar visibility**: "My Rent" only appears when `resident.getMyTenancy` returns non-null

### `/resident/common-areas`
- **Key queries**: `commonAreas.listByBuilding`, `commonAreas.listMyBookings`
- **Booking flow**: Select area → Pick time → "Book" → `commonAreas.createBooking`
- **My Bookings**: List with cancel option

### `/resident/documents`
- **Key queries**: `documents.listByBuilding`
- **Table**: Name, Category, Date, Download button — read-only

### `/resident/inspections` (Branch 17, read-only)
- **Key queries**: `inspection.listForResident`
- **Table**: Date, Unit, Inspector, Status — read-only, no create/edit/delete

### `/resident/announcements`
- **Key queries**: `announcements.listByBuilding`
- **List**: Title, Date, Category, Body — read-only

### `/resident/messages`
- **Same structure as manager messages**: Realtime conversation + compose

### `/resident/settings`
- **Same as manager settings**: Profile form, avatar upload, notification preference toggles (Branch 10)

---

## 5. SUPER-ADMIN PORTAL (`/super-admin/*`)

### `/super-admin/organisations`
- **Key queries**: `organisations.list`
- **Table**: Org name, Slug, Buildings count, Created date
- **Buttons**: "Create Organisation" → dialog

### `/super-admin/buildings`
- **Key queries**: `buildings.list`
- **Table**: Building name, Org, Address, Units count, Status
- **Buttons**: "Add Building" → dialog

### `/super-admin/users`
- **Key queries**: `users.list`
- **Table**: Name, Email, Role, Created, Last login
- **Filters**: Role filter

---

## 6. SIDEBAR NAVIGATION

### Manager Sidebar (`app-sidebar.tsx`)
| Item | Route | Roles |
|------|-------|-------|
| Dashboard | `/manager` | Manager only (not Reception) |
| Residents | `/manager/residents` | Manager only |
| Units | `/manager/units` | Manager only |
| Rent | `/manager/rent` | Manager only |
| Keys & Access | `/manager/keys` | All (incl. Reception) |
| Maintenance | `/manager/maintenance` | All (incl. Reception) |
| Inspections | `/manager/inspections` | Manager only |
| Visitors | `/manager/visitors` | All (incl. Reception) |
| Parcels | `/manager/parcels` | All (incl. Reception) |
| Announcements | `/manager/announcements` | Manager only |
| Documents | `/manager/documents` | Manager only |
| Messages | `/manager/messages` | All (incl. Reception) |
| Notifications | `/manager/notifications` | Manager only (badge shows unread count) |
| Strata | `/manager/strata` | Manager only |
| Common Areas | `/manager/common-areas` | Manager only |
| Financials | `/manager/financials` | Manager only |
| Analytics | `/manager/analytics` | Manager only |
| Settings | `/manager/settings` | All (footer) |
| Sign Out | (action) | All (footer) |

### Resident Sidebar (`resident-sidebar.tsx`)
| Item | Route | Condition |
|------|-------|-----------|
| My Home | `/resident` | Always |
| My Levies | `/resident/levies` | Always |
| My Rent | `/resident/rent` | Only if `getMyTenancy` returns non-null |
| Maintenance | `/resident/maintenance` | Always |
| Common Areas | `/resident/common-areas` | Always |
| Documents | `/resident/documents` | Always |
| Inspections | `/resident/inspections` | Always |
| Announcements | `/resident/announcements` | Always |
| Settings | `/resident/settings` | Always |
| Messages | `/resident/messages` | Always (with unread badge, 30s poll) |
| Sign Out | (action) | Always (footer) |

---

## 7. API ROUTES (non-tRPC)

| Route | Method | Purpose | Auth |
|-------|--------|---------|------|
| `/api/auth/callback` | GET | Supabase code exchange | Public |
| `/api/stripe/webhook` | POST | Stripe Checkout event handler | Public (whitelisted in `isPublicAuthPath`) |
| `/api/storage/maintenance-upload-url` | GET | Generate signed upload URL | Authenticated |

---

## 8. KNOWN CODE-LEVEL BUGS (from CLAUDE.md)

1. **Maintenance cache invalidation gap** — `updateStatus` on detail page only invalidates `getById`. List page and stats are stale until manual refresh.
2. **`assignInput` useEffect clobber** — Syncs `req.assignedTo` on every refetch, overwriting text in progress.
3. **Photo upload state on failure** — `cancelPendingFile` not called in `confirmUpload` catch, leaving "Add Photo" button disabled.
4. **`NEXT_STATUSES` duplicated** — `_client.tsx` (list) and `[id]/_client.tsx` (detail) each define their own copy. Divergence risk.
5. **`RentPayment.amountCents` overwritten on PARTIAL** — No `originalAmountCents` field; cannot distinguish owed vs paid amounts.
