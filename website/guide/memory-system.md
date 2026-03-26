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

## What gets remembered

- Debugging patterns that worked
- API quirks discovered (via `meow:docs-finder` annotations)
- Cost patterns (which tasks are expensive)
- Architecture decisions and their rationale
- Mistakes and their fixes (failure journals)

## Privacy

All memory stays project-local in `.claude/memory/`. No data leaves the machine. Add `.claude/memory/` to `.gitignore` if you don't want it in version control.
