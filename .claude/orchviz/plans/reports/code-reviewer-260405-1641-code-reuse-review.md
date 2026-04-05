# Code Reuse Review — Phase 8+9

## Scope
- 9 files reviewed (3 new, 6 modified)
- Focus: duplication, type overlap, shared patterns

## Findings (6 max)

### 1. CRITICAL — `Math.ceil(length / 4)` token heuristic duplicated 3x

**Locations:**
- `src/context-tracker.ts:41` — `estimateTokens()` function (canonical)
- `src/orch-enricher.ts:333` — inline in `extractToolContext()`
- `src/orch-enricher.ts:387` — inline in `extractFileAttention()`

**Problem:** `orch-enricher.ts` already imports from `context-tracker.ts` (line 36-41) but does NOT use `estimateTokens()` for its two inline calculations. If the heuristic changes (e.g., tiktoken integration), two of three sites get missed.

**Fix:** Replace both inline `Math.ceil(responseStr.length / 4)` in `orch-enricher.ts` with `estimateTokens(responseStr)` — already imported via `context-tracker.ts`.

---

### 2. HIGH — `pendingToolCalls` Map exists in both `transcript-parser.ts` and `subagent-watcher.ts` with different value types

- `transcript-parser.ts:48` — `Map<string, { name: string; args: string }>`
- `subagent-watcher.ts:25` — `Map<string, PendingToolCall>` where `PendingToolCall = { name: string; startTime: number }`

**Assessment:** These serve different purposes (parser tracks tool args for summarization; subagent-watcher tracks start time for permission detection). NOT true duplication — they are conceptually distinct maps with different lifecycles. The naming collision is misleading but the logic is correct.

**Verdict:** Informational only. Consider renaming subagent-watcher's map to `pendingPermissionCalls` for clarity, but not blocking.

---

### 3. HIGH — `subagent-watcher.ts` re-implements file-watching pattern from `session-watcher.ts`

Both classes share:
- `fs.watch()` + poll fallback pattern
- `readNewFileLines()` for tailing (shared via import -- good)
- `fileSize` tracking per watched file
- `scanDir()` discovery loop

**Assessment:** `readNewFileLines()` is properly shared (imported from `transcript-parser.ts`). The watch+poll pattern is similar but NOT identical — `SubagentWatcher` watches a subdirectory of a session while `SessionWatcher` watches the top-level project directory. The lifecycle and cleanup are different enough that extracting a base class would over-abstract.

**Verdict:** Acceptable. The shared utility (`readNewFileLines`) is already factored out. The watch setup is ~15 lines of boilerplate that doesn't warrant a shared abstraction given the different lifecycles.

---

### 4. MEDIUM — `context-tracker.ts` vs `orch-enricher.ts` token tracking overlap

`context-tracker.ts` provides `ContextBreakdown` with mutator functions. `orch-enricher.ts` imports and uses them (lines 183-204). `agent-tracker.ts` also imports `createContextBreakdown` and `addToolResultTokens` (lines 10, 98).

**Assessment:** No duplication. `context-tracker.ts` is the single source of truth for token breakdown logic. Both `orch-enricher.ts` and `agent-tracker.ts` are consumers. The data flows: enricher creates/updates breakdowns per event, state-engine syncs them into agent-tracker (state-engine.ts:76). Clean separation.

**Verdict:** No action needed.

---

### 5. LOW — `FileAttention` type defined once, extended once — clean

- Defined: `src/protocol.ts:58` — `FileAttention { path, operation, tokenCost }`
- Extended: `scripts/lib/state-engine.ts:14` — `FileAttentionEntry extends FileAttention` adds `agents: string[]`

**Assessment:** Proper type extension via `extends`. Single definition. No duplication.

**Verdict:** No action needed.

---

### 6. LOW — `permission-detection.ts` timer/state pattern is self-contained, no duplication

The timer pattern (`setTimeout` / `clearTimeout` with state object) is specific to permission detection. `session-watcher.ts` uses `setTimeout` for inactivity timeout but with completely different logic (single timer vs per-tool-call detection). No shared abstraction warranted.

**Verdict:** No action needed.

---

## Summary

| # | Severity | Issue | Action |
|---|----------|-------|--------|
| 1 | CRITICAL | `estimateTokens` heuristic inlined 2x in orch-enricher despite import | Replace with `estimateTokens()` call |
| 2 | INFO | `pendingToolCalls` name collision across files | Consider rename for clarity |
| 3 | INFO | Watch+poll pattern similar but correctly not shared | None |
| 4 | INFO | Token tracking split across modules | Clean — no action |
| 5 | INFO | `FileAttention` type hierarchy | Clean — no action |
| 6 | INFO | Permission timer pattern | No duplication |

**Blocking:** Finding #1 only. Two-line fix.

---

**Status:** DONE
**Summary:** Reviewed 9 files for code reuse issues. Found 1 blocking issue (inlined `estimateTokens` heuristic in orch-enricher.ts that should use the existing imported function). 5 other checks confirmed clean separation with no true duplication.
**Concerns/Blockers:** None beyond Finding #1.
