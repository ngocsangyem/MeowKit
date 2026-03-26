# Review Cycle

Mode-aware review handling for reviewer agent results.

## Autonomous Mode

```
cycle = 0
LOOP:
  1. Run reviewer agent → score, critical_count, warnings

  2. IF score >= 9.5 AND critical_count == 0:
     → Auto-approve, PROCEED

  3. ELSE IF critical_count > 0 AND cycle < 3:
     → Auto-fix critical issues
     → Re-run tests
     → cycle++, GOTO LOOP

  4. ELSE IF cycle >= 3:
     → ESCALATE to user
     → Options: "Fix manually" / "Approve anyway" / "Abort"

  5. ELSE (no critical, score < 9.5):
     → Approve with warnings logged, PROCEED
```

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
- Lower threshold: score >= 8.5 acceptable
- Only 1 auto-fix cycle before escalate
- Focus: correctness, security, no regressions

## Critical Issues (Always Block)

- Security vulnerabilities (XSS, SQL injection, OWASP)
- Performance bottlenecks (O(n^2) when O(n) possible)
- Architectural violations
- Data loss risks
- Breaking changes without migration
