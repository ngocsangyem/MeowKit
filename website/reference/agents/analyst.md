---
title: analyst
description: "Cost tracking and pattern capture agent. Runs at Phase 0 for budget reporting and Phase 6 for session reflection."
---

# analyst

Cost tracking and pattern capture agent that runs at both ends of the pipeline.

## Overview

The analyst runs at **Phase 0** (Orient) and **Phase 6** (Reflect). At Phase 0, it reads `cost-log.json` for budget reporting and task-cost history. At Phase 6, it processes the session's learnings and routes them to the appropriate topic file — `fixes.md` for bug-class patterns, `architecture-decisions.md` for architectural choices, or `review-patterns.md` for recurring observations.

Every 10 sessions, it proposes updates to CLAUDE.md based on accumulated patterns (never auto-applies — always proposes for human review).

**How memory loading works:** Consumer skills (meow:fix, meow:plan-creator, meow:review) load the relevant topic files on-demand at their own task start. The analyst does not auto-load or auto-inject memory on every turn — that pipeline was removed in v2.4.0. Topic files are read explicitly by the skill that needs them.

## Quick Reference

### Documentation & Management

| Capability | Details |
|-----------|---------|
| **Phase 0 reporting** | Reads `cost-log.json` for budget reporting and task-cost history |
| **3-category extraction** | Phase 6: routes learnings to fixes.md, architecture-decisions.md, or review-patterns.md |
| **Cost tracking** | Token usage per task in `memory/cost-log.json` |
| **Cost reports** | `/meow:budget` — spend by task, agent, model tier, over time |
| **Pattern capture** | Bug-class patterns → `fixes.json`; review patterns → `review-patterns.json`; decisions → `architecture-decisions.json` |
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
  Patterns found: "auth tests frequently need retry" → saved to review-patterns.json
  Decision: "JWT refresh logic requires integration tests, not unit tests" → architecture-decisions.md
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
