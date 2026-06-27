# v-once and v-memo — Deep Guidance

> The basics (what these directives do, syntax) are covered in `mk:vue` →
> `references/reactivity-performance.md`. This file adds the caveats, edge cases,
> and patterns that matter in production.

**Bottleneck:** Vue re-evaluates templates on every reactive change. `v-once` and
`v-memo` tell Vue to skip re-evaluation for subtrees that haven't meaningfully
changed.

Measure with Vue DevTools (Performance panel) before adding these directives.
Confirm the component is actually a re-render hotspot.

## Contents

- [v-once caveats](#v-once-caveats)
- [v-memo in lists — the primary use case](#v-memo-in-lists--the-primary-use-case)
- [v-memo with multiple dependencies](#v-memo-with-multiple-dependencies)
- [v-memo with empty array](#v-memo-with-empty-array)
- [What breaks inside memoized subtrees](#what-breaks-inside-memoized-subtrees)
- [Debugging — why updates stopped firing](#debugging--why-updates-stopped-firing)

## v-once caveats

`v-once` is safe only when the data used at render time is truly static for the
lifetime of the component — not "unlikely to change" but literally never updated.

```vue
<template>
  <!-- Safe: values are constants set at module load time -->
  <footer v-once class="text-sm text-gray-500">
    &copy; {{ copyrightYear }} {{ companyName }}
  </footer>

  <!-- Dangerous: looks static but termsContent may update via a store -->
  <!-- Remove v-once if you ever push live-update capability -->
  <!-- v-html ALWAYS requires sanitized input — never bind raw CMS/user HTML -->
  <div v-once class="prose" v-html="safeTerms" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import DOMPurify from 'dompurify'

const copyrightYear = new Date().getFullYear()
const companyName = 'Acme Corp'
// termsContent loaded once at component mount — safe as long as it never re-fetches
const termsContent = await fetchTermsOnce()
// Sanitize before v-html — see sfc-structure-and-templates.md for the rule
const safeTerms = computed(() => DOMPurify.sanitize(termsContent))
</script>
```

If you're unsure whether a value will change in the future, skip `v-once`. The
performance gain rarely justifies a future debugging session when updates silently stop.

## v-memo in lists — the primary use case

`v-memo` shines in large `v-for` loops where selection or activation state changes
cause all items to re-render:

```vue
<template>
  <!--
    Without v-memo: every item re-renders when selectedId changes.
    With v-memo: only items whose (item.id === selectedId) result changed re-render.
    For 1000 items, that's 2 renders instead of 1000.
  -->
  <div
    v-for="item in items"
    :key="item.id"
    v-memo="[item.id === selectedId]"
    class="flex items-center gap-3 p-3 rounded-lg"
    :class="{ 'bg-blue-50 ring-1 ring-blue-400': item.id === selectedId }"
  >
    <ExpensiveItemCard :item="item" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import ExpensiveItemCard from './ExpensiveItemCard.vue'

type Item = { id: number; name: string }

const items = ref<Item[]>([])
const selectedId = ref<number | null>(null)
</script>
```

The memo array must contain **all** values that affect the rendered output of that
subtree. If you miss one, items will display stale data.

## v-memo with multiple dependencies

```vue
<template>
  <!-- Re-render only when selection OR edit state changes for this item -->
  <div
    v-for="item in items"
    :key="item.id"
    v-memo="[item.id === selectedId, item.id === editingId]"
    class="p-2 border rounded"
  >
    <ItemCard
      :item="item"
      :selected="item.id === selectedId"
      :editing="item.id === editingId"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const selectedId = ref<number | null>(null)
const editingId = ref<number | null>(null)
const items = ref<{ id: number; name: string }[]>([])
</script>
```

## v-memo with empty array

`v-memo="[]"` behaves identically to `v-once` — renders once, never updates. Prefer
`v-once` for clarity when you actually mean "never update."

```vue
<template>
  <!-- Equivalent — prefer v-once for readability -->
  <div v-for="item in staticItems" :key="item.id" v-memo="[]">
    {{ item.name }}
  </div>
</template>
```

## What breaks inside memoized subtrees

`v-memo` prevents the VDOM diff for the entire subtree. Any reactive binding inside
that subtree will not update when the memo condition stays the same:

```vue
<template>
  <!-- BROKEN: v-model inside v-memo stops working when selectedId doesn't change -->
  <div v-for="item in items" :key="item.id" v-memo="[item.id === selectedId]">
    <input v-model="item.name" />  <!-- input updates won't reflect in DOM -->
  </div>

  <!-- BROKEN: child component internal state won't trigger parent re-render -->
  <div v-for="item in items" :key="item.id" v-memo="[item.id === selectedId]">
    <CounterWidget />  <!-- internal counter increments are blocked -->
  </div>
</template>
```

Reserve `v-memo` for display-only subtrees. Avoid it around interactive form elements
or components with independent reactive state.

## Debugging — why updates stopped firing

`onUpdated` will NOT fire when `v-memo` prevents the re-render:

```vue
<script setup lang="ts">
import { onUpdated } from 'vue'

// This hook is silent when v-memo blocks the update — expected behavior.
// To confirm v-memo is the cause: temporarily remove v-memo and check if updates resume.
onUpdated(() => {
  console.log('component updated')
})
</script>
```

If an item shows stale data, the memo array is missing a dependency. Add it and re-measure.
