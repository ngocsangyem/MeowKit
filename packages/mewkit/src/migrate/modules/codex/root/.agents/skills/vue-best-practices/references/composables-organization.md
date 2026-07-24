Basics live in `mk:vue` references/composables.md — this covers the deltas.

## Contents

- [Compose from primitives](#compose-from-primitives)
- [Options-object params](#options-object-params)
- [readonly + explicit actions](#readonly--explicit-actions)
- [Utilities are not composables](#utilities-are-not-composables)
- [Organize by feature](#organize-by-feature)

---

## Compose from primitives

Build complex composables by composing smaller focused ones. Each primitive composable
owns one concern.

```ts
// composables/use-event-listener.ts
import { onMounted, onUnmounted, toValue, type MaybeRefOrGetter } from 'vue'

const useEventListener = <K extends keyof WindowEventMap>(
  target: MaybeRefOrGetter<Window | Element | null>,
  event: K,
  handler: (e: WindowEventMap[K]) => void
) => {
  onMounted(() => toValue(target)?.addEventListener(event, handler as EventListener))
  onUnmounted(() => toValue(target)?.removeEventListener(event, handler as EventListener))
}

export default useEventListener
```

```ts
// composables/use-mouse.ts — composes use-event-listener
import { ref } from 'vue'
import useEventListener from './use-event-listener'

const useMouse = () => {
  const x = ref(0)
  const y = ref(0)
  useEventListener(window, 'mousemove', (e) => { x.value = e.pageX; y.value = e.pageY })
  return { x, y }
}

export default useMouse
```

```ts
// composables/use-mouse-in-element.ts — composes use-mouse
import { computed, type Ref } from 'vue'
import useMouse from './use-mouse'

const useMouseInElement = (elementRef: Ref<HTMLElement | null>) => {
  const { x, y } = useMouse()
  const isOutside = computed(() => {
    if (!elementRef.value) return true
    const { left, right, top, bottom } = elementRef.value.getBoundingClientRect()
    return x.value < left || x.value > right || y.value < top  || y.value > bottom
  })
  return { x, y, isOutside }
}

export default useMouseInElement
```
---

## Options-object params

When a composable accepts more than two parameters, use an options object. Named
parameters are self-documenting at the call site and extensible without breaking callers.

```ts
// composables/use-fetch.ts
import { ref, shallowRef } from 'vue'

type UseFetchOptions = { method?: string; immediate?: boolean; timeout?: number }

const useFetch = <T>(url: string, options: UseFetchOptions = {}) => {
  const { method = 'GET', immediate = true, timeout = 30_000 } = options
  const data = ref<T | null>(null)
  const error = shallowRef<Error | null>(null)
  const loading = shallowRef(false)

  const execute = async () => {
    loading.value = true
    error.value = null
    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), timeout)
    try {
      const res = await fetch(url, { method, signal: controller.signal })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      data.value = await res.json()
    } catch (err) {
      error.value = err as Error
    } finally {
      clearTimeout(id)
      loading.value = false
    }
  }

  if (immediate) execute()
  return { data, error, loading, execute }
}

export default useFetch
```

---

## readonly + explicit actions

Return `readonly` state so consumers cannot mutate it directly — all updates flow
through named actions.

```ts
// composables/use-cart.ts
import { ref, computed, readonly } from 'vue'

type CartItem = { id: string; name: string; price: number; quantity: number }

const useCart = () => {
  const _items = ref<CartItem[]>([])
  const total = computed(() => _items.value.reduce((s, i) => s + i.price * i.quantity, 0))

  const addItem = (item: Omit<CartItem, 'quantity'>, qty = 1) => {
    const existing = _items.value.find(i => i.id === item.id)
    existing ? (existing.quantity += qty) : _items.value.push({ ...item, quantity: qty })
  }
  const removeItem = (id: string) => { _items.value = _items.value.filter(i => i.id !== id) }
  const clear = () => { _items.value = [] }

  return { items: readonly(_items), total, addItem, removeItem, clear }
}

export default useCart
```

---

## Utilities are not composables

Functions without lifecycle hooks or reactive state are plain utilities. Do not wrap them
in a `use*` composable — it adds indirection with no benefit.

```ts
// utils/formatters.ts — no Vue imports
export const formatDate = (date: Date, locale = 'en-US'): string =>
  new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(date)

export const formatCurrency = (amount: number, currency = 'USD', locale = 'en-US'): string =>
  new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount)
```

Use the utility directly in a composable that needs reactivity:

```ts
// composables/use-invoice-summary.ts
import { computed, type Ref } from 'vue'
import { formatCurrency } from '@/utils/formatters'

const useInvoiceSummary = (invoice: Ref<{ total: number }>) => ({
  totalLabel: computed(() => formatCurrency(invoice.value.total)),
})

export default useInvoiceSummary
```

---

## Organize by feature

Extract component logic into feature-scoped composables; the component script becomes a
thin coordinator:

```vue
<script setup lang="ts">
import useItems from '@/features/catalog/composables/use-items'
import useSearch from '@/features/catalog/composables/use-search'
import useSelectionModal from '@/features/catalog/composables/use-selection-modal'

const { items, loading } = useItems()
const { query, visibleItems } = useSearch(items)
const { selected, isOpen, select, close } = useSelectionModal()
</script>
```

Directory layout — composables live next to the feature:

```
features/catalog/
├── CatalogView.vue
├── composables/
│   ├── use-items.ts
│   ├── use-search.ts
│   └── use-selection-modal.ts
└── utils/sort-helpers.ts
```

Promote to `src/composables/` only when a second feature needs the same composable.
