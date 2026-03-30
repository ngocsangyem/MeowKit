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

## Schema Notes

`patterns.json` entries now support optional fields: `category` (pattern/decision/failure), `severity` (critical/standard), `applicable_when` (condition sentence). Existing entries without these fields remain valid — `severity` defaults to `standard` during extraction.

## Gotchas

- **Stale patterns applied to changed codebase**: Memory suggests patterns from old architecture → Run consolidation when patterns exceed 50 entries; flag patterns with lastSeen > 6 months
- **cost-log.json growing unbounded**: Every session appends without pruning → Run consolidation to archive entries older than 90 days
- **NEEDS_CAPTURE markers in lessons.md**: Stop hook writes markers at session end; Phase 0 processes them retroactively (max 3, 2-min budget)
