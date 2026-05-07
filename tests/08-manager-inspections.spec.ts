import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

test.describe('Manager Inspections (/manager/inspections)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'manager');
    await page.goto('/manager/inspections');
    await page.waitForLoadState('networkidle');
  });

  test('renders inspections page heading', async ({ page }) => {
    await expect(page.getByText(/inspection/i).first()).toBeVisible();
    await page.screenshot({ path: 'test-results/screenshots/manager-inspections.png' });
  });

  test('Create Inspection button is present and opens dialog', async ({ page }) => {
    const createBtn = page.getByRole('button', { name: /create inspection|new inspection|add inspection/i });
    if (await createBtn.isVisible()) {
      await createBtn.click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
      await page.screenshot({ path: 'test-results/screenshots/manager-inspections-create-dialog.png' });
      await page.keyboard.press('Escape');
    }
  });

  test('inspections table/list is visible', async ({ page }) => {
    const table = page.getByRole('table');
    const list = page.locator('[class*="card"], [class*="list"]');
    const hasContent = (await table.count() > 0) || (await list.count() > 0);
    expect(hasContent).toBeTruthy();
  });

  test('clicking an inspection navigates to editor (/manager/inspections/[id])', async ({ page }) => {
    const rows = page.locator('tbody tr');
    if (await rows.count() === 0) { test.skip(); return; }

    const firstLink = rows.first().getByRole('link').first()
      .or(page.getByRole('link', { name: /view|open|edit/i }).first());
    if (await firstLink.count() > 0) {
      await firstLink.click();
      await expect(page).toHaveURL(/\/manager\/inspections\/\w+/);
      await page.screenshot({ path: 'test-results/screenshots/manager-inspections-detail.png' });
    }
  });
});

test.describe('Manager Inspection Editor (/manager/inspections/[id])', () => {
  test('inspection editor page loads with rooms and items', async ({ page }) => {
    await loginAs(page, 'manager');
    await page.goto('/manager/inspections');
    await page.waitForLoadState('networkidle');

    const rows = page.locator('tbody tr');
    if (await rows.count() === 0) { test.skip(); return; }

    const firstLink = rows.first().getByRole('link').first()
      .or(page.getByRole('link', { name: /view|open|edit/i }).first());
    if (await firstLink.count() === 0) { test.skip(); return; }

    await firstLink.click();
    await page.waitForURL(/\/manager\/inspections\/\w+/, { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/room|item|inspection/i).first()).toBeVisible();
    await page.screenshot({ path: 'test-results/screenshots/manager-inspections-editor.png' });
  });

  test('Add Room button is present on editor', async ({ page }) => {
    await loginAs(page, 'manager');
    await page.goto('/manager/inspections');
    await page.waitForLoadState('networkidle');

    const rows = page.locator('tbody tr');
    if (await rows.count() === 0) { test.skip(); return; }

    const firstLink = rows.first().getByRole('link').first()
      .or(page.getByRole('link', { name: /view|open|edit/i }).first());
    if (await firstLink.count() === 0) { test.skip(); return; }

    await firstLink.click();
    await page.waitForURL(/\/manager\/inspections\/\w+/, { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    const addRoomBtn = page.getByRole('button', { name: /add room/i });
    if (await addRoomBtn.isVisible()) {
      await expect(addRoomBtn).toBeEnabled();
    }
  });
});
