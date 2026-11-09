---
name: mk:status
description: Backward-looking delivery status for the active plan — resolves which plan is meant, then has the project-manager agent write an evidence-based status report into the plan directory. Use when asked "where are we", "what is done", "what is blocked", or for a stakeholder update. NOT for "what should I do next" advice (see mk:help); NOT for sprint capacity or ticket planning (see mk:planning-engine).
argument-hint: '[plan-dir | plan-slug]'
source: local
trust_level: kit-authored
injection_risk: low
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - AskUserQuestion
keywords:
  - delivery-status
  - progress-report
  - plan-status
  - blocked-items
  - stakeholder-update
when_to_use: Use when the user wants to know what is done, what is blocked and what changed since the last report for an active plan. Produces a dated report inside the plan directory.
user-invocable: true
owner: lifecycle
criticality: medium
status: active
runtime: claude-code
---

# Delivery status report

Produces a classified, evidence-based delivery status report for the active plan, written by the
`project-manager` agent into `{plan-dir}/status-reports/{YYMMDD}-status.md`.

This is the **foreground** entry point for that agent. Use it when the background auto-fire
policy in `.claude/skills/cook/references/post-phase-delegation.md` does not apply — an on-demand
question, or a session with more than one active plan to disambiguate.

This skill is backward-looking: what is done, what is blocked. For "what should I do next", use
`mk:help`.

## Usage

```
mk:status
mk:status <plan-dir>
mk:status <plan-slug>
```

## 1. Resolve the plan

With an argument:

- an absolute or relative path to a plan directory → use it directly
- a slug → resolve with `ls -d tasks/plans/*{slug}*`
- no match → print `Plan not found: {arg}. Use tasks/plans/<date-slug>/ form.` and stop

With no argument, glob `tasks/plans/*/plan.md` and keep the plans whose frontmatter `status` is
not `completed`, `cancelled` or `archived`:

- **0 results** → print `No active plan. Run mk:plan-creator to create one.` and stop. Write no
  file: a status report about no plan is a file that says nothing.
- **1 result** → use it.
- **2+ results** → ask with `AskUserQuestion`, header "Active plan", question "Which plan should
  I report on?", one option per plan labelled with its title and created date. Never pick the
  most recent one silently — an unrelated plan's report reads as this plan's status.

## 2. Delegate to the project-manager agent

Invoke `project-manager` with the resolved plan directory:

```
Generate delivery status for plan at <plan-dir>.
Write report to <plan-dir>/status-reports/{YYMMDD}-status.md
(create the status-reports/ subdir if absent).
Load template from .claude/skills/status/assets/pm-status-template.md.
```

**Foreground invocation** — do not include "run in the background" in the prompt. The run waits
for the agent to return the report path before step 3.

The agent reads prior reports when they exist to compute the delta, aggregates the plan, the
verdicts, the cost log and the git log, fills the template, and writes the report.

## 3. Print the report path

Print the absolute path, plus the report's headline so the user does not have to open the file
to learn the answer:

```
✓ Status report written:
  /path/to/repo/tasks/plans/260422-auth/status-reports/260422-status.md

  Headline: 4 of 7 tasks done, 2 blocked — at-risk
```

## Skip conditions

A user-invoked status run is always honored. The `MEOWKIT_PM_AUTO` environment variable gates
only the silent background fires described in
`.claude/skills/cook/references/post-phase-delegation.md`; it never suppresses an explicit ask.

## Notes

- The `project-manager` agent declares no background mode, so this runs in the foreground by
  default and waits for the report path. A user who wants genuinely asynchronous behavior asks
  that agent directly and says to run in the background.
- `{YYMMDD}-status.md` means a same-day re-run overwrites (idempotent) while multi-day history
  accumulates in the plan's `status-reports/` directory.
- Reports travel with the plan: archiving a plan archives its reports.
- Status is a report, never an approval. A green headline clears no gate.

## Related

- Agent: `.claude/agents/project-manager.md`
- Template: `.claude/skills/status/assets/pm-status-template.md`
- Background auto-fire policy: `.claude/skills/cook/references/post-phase-delegation.md`
- Forward-looking alternative: `mk:help`
