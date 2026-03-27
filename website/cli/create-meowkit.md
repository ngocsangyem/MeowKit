---
title: create-meowkit
description: Scaffold or update a MeowKit project.
persona: B
---

# create-meowkit

Scaffold the full MeowKit system into your project, or update an existing installation.

## Usage

```bash
npm create meowkit@latest [options]
```

## What happens

1. **Detects your tech stack** — scans for package.json, go.mod, pyproject.toml, etc.
2. **Asks two questions** — project name + optional Gemini API key
3. **Scaffolds or updates** `.claude/` with the full system:

| Component | Count | Description |
|-----------|-------|-------------|
| Agents | 13 | Specialist agents (planner, developer, reviewer, ...) |
| Skills | 40+ | Pipeline skills (cook, fix, ship, review, qa, ...) |
| Commands | 18 | Slash commands |
| Modes | 7 | Behavioral modes (default, strict, fast, ...) |
| Rules | 12 | Enforcement rules (security, TDD, gates, ...) |
| Hooks | 6 | Lifecycle hooks |
| Scripts | 6 | Python validation + security scripts |

## Smart Update

When `.claude/` already exists, the CLI switches to **update mode** automatically:

- **Core files** (agents, rules, hooks, scripts) — overwritten if you haven't modified them
- **User-modified files** — skipped with a warning
- **New files** — always added
- **User config** (`CLAUDE.md`, `meowkit.config.json`, `.env`) — never overwritten

A `.claude/meowkit.manifest.json` tracks file checksums to detect user modifications.

Use `--force` to overwrite everything regardless.

## Options

| Flag | Alias | Description |
|------|-------|-------------|
| `--force` | `-f` | Overwrite all files (ignore user modifications) |
| `--dry-run` | `-n` | Preview files without writing |
| `--mode <mode>` | `-m` | Override default mode: `fast`, `balanced`, `strict` |
| `--no-memory` | | Disable memory/context persistence |
| `--global` | `-g` | Install as global config (`~/.claude/`) |
| `--json` | | Structured JSON output (for CI/scripting) |
| `--verbose` | `-v` | Enable debug logging |
| `--help` | `-h` | Show help |

## What it creates

```
your-project/
├── CLAUDE.md                          # Project conventions (root)
└── .claude/
    ├── agents/                        # 13 specialist agents
    ├── skills/                        # 40+ skills
    ├── commands/                      # 18 slash commands
    ├── modes/                         # 7 behavioral modes
    ├── rules/                         # 12 enforcement rules
    ├── hooks/                         # 6 lifecycle hooks
    ├── scripts/                       # Validation + security scripts
    ├── settings.json                  # Hook registrations + permissions
    ├── meowkit.config.json            # Project config (name, stack, mode)
    ├── meowkit.manifest.json          # Checksum manifest (for updates)
    ├── env.example                    # .env template
    ├── mcp.json.example               # MCP server config template
    ├── gitignore.meowkit              # Entries to append to .gitignore
    └── memory/                        # Cross-session persistence
```
