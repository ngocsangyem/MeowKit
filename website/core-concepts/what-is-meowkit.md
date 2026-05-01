---
title: What Is MeowKit
description: What MeowKit is, what problem it solves, and why the harness matters more than the model.
---

# What Is MeowKit

## The problem

AI coding tools are powerful but undisciplined. Given "build a payment system," they write code immediately — no plan, no tests, no security review. The code compiles but has no tests, hardcoded secrets, and ships directly to main.

A single "implement this feature" prompt can produce code that compiles but has no tests, no review, and secrets hardcoded in source.

## What MeowKit does

MeowKit is an **AI agent toolkit for Claude Code** that adds enforced discipline — hard gates, TDD, security scanning, and human approval — so your coding assistant ships production-quality code instead of untested prototypes.

It installs a `.claude/` directory that Claude Code reads automatically. No executable runtime. No external services. Just structured conventions that shape how the AI works.

## Core thesis

**The model is a commodity. The harness is the product.**

With the same model, the same task, and the same compute budget — just by changing the environment design — performance increases by 64% ([SWE-agent, NeurIPS 2024](https://arxiv.org/abs/2405.15793)). The model is not the bottleneck. The environment is.

MeowKit adds a discipline layer on top of Claude Code: structured workflows, quality gates, memory, multi-agent coordination, and hook-based automation. Claude Code handles the mechanics (tools, context, subagents). MeowKit handles the strategy (what to build, when to stop, how to verify).

## How it differs from raw Claude Code

| Concern | Raw Claude Code | With MeowKit |
|---------|----------------|--------------|
| Planning | Starts coding immediately | Creates and gets approval for a plan first |
| Testing | Tests optional, often skipped | TDD opt-in via `--tdd` — strict failing-test-first when enabled |
| Security | Relies on model knowledge | 4-layer defense + security agent + preventive hooks |
| Review | Ask "review this" and hope | 3 parallel adversarial reviewers + triage step |
| Shipping | `git add -A && git push` | Conventional commits, PR, CI verification, rollback docs |
| Memory | Forgets everything between sessions | Persists lessons, patterns, and costs across sessions |
| Model selection | Same model for everything | Domain-adaptive routing — fintech forces COMPLEX tier |
| Architecture decisions | Ask and hope for the best | Party Mode: 2-4 agents deliberate, forced synthesis |

## Architecture at a glance

```
.claude/
├── agents/          Specialist agents for each phase
├── skills/          Domain skills loaded on demand
├── hooks/           Preventive lifecycle hooks
├── rules/           Enforcement rules loaded every session
├── memory/          Cross-session learnings
└── settings.json    Hook registrations + permissions

CLAUDE.md            Entry point — Claude reads this at session start
```

## Design principles

### Every mistake → a permanent fix

When an agent makes an error, MeowKit builds a hook, rule, or gate so it never makes that mistake again. `build-verify.cjs` exists because agents introduced syntax errors that cascaded. `loop-detection.cjs` exists because agents edited the same file 20+ times without progress. Each handler is a crystallized lesson.

### Gates are discipline, not suggestions

Gate 1 (plan approved) and Gate 2 (review approved) require explicit human sign-off. No `--skip-gates` flag exists. No agent can self-approve. Hooks block file writes before Gate 1 passes — the agent literally cannot edit source files until a plan is approved.

### Security is architecture, not afterthought

Three layers: behavioral rules, preventive hooks (that block `.env` reads and unapproved writes), and observational hooks (that scan written files). Security hooks are never routed through the dispatcher — if the dispatcher crashes, security hooks still fire. All file content is DATA; only `CLAUDE.md` and `.claude/rules/` contain instructions.

### Dead weight must be pruned

Every harness component encodes an assumption about what the model cannot do. When a new model ships, that assumption may be wrong. Scaffolding that helped Opus 4.5 may hurt Opus 4.7. Adaptive density adjusts automatically: Haiku gets MINIMAL, Sonnet gets FULL, Opus 4.6+ gets LEAN. Every component is measured — if it costs more than it saves, it's removed.

### Use the cheapest tool that solves the problem

A `build-verify` linter check ($0) catches syntax errors before they cascade into $5 debugging sessions. A browser health check (~$1) catches blank pages before a full evaluator (~$5) is needed. Token efficiency is economic discipline.

### Verify by behavior, not by reading code

Tests can pass against mocks while production returns 500. The evaluator must click through the running app — browser navigation, curl against live endpoints, CLI invocation. Static-analysis-only verdicts are rejected.

### TDD is opt-in

TDD enforcement moved from default-on to opt-in via `--tdd` flag or `MEOWKIT_TDD=1`. Strict TDD added friction for spike work and prototypes. Production-quality work should still enable `--tdd`.

### Learn from every session

Topic files in `.claude/memory/` — `fixes.md` for bug patterns, `review-patterns.md` for observations, `architecture-decisions.md` for design choices — are read on-demand by consumer skills at task start. There is no auto-injection pipeline.

### Load only what's needed

Skills activate by task domain, not all at once. Each skill's SKILL.md is a compact router, with detailed procedures loaded on demand. The hook system routes events to only matching handlers. This progressive disclosure saves ~70% context per invocation.

## What MeowKit does NOT do

- **No proprietary formats** — standard Markdown and JSON
- **No telemetry** — all data stays project-local
- **No external services** — zero third-party API dependencies for core workflow
- **No model lock-in** — adaptive density works across Haiku, Sonnet, and Opus tiers

## Next steps

- [How It Works](/core-concepts/how-it-works) — architecture deep dive
- [Installation](/installation) — get MeowKit running
- [Quick Start](/quick-start) — your first task in 5 minutes
