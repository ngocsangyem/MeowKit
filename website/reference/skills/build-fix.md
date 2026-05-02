---
title: "mk:build-fix"
description: "Universal build error resolver — detects language from error output, loads fix patterns, auto-retries up to 3 attempts."
---

# mk:build-fix

Build error triage: detects language from error output, loads the appropriate fix reference, classifies the error by fixability, applies the fix, and chains into `mk:verify` to confirm green. NOT for runtime errors (use `mk:fix`); NOT for architectural debugging (use `mk:investigate`).

## When to use

- Build fails (`npm run build`, `tsc`, `go build`, `cargo build`)
- Type check errors (TypeScript TS\d{4}, mypy)
- Compilation errors in any language
- Triggers: "build failed", "fix build", "compilation error", "type error"

## Process

1. **Capture error output** — run failing build, capture full output
2. **Detect language** — match error patterns in order (first match wins): TypeScript → Python → Go → Rust → Ruby → Swift
3. **Load reference** from `references/<lang>-fixes.md`
4. **Classify error** — Signature Match (known fix exists), Pattern Match (known category), Unknown (manual)
5. **Apply fix** — apply fixed instruction or ask for help
6. **Retry** — re-run build, up to 3 attempts

## Phase anchor

Phase: 3 (Build GREEN). Handoff: `mk:verify` passes → Phase 4 (Review). 3 attempts exhausted → escalate.
