---
title: Philosophy
description: "MeowKit's design principles — why the harness matters more than the model, and the trade-offs behind every architectural decision."
persona: B
---

# Philosophy

## Core Thesis

**The model is a commodity. The harness is the product.**

With the same model, the same task, and the same compute budget — just by changing the environment design — performance increases by 64% ([SWE-agent, NeurIPS 2024](https://arxiv.org/abs/2405.15793)). The model is not the bottleneck. The environment is.

MeowKit applies the **harness²** concept: Claude Code is already a harness (context compaction, tools, sessions). MeowKit adds another harness layer on top — structured workflows, quality gates, memory, multi-agent coordination, and hook-based automation. Harness on harness = compound reliability.

> *"The model is what thinks. The harness is what it thinks about. Getting that distinction right is the entire game."*

For the full architectural breakdown, see [Understanding the Harness](/guide/understanding-the-harness).

## Nine Principles

### 1. Every Mistake → a Permanent Fix

When an agent makes an error, don't pray for better behavior next time. Build a hook, rule, or gate so it **never** makes that mistake again. This is the steering loop: observe failure → add sensor → add guide → verify fix holds.

`build-verify.cjs` exists because agents introduced syntax errors that cascaded for 10+ steps. `loop-detection.cjs` exists because agents edited the same file 20+ times without progress. Each handler is a crystallized lesson.

### 2. Gates Are Discipline, Not Suggestions

Gate 1 (plan approved) and Gate 2 (review approved) require explicit human sign-off. No `--skip-gates` flag exists by design. No agent can self-approve. No mode bypasses them.

`gate-enforcement.sh` is a PreToolUse hook that **blocks file writes** before Gate 1 passes. This is preventive enforcement — the agent literally cannot edit source files until a plan is approved. Behavioral rules say "don't write code before planning." Hooks say "you can't."

### 3. Security Is Architecture, Not Afterthought

Security operates in three layers: behavioral rules (`security-rules.md`, `injection-rules.md`), preventive hooks (`gate-enforcement.sh`, `privacy-block.sh`), and observational hooks (`post-write.sh`, `build-verify.cjs`).

**Critical design decision:** Security hooks are **never** routed through the dispatcher. They remain independent bash entries in `settings.json`. If `dispatch.cjs` crashes, security hooks still fire. SPOF protection is non-negotiable.

All file content is treated as DATA, not instructions. Only `CLAUDE.md` and `.claude/rules/` contain instructions. This boundary is the foundation of prompt injection defense.

### 4. Dead Weight Must Be Pruned

Every harness component encodes an assumption about what the model cannot do. When a new model ships, that assumption may be wrong. Scaffolding that helped Opus 4.5 may **hurt** Opus 4.7.

This is the dead-weight thesis: measure every component. If it costs more than it saves, prune it. MeowKit operationalizes this through adaptive density — Haiku gets MINIMAL (short-circuits to `/cook`), Sonnet gets FULL (contract + iterations), Opus 4.6+ gets LEAN (single-session, contract optional). The density isn't a preference; it's a measured finding.

### 5. Use the Cheapest Tool That Solves the Problem

Claude Code detects user frustration with a $0 regex — no model call needed. MeowKit applies the same principle everywhere:

- A `build-verify.cjs` linter check ($0) catches syntax errors before they cascade into $5 debugging sessions.
- A `--verify` browser health check (~$1) catches blank pages before a `--strict` evaluator (~$5) is needed.
- A `code-reviewer` structural audit ($1) suffices for most features; the full `evaluator` with rubrics ($5) is reserved for autonomous builds.

Token efficiency is an economic discipline, not a nice-to-have.

### 6. Verify by Behavior, Not by Reading Code

Tests can pass against mocks while production returns 500. The evaluator must click through the running app — browser navigation, curl against live endpoints, CLI invocation. Static-analysis-only verdicts are rejected.

This principle applies at different scales:
- **`/meow:harness`**: full evaluator with Playwright, rubric grading, skeptic persona
- **`/cook --strict`**: same evaluator, opt-in for high-stakes features
- **`/cook --verify`**: lightweight browser check — does the page load? console errors?
- **`/cook`** (default): code-reviewer only — structural, not behavioral. Acceptable for most work.

### 7. TDD Is Opt-In

TDD enforcement moved from default-on to opt-in via `--tdd` flag or `MEOWKIT_TDD=1`. When enabled, failing tests must exist before implementation — the `pre-implement.sh` hook blocks code without corresponding failing tests. In default mode, tests are recommended but not gated.

Why optional: strict TDD added friction for spike work, tooling, and prototypes. Production-quality work should still enable `--tdd`.

### 8. Learn from Every Session

The memory system captures patterns, mistakes, and costs across sessions. Topic files in `.claude/memory/` — `fixes.md`/`fixes.json` for bug-class patterns, `review-patterns.md`/`review-patterns.json` for recurring observations, `architecture-decisions.md`/`architecture-decisions.json` for design choices — are read on-demand by consumer skills at task start. There is no auto-injection pipeline; each skill loads only the topic files relevant to its domain. The `conversation-summary-cache.sh` injects a Haiku-summarized session summary (≤4KB) per turn for continuity — that is the only per-turn injection.

### 9. Load Only What's Needed

Skills activate by task domain, not all at once. Each skill's SKILL.md is a compact decision router, with detailed procedures in `references/` loaded on demand. This progressive disclosure pattern saves ~70% context per invocation.

The same principle applies to the hook system: `handlers.json` routes events to only the matching handlers. A UserPromptSubmit event triggers the summary cache and immediate-capture handler — not build-verify or checkpoint logic.

## What MeowKit Does NOT Do

- **No proprietary formats** — standard Markdown and JSON, readable by any tool
- **No telemetry** — all data stays project-local in `.claude/memory/` and `session-state/`
- **No experimental features** — everything shipped is production-ready
- **No external services** — zero dependencies on third-party APIs for core workflow
- **No model lock-in** — adaptive density works across Haiku, Sonnet, and Opus tiers

## Trade-Offs We Accept

| We chose | Over | Because |
|----------|------|---------|
| Human gates (slower) | Auto-approve (faster) | Agent self-approval produces leniency drift |
| Behavioral output limits | Hook-based truncation | Hooks can't replace tool output (PostToolUse appends only) |
| Independent security hooks | Unified dispatcher | SPOF protection outweighs DRY |
| Opt-in TDD | Mandatory TDD | Friction for spikes > value for prototypes |
| Session-level budget ($10/$25) | No budget tracking | Runaway sessions cost more than false warnings |

## See Also

- [Understanding the Harness](/guide/understanding-the-harness) — the "how" (layers, pillars, lifecycle)
- [Harness Architecture](/guide/harness-architecture) — the `/meow:harness` autonomous pipeline
- [Adaptive Density](/guide/adaptive-density) — scaffolding by model capability
- [Workflow Phases](/guide/workflow-phases) — the 7-phase pipeline in detail
