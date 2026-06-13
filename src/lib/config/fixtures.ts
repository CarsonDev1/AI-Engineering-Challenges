import type { TenantConfig } from './schema';

// Canonical minimal valid tenant config shared by the schema and engine test suites.
export const validConfig: TenantConfig = {
  branding: { companyName: 'SafeGuard Insurance', logoUrl: 'https://example.com/logo.png', primaryColor: '#1677ff', secondaryColor: '#f0f5ff', currency: 'USD' },
  claimTypes: { OUTPATIENT: { enabled: true, requiredDocuments: ['Medical receipt'], optionalDocuments: ['Prescription'] } },
  approval: { autoApprovalThreshold: 20000, tiers: [{ upTo: 100000, role: 'assessor' }, { upTo: null, role: 'director' }] },
  notifications: { claim_submitted: { enabled: true, channels: ['email'] } },
  sla: { businessDaysByClaimType: { OUTPATIENT: 5 }, escalation: { notifyRole: 'operations_manager' } },
  customFields: [{ key: 'employeeId', label: 'Employee ID', type: 'text', required: true }],
};
