# Code Review — Phase 8+9 Quality Audit

**Scope:** context-tracker.ts, subagent-watcher.ts, permission-detection.ts, orch-enricher.ts (new sections), session-watcher.ts (SubagentWatcher integration), state-engine.ts (fileAttention)
**Focus:** Dead code, stringly-typed fields, silent failures, copy-paste, redundant state

---

## Findings (6)

### 1. CRITICAL — `pendingToolCalls` never populated in SubagentWatcher

**File:** `src/subagent-watcher.ts:25,114,140`

`SubagentState.pendingToolCalls` is initialized as an empty Map (line 114) and passed to `handlePermissionDetection` (line 140), but **nothing ever calls `.set()` on it**. The TranscriptParser tracks its own `pendingToolCalls` internally (transcript-parser.ts:48) but that Map is private and separate.

**Impact:** Permission detection for subagents is dead code — `handlePermissionDetection` always exits early at the `needsPermission` check (line 49 of permission-detection.ts) because the Map is perpetually empty. No `permission_requested` event will ever fire for subagents.

**Fix:** Either wire the parser's tool_use/tool_result tracking into the SubagentState's `pendingToolCalls`, or add a callback in the parser delegate for tool lifecycle events.

---

### 2. HIGH — `rebuild()` double-processes events

**File:** `scripts/lib/state-engine.ts:179-197`

`rebuild()` creates a fresh engine, replays all events into it via `fresh.processEvent()`, copies scalar state from the snapshot, then replays **all events again** into the current engine's sub-modules via `routeToSubmodules()`. This means `agentTracker`, `taskGraph`, and `planBinder` process every event twice.

**Impact:** After a rebuild, agent states will have doubled tool call counts, duplicated spawn records, and corrupted task graph state.

**Fix:** Either use the fresh engine's sub-module state directly (replace the current instance) or only call `routeToSubmodules` — not both.

---

### 3. MEDIUM — Copy-paste: token cost estimation duplicated 3 times

**Files:** `src/orch-enricher.ts:330-333`, `src/orch-enricher.ts:385-388`, `src/context-tracker.ts:40-42`

The `Math.ceil(str.length / 4)` heuristic appears in `extractToolContext`, `extractFileAttention`, and `estimateTokens()`. The dedicated function `estimateTokens` in context-tracker.ts exists for exactly this purpose but is not used by the enricher.

**Fix:** Replace inline calculations in orch-enricher.ts with `estimateTokens()` from context-tracker.ts.

---

### 4. MEDIUM — Dead export: `addUserMessageTokens` never called

**File:** `src/context-tracker.ts:54`

`addUserMessageTokens` is exported but never imported or called anywhere in the codebase. The enricher handles `Message` events (orch-enricher.ts:199) but calls `addReasoningTokens` for them, not `addUserMessageTokens`.

**Impact:** The `userMessages` field in `ContextBreakdown` is always 0 (after initial creation), making it misleading in any dashboard that displays it.

**Fix:** Either call `addUserMessageTokens` for actual user messages (distinct from reasoning), or remove the dead field and function to avoid confusion.

---

### 5. MEDIUM — Stringly-typed event routing in session-watcher subagent delegate

**File:** `src/session-watcher.ts:213,221-225`

The subagent delegate constructs `HookPayload` objects with raw string literals for `hook_event_name`:
```ts
hook_event_name: 'SubagentStart'  // line 213
hook_event_name: String(payload.type ?? 'Message')  // line 224
```

Line 224 is especially brittle — it trusts arbitrary `payload.type` values from parsed JSONL as valid hook event names. If a subagent emits an unexpected type, it flows through enrichment unchecked and could produce events with nonsensical `eventType` values.

**Fix:** Validate `payload.type` against a known set of event names; default to `'Message'` only for recognized types, log a warning for unrecognized ones.

---

### 6. LOW — `fileAttention` accumulation unbounded, no eviction

**File:** `scripts/lib/state-engine.ts:59-70`

`fileAttentionMap` grows without bound — every unique file path seen across all events is retained with cumulative token costs. For long sessions touching many files, this map grows linearly and is included in every snapshot via `getSnapshot()`.

**Impact:** Memory pressure in long-running sessions; snapshot payloads grow increasingly large over SSE.

**Fix:** Consider a cap (e.g., top-N by tokenCost) or LRU eviction, or at minimum exclude low-cost entries from the snapshot.

---

## Positive Observations

- Clean separation: context-tracker uses plain objects (no Maps), fully JSON-serializable
- Permission detection properly uses snapshot-time comparison to avoid false positives from newly-added tool calls
- Cross-source deduplication in enricher (seenToolUseIds with dedupKey combining hook name + tool_use_id) is well-designed
- Per-session parser cleanup in session-watcher prevents unbounded memory from seenUuids

---

**Status:** DONE
**Summary:** 6 findings: 1 critical (dead permission detection for subagents), 1 high (rebuild double-processing corrupts state), 3 medium, 1 low.
**Concerns:** Finding #2 (rebuild) will corrupt state on any reconnect/replay scenario — recommend fixing before shipping.
