# Workflow Discovery & Cache

Every Jira instance defines its own workflows, so a hard-coded "To Do → In Progress → Done" produces broken transitions. The source of truth is your Jira; this file covers how the cache under `tasks/jira-workflows/` is filled, checked and used.

## Contents

- [Fill the cache](#fill-the-cache)
- [Layout](#layout)
- [Discovery primitives](#discovery-primitives)
- [Freshness](#freshness)
- [Non-admin partial cache](#non-admin-partial-cache)
- [Consumers](#consumers)
- [Git tracking](#git-tracking)

## Fill the cache

```bash
# One ticket per (project, issue-type) is enough; re-running refreshes it
bash $CLAUDE_PROJECT_DIR/.claude/skills/jira/scripts/fetch-workflow.sh PROJ-123
```

The script tries `admin workflow for-issue <KEY>` first. On a permission failure it falls back to `lifecycle transitions <KEY>` and writes an INCOMPLETE partial file. The first run creates the directory; nothing scaffolds it.

## Layout

```
tasks/jira-workflows/
├── _schemes/<PROJECT_KEY>.md      project → workflow mapping
├── _partial-<PROJECT_KEY>.md      non-admin discovery (INCOMPLETE)
└── <workflow-slug>.md             full statuses + transitions
```

The files are managed by `fetch-workflow.sh`; do not hand-author them. A workflow file looks like this:

```markdown
# Workflow: <Workflow Name>

- Source: admin workflow for-issue PROJ-123
- Fetched: 2026-05-10T09:36:12Z
- Updated upstream: 2025-11-04T14:22:01Z
- Discovery scope: complete

## Statuses
| ID | Name | Category |

## Transitions
| ID | Name | From | To |
```

## Discovery primitives

| Command | Permission | Result |
|---|---|---|
| `admin workflow for-issue <KEY>` | Jira admin | Full workflow for that issue's (project, issue type) |
| `admin workflow get --name NAME` / `list` | Jira admin | One workflow by name / the workflow library |
| `lifecycle transitions <KEY>` | Standard read | Outgoing transitions from the current state only (partial) |

## Freshness

Re-fetch when:

- a `lifecycle transition` call returns "transition not found" or "invalid status";
- an admin announces a workflow change;
- the file is older than 30 days (advisory).

Before suggesting a transition, compare the cached transition IDs with the live `lifecycle transitions <KEY>` output; if live IDs are missing from the cache, say the cache may be stale and offer `fetch-workflow.sh <KEY>`.

## Non-admin partial cache

Without admin the cache only holds transitions observed from tickets' current states. Read it first; if a transition is missing, run `lifecycle transitions <KEY>` for that ticket. Never invent a status name: use the user's input checked against the cache or the live output.

## Consumers

| Skill | Reads | Why |
|---|---|---|
| `mk:jira-lifecycle` | full cache | Suggest the right `--to "Status Name"` or `--id <id>` |
| `mk:jira-bulk` | full cache | Dry-run output uses real status names |
| `mk:planning-engine` | status categories | Group blocked / in-progress / done |
| `mk:jira-evaluator` | status and transition counts | Workflow shape feeds the complexity signal |

The files in `references/patterns/` describe common workflow shapes for orientation only; they are not your project's workflow.

## Git tracking

The cache differs per Jira instance. Commit it if the team uses one instance and wants to share the discovery cost; gitignore it when several tenants are involved. Nothing enforces either choice.
