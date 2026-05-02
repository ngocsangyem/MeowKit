---
title: "mk:decision-framework"
description: "Structures expert judgment into repeatable, auditable decision systems — triage, escalation, case management, billing ops."
---

# mk:decision-framework

Structures expert judgment into repeatable, auditable decision systems for recurring high-stakes choices. Produces a decision framework document at Phase 1 (Plan). Developer agent implements the decision logic in code.

## When to use

- User asks "how should we handle X cases?", "build triage system"
- Designing escalation protocols or case management workflows
- Billing ops, support, returns, incident response, compliance decisions
- Any domain with classified decision types and routing rules

## Process (7 steps)

1. **Identify Decision Type** — what is decided? who decides? how often?
2. **Build Classification Taxonomy** — mutually exclusive categories, 3-7 top-level buckets
3. **Define Sequential Decision Rules** — ordered by: Safety > Compliance > Economics > Speed
4. **Create Weighted Scoring** — 3-5 factors, weights sum to 100%, calibrate against 3 historical cases
5. **Design Routing** — map classification to action paths
6. **Document Exceptions** — edge cases, override criteria, escalation paths
7. **Validate with Examples** — run 3 real cases through the framework

## Failure handling

- Domain unclear → ask for 3 example cases, derive taxonomy from examples
- No domain expert → flag output as `needs-expert-input`, mark uncertain classifications
