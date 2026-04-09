# /test — Test Runner & TDD Enforcement (opt-in)

## Usage

```
/test [optional: specific test file or pattern]
/test --coverage
/test --watch
/test --red-only         # Force RED-phase semantics (writes failing tests, no implementation)
/test --tdd              # Run with TDD enforcement explicitly enabled for this invocation
```

## Behavior

Runs the test suite. **TDD enforcement is opt-in**: with `--tdd` (or when `MEOWKIT_TDD=1` is set), the command enforces RED-phase semantics — failing tests must exist before implementation. Without `--tdd`, the command runs tests when invoked but does NOT block the developer.

For backward compatibility, `--red-only` still forces the RED-phase write-failing-tests behavior regardless of mode (used by `/meow:cook` Phase 2 in TDD mode).

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

3. **TDD Rules Enforcement** (only when `--tdd` / `MEOWKIT_TDD=1` — see `rules/tdd-rules.md`):
   - No implementation code before a failing test exists.
   - After implementation, ALL existing tests must pass (not just new ones).
   - If tests fail after implementation: self-heal up to 3 attempts.
   - After 3 failed attempts: stop and escalate to human with failing output, attempted fixes, and suspected root cause.
   - Test coverage for new code should match or exceed the project's existing coverage percentage.
   - During refactoring: re-run tests after every change.

   **In default mode (TDD off):** the rules above do NOT apply. Tests may be written before, alongside, or after the implementation. The "tests must pass" rule from `development-rules.md` still applies IF tests exist.

### Flags

| Flag | Behavior |
|------|----------|
| `--coverage` | Run tests with coverage report. Show: line coverage %, branch coverage %, uncovered files/lines. |
| `--watch` | Continuous test mode. Re-run affected tests on every file save. |
| `--red-only` | Write failing tests but do NOT implement. Used by `/meow:cook --tdd` in Phase 2 to generate the RED test suite before Phase 3 implementation. |
| `--tdd` | Enforce TDD discipline for this invocation. Equivalent to writing the `.claude/session-state/tdd-mode` sentinel. RED-phase rules in `tdd-rules.md` apply. |

### Output

- Test results: total, passed, failed, skipped
- For `--red-only`: list of tests written with confirmation all FAIL
- For `--coverage`: coverage report with percentages
- For failures: detailed output with file, line, expected vs actual
