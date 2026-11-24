---
name: mk:jira-lifecycle
description: "mk:jira leaf: transition, assign. NOT for mk:jira-bulk."
phase: on-demand
source: local
keywords:
  - jira
  - jira-lifecycle
  - jira-transition
  - jira-assign
  - jira-resolve
  - jira-version
  - jira-component
when_to_use: "Change status."
user-invocable: true
context: fork
agent: jira-lifecycle
owner: jira
criticality: medium
status: active
runtime: claude-code
requires_external_service: ["jira"]
default_enabled: false
---

# mk:jira-lifecycle

Forks to the `jira-lifecycle` agent. `lifecycle transition` takes the issue key positional + a `--to "Status Name"` flag (or `--id <transition_id>`).

**Discover before suggesting transitions.** Read `tasks/jira-workflows/`; if it is empty for the project, run `bash $CLAUDE_PROJECT_DIR/.claude/skills/jira/scripts/fetch-workflow.sh <KEY>`. Details: `references/workflow-discovery.md`.

## Triggers

- "transition PROJ-123 to In Progress"
- "mark PROJ-123 as Done with resolution Fixed"
- "assign PROJ-123 to john.doe"
- "reopen PROJ-123"
- "release version v1.0.0 in PROJ" (versions and components are in this leaf)

## Examples

- Status change: "move PROJ-123 to In Review with comment 'ready for QA'"
- Resolution-required: "close PROJ-456 with resolution Won't Fix"
- Assignment: "assign all my open PROJ tickets to john.doe" (the agent will refuse — that's bulk; redirect to `mk:jira-bulk`)

## See also

- Agent: `../../agents/jira-lifecycle.md`
- Shared: `../jira/references/{install-and-auth,cli-idioms,safety-framework}.md`
- `references/workflow-discovery.md` — discovery, cache layout and freshness (read first)
- `references/workflow-transitions.md` — common transition idioms + resolution-required patterns
- `references/patterns/*.md` — illustrative workflow shapes (standard, software-dev, JSM request, incident); load only on request, they are not this project's workflow
- Peer leaves: `mk:jira-bulk` (bulk transition; reads same workflow cache), `mk:jira-jsm` (JSM-specific transitions), `mk:jira-collaborate` (transition `--comment` body templates)

## Gotchas

- (none yet — grow from observed failures)
