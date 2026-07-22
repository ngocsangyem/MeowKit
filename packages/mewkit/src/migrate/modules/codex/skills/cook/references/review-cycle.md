# Code Review Cycle

Review-fix cycle for Gate 2 enforcement. Gate 2 requires human approval in ALL modes.

## Interactive Cycle (max 3 cycles)

```
cycle = 0
LOOP:
  1. Spawn reviewer sub-task → score, critical_count, warnings, suggestions

  2. Run .agents/skills/cook/scripts/validate-gate-2.sh (if available)

  3. DISPLAY FINDINGS:
     Review: [score]/10
     Critical ([N]): MUST FIX — [list with file:line]
     Warnings ([N]): SHOULD FIX — [list with file:line]
     Suggestions ([N]): NICE TO HAVE — [list]

  4. stop and ask the user in chat (header: "Gate 2"):
     IF critical_count > 0:
       - "Fix critical issues" → fix, re-run tester, cycle++, LOOP
       - "Fix all issues" → fix all, re-run tester, cycle++, LOOP
       - "Approve anyway" → PROCEED (human override documented)
       - "Abort" → stop
     ELSE:
       - "Approve" → PROCEED
       - "Fix warnings/suggestions" → fix, cycle++, LOOP
       - "Abort" → stop

  5. IF cycle >= 3 AND user selects fix:
     → "3 review cycles completed. Final decision required."
     → stop and ask the user in chat: "Approve with noted issues" / "Abort workflow"
```

## Auto-Handling Cycle

Auto mode auto-FIXES but does NOT auto-APPROVE Gate 2.

```
cycle = 0
LOOP:
  1. Spawn reviewer → score, critical_count, warnings

  2. IF critical_count > 0 AND cycle < 3:
     → Auto-fix critical issues
     → Re-run tester to verify fix
     → cycle++, LOOP

  3. ELSE IF critical_count > 0 AND cycle >= 3:
     → ESCALATE TO USER (cannot auto-approve)

  4. ELSE (no critical):
     → Present findings to user for Gate 2 approval
     → stop and ask the user in chat (header: "Gate 2"): "Approve" / "Fix warnings" / "Abort"

  GATE 2 ALWAYS REQUIRES HUMAN APPROVAL. NO EXCEPTIONS.
  Auto mode only automates the fix loop, not the approval.
```

Before presenting Gate 2 (either cycle), the workflow evidence index must be complete: run `validate-gate-2.sh` (authoritative structural guard) AND `node .codex/scripts/validate-workflow-evidence.cjs <path> --phase cook` (completeness mirror). Surface both; neither approves — they gate on structure/completeness only. See `workflow-steps.md` → Workflow Evidence Index.

## Regression Recovery Options

When the reviewer surfaces a regression, side effect, or broken workflow (verdict includes `Side Effects Detected: Yes` OR a FAIL dimension citing existing-behavior break):

1. **DO NOT silently patch.** Auto-fix loops are for code that the agent introduced and got wrong; they are not for fixing impact on existing callers.
2. **STOP** the iteration loop.
3. **Present 2–4 concrete options** to the user via the inner harness's clarifying-question surface (whichever interactive prompt mechanism the runtime exposes). Standard options (offer when applicable):
   - Revert this slice and re-plan with stricter scope
   - Keep the implementation and update `<dependents>` to match the new contract
   - Add a compatibility shim at `<boundary>` so old callers keep working
   - Accept the regression — old behavior was unintended/buggy
4. **Record the user's selection** in the verdict file as a `## User Decision Addendum` block including `User selected:` and `Resumption point:` lines. The `validate-gate-2.sh` script blocks the verdict until this addendum is present (positive-presence-only signal; absence of the original side-effect line is never a block).
5. **Resume** based on the user's choice: revert → return to Phase 1; keep + update dependents → Phase 3 with broader scope; compat shim → Phase 3 with shim added; accept → Gate 2 PASS with the trade-off documented in the addendum.

This pattern preserves the user's decision-making authority on cross-cutting changes and prevents silent scope expansion.

## Critical Issues (Always Block)

- Security: XSS, SQL injection, OWASP vulnerabilities
- Performance: O(n^2) when O(n) possible, N+1 queries
- Architecture violations: wrong layer, broken boundaries
- Data loss risks: CASCADE DELETE without approval
- Breaking changes without migration path

## Output Formats

- Waiting: `Phase 4: Review [score]/10 — WAITING for Gate 2 approval`
- After fix: `Phase 4: [old]/10 → Fixed [N] issues → [new]/10 — Gate 2 approved`
- Approved: `Phase 4: Review [score]/10 — Gate 2 approved by user`
