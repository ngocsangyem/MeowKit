---
title: "mk:decision-framework"
description: "Operational decision architecture: triage, escalation, case management. Structures expert judgment into repeatable, auditable decision systems."
---

# mk:decision-framework

Structures expert judgment into repeatable, auditable decision systems for recurring high-stakes choices.

## What This Skill Does

`mk:decision-framework` solves a specific problem: expert decisions that live in people's heads instead of in documented, consistent processes. When your team handles the same kind of decision repeatedly — a return request, a billing dispute, a security incident — but each case gets handled differently depending on who is on shift, you have a decision debt problem.

This skill works through a 7-step process to extract that implicit judgment, build a classification taxonomy, define sequential rules with explicit priority ordering (safety over economics, always), create weighted scoring for ranked options, and produce an escalation protocol with specific severity levels, authority scopes, and timelines.

The output is a decision framework document — not pseudocode, but a structured artifact that a developer agent can implement as code and an operations team can follow manually. It is designed to be auditable: every decision path has a documented rationale.

## Core Capabilities

- **Taxonomy building** — Maps every case type into 3–7 mutually exclusive top-level buckets
- **Sequential decision rules** — Orders rules Safety → Compliance → Economics → Speed with documented rationale
- **Weighted scoring** — Multi-factor scoring with weights summing to 100%, calibrated against real historical cases
- **Escalation protocols** — 4-level escalation (Expert → Manager → Director → VP) with authority scope and specific timelines
- **Communication patterns** — Template selection per relationship state: Routine, Significant, or Crisis tone
- **Edge case discovery** — Structured process to surface where the textbook approach fails

## When to Use This

::: tip Use mk:decision-framework when...
- Building operations systems: billing, support, returns, logistics, compliance
- Designing triage logic or case management workflows
- Creating escalation protocols with multiple severity levels
- Answering "how should we handle X cases?" for a recurring decision type
:::

::: warning Don't use mk:decision-framework when...
- The decision happens once (use a plan, not a framework)
- The domain is already well-documented externally (load the existing spec)
- You need implementation code directly — this outputs a design document, not code
:::

## Usage

```bash
# Decision framework for a specific domain
/mk:decision-framework returns processing

# Billing operations triage
/mk:decision-framework billing disputes and chargebacks

# Incident classification
/mk:decision-framework security incident response
```

## The 7-Step Process

1. **Identify Decision Type** — Clarify what is being decided, who decides it, and how often. Pin the frequency and stakes before building taxonomy.

2. **Build Classification Taxonomy** — Load `references/decision-tree-template.md`. Map every case type into mutually exclusive categories. Aim for 3–7 top-level buckets: too few collapses distinct cases, too many creates lookup overhead.

3. **Define Sequential Decision Rules** — Order rules by: **Safety → Compliance → Economics → Speed**. Never let speed override safety. Document the reasoning for each rule's position in the sequence.

4. **Create Weighted Scoring** — Load `references/weighted-scoring-guide.md`. Define 3–5 factors with weights summing to 100%. Calibrate against 3 real historical cases, not hypothetical ones.

5. **Define Escalation Protocol** — Load `references/escalation-protocol-template.md`. Map 4 escalation levels: Expert → Manager → Director → VP. Each level must have authority scope, specific timeline (hours, not "soon"), and escalation trigger.

6. **Add Communication Templates** — Load `references/communication-patterns.md`. Select tone per relationship state: Routine (standard update), Significant (customer impact), Crisis (all-hands). Customize placeholders for each template.

7. **Document Edge Cases** — Load `references/edge-case-discovery.md`. Collect edge cases from team ("what surprised you?"). Each entry: situation → why the obvious approach fails → correct approach.

## References

| File | Purpose |
|------|---------|
| `references/decision-tree-template.md` | Domain-agnostic taxonomy + sequential rules template |
| `references/escalation-protocol-template.md` | 4-level escalation with authority scope, timeline, triggers |
| `references/weighted-scoring-guide.md` | Multi-factor scoring + calibration method against real cases |
| `references/communication-patterns.md` | 3 tones (Routine / Significant / Crisis) with example templates |
| `references/edge-case-discovery.md` | Edge case collection and documentation process |
| `references/examples/example-returns-triage.md` | Worked example: returns processing |
| `references/examples/example-billing-ops.md` | Worked example: billing operations |
| `references/examples/example-incident-response.md` | Worked example: security incident response |

## Worked Examples

Three reference implementations ship with the skill:

- **Returns triage** (`example-returns-triage.md`) — Classifies return requests by reason code, condition, and customer tier. Shows how Safety (fraud signals) gates before Economics (restocking cost).
- **Billing ops** (`example-billing-ops.md`) — Dispute and chargeback triage with escalation timelines per dispute value. Shows weighted scoring across dispute age, customer history, and amount.
- **Incident response** (`example-incident-response.md`) — Security incident classification from P1–P4 with authority scopes and communication cadence per severity.

## Gotchas

- **Domain unclear at start**: Ask the user for 3 example cases. Derive taxonomy from examples, not from abstract category names. Real cases reveal the real distinctions.
- **No domain expert available**: Flag the output as `needs-expert-input`. Mark uncertain classifications explicitly — do not paper over gaps with confident-sounding language.
- **Scope creep during taxonomy**: Resist collapsing two case types just because they look similar. Different decision rules = separate buckets, even if the surface looks the same.
- **Vague escalation timelines**: "Escalate soon" is not a protocol. Escalation timelines must be specific hours (e.g., "escalate to Manager if unresolved after 2 hours").
- **Scoring weights that don't calibrate**: Weights set theoretically and never checked against real cases will produce wrong rankings. Run 3 historical cases through the scoring matrix before finalizing weights.

## Related

- [`mk:plan-creator`](/reference/skills/plan-creator) — Creates the plan this framework feeds into
- [`mk:cook`](/reference/skills/cook) — End-to-end pipeline that uses framework outputs at Phase 1
