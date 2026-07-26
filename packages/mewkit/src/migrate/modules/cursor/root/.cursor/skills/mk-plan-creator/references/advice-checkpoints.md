# `--advice` checkpoints — `mk-plan-creator`

Skip this file unless the run was invoked with `--advice`. Without the flag there are
zero supervision calls, no state and no receipt, and nothing here loads.

On the first checkpoint of a run, read `.cursor/rules/domain-advice-supervision.mdc` — it is the contract this file
implements, and it holds the call protocol every checkpoint follows.

## Checkpoints

| Stage | Fires at | Condition | Max |
|---|---|---|---:|
| GUIDE | end of `step-00-scope-challenge`, **before** `step-01-research` | always, when the flag is on | 1 |
| RESCUE | `step-05-red-team` | the red team leaves a contradiction the plan does not resolve, or research produced two incompatible directions | 2 |
| REVIEW | after `step-06-validation-interview`, **before** `step-07-gate` | always, when the flag is on | 1 |
| RECHECK | after corrections from a `RETURN_TO_EXECUTOR` | only after a return | 1 |

Hard cap **4 calls per run**, charged as `--skill mk-plan-creator`. Checkpoints are
macro boundaries — never per step, per phase file, or per red-team finding.

GUIDE fires after the scope challenge because that is where the scope stops moving;
supervising a scope still being negotiated advises on a plan that will not exist. REVIEW
fires before the gate step, never inside it.

## What each checkpoint asks

- **GUIDE** — given this settled scope, what must the research and the phase breakdown
  actually resolve?
- **RESCUE** — the red team left a contradiction; which direction does the evidence
  support?
- **REVIEW** — does this plan's evidence cover its own acceptance criteria before it
  reaches the gate?
- **RECHECK** — were the corrections addressed?

## What supervision does NOT touch here

- **The plan itself.** Athena writes no plan file and edits no phase file. It reads and
  may return the plan to the planner.
- **Gate 1.** It stays human. A REVIEW directive is evidence presented at the gate.
- **A scope correction** invalidates Gate 1 and requires a new human approval; an
  in-scope correction keeps it and invalidates downstream evidence.

## Fallback

If the runtime cannot delegate to `athena`, print exactly

```
advice checkpoint unavailable in this runtime: <reason>
```

and continue unsupervised. Never write a packet inline and present it as the agent's —
a recommendation written by the agent that is stuck is not an independent check, and a
receipt produced that way records supervision that never happened.
