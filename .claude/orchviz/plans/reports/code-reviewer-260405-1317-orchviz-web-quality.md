# OrchViz Web Frontend — Code Quality Review

**Reviewer:** code-reviewer
**Date:** 2026-04-05
**Scope:** 33 source files in `web/` (hooks, canvas, components, lib)

## Top 10 Findings

### 1. CRITICAL — `drawEffects` return value ignored; effects never cleaned up by canvas

**File:** `draw-effects.ts:19-39` returns `boolean[]` liveness flags.
**File:** `node-graph-canvas.tsx:100` calls `drawEffects(ctx, sim.effects, time)` — return value discarded.

Effects are cleaned in `use-orch-simulation.ts:49-51` using `Date.now() - e.startTime < e.duration`, but `VisualEffect.startTime` is set as epoch-ms (`Date.now()`) while `drawEffects` computes `age = time - fx.startTime` where `time = Date.now() / 1000` (seconds). **The age calculation mixes seconds and milliseconds**, so `progress = age / fx.duration` will be a huge number, and effects will flash for one frame then disappear (or never render).

`VisualEffect.duration` is set in ms (800, 1000) in `handle-agent.ts:42,79` but `drawEffects` divides by it as if it were seconds.

**Fix:** Normalize units. Either pass `Date.now()` as `time` to `drawEffects` and treat duration as ms, or convert `startTime`/`duration` to seconds at creation. The simplest fix:
```ts
// draw-effects.ts
const age = (Date.now() - fx.startTime) / 1000;
const progress = age / (fx.duration / 1000);
```

---

### 2. HIGH — Duplicate `hexToRgba` / `withAlpha` in `colors.ts`

**File:** `colors.ts:59-69`

`hexToRgba(hex, alpha)` and `withAlpha(hex, alpha)` are identical functions. `withAlpha` just calls `hexToRgba`. Both are exported. Codebase uses both — `draw-nodes.ts` uses `withAlpha`, nothing uses `hexToRgba` directly.

**Fix:** Remove `hexToRgba` export, keep only `withAlpha`. Or alias one to the other and deprecate.

---

### 3. HIGH — Stringly-typed `currentPhase` and `tier` with no validation

**File:** `types.ts:18` — `currentPhase: string`
**File:** `orch-types.ts:10` — `tier: string`

Phases are checked via `===` in `workflow-sidebar.tsx:28` against the `PHASES` array. Tiers are checked in `tierColor()` and `TIER_ICONS`. But incoming SSE events can set arbitrary strings with no validation — a typo like `"orchetsrator"` silently maps to `COLORS.muted` and the default `'●'` icon, with no warning.

**Fix:** Define union types: `type AgentTier = 'orchestrator' | 'executor' | 'validator' | 'support'` and `type WorkflowPhase = 'orient' | 'plan' | 'test-red' | 'build' | 'review' | 'ship' | 'reflect' | 'unknown'`. Validate at the SSE boundary (`pushDeduped`).

---

### 4. HIGH — `drawCostLabels` drawn in screen-space but uses world-space coordinates

**File:** `node-graph-canvas.tsx:105` — `drawCostLabels(ctx, agents)` is called **after** `ctx.restore()` (camera transform popped). But `draw-cost.ts:41` uses `agent.x` and `agent.y` directly — these are world-space coordinates.

Cost pills will render at wrong positions unless the camera transform happens to be identity (offset 0, scale 1). As soon as the user pans or zooms, cost labels detach from their nodes.

**Fix:** Either move `drawCostLabels` inside the `ctx.save()/restore()` block (before line 102), or apply the camera transform manually inside `drawCostLabels`.

---

### 5. MEDIUM — Redundant elapsed-time computation in both `TopBar` and `ControlBar`

**File:** `top-bar.tsx:25-27` and `control-bar.tsx:39-41` — identical `mm:ss` calculation from `state.startTime`.

