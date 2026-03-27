---
title: [Short descriptive title]
type: report
source: [scout | researcher | reviewer | debugger | analyst]
created: [YYMMDD]
plan: [path to parent plan.md]
---

<!-- Report template for plan research and analysis outputs.
     Used by: meow:scout, researcher subagents, meow:review, meow:investigate
     Saved to: tasks/plans/YYMMDD-name/reports/
     Naming: {source}-{NN}-{topic}.md (e.g., researcher-01-auth-patterns.md) -->

## Summary

<!-- 2-3 sentences: what was investigated, key finding, confidence level -->

[What was researched and the main conclusion]

## Key Findings

<!-- Numbered list, most important first. Each finding = fact + evidence + implication -->

1. **[Finding]** — [Evidence] → [What this means for the plan]
2. **[Finding]** — [Evidence] → [What this means for the plan]
3. **[Finding]** — [Evidence] → [What this means for the plan]

## Relevant Files

<!-- Paths the agent should read when implementing based on this report -->

- `[path/to/file]` — [why it's relevant]
- `[path/to/file]` — [why it's relevant]

## Recommendations

<!-- Actionable items for the planner/developer. Not opinions — concrete next steps. -->

- [Recommendation with rationale]
- [Recommendation with rationale]

## Confidence

<!-- How reliable are these findings? -->

| Aspect | Confidence | Notes |
|--------|-----------|-------|
| [Finding 1] | High/Medium/Low | [Why this confidence level] |
| [Finding 2] | High/Medium/Low | [Why this confidence level] |

## Open Questions

<!-- What couldn't be determined? What needs human input? -->

- [Question that needs human decision]
- [Uncertainty that affects the plan]
