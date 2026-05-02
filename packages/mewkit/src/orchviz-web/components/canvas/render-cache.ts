// ─── Glow sprite cache ─────────────────────────────────────────────────────
// Pre-renders radial gradient glows to off-screen canvases.
// Avoids creating CanvasGradient objects every frame.

const glowSpriteCache = new Map<string, HTMLCanvasElement>()

/** Simple radial glow: gradient from center (innerAlpha) to edge (outerAlpha) */
export function getGlowSprite(
  color: string, radius: number, innerAlpha: string, outerAlpha: string,
): HTMLCanvasElement {
  const rQ = Math.ceil(radius)
  const key = `${color}|${rQ}|${innerAlpha}|${outerAlpha}`
  let sprite = glowSpriteCache.get(key)
  if (sprite) return sprite

  const size = rQ * 2
  sprite = document.createElement('canvas')
  sprite.width = size
  sprite.height = size
  const ctx = sprite.getContext('2d')!
  const glow = ctx.createRadialGradient(rQ, rQ, 0, rQ, rQ, rQ)
  glow.addColorStop(0, color + innerAlpha)
  glow.addColorStop(1, color + outerAlpha)
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, size, size)

  glowSpriteCache.set(key, sprite)
  return sprite
}

/** Agent glow: gradient from innerRadius to outerRadius */
export function getAgentGlowSprite(
  color: string, innerRadius: number, outerRadius: number, glowAlphaHex: string,
): HTMLCanvasElement {
  const iR = Math.round(innerRadius)
  const oR = Math.ceil(outerRadius)
  const key = `ag|${color}|${iR}|${oR}|${glowAlphaHex}`
  let sprite = glowSpriteCache.get(key)
  if (sprite) return sprite

  const size = oR * 2
  sprite = document.createElement('canvas')
  sprite.width = size
  sprite.height = size
  const ctx = sprite.getContext('2d')!
  const glow = ctx.createRadialGradient(oR, oR, iR, oR, oR, oR)
  glow.addColorStop(0, color + glowAlphaHex)
  glow.addColorStop(1, color + '00')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, size, size)

  glowSpriteCache.set(key, sprite)
  return sprite
}

// ─── Pause icon Path2D cache ───────────────────────────────────────────────
// pause-icons.ts manages its own internal Path2D cache keyed by icon-name + size-bucket.
// That cache is module-private and populated on first call (lazy, zero allocation in hot path).
// No additional caching layer is needed here — all pause icon builders produce
// per-frame-safe output via cached Path2D objects.
// (phase-03 note: render-cache.ts is the canonical cache registry; this comment
//  documents that pause-icons.ts is self-contained and compliant.)

// ─── Text measurement cache ────────────────────────────────────────────────
// Caches ctx.measureText().width to avoid redundant browser layout per frame.

const textWidthCache = new Map<string, number>()
const TEXT_CACHE_MAX = 2000

export function measureTextCached(ctx: CanvasRenderingContext2D, text: string): number {
  const key = ctx.font + '|' + text
  let w = textWidthCache.get(key)
  if (w !== undefined) return w
  w = ctx.measureText(text).width
  if (textWidthCache.size > TEXT_CACHE_MAX) textWidthCache.clear()
  textWidthCache.set(key, w)
  return w
}
