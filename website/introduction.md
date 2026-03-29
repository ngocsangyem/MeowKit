---
title: Introduction
description: What MeowKit is, what problem it solves, and how it differs from raw Claude Code.
persona: A
---

# Introduction

MeowKit is an AI agent toolkit for Claude Code that gives your coding assistant enforced discipline — hard gates, TDD, security scanning, and human approval — so it ships production-quality code instead of untested prototypes.

::: tip What's new in v1.0.0 — The Disciplined Velocity Release
10 new capabilities: scale-adaptive routing, 3-layer adversarial review, Party Mode, parallel execution, navigation help, hook enforcement, and more. [See what's new →](/guide/whats-new)
:::

## What problem does MeowKit solve?

AI coding tools are powerful but undirected. Without structure, they skip tests, ignore security, and ship untested code. A single "implement this feature" prompt can produce code that compiles but has no tests, no review, and secrets hardcoded in source.

MeowKit fixes this by installing a `.claude/` directory that Claude Code reads automatically. It contains 14 specialist agents, 49 skills, lifecycle hooks, security rules, and a memory system that together enforce a structured development workflow.

## How it works

When you start a Claude Code session in a MeowKit project, the toolkit automatically:

1. **Routes your task** to the right agent based on complexity (orchestrator)
2. **Creates a plan** before any code is written (planner, Gate 1)
3. **Writes failing tests first** before implementation (tester, TDD enforcement)
4. **Implements with discipline** — builds until tests pass (developer)
5. **Reviews across 5 dimensions** — architecture, types, tests, security, performance (reviewer, Gate 2)
6. **Ships safely** — conventional commits, PR, CI verification, rollback docs (shipper)
7. **Learns from the session** — captures patterns and lessons for next time (analyst)

No step can be skipped. Two hard gates (plan approval + review approval) require explicit human sign-off.

## How it differs from raw Claude Code

| Concern                | Raw Claude Code                     | With MeowKit                                                    |
| ---------------------- | ----------------------------------- | --------------------------------------------------------------- |
| Planning               | Starts coding immediately           | Creates and gets approval for a plan first                      |
| Testing                | Tests optional, often skipped       | TDD enforced — failing test before implementation               |
| Security               | Relies on model knowledge           | 4-layer defense + security agent + post-write hooks             |
| Review                 | Ask "review this" and hope          | 3 parallel adversarial reviewers + triage step                  |
| Shipping               | "git add -A && git push"            | Conventional commits, PR, CI verification, rollback docs        |
| Memory                 | Forgets everything between sessions | Persists lessons, patterns, and costs                           |
| Model selection        | Same model for everything           | Domain-adaptive routing — fintech forces COMPLEX tier           |
| Architecture decisions | Ask and hope for the best           | Party Mode: 2-4 agents deliberate, forced synthesis             |
| Parallel work          | Single-threaded                     | Worktree-isolated parallel agents, max 3, with integration gate |

## Architecture at a glance

```
.claude/
├── agents/          14 specialist agents
├── skills/          49 skills with meow: namespace (step-file decomposition for complex skills)
├── hooks/           Lifecycle hooks (security scan, TDD gate)
├── rules/           14 enforcement rules (security, injection, TDD, parallel execution)
├── scripts/         6 Python validators (stdlib only)
├── memory/          Cross-session persistence
└── settings.json    Hook registrations + permissions

CLAUDE.md            Entry point — Claude reads this at session start
docs/
└── project-context.md   Agent "constitution" — loaded by ALL agents at session start
```

## Next steps

- [Why MeowKit](/why-meowkit) — the philosophy behind enforced discipline
- [Installation](/installation) — get MeowKit running in 2 minutes
- [Quick Start](/quick-start) — your first task with MeowKit in 5 minutes
