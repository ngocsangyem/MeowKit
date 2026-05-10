---
title: "mk:jira-relationships"
description: "Manage JIRA issue relationships: link, unlink, blockers, dependencies, clone, bulk-link."
---

# mk:jira-relationships

## What This Skill Does

Forks the `jira-relationships` agent to manage issue-to-issue relationships — links, blockers, dependencies, clones, bulk-link.

## When to Use

- **Triggers:** "link PROJ-123 blocks PROJ-456", "what blocks PROJ-123", "what does PROJ-123 depend on", "clone PROJ-123", "unlink"
- **NOT for:** sprint / epic relationships (use [`mk:jira-agile`](/reference/skills/jira-agile)).

## Direction Matters

Link direction is **not symmetric**: `A blocks B` ≠ `B blocks A`. The agent confirms direction when ambiguous.

## Verified Wrapper Invocations

| Operation | Tier | Invocation |
|---|---|---|
| Link | 2 | `... relationships link PROJ-123 --type blocks --to PROJ-456` |
| Unlink | 3 | `... relationships unlink PROJ-123 --link-id <ID>` |
| Get blockers | 1 | `... relationships get-blockers PROJ-123` |
| Get dependencies | 1 | `... relationships get-dependencies PROJ-123` |
| Clone | 2 | `... relationships clone PROJ-123 --summary "..."` |
| Bulk-link by JQL | 3 | `... relationships bulk-link --jql "<JQL>" --type blocks --to PROJ-456 --dry-run` |

`bulk-link` lives in the `relationships` group (verified at `relationships_cmds.py:1661`), NOT in the `bulk` group.

## Domain References

- `references/relationship-patterns.md` — blocker-chain analysis, sprint-planning patterns, dependency strategies

## Peer Leaves

`mk:jira-bulk` (bulk-link discipline; same dry-run rules) · `mk:jira-agile` (epic ↔ child via `agile epic add`) · `mk:jira-search` (JQL-based candidate discovery before linking)

## Agent

[`jira-relationships`](/reference/agents/jira-relationships) — A + C, NOT B.
