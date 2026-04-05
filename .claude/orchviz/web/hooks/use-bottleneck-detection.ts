'use client';

/**
 * OrchViz — Bottleneck Detection Hook
 * Scans agents/tasks for anomalies: stalled agents, long tools, blocked chains.
 * Debounced to 1/sec to avoid thrashing.
 */

import { useRef, useState, useEffect } from 'react';
import type { AgentNode } from '@/lib/orch-types';
import type { TaskNode } from '@/hooks/simulation/types';

export interface BottleneckMarker {
  type: 'stalled_agent' | 'long_tool' | 'retry_loop' | 'blocked_chain';
  severity: 'warning' | 'error';
  agentName: string;
  description: string;
}

const STALL_THRESHOLD_S   = 30;   // agent active but no tool >30s → warning
const LONG_TOOL_THRESHOLD_S = 60; // tool running >60s → warning
const BLOCKED_THRESHOLD_S = 120;  // task blocked >120s → error

export function useBottleneckDetection(
  agents: Record<string, AgentNode>,
  tasks: Record<string, TaskNode>,
  lastEventTime: number,
  enabled: boolean,
): BottleneckMarker[] {
  const [markers, setMarkers] = useState<BottleneckMarker[]>([]);
  const lastScanRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled) { setMarkers([]); return; }

    const now = Date.now();
    // Debounce: only scan once per second
    if (now - lastScanRef.current < 1000) return;
    lastScanRef.current = now;

    const nowS = now / 1000;
    const found: BottleneckMarker[] = [];

    // stalled_agent: active/thinking but no tool call for >30s
    for (const agent of Object.values(agents)) {
      if (agent.status !== 'active' && agent.status !== 'thinking') continue;
      const idleSince = agent.currentTool === null
        ? (lastEventTime > 0 ? nowS - lastEventTime / 1000 : 0)
        : 0;
      if (idleSince > STALL_THRESHOLD_S) {
        found.push({
          type: 'stalled_agent',
          severity: 'warning',
          agentName: agent.name,
          description: `${agent.name} active but no tool for ${Math.floor(idleSince)}s`,
        });
      }
    }

    // long_tool: tool running >60s
    for (const agent of Object.values(agents)) {
      if (!agent.currentTool) continue;
      const activeSince = nowS - agent.spawnTime;
      if (activeSince > LONG_TOOL_THRESHOLD_S) {
        found.push({
          type: 'long_tool',
          severity: 'warning',
          agentName: agent.name,
          description: `${agent.name} tool "${agent.currentTool}" running ${Math.floor(activeSince)}s`,
        });
      }
    }

    // blocked_chain: task blocked >120s (use lastEventTime as proxy for task update time)
    for (const task of Object.values(tasks)) {
      if (task.status !== 'blocked') continue;
      const blockedFor = lastEventTime > 0 ? nowS - lastEventTime / 1000 : 0;
      if (blockedFor > BLOCKED_THRESHOLD_S) {
        const owner = task.owner ?? 'unknown';
        found.push({
          type: 'blocked_chain',
          severity: 'error',
          agentName: owner,
          description: `Task "${task.subject}" blocked for ${Math.floor(blockedFor)}s`,
        });
      }
    }

    setMarkers(found);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agents, tasks, lastEventTime, enabled]);

  return markers;
}
