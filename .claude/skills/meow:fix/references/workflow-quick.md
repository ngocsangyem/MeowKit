# Quick Workflow

Fast debug-fix-review cycle for simple issues. No task tracking overhead.

## Steps

### Step 1: Debug
Activate `meow:investigate` skill. Find root cause quickly.
- Read error message/logs
- Locate affected file(s)
- Identify exact fix needed

Use parallel `Explore` subagents if root cause spans multiple areas.

**Output:** `Step 1: Root cause — [brief description]`

### Step 2: Fix & Verify
Implement the fix directly. Make minimal changes following existing patterns.

**Parallel Verification** — launch in single message:
```
Agent(subagent_type="Bash", prompt="Run typecheck")
Agent(subagent_type="Bash", prompt="Run lint")
```

**Output:** `Step 2: Fixed — [N] files, verified (types/lint passed)`

### Step 3: Review
Use reviewer agent for quick review.

See `references/review-cycle.md` for mode-specific handling.

**Output:** `Step 3: Review [score]/10 — [status]`

### Step 4: Complete
Report summary to user.
- If autonomous mode + score >= 9.0: ask to commit
- If HITL mode: ask user next action

**Output:** `Step 4: Complete — [action]`

## Notes
- If review fails → escalate to Standard workflow
- Total steps: 4 (vs 6 in Standard, 8 in Deep)
- No planning phase needed
