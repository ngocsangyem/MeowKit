/**
 * OrchViz — Glow Sprite Cache
 *
 * Pre-rendered radial gradient offscreen canvases keyed by color+radius.
 * Avoids recreating expensive gradient objects every frame.
 */

import { withAlpha } from '@/lib/colors';

const _cache = new Map<string, HTMLCanvasElement>();

/**
 * Returns a cached offscreen canvas with a radial glow gradient.
 * Safe to call every frame — returns cached result on hit.
 */
export function getGlowSprite(color: string, radius: number): HTMLCanvasElement {
  const key = `${color}:${radius}`;
  const cached = _cache.get(key);
  if (cached) return cached;

  const size = radius * 2;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(radius, radius, 0, radius, radius, radius);
  grad.addColorStop(0, withAlpha(color, 0.45));
  grad.addColorStop(0.4, withAlpha(color, 0.2));
  grad.addColorStop(1, withAlpha(color, 0));

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  _cache.set(key, canvas);
  return canvas;
}

/** Clear the sprite cache — call on theme change if colors are dynamic. */
export function clearGlowSpriteCache(): void {
  _cache.clear();
}
