---
title: "mk:vue"
description: "Vue 3 Composition API patterns — Pinia state management, reactivity, component design, forms, performance. Auto-activates on .vue files."
---

# mk:vue

Vue 3 Composition API patterns, Pinia, reactivity, component design, forms, and performance. Auto-activates on `.vue` files.

> Use `npx chub search vue` for relevant documentation packages within the Context Hub.

## What This Skill Does

Provides Vue 3 best practices and patterns for building components, composables, Pinia stores, and forms. Enforces Composition API with `<script setup lang="ts">` and TypeScript interfaces throughout. Prevents common reactivity pitfalls and deprecated Options API usage.

## When to Use

**Auto-activate on:** `.vue` files, Vue 3 Composition API, Pinia stores, `<script setup>`, Vue Router, composables.

**Explicit:** `/mk:vue [concern]`

**Do NOT invoke for:** TypeScript fundamentals (use `mk:typescript`), visual design (use `mk:frontend-design`), testing (use `mk:testing`).

## Core Capabilities

- **Component design** — `<script setup lang="ts">`, TypeScript props/emits/slots, PascalCase naming
- **Composables** — reusable reactive logic with `use*` prefix, kebab-case files
- **Pinia stores** — setup syntax with `storeToRefs()` for reactive destructuring
- **Reactivity** — `ref()` for primitives, `reactive()` for complex objects, `computed()` for derived state
- **Performance** — `v-once`, `v-memo`, `defineAsyncComponent`, code splitting
- **Forms** — VeeValidate + Zod integration (optional, when project supports)

## Arguments

| Argument | Type | Description |
|----------|------|-------------|
| `concern` | string | Optional. Focus area: component, composable, store, form, performance |

## Workflow

Operates in **Phase 3 (Build GREEN)**. Output supports the `developer` agent.

### Process

1. **Detect concern** — component? composable? store? form? performance?
2. **Load relevant reference** — `references/vue-patterns.md`
3. **Apply patterns** — implement using Vue 3 best practices from references
4. **Verify** — component renders, types pass, no console warnings

## Core Rules (always apply)

- **ALWAYS** use `<script setup lang="ts">` — never Options API
- **ALWAYS** use `defineProps` with TypeScript interfaces — never runtime validation
- **ALWAYS** use `storeToRefs()` when destructuring Pinia store state
- **NEVER** use `v-html` with user content (security-rules.md — XSS vector)
- **PREFER** composables (`use*`) over mixins
- **PREFER** `ref()` for primitives, `reactive()` only for complex objects
- **NAME** components PascalCase, files kebab-case (naming-rules.md)

## Anti-Patterns

| Don't | Do Instead |
|-------|------------|
| Options API (`data()`, `methods:`) | Composition API `<script setup>` |
| `this.$store` / Vuex | Pinia with setup store syntax |
| Direct store state destructuring | `storeToRefs(useMyStore())` |
| `v-html` with dynamic content | `v-text` or sanitized rendering |
| `reactive()` for primitives | `ref()` for primitives |
| Watchers when computed works | `computed()` for derived state |
| Global event bus | `provide/inject` or Pinia |
| `defineComponent()` wrapper | `<script setup>` directly |

## Patterns

### Component Template

```vue
<script setup lang="ts">
import { ref, computed, onMounted } from "vue";

type Slots = {
  default: [];
};

type Props = {
  title: string;
  count?: number;
};

type Emits = {
  update: [value: number];
};

const slots = defineSlots<Slots>();

const props = withDefaults(defineProps<Props>(), {
  count: 0,
});

const emit = defineEmits<Emits>();

const localCount = ref(props.count);
const doubled = computed(() => localCount.value * 2);

const increment = (): void => {
  localCount.value++;
  emit("update", localCount.value);
};

onMounted(() => {
  // setup logic
});
</script>

<template>
  <div>
    <h2>{{ title }}</h2>
    <p>Count: {{ localCount }} (doubled: {{ doubled }})</p>
    <button @click="increment">+1</button>
  </div>
</template>
```

### Composables

```typescript
// composables/useCounter.ts
import { ref, computed } from "vue";

const useCounter = () => {
  const count = ref(0);
  const doubled = computed(() => count.value * 2);

  const increment = (): void => { count.value++; };
  const decrement = (): void => { count.value--; };
  const reset = (): void => { count.value = 0; };

  return { count, doubled, increment, decrement, reset };
};

export default useCounter;
```

Naming: always `use` prefix, kebab-case file: `use-counter.ts`

### Pinia Store (Setup Syntax)

```typescript
// stores/use-auth-store.ts
import { defineStore } from "pinia";
import { ref, computed } from "vue";

export const useAuthStore = defineStore("auth", () => {
  const user = ref<User | null>(null);
  const isLoggedIn = computed(() => user.value !== null);

  const login = async (credentials: LoginDto): Promise<void> => {
    user.value = await authApi.login(credentials);
  };

  const logout = (): void => {
    user.value = null;
  };

  return { user, isLoggedIn, login, logout };
});
```

