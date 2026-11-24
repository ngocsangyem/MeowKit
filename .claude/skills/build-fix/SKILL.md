---
name: mk:build-fix
description: "Triages build, compile and type errors, then retries. NOT for mk:fix."
version: 1.0.0
argument-hint: '[error output or file path]'
source: local
allowed-tools:
  - Bash
  - Read
  - Edit
  - Glob
keywords:
  - build-fix
  - compile-error
  - type-error
  - build-failed
  - auto-retry
  - error-triage
when_to_use: "The build just failed."
user-invocable: true
owner: testing
criticality: medium
status: active
runtime: claude-code
---

# Build Fix

Goal: get a failing build, compile or type-check command to green with the smallest change, then confirm with `mk:verify`.

Detects the language from the error output, loads the matching reference, classifies each error by fixability, applies the fix, and chains into `mk:verify` to confirm the build is green.

## When to Use

- Build command fails (npm run build, tsc, go build, python -m build, cargo build), type-check errors (TypeScript TS\d{4}, mypy), or compilation errors in any language.
- Triggers: "build failed", "fix build", "compilation error", "type error".
- Not here: if the build passes and behavior is wrong, stop and use `mk:fix`; to find out why something fails without editing, use `mk:investigate`.

## Phase Anchor

**Phase: 3 (Build GREEN)**
**Handoff:** If `mk:verify` passes, proceed to Phase 4 (Review). If 3 attempts are exhausted, escalate to the user.

## Process

### Step 1: Capture Error Output

Run the failing build command and capture full output. If error output was passed as input,
use that directly.

### Step 2: Detect Language

Match error patterns in order (first match wins):

| Pattern | Language | Reference |
|---------|----------|-----------|
| `error TS\d{4}:` | TypeScript | `references/typescript-errors.md` |
| `SyntaxError:` or `ModuleNotFoundError:` or `IndentationError:` | Python | `references/python-errors.md` |
| `cannot find package` or `undefined: ` or `syntax error near` (Go) | Go | `references/general-errors.md` |
| `error[E\d{4}]` (Rust) | Rust | `references/general-errors.md` |
| Any other pattern | Unknown | `references/general-errors.md` |

Load the matched reference file before proceeding to Step 3.

### Step 3: Classify Error Fixability

After loading the reference, classify the error:

| Class | Description | Action |
|-------|-------------|--------|
| **auto-fixable** | Syntax errors, missing imports, simple type mismatches in the code | Apply the fix, then state the change in the report |
| **suggest-with-confidence** | Wrong argument types, missing interface properties; anything that kills a process, installs a dependency, changes a lockfile or deletes a cache or build directory | Ask the user first, then apply; these touch more than the source file |
| **report-only** | Runtime errors, architectural issues, circular dependencies | Describe the problem and root cause; do not edit |

**Auto-fixable examples:** TS1005 Expected semicolon, TS2307 Cannot find module (missing import)
**Suggest-with-confidence examples:** TS2322 type mismatch, TS2345 argument type mismatch
**Report-only examples:** Circular dependency, architectural type mismatch requiring refactor

### Step 4: Apply Fix

For auto-fixable and suggest-with-confidence:
- Apply the minimal change that resolves the error
- Do not refactor beyond what the error requires (YAGNI)
- Typing rules (no `any` as a fix) are in `.claude/rules/security-rules.md`; use `unknown` and type guards or fix the actual type.

For report-only:
- Describe what needs to change and why
- Stop — do not modify files
- Return the diagnosis to the developer

### Step 5: Verify Fix

Run `mk:verify` (or the project's build command directly if verify not available).

### Step 6: Iterate (Max 3 Attempts)

If the build still fails after applying a fix:
- Attempt 2: re-classify with updated error output, try different approach
- Attempt 3: re-classify one final time with a different approach

After 3 failed attempts, **escalate to user** with:
- All 3 error outputs
- All 3 attempted fixes and why each failed
- Suspected root cause
- Suggested next steps (architectural review, dependency update, etc.)

End the escalation report with the status block, BLOCKED when the three attempts failed:

```
**Status:** DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
**Summary:** [1-2 sentences]
**Concerns/Blockers:** [if applicable]
```

## Attempt Counter

This skill's own rule: max 3 self-healing attempts, then escalate. Track attempts in the session and reset the counter when switching to a different error.

## Reference Files

- `references/typescript-errors.md` — TS error codes with fix patterns
- `references/python-errors.md` — Python exception types with fix patterns
- `references/general-errors.md` — Framework-agnostic build error patterns

## Gotchas

- **Stale `.tsbuildinfo` hides real errors on warm incremental builds** — `tsc --incremental` skips files it thinks are unchanged; a corrupt or out-of-date `.tsbuildinfo` causes TS to report 0 errors while the actual output is broken; delete `.tsbuildinfo` and rerun `tsc --noEmit` before declaring the build clean.
- **Platform-specific native binaries fail silently after `npm ci` on a different OS** — packages like `esbuild`, `sharp`, `@swc/core` ship OS-specific binaries; a `node_modules/` copied from macOS to Linux (or via Docker volume mount) silently uses wrong binaries until a cryptic "invalid ELF header" or "exec format error" appears at runtime; always run `npm ci` fresh inside the container, never share `node_modules` across platforms.
- **Peer dependency warnings mask fatal version mismatches** — `npm install` prints peer dep warnings as non-fatal by default; a `eslint@8` peer warning can hide the real problem that `@typescript-eslint/parser@6` requires `eslint@8` but `9` is installed, causing `TypeError: eslint.linter is not a constructor` at runtime; always resolve peer warnings before treating the build as clean.
- **Different error output on cold vs warm cache means fixing the wrong error** — a first clean build often surfaces errors that incremental builds skip; fix errors only after a full clean build (`rm -rf dist .tsbuildinfo && tsc`) to ensure you're seeing the complete error set, not just the delta from last run.
- **Circular dependencies aren't caught by `tsc` but break bundlers at runtime** — TypeScript compiles circular imports without error; Vite/webpack may emit a broken bundle where one module resolves to `{}` because the other hadn't initialized yet; run `madge --circular src/` to detect cycles as part of build triage.
