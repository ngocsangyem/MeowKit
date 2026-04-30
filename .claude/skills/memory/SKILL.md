---
name: mk:memory
description: "Topic-file-scoped session memory. Use when capturing session learnings, extracting patterns, or tracking costs — persists to .claude/memory/ topic files (fixes.md, review-patterns.md, architecture-decisions.md). Activates during Phase 0 (Orient) to load context and Phase 6 (Reflect) to persist it. NOT for weekly-cadence engineering retrospectives (see mk:retro); NOT for arbitrary file storage."
---

# Memory System Toolkit

Reference guides for the memory system: session capture, pattern extraction, and cost tracking.

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

Archive old standard-severity entries from topic files to `lessons-archive.md`.

**Topic files subject to pruning:**
- `fixes.md` — bug-class session learnings
- `review-patterns.md` — process/review learnings
- `architecture-decisions.md` — architectural decision records

**What gets pruned:**
- `## headings` with a date `(YYYY-MM-DD, severity: standard)` older than threshold (default: 90 days)

**What is exempt:**
- `severity: critical` or `severity: security` entries — never pruned
- Entries without a parseable date — kept as-is (safe default)

**How to run:**
```
/mk:memory --prune              # default 90-day threshold
/mk:memory --prune --days 180   # custom threshold
/mk:memory --prune --dry-run    # show what would be archived without moving
```

**Mechanism (grep-based — no parser dependency):**
1. For each topic file: grep for `## ` headings + date pattern `(YYYY-MM-DD, severity: standard)`
2. Compute age from today's date; identify entries older than threshold
3. Append stale entries to `.claude/memory/lessons-archive.md`
4. Remove stale entry blocks from topic file (rewrite without them)
5. Report: "Archived N entries across M files"

**Recovery:** Copy entries from `lessons-archive.md` back to the appropriate topic file.

## Schema Notes

Split JSON files (`fixes.json`, `review-patterns.json`, `architecture-decisions.json`) all use v2.0.0 schema with fields: `version`, `scope`, `consumer`, `patterns[]`, `metadata`. Each pattern entry supports: `id`, `type`, `category`, `severity`, `domain`, `applicable_when`, `context`, `pattern`, `frequency`, `lastSeen`.

## Gotchas

- **Stale patterns applied to changed codebase**: Memory suggests patterns from old architecture → Run consolidation when patterns exceed 50 entries; flag patterns with lastSeen > 6 months
- **cost-log.json growing unbounded**: Every session appends without pruning → Run consolidation to archive entries older than 90 days
- **lessons.md is now archived**: Do not write to lessons.md — it is a stub. Write to topic files (fixes.md, architecture-decisions.md, review-patterns.md) instead.
