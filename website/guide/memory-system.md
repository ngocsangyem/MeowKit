---
title: Memory System
description: How MeowKit persists learnings across sessions — topic files, immediate capture, pruning.
---

# Memory System

MeowKit stores engineering learnings in `.claude/memory/` — fix patterns, review findings, architecture decisions. Skills read only the topic files relevant to their domain. There is no auto-injection pipeline.

## Topic files

| File | Consumer | Read when |
|------|----------|-----------|
| `fixes.md` + `fixes.json` | `mk:fix` | Bug diagnosis |
| `review-patterns.md` + `review-patterns.json` | `mk:review`, `mk:plan-creator` | Code review or planning |
| `architecture-decisions.md` + `architecture-decisions.json` | `mk:plan-creator`, `mk:cook` | Architecture work |
| `security-notes.md` | `mk:cso`, `mk:review` | Security audit |
| `cost-log.json` | analyst, `mk:memory` | Cost reporting |
| `decisions.md` | architect | Long-form ADRs |
| `conversation-summary.md` | (auto) | Session continuity (≤4KB per turn) |

**Machine-local by default.** `.claude/memory/*` is gitignored — content is developer-specific working state. Only `.gitkeep` is tracked.

## How to capture

### Immediate capture (anytime during a session)

Type messages with `##` prefix. The `immediate-capture-handler.cjs` hook routes them:

| Prefix | Target |
|--------|--------|
| `##pattern: bug-class <description>` | `fixes.json` |
| `##pattern: <description>` | `review-patterns.json` |
| `##decision: chose X over Y because…` | `architecture-decisions.json` |
| `##note: <text>` | `quick-notes.md` |

Captures pass injection validation and secret scrubbing before writing. All writes are atomic (temp-file + rename).

### Session-end capture

The Stop hook auto-appends cost entries to `cost-log.json`. Phase 6 `mk:memory session-capture` extracts patterns, decisions, and failures from the session.

## How to read

Skills include a "Load memory" step in their SKILL.md. The agent uses `Read` to load the relevant topic file at task start. Nothing is injected on subsequent turns.

## Pruning

```bash
/mk:memory --prune              # Archive entries older than 90 days
/mk:memory --prune --days 180   # Custom threshold
/mk:memory --prune --dry-run    # Preview without writing
```

Entries move to `lessons-archive.md`. Exempt: entries marked `severity: critical` or `severity: security`. Prune when a single topic file exceeds 300 lines or all topic files exceed 500 lines.

## Separate from Claude Code auto-memory

Claude Code has its own auto-memory at `~/.claude/projects/<project>/memory/`. It is separate from MeowKit's `.claude/memory/`. Use Claude Code auto-memory for personal habits; use MeowKit memory for project-specific engineering artifacts.

## See also

- [How It Works](/core-concepts/how-it-works) — memory in the architecture overview
- [docs/memory-system.md](/docs/memory-system) — full system reference
