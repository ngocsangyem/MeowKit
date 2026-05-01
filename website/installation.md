---
title: Installation
description: Install MeowKit and get it running in your project.
persona: A
---

# Installation

## Prerequisites

- **Node.js** 20 or later
- **Python** 3.9 or later (for validation scripts — stdlib only, no pip installs)
- **Git** installed and configured
- **Claude Code** installed ([claude.ai/code](https://claude.ai/code))

## Install

```bash
npx mewkit init
```

The CLI asks two optional questions then generates a `.claude/` directory with everything configured.

### Interactive setup

The CLI asks two questions:

| Question | Default |
|----------|---------|
| Project description (optional) | skipped |
| Gemini API key (optional) | skipped |

All other settings use fixed defaults: cost tracking enabled, memory enabled, mode set to `balanced`. Stack detection is not performed.

### CLI flags

Skip the interactive prompts with flags:

```bash
npx mewkit init -- --mode strict     # Set mode directly
npx mewkit init -- --no-memory        # Disable memory
npx mewkit init -- --force            # Overwrite existing .claude/
npx mewkit init -- --dry-run          # Preview without writing
npx mewkit init -- --global           # Install as global config
```

## What gets generated

```
.claude/
├── agents/          Specialist agents for each phase
├── skills/          Domain skills with mk: namespace
├── hooks/           Lifecycle hooks
├── rules/           Enforcement rules
├── scripts/         Python validators
│   └── bin/         Shell utilities
├── memory/          Cross-session persistence
├── settings.json    Hook registrations
└── modes/           Behavioral modes

CLAUDE.md             Entry point for Claude Code
.meowkit.config.json  Project configuration
.mcp.json.example     Optional MCP server config
.env.example          Optional API keys (Gemini)
```

## Verify installation

```bash
npx mewkit doctor
```

This checks: Node.js version, Python version, Git availability, hooks executable, scripts present.

## Post-install setup

### MCP servers (optional)

Copy `.mcp.json.example` to `.mcp.json` and configure servers you need:

```bash
cp .mcp.json.example .mcp.json
```

Available MCP servers: Context7 (docs), Playwright (QA), Sequential Thinking.

### Gemini API key (optional)

For `mk:multimodal` (image/video/audio analysis):

```bash
# Add to .env
echo "GEMINI_API_KEY=your-key" >> .env
```

Get a key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey).

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `.claude/` already exists | Use `--force` flag or delete manually |
| Hooks not executable | Run `chmod +x .claude/hooks/*.sh` |
| Python scripts fail | Ensure Python 3.9+ is in PATH |
| Claude Code doesn't load CLAUDE.md | Restart Claude Code session |

## Next steps

After scaffolding, finalize setup:

```bash
npx mewkit setup    # Post-scaffold configuration (venv, MCP, env, gitignore)
npx mewkit doctor   # Verify installation
```

- [Quick Start](/quick-start) — your first task with MeowKit
- [Configuration](/reference/configuration) — customize MeowKit for your project
