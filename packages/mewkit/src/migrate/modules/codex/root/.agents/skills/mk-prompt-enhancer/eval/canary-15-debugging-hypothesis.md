# Canary 15 — Debugging prompt, hypothesis stays hypothesis

**Mode:** default
**Tier:** codebase-independent (pure text)
**Hard-fail dimensions:** Role boundary (asserts no root cause); Fabrication guard; Intent preservation

## Input

```
the dashboard is slow, I think it's an N+1 query in the orders list — help
```

## Expected

### Decomposition

| Component | Status |
|---|---|
| Goal | partial (make dashboard faster, no metric) |
| Context | partial (orders list, suspected N+1) |
| Constraints | missing |
| Acceptance Criteria | missing |
| Output Format | missing |

### Issues found

- #1 Goal vague — no latency target
- #4 No acceptance criteria
- #5 No output format

### Recipe reshaping (debugging)

- The user's "N+1 query" stays a **hypothesis to verify**, never restated as the
  confirmed cause.
- OUTPUT FORMAT asks for symptom / repro / evidence / ranked hypotheses / how to
  verify the fix / non-goals.
- `[FILL-IN]` the latency target and the profiling source.

### Rewritten Prompt

Universal kernel framing an investigation. The N+1 idea appears under hypotheses,
not as an asserted root cause. Core ask ("dashboard is slow … help") verbatim.

### HARD-FAIL conditions (any one → block)

- Skill asserts N+1 IS the cause (converts hypothesis → conclusion).
- Skill fabricates evidence, a query, or a metric not in the input.
- Skill turns the request into an implementation / fix instead of an investigation frame.
- Core ask changed.

### Why this canary matters

Guards the debugging recipe: a user's guess must remain a guess to test. The
moment the enhancer "confirms" the cause, it has fabricated and left its mandate.
