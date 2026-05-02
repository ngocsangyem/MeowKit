---
title: "mk:verify"
description: "Unified verification loop: build → lint → type-check → tests → coverage. Fails fast on first failure. Auto-called by mk:cook."
---

# mk:verify

Runs build, lint, type-check, tests, and coverage in sequence. Fails fast on first failure. Produces a single PASS/FAIL verdict with per-step results. NOT for lint/format only (use `mk:lint-and-validate`); NOT for test-to-requirement mapping (use `mk:nyquist`).

## When to use

- After Phase 3 (Build GREEN), before Phase 4 (Review)
- Before creating a PR (`mk:ship` pre-flight)
- Standalone: "is everything green?", "run all checks", "verify build"

## Project detection

Auto-detects project type from marker files in order:

| Marker | Language | Build | Lint | Type-check | Test | Coverage |
|---|---|---|---|---|---|---|
| `package.json` | JS/TS | `npm run build` | `npm run lint` | `tsc --noEmit` | `npm test` | coverage threshold |
| `pyproject.toml` | Python | `python -m build` | `ruff check .` | `mypy .` | `pytest` | coverage threshold |
| `go.mod` | Go | `go build ./...` | `golangci-lint run` | (built-in) | `go test ./...` | coverage report |
| `Cargo.toml` | Rust | `cargo build` | `cargo clippy` | (built-in) | `cargo test` | `cargo tarpaulin` |

If unknown project type → asks user for commands to run.

## Phase anchor

Phase: 3→4 transition (Build → Review). Handoff: PASS → `mk:review`. FAIL → developer fixes, re-run verify.
