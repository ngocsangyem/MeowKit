# Advice Checkpoints (`--advice` only)

Load this file only when the run was invoked with `--advice`. Without the flag there
are zero supervision calls, no dossier, no receipt, and behavior is unchanged.

The contract this implements is
`.claude/rules-conditional/advice-supervision-rules.md`. Where the two disagree, the
contract wins.

## Deep runs only

`--advice` applies to the **deep** workflow. The quick profile restates the decision,
gives 2-4 options and returns inline — it creates no scout, report, plan, or memory
entry, and supervising three inline steps is noise rather than safety. Passing
`--advice` with `--depth quick` prints one line and continues unsupervised:

```
advice: --advice applies to deep runs; continuing unsupervised
```

## Checkpoints

| Stage | Fires at | Condition | Max |
|---|---|---|---:|
| GUIDE | after step 1's decision / constraint / success-criterion frame, **before** generating approaches | always, when the flag is on | 1 |
| RESCUE | during generation or the challenge pass | the evidence and the stated constraints contradict each other, or the option set collapses to one viable path for a reason nobody stated | 2 |
| REVIEW | after the challenge pass, **before** presenting the recommendation to the user | always, when the flag is on | 1 |
| RECHECK | after corrections from a `RETURN_TO_EXECUTOR` | only after a return | 1 |

Hard cap **4 calls per run**. Checkpoints are macro boundaries — never per option,
per technique, or per scoring pass.

GUIDE fires **after** the frame and **before** generation on purpose: it supplies the
decision criteria and risk lens the generation should span, which is worthless once
the options already exist.

## Role boundary — read this before wiring anything

The brainstormer generates the option set. Athena does **not**:

- It does not generate a second set of approaches. If it wants an option that is
  missing, it names the gap; this skill generates it.
- It does not choose for the user. It recommends one direction **inside the
  user-approved scope**, and that recommendation is evidence the user reads.
- It never adds a gate. Brainstorming has no Gate 1, and supervision does not create
  one.

A run where Athena replaces the option set has failed, even if the answer was good.

## Call

```
mewkit advice begin --run <supervisionRunId> --skill mk:brainstorming \
  --stage GUIDE|RESCUE|REVIEW|RECHECK --checkpoint <checkpointId>
```

This enforces the cap, stage legality and idempotency, and writes the pending marker
that makes a crash resumable. A refusal is final for that checkpoint: continue
unsupervised, or escalate when the refusal says to.

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

Serialized cap 12 KiB — pass pointers, never payloads.

## After the call

```
mewkit advice commit --run <runId> --checkpoint <checkpointId> \
  --disposition <returned disposition> --outcome adopted|rejected|deferred \
  --reason "<one line, required even when adopted>" \
  --directive "<summary>" --next "<next safe action>" \
  [--correction "<change>" ...] [--evidence-pointer <path> ...]
```

Route on the disposition:

- `CONTINUE_WITH_DIRECTIVE` — proceed; the directive is input to the generation, not a
  replacement for it.
- `READY_FOR_EXISTING_GATE` — present the recommendation to the user as normal. There
  is no gate here to clear, and this does not become one.
- `RETURN_TO_EXECUTOR` — this skill addresses each correction (usually a missing
  option, an unexamined constraint, or a trade-off asserted without evidence) or
  records why it is rejected, then RECHECK once.
- `ESCALATE_TO_HUMAN` — stop and put the decision to the user.
- `BLOCKED_MISSING_EVIDENCE` — supply the named evidence or continue unsupervised.

A second unresolved return escalates to a human; there is no third opinion.

If the runtime cannot delegate to `athena`, print exactly
`advice checkpoint unavailable in this runtime: <reason>` and continue unsupervised.
**Never write a packet inline and present it as Athena's** — a recommendation written
by the agent that is stuck is not an independent check.
