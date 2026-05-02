---
title: "mk:help"
description: "Navigation assistant — scans project state and recommends the next step in the 7-phase pipeline."
---

# mk:help

Answers "What should I do next?" by scanning project state (plans, reviews, tests, git) and mapping to the 7-phase pipeline. Use at session start or after interruption.

## How it works

Scans these sources in order, stops at first actionable recommendation:

1. **Paused step-file workflows** — checks `session-state/*-progress.json`
2. **In-progress plans** — looks for plans with incomplete phases
3. **Pending reviews** — checks for unreviewed code
4. **Git state** — detects uncommitted changes, open PRs
5. **Memory** — surfaces recent patterns relevant to current state

## Usage

```bash
/mk:help              # Quick recommendation
/mk:help --verbose    # Detailed state with rationale
```

Not for domain complexity routing (see `mk:scale-routing`) or skill discovery (skill descriptions handle that).
