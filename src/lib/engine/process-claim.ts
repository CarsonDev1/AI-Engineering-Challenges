import { NOTIFICATION_EVENTS, type TenantConfig, type ClaimType, type CustomFieldType } from '../config/schema';
import { addBusinessDays } from './business-days';

export type ClaimInput = { claimType: ClaimType; amount: number; submittedAt: string;
  customFieldValues: Record<string, unknown> };

export type ClaimError = { code: 'CLAIM_TYPE_NOT_ENABLED' | 'INVALID_AMOUNT'
  | 'MISSING_CUSTOM_FIELD' | 'INVALID_CUSTOM_FIELD'; field?: string; message: string };

export type ProcessClaimResult =
  | { ok: false; errors: ClaimError[] }
  | { ok: true;
      requiredDocuments: string[]; optionalDocuments: string[];
      approval: { route: 'AUTO_APPROVED' } | { route: 'MANUAL'; role: string; tierIndex: number };
      notifications: { event: string; channels: string[]; template: 'custom' | 'default' }[];
      slaDeadline: string;
      escalation: { notifyRole: string } };

export function processClaim(config: TenantConfig, claim: ClaimInput): ProcessClaimResult {
  const errors: ClaimError[] = [];
  const typeCfg = config.claimTypes[claim.claimType];
  if (!typeCfg?.enabled)
    errors.push({ code: 'CLAIM_TYPE_NOT_ENABLED', message: `Claim type ${claim.claimType} is not enabled for this tenant` });
  if (!Number.isFinite(claim.amount) || claim.amount <= 0)
    errors.push({ code: 'INVALID_AMOUNT', message: 'Amount must be a positive number' });
  for (const f of config.customFields) {
    const v = claim.customFieldValues[f.key];
    if (f.required && (v === undefined || v === null || v === ''))
      errors.push({ code: 'MISSING_CUSTOM_FIELD', field: f.key, message: `Missing required field: ${f.label}` });
    else if (v !== undefined && v !== null && v !== '' && !isTypeValid(f.type, v, f.options))
      errors.push({ code: 'INVALID_CUSTOM_FIELD', field: f.key, message: `Invalid value for ${f.label} (expected ${f.type})` });
  }
  if (errors.length) return { ok: false, errors };

  const approval = claim.amount < config.approval.autoApprovalThreshold
    ? { route: 'AUTO_APPROVED' as const }
    : matchTier(config.approval.tiers, claim.amount);

  return { ok: true,
    // typeCfg defined+enabled: guaranteed by the early return above
    requiredDocuments: typeCfg!.requiredDocuments,
    optionalDocuments: typeCfg!.optionalDocuments,
    approval,
    // Canonical lifecycle order, not Object.entries() — jsonb round-trips reorder keys.
    notifications: NOTIFICATION_EVENTS
      .filter((event) => config.notifications[event]?.enabled)
      .map((event) => {
        const n = config.notifications[event]!;
        return { event, channels: n.channels, template: n.emailTemplate ? 'custom' as const : 'default' as const };
      }),
    // SLA presence for enabled types guaranteed by tenantConfigSchema refinement
    slaDeadline: addBusinessDays(claim.submittedAt, config.sla.businessDaysByClaimType[claim.claimType]!),
    escalation: { notifyRole: config.sla.escalation.notifyRole } };
}

// Half-open intervals: a boundary amount belongs to the higher tier.
function matchTier(tiers: TenantConfig['approval']['tiers'], amount: number) {
  const i = tiers.findIndex(t => t.upTo === null || amount < t.upTo);
  return { route: 'MANUAL' as const, role: tiers[i].role, tierIndex: i };
}

function isTypeValid(type: CustomFieldType, v: unknown, options?: string[]): boolean {
  switch (type) {
    case 'number': return typeof v === 'number' && Number.isFinite(v);
    case 'date': return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
    case 'select': return typeof v === 'string' && (options ?? []).includes(v);
    case 'text': return typeof v === 'string';
    default: { const _exhaustive: never = type; return _exhaustive; }
  }
}
