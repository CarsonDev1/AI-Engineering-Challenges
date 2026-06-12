# Product Design — Multi-Tenant Configuration Platform

**Date:** 2026-06-11
**Status:** Approved
**References:** [Challenge brief](https://github.com/papaya-insurtech/pumpkin/blob/main/AI_Engineering_Challenges/AI_Challenge_15.md) · [Project workflow design](2026-06-11-project-workflow-design.md)

## 1. Overview

An insurance platform that serves multiple insurance companies (tenants). Each tenant's
claim processing behavior — branding, claim types, document requirements, approval
rules, notifications, SLA, custom fields — is fully defined by configuration, editable
through an admin UI. A runtime engine processes claims differently based on the active
tenant configuration. Onboarding a new tenant requires zero code changes.

**Design philosophy:** configuration is *policy*, code is *mechanism*. The entire
tenant config is one JSON document validated by one Zod schema; the engine is a pure
function over that document.

## 2. Non-Goals

- Authentication — out of challenge scope; mitigated with a "Reset demo data" action
  (documented trade-off).
- Actually sending email/SMS/webhooks — the engine returns *which* notifications would
  fire; delivery is out of scope.
- Holiday calendars for business-day math — weekends only; the schema leaves room for
  a future holiday-calendar dimension.
- Currency settings — listed as a candidate future config dimension; implemented only
  if time remains after all acceptance criteria pass.
- i18n. English-only UI.

## 3. Architecture

```
Admin UI (Next.js App Router + Ant Design, TypeScript strict)
   │  fetch — Zod-validated on both sides
API route handlers (CRUD tenants/versions · process-claim · reset-demo)
   │                                  │
Neon PostgreSQL (Prisma, 2 tables)    lib/engine — processClaim(config, claim)
                                      PURE FUNCTION, no IO
```

Key invariant: **one engine**. The runtime API, the preview UI, the demo page, and the
unit tests all call the same `processClaim` function. Preview cannot drift from runtime
by construction.

## 4. Data Model

```sql
tenants( id uuid PK, slug text UNIQUE, active_version_id uuid, created_at timestamptz )
tenant_config_versions( id uuid PK, tenant_id uuid FK, version_no int,
                        config jsonb, note text, created_at timestamptz,
                        UNIQUE(tenant_id, version_no) )
```

Every save inserts a new version row and repoints `active_version_id`. Nothing is ever
updated in place or deleted — the version table is the audit trail.

### TenantConfig schema (Zod — single source of truth, shared client/server)

```ts
TenantConfig = {
  branding: { companyName: string, logoUrl: string (url), primaryColor: hex, secondaryColor: hex },
  claimTypes: Partial<Record<'OUTPATIENT'|'INPATIENT'|'DENTAL'|'MATERNITY'|'OPTICAL', {
    enabled: boolean,
    requiredDocuments: string[],   // disjoint from optionalDocuments
    optionalDocuments: string[],
  }>>,
  approval: {
    autoApprovalThreshold: number,        // >= 0
    tiers: Array<{ upTo: number | null,   // strictly ascending; last tier upTo = null (∞)
                   role: string }>,
  },
  notifications: Partial<Record<'claim_submitted'|'approved'|'rejected'|'payment_sent', {
    enabled: boolean,
    channels: Array<'email'|'sms'|'webhook'>,  // >= 1 when enabled
    emailTemplate?: string,                     // custom override; default used when absent
  }>>,
  sla: {
    businessDaysByClaimType: Partial<Record<ClaimType, number>>,  // > 0, only for enabled types
    escalation: { notifyRole: string },
  },
  customFields: Array<{ key: string (unique), label: string,
                        type: 'text'|'number'|'date'|'select',
                        required: boolean, options?: string[] /* select only */ }>,
}
```

### Approval tier semantics (decision)

Tiers are stored as a list of **strictly ascending upper bounds**; ranges are derived,
so overlaps and gaps are impossible by construction. Boundary rule — half-open
intervals, boundary belongs to the higher tier:

- `amount < autoApprovalThreshold` → auto-approved. Threshold `0` means **nothing**
  is auto-approved (no amount is `< 0`).
- Otherwise the first tier with `amount < upTo` applies; the final tier
  (`upTo: null`) catches everything else.
- Example (SafeGuard): threshold 20,000; tiers assessor `<100,000`, team_lead
  `<500,000`, director `∞`. Amount exactly 20,000 → assessor (not auto). Amount
  exactly 100,000 → team_lead.

## 5. Engine — `processClaim`

```ts
processClaim(config: TenantConfig, claim: ClaimInput): ProcessClaimResult

ClaimInput = { claimType: ClaimType, amount: number,
               submittedAt: string /* ISO date */,
               customFieldValues: Record<string, unknown> }

ProcessClaimResult =
  | { ok: false, errors: Array<{ code: 'CLAIM_TYPE_NOT_ENABLED'|'INVALID_AMOUNT'
        |'MISSING_CUSTOM_FIELD'|'INVALID_CUSTOM_FIELD', field?: string, message: string }> }
  | { ok: true,
      requiredDocuments: string[], optionalDocuments: string[],
      approval: { route: 'AUTO_APPROVED' }
               | { route: 'MANUAL', role: string, tierIndex: number },
      notifications: Array<{ event: NotificationEvent, channels: Channel[],
                             template: 'custom' | 'default' }>,
      slaDeadline: string /* ISO date */,
      escalation: { notifyRole: string } }
```

Rules:
- Disabled or absent claim type → structured error, never a crash or empty result.
- `slaDeadline = addBusinessDays(submittedAt, sla.businessDaysByClaimType[type])` —
  `addBusinessDays` is a separate, unit-tested module that skips Saturdays and Sundays.
- Custom field validation: required fields must be present and type-valid; errors name
  the exact field.
- Amount must be a positive finite number.
- `notifications` is the **full notification plan for the claim lifecycle** — one entry
  per enabled event with its channels and template source — not just the
  `claim_submitted` event. This is what "which notifications fire" means for preview.

### Worked acceptance example — "one claim, three fates"

Claim `OUTPATIENT, 12,000, submitted Friday 2026-06-12`:

| | SafeGuard | HealthFirst | GovHealth |
|---|---|---|---|
| Routing | `12,000 < 20,000` → AUTO_APPROVED | assessor (≥ 5,000) | committee (threshold 0) |
| Documents | Medical receipt | Medical receipt | Medical receipt + Referral letter |
| Notifications | email | email + sms | email + webhook |
| SLA deadline | +5 bd → 2026-06-19 (Fri) | +7 bd → 2026-06-23 (Tue) | +15 bd → 2026-07-03 (Fri) |
| Custom fields | Employee ID missing → error | none → ok | Department, Budget Code missing → error |

These exact values become integration test assertions.

## 6. API Surface

| Method & path | Purpose |
|---|---|
| `GET/POST /api/tenants` | List / create tenant (create seeds version 1) |
| `GET /api/tenants/:id` | Tenant + active config |
| `PUT /api/tenants/:id/config` | Save config → **server-side Zod parse** → new version |
| `DELETE /api/tenants/:id` | Delete tenant |
| `GET /api/tenants/:id/versions` | Version history |
| `POST /api/tenants/:id/rollback` | `{versionId}` → copy old config as a **new** version |
| `POST /api/process-claim` | `{tenantId, claim}` → engine result. **Single endpoint used by runtime consumers, preview UI, and demo page.** |
| `POST /api/reset-demo` | Re-seed the three sample tenants |

All write endpoints validate with the shared Zod schema; invalid payloads return 400
with field-level errors regardless of what the UI allowed.

## 7. Admin UI (Ant Design)

| Page | Content |
|---|---|
| `/` | Tenant cards (branding colors), create, **Reset demo data** |
| `/tenants/[id]` | Config editor — six tabs (Branding, Claim Types & Documents, Approval, Notifications, SLA, Custom Fields); Save = new version with optional note |
| `/tenants/[id]/preview` | Sample-claim form → result panel rendered in the tenant's branding |
| `/tenants/[id]/history` | Version list, view old config, diff vs current, rollback |
| `/diff` | Pick two tenants → side-by-side deep diff grouped by config section |
| `/demo` | One claim form → three result columns, one per tenant, each in its own branding |

## 8. Validation Rules (Zod refinements, enforced on both sides)

1. At least one claim type enabled.
2. `autoApprovalThreshold >= 0`.
3. Tier bounds strictly ascending; exactly one final tier with `upTo: null`; every tier has a role.
4. SLA days positive, configured only for enabled claim types; every enabled claim type has an SLA.
5. `requiredDocuments` ∩ `optionalDocuments` = ∅ per claim type.
6. Enabled notification events have ≥ 1 channel.
7. Branding colors are valid hex; logo URL is a valid URL.
8. Custom field keys unique; `select` fields have ≥ 1 option.
9. `autoApprovalThreshold` strictly below the first tier's upper bound (when bounded) —
   a threshold at or above it would make the first tier unreachable (dead tier).
   _(Added 2026-06-12 after cross-checking the brief's tier example.)_

## 9. Config Diff

One generic utility: `diff(a, b) → Array<{ path, kind: 'added'|'removed'|'changed', left?, right? }>`
— recursive over objects/arrays, reports both directions. Reused for tenant-vs-tenant
(`/diff`) and version-vs-current (`/tenants/[id]/history`). Unit-tested against nested
fixtures (documents inside one claim type, tier changes, channel changes).

## 10. Versioning & Rollback Semantics

- Save → version `n+1`, `active_version_id` repointed.
- Rollback to version `k` → **new** version `n+1` whose config is a copy of `k`'s
  (note: "rollback to v{k}"). History is never rewritten — forward-only, audit-safe.
- Runtime and preview always read the active version. Old versions are read-only.

## 11. Seed Data (exact per challenge brief)

**SafeGuard Insurance (corporate):** OUTPATIENT (req: Medical receipt; opt: Prescription),
INPATIENT (req: Discharge summary, Itemized bill, Medical receipt), DENTAL (req: Dental
receipt; opt: Treatment plan). Threshold 20,000. Tiers: assessor <100,000 · team_lead
<500,000 · director ∞. Email only, all four events. SLA: OP 5 · IP 10 · DENTAL 5 bd;
escalation → operations_manager. Custom field: Employee ID (text, required).

**HealthFirst (retail):** all five claim types (OPTICAL req: Optical receipt,
Prescription; MATERNITY req: Medical receipt, Delivery summary). Threshold 5,000.
Tiers: assessor <50,000 · manager ∞. Email + SMS. SLA 7 bd all types; escalation →
support_lead. No custom fields.

**GovHealth (government):** OUTPATIENT (req: Medical receipt, Referral letter),
INPATIENT (req: Medical receipt, Discharge summary, Hospital certificate). Threshold
**0** (everything manual). Single tier: committee ∞. Email + webhook. SLA 15 bd all
types; escalation → department_supervisor. Custom fields: Department (text, required),
Budget Code (text, required).

The seed script powers both initial deployment and `POST /api/reset-demo`.

## 12. Testing Strategy (Vitest unit + Playwright E2E)

- **Engine:** auto vs manual at `amount = threshold`; boundary `amount = upTo`;
  threshold 0; disabled claim type; missing/invalid custom fields; notification
  template fallback; full worked example above as integration-style assertions.
- **addBusinessDays:** Friday +5 → next Friday; submission on Saturday/Sunday;
  long spans crossing multiple weekends.
- **Diff:** nested adds/removes/changes in both directions.
- **Schema refinements:** each of the 8 validation rules has a rejecting fixture.
- **Versioning:** save increments version; rollback creates a new version with copied
  config and leaves history intact.

**End-to-end (Playwright, chromium, ~8 specs against the local dev server):** home lists
the three seeds after reset · editor save creates a new version · invalid config blocked
inline · preview reproduces the §5 worked example · demo page renders three different
fates · diff highlights SafeGuard-vs-GovHealth differences · rollback restores previous
behavior in preview · tenant #4 onboards through the UI with zero code and processes a
claim. The suite calls `POST /api/reset-demo` in `beforeAll` and runs with `workers: 1`
so runs are deterministic.

## 13. Deployment

Vercel (app) + Neon (PostgreSQL, persists across deploys/cold starts — required so a
tenant created through the UI survives until graded). Prisma for schema/migrations.
Env: `DATABASE_URL`. Seed via script locally and `reset-demo` endpoint in production.

## 14. Acceptance Criteria Mapping

| Challenge criterion | Demonstrated by |
|---|---|
| 3 tenants → different behavior, same claim | `/demo` page + worked-example tests |
| UI validates and blocks invalid config | Zod refinements client+server, 400 with field errors |
| Preview predicts processing accurately | Preview calls the same `/api/process-claim` as runtime |
| Diff identifies all differences | Generic deep-diff + nested fixtures tests |
| History & rollback work | Forward-only versioning + tests |
| 4th tenant with zero code changes | Create via UI → process claim immediately; survives restart (Neon) |
| `processClaim` returns correct results | Engine unit tests incl. boundary semantics |
| Modular — new config dimension cheap | One schema + one engine + tab-per-section UI; documented in writeup |
