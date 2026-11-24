---
name: mk:careful
version: 0.1.0
description: "Warns before rm -rf, DROP TABLE, force-push. NOT for mk:freeze."
allowed-tools:
  - Bash
  - Read
hooks:
  PreToolUse:
    - matcher: Bash
      hooks:
        - type: command
          command: node
          args: ["${CLAUDE_PROJECT_DIR}/.claude/skills/careful/bin/check-careful.cjs"]
          statusMessage: Checking for destructive commands...
source: gstack
keywords:
  - careful
  - safety-mode
  - destructive-commands
  - prod-mode
  - guardrails
when_to_use: "Working on prod."
user-invocable: true
owner: research
criticality: medium
status: active
runtime: claude-code
---

# /careful — Destructive Command Guardrails

Goal: ask before a destructive shell command runs (`rm -rf`, `DROP TABLE`, force-push, `reset --hard`, `kubectl delete`), for the rest of the session. To confine edits to one directory instead, use `mk:freeze`; the two stack.

## What's protected

See [references/destructive-patterns.md](references/destructive-patterns.md) for the full pattern list and its known gaps.

## How it works

This skill registers a `PreToolUse` hook on Bash (`bin/check-careful.cjs`). The hook is active from the moment the skill is invoked and ends with the session. It reads the command from the tool input, matches it against the pattern table, and when one matches it asks you to confirm before the command runs. You can approve a single command; each match asks again.

In a production-like environment the answer is stricter. When `NODE_ENV`, `APP_ENV` or `ENVIRONMENT` names production, prod or staging, a CRITICAL command is refused outright with no prompt to override; only a person changing that environment variable lifts it. HIGH patterns still ask. Recursive deletes of build outputs and dependency trees (`node_modules`, `dist`, `.next` and similar) pass without a prompt.

Each match is appended to a log of override requests; it records the request, not your decision.

## Hooks

- **Bash command guard**: asks before destructive commands; refuses CRITICAL ones in a production-like environment. It checks Bash only: Edit and Write are not covered (see `mk:freeze`).
- Session-scoped: it exists only because `mk:careful` was invoked.

## Gotchas

- **False positives on legitimate operations**: Pattern matching `rm` or `drop` in file content, not commands → Check command context, not just string presence
- **Overly broad regex blocking development**: Guard triggers on test fixtures or documentation mentioning destructive commands → Scope guards to actual Bash tool invocations only
