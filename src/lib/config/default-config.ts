import type { TenantConfig } from './schema';

// The minimal valid config a freshly-created tenant starts from (the Create modal posts
// this; everything else is tuned later in the editor). Must satisfy tenantConfigSchema.
export function defaultTenantConfig(companyName: string): TenantConfig {
  const label = companyName.trim() || 'New Tenant';
  return {
    branding: {
      companyName: label,
      logoUrl: `https://placehold.co/200x60/475569/ffffff?text=${encodeURIComponent(label)}`,
      primaryColor: '#475569',
      secondaryColor: '#e2e8f0',
      currency: 'USD',
    },
    claimTypes: {
      OUTPATIENT: { enabled: true, requiredDocuments: ['Medical receipt'], optionalDocuments: [] },
    },
    approval: { autoApprovalThreshold: 0, tiers: [{ upTo: null, role: 'assessor' }] },
    notifications: { claim_submitted: { enabled: true, channels: ['email'] } },
    sla: { businessDaysByClaimType: { OUTPATIENT: 5 }, escalation: { notifyRole: 'operations_manager' } },
    customFields: [],
  };
}
