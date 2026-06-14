# Demo Script

A ~6-minute walkthrough that hits every capability. Works on the live URL
(https://ai-engineering-challenges.vercel.app) or locally (`npm run dev`).

> Tip: there's an automated, slow-motion version of this tour you can run on a local server —
> `node test-results/demo-walkthrough.mjs` (opens a real browser and clicks through it).

---

## 0. Set the stage (10s)
- Open the app. If the list is empty, click **Reset demo data** → three insurers appear:
  **SafeGuard** (corporate, blue), **HealthFirst** (retail, green), **GovHealth**
  (government, purple). Each card is rendered in that tenant's own brand colour.

> One line to say it: *"Three insurers, one codebase. Everything that differs between them
> is configuration, not code."*

## 1. The headline — one claim, three fates (60s)
- Top nav → **Demo**.
- Leave the claim as `OUTPATIENT`, amount `12000`; click **Process for all three**.
- Three columns light up, each in its tenant's branding, with **different outcomes from the
  same claim**:
  - **SafeGuard** → Auto-approved · SLA 2026-06-19 · email
  - **HealthFirst** → Manual review · assessor · SLA 2026-06-23 · email + SMS
  - **GovHealth** → Manual review · committee · SLA 2026-07-03 · email + webhook
- Toggle **Clear custom fields** → Process again: SafeGuard and GovHealth now show
  structured "missing required field" errors; HealthFirst (no custom fields) still processes.

> *"Same claim, three different routings, SLAs, notifications, and required fields — purely
> from each tenant's config. No `if (tenant === …)` anywhere in the code."*

## 2. Configure a tenant (90s)
- Top nav → **Tenants** → on the SafeGuard card click **Edit**.
- Walk the six tabs: **Branding** (colours, logo, currency), **Claim Types & Documents**
  (toggle a type, edit required/optional documents), **Approval** (auto-approval threshold +
  tiers), **Notifications** (events × channels + custom template), **SLA** (business days per
  enabled type), **Custom Fields**.
- Show validation live: on **Approval**, set a tier's upper bound below the one above it → an
  inline *"Tier bounds must be strictly ascending"* error appears immediately. Fix it.
- On **Approval**, change the auto-approval threshold `20000 → 25000`, type a note ("raise
  auto-approval to 25k"), click **Save configuration** → toast confirms a new version.

> *"The same Zod schema validates here in the browser and again on the server — you can't
> save (or POST) an invalid config."*

## 3. Preview (45s)
- Back to **Tenants** → SafeGuard card → **Preview**.
- Enter Employee ID `E-1001`, click **Process claim** → the result panel renders in
  SafeGuard's branding: approval routing, required documents, notifications, SLA deadline,
  escalation.
- (Optional) open the browser Network tab to show it calls `POST /api/process-claim` — the
  *same* endpoint the runtime uses, so preview can't drift from production.

## 4. Compare two tenants (30s)
- Top nav → **Compare**.
- Pick **SafeGuard** and **GovHealth** → a side-by-side diff grouped by section highlights
  every difference (claim types, threshold, channels, custom fields, documents…).
- Pick the same tenant twice → *"No differences."*

## 5. History — view, diff, rollback (60s)
- **Tenants** → SafeGuard → **History**. You'll see the versions you saved.
- **View** a past version → its full configuration, read-only.
- **Diff vs current** → exactly what changed.
- **Roll back** an older version → it creates a *new* version ("rollback to vN"); older rows
  are untouched. Re-run the preview/demo to show the behaviour reverted.

> *"Rollback is forward-only — history is an audit trail, never rewritten."*

## 6. Onboard a 4th tenant — zero code (45s)
- **Tenants** → **New tenant** → name `Aurora Health`, slug `aurora-health` → **Create**.
- The new tenant appears immediately and can process claims right away — open its **Preview**
  and run one.
- (Optional) open its editor → **Branding** → change **Currency** → Save: a new config
  dimension flowing end to end with no code change.

> *"Onboarding a new insurer was a form, not a deploy. And because it's stored in Neon, it
> survives the next redeploy."*

## 7. Delete (15s)
- On the Aurora Health card, click **Delete** → confirm. CRUD is complete.

---

## The three seeded tenants (reference)

| | SafeGuard (corporate) | HealthFirst (retail) | GovHealth (government) |
|--|--|--|--|
| Claim types | OUTPATIENT, INPATIENT, DENTAL | all five | OUTPATIENT, INPATIENT |
| Auto-approval | 20,000 | 5,000 | 0 (all manual) |
| Tiers | assessor · team_lead · director | assessor · manager | committee |
| Notifications | email | email + SMS | email + webhook |
| SLA | OP 5 / IP 10 / DENTAL 5 days | 7 days | 15 days |
| Custom fields | Employee ID | — | Department, Budget Code |
