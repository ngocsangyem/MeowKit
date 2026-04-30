---
title: "mk:memory"
description: "Memory system toolkit — session capture, pattern extraction, cost tracking, and topic file pruning"
---

# mk:memory

Memory system toolkit — session capture, pattern extraction, cost tracking, and topic file pruning.

## What This Skill Does

A **reference toolkit** — a collection of guides used by agents during specific workflow phases. Each guide is in the `references/` subdirectory and loaded on-demand.

| Reference | When Loaded | Content |
|-----------|-------------|---------|
| `session-capture.md` | Phase 6 | 3-category learning extraction (patterns/decisions/failures) into topic files |
| `pattern-extraction.md` | Phase 6 | Frequency-based promotion candidates from split JSON files to CLAUDE.md |
| `cost-tracking.md` | Phase 0, 6 | Token usage tracking and budget reports from `cost-log.json` |
| `consolidation.md` | Manual | Prune stale topic file entries; archive cost data |

## When to Use

Phase 0 (Orient) and Phase 6 (Reflect) persistence. At Phase 0, consumer skills load relevant topic files. At Phase 6, `mk:cook` spawns a dedicated subagent for session-capture. Pruning is manual: invoke when a topic file exceeds 300 lines or a JSON file exceeds 50 entries.

::: info Skill Details
**Phase:** 0, 6
**Used by:** analyst agent, mk:cook Phase 6 (MUST-spawn subagent)
:::

## Topic file layout

Memory is split into focused topic files. Each skill reads only the files it needs:

| File | Scope | Consumer |
|------|-------|---------|
| `fixes.md` + `fixes.json` | Bug-class patterns | mk:fix |
| `review-patterns.md` + `review-patterns.json` | Review patterns | mk:review, mk:plan-creator |
| `architecture-decisions.md` + `architecture-decisions.json` | Architectural decisions | mk:plan-creator, mk:cook |
| `security-notes.md` | Security findings | mk:cso, mk:review |

Split JSON files use schema v2.0.0 with fields: `version`, `scope`, `consumer`, `patterns[]`, `metadata`.

## Subcommands

### `--prune`

Archive old standard-severity entries from topic files to `lessons-archive.md`.

**Mechanism (grep-based — no parser dependency):**
1. For each topic file: grep for `## ` headings with date pattern `(YYYY-MM-DD, severity: standard)`
2. Compute age from today's date; identify entries older than threshold (default: 90 days)
3. Append stale entries to `.claude/memory/lessons-archive.md`
4. Rewrite topic file without stale blocks
5. Report: "Archived N entries across M files"

```
/mk:memory --prune              # default 90-day threshold
/mk:memory --prune --days 180   # custom threshold
/mk:memory --prune --dry-run    # show what would be archived without moving
```

**Exempt from pruning:** `severity: critical` or `severity: security` entries; entries without a parseable date.

**Recovery:** Copy entries from `lessons-archive.md` back to the appropriate topic file.

## Gotchas

- **Stale patterns applied to changed codebase**: Run pruning when JSON files exceed 50 entries; flag patterns with `lastSeen` > 6 months
- **cost-log.json growing unbounded**: Run consolidation to archive entries older than 90 days
- **lessons.md is now an archived stub**: Do not write to `lessons.md`. Write to topic files (`fixes.md`, `architecture-decisions.md`, `review-patterns.md`) or use `##prefix:` immediate capture instead

## Related

- [Memory System](/guide/memory-system) — Comprehensive guide with architecture, FAQ, and migration
- [Workflow Phases](/guide/workflow-phases) — Where this toolkit is used
- [analyst agent](/reference/agents/analyst) — Primary agent using these references
