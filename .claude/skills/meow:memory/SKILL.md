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
| **[session-capture.md](./references/session-capture.md)** | Phase 6 | Capturing session context for future sessions |
| **[pattern-extraction.md](./references/pattern-extraction.md)** | Phase 6 | Extracting recurring patterns from session history |
| **[cost-tracking.md](./references/cost-tracking.md)** | Phase 0, 6 | Token usage tracking, cost reporting, budget alerts |

## Gotchas

- **Stale patterns applied to changed codebase**: Memory suggests patterns from old architecture → Include timestamp and context hash in pattern entries; flag old patterns on read
- **cost-log.json growing unbounded**: Every session appends without pruning → Implement monthly rollup: archive entries older than 90 days
