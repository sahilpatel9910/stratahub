# StrataHub — Prioritised Fix List
**Date:** 2026-05-07 | QA Audit Branch: `testing/full-qa-audit`

---

## CRITICAL BLOCKERS — Fix before any merge

### 1. BUG-001 — Super-admin routes accessible to non-super-admins
**Fix:** Add a role check in `src/app/(dashboard)/super-admin/layout.tsx`:
```ts
// In the layout's server component:
if (user.orgMemberships[0]?.role !== 'SUPER_ADMIN') redirect('/access-required');
```
Or ensure `src/proxy.ts` middleware checks for SUPER_ADMIN on all `/super-admin/*` paths.

**Why critical:** Any BUILDING_MANAGER can currently view and potentially interact with all organisation, building, and user management pages. This is a serious authorization hole.

---

### 2. BUG-002 — Reception role redirects to `/` instead of `/manager/visitors`
**Fix:** In `src/app/page.tsx`, add or correct the RECEPTION case in the role switch:
```ts
case 'RECEPTION':
  redirect('/manager/visitors');
  break;
```
Or if grouped with BUILDING_MANAGER → `/manager`, then in `/manager/layout.tsx` check if `isReceptionOnly` and redirect to `/manager/visitors`.

**Why critical:** Reception staff cannot access their portal at all — they land on a blank root page.

---

## AUTH AND PERMISSION BUGS

