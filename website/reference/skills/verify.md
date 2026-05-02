---
title: "mk:verify"
description: "Unified verification: build -> lint -> test -> type-check -> coverage. Use for 'is everything green', 'run all checks', 'verify build'. Auto-called by mk:cook."
---

# mk:verify

## What This Skill Does

Runs a unified verification loop across five steps -- build, lint, type-check, tests, and coverage -- in sequence with fail-fast behavior. Auto-detects the project type (JS/TS, Python, Go, Ruby, Rust) from marker files and selects the correct commands for each step. Produces a single PASS/FAIL verdict with per-step timing and results. Serves as the quality gate between Phase 3 (Build) and Phase 4 (Review) and is auto-called by `mk:cook`.

## When to Use

- After Phase 3 (Build GREEN) completes, before Phase 4 (Review)
- Before creating a PR -- serves as the `mk:ship` pre-flight check
- Standalone: "is everything green?", "run all checks", "verify build"
- **NOT** for lint/format only -- use `mk:lint-and-validate`
- **NOT** for test-to-requirement coverage mapping -- use `mk:nyquist`

## Core Capabilities

- **Auto-detects project type:** Checks marker files in priority order: `Cargo.toml` > `go.mod` > `pyproject.toml` > `Gemfile` > `package.json`
- **Package manager detection:** For JS/TS, detects npm/pnpm/yarn/bun from lock files
- **TypeScript awareness:** Falls back to `tsc --noEmit` if no `typecheck` script in package.json
- **Monorepo support:** Detects workspace configs and runs from root by default
- **Coverage threshold detection:** Reads from jest.config, .nycrc, pyproject.toml, .simplecov, etc.; defaults to 80%
- **Fail-fast execution:** Stops immediately on first failure -- does not run later steps
- **Flaky test handling:** Re-runs tests once before reporting FAIL

## Arguments

| Flag | Effect |
|------|--------|
| _(no args)_ | Run full verification: build -> lint -> type-check -> tests -> coverage |
| `--coverage-threshold N` | Override coverage threshold with N% |
| `--skip-build` | Skip build step (use if build runs separately) |
| `--skip-coverage` | Skip coverage check (use for quick verification) |

## Workflow

1. **Detect project type** -- Check for marker files, determine language and tooling
2. **Build** -- Compile/bundle the project using the detected build command
3. **Lint** -- Run static analysis and style checks
4. **Type-check** -- Run static type validation (if applicable to language; Go/Rust is built-in to build step)
5. **Test** -- Run the full test suite
6. **Coverage** -- Check that coverage meets the threshold (from config or 80% default)

Each step runs in order. If any step fails, subsequent steps are SKIPPED and the verdict is FAIL.

## Project Detection

The skill auto-detects project type from marker files:

| Marker File | Language | Build | Lint | Type-check | Test | Coverage |
|-------------|----------|-------|------|------------|------|----------|
| `package.json` | JS/TS | `{pm} run build` | `{pm} run lint` | `{pm} run typecheck` or `tsc --noEmit` | `{pm} test` | jest/.nycrc config |
| `pyproject.toml` | Python | `python -m build` | `ruff check .` or `flake8` | `mypy .` | `pytest` | `pyproject.toml` threshold |
| `go.mod` | Go | `go build ./...` | `golangci-lint run` | (built-in to build) | `go test ./...` | coverage report |
| `Gemfile` | Ruby | `bundle exec rake build` | `rubocop` | N/A | `bundle exec rspec` | `.simplecov` |
| `Cargo.toml` | Rust | `cargo build` | `cargo clippy` | (built-in to build) | `cargo test` | `cargo tarpaulin` |

For JS/TS projects, the package manager is auto-detected from lock files: `bun.lockb` > `pnpm-lock.yaml` > `yarn.lock` > `package-lock.json` (fallback: npm).

If multiple marker files exist, the most specific one is used. If none found, the skill asks the user for commands.

## Usage

```bash
/mk:verify                              # Full verification (default 80% threshold)
/mk:verify --coverage-threshold 90      # Stricter coverage requirement
/mk:verify --skip-build                 # Skip build (already built)
/mk:verify --skip-coverage              # Quick check without coverage
```

## Example Prompt

> "I think I'm ready to open a PR. /mk:verify"

The skill detects a JS/TS project with pnpm, runs `pnpm run build` (PASS, 4.2s), `pnpm run lint` (PASS, 0 errors), `pnpm run typecheck` (PASS), `pnpm test` (PASS, 142 tests), and checks coverage (PASS, 87% vs 80% threshold). Outputs: **Overall: PASS -- ready for review**.

## Common Use Cases

- **Pre-PR quality gate:** Run all checks before opening a PR to avoid CI failures
- **CI pipeline simulation:** Run the same checks locally that CI would run
- **Quick sanity check:** Use `--skip-coverage` for fast iteration during development
- **Coverage enforcement:** Use `--coverage-threshold 90` to maintain high standards
- **Multi-language repos:** Skill auto-detects the primary language and runs appropriate checks

## Pro Tips

- **Run before `mk:review`** -- the verify step is the Phase 3->4 transition gate; PASS is required before review
- **Auto-called by `mk:cook`** -- you rarely need to invoke it directly during the full development workflow
- **If tests fail intermittently**, the skill auto-retries once before marking FAIL
- **For monorepos**, the skill runs from root by default; if root scripts are missing, it asks which workspace to verify
- **Missing optional tools** (e.g., `golangci-lint`) are SKIPPED with a note -- they don't fail the entire verification
- **Coverage for Rust** requires `cargo-tarpaulin`; if not installed, coverage is SKIPPED with an install note

> **Canonical source:** `.claude/skills/verify/SKILL.md`
