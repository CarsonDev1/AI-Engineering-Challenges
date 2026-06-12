import { describe, it, expect } from 'vitest';
import { SEED_TENANTS } from './seed-tenants';
import { tenantConfigSchema } from './schema';
import { processClaim } from '../engine/process-claim';

const base = { claimType: 'OUTPATIENT' as const, amount: 12000, submittedAt: '2026-06-12' };
const bySlug = (slug: string) => SEED_TENANTS.find((t) => t.slug === slug)!.config;

describe('seed tenants', () => {
  it('seeds exactly the three sample tenants', () =>
    expect(SEED_TENANTS.map((t) => t.slug)).toEqual(['safeguard', 'healthfirst', 'govhealth']));

  it('all seed configs are schema-valid', () =>
    SEED_TENANTS.forEach((t) =>
      expect(tenantConfigSchema.safeParse(t.config).success).toBe(true)));

  it('one claim, three fates — spec §5 worked example', () => {
    const safeguard = processClaim(bySlug('safeguard'), {
      ...base,
      customFieldValues: { employeeId: 'E-1' },
    });
    expect(safeguard.ok && safeguard.approval).toEqual({ route: 'AUTO_APPROVED' });
    expect(safeguard.ok && safeguard.slaDeadline).toBe('2026-06-19');

    const healthfirst = processClaim(bySlug('healthfirst'), { ...base, customFieldValues: {} });
    expect(healthfirst.ok && healthfirst.approval).toMatchObject({ route: 'MANUAL', role: 'assessor' });
    expect(healthfirst.ok && healthfirst.slaDeadline).toBe('2026-06-23');

    const govhealth = processClaim(bySlug('govhealth'), {
      ...base,
      customFieldValues: { department: 'Health', budgetCode: 'BG-7' },
    });
    expect(govhealth.ok && govhealth.approval).toMatchObject({ route: 'MANUAL', role: 'committee' });
    expect(govhealth.ok && govhealth.slaDeadline).toBe('2026-07-03');

    const govMissing = processClaim(bySlug('govhealth'), { ...base, customFieldValues: {} });
    expect(!govMissing.ok && govMissing.errors.map((e) => e.field).sort()).toEqual([
      'budgetCode',
      'department',
    ]);
  });
});
