# /fix — Bug Fix with Auto-Detected Complexity

## Usage

```
/fix [bug description or error message]
/fix [bug description] --tdd      # Force regression test before the fix
```

## Flags

- `--tdd` — Force regression test BEFORE the fix (writes the `.claude/session-state/tdd-mode` sentinel via Bash). Useful for security-sensitive bugs where you want to prove the bug exists with a failing test before fixing it. Default: regression tests are recommended but not gated.
- `--no-capture` — Suppress Step 6 memory capture for throwaway one-line fixes. Default: capture is on for Standard and Complex paths; Simple path captures only when the bug class is novel.

## Behavior

Automatically detects bug complexity and applies the appropriate fix strategy. Supports direct bug descriptions, error messages, and CI failure logs.

**TDD mode (`--tdd` / `MEOWKIT_TDD=1`):** Standard and Complex paths require a failing regression test before the fix (RED phase enforced). Even Simple fixes get a regression test in TDD mode.

**Default mode:** The Standard path recommends a regression test but doesn't gate on it. Simple fixes proceed directly. Complex fixes still require a plan (Gate 1).

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

1. Write a regression test that reproduces the bug.
   - **TDD mode (`--tdd` / `MEOWKIT_TDD=1`):** test MUST FAIL before fix (RED phase enforced).
   - **Default mode:** regression test recommended but not gated; you may skip it for time-sensitive fixes (reviewer may flag at Gate 2).
2. Apply the fix.
3. Run all tests — regression test (if written) and existing tests must pass.
4. Done.

#### Complex (architectural, multi-file, race condition)

1. Create a plan first (run `/mk:plan` for the fix).
2. Wait for Gate 1 approval.
3. Write regression test(s) — TDD cycle if `--tdd` / `MEOWKIT_TDD=1` set; otherwise write tests when convenient (recommended even in default mode for security-sensitive fixes).
4. Implement fix.
5. Run `/mk:review` (Gate 2 applies).
6. Ship via `/mk:ship`.

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

- For simple: the fix itself + test results. Memory capture optional (novel bug class only).
- For standard: regression test + fix + test results + Step 6 memory capture.
- For complex: full pipeline output (plan → test → fix → review → ship) + Step 6 memory capture.

### Step 6 — Capture (MANDATORY for standard/complex, unless `--no-capture`)

After tests pass and before yielding:

1. **Edit `.claude/memory/fixes.md`** — append a section using the live schema (read the file first to match heading style):

    ```
    ## <YYYY-MM-DD> — <bug-class slug> (severity: low|medium|high|critical)

    - Symptom: <one line>
    - Root cause: <one line>
    - Fix: <one line + file paths>
    - Prevention: <regression test path OR architectural guard added>
    ```

2. **Edit `.claude/memory/fixes.json`** — under `patterns`, add or update one entry matching the live schema (`version: 2.0.0`, `scope: fixes`):

    ```json
    {
      "id": "<kebab-slug>",
      "type": "failure",
      "category": "bug-class",
      "severity": "low|medium|high|critical",
      "domain": ["<area1>", "<area2>"],
      "applicable_when": "<one line>",
      "context": "<one line>",
      "pattern": "<one line — what to do or avoid>",
      "frequency": 1,
      "lastSeen": "<YYYY-MM-DD>"
    }
    ```

3. **If the same `id` already exists**, increment `frequency` and update `lastSeen`. Do not duplicate entries.

4. **Do NOT use `##pattern:` prefixes.** That is a user-typed keyboard shortcut bound to UserPromptSubmit — it only fires when the human user types the prefix at the start of a message. Agent output does not trigger it. Always call `Edit` directly. See `.claude/skills/memory/references/capture-architecture.md`.

5. **Scrub secrets, tokens, and PII before writing.** `Edit` is not secret-scrubbed; the LLM is responsible.
