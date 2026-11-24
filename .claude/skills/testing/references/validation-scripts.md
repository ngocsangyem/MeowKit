# Validation scripts

Deterministic checks that do not depend on model judgment. They live in `mk:lint-and-validate`; this file says when to run them and what to expect.

## What the scripts do

Both are pattern scanners, not test or build runners.

| Script | Scope | Looks for |
|---|---|---|
| `.claude/skills/lint-and-validate/scripts/validate.py [dir]` | Every source file under the directory; writes a report file | Secret, `any`, SQL-interpolation and framework-guard patterns (per language) |
| `.claude/skills/lint-and-validate/scripts/security-scan.py [dir]` | The git-changed files, or the whole directory without git | The same family of security patterns |

Run them with `node .claude/hooks/lib/skill-python.cjs <script path> [dir]`. Exit code `0` means no BLOCK-level finding; `1` means at least one. WARN findings print but do not change the exit code. The scripts do not run the type checker, the linter, the tests or the build: for those use the project's own commands or `mk:verify`.

## When to run

Run them at review time and before shipping, or whenever you want a reproducible pattern check. The ship check enforces lint, related tests and a type-check on commit, push and merge; these scanners add a pattern check that it does not make. Treat a BLOCK finding as a defect to fix or to justify in the review, since a pattern match can be a false positive.

## Why a script

A script finds a `console.log` buried in a large diff every time, applies the same rules on every run, and cannot claim tests pass when they fail. Use its output as evidence next to the review, not instead of it.

## Extending

A new pattern goes in the matching `check_*` function of the script (`check_ts_js` for TypeScript and JavaScript, and its siblings per language); add one case the scanner flags and one it passes.
