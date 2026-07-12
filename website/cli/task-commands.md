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

## task-state show

Reconstruct durable resume state from the task records under `tasks/active/` — files only, no network. Marks the record whose plan matches the active-plan pointer as current, and surfaces any incompatible/corrupt record as an issue rather than crashing.

```bash
npx mewkit task-state show [--json]
```

## task-state update

Atomically update a durable task record (created for planned / long-running work). Used by orchestration workflows to record status, the last completed step, the next action, and capability decisions so a fresh session can resume. Advisory — a failed write is surfaced but never blocks the workflow.

```bash
npx mewkit task-state update <id> [--status <active|blocked|done>] [--step "<what just finished>"] [--next "<next action>"] [--plan <path>] [--json]
```

**Flags:**

| Flag       | Description                                             | Default  |
| ---------- | ------------------------------------------------------- | -------- |
| `--status` | Task status: `active`, `blocked`, `done`                | `active` |
| `--step`   | What just finished (the last completed step)            | —        |
| `--next`   | The next action to take on resume                       | —        |
| `--plan`   | Path to the plan this record joins                      | —        |

**Examples:**

```bash
npx mewkit task-state show
# Lists active task records + the current-plan marker

npx mewkit task-state update feat-auth --status active --step "wired login route" --next "add refresh-token test"
```
