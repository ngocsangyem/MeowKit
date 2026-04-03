# TDD Enforcement Rules

These rules apply to all implementation work in MeowKit. No exceptions unless explicitly noted.

## Rules

1. **No implementation before a failing test.** No implementation code may be written before a failing test exists for the feature.

1b. **MICRO-TASK exemption.** Code classified as MICRO-TASK by the orchestrator is exempt from TDD. MICRO-TASK means:
   - (a) Not production-facing (tests, scripts, tooling, docs, configs) AND
   - (b) Less than 30 lines AND
   - (c) Orchestrator explicitly classifies as MICRO-TASK

   This is distinct from TRIVIAL in model-selection-rules.md (which means cosmetic-only: rename, typo, format). MICRO-TASK covers non-production code that has logic but doesn't need test coverage.

   WHY: Scripts, configs, and tooling don't benefit from TDD. Requiring tests for a 15-line migration script wastes time without improving quality.

   GUARD: Production-facing code ALWAYS requires TDD regardless of size. When in doubt, require TDD.

2. **Failing test definition.** A "failing test" means a test that:
   - Runs successfully (no compilation/syntax errors)
   - Targets the feature's expected behavior
   - Produces a FAIL result
   - Compilation errors do NOT count as failing tests

3. **All tests must pass after implementation.** After implementation, ALL existing tests must pass — not just the new ones. No regressions allowed.

4. **Self-healing limit: 3 attempts.** If tests fail after implementation, the developer agent attempts self-healing up to 3 times. Each attempt should try a different approach, not repeat the same fix.

5. **Escalation after 3 failures.** After 3 failed self-healing attempts, work stops and the issue is escalated to a human with:
   - Failing test output (exact error messages)
   - List of attempted fixes and why each failed
   - Suspected root cause
   - Suggested next steps

6. **Coverage threshold.** Test coverage for new code should match or exceed the project's existing coverage percentage. If the project has 75% coverage, new code must have at least 75% coverage.

7. **Refactoring phase.** After tests pass, the developer may refactor but must re-run ALL tests after every refactoring change. No "batch refactor then test" — test after each change.
