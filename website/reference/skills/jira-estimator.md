---
title: "mk:jira-estimator"
description: "Read-only heuristic story-point estimation. Auto-consumes prior evaluator output."
---

# mk:jira-estimator

## What This Skill Does

Forks the `jira-estimator` agent to produce a **heuristic story-point estimation** (Fibonacci suggestion) for a single Jira ticket. Read-only — never mutates Jira. If a prior `mk:jira-evaluator` report exists at `tasks/reports/jira-evaluate-*-{KEY}.md`, the agent reads it and incorporates complexity signals.

## When to Use

- **Triggers:** "estimate PROJ-123", "story points for PROJ-123", "how complex is PROJ-123"
- **NOT for:** complexity-only analysis ([`mk:jira-evaluator`](/reference/skills/jira-evaluator)) · full RCA ([`mk:jira-analyst`](/reference/skills/jira-analyst)).

## Custom-Field Discovery (mandatory)

Before reading or writing story points, the agent verifies the per-instance ID:

```bash
bash $CLAUDE_PROJECT_DIR/.claude/skills/jira/scripts/jira-as.sh fields list --search "Story Points" \
  | jq '.[] | select(.name == "Story Points") | .id'
```

`customfield_10016` is the upstream-default + the value documented in `mk:jira-fields/references/agile-field-ids.md`, `mk:jira-agile/references/agile-field-reference.md`, and `mk:jira-admin/references/voodoo-constants.md`. If discovered ID differs, use the discovered value.

## Output (Normal)

```markdown
## Estimation: {ISSUE-KEY}

**Suggested Points:** {N} (range: {low-high})
**Confidence:** {High|Medium|Low}

### Reasoning
- {qualitative analysis}

### To apply:
bash $CLAUDE_PROJECT_DIR/.claude/skills/jira/scripts/jira-as.sh issue update {ISSUE-KEY} \
  --custom-fields '{"customfield_10016": {N}}'
```

## Escalation Triggers

The agent auto-flags for human estimation when:

- Suggested range spans >1 Fibonacci step
- Zero historical precedent in project
- Ticket references unfamiliar technology
- Description too vague (<30 words, no AC)

## Report Persistence

Writes to `tasks/reports/jira-estimate-{YYMMDD}-{HHMM}-{ISSUE-KEY}.md`. Consumed by `mk:planning-engine` (capacity) and `mk:cook` plan-creation step.

## Shared References

- `references/estimation-guide.md` (in `mk:jira/references/`)
- `mk:jira-time/references/estimation-guide.md` (story-point vs hours-based tradeoffs)

## Peer Skills

`mk:jira-evaluator` (run first for complexity signals) · `mk:jira-analyst` (full ticket synthesis) · `mk:jira-issue` (writes the estimate via `update --custom-fields`) · `mk:jira-fields` (instance discovery) · `mk:planning-engine` (capacity analysis).

## Agent

[`jira-estimator`](/reference/agents/jira-estimator) — A + C (FS write only — NEVER Jira state), NOT B.
