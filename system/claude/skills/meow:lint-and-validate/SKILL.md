---
name: meow:lint-and-validate
description: Automatic quality control, linting, and static analysis procedures. Use after every code modification to ensure syntax correctness and project standards. Triggers onKeywords: lint, format, check, validate, types, static analysis.
allowed-tools: Read, Glob, Grep, Bash
source: antigravity-kit
author: vudovn (antigravity-kit)
---

# Lint and Validate Skill

> **MANDATORY:** Run appropriate validation tools after EVERY code change. Do not finish a task until the code is error-free.

### Procedures by Ecosystem

See [references/linter-commands.md](references/linter-commands.md) for full command reference per ecosystem (Node.js/TS, Python) and MeowKit validation scripts.

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

See [references/linter-commands.md](references/linter-commands.md) for full command tables and MeowKit validation scripts.
