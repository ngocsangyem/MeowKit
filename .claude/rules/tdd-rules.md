# TDD Enforcement Rules

**TDD enforcement is OPT-IN.** Default mode: tests are recommended but not gated (the rules in "When TDD is disabled" apply). Strict mode: enable via `--tdd` flag on commands OR `export MEOWKIT_TDD=1` (the rules in "When TDD is enabled" apply).

Why optional: matches user feedback that strict TDD adds friction for spike work, tooling, and prototypes. Production-quality work should still enable `--tdd`.

## When TDD is enabled (`MEOWKIT_TDD=1` or `--tdd`)

These rules apply to all implementation work in strict mode. No exceptions unless explicitly noted.

1. **No implementation before a failing test.** No implementation code may be written before a failing test exists for the feature.

1b. **MICRO-TASK exemption.** Code classified as MICRO-TASK by the orchestrator is exempt from TDD even in strict mode. MICRO-TASK means:

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

**Plan-creator integration:** `--tdd` composes with plan-creator modes (e.g., `--hard --tdd`, `--deep --tdd`). When enabled, plan-creator injects 4 TDD sections per phase file: Tests Before, Refactor Opportunities, Tests After, Regression Gate. See `meow:plan-creator workflow.md` variable `tdd_mode`.

## When TDD is disabled (default)

- Tests are good practice; the tester agent writes them when invoked but does NOT block the developer
- No RED-phase gate; the developer may implement directly per the approved plan
- The `pre-implement.sh` hook is a no-op (exits 0 silently)
- All other quality rules STILL APPLY: `security-rules.md`, `injection-rules.md`, Gate 1, Gate 2, naming, code quality, review verdict
- "Tests must pass before commit" from `development-rules.md` STILL APPLIES **IF tests exist** — you just don't have to write them first
- Reviewer may flag missing tests as a WARN at Gate 2; user decides whether to address before ship

**To opt back in:** add `export MEOWKIT_TDD=1` to your shell rc, OR pass `--tdd` per command, OR write `on` to `.claude/session-state/tdd-mode` (the slash command does this when `--tdd` is detected).
