---
title: "mk:lint-and-validate"
description: "Automatic quality control — runs linting, type checking, and security scanning after every code change."
---
# mk:lint-and-validate
Automatic quality control — runs linting, type checking, and security scanning after every code change.
## What This Skill Does
Enforces the quality loop: write code → run lint → run typecheck → fix errors → repeat until clean. Supports Node.js/TypeScript (`npm run lint`, `npx tsc --noEmit`) and Python (`ruff check`, `mypy`). No code is committed or reported as "done" without passing these checks.
## Core Capabilities
- **Node.js/TypeScript** — `npm run lint`, `npx tsc --noEmit`, `npm audit`
- **Python** — `ruff check --fix`, `bandit -r`, `mypy`
- **Mandatory** — No code submitted without passing checks
- **MeowKit scripts** — Uses `.claude/scripts/validate.py` and `security-scan.py`
## Usage
Auto-activates after every code modification. Also triggered by: "lint", "format", "check", "validate", "types", "static analysis".
::: info Skill Details
**Phase:** 2  
**Used by:** tester agent
:::

## Related
- [`mk:clean-code`](/reference/skills/clean-code) — Coding standards (principles)
- [Hooks](/reference/hooks) — `post-write.sh` also runs security checks automatically
