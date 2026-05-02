---
title: "mk:build-fix"
description: "Universal build error resolver — detects language, loads fix patterns, classifies by fixability, auto-retries up to 3 attempts. Chains into mk:verify."
---

# mk:build-fix — Build Error Triage

## What This Skill Does

Automatically triages and fixes build errors across multiple languages. Detects language from error output, loads the appropriate error reference, classifies each error by fixability (auto-fixable / suggest-with-confidence / report-only), applies minimal fixes, verifies the build passes, and iterates up to 3 times before escalating.

**NOT for:** runtime errors (`mk:fix`), architectural debugging (`mk:investigate`).

## When to Use

- Build fails (`npm run build`, `tsc`, `go build`, `cargo build`)
- Type check errors (`TS\d{4}`, mypy)
- Compilation errors in any language
- **Triggers:** "build failed", "fix build", "compilation error", "type error"

## Arguments

`[error output or file path]`

## Core Capabilities

### 6-Step Process

**Step 1: Capture Error Output** — Run the failing build command, capture full output. Or use error output passed as input.

**Step 2: Detect Language** — Match patterns in order (first match wins):

| Pattern | Language | Reference |
|---|---|---|
| `error TS\d{4}:` | TypeScript | `references/typescript-errors.md` |
| `SyntaxError:` / `ModuleNotFoundError:` / `IndentationError:` | Python | `references/python-errors.md` |
| `cannot find package` / `undefined: ` (Go) | Go | `references/general-errors.md` |
| `error[E\d{4}]` (Rust) | Rust | `references/general-errors.md` |
| Any other pattern | Unknown | `references/general-errors.md` |

**Step 3: Classify Error Fixability:**

| Class | Description | Action |
|---|---|---|
| **auto-fixable** | Syntax errors, missing imports, simple type mismatches | Apply fix immediately |
| **suggest-with-confidence** | Wrong argument types, missing interface properties | Propose fix, apply after brief explanation |
| **report-only** | Runtime errors, structural issues, circular dependencies | Describe problem + root cause; do NOT auto-fix |

**Auto-fixable examples:** TS1005 (missing semicolon), TS2307 (cannot find module), TS7006 (implicit any). **Suggest examples:** TS2322 (type mismatch), TS2345 (argument mismatch). **Report-only examples:** Circular dependency, architectural mismatch requiring refactor.

**Step 4: Apply Fix** — Minimal change that resolves the error. No refactoring beyond what the error requires (YAGNI). NEVER use `any` — use `unknown` + type guards.

**Step 5: Verify Fix** — Run `mk:verify` (or project build command if verify not available).

**Step 6: Iterate (Max 3)** — Re-classify with updated errors, try different approaches. After 3 failures, escalate with: all 3 error outputs, all 3 attempted fixes and why each failed, suspected root cause, suggested next steps (architectural review, dependency update, etc.).

### Error Reference Files

**TypeScript (`references/typescript-errors.md`):**

| Error | Message | Class | Fix |
|---|---|---|---|
| TS1005 | Expected X | auto-fixable | Missing `;`, `)`, `}`, `>` — count pairs |
| TS2304 | Cannot find name | auto-fixable | Add import or correct typo |
| TS2307 | Cannot find module | auto-fixable | Install package or fix path |
| TS2322 | Type not assignable | suggest | Narrow source type or widen target |
| TS2339 | Property does not exist | suggest | Typo, add to interface, optional chaining |
| TS2345 | Argument not assignable | suggest | Fix arg type at call site |
| TS7006 | Implicit 'any' parameter | auto-fixable | Add explicit type annotation |
| TS2531 | Object possibly null | suggest | Null check, optional chaining |
| TS2532 | Object possibly undefined | suggest | Null check, nullish coalescing |
| TS2554 | Wrong argument count | auto-fixable | Add/remove arguments |

**Python (`references/python-errors.md`):**

| Error | Message | Class | Fix |
|---|---|---|---|
| SyntaxError | invalid syntax / EOF | auto-fixable | Missing `:`, unclosed brackets |
| IndentationError | unexpected/expected indent | auto-fixable | Standardize 4 spaces |
| ModuleNotFoundError | No module named X | auto-fixable | pip install, check venv, `__init__.py` |
| ImportError | cannot import X from Y | suggest | Check docs, break circular import |
| TypeError | args mismatch / unsupported operand | suggest | Count args, `self`, type conversion |
| AttributeError | X has no attribute Y | suggest | Typo, NoneType guard, wrong return type |
| FileNotFoundError | No such file | suggest | Relative path, `pathlib`, create dir |

**General (`references/general-errors.md`):** Dependency errors (missing, version mismatch), environment errors (missing env var, permission denied, port in use), build tool errors (OOM, circular dep, stale cache), Go-specific, Rust-specific.

## Security Constraint

**NEVER use TypeScript `any` as a fix for type errors.** Use `unknown` + type guards or fix the actual type mismatch. `any` is a blocked pattern per `security-rules.md`.

## Gotchas

- **Stale `.tsbuildinfo` hides real errors** — `tsc --incremental` skips files it thinks are unchanged. Delete `.tsbuildinfo` and rerun `tsc --noEmit` before declaring clean.
- **Platform-specific native binaries fail silently on different OS** — packages like `esbuild`, `sharp` ship OS-specific binaries. Always run `npm ci` fresh in the container; never share `node_modules` across platforms.
- **Peer dependency warnings mask fatal version mismatches** — npm prints peer dep warnings as non-fatal but can hide real incompatibility. Always resolve peer warnings before treating build as clean.
- **Cold vs warm cache produces different errors** — clean build surfaces errors incremental builds skip. Fix only after `rm -rf dist .tsbuildinfo && tsc`.
- **Circular dependencies pass `tsc` but break bundlers** — TypeScript compiles circular imports without error but Vite/webpack may emit broken bundles. Run `madge --circular src/` during triage.

## Example Prompts

- "Fix the build — I'm getting TS2322 errors in the auth module"
- "Build failed with SyntaxError in Python, help me fix it"
- "Compilation errors after upgrading TypeScript — triage and fix"
- "Build is failing, here's the error output: [paste]"

## Pro Tips

- Attempt counter resets when switching to a different error. Track per-error, not globally.
- For TypeScript, the "Quick Lookup by Symptom" table in `typescript-errors.md` is faster than the full catalog.
- Always delete `.tsbuildinfo` and run a clean build before triaging — incremental builds hide errors.
- If the classification in Step 3 says "report-only", stop there. Do not modify files; return the diagnosis.