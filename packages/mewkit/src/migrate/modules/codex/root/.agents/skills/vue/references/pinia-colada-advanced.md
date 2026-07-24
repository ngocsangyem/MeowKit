# Pinia Colada (Advanced Patterns)

> Applies when the project depends on `@pinia/colada`. Read after `pinia-colada.md`.

## Contents

- [Optimistic Updates via Cache](#optimistic-updates-via-cache)
- [Optimistic Updates via UI](#optimistic-updates-via-ui)
- [Infinite Queries](#infinite-queries)
- [Paginated Queries](#paginated-queries)
- [Error Handling](#error-handling)
- [Query Cancellation](#query-cancellation)
- [SSR](#ssr-custom-setup)
- [Nuxt](#nuxt)

## Optimistic Updates via Cache

Full pattern: save old state → set new state → cancel queries → rollback on error → invalidate on settle.

```ts
import { useMutation, useQueryCache } from '@pinia/colada'

const queryCache = useQueryCache()
const { mutate } = useMutation({
  mutation: patchContact,

  onMutate(contactInfo) {
    const oldContact = queryCache.getQueryData<Contact>(['contact', contactInfo.id])!
    const newContact: Contact = { ...oldContact, ...contactInfo }

    queryCache.setQueryData(['contact', newContact.id], newContact)
    queryCache.cancelQueries({ key: ['contact', newContact.id] })

    return { oldContact, newContact }
  },

  onError(err, contactInfo, { newContact, oldContact }) {
    // Only rollback if the cache hasn't been updated by another mutation/query
    if (newContact === queryCache.getQueryData(['contact', contactInfo.id])) {
      queryCache.setQueryData(['contact', contactInfo.id], oldContact)
    }
  },

  onSettled(_data, _error, _vars, { newContact }) {
    if (newContact) {
      queryCache.invalidateQueries({ key: ['contact', newContact.id] })
    }
  },

  onSuccess(contact, _contactInfo, { newContact }) {
    // Progressive update with server data
    queryCache.setQueryData(['contact', newContact.id], contact)
  },
})
```

Appending to a list — same pattern, merge into the array:

```ts
onMutate(text) {
  const oldList = queryCache.getQueryData<Todo[]>(['todos'])
  const newItem: Todo = { text, id: crypto.randomUUID() }
  const newList = [...(oldList || []), newItem]
  queryCache.setQueryData(['todos'], newList)
  queryCache.cancelQueries({ key: ['todos'] })
  return { oldList, newList, newItem }
},
onSuccess(serverItem, _vars, { newItem }) {
  const list = queryCache.getQueryData<Todo[]>(['todos']) || []
  const idx = list.findIndex((t) => t.id === newItem.id)
  if (idx >= 0) {
    const copy = list.slice()
    copy.splice(idx, 1, serverItem)
    queryCache.setQueryData(['todos'], copy)
  }
},
```

## Optimistic Updates via UI

When the mutation is collocated with the query, use `variables` + `isLoading`:

```vue
<script setup lang="ts">
const { data: todoList } = useQuery({ key: ['todos'], query: getTodoList })
const queryCache = useQueryCache()
const { mutate, isLoading, variables: newTodo } = useMutation({
  mutation: (text: string) => createTodo(text),
  async onSettled() {
    await queryCache.invalidateQueries({ key: ['todos'] })
  },
})
</script>

<template>
  <ul v-if="todoList">
    <li v-for="todo in todoList" :key="todo.id">{{ todo.text }}</li>
    <li v-if="isLoading" :style="{ opacity: 0.5 }">{{ newTodo }}</li>
  </ul>
</template>
```

When the mutation lives in a different component, give the mutation a `key` and read its state
elsewhere via `mutationCache.getEntries({ key })` (see `pinia-colada-cache.md`).

## Infinite Queries

All pages live in ONE cache entry. The page param is NOT in the key — only filters are.

```ts
import { useInfiniteQuery } from '@pinia/colada'

const { data, hasNextPage, loadNextPage, asyncStatus } = useInfiniteQuery({
  key: () => ['feed', { search: search.value }],
  initialPageParam: 1,
  query: ({ pageParam }) => fetch(`/api/feed?page=${pageParam}`).then((r) => r.json()),
  getNextPageParam: (lastPage) => lastPage.nextPage ?? null,
})

// data.value.pages: array of pages
// data.value.pageParams: param used for each page
```

Cursor-based:

```ts
useInfiniteQuery({
  key: ['notifications'],
  initialPageParam: null as string | null,
  query: ({ pageParam }) => api.listNotifications({ cursor: pageParam }),
  getNextPageParam: (lastPage) => lastPage.nextCursor ?? null,
})
```

Changing the key resets the infinite query.

## Paginated Queries

Each page is a separate cache entry — the page IS part of the key. Use `placeholderData` for smooth
transitions:

```ts
const page = ref(1)
const { data, isPlaceholderData } = useQuery({
  key: () => ['products', { page: page.value }],
  query: () => getProducts({ page: page.value }),
  placeholderData: (previousData) => previousData,
})
```

## Error Handling

Use `state` for TypeScript narrowing:

```vue
<div v-if="state.status === 'error'">{{ state.error.message }}</div>
<div v-else-if="state.data">{{ state.data }}</div>
```

Custom error type globally:

```ts
// types/pinia-colada.d.ts
declare module '@pinia/colada' {
  interface TypesConfig {
    defaultError: MyCustomError
  }
}
```

Global mutation error handling via `mutationOptions`:

```ts
app.use(PiniaColada, {
  mutationOptions: {
    onError(error) {
      showToast(error.message)
    },
  },
})
```

Global query error handling uses `PiniaColadaQueryHooksPlugin` — see `pinia-colada-plugins.md`.

Attach query meta, accessible in plugins:

```ts
useQuery({
  ...myQuery,
  meta: { errorMessage: 'Failed to load products' },
})
// In a plugin: entry.meta?.errorMessage
```

Augment the meta type:

```ts
declare module '@pinia/colada' {
  interface TypesConfig {
    queryMeta: { errorMessage?: string }
  }
}
```

## Query Cancellation

The `query` function receives a `signal` (AbortSignal). Pass it to fetch:

```ts
useQuery({
  key: ['products'],
  query: ({ signal }) => fetch('/api/products', { signal }).then((r) => r.json()),
})
```

Cancel from the cache without a refetch (useful in optimistic updates):

```ts
queryCache.cancelQueries({ key: ['products'] })
```

## SSR (Custom Setup)

Serialize the cache on the server, hydrate on the client using `devalue`:

```ts
// Server
import { serialize } from 'devalue'
import { serializeQueryCache } from '@pinia/colada'

const cacheData = serializeQueryCache(queryCache)
// Send serialize(cacheData) to the client
```

```ts
// Client
import { parse } from 'devalue'
import { hydrateQueryCache } from '@pinia/colada'

hydrateQueryCache(queryCache, parse(serverData))
```

Lazy queries (don't fetch on the server):

```ts
useQuery({ ...myQuery, enabled: false }) // enable on client mount
```

## Nuxt

Install the Nuxt module:

```bash
pnpm i @pinia/colada-nuxt
```

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@pinia/colada-nuxt'],
})
```

- No `await` needed — SSR is handled automatically.
- Use `$fetch` in query functions (works on both server and client).
- In `defineQuery`, import `useRoute` from `vue-router` (NOT from Nuxt auto-imports).
- Configure via `colada.options.ts` in the project root.
