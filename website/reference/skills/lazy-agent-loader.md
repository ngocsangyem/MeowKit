---
title: "mk:lazy-agent-loader"
description: "Loads agent definitions on-demand instead of all-at-once. Reduces token consumption in multi-agent workflows."
---

# mk:lazy-agent-loader

Manages agent context budget by loading only agent summaries initially (~50 tokens each) and full definitions only when an agent is activated. Caches loaded agents in session state.

## Core purpose

Reduce token usage in multi-agent workflows. Without lazy loading, loading all 17 agent definitions at session start consumes significant context.

## When to use

Activated by `agent-detector` during agent selection. Not user-invocable directly.

## Loading strategy

**Initial load (~1200 tokens):** Load only the agent index (id, category, specialty, keywords for all agents). Do NOT load individual agent files.

**On agent selection:**
- Score ≥ 80 (PRIMARY) → Load full definition (~500-2000 tokens)
- Score 50-79 (SECONDARY) → Load summary only
- Score < 50 (OPTIONAL) → Don't load

## Integration

`agent-detector` scores agents using the index keywords, identifies PRIMARY agent(s), and delegates loading to this skill. Pre-loads agents needing session-start context (orchestrator, analyst) even when lazy.

## Gotchas

- Agent loaded too late may miss context available at session start → pre-load agents that need session-start context
- Cache serves stale agent definition if agent file updated → invalidate on file mtime change
