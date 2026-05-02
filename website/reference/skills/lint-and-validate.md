---
title: "mk:lint-and-validate"
description: "Automatic linting and static analysis after code changes. Runs linter + typecheck. NOT for full build verification (use mk:verify)."
---

# mk:lint-and-validate

Run lint and type-check after every code change. Submitting code with audit failures is NOT allowed. For the full pipeline (build → lint → type-check → tests → coverage), use `mk:verify`.

## Quality loop

1. Write/Edit Code
2. Run Audit: `npm run lint && npx tsc --noEmit` (adjust per ecosystem)
3. Analyze Report — check the report output
4. Fix & Repeat — submitting code with failures is not allowed

## Ecosystem support

Node.js/TypeScript and Python via `references/linter-commands.md`. If lint fails: fix style/syntax immediately. If type-check fails: fix type errors. If tool missing: install it.

## Gotchas

- Linter config must exist in project — if missing, suggest creating one before running
- TypeScript projects must have `tsconfig.json` with `noEmit: true` for `tsc --noEmit`
