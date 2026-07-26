# Standard Workflow

Full pipeline for moderate complexity issues. Uses task tracking for phase coordination.

## Steps

### Step 1: Scout, Debug & Investigate
Run `mk:scout`, then activate `mk:investigate` and `mk:sequential-thinking`. Use a researcher only if external docs are needed.
- Read error messages, logs, stack traces
- Capture deterministic reproduction or bounded intermittent evidence
- Trace backward to root cause
- Identify all affected files

**Output:** `Step 1: Root cause — [summary], [N] files affected`

### Step 2: Extend Scout Coverage
Extend the mandatory scout when the initial blast radius is larger than the direct module.

- Find patterns, similar implementations, dependencies, and callers
- Use parallel exploration only for independent affected areas

**Output:** `Step 2: Scouted [N] areas — Found [M] related files`

### Step 3: Implement Fix
Fix the issue following debugging findings.

**Parallel Verification** after implementation:
```
Agent(subagent_type="Bash", prompt="Run typecheck")
Agent(subagent_type="Bash", prompt="Run lint")
Agent(subagent_type="Bash", prompt="Run build")
```

**Output:** `Step 3: Implemented — [N] files, verified`

### Step 4: Test
Use tester agent to run tests.
- Write new tests if needed
- Run existing test suite
- If fail → self-heal up to 3 attempts

**Output:** `Step 4: Tests [X/X passed]`

### Step 5: Review
Use reviewer agent. See `references/review-cycle.md`.

**Output:** `Step 5: Review [score]/10 — [status]`

### Step 6: Finalize
- Report summary to user
- Ask to commit via shipper agent
- Update docs if needed via documenter agent

**Output:** `Step 6: Complete — [action]`

## Advice Checkpoints (`--advice` only)

Skip this whole section unless the run was invoked with `--advice`. Without the
flag there are zero advisory calls and nothing here loads.

On the first checkpoint of a run, read
`.claude/rules-conditional/advice-supervision-rules.md` — it is the contract this
section implements.

### Checkpoints

| Stage | Fires at | Condition | Max |
|---|---|---|---:|
| GUIDE | Step 3, before the first edit | Root cause is confirmed, or a diagnostic report was handed off | 1 |
| RESCUE | Step 3 | Two distinct fix approaches have failed, OR the evidence contradicts itself, OR the step is irreversible (security boundary, public contract, possible data loss) | 2 |
| REVIEW | Step 4→5 boundary, after Verify and before the normal review | always, when the flag is on | 1 |
| RECHECK | after corrections from a `RETURN_TO_EXECUTOR` | only after a return | 1 |

Hard cap **5 calls per run**. Checkpoints are macro boundaries — never per tool
call, per loop iteration, or per file.

The RESCUE trigger does not replace or postpone the three-failed-attempt human
STOP in `SKILL.md`. That stop fires on its own schedule whether or not supervision
was taken at two failures.

### Call

Open the checkpoint first — this is what enforces the cap, the stage legality and
idempotency, and writes the pending marker that makes a crash resumable:

```
mewkit advice begin --run <supervisionRunId> --skill mk:fix \
  --stage GUIDE|RESCUE|REVIEW|RECHECK --checkpoint <checkpointId>
```

A refusal is final for that checkpoint: continue unsupervised, or escalate when the
refusal says to. Re-running the same `--checkpoint` returns the recorded result and
spends no slot.

Then delegate, with the packet inline (a fork inherits no conversation):

```
Agent(subagent_type="athena",
      description="advice: <checkpoint name>",
      prompt="<the packet below, inline>")
```

Packet fields — `runId`, `skill`, `stage`, `checkpointId`, `mission`,
`lockedDecisions`, `currentState`, `workerSummary`, `evidenceRefs` (≤5 pointers,
each with provenance), `priorDirective`, `question`, `riskAndReversibility`.
Serialized cap 12 KiB; pass pointers, never payloads. Locked decisions and the exact
question appear at both the start and the end.

Validate the packet before sending it — the caps, pointer budget, provenance
requirement and secret scan are enforced by this command, not by writing the packet
carefully:

```
mewkit advice validate-packet --evidence <packet.json> --correction-kind input
```

Validate the returned packet the same way with `--correction-kind output` before
acting on it or summarizing it into a receipt.

### After the call

Render the returned packet to the user, then commit it:

```
mewkit advice commit --run <runId> --checkpoint <checkpointId> \
  --disposition <returned disposition> --outcome adopted|rejected|deferred \
  --reason "<one line, required even when adopted>" \
  --directive "<summary>" --next "<next safe action>" \
  [--correction "<change>" ...] [--evidence-pointer <path> ...]
```

`commit` writes the receipt to `tasks/reports/{YYMMDD}-{slug}-advice-{n}.md`, records
the call against the cap, and refuses a disposition that is illegal for the stage.
`disposition` is Athena's routing signal; `--outcome` is what this pipeline decided
to do with it — a rejected directive is a legitimate, recordable outcome.

Route on the disposition:

- `CONTINUE_WITH_DIRECTIVE` — proceed; the directive is input, not instruction.
- `READY_FOR_EXISTING_GATE` — run the normal Step 5 review. The gate is NOT cleared.
- `RETURN_TO_EXECUTOR` — apply the corrections, then supersede the stale evidence:
  `mewkit advice commit … --disposition RETURN_TO_EXECUTOR --evidence <workflow-evidence.json> --correction-kind source|scope`.
  Re-run Step 4 before the review. `scope` also returns Gate 1 to `required`.
- `ESCALATE_TO_HUMAN` — stop at the existing human touchpoint.
- `BLOCKED_MISSING_EVIDENCE` — supply the named evidence or continue unsupervised.

If an active durable task record exists, point at the receipt:
`mewkit task-state update <id> --evidence-ref <receipt path>`. With no active record,
keep the file and skip this step — never invent a record.

A failed receipt write prints a one-line notice and the run continues; it never
blocks and is never skipped silently.

**Supervision is evidence, not authority.** It cannot pass, clear, or unblock any
gate, and it is never counted as verification. Verification stays with Step 4
tests and the Step 5 review verdict.

If the runtime cannot delegate to `athena`, print exactly
`advice checkpoint unavailable in this runtime: <reason>` and continue
unsupervised. Never write a counsel packet inline and present it as Athena's.
