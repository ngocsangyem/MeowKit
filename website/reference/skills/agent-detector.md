---
title: "mk:agent-detector"
description: "Auto-detects agent, complexity tier, and model for every message. Highest-priority skill — runs first in every workflow."
---

# mk:agent-detector

Runs first for every user message. Analyzes task content, technology mentions, user intent, project context, and file patterns to route to the correct agent with the right complexity level and model tier. No manual agent selection needed.

## Core purpose

Replace manual agent selection with deterministic multi-layer scoring. Every message flows through detection before any other skill or agent action.

## When to use

Always — every user message, no exceptions. This skill fires before any other skill or agent.

## Process

1. **Check cache** — reuse cached result if same workflow and phase > 1
2. **Score agents** — analyze task content across 4 layers: task keywords, technology mentions, user intent signals, project context/file patterns
3. **Select model + mode** — map complexity to model tier, check team mode eligibility
4. **Output + handoff** — show detection banner, load agent instructions, invoke skill

## Key behaviors

- Uses in-memory pattern detection only — no file scanning to keep token usage low (~10-30k tokens saved per message)
- Cache reuses result from previous workflow phase; does NOT invalidate on pivot signals
- After complexity detection, sets response verbosity via token budget levels (silent, not surfaced to users)
- Multi-domain tasks split scores across agents; highest scorer wins even if wrong for dominant concern

## Gotchas

- Short messages with domain keywords (e.g., "fix the auth token") score high for complex agents even for one-line changes. Override via `--quick` or `/mk:fix --quick`.
- Cache stale after context switch (e.g., "actually, let's do X instead"). Confirm the banner after any explicit task change; start a new message with the new task description.
- Cross-domain tasks: state primary concern explicitly (e.g., "Security task: add check to payment UI") so domain detection anchors correctly.
