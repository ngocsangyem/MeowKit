---
title: [Short descriptive title — outcome-focused, not activity]
description: [One-line summary for card preview]
type: [feature | bug-fix | refactor | security]
status: draft
priority: [critical | high | medium | low]
effort: [xs | s | m | l | xl]
created: [YYMMDD]
branch: [feature/your-branch-name]
model: [feature-model | bugfix-model | refactor-model | security-model]
tags: []
issue: ""
blockedBy: []
blocks: []
---

## Goal
<!-- One sentence. What done looks like — not what to do. -->
[OUTCOME DESCRIPTION]

## Context
<!-- Current state + problem. Max 5 bullets. -->
- [What exists now]
- [What the problem is]
- [Why this task exists]

## Scope
### In scope
- [What this task covers]

### Out of scope
- [What this task explicitly excludes]

## Constraints
<!-- Hard limits. Imperative: "Do NOT...", "MUST preserve..." -->
- [Constraint 1]
- [Constraint 2]

## Technical Approach
<!-- How it will be built. Reference workflow model for phase details. -->
[APPROACH DESCRIPTION]

## Risk Map
<!-- Required for m/l/xl effort. Skip for xs/s. -->
<!-- Rules: codebase pattern → LOW | external dep/new API → HIGH | >5 files blast → HIGH | novel → MEDIUM+ -->
| Component | Risk | Reason |
|-----------|------|--------|
| [component] | [LOW/MEDIUM/HIGH] | [one-line reason] |

## Red Team Review
<!-- Optional: populated by step-05 red-team review -->

## Acceptance Criteria
<!-- Binary pass/fail. No subjective criteria. -->
- [ ] [Specific, verifiable condition]
- [ ] [Specific, verifiable condition]
- [ ] All existing tests pass
- [ ] No security scan violations

## Related
- Plan reports: [tasks/plans/YYMMDD-name/reports/]
- Affected files: [paths or globs]

## Agent State
<!-- Updated by agent after each significant action -->
Planning phase: draft
Last action: plan created from template
Next action: fill required sections
Blockers: none
Selected model: [workflow model]
Validation: pending
Approved by: pending
