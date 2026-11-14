---
name: "mk-vue-best-practices"
description: "Deep Vue 3 best-practices review and authoring workflow: built-in components (Teleport, Suspense, KeepAlive, Transition), animations, slots, directives, render fns, perf pass. Complements mk:vue."
---

# Vue 3 Best Practices

Deep, ordered Vue 3 best-practices workflow plus a review/recommendations mode. Complements
`mk:vue`: `mk:vue` is the everyday Composition API quick-reference (auto-activates on `.vue`);
this skill is the **opinionated workflow + best-practices reviewer** you invoke deliberately.

## When to Use

**Invoke-only** — this skill does NOT auto-activate on `.vue`. Activate it for:

- `the vue-best-practices skill [concern]` (explicit).
- "review my Vue code", "Vue best practices", "recommend Vue improvements".
- A non-trivial Vue feature where the full ordered workflow earns its cost (built-in
  components, animations, optional features, a performance pass).

**Do NOT invoke for:** everyday Vue authoring quick-reference (`mk:vue`), generic diff/PR
structural review (`mk:review`), TypeScript fundamentals (`mk:typescript`), React
(`mk:react-patterns`), Angular (`mk:angular`), visual design (`mk:frontend-design`), testing
(`mk:testing` / `mk:qa`; Vue *test* design/review → `mk:vue-testing-best-practices`).

## Foundations Live in mk:vue

This skill does not restate the basics. For day-to-day foundations, read `mk:vue`:

- `ref`/`reactive`/`computed`/`watch`, `toRefs`, destructuring → `mk:vue` `../vue/references/reactivity-performance.md`
- props / emits / `defineModel` / naming / basic slots → `mk:vue` `../vue/references/components.md`
- composable naming, default export, state scope, shared→Pinia → `mk:vue` `../vue/references/composables.md`
- Pinia / Pinia Colada / file-based routing → `mk:vue` `references/{state-pinia,pinia-colada*,routing-pages}.md`

This skill adds the **deltas** and the topics `mk:vue` does not cover (below).

## Workflow

Follow in order unless the user asks otherwise.

### 1. Confirm architecture (required)

- Default stack: Vue 3 + Composition API + `<script setup lang="ts">`.
- Options API or JSX only if the project explicitly uses them.
- For a non-trivial feature, sketch a brief component map first: one-sentence responsibility
  per component, props/emits contract per child, feature-folder layout
  (`components/<feature>/...`, `composables/use<Feature>.ts`). Keep entry/root and route-view
  components as thin composition surfaces.

### 2. Apply foundation deltas (required)

Read these for the guidance beyond `mk:vue` basics:

- Reactivity deltas (`shallowRef`/`shallowReactive`, computed purity, class/style computed,
  `watch` `immediate`, async cleanup) → [reactivity-advanced](references/reactivity-advanced.md)
- Data-flow deltas (provide/inject + `InjectionKey`, imperative refs via `defineExpose` +
  `useTemplateRef`, event re-emit) → [component-data-flow-advanced](references/component-data-flow-advanced.md)
- SFC structure, scoped-style performance, template safety (`v-html`, `v-for`+`v-if`,
  `v-if` vs `v-show`) → [sfc-structure-and-templates](references/sfc-structure-and-templates.md)
- Composable organization (compose from primitives, options object, readonly + actions,
  utilities-not-composables, organize by feature) → [composables-organization](references/composables-organization.md)

### 3. Optional features — load only when the requirement exists

Do not add these by default. Read the matching reference when the need is real.

**Built-in components**

- Parent controls child content/layout → [component-slots](references/component-slots.md)
- Wrapper/base components forward attrs/events → [component-fallthrough-attrs](references/component-fallthrough-attrs.md)
- Stateful view caching → [component-keep-alive](references/component-keep-alive.md)
- Overlays/portals → [component-teleport](references/component-teleport.md)
- Async subtree fallback boundary → [component-suspense](references/component-suspense.md)
- Enter/leave effects → [component-transition](references/component-transition.md)
- Animated list mutations → [component-transition-group](references/component-transition-group.md)

