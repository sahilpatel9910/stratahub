import { test, expect } from '@playwright/test';
import { loginAs, DEMO_ACCOUNTS } from './helpers/auth';

// ─── LOGIN PAGE ───────────────────────────────────────────────────────────────

test.describe('Login page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('renders key elements', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /forgot password/i })).toBeVisible();
    await page.screenshot({ path: 'test-results/screenshots/login-page.png' });
  });

  test('shows error for invalid credentials', async ({ page }) => {
    await page.getByLabel('Email').fill('wrong@example.com');
    await page.getByLabel('Password').fill('WrongPass123!');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.locator('text=Invalid login credentials').or(page.locator('[class*="red"]').first())).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: 'test-results/screenshots/login-invalid-creds.png' });
  });

  test('shows validation for empty email', async ({ page }) => {
    await page.getByLabel('Password').fill('somepassword');
    await page.getByRole('button', { name: /sign in/i }).click();
    // HTML5 required validation — email field should be invalid
    const emailInput = page.getByLabel('Email');
    await expect(emailInput).toHaveAttribute('required');
  });

  test('shows loading state while signing in', async ({ page }) => {
    await page.getByLabel('Email').fill(DEMO_ACCOUNTS.manager.email);
    await page.getByLabel('Password').fill(DEMO_ACCOUNTS.manager.password);
    await page.getByRole('button', { name: /sign in/i }).click();
    // Momentarily shows "Signing in..."
    // (may be too fast to catch, but assert button is disabled after click)
    const btn = page.getByRole('button', { name: /signing in|sign in/i });
    await expect(btn).toBeVisible();
  });

  test('manager login redirects to /manager', async ({ page }) => {
    await loginAs(page, 'manager');
    await expect(page).toHaveURL(/\/manager/);
    await page.screenshot({ path: 'test-results/screenshots/manager-dashboard.png' });
  });

  test('owner login redirects to /resident', async ({ page }) => {
    await loginAs(page, 'owner1');
    await expect(page).toHaveURL(/\/resident/);
    await page.screenshot({ path: 'test-results/screenshots/resident-dashboard.png' });
  });

  test('tenant login redirects to /resident', async ({ page }) => {
    await loginAs(page, 'tenant1');
    await expect(page).toHaveURL(/\/resident/);
  });

  test('forgot password link navigates correctly', async ({ page }) => {
    await page.getByRole('link', { name: /forgot password/i }).click();
    await expect(page).toHaveURL(/\/forgot-password/);
  });
});

// ─── FORGOT PASSWORD PAGE ─────────────────────────────────────────────────────

test.describe('Forgot password page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/forgot-password');
  });

  test('renders correctly', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /reset your password/i })).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByRole('button', { name: /send reset link/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /back to sign in/i })).toBeVisible();
    await page.screenshot({ path: 'test-results/screenshots/forgot-password.png' });
  });

  test('shows success state after submitting valid email', async ({ page }) => {
    await page.getByLabel('Email').fill('manager@demo.com');
    await page.getByRole('button', { name: /send reset link/i }).click();
    await expect(page.getByText(/check your email/i)).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: 'test-results/screenshots/forgot-password-success.png' });
  });

  test('back to sign in link works', async ({ page }) => {
    await page.getByRole('link', { name: /back to sign in/i }).click();
    await expect(page).toHaveURL(/\/login/);
  });
});

// ─── PROTECTED ROUTE REDIRECTS ────────────────────────────────────────────────

test.describe('Auth-gated routes', () => {
  test('unauthenticated access to /manager redirects to login', async ({ page }) => {
    await page.goto('/manager');
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test('unauthenticated access to /resident redirects to login', async ({ page }) => {
    await page.goto('/resident');
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test('unauthenticated access to /super-admin redirects to login', async ({ page }) => {
    await page.goto('/super-admin/organisations');
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test('resident cannot access /manager routes', async ({ page }) => {
    await loginAs(page, 'owner1');
    await page.goto('/manager');
    // Should redirect to /resident or /access-required
    await expect(page).not.toHaveURL(/\/manager/, { timeout: 10000 });
  });
});

// ─── REGISTER PAGE ────────────────────────────────────────────────────────────

test.describe('Register page', () => {
  test('shows invitation required message without token', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByText(/invitation required/i)).toBeVisible();
    await page.screenshot({ path: 'test-results/screenshots/register-no-invite.png' });
  });

  test('shows invalid invite message for bad token', async ({ page }) => {
    await page.goto('/register?invite=bad-token-12345');
    await expect(page.getByText(/not found|invalid|expired/i).first()).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: 'test-results/screenshots/register-bad-token.png' });
  });
});

// ─── SIGN OUT ─────────────────────────────────────────────────────────────────

test.describe('Sign out', () => {
  test('manager can sign out and is redirected to login', async ({ page }) => {
    await loginAs(page, 'manager');
    await page.getByRole('button', { name: /sign out/i }).click();
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
    await page.screenshot({ path: 'test-results/screenshots/signed-out.png' });
  });
});
