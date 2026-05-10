---
title: "mk:jira-ops"
description: "JIRA-side cache + project-context discovery. Diagnostic surface only."
---

# mk:jira-ops

## What This Skill Does

Forks the `jira-ops` agent to inspect / reset the `jira-as` local cache and discover project context (default issue types, mandatory fields). Diagnostic-only — no Jira-side state changes.

## When to Use

- **Triggers:** "jira cache status", "clear jira cache", "discover project context for PROJ"
- **NOT for:** issue CRUD · project admin ([`mk:jira-admin`](/reference/skills/jira-admin)).

## Verified Wrapper Invocations

| Operation | Tier | Invocation |
|---|---|---|
| Cache status | 1 | `... ops cache-status` |
| Cache clear | 1 | `... ops cache-clear` (clears jira-as local cache; does NOT touch Atlassian) |
| Discover project | 1 | `... ops discover-project --project PROJ` |

## When to Cache-Clear

If the user reports stale field IDs after admin changes, wrong project context, or a renamed status that search still shows under the old name — clear the cache and re-run the failing op. Cache TTL is otherwise self-managing.

## Power-User Note

`cache-warm` is intentionally NOT exposed as a primary trigger. Power users invoke it directly:

```bash
bash $CLAUDE_PROJECT_DIR/.claude/skills/jira/scripts/jira-as.sh ops cache-warm --project PROJ
```

## Domain References

- `references/rate-limits.md` — Atlassian rate-limit ceilings + back-off behaviour

## Peer Leaves

`mk:jira-bulk` is the most common trigger for cache-warm + rate-limit awareness.

## Agent

[`jira-ops`](/reference/agents/jira-ops) — A + C, NOT B.
