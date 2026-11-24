# mk:jira — Verified CLI Idioms (jira-as)

This file is the **canonical syntax reference** for every `mk:jira-*` agent and skill.

When in doubt, run `bash scripts/jira-as.sh <group> <verb> --help` to confirm the actual signature for any specific command — `--help` is always authoritative.

## Core Rule: positional issue/project keys; flags for everything else

`jira-as` exposes the primary **issue key** (e.g. `PROJ-123`) or **project key** as a positional argument on most read/update/delete operations. Almost every other parameter — including JQL on most commands, target status, target project on create, time-spent duration — is a flag.

Two exceptions worth memorizing:

- `jira-as search query "JQL ..."` — JQL is positional
- `jira-as search validate "JQL ..."` — JQL is positional (variadic)

Everywhere else, **assume flags** and verify per-command via `--help`.

## Wrapper invocation

All `jira-as` invocations from agents/skills MUST go through:

```
bash scripts/jira-as.sh <args>
```

The wrapper:

- Resolves to this skill's own `.meowkit/envs/jira/bin/jira-as`
- Reads the env files (`.meowkit/.env`, the env file an older install kept in the runtime folder, `~/.meowkit/.env`; a shell export wins) and translates `MEOW_JIRA_*` → `JIRA_*`
- Exports `JIRA_OUTPUT=json` as default (drop `--output json` flag noise from per-call examples)

## Verified Quick Examples

| Operation            | Verified syntax                                                                     |
| -------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Get one issue        | `jira-as issue get PROJ-123`                                                        |
| Create an issue      | `jira-as issue create --project PROJ --type Task --summary "Login fails on Safari"` |
| Create from template | `jira-as issue create --project PROJ --template bug --summary "..."`                |
| Update an issue      | `jira-as issue update PROJ-123 --summary "..."`                                     |
| Delete an issue      | `jira-as issue delete PROJ-123`                                                     |
| Search by JQL        | `jira-as search query "project = PROJ AND status = Open"`                           |
| Validate JQL         | `jira-as search validate "project = PROJ"`                                          |
| Transition an issue  | `jira-as lifecycle transition PROJ-123 --to "In Progress"`                          |
| Log work             | `jira-as time log PROJ-123 --time 2h`                                               |
| Assign               | `jira-as lifecycle assign PROJ-123 --user john.doe`                             |
| Add comment          | `jira-as collaborate comment add PROJ-123 --body "text"`                            |
| Link issues          | `jira-as relationships link PROJ-123 --type blocks --to PROJ-456`                   |

Most parameters beyond the primary issue/project key are flags. Always confirm via `--help` before authoring agent invocations.

## Output convention

- The wrapper sets `JIRA_OUTPUT=json` default. Per-call `--output json` flag is unnecessary.
- Agents pipe through `jq` to project only what's needed: `... | jq '{key, summary: .fields.summary}'`.
- Never copy raw stdout into Claude's context — always project via `jq`.
- User override: `JIRA_OUTPUT=text bash scripts/jira-as.sh ...` still works.

## Common per-command flags

These appear across many groups (verify per call via `--help`):

| Flag              | Meaning                                                        |
| ----------------- | -------------------------------------------------------------- | ------ | -------------------------------- |
| `--limit N`       | cap result count for list/search                               |
| `--dry-run`       | show what _would_ happen without exec; surfaces `would_*` keys |
| `--force`         | skip confirmation (only after a `--dry-run` review)            |
| `--output text    | json                                                           | table` | override the default JSON output |
| `--field foo=bar` | repeated flag for setting custom field values                  |

## Group → canonical verb cheat sheet

| Group           | Common verbs                                                                                                                                                    |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `issue`         | `get`, `create`, `update`, `delete`                                                                                                                             |
| `search`        | `query`, `validate`, `build`, `suggest`, `export`, `bulk-update`, `filter`                                                                                      |
| `lifecycle`     | `transition`, `assign`, `resolve`, `reopen`, `version`, `component`                                                                                             |
| `collaborate`   | `comment {add,list,update,delete}`, `attachment {upload,list,download}`, `watchers`, `notify`, `activity`                                                                              |
| `relationships` | `link`, `unlink`, `get-blockers`, `get-dependencies`, `clone`, `bulk-link`                                                                                      |
| `time`          | `log`, `worklogs`, `update-worklog`, `delete-worklog`, `estimate`, `tracking`, `report`, `export`, `bulk-log`                                                   |
| `agile`         | `backlog`, `rank`, `estimate`, `velocity`, `subtask`, `epic`, `sprint`                                                                                          |
| `fields`        | `list`, `create`, `check-project`, `configure-agile`                                                                                                            |
| `bulk`          | `transition`, `assign`, `set-priority`, `clone`, `delete` (always with `--dry-run` first); `bulk-link` is under `relationships`, `bulk-log` under `time`                                                                     |
| `jsm`           | `service-desk`, `request-type`, `request`, `customer`, `organization`, `queue`, `sla`, `approval`                                                               |
| `admin`         | `project`, `config`, `category`, `user`, `group`, `automation`, `automation-template`, `permission-scheme`, `permission`, `notification-scheme`, `notification` |
| `dev`           | `branch-name`, `pr-description`, `parse-commits`, `link-commit`, `link-pr`, `get-commits`                                                                       |
| `ops`           | `cache-status`, `cache-clear`, `discover-project`, `cache-warm`                                                                                                 |

## Conflict resolution

If a phase doc / older example contradicts this file, **this file wins**. If this file contradicts `--help` output, **`--help` wins** — and update this file.
