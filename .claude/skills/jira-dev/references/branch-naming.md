# Branch Naming Conventions


## Standard Format

`dev branch-name <KEY>` prints the branch name and is authoritative; this file explains its output.

```
<prefix>/<issue-key-lowercase>-<summary-slug>
```

With no flag the prefix is `feature`. `--auto-prefix` picks it from the issue type, `--prefix <p>` forces one of `feature`, `bugfix`, `hotfix`, `task`, `epic`, `spike`, `chore`, `docs`. The summary is lowercased and hyphenated, and the whole name is cut at 80 characters.

## Prefix by issue type (`--auto-prefix`)

| Prefix | Issue types |
|--------|-------------|
| `feature` | Story, Feature, New Feature, Improvement, Enhancement |
| `bugfix` | Bug, Defect |
| `hotfix` | Hotfix |
| `task` | Task, Sub-task |
| `epic` | Epic |
| `spike` | Spike, Research |
| `chore` | Chore, Maintenance |
| `docs` | Documentation |

Any other type falls back to `feature`.

## Commands

```bash
bash $CLAUDE_PROJECT_DIR/.claude/skills/jira/scripts/jira-as.sh dev branch-name PROJ-123
# Output: feature/proj-123-fix-login-button

bash $CLAUDE_PROJECT_DIR/.claude/skills/jira/scripts/jira-as.sh dev branch-name PROJ-123 --auto-prefix
bash $CLAUDE_PROJECT_DIR/.claude/skills/jira/scripts/jira-as.sh dev branch-name PROJ-123 --prefix hotfix

# Print a checkout command instead of the bare name
bash $CLAUDE_PROJECT_DIR/.claude/skills/jira/scripts/jira-as.sh dev branch-name PROJ-123 --output git
```

## Naming rules

- Lowercase kebab-case; no underscores, spaces or special characters.
- Keep the key: it is what links the branch to the issue.
