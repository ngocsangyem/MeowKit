---
title: Runtime Commands
description: MeowKit CLI runtime commands reference.
persona: B
---

# npx meowkit commands

Runtime tools for managing your MeowKit project. Run from your project root.

## doctor

Diagnose environment issues with auto-fix for permissions.

```bash
npx meowkit doctor [--report]
```

**Checks:** Node.js 20+, Python 3.9+, Git, `.claude/` structure, hooks executable, scripts present, memory writable, MCP config, Python venv, config validity.

**Auto-fixes:** Hook file permissions (`chmod +x`).

| Flag | Description |
|------|-------------|
| `--report` | Print shareable diagnostic report |

## setup

Guided post-scaffold configuration. Each step is idempotent.

```bash
npx meowkit setup [--only=<step>]
```

| Step | What it does |
|------|-------------|
| `venv` | Creates Python venv for skill scripts at `.claude/skills/.venv` |
| `mcp` | Copies `mcp.json.example` → `.mcp.json` |
| `env` | Copies `env.example` → `.env` |
| `gitignore` | Appends MeowKit entries to `.gitignore` |

```bash
npx meowkit setup              # Run all steps
npx meowkit setup --only=venv  # Run single step
```

## task

Create and manage structured task files. See [Task Commands](/cli/task-commands) for details.

```bash
npx meowkit task new --type feature "Add user auth"
npx meowkit task list [--all] [--status done]
```

## validate

Verify `.claude/` structure integrity.

```bash
npx meowkit validate
```

**Checks:** Agents (10+), skills (30+), commands dir, modes (5+), rules (10+), hooks executable, scripts present, settings.json, CLAUDE.md, config file.

## budget

View token usage and cost tracking.

```bash
npx meowkit budget [--monthly]
```

| Flag | Description |
|------|-------------|
| `--monthly` | Aggregate by month instead of showing last 10 entries |

## memory

View or manage cross-session memory.

```bash
npx meowkit memory              # Summary (line counts, pattern count)
npx meowkit memory --show       # Display full lessons.md
npx meowkit memory --stats      # Sessions captured, patterns learned
npx meowkit memory --clear      # Clear all memory (with confirmation)
```

## upgrade

Update create-meowkit to the latest version.

```bash
npx meowkit upgrade [--check] [--beta]
```

| Flag | Description |
|------|-------------|
| `--check` | Show available update without installing |
| `--beta` | Install beta channel |

## status

Print version and current config.

```bash
npx meowkit status
```

Shows: MeowKit version, project config from `.claude/meowkit.config.json`.
