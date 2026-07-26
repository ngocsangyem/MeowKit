# `--advice` checkpoints — `mk-brainstorming`

Skip this file unless the run was invoked with `--advice`. Without the flag there are
zero supervision calls, no state and no receipt, and nothing here loads.

On the first checkpoint of a run, read `.agents/skills/rule-advice-supervision/SKILL.md` — it is the contract this file
implements, and it holds the call protocol every checkpoint follows.

## Checkpoints

| Stage | Fires at | Condition | Max |
|---|---|---|---:|
| GUIDE | after step 1's decision / constraint / success-criterion frame, **before** generating approaches | always, when the flag is on | 1 |
| RESCUE | during generation or the challenge pass | the evidence and the stated constraints contradict each other, or the option set collapses to one viable path for a reason nobody stated | 2 |
| REVIEW | after the challenge pass, **before** presenting the recommendation to the user | always, when the flag is on | 1 |
| RECHECK | after corrections from a `RETURN_TO_EXECUTOR` | only after a return | 1 |

Hard cap **4 calls per run**, charged as `--skill mk-brainstorming`. Checkpoints are
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
- **The user's decision.** This skill adds no gate, and supervision creates none.

## Fallback

If the runtime cannot delegate to `athena`, print exactly

```
advice checkpoint unavailable in this runtime: <reason>
```

and continue unsupervised. Never write a packet inline and present it as the agent's —
a recommendation written by the agent that is stuck is not an independent check, and a
receipt produced that way records supervision that never happened.
