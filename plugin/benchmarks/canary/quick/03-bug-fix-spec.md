---
benchmark_task: 03-bug-fix
tier: quick
target_seconds: 60
target_cost_usd: 0.40
rubric_preset: backend-api
---

# Task: Fix Off-by-One in Pagination

A pre-existing function `getPage(items, page, perPage)` has an off-by-one error: it returns the wrong slice for `page=1`.

The fixture (provided in the canary harness):

```ts
function getPage<T>(items: T[], page: number, perPage: number): T[] {
  // BUG: this returns items 0..perPage-1 even when page > 1
  return items.slice(0, perPage);
}
```

Fix the bug AND add a test that proves it.

## Acceptance Criteria

- [ ] `getPage(items, 1, 5)` returns items [0..4]
- [ ] `getPage(items, 2, 5)` returns items [5..9]
- [ ] `getPage(items, 3, 5)` returns items [10..14]
- [ ] At least 3 tests cover the cases above
- [ ] No regressions to existing call sites (the harness simulates one)

## Notes

Tests the harness's ability to:
1. Diagnose a single-file bug from a pre-existing test failure
2. Apply a minimal fix
3. Add regression tests
4. NOT over-engineer (don't refactor the whole pagination system)
