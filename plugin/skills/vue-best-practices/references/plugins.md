# Vue Plugins

## Contents
- [Plugin contract](#plugin-contract)
- [Register capabilities inside install()](#register-capabilities-inside-install)
- [Symbol injection keys](#use-symbol-injection-keys)
- [Typed composable wrapper](#typed-composable-wrapper-for-required-injections)

**Use only when:** behavior must be installed app-wide — global components, global directives, app-scoped services (i18n, auth, http), or `provide`/`inject` singletons. For feature-scoped behavior, prefer composables.

## Plugin contract

A plugin is either an object with `install(app, options?)` or a bare function with the same signature.

```ts
// plugins/my-plugin.ts
import type { App, Plugin } from 'vue'

type MyOptions = {
  prefix?: string
  debug?: boolean
}

export const myPlugin: Plugin<[MyOptions?]> = {
  install(app: App, options: MyOptions = {}) {
    const { prefix = 'my', debug = false } = options
    if (debug) console.log('[myPlugin] installed with prefix:', prefix)
    app.provide(myKey, { prefix })
  },
}
```

```ts
// main.ts
import { createApp } from 'vue'
import App from './App.vue'
import { myPlugin } from '@/plugins/my-plugin'

createApp(App)
  .use(myPlugin, { prefix: 'custom', debug: true })
  .mount('#app')
```

## Register capabilities inside `install()`

Use the `app` instance APIs — don't register things outside `install()`:

```ts
import type { App } from 'vue'
import GlobalAlert from '@/components/global-alert.vue'
import { vHighlight } from '@/directives/v-highlight'
import { createAuthService } from '@/services/auth-service'
import { authKey } from '@/injection-keys'

export const appPlugin = {
  install(app: App) {
    app.component('GlobalAlert', GlobalAlert)   // global component
    app.directive('highlight', vHighlight)       // global directive
    app.provide(authKey, createAuthService())    // injectable service
    // avoid app.config.globalProperties unless strictly necessary
  },
}
```

## Use symbol injection keys

String keys collide across plugins. Use `InjectionKey<T>` for uniqueness and type-safe injection.

```ts
// injection-keys.ts
import type { InjectionKey } from 'vue'
import type { AxiosInstance } from 'axios'

type AppConfig = { apiUrl: string; timeout: number }

export const httpKey: InjectionKey<AxiosInstance> = Symbol('http')
export const configKey: InjectionKey<AppConfig> = Symbol('appConfig')
```

```ts
// plugins/http-plugin.ts
import type { App, Plugin } from 'vue'
import axios from 'axios'
import { httpKey, configKey } from '@/injection-keys'

export const httpPlugin: Plugin = {
  install(app: App) {
    app.provide(httpKey, axios.create({ baseURL: '/api' }))
    app.provide(configKey, { apiUrl: '/api', timeout: 5000 })
  },
}
```

## Typed composable wrapper for required injections

Wrap `inject` in a composable that throws a clear error on missing plugin — fail at setup time, not at runtime in a handler.

```ts
// composables/use-auth.ts
import { inject } from 'vue'
import { authKey } from '@/injection-keys'
import type { AuthService } from '@/services/auth-service'

export default (): AuthService => {
  const auth = inject(authKey)
  if (!auth) {
    throw new Error('useAuth: authPlugin is not installed. Call app.use(authPlugin) in main.ts.')
  }
  return auth
}
```

```vue
<script setup lang="ts">
import useAuth from '@/composables/use-auth'

const auth = useAuth()
</script>
```
