import {
  type Agent,
  type TimelineEntry,
  emptyContextBreakdown,
} from '@/lib/agent-types'
import type { PauseReason, PauseDetail } from '../../../orchviz/protocol'
import { COLORS } from '@/lib/colors'
import { AGENT_SPAWN_DISTANCE } from '@/lib/canvas-constants'
import { pushTimelineBlock, type ProcessEventContext, type MutableEventState } from './process-event'
import { edgeId, asString, asBoolean } from './types'

// ── Pause label helper ────────────────────────────────────────────────────────
function pauseLabel(reason: PauseReason): string {
  switch (reason) {
    case 'permission_request': return 'Permission'
    case 'ask_user_question':  return 'Question'
    case 'plan_mode_review':   return 'Plan Review'
    case 'tool_rejected':      return 'Rejected'
    case 'hook_blocked':       return 'Hook Blocked'
  }
}

export function handleAgentSpawn(
  payload: Record<string, unknown>,
  currentTime: number,
  state: MutableEventState,
  ctx: ProcessEventContext,
): void {
  const name = asString(payload.name)
  const parentId = typeof payload.parent === 'string' ? payload.parent : undefined
  const isMain = asBoolean(payload.isMain)
  const task = typeof payload.task === 'string' ? payload.task : undefined
  const model = typeof payload.model === 'string' ? payload.model : undefined
  const runtime = payload.runtime === 'codex' ? 'codex' as const : undefined

  // If the agent already exists (e.g. session resuming after inactivity),
  // reactivate it instead of replacing — preserves accumulated stats.
  const existing = state.agents.get(name)
  if (existing) {
    state.agents.set(name, {
      ...existing,
      state: 'idle',
      ...(task ? { task } : {}),
      ...(model ? { tokensMax: ctx.getContextWindowSize(model) } : {}),
    })
    return
  }

  let x = 0, y = 0
  if (parentId) {
    const parent = state.agents.get(parentId)
    if (parent) {
      // Collect angles of existing siblings so we can avoid spawning too close
      const siblingAngles: number[] = []
      for (const a of state.agents.values()) {
        if (a.parentId === parentId && a.id !== name) {
          siblingAngles.push(Math.atan2(a.y - parent.y, a.x - parent.x))
        }
      }

      let angle: number
      if (siblingAngles.length === 0) {
        // First child: use hash-based angle
        const hash = name.split('').reduce((h, c) => ((h << 5) - h) + c.charCodeAt(0), 0)
        angle = (Math.abs(hash) % 360) * (Math.PI / 180)
      } else {
        // Find the largest angular gap between existing siblings and place in the middle
        siblingAngles.sort((a, b) => a - b)
        let bestGap = 0
        let bestMid = 0
        for (let i = 0; i < siblingAngles.length; i++) {
          const next = i + 1 < siblingAngles.length ? siblingAngles[i + 1] : siblingAngles[0] + Math.PI * 2
          const gap = next - siblingAngles[i]
          if (gap > bestGap) {
            bestGap = gap
            bestMid = siblingAngles[i] + gap / 2
          }
        }
        angle = bestMid
      }

      x = parent.x + Math.cos(angle) * AGENT_SPAWN_DISTANCE
      y = parent.y + Math.sin(angle) * AGENT_SPAWN_DISTANCE
    }
  }

  const agent: Agent = {
    id: name, name, state: 'idle',
    parentId: parentId || null,
    tokensUsed: 0, tokensMax: ctx.getContextWindowSize(model),
    contextBreakdown: emptyContextBreakdown(),
    toolCalls: 0, timeAlive: 0,
    x, y, vx: 0, vy: 0,
    pinned: false, isMain,
    ...(runtime ? { runtime } : {}),
    task,
    spawnTime: currentTime,
    opacity: 0, scale: 0.3,
    messageBubbles: [],
  }
  state.agents.set(name, agent)

  if (parentId) {
    state.edges.push({ id: edgeId(parentId, name), from: parentId, to: name, type: 'parent-child', opacity: 0 })
  }

  const timelineEntry: TimelineEntry = {
    id: `timeline-${name}`,
    agentId: name,
    agentName: name,
    startTime: currentTime,
    blocks: [],
  }
  pushTimelineBlock(timelineEntry, currentTime, { type: 'idle', label: 'Starting', color: COLORS.idle }, ctx)
  state.timelineEntries.set(name, timelineEntry)

  state.conversations.set(name, [])

  if (!ctx.skipForceSync) {
    setTimeout(() => ctx.syncForceSimulation(state.agents, state.edges), 0)
  }
}

