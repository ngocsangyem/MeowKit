---
title: create-meowkit
description: Scaffold a new MeowKit project configuration.
persona: B
---

# npm create meowkit@latest

Scaffold a MeowKit configuration for your project.

## Usage

```bash
npm create meowkit@latest [options]
```

## Options

| Flag | Description |
|------|-------------|
| `--force` | Overwrite existing `.claude/` directory |
| `--dry-run` | Preview files without writing |
| `--mode <mode>` | Set default mode: fast, balanced, strict |
| `--no-memory` | Disable memory persistence |
| `--global` | Install as global config (~/.claude/) |
| `--help` | Show help message |

## Interactive prompts

| Question | Options |
|----------|---------|
| Project name | Free text |
| Tech stack | Multi-select: Node.js, Python, Go, Swift, React, Vue, etc. |
| Team size | Solo, Small (2-5), Team (6+) |
| Primary tool | Claude Code, Antigravity, Both |
| Default mode | Fast, Balanced, Strict |
| Cost tracking | Yes / No |
| Memory | Yes / No |
| Gemini API key | Optional (for meow:multimodal) |

## What it generates

- `.claude/` directory with agents, skills, hooks, rules, scripts
- `CLAUDE.md` entry point
- `.meowkit.config.json` project config
- `.mcp.json.example` optional MCP servers
- `.env.example` optional API keys
- `.gitignore.meowkit` exclusions to append
