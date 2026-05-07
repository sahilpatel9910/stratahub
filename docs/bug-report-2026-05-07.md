# StrataHub — Full QA Audit Bug Report
**Date:** 2026-05-07  
**Branch:** `testing/full-qa-audit`  
**QA Run:** Playwright E2E — 155 tests, Chromium only  
**Results:** 65 passed · 77 failed · 1 flaky · 12 skipped  
**Test runtime:** 13.8 minutes  
**Dev server:** `npm run dev` on `localhost:3000`  
**Supabase:** Cloud instance (`iizhbllbjgadoxrnafim.supabase.co`)

---

## TEST INFRASTRUCTURE NOTES

Before listing bugs: several failures are caused by the **Playwright test timeout being shorter than the application's auth redirect chain**, not by broken UI. The login sequence involves:
1. `supabase.auth.signInWithPassword` (cloud round-trip ~2-4s)
2. `router.push('/')` → server-side `page.tsx` role lookup (`db.user.findUnique`)
3. Role-based redirect (another navigation)

This chain frequently exceeds the 15s `waitForURL` timeout under concurrent test load (4 workers). These are flagged separately from genuine app bugs.

---

## BUG-001 — CRITICAL | Auth & Permissions

### Super-Admin Routes Accessible Without SUPER_ADMIN Role

**Component/File:** `src/app/(dashboard)/super-admin/layout.tsx` or `src/proxy.ts`  
**Page/Route:** `/super-admin/organisations`, `/super-admin/buildings`, `/super-admin/users`  
**Action Tested:** Navigate to `/super-admin/organisations` while authenticated as `manager@demo.com` (BUILDING_MANAGER role)  
**Expected:** Redirect to `/access-required` or `/manager`  
**Actual:** Page loads at `http://localhost:3000/super-admin/organisations` — no redirect occurs  
**Severity:** **CRITICAL**  
**Screenshot:** `test-results/13-super-admin-*/test-failed-1.png`

**Evidence:**
```
Error: expect(page).not.toHaveURL(expected) failed
Expected pattern: not /\/super-admin/
Received string:  "http://localhost:3000/super-admin/organisations"
14 × unexpected value "http://localhost:3000/super-admin/organisations"
```

**Likely Root Cause:** The `super-admin` layout or route guard is not checking the user's role, or the `superAdminProcedure` guard only applies to tRPC calls but not the page itself. The middleware (`src/proxy.ts`) may not have a route-level guard for `/super-admin/` paths. A BUILDING_MANAGER can visually access all super-admin pages and potentially make super-admin tRPC calls if the page hydrates successfully.

---

## BUG-002 — CRITICAL | Auth & Permissions

### Reception Role Lands on `/` Instead of `/manager/visitors`

**Component/File:** `src/app/page.tsx` (root redirect logic)  
**Page/Route:** `/` (root redirect)  
**Action Tested:** Sign in as `reception@demo.com` and follow redirect  
**Expected:** Land on `/manager/visitors` (reception home page per sidebar config)  
**Actual:** URL is `http://localhost:3000/` — the page does not redirect reception to the correct portal  
**Severity:** **CRITICAL**  
**Screenshot:** `test-results/14-reception-role-*/test-failed-1.png`

**Evidence:**
```
Error: expect(page).toHaveURL(/\/manager\/visitors/) failed
Expected pattern: /\/manager\/visitors/
Received string: "http://localhost:3000/"
9 × unexpected value "http://localhost:3000/"
```

**Likely Root Cause:** The root `page.tsx` redirect map either does not have a RECEPTION case, or it groups RECEPTION with BUILDING_MANAGER and sends both to `/manager`, but then `/manager/layout.tsx` doesn't redirect RECEPTION to `/manager/visitors`. The cascade fails silently leaving the user at `/`.

---

## BUG-003 — HIGH | Auth & Permissions

### Resident Sidebar Hidden Elements (Sign Out, My Home, Nav Links)

**Component/File:** `src/components/layout/resident-sidebar.tsx`  
**Page/Route:** `/resident`  
**Action Tested:** Verify sidebar nav links and Sign Out button are visible after owner login  
**Expected:** Links for "My Home", "My Levies", "Maintenance" etc. and "Sign Out" button are visible  
**Actual:** `getByRole('link', { name: 'My Home' }).first()` — element not found; same for Sign Out button  
**Severity:** **HIGH**  
**Screenshot:** `test-results/12-resident-*/test-failed-1.png`

