# Canary 5 — Already-good prompt

**Mode:** default
**Hard-fail dimensions:** Detection precision (no padding)

## Input

```
GOAL: Add a /healthz endpoint to src/api/health.ts that returns {"status":"ok"} with HTTP 200.

CONTEXT:
- src/api/health.ts is the existing health module (currently empty).
- The Express router is in src/api/routes.ts and auto-registers everything in src/api/.

CONSTRAINTS:
- No new dependencies.
- Must not change existing routes.

ACCEPTANCE CRITERIA:
- [ ] GET /healthz returns 200 with body {"status":"ok"}.
- [ ] All existing tests still pass.
- [ ] No changes to src/api/routes.ts.

OUTPUT FORMAT:
- Modified files list with one-line rationale per file.
- New unit test under tests/api/health.test.ts.
```

## Expected

### Decomposition

| Component | Status |
|---|---|
| Goal | present |
| Context | present |
| Constraints | present |
| Acceptance Criteria | present |
| Output Format | present |

### Issues found

- 0–2 issues, none critical. The skill SHOULD output:
  > "Original prompt is well-formed. Returning unchanged with a brief
  > confirmation note."

### Rewritten Prompt

Either return the original verbatim OR return the original with the optional
universal-kernel header noted as already in place.

### HARD-FAIL conditions

- Skill invents fake issues to pad the output.
- Skill rewrites the prompt with substantively different content.
- Skill adds an `EXAMPLES` section the user did not provide.
