import { prisma } from './prisma';
import { Prisma } from '@/generated/prisma/client';
import type { TenantConfig } from '../config/schema';

// TenantConfig has optional fields, so it is not directly assignable to Prisma's
// InputJsonValue (which forbids `undefined`); the configs written here are always
// schema-validated objects, so the cast is safe.
const asJson = (config: TenantConfig) => config as unknown as Prisma.InputJsonValue;

export async function listTenants() {
  const tenants = await prisma.tenant.findMany({ orderBy: { createdAt: 'asc' } });
  return Promise.all(
    tenants.map(async (t) => ({ ...t, activeConfig: await getActiveConfig(t.id) })),
  );
}

export async function getActiveConfig(tenantId: string): Promise<TenantConfig | null> {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant?.activeVersionId) return null;
  const version = await prisma.tenantConfigVersion.findUnique({
    where: { id: tenant.activeVersionId },
  });
  return (version?.config as unknown as TenantConfig) ?? null;
}

// Every config write = a new immutable version row + a repointed active version.
// Forward-only: no row is ever updated in place. The transaction makes the
// version-number read and the active-pointer move atomic.
export async function createVersion(tenantId: string, config: TenantConfig, note?: string) {
  return prisma.$transaction(async (tx) => {
    const last = await tx.tenantConfigVersion.findFirst({
      where: { tenantId },
      orderBy: { versionNo: 'desc' },
    });
    const version = await tx.tenantConfigVersion.create({
      data: { tenantId, versionNo: (last?.versionNo ?? 0) + 1, config: asJson(config), note },
    });
    await tx.tenant.update({ where: { id: tenantId }, data: { activeVersionId: version.id } });
    return version;
  });
}

export async function createTenant(slug: string, name: string, config: TenantConfig) {
  const tenant = await prisma.tenant.create({ data: { slug, name } });
  await createVersion(tenant.id, config, 'initial version');
  return tenant;
}

// Rollback copies an old version's config forward as a NEW version — history is never
// rewritten or deleted (audit-safe). Runtime and preview always read the active version.
export async function rollbackToVersion(tenantId: string, versionId: string) {
  const old = await prisma.tenantConfigVersion.findUniqueOrThrow({ where: { id: versionId } });
  return createVersion(
    tenantId,
    old.config as unknown as TenantConfig,
    `rollback to v${old.versionNo}`,
  );
}

export async function listVersions(tenantId: string) {
  return prisma.tenantConfigVersion.findMany({
    where: { tenantId },
    orderBy: { versionNo: 'desc' },
  });
}
