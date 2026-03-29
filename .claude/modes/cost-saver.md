# Mode: Cost-Saver

## Activation

Activate with: `mode: cost-saver` in task context or by specifying cost-saver mode at session start.

## Configuration

- **Phases**: All 6 phases active but with reduced overhead.
- **Gate 1 (Plan)**: Enforced. Planning is never skipped.
- **Gate 2 (Review)**: Simplified. Auto-approve if tests pass and no security BLOCKs (same as fast mode).
- **Security checks**: BLOCK-level checks only. No WARN-level scanning.
- **Model routing**: Always cheapest model tier. No escalation for complexity.
- **Test coverage**: No minimum threshold.
- **Disabled checks**: Visual QA, comprehensive audit, full 5-dimension review. Only basic correctness and security BLOCK checks run.

## Keeps Active

Even in cost-saver mode, these are never disabled:
- Basic test execution (tests must still pass)
- Gate 1 (planning)
- Security BLOCK checks (critical security patterns are always caught)

## When to Use

- High-volume routine tasks (many small changes)
- Cost-constrained environments with limited API budget
- Batch processing of simple fixes
- Internal tooling with low risk tolerance requirements
- When `/budget --monthly` shows costs exceeding targets

## What's Different from Default

| Aspect | Default | Cost-Saver |
|--------|---------|-----------|
| Model routing | Standard (tier-based) | Always cheapest |
| Gate 2 | Human approval | Auto-approve if tests pass + no BLOCKs |
| Security | Full (BLOCK + WARN) | BLOCK only |
| Visual QA | Active | Disabled |
| Comprehensive audit | Active | Disabled |
| 5-dimension review | Full | Basic correctness + security only |

## Trade-offs

Lower cost comes at the expense of reduced review depth. Use for low-risk work only. Monitor `memory/cost-log.json` to track savings.
