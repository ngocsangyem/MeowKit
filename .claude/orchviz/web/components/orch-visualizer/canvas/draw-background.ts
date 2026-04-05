/**
 * OrchViz — Background Dot Grid
 *
 * Fills the canvas with the base background color and renders an
 * animated dot grid that breathes using a slow sine wave.
 */

import { COLORS } from '@/lib/colors';
import { BG } from '@/lib/canvas-constants';

/**
 * Draw the dot-grid background.
 * @param time - elapsed seconds (used for breathing animation)
 */
export function drawBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number,
): void {
  // Base fill
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, width, height);

  // Breathing alpha: oscillates between breatheMin and breatheMax
  const breatheT = (Math.sin((time * 1000) / BG.breatheSpeed * Math.PI * 2) + 1) / 2;
  const alpha = BG.breatheMin + breatheT * (BG.breatheMax - BG.breatheMin);

  ctx.save();
  ctx.fillStyle = `rgba(125,211,252,${alpha})`; // cyan dots

  const cols = Math.ceil(width / BG.dotSpacing) + 1;
  const rows = Math.ceil(height / BG.dotSpacing) + 1;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const dx = c * BG.dotSpacing;
      const dy = r * BG.dotSpacing;
      ctx.beginPath();
      ctx.arc(dx, dy, BG.dotRadius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}
