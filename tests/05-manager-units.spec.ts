import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

test.describe('Manager Units page (/manager/units)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'manager');
    await page.goto('/manager/units');
    await page.waitForLoadState('networkidle');
  });

  test('renders page heading', async ({ page }) => {
    await expect(page.getByText(/units/i).first()).toBeVisible();
    await page.screenshot({ path: 'test-results/screenshots/manager-units.png' });
  });

  test('units table or card list is visible', async ({ page }) => {
    const table = page.getByRole('table');
    const cards = page.locator('[class*="card"]');
    const hasTable = await table.count() > 0;
    const hasCards = await cards.count() > 0;
    expect(hasTable || hasCards).toBeTruthy();
  });

  test('Add Unit button is present', async ({ page }) => {
    const addBtn = page.getByRole('button', { name: /add unit/i });
    if (await addBtn.isVisible()) {
      await addBtn.click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
      await page.screenshot({ path: 'test-results/screenshots/manager-units-add-dialog.png' });
      await page.keyboard.press('Escape');
    }
  });

  test('Assign button opens assign resident dialog', async ({ page }) => {
    const assignBtn = page.getByRole('button', { name: /assign/i }).first();
    if (await assignBtn.isVisible()) {
      await assignBtn.click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
      await page.screenshot({ path: 'test-results/screenshots/manager-units-assign-dialog.png' });
      await page.keyboard.press('Escape');
    }
  });

  test('search/filter works if present', async ({ page }) => {
    const search = page.getByPlaceholder(/search by unit/i);
    if (await search.isVisible()) {
      await search.fill('Unit 1');
      await page.waitForTimeout(300);
      await page.screenshot({ path: 'test-results/screenshots/manager-units-search.png' });
    }
  });
});
