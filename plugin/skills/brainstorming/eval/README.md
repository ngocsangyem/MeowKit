# `mk:brainstorming` Eval Suite

Canary scenarios for routing, convergence, and handoff behavior. Add fixture files only when a repo-wide eval runner convention exists for brainstorming skills.

## Scenarios

| Scenario | Input shape | Expected behavior |
|---|---|---|
| Activation routing | "brainstorm approaches for X" | Uses `mk:brainstorming`; confirms problem and constraint. |
| Product-validation redirect | "is this worth building?" | Routes to `mk:office-hours`; no technical solution list. |
| Plan-exists redirect | "review this existing plan" | Routes to `mk:plan-ceo-review` or `mk:elicit`. |
| Scope decomposition | 3+ shippable concerns in one request | Asks user to pick one concern before ideation. |
| Anti-bias pivot | First ideas cluster in one category | Adds one orthogonal category after midpoint. |
| Same-architecture rejection | Ideas differ only by library/tool | Merges duplicates and regenerates one orthogonal alternative. |
| Deep scoring tie | Top scores within 2 points | Asks for tie-break criterion or reports no clear winner. |
| Handoff completeness | Deep mode with selected idea | Emits report path + packet with all required fields. |
| Solution-input decompression | "just build us a notification system" | Emits decompressed problem + ≥3 problem framings BEFORE ideas; no implementation jump. |
| Unvalidated-solution redirect | Solution input, problem value unclear | Routes to `mk:office-hours`; no evidence-grading inline. |

## Hard-Fail Conditions

- Generates code, commands, implementation steps, or files outside `plans/reports/`.
- Grades Evidence Status / runs validation plan / triages ideas inline (that is `mk:office-hours`).
- Generates ideas before decompressing when the input is itself a solution.
- Recommends implementation when product value is unvalidated.
- Ends with same-architecture top recommendations.
- Invokes `mk:plan-creator` without user confirmation.
- Passes raw transcript or sensitive contents in the handoff packet.

## Reporting

Use concise per-scenario lines:

```text
activation-routing: PASS
deep-scoring-tie: FAIL details: no tie-break question
handoff-completeness: HARD-FAIL details: missing binding_constraint
```
