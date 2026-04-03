---
name: meow:build-fix
description: "Build error triage: detect language, load fix patterns, auto-retry. Use for 'build failed', 'fix compilation', 'type error'. Chains into meow:verify."
version: 1.0.0
argument-hint: "[error output or file path]"
source: meowkit
allowed-tools:
  - Bash
  - Read
  - Edit
  - Glob
---

# Build Fix — Universal Build Error Resolver

Detects language from error output, loads the appropriate reference, classifies the error
by fixability, applies the fix, and chains into `meow:verify` to confirm the build is green.

## When to Activate

- Build command fails (npm run build, tsc, go build, python -m build, cargo build)
- Type check errors (TypeScript TS\d{4}, mypy)
- Compilation errors in any language
- Triggers: "build failed", "fix build", "compilation error", "type error"

## Phase Anchor

**Phase: 3 (Build GREEN)**
**Handoff:** If `meow:verify` passes → proceed to Phase 4 (Review). If 3 attempts exhausted → escalate to user.

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
| **auto-fixable** | Syntax errors, missing imports, simple type mismatches | Apply fix immediately |
| **suggest-with-confidence** | Wrong argument types, missing interface properties | Propose fix, apply after brief explanation |
| **report-only** | Runtime errors, architectural issues, circular dependencies | Describe the problem and root cause; do not auto-fix |

**Auto-fixable examples:** TS1005 Expected semicolon, TS2307 Cannot find module (missing import)
**Suggest-with-confidence examples:** TS2322 type mismatch, TS2345 argument type mismatch
**Report-only examples:** Circular dependency, architectural type mismatch requiring refactor

### Step 4: Apply Fix

For auto-fixable and suggest-with-confidence:
- Apply the minimal change that resolves the error
- Do not refactor beyond what the error requires (YAGNI)
- Follow security-rules.md — do NOT use `any` type as a fix

For report-only:
- Describe what needs to change and why
- Stop — do not modify files
- Return the diagnosis to the developer

### Step 5: Verify Fix

Run `meow:verify` (or the project's build command directly if verify not available).

### Step 6: Iterate (Max 3 Attempts)

If the build still fails after applying a fix:
- Attempt 2: re-classify with updated error output, try different approach
- Attempt 3: re-classify one final time with a different approach

After 3 failed attempts, **escalate to user** with:
- All 3 error outputs
- All 3 attempted fixes and why each failed
- Suspected root cause
- Suggested next steps (architectural review, dependency update, etc.)

## Attempt Counter

Track attempts in the session. Reset counter when switching to a different error.
Per `tdd-rules.md` Rule 4: max 3 self-healing attempts, then escalate.

## Reference Files

- `references/typescript-errors.md` — TS error codes with fix patterns
- `references/python-errors.md` — Python exception types with fix patterns
- `references/general-errors.md` — Framework-agnostic build error patterns

## Security Constraint

NEVER use TypeScript `any` as a fix for type errors. Always use `unknown` + type guards or
fix the actual type mismatch. See `security-rules.md` — `any` type is a blocked pattern.
