# Advice Checkpoints (`--advice` only)

Load this file only when the run was invoked with `--advice`. Without the flag there
are zero supervision calls, no dossier, no receipt, and behavior is unchanged.

The contract this implements is
`.claude/rules-conditional/advice-supervision-rules.md`. Where the two disagree, the
contract wins.

## Counsel is not authorization

Read this before wiring anything. Ship is the one supervised skill whose steps have
irreversible external effects, so the boundary is stated first rather than last.

A directive from Athena **never** creates the authority to push, open a PR, merge,
version, publish, or deploy. Those come from exactly two places, unchanged by this flag:

1. an explicit `release` or `publish` scope in the user's request, and
2. the explicit confirmations in `SKILL.md` → *Explicit Confirmations*.

Advice arriving *before* an effect is input to how the effect is performed, not
permission to perform it. `mk:ship` with no scope still defaults to `prepare`, still
asks before staging, and still asks before a local commit — supervised or not.

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

- a merge conflict that cannot be auto-resolved and whose correct resolution is a
  judgment call about intent;
- test-failure ownership that is genuinely ambiguous — pre-existing versus introduced
  by this branch — after `references/test-execution.md`'s triage has run;
- a distribution or version decision where two defensible answers have different
  blast radii.

It is **not** for the ordinary blocking stops in *When to Stop*. Being on the target
branch, a failing test with a clear owner, or coverage below the gate all have defined
behavior already. Consulting on them replaces a deterministic stop with a conversation.

### Why REVIEW waits for terminal CI

A pending pipeline has no outcome to review, and a red one has a defined route:
`references/commit-push-pr.md`'s verification gate and the existing repair-or-stop
behavior own it. Neither routes through Athena, and Athena cannot clear a red CI, wave
through a pending one, or shorten the wait.

REVIEW therefore fires only against a terminally **green** pipeline, and reviews what
shipped — release notes, rollback documentation, whether the deploy classification
matches what actually happened.

## What supervision does NOT touch here

- **Gate 2.** `mk:review` owns the verdict; the human owns the approval. Ship does not
  re-run adversarial review and Athena does not stand in for either.
- **The plan-first gate**, the explicit confirmations, and `--skip-tests`.
- **CI status.** Green, red and pending each keep their existing route.
- **External comments.** An Athena assessment posted to a PR or issue is an external
  effect and needs the same explicit `release` / `publish` authority as any other. The
  default is a local receipt under `tasks/reports/` and nothing else.

## Call

```
mewkit advice begin --run <supervisionRunId> --skill mk:ship \
  --release-stage prepare|release|publish \
  --stage GUIDE|RESCUE|REVIEW|RECHECK --checkpoint <checkpointId>
```

`--release-stage` is the budget the call is charged to and is fixed at `begin`; `commit`
inherits it. Passing a different one at `commit` is refused rather than reconciled.
Checkpoint ids are unique across the whole run, not per stage — reusing one under a
different release stage is refused as a naming collision.

Validate the packet before sending it:

```
mewkit advice validate-packet --evidence <packet.json> --packet-kind input
```

Then delegate with the packet inline (a fork inherits no conversation):

```
Agent(subagent_type="athena",
      description="advice: <checkpoint name>",
      prompt="<packet: runId, skill, stage, checkpointId, mission, lockedDecisions,
               currentState, workerSummary, evidenceRefs (≤5, with provenance),
               priorDirective, question, riskAndReversibility>")
```

Serialized cap 12 KiB — pass pointers, never payloads. The verdict, the diff stat, the
CI run URL and the changelog are pointers; a full diff or CI log is not.

Validate the returned packet the same way with `--packet-kind output` before acting on
it or summarizing it into a receipt.

## After the call

```
mewkit advice commit --run <runId> --checkpoint <checkpointId> \
  --disposition <returned disposition> --outcome adopted|rejected|deferred \
  --reason "<one line, required even when adopted>" \
  --directive "<summary>" --next "<next safe action>" \
  [--correction "<change>" ...] [--evidence-pointer <path> ...]
```

Route on the disposition:

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

If the runtime cannot delegate to `athena`, print exactly
`advice checkpoint unavailable in this runtime: <reason>` and continue unsupervised.
**Never write a packet inline and present it as Athena's** — a recommendation written
by the agent that is stuck is not an independent check.
