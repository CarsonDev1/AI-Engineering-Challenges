# Multi-Tenant Configuration Platform — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the admin-configurable multi-tenant claims platform per the approved spec (`docs/superpowers/specs/2026-06-11-product-design.md`): versioned JSONB tenant configs, a pure `processClaim` engine shared by runtime/preview/demo, six admin UI pages, seeded with three tenants, deployed on Vercel + Neon.

**Architecture:** One Zod schema owns config integrity (client + server). Configs are versioned JSONB snapshots in PostgreSQL (2 tables, forward-only). The engine is a pure function with no IO; every consumer (runtime API, preview, demo, tests) calls the same code path.

**Tech Stack:** Next.js App Router · TypeScript strict · Ant Design v5 · Zod · Prisma · Neon PostgreSQL · Vitest · Playwright (E2E) · Vercel

**Budget:** ~13h across 4 milestones: M0 scaffold (1h) · M1 domain core (3h) · M2 persistence+API (2.5h) · M3 admin UI (4h) · M4 hardening+E2E+deploy+docs (2.5h)

**Conventions (from CLAUDE.md):** TDD for all `lib/` logic; one commit per task; tick the checkbox and update `docs/PROGRESS.md` Snapshot after each task; every task has a `Verify:` criterion.

---

## Milestone 0 — Scaffold

### Task 1: Scaffold Next.js app with the full toolchain

**Files:** Create: Next.js app at repo root (in-place), `vitest.config.ts`, `.env.example`
**Verify:** `npm run dev` serves a page; `npm run test` runs Vitest (0 tests, exit 0); `npx tsc --noEmit` passes.

- [x] **Step 1: Scaffold in place** (repo root already has README/CLAUDE/docs — scaffold into a temp dir and merge)

```powershell
cd "d:\AI Engineering Challenges\multi-tenant-config-platform"
npx create-next-app@latest tmp-scaffold --typescript --eslint --app --src-dir --no-tailwind --import-alias "@/*" --use-npm
robocopy tmp-scaffold . /E /XF README.md /XD .git node_modules; Remove-Item -Recurse -Force tmp-scaffold
npm install
```

- [x] **Step 2: Install dependencies**

```powershell
npm install antd zod @prisma/client
npm install -D vitest prisma @types/node
```

- [x] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: { include: ['src/**/*.test.ts'] },
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
});
```

- [x] **Step 4: Add scripts to `package.json`** _(added `--passWithNoTests`, to be removed in Task 2 once real tests exist)_

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [x] **Step 5: Verify toolchain**

Run: `npm run dev` → page on http://localhost:3000. `npm run test` → "no test files found" exit 0. `npx tsc --noEmit` → clean.

- [x] **Step 6: Commit** _(`a28c2c0`)_

```bash
git add -A && git commit -m "chore: scaffold Next.js + AntD + Zod + Prisma + Vitest toolchain"
```

---

## Milestone 1 — Domain core (pure logic, TDD, no DB)

### Task 2: Config types + Zod schema with all 9 refinements

**Files:** Create: `src/lib/config/schema.ts`, `src/lib/config/schema.test.ts`; Modify: `package.json` (drop `--passWithNoTests` — real tests exist from this task on)
**Verify:** `npm run test -- schema` — valid fixture passes; every invalid fixture (one per rule, 9 rules) rejected.

- [x] **Step 1: Write failing tests** — one accepting fixture + one rejecting fixture per rule

```ts
// src/lib/config/schema.test.ts
import { describe, it, expect } from 'vitest';
import { tenantConfigSchema } from './schema';

export const validConfig = {
  branding: { companyName: 'SafeGuard Insurance', logoUrl: 'https://example.com/logo.png', primaryColor: '#1677ff', secondaryColor: '#f0f5ff' },
  claimTypes: { OUTPATIENT: { enabled: true, requiredDocuments: ['Medical receipt'], optionalDocuments: ['Prescription'] } },
  approval: { autoApprovalThreshold: 20000, tiers: [{ upTo: 100000, role: 'assessor' }, { upTo: null, role: 'director' }] },
  notifications: { claim_submitted: { enabled: true, channels: ['email'] } },
  sla: { businessDaysByClaimType: { OUTPATIENT: 5 }, escalation: { notifyRole: 'operations_manager' } },
  customFields: [{ key: 'employeeId', label: 'Employee ID', type: 'text', required: true }],
};

const invalid = (patch: object) => tenantConfigSchema.safeParse({ ...structuredClone(validConfig), ...patch });

describe('tenantConfigSchema', () => {
  it('accepts a valid config', () => expect(tenantConfigSchema.safeParse(validConfig).success).toBe(true));
  it('rejects when no claim type is enabled', () =>
    expect(invalid({ claimTypes: { OUTPATIENT: { enabled: false, requiredDocuments: [], optionalDocuments: [] } } }).success).toBe(false));
  it('rejects negative threshold', () =>
    expect(invalid({ approval: { autoApprovalThreshold: -1, tiers: validConfig.approval.tiers } }).success).toBe(false));
  it('rejects non-ascending tiers', () =>
    expect(invalid({ approval: { autoApprovalThreshold: 0, tiers: [{ upTo: 500000, role: 'a' }, { upTo: 100000, role: 'b' }, { upTo: null, role: 'c' }] } }).success).toBe(false));
  it('rejects when last tier is not unbounded', () =>
    expect(invalid({ approval: { autoApprovalThreshold: 0, tiers: [{ upTo: 100000, role: 'a' }] } }).success).toBe(false));
  it('rejects SLA for a disabled claim type', () =>
    expect(invalid({ sla: { businessDaysByClaimType: { DENTAL: 5 }, escalation: { notifyRole: 'x' } } }).success).toBe(false));
  it('rejects enabled claim type without SLA', () =>
    expect(invalid({ sla: { businessDaysByClaimType: {}, escalation: { notifyRole: 'x' } } }).success).toBe(false));
  it('rejects overlapping required/optional documents', () =>
    expect(invalid({ claimTypes: { OUTPATIENT: { enabled: true, requiredDocuments: ['Receipt'], optionalDocuments: ['Receipt'] } } }).success).toBe(false));
  it('rejects enabled notification with zero channels', () =>
    expect(invalid({ notifications: { approved: { enabled: true, channels: [] } } }).success).toBe(false));
  it('rejects bad hex color', () =>
    expect(invalid({ branding: { ...validConfig.branding, primaryColor: 'blue' } }).success).toBe(false));
  it('rejects duplicate custom field keys', () =>
    expect(invalid({ customFields: [{ key: 'a', label: 'A', type: 'text', required: true }, { key: 'a', label: 'B', type: 'text', required: false }] }).success).toBe(false));
  it('rejects select field without options', () =>
    expect(invalid({ customFields: [{ key: 'dept', label: 'Dept', type: 'select', required: true }] }).success).toBe(false));
  it('rejects a threshold that makes the first tier unreachable (dead tier)', () =>
    expect(invalid({ approval: { autoApprovalThreshold: 100000, tiers: [{ upTo: 100000, role: 'a' }, { upTo: null, role: 'b' }] } }).success).toBe(false));
});
```

- [x] **Step 2: Run — expect FAIL** (`tenantConfigSchema` not defined)

- [x] **Step 3: Implement `src/lib/config/schema.ts`**

```ts
import { z } from 'zod';

export const CLAIM_TYPES = ['OUTPATIENT', 'INPATIENT', 'DENTAL', 'MATERNITY', 'OPTICAL'] as const;
export const NOTIFICATION_EVENTS = ['claim_submitted', 'approved', 'rejected', 'payment_sent'] as const;
export const CHANNELS = ['email', 'sms', 'webhook'] as const;
export type ClaimType = (typeof CLAIM_TYPES)[number];

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'must be a hex color like #1677ff');

