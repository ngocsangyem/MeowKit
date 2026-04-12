---
name: meow:memory
description: "Use when capturing session learnings, extracting patterns, or tracking costs. Activates during Phase 0 (Orient) to load context and Phase 6 (Reflect) to persist it."
---

# Memory System Toolkit

Reference guides for MeowKit's memory system: session capture, pattern extraction, and cost tracking.

## When to Use

- During Phase 0 (Orient) to load previous session context
- During Phase 6 (Reflect) to capture learnings and patterns
- When the `analyst` agent tracks costs or extracts patterns

## Workflow Integration

Operates in **Phase 0 (Orient)** and **Phase 6 (Reflect)**. Output supports the `analyst` agent.

## References

| Reference | When to load | Content |
|-----------|-------------|---------|
| **[session-capture.md](./references/session-capture.md)** | Phase 6 | Capturing session learnings in 3 categories (patterns/decisions/failures) |
| **[pattern-extraction.md](./references/pattern-extraction.md)** | Phase 6 | Extracting high-frequency patterns for CLAUDE.md promotion |
| **[cost-tracking.md](./references/cost-tracking.md)** | Phase 0, 6 | Token usage tracking, cost reporting, budget alerts |
| **[consolidation.md](./references/consolidation.md)** | Manual | Prune stale entries, merge duplicates, archive cost data (run when memory grows large) |

## Subcommands

### `--prune`

Archive old standard-severity entries from lessons.md to lessons-archive.md.

**What gets pruned:**
- Entries with `status: captured` AND `severity: standard` AND `date` older than threshold (default: 90 days)

**What is exempt:**
- `severity: critical` or `severity: security` — never pruned regardless of age
- `status: NEEDS_CAPTURE` — not yet processed, keep for next session
- `status: live-captured` with `date` < threshold — recently captured, keep

**How to run:**
```
/meow:memory --prune              # default 90-day threshold
/meow:memory --prune --days 180   # custom threshold
/meow:memory --prune --dry-run    # show what would be archived without moving
```

**Mechanism:**
1. Read lessons.md, parse entries via memory-parser.cjs schema
2. Identify entries matching prune criteria
3. Append matched entries to `.claude/memory/lessons-archive.md`
4. Remove matched entries from lessons.md (rewrite without them)
5. Report: "Archived N entries, recovered ~X chars of injection budget"

**Recovery:** Copy entries from lessons-archive.md back to lessons.md to reactivate.

### `--capture-all`

Override marker limits — process all NEEDS_CAPTURE markers regardless of age or count.

## Schema Notes

`patterns.json` entries now support optional fields: `category` (pattern/decision/failure), `severity` (critical/standard), `applicable_when` (condition sentence). Existing entries without these fields remain valid — `severity` defaults to `standard` during extraction.

## Gotchas

- **Stale patterns applied to changed codebase**: Memory suggests patterns from old architecture → Run consolidation when patterns exceed 50 entries; flag patterns with lastSeen > 6 months
- **cost-log.json growing unbounded**: Every session appends without pruning → Run consolidation to archive entries older than 90 days
- **NEEDS_CAPTURE markers in lessons.md**: Stop hook writes markers at session end; Phase 0 processes them retroactively (max 5, 5-min budget). Markers tagged CRITICAL or SECURITY are processed regardless of age or count limit. Use `meow:memory --capture-all` to override marker limits and process all NEEDS_CAPTURE markers regardless of age or count.
