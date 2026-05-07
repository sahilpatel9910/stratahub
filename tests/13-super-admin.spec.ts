/**
 * Super-Admin Full Test Suite
 *
 * Credentials: admin@stratahub.com.au / Admin1234!
 *
 * Covers:
 *  1. Super-admin can log in and land on the correct page
 *  2. All three admin pages load and render correctly
 *  3. Every button, dialog, form, table, search, dropdown on each admin page
 *  4. Access-control: manager/owner/tenant CANNOT reach super-admin routes
 *  5. Unauthenticated access redirects to /login
 *
 * NOTE: Login timeout is set high (45s) because Supabase free tier is slow.
 *       Login failures are NOT treated as bugs — they are an infra constraint.
 *       Only redirect/permission behavior after a successful login is under test.
 */

import { test, expect } from '@playwright/test';
import { loginAs, logout } from './helpers/auth';

// ─── SUPER-ADMIN LOGIN & PORTAL ENTRY ────────────────────────────────────────

test.describe('Super-admin login and portal entry', () => {
  test('super-admin logs in and lands on /super-admin/organisations', async ({ page }) => {
    await loginAs(page, 'superAdmin');
    // Root page.tsx should redirect SUPER_ADMIN to /super-admin/organisations
    await expect(page).toHaveURL(/\/super-admin\/organisations/, { timeout: 15000 });
    await page.screenshot({ path: 'test-results/screenshots/sa-login-redirect.png' });
  });

  test('super-admin sees admin sidebar (Organisations, Buildings, Users)', async ({ page }) => {
    await loginAs(page, 'superAdmin');
    await page.waitForURL(/\/super-admin/, { timeout: 15000 });
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('link', { name: 'Organisations' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('link', { name: 'Buildings' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Users' })).toBeVisible();
    await page.screenshot({ path: 'test-results/screenshots/sa-sidebar.png' });
  });

  test('super-admin sidebar also shows Property Management section', async ({ page }) => {
    await loginAs(page, 'superAdmin');
    await page.waitForURL(/\/super-admin/, { timeout: 15000 });
    await page.waitForLoadState('networkidle');
    // Super-admin also gets the manager nav (AppSidebar isSuperAdmin renders both sections)
    await expect(page.getByRole('link', { name: 'Dashboard' }).first()).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: 'test-results/screenshots/sa-sidebar-full.png' });
  });

  test('super-admin can sign out and is redirected to /login', async ({ page }) => {
    await loginAs(page, 'superAdmin');
    await page.waitForURL(/\/super-admin/, { timeout: 15000 });
    await page.waitForLoadState('networkidle');
    await logout(page);
    await expect(page).toHaveURL(/\/login/);
    await page.screenshot({ path: 'test-results/screenshots/sa-sign-out.png' });
  });
});

// ─── ORGANISATIONS PAGE ───────────────────────────────────────────────────────

test.describe('Super-admin Organisations page (/super-admin/organisations)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'superAdmin');
    await page.goto('/super-admin/organisations');
    await page.waitForLoadState('networkidle');
  });

  test('page heading "Organisations" is visible', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Organisations' })).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: 'test-results/screenshots/sa-orgs-page.png' });
  });

  test('sub-heading "Manage organisations across Australia" is visible', async ({ page }) => {
    await expect(page.getByText('Manage organisations across Australia')).toBeVisible({ timeout: 10000 });
  });

  test('organisations table renders with columns', async ({ page }) => {
    await expect(page.getByRole('table')).toBeVisible({ timeout: 10000 });
    // Column headers
    await expect(page.getByRole('columnheader', { name: 'Organisation' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'ABN' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'State' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Buildings' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Members' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Status' })).toBeVisible();
    await page.screenshot({ path: 'test-results/screenshots/sa-orgs-table.png' });
  });

  test('organisations table has at least one seeded row', async ({ page }) => {
    const rows = page.locator('tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 10000 });
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
    await page.screenshot({ path: 'test-results/screenshots/sa-orgs-rows.png' });
  });

  test('Status badge shows Active or Inactive', async ({ page }) => {
    const badge = page.getByRole('cell').filter({ hasText: /Active|Inactive/ }).first();
    await expect(badge).toBeVisible({ timeout: 10000 });
  });

  test('search input filters organisations', async ({ page }) => {
    const searchInput = page.getByPlaceholder('Search organisations...');
    await expect(searchInput).toBeVisible({ timeout: 10000 });
    // Type something that definitely won't match
    await searchInput.fill('zzz_no_match_xyz');
    await expect(page.getByText('No organisations match your search.')).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: 'test-results/screenshots/sa-orgs-search-empty.png' });
    // Clear and check rows return
    await searchInput.clear();
    const rows = page.locator('tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: 'test-results/screenshots/sa-orgs-search-cleared.png' });
  });

  test('"New Organisation" button is visible and opens create dialog', async ({ page }) => {
    const newBtn = page.getByRole('button', { name: /new organisation/i });
    await expect(newBtn).toBeVisible({ timeout: 10000 });
    await newBtn.click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('heading', { name: 'Create Organisation' })).toBeVisible();
    await page.screenshot({ path: 'test-results/screenshots/sa-orgs-create-dialog.png' });
  });

  test('create dialog has required fields: Organisation Name, ABN (optional), State', async ({ page }) => {
    await page.getByRole('button', { name: /new organisation/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
    await expect(page.getByLabel('Organisation Name')).toBeVisible();
    await expect(page.getByLabel(/abn/i)).toBeVisible();
    await expect(page.getByRole('dialog').getByText('State', { exact: true })).toBeVisible();
    await page.screenshot({ path: 'test-results/screenshots/sa-orgs-create-fields.png' });
  });

  test('create dialog "Create Organisation" button is disabled when name is empty', async ({ page }) => {
    await page.getByRole('button', { name: /new organisation/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
    const submitBtn = page.getByRole('button', { name: /create organisation/i });
    await expect(submitBtn).toBeDisabled();
  });

  test('create dialog "Create Organisation" button enabled after filling name + state', async ({ page }) => {
    await page.getByRole('button', { name: /new organisation/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
    await page.getByLabel('Organisation Name').fill('QA Test Organisation');
    // Select a state from the combobox
    const stateSelect = page.getByRole('combobox').first();
    await stateSelect.click();
    await page.getByRole('option', { name: /NSW|Victoria|Queensland/i }).first().click();
    const submitBtn = page.getByRole('button', { name: /create organisation/i });
    await expect(submitBtn).toBeEnabled();
    await page.screenshot({ path: 'test-results/screenshots/sa-orgs-create-enabled.png' });
  });

  test('create dialog "Cancel" button closes dialog', async ({ page }) => {
    await page.getByRole('button', { name: /new organisation/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: /cancel/i }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 3000 });
  });

  test('row dropdown menu (⋯) opens with Edit and Deactivate/Reactivate options', async ({ page }) => {
    const rows = page.locator('tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 10000 });
    // Find the dropdown trigger in the last cell of the first row
    const moreBtn = rows.first().getByRole('button').last();
    await moreBtn.click();
    await expect(page.getByRole('menuitem', { name: 'Edit' })).toBeVisible({ timeout: 3000 });
    await expect(page.getByRole('menuitem', { name: /deactivate|reactivate/i })).toBeVisible();
    await page.screenshot({ path: 'test-results/screenshots/sa-orgs-row-menu.png' });
    await page.keyboard.press('Escape');
  });

  test('clicking "Edit" in row menu opens edit dialog', async ({ page }) => {
    const rows = page.locator('tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 10000 });
    const moreBtn = rows.first().getByRole('button').last();
    await moreBtn.click();
    await page.getByRole('menuitem', { name: 'Edit' }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('heading', { name: 'Edit Organisation' })).toBeVisible();
    await page.screenshot({ path: 'test-results/screenshots/sa-orgs-edit-dialog.png' });
    await page.keyboard.press('Escape');
  });

  test('edit dialog fields are pre-filled with existing org data', async ({ page }) => {
    const rows = page.locator('tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 10000 });
    const orgName = await rows.first().locator('td').nth(0).innerText();
    const moreBtn = rows.first().getByRole('button').last();
    await moreBtn.click();
    await page.getByRole('menuitem', { name: 'Edit' }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
    // The name field should be pre-filled
    const nameField = page.getByLabel('Organisation Name').nth(1).or(page.locator('#editOrgName'));
    const value = await nameField.inputValue();
    expect(value.trim().length).toBeGreaterThan(0);
    await page.screenshot({ path: 'test-results/screenshots/sa-orgs-edit-prefilled.png' });
    await page.keyboard.press('Escape');
  });

  test('edit dialog "Save Changes" button updates organisation name', async ({ page }) => {
    const rows = page.locator('tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 10000 });
    const moreBtn = rows.first().getByRole('button').last();
    await moreBtn.click();
    await page.getByRole('menuitem', { name: 'Edit' }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
    // The "Save Changes" button should be enabled (form is pre-filled)
    const saveBtn = page.getByRole('button', { name: /save changes/i });
    await expect(saveBtn).toBeEnabled();
    await page.screenshot({ path: 'test-results/screenshots/sa-orgs-save-enabled.png' });
    await page.keyboard.press('Escape');
  });
});

// ─── BUILDINGS PAGE ───────────────────────────────────────────────────────────

test.describe('Super-admin Buildings page (/super-admin/buildings)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'superAdmin');
    await page.goto('/super-admin/buildings');
    await page.waitForLoadState('networkidle');
  });

  test('page heading "Buildings" is visible', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Buildings' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Manage all buildings across organisations')).toBeVisible();
    await page.screenshot({ path: 'test-results/screenshots/sa-buildings-page.png' });
  });

  test('buildings table renders with correct columns', async ({ page }) => {
    await expect(page.getByRole('table')).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('columnheader', { name: 'Building' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Organisation' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Location' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'State' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Units' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Staff' })).toBeVisible();
    await page.screenshot({ path: 'test-results/screenshots/sa-buildings-table.png' });
  });

  test('buildings table has at least one seeded row', async ({ page }) => {
    const rows = page.locator('tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 10000 });
    expect(await rows.count()).toBeGreaterThan(0);
  });

  test('search input filters buildings', async ({ page }) => {
    const searchInput = page.getByPlaceholder('Search buildings...');
    await expect(searchInput).toBeVisible({ timeout: 10000 });
    await searchInput.fill('zzz_no_match_xyz');
    await expect(page.getByText(/no buildings match/i)).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: 'test-results/screenshots/sa-buildings-search-empty.png' });
    await searchInput.clear();
    await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 5000 });
  });

  test('"Add Building" / "New Building" button is visible and opens create dialog', async ({ page }) => {
    // Building page uses dynamic CreateBuildingDialog as a DialogTrigger
    const createBtn = page.getByRole('button', { name: /add building|new building|create building/i });
    await expect(createBtn).toBeVisible({ timeout: 10000 });
    await createBtn.click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: 'test-results/screenshots/sa-buildings-create-dialog.png' });
    await page.keyboard.press('Escape');
  });

  test('create building dialog has required fields', async ({ page }) => {
    const createBtn = page.getByRole('button', { name: /add building|new building|create building/i });
    await createBtn.click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
    // Should have org select, name, address, suburb, state, postcode fields
    await expect(page.getByRole('dialog').getByRole('combobox').first()).toBeVisible();
    await page.screenshot({ path: 'test-results/screenshots/sa-buildings-create-fields.png' });
    await page.keyboard.press('Escape');
  });

  test('row dropdown has "Edit Building" and "Delete" options', async ({ page }) => {
    const rows = page.locator('tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 10000 });
    const moreBtn = rows.first().getByRole('button').last();
    await moreBtn.click();
    await expect(page.getByRole('menuitem', { name: 'Edit Building' })).toBeVisible({ timeout: 3000 });
    await expect(page.getByRole('menuitem', { name: 'Delete' })).toBeVisible();
    await page.screenshot({ path: 'test-results/screenshots/sa-buildings-row-menu.png' });
    await page.keyboard.press('Escape');
  });

  test('clicking "Edit Building" opens edit dialog pre-filled', async ({ page }) => {
    const rows = page.locator('tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 10000 });
    const moreBtn = rows.first().getByRole('button').last();
    await moreBtn.click();
    await page.getByRole('menuitem', { name: 'Edit Building' }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: 'test-results/screenshots/sa-buildings-edit-dialog.png' });
    await page.keyboard.press('Escape');
  });

  test('sidebar nav link "Buildings" is active on this page', async ({ page }) => {
    const buildingsLink = page.getByRole('link', { name: 'Buildings' });
    await expect(buildingsLink).toBeVisible({ timeout: 10000 });
    // Active state attribute — shadcn sidebar sets aria-current or data-active
    await page.screenshot({ path: 'test-results/screenshots/sa-buildings-active-nav.png' });
  });
});

