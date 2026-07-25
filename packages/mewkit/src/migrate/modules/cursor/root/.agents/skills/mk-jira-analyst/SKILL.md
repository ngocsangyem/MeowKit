---
name: "mk-jira-analyst"
description: "Read-only full Jira ticket analysis incl. media + linked issues via jira-analyst agent; produces comment-ready findings. NOT complexity scoring (mk:jira-evaluator) or estimation (mk:jira-estimator)."
---

# mk:jira-analyst

Forks to the `jira-analyst` agent. Read-only. The agent has Write tool privilege ONLY for persisting the report to `tasks/reports/jira-analyze-*.md` — it never writes to Jira itself.

## Triggers

- "analyze PROJ-123"
- "rca for PROJ-123"
- "describe PROJ-123 including the screenshots"

## Examples

- Standalone: "analyze PROJ-456 — what is this ticket about?"
- With investigation: "I investigated and found <findings>; now analyze PROJ-456 with full RCA"
- Media-heavy: "PROJ-789 has 3 screenshots — analyze them and synthesize"

## See also

- Agent: `../../agents/jira-analyst.md`
- Shared: `../jira/references/{install-and-auth,cli-idioms,safety-framework}.md`
- Peer intelligence: `mk:jira-evaluator` (complexity signals), `mk:jira-estimator` (point estimate)
- Peer execution: `mk:jira-issue` (read ticket fields incl. attachments), `mk:jira-collaborate` (post analysis as comment — see `mk:jira-collaborate/references/comment-templates.md`)
- Output: report at `tasks/reports/jira-analyze-*.md` consumable by `mk:planning-engine` and downstream skills.

## Gotchas

- (none yet)