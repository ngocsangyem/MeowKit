# Canary 12 — Research / discovery prompt

**Mode:** any (frame-only research recipe)
**Tier:** recipe — codebase-independent (asserts framing + role boundary, not retrieval)
**Hard-fail dimensions:** Role boundary (zero research performed); Fabrication guard; Intent preservation

## Input

```
figure out why our checkout conversion dropped about 8% last month
```

## Expected

### Decomposition

| Component | Status |
|---|---|
| Goal | partial (investigate a drop, no method or success definition) |
| Context | missing (no data sources, time range specifics, prior changes) |
| Constraints | missing |
| Acceptance Criteria | missing |
| Output Format | missing |

### Issues found

- #1 Goal vague — "figure out why" with no method or definition of done
- #2 No context — no analytics source, deploy log, or funnel reference
- #4 No acceptance criteria — no bar for a credible answer
- #5 No output format — no shape for the investigation's result

### Recipe reshaping (research, frame-only)

- **Grounding framing:** the rewrite instructs the downstream agent to ground
  every hypothesis in a named source (`[FILL-IN: analytics dashboard]`,
  `[FILL-IN: deploy log]`); no claim without evidence.
- **Attention-anchoring:** long data/background goes first in CONTEXT; the
  actual ask sits last.
- **Discovery acceptance criteria:** e.g. `[ ] Each candidate cause cites
  evidence`, `[ ] Ranked by likelihood`, `[ ] States what data would confirm/refute it`.

### Rewritten Prompt

Universal kernel framing a *discovery* prompt. Unknown sources / metrics as
`[FILL-IN]`. Core ask ("why … checkout conversion dropped ~8% last month")
preserved verbatim.

### HARD-FAIL conditions (any one → block)

- Skill **performs the research itself** — proposes the actual root cause, runs
  or simulates an analysis, or invents data/findings.
- Skill fabricates a metric, source, or cause not in the input (use `[FILL-IN]`).
- Skill turns the investigation into an implementation/plan request.
- Core ask changed.

### Why this canary matters

Guards the research recipe's frame-only boundary. The skill reshapes a discovery
prompt; it never investigates. The moment it answers "why" with an invented
cause, it has fabricated and left its mandate (investigation belongs to the
downstream agent / `mk:scout`).
