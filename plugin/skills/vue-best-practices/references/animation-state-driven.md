# State-driven Animations

**Use only when:** animation values need to interpolate continuously from reactive state — mouse position, scroll offset, slider input, or real-time counters. For enter/leave transitions, use `<Transition>` — see `references/component-transition.md`.

## Contents
- [When to use](#when-to-use)
- [Mouse-tracking](#mouse-tracking)
- [Scroll parallax + fade](#scroll-parallax--fade)
- [Progress bar](#progress-bar)
- [Theme transition via CSS vars](#theme-transition-via-css-vars)
- [Numerical tweening (GSAP)](#numerical-tweening-gsap)
- [Performance notes](#performance-notes)

## When to use

| Signal type | Pattern |
|---|---|
| Mouse position | `:style` binding, `transform` |
| Scroll position | computed + `onMounted` scroll listener |
| Range / slider input | `:style` + CSS `transition` |
| Animated counter | watcher + GSAP/requestAnimationFrame |

## Mouse-tracking

```vue
<script setup lang="ts">
import { ref } from 'vue'

const x = ref(0)
const y = ref(0)

const onMousemove = (e: MouseEvent) => {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  x.value = e.clientX - rect.left
  y.value = e.clientY - rect.top
}
</script>

<template>
  <div
    class="relative h-64 bg-slate-100 rounded overflow-hidden"
    @mousemove="onMousemove"
  >
    <div
      class="pointer-events-none absolute w-5 h-5 bg-blue-500 rounded-full"
      :style="{ transform: `translate(${x}px, ${y}px)` }"
    />
  </div>
</template>

<style scoped>
div > div { transition: transform 0.1s ease-out; }
</style>
```

## Scroll parallax + fade

```vue
<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

const scrollY = ref(0)

const heroOpacity = computed(() => Math.max(0, 1 - scrollY.value / 300))
const heroOffset = computed(() => scrollY.value * 0.5)

const onScroll = () => { scrollY.value = window.scrollY }

onMounted(() => window.addEventListener('scroll', onScroll, { passive: true }))
onUnmounted(() => window.removeEventListener('scroll', onScroll))
</script>

<template>
  <div
    class="flex items-center justify-center h-screen"
    :style="{
      opacity: heroOpacity,
      transform: `translateY(${heroOffset}px)`
    }"
  >
    <h1 class="text-4xl font-bold">Scroll down</h1>
  </div>
</template>
```

Note: no CSS `transition` here — scroll updates should be instant; adding a transition creates lag.

## Progress bar

```vue
<script setup lang="ts">
import { ref } from 'vue'

const progress = ref(0)
</script>

<template>
  <div class="space-y-2">
    <div class="h-4 bg-slate-200 rounded-full overflow-hidden">
      <div
        class="h-full bg-green-500 rounded-full"
        :style="{ width: `${progress}%` }"
      />
    </div>
    <input v-model.number="progress" type="range" min="0" max="100" class="w-full" />
  </div>
</template>

<style scoped>
div > div > div { transition: width 0.3s ease; }
</style>
```

## Theme transition via CSS vars

```vue
<script setup lang="ts">
import { ref, computed } from 'vue'

const isDark = ref(false)

const themeStyles = computed(() => ({
  '--bg': isDark.value ? '#1a1a1a' : '#ffffff',
  '--fg': isDark.value ? '#ffffff' : '#1a1a1a',
  backgroundColor: 'var(--bg)',
  color: 'var(--fg)',
}))

const toggleTheme = () => { isDark.value = !isDark.value }
</script>

<template>
  <div class="min-h-screen p-8 transition-colors duration-500" :style="themeStyles">
    <button @click="toggleTheme" class="px-4 py-2 border rounded">
      {{ isDark ? 'Light mode' : 'Dark mode' }}
    </button>
  </div>
</template>
```

## Numerical tweening (GSAP)

For smooth counter animations where CSS transitions can't interpolate raw numbers:

```vue
<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import gsap from 'gsap'

const target = ref(0)
const tweened = reactive({ value: 0 })

const display = computed(() => tweened.value.toFixed(0))

watch(target, (n) => {
  gsap.to(tweened, { duration: 0.5, value: Number(n) || 0, ease: 'power2.out' })
})
</script>

<template>
  <div class="flex items-center gap-4">
    <input v-model.number="target" type="number" class="border rounded px-2 py-1 w-32" />
    <p class="text-4xl font-mono tabular-nums">{{ display }}</p>
  </div>
</template>
```

## Performance notes

Prefer GPU-composited properties — they skip layout and paint:

```css
/* Good: compositor-only */
.el { transition: transform 0.3s ease, opacity 0.3s ease; }

/* Avoid for high-frequency updates: triggers layout */
.el { transition: width 0.3s, height 0.3s, margin 0.3s; }

/* For very frequent updates (mousemove at 60fps), hint the GPU */
.follower { will-change: transform; }
```
