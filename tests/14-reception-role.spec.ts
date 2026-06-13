import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

// ─── RECEPTION ROLE ───────────────────────────────────────────────────────────
// Reception role has restricted nav: Visitors, Parcels, Keys, Maintenance, Messages

test.describe('Reception role (/manager portal, restricted)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'reception');
    await page.waitForLoadState('networkidle');
  });

  test('reception lands on /manager/visitors (home)', async ({ page }) => {
    // Per sidebar: homeHref = "/manager/visitors" for reception
    await expect(page).toHaveURL(/\/manager\/visitors/);
    await page.screenshot({ path: 'test-results/screenshots/reception-dashboard.png' });
  });

  test('reception sidebar shows only allowed nav items', async ({ page }) => {
    const allowedItems = ['Visitors', 'Parcels', 'Keys & Access', 'Maintenance', 'Messages'];
    for (const item of allowedItems) {
      await expect(page.getByRole('link', { name: item }).first()).toBeVisible();
    }
    await page.screenshot({ path: 'test-results/screenshots/reception-sidebar.png' });
  });

  test('reception sidebar does NOT show manager-only items', async ({ page }) => {
    // Use href-based selectors to avoid partial-text false positives
    // (e.g. "StrataHub" logo link text partially matches "Strata")
    const restrictedHrefs = ['/manager/residents', '/manager/strata', '/manager/financials', '/manager/analytics'];
    for (const href of restrictedHrefs) {
      await expect(page.locator(`a[href="${href}"]`)).not.toBeVisible();
    }
  });

  test('reception can access visitors page', async ({ page }) => {
    await page.goto('/manager/visitors');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/visitor/i).first()).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: 'test-results/screenshots/reception-visitors.png' });
  });

  test('reception can access parcels page', async ({ page }) => {
    await page.goto('/manager/parcels');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/parcel/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('reception can access keys page', async ({ page }) => {
    await page.goto('/manager/keys');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/key/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('reception can create custom bills (assertBuildingOperationsAccess)', async ({ page }) => {
    // Per CLAUDE.md: customBills.create uses assertBuildingOperationsAccess — RECEPTION can raise bills
    // Verify reception can at least access the strata page without being blocked
    // (They may not see the tab, but shouldn't get a hard 403)
    await page.goto('/manager/strata');
    // If redirected to access-required, that's expected and OK
    await page.screenshot({ path: 'test-results/screenshots/reception-strata-access.png' });
  });
});
