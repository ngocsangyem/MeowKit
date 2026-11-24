---
name: mk:lint-and-validate
description: "Runs lint and static analysis after edits. NOT for mk:verify."
allowed-tools: Read, Glob, Grep, Bash
phase: on-demand
trust_level: third-party
injection_risk: low
source: antigravity-kit
keywords:
  - lint
  - format
  - static-analysis
  - type-check
  - quality-control
  - post-edit-check
when_to_use: "A file was modified."
user-invocable: true
owner: testing
criticality: medium
status: active
runtime: claude-code
requires_runtime: [python>=3.9]
---

# Lint and Validate

Goal: run the project's lint and type-check on the files you just edited, fix what they report, and finish only with them clean. This is the fast post-edit subset: `mk:verify` and the ship check run the same commands (plus build and tests) later. For the full pipeline use `mk:verify`.

> Script paths in this skill's files are relative to `${CLAUDE_SKILL_DIR}`; prefix them with `${CLAUDE_SKILL_DIR}/` and do not run them from the project root.

## Process

1. **Detect** the project's lint and type commands (`references/linter-commands.md` has the table per ecosystem). If none is configured, look for `.eslintrc`, `tsconfig.json`, `pyproject.toml` and suggest adding one.
2. **Run** them on the changed files. Prefer a dry run first (`eslint --fix-dry-run`, `ruff check --diff`); apply `--fix` only to files with no uncommitted edits of your own, because `--fix` overwrites the working tree.
3. **Fix** the reported issues and re-run. After three failed rounds on the same issue, stop and report what blocks you.
4. **Done** when the commands exit 0. Optionally run the bundled pattern scan below and report its real output.

## Bundled scripts

Two pattern scanners (secrets, `any`, SQL interpolation and framework guards); neither runs a linter or a type checker.

- `node .claude/hooks/lib/skill-python.cjs ${CLAUDE_SKILL_DIR}/scripts/validate.py [dir]` scans a directory, writes a report and exits 1 when it finds a BLOCK-level pattern.
- `node .claude/hooks/lib/skill-python.cjs ${CLAUDE_SKILL_DIR}/scripts/security-scan.py [dir]` scans the git-changed files (the whole directory without git) and exits 1 on a BLOCK.

## Gotchas

- **ESLint flat config (`eslint.config.mjs`) and legacy `.eslintrc` are mutually exclusive** — ESLint 9 auto-detects the flat config format and ignores any `.eslintrc.*` files in the same directory; if the project has both, the flat config silently wins and all legacy `extends` rules are dropped without error, making it look like rules pass when they were never loaded.
- **`eslint --fix` run on unstaged files destroys uncommitted work** — `--fix` writes changes directly to disk without prompting; if run on a file with uncommitted edits, ESLint's changes overwrite the working tree diff; use `--fix-dry-run` first, and run `--fix` only on files with no uncommitted edits.
- **TypeScript ESLint parser version must match the installed `typescript` version** — `@typescript-eslint/parser` pins against specific TypeScript minor versions; a TypeScript upgrade (e.g., 5.3 → 5.5) without bumping `@typescript-eslint/parser` causes `Unexpected token` parse errors on new syntax even though `tsc` accepts it fine.
- **`extends` order determines rule precedence and later entries win** — in legacy `.eslintrc`, `extends: ['plugin:vue/recommended', 'prettier']` works (prettier overrides vue formatting), but reversing to `['prettier', 'plugin:vue/recommended']` re-enables vue formatting rules that conflict with prettier, producing unfixable lint errors on every save.
- **Prettier and ESLint format rules conflict when both run on the same file** — `eslint --fix` applying `quotes: 'single'` then `prettier` reformatting to double quotes creates an infinite fix loop in editor save hooks; disable all formatting rules in ESLint (`eslint-config-prettier`) and let Prettier own formatting exclusively.
