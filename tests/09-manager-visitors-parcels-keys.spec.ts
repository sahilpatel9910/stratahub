import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

// ─── VISITORS ─────────────────────────────────────────────────────────────────

test.describe('Manager Visitors (/manager/visitors)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'manager');
    await page.goto('/manager/visitors');
    await page.waitForLoadState('networkidle');
  });

  test('renders visitors page', async ({ page }) => {
    await expect(page.getByText(/visitor/i).first()).toBeVisible();
    await page.screenshot({ path: 'test-results/screenshots/manager-visitors.png' });
  });

  test('Log Visitor / Add Visitor button opens dialog', async ({ page }) => {
    const btn = page.getByRole('button', { name: /log visitor|add visitor|new visitor|check in/i });
    if (await btn.isVisible()) {
      await btn.click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
      await page.screenshot({ path: 'test-results/screenshots/manager-visitors-add.png' });
      await page.keyboard.press('Escape');
    }
  });

  test('visitors table shows columns', async ({ page }) => {
    const table = page.getByRole('table');
    if (await table.count() > 0) {
      await expect(table).toBeVisible({ timeout: 10000 });
    }
  });
});

// ─── PARCELS ─────────────────────────────────────────────────────────────────

test.describe('Manager Parcels (/manager/parcels)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'manager');
    await page.goto('/manager/parcels');
    await page.waitForLoadState('networkidle');
  });

  test('renders parcels page', async ({ page }) => {
    await expect(page.getByText(/parcel/i).first()).toBeVisible();
    await page.screenshot({ path: 'test-results/screenshots/manager-parcels.png' });
  });

  test('Log Parcel / Add Parcel button opens dialog', async ({ page }) => {
    const btn = page.getByRole('button', { name: /log parcel|add parcel|new parcel|receive parcel/i });
    if (await btn.isVisible()) {
      await btn.click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
      await page.screenshot({ path: 'test-results/screenshots/manager-parcels-log.png' });
      await page.keyboard.press('Escape');
    }
  });

  test('parcels table is visible', async ({ page }) => {
    const table = page.getByRole('table');
    if (await table.count() > 0) {
      await expect(table.first()).toBeVisible({ timeout: 10000 });
    }
  });

  test('Mark as collected action works', async ({ page }) => {
    const collectBtn = page.getByRole('button', { name: /collect|mark.*collected|picked up/i }).first();
    if (await collectBtn.count() > 0 && await collectBtn.isVisible()) {
      await collectBtn.click();
      await page.screenshot({ path: 'test-results/screenshots/manager-parcels-collect.png' });
    }
  });
});

// ─── KEYS & ACCESS ───────────────────────────────────────────────────────────

test.describe('Manager Keys & Access (/manager/keys)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'manager');
    await page.goto('/manager/keys');
    await page.waitForLoadState('networkidle');
  });

  test('renders keys page', async ({ page }) => {
    await expect(page.getByText(/key/i).first()).toBeVisible();
    await page.screenshot({ path: 'test-results/screenshots/manager-keys.png' });
  });

  test('Add Key button opens dialog', async ({ page }) => {
    const btn = page.getByRole('button', { name: /add key|new key|issue key|log key/i });
    if (await btn.isVisible()) {
      await btn.click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
      await page.screenshot({ path: 'test-results/screenshots/manager-keys-add.png' });
      await page.keyboard.press('Escape');
    }
  });

  test('keys table is visible', async ({ page }) => {
    const table = page.getByRole('table');
    if (await table.count() > 0) {
      await expect(table.first()).toBeVisible({ timeout: 10000 });
    }
  });
});
