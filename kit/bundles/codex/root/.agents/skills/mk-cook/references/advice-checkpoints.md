# `--advice` checkpoints — `mk-cook`

Skip this file unless the run was invoked with `--advice`. Without the flag there are
zero supervision calls, no state and no receipt, and nothing here loads.

On the first checkpoint of a run, read `.agents/skills/rule-advice-supervision/SKILL.md` — it is the contract this file
implements, and it holds the call protocol every checkpoint follows.

## Checkpoints

| Stage | Fires at | Condition | Max |
|---|---|---|---:|
| GUIDE | after the plan is agreed, before Phase 3 Build | always, when the flag is on | 1 |
| RESCUE | Phase 3 | repeated failure, a `BLOCKED` subagent, or a high-risk / irreversible decision | 2 |
| REVIEW | after Phase 3.5 Simplify + 3.6 Verify, **before** the Phase 4 reviewer | always, when the flag is on | 1 |
| RECHECK | after corrections from a `RETURN_TO_EXECUTOR` | only after a return | 1 |

Hard cap **5 calls per run**, charged as `--skill mk-cook`. Checkpoints are macro
boundaries — never per tool call, per file, or per build-test-fix loop iteration.

GUIDE fires after the plan is settled on purpose: supervision reads a finished plan, it
does not help write one.

## What each checkpoint asks

- **GUIDE** — given this agreed plan, what decides the build order and what proof will
  matter at review?
- **RESCUE** — this keeps failing on this evidence; what does the evidence support, and
  what would disconfirm the current approach?
- **REVIEW** — does the verified work actually cover the plan's acceptance criteria, or
  does it go back?
- **RECHECK** — were the corrections addressed and proven?

## What supervision does NOT touch here

- **The plan and the review verdict.** The plan is agreed with the user; the verdict is the
  reviewer's. A directive is input to both, never a substitute for either.
- **The reviewer's verdict.** `reviewer` owns Phase 4. Athena may find that the evidence
  and the verdict disagree and route work back; that is routing, not a verdict.
- **Verification.** Phase 3.6 Verify and the review verdict are the proof. Supervision
  never counts toward either.

## Fallback

If the runtime cannot delegate to `athena`, print exactly

```
advice checkpoint unavailable in this runtime: <reason>
```

and continue unsupervised. Never write a packet inline and present it as the agent's —
a recommendation written by the agent that is stuck is not an independent check, and a
receipt produced that way records supervision that never happened.
