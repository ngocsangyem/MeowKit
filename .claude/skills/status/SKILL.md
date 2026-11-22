---
name: mk:status
description: "Evidence-based status of the active plan. NOT for mk:help."
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
when_to_use: "Asked where we are."
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
- **2+ results** → ask the user, header "Active plan", question "Which plan should
  I report on?", one option per plan labelled with its title and created date. Never pick the
  most recent one silently — an unrelated plan's report reads as this plan's status.

## 2. Once the plan is resolved, delegate to the project-manager agent

Invoke `project-manager` with the resolved plan directory:

```
Generate delivery status for plan at <plan-dir>.
Take task counts from `mewkit plan status <plan-dir>`, not from counting checkboxes by hand.
Write report to <plan-dir>/status-reports/{YYMMDD}-status.md
(create the status-reports/ subdir if absent).
Load template from ${CLAUDE_SKILL_DIR}/assets/pm-status-template.md.
Return the report path and the headline.
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

Status is a report, never an approval. A green headline approves nothing.

## Gotchas

- Two or more active plans: ask which one; an unrelated plan's report reads as this plan's status.
- The report is written into the plan directory (`status-reports/`), not the working directory, and archiving the plan archives its reports.
- `{YYMMDD}-status.md` means a same-day re-run overwrites; earlier days accumulate in `status-reports/`.
- The `project-manager` agent runs in the foreground here; a user who wants it in the background asks that agent directly.
- No `mewkit` on the PATH: the agent reads the plan files for counts and says the counts are hand-derived.

## Related

- Agent: `.claude/agents/project-manager.md`
- Template: `assets/pm-status-template.md`
- Background auto-fire policy: `.claude/skills/cook/references/post-phase-delegation.md`
- Forward-looking alternative: `mk:help`
