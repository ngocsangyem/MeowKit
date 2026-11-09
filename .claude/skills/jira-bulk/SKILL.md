---
name: mk:jira-bulk
description: 'mk:jira leaf. 10+ issues at once - transition, assign, label, clone, delete, dry-run first. NOT for mk:jira-issue.'
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
when_to_use: 'A Jira change sweeping ten or more issues in one pass.'
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

## Dry-Run Workflow (MANDATORY)

```
Step 1: invocation + --dry-run
Step 2: agent shows would_* JSON keys + impacted-count
Step 3: explicit user "yes" → re-invoke without --dry-run
```

Skipping Step 1 is a hard violation. The agent will refuse if asked to skip the dry-run.

## Triggers

- "bulk update N issues"
- "mass transition"
- "transition 50+ issues matching JQL to Done"
- "bulk-clone all PROJ stories tagged 'epic-x' into PROJ2"
- "bulk-delete tickets older than 2 years matching JQL"

## Examples

- Mass transition: "transition all PROJ tickets in 'In Progress' for >30 days to Stalled"
- Reassignment: "reassign all open PROJ tickets from alice@ to bob@"
- Cleanup: "delete spam tickets matching JQL 'reporter = ext-bot AND created < -1y'" (dry-run + 2-step confirm)

## See also

- Agent: `../../agents/jira-bulk.md`
- Shared: `../jira/references/{install-and-auth,cli-idioms,safety-framework}.md` (Tier 4 enforcement lives in safety-framework.md)
- Domain refs:
  - `references/safety-checklist.md` — pre-flight checklist for any bulk operation >50 issues
  - `references/checkpoint-guide.md` — checkpoint + resume strategy for 500+ issue ops
- **Workflow cache (read for accurate dry-run output)**:
  - `tasks/jira-workflows/<workflow-slug>.md` — discovered statuses + transitions (run `bash $CLAUDE_PROJECT_DIR/.claude/skills/jira/scripts/fetch-workflow.sh <KEY>` if absent; see `../jira-lifecycle/references/workflow-discovery.md`)
  - For `bulk transition --to "<Status>"`, validate the target status name exists in the cache; for `--id <N>`, validate the transition ID exists. Mismatch → reject before exec.
- Peer leaves: `mk:jira-search` (JQL author + `bulk-update` overlap — same dry-run discipline), `mk:jira-lifecycle` (single-issue transitions; same cache), `mk:jira-relationships` (`bulk-link` is here)

## Gotchas

- (none yet)
