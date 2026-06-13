import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  globalSetup: './playwright/global-setup.ts',
  fullyParallel: true,         // run test files in parallel
  workers: 2,                  // 2 workers — balances speed vs Next.js dev-server compile pressure
  retries: 1,
  timeout: 120_000,            // 2 min per test — Supabase free-tier auth is slow
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // mobile disabled — run manually with: npx playwright test --project=mobile
  ],
});
