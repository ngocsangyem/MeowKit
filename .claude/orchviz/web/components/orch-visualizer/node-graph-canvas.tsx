'use client';

/**
 * OrchViz — Node Graph Canvas
 * 60fps Canvas 2D render loop reading directly from orchRef (mutable ref).
 * Never reads from React state — avoids re-render overhead.
 */

import { useEffect, useRef, useCallback } from 'react';
import type { OrchSimulationState } from '@/hooks/simulation/types';
import type { AgentNode } from '@/lib/orch-types';
import type { CameraTransform } from '@/lib/orch-types';
import { drawBackground } from './canvas/draw-background';
import { drawEdges } from './canvas/draw-edges';
import { drawParticles } from './canvas/draw-particles';
import { drawAgentNodes } from './canvas/draw-nodes';
import { drawBubbles } from './canvas/draw-bubbles';
import { drawToolCalls } from './canvas/draw-tool-calls';
import { drawEffects } from './canvas/draw-effects';
import { drawCostLabels } from './canvas/draw-cost';
import { findNodeAt } from './canvas/hit-testing';

interface NodeGraphCanvasProps {
  orchRef: React.MutableRefObject<OrchSimulationState>;
  transformRef: React.MutableRefObject<CameraTransform>;
  onSelectAgent: (agent: AgentNode | null, screenX: number, screenY: number) => void;
  onHoverAgent: (agent: AgentNode | null) => void;
  onPanStart: (e: React.MouseEvent) => void;
  onPanMove: (e: React.MouseEvent) => void;
  onPanEnd: () => void;
  onZoom: (e: React.WheelEvent) => void;
  paused: boolean;
}

export function NodeGraphCanvas({
  orchRef, transformRef,
  onSelectAgent, onHoverAgent,
  onPanStart, onPanMove, onPanEnd, onZoom,
  paused,
}: NodeGraphCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const hoveredRef = useRef<AgentNode | null>(null);
  const hoverThrottleRef = useRef<number>(0);

  // Resize canvas to match devicePixelRatio
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function resize() {
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
    }

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let running = true;

    function render() {
      if (!running || !canvas) return;
      if (!paused) {
        const dpr = window.devicePixelRatio || 1;
        const w = canvas.width;
        const h = canvas.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { rafRef.current = requestAnimationFrame(render); return; }

        const sim = orchRef.current;
        const t = transformRef.current;
        const time = Date.now() / 1000;
        const agents = Object.values(sim.agents);

        // 1. Background (fills full canvas, no camera transform)
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        drawBackground(ctx, w / dpr, h / dpr, time);

        // 2. Apply camera transform
        ctx.save();
        ctx.translate(t.x, t.y);
        ctx.scale(t.scale, t.scale);

        // 3. Draw scene in world-space
        drawEdges(ctx, sim.edges, sim.agents, time);
        drawParticles(ctx, sim.particles, sim.edges, sim.agents, time);
        drawAgentNodes(ctx, agents, time, hoveredRef.current);
        drawBubbles(ctx, agents, time);
        drawToolCalls(ctx, sim.toolCalls, time);
        drawEffects(ctx, sim.effects, time);
        drawCostLabels(ctx, agents);  // inside camera transform — uses world coords

        ctx.restore();
      }

      rafRef.current = requestAnimationFrame(render);
    }

    rafRef.current = requestAnimationFrame(render);
    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [orchRef, transformRef, paused]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    onPanMove(e);

    // Throttle hover hit-testing
    const now = Date.now();
    if (now - hoverThrottleRef.current < 100) return;
    hoverThrottleRef.current = now;

    const rect = e.currentTarget.getBoundingClientRect();
    const t = transformRef.current;
    const wx = (e.clientX - rect.left - t.x) / t.scale;
    const wy = (e.clientY - rect.top - t.y) / t.scale;
    const agents = Object.values(orchRef.current.agents);
    const hit = findNodeAt(wx, wy, agents);
    hoveredRef.current = hit;
    onHoverAgent(hit);
  }, [onPanMove, transformRef, orchRef, onHoverAgent]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const t = transformRef.current;
    const wx = (e.clientX - rect.left - t.x) / t.scale;
    const wy = (e.clientY - rect.top - t.y) / t.scale;
    const agents = Object.values(orchRef.current.agents);
    const hit = findNodeAt(wx, wy, agents);
    onSelectAgent(hit, e.clientX, e.clientY);
  }, [transformRef, orchRef, onSelectAgent]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: 'grab' }}
      onMouseDown={onPanStart}
      onMouseMove={handleMouseMove}
      onMouseUp={onPanEnd}
      onMouseLeave={onPanEnd}
      onClick={handleClick}
      onWheel={onZoom}
      onContextMenu={handleContextMenu}
    />
  );
}
