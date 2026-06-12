# Multi-Tenant Configuration Platform

An insurance claims platform that serves multiple insurers (tenants) from one codebase.
Each tenant's branding, claim types, document requirements, approval rules,
notifications, SLAs, and custom fields are **fully configurable through an admin UI —
onboarding a new insurer requires zero code changes**. A runtime engine then processes
every claim according to the submitting tenant's active configuration.

Built to the [AI Challenge 15 brief](https://github.com/papaya-insurtech/pumpkin/blob/main/AI_Engineering_Challenges/AI_Challenge_15.md).

> **Design philosophy:** configuration is *policy*, code is *mechanism*. A tenant's
> entire configuration is one JSON document validated by one schema; the runtime is a
> pure function over that document.

## Status

Active development. The domain core and the persistence layer are complete and tested;
the HTTP API and admin UI are next.

| Area | Status |
|------|--------|
| Config schema + cross-field validation (Zod) | ✅ Done |
| Runtime engine `processClaim` (pure, fully tested) | ✅ Done |
| Business-day SLA calculator · deep-diff · seed tenants | ✅ Done |
| Versioned persistence (Prisma 7 + Neon) | ✅ Done |
| REST API (CRUD · process-claim · versions · rollback) | 🔄 Next |
| Admin UI (editor · preview · diff · history) | ⏳ Planned |
| Deployment (Vercel) + demo | ⏳ Planned |

## Architecture

- **One config document per tenant**, validated by **one Zod schema** shared by client
  and server — invalid configurations (no enabled claim type, negative SLA, overlapping
  approval tiers, a threshold that strands the first tier, …) are rejected on both sides,
  even when the API is called directly.
- **One pure engine.** `processClaim(config, claim)` performs no I/O; the API, the
  preview screen, the demo page, and the unit tests all call the same function, so
  preview can never drift from runtime.
- **Versioned, forward-only persistence.** Every save writes a new immutable JSONB
  version row and repoints the tenant's active version; history, diff, and rollback are
  cheap reads, and rollback creates a *new* version rather than rewriting history
  (audit-safe).
- **Serverless-durable database.** Prisma 7 with the Neon serverless driver adapter — a
  tenant created through the UI survives restarts, cold starts, and redeploys.

### One claim, three outcomes

The same claim (`OUTPATIENT`, amount 12,000, submitted Friday 2026-06-12) routed through
the three seeded tenants:

|  | SafeGuard (corporate) | HealthFirst (retail) | GovHealth (government) |
|--|--|--|--|
| Approval | Auto-approved (< 20,000) | Assessor (≥ 5,000) | Committee (threshold 0 — nothing auto-approves) |
| Documents | Medical receipt | Medical receipt | Medical receipt + Referral letter |
| Notifications | email | email + SMS | email + webhook |
| SLA deadline | +5 business days → 2026-06-19 | +7 → 2026-06-23 | +15 → 2026-07-03 |
| Custom fields | Employee ID required | none | Department + Budget Code required |

Three edge cases this encodes: business-day math skips weekends; a boundary amount
belongs to the higher tier (half-open intervals); an auto-approval threshold of `0`
means nothing is auto-approved.

## Tech stack

Next.js (App Router) · TypeScript (strict) · Ant Design · Zod · Prisma 7 + Neon
(PostgreSQL) · Vitest · Vercel.

## Getting started

### Prerequisites

- Node.js 20+
- A Neon PostgreSQL database (free tier) — use its **pooled** connection string.

### Setup

```bash
npm install                    # postinstall runs `prisma generate`

cp .env.example .env           # then set DATABASE_URL to your Neon pooled connection string

npx prisma migrate dev         # apply the schema to your database
npx prisma generate            # Prisma 7 does not auto-run this after migrate
```

### Run

```bash
npm run test                   # unit suite (41 tests)
npm run dev                    # dev server at http://localhost:3000
```

## Project structure

```
src/lib/
  config/   # Zod config schema (single source of truth), seed tenants, fixtures
  engine/   # processClaim (pure runtime) + business-day calculator
  diff/     # generic deep-diff used for config comparison
  db/       # Prisma 7 client wired to the Neon serverless adapter
prisma/     # schema + migrations
docs/       # product spec, implementation plan, live progress log
```

## Testing

`npm run test` runs the Vitest suite (41 tests) covering the schema validation rules,
the engine's boundary semantics (tier boundaries, threshold 0, disabled claim types,
custom-field validation), business-day math across weekends, the generic deep-diff, and
the three-tenant worked example above.

## Documentation

- [docs/PROGRESS.md](docs/PROGRESS.md) — live project state and decision log
- [docs/superpowers/specs/](docs/superpowers/specs/) — product design spec
- [docs/superpowers/plans/](docs/superpowers/plans/) — implementation plan with per-task verification
