# Project Workflow Design — Session-Resilient Development

**Date:** 2026-06-11
**Status:** Approved

## Problem

This project is developed with AI coding agents (Claude Code) under a hard deadline.
Agent sessions can hit context limits, be interrupted unexpectedly, or be reopened
from a different working directory or machine. Without explicit design, each new
session loses the project context, the spec, the plan, and the current task state —
forcing expensive re-discovery and risking inconsistent decisions.

## Goal

Any new session can rebuild full working context **from repository files alone**
within one read pass, and continue from the exact task where the previous session
stopped — with verifiable success criteria per task.

## Core Principle

**All durable state lives in git-tracked files.** Session memory, conversation
summaries, and machine-local configuration are convenience layers only. The test for
any piece of information: *"If this is lost, would a new session be stuck?" If yes,
it belongs in the repo.*

## Architecture

| File | Role | Update discipline |
|------|------|-------------------|
| `CLAUDE.md` (repo root) | Auto-loaded project context: overview, stack, Session Bootstrap Protocol, working agreements, engineering discipline | Rarely — only when conventions change |
| `docs/PROGRESS.md` | Live state: Snapshot (phase, **active plan file**, last/next task, blockers), Decision Log, Session Log | Snapshot after every task; logs append-only |
| `docs/superpowers/specs/*.md` | Design documents (this file; the product spec) | Written once per design cycle, then stable |
| `docs/superpowers/plans/*.md` | Implementation plans with per-task checkboxes and `Verify:` criteria | Checkbox ticked per completed task |
| Git history | Second recovery layer: one commit per task; in-flight work visible via `git status` | One commit per completed task, code + docs together |

### Session Bootstrap Protocol

Defined in `CLAUDE.md`. Every session: (0) follow the engineering discipline,
(1) read `docs/PROGRESS.md`, (2) open the active plan and continue from the first
unchecked task, (3) never start new work before steps 1–2.

### Engineering Discipline

The four Karpathy guidelines are embedded in `CLAUDE.md` (portable with the repo,
independent of machine-local skills):

1. **Think before coding** — surface assumptions and ambiguities; ask, don't guess.
2. **Simplicity first** — minimum code that solves the problem; nothing speculative.
3. **Surgical changes** — every changed line traces to the current task.
4. **Goal-driven** — every plan task carries a `Verify:` criterion; loop until verified.

### Plan Task Format

```markdown
- [ ] Task N.M: <imperative description>
      Verify: <objective check — test passes, command output, observable behavior>
```

## Failure-Mode Walkthrough

1. **Context exhaustion mid-task** — Snapshot and plan checkboxes are on disk; at most
   the in-flight task is lost, and its diff remains in the working tree.
2. **Unexpected session termination** — same recovery path; `git status` exposes the
   in-flight change.
3. **Session opened elsewhere (different directory or machine)** — everything travels
   with the repository; no dependency on local memory or settings.

## Out of Scope

- Per-session journal files and standalone ADR documents — rejected as ceremony that
  risks drifting from reality under deadline pressure. The Decision Log (one line per
  decision) covers the need.
- Automation (hooks, scripts) for doc updates — manual discipline is sufficient at
  this project size.
