'use client';

/**
 * OrchViz — Pure-JS Force Layout Hook
 *
 * Runs repulsion + spring + gravity each animation frame.
 * Writes positions directly into orchRef.current.agents (no React re-render).
 * RT3-2: scales charge/linkDist/collide when node count exceeds FORCE.scaleThreshold.
 * No d3 dependency.
 */

import { useEffect, useRef } from 'react';
import { FORCE, NODE } from '@/lib/canvas-constants';
import type { OrchSimulationState } from './simulation/types';

const ORCHESTRATOR_TIER = 'orchestrator';

export function useForceLayout(
  orchRef: React.MutableRefObject<OrchSimulationState>,
  canvasWidth: number,
  canvasHeight: number,
): void {
  const rafRef = useRef<number>(0);

  useEffect(() => {
    let running = true;

    function tick() {
      if (!running) return;

      const sim = orchRef.current;
      const nodes = Object.values(sim.agents).filter(a => a.opacity > 0.01);
      const count = nodes.length;

      if (count < 2) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      // RT3-2: scale params by node count
      const scaleFactor = count > FORCE.scaleThreshold
        ? FORCE.scaleThreshold / count
        : 1;

      const charge = FORCE.chargeBase * scaleFactor;
      const linkDist = FORCE.linkDistBase * scaleFactor;
      const collideR = FORCE.collideBase * scaleFactor;
      const cx = canvasWidth / 2;
      const cy = canvasHeight / 2;

      // Accumulate forces into temp arrays
      const fx = new Float64Array(count);
      const fy = new Float64Array(count);

      // Repulsion: O(n²) — acceptable for n < ~50 nodes
      for (let i = 0; i < count; i++) {
        for (let j = i + 1; j < count; j++) {
          const dx = nodes[j].x - nodes[i].x;
          const dy = nodes[j].y - nodes[i].y;
          const dist2 = dx * dx + dy * dy || 0.0001;
          const dist = Math.sqrt(dist2);
          // Soft collision floor
          const minDist = nodes[i].radius + nodes[j].radius + collideR;
          const effectiveDist = Math.max(dist, minDist);
          const f = charge / (effectiveDist * effectiveDist);
          const nx = dx / effectiveDist;
          const ny = dy / effectiveDist;
          fx[i] -= f * nx;
          fy[i] -= f * ny;
          fx[j] += f * nx;
          fy[j] += f * ny;
        }
      }

      // Spring toward parent along edges
      for (let i = 0; i < count; i++) {
        const node = nodes[i];
        if (!node.parentAgent) continue;
        const parent = sim.agents[node.parentAgent];
        if (!parent) continue;
        const dx = parent.x - node.x;
        const dy = parent.y - node.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.0001;
        const springF = (dist - linkDist) * 0.04;
        fx[i] += (dx / dist) * springF;
        fy[i] += (dy / dist) * springF;
      }

      // Weak center gravity
      for (let i = 0; i < count; i++) {
        if (nodes[i].tier === ORCHESTRATOR_TIER) continue;
        fx[i] += (cx - nodes[i].x) * FORCE.centerGravity;
        fy[i] += (cy - nodes[i].y) * FORCE.centerGravity;
      }

      // Integrate velocities and positions
      for (let i = 0; i < count; i++) {
        const node = nodes[i];

        // Pin orchestrator to canvas center
        if (node.tier === ORCHESTRATOR_TIER) {
          node.x = cx;
          node.y = cy;
          node.vx = 0;
          node.vy = 0;
          continue;
        }

        // Skip completed/invisible nodes
        if (node.status === 'complete' && node.opacity < 0.05) continue;

        node.vx = (node.vx + fx[i]) * FORCE.velocityDecay;
        node.vy = (node.vy + fy[i]) * FORCE.velocityDecay;
        node.x += node.vx;
        node.y += node.vy;
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [orchRef, canvasWidth, canvasHeight]);
}
