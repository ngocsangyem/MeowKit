---
title: "mk:lint-and-validate"
description: "Automatic linting and static analysis after code changes. Runs linter + type-check + shared validation scripts. MANDATORY after every code change."
---

# mk:lint-and-validate — Lint and Validate

## What This Skill Does

Runs appropriate validation tools after code modifications to catch style violations, type errors, security issues, and code quality problems. **MANDATORY after EVERY code change** — no code is committed or reported as done without passing all checks.

For the full pipeline (build → lint → type-check → tests → coverage), use `mk:verify`. `mk:lint-and-validate` is the lint-only subset for post-edit quick checks.

## When to Use

After EVERY code change. The quality loop: Write/Edit → Run audit → Analyze → Fix & Repeat.

**Triggers:** "lint", "format", "check", "validate", "types", "static analysis".

**NOT for:** full build verification (`mk:verify`), test coverage (`mk:testing`).

## Core Capabilities

### Commands by Ecosystem

**Node.js / TypeScript:**

| Step | Command | Notes |
|---|---|---|
| Lint | `npm run lint` | Project-configured ESLint |
| Lint fix | `npx eslint "path" --fix` | Auto-fix fixable issues |
| Types | `npx tsc --noEmit` | Type check without emitting |
| Security | `npm audit --audit-level=high` | Skip low/moderate severity |

Config files: `.eslintrc`, `.eslintrc.json`, `.eslintrc.js`, `tsconfig.json`

**Python:**

| Step | Command | Notes |
|---|---|---|
| Lint | `ruff check "path" --fix` | Fast, modern, replaces flake8 |
| Security | `bandit -r "path" -ll` | Skip low-severity |
| Types | `mypy "path"` | Static type analysis |

Config files: `pyproject.toml`, `setup.cfg`, `.ruff.toml`

### Shared Validation Scripts

Kit-wide scripts at `.claude/scripts/`:

| Script | Purpose | Command |
|---|---|---|
| `validate.py` | General code validation | `.claude/skills/.venv/bin/python3 .claude/scripts/validate.py` |
| `security-scan.py` | Security pattern scanning | `.claude/skills/.venv/bin/python3 .claude/scripts/security-scan.py` |

### Error Recovery

| Error type | Action |
|---|---|
| Lint fails | Fix style/syntax immediately |
| tsc fails | Correct type mismatches before continuing |
| No tool configured | Check for `.eslintrc`, `tsconfig.json`, `pyproject.toml` — suggest creating one |
| Script not found | Check `.claude/scripts/` — may not be present in all projects |

## Gotchas

- **ESLint flat config (`eslint.config.mjs`) and legacy `.eslintrc` are mutually exclusive** — ESLint 9 auto-detects flat config and silently ignores `.eslintrc.*` files. If a project has both, flat config wins and all legacy `extends` rules are dropped without error, making it look like rules pass when they were never loaded.
- **`eslint --fix` on unstaged files destroys uncommitted work** — `--fix` writes changes directly to disk. Stage with `git add -p` before running, or use `--fix-dry-run` to preview.
- **TypeScript ESLint parser version must match installed `typescript` version** — a TS upgrade without bumping `@typescript-eslint/parser` causes `Unexpected token` parse errors on new syntax even though `tsc` accepts it fine.
- **`extends` order determines rule precedence (later wins)** — `['plugin:vue/recommended', 'prettier']` works; reversing to `['prettier', 'plugin:vue/recommended']` re-enables conflicting vue formatting rules.
- **Prettier and ESLint format rules conflict when both run on the same file** — disable all formatting rules in ESLint (`eslint-config-prettier`) and let Prettier own formatting.

## Example Prompts

- "Lint the changes I just made"
- "Run type-check after refactoring the auth module"
- "Validate the code before I create a PR"

## Pro Tips

- Run `npm run lint && npx tsc --noEmit` as a single command — both must pass.
- If a project is missing lint config, create one before proceeding. The skill will suggest this.
- The gotchas section above covers the most common traps — read it before troubleshooting lint failures.