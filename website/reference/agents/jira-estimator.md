---
title: jira-estimator
description: Jira story point estimator — produces heuristic estimates using complexity analysis, historical data, and team velocity context.
---

# jira-estimator

The jira-estimator agent produces story point estimates for Jira tickets. It combines complexity analysis from the evaluator, historical velocity data, and team context to generate calibrated estimates — not gut feelings. Every estimate includes a confidence level and the reasoning behind the number.

## Cognitive Framing

> *"An estimate without reasoning is a guess. Show the work behind the number."*

The jira-estimator agent is a read-only analysis agent that produces story point recommendations. It never modifies Jira state or sets story points directly — it generates estimates with supporting reasoning that the team can review and accept, adjust, or override.

## Key Facts

| | |
|---|---|
| **Type** | Domain (Jira) |
| **Phase** | On-demand |
| **Model** | haiku |
| **Color** | teal |
| **Safety** | Read-only — never modifies Jira state or sets story points |
| **Never does** | Set story points (jira-agile), evaluate complexity only (jira-evaluator), perform full RCA (jira-analyst) |

## When to Use

- When you need **story point estimates** for sprint planning.
- When you want **calibrated estimates** based on complexity analysis rather than gut feeling.
- When you need to **compare effort levels** across tickets to inform sprint capacity.
- When you want to understand **why a ticket deserves a particular estimate**.

## Key Capabilities

- **Heuristic estimation** — produces story point estimates using multiple data inputs: complexity scores, historical patterns, and team context.
- **Confidence scoring** — rates each estimate's confidence level based on information quality.
- **Reasoning transparency** — documents the factors that influenced the estimate, making it reviewable.
- **Complexity integration** — uses evaluator findings as input for more accurate estimates.
- **Historical calibration** — references past estimates and actual effort to improve accuracy over time.

## Behavioral Checklist

- [x] Produces estimates with explicit reasoning — never outputs a number alone
- [x] Includes confidence level with every estimate
- [x] References complexity analysis when available
- [x] Considers historical data and team velocity for calibration
- [x] Never modifies Jira state — recommendation only
- [x] Never sets story points directly — that belongs to jira-agile

## Common Use Cases

| Scenario | What the agent does |
|---|---|
| "Estimate PROJ-123" | Analyzes ticket complexity, produces story point estimate with reasoning and confidence |
| "How complex is this ticket?" | Runs complexity analysis and maps it to a calibrated story point range |
| "Estimate these 5 tickets for the sprint" | Produces individual estimates for each ticket with comparative context |
| "Why is PROJ-456 estimated at 8 points?" | Shows the complexity factors and historical patterns that led to the estimate |

## Pro Tips

### Use Estimates as Conversation Starters

The estimator's output is designed to be discussed, not accepted blindly. When the estimate includes "high ambiguity score due to missing edge cases in acceptance criteria," that is a prompt for the team to clarify the ticket before committing to the sprint.

### Calibrate with Actual Results

The estimator improves over time when actual effort data is available. After a sprint, comparing estimates to actual story points reveals systematic biases (e.g., consistently underestimating testing effort) that can be corrected in future estimates.

## Key Takeaway

The jira-estimator agent replaces gut-feel estimation with transparent, reasoned story point recommendations. By showing the work behind every number, it transforms estimation from a guessing exercise into a structured conversation about effort and complexity.

## Related Agents

- **[jira-evaluator](/reference/agents/jira-evaluator)** — provides complexity analysis that feeds into estimates
- **[jira-analyst](/reference/agents/jira-analyst)** — performs deep analysis with media support for complex tickets
- **[jira-agile](/reference/agents/jira-agile)** — sets story points on issues (the estimator only recommends)
