---
benchmark_task: 04-refactor
tier: quick
target_seconds: 90
target_cost_usd: 0.60
rubric_preset: backend-api
---

# Task: Extract Helper from Duplicated Logic

A pre-existing module has the same date-formatting logic in three places:

```ts
// in user.ts
const fmt = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

// in order.ts (same code)
const fmt = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

// in invoice.ts (same code)
const fmt = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
```

Extract the formatter into a shared helper at `lib/format-date.ts` named `formatDateISO(date: Date): string`. Replace all three call sites. Add a test for the helper.

## Acceptance Criteria

- [ ] `lib/format-date.ts` exists and exports `formatDateISO`
- [ ] All three call sites (user.ts, order.ts, invoice.ts) import and use `formatDateISO` instead of inline string templates
- [ ] `lib/format-date.test.ts` has at least 3 tests covering: typical date, leap day, year boundary
- [ ] No behavior change at any call site
- [ ] No new dependencies added (do NOT install date-fns / dayjs / luxon)

## Notes

Tests the harness's ability to:
1. Identify duplication across files
2. Extract without breaking call sites
3. Resist over-engineering temptation (no library install)
4. Respect "no behavior change" constraint
