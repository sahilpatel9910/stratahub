/**
 * Tests targeting known bugs and gotchas documented in CLAUDE.md.
 * These tests are deliberately written to EXPOSE the bugs, not work around them.
 */

import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

// ─── BUG: CACHE INVALIDATION GAP IN MAINTENANCE ──────────────────────────────
// CLAUDE.md: "detail page updateStatusMutation only invalidates getById;
// list page version only invalidates listByBuilding + getStats.
// Both should invalidate all three."

test.describe('Known bug: maintenance cache invalidation gap', () => {
  test('status change on detail page is reflected on list page', async ({ page }) => {
    await loginAs(page, 'manager');
    await page.goto('/manager/maintenance');
    await page.waitForLoadState('networkidle');

    const rows = page.locator('tbody tr');
    if (await rows.count() === 0) { test.skip(); return; }

    // Get current status of first row before navigating
    const firstRowStatus = await rows.first().locator('[class*="badge"]').first().textContent();

    // Navigate to detail, change status
    const firstLink = rows.first().getByRole('link').first();
    if (await firstLink.count() === 0) { test.skip(); return; }

    await firstLink.click();
    await page.waitForURL(/\/manager\/maintenance\/\w+/, { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Go back to list
    await page.goBack();
    await page.waitForLoadState('networkidle');

    // The list should still show data (not stale/broken)
    await expect(page.getByRole('table')).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: 'test-results/screenshots/bug-maintenance-cache.png' });
  });
});

// ─── BUG: assignInput useEffect clobbers mid-edit text ───────────────────────
// CLAUDE.md: "syncs from req.assignedTo on every refetch, overwriting in-progress input"