const claimTypeConfig = z.object({
  enabled: z.boolean(),
  requiredDocuments: z.array(z.string().min(1)),
  optionalDocuments: z.array(z.string().min(1)),
}).refine(c => c.requiredDocuments.every(d => !c.optionalDocuments.includes(d)),
  { message: 'required and optional documents must not overlap' });

const tier = z.object({ upTo: z.number().positive().nullable(), role: z.string().min(1) });

const customField = z.object({
  key: z.string().min(1), label: z.string().min(1),
  type: z.enum(['text', 'number', 'date', 'select']),
  required: z.boolean(), options: z.array(z.string().min(1)).optional(),
}).refine(f => f.type !== 'select' || (f.options?.length ?? 0) > 0,
  { message: 'select fields need at least one option' });

export const tenantConfigSchema = z.object({
  branding: z.object({ companyName: z.string().min(1), logoUrl: z.string().url(),
    primaryColor: hexColor, secondaryColor: hexColor }),
  claimTypes: z.partialRecord(z.enum(CLAIM_TYPES), claimTypeConfig),
  approval: z.object({ autoApprovalThreshold: z.number().min(0), tiers: z.array(tier).min(1) })
    .refine(a => a.tiers[a.tiers.length - 1].upTo === null, { message: 'last tier must be unbounded (upTo: null)' })
    .refine(a => a.tiers.slice(0, -1).every(t => t.upTo !== null), { message: 'only the last tier may be unbounded' })
    .refine(a => a.tiers.slice(0, -1).every((t, i, arr) => i === 0 || (arr[i - 1].upTo! < t.upTo!)),
      { message: 'tier bounds must be strictly ascending' })
    .refine(a => a.tiers[0].upTo === null || a.autoApprovalThreshold < a.tiers[0].upTo,
      { message: 'threshold must be below the first tier bound, otherwise that tier is unreachable' }),
  notifications: z.partialRecord(z.enum(NOTIFICATION_EVENTS), z.object({
    enabled: z.boolean(), channels: z.array(z.enum(CHANNELS)), emailTemplate: z.string().optional(),
  }).refine(n => !n.enabled || n.channels.length > 0, { message: 'enabled events need at least one channel' })),
  sla: z.object({
    businessDaysByClaimType: z.partialRecord(z.enum(CLAIM_TYPES), z.number().int().positive()),
    escalation: z.object({ notifyRole: z.string().min(1) }),
  }),
  customFields: z.array(customField)
    .refine(fs => new Set(fs.map(f => f.key)).size === fs.length, { message: 'custom field keys must be unique' }),
}).refine(c => Object.values(c.claimTypes).some(t => t?.enabled), { message: 'at least one claim type must be enabled' })
  .refine(c => Object.entries(c.sla.businessDaysByClaimType).every(([t]) => c.claimTypes[t as ClaimType]?.enabled),
    { message: 'SLA may only be configured for enabled claim types' })
  .refine(c => Object.entries(c.claimTypes).every(([t, cfg]) => !cfg?.enabled || c.sla.businessDaysByClaimType[t as ClaimType] !== undefined),
    { message: 'every enabled claim type needs an SLA' });

export type TenantConfig = z.infer<typeof tenantConfigSchema>;
```

Note: if the installed Zod version lacks `z.partialRecord`, use `z.record(z.enum(...), x).optional()`-style or `z.object({}).catchall()` equivalent — keep the inferred type `Partial<Record<K, V>>`.

- [x] **Step 4: Run — expect all PASS** _(13/13; quality review 2026-06-12: refines carry explicit `path` options and every rejection test asserts `issues[0].path` — locks the error-mapping contract Tasks 9/11 rely on; zod 4: `z.url()` replaces deprecated `z.string().url()`)_
- [x] **Step 5: Commit** _(`9a1eb17`)_ — `feat: tenant config schema with cross-field validation rules`

### Task 3: Business-day calculator

**Files:** Create: `src/lib/engine/business-days.ts`, `src/lib/engine/business-days.test.ts`
**Verify:** Friday + 5 → next Friday; Saturday submission counts from Monday; 15-day span crosses 3 weekends.

- [x] **Step 1: Failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { addBusinessDays } from './business-days';

describe('addBusinessDays', () => {
  it('Friday + 5 business days lands on next Friday', () =>
    expect(addBusinessDays('2026-06-12', 5)).toBe('2026-06-19'));
  it('+7 from Friday crosses two weekends', () =>
    expect(addBusinessDays('2026-06-12', 7)).toBe('2026-06-23'));
  it('+15 from Friday', () =>
    expect(addBusinessDays('2026-06-12', 15)).toBe('2026-07-03'));
  it('Saturday submission starts counting Monday', () =>
    expect(addBusinessDays('2026-06-13', 1)).toBe('2026-06-15'));
  it('Sunday submission starts counting Monday', () =>
    expect(addBusinessDays('2026-06-14', 1)).toBe('2026-06-15'));
});
```

- [x] **Step 2: Run — FAIL**
- [x] **Step 3: Implement**

```ts
// Counts forward `days` business days from dateISO (YYYY-MM-DD), skipping Sat/Sun.
// All math in UTC to avoid timezone drift.
export function addBusinessDays(dateISO: string, days: number): string {
  const d = new Date(`${dateISO}T00:00:00Z`);
  let remaining = days;
  while (remaining > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) remaining--;
  }
  return d.toISOString().slice(0, 10);
}
```

- [x] **Step 4: Run — PASS** _(19/19; quality review added a Monday-start case — 6 tests total — and the weekend-start comment)_
- [x] **Step 5: Commit** _(`43d41b5`)_ — `feat: business-day calculator`

### Task 4: Generic deep-diff utility

**Files:** Create: `src/lib/diff/diff-configs.ts`, `src/lib/diff/diff-configs.test.ts`
**Verify:** nested added/removed/changed reported in both directions with dotted paths.

- [x] **Step 1: Failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { diffConfigs } from './diff-configs';

describe('diffConfigs', () => {
  it('reports changed leaf values', () =>
    expect(diffConfigs({ a: { b: 1 } }, { a: { b: 2 } }))
      .toEqual([{ path: 'a.b', kind: 'changed', left: 1, right: 2 }]));
  it('reports keys only in left as removed', () =>
    expect(diffConfigs({ a: 1, x: 9 }, { a: 1 }))
      .toEqual([{ path: 'x', kind: 'removed', left: 9 }]));
  it('reports keys only in right as added', () =>
    expect(diffConfigs({ a: 1 }, { a: 1, y: 5 }))
      .toEqual([{ path: 'y', kind: 'added', right: 5 }]));
  it('handles nested arrays as values', () =>
    expect(diffConfigs({ docs: ['x'] }, { docs: ['x', 'y'] }))
      .toEqual([{ path: 'docs', kind: 'changed', left: ['x'], right: ['x', 'y'] }]));
  it('returns [] for identical objects', () =>
    expect(diffConfigs({ a: { b: [1, 2] } }, { a: { b: [1, 2] } })).toEqual([]));
});
```

- [x] **Step 2: Run — FAIL**
- [x] **Step 3: Implement**

```ts
export type DiffEntry = { path: string; kind: 'added' | 'removed' | 'changed'; left?: unknown; right?: unknown };

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export function diffConfigs(left: unknown, right: unknown, base = ''): DiffEntry[] {
  if (isPlainObject(left) && isPlainObject(right)) {
    const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])].sort();
    return keys.flatMap(k => {
      const p = base ? `${base}.${k}` : k;
      if (!(k in right)) return [{ path: p, kind: 'removed' as const, left: left[k] }];
      if (!(k in left)) return [{ path: p, kind: 'added' as const, right: right[k] }];
      return diffConfigs(left[k], right[k], p);
    });
  }
  return JSON.stringify(left) === JSON.stringify(right)
    ? [] : [{ path: base, kind: 'changed', left, right }];
}
```

- [x] **Step 4: Run — PASS** _(26/26; quality review added the atomic array-of-objects contract comment + 2 pinning tests — 7 diff tests total)_
- [x] **Step 5: Commit** _(`ec4ee60`)_ — `feat: generic deep-diff for configs`

### Task 5: `processClaim` engine

**Files:** Create: `src/lib/engine/process-claim.ts`, `src/lib/engine/process-claim.test.ts`
**Verify:** all boundary cases below pass, including the spec's worked example numbers.

- [x] **Step 1: Failing tests** (uses `validConfig` exported from schema.test or a local fixture; threshold 20000, tiers assessor<100000/director∞, OUTPATIENT enabled, SLA 5, employeeId required)

```ts
import { describe, it, expect } from 'vitest';
import { processClaim } from './process-claim';
import { validConfig } from '../config/schema.test';

