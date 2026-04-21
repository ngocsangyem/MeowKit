---
name: meow:decision-framework
description: "Operational decision frameworks: triage, escalation, case management, billing ops. Use for 'how to handle X cases', 'build triage', 'escalation protocol'."
version: 1.0.0
argument-hint: "[decision domain description]"
source: meowkit
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - AskUserQuestion
---

# Decision Framework Builder

Structures expert judgment into repeatable, auditable decision systems for recurring high-stakes choices.

## When to Use

Activate when:
- User asks "how should we handle X cases?" or "build triage system"
- Designing escalation protocols or case management workflows
- Billing ops, support, returns, incident response, compliance decisions
- Any domain with classified decision types and routing rules

## Phase Anchor

**Phase: 1 (Plan)** — Produces a decision framework document.
**Handoff:** Developer agent implements the decision logic in code.

## Failure Handling

- **Domain unclear:** Ask user for 3 example cases. Derive taxonomy from examples.
- **No domain expert available:** Flag output as `needs-expert-input`. Mark uncertain classifications explicitly.

## Process (7 Steps)

### Step 1: Identify Decision Type
Clarify the recurring decision being structured. What is decided? Who decides? How often?

### Step 2: Build Classification Taxonomy
Load `references/decision-tree-template.md`. Map every case type into mutually exclusive categories. Aim for 3-7 top-level buckets — too few collapses distinct cases, too many creates lookup overhead.

### Step 3: Define Sequential Decision Rules
Order rules by: **Safety > Compliance > Economics > Speed**. Never let speed override safety. Document the reasoning for each rule's position in the sequence.

### Step 4: Create Weighted Scoring
Load `references/weighted-scoring-guide.md`. Define 3-5 factors with weights summing to 100%. Calibrate against 3 historical cases.

### Step 5: Define Escalation Protocol
Load `references/escalation-protocol-template.md`. Map 4 escalation levels: Expert → Manager → Director → VP. Each level must have authority scope, timeline, and escalation trigger.

### Step 6: Add Communication Templates
Load `references/communication-patterns.md`. Select tone per relationship state: Routine / Significant / Crisis. Customize placeholders.

### Step 7: Document Edge Cases
Load `references/edge-case-discovery.md`. Collect edge cases from team ("what surprised you?"). Document each as: situation → why obvious approach fails → correct approach.

## References

| File | Purpose |
|------|---------|
| `references/decision-tree-template.md` | Domain-agnostic taxonomy + rules template |
| `references/escalation-protocol-template.md` | 4-level escalation with authority/timeline/triggers |
| `references/weighted-scoring-guide.md` | Multi-factor scoring + calibration method |
| `references/communication-patterns.md` | 3 tones with example templates |
| `references/edge-case-discovery.md` | Edge case collection and documentation process |
| `references/examples/example-returns-triage.md` | Worked example: returns processing |
| `references/examples/example-billing-ops.md` | Worked example: billing operations |
| `references/examples/example-incident-response.md` | Worked example: security incidents |

## Output Format

Produce a decision framework document with:
1. **Domain Summary** — what is being decided, frequency, stakes
2. **Classification Taxonomy** — case types and definitions
3. **Decision Rules** — ordered Safety → Compliance → Economics → Speed
4. **Scoring Matrix** — weighted factors with calibration notes
5. **Escalation Protocol** — 4-level table
6. **Communication Templates** — one per tone
7. **Edge Case Playbook** — 2-3 sentence entries per known exception

## Gotchas

- Do not merge case types that have different decision rules — keep taxonomy granular
- Scoring weights must sum to 100%; calibrate on real cases, not hypothetical ones
- Escalation timelines must be specific (hours, not "soon")
- Edge cases are not exceptions to document and ignore — they are the most important cases to get right
