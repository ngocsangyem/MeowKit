---
name: mk:jira-dev
description: 'mk:jira leaf. Branch names, PR descriptions, commit parsing, smart-commit links. NOT for mk:ship.'
phase: on-demand
source: local
keywords:
  - jira
  - jira-dev
  - branch-name
  - pr-description
  - smart-commit
  - jira-git
when_to_use: 'Derive a branch name or a PR body from a Jira ticket.'
user-invocable: true
context: fork
agent: jira-dev
owner: jira
criticality: medium
status: active
runtime: claude-code
requires_external_service: ["jira"]
default_enabled: false
---

# mk:jira-dev

Forks to the `jira-dev` agent. Pure artifact generation — the user reviews and runs the resulting `git`/`gh` commands.

## Triggers

- "branch name for PROJ-123"
- "PR description for PROJ-123"
- "parse commits in main..HEAD for issue keys"
- "link this commit to PROJ-123"
- "link this PR to PROJ-123"

## Examples

- Branch: "give me a branch name for PROJ-123"
- PR: "draft a PR title and body from PROJ-123"
- Smart-commit: "generate a 'Closes PROJ-123' footer for my last 5 commits"

## Handoff

`mk:ship` may invoke `bash $CLAUDE_PROJECT_DIR/.claude/skills/jira/scripts/jira-as.sh dev branch-name <KEY>` during its branch-creation step (documentation-only — no automatic wiring exists today). Users opt in by passing the Jira key context to `mk:ship`.

## See also

- Agent: `../../agents/jira-dev.md`
- Shared: `../jira/references/{install-and-auth,cli-idioms,safety-framework}.md`
- Domain refs:
  - `references/branch-naming.md` — convention reference (`<type>/<KEY>-<slug>`)
  - `references/smart-commits.md` — smart-commit syntax for closing/transitioning from commit messages
  - `references/commit-messages.md` — Atlassian-aware commit-message conventions
- Peer leaves: `mk:ship` (consumes `dev branch-name` + `dev pr-description`), `mk:jira-issue` (issue must exist before branch creation), `mk:jira-lifecycle` (transitions via smart-commit footer)

## Gotchas

- (none yet)