Usage in component — always use `storeToRefs`:

```vue
<script setup lang="ts">
import { storeToRefs } from "pinia";
import { useAuthStore } from "@/stores/use-auth-store";

const authStore = useAuthStore();
const { user, isLoggedIn } = storeToRefs(authStore);
// Methods destructured directly (not reactive)
const { login, logout } = authStore;
</script>
```

### Reactivity Rules

| Rule | Why |
|------|-----|
| `ref()` for primitives | `.value` access is explicit, avoids confusion |
| `reactive()` for objects (if needed) | No `.value`, but can't reassign whole object |
| `computed()` for derived state | Caches automatically, updates when deps change |
| `watch()` for side effects | Async ops, API calls, logging |
| `watchEffect()` for auto-tracking | Auto-detects dependencies |
| `toRef()` / `toRefs()` for prop destructuring | Maintains reactivity when destructuring |

### Performance Patterns

```vue
<!-- v-once for static content -->
<span v-once>{{ expensiveComputation }}</span>

<!-- v-memo for conditional skip -->
<div v-memo="[item.id, item.selected]">
  {{ item.name }}
</div>

<!-- Async components for code splitting -->
<script setup lang="ts">
import { defineAsyncComponent } from "vue";
const HeavyChart = defineAsyncComponent(() => import("./HeavyChart.vue"));
</script>
```

### Form Handling (VeeValidate + Zod)

If project supports vee-validate and zod:

```vue
<script setup lang="ts">
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import { z } from "zod";

const schema = toTypedSchema(
  z.object({
    email: z.string().email("Invalid email"),
    password: z.string().min(8, "Min 8 characters"),
  }),
);

const { handleSubmit, errors } = useForm({ validationSchema: schema });

const onSubmit = handleSubmit(async (values) => {
  await authStore.login(values);
});
</script>
```

## Output Format

```
## Vue: {concern}

**Files:** {list of .vue files modified}
**Pattern:** {composition API | pinia store | composable | component}

### Implementation
{code changes with Vue 3 patterns applied}

### Verification
{component renders, no console warnings, types pass}
```

## Failure Handling

| Failure | Recovery |
|---------|----------|
| Vue 2 syntax detected (Options API) | Migrate to Composition API `<script setup>` |
| Pinia not installed | `npm install pinia` |
| Type errors in template | Fix with `defineProps<T>()` typing |

## Gotchas

- **Destructuring `reactive()` loses reactivity** — `const { count } = reactive({ count: 0 })` makes `count` a plain number; always use `toRefs()` or keep the reactive object intact, or switch to `ref()`.
- **`storeToRefs()` not called when destructuring Pinia store** — `const { user } = useAuthStore()` gives a non-reactive snapshot; `const { user } = storeToRefs(useAuthStore())` is required for reactive bindings.
- **`<script setup>` with `defineExpose()` is required for parent `ref` access** — calling `childRef.value.method()` from a parent always returns `undefined` unless the child explicitly `defineExpose({ method })`; omitting this is silent until runtime.
- **`:deep()` selector broken when component uses scoped styles + slot content** — slot content comes from the parent scope, so `:deep(.child-class)` in a scoped style block has no effect on slotted content; use `:slotted(.child-class)` instead.
- **`watchEffect` cleanup race on fast re-renders** — without calling the `onCleanup` callback to cancel async operations, a fast prop change triggers a second effect before the first resolves, causing stale state writes; always register cleanup via `watchEffect((onCleanup) => { onCleanup(() => controller.abort()) })`.
- **Pinia store state not hydrated in SSR (Nuxt/Vite SSR)** — calling `useMyStore()` outside a component setup context (e.g., in a top-level module) creates a store instance disconnected from the SSR app; always call stores inside `setup()` or pass the `pinia` instance explicitly via `useMyStore(pinia)`.

## References

| Reference | When to load | Content |
|-----------|-------------|---------|
| `references/vue-patterns.md` | Component/composable work | Composition API, reactivity, component design, performance |

## Common Use Cases

- Creating new Vue 3 components with proper TypeScript typing
- Migrating from Options API to Composition API
- Setting up Pinia stores with setup syntax
- Building reusable composables
- Optimizing rendering with `v-once` and `v-memo`
- Implementing form validation with VeeValidate + Zod

## Example Prompt

> /mk:vue store
> I'm setting up auth state management for my Vue 3 app. Generate a Pinia store with proper TypeScript typing, setup syntax, and show me how to use storeToRefs in my components so I don't lose reactivity.

## Pro Tips

- Use `defineProps<T>()` with interfaces for type safety — never runtime validation
- Destructure methods directly from the store, but always use `storeToRefs()` for state
- Use `computed()` instead of `watch()` for derived state whenever possible
- Always test components after refactoring — ensure no console warnings appear
- For SSR projects, always call Pinia stores inside `setup()` context
