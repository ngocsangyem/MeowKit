# /test — TDD Enforcement

## Usage

```
/test [optional: specific test file or pattern]
/test --coverage
/test --watch
/test --red-only
```

## Behavior

Runs TDD enforcement. Ensures tests exist before implementation and reports results.

### Execution Steps

1. **Determine scope.** If a specific file or pattern is provided, target those tests. Otherwise, detect the current feature context and target related tests.

2. **Check if tests exist** for the current feature/change.

   **If NO tests exist:**
   - Write failing tests first (Phase 2 — RED).
   - Tests must target the feature's expected behavior as defined in the approved plan.
   - Each test must: run successfully, target a specific behavior, and produce a FAIL result.
   - Compilation errors do NOT count as failing tests (per tdd-rules).
   - Print: number of tests written and confirmation all are RED.

   **If tests exist:**
   - Run the test suite.
   - Report results: total, passed, failed, skipped.
   - If any fail: print failure details with file, line, expected vs actual.

3. **TDD Rules Enforcement** (from `rules/tdd-rules.md`):
   - No implementation code before a failing test exists.
   - After implementation, ALL existing tests must pass (not just new ones).
   - If tests fail after implementation: self-heal up to 3 attempts.
   - After 3 failed attempts: stop and escalate to human with failing output, attempted fixes, and suspected root cause.
   - Test coverage for new code should match or exceed the project's existing coverage percentage.
   - During refactoring: re-run tests after every change.

### Flags

| Flag | Behavior |
|------|----------|
| `--coverage` | Run tests with coverage report. Show: line coverage %, branch coverage %, uncovered files/lines. |
| `--watch` | Continuous test mode. Re-run affected tests on every file save. |
| `--red-only` | Write failing tests but do NOT implement. Used by `/cook` in Phase 2 to generate the RED test suite before Phase 3 implementation. |

### Output

- Test results: total, passed, failed, skipped
- For `--red-only`: list of tests written with confirmation all FAIL
- For `--coverage`: coverage report with percentages
- For failures: detailed output with file, line, expected vs actual
