---
title: "meow:lazy-agent-loader"
description: "Load agent definitions on-demand to reduce context usage — only loads full agent when scoring indicates it's needed."
---
# meow:lazy-agent-loader
Load agent definitions on-demand to reduce context usage — only loads full agent when scoring indicates it's needed.
## What This Skill Does
Instead of loading all 13 agent definitions at startup (~26,000 tokens), this skill loads only the agent index (~1,000 tokens) and fetches full definitions when a specific agent scores high enough to be activated. Saves 90%+ of context for single-agent tasks.
## Core Capabilities
- **Agent index** — Compact keyword-based index for all 13 agents (~1,000 tokens)
- **Scoring-based loading** — Score ≥80: load full definition. 50-79: summary only. <50: skip.
- **Session cache** — Once loaded, agent stays cached for the session
## Usage
Automatic — used by `meow:agent-detector` for optimized loading.
## Related
- [`meow:agent-detector`](/reference/skills/agent-detector) — Triggers lazy loading based on scoring
