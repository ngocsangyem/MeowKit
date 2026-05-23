---
phase: 1
title: "Protect ranking behavior"
status: pending
priority: P1
effort: "~1h"
dependencies: []
tdd: true
regression_gate: "npm test -- ranking"
---

# Phase 1: Protect ranking behavior

## Context Links

- (fixture)

## Overview

- **Priority:** P1
- **Status:** Pending
- **Effort:** ~1h
- **Depends on:** -
- **Description:** Capture existing ranking behavior before refactor.

## Key Insights

- TDD mode writes failing tests before implementation and keeps the regression gate explicit.

## Requirements

### Functional
1. Preserve equal-score ranking order.

### Non-Functional
- Tests must fail for behavior, not syntax.

## Architecture

Tests define the behavior contract before the refactor.

## Related Code Files

### Files to Create
- `tests/search/ranking.test.ts`

### Files to Modify
- `src/search/ranking.ts` - refactor after RED tests

### Files to Read (Context)
- `src/search/ranking.ts` - current behavior

## Implementation Steps

1. Write failing tests for equal-score ranking.
2. Refactor ranking implementation.

## Tests Before

- [ ] `ranking_preserves_equal_score_order` - fails before protected behavior is implemented.

## Protected Change

- Refactor `src/search/ranking.ts` while preserving equal-score order.

## Tests After

- [ ] `ranking_handles_empty_results` - verifies edge case behavior.

## Regression Gate

```bash
npm test -- ranking
```

## Todo List

- [ ] Write RED ranking test
- [ ] Refactor ranking code

## Success Criteria

1. `npm test -- ranking` passes after implementation.

## Risk Assessment

| Risk | L | I | Mitigation |
|------|---|---|------------|
| Tests pass for wrong reason | M | H | Confirm RED failure before implementation |

## Security Considerations

- No security-sensitive data in ranking fixtures.

## Next Steps

- Handoff to cook with `--tdd`.
