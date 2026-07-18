<script setup lang="ts">
import type { SatelliteMap } from '~/composables/use-galaxy-data'
import {
  buildLayout, drawScene, hitTest, instancePosition,
  type GalaxyInstance, type GalaxyLayout,
} from '~/components/galaxy/galaxy-draw-helpers'

const props = defineProps<{ map: SatelliteMap }>()
const emit = defineEmits<{ select: [node: GalaxyInstance] }>()

const container = ref<HTMLDivElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)
const tooltip = ref<{ x: number, y: number, label: string, sub: string } | null>(null)

const layout: GalaxyLayout = buildLayout(props.map)
const cam = { x: 0, y: 0, zoom: 0.62 }
let time = 0
let raf = 0
let reducedMotion = false
let hoverKey: string | null = null
let focusIndex = -1
let dragging = false
let dragMoved = false
let last = { x: 0, y: 0 }

function screenToWorld(sx: number, sy: number) {
  const el = canvas.value!
  const rect = el.getBoundingClientRect()
  return {
    x: (sx - rect.left - rect.width / 2) / cam.zoom - cam.x,
    y: (sy - rect.top - rect.height / 2) / cam.zoom - cam.y,
  }
}

function render() {
  const el = canvas.value
  const ctx = el?.getContext('2d')
  if (!el || !ctx) return
  const dpr = window.devicePixelRatio || 1
  const w = el.clientWidth
  const h = el.clientHeight
  if (el.width !== w * dpr || el.height !== h * dpr) {
    el.width = w * dpr
    el.height = h * dpr
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, w, h)
  ctx.translate(w / 2, h / 2)
  ctx.scale(cam.zoom, cam.zoom)
  ctx.translate(cam.x, cam.y)
  const focusKey = focusIndex >= 0 ? layout.instances[focusIndex]?.key ?? null : null
  drawScene(ctx, { layout, map: props.map, t: time, hoverKey, focusKey, pulse: !reducedMotion })
}

function loop(now: number) {
  time = now / 1000
  render()
  raf = requestAnimationFrame(loop)
}

function onPointerDown(e: PointerEvent) {
  dragging = true
  dragMoved = false
  last = { x: e.clientX, y: e.clientY }
  canvas.value?.setPointerCapture(e.pointerId)
}
function onPointerMove(e: PointerEvent) {
  if (dragging) {
    const dx = e.clientX - last.x
    const dy = e.clientY - last.y
    if (Math.abs(dx) + Math.abs(dy) > 2) dragMoved = true
    cam.x += dx / cam.zoom
    cam.y += dy / cam.zoom
    last = { x: e.clientX, y: e.clientY }
    if (reducedMotion) render()
    return
  }
  const world = screenToWorld(e.clientX, e.clientY)
  const hit = hitTest(layout, time, world.x, world.y)
  hoverKey = hit?.key ?? null
  canvas.value!.style.cursor = hit ? 'pointer' : dragging ? 'grabbing' : 'grab'
  if (hit) {
    const rect = container.value!.getBoundingClientRect()
    tooltip.value = { x: e.clientX - rect.left, y: e.clientY - rect.top, label: hit.label, sub: hit.sub }
  }
  else {
    tooltip.value = null
  }
  if (reducedMotion) render()
}
function onPointerUp(e: PointerEvent) {
  dragging = false
  if (dragMoved) return
  const world = screenToWorld(e.clientX, e.clientY)
  const hit = hitTest(layout, time, world.x, world.y)
  if (hit) {
    focusIndex = layout.instances.indexOf(hit)
    emit('select', hit)
  }
  if (reducedMotion) render()
}
function onWheel(e: WheelEvent) {
  e.preventDefault()
  const factor = Math.exp(-e.deltaY * 0.0015)
  cam.zoom = Math.min(3, Math.max(0.25, cam.zoom * factor))
  if (reducedMotion) render()
}
function onKeydown(e: KeyboardEvent) {
  const n = layout.instances.length
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
    focusIndex = (focusIndex + 1) % n
  }
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
    focusIndex = (focusIndex - 1 + n) % n
  }
  else if (e.key === 'Enter' && focusIndex >= 0) {
    emit('select', layout.instances[focusIndex]!)
  }
  else {
    return
  }
  e.preventDefault()
  // keep the focused node in view
  const inst = layout.instances[focusIndex]!
  const pos = instancePosition(inst, time)
  cam.x = -pos.x
  cam.y = -pos.y
  if (reducedMotion) render()
}

onMounted(() => {
  reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  // fit the whole belt (plus label margin) into the initial view
  const el = container.value!
  cam.zoom = Math.max(0.25, Math.min(el.clientWidth, el.clientHeight) / 2 / (layout.beltR + 70))
  const observer = new ResizeObserver(() => render())
  observer.observe(container.value!)
  onBeforeUnmount(() => observer.disconnect())
  if (reducedMotion) render()
  else raf = requestAnimationFrame(loop)
})
onBeforeUnmount(() => cancelAnimationFrame(raf))
</script>

<template>
  <div ref="container" class="relative h-full w-full overflow-hidden">
    <canvas
      ref="canvas"
      class="block h-full w-full touch-none"
      tabindex="0"
      role="application"
      :aria-label="`Satellite map of ${map.meta.name}: ${map.planets.length} workflow hubs. Use arrow keys to cycle nodes, Enter to open details.`"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @wheel="onWheel"
      @keydown="onKeydown"
    />
    <div
      v-if="tooltip"
      class="pointer-events-none absolute z-10 rounded-md border px-3 py-1.5 text-sm"
      :style="{
        left: `${tooltip.x + 14}px`,
        top: `${tooltip.y + 14}px`,
        background: 'var(--color-paper-2)',
        borderColor: 'var(--color-rule)',
        color: 'var(--color-ink)',
      }"
    >
      <span class="font-medium">{{ tooltip.label }}</span>
      <span class="ml-2" style="color: var(--color-muted)">{{ tooltip.sub }}</span>
    </div>
    <!-- Screen-reader mirror of the canvas content -->
    <ul class="sr-only">
      <li v-for="planet in map.planets" :key="planet.id">
        {{ planet.label }} ({{ planet.kind }}) — {{ planet.sub }}. Satellites:
        {{ planet.satellites.map(s => s.label).join(', ') }}
      </li>
      <li>{{ map.belt.count }} more nodes in the belt.</li>
    </ul>
  </div>
</template>
