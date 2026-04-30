---
title: "mk:retro"
description: "Weekly engineering retrospective with commit analysis, work patterns, code quality metrics, and team-aware trend tracking."
---
# mk:retro
Weekly engineering retrospective with commit analysis, work patterns, code quality metrics, and team-aware trend tracking.
## What This Skill Does
Analyzes commit history, work patterns, and code quality metrics to produce a structured retrospective. Team-aware: breaks down per-person contributions with praise and growth areas. Tracks trends across retrospectives to show improvement or regression over time.
## Core Capabilities
- **Commit analysis** — Parses git log for the period, categorizes by type
- **Work patterns** — Identifies coding velocity, review turnaround, deploy frequency
- **Team breakdown** — Per-person contributions with strengths and growth areas
- **Trend tracking** — Compares metrics across retrospective runs
- **Persistent history** — Saves reports for long-term trend analysis
## Usage
```bash
/mk:retro                   # run weekly retrospective
"what did we ship this week"  # auto-triggers
```
::: info Skill Details
**Phase:** 6  
**Plan-First Gate:** Data-driven, no plan needed — always skips gate.
:::

## Gotchas

- **Recency bias in commit analysis**: Last 2 days dominate the retro, early-week work forgotten → Weight all days equally; show per-day breakdown
- **Misattributing pair-programmed work**: Co-authored commits counted for committer only → Parse Co-authored-by trailers in commit messages

## Related
- [`mk:memory`](/reference/skills/memory) — Cost tracking and session patterns (complements retro metrics)
