---
title: "mk:freeze"
description: "Session-scoped edit restriction — blocks Edit and Write tools outside an allowed directory. Gate for preventing accidental scope creep during debugging or focused work."
---

## What This Skill Does

Locks all Edit and Write tool operations to a single directory for the current session. Any attempt to edit or write a file outside the allowed path is **denied** (not just warned). The freeze enforces intent boundaries — it prevents accidentally fixing unrelated code while working on a specific module. Bash commands (`sed`, `awk`, `cp`, `mv`) are NOT restricted.

## When to Use

- Debugging a specific module and want to prevent accidentally touching other code
- User asks "freeze", "restrict edits", "only edit this folder", "lock down edits"
- Working in a monorepo where one change could cascade into unrelated packages

**NOT for:** blocking destructive shell commands (use `mk:careful`).

## Core Capabilities

| Aspect | Behavior |
|--------|---------|
| Edit tool | Blocked outside freeze boundary |
| Write tool | Blocked outside freeze boundary |
| Bash tool | NOT restricted (can still `sed`, `awk`, `cp`, `mv` anywhere) |
| Read tool | NOT restricted (can read any file) |
| Glob/Grep | NOT restricted (can search anywhere) |
| Scope | Session only — clears on conversation end or new session |
| Override | None — denied operations cannot be overridden |

## Arguments

`/mk:freeze `PATH` — the directory to restrict edits to. If no path is given, the skill prompts via AskUserQuestion for a text input path.

## Workflow

1. **User runs** `/mk:freeze` or `/mk:freeze `PATH`
2. **If no path given:** AskUserQuestion prompts for directory (text input, not multiple choice)
3. **Path resolution:**
   ```bash
   FREEZE_DIR=$(cd "<user-provided-path>" 2>/dev/null && pwd)
   FREEZE_DIR="${FREEZE_DIR%/}/"   # trailing slash is CRITICAL
   ```
4. **State stored:** `${CLAUDE_PLUGIN_DATA:-.claude/memory}/freeze-dir.txt`
5. **Hook activates:** `bin/check-freeze.sh` registered as PreToolUse on Edit and Write
6. **Every Edit/Write:** hook reads `file_path` from tool input, compares against stored freeze boundary
7. **Inside boundary:** `permissionDecision: "allow"`
8. **Outside boundary:** `permissionDecision: "deny"` with message showing the freeze boundary

## Trailing Slash Requirement

The trailing `/` prevents false matches. Without it, freezing `/src` would also match `/src-old` or `/src-backup` on a prefix check. The trailing slash ensures `/src/` only matches files under `/src/`.

## Symlink Warning

The hook checks the **stated** `file_path`, not the resolved symlink target. If the Edit tool resolves symlinks internally, a file could be written outside the frozen directory despite having a path inside it. Avoid placing symlinks inside the frozen directory that point outside.

## Deactivation

Freeze deactivates when:
- The conversation ends or a new session starts
- A new freeze is set with a different path (overwrites state file)
- User manually deletes `freeze-dir.txt`

## Common Use Cases

1. **Debugging a single service in a monorepo** — freeze to `packages/auth/`, prevent accidentally modifying `packages/api/`
2. **Refactoring one module** — lock edits to `src/components/Dashboard/`
3. **Pair programming** — restrict the AI to only the files the human partner is working on
4. **Test-driven development** — freeze to `src/` and `tests/` to prevent fixture drift

## Example Prompt

> /mk:freeze packages/auth
> I need to debug the auth module in our monorepo but keep accidentally editing files in packages/api. Lock me down to only the auth directory.

## Pro Tips

- Combine with `mk:careful` for full protection: freeze prevents accidental edits, careful prevents destructive bash commands
- The freeze is an intent guardrail, **not a security boundary** — deliberate bash commands can still modify any file
- Test fixture files within a frozen directory can't be updated — use `--exclude` patterns for test fixtures
- The state file persists across messages within the same session; no need to re-specify

### Notes

- Hook script: `.claude/skills/freeze/bin/check-freeze.sh`
- Mechanics reference: `.claude/skills/freeze/references/freeze-mechanics.md`
- Source: gstack