# Project Progress

> Live state of the project. **Read this first in every session.**
> The Snapshot is overwritten after every completed task; the two logs are append-only.

## Snapshot

- **Phase:** M0 done → executing M1 (domain core, TDD)
- **Active plan:** `docs/superpowers/plans/2026-06-11-multi-tenant-platform.md` (19 tasks, 4 milestones, ~13h)
- **Last completed:** Task 1 — scaffold (Next 16.2.9 / React 19 / antd 6.4.3 / zod 4.4.3 / prisma 7.8.0 / vitest 4.1.8); toolchain verified (dev 200, test exit 0, tsc clean)
- **Next up:** Task 2 — config Zod schema (TDD); commits for completed tasks pending user approval
- **Blockers / open questions:** none — Neon project created, `DATABASE_URL` in local `.env` (gitignored)

## Decision Log

- 2026-06-11: Project docs live inside the repo under `docs/`, written in English — they double as evidence of a plan-first development workflow.
- 2026-06-11: Durable project state lives in git-tracked files, not session memory — it must survive context loss, session interruption, and machine/directory changes.
- 2026-06-11: Stack: Next.js (App Router) + TypeScript strict + Ant Design + hosted PostgreSQL + Zod shared schemas; deploy on Vercel. Hosted DB chosen because tenant #4 created through the UI must survive restarts/cold starts.
- 2026-06-11: A single `processClaim` engine powers both runtime and preview mode — two implementations would inevitably drift.
- 2026-06-11: Karpathy guidelines adopted as engineering discipline; every plan task carries a `Verify:` criterion.
- 2026-06-11: Tenant config stored as versioned JSONB snapshots (2 tables) — history/diff/rollback become cheap document operations; Zod owns integrity.
- 2026-06-11: Approval tiers stored as strictly ascending upper bounds (overlap/gap impossible by construction); half-open boundary semantics — a boundary amount belongs to the higher tier; `amount < threshold` auto-approves, so threshold 0 auto-approves nothing.
- 2026-06-11: One `/api/process-claim` endpoint serves runtime, preview, and demo page — preview accuracy guaranteed by construction.
- 2026-06-11: No auth (out of challenge scope, documented trade-off); "Reset demo data" re-seed action mitigates public-URL tampering.
- 2026-06-11: Neon chosen for hosted PostgreSQL; Prisma for schema/migrations.
- 2026-06-11: `processClaim` returns the full lifecycle notification plan (all enabled events), not just `claim_submitted`.
- 2026-06-11: Scope = all 8 acceptance criteria + selected differentiators (demo page "one claim three fates", business-day unit tests, branding-aware preview, reset/seed) — matches the 10–12h estimate communicated to the recruiter.
- 2026-06-11: Playwright E2E suite added (8 chromium specs, `workers: 1`, reset-demo in beforeAll) as plan Task 17 — covers admin flows unit tests cannot reach; accessible-name selectors only (AntD class names are unstable).
- 2026-06-12: antd v6 instead of the planned v5 — Next 16 ships React 19, which antd v5 only supports via a compat patch; v6 supports React 19 natively. Plan's AntD component mapping (ColorPicker, Select tags, Collapse, etc.) is unchanged in v6.
- 2026-06-12: `--passWithNoTests` added to the test script so the Task 1 verify criterion (exit 0 with zero tests) holds; remove it in Task 2 the moment the first real test file exists, so an empty test run can never silently pass again.
- 2026-06-12: Next 16 scaffold's `AGENTS.md` kept — it points agents at `node_modules/next/dist/docs/` for post-training-cutoff API changes; UI/API tasks must consult those docs.

## Session Log

- 2026-06-11 S1: Chose Challenge 15, initialized repo, designed and set up the session-resilient workflow. Next: product spec brainstorm.
