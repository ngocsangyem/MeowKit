---
title: CLI Reference
description: MeowKit command-line tools overview.
persona: B
---

# CLI Reference

MeowKit provides two CLI packages:

| Package | Command | Purpose |
|---------|---------|---------|
| `create-meowkit` | `npm create meowkit@latest` | Scaffold or update the `.claude/` system |
| `meowkit` | `npx meowkit <command>` | Runtime tools: doctor, setup, task, validate, budget, memory, upgrade, status |

## Quick Start

```bash
# 1. Scaffold MeowKit into your project
cd your-project
npm create meowkit@latest

# 2. Configure environment
npx meowkit setup

# 3. Verify installation
npx meowkit doctor

# 4. Create your first task
npx meowkit task new --type feature "Add user authentication"
```

## How it works

`create-meowkit` is a **scaffold + update** tool:
- **First run:** copies the full MeowKit system (agents, skills, hooks, rules, commands, modes, scripts) into `.claude/`
- **Subsequent runs:** smart update — overwrites unchanged core files, skips user-modified files, adds new files

`meowkit` is a **runtime toolbox** for daily use — diagnostics, setup, task management, cost tracking.
