import { Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// Supabase free tier can be slow — allow up to 45s for sign-in + redirect chain.
const LOGIN_TIMEOUT = 45_000;

export const DEMO_ACCOUNTS = {
  superAdmin: { email: 'admin@stratahub.com.au', password: 'Admin1234!' },
  manager:    { email: 'manager@demo.com',        password: 'Demo1234!' },
  reception:  { email: 'reception@demo.com',      password: 'Demo1234!' },
  owner1:     { email: 'owner1@demo.com',         password: 'Demo1234!' },
  tenant1:    { email: 'tenant1@demo.com',        password: 'Demo1234!' },
};

// Where each role lands after login — used by the fast-path.
const ROLE_HOME: Record<string, string> = {
  manager:    '/manager/dashboard',
  reception:  '/manager/visitors',
  owner1:     '/resident/dashboard',
  tenant1:    '/resident/dashboard',
  superAdmin: '/super-admin',
};

/**
 * Log in as a named role.
 *
 * Fast path (used during normal test runs): if global-setup has already
 * cached the session in .auth/<role>.json, inject those cookies and navigate
 * directly to the role's home page.  No Supabase round-trip needed.
 *
 * Fallback: full interactive login (used when .auth files don't exist yet,
 * e.g. on the first run or in CI before global-setup has run).
 */
export async function loginAs(page: Page, role: keyof typeof DEMO_ACCOUNTS) {
  const stateFile = path.join(process.cwd(), '.auth', `${role}.json`);

  if (fs.existsSync(stateFile)) {
    const state = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
    await page.context().addCookies(state.cookies ?? []);
    await page.goto(ROLE_HOME[role] ?? '/');
    return;
  }

  // Fallback: full interactive login.
  const { email, password } = DEMO_ACCOUNTS[role];
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), {
    timeout: LOGIN_TIMEOUT,
  });
}

/**
 * Click Sign Out and wait for the /login redirect.
 */
export async function logout(page: Page) {
  await page.getByRole('button', { name: /sign out/i }).click();
  await page.waitForURL('**/login', { timeout: LOGIN_TIMEOUT });
}
