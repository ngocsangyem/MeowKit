---
title: CLI Reference
description: MeowKit command-line tools overview.
persona: B
---

# CLI Reference

MeowKit provides two CLI packages:

| Package | Command | Purpose |
|---------|---------|---------|
| `mewkit` | `npx mewkit init` | Scaffold or update the `.claude/` system |
| `mewkit` | `npx mewkit <command>` | Runtime tools: doctor, setup, task, validate, budget, memory, upgrade, status |

## Quick Start

```bash
# 1. Scaffold MeowKit into your project
cd your-project
npx mewkit init

# 2. Configure environment
npx mewkit setup

# 3. Verify installation
npx mewkit doctor

# 4. Create your first task
npx mewkit task new --type feature "Add user authentication"
```

## How it works

`npx mewkit init` is a **scaffold + update** tool:
- **First run:** copies the full MeowKit system (agents, skills, hooks, rules, commands, modes, scripts) into `.claude/`
- **Subsequent runs:** smart update — overwrites unchanged core files, skips user-modified files, adds new files

`mewkit` is a **runtime toolbox** for daily use — diagnostics, setup, task management, cost tracking.
