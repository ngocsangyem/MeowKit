/**
 * OrchViz — Hit Testing
 *
 * Distance-based detection for canvas click/hover events.
 * All functions are pure — no side effects, no DOM access.
 */

import { HIT, TOOL_CARD } from '@/lib/canvas-constants';
import type { AgentNode, ToolCallNode } from '@/lib/orch-types';

/**
 * Find the agent node under canvas point (x, y).
 * Uses radius + HIT.nodeExtraPx as the hit zone.
 * Returns the first match (front-to-back order of array).
 */
export function findNodeAt(
  x: number,
  y: number,
  agents: AgentNode[],
): AgentNode | null {
  // Iterate in reverse so topmost-rendered (last in array) is checked first
  for (let i = agents.length - 1; i >= 0; i--) {
    const agent = agents[i];
    if (agent.opacity < 0.05) continue;
    const hitR = agent.radius * agent.scale + HIT.nodeExtraPx;
    const dx = x - agent.x;
    const dy = y - agent.y;
    if (dx * dx + dy * dy <= hitR * hitR) return agent;
  }
  return null;
}

/**
 * Find the tool-call card under canvas point (x, y).
 * Uses card bounding box derived from TOOL_CARD dimensions.
 */
export function findToolAt(
  x: number,
  y: number,
  tools: ToolCallNode[],
): ToolCallNode | null {
  // Import constants inline to avoid circular dep with draw-tool-calls
  const W = TOOL_CARD.maxWidth;
  const H = TOOL_CARD.expandedHeight;

  for (let i = tools.length - 1; i >= 0; i--) {
    const tc = tools[i];
    if (tc.opacity < 0.05) continue;
    const bx = tc.x - W / 2;
    const by = tc.y - H / 2;
    if (x >= bx && x <= bx + W && y >= by && y <= by + H) return tc;
  }
  return null;
}
