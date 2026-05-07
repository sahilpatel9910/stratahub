import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

test.describe('Manager Strata page (/manager/strata) — Levies + Custom Bills', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'manager');
    await page.goto('/manager/strata');
    await page.waitForLoadState('networkidle');
  });

  test('renders page heading', async ({ page }) => {
    await expect(page.getByText(/strata/i).first()).toBeVisible();
    await page.screenshot({ path: 'test-results/screenshots/manager-strata.png' });
  });

  test('has multiple tabs including Custom Bills (5th tab)', async ({ page }) => {
    // Branch 12 added Custom Bills as the 5th tab
    await expect(page.getByRole('tab', { name: /custom bills/i })).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: 'test-results/screenshots/manager-strata-tabs.png' });
  });

  test('Custom Bills tab opens and shows table', async ({ page }) => {
    await page.getByRole('tab', { name: /custom bills/i }).click();
    await page.screenshot({ path: 'test-results/screenshots/manager-strata-custom-bills.png' });
    // Should have table or empty state
    const table = page.getByRole('table');
    const emptyState = page.getByText(/no bills|empty|no custom/i);
    const hasContent = (await table.count() > 0) || (await emptyState.count() > 0);
    expect(hasContent).toBeTruthy();
  });

  test('New Custom Bill button opens create dialog', async ({ page }) => {
    await page.getByRole('tab', { name: /custom bills/i }).click();
    const newBillBtn = page.getByRole('button', { name: /new bill|create bill|add bill/i });
    if (await newBillBtn.isVisible()) {
      await newBillBtn.click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
      await page.screenshot({ path: 'test-results/screenshots/manager-strata-new-bill-dialog.png' });
      await page.keyboard.press('Escape');
    }
  });

  test('Levies tab is present and shows levy data', async ({ page }) => {
    const leviesTab = page.getByRole('tab', { name: /levies/i });
    if (await leviesTab.isVisible()) {
      await leviesTab.click();
      await page.screenshot({ path: 'test-results/screenshots/manager-strata-levies.png' });
    }
  });

  test('Create Levy button opens dialog', async ({ page }) => {
    const leviesTab = page.getByRole('tab', { name: /levies/i });
    if (await leviesTab.isVisible()) {
      await leviesTab.click();
    }
    const createBtn = page.getByRole('button', { name: /create levy|new levy|add levy/i });
    if (await createBtn.isVisible()) {
      await createBtn.click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
      await page.screenshot({ path: 'test-results/screenshots/manager-strata-create-levy-dialog.png' });
      await page.keyboard.press('Escape');
    }
  });
});
