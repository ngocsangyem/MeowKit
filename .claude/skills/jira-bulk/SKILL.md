---
name: mk:jira-bulk
description: "mk:jira leaf: 10+ issues, dry-run first. NOT for mk:jira-issue."
phase: on-demand
source: local
keywords:
  - jira
  - jira-bulk
  - bulk-transition
  - bulk-assign
  - bulk-delete
  - bulk-clone
  - dry-run
when_to_use: "Change ten+ issues."
user-invocable: true
context: fork
agent: jira-bulk
owner: jira
criticality: medium
status: active
runtime: claude-code
requires_external_service: ["jira"]
default_enabled: false
---

# mk:jira-bulk

Forks to the `jira-bulk` agent. The agent enforces a hard dry-run-first rule at runtime.

## Dry-Run Rule

Every bulk command runs with `--dry-run` first; the user approves the would_* summary and its count with a plain "yes", then the command runs again without it. Bulk changes are hard or impossible to undo, so the agent refuses to skip the dry-run. A bulk delete is irreversible and also needs the typed token in `../jira/references/safety-framework.md`.

## Triggers

- "bulk update N issues"
- "mass transition"
- "transition 50+ issues matching JQL to Done"
- "bulk-clone all PROJ stories tagged 'epic-x' into PROJ2"
- "bulk-delete tickets older than 2 years matching JQL"

## Examples

- Mass transition: "transition all PROJ tickets in 'In Progress' for >30 days to Stalled"
- Reassignment: "reassign all open PROJ tickets from alice@ to bob@"
- Cleanup: "delete spam tickets matching JQL 'reporter = ext-bot AND created < -1y'" (dry-run, then the typed delete token)

## See also

- Agent: `../../agents/jira-bulk.md`
- Shared: `../jira/references/{install-and-auth,cli-idioms,safety-framework}.md` (Tier 4 enforcement lives in safety-framework.md)
- Domain refs:
  - `references/safety-checklist.md` — optional pre-flight checklist; use it above 50 issues
  - `references/checkpoint-guide.md` — `--checkpoint` resume for long runs
- **Workflow cache (read for accurate dry-run output)**:
  - `tasks/jira-workflows/<workflow-slug>.md` — discovered statuses + transitions (run `bash $CLAUDE_PROJECT_DIR/.claude/skills/jira/scripts/fetch-workflow.sh <KEY>` if absent; see `../jira-lifecycle/references/workflow-discovery.md`)
  - For `bulk transition --to "<Status>"`, validate the target status name exists in the cache. Mismatch → reject before exec.
- Peer leaves: `mk:jira-search` (JQL author; `search bulk-update` above 10 issues comes here), `mk:jira-lifecycle` (single-issue transitions; same cache), `mk:jira-relationships` (`bulk-link`) and `mk:jira-time` (`bulk-log`) own those verbs and follow the same dry-run rule

## Gotchas

- (none yet)
