# Avoid Over-Abstraction in List Items

**Bottleneck:** every component instance carries memory and lifecycle overhead. In
large `v-for` loops this multiplies — 100 items with 5 wrapper components each
creates 500+ instances instead of 100.

Measure with Vue DevTools (Components panel, instance count) before flattening.
Confirm the component depth is actually causing measurable slowdown.

## Contents

- [The overhead calculation](#the-overhead-calculation)
- [Before: deep wrapper stack](#before-deep-wrapper-stack)
- [After: flattened item component](#after-flattened-item-component)
- [When abstraction is still worth it](#when-abstraction-is-still-worth-it)
- [Alternatives to wrapper components](#alternatives-to-wrapper-components)

## The overhead calculation

| List size | Components per item | Total instances |
|---|---|---|
| 100 | 1 (flat) | 100 |
| 100 | 3 | 300 |
| 100 | 5 | 500 |
| 1 000 | 5 | 5 000 |

Each extra component instance means: one more VNode, one more lifecycle hook set,
one more proxy object, and one more entry in the component tree.

## Before: deep wrapper stack

```vue
<!-- parent list -->
<template>
  <div class="space-y-2">
    <!-- 100 users → 500+ component instances -->
    <UserCard v-for="user in users" :key="user.id" :user="user" />
  </div>
</template>

<!-- UserCard.vue — wraps generic UI components -->
<template>
  <Card>
    <CardHeader>
      <UserAvatar :src="user.avatar" />
    </CardHeader>
    <CardBody>
      <Text>{{ user.name }}</Text>
    </CardBody>
  </Card>
</template>

<script setup lang="ts">
defineProps<{ user: { id: number; name: string; avatar: string } }>()
</script>
```

`Card`, `CardHeader`, `CardBody`, `UserAvatar`, `Text` are each a component
instance — 5 instances per user row.

## After: flattened item component

```vue
<!-- parent list — unchanged -->
<template>
  <div class="space-y-2">
    <!-- 100 users → 100 component instances -->
    <UserCard v-for="user in users" :key="user.id" :user="user" />
  </div>
</template>

<!-- UserCard.vue — native elements with Tailwind, no wrappers -->
<template>
  <div class="flex items-center gap-3 rounded-lg border border-gray-200 p-3">
    <img
      :src="user.avatar"
      :alt="user.name"
      class="h-10 w-10 rounded-full object-cover"
    />
    <span class="text-sm font-medium text-gray-900">{{ user.name }}</span>
  </div>
</template>

<script setup lang="ts">
defineProps<{ user: { id: number; name: string; avatar: string } }>()
</script>
```

The visual result is identical; the component count drops from 500 to 100.

## When abstraction is still worth it

Not every abstraction is dead weight. Keep component wrappers when:

```vue
<template>
  <!-- 1. Complex encapsulated behavior (tooltips, async state, logic) -->
  <UserStatusIndicator :user="user" />

  <!-- 2. The list is small (< 20 items) — overhead is negligible -->
  <template v-if="items.length < 20">
    <FancyItem v-for="item in items" :key="item.id" :item="item" />
  </template>

  <!-- 3. Virtualization is active — only ~20 instances exist at a time -->
  <RecycleScroller :items="items" :item-size="72">
    <template #default="{ item }">
      <!-- Deep nesting is OK here — only 20 are alive -->
      <ComplexItemCard :item="item" />
    </template>
  </RecycleScroller>
</template>
```

## Alternatives to wrapper components

Replace purely-stylistic wrapper components with Tailwind classes:

```vue
<template>
  <!-- Instead of <Card>, <CardHeader>, <CardBody> -->
  <div class="rounded-lg border border-gray-200 shadow-sm">
    <div class="border-b border-gray-100 px-4 py-3">
      <!-- header content -->
    </div>
    <div class="px-4 py-3">
      <!-- body content -->
    </div>
  </div>

  <!-- Instead of <Button variant="primary"> -->
  <button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
    Click
  </button>

  <!-- Instead of <Text size="sm"> -->
  <span class="text-sm text-gray-600">{{ content }}</span>
</template>
```

Apply this only inside the hot `v-for` path. One-off usages elsewhere (headers,
modals, forms) are fine to keep as component abstractions.
