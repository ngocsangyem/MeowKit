/**
 * OrchViz — Frontend Canvas Types
 *
 * Pure data shapes consumed by canvas drawing functions and hooks.
 * No React, no state management imports.
 */

export interface AgentNode {
  name: string;
  tier: string;
  parentAgent: string | null;
  status: 'active' | 'thinking' | 'idle' | 'complete' | 'waiting' | 'error';
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  opacity: number;
  scale: number;
  breathePhase: number;
  scanlineY: number;
  currentTool: string | null;
  toolCallCount: number;
  tokensUsed: number;
  tokensMax: number;
  cost: number;
  spawnTime: number;
  completeTime: number | null;
  messageBubbles: MessageBubble[];
}

export interface EdgeNode {
  source: string;
  target: string;
  active: boolean;
  opacity: number;
}

export interface Particle {
  edgeIdx: number;
  t: number;
  speed: number;
  size: number;
  color: string;
  phase: number;
  dir: 1 | -1;
}

export interface ToolCallNode {
  id: string;
  agentName: string;
  toolName: string;
  args: string;
  state: 'running' | 'complete' | 'error';
  tokenCost: number | null;
  errorMessage: string | null;
  x: number;
  y: number;
  opacity: number;
  startTime: number;
  completeTime: number | null;
}

export interface MessageBubble {
  role: 'user' | 'assistant' | 'thinking' | 'subagent_report';
  text: string;
  time: number;
  _cachedLines?: string[];
  _cachedW?: number;
  _cachedH?: number;
}

export interface VisualEffect {
  type: 'spawn' | 'complete';
  x: number;
  y: number;
  startTime: number;
  duration: number;
  color: string;
}

export interface CameraTransform {
  x: number;
  y: number;
  scale: number;
}
