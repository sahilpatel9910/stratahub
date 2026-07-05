# StrataHub — Production Readiness & Data Accuracy Plan

> **Living document.** Updated after every task so work can resume even if context/tokens are lost.
> **Anchor date:** 2026-06-13 (all relative data is computed from "now", never hard-coded years).
> **Branch:** `feat/production-readiness-v2`

---

## 0. How to use this file (resume instructions)

1. Read **§5 Task Board** — the first task not marked ✅ DONE is the next action.
2. Read **§3 Canonical Data Model** before touching seed/data — it is the single source of truth for every number.
3. Read **§4 Ambiguity Resolutions** before changing any page's purpose.
4. After finishing a task: tick it in §5, add a line to **§6 Change Log**, and update **§7 Resume Pointer**.
5. Verify data with the audit script: `node_modules/.bin/tsx seed/_audit.ts` (read-only counts + aggregates).

---

## 1. Goal (user's words, distilled)

> "Perfect clean data that reflects on dashboard perfectly… proper numbers — date, percentage or rent — all of it.
> Check logic of each thing. Remove ambiguities (same task in two pages must have a single clear meaning).
> Check design for every page. Do development."

**Not** about fake names/emails. **Is** about: every number (date/%/$) being correct, internally consistent, and current relative to today; calculation logic being right; each page having one clear job; consistent design.

---

## 2. Findings — current state (audited against live DB, 2026-06-13)

| Area | Problem | Impact on dashboard |
|---|---|---|
| **Rent** | 60 payments, 1 PAID / 59 PENDING / **0 OVERDUE**. All due dates 2024-01 → 2025-03 (100% in the past). | "Rent collected this month" = a fluke $2,500; overdue under-reported to 0; no current/upcoming rent. |
| **Leases** | All 5 active tenancies' `leaseEndDate` already passed (≤ 2025-04-30) but `isActive = true`. | Expired leases shown as active. Renewals/move-outs nonsensical. |
| **Unit entitlements** | `unitEntitlement = null` on all 30 units; `lotNumber` null. | Levy apportionment impossible; strata "total entitlements" = 0. |
| **Strata levies** | **0 rows.** Balances set statically ($125k admin / $450k capital). | `/manager/strata`, `/resident/levies`, owner financials all empty. |
| **Financial records** | **0 rows.** | `/manager/financials` = $0/$0/$0; `/manager/analytics` flat. |
| **Bond records** | **0 rows** (tenancy.bondStatus = LODGED but no `BondRecord`). | Bond tracking empty; status inconsistent. |
| **Custom bills** | 0 rows. | Custom billing empty; owner "amounts owing" = 0. |
| **Inspections / Documents / Visitors / Keys / Bookings / Bylaws / Meetings / Emergency contacts / Parking / Storage** | **0 rows each.** | Those pages all empty — incl. Reception's primary Visitors page. |
| **Occupancy** | 8/30 occupied = **26.7%** (22 vacant investment units). | Technically consistent but looks broken for a flagship demo. |
| **Duplicate data** | **2 organisations, 2 buildings, 29 users** — seed creates only 1/1/~25. | Building selector / lists show orphan empty building; ambiguous "which building". |
| **Bond amount** | `bondAmountCents = 2 × monthly rent`. NSW max = **4 weeks** rent (≈ 0.92 month). | Bond figures wrong vs legal rule. |
| **Strata dates** | `insuranceExpiry = 2025-06-30` (expired), `nextAgmDate = 2025-09-15` (past); announcement promotes a past AGM as upcoming. | Stale/contradictory dates on strata page. |