> Teleport/Suspense **authoring** (when to use, API, fallback) is owned here; Teleport/Suspense
> **test-setup** (stubs, `flushPromises`, `attachTo`, `mountSuspense`) → `mk:vue-testing-best-practices`.

**Animation techniques** (pick the simplest that matches the motion)

- Non-enter/leave effects → [animation-class-based](references/animation-class-based.md)
- User-input-driven animation → [animation-state-driven](references/animation-state-driven.md)

**Less-common features** (explicit product/technical need only)

- DOM-specific behavior, not a component/composable fit → [custom-directives](references/custom-directives.md)
- Heavy/rarely-used UI lazy-loaded → [async-components](references/async-components.md)
- Templates cannot express the requirement → [render-functions](references/render-functions.md)
- Behavior installed app-wide → [plugins](references/plugins.md)

State management is owned by `mk:vue` (Pinia + Pinia Colada) — route there, not here.

### 4. Performance pass — after behavior is correct

Optimize only once core behavior is implemented and verified. Measure with Vue DevTools
before changing anything.

- Large list rendering → [perf-virtualize-large-lists](references/perf-virtualize-large-lists.md)
- Static subtrees re-rendering → [perf-v-once-v-memo](references/perf-v-once-v-memo.md)
- Over-abstraction in hot list paths → [perf-avoid-abstraction-in-lists](references/perf-avoid-abstraction-in-lists.md)
- Expensive updates triggered too often → [perf-updated-hook](references/perf-updated-hook.md)

### 5. Final self-check

- Core behavior matches requirements; all relevant deltas applied.
- Reactivity is minimal and predictable; derive with `computed`.
- SFC structure + template safety rules followed.
- Components are focused; entry/root/view components stay thin composition surfaces.
- Data-flow contracts are explicit and typed.
- Composables used where reuse/complexity justifies them.
- Optional features used only when required.
- Performance changes applied only after functionality was complete.

## Review & Recommendations Mode

When asked to review or recommend, walk the section-5 self-check as a rubric against the target
code and emit a **structured findings list** — one row per finding:

```
[severity: high|med|low] · path:line · issue · fix
```

- Ground each finding in a specific best-practice from this skill or a `mk:vue` reference.
- Defer foundation-basics findings to `mk:vue`; defer non-Vue structural/security findings to
  `mk:review` / the project's security rules (do not duplicate them here).
- End with a one-line verdict: ready / changes recommended / changes required.

## Gotchas

- (grow this from observed failures)
- **Reactivity foundation belongs to `mk:vue`.** Follow the repository convention first,
  then `mk:vue`'s `ref()` guidance for primitives unless the advanced reference documents a
  task-specific reason to use `shallowRef()`.
- Cross-skill gotchas (destructuring `reactive()`, `storeToRefs`, `defineExpose`, `:slotted()`,
  `watchEffect` cleanup, SSR store hydration, Pinia Colada keys) live in `mk:vue` — read them
  there rather than duplicating.

## Anti-Patterns

Gap-topic anti-patterns only (foundation anti-patterns live in `mk:vue`):

| Don't | Do Instead |
| --- | --- |
| Reach for a render function when a template works | Keep templates; render functions only when templates cannot express it |
| Add `<Transition>` for non-enter/leave motion | Use a class-based or state-driven animation technique |
| Optimize (`v-memo`/virtualization) before behavior is correct | Performance pass last; measure with DevTools first |
| Hoist a `ref` to module scope for shared state | Pinia (global) or Pinia Colada (data) — see `mk:vue` |
| Install app-wide behavior ad hoc in components | A plugin when behavior is genuinely app-wide |

## Provenance

Ported from an upstream Vue best-practices skill — see [SOURCE.md](SOURCE.md) for the upstream
path and pinned commit (for future re-syncs).