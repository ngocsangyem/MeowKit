/**
 * OrchViz — Bezier Edge Renderer
 *
 * Draws tapered cubic-bezier beams between parent-child agent nodes.
 * Active edges pulse; color is taken from the child agent's tier.
 */

import { COLORS, tierColor, withAlpha } from '@/lib/colors';
import { BEAM } from '@/lib/canvas-constants';
import type { EdgeNode, AgentNode } from '@/lib/orch-types';

/** Evaluate a cubic bezier at parameter t (0–1). */
export function bezierPoint(
  x0: number, y0: number,
  cx1: number, cy1: number,
  cx2: number, cy2: number,
  x3: number, y3: number,
  t: number,
): { x: number; y: number } {
  const u = 1 - t;
  const x = u * u * u * x0 + 3 * u * u * t * cx1 + 3 * u * t * t * cx2 + t * t * t * x3;
  const y = u * u * u * y0 + 3 * u * u * t * cy1 + 3 * u * t * t * cy2 + t * t * t * y3;
  return { x, y };
}

/** Compute perpendicular control points for a curved beam. */
function controlPoints(
  x0: number, y0: number, x1: number, y1: number,
): { cx1: number; cy1: number; cx2: number; cy2: number } {
  const mx = (x0 + x1) / 2;
  const my = (y0 + y1) / 2;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  // Perpendicular offset
  const ox = (-dy / dist) * dist * BEAM.curvature;
  const oy = (dx / dist) * dist * BEAM.curvature;
  return { cx1: mx + ox, cy1: my + oy, cx2: mx + ox, cy2: my + oy };
}

/**
 * Draw all edges as tapered bezier beams.
 * @param time - elapsed seconds
 */
export function drawEdges(
  ctx: CanvasRenderingContext2D,
  edges: EdgeNode[],
  agents: Record<string, AgentNode>,
  time: number,
): void {
  for (const edge of edges) {
    if (edge.opacity < 0.05) continue;
    const src = agents[edge.source];
    const tgt = agents[edge.target];
    if (!src || !tgt) continue;

    const color = tierColor(tgt.tier);
    const pulse = edge.active ? Math.sin(time * BEAM.pulseSpeed) * 0.1 + 0.9 : 0.4;
    const alpha = edge.opacity * pulse;

    const { cx1, cy1, cx2, cy2 } = controlPoints(src.x, src.y, tgt.x, tgt.y);

    ctx.save();

    // Draw glow overlay for active edges
    if (edge.active) {
      ctx.beginPath();
      ctx.moveTo(src.x, src.y);
      ctx.bezierCurveTo(cx1, cy1, cx2, cy2, tgt.x, tgt.y);
      ctx.strokeStyle = withAlpha(color, alpha * 0.25);
      ctx.lineWidth = BEAM.startWidth + BEAM.activeGlowAdd;
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    // Tapered beam: render BEAM.segments segments with interpolated width
    for (let i = 0; i < BEAM.segments; i++) {
      const t0 = i / BEAM.segments;
      const t1 = (i + 1) / BEAM.segments;
      const p0 = bezierPoint(src.x, src.y, cx1, cy1, cx2, cy2, tgt.x, tgt.y, t0);
      const p1 = bezierPoint(src.x, src.y, cx1, cy1, cx2, cy2, tgt.x, tgt.y, t1);
      const segW = BEAM.startWidth + (BEAM.endWidth - BEAM.startWidth) * ((t0 + t1) / 2);

      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.strokeStyle = withAlpha(color, alpha);
      ctx.lineWidth = segW;
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    ctx.restore();
  }
}
