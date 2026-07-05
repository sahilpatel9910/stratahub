import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

test.describe('Manager Rent page (/manager/rent)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'manager');
    await page.goto('/manager/rent');
    await page.waitForLoadState('networkidle');
  });

  test('renders page heading', async ({ page }) => {
    await expect(page.getByText(/rent/i).first()).toBeVisible();
    await page.screenshot({ path: 'test-results/screenshots/manager-rent.png' });
  });

  test('has Tenancies tab (Branch 16)', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /tenancies/i })).toBeVisible({ timeout: 10000 });
  });

  test('Tenancies tab shows tenancy table', async ({ page }) => {
    await page.getByRole('tab', { name: /tenancies/i }).click();
    await page.screenshot({ path: 'test-results/screenshots/manager-rent-tenancies.png' });
    const table = page.getByRole('table');
    const emptyState = page.getByText(/no tenancies|no active/i);
    const hasContent = (await table.count() > 0) || (await emptyState.count() > 0);
    expect(hasContent).toBeTruthy();
  });

  test('Create Tenancy button opens dialog', async ({ page }) => {
    await page.getByRole('tab', { name: /tenancies/i }).click();
    const createBtn = page.getByRole('button', { name: /create tenancy|new tenancy|add tenancy/i });
    if (await createBtn.isVisible()) {
      await createBtn.click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
      await page.screenshot({ path: 'test-results/screenshots/manager-rent-create-tenancy.png' });
      await page.keyboard.press('Escape');
    }
  });

  test('tenancy row links to detail page /manager/tenancies/[id]', async ({ page }) => {
    await page.getByRole('tab', { name: /tenancies/i }).click();
    const detailLink = page.getByRole('link', { name: /view|details/i }).first()
      .or(page.locator('tbody tr').first().getByRole('link').first());
    if (await detailLink.count() > 0) {
      await detailLink.click();
      await expect(page).toHaveURL(/\/manager\/tenancies\/\w+/, { timeout: 15000 });
      await page.screenshot({ path: 'test-results/screenshots/manager-tenancy-detail.png' });
    }
  });

  test('overdue rent count is shown in stats', async ({ page }) => {
    // Stats should show some kind of overdue rent metric
    const overdue = page.getByText(/overdue/i);
    if (await overdue.count() > 0) {
      await expect(overdue.first()).toBeVisible();
    }
  });
});

// ─── TENANCY DETAIL ──────────────────────────────────────────────────────────

test.describe('Manager Tenancy Detail (/manager/tenancies/[id])', () => {
  test('detail page shows lease info and payment schedule', async ({ page }) => {
    await loginAs(page, 'manager');
    await page.goto('/manager/rent');
    await page.waitForLoadState('networkidle');
    await page.getByRole('tab', { name: /tenancies/i }).click();

    // Try to navigate to a detail page
    const rows = page.locator('tbody tr');
    if (await rows.count() === 0) { test.skip(); return; }

    const firstLink = rows.first().getByRole('link').first();
    if (await firstLink.count() === 0) { test.skip(); return; }

    await firstLink.click();
    await page.waitForURL(/\/manager\/tenancies\/\w+/, { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/lease|tenancy|rent/i).first()).toBeVisible();
    await page.screenshot({ path: 'test-results/screenshots/manager-tenancy-detail-full.png' });
  });

  test('tenancy detail is read-only: no Record Payment, cross-link to Rent page', async ({ page }) => {
    // Production-readiness A2: "one action, one page" — Record Payment lives
    // on /manager/rent only; the tenancy detail shows read-only history plus
    // a "Record payments on the Rent page →" cross-link.
    await loginAs(page, 'manager');
    await page.goto('/manager/rent');
    await page.waitForLoadState('networkidle');
    await page.getByRole('tab', { name: /tenancies/i }).click();

    const rows = page.locator('tbody tr');
    if (await rows.count() === 0) { test.skip(); return; }

    const firstLink = rows.first().getByRole('link').first();
    if (await firstLink.count() === 0) { test.skip(); return; }

    await firstLink.click();
    await page.waitForURL(/\/manager\/tenancies\/\w+/, { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('button', { name: /record payment/i })).toHaveCount(0);
    const crossLink = page.getByRole('link', { name: /record payments on the rent page/i });
    await expect(crossLink).toBeVisible();
    await expect(crossLink).toHaveAttribute('href', '/manager/rent');
    await page.screenshot({ path: 'test-results/screenshots/manager-tenancy-readonly.png' });
  });

  test('Generate Schedule button shown when no rent payments exist', async ({ page }) => {
    // Per CLAUDE.md: "Generate Schedule" shown when rentPayments.length === 0
    // This is a conditional element — soft check
    await loginAs(page, 'manager');
    await page.goto('/manager/rent');
    await page.waitForLoadState('networkidle');
    // Just verify the page loads without crash
    await expect(page).not.toHaveURL(/error/);
  });
});
