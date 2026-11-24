# Linter Commands Reference

Complete reference for linting and validation commands by ecosystem.

## Node.js / TypeScript

| Step     | Command                                      | Notes                              |
| -------- | -------------------------------------------- | ---------------------------------- |
| Lint     | `npm run lint`                               | Uses project-configured ESLint     |
| Lint fix | `npx eslint "path" --fix-dry-run`, then `--fix` | Dry run first; `--fix` only on files without uncommitted edits |
| Types    | `npx tsc --noEmit`                           | Type check without emitting files  |
| Security | `npm audit --audit-level=high`               | Skip low/moderate severity         |

Config files to look for: `.eslintrc`, `.eslintrc.json`, `.eslintrc.js`, `tsconfig.json`

## Python

| Step     | Command                     | Notes                            |
| -------- | --------------------------- | -------------------------------- |
| Lint     | `ruff check "path"`; `--diff` previews fixes, `--fix` applies them | Fast, modern, replaces flake8; apply `--fix` only to files without uncommitted edits |
| Security | `bandit -r "path" -ll`      | Skip low-severity issues (`-ll`) |
| Types    | `mypy "path"`               | Static type analysis             |

Config files to look for: `pyproject.toml`, `setup.cfg`, `.ruff.toml`

## Shared Validation Scripts

This skill's own pattern scanners (invocation and exit codes are in `SKILL.md`):

| Script | Purpose | Command |
|---|---|---|
| `validate.py` | Directory scan for secret, `any`, SQL and framework-guard patterns; writes a report | `node .claude/hooks/lib/skill-python.cjs scripts/validate.py` |
| `security-scan.py` | The same kind of scan on git-changed files | `node .claude/hooks/lib/skill-python.cjs scripts/security-scan.py` |

Run them in addition to the ecosystem linters, not instead of them.
