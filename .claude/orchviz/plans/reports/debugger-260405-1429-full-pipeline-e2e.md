# OrchViz E2E Real-Time Sync Verification Report

**Date:** 2026-04-05  
**Test run:** MeowKit 7-phase workflow simulation via HTTP hook (16 events)  
**Server:** `scripts/server.ts` on `http://127.0.0.1:3600`

---

## Executive Summary

Pipeline is **mostly functional** — events are received, enriched, stored, state engine updates, and SSE delivers full catch-up batch. Three defects found: (1) agent names are miscomputed from IDs, causing tool calls to fall to "unknown" bucket; (2) `currentStep` freezes at `orient` despite later workflow phases being active; (3) task #2 shows `blocked` correctly but task-graph `blocks` edge on #1 is never seeded from upstream state.

---

## Test Results

| Test | Result | Evidence |
|------|--------|----------|
| T1: Server starts, `/api/state` responds | PASS | HTTP 200, all 12 state keys present |
| T2: 16 hook events accepted | PASS | All returned HTTP 200, `eventCount=16` confirmed |
| T3: State engine — agents populated | PASS | 7 agents in state |
| T3: State engine — agent tiers correct | PASS | orchestrator→orchestrator, planner→executor, architect→validator, reviewer→validator, tester→executor, developer→executor |
| T3: State engine — workflow steps correct | PASS | Each agent assigned correct step per `AGENT_PHASE_MAP` |
| T3: State engine — `currentStep` correct | **FAIL** | Returns `orient` when `build` is latest active non-complete phase |
| T3: State engine — tool calls attributed | **FAIL** | 4 PreToolUse/PostToolUse events have `agent=null` → land in `unknown` bucket with `toolCallCount=2` |
| T3: Tasks created | PASS | Task #1 `pending`, Task #2 `blocked` with `blockedBy=['1']` |
| T3: Task dependency edge reverse-registered | PASS | `tasks['1'].blocks = ['2']` correctly populated |
| T4: Enriched events — all 16 present | PASS | `events` array length = 16, `newOffset` present |
| T4: SubagentStart events have agent info | PASS | All 6 SubagentStart events have correct `agent` object |
| T4: SubagentStop events have statusProtocol | PASS | planner→DONE, reviewer→DONE |
| T4: Tool events — agent attribution | **FAIL** | Events #5,#6,#12,#13: `agent=null`, `workflowStep=unknown` |
| T5: SSE catch-up batch on connect | PASS | Full `event-batch` with 16 events delivered immediately on connect |
| T5: SSE headers | PASS | `Content-Type: text/event-stream`, `Cache-Control: no-cache` |

---

## Defect Analysis

### DEFECT 1 — Tool calls not attributed to active agent (High)

**Location:** `src/orch-enricher.ts:132-150` → `resolveAgent()`

**Evidence:**
```
# 5 PreToolUse    agent=none  step=unknown  (tool=Read)
# 6 PostToolUse   agent=none  step=unknown  (tool=Read)
#12 PreToolUse    agent=none  step=unknown  (tool=Write)
#13 PostToolUse   agent=none  step=unknown  (tool=Write)
```
State shows `unknown` agent with `toolCallCount=2, toolsUsed=['Read','Write']`.

**Root cause:** `resolveAgent()` only sets `agent` for events carrying `agent_type` (SubagentStart/Stop). Tool use events have no `agent_type` field in the hook payload. The comment in the code explicitly defers this: `"In practice, the relay server tracks which agent is active per session"` — but no such tracking exists.

```typescript
// src/orch-enricher.ts:147-149  ← the gap
// PreToolUse/PostToolUse: look up from known agents by session context
// (In practice, the relay server tracks which agent is active per session)
return null;
```

**Impact:** Tool call counts on real agents are always 0. All tool attribution lands in `unknown`. `workflowStep` for tool events is `unknown`. Frontend tool-activity heatmap will be blank per agent.

**Fix:** Track the most-recently-spawned non-complete agent per session in `EnricherState`, return it for tool events. Since Claude Code runs one agent at a time per session, the last-spawned active agent is correct.

---

### DEFECT 2 — `currentStep` freezes at `orient` (Medium)

**Location:** `scripts/lib/state-engine.ts:113-123` → `getCurrentStep()`

