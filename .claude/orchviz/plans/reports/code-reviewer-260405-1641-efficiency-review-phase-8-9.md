# Efficiency Review — Phase 8+9 Changes

**Scope:** subagent-watcher.ts, permission-detection.ts, orch-enricher.ts, session-watcher.ts, state-engine.ts
**Focus:** Memory leaks, timer leaks, fs.watch leaks, unbounded accumulation

---

## Findings (4 Critical, 2 Medium)

### 1. CRITICAL — `seenToolUseIds` grows without bound across sessions

**File:** `src/orch-enricher.ts:61,84,100-103`

`EnricherState.seenToolUseIds` is a `Map<string, Set<string>>` keyed by sessionId. Sets accumulate dedup keys (`hookName:toolUseId`) for every tool call but are **never cleaned up** — not on session end, not on session timeout, not anywhere.

For a long-running OrchViz server watching multiple sessions, this Map grows monotonically. Each session's Set can hold thousands of entries.

**Fix:** On `SessionEnd`/`Stop` events or when `SessionWatcher.cleanupSession()` fires, call `state.seenToolUseIds.delete(sessionId)`. Alternatively, add an eviction policy (e.g., drop sessions older than 10 minutes).

---

### 2. CRITICAL — `fileAttentionMap` in state-engine grows without bound

**File:** `scripts/lib/state-engine.ts:48,59-69`

`fileAttentionMap` is a plain object keyed by file path. Every file-touching tool call adds or updates an entry. It is **never pruned** — not on session end, not in `rebuild()`.

In a session with heavy file operations (grep, glob, read across a large codebase), this object can accumulate hundreds of entries, each carrying an `agents[]` array. The `getSnapshot()` method serializes the entire object on every call.

**Fix:** Cap entries (e.g., keep top-N by tokenCost) or reset on session boundaries.

---

### 3. CRITICAL — `contextBreakdowns` Map never cleaned up

**File:** `src/orch-enricher.ts:59,183-184`

`EnricherState.contextBreakdowns` is `Map<string, ContextBreakdown>` keyed by agent name. Entries are created on first event per agent but **never removed**. Token counters (`toolResults`, `reasoning`, `subagentResults`) accumulate monotonically — values only increase.

For orchestration sessions spawning many subagents (10+), this Map grows proportionally. Unlike `seenToolUseIds`, agent names are at least bounded by the number of unique agents, but accumulated token numbers can overflow in very long sessions.

**Fix:** Clear entries for agents that have completed (`SubagentStop`), or at minimum reset when the session ends.

---

### 4. CRITICAL — `rebuild()` double-processes events

**File:** `scripts/lib/state-engine.ts:179-197`

`rebuild()` creates a *fresh* StateEngine, replays all events into it, copies scalar state — then replays all events *again* via `routeToSubmodules()` into the current engine's sub-modules. This means every agent spawn, tool call, and task mutation is processed **twice** into `agentTracker`, `taskGraph`, and `planBinder`.

Result: duplicate agent states, doubled tool call counts, and incorrect task graphs after any rebuild.

**Fix:** Either copy sub-module state from the fresh engine, or replay into the current sub-modules directly (not both).

---

### 5. MEDIUM — Sync `fs.readFileSync` in `resolveAgent()` hot path

**File:** `src/orch-enricher.ts:229-230`

Every `SubagentStart`/`SubagentStop` event triggers a synchronous `fs.readFileSync` of the `.meta.json` sidecar inside `resolveAgent()`. This runs on the Node event loop and blocks during file I/O.

Same pattern exists in `subagent-watcher.ts:38-39` (`resolveNameFromMeta`), but that is called once per subagent discovery — acceptable. The enricher path is called on every SubagentStart/Stop event, including replays.

**Impact:** Low in typical use (few subagent events), but blocks the event loop during `rebuild()` with many events.

**Fix:** Cache meta.json results by file path in `EnricherState`, or read once in SubagentWatcher and pass the resolved name through the payload.

---

### 6. MEDIUM — `parsers` Map in SessionWatcher only cleaned on explicit cleanup

**File:** `src/session-watcher.ts:56,74-80,282`

Per-session `TranscriptParser` instances (each carrying a `seenUuids` Set and `pendingToolCalls` Map) are stored in `this.parsers`. They are deleted in `cleanupSession()` (line 282) — good. However, `cleanupSession()` is only called from `stop()` (line 107-110), not from the inactivity timeout handler (line 265-269).

When a session times out via inactivity, `session.completed = true` is set but `cleanupSession()` is never called. The parser, its FSWatcher, poll timer, and subagent watcher all remain alive and leaking.

**Fix:** Call `cleanupSession(session)` inside the inactivity timeout handler, or at minimum clean up the parser and stop the subagent watcher.

---

## Summary

| # | Severity | Issue | Location |
|---|----------|-------|----------|
| 1 | CRITICAL | `seenToolUseIds` unbounded growth | orch-enricher.ts:61 |
| 2 | CRITICAL | `fileAttentionMap` unbounded growth | state-engine.ts:48 |
| 3 | CRITICAL | `contextBreakdowns` never cleaned | orch-enricher.ts:59 |
| 4 | CRITICAL | `rebuild()` double-processes events | state-engine.ts:179 |
| 5 | MEDIUM | Sync I/O in enricher hot path | orch-enricher.ts:229 |
| 6 | MEDIUM | Inactivity timeout skips cleanup — leaks watchers/timers/parsers | session-watcher.ts:265 |

**Status:** DONE
**Summary:** Found 4 critical and 2 medium efficiency issues. Main themes: unbounded Map/object accumulation without cleanup on session boundaries, a double-replay bug in rebuild(), and leaked resources on inactivity timeout.
**Concerns:** Finding #4 (rebuild double-process) is a correctness bug, not just efficiency — it will produce wrong state after any rebuild.
