# /cook — 7-Phase Pipeline (Orient → Plan → Test → Build → Review → Ship → Reflect)

## Usage

```
/cook [feature description]
/cook [plan-path]
/cook [feature description] --tdd        # Strict TDD enforced
```

## Flags

- `--tdd` — Enable strict TDD mode for this run. Equivalent to `export MEOWKIT_TDD=1` (but mechanism is a sentinel file, see "TDD mode dispatch" below). Tester writes failing tests before implementation; `pre-implement.sh` blocks edits without RED tests; developer waits on tester. **Default: OFF.**

## TDD mode dispatch (MANDATORY when `--tdd` is in invocation)

If the user invocation contains `--tdd`, your **FIRST action** before any other workflow step is to write the TDD sentinel file via a Bash tool call:

```bash
mkdir -p .claude/session-state && echo on > .claude/session-state/tdd-mode
```

This sentinel persists for the session. Hooks (`pre-implement.sh`), the helper (`tdd-detect.sh`), and downstream agents (developer, tester) read it to detect TDD mode. Without this sentinel, the workflow runs in default mode where Phase 2 is optional.

**Why a sentinel file?** Env vars set in one Bash tool call don't propagate to subsequent tool calls in Claude Code (each Bash invocation spawns a fresh subshell). Filesystem state does. The sentinel is the load-bearing mechanism — do not skip writing it.

`MEOWKIT_TDD=1` env var (set in CI / shell rc) is the highest-precedence opt-in and overrides the sentinel.

## Behavior

Runs MeowKit's 7-phase workflow from planning through shipping. The user intervenes at Gate 1 (plan approval) and Gate 2 (review approval). All other phases proceed automatically.

**TDD mode (post-migration):** TDD enforcement is OPT-IN. In default mode, Phase 2 is optional and the developer implements directly per the approved plan. Pass `--tdd` (or set `MEOWKIT_TDD=1` in your shell) to enable strict RED-phase enforcement.

### Execution Phases

0. **Phase 0 — Orient.** Detect intent, declare model tier, read memory.
   - Print: `Phase 0: Orient — Mode [X], Tier [Y]`

1. **Phase 1 — Plan.** Run `meow:plan-creator` with the feature description.
   - Print: `Phase 1: Planning...`
   - Wait for **Gate 1 approval** from the human.
   - If rejected, revise plan and re-request approval.

2. **Phase 2 — Test.**
   - **TDD mode (`--tdd` / `MEOWKIT_TDD=1`):** Run `meow:testing --red-only` to write failing tests.
     - Print: `Phase 2: Writing failing tests...`
     - Tests target behaviors from the approved plan's acceptance criteria.
     - Tests must run and FAIL (not compilation errors — actual test failures).
   - **Default mode (TDD off):** Phase 2 is OPTIONAL. Skip the tester invocation unless the user explicitly requests tests or unless plan acceptance criteria require coverage.
     - Print: `Phase 2: Skipped (TDD off — pass --tdd to enable)`

3. **Phase 3 — Build.** Write implementation code per the approved plan.
   - Print: `Phase 3: Implementing...`
   - **TDD mode:** implement only enough to make failing tests pass (GREEN). Self-heal up to 3 attempts (per tdd-rules.md). After 3 failures, escalate to human.
   - **Default mode:** implement directly per the plan. The `pre-implement.sh` hook is a no-op. Tests are recommended but not gated.
   - After tests pass (in TDD mode), optionally refactor (re-run tests after every change).

4. **Phase 4 — Review.** Run `meow:review` for 5-dimension structural audit.
   - Print: `Phase 4: Reviewing...`
   - Wait for **Gate 2 approval** from the human. No exceptions — even in auto mode.
   - If any dimension is FAIL, block shipping. Fix issues and re-review.

5. **Phase 5 — Ship.** Run `meow:ship` after Gate 2 approval.
   - Print: `Phase 5: Shipping...`
   - Conventional commit → PR → CI verification.

6. **Phase 6 — Reflect.** Update docs, sync plan, write memory.
   - Print: `Phase 6: Reflecting...`
   - Project-manager sync-back across all plan phases.
   - Docs-manager updates if changes warrant.
   - Memory write: lessons learned this session.

### Status Output

Each phase prints its status:

```
Phase 0: Orient — Mode interactive, Tier STANDARD
Phase 1: Planning...             Plan approved
Phase 2: Writing failing tests...  4 tests written, all RED
Phase 3: Implementing...           All tests GREEN
Phase 4: Reviewing...              Review 8.5/10, Gate 2 approved
Phase 5: Shipping...               PR #42 created, CI green
Phase 6: Reflecting...             Sync-back done, docs updated, memory written
```

### Human Intervention Points

- **Gate 1** (after Phase 1): Approve/reject/revise the plan.
- **Gate 2** (after Phase 4): Approve/reject the review verdict, acknowledge WARNs.

All other phases proceed automatically. Gate 2 is NEVER auto-approved.
