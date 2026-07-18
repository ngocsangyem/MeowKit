<script setup lang="ts">
import { KIND_COLORS } from '~/components/galaxy/galaxy-draw-helpers'
import type { GalaxyInstance } from '~/components/galaxy/galaxy-draw-helpers'

const props = defineProps<{
  node: GalaxyInstance | null
  planetLabels: Record<string, string>
}>()

const orbits = computed(() => {
  if (!props.node?.satelliteId) return null
  return props.planetLabels[props.node.planetId] ?? props.node.planetId
})
const shared = computed(() =>
  (props.node?.sharedWith ?? []).map(id => props.planetLabels[id] ?? id),
)
</script>

<template>
  <aside
    class="rounded-lg border p-5"
    style="background: var(--color-paper-2); border-color: var(--color-rule)"
    aria-live="polite"
  >
    <template v-if="node">
      <div class="flex items-center gap-3">
        <h2 class="text-lg font-semibold" style="color: var(--color-ink)">
          {{ node.label }}
        </h2>
        <span
          class="rounded-full px-2.5 py-0.5 text-xs font-medium"
          :style="{ background: `${KIND_COLORS[node.kind]}22`, color: KIND_COLORS[node.kind] }"
        >
          {{ node.kind }}
        </span>
      </div>
      <p class="mt-3 text-sm leading-relaxed" style="color: var(--color-ink-2)">
        {{ node.detail }}
      </p>
      <dl class="mt-4 space-y-2 text-sm">
        <div v-if="orbits">
          <dt class="inline" style="color: var(--color-muted)">Orbits:</dt>
          <dd class="inline ml-1" style="color: var(--color-ink-2)">
            {{ orbits }}<span v-if="node.edge"> ({{ node.edge }})</span>
          </dd>
        </div>
        <div v-if="shared.length">
          <dt class="inline" style="color: var(--color-muted)">Shared with:</dt>
          <dd class="inline ml-1" style="color: var(--color-ink-2)">{{ shared.join(', ') }}</dd>
        </div>
        <div v-if="!node.satelliteId">
          <dt class="inline" style="color: var(--color-muted)">Role:</dt>
          <dd class="inline ml-1" style="color: var(--color-ink-2)">workflow hub</dd>
        </div>
      </dl>
      <p class="mt-4 break-all text-xs" style="font-family: var(--font-mono); color: var(--color-muted)">
        {{ node.sourceRef }}
      </p>
    </template>
    <p v-else class="text-sm" style="color: var(--color-muted)">
      Click a node — or focus the map and use arrow keys — to see its details.
    </p>
  </aside>
</template>
