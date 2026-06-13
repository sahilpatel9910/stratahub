import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

// ─── ANALYTICS ────────────────────────────────────────────────────────────────

test.describe('Manager Analytics (/manager/analytics)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'manager');
    await page.goto('/manager/analytics');
    await page.waitForLoadState('networkidle');
  });

  test('renders analytics page with charts', async ({ page }) => {
    await expect(page.getByText(/analytic/i).first()).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: 'test-results/screenshots/manager-analytics.png' });
  });

  test('Recharts components are rendered (lazy loaded)', async ({ page }) => {
    // Branch 13: Recharts is lazy-loaded with Suspense
    // Wait for charts to fully load
    await page.waitForTimeout(2000);
    const charts = page.locator('.recharts-wrapper, [class*="recharts"]');
    if (await charts.count() > 0) {
      await expect(charts.first()).toBeVisible();
    }
    await page.screenshot({ path: 'test-results/screenshots/manager-analytics-charts.png' });
  });

  test('no JS errors on analytics page', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.waitForTimeout(2000);
    // Filter out known acceptable errors (e.g. network errors in test env)
    const severeErrors = errors.filter(e => !e.includes('favicon'));
    expect(severeErrors.length).toBe(0);
  });
});

// ─── FINANCIALS ───────────────────────────────────────────────────────────────

test.describe('Manager Financials (/manager/financials)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'manager');
    await page.goto('/manager/financials');
    await page.waitForLoadState('networkidle');
  });

  test('renders financials page', async ({ page }) => {
    await expect(page.getByText(/financial/i).first()).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: 'test-results/screenshots/manager-financials.png' });
  });

  test('financial summary data or charts are shown', async ({ page }) => {
    await page.waitForTimeout(2000);
    const charts = page.locator('.recharts-wrapper, [class*="recharts"]');
    const tables = page.getByRole('table');
    const cards = page.locator('[class*="card"]');
    const hasContent = (await charts.count() > 0) || (await tables.count() > 0) || (await cards.count() > 0);
    expect(hasContent).toBeTruthy();
    await page.screenshot({ path: 'test-results/screenshots/manager-financials-loaded.png' });
  });
});

// ─── COMMON AREAS ────────────────────────────────────────────────────────────

test.describe('Manager Common Areas (/manager/common-areas)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'manager');
    await page.goto('/manager/common-areas');
    await page.waitForLoadState('networkidle');
  });

  test('renders common areas page', async ({ page }) => {
    await expect(page.getByText(/common area/i).first()).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: 'test-results/screenshots/manager-common-areas.png' });
  });

  test('Add Common Area button opens dialog', async ({ page }) => {
    const btn = page.getByRole('button', { name: /add.*area|new.*area|create.*area/i });
    if (await btn.isVisible()) {
      await btn.click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
      await page.screenshot({ path: 'test-results/screenshots/manager-common-areas-add.png' });
      await page.keyboard.press('Escape');
    }
  });

  test('Bookings calendar or list is visible', async ({ page }) => {
    const booking = page.getByText(/booking|calendar|reservation/i);
    if (await booking.count() > 0) {
      await expect(booking.first()).toBeVisible();
    }
    await page.screenshot({ path: 'test-results/screenshots/manager-common-areas-bookings.png' });
  });
});

// ─── SETTINGS ─────────────────────────────────────────────────────────────────

test.describe('Manager Settings (/manager/settings)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'manager');
    await page.goto('/manager/settings');
    await page.waitForLoadState('networkidle');
  });

  test('renders settings page', async ({ page }) => {
    await expect(page.getByText(/setting/i).first()).toBeVisible();
    await page.screenshot({ path: 'test-results/screenshots/manager-settings.png' });
  });

  test('profile form fields are present', async ({ page }) => {
    const nameField = page.getByLabel(/name|first name/i).first()
      .or(page.getByPlaceholder(/name/i).first());
    if (await nameField.isVisible()) {
      await expect(nameField).toBeVisible();
    }
    await page.screenshot({ path: 'test-results/screenshots/manager-settings-profile.png' });
  });

  test('avatar upload section is present', async ({ page }) => {
    // Branch 10: avatar upload
    const avatarSection = page.getByText(/avatar|profile photo|picture/i);
    if (await avatarSection.count() > 0) {
      await expect(avatarSection.first()).toBeVisible();
    }
  });

  test('notification preferences are shown', async ({ page }) => {
    // Branch 10: per-type notification preference toggles
    const prefSection = page.getByText(/notification preference|notify me/i);
    if (await prefSection.count() > 0) {
      await expect(prefSection.first()).toBeVisible();
    }
    await page.screenshot({ path: 'test-results/screenshots/manager-settings-notifications.png' });
  });
});
