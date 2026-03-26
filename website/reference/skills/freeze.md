---
title: "meow:freeze"
description: "Restrict file edits to a specific directory for the session — prevents accidentally modifying unrelated code."
---

# meow:freeze

Restrict file edits to a specific directory for the session — prevents accidentally modifying unrelated code.

## What This Skill Does

`meow:freeze` locks edits to a specific directory. Any attempt to Edit or Write outside that directory is blocked by a PreToolUse hook. Useful during debugging (prevent accidentally "fixing" unrelated code) or when you want to scope changes to one module.

## Core Capabilities

- **PreToolUse hook** — Blocks Edit/Write outside the frozen directory
- **Session-scoped** — Restriction lasts until unfrozen or session ends
- **Used by meow:investigate** — Automatically locks scope during debugging

## Usage

```bash
/meow:freeze src/auth/     # Only allow edits in src/auth/
/meow:freeze .              # Lock to current directory
# ... do your work ...
/unfreeze                   # Remove restriction
```

## Related

- [`meow:careful`](/reference/skills/careful) — Warns on destructive commands
- [`meow:investigate`](/reference/skills/investigate) — Uses freeze for scope locking during debugging
