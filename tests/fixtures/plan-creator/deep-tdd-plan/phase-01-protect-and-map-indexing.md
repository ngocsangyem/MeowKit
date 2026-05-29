---
phase: 1
title: "Protect and map indexing"
status: pending
priority: P1
effort: "~1.5h"
dependencies: []
tdd: true
regression_gate: "npm test -- search"
---

# Phase 1: Protect and map indexing

## Context Links

- (fixture)

## Overview

- **Priority:** P1
- **Status:** Pending
- **Effort:** ~1.5h
- **Depends on:** -
- **Description:** Combine bounded deep context with RED-first regression coverage.

## Key Insights

- Deep mode supplies the scope map; TDD supplies the regression gate.

## Requirements

### Functional
1. Preserve search API behavior while extracting indexing logic.

### Non-Functional
- Keep phase context compact and testable.

## Architecture

Phase map drives the refactor order; TDD protects behavior before code changes.

## Related Code Files

### Files to Create
- `src/search/indexer.ts`
- `tests/search/indexer.test.ts`

### Files to Modify
- `src/search/query.ts` - call extracted indexer

### Files to Read (Context)
- `tests/search/query.test.ts` - existing query contract

## Deep Phase Map

### File Inventory

| Action | Path | Reason | Test Impact |
|---|---|---|---|
| Modify | `src/search/query.ts` | Existing API path | Query tests must pass |
| Create | `src/search/indexer.ts` | Extract indexer | New unit test required |

### Test Gap Matrix

| Behavior | Existing Coverage | Missing Coverage | Priority |
|---|---|---|---|
| Query API response | `tests/search/query.test.ts` | Extracted indexer unit test | High |

### Interface Checklist

- `GET /search` payload stays unchanged.
- `SearchResult.score` remains numeric.

### Dependency Map

- Query behavior depends on indexer extraction preserving result order.

## Implementation Steps

1. Write RED tests for query API preservation.
2. Extract indexer and wire query path.

## Tests Before

- [ ] `search_api_preserves_payload` - fails before extracted indexer is wired.

## Protected Change

- Extract `src/search/indexer.ts` and update `src/search/query.ts`.

## Tests After

- [ ] `indexer_handles_empty_collection` - verifies extracted edge case.

## Regression Gate

```bash
npm test -- search
```

## Todo List

- [ ] Write RED search API test
- [ ] Extract indexer

## Success Criteria

1. `npm test -- search` passes after implementation.

## Risk Assessment

| Risk | L | I | Mitigation |
|------|---|---|------------|
| Deep map and tests drift | M | M | Keep interface checklist aligned with test names |

## Security Considerations

- Fixtures contain synthetic paths only.

## Next Steps

- Cook with `--tdd` after Gate 1.
