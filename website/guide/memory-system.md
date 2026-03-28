---
title: Memory System
description: How MeowKit persists lessons, patterns, and costs across sessions.
persona: B
---

# Memory System

MeowKit's memory system lets the AI agent learn from past sessions, track costs, and accumulate institutional knowledge.

## Memory files

| File | Purpose | Read at | Written at |
|------|---------|---------|------------|
| `memory/lessons.md` | Human-readable session learnings | Session start | Session end |
| `memory/patterns.json` | Machine-readable patterns + frequency | Session start | Session end |
| `memory/cost-log.json` | Token usage per task | On demand | Per task |
| `memory/decisions.md` | Architecture decision log | Planning | On ADR creation |
| `memory/security-log.md` | Injection audit findings | Review | On audit |

## How it works

1. **Session start:** Analyst agent reads `lessons.md` and `patterns.json`
2. **During session:** Patterns captured as they emerge
3. **Session end:** `post-session.sh` hook triggers memory capture
4. **After 10 sessions:** Analyst proposes `CLAUDE.md` updates from accumulated patterns

## patterns.json schema

```json
{
  "id": "unique-string-id",
  "type": "success | correction",
  "scope": "packages/api",
  "context": "when this pattern applies",
  "pattern": "what to do (or what not to do)",
  "frequency": 1,
  "lastSeen": "YYYY-MM-DD"
}
```

The `scope` field is optional. When present, it limits the pattern to a specific directory path (relative to project root). This supports monorepos where patterns may apply to one package but not another. Patterns without `scope` apply project-wide.

**Read-time filtering:** When plan-creator reads patterns.json (Step 0), it filters by current working directory — scoped patterns only apply when CWD is within their scope path.

## What gets remembered

- Debugging patterns that worked
- API quirks discovered (via `meow:docs-finder` annotations)
- Cost patterns (which tasks are expensive)
- Architecture decisions and their rationale
- Mistakes and their fixes (failure journals)

## Privacy

All memory stays project-local in `.claude/memory/`. No data leaves the machine. Add `.claude/memory/` to `.gitignore` if you don't want it in version control.
