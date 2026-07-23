---
name: "freeze"
description: "Session-scoped directory edit restriction. Blocks Edit and Write outside the allowed path for the current session only. Use when debugging to prevent accidentally \"fixing\" unrelated code, or when you want to scope changes to one module. Use when asked to \"freeze\", \"restrict edits\", \"only edit this folder\", or \"lock down edits\". NOT for blocking destructive shell commands (see mk:careful)."
---

# /freeze — Restrict Edits to a Directory

Lock file edits to a specific directory. Any Edit or Write operation targeting
a file outside the allowed path will be **blocked** (not just warned).

```bash
mkdir -p .meowkit/memory
echo '{"skill":"freeze","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","repo":"'$(basename "$(git rev-parse --show-toplevel 2>/dev/null)" 2>/dev/null || echo "unknown")'"}'  >> .meowkit/memory/skill-usage.jsonl 2>/dev/null || true
```

## Setup

Ask the user which directory to restrict edits to. Use stop and ask the user in chat:

- Question: "Which directory should I restrict edits to? Files outside this path will be blocked from editing."
- Text input (not multiple choice) — the user types a path.

Once the user provides a directory path:

1. Resolve it to an absolute path:

```bash
FREEZE_DIR=$(cd "<user-provided-path>" 2>/dev/null && pwd)
echo "$FREEZE_DIR"
```

2. Ensure trailing slash and save to the freeze state file:

```bash
FREEZE_DIR="${FREEZE_DIR%/}/"
STATE_DIR="${PLUGIN_DATA:-.meowkit/memory}"
mkdir -p "$STATE_DIR"
echo "$FREEZE_DIR" > "$STATE_DIR/freeze-dir.txt"
echo "Freeze boundary set: $FREEZE_DIR"
```

Tell the user: "Edits are now restricted to `<path>/`. Any Edit or Write
outside this directory will be blocked. To change the boundary, run `the freeze skill`
again. Freeze persists for the session — end the session or start a new one to clear it."

## How it works

See [references/freeze-mechanics.md](references/freeze-mechanics.md) for technical details on path resolution, symlink handling, state file persistence, and tool scope.

## Hooks

- **PreToolUse on Edit/Write**: Blocks writes outside the frozen directory path
- Activated by `the freeze skill <path>`. Deactivated when session ends.
- Bash commands are NOT restricted — freeze only guards Edit and Write tools

## Gotchas

- **Symlinked files bypass freeze check**: Edit tool resolves symlinks, writing outside frozen directory → Check resolved path, not just the stated path
- **Test files in frozen directory can't update fixtures**: Freeze prevents fixture updates needed for new test cases → Use --exclude pattern for test fixtures within frozen scope