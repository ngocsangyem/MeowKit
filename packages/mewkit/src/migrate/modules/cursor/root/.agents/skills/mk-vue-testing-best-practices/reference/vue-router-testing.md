---
title: Test Vue Router — Mock the Router or Use a Real Memory-History Instance
impact: HIGH
impactDescription: Components using useRoute/useRouter throw or read stale route state when the router is missing or navigation is not awaited
type: best-practice
tags: [vue3, testing, vue-router, useRoute, useRouter, navigation-guards, vitest, vue-test-utils]
---

# Test Vue Router — Mock the Router or Use a Real Memory-History Instance

**Impact: HIGH** - Components that call `useRoute()` / `useRouter()` need a router in the
test context, or mounting throws. Navigation is async, so assertions that don't await
`router.isReady()` / `flushPromises()` read stale route state and flake.

Two strategies: **mock** the composables for isolated component logic, or install a **real
memory-history router** for navigation/guards.

## Contents

- Task Checklist
- Mock the composables (isolated logic)
- Real memory-history router (navigation + guards)
- Testing Navigation Guards

## Task Checklist

- [ ] Pick a strategy: mock `useRoute`/`useRouter` for isolation, or a real router for navigation
- [ ] For a real router, use `createRouter({ history: createMemoryHistory(), routes })`
- [ ] `await router.push(...)` then `await router.isReady()` before asserting route-dependent output
- [ ] `await flushPromises()` after navigation that triggers async data loading
- [ ] Test navigation guards as plain functions where possible, then via the router for integration
- [ ] Assert on visible output or `router.currentRoute.value`, not router internals

**Incorrect:**
```javascript
import { mount } from '@vue/test-utils'
import UserPage from './UserPage.vue'

// BAD: no router — useRoute() returns undefined, component throws
test('shows the user id from the route', () => {
  const wrapper = mount(UserPage)
  expect(wrapper.text()).toContain('42')
})
```

**Correct — mock the composables (isolated logic):**
```javascript
import { mount } from '@vue/test-utils'
import { useRoute, useRouter } from 'vue-router'
import { vi } from 'vitest'
import UserPage from './UserPage.vue'

vi.mock('vue-router')

test('reads the userId param and navigates home on close', async () => {
  vi.mocked(useRoute).mockReturnValue({ params: { userId: '42' } })
  const push = vi.fn()
  vi.mocked(useRouter).mockReturnValue({ push })

  const wrapper = mount(UserPage)
  expect(wrapper.text()).toContain('42')

  await wrapper.find('[data-testid="close"]').trigger('click')
  expect(push).toHaveBeenCalledWith({ name: 'home' })
})
```

**Correct — real memory-history router (navigation + guards):**
```javascript
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import App from './App.vue'
import { routes } from '@/router/routes'

test('navigates to the profile route and renders it', async () => {
  const router = createRouter({ history: createMemoryHistory(), routes })

  await router.push('/users/42')
  await router.isReady()

  const wrapper = mount(App, { global: { plugins: [router] } })
  await flushPromises() // async route data, if any

  expect(wrapper.text()).toContain('User 42')
})
```

## Testing Navigation Guards

```javascript
import { createRouter, createMemoryHistory } from 'vue-router'
import { routes } from '@/router/routes'

test('redirects unauthenticated users to /login', async () => {
  const router = createRouter({ history: createMemoryHistory(), routes })
  router.beforeEach((to) => (to.meta.requiresAuth && !isLoggedIn() ? '/login' : true))

  await router.push('/dashboard')
  await router.isReady()

  expect(router.currentRoute.value.fullPath).toBe('/login')
})
```

For a guard that is a standalone function, prefer unit-testing it directly — call it with
`(to, from)` stubs and assert the returned redirect/`true`/`false`. Use the router only for
the integration path.

## Reference
- [Vue Router — Testing](https://test-utils.vuejs.org/guide/advanced/vue-router.html)
- [Vue Router — createMemoryHistory](https://router.vuejs.org/api/#creatememoryhistory)
