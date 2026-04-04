---
rating: WARN
files: statusline.cjs, settings.json
---

# Statusline Code Review

**Rating: WARN** (2 suggestions, 0 blockers)

## High

1. **Lock race (L81-100)** -- `existsSync` + `writeFileSync` not atomic. Two concurrent renders can both acquire lock. Fix: use `wx` flag on `writeFileSync` in try/catch.

2. **Dead retry code (L173-175)** -- Catch block re-reads same file that just failed. Remove inner duplicate try/catch.

## Medium

3. **cwd not validated (L33/L85)** -- `cwd` from stdin passed to `execFileSync` without path check. Low risk (Claude controls stdin) but defense-in-depth says validate against projectDir.

4. **No maxBuffer on git status (L88)** -- Large repos could exceed 1MB default. Add `maxBuffer: 256*1024`.

## Low

5. **JSON.parse throws on bad input (L30)** -- Handled by outer catch. No action needed.

## Positive

- Zero deps, `execFileSync` (no shell injection), session ID regex, 5s cache TTL, graceful fallback on all errors.

## Performance

Cache hit: <10ms (fs reads only). Cache miss: ~1s worst case (2 git calls @ 500ms timeout). Fits 300ms cycle after first call.
