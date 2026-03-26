# Standard Workflow

Full pipeline for moderate complexity issues. Uses task tracking for phase coordination.

## Steps

### Step 1: Debug & Investigate
Activate `meow:investigate` skill. Use researcher agent if external docs needed.
- Read error messages, logs, stack traces
- Reproduce the issue
- Trace backward to root cause
- Identify all affected files

**Output:** `Step 1: Root cause — [summary], [N] files affected`

### Step 2: Scout Related Code
Launch parallel `Explore` subagents to scout affected areas.
Use `meow:scout` for large codebases.

- Only if unclear which files need changes
- Find patterns, similar implementations, dependencies

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
