# `--advice` checkpoints — `mk:plan-creator`

Skip this file unless the run was invoked with `--advice`. Without the flag there are
zero supervision calls, no state and no receipt, and nothing here loads.

On the first checkpoint of a run, read the supervision contract this skill's `SKILL.md`
names under `--advice`. This file implements it, and it holds the call protocol every
checkpoint follows.

## Checkpoints

| Stage | Fires at | Condition | Max |
|---|---|---|---:|
| GUIDE | end of `step-00-scope-challenge`, **before** `step-01-research` | always, when the flag is on | 1 |
| RESCUE | `step-05-red-team` | the red team leaves a contradiction the plan does not resolve, or research produced two incompatible directions | 2 |
| REVIEW | after `step-06-validation-interview`, **before** `step-07-gate` | always, when the flag is on | 1 |
| RECHECK | after corrections from a `RETURN_TO_EXECUTOR` | only after a return | 1 |

Hard cap **4 calls per run**, charged as `--skill mk:plan-creator`. Checkpoints are
macro boundaries — never per step, per phase file, or per red-team finding.

GUIDE fires after the scope challenge because that is where the scope stops moving;
supervising a scope still being negotiated advises on a plan that will not exist. REVIEW
fires before the plan is agreed, never inside that step.

## What each checkpoint asks

- **GUIDE** — given this settled scope, what must the research and the phase breakdown
  actually resolve?
- **RESCUE** — the red team left a contradiction; which direction does the evidence
  support?
- **REVIEW** — does this plan's evidence cover its own acceptance criteria before it
  reaches the user?
- **RECHECK** — were the corrections addressed?

## What supervision does NOT touch here

- **The plan itself.** Athena writes no plan file and edits no phase file. It reads and
  may return the plan to the planner.
- **The conversation with the user.** It stays the user's. A REVIEW directive is input to
  it, never a substitute for it.
- **A scope correction** means the plan the user saw no longer describes the work: present
  it again. An in-scope correction keeps it and invalidates downstream evidence.

## Routing in this skill

The call protocol defines the dispositions; here is what each one means for this skill.

- `CONTINUE_WITH_DIRECTIVE` — continue the step sequence; the directive is input to
  planning, not a replacement for a step.
- `READY_FOR_EXISTING_GATE` — run `step-07-gate` as normal. The user's answer is still owed.
- `RETURN_TO_EXECUTOR` — the planner applies each correction or records why it is
  rejected, the normal semantic and validation checks re-run, then RECHECK once.
- `ESCALATE_TO_HUMAN` — stop and ask the user.
- `BLOCKED_MISSING_EVIDENCE` — supply the named evidence or continue unsupervised.

A second unresolved return escalates to a human; there is no third opinion.

Only `supervisionRunId` crosses an approved handoff to a following skill. Spawned
workers (researcher, red-team) receive a task-specific directive — never the flag,
never the dossier.

Serialized cap 12 KiB — pass the plan path and the red-team report as pointers, never
the plan body.

`step-07-gate` is unchanged: the user reads the plan and says whether it is right. A
`READY_FOR_EXISTING_GATE` disposition means "the plan is in a state where presenting it
is the correct next step" — nothing more. Skipping the presentation, or citing Athena's
directive instead of the user's answer, replaces the one judgement the step exists for.

## Fallback

If the runtime cannot delegate to `athena`, print exactly

```
advice checkpoint unavailable in this runtime: <reason>
```

and continue unsupervised. Never write a packet inline and present it as the agent's —
a recommendation written by the agent that is stuck is not an independent check, and a
receipt produced that way records supervision that never happened.
