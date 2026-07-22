---
name: "jira-dev"
description: "Generate developer artifacts from Jira tickets via the jira-as wrapper: branch names, PR descriptions, parsed commits, commit/PR-to-issue links. Triggers: 'branch name for KEY', 'PR description for KEY', 'parse commits for issue keys', 'link PR to KEY'. NOT for executing git/gh commands directly (mk:ship); NOT for issue CRUD (mk:jira-issue)."
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

`mk:ship` may invoke `bash $(git rev-parse --show-toplevel)/.agents/skills/jira/scripts/jira-as.sh dev branch-name <KEY>` during its branch-creation step (documentation-only — no automatic wiring exists today). Users opt in by passing the Jira key context to `mk:ship`.

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