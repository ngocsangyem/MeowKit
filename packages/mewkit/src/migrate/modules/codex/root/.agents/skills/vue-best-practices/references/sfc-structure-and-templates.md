Basics live in `mk:vue` references/components.md and references/reactivity-performance.md — this covers SFC structure, scoped-style performance, and template-safety topics beyond them.

## Contents

- [Scoped styles + class-selector performance](#scoped-styles--class-selector-performance)
- [style camelCase bindings](#style-camelcase-bindings)
- [v-for + v-if separation](#v-for--v-if-separation)
- [v-if vs v-show](#v-if-vs-v-show)
- [v-html and sanitization](#v-html-and-sanitization)
- [useTemplateRef for DOM access](#usetemplateref-for-dom-access)

---

## Scoped styles + class-selector performance

Use `<style scoped>` so styles stay local to the component. Inside scoped blocks, prefer
class selectors over element selectors — Vue's scoped attribute is appended to both the
element and the selector, so element selectors compile to `h1[data-v-xxxxx]` which is
evaluated right-to-left by the browser (slower than `.title[data-v-xxxxx]`).

```vue
<!-- BAD: element selectors compile to slower attribute-qualified rules -->
<template>
  <article>
    <h1>{{ title }}</h1>
    <p>{{ body }}</p>
  </article>
</template>

<style scoped>
article { max-width: 72ch; }
h1 { font-size: 1.5rem; }
p  { line-height: 1.7; }
</style>
```

```vue
<!-- GOOD: class selectors; faster browser matching -->
<template>
  <article class="article">
    <h1 class="article-title">{{ title }}</h1>
    <p class="article-body">{{ body }}</p>
  </article>
</template>

<style scoped>
.article       { max-width: 72ch; }
.article-title { font-size: 1.5rem; }
.article-body  { line-height: 1.7; }
</style>
```

For projects using Tailwind, apply utility classes in the template and reserve `<style scoped>`
for cases where Tailwind cannot express the rule (e.g. pseudo-content, complex grid areas).

---

## :style camelCase bindings

Use camelCase JavaScript property names in `:style` object bindings for IDE support and
to avoid the quoting noise of kebab-case string keys.

```vue
<!-- BAD: quoted kebab keys -->
<template>
  <div :style="{ 'font-size': size + 'px', 'background-color': bg }">content</div>
</template>

<!-- GOOD: camelCase keys -->
<template>
  <div :style="{ fontSize: size + 'px', backgroundColor: bg }">content</div>
</template>
```

---

## v-for + v-if separation

Never place `v-for` and `v-if` on the same element — it produces unclear intent and wastes
work. Two patterns cover all real cases:

**Filter items before rendering — use a computed:**

```vue
<script setup lang="ts">
import { ref, computed } from 'vue'

type User = { id: number; name: string; active: boolean }
const users = ref<User[]>([])

const activeUsers = computed(() => users.value.filter(u => u.active))
</script>

<template>
  <!-- ✅ v-for on the computed list; no v-if needed on the same element -->
  <li
    v-for="user in activeUsers"
    :key="user.id"
    class="py-1"
  >
    {{ user.name }}
  </li>
</template>
```

**Conditionally show the entire list — wrap with v-if:**

```vue
<template>
  <ul v-if="users.length > 0" class="divide-y">
    <li v-for="user in users" :key="user.id" class="py-1">
      {{ user.name }}
    </li>
  </ul>
  <p v-else class="text-gray-500">No users found.</p>
</template>
```

---

## v-if vs v-show

| Directive | Mechanism | Use when |
|---|---|---|
| `v-if` | Mount / unmount from DOM | Rarely toggled; expensive initial render is acceptable; condition affects server-rendered output |
| `v-show` | `display: none` toggle | Toggled frequently; child state must survive hidden |

```vue
<template>
  <!-- Frequent toggle (dropdown, tab panel) — keep in DOM -->
  <DropdownMenu v-show="isOpen" />

  <!-- Role-based; shown once after auth check — lazy render -->
  <AdminPanel v-if="isAdmin" />
</template>
```

---

## v-html and sanitization

Never render user-provided content with `v-html` — it is a direct XSS vector. `v-html`
is only acceptable for **trusted** HTML you control (CMS rich-text, markdown output from
your own pipeline). Even then, sanitize before rendering.

```vue
<script setup lang="ts">
import { computed } from 'vue'
import DOMPurify from 'dompurify'

type Props = {
  /** Trusted HTML from the CMS pipeline — never raw user input */
  trustedHtml: string
  /** Plain user text — always escape via interpolation */
  userText: string
}

const props = defineProps<Props>()

// Sanitize before binding — DOMPurify strips dangerous tags and attributes
const safeHtml = computed(() => DOMPurify.sanitize(props.trustedHtml))
</script>

<template>
  <!-- ✅ user content: escaped interpolation, never v-html -->
  <p class="text-sm text-gray-700">{{ props.userText }}</p>

  <!-- ✅ trusted CMS content: sanitized before render -->
  <article class="prose" v-html="safeHtml" />
</template>
```

---

## useTemplateRef for DOM access

`useTemplateRef` (Vue 3.5+) is the canonical way to access a template ref — the string
key in `ref="..."` is matched by name to the `useTemplateRef` call.

```vue
<script setup lang="ts">
import { useTemplateRef, onMounted } from 'vue'

// The string argument must match the ref="..." value in the template
const inputEl = useTemplateRef<HTMLInputElement>('search-input')

onMounted(() => {
  inputEl.value?.focus()
})
</script>

<template>
  <input
    ref="search-input"
    type="search"
    class="rounded border border-gray-300 px-3 py-1.5 focus:outline-none focus:ring-2"
    placeholder="Search..."
  />
</template>
```
