# StrataHub — Architectural Decisions & Patterns

## Core Patterns

### Building context (Zustand)
```ts
// src/hooks/use-building-context.ts — persisted to localStorage: "strata-hub-building"
const { selectedBuildingId, selectedBuildingName, setSelectedBuilding, clearSelectedBuilding } = useBuildingContext();
```
Auto-selects when user has exactly one building. All building-scoped queries use `skipToken` (not `enabled: false`) when no building is selected:
```ts
const query = trpc.residents.listByBuilding.useQuery(
  selectedBuildingId ? { buildingId: selectedBuildingId } : skipToken
);
```

### tRPC client config
```ts
// src/lib/trpc/provider.tsx
QueryClient: { staleTime: 5 * 60 * 1000, refetchOnWindowFocus: false }
tRPC link: httpBatchLink({ url: `${NEXT_PUBLIC_APP_URL}/api/trpc` }) + superjson
```
Cache invalidation after mutations: `utils.routerName.procedureName.invalidate()`

### Constants
```ts
// src/lib/constants.ts
formatCurrency(cents)      // → "$1,234.56" AUD
centsToDollars(cents)      // → "$X.XX" string
dollarsToCents(dollars)    // → integer cents
AUSTRALIAN_STATES, USER_ROLE_LABELS, UNIT_TYPE_LABELS, MAINTENANCE_CATEGORY_LABELS, PRIORITY_LABELS
```

---

## Architectural Decisions

1. **Server component layout + client pages** — `(dashboard)/layout.tsx` is a thin wrapper (TRPCProvider + SidebarProvider). Individual layouts (`manager/layout.tsx`, `resident/layout.tsx`) are async server components that fetch buildings directly from Prisma. Page components are client components.

2. **`skipToken` for conditional queries** — Never use `enabled: false`; always use `skipToken` for building-scoped queries when no building is selected.

3. **Cents for money** — All monetary values stored as integers in cents. Always use `formatCurrency(cents)` for display.

4. **Dual-layer auth** — Supabase manages sessions + cookie refresh. Prisma stores app user with role data. Link: `User.supabaseAuthId = supabase auth UUID`.

5. **Zustand + localStorage for building context** — Survives page refresh. Auto-selects when exactly one building exists. Clears stale selection if building is no longer in user's assignment list.

6. **Prisma user created at invite acceptance** — `POST /api/invite/accept` finds-or-creates the Prisma User from Supabase `user_metadata`. There is no separate `/api/auth/create-user` route.

7. **Base UI render prop** — shadcn uses `@base-ui/react` (not `@radix-ui`). Use `render={<Component />}` instead of `asChild`. Select `onValueChange` guards against `null`.

8. **Prisma 7 + driver adapter** — Connection URL in `prisma.config.ts` (for migrations). `PrismaPg` adapter passed to `PrismaClient` constructor (for queries). `postinstall: prisma generate` runs on every Vercel deploy.

9. **`prisma db push` not `migrate dev`** — Schema was bootstrapped with `db push`. Always use `npx prisma db push` to apply changes, then `npx prisma generate`. The `migrations/` folder has drift — do not use `migrate dev`.

10. **Supabase Storage upload pattern** — Files never go through Next.js. Flow: `POST /api/storage/upload-url` (service role creates signed PUT URL after building-management auth) → client PUTs directly → tRPC saves DB record. Downloads use `documents.getDownloadUrl` (short-lived signed URL). Bucket: `documents` (private).

11. **Building-scoped authorization pattern** — Never trust caller-supplied `buildingId` by role alone. Resolve the building from the target record and call `assertBuildingAccess` (read) or `assertBuildingManagementAccess` (write) from `src/server/auth/building-access.ts`.

12. **Fire-and-forget for emails and notifications** — Called with `void` inside mutations. Failures caught server-side but never surfaced to client. The primary mutation always succeeds even if Resend is down.

13. **Lazy Resend client** — `getResend()` in `src/lib/email/resend.ts` initialises lazily on first call using `"re_placeholder"` as fallback. Prevents build-time throws when `RESEND_API_KEY` is not set.

14. **Resident router scopes by unit membership** — `resident.*` procedures derive buildingId from the caller's active Ownership → Tenancy → BuildingAssignment (in that priority). They do NOT accept `buildingId` as input. `createMaintenanceRequest` verifies `unitId` against caller's memberships to prevent IDOR.

15. **Notification topbar polling** — `notifications.unreadCount` polled every 30 seconds. `listRecent` fetched only when bell dropdown is open. Both invalidated after `markRead`/`markAllRead`.

16. **Unit-first occupancy workflow** — Unit creation requires owner details. Owner invites can be unit-scoped (creates `Ownership` on acceptance). Occupancy changes go through unit assignment so ownership/tenancy stay attached to the unit.

17. **Open redirect protection** — `/api/auth/signout` only accepts relative redirect paths (must start with `/` and not `//`). Absolute URLs are silently replaced with `/login`.
