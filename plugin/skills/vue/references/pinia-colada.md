# Pinia Colada (Core)

> Applies when the project depends on `@pinia/colada`. It is the preferred async/data-fetching
> layer; for global app/UI state use a Pinia store (`state-pinia.md`).

## Contents

- [Rules](#rules)
- [Setup](#setup)
- [Key Factories](#key-factories)
- [defineQueryOptions](#definequeryoptions)
- [useQuery](#usequery)
- [Mutations](#mutations)
- [defineQuery (shared state)](#definequery-shared-state)
- [State & Status](#state--status)
- [Folder Structure](#folder-structure)

## Rules

- Use key factories + `defineQueryOptions`. Never inline keys in real projects.
- Organize queries in a `queries/` folder, mutations in a `mutations/` folder.
- Install `@pinia/colada-devtools` as a **dev dependency**; place `<PiniaColadaDevtools />` at the
  end of the root template (`App.vue`). Do NOT enable devtools in production unless requested.
- Keys MUST depend on ALL variables used in the `query` function.
- Dynamic keys → always a getter function, never a plain value.
- Use `as const` on key-factory return types.
- Prefer `refresh()` over `refetch()`: it reuses in-flight requests and respects `staleTime`.

## Setup

```bash
pnpm i @pinia/colada
pnpm i -D @pinia/colada-devtools
```

```ts
// main.ts
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { PiniaColada } from '@pinia/colada'

const app = createApp(App)
app.use(createPinia())
app.use(PiniaColada, {
  // queryOptions: { staleTime: 0 },
  // mutationOptions: {},
  // plugins: [],
})
```

```vue
<!-- App.vue -->
<script setup lang="ts">
import { PiniaColadaDevtools } from '@pinia/colada-devtools'
</script>

<template>
  <RouterView />

  <PiniaColadaDevtools />
</template>
```

## Key Factories

Centralize keys in the query file. Reuse parent keys to keep the hierarchy consistent:

```ts
// queries/products.ts
export const PRODUCT_QUERY_KEYS = {
  root: ['products'] as const,
  byId: (id: string) => [...PRODUCT_QUERY_KEYS.root, id] as const,
  byIdWithReviews: (id: string) => [...PRODUCT_QUERY_KEYS.byId(id), { reviews: true }] as const,
}
```

Invalidating `PRODUCT_QUERY_KEYS.root` invalidates ALL product queries (hierarchical matching).

## defineQueryOptions

Combine key factories with `defineQueryOptions` for type-safe, reusable query definitions.

**Static** (no params):

```ts
// queries/products.ts
import { defineQueryOptions } from '@pinia/colada'

export const productListQuery = defineQueryOptions({
  key: PRODUCT_QUERY_KEYS.root,
  query: () => getProducts(),
})
```

**Dynamic** (with params):

```ts
export const productByIdQuery = defineQueryOptions((id: string) => ({
  key: PRODUCT_QUERY_KEYS.byId(id),
  query: () => getProductById(id),
}))
```

**Multiple params** — use object destructuring:

```ts
export const productByIdQuery = defineQueryOptions(
  ({ id, withReviews = false }: { id: string; withReviews?: boolean }) => ({
    key: PRODUCT_QUERY_KEYS.byIdWithReviews(id),
    query: () => getProductById(id, { withReviews }),
  }),
)
```

## useQuery

Pass dynamic options as a getter function so the key re-evaluates reactively:

```vue
<script setup lang="ts">
import { useQuery } from '@pinia/colada'
import { useRoute } from 'vue-router'
import { productByIdQuery } from '@/queries/products'

const route = useRoute()
const { state, asyncStatus } = useQuery(() => productByIdQuery(route.params.id))
</script>

<template>
  <div v-if="asyncStatus === 'loading'">Loading...</div>
  <div v-if="state.status === 'error'">{{ state.error.message }}</div>
  <div v-else-if="state.data">{{ state.data.name }}</div>
</template>
```

Spread defined options and override per usage:

```ts
const enabled = ref(false)
useQuery(() => ({
  ...productByIdQuery('24'),
  enabled: enabled.value,
}))
```

Pause a query until required data exists with `enabled`:

```ts
const selectedDeckId = ref<number | null>(null)
useQuery({
  key: () => ['decks', selectedDeckId.value],
  query: () => getDeck(selectedDeckId.value!),
  enabled: () => selectedDeckId.value != null,
})
```

## Mutations

```ts
import { useMutation, useQueryCache } from '@pinia/colada'
import { PRODUCT_QUERY_KEYS } from '@/queries/products'

const queryCache = useQueryCache()
const { mutate: updateProduct, asyncStatus } = useMutation({
  mutation: (product: Product) => patchProduct(product),
  onSettled(_data, _error, product) {
    queryCache.invalidateQueries({ key: PRODUCT_QUERY_KEYS.byId(product.id) })
    queryCache.invalidateQueries({ key: PRODUCT_QUERY_KEYS.root, exact: true })
  },
})
```

- `mutate()` — fire-and-forget, catches errors.
- `mutateAsync()` — returns a promise, re-throws errors.
- `variables` — last args passed to the mutation (useful for optimistic UI).

Reusable mutations with `defineMutation`:

```ts
// mutations/products.ts
import { defineMutation } from '@pinia/colada'

export const useDeleteProduct = defineMutation({
  mutation: (id: string) => fetch(`/api/products/${id}`, { method: 'DELETE' }),
})
```

Function form for shared mutation state across components:

```ts
export const useCreateProduct = defineMutation(() => {
  const name = ref('')
  const { mutate, ...rest } = useMutation({
    mutation: (text: string) => createProduct(text),
  })
  return { ...rest, createProduct: () => mutate(name.value), name }
})
```

## defineQuery (shared state)

Wrap with `defineQuery` to share reactive state (e.g. a search ref) across components using the
same query. Without it, each component gets its own copy.

```ts
// queries/todos.ts
import { defineQuery, useQuery } from '@pinia/colada'
import { ref } from 'vue'

export const useFilteredTodos = defineQuery(() => {
  const search = ref('')
  const { state, ...rest } = useQuery({
    key: () => ['todos', { search: search.value }],
    query: () => fetch(`/api/todos?filter=${search.value}`).then((r) => r.json()),
  })
  return { ...rest, todoList: state, search }
})
```

## State & Status

| Property                  | Values                                 | Purpose                             |
| ------------------------- | -------------------------------------- | ----------------------------------- |
| `state.status` / `status` | `'pending'` → `'success'` \| `'error'` | Data status (has it ever resolved?) |
| `asyncStatus`             | `'idle'` \| `'loading'`                | Is the query currently fetching?    |

Use `state` (not destructured `data`/`error`) for TypeScript narrowing:

```ts
if (state.value.status === 'error') {
  state.value.error // Error, not null
}
```

`refresh()` vs `refetch()`:

- `refresh()` — reuses in-flight requests, skips if data is fresh.
- `refetch()` — always triggers a new fetch.

## Folder Structure

```
src/
├── api/              # fetch functions
│   ├── products.ts
│   └── contacts.ts
├── queries/          # key factories + defineQueryOptions
│   ├── products.ts
│   └── contacts.ts
├── mutations/        # defineMutation
│   ├── products.ts
│   └── contacts.ts
└── pages/
    └── products/[id].vue
```
