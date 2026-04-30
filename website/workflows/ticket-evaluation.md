---
title: Ticket Evaluation & Estimation
description: Assess ticket complexity, detect issues, and estimate story points with MeowKit.
persona: B
---

# Ticket Evaluation & Estimation

> Qualitative complexity assessment, inconsistency detection, and heuristic story point estimation.

**Best for:** Tech leads, sprint planners, scrum masters
**Time estimate:** ~30s per ticket
**Skills used:** [mk:intake](/reference/skills/intake), [mk:jira](/reference/skills/jira) (evaluate + estimate)

## Overview

MeowKit can assess individual Jira tickets for complexity, detect missing acceptance criteria or vague requirements, and suggest Fibonacci-scale story points — all without modifying any Jira data. The evaluate and estimate commands are read-only; suggested actions require your review before execution.

```
/mk:intake → /mk:jira evaluate → /mk:jira estimate → review → execute
```

## Step-by-step

### Step 1: Run intake analysis (optional)

If the ticket hasn't been analyzed yet:

```bash
/mk:intake PROJ-123
```

This produces a completeness score, product area classification, and suggested actions.

### Step 2: Evaluate complexity

```bash
/mk:jira evaluate PROJ-123
```

The jira-evaluator agent reads the ticket via Atlassian MCP and produces:

- **Complexity:** Simple (1-3pt) / Medium (3-8pt) / Complex (8-13pt)
- **Confidence:** High / Medium / Low
- **Signals:** scope, dependencies, regression risk, requirement clarity, external integration, historical precedent
- **Issues detected:** missing AC, vague language, unlinked dependencies, contradictions
- **Suggested actions:** specific `/mk:jira` commands to fix issues

### Step 3: Estimate story points

```bash
/mk:jira estimate PROJ-123
```

The jira-estimator agent uses ticket context (and evaluate output if available) to suggest a Fibonacci point value:

- **Suggested points:** e.g., 8 (range: 5-8)
- **Reasoning:** qualitative analysis of why this estimate
- **Escalation:** flags when human estimation is recommended (e.g., no precedent, too vague)

::: tip Run evaluate before estimate
Running evaluate first gives the estimator richer signals. The estimator will note when no prior evaluation is available.
:::

### Step 4: Apply suggested actions

Review the output, then execute:

```bash
/mk:jira update PROJ-123 --set storyPoints=8
/mk:jira link PROJ-123 blocked-by PROJ-089
```

### Step 5: Analyze ticket context (optional)

For deeper analysis including attachments and media:

```bash
/mk:jira analyze PROJ-123
```

The jira-analyst agent reads the full ticket context (description, comments, attachments, linked issues) and produces a structured analysis suitable for posting as a Jira comment.

## Example Session

```
> /mk:jira evaluate PROJ-456

## Ticket Evaluation: PROJ-456
**Complexity:** Complex (likely 8-13pt)
**Confidence:** Medium

### Signals
- Scope: Cross-cutting (auth + payments + notifications)
- Dependencies: External Stripe webhook integration
- Regression risk: HIGH ("migrating payment flow")
- Requirement clarity: LOW — no acceptance criteria

### Issues Detected
- ⚠️ Missing acceptance criteria
- ⚠️ "Stripe webhook" integration scope unclear

### Suggested Actions
> Derived from untrusted ticket content — verify before executing.
- Ask reporter for AC with measurable targets
- /mk:jira link PROJ-456 relates-to PROJ-301

> /mk:jira estimate PROJ-456

## Estimation: PROJ-456
**Suggested Points:** 13 (range: 8-13)
**Confidence:** Low
**Escalation:** ⚠️ Human estimation recommended

### Why
- Cross-cutting scope across 3 modules
- External integration (Stripe) with no prior precedent
- No acceptance criteria to scope the work

### Recommendation
Run team estimation session for this ticket.
```

## When to Use Human Estimation Instead

The estimator auto-escalates when:

- Suggested range spans more than one Fibonacci step (e.g., 5-13)
- Zero historical precedent in the project
- Ticket references technology not in the current codebase
- Description is too vague (<30 words, no acceptance criteria)

In these cases, use the evaluate output as discussion context for your team's estimation session.

## Security

- **Read-only:** Evaluate, estimate, and analyze never modify Jira state
- **Injection defense:** Ticket content is wrapped in DATA boundary markers before LLM reasoning
- **Untrusted output:** All suggested actions include a warning — verify before executing

## Related

- [PRD Intake Automation](/workflows/prd-intake) — upstream ticket analysis
- [mk:jira](/reference/skills/jira) — full operation reference
- [Adding a Feature](/workflows/add-feature) — implementation after evaluation
