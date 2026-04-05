/**
 * OrchViz — Main Event Dispatcher
 *
 * Routes SSE events to the appropriate handler based on eventType.
 * Mutates simulation state in-place (called inside rAF loop).
 */

import { PERF, BUBBLE } from '@/lib/canvas-constants';
import type { OrchSimulationState, OrchEvent } from './types';
import { pushEvent } from './types';
import { handleAgentSpawn, handleAgentComplete, handleAgentIdle } from './handle-agent';
import { handleTaskInferred } from './handle-task';
import { handlePreToolUse, handlePostToolUse } from './handle-tool-call';

const TASK_TOOL_NAMES = new Set([
  'TaskCreate', 'TaskUpdate',
  'mcp__claude-in-chrome__TaskCreate', 'mcp__claude-in-chrome__TaskUpdate',
]);

export function processEvent(state: OrchSimulationState, event: OrchEvent): void {
  pushEvent(state, event);

  const { eventType } = event;

  switch (eventType) {
    case 'SubagentStart':
      handleAgentSpawn(state, event);
      return;

    case 'SubagentStop':
      handleAgentComplete(state, event);
      return;

    case 'agent_idle':
      handleAgentIdle(state, event);
      return;

    case 'PreToolUse':
    case 'tool_call_start': {
      const toolName = event.toolContext?.name ?? '';
      if (TASK_TOOL_NAMES.has(toolName)) handleTaskInferred(state, event);
      handlePreToolUse(state, event);
      return;
    }

    case 'PostToolUse':
    case 'tool_call_end': {
      const toolName = event.toolContext?.name ?? '';
      if (TASK_TOOL_NAMES.has(toolName)) handleTaskInferred(state, event);
      handlePostToolUse(state, event);
      return;
    }

    case 'message': {
      const agentName = event.agent?.name;
      const msgCtx = event.messageContext;
      if (!agentName || !state.agents[agentName] || !msgCtx) return;
      const agent = state.agents[agentName];
      const text = msgCtx.text.slice(0, BUBBLE.maxWidth);
      agent.messageBubbles.push({ role: msgCtx.role, text, time: event.timestamp });
      if (agent.messageBubbles.length > PERF.maxBubblesPerAgent) {
        agent.messageBubbles.shift();
      }
      return;
    }

    default:
      // Unknown event type — already pushed to ring buffer above
  }
}
