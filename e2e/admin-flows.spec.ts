import { test, expect } from '@playwright/test';

// Seed the three sample tenants before the suite. Accessible-name / role / test-id
// selectors only — AntD class names are unstable.
test.beforeAll(async ({ request }) => {
  await request.post('/api/reset-demo');
});

test('home lists the three seeded tenants', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Tenant Configurations' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'SafeGuard Insurance' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'HealthFirst' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'GovHealth' })).toBeVisible();
  await expect(page.getByTestId('tenant-card')).toHaveCount(3);
});

test('reset demo restores exactly the three samples', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Reset demo data' }).click();
  await page.getByRole('button', { name: 'Reset', exact: true }).click(); // confirm dialog
  await expect(page.getByText('Demo data reset')).toBeVisible();
  await expect(page.getByTestId('tenant-card')).toHaveCount(3);
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
  await page.goto('/');
  const slug = `e2e-${Date.now()}`;

  await page.getByRole('button', { name: 'New tenant' }).click();
  await page.getByLabel('Company name').fill('E2E Test Insurer');
  await page.getByLabel('Slug').fill(slug);
  await page.getByRole('button', { name: 'Create tenant' }).click();

  await expect(page.getByRole('heading', { name: 'E2E Test Insurer' })).toBeVisible();
  await expect(page.getByTestId('tenant-card')).toHaveCount(4);

  // Clean up so the database returns to the three samples.
  const list = (await (await request.get('/api/tenants')).json()) as Array<{ id: string; slug: string }>;
  const created = list.find((t) => t.slug === slug);
  if (created) await request.delete(`/api/tenants/${created.id}`);
});
