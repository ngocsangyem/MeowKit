---
title: Understanding MeowKit's Harness
description: "The harness² concept — 7-layer taxonomy, session lifecycle, and how MeowKit compounds on Claude Code."
---

> **See also:** [How It Works](/core-concepts/how-it-works) — the canonical architecture overview.

# Understanding the Harness

MeowKit is a harness² system: Claude Code is already a harness (tools, context, subagents). MeowKit adds another harness layer on top — workflows, gates, memory, and hook-based automation.

## The 7-Layer Taxonomy

This structure isolates different types of reasoning into discrete layers, preventing the "overloaded assistant" problem:

| Layer | Owner | What it does |
|-------|-------|-------------|
| L1: Builder | Human | Approve plans (Gate 1), approve reviews (Gate 2) |
| L2: Planner | `mk:plan-creator` | Decompose requests into product-level specs — user stories, not file names |
| L3: Cook | `/mk:cook` workflow | 7-phase pipeline: Orient → Plan → Test → Build → Review → Ship → Reflect |
| L4: Native Tasks | `dispatch.cjs` + handlers | Build-verify, budget tracking, checkpoints, immediate capture |
| L5: Teams | `/mk:scout`, `/mk:party` | Parallel agents with worktree isolation. Context firewall. |
| L6: Skills | 70+ skills | JIT activation — only loaded when task domain matches |
| L7: Base Shell | Claude Code | Context compaction, tool validation, subagent models |

## Session Lifecycle

Hook events fire at key moments. Each dispatches to specific handlers:

```
SessionStart
  → model-detector.cjs: reads model tier, writes density
  → orientation-ritual.cjs: resumes from checkpoint if exists
  → project-context-loader.sh: injects project context

UserPromptSubmit
  → conversation-summary-cache.sh: injects cached summary (≤4KB)
  → immediate-capture-handler.cjs: captures ##prefix messages

Every tool call (PostToolUse)
  → build-verify.cjs: compile/lint (hash-cached)
  → loop-detection.cjs: warn at 4 edits, escalate at 8
  → budget-tracker.cjs: warn at $30, block at $100
  → auto-checkpoint.cjs: save every 20 calls

Stop
  → pre-completion-check.sh: block if no verification evidence
  → checkpoint-writer.cjs: save git state + budget + sequence
  → post-session.sh: capture patterns to memory
```

**Crash recovery:** `auto-checkpoint.cjs` saves every 20 calls. If the session crashes before Stop, the last checkpoint preserves progress. Next session's `orientation-ritual.cjs` resumes from it.

## Security hooks — SPOF protection

Security hooks (`gate-enforcement.sh`, `privacy-block.sh`) are never routed through `dispatch.cjs`. They remain independent bash entries in `settings.json`. If the dispatcher crashes, security hooks still fire.

## Next steps

- [How agents and skills work](/core-concepts/how-it-works) — the canonical overview
- [Middleware layer](/guide/middleware-layer) — hook dispatch in depth
- [Adaptive density](/guide/adaptive-density) — scaffolding by model tier
