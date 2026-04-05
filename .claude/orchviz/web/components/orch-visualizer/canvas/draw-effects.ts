/**
 * OrchViz — Spawn / Complete Visual Effects
 *
 * Draws expanding ring + scatter-particle spawn bursts and
 * expanding glow rings for agent completion events.
 * Returns a boolean array indicating which effects are still alive.
 */

import { withAlpha } from '@/lib/colors';
import { SPAWN_FX, COMPLETE_FX } from '@/lib/canvas-constants';
import { drawHexagon } from './draw-nodes';
import type { VisualEffect } from '@/lib/orch-types';

/**
 * Draw all active visual effects and return liveness flags.
 * @param time - current elapsed seconds
 * @returns boolean[] — true = still alive, false = expired (remove)
 */
export function drawEffects(
  ctx: CanvasRenderingContext2D,
  effects: VisualEffect[],
  time: number,
): boolean[] {
  return effects.map((fx) => {
    const age = time - fx.startTime;
    const progress = age / fx.duration;
    if (progress >= 1) return false;

    ctx.save();

    if (fx.type === 'spawn') {
      drawSpawnEffect(ctx, fx, progress);
    } else {
      drawCompleteEffect(ctx, fx, progress);
    }

    ctx.restore();
    return true;
  });
}

function drawSpawnEffect(
  ctx: CanvasRenderingContext2D,
  fx: VisualEffect,
  progress: number,
): void {
  const ringR = SPAWN_FX.ringStart + progress * SPAWN_FX.ringExpand;
  const ringAlpha = SPAWN_FX.maxAlpha * (1 - progress);

  // Expanding hex ring
  ctx.strokeStyle = withAlpha(fx.color, ringAlpha);
  ctx.lineWidth = 2;
  drawHexagon(ctx, fx.x, fx.y, ringR);
  ctx.stroke();

  // White flash during first 30%
  if (progress < SPAWN_FX.flashThreshold) {
    const flashProgress = progress / SPAWN_FX.flashThreshold;
    const flashR = SPAWN_FX.flashBaseRadius + flashProgress * SPAWN_FX.flashMinRadius;
    const flashAlpha = SPAWN_FX.flashAlpha * (1 - flashProgress);
    const flashGrad = ctx.createRadialGradient(fx.x, fx.y, 0, fx.x, fx.y, flashR);
    flashGrad.addColorStop(0, `rgba(255,255,255,${flashAlpha})`);
    flashGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.beginPath();
    ctx.arc(fx.x, fx.y, flashR, 0, Math.PI * 2);
    ctx.fillStyle = flashGrad;
    ctx.fill();
  }

  // 8 scatter particles radiating outward
  for (let i = 0; i < SPAWN_FX.particleCount; i++) {
    const angle = (i / SPAWN_FX.particleCount) * Math.PI * 2;
    const dist = ringR * 0.85;
    const px = fx.x + Math.cos(angle) * dist;
    const py = fx.y + Math.sin(angle) * dist;
    const pAlpha = ringAlpha * 0.8;
    ctx.beginPath();
    ctx.arc(px, py, SPAWN_FX.particleSize, 0, Math.PI * 2);
    ctx.fillStyle = withAlpha(fx.color, pAlpha);
    ctx.fill();
  }
}

function drawCompleteEffect(
  ctx: CanvasRenderingContext2D,
  fx: VisualEffect,
  progress: number,
): void {
  const ringR = COMPLETE_FX.ringStart + progress * COMPLETE_FX.ringExpand;
  const ringAlpha = COMPLETE_FX.maxAlpha * (1 - progress);

  // Glow ring
  const glowGrad = ctx.createRadialGradient(fx.x, fx.y, ringR * 0.7, fx.x, fx.y, ringR);
  glowGrad.addColorStop(0, withAlpha(fx.color, ringAlpha * 0.4));
  glowGrad.addColorStop(1, withAlpha(fx.color, 0));
  ctx.beginPath();
  ctx.arc(fx.x, fx.y, ringR, 0, Math.PI * 2);
  ctx.fillStyle = glowGrad;
  ctx.fill();

  // Crisp ring stroke
  ctx.strokeStyle = withAlpha(fx.color, ringAlpha);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(fx.x, fx.y, ringR, 0, Math.PI * 2);
  ctx.stroke();

  // Flash at start
  if (progress < COMPLETE_FX.flashThreshold) {
    const fp = progress / COMPLETE_FX.flashThreshold;
    const fa = COMPLETE_FX.flashAlpha * (1 - fp);
    ctx.beginPath();
    ctx.arc(fx.x, fx.y, 24 + fp * 16, 0, Math.PI * 2);
    ctx.fillStyle = withAlpha(fx.color, fa * 0.3);
    ctx.fill();
  }
}
