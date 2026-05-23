---
phase: 3
title: "Result ranker"
status: pending
priority: P2
effort: "~1h"
dependencies: [2]
---

# Phase 3: Result ranker

## Context Links

- Phase 2 returns Vec<DocId>.

## Overview

- **Priority:** P2
- **Status:** Pending
- **Effort:** ~1h
- **Depends on:** Phase 2
- **Description:** Re-rank match IDs by BM25 score.

## Key Insights

- BM25 is Tantivy's default; rerank is a wrapper.

## Requirements

### Functional
1. Compute BM25 score per doc.

### Non-Functional
- Ranker latency ≤ 10ms per 100 docs.

## Architecture

Pure function — takes scored IDs, returns sorted by score desc.

## Related Code Files

### Files to Create
- `src/search/ranker.rs`

### Files to Modify
- `src/search/query.rs` — call ranker before returning

### Files to Read (Context)
- Tantivy BM25 docs

## Implementation Steps

1. Implement `rerank(matches: Vec<Match>) -> Vec<Match>`.
2. Sort by score descending.

## Todo List

- [ ] Implement rerank
- [ ] Wire into query.rs

## Success Criteria

1. `cargo test ranker::orders_by_score` passes.

## Risk Assessment

| Risk | L | I | Mitigation |
|------|---|---|------------|
| Score ties order non-determinism | L | L | Secondary sort by doc-id |

## Security Considerations

- N/A.

## Next Steps

- Done.
