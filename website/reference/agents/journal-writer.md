---
title: journal-writer
description: Failure documentation agent — captures root cause analysis, incident reports, and technical post-mortems.
---

# journal-writer

Documents failures, incidents, and escalations with brutal honesty. Captures what went wrong, what was tried, and what was learned. Activated on failure or escalation events in Phase 6.

## Key facts

| | |
|---|---|
| **Type** | Support |
| **Phase** | 6 |
| **Subagent type** | escalation |
| **Auto-activates** | On failure or escalation |
| **Never does** | Write production code |

## When activated

- Test suites fail after multiple fix attempts (self-healing exhausted)
- Critical bugs found in production
- Major refactoring efforts fail or stall
- Performance issues block releases
- Security vulnerabilities discovered
- Architectural decisions prove problematic

## Journal format

Writes to `docs/journal/YYMMDD-title.md` with: title, date, severity (Critical/High/Medium), what happened, what was tried, root cause, lessons learned, prevention steps.

## Skills loaded

`mk:memory` (session capture)
