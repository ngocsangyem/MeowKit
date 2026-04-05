/**
 * OrchViz — Hexagonal Agent Node Renderer
 *
 * Draws layered hexagonal agent nodes: glow, interior, scanline,
 * status ring, center icon, orbiting particles, label, and cost pill.
 */

import { COLORS, tierColor, withAlpha } from '@/lib/colors';
import { NODE, ANIM, COST } from '@/lib/canvas-constants';
import { getGlowSprite } from './glow-sprites';
import type { AgentNode } from '@/lib/orch-types';

/** Draw a regular hexagon path with apex at top. Does not stroke/fill. */
export function drawHexagon(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    const px = x + r * Math.cos(angle);
    const py = y + r * Math.sin(angle);
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

const TIER_ICONS: Record<string, string> = {
  orchestrator: '◆',
  executor: '▶',
  validator: '◇',
  support: '●',
};

function isDashed(status: AgentNode['status']): boolean {
  return status === 'waiting' || status === 'complete';
}

function breatheRadius(agent: AgentNode, time: number): number {
  const isThinking = agent.status === 'thinking' || agent.status === 'active';
  const speed = isThinking ? ANIM.breatheThinkSpeed : ANIM.breatheIdleSpeed;
  const amp = isThinking ? ANIM.breatheThinkAmp : ANIM.breatheIdleAmp;
  return agent.radius * agent.scale * (1 + Math.sin(time * speed + agent.breathePhase) * amp);
}

/** Draw all agent nodes onto the canvas. */
export function drawAgentNodes(
  ctx: CanvasRenderingContext2D,
  agents: AgentNode[],
  time: number,
  hoveredAgent: AgentNode | null,
): void {
  for (const agent of agents) {
    if (agent.opacity < 0.05) continue;
    ctx.save();
    ctx.globalAlpha = agent.opacity;
    ctx.translate(agent.x, agent.y);

    const r = breatheRadius(agent, time);
    const color = tierColor(agent.tier);

    // Layer 1: Glow sprite (drawn centered, larger than node)
    const glowR = r * 2.2;
    const sprite = getGlowSprite(color, Math.round(glowR));
    ctx.drawImage(sprite, -glowR, -glowR);

    // Layer 2: Interior fill (clip to hex)
    ctx.save();
    drawHexagon(ctx, 0, 0, r);
    ctx.clip();
    ctx.fillStyle = COLORS.nodeInterior;
    ctx.fill();

    // Layer 3: Scanline sweep clipped to hex
    const scanSpeed = agent.status === 'thinking' ? ANIM.scanlineThinkSpeed : ANIM.scanlineNormalSpeed;
    const scanY = ((agent.scanlineY + time * scanSpeed) % (r * 2.5)) - r * 1.25;
    const scanGrad = ctx.createLinearGradient(0, scanY - 6, 0, scanY + 6);
    scanGrad.addColorStop(0, withAlpha(color, 0));
    scanGrad.addColorStop(0.5, withAlpha(color, 0.12));
    scanGrad.addColorStop(1, withAlpha(color, 0));
    ctx.fillStyle = scanGrad;
    ctx.fillRect(-r, scanY - 6, r * 2, 12);
    ctx.restore();

    // Layer 4: Status ring
    ctx.save();
    drawHexagon(ctx, 0, 0, r);
    if (isDashed(agent.status)) ctx.setLineDash([4, 4]);
    const ringAlpha = agent.status === 'active' ? 0.9 : 0.55;
    const ringGlow = agent.status === 'active' || agent.status === 'thinking';
    if (ringGlow) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
    }
    ctx.strokeStyle = withAlpha(color, ringAlpha);
    ctx.lineWidth = agent.status === 'error' ? 2.5 : 1.5;
    if (agent.status === 'error') ctx.strokeStyle = withAlpha(COLORS.error, 0.9);
    ctx.stroke();
    ctx.restore();

    // Layer 5: Center icon
    const icon = TIER_ICONS[agent.tier] ?? '●';
    ctx.font = `${r * 0.45}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = withAlpha(color, 0.9);
    ctx.fillText(icon, 0, 0);

    // Layer 6: Orbiting particles if active
    if (agent.status === 'active' || agent.status === 'thinking') {
      const orbitR = r + ANIM.orbitRadius;
      for (let i = 0; i < ANIM.orbitCount; i++) {
        const angle = time * ANIM.orbitSpeed + (i / ANIM.orbitCount) * Math.PI * 2;
        const ox = Math.cos(angle) * orbitR;
        const oy = Math.sin(angle) * orbitR;
        ctx.beginPath();
        ctx.arc(ox, oy, ANIM.orbitDotSize, 0, Math.PI * 2);
        ctx.fillStyle = withAlpha(color, 0.65);
        ctx.fill();
      }
    }

    // Layer 7: Label below
    ctx.font = `bold ${r * 0.32}px monospace`;
    ctx.fillStyle = COLORS.text;
    ctx.fillText(agent.name, 0, r + 10);
    ctx.font = `${r * 0.26}px monospace`;
    ctx.fillStyle = withAlpha(color, 0.7);
    ctx.fillText(agent.tier, 0, r + 20);

    // Layer 8: Hover ring
    if (hoveredAgent?.name === agent.name) {
      drawHexagon(ctx, 0, 0, r + 3);
      ctx.strokeStyle = withAlpha(color, 0.4);
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.restore();
  }
}
