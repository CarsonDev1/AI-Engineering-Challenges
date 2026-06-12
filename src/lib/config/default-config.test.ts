import { describe, it, expect } from 'vitest';
import { defaultTenantConfig } from './default-config';
import { tenantConfigSchema } from './schema';

describe('defaultTenantConfig', () => {
  it('produces a config that passes the shared schema (so create never 400s on the default)', () =>
    expect(tenantConfigSchema.safeParse(defaultTenantConfig('Aurora Health')).success).toBe(true));

  it('falls back to a placeholder name when given blank input', () =>
    expect(defaultTenantConfig('   ').branding.companyName).toBe('New Tenant'));
});
