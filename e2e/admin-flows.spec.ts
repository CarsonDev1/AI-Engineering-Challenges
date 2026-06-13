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

test('history lists versions, diffs against current, and rolls back forward-only', async ({ page, request }) => {
  await request.post('/api/reset-demo'); // fresh seeds
  await page.goto('/');

  // Save a v2: raise SafeGuard's auto-approval threshold 20000 -> 25000.
  await page
    .getByTestId('tenant-card')
    .filter({ hasText: 'SafeGuard Insurance' })
    .getByRole('link', { name: 'Edit' })
    .click();
  await expect(page.getByRole('button', { name: 'Save configuration' })).toBeVisible();
  const tenantId = page.url().split('/tenants/')[1].split('/')[0];

  await page.getByRole('tab', { name: 'Approval' }).click();
  await page.getByLabel('Auto-approval threshold').fill('25000');
  await page.getByPlaceholder('Version note (optional)').fill('raise auto-approval to 25k');
  await page.getByRole('button', { name: 'Save configuration' }).click();
  await expect(page.getByText('Saved as version 2')).toBeVisible();

  // History shows both versions; v2 is current.
  await page.goto(`/tenants/${tenantId}/history`);
  await expect(page.getByTestId('version-row')).toHaveCount(2);
  const v2Row = page.getByTestId('version-row').filter({ hasText: 'v2' });
  await expect(v2Row).toContainText('Current');
  await expect(v2Row).toContainText('raise auto-approval to 25k'); // the save note lands on the new version
  await expect(page.getByTestId('version-row').filter({ hasText: 'v1' })).toContainText('initial version');

  // Diff v1 vs current surfaces the threshold change.
  await page
    .getByTestId('version-row')
    .filter({ hasText: 'v1' })
    .getByRole('button', { name: 'Diff vs current' })
    .click();
  await expect(page.getByTestId('diff-table')).toBeVisible();
  await expect(page.getByText('approval.autoApprovalThreshold')).toBeVisible();
  await page.keyboard.press('Escape'); // close the drawer

  // Roll back to v1 -> creates v3 (note "rollback to v1"), now current; old rows intact.
  await page.getByTestId('version-row').filter({ hasText: 'v1' }).getByRole('button', { name: 'Roll back' }).click();
  await page.getByRole('button', { name: 'Yes, roll back' }).click();
  await expect(page.getByText(/Rolled back to v1/)).toBeVisible();
  await expect(page.getByTestId('version-row')).toHaveCount(3);
  const v3 = page.getByTestId('version-row').filter({ hasText: 'v3' });
  await expect(v3).toContainText('rollback to v1');
  await expect(v3).toContainText('Current');

  // The runtime now reflects the rolled-back threshold (20000): a 22000 claim that v2
  // (25000) auto-approved is MANUAL again under v3.
  const result = await (
    await request.post('/api/process-claim', {
      data: {
        tenantId,
        claim: { claimType: 'OUTPATIENT', amount: 22000, submittedAt: '2026-06-12', customFieldValues: { employeeId: 'E-1' } },
      },
    })
  ).json();
  expect(result.ok).toBe(true);
  expect(result.approval).toMatchObject({ route: 'MANUAL', role: 'assessor' });
});
