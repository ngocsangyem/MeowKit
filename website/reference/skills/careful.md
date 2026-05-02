---
title: "mk:careful"
description: "Session-scoped safety guardrails — warns before rm -rf, DROP TABLE, force-push, git reset --hard, and other destructive operations."
---

# mk:careful

Session-scoped safety guardrails for destructive commands. Warns before `rm -rf`, `DROP TABLE`, `force-push`, `git reset --hard`, `kubectl delete`, and similar operations. Active for current session only. User can override each warning.

## When to use

Touching prod, debugging live systems, working in a shared environment. User asks "be careful", "safety mode", "prod mode", "careful mode". NOT for scoping edits to a directory (use `mk:freeze`).

## How it works

Every bash command is checked against destructive patterns via `bin/check-careful.sh` PreToolUse hook before running. If detected: warns and asks user to proceed or cancel. Full pattern list at `references/destructive-patterns.md`.
