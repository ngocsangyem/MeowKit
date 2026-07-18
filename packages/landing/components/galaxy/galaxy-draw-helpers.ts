/**
 * Pure layout + drawing helpers for the galaxy canvas.
 * All positions are deterministic — angles seed from indices, never Math.random.
 */
import type { SatelliteMap, GalaxyNodeKind } from '~/composables/use-galaxy-data'

// Single source of truth for kind accents; the page legend reads the same map.
export const KIND_COLORS: Record<GalaxyNodeKind, string> = {
  skill: '#6ea8ff',
  agent: '#e0a63f',
  command: '#46c78f',
  hook: '#c084f5',
}
export const INK = '#e8ecf5'
export const MUTED = '#8b94a8'

const GOLDEN = 2.399963229728653

export interface GalaxyInstance {
  key: string
  planetId: string
  satelliteId?: string
  kind: GalaxyNodeKind
  label: string
  sub: string
  detail: string
  sourceRef: string
  edge?: string
  sharedWith?: string[]
  // planet: fixed position. satellite: orbit parameters around its planet.
  px: number
  py: number
  orbitR: number
  baseAngle: number
  speed: number
  radius: number
}

export interface GalaxyLayout {
  instances: GalaxyInstance[]
  planetPos: Map<string, { x: number, y: number }>
  ringR: number
  beltR: number
  stars: { x: number, y: number, r: number, a: number }[]
}

// mulberry32 — deterministic starfield, same sky on every load
function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function buildLayout(map: SatelliteMap): GalaxyLayout {
  const n = map.planets.length
  const ringR = 320
  const instances: GalaxyInstance[] = []
  const planetPos = new Map<string, { x: number, y: number }>()

  map.planets.forEach((planet, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n
    const px = ringR * Math.cos(angle)
    const py = ringR * Math.sin(angle)
    planetPos.set(planet.id, { x: px, y: py })
    instances.push({
      key: planet.id, planetId: planet.id, kind: planet.kind,
      label: planet.label, sub: planet.sub, detail: planet.detail,
      sourceRef: planet.sourceRef,
      px, py, orbitR: 0, baseAngle: 0, speed: 0,
      radius: 15 + Math.min(6, planet.satellites.length),
    })
    planet.satellites.forEach((sat, j) => {
      const orbitR = 44 + j * 14
      instances.push({
        key: `${planet.id}/${sat.id}`, planetId: planet.id, satelliteId: sat.id,
        kind: sat.kind, label: sat.label, sub: sat.kind, detail: sat.detail,
        sourceRef: sat.sourceRef, edge: sat.edge, sharedWith: sat.sharedWith,
        px, py, orbitR,
        baseAngle: (i * 5 + j) * GOLDEN,
        speed: 14 / orbitR, // inner satellites orbit faster
        radius: 5,
      })
    })
  })

  const rand = mulberry32(42)
  const beltR = ringR + 220
  const stars = Array.from({ length: 260 }, () => ({
    x: (rand() - 0.5) * beltR * 3.2,
    y: (rand() - 0.5) * beltR * 3.2,
    r: 0.5 + rand() * 1.1,
    a: 0.12 + rand() * 0.5,
  }))
  return { instances, planetPos, ringR, beltR, stars }
}

export function instancePosition(inst: GalaxyInstance, t: number) {
  if (!inst.satelliteId) return { x: inst.px, y: inst.py }
  const a = inst.baseAngle + t * inst.speed
  return { x: inst.px + inst.orbitR * Math.cos(a), y: inst.py + inst.orbitR * Math.sin(a) }
}

export interface DrawState {
  layout: GalaxyLayout
  map: SatelliteMap
  t: number
  hoverKey: string | null
  focusKey: string | null
  pulse: boolean
}

export function drawScene(ctx: CanvasRenderingContext2D, s: DrawState) {
  const { layout, map, t } = s
  // starfield
  ctx.fillStyle = INK
  for (const star of layout.stars) {
    ctx.globalAlpha = star.a
    ctx.beginPath()
    ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1

  // belt — faint dotted ring with count label
  ctx.strokeStyle = MUTED
  ctx.globalAlpha = 0.35
  ctx.lineWidth = 1.4
  ctx.setLineDash([2, 9])
  ctx.beginPath()
  ctx.arc(0, 0, layout.beltR, 0, Math.PI * 2)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.globalAlpha = 0.8
  ctx.fillStyle = MUTED
  ctx.font = '13px "Geist Mono", monospace'
  ctx.textAlign = 'center'
  ctx.fillText(`+${map.belt.count} more in the belt`, 0, -layout.beltR - 14)
  ctx.globalAlpha = 1

  // cross links between planets
  ctx.strokeStyle = MUTED
  ctx.globalAlpha = 0.22
  ctx.lineWidth = 1
  for (const link of map.crossLinks) {
    const a = layout.planetPos.get(link.from)
    const b = layout.planetPos.get(link.to)
    if (!a || !b) continue
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
  }
  ctx.globalAlpha = 1

  // orbit rings + shared-satellite hover links
  for (const inst of layout.instances) {
    if (!inst.satelliteId) continue
    ctx.strokeStyle = MUTED
    ctx.globalAlpha = 0.14
    ctx.beginPath()
    ctx.arc(inst.px, inst.py, inst.orbitR, 0, Math.PI * 2)
    ctx.stroke()
    ctx.globalAlpha = 1
  }
  const active = layout.instances.find((i) => i.key === s.hoverKey || i.key === s.focusKey)
  if (active?.sharedWith?.length) {
    const pos = instancePosition(active, t)
    ctx.strokeStyle = KIND_COLORS[active.kind]
    ctx.globalAlpha = 0.4
    ctx.setLineDash([3, 5])
    for (const other of active.sharedWith) {
      const op = layout.planetPos.get(other)
      if (!op) continue
      ctx.beginPath()
      ctx.moveTo(pos.x, pos.y)
      ctx.lineTo(op.x, op.y)
      ctx.stroke()
    }
    ctx.setLineDash([])
    ctx.globalAlpha = 1
  }

  // nodes
  for (const inst of layout.instances) {
    const pos = instancePosition(inst, t)
    const isPlanet = !inst.satelliteId
    const pulse = isPlanet && s.pulse ? 1 + 0.04 * Math.sin(t * 1.4 + inst.px) : 1
    const r = inst.radius * pulse
    const highlighted = inst.key === s.hoverKey || inst.key === s.focusKey
    ctx.beginPath()
    ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2)
    ctx.fillStyle = KIND_COLORS[inst.kind]
    ctx.globalAlpha = isPlanet ? 0.92 : 0.85
    ctx.fill()
    ctx.globalAlpha = 1
    if (highlighted) {
      ctx.strokeStyle = INK
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(pos.x, pos.y, r + 4, 0, Math.PI * 2)
      ctx.stroke()
    }
    if (isPlanet) {
      ctx.fillStyle = INK
      ctx.font = '600 14px Geist, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(inst.label, pos.x, pos.y + r + 20)
    }
  }
}

/** Hit-test in world space; planets win ties via larger radius. */
export function hitTest(layout: GalaxyLayout, t: number, wx: number, wy: number) {
  let best: GalaxyInstance | null = null
  let bestDist = Infinity
  for (const inst of layout.instances) {
    const pos = instancePosition(inst, t)
    const d = Math.hypot(pos.x - wx, pos.y - wy)
    if (d <= inst.radius + 6 && d - inst.radius < bestDist) {
      bestDist = d - inst.radius
      best = inst
    }
  }
  return best
}
