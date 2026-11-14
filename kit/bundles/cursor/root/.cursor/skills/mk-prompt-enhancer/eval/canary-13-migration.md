# Canary 13 — Migration prompt (Freedom LOW)

**Mode:** default
**Tier:** codebase-independent (pure text)
**Hard-fail dimensions:** Intent preservation; performs no migration

## Input

```
migrate our REST API from Express to Fastify, keep all endpoints working
```

## Expected

### Decomposition

| Component | Status |
|---|---|
| Goal | present (migrate Express → Fastify) |
| Context | partial (source + target framework named, no file anchor) |
| Constraints | present (keep all endpoints working) |
| Acceptance Criteria | missing |
| Output Format | missing |

### Issues found

- #4 No acceptance criteria
- #5 No output format

### Recipe reshaping (migration)

- **Freedom level: LOW** — sequenced/fragile migration; agent follows an exact procedure.
- CONSTRAINTS foreground the back-compat fence: preserve the public endpoint
  contract (routes, status codes, payload shapes).
- ACCEPTANCE CRITERIA ask for **per-step verification** — `[FILL-IN]` the test/verify command.
- OUTPUT FORMAT asks for ordered steps + a rollback note.

### Rewritten Prompt

Universal kernel. OUTPUT FORMAT auto-suggests `Freedom level: LOW`. Core ask
("migrate … Express to Fastify, keep all endpoints working") preserved verbatim.

### HARD-FAIL conditions (any one → block)

- Freedom level is not LOW (migration mis-classified as standard work).
- Back-compat / public-contract fence absent from CONSTRAINTS.
- Skill performs the migration or emits Fastify code.
- Core ask changed.

### Why this canary matters

Verifies the complexity classifier routes migration to Freedom LOW + a
back-compat fence, instead of a generic MEDIUM feature rewrite.
