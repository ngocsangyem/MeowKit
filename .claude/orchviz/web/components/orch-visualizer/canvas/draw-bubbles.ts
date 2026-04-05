/**
 * OrchViz — Message Bubble Renderer
 *
 * Draws role-colored speech bubbles stacked to the right of each agent.
 * Bubbles fade in, hold, then fade out per BUBBLE constants.
 */

import { COLORS, withAlpha } from '@/lib/colors';
import { BUBBLE } from '@/lib/canvas-constants';
import type { AgentNode, MessageBubble } from '@/lib/orch-types';

const ROLE_COLORS: Record<MessageBubble['role'], string> = {
  user: COLORS.bubbleUser,
  assistant: COLORS.bubbleAssistant,
  thinking: COLORS.bubbleThinking,
  subagent_report: COLORS.bubbleReport,
};

const ROLE_LABELS: Record<MessageBubble['role'], string> = {
  user: 'USER',
  assistant: 'ASST',
  thinking: 'THINK',
  subagent_report: 'RPT',
};

function bubbleAlpha(age: number): number {
  if (age < BUBBLE.fadeIn) return age / BUBBLE.fadeIn;
  const holdEnd = BUBBLE.fadeIn + BUBBLE.hold;
  if (age < holdEnd) return 1;
  const fadeEnd = holdEnd + BUBBLE.fadeOut;
  if (age < fadeEnd) return 1 - (age - holdEnd) / BUBBLE.fadeOut;
  return 0;
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxW: number,
  bubble: MessageBubble,
): string[] {
  if (bubble._cachedLines && bubble._cachedW === maxW) return bubble._cachedLines;
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = word;
      if (lines.length >= BUBBLE.maxLines) break;
    } else {
      line = test;
    }
  }
  if (line && lines.length < BUBBLE.maxLines) lines.push(line);
  bubble._cachedLines = lines;
  bubble._cachedW = maxW;
  return lines;
}

/** Draw all message bubbles for all agents. */
export function drawBubbles(
  ctx: CanvasRenderingContext2D,
  agents: AgentNode[],
  time: number,
): void {
  for (const agent of agents) {
    if (!agent.messageBubbles.length || agent.opacity < 0.05) continue;

    const isThinking = agent.status === 'thinking';
    const style = isThinking ? BUBBLE.thinking : BUBBLE.normal;
    const anchorX = agent.x + agent.radius + BUBBLE.anchorOffset;
    let stackY = agent.y - agent.radius;
    let firstVisible = true;

    ctx.save();
    ctx.globalAlpha = agent.opacity;

    for (const bubble of agent.messageBubbles) {
      const age = time - bubble.time;
      const alpha = bubbleAlpha(age);
      if (alpha <= 0.01) continue;

      const color = ROLE_COLORS[bubble.role];
      ctx.font = `${style.fontSize}px monospace`;
      const maxW = BUBBLE.maxWidth - style.padding * 2;
      const lines = wrapText(ctx, bubble.text, maxW, bubble);
      const boxW = Math.min(BUBBLE.maxWidth, maxW + style.padding * 2);
      const boxH = style.headerH + lines.length * style.lineH + style.padding;

      ctx.save();
      ctx.globalAlpha *= alpha;

      // Background pill
      const bx = anchorX;
      const by = stackY;
      ctx.beginPath();
      ctx.roundRect(bx, by, boxW, boxH, BUBBLE.borderRadius);
      ctx.fillStyle = withAlpha(color, 0.14);
      ctx.fill();
      ctx.strokeStyle = withAlpha(color, 0.5);
      ctx.lineWidth = 0.8;
      ctx.stroke();

      // Triangle pointer on first visible bubble only
      if (firstVisible) {
        const ty = by + boxH / 2;
        ctx.beginPath();
        ctx.moveTo(bx - BUBBLE.triOffset, ty);
        ctx.lineTo(bx, ty - BUBBLE.triWidth);
        ctx.lineTo(bx, ty + BUBBLE.triWidth);
        ctx.closePath();
        ctx.fillStyle = withAlpha(color, 0.5);
        ctx.fill();
        firstVisible = false;
      }

      // Role label
      ctx.font = `${style.labelSize}px monospace`;
      ctx.fillStyle = withAlpha(color, 0.8);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(ROLE_LABELS[bubble.role], bx + style.padding, by + 3);

      // Body text
      ctx.font = `${style.fontSize}px monospace`;
      ctx.fillStyle = withAlpha(COLORS.text, 0.9);
      lines.forEach((line, i) => {
        ctx.fillText(line, bx + style.padding, by + style.headerH + i * style.lineH);
      });

      ctx.restore();

      stackY += boxH + BUBBLE.gap;
    }

    ctx.restore();
  }
}