const claim = (over = {}) => ({ claimType: 'OUTPATIENT' as const, amount: 12000,
  submittedAt: '2026-06-12', customFieldValues: { employeeId: 'E-001' }, ...over });

describe('processClaim', () => {
  it('auto-approves below threshold', () => {
    const r = processClaim(validConfig, claim());
    expect(r.ok && r.approval).toEqual({ route: 'AUTO_APPROVED' });
  });
  it('amount exactly at threshold goes to the first tier (half-open)', () => {
    const r = processClaim(validConfig, claim({ amount: 20000 }));
    expect(r.ok && r.approval).toEqual({ route: 'MANUAL', role: 'assessor', tierIndex: 0 });
  });
  it('amount exactly at a tier bound belongs to the higher tier', () => {
    const r = processClaim(validConfig, claim({ amount: 100000 }));
    expect(r.ok && r.approval).toEqual({ route: 'MANUAL', role: 'director', tierIndex: 1 });
  });
  it('threshold 0 auto-approves nothing', () => {
    const cfg = structuredClone(validConfig); cfg.approval.autoApprovalThreshold = 0;
    const r = processClaim(cfg, claim({ amount: 1 }));
    expect(r.ok && r.approval.route).toBe('MANUAL');
  });
  it('computes SLA deadline in business days', () => {
    const r = processClaim(validConfig, claim());
    expect(r.ok && r.slaDeadline).toBe('2026-06-19');
  });
  it('returns the full lifecycle notification plan', () => {
    const r = processClaim(validConfig, claim());
    expect(r.ok && r.notifications).toEqual([{ event: 'claim_submitted', channels: ['email'], template: 'default' }]);
  });
  it('rejects disabled claim type with structured error', () => {
    const r = processClaim(validConfig, claim({ claimType: 'DENTAL' }));
    expect(!r.ok && r.errors[0].code).toBe('CLAIM_TYPE_NOT_ENABLED');
  });
  it('rejects missing required custom field, naming the field', () => {
    const r = processClaim(validConfig, claim({ customFieldValues: {} }));
    expect(!r.ok && r.errors[0]).toMatchObject({ code: 'MISSING_CUSTOM_FIELD', field: 'employeeId' });
  });
  it('rejects non-positive amount', () => {
    const r = processClaim(validConfig, claim({ amount: 0 }));
    expect(!r.ok && r.errors[0].code).toBe('INVALID_AMOUNT');
  });
});
```

- [x] **Step 2: Run — FAIL**
- [x] **Step 3: Implement**

```ts
import type { TenantConfig, ClaimType } from '../config/schema';
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
    requiredDocuments: typeCfg!.requiredDocuments,
    optionalDocuments: typeCfg!.optionalDocuments,
    approval,
    notifications: Object.entries(config.notifications)
      .filter(([, n]) => n?.enabled)
      .map(([event, n]) => ({ event, channels: n!.channels, template: n!.emailTemplate ? 'custom' as const : 'default' as const })),
    slaDeadline: addBusinessDays(claim.submittedAt, config.sla.businessDaysByClaimType[claim.claimType]!),
    escalation: { notifyRole: config.sla.escalation.notifyRole } };
}

// Half-open intervals: a boundary amount belongs to the higher tier.
function matchTier(tiers: TenantConfig['approval']['tiers'], amount: number) {
  const i = tiers.findIndex(t => t.upTo === null || amount < t.upTo);
  return { route: 'MANUAL' as const, role: tiers[i].role, tierIndex: i };
}

function isTypeValid(type: string, v: unknown, options?: string[]): boolean {
  switch (type) {
    case 'number': return typeof v === 'number' && Number.isFinite(v);
    case 'date': return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
    case 'select': return typeof v === 'string' && (options ?? []).includes(v);
    default: return typeof v === 'string';
  }
}
```

- [x] **Step 4: Run — PASS** _(38/38; quality review: `isTypeValid` now takes the exported `CustomFieldType` union with an exhaustive `never` default — a new field type fails compilation until validated; `validConfig` extracted to `src/lib/config/fixtures.ts` (kills the test-imports-test double-run); +3 engine tests: invalid number value, select outside options, multi-error accumulation — 12 engine tests total)_
- [x] **Step 5: Commit** _(`af7f415`)_ — `feat: processClaim engine with boundary semantics`

### Task 6: Seed data — three tenants + worked-example integration test

**Files:** Create: `src/lib/config/seed-tenants.ts`, `src/lib/config/seed-tenants.test.ts`
**Verify:** all 3 seed configs pass `tenantConfigSchema`; the spec §5 worked example asserts exactly (SafeGuard AUTO/2026-06-19 · HealthFirst assessor/2026-06-23 · GovHealth committee/2026-07-03).

- [x] **Step 1: Failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { SEED_TENANTS } from './seed-tenants';
import { tenantConfigSchema } from './schema';
import { processClaim } from '../engine/process-claim';

const base = { claimType: 'OUTPATIENT' as const, amount: 12000, submittedAt: '2026-06-12' };
const bySlug = (slug: string) => SEED_TENANTS.find(t => t.slug === slug)!.config;

describe('seed tenants', () => {
  it('all seed configs are schema-valid', () =>
    SEED_TENANTS.forEach(t => expect(tenantConfigSchema.safeParse(t.config).success).toBe(true)));

  it('one claim, three fates — spec §5 worked example', () => {
    const safeguard = processClaim(bySlug('safeguard'), { ...base, customFieldValues: { employeeId: 'E-1' } });
    expect(safeguard.ok && safeguard.approval).toEqual({ route: 'AUTO_APPROVED' });
    expect(safeguard.ok && safeguard.slaDeadline).toBe('2026-06-19');

    const healthfirst = processClaim(bySlug('healthfirst'), { ...base, customFieldValues: {} });
    expect(healthfirst.ok && healthfirst.approval).toMatchObject({ route: 'MANUAL', role: 'assessor' });
    expect(healthfirst.ok && healthfirst.slaDeadline).toBe('2026-06-23');

    const govhealth = processClaim(bySlug('govhealth'), { ...base, customFieldValues: { department: 'Health', budgetCode: 'BG-7' } });
    expect(govhealth.ok && govhealth.approval).toMatchObject({ route: 'MANUAL', role: 'committee' });
    expect(govhealth.ok && govhealth.slaDeadline).toBe('2026-07-03');

    const govMissing = processClaim(bySlug('govhealth'), { ...base, customFieldValues: {} });
    expect(!govMissing.ok && govMissing.errors.map(e => e.field).sort()).toEqual(['budgetCode', 'department']);
  });
});
```

- [x] **Step 2: Run — FAIL** _(failed correctly: `Cannot find module './seed-tenants'`)_
- [x] **Step 3: Implement `SEED_TENANTS`** — `readonly SeedTenant[]` (`{ slug, name, config: TenantConfig }`) with the exact spec §11 data: safeguard (threshold 20000; tiers assessor<100000, team_lead<500000, director∞; email all 4 events; SLA OP5/IP10/DENTAL5; employeeId required), healthfirst (all 5 types; threshold 5000; assessor<50000, manager∞; email+sms; SLA 7 all; no custom fields), govhealth (OP+IP; threshold 0; committee∞; email+webhook; SLA 15; department + budgetCode required). Document lists per spec §11 verbatim. _(Decision: all four lifecycle notification events enabled for every tenant — tenants differ only by channel; matches the brief's per-tenant channel descriptions and makes the demo's "same events, different channels" contrast explicit.)_

