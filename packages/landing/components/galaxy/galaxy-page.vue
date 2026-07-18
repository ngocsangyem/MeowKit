<script setup lang="ts">
import { KIND_COLORS } from '~/components/galaxy/galaxy-draw-helpers'
import type { GalaxyInstance } from '~/components/galaxy/galaxy-draw-helpers'
import type { GalaxyNodeKind } from '~/composables/use-galaxy-data'

// Shared body for the /galaxy and /demo routes — both page files render this component.
useSeoMeta({
  title: 'Galaxy — MeowKit',
  description: 'An animated satellite map of how MeowKit skills, agents, commands, and hooks orbit each other.',
})

const { map, status, error } = useGalaxyData()
const selected = ref<GalaxyInstance | null>(null)

const statRows = computed(() => {
  if (!map.value) return []
  const s = map.value.stats
  return [
    { label: 'skills', value: s.skills },
    { label: 'agents', value: s.agents },
    { label: 'commands', value: s.commands },
    { label: 'hooks', value: s.hooks },
    { label: 'edges', value: s.edges },
  ]
})

const legend: { kind: GalaxyNodeKind, label: string }[] = [
  { kind: 'skill', label: 'skill' },
  { kind: 'agent', label: 'agent' },
  { kind: 'command', label: 'command' },
  { kind: 'hook', label: 'hook' },
]

const planetLabels = computed(() =>
  Object.fromEntries((map.value?.planets ?? []).map(p => [p.id, p.label])),
)
</script>

<template>
  <div class="container-landing py-12">
    <header>
      <h1 class="font-semibold" style="font-size: var(--text-2xl); color: var(--color-ink)">
        The MeowKit galaxy
      </h1>
      <p v-if="map" class="mt-2" style="color: var(--color-ink-2)">
        {{ map.meta.tagline }}.
        <span style="color: var(--color-muted)">Snapshot {{ map.meta.date }}.</span>
      </p>
    </header>

    <div v-if="map" class="mt-5 flex flex-wrap items-center gap-x-8 gap-y-3">
      <div v-for="stat in statRows" :key="stat.label" class="flex items-baseline gap-2">
        <span class="text-xl font-semibold" style="color: var(--color-ink)">{{ stat.value }}</span>
        <span class="text-sm" style="color: var(--color-muted)">{{ stat.label }}</span>
      </div>
      <ul class="ml-auto flex items-center gap-5" aria-label="Legend">
        <li v-for="item in legend" :key="item.kind" class="flex items-center gap-2 text-sm" style="color: var(--color-ink-2)">
          <span class="inline-block h-2.5 w-2.5 rounded-full" :style="{ background: KIND_COLORS[item.kind] }" aria-hidden="true" />
          {{ item.label }}
        </li>
      </ul>
    </div>

    <div class="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div
        class="h-[70vh] min-h-[26rem] rounded-lg border"
        style="background: var(--color-paper); border-color: var(--color-rule)"
      >
        <GalaxyCanvas v-if="map" :map="map" @select="selected = $event" />
        <div v-else class="flex h-full items-center justify-center text-sm" style="color: var(--color-muted)">
          <span v-if="error">Could not load the satellite map.</span>
          <span v-else>Loading the galaxy…</span>
        </div>
      </div>
      <GalaxyDetailPanel :node="selected" :planet-labels="planetLabels" />
    </div>

    <p class="mt-4 text-sm" style="color: var(--color-muted)">
      Planets are the workflow hubs — the skills with the most outbound references. Satellites are the
      skills and agents they call. Drag to pan, scroll to zoom.
    </p>
  </div>
</template>
