---
name: mk:verify
description: "One pass of build, lint, test, coverage. NOT for mk:lint-and-validate."
version: 1.0.0
argument-hint: "[--full] [--coverage-threshold N] [--skip-build] [--skip-coverage]"
source: local
allowed-tools:
  - Bash
  - Read
  - Glob
keywords:
  - verify
  - build-check
  - lint-test-typecheck
  - coverage
  - unified-verification
  - pre-ship
when_to_use: "Is it green?"
user-invocable: true
owner: lifecycle
criticality: high
status: active
runtime: claude-code
---

# Verify — Unified Verification Loop

Runs build → lint → type-check → tests → coverage in sequence. Fails fast on first failure.
Produces a single PASS/FAIL verdict with per-step results.

## When to Use

- After Phase 3 (Build GREEN) completes, before Phase 4 (Review)
- Before creating a PR (`mk:ship` pre-flight)
- Standalone: "is everything green?", "run all checks", "verify build"

## Phase Anchor

**Phase: 3→4 transition (Build → Review)**
**Handoff:** If PASS → proceed to `mk:review`. If FAIL → developer fixes, re-run verify.

## Project Detection and Scope

Detect the project type from its marker files and choose commands per `references/project-detection.md`, which holds the command table, the marker rule (primary language; ask when mixed or when no marker is found) and the changed-file set.

By default the skill checks what changed, so a post-change run stays fast: lint and tests run on the changed files (tests only those related to them); build and type-check stay whole-program, because a partial build or type-check misses cross-file breakage; coverage is skipped and reported `SCOPED`. `--full` runs every step across the whole project, for releases and CI. With no git, or no changed files, run the whole project.

On a machine where `mewkit host status` works (beta), run build and test steps through `mewkit host run -- <command>` and read exit 75 as not verified, per `references/heavy-commands.md`; elsewhere run them directly.

The ship check mirrors this at commit, push and merge time: lint on changed files, related tests and a type-check. It is not a whole-project gate; use `--full` for one.

## Process (Fail Fast)

Execute each step in order. **Stop immediately on first failure** — do not continue to the next step.

1. **Resolve scope**: collect the changed files (reference). Lint and tests run against the changed set; build and type-check run whole-program; `--full` runs every step across the whole project.
2. **Detect** the project type from its marker files
3. **Build** — compile/bundle the project (whole-program)
4. **Lint** — static analysis on the changed files (whole project under `--full`)
5. **Type-check** — static type validation, whole-program (if applicable to language)
6. **Test** — run tests related to the changed files (full suite under `--full`)
7. **Coverage** — `--full` only (a related-tests run does not reflect global coverage)

## Coverage Threshold

1. Check project config for threshold (`.nycrc`, `jest.config`, `pyproject.toml [tool.coverage]`, etc.)
2. If no project config: use **80%** as a fallback
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

In scoped (default) mode, Lint and Tests note the changed-file count and Coverage shows
`SCOPED`:

```
- Lint:       PASS (3 changed files, 0 errors)
- Tests:      PASS (related to 3 changed files — 18 passed, 0 failed)
- Coverage:   SCOPED (run with --full for global coverage)
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

| Flag                     | Effect                                                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `--full`                 | Check the whole project (build+lint+test+coverage across all files). Use for releases/CI. Default is changed-files scope |
| `--coverage-threshold N` | Override coverage threshold with N%                                                                                      |
| `--skip-build`           | Skip build step (use if build runs separately)                                                                           |
| `--skip-coverage`        | Skip coverage check (use for quick verification)                                                                         |

## Gotchas

- **Config changes escalate to `--full`:** when the changed set includes build/lint/type/test
  config or dependencies (`package.json`, lockfiles, `tsconfig*`, ESLint/Prettier config,
  `jest`/`vitest`/`pytest`/`ruff` config, CI workflows, oxlint), scoping is unsafe — those affect the
  whole project. Run the whole project instead.
- **Deleted-only changes:** if the changed set is only deletions/renames with no surviving
  source files, related-tests scoping finds nothing — fall back to `--full` to confirm nothing
  downstream broke.
- **Package manager detection:** For JS/TS, check for `pnpm-lock.yaml`, `yarn.lock`, or `bun.lockb` before defaulting to `npm`
- **Monorepo:** If multiple `package.json` found, ask user which workspace to verify or run from root
- **Type-check for Go/Rust:** Covered by the build step — mark as PASS if build passed
- **Coverage for Ruby:** `.simplecov` config may not exist; default to 80% threshold if missing
- **Flaky tests:** re-run a failing test once to separate a flake from a regression; report the retry
