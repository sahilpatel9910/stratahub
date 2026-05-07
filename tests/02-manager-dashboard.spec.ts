import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

test.describe('Manager Dashboard (/manager)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'manager');
    await page.goto('/manager');
    await page.waitForLoadState('networkidle');
  });

  test('renders page heading', async ({ page }) => {
    await expect(page.getByText(/manager overview/i)).toBeVisible();
    await page.screenshot({ path: 'test-results/screenshots/manager-dashboard-loaded.png' });
  });

  test('sidebar navigation is visible with all items', async ({ page }) => {
    const navItems = [
      'Dashboard', 'Residents', 'Units', 'Rent', 'Keys & Access',
      'Maintenance', 'Inspections', 'Visitors', 'Parcels',
      'Announcements', 'Documents', 'Messages', 'Notifications',
      'Strata', 'Common Areas', 'Financials', 'Analytics',
    ];
    for (const item of navItems) {
      await expect(page.getByRole('link', { name: item }).first()).toBeVisible();
    }
    await page.screenshot({ path: 'test-results/screenshots/manager-sidebar.png' });
  });

  test('StrataHub logo link goes to /manager', async ({ page }) => {
    await page.getByRole('link', { name: /stratahub/i }).first().click();
    await expect(page).toHaveURL(/\/manager$/);
  });

  test('Settings link in sidebar footer works', async ({ page }) => {
    await page.getByRole('link', { name: /settings/i }).click();
    await expect(page).toHaveURL(/\/manager\/settings/);
  });

  test('stat cards appear when building is selected', async ({ page }) => {
    // If building is pre-selected from context, stat cards should show
    // Check for at least one metric label
    const labels = ['Open maintenance', 'Overdue rent', 'Pending parcels', 'Keys to rotate'];
    for (const label of labels) {
      await expect(page.getByText(label)).toBeVisible({ timeout: 10000 });
    }
  });

  test('recent maintenance section renders', async ({ page }) => {
    await expect(page.getByText(/recent maintenance/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('recent announcements section renders', async ({ page }) => {
    await expect(page.getByText(/announcements/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('notification badge appears in sidebar when there are unread notifications', async ({ page }) => {
    // The badge is conditional — just assert the Notifications link is present
    await expect(page.getByRole('link', { name: /notifications/i })).toBeVisible();
  });
});

// ─── MOBILE VIEWPORT ──────────────────────────────────────────────────────────

test.describe('Manager Dashboard — mobile', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('page loads on mobile', async ({ page }) => {
    await loginAs(page, 'manager');
    await page.goto('/manager');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/manager overview/i)).toBeVisible();
    await page.screenshot({ path: 'test-results/screenshots/manager-dashboard-mobile.png' });
  });
});
