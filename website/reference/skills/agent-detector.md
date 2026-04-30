---
title: "mk:agent-detector"
description: "Auto-detects the right agent, complexity level, and model tier for every message using multi-layer scoring."
---
# mk:agent-detector
Auto-detects the right agent, complexity level, and model tier for every message using multi-layer scoring.
## What This Skill Does
Runs on EVERY message before anything else. Uses a multi-layer detection system (task content analysis, keyword matching, project context, file patterns) to score all available agents, classify complexity (Quick/Standard/Deep), and select the model tier (Haiku/Sonnet/Opus). Runs on Haiku for cost efficiency.
## Core Capabilities
- **Multi-layer scoring** — Task content → keywords → project context → file patterns
- **Complexity classification** — Quick, Standard, Deep with auto-detection
- **Model selection** — Maps complexity + agent type to Haiku/Sonnet/Opus
- **Agent banner** — Shows selected agent, model, and phase at response start
- **Cache** — Reuses detection results within same workflow (skip re-detection)
## Usage
Fully automatic — runs on every message. No explicit invocation.
::: info Skill Details
**Phase:** 0  
**Used by:** orchestrator agent
:::

## Gotchas

- **Misrouting trivial tasks to heavyweight agents**: Short messages that contain domain keywords (e.g., "fix the auth token") score high for complex agents even when the actual work is a one-line change. The detector favors keyword matches over scope signals. → If the banner shows an unexpected agent/model tier, override via `--quick` or use the explicit `/mk:fix --quick` shorthand to force the right complexity level.
- **Cache stale after context switch**: The detection cache reuses the result from the previous workflow phase, but when a conversation pivots mid-session (e.g., "actually, let's do X instead"), the cached detection is wrong for the new task. The detector doesn't invalidate on pivot signals. → Confirm the banner after any explicit task change; if the agent/model is wrong, start a new message explicitly describing the new task so Layer 0 re-detects from scratch.
- **Multi-domain tasks picking the wrong primary agent**: Tasks spanning two domains (e.g., "add a security check to the payment UI") split scores across agents and the highest scorer wins, which may be wrong for the dominant concern. The tiebreaker is the first keyword match, not importance. → For cross-domain tasks, state the primary concern explicitly at the start of the message (e.g., "Security task: ...") so Layer 0 domain detection anchors to the right agent before keyword scoring runs.

## Related
- [`mk:lazy-agent-loader`](/reference/skills/lazy-agent-loader) — Loads agent definitions on-demand
- [`mk:workflow-orchestrator`](/reference/skills/workflow-orchestrator) — Executes the detected workflow
