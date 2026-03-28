# /fix — Bug Fix with Auto-Detected Complexity

## Usage

```
/fix [bug description or error message]
```

## Behavior

Automatically detects bug complexity and applies the appropriate fix strategy. Supports direct bug descriptions, error messages, and CI failure logs.

### Complexity Detection Heuristic

Before fixing, classify the bug:

| Signal                            | Complexity        |
| --------------------------------- | ----------------- |
| Single file likely affected       | Simple            |
| Typo, off-by-one, missing import  | Simple            |
| Logic bug, state management issue | Standard          |
| 2-4 files affected                | Standard          |
| Auth/security involved            | Complex (minimum) |
| Schema/migration change needed    | Complex           |
| 5+ files affected                 | Complex           |
| Race condition, concurrency issue | Complex           |
| Multi-service interaction         | Complex           |

### Execution by Complexity

#### Simple (typo, off-by-one, missing import)

1. Identify the issue directly from the description or error.
2. Apply the fix.
3. Run existing tests to confirm no regressions.
4. Done. (Gate 1 bypassed per gate-rules — the fix IS the plan.)

#### Standard (logic bug, state issue)

1. Write a regression test that reproduces the bug (test must FAIL before fix).
2. Apply the fix.
3. Run all tests — regression test and existing tests must pass.
4. Done.

#### Complex (architectural, multi-file, race condition)

1. Create a plan first (run `/meow:plan` for the fix).
2. Wait for Gate 1 approval.
3. Write regression test(s) — TDD cycle.
4. Implement fix.
5. Run `/meow:review` (Gate 2 applies).
6. Ship via `/meow:ship`.

#### CI Failure

1. Parse CI logs to identify the failing step and error.
2. Trace the error to the source file(s).
3. Classify as simple/standard/complex using heuristics above.
4. Apply the appropriate fix strategy.

#### Log-Based

1. Parse the provided error log.
2. Extract: error type, stack trace, affected file(s), line number(s).
3. Trace to source code.
4. Classify and apply the appropriate fix strategy.

### Output

- For simple: the fix itself + test results.
- For standard: regression test + fix + test results.
- For complex: full pipeline output (plan → test → fix → review → ship).