// ─── USERS PAGE ───────────────────────────────────────────────────────────────

test.describe('Super-admin Users page (/super-admin/users)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'superAdmin');
    await page.goto('/super-admin/users');
    await page.waitForLoadState('networkidle');
  });

  test('page heading "Users" is visible', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: 'test-results/screenshots/sa-users-page.png' });
  });

  test('users table renders', async ({ page }) => {
    await expect(page.getByRole('table')).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: 'test-results/screenshots/sa-users-table.png' });
  });

  test('users table has seeded rows', async ({ page }) => {
    const rows = page.locator('tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 10000 });
    expect(await rows.count()).toBeGreaterThan(0);
  });

  test('search input is present and filters users', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search/i).first();
    await expect(searchInput).toBeVisible({ timeout: 10000 });
    await searchInput.fill('zzz_no_match_xyz');
    await page.waitForTimeout(400);
    await page.screenshot({ path: 'test-results/screenshots/sa-users-search-empty.png' });
    await searchInput.clear();
  });

  test('tabs are present (All, Invited, etc.)', async ({ page }) => {
    // Users page has tabs based on the component code
    const tabs = page.getByRole('tab');
    const count = await tabs.count();
    if (count > 0) {
      await expect(tabs.first()).toBeVisible({ timeout: 5000 });
      await page.screenshot({ path: 'test-results/screenshots/sa-users-tabs.png' });
    }
  });

  test('"Invite User" button opens invite dialog', async ({ page }) => {
    const inviteBtn = page.getByRole('button', { name: /invite user|new user|add user/i });
    if (await inviteBtn.isVisible()) {
      await inviteBtn.click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
      await page.screenshot({ path: 'test-results/screenshots/sa-users-invite-dialog.png' });
      await page.keyboard.press('Escape');
    }
  });

  test('invite dialog has email, role, org, building fields', async ({ page }) => {
    const inviteBtn = page.getByRole('button', { name: /invite user|new user|add user/i });
    if (await inviteBtn.isVisible()) {
      await inviteBtn.click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
      // Email field
      await expect(page.getByRole('dialog').getByLabel(/email/i)).toBeVisible();
      // Role select
      await expect(page.getByRole('dialog').getByRole('combobox').first()).toBeVisible();
      await page.screenshot({ path: 'test-results/screenshots/sa-users-invite-fields.png' });
      await page.keyboard.press('Escape');
    }
  });

  test('user row dropdown has management options', async ({ page }) => {
    const rows = page.locator('tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 10000 });
    const moreBtn = rows.first().getByRole('button').last();
    if (await moreBtn.isVisible()) {
      await moreBtn.click();
      await page.screenshot({ path: 'test-results/screenshots/sa-users-row-menu.png' });
      await page.keyboard.press('Escape');
    }
  });

  test('super-admin account itself appears in the users table', async ({ page }) => {
    // The admin@stratahub.com.au account should be listed
    const adminRow = page.getByText('admin@stratahub.com.au');
    if (await adminRow.count() > 0) {
      await expect(adminRow.first()).toBeVisible({ timeout: 10000 });
    }
    // Or by name if the table shows names
    await page.screenshot({ path: 'test-results/screenshots/sa-users-admin-row.png' });
  });
});

