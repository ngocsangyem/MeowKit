---
name: code-quality
version: 1.0.0
weight_default: 0.10
applies_to: [frontend, backend, fullstack, cli, library, data-pipeline]
hard_fail_threshold: FAIL
---

# Code Quality

## Intent

Measures whether the implementation is **maintainable** by a human reviewer (or a future agent) without rewriting it. Focuses on structural concerns the evaluator can verify mechanically: file size, function complexity, naming, type safety, dead code. Does NOT enforce style preferences — `mk:review` (Gate 2) handles aesthetic review. This rubric is the floor, not the ceiling.

## Criteria

- No file exceeds 200 lines (split per `development-rules.md`)
- No function exceeds 50 lines or 4 levels of nesting
- No TODO / FIXME / XXX comments referencing missing implementation
- Type safety enforced (no `any` in TypeScript, no `Object.cast` in Swift, no `interface{}` in Go without explicit reason)
- No dead code (unused imports, unreferenced functions, commented-out blocks)
- No hardcoded secrets, API keys, or credentials (security-rules.md hard fail)
- Error handling exists at boundaries (no bare try/catch swallowing errors)

## Grading

| Level | Definition |
|---|---|
| PASS | All 7 criteria pass mechanical check |
| WARN | 1-2 minor violations (one file 210 lines; one function 55 lines) |
| FAIL | Hardcoded secret detected OR `any` types pervasive OR multiple files >250 lines OR error handling missing on critical paths |

## Anti-patterns

- `any` types as a workaround for type errors
- Hardcoded API keys, even in `.env.example`
- `try { ... } catch (e) { /* ignored */ }`
- Files that grew past 200 lines because "splitting felt premature"
- Commented-out code "in case we need it later"
- TODO comments without an issue link
- `console.log` debugging statements left in production code

## Few-Shot Examples

### Example 1 — PASS

**Artifact:** TypeScript project. All files ≤180 lines. No `any` types (verified `grep -rn ': any' src/` returns nothing). Error boundaries on async I/O. No secrets in code. No TODOs. `npm run lint` clean.
**Verdict:** PASS
**Reasoning:** All mechanical criteria pass. Reviewer can navigate the code without confusion.

### Example 2 — FAIL

**Artifact:** TypeScript project. One file at 412 lines. 23 occurrences of `: any`. API key hardcoded in `src/config.ts:15`. Three `try/catch` blocks with empty handlers. Eight TODO comments without context.
**Verdict:** FAIL
**Reasoning:** Hardcoded secret = automatic FAIL per security-rules.md. Pervasive `any` defeats type safety. File size violation. Multiple anti-patterns.

## References

- `meowkit/.claude/rules/development-rules.md` (file size, no `any`)
- `meowkit/.claude/rules/security-rules.md` (hardcoded secrets are non-negotiable)
