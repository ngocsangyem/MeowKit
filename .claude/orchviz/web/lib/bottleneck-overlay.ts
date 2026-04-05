/**
 * OrchViz — Bottleneck Overlay Canvas Draw
 * Pure function — no React, no state. Called inside camera transform.
 */

import type { AgentNode } from '@/lib/orch-types';
import type { BottleneckMarker } from '@/hooks/use-bottleneck-detection';
import { COLORS, withAlpha } from '@/lib/colors';

const RING_RADIUS_EXTRA = 14; // px beyond node radius
const WARNING_COLOR = COLORS.amber;
const ERROR_COLOR   = COLORS.error;

export function drawBottleneckMarkers(
  ctx: CanvasRenderingContext2D,
  markers: BottleneckMarker[],
  agents: Record<string, AgentNode>,
): void {
  if (markers.length === 0) return;

  const warningCount = markers.filter(m => m.severity === 'warning').length;
  const errorCount   = markers.filter(m => m.severity === 'error').length;

  for (const marker of markers) {
    const agent = agents[marker.agentName];
    if (!agent || agent.opacity < 0.1) continue;

    const color = marker.severity === 'error' ? ERROR_COLOR : WARNING_COLOR;
    const r = agent.radius + RING_RADIUS_EXTRA;

    // Semi-transparent ring around agent
    ctx.beginPath();
    ctx.arc(agent.x, agent.y, r, 0, Math.PI * 2);
    ctx.strokeStyle = withAlpha(color, 0.55);
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Filled glow disc
    ctx.beginPath();
    ctx.arc(agent.x, agent.y, r, 0, Math.PI * 2);
    ctx.fillStyle = withAlpha(color, 0.07);
    ctx.fill();

    // Warning icon above node
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = withAlpha(color, 0.9);
    ctx.fillText('⚠', agent.x, agent.y - r - 8);
  }

  // Summary count in bottom-left of canvas (screen-space — call OUTSIDE camera transform
  // but we draw here with a note: caller must pass canvas dims or use fixed coords)
  const total = warningCount + errorCount;
  if (total === 0) return;

  // Reset transform is caller's responsibility — draw relative to world origin
  // This summary line is intentionally world-origin placed; root component overlays it in CSS
  ctx.save();
  ctx.font = 'bold 9px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const label = `⚠ ${errorCount > 0 ? `${errorCount} ERR` : ''} ${warningCount > 0 ? `${warningCount} WARN` : ''}`.trim();
  ctx.fillStyle = withAlpha(errorCount > 0 ? ERROR_COLOR : WARNING_COLOR, 0.8);
  ctx.fillText(label, -9999, -9999); // suppressed in world-space — see root for HUD badge
  ctx.restore();
}
