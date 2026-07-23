# Composables

Reusable Composition API logic. A composable is a function that uses Vue reactivity and returns
reactive state plus the functions that operate on it.

## Rules

- Prefix with `use`: `useCounter`, `useAuth`.
- File name in `kebab-case`: `use-counter.ts`.
- Write the composable as an arrow function; use arrows for inner functions too.
- Export the composable as the file's `export default`.
- Keep one concern per composable; compose small ones rather than building a mega-composable.

## Example

A correct, minimal composable. `reset()` restores the original value via a captured `initial`
argument — the value is closed over, so there is no undefined identifier.

```ts
// composables/use-counter.ts
import { ref, computed } from 'vue'

const useCounter = (initial = 0) => {
  const count = ref(initial)
  const doubled = computed(() => count.value * 2)

  const increment = (): void => {
    count.value++
  }
  const decrement = (): void => {
    count.value--
  }
  const reset = (): void => {
    count.value = initial // captured from the argument — always defined
  }

  return { count, doubled, increment, decrement, reset }
}

export default useCounter
```

Usage:

```vue
<script setup lang="ts">
import useCounter from '@/composables/use-counter'

const { count, doubled, increment, reset } = useCounter(10)
</script>
```

## State scope

Each call to a composable creates its own independent reactive state — `useCounter()` in two
components gives two separate counters. That is the default and usually what you want.

When components must **share** the same reactive state (e.g. a shared search term feeding a query),
do NOT hoist a `ref` to module scope. For shared data-fetching state, wrap with `defineQuery` /
`defineMutation` from Pinia Colada — see `pinia-colada.md` (routed from `SKILL.md`). For shared
global app/UI state, use a Pinia store — see `state-pinia.md`.
