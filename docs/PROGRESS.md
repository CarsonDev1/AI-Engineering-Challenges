# Project Progress

> Live state of the project. **Read this first in every session.**
> The Snapshot is overwritten after every completed task; the two logs are append-only.

## Snapshot

- **Phase:** Workflow setup complete → next: product spec (brainstorm)
- **Active plan:** none yet (created after the product spec is approved)
- **Last completed:** Session-resilient workflow designed and set up (CLAUDE.md, PROGRESS.md, workflow design doc)
- **Next up:** Brainstorm and write the product spec for Challenge 15 (config schema, admin UI, runtime engine, deployment)
- **Blockers / open questions:** none

## Decision Log

- 2026-06-11: Project docs live inside the repo under `docs/`, written in English — they double as evidence of a plan-first development workflow.
- 2026-06-11: Durable project state lives in git-tracked files, not session memory — it must survive context loss, session interruption, and machine/directory changes.
- 2026-06-11: Stack: Next.js (App Router) + TypeScript strict + Ant Design + hosted PostgreSQL + Zod shared schemas; deploy on Vercel. Hosted DB chosen because tenant #4 created through the UI must survive restarts/cold starts.
- 2026-06-11: A single `processClaim` engine powers both runtime and preview mode — two implementations would inevitably drift.
- 2026-06-11: Karpathy guidelines adopted as engineering discipline; every plan task carries a `Verify:` criterion.

## Session Log

- 2026-06-11 S1: Chose Challenge 15, initialized repo, designed and set up the session-resilient workflow. Next: product spec brainstorm.
