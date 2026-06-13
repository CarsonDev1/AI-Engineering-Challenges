import { defineConfig, devices } from '@playwright/test';

// E2E against the real Next dev server + Neon. Serial (workers: 1) because specs share
// one database; Playwright boots `npm run dev` and tears it down automatically.
// Port defaults to 3000 but is overridable via E2E_PORT so the suite can run on a dev box
// where 3000 is already taken by another project (set E2E_PORT=3100 npm run test:e2e).
const PORT = process.env.E2E_PORT ?? '3000';
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run dev -- -p ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
