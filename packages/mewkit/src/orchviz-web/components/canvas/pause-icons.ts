/**
 * Pause-state icon builders for the canvas renderer.
 *
 * All icons are deterministic Path2D-based; they accept the same
 * (ctx, x, y, r, color) signature so the per-reason switch in
 * draw-agents.ts can call them uniformly.
 *
 * [red-team #2]  drawLockIcon extracted from draw-agents.ts:240-256 — byte-identical output.
 * [red-team #20] New icons live here, NOT in draw-agents.ts or draw-misc.ts
 *                (both already over the 200-LOC project limit).
 */

import { getCachedPath2D } from '@/lib/canvas-path-cache'

// ─── Icon: Lock (permission_request) ─────────────────────────────────────────
// Extracted verbatim from draw-agents.ts:240-256.  Output MUST remain identical.

export function drawLockIcon(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, r: number, color: string,
): void {
  const s = r * 0.3
  ctx.save()
  ctx.strokeStyle = color + '90'
  ctx.fillStyle  = color + '90'
  ctx.lineWidth  = 1.5
  // Lock body (rounded rect)
  ctx.beginPath()
  ctx.roundRect(x - s * 0.6, y - s * 0.1, s * 1.2, s * 1.0, 2)
  ctx.fill()
  // Lock shackle (arc)
  ctx.beginPath()
  ctx.arc(x, y - s * 0.15, s * 0.4, Math.PI, 0)
  ctx.stroke()
  ctx.restore()
}

// ─── Icon: Question bubble (ask_user_question) ────────────────────────────────

export function drawQuestionBubbleIcon(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, r: number, color: string,
): void {
  const s = r * 0.32
  ctx.save()
  ctx.strokeStyle = color + '90'
  ctx.fillStyle   = color + '18'
  ctx.lineWidth   = 1.5
  // Speech bubble body
  const bx = x - s, by = y - s * 0.9
  const bw = s * 2,  bh = s * 1.6
  const br = s * 0.35
  const key = `qbub|${Math.round(s * 10)}`
  const path = getCachedPath2D(key, () => {
    const p = new Path2D()
    p.roundRect(0, 0, bw, bh, br)
    return p
  })
  ctx.save()
  ctx.translate(bx, by)
  ctx.fill(path)
  ctx.stroke(path)
  ctx.restore()
  // Tail
  ctx.beginPath()
  ctx.moveTo(x - s * 0.3, y + s * 0.7)
  ctx.lineTo(x - s * 0.55, y + s * 1.1)
  ctx.lineTo(x + s * 0.05, y + s * 0.7)
  ctx.stroke()
  // Question mark
  ctx.fillStyle  = color + '90'
  ctx.font       = `bold ${s * 1.1}px monospace`
  ctx.textAlign  = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('?', x, y + s * 0.05)
  ctx.restore()
}

// ─── Icon: Document with check (plan_mode_review) ────────────────────────────

export function drawDocumentCheckIcon(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, r: number, color: string,
): void {
  const s = r * 0.3
  ctx.save()
  ctx.strokeStyle = color + '90'
  ctx.fillStyle   = color + '18'
  ctx.lineWidth   = 1.5
  // Document outline
  ctx.beginPath()
  ctx.roundRect(x - s * 0.65, y - s * 0.9, s * 1.3, s * 1.8, 2)
  ctx.fill()
  ctx.stroke()
  // Checkmark
  ctx.strokeStyle = color + '90'
  ctx.lineWidth   = 1.8
  ctx.beginPath()
  ctx.moveTo(x - s * 0.3, y + s * 0.1)
  ctx.lineTo(x - s * 0.05, y + s * 0.4)
  ctx.lineTo(x + s * 0.35, y - s * 0.2)
  ctx.stroke()
  ctx.restore()
}

// ─── Icon: Forbidden / crossed circle (tool_rejected) ────────────────────────

export function drawForbiddenIcon(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, r: number, color: string,
): void {
  const s = r * 0.32
  ctx.save()
  ctx.strokeStyle = color + '90'
  ctx.lineWidth   = 1.8
  ctx.beginPath()
  ctx.arc(x, y, s, 0, Math.PI * 2)
  ctx.stroke()
  // Diagonal slash
  const angle = Math.PI / 4
  ctx.beginPath()
  ctx.moveTo(x - Math.cos(angle) * s, y - Math.sin(angle) * s)
  ctx.lineTo(x + Math.cos(angle) * s, y + Math.sin(angle) * s)
  ctx.stroke()
  ctx.restore()
}

// ─── Icon: Shield with bar (hook_blocked) ────────────────────────────────────

export function drawShieldBarIcon(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, r: number, color: string,
): void {
  const s = r * 0.3
  ctx.save()
  ctx.strokeStyle = color + '90'
  ctx.fillStyle   = color + '18'
  ctx.lineWidth   = 1.5
  // Shield shape via Path2D
  const key = `shield|${Math.round(s * 10)}`
  const path = getCachedPath2D(key, () => {
    const p = new Path2D()
    const hw = s * 0.8
    p.moveTo(0, -s)
    p.lineTo(hw, -s * 0.6)
    p.lineTo(hw, s * 0.2)
    p.bezierCurveTo(hw, s * 0.8, 0, s * 1.1, 0, s * 1.1)
    p.bezierCurveTo(-hw, s * 0.8, -hw, s * 0.2, -hw, s * 0.2)
    p.lineTo(-hw, -s * 0.6)
    p.closePath()
    return p
  })
  ctx.save()
  ctx.translate(x, y - s * 0.1)
  ctx.fill(path)
  ctx.stroke(path)
  // Horizontal bar inside shield
  ctx.strokeStyle = color + '90'
  ctx.lineWidth   = 2
  ctx.beginPath()
  ctx.moveTo(-s * 0.45, s * 0.15)
  ctx.lineTo( s * 0.45, s * 0.15)
  ctx.stroke()
  ctx.restore()
  ctx.restore()
}

// ─── Corner badge ────────────────────────────────────────────────────────────
// Top-right of node; auto-hides if r < 14.
// Used for: ask_user_question (option count), hook_blocked ("!")

export function drawCornerBadge(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, r: number,
  label: string, color: string,
): void {
  if (r < 14) return
  const br    = r * 0.22          // badge circle radius
  const bx    = x + r * 0.72     // top-right quadrant
  const by    = y - r * 0.72
  ctx.save()
  ctx.fillStyle   = color
  ctx.strokeStyle = '#050510'     // void bg — sharp contrast outline
  ctx.lineWidth   = 1.5
  ctx.beginPath()
  ctx.arc(bx, by, br, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle    = '#050510'
  ctx.font         = `bold ${Math.max(7, br * 1.1)}px monospace`
  ctx.textAlign    = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, bx, by)
  ctx.restore()
}
