# Pinia (Global State)

Pinia setup stores hold **global UI/app state** — the authenticated user, theme, feature flags,
cross-page selections. They are NOT the place for server data fetching. When the project depends on
`@pinia/colada`, fetch and cache server data there instead (see `pinia-colada.md`, routed from
`SKILL.md`); keep stores for state that the app owns.

## Setup Store Syntax

Use the function (setup) form of `defineStore`. Expose state as `ref`/`computed`, methods as arrow
functions, and return everything consumers need.

```ts
// stores/use-auth-store.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const isLoggedIn = computed(() => user.value !== null)

  // Async method declared as a const arrow returning a Promise — valid TS.
  const login = async (credentials: LoginDto): Promise<void> => {
    user.value = await authApi.login(credentials)
  }

  const logout = (): void => {
    user.value = null
  }

  return { user, isLoggedIn, login, logout }
})
```

## Consuming a Store

Destructure **state/getters through `storeToRefs`** to keep reactivity; destructure **methods
directly** from the store (they are not reactive and `storeToRefs` would drop them).

```vue
<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/use-auth-store'

const authStore = useAuthStore()
const { user, isLoggedIn } = storeToRefs(authStore) // reactive state + getters
const { login, logout } = authStore // methods, destructured directly
</script>
```

## State vs Data Fetching

| Concern                                | Where it belongs                          |
| -------------------------------------- | ----------------------------------------- |
| Auth user, theme, flags, UI selections | Pinia store (this file)                   |
| Fetching/caching server resources      | Pinia Colada when `@pinia/colada` present |
| Shared reactive logic, no global scope | Composable (`composables.md`)             |

## SSR Note

Call stores inside a component `setup()` (or pass the `pinia` instance explicitly via
`useMyStore(pinia)`). Calling a store at top-level module scope in SSR creates an instance
disconnected from the request's app and loses hydration.
