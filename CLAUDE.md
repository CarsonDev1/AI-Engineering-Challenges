# CLAUDE.md — Multi-Tenant Configuration Platform

Solution for Papaya Insurtech **AI Challenge 15**. An admin-configurable multi-tenant
claims processing platform: each tenant (insurer) gets its own branding, claim types,
document requirements, approval tiers, notifications, SLA, and custom fields — all
editable through an admin UI with zero code changes, backed by a runtime engine that
processes claims differently per tenant configuration.

Challenge brief: <https://github.com/papaya-insurtech/pumpkin/blob/main/AI_Engineering_Challenges/AI_Challenge_15.md>

## Session Bootstrap Protocol

At the start of every session, before doing anything else:

0. Follow the **Engineering Discipline** below for every code change.
1. Read `docs/PROGRESS.md` — current phase, last completed task, next task, decisions made.
2. Open the active plan in `docs/superpowers/plans/` (if one exists) and continue from
   the first unchecked task.
3. Never start new work without completing steps 1–2.

## Stack

- Next.js (App Router) + TypeScript (strict) + Ant Design
- PostgreSQL (hosted) — persistence must survive deploys and restarts
- Zod schemas as the single source of truth for validation (shared client/server)
- Deployment: Vercel (live admin UI URL)

Commands:

- `npm run dev` — Next.js dev server (http://localhost:3000)
- `npm run test` — Vitest unit suite · `npm run test:watch` — watch mode
- `npx tsc --noEmit` — typecheck (strict)
- `npx prisma migrate dev --name <name>` — create + apply a migration to Neon
- `npx prisma generate` — regenerate the client into `src/generated/prisma` (Prisma 7 does **not** auto-run this after migrate; also wired as `postinstall`)
- `npx prisma migrate status` / `npx prisma studio` — inspect migrations / data

Prisma 7 notes: client is generated (gitignored) into `src/generated/prisma` — import from `@/generated/prisma/client`; runtime connects via the `@prisma/adapter-neon` driver adapter (`src/lib/db/prisma.ts`); the CLI/migration connection lives in `prisma.config.ts` (not the schema `datasource`).

## Working Agreements

- One commit per completed task; code and doc updates go in the same commit.
- After each task: tick the plan checkbox and update the Snapshot in `docs/PROGRESS.md`.
- Log design decisions in `docs/PROGRESS.md` → Decision Log the moment they are made.
- Append one Session Log line at the end of every session.
- A single `processClaim` engine powers both runtime and preview mode — never fork that logic.
- All documentation in English.

## Engineering Discipline (Karpathy guidelines)

1. **Think before coding** — state assumptions explicitly; if multiple interpretations
   exist, present them — don't pick one silently; ask when unclear.
2. **Simplicity first** — minimum code that solves the problem; no speculative
   abstractions, no unrequested configurability.
3. **Surgical changes** — every changed line traces to the current task; never
   "improve" adjacent code; clean up only orphans your own change created.
4. **Goal-driven** — every task has a verifiable success criterion (the `Verify:` line
   in the plan); loop until verified, not until it "looks done".

## Repository Map

- `docs/PROGRESS.md` — live project state (snapshot, decision log, session log)
- `docs/superpowers/specs/` — design documents
- `docs/superpowers/plans/` — implementation plans with per-task checkboxes
