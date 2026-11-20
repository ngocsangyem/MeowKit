# `--advice` checkpoints — `mk:brainstorming`

Skip this file unless the run was invoked with `--advice`. Without the flag there are
zero supervision calls, no state and no receipt, and nothing here loads.

On the first checkpoint of a run, read the supervision contract this skill's `SKILL.md`
names under `--advice`. This file implements it, and it holds the call protocol every
checkpoint follows.

## Checkpoints

| Stage | Fires at | Condition | Max |
|---|---|---|---:|
| GUIDE | after step 1's decision / constraint / success-criterion frame, **before** generating approaches | always, when the flag is on | 1 |
| RESCUE | during generation or the challenge pass | the evidence and the stated constraints contradict each other, or the option set collapses to one viable path for a reason nobody stated | 2 |
| REVIEW | after the challenge pass, **before** presenting the recommendation to the user | always, when the flag is on | 1 |
| RECHECK | after corrections from a `RETURN_TO_EXECUTOR` | only after a return | 1 |

Hard cap **4 calls per run**, charged as `--skill mk:brainstorming`. Checkpoints are
macro boundaries — never per option, per technique, or per scoring pass.

**Deep workflow only.** The quick profile answers inline in three steps and creates no
scout, report, plan or memory entry; supervising that is noise rather than safety.

GUIDE fires **after** the frame and **before** generation on purpose: it supplies the
decision criteria and risk lens the generation should span, which is worthless once the
options already exist.

## What each checkpoint asks

- **GUIDE** — what criteria and risk lens should the option set span, and what would make
  an option disqualifying?
- **RESCUE** — the constraints and the evidence disagree; which one is wrong?
- **REVIEW** — does the recommended direction survive its own challenge pass, or does it
  go back?
- **RECHECK** — were the corrections addressed?

## What supervision does NOT touch here

- **The option set.** Athena never generates approaches, scores them, or chooses for the
  user. It supplies criteria and reads the result.
- **The user's decision.** This skill adds no approval step, and supervision creates none.

## Routing in this skill

The call protocol defines the dispositions; here is what each one means for this skill.

- `CONTINUE_WITH_DIRECTIVE` — proceed; the directive is input to the generation, not a
  replacement for it.
- `READY_FOR_EXISTING_GATE` — present the recommendation to the user as normal. There
  is no approval step here to clear, and this does not become one.
- `RETURN_TO_EXECUTOR` — this skill addresses each correction (usually a missing
  option, an unexamined constraint, or a trade-off asserted without evidence) or
  records why it is rejected, then RECHECK once.
- `ESCALATE_TO_HUMAN` — stop and put the decision to the user.
- `BLOCKED_MISSING_EVIDENCE` — supply the named evidence or continue unsupervised.

A second unresolved return escalates to a human; there is no third opinion.

`--advice` applies to the **deep** workflow. The quick profile restates the decision,
gives 2-4 options and returns inline — it creates no scout, report, plan, or memory
entry, and supervising three inline steps is noise rather than safety. Passing
`--advice` with `--depth quick` prints one line and continues unsupervised:

```
advice: --advice applies to deep runs; continuing unsupervised
```

## Fallback

If the runtime cannot delegate to `athena`, print exactly

```
advice checkpoint unavailable in this runtime: <reason>
```

and continue unsupervised. Never write a packet inline and present it as the agent's —
a recommendation written by the agent that is stuck is not an independent check, and a
receipt produced that way records supervision that never happened.
