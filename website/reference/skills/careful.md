---
title: "mk:careful"
description: "Safety guardrails for destructive commands — warns before rm -rf, DROP TABLE, force-push, and similar operations."
---

# mk:careful

Safety guardrails for destructive commands — warns before rm -rf, DROP TABLE, force-push, and similar operations.

## What This Skill Does

`mk:careful` intercepts destructive Bash commands via a PreToolUse hook and warns before execution. It catches: `rm -rf` on important paths, `DROP TABLE/DATABASE`, `git push --force`, `git reset --hard`, `kubectl delete`, and Docker cleanup commands. Safe exceptions (cleaning `node_modules/`, `dist/`, cache) are allowed through.

## Core Capabilities

- **PreToolUse hook** — Intercepts Bash commands before execution
- **Pattern detection** — rm -rf, DROP, force-push, hard reset, kubectl delete, docker rm
- **Safe exceptions** — Build artifacts (node_modules, dist, __pycache__, .cache) pass through
- **User override** — Warnings can be acknowledged; user decides to proceed or cancel

## Usage

Activates automatically when the skill is loaded. No explicit invocation needed.

```bash
# These trigger warnings:
rm -rf /important/path    # → WARNING: Destructive rm -rf detected
DROP TABLE users;         # → WARNING: DROP TABLE detected
git push --force          # → WARNING: Force push detected

# These pass through (safe):
rm -rf node_modules       # → OK (build artifact)
rm -rf dist               # → OK (build output)
```

::: info Skill Details
**Phase:** 5  
**Used by:** shipper agent
:::

## Gotchas

- **False positives on legitimate operations**: Pattern matching `rm` or `drop` in file content, not commands → Check command context, not just string presence
- **Overly broad regex blocking development**: Guard triggers on test fixtures or documentation mentioning destructive commands → Scope guards to actual Bash tool invocations only

## Related

- [`mk:freeze`](/reference/skills/freeze) — Restricts edits to a specific directory
- [Security Rules](/reference/configuration) — Broader security enforcement
