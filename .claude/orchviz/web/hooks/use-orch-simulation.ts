'use client';

/**
 * OrchViz — Core Orchestration Simulation Hook
 *
 * Dual-state pattern: orchRef (mutable, read by Canvas at 60fps) +
 * state (throttled React commit every ANIM.uiThrottleMs).
 * RT2-1: structuredClone only agents + tasks on commit.
 * RT3-6: share events array by reference.
 */

import { useRef, useState, useEffect } from 'react';
import { ANIM, PERF } from '@/lib/canvas-constants';
import { createInitialState } from './simulation/types';
import type { OrchSimulationState } from './simulation/types';
import { processEvent } from './simulation/process-event';
import type { SSEBridge } from './use-sse-bridge';

export function useOrchSimulation(bridge: SSEBridge): {
  orchRef: React.MutableRefObject<OrchSimulationState>;
  state: OrchSimulationState;
  setState: React.Dispatch<React.SetStateAction<OrchSimulationState>>;
} {
  const orchRef = useRef<OrchSimulationState>(createInitialState());
  const [state, setState] = useState<OrchSimulationState>(orchRef.current);
  const lastCommitRef = useRef<number>(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    let running = true;

    function tick() {
      if (!running) return;
      const sim = orchRef.current;
      const now = Date.now();

      // 1. Drain and process SSE events
      const events = bridge.drainEvents();
      for (const ev of events) {
        processEvent(sim, ev);
      }

      // 2. Advance particles: remove when out of [0,1]
      sim.particles = sim.particles.filter(p => {
        p.t += p.speed * p.dir;
        return p.t >= 0 && p.t <= 1;
      });

      // 3. Advance effects: remove expired
      sim.effects = sim.effects.filter(e => {
        return now - e.startTime < e.duration;
      });

      // 4. Fade completed agents
      for (const agent of Object.values(sim.agents)) {
        if (agent.status === 'complete') {
          agent.opacity = Math.max(0, agent.opacity - ANIM.agentFadeOut * 0.016);
        } else if (agent.opacity < 1) {
          agent.opacity = Math.min(1, agent.opacity + ANIM.agentFadeIn * 0.016);
        }
        // Scale in
        if (agent.scale < 1) {
          agent.scale = Math.min(1, agent.scale + ANIM.agentScaleIn * 0.016);
        }
        // Prune invisible completed agents from bubbles
        if (agent.messageBubbles.length > PERF.maxBubblesPerAgent) {
          agent.messageBubbles.splice(0, agent.messageBubbles.length - PERF.maxBubblesPerAgent);
        }
      }

      // 5. Throttled React commit — RT2-1: clone only agents + tasks
      if (now - lastCommitRef.current >= ANIM.uiThrottleMs) {
        lastCommitRef.current = now;
        setState(prev => ({
          ...prev,
          // Shallow-clone top-level, deep-clone hot mutable objects
          agents: structuredClone(sim.agents),
          tasks: structuredClone(sim.tasks),
          // Share by reference — Canvas reads these directly from orchRef anyway
          particles: sim.particles,
          effects: sim.effects,
          edges: sim.edges,
          toolCalls: sim.toolCalls,
          // RT3-6: share events array by reference (ring buffer)
          events: sim.events,
          currentPhase: sim.currentPhase,
          plan: sim.plan,
          sessionId: sim.sessionId,
          startTime: sim.startTime,
          lastEventTime: sim.lastEventTime,
          eventCount: sim.eventCount,
          toolCount: sim.toolCount,
          totalCost: sim.totalCost,
          lastProcessedSeq: sim.lastProcessedSeq,
        }));
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [bridge]);

  return { orchRef, state, setState };
}
