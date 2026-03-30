---
title: Changelog
description: MeowKit release history and changes.
---

# Changelog

## 1.0.0 (2026-03-30) — The Disciplined Velocity Release

The biggest MeowKit update yet. 13 new capabilities inspired by deep analysis of BMAD-METHOD and ClaudeKit-Engineer. Theme: **scale throughput while maintaining absolute discipline**.

### Intelligence & Routing

- **Scale-Adaptive Intelligence** — Domain-based complexity routing at Phase 0 via `meow:scale-routing`. CSV-driven: fintech, healthcare, IoT domains auto-force COMPLEX tier. User-extensible CSV for project-specific domains.
- **Planning Depth Per Mode** — All 7 modes declare researcher count: `strict`/`architect` run 2 parallel researchers with competing approaches; `default`/`audit` run 1; `fast`/`cost-saver`/`document` skip research.
- **Navigation Help** — `/meow:help` scans project state (plans, reviews, tests, git) and recommends the next pipeline step. No guessing.

### Quality & Review

- **Multi-Layer Adversarial Review** — `meow:review` now runs 3 parallel reviewers (Blind Hunter, Edge Case Hunter, Criteria Auditor) with post-review triage. Catches 2-3x more bugs than single-pass review.
- **Anti-Rationalization Hardening** — Agents cannot downgrade complexity, minimize tests, skip security, or dismiss WARN verdicts without 3-part justification.
- **Project Context System** — `docs/project-context.md` is the agent "constitution". All agents load it at session start. Eliminates context drift.

### Collaboration & Parallelism

- **Party Mode** — `/meow:party "topic"` spawns 2-4 agents to debate architecture decisions with forced synthesis. Discussion only — no code changes during party.
- **Parallel Execution & Teams** — COMPLEX tasks with independent subtasks run up to 3 parallel agents with git worktree isolation. Integration test required after merge.

### Architecture & Enforcement

- **Step-File Architecture** — Complex skills decompose into JIT-loaded step files. Token-efficient, auditable, resumable. First skill: `meow:review` (4 steps).
- **Hook-Based Enforcement** — 3 shell hooks upgrade behavioral rules to preventive: `privacy-block.sh` (blocks sensitive reads), `gate-enforcement.sh` (blocks writes before Gate 1), `project-context-loader.sh` (auto-loads context).

### New Rules

- `scale-adaptive-rules.md` — domain routing, CSV override, Gate 1 one-shot bypass
- `step-file-rules.md` — JIT loading, no-skip, state persistence
- `parallel-execution-rules.md` — worktree isolation, max 3 agents, integration gate

### New Skills

- `meow:scale-routing` — domain-to-complexity CSV routing
- `meow:project-context` — generate/update agent constitution
- `meow:party` — multi-agent deliberation sessions
- `meow:worktree` — git worktree lifecycle management
- `meow:task-queue` — task claiming with ownership enforcement
- `meow:help` — pipeline navigation assistant
- `meow:debug` — structured debugging: reproduce → isolate → root cause → fix → verify
- `meow:simplify` — post-implementation complexity reduction (between Build and Review)
- `meow:team-config` — parallel agent team setup with ownership maps and worktrees

### Breaking changes

None. All additions are backward-compatible.

## Pre-1.0 (2026-03-29)

All pre-1.0 changes are consolidated into the 1.0.0 release above.