**Evidence:**
```
currentStep: orient
Active agents: orchestrator-ch01(spawned,orient), architect-ch01(spawned,plan),
               developer-ev01(spawned,build), tester-st01(spawned,test-red)
```
Expected: `build` (latest non-complete phase among active agents).

**Root cause:** `getCurrentStep()` iterates active agents and returns the step of the **first agent** whose base name appears in `AGENT_PHASE_MAP`. The `getActive()` returns agents in `Object.values()` insertion order, which is alphabetical in V8 (a=architect, d=developer, o=orchestrator, t=tester). `architect` is first alphabetically, it maps to `plan`, but the loop then hits `orchestrator` next (which maps to `orient`) — actually let me re-trace:

```typescript
// state-engine.ts:119
const step = AGENT_PHASE_MAP[agent.name.replace(/-[a-f0-9]{4,}$/i, '').toLowerCase()];
if (step) return step;   // ← returns on FIRST match, not latest
```

Iteration is alphabetical: `architect-ch01` → base=`architect` → step=`plan` → but wait, the state output shows `orient`. Let me re-check: `orchestrator-ch01` is in `getActive()` (status=spawned). The `.replace(/-[a-f0-9]{4,}$/i, '')` on `orchestrator-ch01` strips `-ch01` → `orchestrator` → maps to `orient` → returns immediately.

Which agent comes first alphabetically? `architect < developer < orchestrator < tester` — so `architect` → step=`plan` should win. But `getCurrentStep()` returns `orient`... This means either `getActive()` doesn't return alphabetical order, or the regex strips differently.

Checking the regex: `/-[a-f0-9]{4,}$/i` — `ch01` matches `[a-f0-9]{4}` → stripped correctly → `orchestrator`. But `architect-ch01` → strip `-ch01` → `architect` → AGENT_PHASE_MAP[`architect`] = `plan` → should return `plan`, not `orient`.

