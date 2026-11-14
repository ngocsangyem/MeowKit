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

Skip this whole section unless the run was invoked with `--advice`. Without the flag
there are zero supervision calls and nothing here loads.

On the first checkpoint of a run, read `.cursor/rules/domain-advice-supervision.mdc` — it is the contract this section
implements, and it holds the call protocol every checkpoint follows.

### Checkpoints

| Stage | Fires at | Condition | Max |
|---|---|---|---:|
| GUIDE | Step 3, before the first edit | Root cause is confirmed, or a diagnostic report was handed off | 1 |
| RESCUE | Step 3 | Two distinct fix approaches have failed, OR the evidence contradicts itself, OR the step is irreversible (security boundary, public contract, possible data loss) | 2 |
| REVIEW | Step 4→5 boundary, after Verify and before the normal review | always, when the flag is on | 1 |
| RECHECK | after corrections from a `RETURN_TO_EXECUTOR` | only after a return | 1 |

Hard cap **5 calls per run**, charged as `--skill mk-fix`. Checkpoints are macro
boundaries — never per tool call, per loop iteration, or per file.

The RESCUE trigger does not replace or postpone the three-failed-attempt human STOP in
`SKILL.md`. That stop fires on its own schedule whether or not supervision was taken at
two failures.

### What each checkpoint asks

- **GUIDE** — given this root cause, which fix path carries the least risk, and what
  proof would show it worked?
- **RESCUE** — two approaches failed on this evidence; what does the evidence actually
  support, and what would disconfirm the current hypothesis?
- **REVIEW** — does the evidence cover the reported bug and its regression, or does this
  go back?
- **RECHECK** — were the corrections addressed and proven?

### Boundaries

**Supervision is evidence, not authority.** It cannot pass, clear, or unblock any gate,
and it is never counted as verification. Verification stays with the Verify step's tests
and the review verdict.

If the runtime cannot delegate to `athena`, print exactly

```
advice checkpoint unavailable in this runtime: <reason>
```

and continue unsupervised. Never write a packet inline and present it as the agent's —
that is not an independent check, and a receipt produced that way records supervision
that never happened.
