import { describe, it, expect } from 'vitest';
import { tenantConfigSchema } from './schema';
import { validConfig } from './fixtures';

const invalid = (patch: object) => tenantConfigSchema.safeParse({ ...structuredClone(validConfig), ...patch });

const firstIssue = (patch: object) => {
  const r = invalid(patch);
  return r.success ? undefined : r.error.issues[0];
};

describe('tenantConfigSchema', () => {
  it('accepts a valid config', () => expect(tenantConfigSchema.safeParse(validConfig).success).toBe(true));

  it('rejects when no claim type is enabled', () =>
    expect(firstIssue({ claimTypes: { OUTPATIENT: { enabled: false, requiredDocuments: [], optionalDocuments: [] } } }))
      .toMatchObject({ path: ['claimTypes'] }));

  it('rejects negative threshold', () =>
    expect(firstIssue({ approval: { autoApprovalThreshold: -1, tiers: validConfig.approval.tiers } }))
      .toMatchObject({ path: ['approval', 'autoApprovalThreshold'] }));

  it('rejects non-ascending tiers', () =>
    expect(firstIssue({ approval: { autoApprovalThreshold: 0, tiers: [{ upTo: 500000, role: 'a' }, { upTo: 100000, role: 'b' }, { upTo: null, role: 'c' }] } }))
      .toMatchObject({ path: ['approval', 'tiers'] }));

  it('rejects when last tier is not unbounded', () =>
    expect(firstIssue({ approval: { autoApprovalThreshold: 0, tiers: [{ upTo: 100000, role: 'a' }] } }))
      .toMatchObject({ path: ['approval', 'tiers'] }));

  it('rejects SLA for a disabled claim type', () =>
    expect(firstIssue({ sla: { businessDaysByClaimType: { DENTAL: 5 }, escalation: { notifyRole: 'x' } } }))
      .toMatchObject({ path: ['sla', 'businessDaysByClaimType'], message: expect.stringContaining('SLA may only be configured') }));

  it('rejects enabled claim type without SLA', () =>
    expect(firstIssue({ sla: { businessDaysByClaimType: {}, escalation: { notifyRole: 'x' } } }))
      .toMatchObject({ path: ['sla', 'businessDaysByClaimType'], message: expect.stringContaining('needs an SLA') }));

  it('rejects overlapping required/optional documents', () =>
    expect(firstIssue({ claimTypes: { OUTPATIENT: { enabled: true, requiredDocuments: ['Receipt'], optionalDocuments: ['Receipt'] } } }))
      .toMatchObject({ path: ['claimTypes', 'OUTPATIENT'] }));

  it('rejects enabled notification with zero channels', () =>
    expect(firstIssue({ notifications: { approved: { enabled: true, channels: [] } } }))
      .toMatchObject({ path: ['notifications', 'approved'] }));

  it('rejects bad hex color', () =>
    expect(firstIssue({ branding: { ...validConfig.branding, primaryColor: 'blue' } }))
      .toMatchObject({ path: ['branding', 'primaryColor'] }));

  it('rejects duplicate custom field keys', () =>
    expect(firstIssue({ customFields: [{ key: 'a', label: 'A', type: 'text', required: true }, { key: 'a', label: 'B', type: 'text', required: false }] }))
      .toMatchObject({ path: ['customFields'] }));

  it('rejects select field without options', () =>
    expect(firstIssue({ customFields: [{ key: 'dept', label: 'Dept', type: 'select', required: true }] }))
      .toMatchObject({ path: ['customFields', 0] }));

  it('rejects a threshold that makes the first tier unreachable (dead tier)', () =>
    expect(firstIssue({ approval: { autoApprovalThreshold: 100000, tiers: [{ upTo: 100000, role: 'a' }, { upTo: null, role: 'b' }] } }))
      .toMatchObject({ path: ['approval', 'autoApprovalThreshold'] }));
});
