# Vue 3 Patterns Reference

## Component Template

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

## Composables (Custom Hooks)

```typescript
// composables/useCounter.ts
import { ref, computed } from "vue";

const useCounter = () => {
  const count = ref(0);
  const doubled = computed(() => count.value * 2);

  const increment = (): void => {
    count.value++;
  };
  const decrement = (): void => {
    count.value--;
  };
  const reset = (): void => {
    count.value = initial;
  };

  return { count, doubled, increment, decrement, reset };
};

export default useCounter;
```

Naming: always `use` prefix, kebab-case file: `use-counter.ts`

## Pinia Store (Setup Syntax)

```typescript
// stores/use-auth-store.ts
import { defineStore } from "pinia";
import { ref, computed } from "vue";

export const useAuthStore = defineStore("auth", () => {
  const user = ref<User | null>(null);
  const isLoggedIn = computed(() => user.value !== null);

  async login = (credentials: LoginDto): void => {
    user.value = await authApi.login(credentials);
  }

  const logout = (): void => {
    user.value = null;
  }

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

## Reactivity Rules

| Rule                                          | Why                                            |
| --------------------------------------------- | ---------------------------------------------- |
| `ref()` for primitives                        | `.value` access is explicit, avoids confusion  |
| `reactive()` for objects (if needed)          | No `.value`, but can't reassign whole object   |
| `computed()` for derived state                | Caches automatically, updates when deps change |
| `watch()` for side effects                    | Async ops, API calls, logging                  |
| `watchEffect()` for auto-tracking             | Auto-detects dependencies                      |
| `toRef()` / `toRefs()` for prop destructuring | Maintains reactivity when destructuring        |

## Performance Patterns

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

## Form Handling (VeeValidate + Zod) - Optional

If project support vee-validate and zod

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
