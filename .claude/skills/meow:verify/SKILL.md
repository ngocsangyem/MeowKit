---
name: meow:verify
description: "Unified verification: build→lint→test→type-check→coverage. Use for 'is everything green', 'run all checks', 'verify build'. Auto-called by meow:cook."
version: 1.0.0
argument-hint: "[--coverage-threshold N] [--skip-build] [--skip-coverage]"
source: meowkit
allowed-tools:
  - Bash
  - Read
  - Glob
---

# Verify — Unified Verification Loop

Runs build → lint → type-check → tests → coverage in sequence. Fails fast on first failure.
Produces a single PASS/FAIL verdict with per-step results.

## When to Activate

- After Phase 3 (Build GREEN) completes, before Phase 4 (Review)
- Before creating a PR (`meow:ship` pre-flight)
- Standalone: "is everything green?", "run all checks", "verify build"

## Phase Anchor

**Phase: 3→4 transition (Build → Review)**
**Handoff:** If PASS → proceed to `meow:review`. If FAIL → developer fixes, re-run verify.

## Project Detection

Detect project type by checking for marker files in this order:

| Marker File | Language | Build | Lint | Type-check | Test | Coverage |
|-------------|----------|-------|------|------------|------|----------|
| `package.json` | JS/TS | `npm run build` | `npm run lint` | `npm run typecheck` or `tsc --noEmit` | `npm test` | `.nycrc` or `jest.config` threshold |
| `pyproject.toml` | Python | `python -m build` | `ruff check .` or `flake8` | `mypy .` | `pytest` | `pyproject.toml` coverage threshold |
| `go.mod` | Go | `go build ./...` | `golangci-lint run` | (built-in to build) | `go test ./...` | coverage report |
| `Gemfile` | Ruby | `bundle exec rake build` | `rubocop` | (N/A) | `bundle exec rspec` | `.simplecov` |
| `Cargo.toml` | Rust | `cargo build` | `cargo clippy` | (built-in to build) | `cargo test` | `cargo tarpaulin` |

**Multiple markers found:** Use the most specific one (e.g., `Cargo.toml` over `package.json` if both exist in a mixed repo).

**No marker found:** Ask user — "What build and test commands should I use for this project?"

See `references/project-detection.md` for detailed detection logic and edge cases.

## Process (Fail Fast)

Execute each step in order. **Stop immediately on first failure** — do not continue to the next step.

1. **Detect** project type from marker files
2. **Build** — compile/bundle the project
3. **Lint** — static analysis and style checks
4. **Type-check** — static type validation (if applicable to language)
5. **Test** — run full test suite
6. **Coverage** — check coverage meets threshold

## Coverage Threshold

1. Check project config for threshold (`.nycrc`, `jest.config`, `pyproject.toml [tool.coverage]`, etc.)
2. If no project config: use default **80%**
3. If `--coverage-threshold N` flag provided: override with N%

## Output Format

```
## Verification Report

- Build:      PASS (npm run build, 4.2s)
- Lint:       PASS (0 errors, 2 warnings)
- Type-check: PASS (0 errors)
- Tests:      PASS (142 passed, 0 failed, 3 skipped)
- Coverage:   PASS (87% vs 80% threshold)

**Overall: PASS** — ready for review
```

Failure example (stops after lint):
```
## Verification Report

- Build:      PASS (npm run build, 3.8s)
- Lint:       FAIL (3 errors in src/auth.ts:12, src/user.ts:45)
- Type-check: SKIPPED (lint failed)
- Tests:      SKIPPED (lint failed)
- Coverage:   SKIPPED (lint failed)

**Overall: FAIL** — fix lint errors before proceeding

Errors:
  src/auth.ts:12  error  'password' is assigned but never used  no-unused-vars
  src/user.ts:45  error  Expected '===' but saw '=='            eqeqeq
```

## Flags

| Flag | Effect |
|------|--------|
| `--coverage-threshold N` | Override coverage threshold with N% |
| `--skip-build` | Skip build step (use if build runs separately) |
| `--skip-coverage` | Skip coverage check (use for quick verification) |

## Gotchas

- **Package manager detection:** For JS/TS, check for `pnpm-lock.yaml`, `yarn.lock`, or `bun.lockb` before defaulting to `npm`
- **Monorepo:** If multiple `package.json` found, ask user which workspace to verify or run from root
- **Type-check for Go/Rust:** Covered by the build step — mark as PASS if build passed
- **Coverage for Ruby:** `.simplecov` config may not exist; default to 80% threshold if missing
- **Flaky tests:** If tests fail intermittently, re-run once before reporting FAIL
