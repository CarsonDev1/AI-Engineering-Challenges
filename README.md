# Multi-Tenant Configuration Platform

Solution for **AI Challenge 15 — Multi-Tenant Configuration Platform** from the [Papaya Insurtech AI Engineering Challenges](https://github.com/papaya-insurtech/pumpkin/blob/main/AI_Engineering_Challenges/AI_Challenge_15.md).

> An insurance platform serves multiple insurance companies (tenants). Each tenant has different branding, claim workflows, document requirements, benefit structures, and approval rules — all fully configurable through an admin UI with zero code changes, backed by a runtime engine that processes claims differently per tenant config.

## Status

🚧 **Work in progress** — currently in the spec & planning phase.

| Phase | Status |
|-------|--------|
| Requirements analysis & spec | 🔄 In progress |
| Implementation plan | ⏳ Pending |
| Data model & runtime engine | ⏳ Pending |
| Admin UI (CRUD, preview, diff, history) | ⏳ Pending |
| Deployment & demo | ⏳ Pending |

## Planned Stack

- **Frontend:** Next.js + TypeScript + Ant Design
- **Backend:** Next.js API routes (Node.js + TypeScript)
- **Database:** PostgreSQL (hosted — persistent across deploys)
- **Validation:** Zod (single schema shared between client and server)
- **Deployment:** Vercel (live URL for the admin UI)

## Documentation

- `docs/` — spec, implementation plan, and design decisions (added as the project progresses)
- A writeup covering the approach, trade-offs, and AI-assisted workflow will be included with the final submission.
