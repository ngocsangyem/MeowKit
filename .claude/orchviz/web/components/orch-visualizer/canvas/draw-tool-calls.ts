/**
 * OrchViz — Tool Call Card Renderer
 *
 * Draws floating cards for active tool calls anchored to agent positions.
 * Running: amber border + spinning arc. Complete: dimmed. Error: red glow.
 */

import { COLORS, withAlpha } from '@/lib/colors';
import { TOOL_CARD } from '@/lib/canvas-constants';
import type { ToolCallNode } from '@/lib/orch-types';

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

/** Draw all tool-call floating cards. */
export function drawToolCalls(
  ctx: CanvasRenderingContext2D,
  toolCalls: ToolCallNode[],
  time: number,
): void {
  for (const tc of toolCalls) {
    if (tc.opacity < 0.02) continue;

    ctx.save();
    ctx.globalAlpha = tc.opacity;

    const isRunning = tc.state === 'running';
    const isError = tc.state === 'error';
    const h = isRunning ? TOOL_CARD.expandedHeight : TOOL_CARD.collapsedHeight;
    const w = TOOL_CARD.maxWidth;
    const x = tc.x - w / 2;
    const y = tc.y - h / 2;

    const borderColor = isError
      ? COLORS.toolError
      : isRunning
        ? COLORS.toolRunning
        : COLORS.toolComplete;

    // Error glow pulse
    if (isError) {
      const pulse = Math.sin(time * 4) * TOOL_CARD.errorGlowPulse;
      ctx.shadowColor = COLORS.toolError;
      ctx.shadowBlur = TOOL_CARD.errorGlowBase + pulse;
    }

    // Card background
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, TOOL_CARD.borderRadius);
    ctx.fillStyle = withAlpha(borderColor, isError ? 0.1 : 0.07);
    ctx.fill();
    ctx.strokeStyle = withAlpha(borderColor, isError ? 0.8 : 0.5);
    ctx.lineWidth = isError ? 1.5 : 1;
    ctx.stroke();

    ctx.shadowBlur = 0;

    const cx = tc.x;
    const textY = y + 7;

    // Spinning arc for running state
    if (isRunning) {
      const spinAngle = time * TOOL_CARD.spinSpeed;
      const spinR = h / 2 - TOOL_CARD.spinRingPadding;
      const spinX = x + w - h / 2;
      const spinY = tc.y;
      ctx.beginPath();
      ctx.arc(spinX, spinY, spinR, spinAngle, spinAngle + TOOL_CARD.spinArc);
      ctx.strokeStyle = withAlpha(COLORS.toolRunning, 0.9);
      ctx.lineWidth = 1.5;
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    // Tool name
    ctx.font = `bold ${TOOL_CARD.fontSize}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = withAlpha(borderColor, isRunning ? 0.95 : 0.6);
    ctx.fillText(truncate(tc.toolName, 22), cx, textY);

    if (isRunning && tc.args) {
      // Args line
      ctx.font = `${TOOL_CARD.fontSize - 1}px monospace`;
      ctx.fillStyle = withAlpha(COLORS.muted, 0.8);
      ctx.fillText(truncate(tc.args, 26), cx, textY + 11);
    }

    if (tc.state === 'complete' && tc.tokenCost !== null) {
      ctx.font = `${TOOL_CARD.tokenFontSize}px monospace`;
      ctx.fillStyle = withAlpha(COLORS.costText, 0.6);
      ctx.fillText(`${tc.tokenCost}tok`, cx, textY + 10);
    }

    if (isError && tc.errorMessage) {
      ctx.font = `${TOOL_CARD.errorFontSize}px monospace`;
      ctx.fillStyle = withAlpha(COLORS.toolError, 0.9);
      ctx.fillText('FAILED: ' + truncate(tc.errorMessage, 20), cx, textY + 10);
    }

    ctx.restore();
  }
}
