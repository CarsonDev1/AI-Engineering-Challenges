import { test, expect, type Page } from '@playwright/test';
import { defaultTenantConfig } from '../src/lib/config/default-config';

// Full-feature diagnostic sweep (debugging the reported "save configuration fails").
// Every save captures the actual PUT response so a failure pinpoints status + body;
// uncaught page errors fail the test that produced them.

test.beforeAll(async ({ request }) => {
  await request.post('/api/reset-demo');
});

let pageErrors: string[] = [];
test.beforeEach(({ page }) => {
  pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
});
test.afterEach(() => {
  expect(pageErrors, 'uncaught page errors').toEqual([]);
});

async function openEditor(page: Page, name: string) {
  await page.goto('/');
  await page.getByTestId('tenant-card').filter({ hasText: name }).getByRole('link', { name: 'Edit' }).click();
  // The home page also has a heading with the tenant name (the card), so wait for an
  // editor-only element to prove the editor actually mounted before continuing.
  await expect(page.getByRole('button', { name: 'Save configuration' })).toBeVisible();
  await expect(page.getByRole('heading', { name })).toBeVisible();
}

// Clicks Save, captures the PUT, asserts 200 (failing with the response body if not),
// and waits for the version toast. Returns the new version number.
async function saveExpectOk(page: Page): Promise<number> {
  const [res] = await Promise.all([
    page.waitForResponse((r) => r.request().method() === 'PUT' && r.url().includes('/config')),
    page.getByRole('button', { name: 'Save configuration' }).click(),
  ]);
  expect(res.status(), `PUT /config body: ${await res.text()}`).toBe(200);
  const versionNo = (await res.json()).version.versionNo as number;
  await expect(page.getByText(`Saved as version ${versionNo}`)).toBeVisible();
  return versionNo;
}

// ── 1. The most direct repro: unchanged seed configs must round-trip ──────────────

for (const name of ['SafeGuard Insurance', 'HealthFirst', 'GovHealth']) {
  test(`unchanged ${name} config saves (round-trip)`, async ({ page }) => {
    await openEditor(page, name);
    expect(await saveExpectOk(page)).toBe(2);
  });
}

// ── 2. Branding edits persist across reload ───────────────────────────────────────

test('branding edit saves and persists across reload', async ({ page }) => {
  await openEditor(page, 'SafeGuard Insurance');
  await page.getByLabel('Company name').fill('SafeGuard Insurance Co.');
  await saveExpectOk(page);
  await page.reload();
  await expect(page.getByLabel('Company name')).toHaveValue('SafeGuard Insurance Co.');
});

// ── 3. Claim-type toggle keeps SLA in sync, both directions ───────────────────────

test('enabling a claim type seeds its SLA; disabling removes it', async ({ page }) => {
  await openEditor(page, 'SafeGuard Insurance');
  await page.getByRole('tab', { name: 'Claim Types & Documents' }).click();
  await page.getByRole('switch', { name: 'Enable MATERNITY' }).click();
  await page.getByRole('tab', { name: 'SLA' }).click();
  await expect(page.getByLabel('MATERNITY — business days to resolve')).toHaveValue('5');
  await saveExpectOk(page);

  await page.getByRole('tab', { name: 'Claim Types & Documents' }).click();
  await page.getByRole('switch', { name: 'Enable MATERNITY' }).click();
  await page.getByRole('tab', { name: 'SLA' }).click();
  await expect(page.getByLabel('MATERNITY — business days to resolve')).toHaveCount(0);
  await saveExpectOk(page);
});

// ── 4. Overlapping documents blocked inline, then fixed ───────────────────────────

test('overlapping required/optional documents blocked inline, fixable', async ({ page }) => {
  await openEditor(page, 'SafeGuard Insurance');
  await page.getByRole('tab', { name: 'Claim Types & Documents' }).click();
  await page.getByRole('button', { name: /OUTPATIENT/ }).click(); // expand panel

  const required = page.getByLabel('Required documents');
  await required.click();
  await page.keyboard.type('Prescription'); // already an optional document
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Save configuration' }).click();
  await expect(page.getByText('required and optional documents must not overlap')).toBeVisible();

  // antd v6 tags: Backspace no longer removes the last tag — click the tag's × icon.
  await page
    .locator('.field')
    .filter({ hasText: 'Required documents' })
    .locator('.ant-select-selection-item[title="Prescription"] .ant-select-selection-item-remove')
    .click();
  await expect(page.getByText('required and optional documents must not overlap')).toHaveCount(0);
  await saveExpectOk(page);
});

