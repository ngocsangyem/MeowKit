---
title: create-meowkit
description: Scaffold or update a MeowKit project.
persona: B
---

# create-meowkit

> **Deprecated.** Use `npx mewkit init` instead. `create-meowkit` still works for users who haven't migrated, but will not receive new features or version bumps.

Scaffold the full MeowKit system into your project, or update an existing installation.

## How it works

The CLI is a thin package on npm. It **downloads** the latest release from [GitHub Releases](https://github.com/ngocsangyem/MeowKit/releases), extracts it, and installs `.claude/` into your project. No templates are bundled in the npm package.

```
npm registry → thin CLI (~50KB)
GitHub Releases → release zip (.claude/, tasks/, CLAUDE.md)
```

## Usage

```bash
npx mewkit init [options]
```

## What happens

1. **Fetches** latest stable release from GitHub (or beta with `--beta`)
2. **Asks** two optional questions — project description + Gemini API key
3. **Downloads** the release zip and extracts to a temp directory
4. **Scaffolds** `.claude/` into your project via smart update
5. **Validates** the installation
6. **Cleans up** temp files

| Component | Count | Description |
|-----------|-------|-------------|
| Agents | 14 | Specialist agents (planner, developer, reviewer, ...) |
| Skills | 49 | Pipeline skills (cook, fix, ship, review, qa, ...) |
| Commands | 18 | Slash commands |
| Modes | 7 | Behavioral modes (default, strict, fast, ...) |
| Rules | 14 | Enforcement rules (security, TDD, gates, ...) |
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
| `--beta` | | Use latest beta release instead of stable |
| `--global` | `-g` | Install as global config (`~/.claude/`) |
| `--json` | | Structured JSON output (for CI/scripting) |
| `--verbose` | `-v` | Enable debug logging |
| `--help` | `-h` | Show help |

## What it creates

```
your-project/
├── CLAUDE.md                          # Project conventions (root)
├── tasks/                             # Task templates
│   └── templates/                     # Feature, bug-fix, refactor, security
└── .claude/
    ├── agents/                        # 14 specialist agents
    ├── skills/                        # 49 skills (meow: namespace)
    ├── commands/                      # 18 slash commands
    ├── modes/                         # 7 behavioral modes
    ├── rules/                         # 14 enforcement rules
    ├── hooks/                         # 6 lifecycle hooks
    ├── scripts/                       # Validation + security scripts
    ├── settings.json                  # Hook registrations + permissions
    ├── meowkit.config.json            # Project config
    ├── meowkit.manifest.json          # Checksum manifest (for updates)
    ├── env.example                    # .env template (for agent API keys)
    ├── mcp.json.example               # MCP server config template
    ├── gitignore.meowkit              # Entries to append to .gitignore
    └── memory/                        # Cross-session persistence
```

## Version channels

| Channel | Command | Source |
|---------|---------|--------|
| Stable | `npx mewkit init` | Latest GitHub release (not prerelease) |
| Beta | `npx mewkit init --beta` | Latest GitHub prerelease |
