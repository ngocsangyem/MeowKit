# mk:jira — Verified CLI Idioms (jira-as)

This file is the **canonical syntax reference** for every `mk:jira-*` agent and skill. Authored from `docs/jira-as/README.md` + direct verification against `src/jira_as/cli/commands/*.py` Click decorators.

When in doubt, run `bash $CLAUDE_PROJECT_DIR/.claude/skills/jira/scripts/jira-as.sh <group> <verb> --help` to confirm the actual signature for any specific command — `--help` is always authoritative.

## Core Rule: positional issue/project keys; flags for everything else

`jira-as` exposes the primary **issue key** (e.g. `PROJ-123`) or **project key** as a positional argument on most read/update/delete operations. Almost every other parameter — including JQL on most commands, target status, target project on create, time-spent duration — is a flag.

Two exceptions worth memorizing:
- `jira-as search query "JQL ..."` — JQL is positional
- `jira-as search validate "JQL ..."` — JQL is positional (variadic)

Everywhere else, **assume flags** and verify per-command via `--help`.

## Wrapper invocation

All `jira-as` invocations from agents/skills MUST go through:

```
bash $CLAUDE_PROJECT_DIR/.claude/skills/jira/scripts/jira-as.sh <args>
```

The wrapper:
- Resolves to venv-local `.claude/skills/.venv/bin/jira-as`
- Sources `.claude/.env` and translates `MEOW_JIRA_*` → `JIRA_*`
- Exports `JIRA_OUTPUT=json` as default (drop `--output json` flag noise from per-call examples)

## Verified Quick Examples

| Operation | Verified syntax | Source |
|---|---|---|
| Get one issue | `jira-as issue get PROJ-123` | `issue_cmds.py:453` (positional) |
| Create an issue | `jira-as issue create --project PROJ --type Task --summary "Login fails on Safari"` | `issue_cmds.py:542` (`--project` required, `--summary` required) |
| Create from template | `jira-as issue create --project PROJ --template bug --summary "..."` | same |
| Update an issue | `jira-as issue update PROJ-123 --summary "..."` | `issue_cmds.py:665` (positional key) |
| Delete an issue | `jira-as issue delete PROJ-123` | `issue_cmds.py:732` |
| Search by JQL | `jira-as search query "project = PROJ AND status = Open"` | `search_cmds.py:1176` (positional) |
| Validate JQL | `jira-as search validate "project = PROJ"` | `search_cmds.py:1273` |
| Transition an issue | `jira-as lifecycle transition PROJ-123 --to "In Progress"` | `lifecycle_cmds.py:851` (positional key, `--to` flag) |
| Log work | `jira-as time log PROJ-123 --time 2h` | `time_cmds.py:1181` (positional key, `--time` flag) |
| Assign | `jira-as lifecycle assign PROJ-123 --assignee john.doe` | `lifecycle_cmds.py:923` |
| Add comment | `jira-as collaborate comment add PROJ-123 --body "text"` | `collaborate_cmds.py` (verify via `--help`) |
| Link issues | `jira-as relationships link PROJ-123 --type blocks --to PROJ-456` | `relationships_cmds.py` (verify via `--help`) |

Most parameters beyond the primary issue/project key are flags. Always confirm via `--help` before authoring agent invocations.

## Output convention

- The wrapper sets `JIRA_OUTPUT=json` default. Per-call `--output json` flag is unnecessary.
- Agents pipe through `jq` to project only what's needed: `... | jq '{key, summary: .fields.summary}'`.
- Never copy raw stdout into Claude's context — always project via `jq`.
- User override: `JIRA_OUTPUT=text bash $CLAUDE_PROJECT_DIR/.claude/skills/jira/scripts/jira-as.sh ...` still works.

## Common per-command flags

These appear across many groups (verify per call via `--help`):

| Flag | Meaning |
|---|---|
| `--limit N` | cap result count for list/search |
| `--dry-run` | show what *would* happen without exec; surfaces `would_*` keys |
| `--force` | skip confirmation (only after a `--dry-run` review) |
| `--output text|json|table` | override the default JSON output |
| `--field foo=bar` | repeated flag for setting custom field values |

## Group → canonical verb cheat sheet

| Group | Common verbs |
|---|---|
| `issue` | `get`, `create`, `update`, `delete` |
| `search` | `query`, `validate`, `build`, `suggest`, `export`, `bulk-update`, `filter` |
| `lifecycle` | `transition`, `assign`, `resolve`, `reopen`, `version`, `component` |
| `collaborate` | `comment {add,list,update,delete}`, `attachment {upload,list,download}`, `watcher` |
| `relationships` | `link`, `unlink`, `get-blockers`, `get-dependencies`, `clone`, `bulk-link` |
| `time` | `log`, `worklogs`, `update-worklog`, `delete-worklog`, `estimate`, `tracking`, `report`, `export`, `bulk-log` |
| `agile` | `backlog`, `rank`, `estimate`, `velocity`, `subtask`, `epic`, `sprint` |
| `fields` | `list`, `create`, `check-project`, `configure-agile` |
| `bulk` | `transition`, `assign`, `set-priority`, `clone`, `delete` (always with `--dry-run` first) |
| `jsm` | `service-desk`, `request-type`, `request`, `customer`, `organization`, `queue`, `sla`, `approval` |
| `admin` | `project`, `config`, `category`, `user`, `group`, `automation`, `automation-template`, `permission-scheme`, `permission`, `notification-scheme`, `notification` |
| `dev` | `branch-name`, `pr-description`, `parse-commits`, `link-commit`, `link-pr`, `get-commits` |
| `ops` | `cache-status`, `cache-clear`, `discover-project`, `cache-warm` |

## Per-command flag verification (mandatory during agent authoring)

When authoring a `jira-{leaf}` agent's Operations table, run:

```
bash $CLAUDE_PROJECT_DIR/.claude/skills/jira/scripts/jira-as.sh <group> <verb> --help
```

Capture the actual signature. Do NOT infer flags from prose examples in this file or other docs — `--help` is authoritative.

## Conflict resolution

If a phase doc / older example contradicts this file, **this file wins**. If this file contradicts `--help` output, **`--help` wins** — and update this file.