// ── 5. Approval tiers: add row, live ascending validation ─────────────────────────

test('tier can be added; ascending order validates live', async ({ page }) => {
  await openEditor(page, 'HealthFirst');
  await page.getByRole('tab', { name: 'Approval' }).click();
  await page.getByRole('button', { name: 'Add tier' }).click();
  await page.getByLabel('Tier 2 approver role').fill('senior_manager');
  await saveExpectOk(page);

  await page.getByLabel('Tier 2 upper bound').fill('40000'); // below tier 1's 50000
  await expect(page.getByText('Tier bounds must be strictly ascending.')).toBeVisible();
  await page.getByLabel('Tier 2 upper bound').fill('100000');
  await expect(page.getByText('Tier bounds must be strictly ascending.')).toHaveCount(0);
});

// ── 6. SLA: clearing an enabled type's days is blocked, restoring saves ───────────

test('clearing an enabled type SLA is blocked; restoring saves', async ({ page }) => {
  await openEditor(page, 'GovHealth');
  await page.getByRole('tab', { name: 'SLA' }).click();
  await page.getByLabel('OUTPATIENT — business days to resolve').fill('');
  await page.getByRole('button', { name: 'Save configuration' }).click();
  await expect(page.getByText('every enabled claim type needs an SLA')).toBeVisible();

  await page.getByLabel('OUTPATIENT — business days to resolve').fill('15');
  await expect(page.getByText('every enabled claim type needs an SLA')).toHaveCount(0);
  await saveExpectOk(page);
});

// ── 7. Custom fields: duplicate key + select-without-options blocked ──────────────

test('custom field rules: duplicate key, select needs options, valid select saves', async ({ page }) => {
  await openEditor(page, 'GovHealth');
  await page.getByRole('tab', { name: 'Custom Fields' }).click();
  await page.getByRole('button', { name: 'Add custom field' }).click();
  await page.getByLabel('Field 3 key').fill('department'); // duplicate of seed field
  await page.getByLabel('Field 3 label').fill('Region');
  await page.getByRole('button', { name: 'Save configuration' }).click();
  await expect(page.getByText('custom field keys must be unique')).toBeVisible();

  await page.getByLabel('Field 3 key').fill('region');
  await expect(page.getByText('custom field keys must be unique')).toHaveCount(0);
  await page.getByLabel('Field 3 type').click();
  // antd v6 dropdown items don't carry role="option" — target the visible item itself.
  await page.locator('.ant-select-dropdown .ant-select-item-option[title="select"]').click();
  await expect(page.getByText('select fields need at least one option')).toBeVisible();

  await page.getByLabel('Field 3 options').click();
  await page.keyboard.type('north');
  await page.keyboard.press('Enter');
  await page.keyboard.type('south');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  await expect(page.getByText('select fields need at least one option')).toHaveCount(0);
  await saveExpectOk(page);
});

// ── 8. Notifications: enabling an event demands a channel ─────────────────────────

test('enabling a notification event without channels is blocked until one is chosen', async ({ page, request }) => {
  const slug = `sweep-${Date.now()}`;
  await request.post('/api/tenants', {
    data: { slug, name: 'Sweep Insurer', config: defaultTenantConfig('Sweep Insurer') },
  });
  const tenants = (await (await request.get('/api/tenants')).json()) as Array<{ id: string; slug: string }>;
  const created = tenants.find((t) => t.slug === slug)!;

  await page.goto(`/tenants/${created.id}`);
  await expect(page.getByRole('heading', { name: 'Sweep Insurer' })).toBeVisible();
  await page.getByRole('tab', { name: 'Notifications' }).click();
  await page.getByRole('switch', { name: 'Enable approved' }).click();
  await page.getByRole('button', { name: 'Save configuration' }).click();
  await expect(page.getByText('enabled events need at least one channel')).toBeVisible();

  const approvedRow = page.locator('.notif-row').filter({ has: page.getByText('approved', { exact: true }) });
  await approvedRow.getByRole('checkbox', { name: 'email' }).check();
  await expect(page.getByText('enabled events need at least one channel')).toHaveCount(0);
  await saveExpectOk(page);

  await request.delete(`/api/tenants/${created.id}`);
});

