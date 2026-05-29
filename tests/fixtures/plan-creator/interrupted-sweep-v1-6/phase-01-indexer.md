---
phase: 1
title: "Indexer setup"
status: pending
priority: P1
effort: "~1h"
dependencies: []
---

# Phase 1: Indexer setup

## Context Links

- (no research yet)

## Overview

- **Priority:** P1
- **Status:** Pending
- **Effort:** ~1h
- **Depends on:** —
- **Description:** Wire up the Tantivy index for the documents collection.

## Key Insights

- Tantivy supports incremental updates.

## Requirements

### Functional
1. Index all existing documents on first run.

### Non-Functional
- Indexing throughput ≥ 500 docs/sec.

## Architecture

Single writer, multi-reader. Index files stored under `data/index/`.

## Related Code Files

### Files to Create
- `src/search/indexer.rs`

### Files to Modify
- `src/main.rs` — register the indexer worker

### Files to Read (Context)
- `docs/data-model.md`

## Implementation Steps

1. Add `tantivy = "0.21"` to `Cargo.toml`.
2. Implement `Indexer::build_from_collection`.

## Todo List

- [ ] Add dependency
- [ ] Implement build_from_collection

## Success Criteria

1. `cargo test indexer::tests::build` passes.

## Risk Assessment

| Risk | L | I | Mitigation |
|------|---|---|------------|
| Index file corruption | L | H | Atomic-rename on commit |

## Security Considerations

- No PII in document text fields; safe to index.

## Next Steps

- Phase 2 consumes the index.

## Validation Log

### Whole-Plan Consistency Sweep — 2026-05-23T19:38:00Z
- Files reread: plan.md, phase-01-indexer.md, phase-02-query.md, phase-03-ranker.md
- Decision deltas checked: 1
- Reconciled stale references: 1
- Unresolved contradictions: 0
- NOTE: plan.md frontmatter `consistency_sweeps.validation` NOT written (interrupted before atomicity sentinel step).