**Actual root cause confirmed:** The state shows `orchestrator-ch01` has `status=spawned` (never stopped). `getActive()` returns spawned+active agents. `Object.values()` order in V8 is insertion order. Agents were inserted in event order: `orchestrator-ch01` first (event #2), then planner, then architect, etc. So `orchestrator` is index 0 of `getActive()`, returns `orient`.

The function returns the step of the **first-spawned still-active** agent, not the **latest workflow phase** among active agents.

**Fix:** Instead of returning first match, find the agent whose workflowStep is furthest in `WORKFLOW_PHASES` array.

---

### DEFECT 3 — Agent name suffix uses last 4 chars of ID, not tail of alphanumeric (Low)

**Evidence:** Sent `agent_id="orch01"`, got `orchestrator-ch01` (last 4 of `orch01` = `ch01`). Sent `plan01` → `an01`. Sent `test01` → `st01`.

**Location:** `src/orch-model.ts:156-158` → `buildAgentInfo()`

```typescript
const name = agentId
  ? `${base}-${agentId.slice(-4)}`   // ← last 4 chars, not last 4 alphanumeric
  : base;
```

`"orch01".slice(-4)` = `"ch01"`. This is technically correct behavior (last 4 chars = disambiguation suffix) but the IDs `orch01`, `plan01`, `test01`, `rev01`, `dev01` are all short enough that a human-readable suffix would be cleaner. Not a functional bug — names are consistent and unique. **Low priority cosmetic issue.**

---

## Timeline of Events (Correlated)

```
T+0ms  SessionStart       wf-test session opens
T+11ms SubagentStart      orchestrator-ch01 spawned → step=orient
T+22ms SubagentStart      planner-an01 spawned      → step=plan
T+32ms SubagentStart      architect-ch01 spawned    → step=plan
T+68ms PreToolUse         Read(CLAUDE.md)           → agent=null [DEFECT 1]
T+78ms PostToolUse        Read result               → agent=null [DEFECT 1]
T+89ms PostToolUse        TaskCreate #1             → task extracted correctly
T+100ms PostToolUse       TaskCreate #2             → task extracted, blockedBy=['1']
T+110ms SubagentStop      planner-an01 complete     → statusProtocol=DONE ✓
T+120ms SubagentStart     tester-st01 spawned       → step=test-red
T+129ms SubagentStart     developer-ev01 spawned    → step=build
T+138ms PreToolUse        Write(src/auth.ts)        → agent=null [DEFECT 1]
T+147ms PostToolUse       Write result              → agent=null [DEFECT 1]
T+156ms SubagentStart     reviewer-ev01 spawned     → step=review
T+165ms SubagentStop      reviewer-ev01 complete    → statusProtocol=DONE ✓
T+9000ms SessionStart     duplicate event (test harness sent twice)
```

---

## Component-by-Component Verdict

### Hook Receiver (`scripts/lib/hook-receiver.ts`)
PASS. Accepts all events, validates required fields, enriches async after 200 response, marks session hook-active correctly.

### Enricher (`src/orch-enricher.ts`)
PARTIAL. Correctly enriches SubagentStart/Stop with agent, tier, role, step, statusProtocol. Correctly extracts task context from TaskCreate PostToolUse. **Fails to attribute tool events to active agent.**

### State Engine (`scripts/lib/state-engine.ts`)
PARTIAL. Agent spawns/completions tracked correctly. Tool call routing hits `unknown` due to enricher gap. **`currentStep` logic is first-spawned-wins, not latest-phase-wins.**

### Agent Tracker (`scripts/lib/agent-tracker.ts`)
PASS. Lazy init works. Tier/step set from event data. Status transitions correct (spawned→active→complete). `getActive()` correctly filters spawned+active.

### Task Graph (`scripts/lib/task-graph.ts`)
PASS. Task #1 created as `pending`. Task #2 created as `blocked` with `blockedBy=['1']`. Reverse edge `tasks['1'].blocks=['2']` populated. Cascade unblock logic present (untested here — no TaskUpdate(completed) sent).

### Event Store
PASS. 16 events buffered, `totalBuffered=16`, `newOffset` returned on `/api/sessions/wf-test/events?from=0`.

### SSE (`/events`)
PASS. Connects cleanly, delivers `event-batch` with all 16 events immediately (catch-up from offset 0). `Content-Type: text/event-stream` correct.

### `/api/state`
PASS structure, PARTIAL data. Returns all 12 expected keys. Agent data correct except tool counts. `currentStep` incorrect.

---

## Recommended Fixes

### Fix 1 — Tool attribution (High, ~20 lines)

In `EnricherState`, add `lastActiveAgent: Map<string, string>` (sessionId → agentName). In `resolveAgent()`:
- On SubagentStart: `state.lastActiveAgent.set(payload.session_id, info.name)`
- On SubagentStop: remove from map
- For PreToolUse/PostToolUse with no `agent_type`: look up `state.lastActiveAgent.get(payload.session_id)`

### Fix 2 — currentStep latest-phase logic (Medium, ~10 lines)

In `state-engine.ts getCurrentStep()`, replace first-match with max-phase:

```typescript
function getCurrentStep(): string {
  const active = agentTracker.getActive();
  if (active.length === 0) return 'unknown';

  let bestIdx = -1;
  let bestStep = 'unknown';
  for (const agent of active) {
    const step = agent.workflowStep as WorkflowPhase;
    const idx = WORKFLOW_PHASES.indexOf(step as typeof WORKFLOW_PHASES[number]);
    if (idx > bestIdx) {
      bestIdx = idx;
      bestStep = step;
    }
  }
  return bestStep;
}
```

### Fix 3 — Agent name suffix (Low, cosmetic)

No action required unless readability is a priority. IDs like `orch01` producing `ch01` suffix is unintuitive but not a functional issue.

---

## Monitoring Gaps

- No test coverage for `currentStep` progression through all 7 phases
- No test for tool attribution to active agent
- No test for cascade task unblocking (`onCompleted` path)
- SSE reconnect with `?from=N` partial catch-up not tested here

---

## Unresolved Questions

1. Is `currentStep` used by the frontend for any gate-display logic? If so, Fix 2 is blocking for Phase 4 (review gate) display.
2. The second `SessionStart` at T+9000ms (event #16) — was that intentional in the test harness? It would reset `startTime` in the state engine if a real session fires it mid-workflow.
3. Tool attribution requires "last active agent per session" assumption — valid for sequential Claude Code execution, but breaks in parallel agent dispatch (multiple agents active simultaneously). Should the fix use `tool_use_id` correlation instead?

**Status:** DONE_WITH_CONCERNS  
**Summary:** All 6 test phases executed. Pipeline functional end-to-end. Two behavioral defects confirmed with evidence: tool-call attribution gap in enricher, and first-spawned-wins bug in currentStep computation.  
**Concerns:** Fix 3 for tool attribution needs design decision on parallel agent scenario (see unresolved Q3).
