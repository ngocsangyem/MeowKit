# Code Review Cycle

The review-fix cycle for Phase 4. The reviewer writes a verdict file in every mode; this
page is how the findings get acted on before shipping.

## Contents

- [Interactive Cycle (max 3 cycles)](#interactive-cycle-max-3-cycles)
- [Auto-Handling Cycle](#auto-handling-cycle)
- [Returned Work (`--advice` runs only)](#returned-work---advice-runs-only)
- [Regression Recovery Options](#regression-recovery-options)
- [Critical Issues (Always Block)](#critical-issues-always-block)
- [Output Formats](#output-formats)

## Interactive Cycle (max 3 cycles)

```
cycle = 0
LOOP:
  1. Spawn reviewer subagent → score, critical_count, warnings, suggestions

  2. DISPLAY FINDINGS:
     Review: [score]/10
     Critical ([N]): MUST FIX — [list with file:line]
     Warnings ([N]): SHOULD FIX — [list with file:line]
     Suggestions ([N]): NICE TO HAVE — [list]

  3. AskUserQuestion (header: "Review"):
     IF critical_count > 0:
       - "Fix critical issues" → fix, re-run tester, cycle++, LOOP
       - "Fix all issues" → fix all, re-run tester, cycle++, LOOP
       - "Ship as is" → PROCEED (record the trade-off in the verdict)
       - "Abort" → stop
     ELSE:
       - "Continue" → PROCEED
       - "Fix warnings/suggestions" → fix, cycle++, LOOP
       - "Abort" → stop

  4. IF cycle >= 3 AND user selects fix:
     → "3 review cycles completed. Final decision required."
     → AskUserQuestion: "Continue with noted issues" / "Abort workflow"
```

## Auto-Handling Cycle

Auto mode fixes what it can and does not pause.

```
cycle = 0
LOOP:
  1. Spawn reviewer → score, critical_count, warnings

  2. IF critical_count > 0 AND cycle < 3:
     → Auto-fix critical issues
     → Re-run tester to verify fix
     → cycle++, LOOP

  3. ELSE IF critical_count > 0 AND cycle >= 3:
     → ESCALATE TO USER — three cycles did not clear the criticals

  4. ELSE (no critical):
     → Record the verdict path in the run summary and continue
```

Either cycle: the workflow evidence index should name the verdict path and the verification
commands that ran, so the run can be retraced afterwards. See `workflow-steps.md` →
Workflow Evidence Index.

## Returned Work (`--advice` runs only)

A `RETURN_TO_EXECUTOR` from the REVIEW checkpoint is **not** a review verdict and
does not enter this cycle as one. It fires BEFORE the reviewer is spawned:

1. Route each required correction to its current owner — planner, developer, tester,
   whoever owns that artifact. Never to Athena, which cannot edit anything.
2. The owner addresses each correction or records why it is rejected.
3. Supersede the stale evidence and re-run the normal checks
   (`workflow-steps.md` → Advice Checkpoints). Phase 3.6 Verify runs again before the
   reviewer, because its previous output describes code that no longer exists.
4. RECHECK once. A second unresolved return escalates to a human — there is no third
   opinion, and the reviewer's own verdict is what Phase 4 produces either way.

Athena never emits PASS/WARN/FAIL and never records a security finding of its own. It may
detect that the evidence contradicts itself and route the work back; the verdict
stays with `reviewer`, `evaluator` and `security`.

## Regression Recovery Options

When the reviewer surfaces a regression, side effect, or broken workflow (verdict includes `Side Effects Detected: Yes` OR a FAIL dimension citing existing-behavior break):

1. **DO NOT silently patch.** Auto-fix loops are for code that the agent introduced and got wrong; they are not for fixing impact on existing callers.
2. **STOP** the iteration loop.
3. **Present 2–4 concrete options** to the user via the inner harness's clarifying-question surface (whichever interactive prompt mechanism the runtime exposes). Standard options (offer when applicable):
   - Revert this slice and re-plan with stricter scope
   - Keep the implementation and update `<dependents>` to match the new contract
   - Add a compatibility shim at `<boundary>` so old callers keep working
   - Accept the regression — old behavior was unintended/buggy
4. **Record the user's selection** in the verdict file as a `## User Decision Addendum` block including `User selected:` and `Resumption point:` lines. A verdict that reports a side effect without this addendum is incomplete — the decision is the part a later reader needs.
5. **Resume** based on the user's choice: revert → return to Phase 1; keep + update dependents → Phase 3 with broader scope; compat shim → Phase 3 with shim added; accept → carry on with the trade-off documented in the addendum.

This pattern preserves the user's decision-making authority on cross-cutting changes and prevents silent scope expansion.

## Critical Issues (Always Block)

- Security: XSS, SQL injection, OWASP vulnerabilities
- Performance: O(n^2) when O(n) possible, N+1 queries
- Architecture violations: wrong layer, broken boundaries
- Data loss risks: CASCADE DELETE without approval
- Breaking changes without migration path

## Output Formats

- Waiting: `Phase 4: Review [score]/10 — awaiting the user's call on [N] findings`
- After fix: `Phase 4: [old]/10 → Fixed [N] issues → [new]/10 — verdict at [path]`
- Done: `Phase 4: Review [score]/10 — verdict at [path]`
