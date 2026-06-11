# Project Progress

> Live state of the project. **Read this first in every session.**
> The Snapshot is overwritten after every completed task; the two logs are append-only.

## Snapshot

- **Phase:** Implementation plan ready → next: execute Task 1 (scaffold)
- **Active plan:** `docs/superpowers/plans/2026-06-11-multi-tenant-platform.md` (18 tasks, 4 milestones, ~12h)
- **Last completed:** Implementation plan written and self-reviewed
- **Next up:** Execute Task 1 — scaffold Next.js + toolchain (fresh session recommended for execution)
- **Blockers / open questions:** Neon account needed at Task 7 (manual step)

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

## Session Log

- 2026-06-11 S1: Chose Challenge 15, initialized repo, designed and set up the session-resilient workflow. Next: product spec brainstorm.
