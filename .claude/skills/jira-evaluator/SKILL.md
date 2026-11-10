---
name: mk:jira-evaluator
description: 'mk:jira leaf. Score one ticket for complexity and inconsistencies, read-only. NOT for mk:jira-estimator.'
phase: on-demand
source: local
keywords:
  - jira
  - jira-evaluator
  - ticket-evaluation
  - complexity-analysis
  - ticket-quality
when_to_use: 'Ask how complex or how self-contradictory a single Jira ticket is.'
user-invocable: true
context: fork
agent: jira-evaluator
owner: jira
criticality: medium
status: active
runtime: claude-code
requires_external_service: ["jira"]
default_enabled: false
---

# mk:jira-evaluator

Forks to the `jira-evaluator` agent. Read-only ticket evaluation.

## Triggers

- "evaluate PROJ-123"
- "analyze ticket complexity for KEY"
- "check ticket quality"

## Examples

- Single-ticket complexity: "evaluate PROJ-456 — give me Fibonacci range + inconsistencies."
- Pre-estimation: "evaluate PROJ-789 first; I'll estimate after."

## See also

- Agent: `../../agents/jira-evaluator.md`
- Shared: `../jira/references/{install-and-auth,cli-idioms,safety-framework,evaluation-rubric}.md`
- Peer intelligence: `mk:jira-estimator` (point estimate — consumes evaluator output), `mk:jira-analyst` (full RCA — consumes evaluator complexity signals when present)
- Peer execution: `mk:jira-issue` (read the ticket), `mk:jira-search` (historical comparison via JQL), `mk:planning-engine` (tech review consumes evaluator output)

## Gotchas

- (none yet)
