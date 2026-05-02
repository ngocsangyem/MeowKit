---
title: "mk:memory"
description: "Session memory toolkit — capture learnings, extract patterns, track costs. Persists to .claude/memory/ topic files."
---

# mk:memory

Topic-file-scoped session memory. Captures learnings, extracts patterns, and tracks costs. Persists to `.claude/memory/` topic files. Activates during Phase 0 (Orient) to load context and Phase 6 (Reflect) to persist it.

## When to use

- Phase 0 (Orient): load previous session context
- Phase 6 (Reflect): capture learnings and patterns
- When `analyst` agent tracks costs or extracts patterns

## Subcommands

### `--prune`

Archive old standard-severity entries from topic files to `lessons-archive.md`. Topic files pruned: `fixes.md`, `review-patterns.md`, `architecture-decisions.md`. Exempt: entries marked `severity: critical` or `severity: security`, entries with no parseable date.

```bash
/mk:memory --prune              # Default 90-day threshold
/mk:memory --prune --days 180   # Custom threshold
/mk:memory --prune --dry-run    # Preview without writing
```

### `session-capture`

Phase 6 extraction: patterns, decisions, failures from the session. Appends to the appropriate topic file by category.

## References (loaded on-demand)

| Reference | When | Content |
|---|---|---|
| `session-capture.md` | Phase 6 | 3-category capture (patterns/decisions/failures) |
| `pattern-extraction.md` | Phase 6 | High-frequency pattern extraction for CLAUDE.md promotion |
| `cost-tracking.md` | Phase 0, 6 | Token usage tracking, cost reporting, budget alerts |
| `consolidation.md` | Manual | Prune stale entries, merge duplicates, archive cost data |
