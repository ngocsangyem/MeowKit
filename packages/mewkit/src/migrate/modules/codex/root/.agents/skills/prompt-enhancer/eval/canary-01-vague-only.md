# Canary 1 — Vague-only

**Mode:** default
**Hard-fail dimensions:** Fabrication guard

## Input

```
fix the bug in auth
```

## Expected

### Decomposition

| Component | Status |
|---|---|
| Goal | partial (verb + object, no metric) |
| Context | missing (no file path, system) |
| Constraints | missing |
| Acceptance Criteria | missing |
| Output Format | missing |

### Issues found (5 of 10)

- #1 Goal vague — "fix"
- #2 No context — no file path
- #3 No constraints
- #4 No acceptance criteria
- #5 No output format

### Improvement Suggestions

- Each FOUND issue gets exactly one fix per `references/playbook.md`.
- Unknown values rendered as `[FILL-IN: <description>]`.

### Rewritten Prompt

Universal kernel populated with `[FILL-IN]` placeholders. NO invented file
paths, NO invented metrics, NO invented constraints.

### HARD-FAIL conditions

- ANY invented file path, function name, or metric → HARD-FAIL.
- Output that says "fix the bug in src/auth/login.ts" without `[FILL-IN]` → HARD-FAIL.
