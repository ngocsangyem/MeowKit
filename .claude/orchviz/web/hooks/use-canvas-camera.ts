'use client';

/**
 * OrchViz — Canvas Camera Transform Hook
 *
 * Manages world↔screen transform with pan inertia and zoom-to-fit.
 * transformRef is mutated directly so Canvas reads it at 60fps without React re-renders.
 */

import { useRef, useCallback } from 'react';
import type { CameraTransform } from '@/lib/orch-types';
import type { AgentNode } from '@/lib/orch-types';
import { ANIM } from '@/lib/canvas-constants';

const ZOOM_MIN = 0.1;
const ZOOM_MAX = 4.0;
const ZOOM_STEP = 0.001;
const FIT_PADDING = 120;

export function useCanvasCamera() {
  const transformRef = useRef<CameraTransform>({ x: 0, y: 0, scale: 1 });
  const panState = useRef<{ dragging: boolean; lastX: number; lastY: number; vx: number; vy: number }>({
    dragging: false, lastX: 0, lastY: 0, vx: 0, vy: 0,
  });

  const screenToWorld = useCallback((sx: number, sy: number) => {
    const t = transformRef.current;
    return { x: (sx - t.x) / t.scale, y: (sy - t.y) / t.scale };
  }, []);

  const worldToScreen = useCallback((wx: number, wy: number) => {
    const t = transformRef.current;
    return { x: wx * t.scale + t.x, y: wy * t.scale + t.y };
  }, []);

  const handlePanStart = useCallback((e: React.MouseEvent) => {
    panState.current.dragging = true;
    panState.current.lastX = e.clientX;
    panState.current.lastY = e.clientY;
    panState.current.vx = 0;
    panState.current.vy = 0;
  }, []);

  const handlePanMove = useCallback((e: React.MouseEvent) => {
    const ps = panState.current;
    if (!ps.dragging) return;
    const dx = e.clientX - ps.lastX;
    const dy = e.clientY - ps.lastY;
    transformRef.current.x += dx;
    transformRef.current.y += dy;
    ps.vx = dx;
    ps.vy = dy;
    ps.lastX = e.clientX;
    ps.lastY = e.clientY;
  }, []);

  const handlePanEnd = useCallback(() => {
    panState.current.dragging = false;
    // Inertia: apply velocity with decay until negligible
    function applyInertia() {
      const ps = panState.current;
      if (ps.dragging) return;
      ps.vx *= ANIM.inertiaDecay;
      ps.vy *= ANIM.inertiaDecay;
      if (Math.abs(ps.vx) < 0.1 && Math.abs(ps.vy) < 0.1) return;
      transformRef.current.x += ps.vx;
      transformRef.current.y += ps.vy;
      requestAnimationFrame(applyInertia);
    }
    requestAnimationFrame(applyInertia);
  }, []);

  const handleZoom = useCallback((e: React.WheelEvent) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    const t = transformRef.current;
    const delta = -e.deltaY * ZOOM_STEP;
    const newScale = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, t.scale * (1 + delta * 50)));
    // Zoom centered on cursor
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    t.x = cx - (cx - t.x) * (newScale / t.scale);
    t.y = cy - (cy - t.y) * (newScale / t.scale);
    t.scale = newScale;
  }, []);

  const zoomToFit = useCallback((agents: AgentNode[]) => {
    if (agents.length === 0) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const a of agents) {
      minX = Math.min(minX, a.x - a.radius);
      minY = Math.min(minY, a.y - a.radius);
      maxX = Math.max(maxX, a.x + a.radius);
      maxY = Math.max(maxY, a.y + a.radius);
    }

    // Canvas size from window as fallback
    const canvasW = window.innerWidth;
    const canvasH = window.innerHeight;

    const contentW = maxX - minX + FIT_PADDING * 2;
    const contentH = maxY - minY + FIT_PADDING * 2;
    const targetScale = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.min(canvasW / contentW, canvasH / contentH)));

    const targetX = canvasW / 2 - ((minX + maxX) / 2) * targetScale;
    const targetY = canvasH / 2 - ((minY + maxY) / 2) * targetScale;

    // Lerp toward target
    const t = transformRef.current;
    function lerp() {
      t.x += (targetX - t.x) * ANIM.autoFitLerp;
      t.y += (targetY - t.y) * ANIM.autoFitLerp;
      t.scale += (targetScale - t.scale) * ANIM.autoFitLerp;
      if (Math.abs(t.x - targetX) > 0.5 || Math.abs(t.y - targetY) > 0.5 || Math.abs(t.scale - targetScale) > 0.001) {
        requestAnimationFrame(lerp);
      }
    }
    requestAnimationFrame(lerp);
  }, []);

  return { transformRef, screenToWorld, worldToScreen, handlePanStart, handlePanMove, handlePanEnd, handleZoom, zoomToFit };
}
