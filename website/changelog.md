---
title: Changelog
description: MeowKit release history and changes.
---

# Changelog

## 0.2.0 (2026-03-30) — Improvements

### Features

**Improvement 1**

- **Party Mode** — `/meow:party "topic"` spawns 2-4 deliberation agents that debate architecture decisions and produce a forced synthesis. Use before any major architectural choice. No code is written during party.
- **Step-File Architecture** — Complex skills decompose into JIT-loaded step files (`workflow.md` + `step-NN-*.md`). Token-efficient, auditable, and resumable via `session-state/` persistence. First skill: `meow:review` (4 steps).
- **Parallel Execution & Teams** — COMPLEX tasks with independent subtasks can run up to 3 parallel agents. Each agent gets git worktree isolation. Full integration test required after merge. Gates (1 and 2) are never parallelized.

**Improvement 2**

- **Scale-Adaptive Intelligence** — Domain-based complexity routing at Phase 0 via `meow:scale-routing`. CSV-driven: fintech, healthcare, auth domains auto-force COMPLEX tier. User-extensible CSV for project-specific domains.
- **Project Context System** — `docs/project-context.md` is now the agent constitution. All 14 agents load it at session start before any task-specific context. Eliminates inter-agent drift from independent inference.
- **Multi-Layer Adversarial Review** — `meow:review` now runs 3 parallel reviewers (Blind Hunter, Edge Case Hunter, Criteria Auditor) followed by a triage step. Catches 2-3x more bugs than single-pass review.
- **Anti-Rationalization Hardening** — Agents cannot downgrade complexity after scale-routing assigns it, minimize test coverage, skip security rules for "simple" tasks, or dismiss WARN verdicts without explicit justification.

### Rules added

- `scale-adaptive-rules.md` — domain routing, CSV override, Gate 1 one-shot bypass
- `step-file-rules.md` — JIT loading, no-skip, state persistence
- `parallel-execution-rules.md` — worktree isolation, max 3 agents, integration gate

### Breaking changes

None. All additions are backward-compatible.

## 0.1.2 (2026-03-29)

### Features

- Interactive version selection when running `npm create meowkit@latest`
- Add `git-manager` agent for commit/push operations with conventional commits
- Add README.md for both npm packages (`create-meowkit`, `meowkit-cli`)
- Add CHANGELOG.md and VitePress changelog page
- Add Resources dropdown in VitePress nav

### Documentation

- Rewrite root README.md — project description, package table, release guide
- Update VitePress CLI docs — `--list` flag, beta channel, GitHub-download model
- Rewrite `create-meowkit` docs for GitHub-download architecture

## 0.1.1 (2026-03-29)

### Bug Fixes

- Exclude runtime dirs (session-state, memory, logs) from release zip
- Exclude `.claude/metadata.json` and `.claude/.env` from release artifacts
- Add `.claude/session-state/` to `.gitignore`

## 0.1.0 (2026-03-29)

### Features

- Initial release of MeowKit AI agent toolkit
- 49 skills with `meow:` namespace
- 14 specialist agents (orchestrator, planner, developer, reviewer, etc.)
- 18 slash commands
- 7 behavioral modes (default, strict, fast, architect, audit, document, cost-saver)
- 14 enforcement rules (security, TDD, gates, injection defense)
- 6 lifecycle hooks (post-write security scan, post-session memory capture)
- 4-layer prompt injection defense
- Cross-session memory system
- `create-meowkit` CLI — downloads releases from GitHub, scaffolds `.claude/`
- `meowkit-cli` runtime — upgrade, doctor, validate, budget, memory, status
- Smart update with SHA-256 checksum manifest (preserves user modifications)
- Semantic-release automation with dual channels (main=stable, dev=beta)
- GitHub Actions CI/CD (release, beta, PR validation)
- Version listing (`--list`), beta channel support (`--beta`)
