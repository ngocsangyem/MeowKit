# Post-Phase Delegation Rules

After completing a workflow phase, orchestration skills delegate to the
`project-manager` agent for delivery-status reporting. This rule defines
fire points, skip conditions, and invocation form.

[CONTEXTUAL] — applies only when an orchestration skill is active.

## Rule 1: Orchestration Skills MUST Delegate Post-Phase

The following skills MUST delegate to `project-manager` at the fire points
listed below. Delegation is via natural language in the skill body —
hooks cannot invoke the Agent tool (verified).

| Skill                          | Fire point                                                 | Mode        |
| ------------------------------ | ---------------------------------------------------------- | ----------- |
| `mk:cook`                    | After Gate 2 verdict PASS, before Phase 5 ship             | background  |
| `mk:autobuild`                 | Step 5 pre-escalation (before AskUserQuestion on iter cap) | **foreground** |
| `mk:autobuild`                 | Step 6 final run report                                    | background  |
| `mk:workflow-orchestrator`   | After each phase transition (post-SubagentStop)            | background  |
| `mk:fix`                     | Complex path only, after Phase 4 verdict                   | background  |
| `mk:worktree`                | After merge integration test passes                        | background  |

WHY: Centralized fire points keep delegation DRY and auditable.

## Rule 2: Invocation Form

Use this exact delegation pattern:

```
After {phase-label} completes, delegate to the project-manager agent:
"Generate delivery status for plan at {plan-dir}. Write report to
{plan-dir}/status-reports/{YYMMDD}-status.md (create subdir if absent).
Load template from tasks/templates/pm-status-template.md.
Run in the background — do not block the caller."
```

For `background` mode (default), explicitly include `Run in the background`
in the prompt so the host runtime spawns PM concurrently — the caller continues
to the next phase without blocking.

For `foreground` mode (harness step 5 only), OMIT the background directive
and wait for PM's result — user needs current delivery state before the
escalation prompt.

WHY: Prompt text is the dispatch signal; one pattern prevents drift.

## Rule 3: Skip Conditions

PM is NOT invoked when ANY of the following is true:

- `mk:fix` with `complexity=simple` (Gate 1 bypass path — no plan to track)
- `mk:autobuild` with `MEOWKIT_AUTOBUILD_MODE=MINIMAL` (dead-weight thesis)
- Environment variable `MEOWKIT_PM_AUTO=off` (user opt-out; `/mk:status` still works)
- No active plan at `tasks/plans/` (nothing to track)
- Docs-only or rule-only updates with no active implementation plan; report docs impact directly instead

WHY: Skip paths avoid delivery tracking when there is no useful plan/report surface.

## Rule 4: Orchestrator Disambiguation

Per `.claude/rules/orchestration-rules.md`, `mk:cook` and `mk:workflow-orchestrator` are mutually exclusive per session. Refer to that rule for the full disambiguation logic.

WHY: Orchestrator mutual exclusion also prevents duplicate PM reports.

## Rule 5: Harness Foreground Exception

Step 5 pre-escalation is the ONLY foreground PM invocation.

Rationale: when `mk:autobuild` iteration cap is reached, the user is
about to decide ship vs abort via AskUserQuestion. Current delivery
state must surface BEFORE the question, not after.

All other fires are background — PM is a reporter, not a blocker.

WHY: Foreground PM is only useful when the user is actively deciding ship vs abort.

## Rule 6: Opt-Out Honored Everywhere

`MEOWKIT_PM_AUTO=off` disables ALL automatic fires across all skills.
Set in the shell environment; not agent-controlled.

User-invoked `/mk:status` is ALWAYS honored regardless of this env var.

WHY: One global knob prevents per-skill opt-out drift.

## Rule 7: No Hook Dispatch

PM MUST NOT be invoked from hook handlers. On Claude Code, hooks cannot call
the Agent tool (verified via runtime documentation).

WHY: Hook-based dispatch would loop on PM's own SubagentStop; explicit delegation is auditable.

## Applies To

- `mk:cook` (single-task pipeline)
- `mk:autobuild` (autonomous build pipeline, steps 5 + 6)
- `mk:workflow-orchestrator` (auto-invoked 7-phase)
- `mk:fix` (standard/complex paths only; simple path skipped)
- `mk:worktree` (after parallel merge integration test)
- Any future orchestration skill that drives the 7-phase flow

Skills NOT in this list do NOT delegate to PM. User-invoked `/mk:status`
is the only non-orchestration entry path.
