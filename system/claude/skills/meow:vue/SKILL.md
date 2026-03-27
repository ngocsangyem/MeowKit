---
name: meow:vue
description: "Vue 3 Composition API patterns, Pinia state management, reactivity, component design, and performance. Auto-activates on .vue files or Vue-related tasks. Use for Vue architecture decisions, composables, Pinia stores, forms, and optimization."
source: aura-frog
original_skills: [vue-expert]
adapted_for: meowkit
---

# Vue 3 Expert

Vue 3 Composition API patterns, Pinia, reactivity, component design, forms, and performance.

> Use `npx chub search vue` for relevant documentation packages within the Context Hub

## When to Invoke

**Auto-activate on:** `.vue` files, Vue 3 Composition API, Pinia stores, `<script setup>`, Vue Router, composables

**Explicit:** `/meow:vue [concern]`

**Do NOT invoke for:** TypeScript fundamentals (use meow:typescript), visual design (use meow:frontend-design), testing (use meow:testing)

## Workflow Integration

Operates in **Phase 3 (Build GREEN)**. Output supports the `developer` agent.

## Process

1. **Detect concern** — component? composable? store? form? performance?
2. **Load relevant reference** — vue-patterns, pinia, or forms
3. **Apply patterns** — implement using Vue 3 best practices from references
4. **Verify** — component renders, types pass, no console warnings

## Core Rules (always apply)

- **ALWAYS** use `<script setup lang="ts">` — never Options API
- **ALWAYS** use `defineProps` with TypeScript interfaces — never runtime validation
- **ALWAYS** use `storeToRefs()` when destructuring Pinia store state
- **NEVER** use `v-html` with user content (MeowKit security-rules.md — XSS vector)
- **PREFER** composables (`use*`) over mixins
- **PREFER** `ref()` for primitives, `reactive()` only for complex objects
- **NAME** components PascalCase, files kebab-case (MeowKit naming-rules.md)

## Anti-Patterns

| Don't                              | Do Instead                       |
| ---------------------------------- | -------------------------------- |
| Options API (`data()`, `methods:`) | Composition API `<script setup>` |
| `this.$store` / Vuex               | Pinia with setup store syntax    |
| Direct store state destructuring   | `storeToRefs(useMyStore())`      |
| `v-html` with dynamic content      | `v-text` or sanitized rendering  |
| `reactive()` for primitives        | `ref()` for primitives           |
| Watchers when computed works       | `computed()` for derived state   |
| Global event bus                   | `provide/inject` or Pinia        |
| `defineComponent()` wrapper        | `<script setup>` directly        |

## Output Format

```
## Vue: {concern}

**Files:** {list of .vue files modified}
**Pattern:** {composition API | pinia store | composable | component}

### Implementation
{code changes with Vue 3 patterns applied}

### Verification
{component renders, no console warnings, types pass}
```

## References

| Reference                                           | When to load              | Content                                                    |
| --------------------------------------------------- | ------------------------- | ---------------------------------------------------------- |
| **[vue-patterns.md](./references/vue-patterns.md)** | Component/composable work | Composition API, reactivity, component design, performance |

## Failure Handling

| Failure                             | Recovery                                    |
| ----------------------------------- | ------------------------------------------- |
| Vue 2 syntax detected (Options API) | Migrate to Composition API `<script setup>` |
| Pinia not installed                 | `npm install pinia`                         |
| Type errors in template             | Fix with `defineProps<T>()` typing          |
