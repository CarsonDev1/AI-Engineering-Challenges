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

- [ ] **Step 6: Commit**

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
- [ ] **Step 5: Commit** — `feat: tenant config schema with cross-field validation rules`

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
- [ ] **Step 5: Commit** — `feat: business-day calculator`

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
- [ ] **Step 5: Commit** — `feat: generic deep-diff for configs`

### Task 5: `processClaim` engine

**Files:** Create: `src/lib/engine/process-claim.ts`, `src/lib/engine/process-claim.test.ts`
**Verify:** all boundary cases below pass, including the spec's worked example numbers.

- [ ] **Step 1: Failing tests** (uses `validConfig` exported from schema.test or a local fixture; threshold 20000, tiers assessor<100000/director∞, OUTPATIENT enabled, SLA 5, employeeId required)

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

- [ ] **Step 2: Run — FAIL**
- [ ] **Step 3: Implement**

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

- [ ] **Step 4: Run — PASS** · **Step 5: Commit** — `feat: processClaim engine with boundary semantics`

### Task 6: Seed data — three tenants + worked-example integration test

**Files:** Create: `src/lib/config/seed-tenants.ts`, `src/lib/config/seed-tenants.test.ts`
**Verify:** all 3 seed configs pass `tenantConfigSchema`; the spec §5 worked example asserts exactly (SafeGuard AUTO/2026-06-19 · HealthFirst assessor/2026-06-23 · GovHealth committee/2026-07-03).

- [ ] **Step 1: Failing tests**

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

- [ ] **Step 2: Run — FAIL**
- [ ] **Step 3: Implement `SEED_TENANTS`** — `Array<{ slug, name, config: TenantConfig }>` with the exact spec §11 data: safeguard (threshold 20000; tiers assessor<100000, team_lead<500000, director∞; email all 4 events; SLA OP5/IP10/DENTAL5; employeeId required), healthfirst (all 5 types; threshold 5000; assessor<50000, manager∞; email+sms; SLA 7 all; no custom fields), govhealth (OP+IP; threshold 0; committee∞; email+webhook; SLA 15; department + budgetCode required). Document lists per spec §11 verbatim.

- [ ] **Step 4: Run — PASS** · **Step 5: Commit** — `feat: seed tenant configs matching the challenge brief`

---

## Milestone 2 — Persistence + API

### Task 7: Prisma schema + Neon connection

**Files:** Create: `prisma/schema.prisma`, `src/lib/db/prisma.ts`, `.env.example`; Modify: `.gitignore` (ensure `.env` ignored — already present)
**Verify:** `npx prisma migrate dev --name init` succeeds against the Neon DB; `npx prisma studio` shows both tables.

- [ ] **Step 1: Create Neon project** (manual): neon.tech → new project `multi-tenant-config-platform` → copy connection string into `.env` as `DATABASE_URL`. Create `.env.example` with `DATABASE_URL="postgresql://user:pass@host/db?sslmode=require"`.

- [ ] **Step 2: `prisma/schema.prisma`**

```prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "postgresql", url = env("DATABASE_URL") }

model Tenant {
  id              String                @id @default(uuid())
  slug            String                @unique
  name            String
  activeVersionId String?
  versions        TenantConfigVersion[]
  createdAt       DateTime              @default(now())
}

model TenantConfigVersion {
  id        String   @id @default(uuid())
  tenantId  String
  tenant    Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  versionNo Int
  config    Json
  note      String?
  createdAt DateTime @default(now())

  @@unique([tenantId, versionNo])
}
```

- [ ] **Step 3: `src/lib/db/prisma.ts`** — standard singleton

```ts
import { PrismaClient } from '@prisma/client';
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

- [ ] **Step 4: Migrate + verify** — `npx prisma migrate dev --name init` → success. Commit: `feat: prisma schema for tenants and config versions`

### Task 8: Tenant repository (versioning semantics live here)

**Files:** Create: `src/lib/db/tenant-repo.ts`
**Verify:** exercised through API tests in Task 9 + version-numbering rules visible in code review; rollback NEVER mutates old rows.

- [ ] **Step 1: Implement** — all config writes go through `createVersion`:

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

- [ ] **Step 2: Typecheck + Commit** — `feat: tenant repository with forward-only versioning`

### Task 9: API route handlers (server-side validation chokepoint)

**Files:** Create: `src/app/api/tenants/route.ts`, `src/app/api/tenants/[id]/route.ts`, `src/app/api/tenants/[id]/config/route.ts`, `src/app/api/tenants/[id]/versions/route.ts`, `src/app/api/tenants/[id]/rollback/route.ts`, `src/app/api/process-claim/route.ts`, `src/app/api/reset-demo/route.ts`
**Verify:** curl sequence below returns expected statuses/bodies; invalid config → 400 with Zod issues even when sent directly (bypassing UI).

- [ ] **Step 1: Implement handlers.** Pattern (config save — the critical one):

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

- [ ] **Step 2: Verify with curl** (`npm run dev` running):

```powershell
curl -s -X POST localhost:3000/api/reset-demo                                    # → 3 tenants
curl -s localhost:3000/api/tenants                                               # → safeguard, healthfirst, govhealth
curl -s -X POST localhost:3000/api/process-claim -H "Content-Type: application/json" `
  -d '{"tenantId":"<safeguard-id>","claim":{"claimType":"OUTPATIENT","amount":12000,"submittedAt":"2026-06-12","customFieldValues":{"employeeId":"E-1"}}}'
# → ok:true, approval AUTO_APPROVED, slaDeadline 2026-06-19
# PUT config with threshold -5 → 400 with Zod issues
```

