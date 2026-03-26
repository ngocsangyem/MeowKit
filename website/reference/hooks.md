---
title: Hooks
description: MeowKit's lifecycle hooks — what they enforce, when they run.
persona: C
---

# Hooks

MeowKit uses lifecycle hooks to enforce discipline at the tool level. Some hooks are registered in `.claude/settings.json` (automatic), others are invoked by skills.

## Registered hooks (automatic)

These run automatically via Claude Code's hook system:

| Hook | Type | Trigger | What it does | Blocks? |
|------|------|---------|-------------|---------|
| `post-write.sh` | PostToolUse | Edit, Write | Security scan: secrets, `any` type, SQL injection, XSS, destructive patterns | Yes (exit 2) |
| `post-session.sh` | Stop | Session end | Capture session data to `.claude/memory/` | No |

## Skill-embedded hooks

These are registered in SKILL.md frontmatter and run when those skills are active:

| Hook | Skill | Trigger | What it does |
|------|-------|---------|-------------|
| `check-freeze.sh` | meow:freeze | Edit, Write | Block edits outside frozen directory |
| `check-careful.sh` | meow:careful | Bash | Warn on destructive commands (rm -rf, DROP TABLE) |

## Skill-invoked scripts

These run when specific skills call them:

| Script | Phase | What it does | Blocks? |
|--------|-------|-------------|---------|
| `pre-task-check.sh` | Any | Prompt injection pattern detection | Yes (BLOCK on injection) |
| `pre-implement.sh` | Phase 2-3 | TDD gate — blocks without failing test | Yes |
| `pre-ship.sh` | Phase 5 | Test + lint + typecheck | Yes |
| `cost-meter.sh` | Any | Token usage tracking | No |

## Hook configuration

Hooks are registered in `.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [{ "type": "command", "command": "sh .claude/hooks/post-write.sh \"$TOOL_INPUT_FILE_PATH\"" }]
      }
    ],
    "Stop": [
      { "hooks": [{ "type": "command", "command": "sh .claude/hooks/post-session.sh" }] }
    ]
  }
}
```
