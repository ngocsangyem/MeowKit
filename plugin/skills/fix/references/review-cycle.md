# Review Cycle

Mode-aware review handling for reviewer agent results.

## Autonomous Mode

Auto mode auto-FIXES; it never auto-APPROVES. The loop terminates in a
"ready for user approval" state — crossing Gate 2 or any ship boundary always
requires explicit human approval (`.claude/rules/gate-rules.md`). Score is
advisory display only and never gates the decision.

```
cycle = 0
LOOP:
  1. Run reviewer agent → score, critical_count, warnings (score is display-only)

  2. IF critical_count > 0 AND cycle < 3:
     → Auto-fix critical issues
     → Re-run tests
     → cycle++, GOTO LOOP

  3. ELSE IF cycle >= 3 AND critical_count > 0:
     → ESCALATE to user
     → Options: "Fix manually" / "Approve anyway" / "Abort"

  4. ELSE (no critical remaining):
     → Log any warnings + evidence completeness
     → PRESENT for user approval (do NOT self-approve, do NOT cross Gate 2/ship)
```

High-risk flags (AUTH, AUTHZ, DATA_MODEL, AUDIT_SEC, EXT_SYSTEM,
PUBLIC_CONTRACT, WEAK_PROOF from `.claude/rules/risk-checklist.md`) force
explicit human approval before finalize regardless of cycle outcome.

## Human-in-the-Loop Mode

```
ALWAYS:
  1. Run reviewer agent → score, critical_count, warnings

  2. Display findings to user

  3. AskUserQuestion:
     IF critical_count > 0:
       - "Fix critical issues"
       - "Fix all issues"
       - "Approve anyway"
       - "Abort"
     ELSE:
       - "Approve"
       - "Fix warnings/suggestions"
       - "Abort"

  4. Handle response:
     - Fix → implement, re-test, re-review (max 3 cycles)
     - Approve → proceed
     - Abort → stop workflow
```

## Quick Mode Review

Same as Autonomous but:
- Only 1 auto-fix cycle before escalate
- Focus: correctness, security, no regressions
- Still terminates in "ready for user approval" — score never gates; no self-approve

## Critical Issues (Always Block)

- Security vulnerabilities (XSS, SQL injection, OWASP)
- Performance bottlenecks (O(n^2) when O(n) possible)
- Architectural violations
- Data loss risks
- Breaking changes without migration
