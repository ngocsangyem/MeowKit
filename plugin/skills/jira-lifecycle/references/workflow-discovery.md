# Workflow Discovery & Caching Protocol

The authoritative source for "what statuses + transitions exist in your Jira" is **your Jira instance**, not a hardcoded template. This file documents how the `mk:jira-*` family discovers, caches, and consumes that source.

## TL;DR

```bash
# Admin path (preferred): full graph
bash $CLAUDE_PROJECT_DIR/.claude/skills/jira/scripts/fetch-workflow.sh PROJ-123

# What it writes
tasks/jira-workflows/_schemes/PROJ.md          # project → workflow mapping
tasks/jira-workflows/<workflow-slug>.md        # full statuses + transitions
```

If the user lacks Jira admin, the script falls back to per-ticket `lifecycle transitions <KEY>` and writes `_partial-PROJ.md` (explicitly INCOMPLETE).

## Verified source primitives

| jira-as command | Source line | Permission | Result |
|---|---|---|---|
| `admin workflow for-issue <KEY>` | `admin_cmds.py:3377` | Jira admin (calls `get_project_workflow_scheme` + `search_workflows`) | Full workflow def for `(project, issue-type)` of `<KEY>` |
| `admin workflow get --name NAME` | `admin_cmds.py:3343` | Jira admin | Full workflow def by name |
| `admin workflow list [--details] [--scope]` | `admin_cmds.py:3313` | Jira admin | Library of workflows in instance |
| `admin workflow-scheme list / get` | `admin_cmds.py:3398/3424` | Jira admin | Project → workflow-name maps |
| `lifecycle transitions <KEY>` | `lifecycle_cmds.py:922` | Standard read | **Per-state outgoing only** (partial) |
| `admin status list` | `admin_cmds.py:3474` | Jira admin | Status library |

## Discovery flow

```
fetch-workflow.sh PROJ-123
    │
    ├── try: admin workflow for-issue PROJ-123          ← admin path
    │       │
    │       success → extract { name, statuses, transitions }
    │              → write tasks/jira-workflows/<slug>.md
    │              → write tasks/jira-workflows/_schemes/PROJ.md
    │
    └── on 403 (permission) or non-zero exit
            ├── lifecycle transitions PROJ-123          ← non-admin fallback
            ├── append observed (from-state, to-state) tuples
            └── write tasks/jira-workflows/_partial-PROJ.md (INCOMPLETE flag)
```

## Cache file shape (admin path)

```markdown
# Workflow: <Workflow Name>

- Source: admin workflow for-issue PROJ-123
- Fetched: 2026-05-10T09:36:12Z
- Updated upstream: 2025-11-04T14:22:01Z
- Discovery scope: complete

## Statuses

| ID | Name | Category |
|---|---|---|
| 10000 | To Do | new |
| 10001 | In Progress | indeterminate |
| 10002 | Done | done |

## Transitions

| ID | Name | From | To |
|---|---|---|---|
| 11 | Start work | To Do | In Progress |
| 21 | Submit for review | In Progress | In Review |
| 31 | Done | In Review | Done |
```

## Cache freshness

Cache files carry two timestamps:

- `Fetched` — when this snapshot was taken locally.
- `Updated upstream` — Jira's `workflow.updated` field (admin path only — non-admin partial cache lacks this).

### Auto-invalidation triggers

The lifecycle agent's pre-flight runs:

```bash
# Sanity-check: do the cached transitions still match what Jira returns?
LIVE=$(bash $CLAUDE_PROJECT_DIR/.claude/skills/jira/scripts/jira-as.sh lifecycle transitions PROJ-123 --output json | jq -r '.[] | .id' | sort)
CACHED=$(grep '^| [0-9]' tasks/jira-workflows/<slug>.md | awk '{print $2}' | sort)

# If LIVE ⊄ CACHED → cache is stale, re-fetch
```

A mismatch surfaces as: "Cache may be stale (live transitions diverge). Re-fetch with `bash $CLAUDE_PROJECT_DIR/.claude/skills/jira/scripts/fetch-workflow.sh PROJ-123`?"

### Manual invalidation

- Admin notifies workflow change → user runs `fetch-workflow.sh` once per affected project.
- File age >30 days → agent surfaces a `staleness: advisory` warning.

## Non-admin reality check

If `admin workflow for-issue` returns exit 3 (permission), the partial fallback can only learn what we observe. The honest output:

```markdown
# Partial workflow discovery: PROJ

INCOMPLETE — non-admin discovery via `lifecycle transitions <KEY>` only.
Each row reflects an observed outbound transition from one ticket's current state.
The full workflow graph (all states, all transitions) requires Jira admin.

## Observed transitions

| From state | To state | Transition name | First-seen ticket |
```

The lifecycle agent should:
1. Read this file before suggesting transitions
2. If a transition isn't in the partial cache, run `lifecycle transitions <KEY>` to discover it on-demand for the current ticket
3. **Never** invent a status name — always use the user's input + verified existence in either cache or live `transitions` output

## Cross-skill consumers

| Skill | Reads | Why |
|---|---|---|
| `mk:jira-lifecycle` (this) | full cache | Recommend `--to "Status Name"` or `--id <id>` accurately |
| `mk:jira-bulk` | full cache | Dry-run output uses real status IDs |
| `mk:planning-engine` | status categories | Group "blocked" / "in-progress" / "done" by category for capacity calc |
| `mk:jira-evaluator` | status_count + transition_count | Workflow shape contributes to complexity signal |

## Educational concept patterns (NOT authoritative)

The files at `.claude/skills/jira-lifecycle/references/patterns/` (`standard-workflow.md`, `software-dev-workflow.md`, `jsm-request-workflow.md`, `incident-workflow.md`) describe **common workflow shapes** for orientation. They are NOT your project's actual workflow.

If you find yourself asking "what statuses does this project use?" — read the cache first, run `fetch-workflow.sh` if absent. Do NOT default to the patterns/ files.

## Open questions / known limits

- `admin workflow for-issue` requires Jira admin. Project-admin sufficiency varies by Atlassian deployment; runtime test only.
- Workflow `updated` timestamp from Cloud may not propagate immediately on edits; treat as advisory.
- Multi-tenant Jira (e.g., consulting orgs hopping instances) — cache is per-`CLAUDE_PROJECT_DIR`, so each working dir has its own; no cross-tenant leakage.
- jira-as version drift: if `admin workflow for-issue` is removed/renamed, `fetch-workflow.sh` falls back to non-admin discovery; agent surfaces the gap.
