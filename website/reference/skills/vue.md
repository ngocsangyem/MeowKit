---
title: "meow:vue"
description: "Vue 3 Composition API patterns with Pinia, reactivity best practices, forms (VeeValidate + Zod), and performance optimization."
---

# meow:vue

Vue 3 Composition API patterns with Pinia, reactivity best practices, forms (VeeValidate + Zod), and performance optimization.

## What This Skill Does

`meow:vue` ensures all Vue code follows modern Vue 3 patterns. It enforces `<script setup>` exclusively, Pinia setup stores instead of Vuex, `storeToRefs()` for reactive destructuring, composables instead of mixins, and `ref()` for primitives. The skill prevents common Vue anti-patterns that cause reactivity bugs, unnecessary re-renders, and XSS vulnerabilities.

## Core Capabilities

- **Script setup enforcement** — Every component uses `<script setup lang="ts">`
- **Pinia setup stores** — `defineStore('name', () => { ... })` with `storeToRefs()` for reactive destructuring
- **Reactivity patterns** — `ref()` for primitives, `reactive()` only for complex objects, `computed()` for derived state
- **Component typing** — `defineProps<T>()` with TypeScript interfaces, `defineEmits<T>()`
- **Form handling** — VeeValidate + Zod schema validation via `toTypedSchema()`
- **Performance** — `v-once`, `v-memo`, `defineAsyncComponent()` for code splitting
- **Security** — Never use `v-html` with dynamic content (XSS vector, MeowKit security rule)

## When to Use This

::: tip Use meow:vue when...
- Creating or modifying Vue components
- Setting up Pinia stores
- Writing composables (custom hooks)
- Implementing forms with validation
- Optimizing Vue component performance
:::

## Usage

```bash
# Auto-activates on .vue files, or invoke explicitly
/meow:vue create a user profile component
/meow:vue set up Pinia auth store
/meow:vue add form validation with Zod
/meow:vue optimize this component for performance
```

## Example Prompts

| Prompt | What vue does |
|--------|--------------|
| `create a login form component` | `<script setup>` + defineProps + VeeValidate + Zod schema |
| `set up auth store with Pinia` | Setup store with `ref()`, `computed()`, `storeToRefs()` usage |
| `convert Options API to Composition` | Migrates `data()` → `ref()`, `methods:` → functions, `computed:` → `computed()` |
| `add async component loading` | `defineAsyncComponent(() => import('./Heavy.vue'))` |

## Quick Workflow

```
Detect concern (component? store? composable? form? performance?)
  → Load vue-patterns.md reference
  → Apply: script setup, Pinia, reactivity rules, typing
  → Verify: component renders, types pass, no console warnings
```

::: info Skill Details
**Phase:** 3  
**Used by:** developer agent
:::

## Related

- [`meow:typescript`](/reference/skills/typescript) — TypeScript fundamentals
- [`meow:frontend-design`](/reference/skills/frontend-design) — Visual design patterns
