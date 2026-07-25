# Test Failure Fix Workflow

For fixing broken tests (not writing new tests — that's the tester agent's job).

## Steps

### Step 1: Classify Failure Type
- **True failure**: code changed, test correctly catches the regression → fix the code
- **Stale test**: implementation changed intentionally, test expectations outdated → update test
- **Flaky test**: passes sometimes, fails sometimes → fix the flakiness
- **Environment**: works locally, fails in CI → fix environment setup

### Step 2: Read Test Output
- Get exact error message and stack trace
- Identify which assertion failed and expected vs actual values
- Check if multiple tests share the same root cause

### Step 3: Fix Based on Type

**True failure:**
- Locate the regression in code (git bisect if needed)
- Fix the code, not the test
- Verify fix passes all related tests

**Stale test:**
- Confirm the implementation change was intentional (check plan/PR)
- Update test expectations to match new behavior
- NEVER change test to pass without understanding why it failed

**Flaky test:**
- Identify source of flakiness: timing, ordering, shared state, external dependency
- Fix: add waits/retries for async, isolate shared state, mock external deps
- Run test 5x to confirm stability

**Environment:**
- Compare local vs CI: versions, env vars, OS, timezone
- Fix environment setup or add skip conditions

### Step 4: Verify
Run full test suite — no regressions allowed.

### Step 5: Review
Use reviewer agent. Test fixes get same review rigor as code fixes.
