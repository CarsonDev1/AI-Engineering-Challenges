import type { TenantConfig } from './schema';

// Canonical sample tenants from the challenge brief (spec §11). Pure data — no IO.
// This same array powers the initial deployment seed and the POST /api/reset-demo
// re-seed, so the engine is fully data-driven and onboarding a 4th tenant needs no
// code change. All four lifecycle notification events are enabled for every tenant;
// the tenants differ only in their channels, matching the brief's "email only" /
// "email + SMS" / "email + webhook" descriptions.

export type SeedTenant = { slug: string; name: string; config: TenantConfig };

const safeguard: TenantConfig = {
  branding: {
    companyName: 'SafeGuard Insurance',
    logoUrl: 'https://placehold.co/200x60/1d4ed8/ffffff?text=SafeGuard',
    primaryColor: '#1d4ed8',
    secondaryColor: '#dbeafe',
    currency: 'USD',
  },
  claimTypes: {
    OUTPATIENT: { enabled: true, requiredDocuments: ['Medical receipt'], optionalDocuments: ['Prescription'] },
    INPATIENT: {
      enabled: true,
      requiredDocuments: ['Discharge summary', 'Itemized bill', 'Medical receipt'],
      optionalDocuments: [],
    },
    DENTAL: { enabled: true, requiredDocuments: ['Dental receipt'], optionalDocuments: ['Treatment plan'] },
  },
  approval: {
    autoApprovalThreshold: 20000,
    tiers: [
      { upTo: 100000, role: 'assessor' },
      { upTo: 500000, role: 'team_lead' },
      { upTo: null, role: 'director' },
    ],
  },
  notifications: {
    claim_submitted: { enabled: true, channels: ['email'] },
    approved: { enabled: true, channels: ['email'] },
    rejected: { enabled: true, channels: ['email'] },
    payment_sent: { enabled: true, channels: ['email'] },
  },
  sla: {
    businessDaysByClaimType: { OUTPATIENT: 5, INPATIENT: 10, DENTAL: 5 },
    escalation: { notifyRole: 'operations_manager' },
  },
  customFields: [{ key: 'employeeId', label: 'Employee ID', type: 'text', required: true }],
};

const healthfirst: TenantConfig = {
  branding: {
    companyName: 'HealthFirst',
    logoUrl: 'https://placehold.co/200x60/059669/ffffff?text=HealthFirst',
    primaryColor: '#059669',
    secondaryColor: '#d1fae5',
    currency: 'USD',
  },
  claimTypes: {
    OUTPATIENT: { enabled: true, requiredDocuments: ['Medical receipt'], optionalDocuments: ['Prescription'] },
    INPATIENT: { enabled: true, requiredDocuments: ['Discharge summary', 'Medical receipt'], optionalDocuments: [] },
    DENTAL: { enabled: true, requiredDocuments: ['Dental receipt'], optionalDocuments: ['Treatment plan'] },
    MATERNITY: { enabled: true, requiredDocuments: ['Medical receipt', 'Delivery summary'], optionalDocuments: [] },
    OPTICAL: { enabled: true, requiredDocuments: ['Optical receipt', 'Prescription'], optionalDocuments: [] },
  },
  approval: {
    autoApprovalThreshold: 5000,
    tiers: [
      { upTo: 50000, role: 'assessor' },
      { upTo: null, role: 'manager' },
    ],
  },
  notifications: {
    claim_submitted: { enabled: true, channels: ['email', 'sms'] },
    approved: { enabled: true, channels: ['email', 'sms'] },
    rejected: { enabled: true, channels: ['email', 'sms'] },
    payment_sent: { enabled: true, channels: ['email', 'sms'] },
  },
  sla: {
    businessDaysByClaimType: { OUTPATIENT: 7, INPATIENT: 7, DENTAL: 7, MATERNITY: 7, OPTICAL: 7 },
    escalation: { notifyRole: 'support_lead' },
  },
  customFields: [],
};

const govhealth: TenantConfig = {
  branding: {
    companyName: 'GovHealth',
    logoUrl: 'https://placehold.co/200x60/7e22ce/ffffff?text=GovHealth',
    primaryColor: '#7e22ce',
    secondaryColor: '#f3e8ff',
    currency: 'USD',
  },
  claimTypes: {
    OUTPATIENT: { enabled: true, requiredDocuments: ['Medical receipt', 'Referral letter'], optionalDocuments: [] },
    INPATIENT: {
      enabled: true,
      requiredDocuments: ['Medical receipt', 'Discharge summary', 'Hospital certificate'],
      optionalDocuments: [],
    },
  },
  approval: {
    autoApprovalThreshold: 0,
    tiers: [{ upTo: null, role: 'committee' }],
  },
  notifications: {
    claim_submitted: { enabled: true, channels: ['email', 'webhook'] },
    approved: { enabled: true, channels: ['email', 'webhook'] },
    rejected: { enabled: true, channels: ['email', 'webhook'] },
    payment_sent: { enabled: true, channels: ['email', 'webhook'] },
  },
  sla: {
    businessDaysByClaimType: { OUTPATIENT: 15, INPATIENT: 15 },
    escalation: { notifyRole: 'department_supervisor' },
  },
  customFields: [
    { key: 'department', label: 'Department', type: 'text', required: true },
    { key: 'budgetCode', label: 'Budget Code', type: 'text', required: true },
  ],
};

export const SEED_TENANTS: readonly SeedTenant[] = [
  { slug: 'safeguard', name: 'SafeGuard Insurance', config: safeguard },
  { slug: 'healthfirst', name: 'HealthFirst', config: healthfirst },
  { slug: 'govhealth', name: 'GovHealth', config: govhealth },
];
