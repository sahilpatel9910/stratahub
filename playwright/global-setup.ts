import { chromium } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Playwright global setup — runs once before the entire test suite.
 *
 * Logs in as each role via the real Supabase auth flow and saves the browser
 * storage state (cookies) to .auth/<role>.json.  Individual tests then call
 * loginAs() which injects those cookies instead of doing a fresh Supabase
 * round-trip, eliminating 50+ redundant login cycles and preventing timeouts.
 */

const BASE_URL = 'http://localhost:3000';

const ACCOUNTS = {
  superAdmin: { email: 'admin@stratahub.com.au', password: 'Admin1234!' },
  manager:    { email: 'manager@demo.com',        password: 'Demo1234!' },
  reception:  { email: 'reception@demo.com',      password: 'Demo1234!' },
  owner1:     { email: 'owner1@demo.com',         password: 'Demo1234!' },
  tenant1:    { email: 'tenant1@demo.com',        password: 'Demo1234!' },
} as const;

export default async function globalSetup() {
  const authDir = path.join(process.cwd(), '.auth');
  fs.mkdirSync(authDir, { recursive: true });

  const browser = await chromium.launch();

  for (const [role, { email, password }] of Object.entries(ACCOUNTS)) {
    const context = await browser.newContext({ baseURL: BASE_URL });
    const page = await context.newPage();

    await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: /sign in/i }).click();

    // Wait until auth redirect chain completes (Supabase free tier can be slow)
    await page.waitForURL(
      (url) => !url.pathname.includes('/login'),
      { timeout: 60_000 },
    );

    await context.storageState({ path: path.join(authDir, `${role}.json`) });
    await context.close();

    console.log(`  ✓ auth cached: ${role} (${email})`);
  }

  await browser.close();
}
