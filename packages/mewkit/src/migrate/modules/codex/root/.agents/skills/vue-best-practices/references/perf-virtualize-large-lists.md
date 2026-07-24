# Virtualize Large Lists

**Bottleneck:** rendering all list items creates excessive DOM nodes — memory spikes, slow initial render, expensive updates.

Measure with Vue DevTools (Performance panel) before adding virtualization. Confirm the list is actually the hotspot.

Apply virtualization when a list exceeds ~50–100 items, especially with complex item content.

## Contents

- [Why it matters](#why-it-matters)
- [Library options](#library-options)
- [Before / after: plain v-for](#before--after-plain-v-for)
- [@tanstack/vue-virtual (already in this repo)](#tanstackvue-virtual-already-in-this-repo)
- [Variable-height items](#variable-height-items)
- [When NOT to virtualize](#when-not-to-virtualize)

## Why it matters

| Approach | 100 items | 1 000 items | 10 000 items |
|---|---|---|---|
| Plain `v-for` | ~100 DOM nodes | ~1 000 nodes | ~10 000 nodes / crashes |
| Virtualized | ~20 DOM nodes | ~20 nodes | ~20 nodes |

## Library options

| Library | Best for |
|---|---|
| `@tanstack/vue-virtual` | Complex layouts, headless; **already present in this repo** |
| `vue-virtual-scroller` | General use, easy setup with built-in CSS |
| `vue-virtual-scroll-grid` | 2D grid virtualization |

Do not pin versions. Prefer `@tanstack/vue-virtual` as a first choice given it is already a dependency.

## Before / after: plain v-for

```vue
<!-- BAD: all 10 000 items rendered at once -->
<template>
  <div class="h-[600px] overflow-auto">
    <UserCard
      v-for="user in users"
      :key="user.id"
      :user="user"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import UserCard from './UserCard.vue'

const users = ref<User[]>([])

onMounted(async () => {
  users.value = await fetchAllUsers() // 10 000 DOM nodes
})
</script>
```

## @tanstack/vue-virtual (already in this repo)

```vue
<template>
  <div ref="parentRef" class="h-[600px] overflow-auto">
    <div :style="{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }">
      <div
        v-for="row in virtualizer.getVirtualItems()"
        :key="row.key"
        :style="{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: `${row.size}px`,
          transform: `translateY(${row.start}px)`,
        }"
      >
        <UserCard :user="users[row.index]" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useVirtualizer } from '@tanstack/vue-virtual'
import UserCard from './UserCard.vue'

type User = { id: number; name: string }

const users = ref<User[]>([/* 10 000 users */])
const parentRef = ref<HTMLElement | null>(null)

const virtualizer = useVirtualizer({
  count: users.value.length,
  getScrollElement: () => parentRef.value,
  estimateSize: () => 80,   // estimated row height in px
  overscan: 5,              // extra rows above/below viewport
})
</script>
```

## Variable-height items

When item heights differ, use `vue-virtual-scroller`'s `DynamicScroller`:

```vue
<template>
  <DynamicScroller :items="messages" :min-item-size="54" key-field="id" class="h-[600px]">
    <template #default="{ item, index, active }">
      <DynamicScrollerItem :item="item" :active="active" :data-index="index">
        <ChatMessage :message="item" />
      </DynamicScrollerItem>
    </template>
  </DynamicScroller>
</template>

<script setup lang="ts">
import { DynamicScroller, DynamicScrollerItem } from 'vue-virtual-scroller'
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css'
import ChatMessage from './ChatMessage.vue'
import type { Message } from '@/types'

defineProps<{ messages: Message[] }>()
</script>
```

## When NOT to virtualize

- Lists under 50 items with simple content
- Content that must all be in initial HTML for SEO
- Print layouts where all nodes must render
- Accessibility contexts where every item must be reachable simultaneously
