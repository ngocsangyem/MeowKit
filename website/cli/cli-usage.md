---
title: CLI Usage — Migration
description: How to use mewkit migrate to export your kit to external coding-agent tools.
persona: B
---

# CLI Usage — Migration

This page walks through using `mewkit migrate` end-to-end: what gets migrated, how to run it, and what to do when something needs your attention.

For the flag reference, see [Commands → migrate](/cli/commands#migrate). For the per-tool capability matrix and conflict recovery, see the [Migration Guide](/migration).

## What Gets Migrated

`mewkit migrate` exports six categories of content from your `.claude/` kit:

| Category     | Source                          | Notes                                                                           |
| ------------ | ------------------------------- | ------------------------------------------------------------------------------- |
| **Agents**   | `.claude/agents/*.md`           | Subagent definitions with frontmatter (`name`, `description`, `model`, `tools`) |
| **Commands** | `.claude/commands/meow/**/*.md` | Slash commands, including nested directories                                    |
| **Skills**   | `.claude/skills/<name>/`        | Whole directories (`SKILL.md` + `references/` + `scripts/`)                     |
| **Config**   | `CLAUDE.md`                     | Your project's instructions for Claude Code                                     |
| **Rules**    | `.claude/rules/*.md`            | Behavioral rules loaded by agents                                               |
| **Hooks**    | `.claude/hooks/*.{cjs,mjs,js}`  | Runtime event handlers (only node-runnable scripts)                             |

**What's filtered out automatically:**

- Shell hooks (`.sh`, `.ps1`, `.bat`, `.py`) — only Node hooks migrate.
- MeowKit-internal directories: `memory/`, `session-state/`, `modes/`, `rubrics/`, `benchmarks/`, `logs/`.
- MeowKit-internal files: `metadata.json`, `meowkit.config.json`, `statusline.cjs`.

Each tool accepts a different subset. See the [capability matrix](/migration#capability-matrix) to know what each provider supports.

## Step-by-Step Guide

### Step 1 — Make sure your kit is in place

`mewkit migrate` reads from `<cwd>/.claude/`. If you haven't scaffolded yet:

```bash
npx mewkit init
```

If you already have a `.claude/`, skip ahead.

### Step 2 — Preview before writing

Always dry-run first. It computes the full plan and prints it but writes nothing:

```bash
npx mewkit migrate cursor --dry-run
```

You'll see something like:

```
Migrate plan
  Source: ./.claude/ (project)

  install:  95
  update:   0
  skip:     0
  conflict: 0
  delete:   0

(dry run — no files written)
```

If anything looks off (wrong source path, unexpected conflicts, hooks dropped), adjust flags before the real run.

### Step 3 — Run the migration

```bash
npx mewkit migrate cursor
```

mewkit prompts to confirm:

```
? Migrate 95 action(s)? Yes
```

Files are written atomically. The registry at `~/.mewkit/portable-registry.json` tracks every install.

### Step 4 — Migrate to multiple tools at once

Three ways:

```bash
# Interactive picker (TTY required)
npx mewkit migrate

# All 15 tools, non-interactive
npx mewkit migrate --all --yes

# Combined with init
npx mewkit init --migrate-to cursor,codex,droid
```

### Step 5 — Re-run after upgrades or edits

After `npx mewkit upgrade` (refreshes `.claude/`), or if you edit a target file directly, re-run migrate:

```bash
npx mewkit migrate cursor
```

mewkit reconciles automatically: unchanged items skip, kit updates apply, your hand-edits are preserved (or surface as conflicts you can resolve).

## Common Tasks

### Migrate only specific types

```bash
# Only skills + rules
npx mewkit migrate cursor --only=skills,rules

# Everything except hooks
npx mewkit migrate gemini-cli --skip-hooks

# Only the CLAUDE.md config
npx mewkit migrate codex --only=config
```

### Install globally instead of per-project

By default, mewkit writes to project-local paths (`./.cursor/`, `./.codex/`). For global installs:

```bash
npx mewkit migrate cursor --global
# or with init:
npx mewkit init --migrate-to cursor --migrate-global
```

Each scope has its own registry — running both project and global migrations is safe; they don't interfere.

### Force overwrite local edits

If you want mewkit's version to win unconditionally:

```bash
npx mewkit migrate cursor --force
```

Without `--force`, conflicts on user-edited files prompt you for keep/overwrite/diff.

### Run in CI / non-interactive mode

```bash
npx mewkit migrate --all --yes
# or
npx mewkit init --migrate-to all
```

`--yes` skips all prompts. Conflicts default to "keep your version." Pass `--force` if you want CI to overwrite instead.

### Override the source path

By default mewkit reads `./.claude/`. To migrate a different kit:

```bash
npx mewkit migrate cursor --source /path/to/other/.claude
```

## Resolving Conflicts

When source AND target both changed since last install, mewkit prompts:

```
[!] Conflict: cursor/agent/scout
  mewkit updated source since last install
  Target file was also modified (user edits detected)

? How to resolve?
  > Overwrite with mewkit version (lose your edits)
    Keep your version (skip mewkit update)
    Show diff
```

| Choice          | What it does                                                                                   |
| --------------- | ---------------------------------------------------------------------------------------------- |
| **Overwrite**   | Take mewkit's version. Your edits are lost.                                                    |
| **Keep**        | Take your version. mewkit's update is deferred until next conflict.                            |
| **Show diff**   | Display unified diff (then re-prompt). Limit: 5 views per item.                                |
| **Smart merge** | (merge-target files only) Update mewkit's sections, keep your additions outside the sentinels. |

**Skip the prompt entirely:**

- `--force` — overwrite all conflicts without asking
- `--yes` — non-interactive default is "keep your version"

## What Happens on a Re-Run

`mewkit migrate` is idempotent. Run it as many times as you want — the SHA-256 registry tracks what was installed and decides per file:

| Source                 | Target          | Result                          |
| ---------------------- | --------------- | ------------------------------- |
| Unchanged              | Unchanged       | **skip**                        |
| Changed (kit upgraded) | Unchanged       | **update**                      |
| Unchanged              | You edited it   | **skip** — your edits preserved |
| Changed                | You edited it   | **conflict** — prompt           |
| Removed from source    | Still in target | **delete**                      |
| Brand new in source    | Missing         | **install**                     |

This is why re-running after `mewkit upgrade` is safe: kit updates flow through, your hand-edits don't get clobbered, and only true conflicts surface.

## Quick Reference

```bash
# Single tool, project scope
npx mewkit migrate cursor

# Preview only
npx mewkit migrate cursor --dry-run

# All tools, CI-friendly
npx mewkit migrate --all --yes

# One-shot scaffold + export
npx mewkit init --migrate-to cursor,codex

# Restrict to specific types
npx mewkit migrate cursor --only=skills,rules

# Global scope
npx mewkit migrate cursor --global

# Override conflicts
npx mewkit migrate cursor --force
```

## See Also

- [Commands → migrate](/cli/commands#migrate) — every flag, exit codes
- [Migration Guide](/migration) — capability matrix per tool, troubleshooting
- [Commands → init --migrate](/cli/commands#init-migrate-one-shot-scaffold-export) — chained scaffold + export
