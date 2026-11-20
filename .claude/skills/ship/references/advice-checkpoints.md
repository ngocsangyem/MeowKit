# `--advice` checkpoints — `mk:ship`

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
| GUIDE | after the ship scope is resolved and pre-flight has run, **before** any effect | always, when the flag is on | 1 |
| RESCUE | an exceptional blocker | see below | 2 |
| REVIEW | the outcome, **only after CI reaches a terminal state** | terminal green only | 1 |
| RECHECK | after corrections from a `RETURN_TO_EXECUTOR` | only after a return | 1 |

Hard cap **4 calls per release stage**, not per run. `prepare`, `release` and `publish`
each carry their own budget, and the CLI charges a call to the stage named by
`--release-stage`. A run that walks all three is three supervision episodes.

This is why the flag is required for ship and refused for every other supervised skill:
without it a call has no budget to spend from, and defaulting it would charge a
publish-time question to the budget `prepare` already spent.

### What counts as an exceptional blocker

RESCUE is for a stop the pipeline cannot resolve on its own:

- a merge conflict whose correct resolution is a judgment call about intent;
- test-failure ownership that is genuinely ambiguous — pre-existing versus introduced by
  this branch — after the ordinary triage has run;
- a distribution or version decision where two defensible answers have different blast
  radii.

It is **not** for the ordinary blocking stops. Being on the target branch, a failing test
with a clear owner, or coverage below the threshold all have defined behavior already.
Consulting on them replaces a deterministic stop with a conversation.

### Why REVIEW waits for terminal CI

A pending pipeline has no outcome to review, and a red one has a defined route: the
existing verification step and its repair-or-stop path. Athena cannot clear red CI, wave
it through, or shorten the wait.

## What each checkpoint asks

- **GUIDE** — given this scope and pre-flight state, what is the safest ordering and what
  is the rollback?
- **RESCUE** — this blocker needs a judgment call; which resolution does the evidence
  support?
- **REVIEW** — does the shipped outcome match what was intended, on terminal-green CI?
- **RECHECK** — were the corrections addressed?

## What supervision does NOT touch here

- **Authorization.** A directive never creates the authority to push, open a PR, merge,
  version, publish, or deploy. That comes only from an explicit `release` or `publish`
  scope plus the existing explicit confirmations, both unchanged by this flag.
- **Red or pending CI.** It keeps its existing repair-or-stop route.
- **The review verdict.** It stays with the review skill, and the decision with the user.
- **External effects.** Posting an assessment to a PR or issue is an external effect
  needing the same explicit authority as any other. The default is a local receipt only.

## Routing in this skill

The call protocol defines the dispositions; here is what each one means for this skill.

- `CONTINUE_WITH_DIRECTIVE` — proceed through the pipeline. Every confirmation the
  scope requires still happens; the directive changes how a step is done, never whether
  it is allowed.
- `READY_FOR_EXISTING_GATE` — the ordinary next step is correct. On ship that is a
  confirmation prompt or a human decision, and this **does not answer it**.
- `RETURN_TO_EXECUTOR` — address each correction, then re-run the checks it invalidated
  before continuing. A correction that changes shipped content after a push is a new
  revision: it needs its own CI pass, not the previous one.
- `ESCALATE_TO_HUMAN` — stop at the existing human touchpoint.
- `BLOCKED_MISSING_EVIDENCE` — supply the named evidence or continue unsupervised.

A second unresolved return **within the same release stage** escalates to a human; there
is no third opinion. Returns are counted per release stage, because a resolved return
while preparing and an unrelated one while releasing are two episodes, not one loop.

Advice arriving *before* an effect is input to how the effect is performed, not
permission to perform it. `mk:ship` with no scope still defaults to `prepare`, still
asks before staging, and still asks before a local commit — supervised or not.

`--release-stage` is the budget the call is charged to and is fixed at `begin`; `commit`
inherits it. Passing a different one at `commit` is refused rather than reconciled.
Checkpoint ids are unique across the whole run, not per stage — reusing one under a
different release stage is refused as a naming collision.

REVIEW therefore fires only against a terminally **green** pipeline, and reviews what
shipped — release notes, rollback documentation, whether the deploy classification
matches what actually happened.

Supervision also leaves the plan-first requirement, the explicit confirmations and `--skip-tests` as they are.

## Fallback

If the runtime cannot delegate to `athena`, print exactly

```
advice checkpoint unavailable in this runtime: <reason>
```

and continue unsupervised. Never write a packet inline and present it as the agent's —
a recommendation written by the agent that is stuck is not an independent check, and a
receipt produced that way records supervision that never happened.
