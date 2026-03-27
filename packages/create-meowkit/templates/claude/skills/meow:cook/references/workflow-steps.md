# Unified Workflow Steps

All modes share core steps with mode-specific variations.

## Step 0: Intent Detection & Setup

1. Parse input with `references/intent-detection.md` rules
2. Log detected mode
3. If mode=code: detect plan path, set active plan

**Output:** `Step 0: Mode [interactive|auto|fast|parallel|no-test|code] — [reason]`

## Step 1: Research (skip if fast/code mode)

- Use `meow:scout` for codebase exploration
- Use researcher agent for external knowledge
- Keep reports concise

**Output:** `Step 1: Research complete — [N] reports gathered`

### [Review Gate 1] (skip if auto mode)
Present research summary. Ask: "Proceed to planning?" / "More research" / "Abort"

## Step 2: Planning

- Use planner agent with research context
- Create plan file in `tasks/plans/YYMMDD-name.md`
- Use `meow:plan-creator` skill for template selection
- For code mode: skip — plan already exists

**Output:** `Step 2: Plan created — [N] phases`

### [Review Gate 2] (skip if auto mode)
Present plan. Ask: "Approve" / "Revise" / "Abort" — Gate 1 enforcement

## Step 3: Implementation

- Read plan phases, execute sequentially
- Use developer agent for implementation
- Use tester agent for TDD (failing tests first)
- Run type checking after each file

**Output:** `Step 3: Implemented [N] files — [X/Y] tasks complete`

### [Review Gate 3] (skip if auto mode)
Present implementation summary. Ask: "Proceed to testing?" / "Changes needed" / "Abort"

## Step 4: Testing (skip if no-test mode)

- Use tester agent for test suite
- If failures: self-heal up to 3 attempts
- NEVER use fake mocks or skip failing tests

**Output:** `Step 4: Tests [X/X passed]`

### [Review Gate 4] (skip if auto mode)
Present test results. Ask: "Proceed to review?" / "Fix tests" / "Abort"

## Step 5: Code Review

- Use reviewer agent (5-dimension review)
- See `references/review-cycle.md` for mode-specific handling
- Auto mode: auto-approve if score >= 9.5 AND 0 critical

**Output:** `Step 5: Review [score]/10 — [status]`

## Step 6: Finalize

1. Use documenter agent for doc updates
2. Use shipper agent for commit + PR
3. Update plan file status

**Output:** `Step 6: Finalized — committed`

## Mode Flow Summary

```
interactive: 0 → 1 → [R] → 2 → [R] → 3 → [R] → 4 → [R] → 5 → 6
auto:        0 → 1 → 2 → 3 → 4 → 5(auto) → 6 → next phase
fast:        0 → skip → 2(fast) → [R] → 3 → [R] → 4 → [R] → 5 → 6
parallel:    0 → 1? → [R] → 2 → [R] → 3(multi) → [R] → 4 → [R] → 5 → 6
no-test:     0 → 1 → [R] → 2 → [R] → 3 → [R] → skip → 5 → 6
code:        0 → skip → skip → 3 → [R] → 4 → [R] → 5 → 6
```
