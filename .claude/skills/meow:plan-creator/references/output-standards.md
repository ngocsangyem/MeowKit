# Plan Output Standards

## Required YAML Frontmatter
```yaml
title: [outcome-focused, not activity]
type: [feature | bug-fix | refactor | security]
status: [draft | approved | in-progress | done]
priority: [critical | high | medium | low]
effort: [xs | s | m | l | xl]
created: [YYMMDD]
model: [feature-model | bugfix-model | refactor-model | security-model]
```

## Required Body Sections
Every plan must have: Goal, Context, Scope (in/out), Constraints, Acceptance Criteria, Agent State.

## Quality Rules
- Goal: one sentence, outcome-focused ("Users can..." not "Implement...")
- Context: max 5 bullets (current state + problem)
- Acceptance criteria: binary checkboxes, no subjective terms
- Constraints: imperative ("Do NOT...", "MUST preserve...")
- Agent State: filled before saving, updated after each phase

## Validation
Run `scripts/validate-plan.py <plan-file>` before presenting for Gate 1.
Output: PLAN_COMPLETE or PLAN_INCOMPLETE with missing items.