- [x] **Step 4: Run — PASS** _(suite 41/41; the §5 worked example asserts exactly — SafeGuard AUTO/2026-06-19 · HealthFirst assessor/2026-06-23 · GovHealth committee/2026-07-03 · GovHealth missing both custom fields)_ · **Step 5: Commit** _(`ac537ba`)_ — `feat: seed tenant configs matching the challenge brief`

---

## Milestone 2 — Persistence + API

### Task 7: Prisma schema + Neon connection

**Files:** Create: `prisma/schema.prisma`, `prisma.config.ts`, `src/lib/db/prisma.ts`; Modify: `.gitignore` (ignore `/src/generated/`), `package.json` (`postinstall: prisma generate`), `.env.example`
**Verify:** `npx prisma migrate dev --name init` then `npx prisma generate` succeed against Neon; `npx prisma migrate status` = up to date; a runtime smoke test through `src/lib/db/prisma.ts` (the Neon adapter) queries both tables.

> **Prisma 7 deviation (2026-06-12):** the installed Prisma is **7.8.0**, which changes this task materially from the originally-planned v5/v6 shape. Verified against the official v7 docs before implementing:
> - Generator is **`prisma-client`** (not `prisma-client-js`) and **requires `output`** — the client is generated into `src/generated/prisma` (gitignored; rebuilt by `postinstall`), not `node_modules`. Import from `@/generated/prisma/client`.
> - The Rust query engine is gone → a **driver adapter is mandatory**. Chosen: **`@prisma/adapter-neon`** (Neon serverless driver) — needs `@neondatabase/serverless` + `ws` (Node < 22 has no global `WebSocket`) + `dotenv`.
> - `url` is **no longer allowed in the schema `datasource`** — connection lives in `prisma.config.ts` (migrations) and the adapter (runtime).
> - `migrate dev` / `db push` **no longer auto-run `generate`** — must run `prisma generate` explicitly (and on deploy via `postinstall`).

- [x] **Step 1: Neon project** — already provisioned (prior session); `DATABASE_URL` (pooled, `-pooler` host) present in gitignored `.env`. `.env.example` updated with a Neon pooled-connection template.

- [x] **Step 2: Install Prisma 7 Neon-adapter deps** — `npm install @prisma/adapter-neon @neondatabase/serverless ws dotenv` + `npm install -D @types/ws`.

- [x] **Step 3: `prisma/schema.prisma`** — `generator client { provider = "prisma-client"; output = "../src/generated/prisma" }`, `datasource db { provider = "postgresql" }` (no `url`), plus the `Tenant` + `TenantConfigVersion` models (unchanged shape: forward-only versioning, `@@unique([tenantId, versionNo])`, cascade delete).

- [x] **Step 4: `prisma.config.ts`** (repo root) — `import 'dotenv/config'` + `defineConfig({ schema, migrations.path, datasource: { url: env('DATABASE_URL') } })`. This is where the CLI/migration connection now lives.

- [x] **Step 5: `src/lib/db/prisma.ts`** — singleton `PrismaClient({ adapter: new PrismaNeon({ connectionString }) })`, with `neonConfig.webSocketConstructor = ws` and a `DATABASE_URL` presence guard. Import `PrismaClient` from `@/generated/prisma/client`.

- [x] **Step 6: Migrate + generate + verify** — `npx prisma migrate dev --name init` (created `prisma/migrations/20260612085136_init`, applied to Neon over the pooler) → `npx prisma generate` → `tsc --noEmit` clean, suite 41/41, `migrate status` up to date, runtime adapter smoke test returned `{tenants:0, versions:0}`. **Step 7: Commit** _(`5aeb622`)_ — `feat: prisma 7 schema + neon adapter for tenants and config versions`

### Task 8: Tenant repository (versioning semantics live here)

**Files:** Create: `src/lib/db/tenant-repo.ts`, `src/lib/db/tenant-repo.integration.test.ts`, `vitest.integration.config.ts`; Modify: `vitest.config.ts` (exclude `*.integration.test.ts`), `package.json` (`test:integration` script)
**Verify:** `npm run test:integration` passes against Neon — versions increment, rollback creates a NEW version (note `rollback to vN`) and NEVER mutates old rows; `npm run test` still 41 (pure, offline); `tsc --noEmit` clean.

> **Test-strategy decision (2026-06-12):** the plan originally deferred repo coverage to the Task 9 API tests, but the forward-only versioning/rollback semantics are the most bug-prone part of the system (spec §10), so they get a dedicated **integration test** that exercises the real Neon database. It is isolated in `*.integration.test.ts`, excluded from `npm run test` (which stays a pure, offline, deterministic unit suite), and run on demand via `npm run test:integration` (its own config loads `dotenv`, runs serially, 30s timeout for the cross-region round-trips). The test creates a scratch `__itest_tenant` and deletes it in `afterAll`.

- [x] **Step 1: Implement** — all config writes go through `createVersion`:

```ts
import { prisma } from './prisma';
import type { TenantConfig } from '../config/schema';

export async function listTenants() {
  const tenants = await prisma.tenant.findMany({ orderBy: { createdAt: 'asc' } });
  return Promise.all(tenants.map(async t => ({ ...t, activeConfig: await getActiveConfig(t.id) })));
}

export async function getActiveConfig(tenantId: string): Promise<TenantConfig | null> {
  const t = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!t?.activeVersionId) return null;
  const v = await prisma.tenantConfigVersion.findUnique({ where: { id: t.activeVersionId } });
  return (v?.config as TenantConfig) ?? null;
}

// Every save = new version row + repoint active. Forward-only.
export async function createVersion(tenantId: string, config: TenantConfig, note?: string) {
  return prisma.$transaction(async tx => {
    const last = await tx.tenantConfigVersion.findFirst({ where: { tenantId }, orderBy: { versionNo: 'desc' } });
    const v = await tx.tenantConfigVersion.create({
      data: { tenantId, versionNo: (last?.versionNo ?? 0) + 1, config: config as object, note } });
    await tx.tenant.update({ where: { id: tenantId }, data: { activeVersionId: v.id } });
    return v;
  });
}

export async function createTenant(slug: string, name: string, config: TenantConfig) {
  const t = await prisma.tenant.create({ data: { slug, name } });
  await createVersion(t.id, config, 'initial version');
  return t;
}

export async function rollbackToVersion(tenantId: string, versionId: string) {
  const old = await prisma.tenantConfigVersion.findUniqueOrThrow({ where: { id: versionId } });
  return createVersion(tenantId, old.config as TenantConfig, `rollback to v${old.versionNo}`);
}

export async function listVersions(tenantId: string) {
  return prisma.tenantConfigVersion.findMany({ where: { tenantId }, orderBy: { versionNo: 'desc' } });
}
```

