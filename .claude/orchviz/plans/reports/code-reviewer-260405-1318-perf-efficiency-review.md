# Efficiency Review — OrchViz Web Frontend

**Scope:** 12 files across hooks/, canvas/, node-graph-canvas.tsx
**Focus:** Hot-path allocations, O(n^2) guards, canvas state, memory leaks, unnecessary re-renders

## Overall Assessment

Well-architected dual-state pattern (mutable orchRef for 60fps, throttled React commits). Glow sprite cache is a smart optimization. Three independent rAF loops (simulation, force layout, canvas render) is intentional and clean. The main issues are per-frame allocations and a dot-grid that scales poorly on large/HiDPI canvases.

## Findings (ranked by impact)

### 1. CRITICAL — Per-frame `Object.values()` allocation x3

**Files:**
- `use-force-layout.ts:32` — `Object.values(sim.agents).filter(...)`
- `use-orch-simulation.ts:54` — `Object.values(sim.agents)`
- `node-graph-canvas.tsx:83` — `Object.values(sim.agents)`

**Issue:** `Object.values()` allocates a new array every call. With 3 rAF loops at 60fps, that is 180 array allocations/sec. The force layout adds a `.filter()` on top (360 alloc/sec combined for that path). These are the hottest lines in the codebase.

**Fix:** Pre-allocate a reusable array outside the rAF, populate it in-place each frame:
```ts
const _nodesBuf: AgentNode[] = [];
function tick() {
  _nodesBuf.length = 0;
  for (const id in sim.agents) {
    const a = sim.agents[id];
    if (a.opacity > 0.01) _nodesBuf.push(a);
  }
  // use _nodesBuf instead of Object.values().filter()
}
```

### 2. HIGH — `Float64Array` allocated per frame in force layout

**File:** `use-force-layout.ts:52-53`

**Issue:** `new Float64Array(count)` x2 every frame. Typed array allocation is heavier than regular arrays due to zeroing. At 60fps with 20 agents, this is 120 typed-array allocations/sec.

**Fix:** Hoist `fx`/`fy` outside the rAF loop. Resize only when `count` changes:
```ts
let fx = new Float64Array(0);
let fy = new Float64Array(0);
function tick() {
  if (fx.length < count) { fx = new Float64Array(count * 2); fy = new Float64Array(count * 2); }
  fx.fill(0, 0, count);
  fy.fill(0, 0, count);
}
```

### 3. HIGH — Dot-grid background: O(cols*rows) fill calls, no guard

**File:** `draw-background.ts:35-43`

**Issue:** On a 2560x1440 HiDPI display at 2x, canvas is 5120x2880. With `dotSpacing=40`, that is 128x72 = 9,216 `arc()+fill()` calls per frame. Each `beginPath+arc+fill` is an expensive Canvas2D operation.

**Fix:** Pre-render the dot grid to an offscreen canvas (same pattern as `glow-sprites.ts`). Redraw only when canvas size or `breatheAlpha` bucket changes:
```ts
// Cache the dot grid at quantized alpha levels (e.g., 20 steps)
const alphaStep = Math.round(alpha * 20) / 20;
// Only re-render offscreen canvas when alphaStep changes
```

### 4. MEDIUM — `createRadialGradient` per particle per frame

**File:** `draw-particles.ts:90` — glow halo gradient

**Issue:** `createRadialGradient()` is called once per particle per frame. With 20 particles, that is 1,200 gradient objects/sec. Each gradient also calls `addColorStop` twice with string interpolation via `withAlpha()`.

**Fix:** Use the same offscreen-sprite caching pattern from `glow-sprites.ts` for particle glows. Key by `color + rounded radius`.

### 5. MEDIUM — `bezierPoint` called 2x + trail segments per particle

**File:** `draw-particles.ts:66-86`

**Issue:** Each particle evaluates `bezierPoint` for the main position (line 85), the perpendicular (line 66, which internally calls bezierPoint 2x), and each trail segment (line 72). With `trailSegments=6`, that is 2 + 2 + 7 = 11 bezier evaluations per particle per frame. For 20 particles: 220 evaluations/frame.

