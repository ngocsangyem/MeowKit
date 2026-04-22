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
| `meow:cook`                    | After Gate 2 verdict PASS, before Phase 5 ship             | background  |
| `meow:harness`                 | Step 5 pre-escalation (before AskUserQuestion on iter cap) | **foreground** |
| `meow:harness`                 | Step 6 final run report                                    | background  |
| `meow:workflow-orchestrator`   | After each phase transition (post-SubagentStop)            | background  |
| `meow:fix`                     | Complex path only, after Phase 4 verdict                   | background  |
| `meow:worktree`                | After merge integration test passes                        | background  |

WHY: Without a single source of truth for fire points, each skill drifts
with its own delegation logic. Centralizing in a rule keeps behavior DRY
and auditable — fire-point changes happen in one file.

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
in the prompt so Claude Code spawns PM concurrently — the caller continues
to the next phase without blocking.

For `foreground` mode (harness step 5 only), OMIT the background directive
and wait for PM's result — user needs current delivery state before the
escalation prompt.

WHY: PM's frontmatter has no `background: true` flag (each invocation
decides). The prompt text is the dispatch signal. Inline delegation copies
drift; a fixed invocation pattern prevents subtle semantic differences.

## Rule 3: Skip Conditions

PM is NOT invoked when ANY of the following is true:

- `meow:fix` with `complexity=simple` (Gate 1 bypass path — no plan to track)
- `meow:harness` with `MEOWKIT_HARNESS_MODE=MINIMAL` (dead-weight thesis)
- Environment variable `MEOWKIT_PM_AUTO=off` (user opt-out; `/meow:status` still works)
- No active plan at `tasks/plans/` (nothing to track)

WHY: Delivery tracking has a cost. Skip paths prevent PM from firing when
the work has no plan to track, when the model is already self-managing,
or when the user explicitly opts out.

INSTEAD of: firing PM on every trivial fix or MINIMAL harness run
USE: the skip conditions above, audited once per skill citation

## Rule 4: Orchestrator Disambiguation

Per `CLAUDE.md` "Orchestrator Entry Point Rule", `meow:cook` and
`meow:workflow-orchestrator` are mutually exclusive per session.

- **Explicit `/meow:cook` invocation** → `meow:cook` delegates to PM per its row above. `meow:workflow-orchestrator` does NOT also delegate.
- **Session-start complex-feature intent (no explicit invocation)** → `meow:workflow-orchestrator` delegates per its row.
- **Never both in the same session.**

WHY: Double-firing PM on the same phase transition wastes haiku calls and
produces duplicate reports. The mutual-exclusion rule that governs the
orchestrators themselves extends to their PM delegation.

## Rule 5: Harness Foreground Exception

Step 5 pre-escalation is the ONLY foreground PM invocation.

Rationale: when `meow:harness` iteration cap is reached, the user is
about to decide ship vs abort via AskUserQuestion. Current delivery
state must surface BEFORE the question, not after.

All other fires are background — PM is a reporter, not a blocker.

WHY: Foreground PM during normal flow blocks the main agent for no
user-visible benefit. Only at iteration cap does the user actively wait
on the decision, justifying the block.

## Rule 6: Opt-Out Honored Everywhere

`MEOWKIT_PM_AUTO=off` disables ALL automatic fires across all skills.
Set in the shell environment; not agent-controlled.

User-invoked `/meow:status` is ALWAYS honored regardless of this env var.

WHY: Users who don't want silent PM chatter should have one knob to
disable it globally. A per-skill opt-out would drift and confuse.

INSTEAD of: per-skill toggles or skill-local env vars
USE: one env var gating all silent fires

## Rule 7: No Hook Dispatch

PM MUST NOT be invoked from hook handlers. Claude Code hooks cannot call
the Agent tool (verified via Anthropic docs).

INSTEAD of: SubagentStop hook firing PM → infinite-loop risk
USE: explicit delegation in the orchestration skill body per Rule 2

WHY: Hook-based dispatch would create a loop (PM's own SubagentStop would
re-fire the hook). Explicit skill-body delegation is both correct and
auditable.

## Applies To

- `meow:cook` (single-task pipeline)
- `meow:harness` (autonomous build pipeline, steps 5 + 6)
- `meow:workflow-orchestrator` (auto-invoked 7-phase)
- `meow:fix` (standard/complex paths only; simple path skipped)
- `meow:worktree` (after parallel merge integration test)
- Any future orchestration skill that drives the 7-phase flow

Skills NOT in this list do NOT delegate to PM. User-invoked `/meow:status`
is the only non-orchestration entry path.
