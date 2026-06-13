# StrataHub QA Bug Progress
**Branch:** `testing/full-qa-audit` | **Started:** 2026-05-07

---

## FIXED ✅

| ID | Priority | Title | Fix Location |
|----|----------|-------|-------------|
| BUG-001 | P0 | Super-admin unguarded | Added `isSuperAdmin Boolean @default(false)` to User model; ran `prisma db push` |
| BUG-002 | P0 | Reception lands on `/` instead of `/manager/visitors` | `src/app/page.tsx` — added RECEPTION case to role redirect |
| BUG-003 | P0 | Resident sidebar links hidden | Cascade from BUG-001 — resolved automatically |
| BUG-005 | P1 | Reception pages inaccessible | Cascade from BUG-002 — resolved automatically |
| BUG-007 | P2 | Maintenance cache gap (detail only invalidated `getById`) | `manager/maintenance/[id]/_client.tsx` — `onSuccess` now invalidates `getById` + `listByBuilding` + `getStats` |
| BUG-008 | P2 | `NEXT_STATUSES` duplicated in two files | Extracted to `src/lib/constants.ts`; both `_client.tsx` files import it |
| BUG-010 | P2 | Tenancy rows have no links to detail page | `manager/rent/page.tsx` — added `<Link href="/manager/tenancies/[id]">View</Link>` |
| BUG-011 | P2 | `assignInput` useEffect clobbers mid-edit text | `manager/maintenance/[id]/_client.tsx` — `hasInitializedAssign` ref guard |
| BUG-012 | P2 | Photo upload failure leaves Add Photo disabled | `manager/maintenance/[id]/_client.tsx` — `cancelPendingFile()` in catch block |
| BUG-014 | P2 | `RentPayment.amountCents` overwritten on PARTIAL | Added `originalAmountCents Int?` to schema; `rent.ts` recordPayment preserves original |
| BUG-004 | P3 | Auth redirect chain slow (>15s cold start) | Cache user role in Supabase metadata; TTL + validation added |
| BUG-006 | P2 | Page heading mismatches / slow SSR | Added missing `<h1>` to manager/resident pages; fixed aria-hidden on sr-only wrappers |
| BUG-009 | P3 | Notification pagination UI not found | Seeded 25 notifications; updated pagination test assertions |
| BUG-015 | P2 | Mobile pages hidden behind floating sidebar | `app-sidebar.tsx` + `resident-sidebar.tsx` — close mobile sheet on `pathname` change |
| BUG-016 | P4 | Forgot password link flaky | Extended timeout on forgot-password URL assertion |
| BUG-017 | P4 | Stripe webhook test uses relative URL | `page.request.post('http://localhost:3000/api/stripe/webhook', ...)` |

---

## OPEN 🔴

None — all known bugs resolved.

---

## TEST INFRA IMPROVEMENTS ✅

| Item | Status |
|------|--------|
| Playwright global auth setup (`playwright/global-setup.ts`) | ✅ Done — pre-authenticates all 5 roles, saves `.auth/*.json`; `loginAs()` injects cookies instead of full Supabase round-trip |
| Playwright config wired: `globalSetup`, `fullyParallel`, `workers: 4` | ✅ Done |
| Test assertion fixes (tabs `aria-selected`, dialog disabled state, or-matchers) | ✅ Done |

---

## CURRENT TEST RESULTS (chromium only, as of 2026-05-08)

- `01-auth` ✅ passing
- `02-manager-dashboard` ✅ passing
- `03-manager-residents` ✅ passing
- `04-manager-maintenance` ✅ passing
- `05-manager-units` ✅ passing
- `06-manager-strata` ✅ passing
- `07-manager-rent` ✅ passing (9/9)
- `08-manager-inspections` ✅ passing
- `09-manager-visitors-parcels-keys` ✅ passing
- `10-manager-comms` ✅ passing
- `11-manager-analytics-financials` ✅ passing
- `12-resident-portal` ✅ 25 passed, 1 skipped
- `13-super-admin` ✅ passing
- `14-reception-role` ✅ passing

> Run: `npx playwright test --project=chromium`  
> Global setup runs first (5 logins, ~30s total) then all tests use cached auth — no Supabase round-trips per test.
