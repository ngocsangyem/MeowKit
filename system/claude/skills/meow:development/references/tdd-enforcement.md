# Skill: TDD Enforcement

**Purpose:** Enforce test-first development. No implementation code is written until failing tests exist and are verified.

## When to Use

Invoke this skill for ALL feature development and bug fixes. The only exceptions are: documentation-only changes, config-only changes, and pure refactors with existing test coverage.

## Rules

### Rule 1: Tests Before Implementation

The developer agent CANNOT write implementation code until the tester agent (or the developer in tester role) confirms that failing tests exist for the feature.

### Rule 2: Capture Failing Test Output

The failing test output MUST be captured and shown before any implementation begins. This proves the test is:
- Actually running (not skipped)
- Failing for the right reason (not a syntax error)
- Testing the intended behavior

### Rule 3: All Tests Must Pass After Implementation

After writing implementation code, run the FULL test suite. ALL tests must pass — not just the new ones.

### Rule 4: Three-Strike Escalation

If tests fail after implementation:
1. **Strike 1:** Developer reviews failure, attempts fix.
2. **Strike 2:** Developer re-examines approach, attempts fix.
3. **Strike 3:** Developer attempts final fix.
4. **After 3 failures:** STOP. Escalate to human with:
   - The test that is failing
   - All 3 attempted fixes
   - The error output from each attempt
   - Developer's hypothesis on root cause

### Rule 5: Valid Failing Tests

A valid failing test is NOT:
- A syntax error in the test file
- An import error because the module doesn't exist yet (use mock/stub)
- A test that is skipped or pending

A valid failing test IS:
- A test that runs to completion
- Asserts expected behavior
- Fails because the behavior is not yet implemented

## Pre-Implementation Check

Before writing ANY implementation code, verify:

```
CHECK 1: Does a test file exist that references the feature?
  → If NO: Write the test first.
  → If YES: Proceed to Check 2.

CHECK 2: Does running tests show at least one FAIL for this feature?
  → If NO: The test is not valid or not failing. Fix the test.
  → If YES: Proceed to implementation.
```

## Workflow

```
1. [TESTER]  Write test(s) for the desired behavior
2. [TESTER]  Run tests → confirm FAIL (capture output)
3. [TESTER]  Share failing test output with developer
4. [DEV]     Verify: test is valid, failure is correct
5. [DEV]     Write MINIMUM code to make test pass
6. [DEV]     Run ALL tests → confirm PASS
7. [DEV]     If FAIL → fix (up to 3 attempts) → if still FAIL → escalate
8. [BOTH]    Refactor if needed → run tests → confirm PASS
```

## Enforcement in Practice

When asked to implement a feature, respond with:

> "Before I write implementation code, I need to verify that failing tests exist for this feature. Let me check."

Then run the test suite. If no failing tests exist for the feature, write them first. Only after seeing FAIL output should you proceed to implementation.
