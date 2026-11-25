---
name: mk:jira-estimator
description: "mk:jira leaf: points for one ticket. NOT for mk:story-sizer."
phase: on-demand
source: local
keywords:
  - jira
  - jira-estimator
  - story-points
  - fibonacci-estimation
  - ticket-estimation
when_to_use: "Points on a ticket."
user-invocable: true
context: fork
agent: jira-estimator
owner: jira
criticality: medium
status: active
runtime: claude-code
requires_external_service: ["jira"]
default_enabled: false
---

# mk:jira-estimator

Forks to the `jira-estimator` agent. Read-only heuristic estimation. If a prior `mk:jira-evaluator` report exists at `tasks/reports/jira-evaluate-*-{KEY}.md`, the agent reads it and incorporates the complexity signals. Write an estimate report only when the user asks for one or a planning run will consume it; otherwise answer inline.

## Triggers

- "estimate PROJ-123"
- "story points for PROJ-123"
- "how complex is PROJ-123 in points?"

## Examples

- Cold estimate: "estimate PROJ-456 — give me a Fibonacci range and reasoning."
- Post-evaluate: "I just evaluated PROJ-456; now estimate it."

## See also

- Agent: `../../agents/jira-estimator.md`
- Shared: `../jira/references/{install-and-auth,cli-idioms,safety-framework}.md`
- Guide: heuristic signals and escalation triggers are in `../jira/references/estimation-guide.md` (the only estimation guide for story points)
- Peer intelligence: `mk:jira-evaluator` (run first for complexity signals), `mk:jira-analyst` (full ticket synthesis)
- Peer execution: `mk:jira-issue` writes the estimate to the story-points field that `mk:jira-fields` discovers, `mk:planning-engine` (capacity analysis)
