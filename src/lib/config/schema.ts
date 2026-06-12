import { z } from 'zod';

export const CLAIM_TYPES = ['OUTPATIENT', 'INPATIENT', 'DENTAL', 'MATERNITY', 'OPTICAL'] as const;
export const NOTIFICATION_EVENTS = ['claim_submitted', 'approved', 'rejected', 'payment_sent'] as const;
export const CHANNELS = ['email', 'sms', 'webhook'] as const;
export const CUSTOM_FIELD_TYPES = ['text', 'number', 'date', 'select'] as const;
export type ClaimType = (typeof CLAIM_TYPES)[number];
export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number];

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'must be a hex color like #1677ff');

const claimTypeConfig = z
  .object({
    enabled: z.boolean(),
    requiredDocuments: z.array(z.string().min(1)),
    optionalDocuments: z.array(z.string().min(1)),
  })
  .refine((c) => c.requiredDocuments.every((d) => !c.optionalDocuments.includes(d)), {
    message: 'required and optional documents must not overlap',
  });

const tier = z.object({ upTo: z.number().positive().nullable(), role: z.string().min(1) });

const customField = z
  .object({
    key: z.string().min(1),
    label: z.string().min(1),
    type: z.enum(CUSTOM_FIELD_TYPES),
    required: z.boolean(),
    options: z.array(z.string().min(1)).optional(),
  })
  .refine((f) => f.type !== 'select' || (f.options?.length ?? 0) > 0, {
    message: 'select fields need at least one option',
  });

export const tenantConfigSchema = z
  .object({
    branding: z.object({
      companyName: z.string().min(1),
      // z.string().url() is deprecated in Zod 4 — using z.url() which infers to `string`
      logoUrl: z.url(),
      primaryColor: hexColor,
      secondaryColor: hexColor,
    }),
    claimTypes: z.partialRecord(z.enum(CLAIM_TYPES), claimTypeConfig),
    approval: z
      .object({ autoApprovalThreshold: z.number().min(0), tiers: z.array(tier).min(1) })
      .refine((a) => a.tiers[a.tiers.length - 1].upTo === null, {
        message: 'last tier must be unbounded (upTo: null)',
        path: ['tiers'],
      })
      .refine((a) => a.tiers.slice(0, -1).every((t) => t.upTo !== null), {
        message: 'only the last tier may be unbounded',
        path: ['tiers'],
      })
      .refine(
        (a) =>
          a.tiers
            .slice(0, -1)
            .every((t, i, arr) => i === 0 || arr[i - 1].upTo! < t.upTo!),
        { message: 'tier bounds must be strictly ascending', path: ['tiers'] }
      )
      .refine(
        (a) => a.tiers[0].upTo === null || a.autoApprovalThreshold < a.tiers[0].upTo,
        {
          message:
            'threshold must be below the first tier bound, otherwise that tier is unreachable',
          path: ['autoApprovalThreshold'],
        }
      ),
    notifications: z.partialRecord(
      z.enum(NOTIFICATION_EVENTS),
      z
        .object({
          enabled: z.boolean(),
          channels: z.array(z.enum(CHANNELS)),
          emailTemplate: z.string().optional(),
        })
        .refine((n) => !n.enabled || n.channels.length > 0, {
          message: 'enabled events need at least one channel',
        })
    ),
    sla: z.object({
      businessDaysByClaimType: z.partialRecord(
        z.enum(CLAIM_TYPES),
        z.number().int().positive()
      ),
      escalation: z.object({ notifyRole: z.string().min(1) }),
    }),
    customFields: z
      .array(customField)
      .refine((fs) => new Set(fs.map((f) => f.key)).size === fs.length, {
        message: 'custom field keys must be unique',
      }),
  })
  .refine((c) => Object.values(c.claimTypes).some((t) => t?.enabled), {
    message: 'at least one claim type must be enabled',
    path: ['claimTypes'],
  })
  .refine(
    (c) =>
      Object.entries(c.sla.businessDaysByClaimType).every(
        ([t]) => c.claimTypes[t as ClaimType]?.enabled
      ),
    { message: 'SLA may only be configured for enabled claim types', path: ['sla', 'businessDaysByClaimType'] }
  )
  .refine(
    (c) =>
      Object.entries(c.claimTypes).every(
        ([t, cfg]) =>
          !cfg?.enabled || c.sla.businessDaysByClaimType[t as ClaimType] !== undefined
      ),
    { message: 'every enabled claim type needs an SLA', path: ['sla', 'businessDaysByClaimType'] }
  );

export type TenantConfig = z.infer<typeof tenantConfigSchema>;
