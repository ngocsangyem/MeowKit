---
title: "mk:vue"
description: "Vue 3 Composition API patterns — Pinia state management, reactivity, component design, forms, performance. Auto-activates on .vue files."
---

# mk:vue

Vue 3 Composition API patterns, Pinia, reactivity, component design, forms, and performance. Auto-activates on `.vue` files. NOT for TypeScript fundamentals (use `mk:typescript`), visual design (use `mk:frontend-design`), or testing (use `mk:testing`).

## When to use

Auto-activate on: `.vue` files, Vue 3 Composition API, Pinia stores, `<script setup>`, Vue Router, composables. Explicit: `/mk:vue [concern]`.

## Core rules (always apply)

- ALWAYS use `<script setup lang="ts">` — never Options API
- ALWAYS use `defineProps` with TypeScript interfaces — never runtime validation
- ALWAYS use `storeToRefs()` when destructuring Pinia store state
- NEVER use `v-html` with user content (`security-rules.md` — XSS vector)
- PREFER composables (`use*`) over mixins
- Use `npx chub search vue` for documentation packages within Context Hub

## Process

1. Detect concern — component? composable? store? form? performance?
2. Load relevant reference — vue-patterns, pinia, or forms
3. Apply patterns using Vue 3 best practices
4. Verify — component renders, types pass, no console warnings

## Phase anchor

Phase 3 (Build GREEN). Output supports the `developer` agent.
