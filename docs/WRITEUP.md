# Writeup — Multi-Tenant Configuration Platform

## 1. Problem framing

An insurance platform must serve many insurers from one codebase, where each insurer
processes claims differently — different claim types, documents, approval rules,
notifications, SLAs, and custom fields — and the operations team must be able to onboard a
new insurer by filling out a form, with **no code change**.

The core decision falls out of that last requirement: if onboarding can't touch code, then
*everything that differs between tenants must be data*. So the design centers on a single
idea — **configuration is policy, code is mechanism**:

- A tenant's entire behaviour is one **configuration document**.
- One **schema** defines what a valid configuration is.
- One **pure engine** turns `(configuration, claim)` into an outcome.

Onboarding a fourth tenant is then not a feature — it's a row of data the engine already
knows how to read.

## 2. Architecture decisions (and why)

**One Zod schema, shared client + server.** The schema is the single source of truth for
what a valid config is, including cross-field rules (tiers strictly ascending, SLA only for
enabled claim types, threshold below the first tier, etc.). The client uses it for instant
inline validation; the server re-parses with the same schema so a direct API call can't
bypass the rules. One definition → the two sides can't disagree.

**A pure engine, reused everywhere.** `processClaim(config, claim)` performs no I/O and is
the only place claim logic lives. The runtime API, the preview page, the demo page, and the
unit tests all call it. This makes "preview accurately predicts processing" true *by
construction* — preview and runtime are the same function — rather than something to keep in
sync. Reading the config from the database and validating the claim shape happen at the API
boundary, so the engine stays a pure function over typed inputs.

**Versioned JSONB, forward-only.** The whole config is stored as a JSONB snapshot; every
save inserts a new version row and repoints the tenant's active version. Storing the config
as one document (rather than normalising into many tables) makes versioning, diff, and
rollback cheap document operations, and the schema — not foreign keys — guarantees
integrity. Rollback copies an old version *forward* as a new version, so history is never
rewritten (audit-safe, which matters in insurance).

**Neon (serverless Postgres).** The brief requires a tenant created through the UI to
survive restarts and redeploys. Data therefore has to live outside the (ephemeral)
serverless runtime. Prisma 7's Neon driver adapter is the idiomatic Vercel + Neon path.

**Modularity, demonstrated.** The brief uses "currency settings" as the example of adding a
new config dimension cheaply. It's implemented for real: a per-tenant `currency` is one
schema field, echoed by the engine, surfaced by one Branding control and a small
`formatMoney` helper — no routing or SLA logic touched. The size of that change is the
evidence.

## 3. The tricky edge cases, and how they're handled

- **Approval tier boundaries.** Tiers are stored as *strictly ascending upper bounds*, so
  overlaps and gaps are impossible by construction; ranges are derived. Boundaries are
  half-open: an amount exactly on a boundary belongs to the higher tier (e.g. exactly
  100,000 → the next tier up). This is a deliberate, documented rule, pinned by unit tests.
- **Auto-approval threshold of 0.** "Auto-approve under the threshold" means `amount <
  threshold`, so a threshold of `0` auto-approves nothing (no amount is `< 0`) — exactly the
  government tenant's "everything is manual" policy. The rule needs no special-casing; it
  just falls out of the comparison.
- **Business-day SLA math.** The deadline is N business days from submission, skipping
  weekends; a claim submitted on a weekend counts from the following Monday. It's an
  isolated, well-tested module (`addBusinessDays`), all in UTC to avoid timezone drift.
- **A threshold that strands the first tier.** A threshold at or above the first tier's
  upper bound would make that tier unreachable (dead config). The schema rejects it — a
  subtle rule found by cross-checking the brief's own tier example.
- **Preview = runtime.** Guaranteed by calling the same `/api/process-claim` and the same
  engine; the preview/demo never reimplement processing.
- **Stale data after a reset.** Deleting/recreating the demo tenants changes their ids; a
  page left open then points at ids that no longer exist. Every mutation (save, rollback,
  delete, demo run) handles the resulting 404 with a clear message and a path back to the
  tenant list, instead of a dead-end error.
- **Persistence.** Because config lives in Neon, onboarding a tenant through the UI survives
  redeploys.

## 4. Validation rules

Enforced by the shared schema on both client and server: at least one claim type enabled ·
auto-approval threshold ≥ 0 · threshold below the first tier bound · tiers strictly
ascending with exactly one unbounded final tier · required/optional documents disjoint per
claim type · enabled notification events have ≥ 1 channel · SLA positive and present for
exactly the enabled claim types · branding colours are hex and the logo is a URL · custom
field keys unique and `select` fields have ≥ 1 option.

## 5. How AI tooling was used

The whole project was built with an AI coding agent, directed through a deliberately
structured, plan-first workflow rather than ad-hoc prompting:

1. **Spec first.** A product design spec (`docs/superpowers/specs/`) fixed the data model,
   engine contract, validation rules, and the worked example *before* any code.
2. **Plan second.** A task-by-task implementation plan (`docs/superpowers/plans/`) broke the
   work into ~19 milestones, each with an explicit `Verify:` criterion.
3. **Execute with verification.** Each task was implemented, then verified (typecheck, lint,
   unit tests, end-to-end tests, and a screenshot for UI work) before moving on. Domain logic
   was written test-first.
4. **Durable state.** A live progress log with a decision record (`docs/PROGRESS.md`) kept
   the rationale for every non-obvious choice, so the work survived context resets and could
   always resume from a known point.

The most valuable part of directing the AI was insisting on **verifiable success criteria**
and **adversarial self-checking** — e.g. running the full flow against the live deployment
and a per-rule validation audit of every editor tab — which surfaced real issues (a stale-id
dead-end, a crash when a non-200 response reached a result panel, "view past versions" only
showing a diff) that were then fixed.

## 6. Effort

Roughly 13 hours across four milestones: scaffold, domain core (schema + engine, test-first),
persistence + API, admin UI (six pages), then hardening, end-to-end tests, deployment, and
docs. That is above the brief's 5–8h guideline — the extra went into test coverage (54 unit
+ 28 e2e + an integration test), error-state hardening, and polish (brand-matched UI,
versioned history with view/diff/rollback, a searchable compare page).

## 7. What I'd do with more time

- **Authentication & tenant-scoped access** — the one deliberate scope cut.
- **Public-holiday calendars** for SLA math (the schema already anticipates the dimension).
- **Active SLA-breach detection** and actual notification delivery (currently the engine
  returns the plan; delivery is out of scope).
- **A faster test database** for CI — the e2e suite is correct and deterministic but its
  wall-time is bound to cross-region Neon latency.
- **Element-level array diffing** (documents/tiers are currently compared atomically).
