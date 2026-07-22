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
