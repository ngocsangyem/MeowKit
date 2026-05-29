---
phase: 1
title: "Map search indexing"
status: pending
priority: P1
effort: "~1h"
dependencies: []
---

# Phase 1: Map search indexing

## Context Links

- (fixture)

## Overview

- **Priority:** P1
- **Status:** Pending
- **Effort:** ~1h
- **Depends on:** -
- **Description:** Document the bounded deep-mode map for search indexing.

## Key Insights

- Deep mode stores compact claims in phase files and raw scout detail in research reports.

## Requirements

### Functional
1. Map affected files, tests, interfaces, and dependencies.

### Non-Functional
- Keep phase map bounded.

## Architecture

Deep mode produces a phase-scoped map, not a repository-wide scan.

## Related Code Files

### Files to Create
- `src/search/indexer.ts`

### Files to Modify
- `src/search/query.ts` - consume indexer output

### Files to Read (Context)
- `tests/search/query.test.ts` - existing behavior coverage

## Deep Phase Map

### File Inventory

| Action | Path | Reason | Test Impact |
|---|---|---|---|
| Modify | `src/search/query.ts` | Existing query path | Existing query tests must still pass |

### Test Gap Matrix

| Behavior | Existing Coverage | Missing Coverage | Priority |
|---|---|---|---|
| Query result order | `tests/search/query.test.ts` | Index rebuild failure | High |

### Interface Checklist

- `search(query)` return shape remains unchanged.

### Dependency Map

- Query phase depends on indexer output being stable.

## Implementation Steps

1. Read existing query and index files.
2. Update phase map before implementation.

## Todo List

- [ ] Map search files
- [ ] Map search tests

## Success Criteria

1. Phase contains all four deep map subsections.

## Risk Assessment

| Risk | L | I | Mitigation |
|------|---|---|------------|
| Inventory bloat | M | M | Cap rows and summarize overflow |

## Security Considerations

- Do not include secret file contents in inventories.

## Next Steps

- Execute implementation from the bounded map.
