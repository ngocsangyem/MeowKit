# Advice Checkpoints (`--advice` only)

Load this file only when the run was invoked with `--advice`. Without the flag there
are zero supervision calls, no dossier, no receipt, and the step sequence is
byte-identical to an unsupervised run.

The contract this implements is
`.claude/rules-conditional/advice-supervision-rules.md`. Where the two disagree, the
contract wins.

## Checkpoints

| Stage | Fires at | Condition | Max |
|---|---|---|---:|
| GUIDE | end of `step-00-scope-challenge`, **before** `step-01-research` | always, when the flag is on | 1 |
| RESCUE | `step-05-red-team` | the red team leaves a contradiction the plan does not resolve, or research produced two incompatible directions | 2 |
| REVIEW | after `step-06-validation-interview`, **before** `step-07-gate` | always, when the flag is on | 1 |
| RECHECK | after corrections from a `RETURN_TO_EXECUTOR` | only after a return | 1 |

Hard cap **4 calls per run**. Checkpoints are macro boundaries — never per step, per
phase file, or per red-team finding.

GUIDE fires after the scope challenge because that is where the scope stops moving;
supervising a scope that is still being negotiated advises on a plan that will not
exist. REVIEW fires before the gate step, never inside it.

## The Gate 1 boundary — the thing most likely to go wrong here

**Athena does not approve Gate 1, and a REVIEW checkpoint is not a pre-approval.**

`step-07-gate` is unchanged: the human reads the plan and approves it, and
`npx mewkit plan approve` stamps the receipt. A `READY_FOR_EXISTING_GATE` disposition
means "the plan is in a state where presenting Gate 1 is the correct next step" —
nothing more. Presenting it earlier, skipping it, or citing Athena's directive as
part of the approval is a Gate Authority Invariant violation
(`.claude/rules/gate-rules.md`).

Athena also does not write the plan. `RETURN_TO_EXECUTOR` routes corrections back to
the **planner**, which edits the plan and re-runs the normal checks; the corrected
plan then goes to Gate 1 the ordinary way.

If the correction changes scope rather than wording, the plan body changes, so any
previously stamped approval goes stale and re-approval is required — that is the
existing receipt mechanism working, not a new rule.

## Composing with `--html`

The two flags are orthogonal: `--advice` never turns the visual pipeline on, `--html`
never turns supervision on, and combining them changes no activation, approval,
validation, export or ownership. `step-00` parses each independently, and neither alters
`planning_mode`.

Where they meet is the correction loop, because a supervised correction edits Markdown
and the visual artifact pins hashes of that Markdown:

1. The **Markdown plan stays the source of truth.** Athena reviews plan semantics and
   evidence; it never reviews the rendered artifact.
2. REVIEW fires before `step-07-gate`, which is where the visual Gate-1 preconditions are
   checked and `mewkit visual-plan approve` runs. Supervision therefore lands *before*
   the visual approval, never between it and the gate.
3. A `RETURN_TO_EXECUTOR` that edits the plan invalidates the artifact's pinned source
   hashes exactly like any other Steps 5/6 edit. Follow the existing route in
   `references/visual-plan-integration.md` §6: `mewkit visual-plan rehash {plan_dir}` —
   which **clears the prior visual approval** — then re-validate, re-review, and
   `approve` the new revision before presenting Gate 1. A stale artifact must never reach
   the gate alongside a corrected plan.
4. Nothing about step-08b changes. The export still runs only on a Gate-1-approved
   artifact, still writes exactly `{plan_dir}/plan.html`, and is still fail-open.

**Athena touches none of it.** It cannot approve the visual, edit the HTML, change its
filename or path, open a browser, or turn its dossier or receipt into the visual
artifact. That is structural rather than promised: the adapter grants `Read, Grep, Glob`
and nothing else, so there is no tool with which to do any of it. The supervision
dossier and receipts live under `tasks/reports/`; a correction may supersede a
`workflow-evidence.json` and nothing else — the CLI refuses any other write target.

## Call

```
mewkit advice begin --run <supervisionRunId> --skill mk:plan-creator \
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

Serialized cap 12 KiB — pass the plan path and the red-team report as pointers, never
the plan body.

## After the call

```
mewkit advice commit --run <runId> --checkpoint <checkpointId> \
  --disposition <returned disposition> --outcome adopted|rejected|deferred \
  --reason "<one line, required even when adopted>" \
  --directive "<summary>" --next "<next safe action>" \
  [--correction "<change>" ...] [--evidence-pointer <path> ...]
```

Route on the disposition:

- `CONTINUE_WITH_DIRECTIVE` — continue the step sequence; the directive is input to
  planning, not a replacement for a step.
- `READY_FOR_EXISTING_GATE` — run `step-07-gate` as normal. Gate 1 is **not** cleared.
- `RETURN_TO_EXECUTOR` — the planner applies each correction or records why it is
  rejected, the normal semantic and validation checks re-run, then RECHECK once.
- `ESCALATE_TO_HUMAN` — stop at the existing human touchpoint.
- `BLOCKED_MISSING_EVIDENCE` — supply the named evidence or continue unsupervised.

A second unresolved return escalates to a human; there is no third opinion.

Only `supervisionRunId` crosses an approved handoff to a following skill. Spawned
workers (researcher, red-team) receive a task-specific directive — never the flag,
never the dossier.

If the runtime cannot delegate to `athena`, print exactly
`advice checkpoint unavailable in this runtime: <reason>` and continue unsupervised.
**Never write a packet inline and present it as Athena's.**