- [ ] **Step 3: Commit** — `feat: REST API with server-side Zod validation`

---

## Milestone 3 — Admin UI (Ant Design)

UI tasks share these conventions: client components under `src/components/`, AntD `App` + `ConfigProvider` in `src/app/layout.tsx`, data fetching via plain `fetch` to the API (no extra state library — YAGNI), `message.success/error` feedback on every mutation.

### Task 10: App shell + tenant list + create + reset demo

**Files:** Create: `src/app/layout.tsx` (AntD registry/provider), `src/app/page.tsx`, `src/components/TenantCard.tsx`, `src/components/CreateTenantModal.tsx`
**Verify:** `/` lists 3 seeded tenants as cards tinted with each tenant's `primaryColor`; Create modal makes tenant with a minimal valid default config; Reset Demo restores the 3 seeds and leaves other tenants untouched.

- [ ] Tenant card shows: name, slug, enabled claim types as tags, links Edit/Preview/History. Create modal asks name + slug only and posts a sane default config (OUTPATIENT enabled, threshold 0, single tier `assessor`/∞, claim_submitted email, SLA 5, no custom fields) — everything else is edited later in the editor.
- [ ] Commit — `feat: tenant list page with create and reset-demo`

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

- [ ] Commit — `feat: six-tab tenant config editor with client-side validation`

### Task 12: Preview page (branding-aware)

**Files:** Create: `src/app/tenants/[id]/preview/page.tsx`, `src/components/ClaimForm.tsx`, `src/components/ProcessResultPanel.tsx`, `src/components/BrandingFrame.tsx`
**Verify:** claim form renders only the tenant's enabled claim types + that tenant's custom fields (dynamic); submitting calls `POST /api/process-claim` (the runtime endpoint — check Network tab) and renders all 5 result parts inside a frame using the tenant's logo + colors; a disabled-type or missing-field claim shows the structured errors, not a crash.

`ProcessResultPanel` sections: Documents (required/optional lists) · Approval (AUTO badge or role + tier) · Notifications (event → channel tags + template source) · SLA deadline (date + "N business days") · Escalation. `ClaimForm` and `ProcessResultPanel` are shared with the demo page (Task 15) — build them tenant-parameterized.

- [ ] Commit — `feat: branding-aware preview mode calling the runtime endpoint`

### Task 13: History page — versions, view, diff vs current, rollback

**Files:** Create: `src/app/tenants/[id]/history/page.tsx`, `src/components/VersionDiffDrawer.tsx`
**Verify:** every save in Task 11 appears as a version row (no, note, date); "Diff vs current" opens a drawer listing `diffConfigs(version, current)` entries grouped by top-level section; Rollback creates a NEW version (note `rollback to vN`) — old rows unchanged; preview immediately reflects the rolled-back config.

- [ ] Commit — `feat: config history with diff and forward-only rollback`

### Task 14: Tenant-vs-tenant diff page

**Files:** Create: `src/app/diff/page.tsx`, `src/components/DiffTable.tsx` (shared with Task 13's drawer)
**Verify:** select SafeGuard vs GovHealth → table shows ALL differences both directions (e.g. `claimTypes.DENTAL` removed, `customFields` changed, threshold changed, channels changed), grouped by section with added/removed/changed color coding; selecting the same tenant twice → "No differences".

- [ ] Commit — `feat: side-by-side tenant config diff`

### Task 15: Demo page — "one claim, three fates"

**Files:** Create: `src/app/demo/page.tsx`
**Verify:** one shared claim form (OUTPATIENT, amount, date) + per-tenant custom-field inputs prefilled with valid values; Submit fires the SAME claim to `/api/process-claim` for all three seed tenants; three result columns render in each tenant's branding showing different routing/notifications/SLA — the spec §5 table reproduced live. A "Clear custom fields" toggle demonstrates per-tenant validation errors.

- [ ] Commit — `feat: one-claim-three-fates demo page`

---

## Milestone 4 — Hardening, deploy, submission docs

### Task 16: Error-state hardening pass

**Files:** Modify: API handlers (404/400 paths), `src/components/ProcessResultPanel.tsx`, editor save flow
**Verify:** each row of this checklist behaves as stated — (1) process-claim with unknown tenantId → 404 JSON, UI shows friendly error; (2) PUT config bypassing UI with overlapping documents → 400 + issues array; (3) deleting a tenant then visiting its pages → redirect to `/` with message; (4) claim MATERNITY to SafeGuard via demo/preview → structured CLAIM_TYPE_NOT_ENABLED rendered as an alert, never a blank panel; (5) empty tenant list (before seed) → empty-state with "Reset demo data" call-to-action.

- [ ] Walk the checklist manually, fix gaps, add a regression test where the gap was in `lib/` logic.
- [ ] Commit — `fix: harden error states across API and UI`

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
