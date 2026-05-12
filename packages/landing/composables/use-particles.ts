interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  opacity: number
  targetOpacity: number
  size: number
  charIdx: number
  colorIdx: number
  respawnTimer: number
}

const CODE_CHARS = [
  '{', '}', '[', ']', '()', '=>', '</', '/>',
  '&&', '||', '!==', '===', '...', '??',
  '#', '@', '$', '`', '//', '**', '::', '~',
  '!=', '+=', '->', ':=', '<%', '%>',
]

// Weighted palette: cyan dominant (brand), purple accent, white sparkle
const PALETTE: [number, number, number][] = [
  [102, 204, 255], // magic-glow cyan
  [102, 204, 255],
  [102, 204, 255],
  [168, 85, 247],  // arcane purple
  [168, 85, 247],
  [248, 250, 252], // pure white sparkle
  [59, 130, 246],  // bright blue
]

const ATTRACT_RADIUS = 180
const ATTRACT_STRENGTH = 0.0022

export function useParticles(canvas: Ref<HTMLCanvasElement | null>) {
  let animId = 0
  const particles: Particle[] = []
  // Raw mouse coords — updated via mousemove on window (no VueUse dependency)
  let mouseX = -9999
  let mouseY = -9999

  function onMouseMove(e: MouseEvent) {
    mouseX = e.clientX
    mouseY = e.clientY
  }

  function spawn(w: number, h: number): Particle {
    return {
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.18,
      vy: (Math.random() - 0.5) * 0.14,
      opacity: 0,
      targetOpacity: Math.random() * 0.22 + 0.04,
      size: Math.random() * 5 + 10,
      charIdx: Math.floor(Math.random() * CODE_CHARS.length),
      colorIdx: Math.floor(Math.random() * PALETTE.length),
      respawnTimer: Math.floor(Math.random() * 500 + 250),
    }
  }

  function init(w: number, h: number) {
    const count = Math.floor((w * h) / 28000)
    particles.length = 0
    for (let i = 0; i < count; i++) {
      const p = spawn(w, h)
      p.opacity = Math.random() * p.targetOpacity // stagger initial opacity
      particles.push(p)
    }
  }

  function draw() {
    const el = canvas.value
    if (!el) return
    const ctx = el.getContext('2d')
    if (!ctx) return

    const { width: w, height: h } = el
    ctx.clearRect(0, 0, w, h)

    const mx = mouseX
    const my = mouseY

    for (const p of particles) {
      // Mouse attraction — particles gently drift toward cursor
      const dx = mx - p.x
      const dy = my - p.y
      const distSq = dx * dx + dy * dy

      if (distSq < ATTRACT_RADIUS * ATTRACT_RADIUS && distSq > 4) {
        const dist = Math.sqrt(distSq)
        const force = (1 - dist / ATTRACT_RADIUS) * ATTRACT_STRENGTH
        p.vx += (dx / dist) * force
        p.vy += (dy / dist) * force
      }

      // Velocity damping
      p.vx *= 0.975
      p.vy *= 0.975

      p.x += p.vx
      p.y += p.vy

      // Wrap edges
      if (p.x < -20) p.x = w + 10
      else if (p.x > w + 20) p.x = -10
      if (p.y < -20) p.y = h + 10
      else if (p.y > h + 20) p.y = -10

      // Lifecycle: fade in → hold → fade out → respawn
      p.respawnTimer--
      if (p.respawnTimer <= 60) {
        p.opacity = Math.max(0, p.opacity - 0.004)
        if (p.respawnTimer <= 0) {
          Object.assign(p, spawn(w, h))
        }
      }
      else if (p.opacity < p.targetOpacity) {
        p.opacity = Math.min(p.targetOpacity, p.opacity + 0.004)
      }

      if (p.opacity < 0.005) continue

      const [r, g, b] = PALETTE[p.colorIdx]!
      ctx.globalAlpha = p.opacity
      ctx.font = `${p.size}px "Fira Code", monospace`
      ctx.fillStyle = `rgb(${r},${g},${b})`
      ctx.fillText(CODE_CHARS[p.charIdx]!, p.x, p.y)
    }

    ctx.globalAlpha = 1
    animId = requestAnimationFrame(draw)
  }

  function resize() {
    const el = canvas.value
    if (!el) return
    el.width = window.innerWidth
    el.height = window.innerHeight
    init(el.width, el.height)
  }

  function start() {
    resize()
    draw()
    window.addEventListener('mousemove', onMouseMove, { passive: true })
  }

  function stop() {
    cancelAnimationFrame(animId)
    window.removeEventListener('mousemove', onMouseMove)
  }

  return { start, stop, resize }
}