**Fix:** Cache the perpendicular computation — `bezierPerp` at line 66 computes the same value that could be derived from the main position + a small offset. Also, the result at `t` from line 85 duplicates one of the trail iterations. Reorder to compute main position first and reuse it as `s=0` trail point.

### 6. MEDIUM — Tapered edge draws 10 line segments per edge

**File:** `draw-edges.ts:77-91`

**Issue:** Each edge draws `BEAM.segments=10` individual line segments with `beginPath+moveTo+lineTo+stroke` each. With 20 edges, that is 200 stroke calls/frame plus repeated `strokeStyle` and `lineWidth` assignments inside the loop (lines 88-89) that are identical for all segments of one edge.

**Fix:** Move `ctx.strokeStyle` and `ctx.lineWidth` assignments before the segment loop. Also consider reducing segments to 5-6 — taper is barely perceptible at high segment counts.

### 7. MEDIUM — `structuredClone` on agents+tasks every 100ms

**File:** `use-orch-simulation.ts:76-77`

**Issue:** `structuredClone(sim.agents)` deep-clones all agent objects including `messageBubbles` arrays. With 20 agents each having up to `maxBubblesPerAgent` bubbles, this is a non-trivial clone operation 10x/sec. The cloned state is only consumed by React components (sidebar, status bar), not the canvas.

**Fix:** Only clone when data actually changed. Add a dirty flag set by `processEvent`:
```ts
if (sim._dirty && now - lastCommitRef.current >= ANIM.uiThrottleMs) {
  sim._dirty = false;
  // ... setState
}
```

### 8. LOW — `canvas.getContext('2d')` called every frame

**File:** `node-graph-canvas.tsx:77`

**Issue:** `canvas.getContext('2d')` is called inside the render loop. Browsers cache this (returns same object), but it is still a hash lookup on every frame. Trivial to hoist.

**Fix:** Get context once in the useEffect setup, before the rAF loop starts.

### 9. LOW — Glow sprite cache unbounded

**File:** `glow-sprites.ts:10`

**Issue:** `_cache` is a module-level `Map` that grows without bound. Key is `color:radius` where radius is `Math.round(glowR)`. As nodes breathe (radius oscillates), new sizes are created. With 20 agents breathing between radius 28-32, that is ~100 cached canvases. Not catastrophic, but could grow over long sessions.

**Fix:** Add an LRU cap or limit cache entries to ~64. Alternatively, quantize radius to nearest even number to reduce cache pressure.

### 10. LOW — `drawCostLabels` ignores camera transform

**File:** `node-graph-canvas.tsx:105` + `draw-cost.ts:29`

**Issue:** `drawCostLabels` is drawn in screen-space (after `ctx.restore()` removes camera transform) but reads `agent.x/y` which are world-space coordinates. Comment says "uses agent world pos internally" but the code uses raw `agent.x/y` without applying `transformRef`. Cost pills will render at wrong positions when panning/zooming.

**Fix:** Either draw cost labels inside the camera transform block (before `ctx.restore()`) or manually apply the transform to agent positions in `drawCostLabels`.

## Positive Observations

- **Dual-state ref pattern** (orchRef for canvas, throttled setState for React) is textbook correct for avoiding React re-render overhead
- **Reference-swap drain** in SSE bridge (line 108-111) is lock-free and O(1)
- **Glow sprite caching** avoids expensive gradient creation per frame
- **Dedup by seq** in SSE bridge prevents duplicate event processing on reconnect
- **Exponential backoff** with cap on SSE reconnect is production-ready
- **save/restore balance** is correct across all draw functions — no leaks found

## Unresolved Questions

1. Are three independent rAF loops (simulation tick, force layout, canvas render) intentional? They run at independent rates and could drift. A single rAF driving all three would ensure consistent frame timing and eliminate 2/3 of the `Object.values` allocations.
2. What is the expected max agent count? The O(n^2) repulsion has a scale factor but no hard cap. At 100 agents, repulsion alone is 5,000 pair calculations per frame.
