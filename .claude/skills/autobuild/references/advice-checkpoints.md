# `--advice` checkpoints — `mk:autobuild`

Skip this file unless the run was invoked with `--advice`. Without the flag there are
zero supervision calls, no state and no receipt, and nothing here loads.

On the first checkpoint of a run, read the supervision contract this skill's `SKILL.md`
names under `--advice`. This file implements it, and it holds the call protocol every
checkpoint follows.

## Contents

- [Checkpoints](#checkpoints)
- [What each checkpoint asks](#what-each-checkpoint-asks)
- [What supervision does NOT touch here](#what-supervision-does-not-touch-here)
- [Routing in this skill](#routing-in-this-skill)
- [Fallback](#fallback)

## Checkpoints

| Stage | Fires at | Condition | Max |
|---|---|---|---:|
| GUIDE | end of step-02, after the contract decision, **before** step-03 Generate | always, when the flag is on | 1 |
| RESCUE | step-05, on the loop path | plateau or scope drift — see below | 2 |
| REVIEW | step-05, after the terminal evaluator verdict, **before** the ship question | always, when the flag is on | 1 |
| RECHECK | after corrections from a `RETURN_TO_EXECUTOR` | only after a return | 1 |

Hard cap **5 calls per run**, charged as `--skill mk:autobuild`. Checkpoints are macro
boundaries — never per generated artifact, per file, or per evaluator iteration. A
five-round build makes the same number of calls as a one-round build.

GUIDE fires at the end of step-02 rather than after step-01 on purpose: the contract
decision is part of what it advises on, including a deliberate LEAN skip. Supervising
the plan before the contract is settled advises on half the setup.

### What counts as a plateau

RESCUE is not "the verdict was FAIL again". It fires when iterating is no longer
producing movement:

- two consecutive verdicts fail the **same** criteria with no measurable change in the
  evidence, or
- the build has drifted outside the signed contract's scope.

A first FAIL with concrete, actionable iteration feedback is the loop working. Calling
RESCUE there spends a slot on a step that was already going to succeed.

## What each checkpoint asks

- **GUIDE** — given this plan and contract, what should the generator optimize for and
  what evidence will the evaluator need?
- **RESCUE** — the loop has stopped moving; what changes, and what would show it worked?
- **REVIEW** — does the evaluator's evidence actually cover the contract, or does it go
  back?
- **RECHECK** — were the corrections addressed and proven?

## What supervision does NOT touch here

- **The iteration cap.** `--max-iter` (default 3) and its escalation fire on their own
  schedule. A rescue directive never buys another round and never delays the prompt.
- **The budget tracker.** A budget BLOCK halts the run immediately, supervised or not.
- **The run timeout.**
- **The ship question.** Athena's REVIEW is evidence presented alongside the evaluator
  verdict. Both are things the user reads; neither is the decision.
- **The evaluator's verdict** and its active-verification requirement. `evaluator` owns
  PASS/WARN/FAIL. Athena may find that evidence and verdict disagree and route work back;
  that is routing, not a verdict.

## Routing in this skill

The call protocol defines the dispositions; here is what each one means for this skill.

- `CONTINUE_WITH_DIRECTIVE` — proceed into step-03; the directive is input to the
  generator's brief, not a replacement for the signed contract.
- `READY_FOR_EXISTING_GATE` — ask the ship question at §5c as normal. It is **not** answered for the user.
- `RETURN_TO_EXECUTOR` — route corrections to the generator and re-enter step-03 with
  them in the feedback packet, then re-evaluate. The evaluator verdict that preceded the
  correction describes code that no longer exists, so it cannot be the one the user is
  shown — a fresh step-04 pass is required before §5c.
- `ESCALATE_TO_HUMAN` — stop at the existing human touchpoint (§5c or §5e).
- `BLOCKED_MISSING_EVIDENCE` — supply the named evidence or continue unsupervised.

A returned correction is **not** a free iteration: it consumes an `--max-iter` round like
any other loop back to step-03. Otherwise supervision would be a way around the cap.

A second unresolved return escalates to a human; there is no third opinion.

Record the checkpoint in the step's run-report section, next to the ship-decision line, so
the audit trail shows what was advised and what the user decided — in that order.

Serialized cap 12 KiB — pass pointers, never payloads. The plan, the signed contract,
the handoff and the verdict are all files: pass their paths. The generator and evaluator
subagents receive a task-specific directive only — never the flag, never the dossier,
never the run id.

Record `supervisionRunId` in the run report frontmatter next to `next_step`, for the
same reason `next_step` lives there: a resumed run that cannot find its run id would
start a fresh budget.

## Fallback

If the runtime cannot delegate to `athena`, print exactly

```
advice checkpoint unavailable in this runtime: <reason>
```

and continue unsupervised. Never write a packet inline and present it as the agent's —
a recommendation written by the agent that is stuck is not an independent check, and a
receipt produced that way records supervision that never happened.
