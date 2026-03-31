# Task Commands

Manage task files using MeowKit templates.

## task new

Create a new task file from a template.

```bash
npx mewkit task new --type <type> "description"
```

**Arguments:**

| Argument | Description |
|----------|-------------|
| description | Short description (used in filename and title) |

**Flags:**

| Flag | Description | Default |
|------|-------------|---------|
| `--type` | Template type: `feature`, `bug-fix`, `refactor`, `security` | `feature` |
| `--priority` | Priority: `critical`, `high`, `medium`, `low` | `medium` |

**Examples:**

```bash
npx mewkit task new --type feature "Add user authentication"
# Creates: tasks/active/260327-add-user-authentication.feature.md

npx mewkit task new --type bug-fix --priority high "Fix login timeout"
# Creates: tasks/active/260327-fix-login-timeout.bug-fix.md
```

## task list

List task files with status.

```bash
npx mewkit task list [--all] [--status <status>]
```

**Flags:**

| Flag | Description | Default |
|------|-------------|---------|
| `--all` | Include completed and backlog tasks | `false` |
| `--status` | Filter by status: `draft`, `in-progress`, `blocked`, `review`, `done` | all |

**Examples:**

```bash
npx mewkit task list
# Lists active tasks only

npx mewkit task list --all
# Lists all tasks (active + completed + backlog)

npx mewkit task list --status blocked
# Lists only blocked tasks
```