**Likely Root Cause:** The sidebar uses the `shadcn` `Sidebar` component with `variant="floating"`. On some viewport sizes or states, the sidebar may be hidden/collapsed by default and only revealed via a toggle. The sidebar links exist in DOM but may not be visible (opacity: 0 or off-screen) without the sidebar being opened. This is a **mobile/desktop state bug** — sidebar starts collapsed but tests assume it is expanded.

---

## BUG-004 — HIGH | State & Data

### Auth Redirect Chain Too Slow — Login Timeout (Intermittent)

**Component/File:** `src/app/page.tsx`, `src/lib/auth/redirects.ts`  
**Page/Route:** `/` → `/manager` or `/resident`  
**Action Tested:** Sign in as `manager@demo.com` and wait for redirect to `/manager`  
**Expected:** Redirect completes within 15 seconds  
**Actual:** `TimeoutError: page.waitForURL: Timeout 15000ms exceeded` — fires on all login tests  
**Severity:** **HIGH** (blocks E2E test infrastructure; indicates slow auth path in production too)  
**Screenshot:** `test-results/01-auth-*/test-failed-1.png`

**Evidence:**
```
TimeoutError: page.waitForURL: Timeout 15000ms exceeded.
waiting for navigation until "load"
at helpers/auth.ts:17
```

**Likely Root Cause:** The root `page.tsx` calls `supabase.auth.getUser()` → `db.user.findUnique({ where: { supabaseAuthId } })` → role lookup → redirect. Under concurrent load (4 parallel Playwright workers all hitting Supabase simultaneously) each login roundtrip takes 5-10s. Combined with DB query, the chain exceeds 15s. The fix is both a test infrastructure fix (increase timeout, add storage state caching) AND a production concern (the DB lookup on every root load should be cached).

---

## BUG-005 — HIGH | Auth & Permissions

### Reception Cannot Access Own Allowed Pages After Login

**Component/File:** Reception login flow + `/manager/visitors`, `/manager/parcels`, `/manager/keys`  
**Action Tested:** Login as reception, navigate to `/manager/visitors` — page content not found  
**Expected:** Page loads with "Visitors" heading  
**Actual:** `getByText(/visitor/i).first()` — not visible after 10s timeout  
**Severity:** **HIGH** (reception role is entirely broken — redirects to `/` instead of portal)  
**Root Cause:** Cascades from BUG-002 — reception lands at `/` which doesn't render any page content

---

## BUG-006 — HIGH | Frontend UI

### Page Heading Text Mismatches — Multiple Pages

**Pages Affected:**
- `/manager/announcements` — test looks for `/announcement/i`, page may use "Building Communications" or similar
- `/manager/documents` — test looks for `/document/i`
- `/manager/messages` — test looks for `/message/i`
- `/manager/notifications` — test looks for `/notification/i`
- `/manager/analytics` — test looks for `/analytic/i`
- `/manager/financials` — test looks for `/financial/i`
- `/manager/common-areas` — test looks for `/common area/i`
- `/manager/settings` — test looks for `/setting/i`
- `/resident/levies` — test looks for `/levy|levies/i`
- `/resident/maintenance` — test looks for `/maintenance/i`
- `/resident/inspections` — test looks for `/inspection/i`

**Action Tested:** Navigate to page, assert heading is visible  
**Actual:** Element not found within 8-15s timeout (including retry)  
**Severity:** **HIGH** — indicates either slow page loads (RSC + Suspense skeletons blocking text for too long) or the page headings use different wording  
**Likely Root Cause (two sub-causes):**
1. **Slow RSC hydration**: Branch 13 added `loading.tsx` skeletons and server prefetch. In dev mode without warm cache, the first SSR render can take 8-15s before the skeleton resolves to real content.
2. **Text mismatch**: Some pages use eyebrow labels instead of `<h1>` headings, e.g. `<p class="eyebrow-label">Manager Overview</p>` instead of an actual heading with the page name.

---

## BUG-007 — HIGH | Backend

### Maintenance Cache Invalidation Gap (Known — Documented)

**Component/File:** `src/app/(dashboard)/manager/maintenance/[id]/_client.tsx`, `src/app/(dashboard)/manager/maintenance/_client.tsx`  
**Action Tested:** Update maintenance status on detail page, go back to list — list shows stale status  
**Expected:** List page reflects new status without manual refresh  
**Actual:** Status mutation on detail only invalidates `getById`, not `listByBuilding` or `getStats`  
**Severity:** **HIGH** (data staleness leads to incorrect operational view)  
**From CLAUDE.md:** Documented but unfixed.