**Fix:** Extract to a shared utility or compute once in the parent and pass as prop. Minor but violates DRY.

---

### 6. MEDIUM — `controlPoints` in `draw-edges.ts` duplicated inline in `draw-particles.ts`

**File:** `draw-edges.ts:27-39` — `controlPoints()` function.
**File:** `draw-particles.ts:50-57` — same control-point math copy-pasted with hardcoded `0.15` instead of `BEAM.curvature`.

If `BEAM.curvature` changes, particles will follow a different curve than the edges they're drawn on.

**Fix:** Import and reuse `controlPoints` from `draw-edges.ts` in `draw-particles.ts`.

---

### 7. MEDIUM — `handleZoom` only triggers when `ctrlKey` is held

**File:** `use-canvas-camera.ts:74` — `if (!e.ctrlKey) return;`

Standard canvas zoom behavior is wheel-only (no modifier). Requiring ctrl+wheel is unexpected and undiscoverable. The keyboard hints in the UI (`F=fit`) don't mention ctrl+wheel for zoom.

**Fix:** Either remove the `ctrlKey` guard or document it in the UI hints.

---

### 8. MEDIUM — Unbounded `toolCalls` array growth

**File:** `handle-tool-call.ts:47` — `state.toolCalls.push(toolCall)` with no eviction.

`events` has a ring buffer cap (`PERF.maxEventBuffer`). `agents` are bounded by spawn events. But `toolCalls` grows without limit. In a long session with hundreds of tool calls, this array becomes a memory leak and a linear-scan bottleneck in `findLast` (line 65) and `drawToolCalls`.

**Fix:** Add a max cap (e.g., evict completed tool calls older than `ANIM.toolMaxOrphanS` in the tick loop, similar to effects cleanup).

---

### 9. LOW — `findToolAt` hardcodes magic numbers instead of importing constants

**File:** `hit-testing.ts:43-44` — `const W = 170; const H = 32;` with comment "to avoid circular dep."

These duplicate `TOOL_CARD.maxWidth` and `TOOL_CARD.expandedHeight`. If those constants change, hit-testing breaks silently.

**Fix:** Import from `canvas-constants.ts` — there is no circular dependency since `hit-testing.ts` doesn't import from `draw-tool-calls.ts`.

---

### 10. LOW — `drawBackground` creates `beginPath/arc/fill` per dot instead of batching

**File:** `draw-background.ts:38-42` — nested loop calls `beginPath/arc/fill` for every grid dot.

For a 1920x1080 canvas with 40px spacing, that's ~1300 draw calls per frame. Could batch into a single path.

**Fix:**
```ts
ctx.beginPath();
for (let r = 0; r < rows; r++) {
  for (let c = 0; c < cols; c++) {
    ctx.moveTo(c * BG.dotSpacing + BG.dotRadius, r * BG.dotSpacing);
    ctx.arc(c * BG.dotSpacing, r * BG.dotSpacing, BG.dotRadius, 0, Math.PI * 2);
  }
}
ctx.fill();
```

---

## Summary

| Severity | Count | Key themes |
|----------|-------|------------|
| Critical | 1 | Unit mismatch (ms vs s) in visual effects — effects likely broken |
| High | 3 | Cost labels wrong after pan/zoom; stringly-typed enums; dead code |
| Medium | 4 | Copy-paste bezier math; unbounded array; DRY violations |
| Low | 2 | Magic numbers; perf micro-opt |

**Blocking:** Items 1 and 4 are production-visible bugs. Effects render incorrectly (or not at all) and cost labels detach from nodes on pan/zoom.

**Status:** DONE
**Summary:** Reviewed 33 files. Found 2 rendering bugs (ms/s mismatch in effects, screen-space cost labels), 1 unbounded memory growth, 1 copy-paste divergence risk, and several stringly-typed fields lacking validation.
**Concerns:** Items 1 and 4 should be fixed before shipping — they cause visible rendering errors.
