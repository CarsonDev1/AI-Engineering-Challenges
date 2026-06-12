import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from './prisma';
import {
  createTenant,
  createVersion,
  getActiveConfig,
  rollbackToVersion,
  listVersions,
} from './tenant-repo';
import { SEED_TENANTS } from '../config/seed-tenants';
import type { TenantConfig } from '../config/schema';

// Integration test: exercises the repository against the real Neon database, then
// removes its scratch tenant. Excluded from `npm run test`; run via
// `npm run test:integration`.
const SLUG = '__itest_tenant';
const baseConfig = SEED_TENANTS[0].config; // SafeGuard — threshold 20000

const cleanup = () => prisma.tenant.deleteMany({ where: { slug: SLUG } });

describe('tenant-repo (integration — hits Neon)', () => {
  beforeAll(cleanup);
  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it('forward-only versioning: save increments, rollback creates a new version, history is immutable', async () => {
    // createTenant seeds version 1 and points active at it
    const tenant = await createTenant(SLUG, 'Integration Test Tenant', baseConfig);
    expect((await listVersions(tenant.id)).map((v) => v.versionNo)).toEqual([1]);
    expect((await getActiveConfig(tenant.id))?.approval.autoApprovalThreshold).toBe(
      baseConfig.approval.autoApprovalThreshold,
    );

    // a save creates version 2 and repoints active
    const cfgV2 = structuredClone(baseConfig);
    cfgV2.approval.autoApprovalThreshold = 99999;
    await createVersion(tenant.id, cfgV2, 'bump threshold');
    expect((await getActiveConfig(tenant.id))?.approval.autoApprovalThreshold).toBe(99999);

    // rollback to v1 creates version 3 (a copy of v1) and points active at it
    const v1 = (await listVersions(tenant.id)).find((v) => v.versionNo === 1)!;
    const rolled = await rollbackToVersion(tenant.id, v1.id);
    expect(rolled.versionNo).toBe(3);
    expect(rolled.note).toBe('rollback to v1');

    const versions = await listVersions(tenant.id);
    expect(versions.map((v) => v.versionNo)).toEqual([3, 2, 1]); // newest first
    expect((await getActiveConfig(tenant.id))?.approval.autoApprovalThreshold).toBe(
      baseConfig.approval.autoApprovalThreshold,
    );

    // old rows are never mutated by later saves or by rollback
    const byNo = Object.fromEntries(
      versions.map((v) => [v.versionNo, v.config as unknown as TenantConfig]),
    );
    expect(byNo[1].approval.autoApprovalThreshold).toBe(baseConfig.approval.autoApprovalThreshold);
    expect(byNo[2].approval.autoApprovalThreshold).toBe(99999);
    expect(byNo[3].approval.autoApprovalThreshold).toBe(baseConfig.approval.autoApprovalThreshold);
  });
});
