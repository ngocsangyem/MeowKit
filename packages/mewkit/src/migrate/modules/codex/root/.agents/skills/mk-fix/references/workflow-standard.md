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

**Not available in this bundle yet.** The supervisor contract that governs
`--advice` — the `GUIDE → RESCUE* → REVIEW → RECHECK*` cadence, per-stage and
per-skill caps, the continuity dossier, the receipt, and the `RETURN_TO_EXECUTOR`
correction cycle — is enforced by `mewkit advice begin|commit`, and the adapter that
reaches it from this runtime has not been authored or smoke-tested here.

Until it is, treat `--advice` as unavailable on this surface: print exactly

```
advice checkpoint unavailable in this runtime: adapter not authored for this bundle
```

and continue unsupervised. The ordinary workflow is unaffected.

Do NOT improvise a checkpoint. Writing a packet inline and presenting it as the
advisory agent's output is not an independent check, and a receipt produced that way
records supervision that never happened. The canonical contract, for reference, is
the advice-supervision rule in the source kit.
