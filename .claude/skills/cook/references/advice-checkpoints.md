# `--advice` checkpoints — `mk:cook`

Skip this file unless the run was invoked with `--advice`. Without the flag there are
zero supervision calls, no state and no receipt, and nothing here loads.

On the first checkpoint of a run, read the supervision contract this skill's `SKILL.md`
names under `--advice`. This file implements it, and it holds the call protocol every
checkpoint follows.

## Checkpoints

| Stage | Fires at | Condition | Max |
|---|---|---|---:|
| GUIDE | after the plan is agreed, before Phase 3 Build | always, when the flag is on | 1 |
| RESCUE | Phase 3 | repeated failure, a `BLOCKED` subagent, or a high-risk / irreversible decision | 2 |
| REVIEW | after Phase 3.5 Simplify + 3.6 Verify, **before** the Phase 4 reviewer | always, when the flag is on | 1 |
| RECHECK | after corrections from a `RETURN_TO_EXECUTOR` | only after a return | 1 |

Hard cap **5 calls per run**, charged as `--skill mk:cook`. Checkpoints are macro
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

## Routing in this skill

The call protocol defines the dispositions; here is what each one means for this skill.

- `CONTINUE_WITH_DIRECTIVE` — proceed into Build; the directive is input, not instruction.
- `READY_FOR_EXISTING_GATE` — run the Phase 4 reviewer. The verdict is still the reviewer's to write.
- `RETURN_TO_EXECUTOR` — route corrections to the current owner, then supersede the
  stale evidence:
  `mewkit advice commit … --disposition RETURN_TO_EXECUTOR --evidence tasks/plans/<plan>/reports/evidence/workflow-evidence.json --correction-kind source|scope`.
  Re-run Phase 3.6 Verify before Phase 4 — the previous Verify output describes code
  that no longer exists. A `scope` correction also sends the plan back to the user,
  because a plan change needs an agreement Athena cannot give.
- `ESCALATE_TO_HUMAN` — stop and ask the user.
- `BLOCKED_MISSING_EVIDENCE` — supply the named evidence or continue unsupervised.

A second unresolved return escalates to a human; there is no third opinion.

Serialized cap 12 KiB — pass pointers, never payloads. Spawned workers receive a
task-specific directive only: never the flag, never the dossier, never the run id.

## Fallback

If the runtime cannot delegate to `athena`, print exactly

```
advice checkpoint unavailable in this runtime: <reason>
```

and continue unsupervised. Never write a packet inline and present it as the agent's —
a recommendation written by the agent that is stuck is not an independent check, and a
receipt produced that way records supervision that never happened.
