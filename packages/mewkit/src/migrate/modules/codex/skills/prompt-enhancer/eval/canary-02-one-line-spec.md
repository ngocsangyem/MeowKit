# Canary 2 — One-line spec

**Mode:** default

## Input

```
add a dark mode
```

## Expected

### Decomposition

| Component | Status |
|---|---|
| Goal | partial (verb + object, no theme switching specifics) |
| Context | missing (no app/framework reference) |
| Constraints | missing |
| Acceptance Criteria | missing |
| Output Format | missing |

### Issues found (≥4 of 10)

- #1 Goal vague (or partial)
- #2 No context
- #4 No acceptance criteria
- #5 No output format

### Improvement Suggestions

- Suggest acceptance criteria around theme switching:
  - Theme persists across reloads.
  - Default theme matches `prefers-color-scheme` media query.
  - User-toggle UI accessible from header.
- Each is offered as a *suggestion* the user can accept/reject. Do NOT embed
  these as if the user requested them.

### Rewritten Prompt

Universal kernel; `CONTEXT` and `OUTPUT FORMAT` populated via `[FILL-IN]`
placeholders. Acceptance criteria items written as suggestions the user must
confirm.

### Notes

- Skill SHOULD note: "Acceptance criteria below are suggestions — confirm or replace."
