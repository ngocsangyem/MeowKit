---
title: Runtime Commands
description: MeowKit CLI runtime commands for environment management.
persona: B
---

# npx meowkit commands

Runtime utilities for managing your MeowKit installation.

## Commands

### doctor

Check environment readiness:

```bash
npx meowkit doctor
```

Verifies: Node.js, Python, Git, hooks, scripts, file structure.

### validate

Verify `.claude/` structure integrity:

```bash
npx meowkit validate
```

Checks: CLAUDE.md exists, agents present, hooks executable.

### budget

View token usage report:

```bash
npx meowkit budget
```

Shows: per-task costs, model tier usage, monthly aggregation.

### memory

View or clear session memory:

```bash
npx meowkit memory          # view current memory
npx meowkit memory --clear  # clear all memory
```

### upgrade

Update to latest MeowKit version:

```bash
npx meowkit upgrade
```