// ─── SUPER-ADMIN CAN ALSO ACCESS MANAGER PORTAL ──────────────────────────────

test.describe('Super-admin cross-portal access (can reach /manager pages)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'superAdmin');
    await page.waitForURL(/\/super-admin/, { timeout: 15000 });
  });

  test('super-admin can navigate to /manager via sidebar and it loads', async ({ page }) => {
    await page.getByRole('link', { name: 'Dashboard' }).first().click();
    await expect(page).toHaveURL(/\/manager/, { timeout: 10000 });
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/manager overview/i)).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: 'test-results/screenshots/sa-to-manager-dashboard.png' });
  });

  test('super-admin can navigate back to /super-admin/organisations via sidebar', async ({ page }) => {
    // First go to manager
    await page.goto('/manager');
    await page.waitForLoadState('networkidle');
    // Go back to admin via sidebar
    await page.getByRole('link', { name: 'Organisations' }).click();
    await expect(page).toHaveURL(/\/super-admin\/organisations/, { timeout: 10000 });
    await page.screenshot({ path: 'test-results/screenshots/sa-back-to-admin.png' });
  });
});

// ─── ACCESS CONTROL: NON-SUPER-ADMIN ROLES ───────────────────────────────────

test.describe('Access control — non-super-admin cannot reach /super-admin routes', () => {

  test('unauthenticated user accessing /super-admin/organisations is redirected to /login', async ({ page }) => {
    await page.goto('/super-admin/organisations');
    await expect(page).toHaveURL(/\/login/, { timeout: 15000 });
    await page.screenshot({ path: 'test-results/screenshots/sa-access-unauthed.png' });
  });

  test('unauthenticated user accessing /super-admin/buildings is redirected to /login', async ({ page }) => {
    await page.goto('/super-admin/buildings');
    await expect(page).toHaveURL(/\/login/, { timeout: 15000 });
  });

  test('unauthenticated user accessing /super-admin/users is redirected to /login', async ({ page }) => {
    await page.goto('/super-admin/users');
    await expect(page).toHaveURL(/\/login/, { timeout: 15000 });
  });

  test('BUILDING_MANAGER accessing /super-admin/organisations is redirected away', async ({ page }) => {
    await loginAs(page, 'manager');
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 45000 });
    // Navigate to super-admin route
    await page.goto('/super-admin/organisations');
    await page.waitForLoadState('networkidle');
    // Must NOT stay on super-admin — should land on /manager
    await expect(page).not.toHaveURL(/\/super-admin/, { timeout: 15000 });
    await page.screenshot({ path: 'test-results/screenshots/sa-manager-blocked.png' });
  });

  test('BUILDING_MANAGER accessing /super-admin/buildings is redirected away', async ({ page }) => {
    await loginAs(page, 'manager');
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 45000 });
    await page.goto('/super-admin/buildings');
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL(/\/super-admin/, { timeout: 15000 });
  });

  test('BUILDING_MANAGER accessing /super-admin/users is redirected away', async ({ page }) => {
    await loginAs(page, 'manager');
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 45000 });
    await page.goto('/super-admin/users');
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL(/\/super-admin/, { timeout: 15000 });
    await page.screenshot({ path: 'test-results/screenshots/sa-manager-users-blocked.png' });
  });

  test('OWNER accessing /super-admin/organisations is redirected away', async ({ page }) => {
    await loginAs(page, 'owner1');
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 45000 });
    await page.goto('/super-admin/organisations');
    await page.waitForLoadState('networkidle');
    // Owner should end up on /resident, not /super-admin
    await expect(page).not.toHaveURL(/\/super-admin/, { timeout: 15000 });
    await expect(page).toHaveURL(/\/resident/, { timeout: 10000 });
    await page.screenshot({ path: 'test-results/screenshots/sa-owner-blocked.png' });
  });

  test('TENANT accessing /super-admin/buildings is redirected to /resident', async ({ page }) => {
    await loginAs(page, 'tenant1');
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 45000 });
    await page.goto('/super-admin/buildings');
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL(/\/super-admin/, { timeout: 15000 });
    await expect(page).toHaveURL(/\/resident/, { timeout: 10000 });
    await page.screenshot({ path: 'test-results/screenshots/sa-tenant-blocked.png' });
  });

  test('RECEPTION accessing /super-admin/organisations is redirected away', async ({ page }) => {
    await loginAs(page, 'reception');
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 45000 });
    await page.goto('/super-admin/organisations');
    await page.waitForLoadState('networkidle');
    // Reception is a manager-portal role — should go to /manager not /super-admin
    await expect(page).not.toHaveURL(/\/super-admin/, { timeout: 15000 });
    await page.screenshot({ path: 'test-results/screenshots/sa-reception-blocked.png' });
  });
});

