---
name: "mk-jira-estimator"
description: "Heuristic read-only story-point estimation for one Jira ticket via jira-estimator agent. NOT complexity analysis (mk:jira-evaluator) or full RCA (mk:jira-analyst)."
---

# mk:jira-estimator

Forks to the `jira-estimator` agent. Read-only heuristic estimation. If a prior `mk:jira-evaluator` report exists at `tasks/reports/jira-evaluate-*-{KEY}.md`, the agent reads it and incorporates the complexity signals.

## Triggers

- "estimate PROJ-123"
- "story points for PROJ-123"
- "how complex is PROJ-123 in points?"

## Examples

- Cold estimate: "estimate PROJ-456 — give me a Fibonacci range and reasoning."
- Post-evaluate: "I just evaluated PROJ-456; now estimate it."

## See also

- Agent: `../../agents/jira-estimator.md`
- Shared: `../jira/references/{install-and-auth,cli-idioms,safety-framework,estimation-guide}.md`
- Domain refs (cross-link, lives under jira-time):
  - `../jira-time/references/estimation-guide.md` — story-point vs hours-based estimation tradeoffs
- Peer intelligence: `mk:jira-evaluator` (run first for complexity signals), `mk:jira-analyst` (full ticket synthesis)
- Peer execution: `mk:jira-issue` (`update --custom-fields '{"customfield_10016": N}'` writes the estimate), `mk:jira-fields` (discover instance-specific story-points field ID), `mk:planning-engine` (capacity analysis)

## Gotchas

- (none yet)