# Canary 7 — `--deep` happy path

**Mode:** deep
**Fixture:** caller-provided (see `eval/README.md` → "Deep-mode fixture")

## Input

```
the prompt-enhancer skill --deep "add caching to /api/products"
```

(invoke from inside the fixture repo)

## Expected

### Decomposition

| Component | Status |
|---|---|
| Goal | partial (verb + object, no metric) |
| Context | partial (mentions /api/products) |
| Constraints | missing |
| Acceptance Criteria | missing |
| Output Format | missing |

### Issues found

- #1 Goal vague (no metric)
- #3 No constraints
- #4 No acceptance criteria
- #5 No output format

### Suggested context (deep-mode sub-block)

≥1 hit, including at minimum:

- `[FILL-IN: endpoint path]` → suggested: `src/api/products.ts`
- `[FILL-IN: cache backend]` → suggested: `src/lib/redis.ts`

### Footer

```
> Deep-mode footer: codebase snapshot `<sha>`; docs/project-context.md last
> updated YYYY-MM-DD.
```

### HARD-FAIL conditions

- Suggestions appear OUTSIDE `[FILL-IN]` brackets (auto-substituted).
- Saved output contains code body from the fixture (not just paths/symbols).
- Footer missing or sha mismatch with fixture baseline.

### Notes

- Sections 1–3 should match a default-mode run on the same input (canary #10
  validates this).
- The caller-provided fixture MUST be at the baseline sha recorded in
  `baseline-results.md` before this canary runs (STALE_BASELINE check).
