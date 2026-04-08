---
title: Runtime Commands
description: MeowKit CLI runtime commands reference.
persona: B
---

# npx mewkit commands

Runtime tools for managing your MeowKit project. Run from your project root.

## doctor

Diagnose environment issues with auto-fix for permissions.

```bash
npx mewkit doctor [--report]
```

**Checks:** Node.js 20+, Python 3.9+, Git, `.claude/` structure, hooks executable, scripts present, memory writable, MCP config, Python venv, config validity.

**Auto-fixes:** Hook file permissions (`chmod +x`).

| Flag | Description |
|------|-------------|
| `--report` | Print shareable diagnostic report |

## setup

Guided post-scaffold configuration. Each step is idempotent.

```bash
npx mewkit setup [--only=<step>]
```

| Step | What it does |
|------|-------------|
| `venv` | Creates Python venv for skill scripts at `.claude/skills/.venv` |
| `mcp` | Copies `mcp.json.example` → `.mcp.json` |
| `env` | Copies `env.example` → `.env` |
| `gitignore` | Appends MeowKit entries to `.gitignore` |

```bash
npx mewkit setup              # Run all steps
npx mewkit setup --only=venv  # Run single step
```

## task

Create and manage structured task files. See [Task Commands](/cli/task-commands) for details.

```bash
npx mewkit task new --type feature "Add user auth"
npx mewkit task list [--all] [--status done]
```

## validate

Verify `.claude/` structure integrity.

```bash
npx mewkit validate
```

**Checks:** Agents (10+), skills (30+), commands dir, modes (5+), rules (10+), hooks executable, scripts present, settings.json, CLAUDE.md, config file.

## budget

View token usage and cost tracking.

```bash
npx mewkit budget [--monthly]
```

| Flag | Description |
|------|-------------|
| `--monthly` | Aggregate by month instead of showing last 10 entries |

## memory

View or manage cross-session memory.

```bash
npx mewkit memory              # Summary (line counts, pattern count)
npx mewkit memory --show       # Display full lessons.md
npx mewkit memory --stats      # Sessions captured, patterns learned
npx mewkit memory --clear      # Clear all memory (with confirmation)
```

## upgrade

Update mewkit to the latest version.

```bash
npx mewkit upgrade [--check] [--beta] [--list]
```

| Flag | Description |
|------|-------------|
| `--check` | Show available update (shows both stable and beta) |
| `--beta` | Install beta channel |
| `--list` | List all available versions with channel info |

**Examples:**

```bash
npx mewkit upgrade              # Upgrade to latest stable
npx mewkit upgrade --beta       # Upgrade to latest beta
npx mewkit upgrade --check      # Check without installing
npx mewkit upgrade --list       # Show all versions
```

**Output of `--list`:**

```
Channels:
  stable:  1.2.0
  beta:    1.3.0-beta.2

Recent versions:
  1.2.0 (installed)
  1.1.1
  1.1.0
  1.0.0
```

## /meow:summary — Conversation Summary Cache Inspector

User-facing inspector for the Phase 9 conversation summary cache.

### Usage

```bash
/meow:summary              # show current cache
/meow:summary --clear      # wipe cache and lock
/meow:summary --status     # show throttle state
```

### What It Reads

- `.claude/memory/conversation-summary.md` — cache file written by background Haiku summarizer on `Stop` hook event
- `session-state/conversation-summary.lock` — mutex held while background worker runs

### Behavior

**Default (no flags):** Reads `.claude/memory/conversation-summary.md`. If frontmatter `session_id` is empty, prints "No summary cached for this session yet." Otherwise prints frontmatter (session_id, last_updated, event_count, transcript_size_bytes, summaries count) plus the markdown body.

**`--clear`:** Overwrites cache with empty placeholder. Removes `session-state/conversation-summary.lock` if present. Next `Stop` crossing the throttle threshold regenerates the cache.

**`--status`:** Reads transcript size and cache frontmatter. Computes and reports throttle conditions:
- `THRESHOLD` = `${MEOWKIT_SUMMARY_THRESHOLD:-20480}` bytes
- `EVENT_GAP` = `${MEOWKIT_SUMMARY_TURN_GAP:-30}` events
- `GROWTH_DELTA` = `${MEOWKIT_SUMMARY_GROWTH_DELTA:-5120}` bytes

Reports whether the next `Stop` will trigger a summary or skip, and whether the lock file exists (background worker still running).

### Notes

- Cache is per-session: `project-context-loader.sh` clears it automatically on new session start.
- This command does not do any summarization — it only exposes the cache for inspection and management.
- Opt-out: set `MEOWKIT_SUMMARY_CACHE=off` to disable both summarization and injection.

### Related

- Hook: `.claude/hooks/conversation-summary-cache.sh` (see [Hooks Reference](/reference/hooks))
- Rule: [harness-rules Rule 11](/reference/rules-index#harness-rules)
- Guide: [Middleware Layer](/guide/middleware-layer)

## status

Print version, channel, and current config.

```bash
npx mewkit status
```

Shows: MeowKit version with channel indicator (stable/beta), project config from `.claude/meowkit.config.json`.