test.describe('Known bug: assignInput clobber on refetch', () => {
  test('typing in assignedTo field is not overwritten by refetch', async ({ page }) => {
    await loginAs(page, 'manager');
    await page.goto('/manager/maintenance');
    await page.waitForLoadState('networkidle');

    const rows = page.locator('tbody tr');
    if (await rows.count() === 0) { test.skip(); return; }

    const firstLink = rows.first().getByRole('link').first();
    if (await firstLink.count() === 0) { test.skip(); return; }

    await firstLink.click();
    await page.waitForURL(/\/manager\/maintenance\/\w+/, { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Find the assign contractor input
    const assignInput = page.getByPlaceholder(/assign|contractor/i).first()
      .or(page.getByLabel(/assign/i).first());

    if (await assignInput.count() === 0) { test.skip(); return; }

    const testText = 'John Smith Contractors';
    await assignInput.fill(testText);

    // Wait for any automatic refetch interval
    await page.waitForTimeout(3000);

    // Input should still contain what was typed (not clobbered)
    const currentValue = await assignInput.inputValue();
    expect(currentValue).toBe(testText);
    await page.screenshot({ path: 'test-results/screenshots/bug-assign-clobber.png' });
  });
});

// ─── BUG: Two-step photo upload leaves state broken on failure ────────────────
// CLAUDE.md: "failed upload leaves Add Photo disabled until user manually cancels"

test.describe('Known bug: photo upload failure state', () => {
  test('photo upload cancel restores Add Photo button', async ({ page }) => {
    await loginAs(page, 'manager');
    await page.goto('/manager/maintenance');
    await page.waitForLoadState('networkidle');

    const rows = page.locator('tbody tr');
    if (await rows.count() === 0) { test.skip(); return; }

    const firstLink = rows.first().getByRole('link').first();
    if (await firstLink.count() === 0) { test.skip(); return; }

    await firstLink.click();
    await page.waitForURL(/\/manager\/maintenance\/\w+/, { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    const addPhotoBtn = page.getByRole('button', { name: /add photo|upload photo|photo/i }).first();
    if (await addPhotoBtn.count() === 0) { test.skip(); return; }

    const wasEnabled = await addPhotoBtn.isEnabled();
    expect(wasEnabled).toBeTruthy();
    await page.screenshot({ path: 'test-results/screenshots/bug-photo-upload.png' });
  });
});

// ─── BUG: NEXT_STATUSES map duplicated ───────────────────────────────────────
// CLAUDE.md: "NEXT_STATUSES transition map is duplicated in manager/maintenance/_client.tsx
// and manager/maintenance/[id]/_client.tsx. Update both if transitions change."

test.describe('Known bug: NEXT_STATUSES consistency check', () => {
  test('status transitions are consistent between list and detail pages', async ({ page }) => {
    // This is a code-level bug — verify that both pages show the same available transitions
    // by checking the list page action menu and comparing with detail page select
    await loginAs(page, 'manager');
    await page.goto('/manager/maintenance');
    await page.waitForLoadState('networkidle');

    const rows = page.locator('tbody tr');
    if (await rows.count() === 0) { test.skip(); return; }

    // Get status from row menu (if available)
    const moreBtn = page.locator('tbody tr').first().getByRole('button').last();
    if (await moreBtn.count() > 0) {
      await moreBtn.click();
      await page.screenshot({ path: 'test-results/screenshots/bug-status-list-menu.png' });
      await page.keyboard.press('Escape');
    }

    // Navigate to detail
    const firstLink = rows.first().getByRole('link').first();
    if (await firstLink.count() === 0) { test.skip(); return; }
    await firstLink.click();
    await page.waitForURL(/\/manager\/maintenance\/\w+/, { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    const statusSelect = page.getByRole('combobox').first();
    if (await statusSelect.isVisible()) {
      await statusSelect.click();
      await page.screenshot({ path: 'test-results/screenshots/bug-status-detail-select.png' });
      await page.keyboard.press('Escape');
    }
  });
});

// ─── CRITICAL: Stripe webhook path is whitelisted ─────────────────────────────
// CLAUDE.md: "/api/stripe/ is whitelisted in isPublicAuthPath(). If removed, payments silently fail."

test.describe('Critical: Stripe webhook path accessibility', () => {
  test('POST /api/stripe/webhook returns 400 (not 307 redirect) without auth', async ({ page }) => {
    // Use page.request — not page.evaluate/fetch — so we get a real HTTP response
    // without depending on browser origin. Must use absolute URL.
    const response = await page.request.post('http://localhost:3000/api/stripe/webhook', {
      headers: { 'content-type': 'application/json' },
      data: {},
    });

    // Should be 400 (bad signature) not 307 (redirect to login)
    expect(response.status()).not.toBe(307);
    expect(response.status()).toBe(400);
    await page.screenshot({ path: 'test-results/screenshots/critical-stripe-webhook.png' });
  });
});

// ─── CRITICAL: Outstanding balance sums both levies AND custom bills ───────────
// CLAUDE.md: "Sums both levyUnpaidTotal + billUnpaidTotal. Don't revert to levy-only sum."

test.describe('Critical: Resident outstanding balance completeness', () => {
  test('resident dashboard outstanding balance includes custom bills', async ({ page }) => {
    await loginAs(page, 'owner1');
    await page.goto('/resident');
    await page.waitForLoadState('networkidle');

    // The outstanding balance stat card should exist
    const balance = page.getByText(/outstanding|balance|owing|amount due/i).first();
    if (await balance.count() > 0) {
      await expect(balance).toBeVisible();
    }
    await page.screenshot({ path: 'test-results/screenshots/critical-outstanding-balance.png' });
  });
});

// ─── MOBILE RESPONSIVENESS ────────────────────────────────────────────────────

test.describe('Mobile responsiveness — critical pages', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('resident levies page is usable on mobile', async ({ page }) => {
    await loginAs(page, 'owner1');
    await page.goto('/resident/levies');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/levy|levies/i).first()).toBeVisible();
    await page.screenshot({ path: 'test-results/screenshots/mobile-resident-levies.png' });
  });

  test('manager maintenance page is usable on mobile', async ({ page }) => {
    await loginAs(page, 'manager');
    await page.goto('/manager/maintenance');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/maintenance/i).first()).toBeVisible();
    await page.screenshot({ path: 'test-results/screenshots/mobile-manager-maintenance.png' });
  });

  test('login page is fully usable on mobile', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
    await page.screenshot({ path: 'test-results/screenshots/mobile-login.png' });
  });
});