### Logic findings (code, not data)
- **L1** `rent.ts › buildRentScheduleEntries`: WEEKLY count = `months × 4`, FORTNIGHTLY = `months × 2`. A year is **52** weeks / **26** fortnights, so a "12-month" weekly schedule covers only 48 weeks (~8% short). Should derive count from lease span (or use 52/12 ≈ 4.345 and 26/12). 
- **L2** Overdue is only set by the `mark-overdue` cron, never live. Seed must set correct statuses; dashboards should not assume the cron ran. Consider a derived display status.
- **L3** `financials.getSummary` sums all-time with no period filter (no this-month/quarter/FY). Acceptable but document it; analytics may need periods.
- **L4** `isOccupied` is a denormalised flag — must stay in sync with active tenancy / owner-occupancy. Verify all write paths keep it correct.
- **L5** Strata levy apportionment logic in `strata.ts` — **not yet read**; verify it apportions by `unitEntitlement`.
- **L6** No explicit rent **collection-rate %** found; dashboard shows $ only. Confirm whether a % is expected.

---

## 3. Canonical Data Model (single source of truth for the rebuild)

> All dates are **offsets from `now`** so data never goes stale. Money in **cents**. Currency **AUD**, locale **en-AU**.

### ✅ Confirmed decisions (2026-06-13)
- **DB:** Wipe + re-seed the configured Supabase (authorised). Run `db:seed:wipe` then rebuilt `db:seed:demo`, then verify with `_audit.ts`.
- **Scope:** **Multi-building.** One org (*Harbour Strata Pty Ltd*) manages **2 buildings**, each with full data; the building selector must be meaningful. Manager assigned to both.
- **Occupancy:** **~80%** per building.
- **Rent:** **Mixed frequencies** (WEEKLY / FORTNIGHTLY / MONTHLY). Bonds = **4 weeks** (NSW).
- **Users:** Only the documented demo accounts get Supabase **auth logins** (manager, reception, owner1–5, tenant1–5, super-admin — preserves Playwright global-setup). All other owners/tenants are **DB-only** users (`supabaseAuthId = null`, which the schema allows) so ownership/tenancy data is realistic without creating dozens of auth accounts.

**Buildings:**
- **B1 — Harbour View Apartments**, 1 Macquarie Street, Sydney NSW 2000, 10 floors × 3 = 30 units, scheme `SP12345`.
- **B2 — Parkline Residences**, 88 Walker Street, North Sydney NSW 2060, 6 floors × 3 = 18 units, scheme `SP67890`. (Both NSW so bond rules are uniform; revisit if multi-state testing is wanted.)
- De-dupe: the rebuilt seed owns both buildings; `wipe.ts` removes everything else (incl. the current orphan org/building).

**Units & entitlements:** pos1 = 1-bed, pos2 = 2-bed, pos3 = 3-bed (per floor). `lotNumber` = 1..30. `unitEntitlement` by type so the building totals **1000**: 1-bed = 25, 2-bed = 35, 3-bed = 40 (10 of each → 250+350+400 = 1000). Set `squareMetres`, `parkingSpaces` (2/3-bed get 1), `storageSpaces`.

**Occupancy target ≈ 80%** (≈ 24/30): mix of owner-occupied + tenanted; ~6 genuinely vacant. *(Pending confirmation — see questions.)*

**Rent (Sydney CBD, weekly basis):** 1-bed $720/wk, 2-bed $920/wk, 3-bed $1,250/wk. Store using a **mix of frequencies** (WEEKLY / FORTNIGHTLY / MONTHLY) to exercise all schedule logic. Monthly = weekly × 52 / 12; fortnightly = weekly × 2. *(Pending confirmation.)*

**Bond (NSW, 4 weeks):** `bond = round(weeklyRent × 4)`. Create a matching `BondRecord`: status LODGED, authority "NSW Fair Trading – Rental Bonds Online", state NSW, `lodgementDeadline = leaseStart + 10 business days`, `lodgementDate ≈ leaseStart + 5 days`, reference number.

**Lease dates (staggered, all spanning now):** e.g. start `now − {12,10,8,6,4} mo`, end `start + 12 mo` (so several renewals fall in the next few months; ≥1 already near expiry). No active lease may have `leaseEndDate < now`.

**Rent payment schedule:** generate from lease start at the tenancy's frequency. Statuses by date:
- due < (now − 1 period): **PAID**, `paidDate ≈ dueDate + 0–3 days`, method "Bank Transfer"/"Stripe".
- the one most-recent past period: PAID for most tenants; **OVERDUE** for exactly **1–2 "problem" tenants** (so overdue count is realistic, not 0 and not 60).
- current/next periods: **PENDING**.
- Target overall collection ≈ **92–96%**.

