# Project Progress

> Live state of the project. **Read this first in every session.**
> The Snapshot is overwritten after every completed task; the two logs are append-only.

## Snapshot

- **Phase:** M2 (persistence + API) **complete — 3 of 3 tasks done**; next milestone M3 (admin UI, Ant Design)
- **Active plan:** `docs/superpowers/plans/2026-06-11-multi-tenant-platform.md` (19 tasks, 4 milestones, ~13h)
- **Last completed:** Task 9 — 7 API route handlers (tenants CRUD · config PUT (Zod chokepoint) · versions · rollback · single `process-claim` · `reset-demo`), `claimInputSchema` (TDD'd, 5 tests), and repo helpers (`getTenant`/`deleteTenant`/`reseedDemoTenants`). Verified end-to-end on the real Next 16 server + Neon (reset seeds 3 · worked example for safeguard+govhealth · invalid config→400 with issues · malformed claim→400). `tsc --noEmit` clean, unit suite **46**. Task 8 committed & pushed (HEAD `e3baa25`); Task 9 commit pending user approval.
- **Next up:** Task 10 — app shell (AntD `App`/`ConfigProvider` in `layout.tsx`) + tenant list page (`/`) with branding-tinted cards, Create-tenant modal, and a Reset-demo button. Starts M3.
- **Blockers / open questions:** none. (`@prisma/streams-local` warns it wants Node ≥22; we're on Node 20.19 — only affects `prisma dev`'s local server, not migrate/generate/runtime. Revisit if Vercel build complains.)

## Decision Log

- 2026-06-11: Project docs live inside the repo under `docs/`, written in English — they are the durable record of a plan-first development workflow.
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
- 2026-06-11: Scope = all 8 acceptance criteria + selected enhancements (demo page "one claim three fates", business-day unit tests, branding-aware preview, reset/seed) — fits the committed 10–12h delivery estimate.
- 2026-06-11: Playwright E2E suite added (8 chromium specs, `workers: 1`, reset-demo in beforeAll) as plan Task 17 — covers admin flows unit tests cannot reach; accessible-name selectors only (AntD class names are unstable).
- 2026-06-12: antd v6 instead of the planned v5 — Next 16 ships React 19, which antd v5 only supports via a compat patch; v6 supports React 19 natively. Plan's AntD component mapping (ColorPicker, Select tags, Collapse, etc.) is unchanged in v6.
- 2026-06-12: `--passWithNoTests` added to the test script so the Task 1 verify criterion (exit 0 with zero tests) holds; remove it in Task 2 the moment the first real test file exists, so an empty test run can never silently pass again.
- 2026-06-12: Next 16 scaffold's `AGENTS.md` kept — it points agents at `node_modules/next/dist/docs/` for post-training-cutoff API changes; UI/API tasks must consult those docs.
- 2026-06-12: Validation rule 9 added to spec §8 and plan Task 2 — `autoApprovalThreshold` must be strictly below the first tier's upper bound (when bounded); at/above it the first tier is unreachable (dead config the admin almost certainly didn't intend).
- 2026-06-12: Every schema refinement carries an explicit issue `path` (section/field level), and rejection tests assert `issues[0].path` — this is the error-mapping contract: editor tabs (Task 11) and API 400 bodies (Task 9) locate errors by path, so `path: []` issues are banned.
- 2026-06-12: Claim-input shape is validated with Zod at the API boundary (Task 9), not inside the engine — `processClaim` stays a pure function trusting its typed contract; malformed bodies (garbage `submittedAt`, missing `customFieldValues`) get a 400, never a 500.
- 2026-06-12: Diff treats arrays as atomic leaves (JSON.stringify equality) — element-wise array diffing is out of scope; safe because both diff inputs are always Postgres JSONB reads (consistent key serialization), a precondition documented in the module comment and pinned by tests.
- 2026-06-12: Custom-field types are a named exported enum (`CUSTOM_FIELD_TYPES`/`CustomFieldType`) and the engine's type-validation switch is exhaustive with a `never` default — adding a new field type to the schema fails compilation until its validation is written (silent accept-as-text is impossible).
- 2026-06-12: Shared test fixture `validConfig` lives in `src/lib/config/fixtures.ts` (not in a test file) — importing from test files makes vitest re-execute the imported suite (observed: 48 reported tests instead of 35) and the pattern compounds; test files are not importable modules in this repo.
- 2026-06-12: All four lifecycle notification events (`claim_submitted`/`approved`/`rejected`/`payment_sent`) are enabled for every seed tenant; tenants differ only by channel (SafeGuard email · HealthFirst email+sms · GovHealth email+webhook). The brief states "all four events" only for SafeGuard and leaves event-enablement unstated for the other two — applying it uniformly keeps the demo's contrast purely about channels and avoids inventing per-event on/off rules the brief never specifies.
- 2026-06-12: Seed configs include only the claim types a tenant offers (each `enabled: true`); types a tenant does not offer are absent rather than present-but-disabled. The engine treats absent and disabled identically (`!typeCfg?.enabled`), so e.g. MATERNITY→SafeGuard still yields `CLAIM_TYPE_NOT_ENABLED`; `claimTypes` is a `partialRecord` precisely to allow this minimal representation.
- 2026-06-12: Installed Prisma is **7.8.0**, which is a material change from the plan's v5/v6 assumptions. Verified the v7 setup against official docs before coding: generator `prisma-client` (not `prisma-client-js`) with a **required `output`** (`src/generated/prisma`); the Rust query engine is removed so a **driver adapter is mandatory**; `url` is banned from the schema `datasource` (moves to `prisma.config.ts`); `migrate`/`db push` no longer auto-run `generate`.
- 2026-06-12: Chose **`@prisma/adapter-neon`** (Neon serverless driver over WS/HTTP) over `@prisma/adapter-pg` — it is the idiomatic Vercel+Neon serverless path, sidesteps PgBouncer transaction-mode pitfalls on the pooled connection, and matches why Neon was chosen. Cost: extra deps `@neondatabase/serverless` + `ws` (Node < 22 has no global `WebSocket`, so `neonConfig.webSocketConstructor = ws`) + `dotenv` (for `prisma.config.ts`).
- 2026-06-12: Generated Prisma client is **gitignored** (`/src/generated/`) and rebuilt by a `postinstall: prisma generate` script — keeps the repo free of generated code, prevents drift, and guarantees Vercel builds against a fresh client. `DATABASE_URL` is the Neon **pooled** connection (`-pooler` host); the initial migration applied cleanly over it, so no separate `DIRECT_URL` is needed at this size.
- 2026-06-12: The bug-prone versioning/rollback semantics (spec §10) get a **dedicated integration test** against real Neon, rather than only the plan's indirect Task-9 API coverage. It lives in `*.integration.test.ts`, is **excluded from `npm run test`** (which stays pure/offline/deterministic — 41 unit tests), and runs via `npm run test:integration` (own config: `dotenv` setup, serial, 30s timeout for cross-region WS round-trips; scratch `__itest_tenant` cleaned up in `afterAll`). This keeps TDD discipline on the riskiest logic without coupling the unit suite to the network.
- 2026-06-12: API claim-input validation lives in `src/lib/engine/claim-input.ts` (`claimInputSchema`), TDD'd as the one new bit of `lib/` logic; the `process-claim` route parses the body with it before calling the engine, so malformed input (garbage `submittedAt`, non-numeric `amount`, missing `customFieldValues`) returns 400, never a 500 — the engine stays a pure function trusting its typed contract.
- 2026-06-12: The 7 route handlers are thin glue over the already-tested engine/repo, so they are verified by an **end-to-end script against `next dev` + Neon** (real Next 16 routing/runtime) rather than unit-mocked — this catches Next-16-specific issues (async `params`, route registration) that mocks would miss; flow/UI coverage comes later from Playwright (Task 17). Next 16 route specifics confirmed from `node_modules/next/dist/docs` per AGENTS.md.

## Session Log

- 2026-06-11 S1: Chose Challenge 15, initialized repo, designed and set up the session-resilient workflow. Next: product spec brainstorm.
