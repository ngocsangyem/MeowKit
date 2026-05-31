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

## Release-time control surfaces

The harness has several CLI surfaces that keep the system honest as it grows:

| Surface | Command | Purpose |
| ------- | ------- | ------- |
| Gate enforcement | `npx mewkit doctor --hard-gates` | Probes the configured hard gates through the same hook path used at runtime. |
| Workflow coherence | `npx mewkit validate --workflow` | Checks `.claude/workflow.yaml` against the documented workflow. |
| Ownership coverage | `npx mewkit validate --ownership` and `npx mewkit inventory --check` | Confirms shipped artifacts have governance metadata and count indexes stay current. |
| Pack safety | `npx mewkit validate --packs` and `npx mewkit pack suggest-prune` | Checks pack manifest coherence and reports prune candidates without deleting files. |
| Observability | `npx mewkit reflect`, `npx mewkit health`, `npx mewkit simulate --all` | Reads `.claude/memory/trace-log.jsonl` and turns gate blocks, hook failures, and scenarios into reviewable evidence. |
| Long-run evolution | `npx mewkit evolve suggest` | Proposes rule edits, hook tests, skill changes, pack pruning, or regression scenarios from evidence. |
| Provider portability | `npx mewkit portability matrix` | Shows which providers support which MeowKit surfaces. |
| Gate policy | `npx mewkit policy explain` | Explains the active strictness profile for gates. |

The event log is `.claude/memory/trace-log.jsonl`. MeowKit should not create a second event store for gate or hook evidence.

`evolve`, usage pruning, and pack pruning are proposal-only surfaces. They can explain what the evidence suggests, but they do not rewrite rules or delete files by themselves.

Usage-based pruning may render `N/A` until usage emitters exist for the artifact type. That is intentional; MeowKit does not infer usage from static metadata alone.

## Next steps

- [How agents and skills work](/core-concepts/how-it-works) — the canonical overview
- [Middleware layer](/guide/middleware-layer) — hook dispatch in depth
- [Runtime commands](/cli/commands) — CLI checks for gates, inventory, packs, observability, and evolution
- [Adaptive density](/guide/adaptive-density) — scaffolding by model tier
