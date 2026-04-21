# Project Detection

Detailed logic for detecting project type and selecting the correct verification commands.

## Contents

- [Detection Order](#detection-order)
- [JS/TS Sub-Type Detection](#jsts-sub-type-detection)
  - [Package Manager](#package-manager)
  - [Script Detection](#script-detection)
  - [Monorepo Detection](#monorepo-detection)
- [Coverage Threshold Detection](#coverage-threshold-detection)
  - [JS/TS](#jsts)
  - [Python](#python)
  - [Go](#go)
  - [Ruby](#ruby)
  - [Rust](#rust)
- [Unknown Project Type](#unknown-project-type)
- [Command Existence Check](#command-existence-check)


---

## Detection Order

Check marker files in this priority order. Stop at the first match.

```
1. Cargo.toml      → Rust
2. go.mod          → Go
3. pyproject.toml  → Python (modern)
4. setup.py        → Python (legacy) — use same commands as pyproject.toml
5. Gemfile         → Ruby
6. package.json    → JS/TS (check sub-type below)
```

If multiple markers exist (e.g., a Python project with a `package.json` for frontend tooling),
use the marker that matches the PRIMARY language of the codebase. When ambiguous, ask the user.

---

## JS/TS Sub-Type Detection

After detecting `package.json`, determine the package manager and available scripts:

### Package Manager

Check for lock files in this order:
1. `bun.lockb` → use `bun`
2. `pnpm-lock.yaml` → use `pnpm`
3. `yarn.lock` → use `yarn`
4. `package-lock.json` or none → use `npm`

### Script Detection

Read `package.json` scripts. Map to commands:

| Script key present | Command to run |
|--------------------|----------------|
| `build` | `{pm} run build` |
| `lint` | `{pm} run lint` |
| `typecheck` | `{pm} run typecheck` |
| `type-check` | `{pm} run type-check` |
| Neither typecheck nor type-check | `npx tsc --noEmit` (if `tsconfig.json` exists) |
| `test` | `{pm} test` |
| `test:coverage` | `{pm} run test:coverage` (preferred over `test` for coverage) |

Where `{pm}` = the detected package manager (npm/pnpm/yarn/bun).

### Monorepo Detection

If `workspaces` key exists in root `package.json`, or `pnpm-workspace.yaml` exists:
- Print: "Monorepo detected. Verifying from root — this runs all workspace checks."
- Run commands from root (most monorepos support this).
- If root scripts are missing: ask user which workspace(s) to verify.

---

## Coverage Threshold Detection

After detecting project type, locate the coverage threshold config:

### JS/TS
1. Check `jest.config.js` / `jest.config.ts` for `coverageThreshold.global.lines` (or `branches`, `functions`)
2. Check `.nycrc` or `.nycrc.json` for `lines` threshold
3. Check `vitest.config.ts` for `coverage.thresholds`
4. Fallback: 80%

### Python
1. Check `pyproject.toml` → `[tool.coverage.report]` → `fail_under`
2. Check `.coveragerc` → `[report]` → `fail_under`
3. Fallback: 80%

### Go
1. Run `go test ./... -coverprofile=coverage.out` then `go tool cover -func=coverage.out`
2. Parse total coverage from output. No config file — compare against default 80%.

### Ruby
1. Check `.simplecov` for `minimum_coverage` setting
2. Fallback: 80%

### Rust
1. Run `cargo tarpaulin --out Stdout` (if tarpaulin installed)
2. If tarpaulin not installed: skip coverage step, note in report: "Coverage: SKIPPED (tarpaulin not installed — run `cargo install cargo-tarpaulin`)"
3. Fallback threshold: 80%

---

## Unknown Project Type

If no marker file found:

1. Check git history: `git log --oneline -5` — may reveal language from file extensions in commits
2. Check file extensions in `src/` or `lib/` directory
3. If still unclear: ask user with AskUserQuestion:
   > "I couldn't detect your project type automatically. What commands should I use for:
   > - Build: ___
   > - Lint: ___
   > - Type-check: ___
   > - Test: ___"

Store the user's answers for the duration of the session. Do not re-ask.

---

## Command Existence Check

Before running any command, verify it exists to avoid confusing errors:

```bash
# Check if a script exists in package.json
node -e "const p = require('./package.json'); process.exit(p.scripts?.lint ? 0 : 1)"

# Check if a binary exists
command -v golangci-lint >/dev/null 2>&1
```

If a required tool is missing (e.g., `golangci-lint` not installed):
- Note it in the report: "Lint: SKIPPED (golangci-lint not found — install with `go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest`)"
- Continue to next step (do not fail the entire verification for a missing optional tool)
- Exception: if `build` or `test` commands are missing, that IS a failure.