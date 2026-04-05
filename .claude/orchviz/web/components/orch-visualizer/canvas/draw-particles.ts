/**
 * OrchViz — Particle / Data-Packet Renderer
 *
 * Draws comet-trailed data packets that travel along bezier edges.
 * Each particle wobbles perpendicular to the path and fades a trail behind it.
 */

import { withAlpha } from '@/lib/colors';
import { PARTICLE, BEAM } from '@/lib/canvas-constants';
import { bezierPoint } from './draw-edges';
import type { Particle, EdgeNode, AgentNode } from '@/lib/orch-types';

/** Evaluate the perpendicular unit vector at bezier parameter t. */
function bezierPerp(
  x0: number, y0: number,
  cx1: number, cy1: number,
  cx2: number, cy2: number,
  x3: number, y3: number,
  t: number,
): { px: number; py: number } {
  const dt = 0.01;
  const tc = Math.min(1, Math.max(0, t));
  const a = bezierPoint(x0, y0, cx1, cy1, cx2, cy2, x3, y3, Math.max(0, tc - dt));
  const b = bezierPoint(x0, y0, cx1, cy1, cx2, cy2, x3, y3, Math.min(1, tc + dt));
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  return { px: -dy / len, py: dx / len };
}

/**
 * Draw all data-packet particles along their respective edges.
 * @param time - elapsed seconds
 */
export function drawParticles(
  ctx: CanvasRenderingContext2D,
  particles: Particle[],
  edges: EdgeNode[],
  agents: Record<string, AgentNode>,
  time: number,
): void {
  for (const p of particles) {
    const edge = edges[p.edgeIdx];
    if (!edge) continue;
    const src = agents[edge.source];
    const tgt = agents[edge.target];
    if (!src || !tgt) continue;

    // Recompute control points (matching draw-edges curvature)
    const mx = (src.x + tgt.x) / 2;
    const my = (src.y + tgt.y) / 2;
    const dist = Math.hypot(tgt.x - src.x, tgt.y - src.y);
    const dx = tgt.x - src.x;
    const dy = tgt.y - src.y;
    const ox = (-dy / (dist || 1)) * dist * BEAM.curvature;
    const oy = (dx / (dist || 1)) * dist * BEAM.curvature;
    const cx1 = mx + ox, cy1 = my + oy, cx2 = mx + ox, cy2 = my + oy;

    const t = p.dir === 1 ? p.t : 1 - p.t;

    // Wobble perpendicular to path
    const wobbleAmt =
      Math.sin(t * PARTICLE.wobbleFreqSpatial + time * PARTICLE.wobbleFreqTime + p.phase) *
      PARTICLE.wobbleAmp *
      Math.sin(t * Math.PI); // taper at endpoints
    const { px, py } = bezierPerp(src.x, src.y, cx1, cy1, cx2, cy2, tgt.x, tgt.y, t);

    // Comet trail: segments fading backward
    ctx.save();
    for (let s = PARTICLE.trailSegments; s >= 0; s--) {
      const trailT = Math.max(0, t - s * 0.015 * p.dir);
      const pt = bezierPoint(src.x, src.y, cx1, cy1, cx2, cy2, tgt.x, tgt.y, trailT);
      const wobbleFade = Math.sin(trailT * PARTICLE.wobbleFreqSpatial + time * PARTICLE.wobbleFreqTime + p.phase) * PARTICLE.wobbleAmp * Math.sin(trailT * Math.PI);
      const wx = pt.x + px * wobbleFade;
      const wy = pt.y + py * wobbleFade;
      const trailAlpha = (PARTICLE.trailAlphaBase * (1 - s / PARTICLE.trailSegments)) * 0.7;
      const r = p.size * (1 - s / PARTICLE.trailSegments) * 0.7;
      ctx.beginPath();
      ctx.arc(wx, wy, Math.max(0.3, r), 0, Math.PI * 2);
      ctx.fillStyle = withAlpha(p.color, trailAlpha);
      ctx.fill();
    }

    // Position with wobble applied
    const pos = bezierPoint(src.x, src.y, cx1, cy1, cx2, cy2, tgt.x, tgt.y, t);
    const wx = pos.x + px * wobbleAmt;
    const wy = pos.y + py * wobbleAmt;

    // Glow halo
    const glow = ctx.createRadialGradient(wx, wy, 0, wx, wy, PARTICLE.glowRadius);
    glow.addColorStop(0, withAlpha(p.color, 0.35));
    glow.addColorStop(1, withAlpha(p.color, 0));
    ctx.beginPath();
    ctx.arc(wx, wy, PARTICLE.glowRadius, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();

    // Core dot
    ctx.beginPath();
    ctx.arc(wx, wy, p.size, 0, Math.PI * 2);
    ctx.fillStyle = withAlpha(p.color, 0.95);
    ctx.fill();

    // Bright highlight
    ctx.beginPath();
    ctx.arc(wx - p.size * 0.3, wy - p.size * 0.3, p.size * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fill();

    ctx.restore();
  }
}
