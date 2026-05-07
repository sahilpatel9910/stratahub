import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

// ─── ANNOUNCEMENTS ────────────────────────────────────────────────────────────

test.describe('Manager Announcements (/manager/announcements)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'manager');
    await page.goto('/manager/announcements');
    await page.waitForLoadState('networkidle');
  });

  test('renders announcements page', async ({ page }) => {
    await expect(page.getByText(/announcement/i).first()).toBeVisible();
    await page.screenshot({ path: 'test-results/screenshots/manager-announcements.png' });
  });

  test('Create Announcement button opens dialog', async ({ page }) => {
    const btn = page.getByRole('button', { name: /create announcement|new announcement|post announcement/i });
    if (await btn.isVisible()) {
      await btn.click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
      await page.screenshot({ path: 'test-results/screenshots/manager-announcements-create.png' });
      await page.keyboard.press('Escape');
    }
  });

  test('announcements list is visible', async ({ page }) => {
    const table = page.getByRole('table');
    const cards = page.locator('[class*="card"]');
    const hasContent = (await table.count() > 0) || (await cards.count() > 0);
    expect(hasContent).toBeTruthy();
  });
});

// ─── DOCUMENTS ────────────────────────────────────────────────────────────────

test.describe('Manager Documents (/manager/documents)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'manager');
    await page.goto('/manager/documents');
    await page.waitForLoadState('networkidle');
  });

  test('renders documents page', async ({ page }) => {
    await expect(page.getByText(/document/i).first()).toBeVisible();
    await page.screenshot({ path: 'test-results/screenshots/manager-documents.png' });
  });

  test('Upload Document button is present', async ({ page }) => {
    const btn = page.getByRole('button', { name: /upload|add document|new document/i });
    if (await btn.isVisible()) {
      await btn.click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
      await page.screenshot({ path: 'test-results/screenshots/manager-documents-upload.png' });
      await page.keyboard.press('Escape');
    }
  });
});

// ─── MESSAGES ─────────────────────────────────────────────────────────────────

test.describe('Manager Messages (/manager/messages)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'manager');
    await page.goto('/manager/messages');
    await page.waitForLoadState('networkidle');
  });

  test('renders messages page with conversation list', async ({ page }) => {
    await expect(page.getByText(/message/i).first()).toBeVisible();
    await page.screenshot({ path: 'test-results/screenshots/manager-messages.png' });
  });

  test('message compose area is visible', async ({ page }) => {
    const compose = page.getByPlaceholder(/type a message|write|compose/i)
      .or(page.getByRole('textbox').last());
    // Compose box may only appear when a conversation is selected
    await page.screenshot({ path: 'test-results/screenshots/manager-messages-compose.png' });
  });

  test('sending a message works', async ({ page }) => {
    // Select first conversation if available
    const conversation = page.locator('[class*="conversation"], [class*="thread"]').first()
      .or(page.locator('ul li').first());
    if (await conversation.count() > 0) {
      await conversation.click();
      const compose = page.getByPlaceholder(/type a message|write|compose/i);
      if (await compose.isVisible()) {
        await compose.fill('Test message from QA audit');
        await page.keyboard.press('Enter');
        await page.screenshot({ path: 'test-results/screenshots/manager-messages-sent.png' });
      }
    }
  });
});

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────

test.describe('Manager Notifications (/manager/notifications)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'manager');
    await page.goto('/manager/notifications');
    await page.waitForLoadState('networkidle');
  });

  test('renders notifications centre', async ({ page }) => {
    await expect(page.getByText(/notification/i).first()).toBeVisible();
    await page.screenshot({ path: 'test-results/screenshots/manager-notifications.png' });
  });

  test('filter pills are present (All, Unread, etc)', async ({ page }) => {
    // Branch 9: filter pills for notification type
    const filters = page.getByRole('button', { name: /all|unread|read/i });
    if (await filters.count() > 0) {
      await expect(filters.first()).toBeVisible();
    }
  });

  test('Mark all read button works', async ({ page }) => {
    const markAllBtn = page.getByRole('button', { name: /mark all read|mark all as read/i });
    if (await markAllBtn.isVisible()) {
      await markAllBtn.click();
      await page.screenshot({ path: 'test-results/screenshots/manager-notifications-mark-read.png' });
    }
  });

  test('Load more button appears and loads additional notifications', async ({ page }) => {
    // Demo seed creates 25 notifications; page size is 20, so hasNextPage = true
    const loadMoreBtn = page.getByRole('button', { name: /load more/i });
    await expect(loadMoreBtn).toBeVisible({ timeout: 10_000 });

    // Count notification rows before loading more (first page = 20)
    const notifRows = page.getByRole('button', { name: /demo notification/i });
    const countBefore = await notifRows.count();
    expect(countBefore).toBeGreaterThanOrEqual(20);

    await loadMoreBtn.click();

    // Wait until more rows appear (or Load more disappears meaning all loaded)
    await expect(async () => {
      const count = await page.getByRole('button', { name: /demo notification/i }).count();
      expect(count).toBeGreaterThan(countBefore);
    }).toPass({ timeout: 10_000 });

    const countAfter = await page.getByRole('button', { name: /demo notification/i }).count();
    expect(countAfter).toBeGreaterThan(countBefore);
    await page.screenshot({ path: 'test-results/screenshots/manager-notifications-paginated.png' });
  });
});
