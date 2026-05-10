# tasks/jira-workflows/ — Discovered Jira Workflow Cache

This directory caches **actual Jira workflow definitions** discovered at runtime via the `mk:jira-*` family. **Do not commit hand-authored workflows here** — files are managed by `meowkit/.claude/skills/jira/scripts/fetch-workflow.sh`.

## Why this exists

Every Jira instance defines its own workflows. Hard-coded "default" patterns (To Do → In Progress → Done) are misleading and produce broken transitions. The right answer is to fetch the real workflow from Jira and cache it locally for downstream skills (`mk:jira-lifecycle`, `mk:jira-bulk`, `mk:planning-engine`, `mk:jira-evaluator`) to consume.

## Directory layout

```
tasks/jira-workflows/
├── README.md                            (this file)
├── _schemes/
│   └── <PROJECT_KEY>.md                 project → workflow-name mapping
├── _partial-<PROJECT_KEY>.md            non-admin partial discovery (INCOMPLETE)
└── <workflow-name-slug>.md              full workflow definition
```

## Discovery primitives (verified against jira-as source)

| Primitive | jira-as command | Permission | Result |
|---|---|---|---|
| **Admin path** | `admin workflow for-issue <KEY>` | Jira admin | Full workflow (statuses + transitions) for the workflow assigned to this `(project, issue-type)` |
| **Non-admin fallback** | `lifecycle transitions <KEY>` | Standard read | Outgoing transitions from current state only — **partial graph** |

The admin path is the gold standard. Non-admins accumulate observations into `_partial-<PROJECT_KEY>.md`; that file is explicitly labelled INCOMPLETE.

## How to populate the cache

```bash
# One ticket per (project, issue-type) is enough; auto-discovers + caches
bash $CLAUDE_PROJECT_DIR/.claude/skills/jira/scripts/fetch-workflow.sh PROJ-123
```

The wrapper:
1. Tries `admin workflow for-issue PROJ-123` first
2. On 403 (non-admin), falls back to `lifecycle transitions PROJ-123` and writes `_partial-PROJ.md`
3. Writes `_schemes/PROJ.md` (issue-type → workflow mapping) on success
4. Idempotent — re-runs refresh `fetched:` timestamp

## Freshness policy

Cache files include:
- `Fetched: <ISO timestamp>` — when this snapshot was taken
- `Updated upstream: <ISO timestamp>` — Jira's `workflow.updated` field (admin path only)

**Re-fetch when:**
- A `lifecycle transition` call returns "transition not found" or "invalid status" — cached graph is stale
- Admins notify a workflow change
- Older than 30 days (advisory; the agent surfaces this)

**Auto-invalidation**: agents compare cached transition IDs against live `lifecycle transitions <KEY>` output before suggesting a transition; mismatch triggers re-fetch.

## Cross-skill consumers

| Skill | What it consumes | Why |
|---|---|---|
| `mk:jira-lifecycle` | Full transition list | Suggest the right `--to "Status Name"` or `--id <id>` |
| `mk:jira-bulk` | Full transition list + status categories | Plan dry-run output accurately |
| `mk:planning-engine` | Status categories | Identify "blocked" / "in-progress" / "done" categories for capacity analysis |
| `mk:jira-evaluator` | Status count, transition count | Workflow shape feeds complexity signal (>5 states + parallel branches = more complex tickets) |

## What lives here vs `meowkit/.claude/skills/jira-lifecycle/references/patterns/`

- **Here (`tasks/jira-workflows/`)**: discovered, instance-specific, authoritative for this project's actual Jira.
- **There (`patterns/`)**: educational concept references describing common workflow shapes (standard 3-state, software-dev with code-review, JSM-request, incident). **NOT authoritative**; use them to understand patterns, not to predict your project's actual statuses.

When the agent suggests a transition, it MUST consult the discovered cache (or run `fetch-workflow.sh`), not the conceptual patterns.

## Git tracking

`tasks/` is meowkit-internal state. The default `.gitignore` for tasks/ should be evaluated per project — many teams keep `tasks/plans/` checked in but not `tasks/jira-workflows/` (each developer's instance differs). If your team standardizes on one Jira instance, you can commit the cache to share discovery cost. If multiple Jira tenants are involved, gitignore the cache.

Decision is left to the user; mk:jira-* skills do not enforce.
