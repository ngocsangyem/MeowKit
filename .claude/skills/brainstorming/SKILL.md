---
name: mk:brainstorming
preamble-tier: 3
version: 2.1.0
description: "Compares approaches for one decision. NOT for mk:office-hours."
allowed-tools:
  - Read
  - Grep
  - Glob
  - AskUserQuestion
  - WebSearch
source: local
keywords:
  - brainstorm
  - explore-solutions
  - compare-approaches
  - trade-off-analysis
  - alternatives
when_to_use: "Options are open."
user-invocable: true
owner: research
criticality: medium
status: active
runtime: claude-code
---

# Brainstorming

Use for generating or comparing multiple technical approaches to one validated decision.

**Boundary:** `mk:office-hours` answers “should we build this?”; this skill answers “how should we build it?” A bare “brainstorm” request is ambiguous: ask whether the user wants product discovery/validation or technical approaches. Do not route from that word alone. (`mk:office-hours` points here for this rule.)

## Profiles

- **quick** / `--depth quick` (default) — restate the decision in one line; give 2-4 technically distinct options and one recommendation. If a material fact is missing, state the assumption rather than running discovery. Return inline and stop. Do not load techniques, scout, scoring, challenge, reports, plans, or handoff.
- **deep** / `--depth deep` — load the needed technique and use the deep workflow below. A report, HTML output, or handoff is optional and only produced when requested or needed by an active plan.

## Routing

| Situation | Route |
| --- | --- |
| New product, feature, or side-project value is unvalidated | `mk:office-hours` |
| Observed failure or root-cause work | `mk:investigate` |
| Existing plan, verdict, or brainstorm needs critique | `mk:plan-ceo-review` or `mk:elicit` |
| Generic Q&A or a single implementation detail | answer directly or use `mk:docs-finder` |

## Defaults

Use at least two alternatives. Quick returns 2-4; deep generates 3-8 and never more than 8. Keep multiple dimensions in one run when they serve one decision or report; split only 3+ independently shippable concerns.

## Quick Workflow

1. Restate the validated decision and any material assumption.
2. Give 2-4 technically distinct options with the key trade-off for each.
3. Recommend one option and return inline. Do not create a report or plan.

## Deep Workflow


1. Confirm the decision, binding constraint, success criterion, and excluded scope. Ask at most three focused questions when needed.
2. If 3+ independently shippable concerns are bundled, ask to choose one. Use a compact scout summary only when current codebase touchpoints change the decision.
3. Load one technique (table below); generate 3-8 technical approaches without scoring while generating. If the technique gives weak ideas after three attempts, switch.
4. Run one anti-bias pivot, then the challenge pass in `references/challenge-pass.md` before recommending.
5. Load scoring only for deep scoring. Write a report, HTML output, or handoff only when requested or needed by an active plan.

## Technique by problem shape

| Problem shape | Technique file in `references/techniques/` |
| --- | --- |
| "How to build X"; several architecturally distinct approaches (default) | `multi-alternative.md` |
| Novel problem; no pattern in the codebase; standard solutions do not fit | `first-principles.md` |
| Looks novel but probably is not; cross-domain patterns may help | `analogical-thinking.md` |
| Many constraints, narrow solution space | `constraint-mapping.md` |
| Improving or iterating something that exists (feature, API, schema) | `scamper.md` |
| Technically right but may fail on an operations, support, security or user axis | `perspective-shift.md` |
| "How could this fail?" or "what should we prevent?" | `reverse.md` |
| The user arrives holding a solution, not a problem | `solution-decompression.md` first, then optionally `reverse.md` |

## `--advice` (composable, off by default)

Opt-in strategic supervision for one run, **deep workflow only**. GUIDE fires after the
frame and before generation, REVIEW after the challenge pass and before the
recommendation reaches the user; hard cap 4.

Athena supplies decision criteria and reads the chosen direction. It never generates the
option set, scores it, chooses for the user, or adds an approval step.

Without the flag there are zero calls and no state is written.

Checkpoints: `references/advice-checkpoints.md`. Contract: `.claude/skills/advise/references/advice-supervision-rules.md` (load only when the
flag is present).

## References

- `references/context-budget.md` — deep clarification, count, pivot, and challenge limits
- `references/techniques/` — choose one technique for a deep run (table above)
- `references/gotchas.md` — failure modes and edge cases; read before a deep run
- `references/challenge-pass.md` and `references/scoring-criteria.md` — deep convergence only
- `references/editorial-html.md` — HTML only for a requested report
- `references/advice-checkpoints.md` — `--advice` checkpoint boundaries, caps, and what supervision may not touch

## Gotchas

The full list is `references/gotchas.md`. The ones that bite most: solutioning before the problem is confirmed, scoring before all ideas exist, ideas that are the same mechanism in different libraries, and a report with no recommendation.
