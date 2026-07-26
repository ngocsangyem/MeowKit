# Advice Checkpoints (`--advice` only)

Load this file only when the run was invoked with `--advice`. Without the flag there
are zero supervision calls, no dossier, no receipt, and behavior is unchanged.

The contract this implements is
`.claude/rules-conditional/advice-supervision-rules.md`. Where the two disagree, the
contract wins.

## Checkpoints

| Stage | Fires at | Condition | Max |
|---|---|---|---:|
| GUIDE | end of step-02, after the contract decision, **before** step-03 Generate | always, when the flag is on | 1 |
| RESCUE | step-05, on the loop path | plateau or scope drift — see below | 2 |
| REVIEW | step-05 §5c, after the terminal evaluator verdict, **before** the Gate 2 question | always, when the flag is on | 1 |
| RECHECK | after corrections from a `RETURN_TO_EXECUTOR` | only after a return | 1 |

Hard cap **5 calls per run**. Checkpoints are macro boundaries — never per generated
artifact, per file, or per evaluator iteration. A five-round build makes the same number
of calls as a one-round build.

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

## What supervision does NOT touch here

- **The iteration cap.** `--max-iter` (default 3) and the §5e escalation fire on their
  own schedule. A rescue directive never buys another round and never delays the
  escalation prompt.
- **The budget tracker.** A BLOCK from `budget-tracker.sh` halts the run immediately,
  supervised or not. Athena does not weigh in on whether to keep spending.
- **The 6-hour timeout.**
- **Gate 2 at §5c.** Athena's REVIEW is evidence presented alongside the evaluator
  verdict. Both are things the human reads; neither is the approval.
- **The evaluator's verdict.** `evaluator` owns PASS/WARN/FAIL and the
  active-verification hard gate. Athena may find that the evidence and the verdict
  disagree and return the work — it may not regrade it.

## Call

```
mewkit advice begin --run <supervisionRunId> --skill mk:autobuild \
  --stage GUIDE|RESCUE|REVIEW|RECHECK --checkpoint <checkpointId>
```

This enforces the cap, stage legality and idempotency, and writes the pending marker
that makes a crash resumable — which matters more here than anywhere else, because an
autobuild run is expected to survive context resets and `--resume`. Re-running the same
`--checkpoint` returns the recorded result and spends no slot.

Record `supervisionRunId` in the run report frontmatter next to `next_step`, for the
same reason `next_step` lives there: a resumed run that cannot find its run id would
start a fresh budget.

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

Serialized cap 12 KiB — pass pointers, never payloads. The plan, the signed contract,
the handoff and the verdict are all files: pass their paths. The generator and evaluator
subagents receive a task-specific directive only — never the flag, never the dossier,
never the run id.

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

- `CONTINUE_WITH_DIRECTIVE` — proceed into step-03; the directive is input to the
  generator's brief, not a replacement for the signed contract.
- `READY_FOR_EXISTING_GATE` — present Gate 2 at §5c as normal. Gate 2 is **not** cleared.
- `RETURN_TO_EXECUTOR` — route corrections to the generator and re-enter step-03 with
  them in the feedback packet, then re-evaluate. The evaluator verdict that preceded the
  correction describes code that no longer exists, so it cannot be the one presented at
  Gate 2 — a fresh step-04 pass is required before §5c.
- `ESCALATE_TO_HUMAN` — stop at the existing human touchpoint (§5c or §5e).
- `BLOCKED_MISSING_EVIDENCE` — supply the named evidence or continue unsupervised.

A returned correction is **not** a free iteration: it consumes an `--max-iter` round like
any other loop back to step-03. Otherwise supervision would be a way around the cap.

A second unresolved return escalates to a human; there is no third opinion.

Record the checkpoint in the step's run-report section, next to the Gate 2 line, so the
audit trail shows what was advised and what the human decided — in that order.

If the runtime cannot delegate to `athena`, print exactly
`advice checkpoint unavailable in this runtime: <reason>` and continue unsupervised.
**Never write a packet inline and present it as Athena's** — a recommendation written
by the agent that is stuck is not an independent check.