### 3. BUG-004 — Auth redirect chain too slow (>15s on first load)
**Fix (two parts):**
1. **App side:** Cache the `db.user.findUnique` result in the Supabase session (store role in user_metadata on login, avoid DB roundtrip on every root load).
2. **Test side:** Use Playwright [storageState](https://playwright.dev/docs/auth#reuse-signed-in-state) to pre-authenticate test workers and skip the login flow entirely in most tests.

---

### 4. BUG-005 — Reception pages inaccessible (cascade from BUG-002)
Resolves automatically when BUG-002 is fixed.

---

## FRONTEND UI BUGS

### 5. BUG-003 — Resident sidebar links not visible (hidden/collapsed sidebar)
**Fix:** Check if `Sidebar` component uses `defaultOpen=false` on small viewports. Ensure `open` state defaults to `true` on desktop. Add `data-testid` attributes to sidebar links for reliable selector targeting in tests.
**Test fix:** Update tests to either toggle sidebar open, or query DOM elements that may be off-screen.

---

### 6. BUG-006 — Page heading text mismatches / slow RSC skeleton resolution
**Two actions:**
1. **Content audit:** Verify each page has a visible `<h1>` with semantic text that matches the nav item name. Pages like Announcements, Documents, Messages, Notifications should each have a clear `<h1>` not just an eyebrow label.
2. **Loading performance:** In dev mode, RSC + Supabase cloud + Prisma cold start can take 10-15s. Add `waitForLoadState('networkidle')` before assertions, or increase assertion timeouts to 20s for pages known to be slow.

---

### 7. BUG-009 — Notification pagination UI not found
**Fix (investigation):** Check if the notification list uses:
- Infinite scroll (then tests need scroll-trigger approach)
- A "Load more" button with different text (check exact button label in component)
- URL-based pagination (then test needs to navigate with cursor param)
Update tests to match actual implementation.

---

### 8. BUG-010 — Tenancy rows have no accessible links to detail page
**Fix:** Ensure each tenancy row in `/manager/rent` Tenancies tab has either:
- A `<Link href="/manager/tenancies/[id]">View</Link>` anchor, or
- A `data-testid` attribute on the row with a click handler

**Test fix:** Update test to use `page.locator('tbody tr').first().click()` if rows use `onClick` + `router.push` instead of anchor tags.

---

### 9. BUG-011 — `assignInput` useEffect clobbers mid-edit text
**File:** `src/app/(dashboard)/manager/maintenance/[id]/_client.tsx`  
**Fix:**
```ts
const hasInitialized = useRef(false);
useEffect(() => {
  if (!hasInitialized.current && req?.assignedTo !== undefined) {
    setAssignInput(req.assignedTo ?? '');
    hasInitialized.current = true;
  }
}, [req?.assignedTo]);
```

---

### 10. BUG-012 — Photo upload failure leaves Add Photo disabled
**File:** `src/app/(dashboard)/manager/maintenance/[id]/_client.tsx`  
**Fix:** In the `confirmUpload` catch block, call `cancelPendingFile()`:
```ts
} catch (error) {
  cancelPendingFile(); // ← add this
  toast.error('Upload failed. Please try again.');
}
```

---

### 11. BUG-016 — Forgot password link navigates flakily
**File:** `src/app/(auth)/login/page.tsx`  
**Fix:** Use `<Link href="/forgot-password">` with proper `next/link`. If it's currently a plain `<a>` or has a JavaScript click handler, switch it to Next.js `Link` for reliable navigation.

---

## API AND BACKEND LOGIC BUGS

### 12. BUG-007 — Maintenance cache invalidation gap
**File:** `src/app/(dashboard)/manager/maintenance/[id]/_client.tsx`  
**Fix:** In `updateStatusMutation.onSuccess`, invalidate all three:
```ts
onSuccess: () => {
  utils.maintenance.getById.invalidate({ id });
  utils.maintenance.listByBuilding.invalidate({ buildingId });
  utils.maintenance.getStats.invalidate({ buildingId });
}
```
Do the same in the list page's mutation `onSuccess`.

---

### 13. BUG-008 — NEXT_STATUSES duplicated
**Files:** `src/app/(dashboard)/manager/maintenance/_client.tsx` and `src/app/(dashboard)/manager/maintenance/[id]/_client.tsx`  
**Fix:** Extract `NEXT_STATUSES` to `src/lib/constants.ts` and import it in both files.

---

## STATE AND DATA MANAGEMENT BUGS

### 14. BUG-014 — RentPayment.amountCents overwritten on PARTIAL
**File:** `prisma/schema.prisma`, `src/server/trpc/routers/rent.ts`  
**Fix:** Add `originalAmountCents Int?` field to `RentPayment` model. Set it from `amountCents` on record creation and never update it. Use it in financial summaries and outstanding balance calculations.

---

## PERFORMANCE AND EDGE CASE ISSUES

### 15. BUG-013 — Residents table loads too slowly
**Root cause:** Cloud Supabase latency + parallel test workers.  
**App fix:** Add RSC prefetch to `/manager/residents` page (Branch 13 pattern — `createServerTRPC().prefetch(residents.listByBuilding)`).  
**Test fix:** Increase timeout to 20s for cloud-connected queries.

---

### 16. BUG-015 — Mobile: pages hidden behind floating sidebar
**Fix:** Verify `Sidebar` component with `variant="floating"` starts closed on mobile and the toggle button is accessible. Test on iOS Safari/Chrome Mobile, not just Playwright iPhone viewport.  
Ensure content area has proper `margin-left` or `padding-left` reset when sidebar is closed on mobile so text is never behind the sidebar overlay.

---

## TEST INFRASTRUCTURE (not app bugs, but needed to unblock E2E)

### 17. BUG-017 — Stripe webhook test uses invalid relative URL
**Fix in test only:**
```ts
// Instead of page.evaluate with a relative URL:
const response = await page.request.post('http://localhost:3000/api/stripe/webhook', {
  data: '{}',
  headers: { 'stripe-signature': 'invalid' },
});
expect(response.status()).toBe(400); // Bad signature, not 307 redirect
```

### 18. Playwright auth storage state (general test infra improvement)
Add a `playwright/global-setup.ts` that logs in once per role and saves cookies to `playwright/.auth/*.json`. Each test spec loads storage state instead of logging in fresh. This eliminates 50+ redundant login cycles and fixes the timeout cascade.

---

## ORDERED FIX PRIORITY

| Priority | Bug | Effort | Impact |
|----------|-----|--------|--------|
| P0 | BUG-001: Super-admin unguarded | 30min | Security critical |
| P0 | BUG-002: Reception redirect broken | 15min | UX critical |
| P1 | BUG-007: Maintenance cache gap | 20min | Data integrity |
| P1 | BUG-008: NEXT_STATUSES duplication | 15min | Maintenance risk |
| P1 | BUG-012: Photo upload state stuck | 10min | UX blocker |
| P1 | BUG-011: assignInput clobber | 20min | UX degradation |
| P2 | BUG-010: Tenancy rows no links | 30min | Navigation broken |
| P2 | BUG-006: Page heading / slow SSR | 2h | Test coverage + UX |
| P2 | BUG-003: Sidebar hidden on load | 1h | Mobile UX |
| P2 | BUG-015: Mobile sidebar overlay | 1h | Mobile UX |
| P3 | BUG-014: RentPayment amountCents | 1h | Financial accuracy |
| P3 | BUG-009: Notification pagination | 30min | Discoverability |
| P3 | BUG-004: Auth redirect chain slow | 2h | Performance |
| P4 | BUG-016: Forgot password flaky | 30min | UX |
| P4 | BUG-013: Residents table slow | 1h | Performance |
| P4 | BUG-017: Fix Stripe webhook test | 15min | Test infra |
| Infra | Playwright auth storage state | 2h | Unblocks all E2E |
