---
title: "mk:jira-lifecycle"
description: "Drive JIRA workflow lifecycle via the jira-as wrapper. Cache-first transition discovery."
---

# mk:jira-lifecycle

## What This Skill Does

Forks the `jira-lifecycle` agent to drive workflow transitions, assignment, resolution, version + component management on a single Jira issue. **Workflow discovery is mandatory** before suggesting transitions — the agent reads `tasks/jira-workflows/` (instance-discovered cache) before recommending a `--to "Status Name"` or `--id <id>`.

## When to Use

- **Triggers:** "transition PROJ-123 to In Progress", "mark PROJ-123 as Done with resolution Fixed", "assign PROJ-123 to john.doe", "reopen PROJ-123", "release version v1.0.0"
- **NOT for:** issue CRUD ([`mk:jira-issue`](/reference/skills/jira-issue)), comments ([`mk:jira-collaborate`](/reference/skills/jira-collaborate)), bulk transitions ([`mk:jira-bulk`](/reference/skills/jira-bulk)).

## Workflow Discovery (NEW in 2.8.3)

Status names + transition graphs differ per Jira instance. Hardcoded defaults are misleading. Discovery flow:

```bash
bash $CLAUDE_PROJECT_DIR/.claude/skills/jira/scripts/fetch-workflow.sh PROJ-123
```

Tries `admin workflow for-issue PROJ-123` first (admin path → full graph). Falls back to `lifecycle transitions PROJ-123` on 403 (non-admin → partial graph). Writes the cache to:

```
tasks/jira-workflows/_schemes/<PROJECT_KEY>.md   # project → workflow-name
tasks/jira-workflows/<workflow-slug>.md          # full statuses + transitions
```

The pattern files (`patterns/standard-workflow.md`, `patterns/software-dev-workflow.md`, etc.) are **CONCEPT REFERENCES, NOT AUTHORITATIVE** — always prefer the discovered cache. See `references/workflow-discovery.md`.

## Verified Wrapper Invocations

| Operation | Tier | Invocation |
|---|---|---|
| Transition by name | 3 | `... lifecycle transition PROJ-123 --to "In Progress"` |
| Transition by ID | 3 | `... lifecycle transition PROJ-123 --id 21` |
| Transition w/ resolution | 3 | `... lifecycle transition PROJ-123 --to Done --resolution Fixed` |
| Assign | 3 | `... lifecycle assign PROJ-123 --user john.doe` |
| Resolve | 3 | `... lifecycle resolve PROJ-123 --resolution Fixed` |
| Reopen | 3 | `... lifecycle reopen PROJ-123` |
| Version create / release | 3 | `... lifecycle version create PROJ --name "v1.0.0"` |

## Resolution-Required Transitions

Many workflows require `--resolution` when transitioning to Done / Closed. The agent proactively prompts when omitted.

## Domain References

- `references/workflow-discovery.md` — discovery + caching protocol (READ FIRST)
- `references/workflow-transitions.md` — common transition idioms + resolution-required patterns
- `references/patterns/{standard,software-dev,jsm-request,incident}-workflow.md` — concept references (NOT authoritative)

## Peer Leaves

`mk:jira-bulk` (bulk transitions; same workflow cache) · `mk:jira-jsm` (JSM-specific transitions) · `mk:jira-collaborate` (transition `--comment` body)

## Agent

[`jira-lifecycle`](/reference/agents/jira-lifecycle) — A + C, NOT B.
