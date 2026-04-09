# Skill: Red-Green-Refactor TDD Cycle (canonical TDD reference)

**This is the canonical TDD cycle reference.** Used by `--tdd` / `MEOWKIT_TDD=1` mode and recommended for production-quality work; NOT enforced by default.

**Purpose:** Document the strict RED-GREEN-REFACTOR cycle for test-driven development.

## When to Use

- **In TDD mode (`--tdd` / `MEOWKIT_TDD=1`):** Invoke this skill for every unit of work during feature development or bug fixing. RED phase is mandatory.
- **In default mode (TDD off):** This reference is opt-in guidance, not enforcement. Use it when you choose to write tests first; skip it when you prefer to implement directly. Opt into strict mode via `--tdd` to make this cycle mandatory.

---

## Phase RED: Write a Failing Test

**Goal:** Describe the desired behavior in a test before writing any implementation.

### Steps

1. Write a test that asserts the behavior you want.
2. Run the test suite.
3. Confirm the new test FAILS.
4. Capture the failure output.

### What Counts as a Valid Failing Test

A valid RED phase failure:
- The test file compiles/parses without errors
- The test runner executes the test (it is not skipped or pending)
- The assertion fails because the behavior is not yet implemented
- The error message clearly indicates what is missing

A test that fails due to these reasons is NOT valid:
- **Syntax error** in the test file — fix the syntax first
- **Import error** because the target module does not exist — create an empty module/stub
- **Runtime crash** before reaching the assertion — fix the setup
- **Skipped/pending** test (`.skip`, `xit`, `pending`) — these do not run

### Output to Capture

```
FAIL src/feature.test.ts
  FeatureName
    ✕ should do expected behavior (5ms)

    Expected: [expected value]
    Received: [actual value or undefined/error]
```

---

## Phase GREEN: Make the Test Pass

**Goal:** Write the MINIMUM code necessary to make the failing test pass.

### Steps

1. Write implementation code — only what is needed for the test.
2. Run the test suite (full suite, not just the new test).
3. Confirm the new test PASSES.
4. Confirm no existing tests broke.

### Rules

- Do NOT write more code than the test requires.
- Do NOT optimize or refactor during this phase.
- Do NOT add features the test does not cover.
- If existing tests break, fix them before proceeding.

### Output to Confirm

```
PASS src/feature.test.ts
  FeatureName
    ✓ should do expected behavior (3ms)

Test Suites: X passed, X total
Tests:       X passed, X total
```

---

## Phase REFACTOR: Improve Without Changing Behavior

**Goal:** Clean up the code while maintaining all passing tests.

### Steps

1. Identify code smells: duplication, poor naming, long functions, unclear structure.
2. Refactor one thing at a time.
3. Run the test suite after EACH refactor step.
4. Confirm ALL tests still PASS.

### Safe Refactors

- Extract function/method
- Rename variable/function for clarity
- Remove duplication (DRY)
- Simplify conditionals
- Extract constants

### Unsafe Changes (NOT Refactoring)

- Adding new behavior (that is a new RED phase)
- Changing function signatures used by other modules (needs its own tests)
- Deleting tests

---

## Integration Tests vs Unit Tests

### Unit Tests
- Test a single function/method in isolation
- Mock all dependencies
- Run in milliseconds
- Use for: business logic, utility functions, data transformations

### Integration Tests
- Test multiple components working together
- Use real (or realistic) dependencies
- May take seconds
- Use for: API endpoints, database operations, service interactions

### TDD Cycle Differences

| Aspect | Unit Tests | Integration Tests |
|--------|-----------|------------------|
| RED phase | Mock dependencies, test logic | Set up test environment, test flow |
| GREEN phase | Implement single unit | Implement and wire up components |
| REFACTOR phase | Refactor unit internals | Refactor wiring and interfaces |
| Run frequency | After every change | After completing a feature unit |

---

## Full Cycle Example

```
[RED]      Write: "it should return 404 when feature not found"
[RED]      Run tests → FAIL: "Expected 404, received undefined"
[GREEN]    Add route handler that returns 404 for missing features
[GREEN]    Run tests → PASS
[REFACTOR] Extract error response to shared utility
[REFACTOR] Run tests → PASS
[RED]      Write: "it should return feature when found"
[RED]      Run tests → FAIL: "Expected feature object, received 404"
[GREEN]    Add lookup logic to handler
[GREEN]    Run tests → PASS
[REFACTOR] Extract lookup to service layer
[REFACTOR] Run tests → PASS
```

Each cycle should be small — minutes, not hours.
