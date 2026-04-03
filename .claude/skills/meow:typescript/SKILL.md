---
name: meow:typescript
description: "Use when writing TypeScript code, fixing type errors, or configuring strict type safety. Auto-activates on .ts/.tsx files. Covers null handling, utility types, and ESLint."
source: aura-frog
original_skills: [typescript-expert, frontend-development (TS parts)]
adapted_for: meowkit
---

<!-- Improvements over source skills:
- Split from 361-line monolith to SKILL.md + references/ (Phase 1: CLASS A)
- Framework-agnostic (removed React-specific patterns from frontend-development)
- Integrated with MeowKit security-rules.md (no `any` types already enforced)
- Added workflow phase anchoring (Phase 3 Build)
-->

# TypeScript Expert

Strict TypeScript patterns for type safety, null handling, and modern best practices.

## When to Invoke

**Auto-activate on:** `.ts`, `.tsx`, `.js`, `.jsx` files, type errors, ESLint issues, "fix types", "add types", "TypeScript help"

**Explicit:** `/meow:typescript [concern]`

**Do NOT invoke for:** Vue-specific patterns (use meow:vue), visual design (use meow:frontend-design)

## Workflow Integration

Operates in **Phase 3 (Build GREEN)**. Output supports the `developer` agent.

## Process

1. **Detect concern** — type error? new code? refactor? ESLint config?
2. **Load relevant reference** — strict-null, type-safety, utility-types, or eslint
3. **Apply patterns** — implement using strict TS patterns from references
4. **Verify** — `npx tsc --noEmit` must pass with zero errors

## Core Rules (always apply)

- **NEVER** use `any` — use `unknown` + type guards (MeowKit security-rules.md)
- **NEVER** use `type assertion` — use `unknown` + type guards (MeowKit security-rules.md)
- **NEVER** use implicit truthiness for null checks — use explicit `=== null || === undefined`
- **ALWAYS** use strict TypeScript config: `strict: true`, `noUncheckedIndexedAccess: true`
- **ALWAYS** use `type` imports: `import type { X } from 'y'`
- **PREFER** named exports over default exports
- **PREFER** discriminated unions over type assertions

## Anti-Patterns

| Don't                         | Do Instead                                   |
| ----------------------------- | -------------------------------------------- |
| `as any` or `as unknown as X` | Proper type narrowing with guards            |
| `if (value)` for null check   | `if (value !== null && value !== undefined)` |
| `export default`              | `export const X` / `export function X`       |
| `Object` type                 | `Record<string, unknown>`                    |
| Implicit return types         | Explicit return type annotations             |
| `enum` (runtime overhead)     | `as const` satisfies or union types          |

## Output Format

```
## TypeScript: {concern}

**Files:** {list of .ts/.tsx files modified}
**Config:** {tsconfig changes if any}

### Changes Applied
{numbered list of type improvements}

### Verification
{tsc --noEmit output — must show 0 errors}
```

## References

| Reference                                                 | When to load     | Content                                                         |
| --------------------------------------------------------- | ---------------- | --------------------------------------------------------------- |
| **[strict-patterns.md](./references/strict-patterns.md)** | Type safety work | Null handling, discriminated unions, type guards, utility types |
| **[review-checklist.md](./references/review-checklist.md)** | When reviewing TypeScript code | Prioritized checklist: CRITICAL (security), HIGH (type safety, async, errors), MEDIUM (React, perf) |

## Failure Handling

| Failure                            | Recovery                                                   |
| ---------------------------------- | ---------------------------------------------------------- |
| `tsc --noEmit` fails after changes | Fix errors before proceeding — never ship with type errors |
| No tsconfig.json found             | Suggest creating one with strict config                    |
| Third-party types missing          | `npm install @types/{package}`                             |
