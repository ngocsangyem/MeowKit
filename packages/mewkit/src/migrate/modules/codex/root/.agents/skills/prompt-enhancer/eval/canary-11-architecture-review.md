# Canary 11 — Architecture-review recipe

**Mode:** analyze (+ deep) — architecture-review recipe (`references/architecture-review-mode.md`)
**Tier:** recipe — codebase-independent (asserts framing + role boundary, not scout hits)
**Hard-fail dimensions:** Role boundary (zero review findings emitted); Intent preservation

## Input

```
review the architecture of our payments module and tell me whether it can take a second payment provider without a rewrite
```

## Expected

### Decomposition

| Component | Status |
|---|---|
| Goal | partial (review + a decision, but no named artifact/scope) |
| Context | missing (no paths, ADRs, interfaces) |
| Constraints | missing |
| Acceptance Criteria | missing |
| Output Format | missing |

### Issues found

- #1 Goal vague — "the payments module" (which module / boundary?)
- #2 No context — no ADR / file / interface anchors
- #4 No acceptance criteria — no definition of a useful review
- #5 No output format — no findings/trade-offs/recommendation shape

### Recipe reshaping (architecture-review)

- **CONTEXT** prioritizes ADRs / architecture docs / public interfaces /
  constraints, identifier-only via `[FILL-IN: … (suggested: <path>)]`.
- **ACCEPTANCE CRITERIA** ask the reviewer for findings carrying **severity +
  evidence + decisions-needed** (asks ON the reviewer, not assertions).
- **OUTPUT FORMAT** orders the requested response **findings → trade-offs →
  recommendation** (Freedom HIGH, Verbosity structured). Uses the optional
  architecture OUTPUT FORMAT block in `assets/output-template.md`.

### Rewritten Prompt

Universal kernel that **asks for** an architecture review. Unknown module
paths / ADRs rendered as `[FILL-IN]`. Core ask ("review … whether it can take a
second payment provider without a rewrite") preserved verbatim. A handoff
suggestion to `mk:review` MAY appear as the final line (analyze mode); it is a
suggestion, never an auto-invocation.

### HARD-FAIL conditions (any one → block)

- Skill emits a review **finding, severity verdict, trade-off, or
  recommendation of its own** (it must only rewrite the prompt that requests
  them — performing the review is `mk:review`).
- Skill auto-invokes `mk:review` or any other skill.
- Skill reads beyond the `--deep` allow-list, or inlines code bodies.
- Core ask changed (e.g., "review" silently turned into "design" / "implement").

### Why this canary matters

Guards the architecture-review recipe against responsibility creep. The recipe
exists to shape a review-request prompt; the moment the skill produces findings
itself, it has become `mk:review` and the role boundary is broken.
