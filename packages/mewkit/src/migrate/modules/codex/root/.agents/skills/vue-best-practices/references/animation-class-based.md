# Class-based Animations

## Contents
- [Decision](#decision)
- [Pattern: animationend event (preferred)](#pattern-animationend-event-preferred)
- [Pattern: setTimeout (when you need a fixed reset window)](#pattern-settimeout-when-you-need-a-fixed-reset-window)
- [Pattern: watch-triggered highlight](#pattern-watch-triggered-highlight)
- [Reusable composable](#reusable-composable)

**Use only when:** animating elements that stay mounted (shake on error, pulse on success, highlight on change). For enter/leave DOM transitions, use `<Transition>` instead — see `references/component-transition.md`.

## Decision

| Need | Use |
|---|---|
| Element stays in DOM, feedback animation | Class-based (this doc) |
| Element enters/leaves DOM (`v-if`/`v-show`) | `<Transition>` |
| List item add/remove | `<TransitionGroup>` |

## Pattern: `animationend` event (preferred)

Avoids `setTimeout` drift — the class removes itself when the animation finishes.

```vue
<script setup lang="ts">
import { ref } from 'vue'

const isShaking = ref(false)

const triggerShake = () => {
  isShaking.value = true
}
</script>

<template>
  <div
    :class="{ shake: isShaking }"
    @animationend="isShaking = false"
  >
    <button @click="triggerShake" class="px-4 py-2 bg-red-500 text-white rounded">
      Submit
    </button>
  </div>
</template>

<style scoped>
.shake {
  animation: shake 0.82s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
  transform: translate3d(0, 0, 0); /* GPU layer */
}

@keyframes shake {
  10%, 90% { transform: translate3d(-1px, 0, 0); }
  20%, 80% { transform: translate3d(2px, 0, 0); }
  30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
  40%, 60% { transform: translate3d(4px, 0, 0); }
}
</style>
```

## Pattern: `setTimeout` (when you need a fixed reset window)

```vue
<script setup lang="ts">
import { ref } from 'vue'

const saved = ref(false)

const save = async () => {
  await saveData()
  saved.value = true
  setTimeout(() => { saved.value = false }, 1000)
}
</script>

<template>
  <button
    :class="{ pulse: saved }"
    class="px-4 py-2 bg-blue-500 text-white rounded"
    @click="save"
  >
    {{ saved ? 'Saved!' : 'Save' }}
  </button>
</template>

<style scoped>
.pulse { animation: pulse 0.5s ease-in-out; }

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}
</style>
```

## Pattern: watch-triggered highlight

```vue
<script setup lang="ts">
import { ref, watch } from 'vue'

const value = ref(0)
const justUpdated = ref(false)

watch(value, () => {
  justUpdated.value = true
  setTimeout(() => { justUpdated.value = false }, 1000)
})
</script>

<template>
  <div :class="{ highlight: justUpdated }" class="p-2 rounded">
    Value: {{ value }}
  </div>
</template>

<style scoped>
.highlight { animation: highlight 1s ease-out; }

@keyframes highlight {
  0% { background-color: #fef08a; }
  100% { background-color: transparent; }
}
</style>
```

## Reusable composable

```ts
// composables/use-animation-trigger.ts
import { ref } from 'vue'

export default (duration = 500) => {
  const isAnimating = ref(false)

  const trigger = () => {
    isAnimating.value = true
    setTimeout(() => { isAnimating.value = false }, duration)
  }

  return { isAnimating, trigger }
}
```

```vue
<script setup lang="ts">
import useAnimationTrigger from '@/composables/use-animation-trigger'

const shake = useAnimationTrigger(820)
const pulse = useAnimationTrigger(500)
</script>

<template>
  <button :class="{ shake: shake.isAnimating.value }" @click="shake.trigger()"
    class="mr-2 px-4 py-2 rounded border">
    Shake
  </button>
  <button :class="{ pulse: pulse.isAnimating.value }" @click="pulse.trigger()"
    class="px-4 py-2 rounded border">
    Pulse
  </button>
</template>
```
