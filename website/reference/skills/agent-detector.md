---
title: "meow:agent-detector"
description: "Auto-detects the right agent, complexity level, and model tier for every message using multi-layer scoring."
---
# meow:agent-detector
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
## Related
- [`meow:lazy-agent-loader`](/reference/skills/lazy-agent-loader) — Loads agent definitions on-demand
- [`meow:workflow-orchestrator`](/reference/skills/workflow-orchestrator) — Executes the detected workflow