// ── 9. Editor not-found state ──────────────────────────────────────────────────────

test('editor shows a not-found state for a deleted/unknown tenant id', async ({ page }) => {
  await page.goto('/tenants/does-not-exist');
  await expect(page.getByText('Tenant not found')).toBeVisible();
});

// ── 10. REPRO: stale editor after a demo reset (ids change underneath) ────────────

test('REPRO: saving from an editor opened before a demo reset fails gracefully (stale id → 404)', async ({ page, request }) => {
  await openEditor(page, 'SafeGuard Insurance');
  await request.post('/api/reset-demo'); // recreates seeds with NEW ids

  const [res] = await Promise.all([
    page.waitForResponse((r) => r.request().method() === 'PUT' && r.url().includes('/config')),
    page.getByRole('button', { name: 'Save configuration' }).click(),
  ]);
  expect(res.status()).toBe(404);
  // The dead-end is handled: an actionable message + redirect to the fresh tenant list,
  // not a cryptic "Save failed." with the user stuck on a stale page.
  await expect(page.getByText(/no longer exists/)).toBeVisible();
  await expect(page).toHaveURL('/');
});

test('REPRO: rolling back from a history page gone stale (after reset) fails gracefully', async ({ page, request }) => {
  // Give SafeGuard a 2nd version so the v1 row shows a Roll back button.
  await request.post('/api/reset-demo');
  const tenants = (await (await request.get('/api/tenants')).json()) as Array<{ id: string; slug: string }>;
  const safeguard = tenants.find((t) => t.slug === 'safeguard')!;
  const versions = (await (await request.get(`/api/tenants/${safeguard.id}/versions`)).json()) as Array<{ id: string }>;
  await request.post(`/api/tenants/${safeguard.id}/rollback`, { data: { versionId: versions[0].id } });

  await page.goto(`/tenants/${safeguard.id}/history`);
  await expect(page.getByTestId('version-row')).toHaveCount(2);

  await request.post('/api/reset-demo'); // the open page's tenant id is now stale

  // Exactly one Roll back button (on the non-current v1 row).
  await page.getByRole('button', { name: 'Roll back' }).click();
  await page.getByRole('button', { name: 'Yes, roll back' }).click();
  await expect(page.getByText(/no longer exists/)).toBeVisible();
  await expect(page).toHaveURL('/');
});

// ── 10b. REPRO: demo page processing after a reset must not crash ─────────────────

test('REPRO: demo processing with stale seed ids recovers, never crashes the panel', async ({ page, request }) => {
  await request.post('/api/reset-demo');
  await page.goto('/demo');
  // Wait until the page has loaded its tenants (the button only renders then), so the
  // reset below genuinely makes the already-loaded ids stale.
  await expect(page.getByRole('button', { name: 'Process for all three' })).toBeVisible();

  await request.post('/api/reset-demo'); // the page's seed ids are now stale → process-claim 404s

  await page.getByRole('button', { name: 'Process for all three' }).click();
  // The 404 bodies must not reach ProcessResultPanel (that crashed on result.errors.map);
  // the page recovers with a message and stays alive.
  await expect(page.getByText(/demo tenants changed/i)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'One claim, three fates' })).toBeVisible();
  await expect(page.getByTestId('process-result')).toHaveCount(0);
});

// ── 11. Runtime engine still reproduces the worked example after all edits ────────

test('worked example intact: SafeGuard auto-approves 12k OUTPATIENT, SLA 2026-06-19', async ({ request }) => {
  await request.post('/api/reset-demo');
  const tenants = (await (await request.get('/api/tenants')).json()) as Array<{ id: string; slug: string }>;
  const safeguard = tenants.find((t) => t.slug === 'safeguard')!;
  const result = await (
    await request.post('/api/process-claim', {
      data: {
        tenantId: safeguard.id,
        claim: { claimType: 'OUTPATIENT', amount: 12000, submittedAt: '2026-06-12', customFieldValues: { employeeId: 'E-1' } },
      },
    })
  ).json();
  expect(result.ok).toBe(true);
  expect(result.approval).toEqual({ route: 'AUTO_APPROVED' });
  expect(result.slaDeadline).toBe('2026-06-19');
});