export function handleAgentComplete(
  payload: Record<string, unknown>,
  currentTime: number,
  state: MutableEventState,
  ctx: ProcessEventContext,
): void {
  const name = asString(payload.name)
  const agent = state.agents.get(name)
  if (agent && agent.state !== 'complete') {
    // [red-team #7] Clear pause fields so pause_cleared arriving after agent_complete
    // doesn't leave a ghost amber node via the toolUseId guard.
    state.agents.set(name, {
      ...agent,
      state: 'complete',
      completeTime: currentTime,
      pauseReason: null,
      pauseToolUseId: undefined,
      pauseDetail: undefined,
      pauseStartedAt: undefined,
    })

    const entry = state.timelineEntries.get(name)
    if (entry) {
      pushTimelineBlock(entry, currentTime, { type: 'complete', label: 'Done', color: COLORS.complete, endTime: currentTime }, ctx)
      entry.endTime = currentTime
    }

    const agentsToComplete = [name]
    for (const [childId, childAgent] of state.agents) {
      if (childAgent.parentId === name && childAgent.state !== 'complete') {
        // [red-team #7] Cascade: clear pause fields on child agents too
        state.agents.set(childId, {
          ...childAgent,
          state: 'complete',
          completeTime: currentTime,
          pauseReason: null,
          pauseToolUseId: undefined,
          pauseDetail: undefined,
          pauseStartedAt: undefined,
        })
        agentsToComplete.push(childId)
        const childEntry = state.timelineEntries.get(childId)
        if (childEntry) {
          pushTimelineBlock(childEntry, currentTime, { type: 'complete', label: 'Done', color: COLORS.complete, endTime: currentTime }, ctx)
          childEntry.endTime = currentTime
        }
      }
    }

    for (const [tcId, tc] of state.toolCalls) {
      if (agentsToComplete.includes(tc.agentId) && tc.state === 'running') {
        state.toolCalls.set(tcId, { ...tc, state: 'complete', completeTime: currentTime })
      }
    }
  }
}

export function handlePermissionRequested(
  payload: Record<string, unknown>,
  currentTime: number,
  state: MutableEventState,
  ctx: ProcessEventContext,
): void {
  const agentName = asString(payload.agent, 'Orchestrator')
  const agent = state.agents.get(agentName)
  if (agent && agent.state !== 'complete') {
    state.agents.set(agentName, {
      ...agent,
      state: 'waiting_permission',
    })

    const entry = state.timelineEntries.get(agentName)
    if (entry) {
      pushTimelineBlock(entry, currentTime, { type: 'idle', label: 'Permission', color: COLORS.waiting_permission }, ctx)
    }
  }
}

export function handleAgentIdle(
  payload: Record<string, unknown>,
  state: MutableEventState,
): void {
  const idleName = asString(payload.name)
  const idleAgent = state.agents.get(idleName)
  if (idleAgent && (idleAgent.state === 'tool_calling' || idleAgent.state === 'waiting_permission')) {
    state.agents.set(idleName, { ...idleAgent, state: 'thinking', currentTool: undefined })
  }
}

export function handleModelDetected(
  payload: Record<string, unknown>,
  state: MutableEventState,
  ctx: ProcessEventContext,
): void {
  const agentName = asString(payload.agent)
  const model = asString(payload.model)
  const agent = state.agents.get(agentName)
  if (agent) {
    state.agents.set(agentName, {
      ...agent,
      tokensMax: ctx.getContextWindowSize(model),
    })
  }
}

// ── Typed pause event handlers (phase-03) ────────────────────────────────────
// [red-team #14] handlePermissionRequested above is RETAINED and UNCHANGED.
// handlePauseStarted fires in parallel for typed pause_started events.
// Both push timeline blocks independently.

export function handlePauseStarted(
  payload: Record<string, unknown>,
  currentTime: number,
  state: MutableEventState,
  ctx: ProcessEventContext,
): void {
  const agentName = asString(payload.agent, 'Orchestrator')
  const reason    = asString(payload.reason, 'permission_request') as PauseReason
  const toolUseId = typeof payload.toolUseId === 'string' ? payload.toolUseId : undefined
  const detail    = (payload.detail ?? undefined) as PauseDetail | undefined

  const agent = state.agents.get(agentName)
  if (!agent || agent.state === 'complete') return

  state.agents.set(agentName, {
    ...agent,
    state: 'paused',
    pauseReason:    reason,
    pauseToolUseId: toolUseId,
    pauseDetail:    detail,
    pauseStartedAt: Date.now(),
  })

  // [red-team #14] Preserve timeline block side-effect (same as handlePermissionRequested)
  const entry = state.timelineEntries.get(agentName)
  if (entry) {
    pushTimelineBlock(entry, currentTime, { type: 'idle', label: pauseLabel(reason), color: COLORS.paused }, ctx)
  }
}

export function handlePauseCleared(
  payload: Record<string, unknown>,
  state: MutableEventState,
): void {
  const agentName = asString(payload.agent, 'Orchestrator')
  const reason    = asString(payload.reason, 'permission_request') as PauseReason
  const toolUseId = typeof payload.toolUseId === 'string' ? payload.toolUseId : undefined

  const agent = state.agents.get(agentName)
  if (!agent) return

  // [red-team #18] For heuristic permission_request, server omits toolUseId.
  // Match by (agent, reason) instead of toolUseId for this specific reason.
  const matches = reason === 'permission_request'
    ? agent.pauseReason === 'permission_request'
    : agent.pauseToolUseId === toolUseId

  if (!matches) return

  state.agents.set(agentName, {
    ...agent,
    state: 'thinking',
    pauseReason:    null,
    pauseToolUseId: undefined,
    pauseDetail:    undefined,
    pauseStartedAt: undefined,
  })
}
