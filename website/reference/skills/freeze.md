---
title: "mk:freeze"
description: "Session-scoped edit restriction — blocks Edit and Write outside the allowed directory. Use when debugging to prevent scope creep."
---

# mk:freeze

Locks file edits to a specific directory for the current session. Any Edit or Write outside the allowed path is BLOCKED (not just warned). Use when debugging to prevent accidentally fixing unrelated code.

## When to use

User asks "freeze", "restrict edits", "only edit this folder", "lock down edits". NOT for blocking destructive shell commands (use `mk:careful`).

## How it works

`bin/check-freeze.sh` PreToolUse hook intercepts Edit and Write operations. If the target path is outside the allowed directory, the operation is blocked with an error message showing the freeze boundary.
