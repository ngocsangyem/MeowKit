/**
 * OrchViz — Cost Pill Renderer
 *
 * Draws a rounded pill above each agent displaying accumulated cost.
 * Only shown when cost exceeds COST.minDisplayCost threshold.
 */

import { COLORS, withAlpha } from '@/lib/colors';
import { COST } from '@/lib/canvas-constants';
import type { AgentNode } from '@/lib/orch-types';

function formatCost(cost: number): string {
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  if (cost < 0.1) return `$${cost.toFixed(3)}`;
  return `$${cost.toFixed(2)}`;
}

/**
 * Draw cost pills above all agents whose cost exceeds the display threshold.
 */
export function drawCostLabels(
  ctx: CanvasRenderingContext2D,
  agents: AgentNode[],
): void {
  for (const agent of agents) {
    if (agent.opacity < 0.05) continue;
    if (agent.cost < COST.minDisplayCost) continue;

    ctx.save();
    ctx.globalAlpha = agent.opacity;

    const label = formatCost(agent.cost);
    ctx.font = '7px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const textW = ctx.measureText(label).width;
    const pillW = textW + COST.pillPadding;
    const pillH = COST.pillHeight;
    const px = agent.x - pillW / 2;
    const py = agent.y - agent.radius * agent.scale - COST.pillYOffset - pillH / 2;

    // Pill background
    ctx.beginPath();
    ctx.roundRect(px, py, pillW, pillH, pillH / 2);
    ctx.fillStyle = COLORS.costPill;
    ctx.fill();
    ctx.strokeStyle = withAlpha(COLORS.costText, 0.3);
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // Cost text
    ctx.fillStyle = COLORS.costText;
    ctx.fillText(label, agent.x, py + pillH / 2);

    ctx.restore();
  }
}
