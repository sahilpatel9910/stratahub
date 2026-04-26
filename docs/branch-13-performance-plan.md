# Branch 13 — Performance & SSR Sprint

## Goal
Convert the app from a fully client-side rendered SPA into a properly server-rendered Next.js app. Fix slowness, add loading states, reduce JS bundle size.

## Current Problems
- All 34 pages are `"use client"` — data fetches fire after hydration (slow)
- No `loading.tsx` files anywhere — no streaming, blank flash on navigation
- No Suspense boundaries for sections
- Recharts loaded eagerly on analytics page (heavy bundle)
- Layout fetches auth server-side but pages re-fetch data client-side (double waterfall)

## What Needs To Happen (in order)

### Step 1 — Add `loading.tsx` files (fastest win)
Create a `loading.tsx` in each route group folder:
- `src/app/(dashboard)/manager/` 
- `src/app/(dashboard)/manager/residents/`
- `src/app/(dashboard)/manager/maintenance/`
- `src/app/(dashboard)/manager/levies/`
- `src/app/(dashboard)/manager/analytics/`
- `src/app/(dashboard)/manager/financials/`
- `src/app/(dashboard)/manager/strata/`
- `src/app/(dashboard)/manager/messaging/`
- `src/app/(dashboard)/manager/notifications/`
- `src/app/(dashboard)/manager/documents/`
- `src/app/(dashboard)/manager/common-areas/`
- `src/app/(dashboard)/resident/`
- `src/app/(dashboard)/resident/levies/`
- `src/app/(dashboard)/resident/maintenance/`
- `src/app/(dashboard)/resident/announcements/`
- `src/app/(dashboard)/resident/messaging/`
- `src/app/(dashboard)/resident/settings/`

Each `loading.tsx` should export a skeleton that matches the real page layout (same grid, same card shapes). Reuse the existing `Skeleton` component from `src/components/ui/skeleton.tsx`.

### Step 2 — Server-side prefetch for high-traffic pages
Convert these 5 pages from CSR to RSC + HydrationBoundary pattern:

**Priority pages:**
1. `/manager` (dashboard) — prefetch `getStats`, `maintenance.listByBuilding`, `announcements.listByBuilding`
2. `/manager/residents` — prefetch `residents.listByBuilding`, `units.listByBuilding`
3. `/manager/maintenance` — prefetch `maintenance.listByBuilding`
4. `/resident` (dashboard) — prefetch `getMyProfile`, `getMyLevies`, `getMyMaintenanceRequests`, `getMyAnnouncements`
5. `/resident/levies` — prefetch `resident.getMyLevies`, `customBills.getMyBills`

**Pattern to use:**
- Page becomes an `async` server component (no `"use client"` at page level)
- Create a tRPC server-side caller using `createCallerFactory` from `src/server/trpc/trpc.ts`
- Call procedures directly in the page, passing `buildingId` from the layout context
- Wrap in `HydrationBoundary` from `@tanstack/react-query` with `dehydrate(queryClient)`
- Keep interactive parts (forms, dialogs, mutations) in separate `"use client"` child components

**Critical constraint:** buildingId comes from Zustand store (`useBuildingContext`) on the client. Server doesn't have it. Options:
- Read it from the URL (add `[buildingId]` to routes) — big refactor, avoid
- Read it from the DB (same logic as layout: first building assigned to user) — preferred for prefetch
- Fall back to client fetch if no default building — acceptable

### Step 3 — Dynamic imports for heavy components
Use `next/dynamic` with `{ ssr: false }` for:
- All Recharts chart components in `src/app/(dashboard)/manager/analytics/page.tsx`
- Dialog components that are not needed on initial render (Create Building, Invite Resident, etc.)

### Step 4 — Suspense boundaries inside pages
For pages that have multiple independent data sections, wrap each section in `<Suspense fallback={<Skeleton />}>` so sections load independently rather than all-or-nothing.

Pages to prioritise:
- Manager dashboard (stats cards vs maintenance list vs announcements)
- Resident dashboard (profile card vs levies vs maintenance vs announcements)
- Analytics page (chart sections are independent)

## Architecture Notes

### tRPC server-side caller
`src/server/trpc/trpc.ts` exports `createCallerFactory`. To use in a server component:
```
createCallerFactory(appRouter)({ db, supabase, supabaseUser, user })
```
Auth context is built the same way as layouts — Supabase server client + DB user lookup.

### HydrationBoundary pattern
Standard Next.js App Router + TanStack Query v5 pattern:
- Create a `QueryClient` on the server
- Call `prefetchQuery` with the tRPC query key
- Pass `dehydrate(queryClient)` to `HydrationBoundary`
- Client picks up the cached data instantly — no loading state needed

### Files NOT to touch
- `src/lib/trpc/provider.tsx` — TRPCProvider stays as-is
- `src/lib/auth/redirects.ts` — auth middleware must not change
- All existing mutation logic in client components — mutations stay client-side

## What NOT to do
- Do not add `buildingId` to URLs — too large a refactor for this branch
- Do not remove `"use client"` from components that handle forms, mutations, or real-time subscriptions
- Do not change the tRPC router procedures — server caller uses existing procedures as-is
- Do not touch Stripe, email, or webhook code

## Progress Tracker

- [x] Step 1: loading.tsx files for all 17 routes (+ super-admin = 23 total)
- [x] Step 2: Server prefetch — manager dashboard
- [x] Step 2: Server prefetch — manager residents
- [x] Step 2: Server prefetch — manager maintenance  
- [x] Step 2: Server prefetch — resident dashboard
- [x] Step 2: Server prefetch — resident levies
- [x] Step 3: next/dynamic for Recharts (analytics page)
- [ ] Step 3: next/dynamic for heavy dialogs
- [ ] Step 4: Suspense boundaries — manager dashboard
- [ ] Step 4: Suspense boundaries — resident dashboard
- [ ] Step 4: Suspense boundaries — analytics

## Definition of Done
- Navigation between pages shows a skeleton immediately (no blank flash)
- Manager dashboard and resident dashboard show real data on first load without skeleton
- Analytics page JS bundle is smaller (Recharts lazy loaded)
- No regressions on auth, mutations, real-time messages, Stripe payments