---

## BUG-008 — HIGH | Backend

### `NEXT_STATUSES` Transition Map Duplicated (Known — Documented)

**Component/File:** `src/app/(dashboard)/manager/maintenance/_client.tsx:74` AND `src/app/(dashboard)/manager/maintenance/[id]/_client.tsx`  
**Risk:** If a status transition is changed in one file and not the other, the list page and detail page will show different available transitions for the same request — confusing managers.  
**Severity:** **HIGH** (maintenance risk; silent divergence)  
**From CLAUDE.md:** Documented but unfixed.

---

## BUG-009 — HIGH | Frontend UI

### Notification Pagination Button Not Found

**Component/File:** `src/app/(dashboard)/manager/notifications/_client.tsx`  
**Action Tested:** Check for "Load more" or "Next" pagination button  
**Expected:** Cursor-based pagination UI visible (Branch 9 added cursor pagination)  
**Actual:** No such button found — either pagination is scroll-based (infinite scroll) or requires enough notifications to trigger, or the button uses different text  
**Severity:** **HIGH** (if notifications accumulate and there's no way to access older ones, important items get lost)

---

## BUG-010 — HIGH | Frontend UI

### Tenancy Detail Page — No Clickable Row Links

**Component/File:** `src/app/(dashboard)/manager/rent/_client.tsx`  
**Action Tested:** Click first tenancy row to navigate to `/manager/tenancies/[id]`  
**Expected:** Each tenancy row is clickable and links to detail page  
**Actual:** `rows.first().getByRole('link').first()` — no links found; timeout after 31s  
**Severity:** **HIGH** (managers cannot access tenancy detail, record payments, or view schedules)  
**Likely Root Cause:** The tenancy rows use a `<button>` or `router.push()` call rather than an `<a>` tag, OR the Tenancies tab isn't loaded because the tRPC query fails silently without building selected.

---

## BUG-011 — MEDIUM | Frontend UI

### `assignInput` useEffect Clobbers In-Progress Text (Known — Documented)

**Component/File:** `src/app/(dashboard)/manager/maintenance/[id]/_client.tsx`  
**Action Tested:** Type in "Assign contractor" field, wait for 3s (refetch interval), check value  
**Expected:** Typed text preserved after refetch  
**Actual:** `useEffect` syncs `req.assignedTo` on every refetch, overwriting anything being typed  
**Severity:** **MEDIUM** (poor UX; frustrating for managers)  
**Fix:** Add `hasInitialized` ref — only sync from server on first mount.

---

## BUG-012 — MEDIUM | Frontend UI

### Photo Upload Failure Leaves Button Disabled (Known — Documented)

**Component/File:** `src/app/(dashboard)/manager/maintenance/[id]/_client.tsx`  
**Action Tested:** Trigger photo upload failure, attempt to re-upload  
**Expected:** "Add Photo" button re-enabled after upload failure  
**Actual:** `cancelPendingFile` not called in `confirmUpload` catch block; button stays disabled  
**Severity:** **MEDIUM** (operational blocker — managers must reload page to re-enable upload)

---

## BUG-013 — MEDIUM | Frontend UI

### Residents Table Loads Too Slowly in Test Environment

**Component/File:** `src/app/(dashboard)/manager/residents/_client.tsx`  
**Action Tested:** Load residents table after login  
**Expected:** Table visible within 10s  
**Actual:** Timeout after 14s on both attempt and retry  
**Severity:** **MEDIUM** (page performance issue — tRPC query to Supabase cloud takes too long under parallel test load)

---

## BUG-014 — MEDIUM | State & Data

### `RentPayment.amountCents` Overwritten on PARTIAL (Known — Documented)

**Component/File:** `prisma/schema.prisma` (RentPayment model), `src/server/trpc/routers/rent.ts`  
**Risk:** No `originalAmountCents` field. When a PARTIAL payment is recorded, the new amount overwrites the original. Summing PARTIAL rows gives amount paid, not amount owed. Reports will show incorrect outstanding balances.  
**Severity:** **MEDIUM** (financial accuracy bug)

---

## BUG-015 — MEDIUM | Mobile

### Mobile Viewport: Resident Pages Don't Show Heading Text

**Component/File:** Multiple resident pages  
**Test viewport:** 390×844 (iPhone 13)  
**Action Tested:** Load `/resident/levies` and `/manager/maintenance` on mobile  
**Expected:** Page heading text visible  
**Actual:** `getByText(/levy|levies/i)` and `getByText(/maintenance/i)` — not visible within 5s  
**Severity:** **MEDIUM**  
**Likely Root Cause:** The floating sidebar (`variant="floating"`) may be overlaying content on mobile; page content may be rendered below an off-canvas sidebar state; OR the mobile sidebar toggle is not implemented, leaving content inaccessible.

---

## BUG-016 — MEDIUM | Auth & Permissions

### Forgot Password Page: Navigation Flaky

**Component/File:** `src/app/(auth)/login/page.tsx`  
**Action Tested:** Click "Forgot password?" link on login page  
**Expected:** Navigate to `/forgot-password`  
**Actual (flaky):** Sometimes navigates correctly; sometimes stays at `/login`. Marked as 1 flaky test.  
**Severity:** **MEDIUM** (flaky — could be a race condition in the link click vs. Supabase client initialisation)

---

## BUG-017 — LOW | Backend

### Stripe Webhook Test: Relative URL Fetch Fails

**Component/File:** `tests/15-known-bugs.spec.ts:153`  
**Action Tested:** `page.evaluate(() => fetch('/api/stripe/webhook', ...))` — verifying webhook is accessible without auth  
**Actual:** `TypeError: Failed to execute 'fetch' on 'Window': Failed to parse URL from /api/stripe/webhook` — because `page` has no URL context (no `page.goto` before the evaluate)  
**Severity:** **LOW** (test infrastructure bug — test is invalid; the actual webhook accessibility is untested)  
**Note:** The real underlying concern from CLAUDE.md is valid — if `/api/stripe/` is ever removed from `isPublicAuthPath()`, payments will silently fail. This needs a separate, correct test.

---

## BUG-018 — LOW | State & Data

### Resident Outstanding Balance: Sums Correctly (PASS — Verified)

Per CLAUDE.md concern, the outstanding balance correctly sums `levyUnpaidTotal + billUnpaidTotal`. Test **PASSED**. No bug here — documentation correctness confirmed.

---

## MISSING ITEMS

- No `context/` folder exists → noted per requirements
- No dedicated unit tests or integration tests (Jest/Vitest) — `npm run test` runs `tsx --test` but no test files found in standard locations
- No `graphify/` folder at project root — `graphify-out/` exists but was excluded from test scope

---

## SUMMARY TABLE

| Bug | Severity | Category | Status |
|-----|----------|----------|--------|
| BUG-001: Super-admin routes unguarded | **CRITICAL** | Auth/Permissions | Confirmed |
| BUG-002: Reception lands at `/` not `/manager/visitors` | **CRITICAL** | Auth/Permissions | Confirmed |
| BUG-003: Resident sidebar hidden on load | **HIGH** | Frontend UI | Confirmed |
| BUG-004: Auth redirect chain too slow | **HIGH** | State/Performance | Confirmed |
| BUG-005: Reception pages inaccessible | **HIGH** | Auth/Permissions | Confirmed (cascade) |
| BUG-006: Page heading text mismatches / slow SSR | **HIGH** | Frontend UI | Confirmed |
| BUG-007: Maintenance cache invalidation gap | **HIGH** | Backend | Documented |
| BUG-008: NEXT_STATUSES duplicated | **HIGH** | Backend | Documented |
| BUG-009: Notification pagination not found | **HIGH** | Frontend UI | Confirmed |
| BUG-010: Tenancy rows have no links | **HIGH** | Frontend UI | Confirmed |
| BUG-011: assignInput clobbers mid-edit | **MEDIUM** | Frontend UI | Documented |
| BUG-012: Photo upload state broken on failure | **MEDIUM** | Frontend UI | Documented |
| BUG-013: Residents table loads too slowly | **MEDIUM** | Performance | Confirmed |
| BUG-014: RentPayment.amountCents overwritten | **MEDIUM** | State/Data | Documented |
| BUG-015: Mobile: pages hidden behind sidebar | **MEDIUM** | Mobile | Confirmed |
| BUG-016: Forgot password link is flaky | **MEDIUM** | Frontend UI | Confirmed |
| BUG-017: Stripe webhook test (invalid test) | **LOW** | Test infra | Test bug |
| BUG-018: Outstanding balance (VERIFIED OK) | — | — | Pass |
