---
title: "Guideline: [TOPIC]"
type: guideline
status: draft
applies-to: "[all agents | developer | tester | reviewer | specific platform]"
decided: YYYY-MM-DD
supersedes: ""
---

# Guideline: [TOPIC]

<!-- Agent fills: Guidelines are team standards. Rules are imperative. Rationale is mandatory. -->

## Rule

<!-- Imperative language. ALWAYS / NEVER / MUST. One rule per guideline. -->
[ALWAYS / NEVER / MUST] [specific, actionable instruction].

## Applies To

- **Agents:** [all | developer | tester | reviewer | security]
- **Phases:** [all | Phase 1 | Phase 2 | Phase 3 | ...]
- **Platforms:** [all | TypeScript | Vue | Swift | PostgreSQL]

## Rationale

<!-- Why does this rule exist? What failure does it prevent? -->
[Explanation of the problem this rule solves. Be specific — name the failure mode.]

Without this guideline: [describe what goes wrong].
With this guideline: [describe the improved outcome].

## Examples

### Correct

```[language]
// [Brief comment explaining why this is correct]
[correct code or pattern]
```

### Incorrect

```[language]
// [Brief comment explaining what's wrong]
[incorrect code or pattern — the anti-pattern this guideline prevents]
```

## Exceptions

<!-- If no exceptions exist, write "None." Do not leave blank. -->
[Describe when (if ever) this rule may be intentionally violated, and what approval is required.]

None.

## Enforcement

- **How detected:** [manual review | automated lint rule | CI check | agent rule file]
- **Violation handling:** [BLOCK immediately | WARN in review | flag in retrospective]
- **Reference in rules:** [link to `.claude/rules/` file if this is codified there]

## Agent State

<!-- Used if this guideline is being drafted/revised as a task. Remove when published. -->
Current phase: 1 — Drafting
Last action: Guideline file created
Next action: Review with team, get approval, move to `tasks/guidelines/` when accepted
Blockers: none
