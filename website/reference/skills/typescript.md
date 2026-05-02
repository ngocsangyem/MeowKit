---
title: "mk:typescript"
description: "Strict TypeScript patterns — null handling, type safety, utility types. Auto-activates on .ts/.tsx files."
---

# mk:typescript

Strict TypeScript patterns for type safety, null handling, and modern best practices. Auto-activates on `.ts`/`.tsx` files. NOT for Vue-specific patterns (use `mk:vue`) or visual design (use `mk:frontend-design`).

## When to use

Auto-activate on: `.ts`, `.tsx`, `.js`, `.jsx` files, type errors, ESLint issues, "fix types", "add types", "TypeScript help". Explicit: `/mk:typescript [concern]`.

## Core rules (always apply)

- NEVER use `any` — use `unknown` + type guards (enforced by `security-rules.md`)
- NEVER use type assertion — use `unknown` + type guards
- NEVER use implicit truthiness for null checks — use explicit `=== null || === undefined`
- ALWAYS use strict config: `strict: true`, `noUncheckedIndexedAccess: true`
- ALWAYS use `type` imports: `import type { X } from 'y'`
- PREFER named exports over default exports
- PREFER discriminated unions over type assertions

## Process

1. Detect concern — type error? new code? refactor? ESLint config?
2. Load relevant reference — strict-null, type-safety, utility-types, or eslint
3. Apply patterns from references
4. Verify — `npx tsc --noEmit` must pass with zero errors

## Phase anchor

Phase 3 (Build GREEN). Output supports the `developer` agent.
