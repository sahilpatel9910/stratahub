import { Page } from '@playwright/test';

// Supabase free tier can be slow — allow up to 45s for sign-in + redirect chain.
const LOGIN_TIMEOUT = 45_000;

export const DEMO_ACCOUNTS = {
  superAdmin: { email: 'admin@stratahub.com.au', password: 'Admin1234!' },
  manager:    { email: 'manager@demo.com',        password: 'Demo1234!' },
  reception:  { email: 'reception@demo.com',      password: 'Demo1234!' },
  owner1:     { email: 'owner1@demo.com',         password: 'Demo1234!' },
  tenant1:    { email: 'tenant1@demo.com',        password: 'Demo1234!' },
};

/**
 * Log in as a named role and wait until the browser has left /login.
 * Uses a long timeout because Supabase free-tier auth + DB role lookup is slow.
 */
export async function loginAs(page: Page, role: keyof typeof DEMO_ACCOUNTS) {
  const { email, password } = DEMO_ACCOUNTS[role];
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  // Wait for the browser to leave /login (auth redirect chain completes).
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
