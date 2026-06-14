import { defineConfig, devices } from '@playwright/test';

// E2E against the real Next dev server + Neon. Serial (workers: 1) because specs share
// one database; Playwright boots `npm run dev` and tears it down automatically.
// Port defaults to 3000 but is overridable via E2E_PORT so the suite can run on a dev box
// where 3000 is already taken by another project (set E2E_PORT=3100 npm run test:e2e).
// E2E_BASE_URL points the suite at an already-running deployment (e.g. the Vercel URL) for
// a live smoke test — when set, we target it and skip booting a local dev server.
const LIVE_URL = process.env.E2E_BASE_URL;
const PORT = process.env.E2E_PORT ?? '3000';
const baseURL = LIVE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  // Generous timeouts: every spec drives the real Neon DB over cross-region WS round-trips
  // (reset-demo alone is ~12 queries), so latency spikes — not logic — are the failure risk.
  timeout: 120_000,
  expect: { timeout: 30_000 },
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // No local server when smoke-testing a live deployment.
  webServer: LIVE_URL
    ? undefined
    : {
        command: `npm run dev -- -p ${PORT}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
