# Linter Commands Reference

Complete reference for linting and validation commands by ecosystem.

## Node.js / TypeScript

| Step     | Command                                      | Notes                              |
| -------- | -------------------------------------------- | ---------------------------------- |
| Lint     | `npm run lint`                               | Uses project-configured ESLint     |
| Lint fix | `npx eslint "path" --fix`                    | Auto-fix fixable issues            |
| Types    | `npx tsc --noEmit`                           | Type check without emitting files  |
| Security | `npm audit --audit-level=high`               | Skip low/moderate severity         |

Config files to look for: `.eslintrc`, `.eslintrc.json`, `.eslintrc.js`, `tsconfig.json`

## Python

| Step     | Command                     | Notes                            |
| -------- | --------------------------- | -------------------------------- |
| Lint     | `ruff check "path" --fix`   | Fast, modern, replaces flake8    |
| Security | `bandit -r "path" -ll`      | Skip low-severity issues (`-ll`) |
| Types    | `mypy "path"`               | Static type analysis             |

Config files to look for: `pyproject.toml`, `setup.cfg`, `.ruff.toml`

## Shared Validation Scripts

If this project ships project-level `validate.py` / `security-scan.py` scripts for deterministic, kit-wide pattern checks (path varies by project — not part of this bundle), run them in addition to the ecosystem linters above:

| Script             | Purpose                   | Command                                                            |
| ------------------ | ------------------------- | ------------------------------------------------------------------- |
| `validate.py`      | General code validation   | `.agents/skills/.venv/bin/python3 <path-to-validate.py>`          |
| `security-scan.py` | Security pattern scanning | `.agents/skills/.venv/bin/python3 <path-to-security-scan.py>`     |

## Quality Loop

```
Write/Edit code
  → npm run lint && npx tsc --noEmit   (Node.js/TS)
  → ruff check . --fix && mypy .       (Python)
  → run the project's shared validation script, if one exists (all)
  → Fix errors → repeat until clean
```

No code is done until all three steps pass with zero errors.

## Error Recovery

| Error type          | Action                                          |
| ------------------- | ----------------------------------------------- |
| Lint fails          | Fix style/syntax immediately                    |
| tsc fails           | Correct type mismatches before continuing       |
| No tool configured  | Check for `.eslintrc`, `tsconfig.json`, `pyproject.toml` — suggest creating one |
| Script not found    | Shared validation scripts are project-specific and may not be present in all projects — skip this step when absent |
