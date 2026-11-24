---
name: mk:decision-framework
description: "Builds triage and escalation frameworks. NOT for mk:party."
version: 1.0.0
argument-hint: '[decision domain description]'
source: local
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - AskUserQuestion
keywords:
  - decision-framework
  - triage
  - escalation
  - case-management
  - operational-decisions
when_to_use: "Handling a class of cases."
user-invocable: true
owner: research
criticality: medium
status: active
runtime: claude-code
---

# Decision Framework Builder

Structures expert judgment into repeatable, auditable decision systems for recurring high-stakes choices.

## When to Use

Use for a decision that recurs, can be classified into cases, and is costly to get wrong ("how should we handle X cases?", a triage system, an escalation protocol; billing ops, support, returns, incident response, compliance). A one-off choice is not this skill: a single trade-off goes to `mk:party` (several perspectives) or `mk:advise` (one verdict). Implementing the logic in code is a separate task for the developer after the framework exists.

## Failure Handling

- **Domain unclear:** ask the user for 3 example cases and derive the taxonomy from them.
- **No domain expert available:** flag the output `needs-expert-input` and mark uncertain classifications explicitly.

## Parts to produce

Produce these in dependency order and skip a part with a stated reason (a one-line note in the document). The taxonomy, rules and edge cases are always produced.

1. **Decision type.** What is decided, by whom, how often.
2. **Classification taxonomy** (`references/decision-tree-template.md`). Mutually exclusive categories, usually 3-7 top-level buckets: too few collapses distinct cases, too many creates lookup overhead.
3. **Sequential decision rules.** Order by Safety, Compliance, Economics, Speed; speed never overrides safety. Give the reason for each rule's position.
4. **Weighted scoring** (`references/weighted-scoring-guide.md`). Only when two handlers would disagree or three or more factors matter; skip it when a single factor is determinative. Three to five factors, weights summing to 100%.
5. **Escalation protocol** (`references/escalation-protocol-template.md`). As many levels as the organisation has (the template shows four: Expert, Manager, Director, VP); each with authority scope, a specific timeline and a trigger.
6. **Communication templates** (`references/communication-patterns.md`). Only when the framework sends messages; one tone per relationship state (routine, significant, crisis).
7. **Edge cases** (`references/edge-case-discovery.md`). Ask the team "what surprised you?"; document each as situation, why the obvious approach fails, correct approach.

**Calibration:** run the framework against at least 3 real past cases. If two of the three disagree with the expert's decision, revisit the weights. The same number applies in the reference files.

Done when the document shows the framework against 3 real cases with a match table (framework result against the expert's actual decision).

## References

| File | Purpose |
|------|---------|
| `references/decision-tree-template.md` | Domain-agnostic taxonomy + rules template |
| `references/escalation-protocol-template.md` | Escalation levels with authority/timeline/triggers |
| `references/weighted-scoring-guide.md` | Multi-factor scoring + calibration method |
| `references/communication-patterns.md` | 3 tones with example templates |
| `references/edge-case-discovery.md` | Edge case collection and documentation process |
| `references/examples/` | Three worked examples (returns triage, billing operations, security incident response); load the one that matches the domain |

## Output Format

Produce a decision framework document with:
1. **Domain Summary** — what is being decided, frequency, stakes
2. **Classification Taxonomy** — case types and definitions
3. **Decision Rules** — ordered Safety → Compliance → Economics → Speed
4. **Scoring Matrix** — weighted factors with calibration notes (if used)
5. **Escalation Protocol** — table with the organisation's levels
6. **Communication Templates** — one per tone (if used)
7. **Edge Case Playbook** — 2-3 sentence entries per known exception
8. **Calibration** — the match table against 3 real cases

## Gotchas

- Do not merge case types that have different decision rules — keep taxonomy granular
- Scoring weights must sum to 100%; calibrate on real cases, not hypothetical ones
- Escalation timelines must be specific (hours, not "soon")
- Edge cases are not exceptions to document and ignore — they are the most important cases to get right
