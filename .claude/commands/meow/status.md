# /meow:status — Delivery Status Report

## Usage

```
/meow:status
/meow:status <plan-dir>
/meow:status <plan-slug>
```

## Behavior

Generates a classified, evidence-based delivery status report for the active plan via the `project-manager` agent. Report is co-located inside the plan dir at `{plan-dir}/status-reports/{YYMMDD}-status.md`.

This is the **foreground** entry point for the project-manager agent. Use it when the agent's background auto-invocation (via `post-phase-delegation.md` rule) is not applicable — e.g., when asking on demand or when disambiguation between multiple active plans is needed.

**For "what should I do next" advice, use `/meow:help` instead.** PM is backward-looking ("what's done, what's blocked"); `meow:help` is forward-looking.

### Execution Steps

#### 1. Resolve the plan

- If an argument is given → treat as `{plan-dir}` or `{plan-slug}`:
  - If it's an absolute or relative path to a plan dir → use directly
  - If it's a slug → resolve via `ls -d tasks/plans/*{slug}*`
  - If not found → print "Plan not found: {arg}. Use tasks/plans/<date-slug>/ form." → exit
- If no argument → Glob `tasks/plans/*/plan.md` filtered by frontmatter `status` not in `{completed, cancelled, archived}`:
  - **0 results** → print "No active plan. Run `/meow:plan` to create one." → exit (no file written)
  - **1 result** → use it
  - **2+ results** → prompt via `AskUserQuestion`:
    - header: "Active plan"
    - question: "Which plan should I report on?"
    - options: one per plan (label = title + created date from frontmatter)

#### 2. Delegate to project-manager

Invoke the `project-manager` agent with the resolved plan dir:

```
@project-manager Generate delivery status for plan at <plan-dir>.
Write report to <plan-dir>/status-reports/{YYMMDD}-status.md
(create the status-reports/ subdir if absent).
Load template from tasks/templates/pm-status-template.md.
```

**Foreground invocation** — do NOT include "run in the background" in the prompt. The command must wait for PM to return the report path before step 3.

PM reads prior reports (if any) to compute delta, aggregates plan + verdicts + cost-log + git log, fills the template, and writes the report.

#### 3. Print the report path

Print the absolute path of the generated report. The user can open it directly.

Example:
```
✓ Status report written:
  /path/to/repo/tasks/plans/260422-auth/status-reports/260422-status.md

  Headline: 4 of 7 tasks done, 2 blocked — at-risk
```

## Skip Conditions

`/meow:status` runs regardless of `MEOWKIT_PM_AUTO` — the env var only gates silent background fires per `post-phase-delegation.md`. User-invoked requests are always honored.

## Notes

- PM has NO `background: true` in frontmatter. `/meow:status` invokes foreground (default Claude Code behavior when the prompt doesn't explicitly say "run in the background"). The command waits for the report path before printing. If the user wants truly async behavior, invoke natural-language `@project-manager ... run in the background`.
- Report naming `{YYMMDD}-status.md` — same-day rerun overwrites (idempotent); multi-day history accumulates in the plan's `status-reports/` subdir.
- Reports travel with the plan — when a plan is archived, its reports archive with it.

## Related

- Agent: `.claude/agents/project-manager.md`
- Template: `tasks/templates/pm-status-template.md`
- Rule: `.claude/rules/post-phase-delegation.md` (background auto-fire policy)
- Alternative (forward-looking): `/meow:help`
