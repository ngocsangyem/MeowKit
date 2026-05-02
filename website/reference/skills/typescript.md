---
title: "mk:typescript"
description: "Strict TypeScript patterns for type safety, null handling, and modern best practices. Auto-activates on .ts/.tsx files."
---

# mk:typescript

## What This Skill Does

Strict TypeScript patterns for type safety, null handling, and modern best practices. Operates in Phase 3 (Build GREEN). Output supports the `developer` agent.

## When to Use

- **Auto-activate on:** `.ts`, `.tsx` files, type errors, ESLint issues, "fix types", "add types", "TypeScript help"
- **NOT for:** Vue-specific patterns (use `mk:vue`), visual design (use `mk:frontend-design`)

## Core Capabilities

- **Strict null checking** — explicit null/undefined guards, no implicit truthiness
- **Type safety enforcement** — ban `any` and type assertions, enforce `unknown` + type guards
- **Discriminated unions** — prefer over type assertions for variant types
- **Named exports** — prefer over default exports for better tree-shaking and IDE support
- **`type` imports** — use `import type` for type-only imports
- **Explicit return types** — annotate function return types for clarity and safety
- **ESLint integration** — strict TypeScript ESLint rules with zero-tolerance for errors

## Usage

```bash
/mk:typescript [concern]
```

## Example Prompt

```
Add strict TypeScript types to the user authentication module. Replace all `any` types with proper interfaces, add null guards for API responses, and ensure discriminated unions for the auth states (loading, authenticated, unauthenticated, error).
```

## Process

1. **Detect concern** — type error? new code? refactor? ESLint config?
2. **Load relevant reference** — strict-null, type-safety, utility-types, or eslint
3. **Apply patterns** — implement using strict TS patterns
4. **Verify** — `npx tsc --noEmit` must pass with zero errors

## Core Rules (always apply)

- **NEVER** use `any` — use `unknown` + type guards (security-rules.md)
- **NEVER** use type assertion — use `unknown` + type guards (security-rules.md)
- **NEVER** use implicit truthiness for null checks — use explicit `=== null || === undefined`
- **ALWAYS** use strict TypeScript config: `strict: true`, `noUncheckedIndexedAccess: true`
- **ALWAYS** use `type` imports: `import type { X } from 'y'`
- **PREFER** named exports over default exports
- **PREFER** discriminated unions over type assertions

## Anti-Patterns

| Don't | Do Instead |
|-------|-----------|
| `as any` or `as unknown as X` | Proper type narrowing with guards |
| `if (value)` for null check | `if (value !== null && value !== undefined)` |
| `export default` | `export const X` / `export function X` |
| `Object` type | `Record<string, unknown>` |
| Implicit return types | Explicit return type annotations |
| `enum` (runtime overhead) | `as const` satisfies or union types |

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

## Failure Handling

| Failure | Recovery |
|---------|----------|
| `tsc --noEmit` fails after changes | Fix errors before proceeding — never ship with type errors |
| No tsconfig.json found | Suggest creating one with strict config |
| Third-party types missing | `npm install @types/{package}` |

## Gotchas

- **`as` cast silences narrowing errors and hides real bugs.** `value as User` tells TS to trust you, not validate. A malformed API response passes the cast and crashes at runtime. Use a type guard or Zod parse at the boundary instead.
- **`moduleResolution: "bundler"` breaks `import type` in non-bundler contexts.** `moduleResolution: bundler` (Vite/esbuild default) allows extensionless imports that Node.js `--esm` rejects at runtime. Flip to `nodenext` for backend code or keep dual configs per target.
- **`noUncheckedIndexedAccess: true` makes every array index `T | undefined`.** Enabling this flag means `arr[0]` is `string | undefined` not `string`. Code that was type-correct before will error until every indexed access is null-guarded.
- **Declaration merging silently adds properties to global types.** A `declare module 'express'` block in any `.d.ts` augments Express types globally. Two libraries with conflicting shapes cause TS2300 errors far from the source.
- **Template literal types create unique brands that break assignability.** `type UserId = \`user_\${string}\`` is not assignable from `string`. Always brand at the input boundary with a parse function.
- **`enum` generates runtime JS objects, causing tree-shaking failures.** Use `as const` satisfies patterns for exported enums.

> **Canonical source:** `.claude/skills/typescript/SKILL.md`
