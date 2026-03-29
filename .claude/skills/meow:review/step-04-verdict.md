# Step 4: Verdict

Synthesize triaged findings into a 5-dimension verdict for Gate 2.

## Dimensions

| Dimension | PASS | WARN | FAIL |
|-----------|------|------|------|
| **Correctness** | No CRITICAL/MAJOR bugs | MINOR bugs only | Any CRITICAL bug |
| **Maintainability** | Clean, readable, follows conventions | Style issues, minor naming | Unreadable, violates architecture |
| **Performance** | No performance regressions | Potential issues flagged | Proven regression |
| **Security** | No security findings | MINOR security notes | Any CRITICAL security issue |
| **Coverage** | All ACs covered + tested | Partial AC coverage | Missing AC implementation |

## Verdict Rules

- **Any FAIL dimension** → Overall FAIL → Gate 2 blocks
- **All PASS** → Overall PASS → Gate 2 eligible
- **Mix of PASS/WARN** → Overall WARN → Gate 2 eligible with acknowledgment

## Presentation Format

```markdown
## Gate 2 Review Verdict

**Overall:** [PASS|WARN|FAIL]

| Dimension | Result | Summary |
|-----------|--------|---------|
| Correctness | [P/W/F] | [one-line] |
| Maintainability | [P/W/F] | [one-line] |
| Performance | [P/W/F] | [one-line] |
| Security | [P/W/F] | [one-line] |
| Coverage | [P/W/F] | [one-line] |

### Current-Change Findings ([count])
[findings list, CRITICAL first]

### Incidental Findings ([count]) — logged to backlog
[findings list, for awareness only]

### Reviewer Sources
- Blind Hunter: [N] findings
- Edge Case Hunter: [N] findings
- Criteria Auditor: [N] findings
```

## After Verdict

- **PASS/WARN:** Present to human for Gate 2 approval
- **FAIL:** List required fixes, route back to developer agent
