---
title: "mk:freeze"
description: "Restrict file edits to a specific directory for the session — prevents accidentally modifying unrelated code."
---

# mk:freeze

Restrict file edits to a specific directory for the session — prevents accidentally modifying unrelated code.

## What This Skill Does

`mk:freeze` locks edits to a specific directory. Any attempt to Edit or Write outside that directory is blocked by a PreToolUse hook. Useful during debugging (prevent accidentally "fixing" unrelated code) or when you want to scope changes to one module.

## Core Capabilities

- **PreToolUse hook** — Blocks Edit/Write outside the frozen directory
- **Session-scoped** — Restriction lasts until unfrozen or session ends
- **Used by mk:investigate** — Automatically locks scope during debugging

## Usage

```bash
/mk:freeze src/auth/     # Only allow edits in src/auth/
/mk:freeze .              # Lock to current directory
# ... do your work ...
/unfreeze                   # Remove restriction
```

::: info Skill Details
**Phase:** any
:::

## Gotchas

- **Symlinked files bypass freeze check**: Edit tool resolves symlinks, writing outside frozen directory → Check resolved path, not just the stated path
- **Test files in frozen directory can't update fixtures**: Freeze prevents fixture updates needed for new test cases → Use --exclude pattern for test fixtures within frozen scope

## Related

- [`mk:careful`](/reference/skills/careful) — Warns on destructive commands
- [`mk:investigate`](/reference/skills/investigate) — Uses freeze for scope locking during debugging
