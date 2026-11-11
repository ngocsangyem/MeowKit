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
    style="background: var(--mk-surface); border-color: var(--mk-line)"
    aria-live="polite"
  >
    <template v-if="node">
      <div class="flex items-center gap-3">
        <h2 class="text-lg font-semibold" style="color: var(--mk-ink)">
          {{ node.label }}
        </h2>
        <span
          class="rounded-full px-2.5 py-0.5 text-xs font-medium"
          :style="{ background: `${KIND_COLORS[node.kind]}22`, color: KIND_COLORS[node.kind] }"
        >
          {{ node.kind }}
        </span>
      </div>
      <p class="mt-3 text-sm leading-relaxed" style="color: var(--mk-muted)">
        {{ node.detail }}
      </p>
      <dl class="mt-4 space-y-2 text-sm">
        <div v-if="orbits">
          <dt class="inline" style="color: var(--mk-muted)">Orbits:</dt>
          <dd class="inline ml-1" style="color: var(--mk-muted)">
            {{ orbits }}<span v-if="node.edge"> ({{ node.edge }})</span>
          </dd>
        </div>
        <div v-if="shared.length">
          <dt class="inline" style="color: var(--mk-muted)">Shared with:</dt>
          <dd class="inline ml-1" style="color: var(--mk-muted)">{{ shared.join(', ') }}</dd>
        </div>
        <div v-if="!node.satelliteId">
          <dt class="inline" style="color: var(--mk-muted)">Role:</dt>
          <dd class="inline ml-1" style="color: var(--mk-muted)">workflow hub</dd>
        </div>
      </dl>
      <p class="mt-4 break-all text-xs" style="font-family: var(--mk-font-mono); color: var(--mk-muted)">
        {{ node.sourceRef }}
      </p>
    </template>
    <p v-else class="text-sm" style="color: var(--mk-muted)">
      Click a node — or focus the map and use arrow keys — to see its details.
    </p>
  </aside>
</template>
