import { test, expect } from '@playwright/test';

// Seed the three sample tenants before the suite. Accessible-name / role / test-id
// selectors only — AntD class names are unstable.
test.beforeAll(async ({ request }) => {
  await request.post('/api/reset-demo');
});

const SEED_SLUGS = ['safeguard', 'healthfirst', 'govhealth'];

// The database may legitimately hold tenants beyond the three seeds (a reset must
// preserve them), so counts are asserted relative to the API, never as absolutes.
test('home lists the three seeded tenants', async ({ page, request }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Tenant Configurations' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'SafeGuard Insurance' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'HealthFirst' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'GovHealth' })).toBeVisible();
  const tenants = (await (await request.get('/api/tenants')).json()) as unknown[];
  await expect(page.getByTestId('tenant-card')).toHaveCount(tenants.length);
});

test('reset demo restores the three samples and preserves other tenants', async ({ page, request }) => {
  const before = (await (await request.get('/api/tenants')).json()) as Array<{ slug: string }>;
  const extras = before.filter((t) => !SEED_SLUGS.includes(t.slug));

  await page.goto('/');
  await page.getByRole('button', { name: 'Reset demo data' }).click();
  await page.getByRole('button', { name: 'Reset', exact: true }).click(); // confirm dialog
  await expect(page.getByText('Demo data reset')).toBeVisible();

  const after = (await (await request.get('/api/tenants')).json()) as Array<{ slug: string }>;
  for (const slug of SEED_SLUGS) expect(after.filter((t) => t.slug === slug)).toHaveLength(1);
  expect(after).toHaveLength(extras.length + SEED_SLUGS.length);
  await expect(page.getByTestId('tenant-card')).toHaveCount(after.length);
});

test('editor saves a new config version with a note', async ({ page }) => {
  await page.goto('/');
  await page
    .getByTestId('tenant-card')
    .filter({ hasText: 'SafeGuard Insurance' })
    .getByRole('link', { name: 'Edit' })
    .click();
  await expect(page.getByRole('heading', { name: 'SafeGuard Insurance' })).toBeVisible();

  await page.getByRole('tab', { name: 'Approval' }).click();
  await page.getByLabel('Auto-approval threshold').fill('25000');
  await page.getByPlaceholder('Version note (optional)').fill('raise auto-approval to 25k');
  await page.getByRole('button', { name: 'Save configuration' }).click();

  await expect(page.getByText('Saved as version 2')).toBeVisible();
});

test('invalid config is blocked inline by client validation', async ({ page, request }) => {
  await page.goto('/');
  await page
    .getByTestId('tenant-card')
    .filter({ hasText: 'HealthFirst' })
    .getByRole('link', { name: 'Edit' })
    .click();
  await expect(page.getByRole('heading', { name: 'HealthFirst' })).toBeVisible();

  await page.getByLabel('Company name').fill('');
  await page.getByRole('button', { name: 'Save configuration' }).click();

  await expect(page.getByText('Fix the highlighted fields before saving.')).toBeVisible();
  await expect(page.getByTestId('field-error').first()).toBeVisible();

  // The save never reached the server — HealthFirst still has only its seed version.
  const tenants = (await (await request.get('/api/tenants')).json()) as Array<{ id: string; slug: string }>;
  const healthfirst = tenants.find((t) => t.slug === 'healthfirst')!;
  const versions = (await (await request.get(`/api/tenants/${healthfirst.id}/versions`)).json()) as unknown[];
  expect(versions).toHaveLength(1);
});

test('onboard a 4th tenant through the modal, zero code', async ({ page, request }) => {
  const before = (await (await request.get('/api/tenants')).json()) as unknown[];
  await page.goto('/');
  const slug = `e2e-${Date.now()}`;

  await page.getByRole('button', { name: 'New tenant' }).click();
  await page.getByLabel('Company name').fill('E2E Test Insurer');
  await page.getByLabel('Slug').fill(slug);
  await page.getByRole('button', { name: 'Create tenant' }).click();

  await expect(page.getByRole('heading', { name: 'E2E Test Insurer' })).toBeVisible();
  await expect(page.getByTestId('tenant-card')).toHaveCount(before.length + 1);

  // Clean up so the database returns to the three samples.
  const list = (await (await request.get('/api/tenants')).json()) as Array<{ id: string; slug: string }>;
  const created = list.find((t) => t.slug === slug);
  if (created) await request.delete(`/api/tenants/${created.id}`);
});

test('preview runs the worked example through the runtime endpoint, in tenant branding', async ({ page, request }) => {
  await request.post('/api/reset-demo'); // fresh seeds → order-independent ids
  await page.goto('/');
  await page
    .getByTestId('tenant-card')
    .filter({ hasText: 'SafeGuard Insurance' })
    .getByRole('link', { name: 'Preview' })
    .click();
  await expect(page.getByRole('heading', { name: 'SafeGuard Insurance' })).toBeVisible();
  await expect(page.getByTestId('brand-frame')).toBeVisible();

  // The form offers only SafeGuard's enabled types (OUTPATIENT/INPATIENT/DENTAL) — not MATERNITY/OPTICAL.
  // antd v6 dropdown items are not role="option"; target the visible item by its title.
  await page.getByLabel('Claim type').click();
  await expect(page.locator('.ant-select-item-option[title="OUTPATIENT"]')).toBeVisible();
  await expect(page.locator('.ant-select-item-option[title="MATERNITY"]')).toHaveCount(0);
  await page.locator('.ant-select-item-option[title="OUTPATIENT"]').click();

  await page.getByLabel('Claim amount').fill('12000');
  await page.getByLabel('Submission date').fill('2026-06-12');
  await page.getByLabel('Employee ID').fill('E-1');

  const [res] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/process-claim') && r.request().method() === 'POST'),
    page.getByRole('button', { name: 'Process claim' }).click(),
  ]);
  expect(res.status()).toBe(200);

  // 12000 < 20000 threshold → auto-approved; +5 business days from Fri 2026-06-12 → Fri 2026-06-19.
  await expect(page.getByTestId('approval-route')).toHaveText(/Auto-approved/);
  await expect(page.getByTestId('sla-deadline')).toHaveText('2026-06-19');
  await expect(page.getByText('Medical receipt')).toBeVisible(); // a required document
});

test('preview shows a structured error for a missing required custom field (no crash)', async ({ page }) => {
  await page.goto('/');
  await page
    .getByTestId('tenant-card')
    .filter({ hasText: 'SafeGuard Insurance' })
    .getByRole('link', { name: 'Preview' })
    .click();
  await expect(page.getByRole('heading', { name: 'SafeGuard Insurance' })).toBeVisible();

  // Leave Employee ID blank; type/amount/date default to a valid OUTPATIENT claim.
  await page.getByLabel('Claim amount').fill('12000');
  await page.getByLabel('Submission date').fill('2026-06-12');
  await page.getByRole('button', { name: 'Process claim' }).click();

  await expect(page.getByTestId('process-result')).toBeVisible();
  await expect(page.getByText('Missing required field: Employee ID')).toBeVisible();
});
