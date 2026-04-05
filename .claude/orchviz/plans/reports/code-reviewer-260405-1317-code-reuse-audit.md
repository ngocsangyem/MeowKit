# Code Reuse Audit — OrchViz src/ vs web/

**Date:** 2026-04-05
**Scope:** src/ (backend) vs web/ (frontend) type/constant/logic duplication

---

## Findings (7 items, ranked by severity)

### 1. CRITICAL — Duplicate `OrchEvent` type definition

- **src/protocol.ts:57-80** — Full `OrchEvent` with 11 fields (seq, timestamp, sessionId, eventType, redactedPayload, agent, workflowStep, planContext, taskContext, toolContext, statusProtocol)
- **web/hooks/simulation/types.ts:31-43** — Slimmed-down `OrchEvent` with 7 fields, different shapes: `agent` is `{ name, tier }` vs `AgentInfo`, `toolContext` is a 3-field subset, adds `messageContext` and `taskContext` with different field names (`id` vs `taskId`)

**Impact:** Any schema change in src/ silently drifts from web/. The `taskContext` fields don't match (`id` vs `taskId`, different `status` values). This WILL cause runtime bugs when SSE sends one shape and frontend expects another.

**Fix:** Create `shared/orch-event.ts` with the canonical type. web/ imports and extends with display-only fields. Or: web/ uses `Pick<>` / mapped type from src/ protocol.

---

### 2. HIGH — Duplicate `TASK_TOOL_NAMES` constant

- **src/constants.ts:36** — `['TaskCreate', 'TaskUpdate', 'TaskGet', 'TaskList']`
- **web/hooks/simulation/process-event.ts:15-18** — `Set(['TaskCreate', 'TaskUpdate', 'mcp__*__TaskCreate', 'mcp__*__TaskUpdate'])` (subset + MCP variants)

**Impact:** web/ adds MCP-prefixed tool names that src/ ignores. If a new task tool is added, must update two places. The src/ list has `TaskGet`/`TaskList` which web/ omits entirely.

**Fix:** Share base list from a shared constants file; web/ extends with MCP variants.

---

### 3. HIGH — Duplicate `maxEventBuffer` constant

- **src/constants.ts:19** — `MAX_EVENT_BUFFER = 5000`
- **web/lib/canvas-constants.ts:172** — `PERF.maxEventBuffer: 5000`

**Impact:** If ring buffer size changes on backend but not frontend (or vice versa), catch-up/reconnect logic breaks silently.

**Fix:** Single source of truth in shared constants.

---

### 4. MEDIUM — Duplicate agent tier classification knowledge

- **src/orch-model.ts:17-43** — `AgentTier` type, `AGENT_TIERS` map, `classifyTier()` function with suffix-stripping normalization
- **web/lib/colors.ts:48-56** — `tierColor()` hardcodes same 4 tier names (orchestrator/executor/validator/support)
- **web/hooks/simulation/handle-agent.ts:14,17,25** — Hardcodes tier string checks: `'orchestrator'`, `'support'`
- **web/components/orch-visualizer/canvas/draw-nodes.ts:26-29** — Hardcodes tier icon map

**Impact:** If a 5th tier is added to src/orch-model.ts, all 3 web/ files silently fall through to defaults. Not catastrophic but tech debt.

**Fix:** Export tier list from shared module; web/ derives color/icon maps from it.

---

### 5. MEDIUM — Duplicate `TaskContext`/`TaskNode` type

- **src/protocol.ts:37-43** — `TaskContext { taskId, subject, owner, status, blockedBy }`
- **web/hooks/simulation/types.ts:45-51** — `TaskNode { id, subject, status, owner, blockedBy }` — note: `id` vs `taskId`, different `status` union

**Impact:** Mapping between these two requires manual field renaming. Any field addition to one must be manually mirrored.

**Fix:** Share base type; web/ aliases `id = taskId`.

---

### 6. MEDIUM — Duplicate `PlanState`/`PlanPhaseCache` shape

- **src/orch-enricher.ts:49-56** — `PlanPhaseCache { planId, phases: [{ id, title, status }] }`
- **web/hooks/simulation/types.ts:53-56** — `PlanState { phases: [{ id, title, status }], overallProgress }`

**Impact:** Phase shape is identical. Minor duplication; `overallProgress` is web-only which is fine.

**Fix:** Low priority. Share the `{ id, title, status }` phase item type.

---

### 7. LOW — No duplicate `hexToRgba` in src/

Confirmed: `hexToRgba` and `withAlpha` exist only in `web/lib/colors.ts`. No color utilities in src/. No duplication.

---

## Within-web/ Analysis

### Canvas Drawing — No hex path duplication found

The hexagon path function exists only in `web/components/orch-visualizer/canvas/draw-nodes.ts:13`. Other canvas files import from `@/lib/colors` consistently. No duplicated drawing primitives across the 10 canvas files.

### Hook state management — No duplication found

Each simulation handler (handle-agent, handle-task, handle-tool-call) manages distinct state slices. `pushEvent()` is defined once in types.ts and imported by process-event.ts. Clean separation.

---

## Recommended Consolidation Plan

| Priority | Action | Files affected |
|----------|--------|----------------|
| P0 | Create `shared/` dir with `OrchEvent`, `TaskContext` canonical types | src/protocol.ts, web/hooks/simulation/types.ts |
| P0 | Unify `TASK_TOOL_NAMES` into shared constants | src/constants.ts, web/hooks/simulation/process-event.ts |
| P1 | Share `MAX_EVENT_BUFFER` | src/constants.ts, web/lib/canvas-constants.ts |
| P1 | Export `AgentTier` union from shared module | src/orch-model.ts, web/lib/colors.ts, web/hooks/simulation/handle-agent.ts |
| P2 | Share plan phase item type | src/orch-enricher.ts, web/hooks/simulation/types.ts |

---

**Status:** DONE
**Summary:** Found 6 real duplication issues (2 critical/high, 3 medium, 1 low). No duplication within web/ canvas or hooks. Key risk: `OrchEvent` type drift between src/ and web/ will cause silent SSE deserialization bugs.
**Concerns:** The `taskContext` field name mismatch (`taskId` vs `id`) may already be causing bugs if task events are flowing end-to-end.
