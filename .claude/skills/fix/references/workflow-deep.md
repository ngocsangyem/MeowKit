# Deep Workflow

Full pipeline with research, brainstorming, and planning for complex issues.

## Steps

### Step 1: Scout, Debug & Parallel Investigation
Run `mk:scout`, then activate `mk:investigate` and `mk:sequential-thinking`. Launch parallel exploration only for independent evidence paths:
```
Agent("Explore", "Find error origin and trace")
Agent("Explore", "Find affected components and dependencies")
Agent("Explore", "Find similar patterns in codebase")
```

**Output:** `Step 1: Root cause — [summary], system impact: [scope]`

### Step 2: Research (parallel with Step 1)
Use researcher agent for external knowledge.
- Search latest docs, best practices
- Find similar issues/solutions
- Gather security advisories if relevant

**Output:** `Step 2: Research complete — [key findings]`

### Step 3: Brainstorm
Use brainstormer agent.
- Evaluate multiple approaches with trade-offs
- Consider second-order effects
- Get user input on preferred direction

**Output:** `Step 3: Approach selected — [chosen approach]`

### Step 4: Plan
Use planner agent to create implementation plan.
- Break down into phases
- Identify dependencies
- Define success criteria

**Output:** `Step 4: Plan created — [N] phases`

### Step 5: Implement
Implement per plan. Follow `.claude/rules/tdd-rules.md` for flag precedence and regression-test requirements; do not restate or weaken that contract here.

**Parallel Verification** after implementation.

**Output:** `Step 5: Implemented — [N] files, [M] phases, verified`

### Step 6: Test
Use tester agent. Comprehensive testing including edge cases, security, performance.

**Output:** `Step 6: Tests [X/X passed]`

### Step 7: Review
Use reviewer agent. See `references/review-cycle.md`.

**Output:** `Step 7: Review [score]/10 — [status]`

### Step 8: Finalize
- Use documenter agent for documentation
- Use shipper agent for commit + PR
- Use journal-writer agent if this was a significant failure

**Output:** `Step 8: Complete — [actions taken]`

## Advice Checkpoints (`--advice` only)

Skip this whole section unless the run was invoked with `--advice`. Without the
flag there are zero advisory calls and nothing here loads.

On the first checkpoint of a run, read
`.claude/rules-conditional/advice-supervision-rules.md` — it is the contract this
section implements.

### Checkpoints

| Stage | Fires at | Condition | Max |
|---|---|---|---:|
| GUIDE | Step 5, before the first edit | Root cause is confirmed, or a diagnostic report was handed off | 1 |
| RESCUE | Step 5 | Two distinct fix approaches have failed, OR the evidence contradicts itself, OR the step is irreversible (security boundary, public contract, possible data loss) | 2 |
| REVIEW | Step 6→7 boundary, after Verify and before the normal review | always, when the flag is on | 1 |
| RECHECK | after corrections from a `RETURN_TO_EXECUTOR` | only after a return | 1 |

Hard cap **5 calls per run**. Checkpoints are macro boundaries — never per tool
call, per loop iteration, or per phase of the plan.

The RESCUE trigger does not replace or postpone the three-failed-attempt human
STOP in `SKILL.md`. That stop fires on its own schedule whether or not supervision
was taken at two failures.

Athena is not a substitute for Step 3 brainstorming or Step 4 planning: it assesses
a decision the pipeline is already facing and recommends one operational path inside
the locked scope. It never authors a plan or a phase graph, and it never approves
Gate 1 on the Step 4 plan.

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
mewkit advice validate-packet --evidence <packet.json> --packet-kind input
```

Validate the returned packet the same way with `--packet-kind output` before
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
- `READY_FOR_EXISTING_GATE` — run the normal Step 7 review. The gate is NOT cleared.
- `RETURN_TO_EXECUTOR` — apply the corrections, then supersede the stale evidence:
  `mewkit advice commit … --disposition RETURN_TO_EXECUTOR --evidence <workflow-evidence.json> --correction-kind source|scope`.
  Re-run Step 6 before the review. A `scope` correction also returns Gate 1 to
  `required` — a plan change needs a fresh human approval, which Athena cannot give.
- `ESCALATE_TO_HUMAN` — stop at the existing human touchpoint.
- `BLOCKED_MISSING_EVIDENCE` — supply the named evidence or continue unsupervised.

If an active durable task record exists, point at the receipt:
`mewkit task-state update <id> --evidence-ref <receipt path>`. With no active record,
keep the file and skip this step — never invent a record.

A failed receipt write prints a one-line notice and the run continues; it never
blocks and is never skipped silently.

**Supervision is evidence, not authority.** It cannot pass, clear, or unblock any
gate — including Gate 1 on the Step 4 plan — and it is never counted as
verification. Verification stays with Step 6 tests and the Step 7 review verdict.

If the runtime cannot delegate to `athena`, print exactly
`advice checkpoint unavailable in this runtime: <reason>` and continue
unsupervised. Never write a counsel packet inline and present it as Athena's.
