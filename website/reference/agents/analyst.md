---
title: analyst
description: "Cost tracking and learning agent that extracts patterns, maintains institutional memory, and proposes improvements."
---

# analyst

Cost tracking and learning agent that extracts patterns, maintains institutional memory, and proposes improvements.

## Overview

The analyst runs at both ends of the pipeline — **Phase 0** (retroactive capture) and **Phase 6** (session extraction). It tracks token usage, generates cost reports, extracts recurring patterns into `memory/patterns.json`, and maintains lessons learned in `memory/lessons.md`.

**Phase 0 (Orient):** Checks `lessons.md` for `NEEDS_CAPTURE` markers left by the Stop hook. Processes max 3 recent markers within a 2-min budget, reconstructing learnings from `git log`.

**Phase 6 (Reflect):** Extracts learnings in 3 categories (patterns/decisions/failures), updates `patterns.json` with enriched fields (category, severity, applicable_when), and logs costs.

Every 10 sessions, it proposes updates to CLAUDE.md based on accumulated patterns (never auto-applies — always proposes for human review).

## Quick Reference

### Documentation & Management

| Capability | Details |
|-----------|---------|
| **Retroactive capture** | Phase 0: processes NEEDS_CAPTURE markers from previous sessions (max 3, 2-min budget) |
| **3-category extraction** | Phase 6: captures patterns, decisions, and failures separately |
| **Cost tracking** | Token usage per task in `memory/cost-log.json` |
| **Cost reports** | `/meow:budget` — spend by task, agent, model tier, over time |
| **Pattern extraction** | Recurring issues and solutions in `memory/patterns.json` (with category, severity, applicable_when) |
| **Lessons learned** | Human-readable learnings in `memory/lessons.md` |
| **CLAUDE.md proposals** | After 10 sessions, proposes improvements (severity ≥ critical, saves ≥ 30min, human-approved) |
| **Cost optimization** | Identifies tasks consistently over-classified to expensive tiers |
| **Consolidation** | Manual: prunes stale patterns, merges duplicates, archives old cost data (when memory reaches scale) |

## How to Use

```bash
/meow:budget    # view cost report
```

The analyst also runs automatically at session end (Phase 6).

## Under the Hood

### Handoff Example

```
Analyst (session end):
  Token usage this session: 45,000 (Sonnet)
  Patterns found: "auth tests frequently need retry" → saved to patterns.json
  Lesson: "JWT refresh logic requires integration tests, not unit tests"
  Cost note: "3 trivial tasks were classified STANDARD — could be TRIVIAL"

  Sessions since last CLAUDE.md proposal: 8 (2 more until next)

  → No handoff (terminal agent)
```

### Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Memory files corrupted | Interrupted session or manual edit | Analyst creates fresh files with empty structure |
| Cost data seems wrong | Token counting is approximate | Analyst logs what's available — never fabricates |
| CLAUDE.md proposal unwanted | Happens every 10 sessions | Review and accept/reject — never auto-applied |