- [x] **Step 2: Integration test (RED→GREEN) + typecheck** — wrote the failing test first (`Cannot find module './tenant-repo'`), then implemented. JSON writes use `config as unknown as Prisma.InputJsonValue` (`Prisma` namespace from `@/generated/prisma/client`; `TenantConfig`'s optional fields make it not directly assignable). Verified: integration 1/1 on Neon (~10s), unit suite 41/41, `tsc --noEmit` clean. **Step 3: Commit** _(`e3baa25`)_ — `feat: tenant repository with forward-only versioning`

### Task 9: API route handlers (server-side validation chokepoint)

**Files:** Create: the 7 `src/app/api/.../route.ts` handlers, `src/lib/engine/claim-input.ts` (+ `.test.ts`); Modify: `src/lib/db/tenant-repo.ts` (added `getTenant`, `deleteTenant`, `reseedDemoTenants`).
**Verify:** the real Next 16 dev server + Neon pass an end-to-end check (a throwaway node fetch script): reset-demo seeds 3 · process-claim reproduces the worked example for two tenants (AUTO/2026-06-19 and committee/2026-07-03 — different fates, same claim) · invalid config → 400 with Zod issues bypassing the UI · malformed claim → 400 not 500. `tsc --noEmit` clean, unit suite 46.

> **Next 16 note:** route handlers consulted `node_modules/next/dist/docs` per AGENTS.md — handlers are `export async function METHOD(req, ctx)`, dynamic params are a **Promise** (`await ctx.params`), `NextResponse.json`, uncached by default. Params typed explicitly (`{ params: Promise<{ id: string }> }`) so `tsc` doesn't depend on Next's generated route types.
>
> **Test-strategy note:** the claim-input Zod schema (the one new bit of `lib/` logic — guards the engine's input contract at the boundary) is TDD'd as a unit (5 tests). The route handlers themselves are thin glue over the already-tested engine/repo, so they are verified at runtime via the end-to-end script rather than unit-mocked; deeper UI/flow coverage comes from the Playwright suite (Task 17).

- [x] **Step 1: Implement handlers + `claimInputSchema` + repo helpers.** Pattern (config save — the critical one):

```ts
// src/app/api/tenants/[id]/config/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { tenantConfigSchema } from '@/lib/config/schema';
import { createVersion } from '@/lib/db/tenant-repo';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const parsed = tenantConfigSchema.safeParse(body.config);
  if (!parsed.success)
    return NextResponse.json({ error: 'Invalid config', issues: parsed.error.issues }, { status: 400 });
  const version = await createVersion(id, parsed.data, body.note);
  return NextResponse.json({ version });
}
```

`process-claim` (single endpoint for runtime + preview + demo):

```ts
// src/app/api/process-claim/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { processClaim } from '@/lib/engine/process-claim';
import { getActiveConfig } from '@/lib/db/tenant-repo';

export async function POST(req: NextRequest) {
  const { tenantId, claim } = await req.json();
  const config = await getActiveConfig(tenantId);
  if (!config) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
  return NextResponse.json(processClaim(config, claim));
}
```

`process-claim` must Zod-validate the claim body shape BEFORE calling the engine (`claimType` enum, `amount` number, `submittedAt` `/^\d{4}-\d{2}-\d{2}$/`, `customFieldValues` record defaulting to `{}`) → 400 on malformed input. _(Added 2026-06-12: garbage `submittedAt` or a missing `customFieldValues` posted directly to the API would otherwise throw inside the engine → 500. Engine preconditions are enforced at the API boundary — the engine stays pure and trusts its typed contract.)_

`reset-demo`: upserts ONLY the 3 seed tenants (delete by slug + recreate from `SEED_TENANTS`); never touches other tenants — any additionally onboarded tenant (e.g. tenant #4) must survive a reset.
Remaining handlers: `GET/POST /api/tenants` (create validates config with schema too), `GET/DELETE /api/tenants/[id]`, `GET .../versions`, `POST .../rollback { versionId }` — all thin wrappers over the repo.

- [x] **Step 2: Verify end-to-end** — passed via a throwaway node fetch script against `next dev` + Neon (all 6 checks green; see the Verify line). Original curl recipe (equivalent):

```powershell
curl -s -X POST localhost:3000/api/reset-demo                                    # → 3 tenants
curl -s localhost:3000/api/tenants                                               # → safeguard, healthfirst, govhealth
curl -s -X POST localhost:3000/api/process-claim -H "Content-Type: application/json" `
  -d '{"tenantId":"<safeguard-id>","claim":{"claimType":"OUTPATIENT","amount":12000,"submittedAt":"2026-06-12","customFieldValues":{"employeeId":"E-1"}}}'
# → ok:true, approval AUTO_APPROVED, slaDeadline 2026-06-19
# PUT config with threshold -5 → 400 with Zod issues
```

- [x] **Step 3: Commit** _(`9df7bf9`)_ — `feat: REST API with server-side Zod validation` _(closes M2)_

---

## Milestone 3 — Admin UI (Ant Design)

UI tasks share these conventions: client components under `src/components/`, AntD `App` + `ConfigProvider` in `src/app/layout.tsx`, data fetching via plain `fetch` to the API (no extra state library — YAGNI), `message.success/error` feedback on every mutation.

### Task 10: App shell + tenant list + create + reset demo

**Files:** Modify: `src/app/layout.tsx` (fonts + AntdRegistry + Providers + header), `src/app/globals.css` (design system), `src/app/page.tsx` (home); Create: `src/app/providers.tsx`, `src/lib/ui/theme.ts`, `src/components/{AppHeader,TenantCard,CreateTenantModal}.tsx`, `src/lib/config/default-config.ts` (+ `.test.ts`); plus the Playwright harness (`playwright.config.ts`, `e2e/admin-flows.spec.ts`).
**Verify:** `tsc` + `lint` clean, unit suite 48; **Playwright (`npm run test:e2e`) 3/3**: home lists the three seeds · reset restores exactly 3 · onboard a 4th via the modal (zero code) then clean up; screenshot confirms the rendered design.

> **Design decision (2026-06-12):** the UI matches **Papaya's own brand** (the company this serves). The palette was extracted from papaya.asia (via the browser): clean white surfaces, near-black ink, **papaya pink `#ED1B55`** primary accent, neutral grays, and a decorative peach→pink→violet gradient; **Plus Jakarta Sans** (their typeface) for UI + display, IBM Plex Mono for ledger figures; pill badges, flat/minimal, 8px radii — Papaya's "header format" (pink rounded badge + bold wordmark, pink-pill eyebrow, pink CTA). Each tenant's `primaryColor` still supplies per-tenant chroma (card spine + chips). AntD re-themed via `ConfigProvider` tokens (`src/lib/ui/theme.ts`) + `@ant-design/nextjs-registry` for SSR styles. _(An earlier "Operational Ledger" warm-paper/oxblood/serif draft was replaced on the same uncommitted task once the brand-match was requested.)_
>
> **Process decision (2026-06-12):** per the user's instruction, **Playwright was pulled forward** from Task 17 to run per-UI-task. It lives in `e2e/` with its own config (chromium, `workers: 1`, reset-demo in `beforeAll`, accessible-name/role selectors), `npm run test:e2e`, and is excluded from the unit/integration suites. UI verification = typecheck + lint + e2e + a screenshot.

- [x] **Step 1: Design foundation** — palette/atmosphere in `globals.css`, AntD theme tokens, fonts, `Providers` (ConfigProvider + App) + AntdRegistry + `AppHeader` (Keystone wordmark) in `layout.tsx`.
- [x] **Step 2: Tenant list** — home page (client) fetches `/api/tenants`, renders branding-tinted `TenantCard`s (name, slug, enabled-type tags, Edit/Preview/History links — those pages land in Tasks 11–13), with a loading + empty state. `CreateTenantModal` asks name + slug only and posts `defaultTenantConfig()` (OUTPATIENT enabled, threshold 0, single tier `assessor`/∞, claim_submitted email, SLA 5, no custom fields; schema-validity pinned by a unit test). Reset-demo confirms, re-seeds, refetches. Slug-conflict (409) surfaces inline.
- [x] **Step 3: Playwright** — harness + 3 specs, all green; AntD `Input addonBefore` deprecation fixed (→ `prefix`); `react-hooks/set-state-in-effect` false-positive on the deferred mount-fetch disabled with a justification.
- [x] **Step 4: Commit** _(`63dffb7`)_ — `feat: tenant list page with create and reset-demo`

### Task 11: Config editor — six tabs

**Files:** Create: `src/app/tenants/[id]/page.tsx`, `src/components/config-editor/{BrandingTab,ClaimTypesTab,ApprovalTab,NotificationsTab,SlaTab,CustomFieldsTab}.tsx`, `src/components/config-editor/ConfigEditor.tsx`
**Verify:** can edit every spec §4 field; client Zod validation blocks bad input with inline messages; Save posts config + optional note → toast shows new version number; server 400 issues render mapped to fields.

Form-to-schema mapping (exact fields per tab):
- **Branding:** companyName (Input), logoUrl (Input url), primaryColor + secondaryColor (ColorPicker, hex output).
- **Claim Types:** one collapsible panel per type with `enabled` Switch; inside: two `Select mode="tags"` lists for requiredDocuments / optionalDocuments (tags = free-text document names).
- **Approval:** InputNumber threshold (min 0); tiers editable table — rows of `upTo` (InputNumber) + `role` (Input); last row locked to ∞; add/remove row buttons; live ascending-order validation.
- **Notifications:** per event: enabled Switch, channels Checkbox.Group [email/sms/webhook], optional emailTemplate TextArea (placeholder explains default fallback).
- **SLA:** InputNumber per *enabled* claim type (rows appear/disappear with ClaimTypes state); escalation notifyRole Input.
- **Custom Fields:** editable list — key, label, type Select(text/number/date/select), required Switch, options tags (visible when type=select).

State strategy: one `useState<TenantConfig>` for the whole draft; each tab edits a slice; Save runs `tenantConfigSchema.safeParse` first, maps `error.issues[].path` to tab + field highlights.

> **Implemented (2026-06-12).** `ConfigEditor` holds the draft + a normalized issue list (`issues.ts` stringifies paths so client safeParse issues and the server's 400 issues map to fields identically); tab labels show per-section error badges; after the first failed save the draft re-validates on every change so errors clear as fixed. Editor-level decisions: (1) toggling a claim type syncs SLA — enabling seeds a 5-business-day default, disabling removes the entry (the SLA tab only shows enabled types, so a stale entry would be invisible-but-invalid); (2) enabling a never-configured notification event starts with zero channels — the inline "needs at least one channel" error makes the admin choose explicitly instead of the UI inventing a default; (3) tier ascending order gets immediate feedback while typing (the plan's "live" check); everything else validates on save. Verified: `tsc` + `lint` clean, unit 48, **Playwright 5/5** (added "editor saves a new config version with a note" asserting the v2 toast, and "invalid config is blocked inline" asserting the toast + inline error + version count still 1 server-side); screenshots of Branding / Claim Types / Approval confirm the brand match.

- [x] Commit _(`4f50232`; follow-ups same session: responsive pass `1111e66`, full-feature e2e sweep + DB-relative counts)_ — `feat: six-tab tenant config editor with client-side validation`

### Task 12: Preview page (branding-aware)

**Files:** Create: `src/app/tenants/[id]/preview/page.tsx`, `src/components/ClaimForm.tsx`, `src/components/ProcessResultPanel.tsx`, `src/components/BrandingFrame.tsx`
**Verify:** claim form renders only the tenant's enabled claim types + that tenant's custom fields (dynamic); submitting calls `POST /api/process-claim` (the runtime endpoint — check Network tab) and renders all 5 result parts inside a frame using the tenant's logo + colors; a disabled-type or missing-field claim shows the structured errors, not a crash.

`ProcessResultPanel` sections: Documents (required/optional lists) · Approval (AUTO badge or role + tier) · Notifications (event → channel tags + template source) · SLA deadline (date + "N business days") · Escalation. `ClaimForm` and `ProcessResultPanel` are shared with the demo page (Task 15) — build them tenant-parameterized.

> **Implemented (2026-06-13).** `BrandingFrame` wraps content in the tenant's logo + name bar and recolours AntD controls to the tenant's `primaryColor` via a nested (inheriting) `ConfigProvider` — so the "Process claim" button and focus rings read in the insurer's own colour. `ClaimForm` is **controlled + config-parameterized** (offers only enabled claim types, renders custom fields by type with an exhaustive `never` switch mirroring the engine) and carries **no submit button / no API call** — the page owns those, so Task 15's demo can compose three of them around one shared claim. `ProcessResultPanel` is pure presentation of a `ProcessClaimResult` (the five outputs, or the structured errors as an alert — never a crash). The preview page POSTs `{ tenantId, claim }` to **`/api/process-claim`** (the same runtime endpoint, verified via `waitForResponse` in the e2e). Two bugs found and fixed during verification: (1) the mount effect runs twice under React Strict Mode, so the draft is now seeded **once** via a functional guard (`prev ?? …`) — a plain set let the second load wipe an in-progress claim mid-interaction; (2) the default/dropdown claim-type order came from `Object.keys(claimTypes)`, which is Postgres **jsonb's normalised key order** (by length → DENTAL first) after the round-trip, so order now derives from the canonical `CLAIM_TYPES` const. Date inputs are native `<input type="date">` (clean `YYYY-MM-DD`, reliable Playwright `fill`) rather than AntD's dayjs `DatePicker`. Verified: `tsc` + `lint` clean, unit **48**, **Playwright 20/20** (2 new preview specs: branded worked-example through the runtime endpoint + missing-required-field structured error), screenshot confirms the SafeGuard-branded render.

> **Follow-up polish (2026-06-13, review pass).** A live browser walk of all three tenants confirmed the runtime-endpoint call (200), per-tenant recolouring, dynamic custom fields, and the no-crash error panel. Three small fixes landed on top: (1) **notification order** — the panel showed events in jsonb key-length order (Approved, Rejected, Payment sent, Claim submitted); fixed **at the engine** (iterate the canonical `NOTIFICATION_EVENTS` const, not `Object.entries`) so every consumer — preview, demo, API — gets lifecycle order, TDD'd with a scrambled-key test (unit **48 → 49**); (2) **antd v6 `Alert`** `message` → `title` (the old prop logged a deprecation console error); (3) `.gitignore` now ignores `/.playwright-mcp/` (MCP browser scratch output).

- [x] Commit _(`e7a3d89`; follow-up polish in a later commit — see above)_ — `feat: branding-aware preview mode calling the runtime endpoint`

### Task 12b: Branding — adopt Papaya identity (Papaya Keystone)

> **Added 2026-06-13 (user request) — tracked as its own phase/task.** Brand the admin product as **Papaya Keystone** using Papaya's own logo lockup; this is Papaya's internal multi-tenant config tool, so adopting the employer's identity is a deliberate culture-fit/polish signal.

**Files:** Modify: `src/components/AppHeader.tsx` (pink "P" mark + "Papaya Keystone" wordmark + aria-label), `src/app/layout.tsx` (metadata title), `src/app/globals.css` (badge → 32px/8px to match Papaya, `.wordmark__product`); Replace: `src/app/favicon.ico` (Papaya's `icon.ico`).
**Verify:** header renders Papaya's pink "P" mark + "Papaya Keystone"; browser tab title + favicon are Papaya's; `tsc` + `lint` clean; e2e unaffected (no spec references "Keystone"); screenshot confirms.

- [x] Reproduced Papaya's mark faithfully (extracted live from papaya.asia: `#ED1B55`, 32px square, 8px radius, white bold "P"; "Papaya" in Plus Jakarta Sans 600 — colour + typeface already matched our theme, so only the letter, wordmark, title, and favicon changed). "Papaya" bold + "Keystone" lighter reads as the product within the parent brand. Papaya's logo is pure CSS (no image asset), so it's reproduced in markup; the **favicon** is the one downloadable asset, pulled from `papaya.asia/icon.ico` (replaces the Next scaffold default). Verified: `tsc` + `lint` clean, header screenshot confirms, `grep` shows no e2e/runtime dependency on the old name.
- [x] Commit _(`6464549`)_ — `feat: adopt Papaya brand identity — Papaya Keystone`

### Task 13: History page — versions, view, diff vs current, rollback

**Files:** Create: `src/app/tenants/[id]/history/page.tsx`, `src/components/VersionDiffDrawer.tsx`
**Verify:** every save in Task 11 appears as a version row (no, note, date); "Diff vs current" opens a drawer listing `diffConfigs(version, current)` entries grouped by top-level section; Rollback creates a NEW version (note `rollback to vN`) — old rows unchanged; preview immediately reflects the rolled-back config.

> **Implemented (2026-06-13).** History page fetches the tenant (for `activeVersionId` + active config) and the versions list in parallel, then renders one row per version (vN · note · localised timestamp · `Current` badge on the active one). "Diff vs current" opens `VersionDiffDrawer`, which feeds `diffConfigs(version.config, activeConfig)` to a new **shared `DiffTable`** — both sides are jsonb DB reads, satisfying the diff's equal-serialization precondition. Rollback confirms, POSTs `/api/tenants/[id]/rollback`, refetches, and toasts `Rolled back to vN — saved as version M`; the new version carries note `rollback to vN` and becomes current while older rows stay byte-identical (forward-only). **Deviation:** `DiffTable` (planned as a Task 14 file) is built **now** because the drawer needs it — Task 14 reuses it rather than creating it. Two antd v6 prop fixes while building: Drawer `width`→`size` (v6 `size` accepts a number) and the earlier `Alert` `message`→`title`. Verified: `tsc` + `lint` clean, unit **49**, **Playwright 21/21** (new spec drives editor-save→history→diff→rollback and asserts the runtime threshold changed: a 22000 claim auto-approved under v2's 25000 threshold is MANUAL again after rolling back to v1's 20000), screenshots confirm the version list + the `v2 vs current` diff drawer.
>
> **Stale-id hardening (2026-06-13).** User hit "rollback error"; reproduced (MCP browser + network capture) as a **stale tenant id → 404** after a demo reset in another tab — rollback itself returns 200 on a valid id, so not a rollback bug. Both stale-id mutation paths (history **rollback** and editor **save**) now special-case 404: an actionable message ("…no longer exists — it may have been reset. Returning to the tenant list.") + redirect to `/` (where fresh data loads), instead of a dead-end "Rollback/Save failed." toast. (Preview already handled its 404.) Pinned by two e2e: the save-REPRO updated to assert the new message + redirect, plus a new rollback-stale REPRO. This is the stale-id slice of Task 16's error-state checklist, pulled forward; Task 16 still owns the rest. Suite **22/22**.

- [x] Commit _(pending user approval)_ — `feat: config history with diff and forward-only rollback`

### Task 14: Tenant-vs-tenant diff page

**Files:** Create: `src/app/diff/page.tsx`. Reuse: `src/components/DiffTable.tsx` (already built in Task 13 for the history drawer — Task 14 only adds the two-tenant picker page around it).
**Verify:** select SafeGuard vs GovHealth → table shows ALL differences both directions (e.g. `claimTypes.DENTAL` removed, `customFields` changed, threshold changed, channels changed), grouped by section with added/removed/changed color coding; selecting the same tenant twice → "No differences".

> **Implemented (2026-06-13).** `/diff` fetches `/api/tenants` once and reuses each tenant's `activeConfig` from that single response, so both diff sides are the same Postgres jsonb serialization (the `diffConfigs` precondition) — no per-tenant refetch. Two `showSearch` selects (default to the first two tenants so a diff shows on arrival) feed `diffConfigs(left, right)` into the shared `DiffTable`. `showSearch` was chosen over a plain dropdown both for usability with many tenants and because two selects share option titles — typing to filter selects unambiguously. Added a "Compare" link to the header nav (`AppHeader`). Verified: `tsc` + `lint` clean, unit **49**, **Playwright 23/23** (new spec: SafeGuard vs GovHealth surfaces `claimTypes.DENTAL` + `approval.autoApprovalThreshold`; same tenant twice → `diff-empty`), screenshot confirms the grouped, colour-coded table.

- [x] Commit _(pending user approval)_ — `feat: side-by-side tenant config diff`

### Task 15: Demo page — "one claim, three fates"

**Files:** Create: `src/app/demo/page.tsx`. Modify: `src/components/ClaimForm.tsx` (export `CustomFieldInput` for reuse), `AppHeader.tsx` (Demo nav link).
**Verify:** one shared claim form (OUTPATIENT, amount, date) + per-tenant custom-field inputs prefilled with valid values; Submit fires the SAME claim to `/api/process-claim` for all three seed tenants; three result columns render in each tenant's branding showing different routing/notifications/SLA — the spec §5 table reproduced live. A "Clear custom fields" toggle demonstrates per-tenant validation errors.

> **Implemented (2026-06-13).** `/demo` loads the three seeds (filtered by slug, in brief order), shares one claim (type from the types ALL three enable · amount · date) and prefills each tenant's custom fields with valid values; "Process for all three" fires three parallel POSTs to the runtime `/api/process-claim` and renders three `BrandingFrame` columns, each with the tenant's custom inputs (reusing the now-exported `CustomFieldInput`) + a `ProcessResultPanel`. The "Clear custom fields" switch sends `{}` so SafeGuard/GovHealth show their required-field errors while HealthFirst (no customs) still processes. Browser-verified the spec §5 fates live: SafeGuard AUTO/2026-06-19 · HealthFirst assessor/2026-06-23 · GovHealth committee/2026-07-03.
>
> **Bug found + fixed during verification:** a non-200 process-claim response (e.g. a stale seed id after a reset → 404) returns `{ error }`, not a `ProcessClaimResult`; feeding it to `ProcessResultPanel` crashed on `result.errors.map`. `run()` now keeps only 200 bodies and, on any non-OK, shows a message + refetches the seeds (the demo's slice of the stale-id hardening); `/api/tenants` is fetched `no-store` so a cached list can't hand the page dead ids. Pinned by a demo-stale REPRO. Also bumped the Playwright `timeout`→120s / `expect`→30s: the suite drives real Neon over cross-region WS and an occasional latency spike (not logic) was tripping the old 60s/15s limits — two consecutive full runs are now green (**25/25**). `tsc` + `lint` clean, unit **49**, screenshot confirms the three branded columns.

- [x] Commit _(`4e2d8da`)_ — `feat: one-claim-three-fates demo page`

---

## Milestone 4 — Hardening, deploy, submission docs

### Task 16: Error-state hardening pass

**Files:** Modify: API handlers (404/400 paths), `src/components/ProcessResultPanel.tsx`, editor save flow
**Verify:** each row of this checklist behaves as stated — (1) process-claim with unknown tenantId → 404 JSON, UI shows friendly error; (2) PUT config bypassing UI with overlapping documents → 400 + issues array; (3) deleting a tenant then visiting its pages → redirect to `/` with message; (4) claim MATERNITY to SafeGuard via demo/preview → structured CLAIM_TYPE_NOT_ENABLED rendered as an alert, never a blank panel; (5) empty tenant list (before seed) → empty-state with "Reset demo data" call-to-action.

- [x] Walked the checklist (browser + API evidence). **All five already pass** — the error states were hardened incrementally across M3, so this was largely a confirmation pass: (1) unknown `tenantId` → 404 JSON; preview shows a message, demo refetches. (2) overlapping-docs / malformed config bypassing the UI → 400 + `issues` (the shared schema + route `safeParse`; confirmed live for a malformed claim, locked by the schema unit test + the "overlapping docs blocked inline" e2e). (3) visiting a deleted tenant's editor/history/preview → a consistent "Tenant not found / Back to tenants" empty-state (no crash) — kept as an empty-state rather than an auto-redirect for direct visits, which is clearer for a deep link; *mutations* on a vanished tenant still redirect to `/` (the stale-id slice done in Tasks 13/15). (4) a disabled-type claim → `CLAIM_TYPE_NOT_ENABLED` rendered by `ProcessResultPanel`'s `!ok` alert branch, never a blank panel (the UI also only offers enabled types, so it can't be triggered by accident). (5) empty tenant list → empty-state with a "Reset demo data" CTA. Also grepped/verified the antd surface: no remaining v6 deprecation warnings (Alert/Drawer fixed earlier; the editor console is clean across all six tabs). No `lib/` gaps found, so no new unit tests.
- [x] **Added regression coverage + hardened the e2e suite itself:** not-found specs for the history & preview pages (editor already had one); and fixed two real flaky-test traps surfaced by repeated full runs — the stale-id REPROs now invalidate via a throwaway tenant created-then-DELETED (deterministic; no `reset-demo` recreate window or seed churn), and `saveExpectOk` no longer reads the response body over CDP (`response.text()`/`json()` intermittently throws "No data found for resource" under load) nor collides on two overlapping "Saved as version N" toasts (`.last()`). Two consecutive full runs now pass **27/27** at ~3.2 min. `tsc` + `lint` clean, unit **49**.
- [x] Commit _(pending user approval)_ — `fix: harden error states and stabilize the e2e suite`

### Task 17: Playwright E2E suite

**Files:** Create: `playwright.config.ts`, `e2e/admin-flows.spec.ts`; Modify: `package.json` (script `"test:e2e": "playwright test"`), `.gitignore` (add `playwright-report/`, `test-results/`)
**Verify:** `npx playwright test` → 8 passed, deterministic across two consecutive runs.

- [ ] **Step 1: Install** — `npm init playwright@latest -- --quiet` (TypeScript, `e2e/` folder, **chromium only**). Config: `webServer: { command: 'npm run dev', url: 'http://localhost:3000', reuseExistingServer: true }`, `workers: 1` (specs mutate shared seed data).

- [ ] **Step 2: Write `e2e/admin-flows.spec.ts`** — `test.beforeAll` posts `/api/reset-demo`; then 8 specs:

```ts
test('home lists the three seeded tenants', ...);     // cards: SafeGuard Insurance, HealthFirst, GovHealth
test('editor save creates a new version', ...);       // safeguard: threshold 20000→25000, save → history shows v2 with note
test('invalid config is blocked inline', ...);        // SLA = -1 → inline error visible, no new version created
test('preview reproduces the worked example', ...);   // safeguard OUTPATIENT 12000 @2026-06-12 + employeeId → AUTO_APPROVED, SLA 2026-06-19
test('demo page shows three different fates', ...);   // 3 columns; routing badges differ (AUTO / assessor / committee)
test('diff highlights SafeGuard vs GovHealth', ...);  // entries include claimTypes.DENTAL (removed) and approval threshold (changed)
test('rollback restores previous behavior', ...);     // amount 22000: under v2 (threshold 25000) → AUTO_APPROVED; rollback to v1 (threshold 20000) → MANUAL assessor
test('tenant #4 onboards with zero code', ...);       // create via UI → process OUTPATIENT claim → result panel renders
```

Each `...` is a full Playwright spec using `page.getByRole`/`getByLabel` selectors — write accessible-name selectors, not CSS classes (AntD class names are unstable).

- [ ] **Step 3: Run twice** — `npx playwright test` → 8 passed both runs.
- [ ] **Step 4: Commit** — `test: Playwright E2E suite for critical admin flows`

> **Done (2026-06-13) — consolidation, since Playwright was pulled forward to Task 10.** The suite already existed and exceeded this task's 8 specs, so Task 17 was an audit + cleanup rather than an introduction. **Coverage audit:** all 8 planned critical flows are in `admin-flows.spec.ts` (home/reset, editor-save+version, invalid-blocked-inline, onboard-4th-zero-code, preview-worked-example, compare SafeGuard↔GovHealth, demo three-fates, history+forward-only-rollback proving the runtime threshold changed). The second file holds the robustness coverage (config round-trips, every cross-field rule through the UI, not-found on all three detail pages, stale-id recovery REPROs, the worked-example regression). **Consolidation:** renamed `debug-sweep.spec.ts` → **`edge-cases.spec.ts`** (`git mv`, history preserved) and rewrote both file headers to describe scope (the old name/comment read as leftover debugging — unfit for a submission repo). **Determinism hardening:** the two admin-flows config-save assertions now wait on the PUT response (the test's 120s budget) and assert 200, instead of racing the 3s success toast — under Neon latency the exact-version toast occasionally appeared/faded outside the 30s expect window (the last remaining flake). `package.json` already has `test:e2e`; `.gitignore` already ignores `playwright-report/`, `test-results/`, `.playwright/`, `.playwright-mcp/`. Verified: **27/27 across two consecutive full runs** (~3.2 min), `lint` clean. Real residual: the suite leans on cross-region Neon, so wall-time is latency-bound — a local/throwaway test DB would be the next improvement (out of timebox).

### Task 18: Deploy to Vercel + Neon, seed, smoke test

**Files:** Create: `vercel.json` (if needed), README "Deployment" section
**Verify (on the LIVE URL):** all 6 pages work; reset-demo seeds 3 tenants; the §5 worked example reproduces on `/demo`; create tenant #4 via UI → process a claim against it → **redeploy → tenant #4 still there** (Neon persistence proof).

- [ ] **Step 1:** Push to GitHub → import repo in Vercel → set `DATABASE_URL` env (Neon pooled connection string) → deploy. Build must pass `npx prisma generate` (add `postinstall: prisma generate` script).
- [ ] **Step 2:** Run `npx prisma migrate deploy` against Neon prod; hit `POST /reset-demo`.
- [ ] **Step 3:** Execute the live smoke checklist above, including the redeploy-persistence test.
- [ ] **Step 4:** Commit — `chore: production deployment configuration`

### Task 19: README, writeup, demo script — submission package

**Files:** Rewrite: `README.md`; Create: `docs/WRITEUP.md`, `docs/DEMO_SCRIPT.md`
**Verify:** a reader can go from zero → running locally in <10 minutes using only README; writeup covers approach, key decisions (cite the Decision Log), trade-offs (no-auth, weekends-only business days), and how AI tools were used; demo script walks: reset → tour 3 tenants → preview → demo page → diff → edit+history+rollback → create tenant #4 → process claim → persistence note.

- [ ] **README sections:** what this is (challenge link) · live URL · screenshots · quickstart (env, migrate, seed, dev) · architecture summary (one engine, versioned JSONB, validation) · testing (`npm run test` — expected count) · project docs map (specs/plans/PROGRESS).
- [ ] **WRITEUP sections:** problem framing · architecture decisions with reasoning · the tricky edge cases and how they're handled (threshold 0, tier boundaries, business days, preview=runtime, persistence) · AI-assisted workflow description (spec → plan → task-by-task with verification) · time spent breakdown · what I'd do with more time.
- [ ] Final `docs/PROGRESS.md` update: phase → submitted; Session Log entry.
- [ ] Commit — `docs: README, writeup, and demo script for submission` → push.

---

## Final Acceptance Sweep (run before calling it done)

| # | Spec criterion | How verified |
|---|---|---|
| 1 | 3 tenants differ on same claim | `/demo` live + seed-tenants.test.ts + E2E demo spec |
| 2 | Invalid config blocked | schema.test.ts + curl 400 + UI inline errors |
| 3 | Preview accurate | preview calls `/api/process-claim` (Network tab) |
| 4 | Diff complete, both directions | diff-configs.test.ts + SafeGuard-vs-GovHealth manual |
| 5 | History + rollback | Task 13 verify + version rows immutable |
| 6 | Tenant #4 zero-code + survives restart | E2E onboarding spec + Task 18 redeploy test |
| 7 | processClaim 5 outputs correct | process-claim.test.ts + worked example |
| 8 | Modularity | one schema/one engine/tab-per-section; writeup section |

Plus: `npm run test` all green · `npx playwright test` 8/8 green · `npx tsc --noEmit` clean · live URL in README.