**Strata levies (quarterly, by entitlement):** annual budget admin $200k + capital works $120k → quarterly admin $50k, CW $30k, apportioned by entitlement/1000. Per unit/quarter: 1-bed admin $1,250 / CW $750; 2-bed $1,750 / $1,050; 3-bed $2,000 / $1,200. Generate last 4 quarters + current: past PAID, current PENDING (some PAID). Add one `SPECIAL_LEVY` (façade repairs) last quarter. `quarterStart`, `dueDate = quarterStart + 30 days`.

**Strata balances:** set consistent with levy history: `adminFundBalance ≈ $185,000`, `capitalWorksBalance ≈ $520,000`. `insuranceExpiry = now + 8 mo`, `nextAgmDate = now + 3 mo`.

**Bylaws:** ~5 (pets, noise, parking, renovations, common-property use) with `bylawNumber`, `effectiveDate` in the past.
**Meetings:** last AGM (past), committee meeting (recent past), next AGM (`now + 3 mo`).

**Financial records:** monthly building income (levy income, interest) + expenses (cleaning, gardening, insurance premium, lift servicing, utilities/common, management fee, repairs) across the **last 12 months** so analytics trends populate and net is plausibly positive. Income ≈ reconciles with levies collected.

**Custom bills:** ~5 — water usage (tenant), parking fine, key replacement, move-in fee (owner), damage chargeback — mixed PAID/PENDING/OVERDUE, mixed ONLINE/MANUAL.

**Inspections:** per several tenanted units — a COMPLETED entry inspection (rooms + items + PASS/FAIL) and an upcoming ROUTINE inspection (`now + ~3 weeks`).

