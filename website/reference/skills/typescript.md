---
title: "meow:typescript"
description: "Strict TypeScript patterns for null safety, type guards, discriminated unions, utility types, and ESLint configuration."
---

# meow:typescript

Strict TypeScript patterns for null safety, type guards, discriminated unions, utility types, and ESLint configuration.

## What This Skill Does

`meow:typescript` enforces strict TypeScript patterns that prevent the subtle bugs `tsc` doesn't catch on its own. It goes beyond "no `any` types" into the nuances: implicit truthiness checks that miss `0` and `""`, untyped error catches, runtime enums that add bundle weight, and `as` assertions that lie to the compiler. The skill auto-activates on `.ts` and `.tsx` files.

## Core Capabilities

- **Strict null handling** — Explicit `=== null || === undefined` instead of implicit truthiness
- **Type guard patterns** — Proper runtime narrowing instead of `as SomeType` assertions
- **Discriminated unions** — `{ ok: true; data: T } | { ok: false; error: string }` for result types
- **Utility type mastery** — Correct use of `Partial`, `Readonly`, `Pick`, `Omit`, `Record`
- **Import conventions** — `import type { X }` for type-only imports, named exports over defaults
- **ESLint configuration** — Recommended strict rules for `@typescript-eslint`
- **Strict tsconfig** — `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`

## When to Use This

::: tip Use meow:typescript when...
- You're writing new TypeScript code and want strict patterns
- You're fixing type errors or ESLint issues
- You need to refactor code for better type safety
- You want to set up strict TypeScript configuration
:::

::: warning Don't use for...
- Vue-specific patterns → [`meow:vue`](/reference/skills/vue)
- Visual/CSS work → [`meow:frontend-design`](/reference/skills/frontend-design)
:::

## Usage

```bash
# Auto-activates on .ts/.tsx files, or invoke explicitly
/meow:typescript fix type errors in auth module
/meow:typescript add strict null checks
/meow:typescript configure ESLint for strict TypeScript
```

## Example Prompts

| Prompt | What typescript does |
|--------|---------------------|
| `fix type errors in auth.ts` | Replaces `any` with proper types, adds null guards |
| `make this function type-safe` | Adds generics, discriminated unions, or type guards |
| `set up strict TypeScript config` | Generates tsconfig.json with all strict flags |
| `add ESLint rules for TypeScript` | Configures `@typescript-eslint` strict rules |

## Quick Workflow

```
Detect concern (type error? new code? refactor? config?)
  → Load strict-patterns.md reference
  → Apply: null guards, type guards, utility types, imports
  → Verify: npx tsc --noEmit → 0 errors
```

::: info Skill Details
**Phase:** 3  
**Used by:** developer agent
:::

## Related

- [`meow:vue`](/reference/skills/vue) — Vue-specific TypeScript patterns
- [`meow:frontend-design`](/reference/skills/frontend-design) — Visual/CSS patterns
