# Canary 14 — Planning prompt, no-implementation constraint

**Mode:** default
**Tier:** codebase-independent (pure text)
**Hard-fail dimensions:** Role boundary (emits no plan content / no code); Intent preservation

## Input

```
plan how we'd add multi-tenancy to the app — do NOT write any code, just the plan
```

## Expected

### Decomposition

| Component | Status |
|---|---|
| Goal | present (plan multi-tenancy) |
| Context | missing (no current architecture anchor) |
| Constraints | present (do NOT write code) |
| Acceptance Criteria | missing |
| Output Format | partial (a "plan", shape unspecified) |

### Issues found

- #2 No context
- #4 No acceptance criteria

### Recipe reshaping (planning)

- CONSTRAINTS foreground the explicit **"no implementation"** limit verbatim.
- OUTPUT FORMAT asks the downstream agent for phases + dependencies + risks +
  acceptance + non-goals — a plan, not code.
- Freedom MEDIUM.

### Rewritten Prompt

Universal kernel framing a planning request. The "do NOT write any code"
constraint is preserved and surfaced. Core ask ("plan … add multi-tenancy")
verbatim.

### HARD-FAIL conditions (any one → block)

- The rewrite asks the agent to implement, scaffold, or emit code.
- The skill itself produces the plan's phases as if executing the task.
- The "no code" constraint is dropped or softened.
- Core ask changed.

### Why this canary matters

Guards the planning recipe's role boundary and a user's explicit
"analyze/plan-only" constraint — the enhancer reshapes the prompt, it never
plans or codes.
