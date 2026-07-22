# Source / Provenance

This skill was ported and adapted to this toolkit's house style from an upstream Vue
best-practices skill.

- **Upstream origin:** `https://github.com/vuejs-ai/skills/tree/main/skills/vue-best-practices`
- **Pinned commit:** `f3dd1bf4d3ac78331bdc903e4519d561c538ca6a`
- **Ported:** 2026-06-14

The upstream skill was vendored into this repo's bundled skills tree under a
`vue-best-practices` directory; refresh against the pinned commit above when re-syncing.

## Adaptation notes

- Positioned as a **complement** to `mk:vue`: foundation basics (reactivity, props/emits,
  composable naming, Pinia/Pinia Colada/routing) are deferred to `mk:vue` references; this
  skill carries the deltas and the topics `mk:vue` does not cover (built-in components,
  animation techniques, optional features, performance pass) plus the ordered workflow and a
  review/recommendations mode.
- Upstream per-file frontmatter (`title`/`impact`/`tags`) and verbose intros were dropped for
  house style; examples were rewritten in `<script setup lang="ts">` with arrow functions,
  `type` over `interface`, `export default` composables, and Tailwind for styling.
- Upstream `state-management.md` was intentionally not ported — state is owned by `mk:vue`.
- Reactivity primitive guidance (`shallowRef()` for primitives) was kept from upstream and
  diverges from `mk:vue`'s `ref()`-for-primitives rule; the divergence is documented in
  `references/reactivity-advanced.md`.

## Re-sync guidance

To refresh against upstream, diff the current upstream references against the pinned commit
above, re-apply the adaptation notes, and bump the pinned commit when done.
