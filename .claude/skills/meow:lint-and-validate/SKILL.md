---
name: meow:lint-and-validate
description: Automatic quality control, linting, and static analysis procedures. Use after every code modification to ensure syntax correctness and project standards. Triggers onKeywords: lint, format, check, validate, types, static analysis.
allowed-tools: Read, Glob, Grep, Bash
phase: on-demand
trust_level: third-party
injection_risk: low
source: antigravity-kit
author: vudovn (antigravity-kit)
---

# Lint and Validate Skill

> **MANDATORY:** Run appropriate validation tools after EVERY code change. Do not finish a task until the code is error-free.

> For the full pipeline (build → lint → type-check → tests → coverage), use `meow:verify`. `meow:lint-and-validate` is a lint-only subset intended for post-edit quick checks.

### Procedures by Ecosystem

See [references/linter-commands.md](references/linter-commands.md) for full command reference per ecosystem (Node.js/TS, Python) and Shared validation scripts.

## The Quality Loop

1. **Write/Edit Code**
2. **Run Audit:** `npm run lint && npx tsc --noEmit`
3. **Analyze Report:** Check the "FINAL AUDIT REPORT" section.
4. **Fix & Repeat:** Submitting code with "FINAL AUDIT" failures is NOT allowed.

## Error Handling

- If `lint` fails: Fix the style or syntax issues immediately.
- If `tsc` fails: Correct type mismatches before proceeding.
- If no tool is configured: Check the project root for `.eslintrc`, `tsconfig.json`, `pyproject.toml` and suggest creating one.

---

**Strict Rule:** No code should be committed or reported as "done" without passing these checks.

---

## Scripts

See [references/linter-commands.md](references/linter-commands.md) for full command tables and Shared validation scripts.

## Gotchas

- **ESLint flat config (`eslint.config.mjs`) and legacy `.eslintrc` are mutually exclusive** — ESLint 9 auto-detects the flat config format and ignores any `.eslintrc.*` files in the same directory; if the project has both, the flat config silently wins and all legacy `extends` rules are dropped without error, making it look like rules pass when they were never loaded.
- **`eslint --fix` run on unstaged files destroys uncommitted work** — `--fix` writes changes directly to disk without prompting; if run on a file with uncommitted edits, ESLint's changes overwrite the working tree diff; always stage changes with `git add -p` before running `--fix`, or use `--fix-dry-run` to preview.
- **TypeScript ESLint parser version must match the installed `typescript` version** — `@typescript-eslint/parser` pins against specific TypeScript minor versions; a TypeScript upgrade (e.g., 5.3 → 5.5) without bumping `@typescript-eslint/parser` causes `Unexpected token` parse errors on new syntax even though `tsc` accepts it fine.
- **`extends` order determines rule precedence and later entries win** — in legacy `.eslintrc`, `extends: ['plugin:vue/recommended', 'prettier']` works (prettier overrides vue formatting), but reversing to `['prettier', 'plugin:vue/recommended']` re-enables vue formatting rules that conflict with prettier, producing unfixable lint errors on every save.
- **Prettier and ESLint format rules conflict when both run on the same file** — `eslint --fix` applying `quotes: 'single'` then `prettier` reformatting to double quotes creates an infinite fix loop in editor save hooks; disable all formatting rules in ESLint (`eslint-config-prettier`) and let Prettier own formatting exclusively.
