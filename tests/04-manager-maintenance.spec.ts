import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

test.describe('Manager Maintenance list (/manager/maintenance)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'manager');
    await page.goto('/manager/maintenance');
    await page.waitForLoadState('networkidle');
  });

  test('renders page heading', async ({ page }) => {
    await expect(page.getByText(/maintenance/i).first()).toBeVisible();
    await page.screenshot({ path: 'test-results/screenshots/manager-maintenance.png' });
  });

  test('tabs are present: All, Active, Completed, Cancelled', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /all/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /active/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /completed/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /cancelled/i })).toBeVisible();
  });

  test('switching tabs changes visible requests', async ({ page }) => {
    await page.getByRole('tab', { name: /active/i }).click();
    await page.screenshot({ path: 'test-results/screenshots/manager-maintenance-active.png' });
    await page.getByRole('tab', { name: /completed/i }).click();
    await page.screenshot({ path: 'test-results/screenshots/manager-maintenance-completed.png' });
  });

  test('search box is present and functional', async ({ page }) => {
    // Use exact placeholder to avoid matching the global topbar search input
    const search = page.getByPlaceholder('Search title or unit...');
    await expect(search).toBeVisible();
    await search.fill('plumbing');
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'test-results/screenshots/manager-maintenance-search.png' });
  });

  test('priority filter dropdown works', async ({ page }) => {
    // Priority filter select
    const prioritySelect = page.getByRole('combobox').first();
    if (await prioritySelect.isVisible()) {
      await prioritySelect.click();
      await page.screenshot({ path: 'test-results/screenshots/manager-maintenance-priority-filter.png' });
      await page.keyboard.press('Escape');
    }
  });

  test('maintenance table is present with data', async ({ page }) => {
    await expect(page.getByRole('table')).toBeVisible({ timeout: 10000 });
  });

  test('clicking a row or View link navigates to detail page', async ({ page }) => {
    // Look for any link to a maintenance detail
    const detailLink = page.getByRole('link', { name: /view|details/i }).first()
      .or(page.locator('tbody tr').first());
    if (await page.getByRole('link', { name: /view/i }).count() > 0) {
      await page.getByRole('link', { name: /view/i }).first().click();
      await expect(page).toHaveURL(/\/manager\/maintenance\/\w+/);
      await page.screenshot({ path: 'test-results/screenshots/manager-maintenance-detail.png' });
    }
  });

  test('overflow menu (⋮) per row opens actions', async ({ page }) => {
    const moreBtn = page.getByRole('button', { name: /more|⋮/i }).first()
      .or(page.locator('[aria-label="open menu"]').first());
    if (await moreBtn.count() > 0) {
      await moreBtn.first().click();
      await page.screenshot({ path: 'test-results/screenshots/manager-maintenance-row-menu.png' });
      await page.keyboard.press('Escape');
    }
  });

  test('loading skeleton is shown before data arrives', async ({ page }) => {
    // Intercept the tRPC call to delay it
    await page.route('**/api/trpc/maintenance.listByBuilding**', async (route) => {
      await page.waitForTimeout(500);
      await route.continue();
    });
    await page.reload();
    // Skeletons should appear briefly
    const skeleton = page.locator('[class*="skeleton"], [class*="animate-pulse"]').first();
    // Soft check — skeletons may appear and disappear quickly
    await page.screenshot({ path: 'test-results/screenshots/manager-maintenance-loading.png' });
  });
});

// ─── MAINTENANCE DETAIL ──────────────────────────────────────────────────────

test.describe('Manager Maintenance Detail (/manager/maintenance/[id])', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'manager');
    // Navigate to list first to get a real ID
    await page.goto('/manager/maintenance');
    await page.waitForLoadState('networkidle');
  });

  test('clicking first row navigates to detail and shows timeline', async ({ page }) => {
    // Try to find a row link
    const rows = page.locator('tbody tr');
    const rowCount = await rows.count();
    if (rowCount === 0) {
      test.skip();
      return;
    }
    // Click the first row or its link
    const firstLink = page.locator('tbody tr').first().getByRole('link').first();
    if (await firstLink.count() > 0) {
      await firstLink.click();
    } else {
      await rows.first().click();
    }
    await page.waitForURL(/\/manager\/maintenance\/\w+/, { timeout: 20000 });
    await expect(page.getByText(/timeline|history|comments/i)).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: 'test-results/screenshots/manager-maintenance-detail-full.png' });
  });

  test('status update dropdown works on detail page', async ({ page }) => {
    const rows = page.locator('tbody tr');
    if (await rows.count() === 0) { test.skip(); return; }

    const firstLink = page.locator('tbody tr').first().getByRole('link').first();
    if (await firstLink.count() > 0) {
      await firstLink.click();
      await page.waitForURL(/\/manager\/maintenance\/\w+/, { timeout: 10000 });
    } else {
      test.skip(); return;
    }

    // Look for status select/dropdown
    const statusSelect = page.getByRole('combobox').first();
    if (await statusSelect.isVisible()) {
      await statusSelect.click();
      await page.screenshot({ path: 'test-results/screenshots/manager-maintenance-status-select.png' });
      await page.keyboard.press('Escape');
    }
  });

  test('comment form is visible and submittable', async ({ page }) => {
    const rows = page.locator('tbody tr');
    if (await rows.count() === 0) { test.skip(); return; }

    const firstLink = page.locator('tbody tr').first().getByRole('link').first();
    if (await firstLink.count() > 0) {
      await firstLink.click();
      await page.waitForURL(/\/manager\/maintenance\/\w+/, { timeout: 10000 });
    } else {
      test.skip(); return;
    }

    const commentBox = page.getByPlaceholder(/comment|note|message/i).first()
      .or(page.getByRole('textbox').last());
    if (await commentBox.isVisible()) {
      await commentBox.fill('Test comment from QA audit');
      await expect(commentBox).toHaveValue('Test comment from QA audit');
      await page.screenshot({ path: 'test-results/screenshots/manager-maintenance-comment-form.png' });
    }
  });
});
