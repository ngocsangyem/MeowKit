# Code Review Cycle

Interactive review-fix cycle used in cook workflows.

## Interactive Cycle (max 3 cycles)

```
cycle = 0
LOOP:
  1. Run reviewer agent → score, critical_count, warnings

  2. Display findings:
     Review: [score]/10
     Critical ([N]): [list]
     Warnings ([N]): [list]
     Suggestions ([N]): [list]

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

  4. Handle:
     Fix → implement, re-test, re-review (cycle++, max 3)
     Approve → proceed
     Abort → stop
```

## Auto-Handling Cycle

```
  IF score >= 9.5 AND critical_count == 0: Auto-approve
  ELSE IF critical > 0 AND cycle < 3: Auto-fix, re-test, retry
  ELSE IF cycle >= 3: ESCALATE to user
  ELSE (no critical, score < 9.5): Approve with warnings
```

## Critical Issues (Always Block)

- Security: XSS, SQL injection, OWASP vulnerabilities
- Performance: O(n^2) when O(n) possible
- Architecture violations
- Data loss risks
- Breaking changes without migration
