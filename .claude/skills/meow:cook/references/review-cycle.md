# Code Review Cycle

Review-fix cycle for Gate 2 enforcement. Gate 2 requires human approval in ALL modes.

## Interactive Cycle (max 3 cycles)

```
cycle = 0
LOOP:
  1. Spawn code-reviewer subagent → score, critical_count, warnings, suggestions

  2. Run .claude/skills/meow:cook/scripts/validate-gate-2.sh (if available)

  3. DISPLAY FINDINGS:
     Review: [score]/10
     Critical ([N]): MUST FIX — [list with file:line]
     Warnings ([N]): SHOULD FIX — [list with file:line]
     Suggestions ([N]): NICE TO HAVE — [list]

  4. AskUserQuestion (header: "Gate 2"):
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
     → AskUserQuestion: "Approve with noted issues" / "Abort workflow"
```

## Auto-Handling Cycle

Auto mode auto-FIXES but does NOT auto-APPROVE Gate 2.

```
cycle = 0
LOOP:
  1. Spawn code-reviewer → score, critical_count, warnings

  2. IF critical_count > 0 AND cycle < 3:
     → Auto-fix critical issues
     → Re-run tester to verify fix
     → cycle++, LOOP

  3. ELSE IF critical_count > 0 AND cycle >= 3:
     → ESCALATE TO USER (cannot auto-approve)

  4. ELSE (no critical):
     → Present findings to user for Gate 2 approval
     → AskUserQuestion (header: "Gate 2"): "Approve" / "Fix warnings" / "Abort"

  GATE 2 ALWAYS REQUIRES HUMAN APPROVAL. NO EXCEPTIONS.
  Auto mode only automates the fix loop, not the approval.
```

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
