---
phase: 2
title: "Query handler"
status: pending
priority: P1
effort: "~1h"
dependencies: [1]
---

# Phase 2: Query handler

## Context Links

- Phase 1 index location: `data/index/`

## Overview

- **Priority:** P1
- **Status:** Pending
- **Effort:** ~1h
- **Depends on:** Phase 1
- **Description:** Accept user queries and return raw match results.

## Key Insights

- Tantivy QueryParser handles boolean operators by default.

## Requirements

### Functional
1. Parse user query string.
2. Return match-doc IDs.

### Non-Functional
- Query latency p95 ≤ 50ms.

## Architecture

Stateless handler over the indexer's reader.

## Related Code Files

### Files to Create
- `src/search/query.rs`

### Files to Modify
- `src/api/routes.rs` — add `/search`

### Files to Read (Context)
- `src/search/indexer.rs`

## Implementation Steps

1. Build QueryParser bound to indexed fields.
2. Implement `search(q: &str)` returning Vec<DocId>.

## Todo List

- [ ] Add QueryParser
- [ ] Wire /search route

## Success Criteria

1. `curl /search?q=foo` returns JSON list of IDs.

## Risk Assessment

| Risk | L | I | Mitigation |
|------|---|---|------------|
| Malformed query crashes handler | M | M | Catch parse errors, return 400 |

## Security Considerations

- Reject query strings > 1KB to limit DoS.

## Next Steps

- Phase 3 ranks the IDs.