**Visitors:** ~10 recent entries (deliveries, tradespeople, personal, real-estate) with arrival/departure times spread over the last 2 weeks. (Reception's primary page.)

**Keys:** key records (FOB, PHYSICAL_KEY, ACCESS_CODE, SWIPE_CARD) issued to residents; 1–2 with `rotationDue ≈ now + 1 wk` (so "keys to rotate" is small but non-zero); key logs (ISSUED/RETURNED).

**Documents:** building docs (strata minutes, insurance certificate, building rules, annual financial report) + a lease agreement per tenancy. Realistic `fileSize`/`mimeType`. NOTE: `fileUrl`/`storagePath` point to storage — demo rows list fine but download needs real objects (acceptable for demo; flag it).

**Common-area bookings:** a few upcoming + past for BBQ / Pool / Meeting Room (respect `bookingRequired`).

**Maintenance:** keep/extend; set `estimatedCost`/`actualCost`, `assignedTo`, `scheduledDate`/`completedDate`; spread `createdAt` over the last 6 months for trends.

**Messages / Notifications:** make notifications reflect real seeded events (not "Demo notification N"); a few realistic message threads manager↔resident.

---

## 4. Ambiguity Resolutions (one job per page)

| Concern | Resolution |
|---|---|
| Empty `/(dashboard)/owner` & `/(dashboard)/tenant` route dirs | **Delete** (dead; portal is `/resident/*` gated by role). |
| `/manager/rent` vs `/manager/tenancies/[id]` | **Rent** = rent roll + record/track payments (operational money view). **Tenancies** = lease lifecycle (terms, bond, generate schedule, move-in/out). Cross-link; do not duplicate "record payment". |
| `/manager/strata` vs `/manager/financials` vs `/manager/analytics` | **Strata** = governance: levies, fund balances, bylaws, meetings, insurance. **Financials** = building income/expense ledger (CRUD). **Analytics** = read-only trends/visuals only (no CRUD). No duplicate "create levy" vs "create income". |
| `/resident/rent` vs `/resident/levies` | **Rent** = tenant's own rent (view + pay). **Levies** = owner's strata levies + financial summary (view + pay). Sidebar gates by role; a user who is both sees both, each clearly labelled. Verify gating. |
| 2 orgs / 2 buildings | **DECIDED: multi-building.** Rebuilt seed owns B1+B2 under one org; `wipe.ts` removes the orphan org/building. Building selector exercised. |

---

## 5. Task Board

Status: ⬜ todo · 🟡 in-progress · ✅ done · ⏸ blocked (needs user)

### Phase D — Data layer (THE priority: accurate numbers on every dashboard)
- ✅ **D0** Root cause of duplicates found: `prisma/seed.ts` creates org *"StrataHub Demo Org"* + 24-unit "Harbour View Apartments"; `seed/demo.ts` creates org *"Harbour Strata Pty Ltd"* + 30-unit "Harbour View Apartments" → 2 orgs, 2 same-named buildings. **Fix:** one org owns B1+B2; robust `wipe.ts` clears ALL orgs/buildings/non-super-admin users (handles orphans), preserves super-admin `admin@stratahub.com.au`.
- ✅ **D1** Rewrote `seed/demo.ts`: 2 buildings, relative dates, entitlements (1000/600), 80%/78% occupancy, mixed rent frequencies, 4-week NSW bonds, DB-only residents + demo logins.
- ✅ **D2** Quarterly levies (432 rows) apportioned by entitlement + 10 bylaws + 6 meetings; balances $185k/$520k; insurance/AGM dates moved to future.
- ✅ **D3** Financial ledger (164 rows, 12 months) — B1 net +$176,560, B2 net +$105,936.
- ✅ **D4** Bond records (22), custom bills (4, mixed status), inspections (8 w/ rooms+items), visitors (10), keys (8 + logs, 1 rotation-due), documents (30 incl. leases), bookings (4), parking (25)/storage (12), emergency contacts.
- ✅ **D5** Realistic rent: 423 PAID / 264 PENDING / 10 OVERDUE; collection 97.0% / 98.8%; "collected this month" $29,840 / $15,840.
- ✅ **D6** Rewrote `seed/wipe.ts` — robust, clears all orgs/buildings/non-super-admin users (handles orphans), preserves super-admin.
- ✅ **D7** Wiped + re-seeded live DB; verified with `seed/_audit.ts`. All integrity checks pass (0 expired-active leases, 0 missing entitlements/owners, 0 future-dated payments, 0 past-due-PENDING).

### Phase S — Security hardening (2026-07-04)
- ✅ **S1** `api/storage/inspection-upload-url` had NO authorization (any authenticated user could get a signed upload URL for any inspection). Now resolves inspection → building and requires operations access; image-only content-type allowlist added here and on `maintenance-upload-url`.
- ✅ **S2** Stripe webhook now requires `session.payment_status === "paid"` before marking levy/bill/rent PAID (checkout.session.completed also fires for delayed payment methods).
- ✅ **S3** `strata.createCheckoutSession` admin bypass narrowed: only managers of THAT levy's building (or super admins) skip the unit-ownership check (was: any BUILDING_MANAGER anywhere). Stripe session-reuse now wrapped in try/catch in strata + custom-bills (parity with rent.ts — an expired saved session no longer makes the item unpayable).
- ✅ **S4** `api/auth/callback` `next` param restricted to relative paths (open-redirect hardening, parity with signout).
- ✅ **S5** Supabase: revoked EXECUTE on SECURITY DEFINER `public.rls_auto_enable()` from anon/authenticated/public (was WARN in security advisors). Remaining advisor items: "RLS enabled no policy" INFO lints are expected (app uses Prisma direct connection; deny-by-default via PostgREST is the intent); "leaked password protection" toggle is Pro-tier — skipped (free tier only).

### Phase L — Logic correctness
- ✅ **L1** Fixed WEEKLY/FORTNIGHTLY schedule counts in `rent.ts` → `Math.round(months*52/12)` / `*26/12` (was `*4` / `*2`, ~8% short). Loop still breaks at `leaseEndDate`.
- ✅ **L5** **Bug found + fixed:** `strata.bulkCreateLevies` charged a FLAT amount to every unit, ignoring `unitEntitlement`. Now apportions the **total** by entitlement (exact-sum via remainder-on-last; equal-split fallback). Per-unit levy emails now send the apportioned amount. UI relabelled "Amount per Unit" → "Total Levy — all units".
- ✅ **L6** Collection rate now computed server-side in `buildings.getStats` (`collectionRatePct`: collected/expected for payments due this month, null when none due) and shown in the manager dashboard "Rent Collected" panel description.
- ✅ **L2** Live-derived overdue: `buildings.getStats.overdueRentCount`, `rent.getRentRoll.overduePayments` and tenancy-detail overdue count all treat PENDING-past-due as overdue even if the `mark-overdue` cron hasn't run.
- ✅ **L3** `financials.getSummary` accepts optional `from`/`to` (default remains all-time — backward compatible).
- ✅ **L4** `isOccupied` sync fixed: `tenancy.create` sets it true in the same transaction; `tenancy.end` sets it false when no other active tenancy remains (owner-occupancy stays a manual flag via `units.update`). Previously NOTHING ever set it back to false.
- ✅ **L7 (dedupe, 2026-07-04)** Rent-schedule builder existed in THREE copies — `rent.ts` (fixed), `tenancy.ts` and `units.ts` (both still had the old ×4/×2 undercount bug). Consolidated into `src/server/lib/rent-schedule.ts`; all routers import it. Never re-implement per router.

### Phase A — Ambiguities
- ✅ **A1** Deleted empty `/(dashboard)/owner` & `/(dashboard)/tenant` route dirs.
- ✅ **A2** (2026-07-04) Record Payment removed from `manager/tenancies/[id]` (it duplicated the Rent page's action AND asked for the amount in raw cents); tenancy detail is now read-only payment history + Generate Schedule (lease lifecycle), with a "Record payments on the Rent page →" cross-link. Rent page already links to tenancy detail. Verified: levy creation only on Strata, financial records only on Financials, Analytics is read-only.
- ✅ **A3** (2026-07-04) Resident sidebar now gates via lightweight `resident.getMyAccess` ({hasOwnership, hasTenancy}): "My Rent" only for tenants; levies item labelled "My Levies" (owners) vs "My Bills" (tenants — same page, serves custom bills). Levies page h1/description/default-tab adapt to role. Added Parcels + Visitors nav items.

### Phase U — Design / UI pass (every page) — scope: **consistency pass** (user-chosen)
- ✅ **U0** Formatters: `formatCurrency` already existed in `src/lib/constants.ts`; **added** `formatDate`, `formatDateTime`, `formatPercent` (null-safe → "—"; % to 1dp) there. Adopted on the manager dashboard (`manager/_client.tsx`) as the reference pattern.
  - **NOTE — do NOT "fix" these:** the 8 inline `/100` are legitimate (pre-filling dollar values into number inputs in rent/financials/strata edit forms, and recharts axis math in `analytics/_charts.tsx`). They are NOT display bugs.
- ✅ **U-headings** Normalised all 9 outlier headings (`text-2xl font-bold` → standard `text-3xl font-semibold tracking-[-0.05em] text-foreground md:text-4xl`). Verified: **all page headings now consistent** (only the intentional hero `md:text-5xl`, `sr-only`, and `error.tsx` variants remain). No `PageHeader` component introduced (kept current style, per user choice).
- ✅ **U1/U2/U3 (core)** Consolidated **12 duplicate local `formatDate` helpers** → shared `formatDate` from `constants.ts` (manager: financials, strata, rent, tenancies, maintenance, parcels, announcements, inspections, documents, keys; resident: rent; super-admin: users). Fixed an inline date outlier in `manager/rent` (was `13/06/2026`, now `13 Jun 2026`). tsc + eslint clean.
  - **Loading/empty states:** coverage is already good (loading.tsx: manager 21 / resident 12 / super-admin 3; list pages have empty states). No action needed.
  - **Intentionally left (special formats):** local helpers in `resident/visitors`, `resident/parcels` (date+time), `resident/inspections` (weekday/long-month), `manager/common-areas` (`formatDateTime`), `manager/strata/custom-bills-tab` (UTC tz).
- 🟡 **U-remaining (optional, cosmetic)** ~19 files still use **inline** `toLocaleDateString` (no duplication; all render correct en-AU dates and guard nulls). Converting to `formatDate`/`formatDateTime` is pure DRY polish — not a correctness/visual issue. List: resident {_client, messages, visitors, parcels, announcements, common-areas, inspections, levies, maintenance, maintenance/[id], documents}; manager {visitors, residents, messages, common-areas, inspections/[id], maintenance/[id], custom-bills-tab}; `analytics/_charts` (legitimate axis math — leave).
- ✅ **U4** (2026-07-05) Mobile spot-check at Pixel 7 (412px): sidebar sheet opens + auto-closes after nav (BUG-015 fix holds); **zero horizontal overflow** on 14 key manager/resident pages. Env-gated `mobile` Playwright project added (`MOBILE=1 npx playwright test --project=mobile`); 6 mobile "failures" in 02/12 are desktop-written sidebar assertions (sidebar is a sheet on mobile), not responsive bugs.

### Phase V — Verify
- ✅ **V1** `tsc --noEmit` clean across the project after all changes (rent.ts, strata.ts, strata page, seed).
- ✅ **V2** (2026-07-05) Targeted Playwright on money/dashboard pages (02, 06, 07, 11, 12): **60 passed, 2 skipped, 0 failed**. Fixed test infra: with 2 demo buildings nothing auto-selects, so global-setup now picks Harbour View for manager (reception auto-selects via Topbar effect — B1 only) and `loginAs` restores localStorage (selected building) alongside cookies. Rewrote stale "Record Payment on tenancy detail" test to assert the A2 behavior (read-only + cross-link).
- ✅ **V3** (2026-07-05) Scripted walkthrough: rendered manager dashboard/rent/strata/financials numbers match `seed/_audit.ts` exactly (overdue 31, occupancy 24/30=80.0%, income $320,560 / expenses $144,000 / net $176,560). All integrity checks pass. Note: seed is 3 weeks old → "collected this month" $0.00 and collection-to-date drifted to 89.3%/91.6%; re-seed (`db:seed:wipe` + `db:seed:demo`) refreshes the demo.
- ✅ **Cron** (2026-07-05) `mark-overdue` configured: `vercel.json` crons entry (daily 14:00 UTC = midnight Sydney), `CRON_SECRET` generated in local `.env`. Smoke-tested: 401 on bad secret; real run marked 36 rent + 2 bills OVERDUE. **Manual step: add `CRON_SECRET` to Vercel env vars** (Vercel Cron sends it as `Authorization: Bearer` automatically).

---

## 6. Change Log (newest first)
- 2026-07-05 — **Verification pass complete (V2/V3/U4) + mark-overdue cron.** Vercel Cron entry added (daily midnight Sydney) + `CRON_SECRET` in local .env (must be mirrored to Vercel env vars). Playwright test infra fixed for the 2-building demo: global-setup selects Harbour View (manager) / waits for Topbar auto-select (reception); `loginAs` restores localStorage with cookies; stale Record-Payment-on-detail test rewritten to assert A2 read-only behavior. Money-page suite 60/60 green. Mobile spot-check clean (sheet nav + no overflow, 14 pages, Pixel 7); env-gated `mobile` Playwright project added. Walkthrough numbers match `seed/_audit.ts` exactly.
- 2026-07-04 — **Performance pass.** Root causes of slow loads + prod "Something went wrong" (digest 1281522004): (1) Vercel `DATABASE_URL` used the session-mode pooler (5432) → `EMAXCONNSESSION: max clients limited to pool_size 15` (confirmed in Vercel runtime errors) — switch to transaction mode 6543 (local .env done; **Vercel env var must be updated manually**); (2) 3–4 `supabase.auth.getUser()` network round trips per navigation (~51ms each, measured) — replaced with locally-verified `getClaims()` via `src/server/auth/request-auth.ts` (~1.6ms) + React cache() dedupe of the layout/prefetch user lookup; (3) Vercel functions ran in iad1 (US) with the DB in Sydney — pinned to syd1 via vercel.json; (4) 42 missing FK indexes created (migration `add_missing_foreign_key_indexes`, mirrored as @@index in schema.prisma). Verified: prod build + scripted authenticated navigation 238–416ms/page from local.
- 2026-07-04 — **Security + logic + dedupe pass (full codebase audit).** Phase S (S1–S5): inspection-upload authz hole closed, webhook payment_status check, payLevy bypass narrowed, redirect hardening, Supabase RPC revoke. L2/L3/L4/L6/L7 done: shared `src/server/lib/rent-schedule.ts` (killed 2 buggy duplicate builders), isOccupied sync on tenancy create/end, live-derived overdue, collection-rate stat, getSummary period filters. A2/A3 done: Record Payment de-duplicated from tenancy detail (+cross-link), resident sidebar role gating via `resident.getMyAccess`, role-aware levies page. New resident features: `/resident/parcels` (listMyParcels) + `/resident/visitors` (listMyVisitors + pre-registration). Formatter consolidation: 9 more files onto shared `formatDate`. tsc + eslint (changed files) + production build clean.
- 2026-06-13 — **Phase U consistency pass.** Normalised all 9 outlier headings → standard style (all headings now consistent). Consolidated 12 duplicate `formatDate` helpers → shared `constants.ts` helper; fixed inline date outlier in manager/rent. Confirmed loading/empty-state coverage is adequate. tsc + eslint clean. Remaining inline `toLocaleDateString` (~19 files) is optional cosmetic DRY (renders correctly already).
- 2026-06-13 — **Phase U0.** Added `formatDate`/`formatDateTime`/`formatPercent` to `constants.ts`; adopted on manager dashboard. Documented heading-style outliers + that the 8 inline `/100` are legitimate. tsc clean.
- 2026-06-13 — **Phase L/A partial.** L1 rent-schedule count fix; L5 levy apportionment-by-entitlement (server+client+emails); A1 deleted dead `/owner` `/tenant` dirs; V1 `tsc --noEmit` clean.
- 2026-06-13 — **Phase D complete.** Rewrote `seed/demo.ts` + `seed/wipe.ts`; wiped + re-seeded live DB. 2 buildings, 59 users (13 auth + 46 DB-only), 22 tenancies, 697 rent payments, 432 levies, 164 financial records, + bonds/bills/inspections/visitors/keys/docs/bookings. All integrity checks pass; dashboard numbers verified accurate & current. Added `seed/_audit.ts` (read-only verification harness).
- 2026-06-13 — Created plan. Audited live DB. Identified seed as root cause of empty/stale dashboards.

---

## 7. Resume Pointer
**DONE & verified:** ALL phases complete — D, S (S1–S5), L1–L7, A1–A3, U0/U-headings/U1–U4, V1–V3, plus the mark-overdue cron (2026-07-05). The plan's task board is finished.
**NEXT ACTION:** (1) **User must add `CRON_SECRET` to Vercel env vars** (value in local `.env`) or the cron gets 401s; also verify Vercel `DATABASE_URL` uses port 6543. (2) Optional: re-seed to freshen the 3-week-old demo (`db:seed:wipe` + `db:seed:demo` — wipes live DB, ask user first). (3) Only cosmetic U-remaining (~19 inline `toLocaleDateString`) left — pure DRY polish.
**Run the app:** `npm run dev` → logins `Demo1234!` (manager@/reception@/owner1–5@/tenant1–5@demo.com); super-admin `admin@stratahub.com.au`/`Admin1234!`. Re-verify data anytime: `tsx seed/_audit.ts`.
**Verified demo facts:** B1 Harbour View 30 units 80% occ; B2 Parkline 18 units 78% occ; collection 97/98.8%; logins `Demo1234!` (manager@, reception@, owner1–5@, tenant1–5@demo.com); super-admin `admin@stratahub.com.au` / `Admin1234!`.
