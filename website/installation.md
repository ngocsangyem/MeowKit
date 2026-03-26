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
npm create meowkit@latest
```

The CLI auto-detects your stack (Node.js, Python, Swift, Go, monorepo), asks a few configuration questions, and generates a `.claude/` directory with everything configured.

### Interactive setup

The CLI asks these questions:

| Question | Options | Default |
|----------|---------|---------|
| Project name | free text | directory name |
| Tech stack | Node.js, Python, Go, Swift, React, Vue, Next.js, etc. | auto-detected |
| Team size | Solo, Small (2-5), Team (6+) | — |
| Primary tool | Claude Code, Antigravity, Both | Claude Code |
| Default mode | Fast, Balanced, Strict | Balanced |
| Cost tracking | yes/no | yes |
| Memory | yes/no | yes |
| Gemini API key | free text (optional) | skip |

### CLI flags

Skip the interactive prompts with flags:

```bash
npm create meowkit@latest -- --mode strict     # Set mode directly
npm create meowkit@latest -- --no-memory        # Disable memory
npm create meowkit@latest -- --force            # Overwrite existing .claude/
npm create meowkit@latest -- --dry-run          # Preview without writing
npm create meowkit@latest -- --global           # Install as global config
```

## What gets generated

```
.claude/
├── agents/          13 specialist agents
├── skills/          40+ skills with meow: namespace
├── hooks/           Lifecycle hooks
├── rules/           10 enforcement rules
├── scripts/         6 Python validators
│   └── bin/         5 shell utilities
├── memory/          Cross-session persistence
├── settings.json    Hook registrations
└── modes/           7 behavioral modes

CLAUDE.md             Entry point for Claude Code
.meowkit.config.json  Project configuration
.mcp.json.example     Optional MCP server config
.env.example          Optional API keys (Gemini)
```

## Verify installation

```bash
npx meowkit doctor
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

For `meow:multimodal` (image/video/audio analysis):

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

- [Quick Start](/quick-start) — your first task with MeowKit
- [Configuration](/reference/configuration) — customize MeowKit for your project
