# `--advice` checkpoints — `mk-cook`

Skip this file unless the run was invoked with `--advice`. Without the flag there are
zero supervision calls, no state and no receipt, and nothing here loads.

On the first checkpoint of a run, read `.cursor/rules/domain-advice-supervision.mdc` — it is the contract this file
implements, and it holds the call protocol every checkpoint follows.

## Checkpoints

| Stage | Fires at | Condition | Max |
|---|---|---|---:|
| GUIDE | after Gate 1, before Phase 3 Build | always, when the flag is on | 1 |
| RESCUE | Phase 3 | repeated failure, a `BLOCKED` subagent, or a high-risk / irreversible decision | 2 |
| REVIEW | after Phase 3.5 Simplify + 3.6 Verify, **before** the Phase 4 reviewer | always, when the flag is on | 1 |
| RECHECK | after corrections from a `RETURN_TO_EXECUTOR` | only after a return | 1 |

Hard cap **5 calls per run**, charged as `--skill mk-cook`. Checkpoints are macro
boundaries — never per tool call, per file, or per build-test-fix loop iteration.

GUIDE fires AFTER Gate 1 on purpose: supervision reads an approved plan, it does not
help produce the approval.

## What each checkpoint asks

- **GUIDE** — given this approved plan, what decides the build order and what proof will
  matter at review?
- **RESCUE** — this keeps failing on this evidence; what does the evidence support, and
  what would disconfirm the current approach?
- **REVIEW** — does the verified work actually cover the plan's acceptance criteria, or
  does it go back?
- **RECHECK** — were the corrections addressed and proven?

## What supervision does NOT touch here

- **Gate 1 and Gate 2.** Both stay human. A directive is evidence read at the gate, never
  the approval.
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
