---
name: mk:freeze
version: 0.1.0
description: "Blocks Edit and Write outside one path. NOT for mk:careful."
allowed-tools:
  - Bash
  - Read
  - AskUserQuestion
hooks:
  PreToolUse:
    - matcher: Edit
      hooks:
        - type: command
          command: node
          args: ["${CLAUDE_PROJECT_DIR}/.claude/skills/freeze/bin/check-freeze.cjs"]
          statusMessage: Checking freeze boundary...
    - matcher: Write
      hooks:
        - type: command
          command: node
          args: ["${CLAUDE_PROJECT_DIR}/.claude/skills/freeze/bin/check-freeze.cjs"]
          statusMessage: Checking freeze boundary...
source: gstack
keywords:
  - freeze
  - scope-edits
  - directory-restriction
  - session-scope
  - edit-lockdown
when_to_use: "Confine a debug session."
user-invocable: true
owner: lifecycle
criticality: medium
status: active
runtime: claude-code
---

# /freeze — Restrict Edits to a Directory

Goal: confine Edit and Write to one directory, for example while debugging, so a stray edit elsewhere is blocked rather than warned about. For destructive shell commands use `mk:careful`; the two stack.

## Setup

Ask the user which directory to restrict edits to (a typed path, not multiple choice), then set it:

```bash
node ${CLAUDE_SKILL_DIR}/scripts/set-freeze.cjs "<user-provided-path>"
```

The script resolves the path, requires it to be an existing directory, saves it with a trailing slash to the state file, reads it back and prints `Freeze boundary set: <dir>`. If it prints an error instead, the boundary did not change; tell the user and ask for a valid path. It refuses a missing path, a file and the filesystem root, because a boundary of `/` would allow every edit while looking active.

Then tell the user: "Edits are now restricted to `<dir>`. Any Edit or Write outside it is blocked. Run `/mk:freeze` again with a new path to move the boundary."

## Unfreezing

The boundary lives in a state file (`${CLAUDE_PLUGIN_DATA:-.meowkit/state}/freeze-dir.txt`) and persists until it is cleared, including across sessions: a later session that loads this skill enforces the old boundary again. To remove it:

```bash
node ${CLAUDE_SKILL_DIR}/scripts/set-freeze.cjs --clear
```

## How it works

This skill registers a `PreToolUse` hook on Edit and Write (`bin/check-freeze.cjs`). The hook is active from the moment the skill is invoked and reads the state file on every call. It allows anything inside the boundary and denies the rest, with a message naming the boundary. See [references/freeze-mechanics.md](references/freeze-mechanics.md) for path resolution, symlinks and tool scope.

Bash is not restricted: `sed`, `cp` and `mv` can still change files outside the boundary. This guards against accidental edits, not against a deliberate command.

## Gotchas

- **Symlinked files bypass the check**: the hook compares the stated path, not the resolved one. Avoid symlinks inside the boundary that point outside it.
- **Files outside the boundary are blocked too**: a fixture, a plan, or an `mk:investigate` report under `tasks/reports/` is outside a frozen `src/`. Move the boundary up to include it, or clear the freeze first. There is no exclude option.
