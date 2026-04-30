---
title: "mk:verify"
description: "Unified verification: build→lint→type-check→test→coverage in sequence, failing fast on first error."
---

# mk:verify

Single "is everything green?" check — runs build → lint → type-check → tests → coverage in sequence, fails fast on first error.

## What This Skill Does

`mk:verify` exists because developers run these checks in different orders, skip steps under time pressure, and interpret "the tests pass" as "the build is green" — which it isn't. A passing test suite with lint errors and a broken type-check is not a green build.

This skill enforces the **ECC pattern** (Every Check Counts): all five verification steps run in a fixed order, and the sequence stops at the first failure. You get one unified report — one PASS or FAIL — not five separate tool invocations to interpret separately. Skipped steps are listed explicitly so the report is always self-explanatory.

`mk:cook` calls `mk:verify` automatically at the Phase 3→4 transition. `mk:ship` calls it as pre-flight before creating a PR. You can also invoke it standalone to answer "is everything green?" without running the full pipeline.

## Core Capabilities

- **Project detection** — Identifies language from marker files; handles JS/TS, Python, Go, Ruby, Rust
- **Fail-fast sequence** — Stops at first failure; downstream steps show SKIPPED, not fake PASSes
- **Coverage threshold** — Reads from project config (`.nycrc`, `jest.config`, `pyproject.toml`); defaults to 80% if unset
- **Unified report** — Single PASS/FAIL verdict with per-step timing and error details
- **Package manager detection** — Checks for `pnpm-lock.yaml`, `yarn.lock`, `bun.lockb` before defaulting to `npm`

## When to Use This

::: tip Use mk:verify when...
- After implementation, before requesting a review
- Before merging or creating a PR (pre-flight check)
- Standalone: "is everything green?" without running the full cook pipeline
- Auto-called by `mk:cook` (Phase 3→4) and `mk:ship` (pre-flight)
:::

::: warning Don't use mk:verify when...
- You only need to run a single check — call the tool directly instead of the full sequence
- You're in a monorepo and need workspace-level verification — ask which workspace first
:::

## Usage

```bash
# Run full verification sequence
/mk:verify

# Override coverage threshold to 90%
/mk:verify --coverage-threshold 90

# Skip build step (if build runs in CI separately)
/mk:verify --skip-build

# Quick check without coverage
/mk:verify --skip-coverage
```

## Project Detection

Detect project type by checking for marker files in this order (first match wins):

| Marker File | Language | Build | Lint | Type-check | Test |
|-------------|----------|-------|------|------------|------|
| `package.json` | JS/TS | `npm run build` | `npm run lint` | `npm run typecheck` or `tsc --noEmit` | `npm test` |
| `pyproject.toml` | Python | `python -m build` | `ruff check .` or `flake8` | `mypy .` | `pytest` |
| `go.mod` | Go | `go build ./...` | `golangci-lint run` | built-in to build | `go test ./...` |
| `Gemfile` | Ruby | `bundle exec rake build` | `rubocop` | N/A | `bundle exec rspec` |
| `Cargo.toml` | Rust | `cargo build` | `cargo clippy` | built-in to build | `cargo test` |

Multiple markers found: use the most specific one (e.g., `Cargo.toml` over `package.json` in a mixed repo). No marker found: ask the user what build and test commands to use.

## Verification Sequence

Execute each step in order. Stop immediately on first failure — do not continue:

1. **Detect** project type from marker files
2. **Build** — compile or bundle the project; catches missing imports and broken modules
3. **Lint** — static analysis and style checks; catches code quality issues before running tests
4. **Type-check** — static type validation (Go/Rust: covered by build step, marked PASS if build passed)
5. **Test** — full test suite; only runs if all prior steps pass
6. **Coverage** — checks threshold from config or flag; final gate before reporting PASS

## Output Format

Pass example:
```
## Verification Report

- Build:      PASS (npm run build, 4.2s)
- Lint:       PASS (0 errors, 2 warnings)
- Type-check: PASS (0 errors)
- Tests:      PASS (142 passed, 0 failed, 3 skipped)
- Coverage:   PASS (87% vs 80% threshold)

**Overall: PASS** — ready for review
```

Fail example (stops after lint):
```
## Verification Report

- Build:      PASS (npm run build, 3.8s)
- Lint:       FAIL (3 errors in src/auth.ts:12, src/user.ts:45)
- Type-check: SKIPPED (lint failed)
- Tests:      SKIPPED (lint failed)
- Coverage:   SKIPPED (lint failed)

**Overall: FAIL** — fix lint errors before proceeding
```

## Integration

- **`mk:cook`** — calls `mk:verify` automatically after Phase 3 (Build GREEN) completes. If FAIL, developer fixes and re-runs before Phase 4 can begin.
- **`mk:ship`** — calls `mk:verify` as pre-flight before creating a commit or PR. A FAIL blocks the ship.
- **`mk:build-fix`** — calls `mk:verify` after each fix attempt to confirm the build is actually green.

## Gotchas

- **Unknown project type**: If no marker file is found, the skill asks rather than guessing. Wrong commands produce misleading results.
- **Missing lint script**: Some `package.json` files have no `lint` script. Check before running; skip with a WARN if absent rather than FAIL.
- **Coverage threshold mismatch**: Project may have per-directory thresholds in `jest.config`. The skill reads the global threshold; per-file overrides are not checked.
- **Flaky tests**: If tests fail intermittently, re-run once before reporting FAIL. Mark the re-run in the report.
- **Monorepo**: Multiple `package.json` files found — ask the user which workspace to verify, or run from the root if a root-level test script exists.

## Related

- [`mk:cook`](/reference/skills/cook) — Calls verify at Phase 3→4 transition
- [`mk:ship`](/reference/skills/ship) — Calls verify as pre-flight before PR creation
- [`mk:build-fix`](/reference/skills/build-fix) — Chains into verify after each fix attempt
- [`mk:testing`](/reference/skills/testing) — TDD reference for writing the tests verify runs