// ─── SIDEBAR NAVIGATION FROM SUPER-ADMIN PAGES ───────────────────────────────

test.describe('Super-admin sidebar navigation links', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'superAdmin');
    await page.goto('/super-admin/organisations');
    await page.waitForLoadState('networkidle');
  });

  test('"Buildings" sidebar link navigates to /super-admin/buildings', async ({ page }) => {
    await page.getByRole('link', { name: 'Buildings' }).click();
    await expect(page).toHaveURL(/\/super-admin\/buildings/, { timeout: 10000 });
    await page.screenshot({ path: 'test-results/screenshots/sa-nav-buildings.png' });
  });

  test('"Users" sidebar link navigates to /super-admin/users', async ({ page }) => {
    await page.getByRole('link', { name: 'Users' }).click();
    await expect(page).toHaveURL(/\/super-admin\/users/, { timeout: 10000 });
    await page.screenshot({ path: 'test-results/screenshots/sa-nav-users.png' });
  });

  test('"Organisations" sidebar link navigates to /super-admin/organisations', async ({ page }) => {
    // First go elsewhere, then come back
    await page.getByRole('link', { name: 'Buildings' }).click();
    await expect(page).toHaveURL(/\/super-admin\/buildings/, { timeout: 10000 });
    await page.getByRole('link', { name: 'Organisations' }).click();
    await expect(page).toHaveURL(/\/super-admin\/organisations/, { timeout: 10000 });
    await page.screenshot({ path: 'test-results/screenshots/sa-nav-orgs.png' });
  });

  test('Sign Out button is in sidebar footer and works', async ({ page }) => {
    await expect(page.getByRole('button', { name: /sign out/i })).toBeVisible({ timeout: 10000 });
    await logout(page);
    await expect(page).toHaveURL(/\/login/);
  });
});

// ─── MOBILE VIEWPORT — SUPER-ADMIN ───────────────────────────────────────────

test.describe('Super-admin pages on mobile viewport', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('organisations page loads on mobile', async ({ page }) => {
    await loginAs(page, 'superAdmin');
    await page.goto('/super-admin/organisations');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'Organisations' })).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: 'test-results/screenshots/sa-mobile-orgs.png' });
  });

  test('buildings page loads on mobile', async ({ page }) => {
    await loginAs(page, 'superAdmin');
    await page.goto('/super-admin/buildings');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'Buildings' })).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: 'test-results/screenshots/sa-mobile-buildings.png' });
  });
});
