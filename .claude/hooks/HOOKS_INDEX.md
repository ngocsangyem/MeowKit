# MeowKit Hooks Index

All hooks in `.claude/hooks/` with their registration, purpose, and input contract.

## Convention (Phase 7 — 260408)

Hooks consume input via **JSON on stdin** (per `code.claude.com/docs/en/hooks`). Shell hooks use the shared parser `lib/read-hook-input.sh`. Node.js hooks use `lib/parse-stdin.cjs`.

Non-security hooks are dispatched via `dispatch.cjs` + `handlers.json` registry. Security hooks (`gate-enforcement.sh`, `privacy-block.sh`) remain independent bash entries in `settings.json` to avoid dispatcher SPOF risk.

Every hook must be registered in `.claude/settings.json` — unregistered hooks are dead code.

## Hooks Table

| Hook | Event | Matcher | Purpose | Timeout | Input |
|---|---|---|---|---|---|
| `project-context-loader.sh` | SessionStart | — | Load project-context.md + LocalContext expansion (directory tree, tool availability, package scripts) + session-ID reset | 5s | `HOOK_SESSION_ID` |
| `gate-enforcement.sh` | PreToolUse | Edit\|Write | Gate 1 (plan approval) + Phase 4 sprint contract gate + suspicious-dir rejection | 10s | `HOOK_FILE_PATH` |
| `privacy-block.sh` | PreToolUse | Read, Edit\|Write, Bash | Block reads of sensitive files (.env, .key, credentials) + SSRF check on Bash fetch commands | 5s | `HOOK_FILE_PATH` or `HOOK_COMMAND` |
| `pre-task-check.sh` | PreToolUse | Bash | Scan bash commands for injection patterns | 5s | `HOOK_COMMAND` |
| `pre-ship.sh` | PreToolUse | Bash | Run tests/lint before git commit/push | 30s | `HOOK_COMMAND` |
| `post-write.sh` | PostToolUse | Edit\|Write | Security scan on every written file | 10s | `HOOK_FILE_PATH` |
| `learning-observer.sh` | PostToolUse | Edit\|Write | Detect churn patterns (same file edited 3+ times) | 5s | `HOOK_FILE_PATH` |
| `handlers/build-verify.cjs` | PostToolUse | Edit\|Write | Auto-run compile/lint on source files. Cached by file hash. Dispatched via `dispatch.cjs`. Supersedes `post-write-build-verify.sh`. | 40s | `tool_input.file_path` |
| `handlers/loop-detection.cjs` | PostToolUse | Edit\|Write | Warn at N=4, escalate at N=8 edits to same file. Dispatched via `dispatch.cjs`. Supersedes `post-write-loop-detection.sh`. | 40s | `tool_input.file_path` + `session_id` |
| `handlers/budget-tracker.cjs` | PostToolUse | Edit\|Write, Bash | Estimate token cost per tool call, accumulate session budget, warn at $30, block at $100. Dispatched via `dispatch.cjs`. | 40s | `tool_input` + `tool_response` |
| `handlers/auto-checkpoint.cjs` | PostToolUse | Edit\|Write | Auto-create checkpoints at intervals during long sessions. Dispatched via `dispatch.cjs`. | 40s | `tool_input.file_path` |
| `handlers/model-detector.cjs` | SessionStart | — | Detect model tier (TRIVIAL/STANDARD/COMPLEX) and harness density (MINIMAL/FULL/LEAN) from SessionStart stdin `model` field. Fallback: `MEOWKIT_MODEL_HINT` env. Dispatched via `dispatch.cjs`. | 10s | `model` field |
| `handlers/orientation-ritual.cjs` | SessionStart | — | Emit session orientation context (active plan, pending tasks). Dispatched via `dispatch.cjs`. | 10s | Full stdin JSON |
| `handlers/memory-loader.cjs` | UserPromptSubmit | — | Load `.claude/memory/lessons.md` and `.claude/memory/patterns.json` into context on each user prompt. Dispatched via `dispatch.cjs`. | 10s | Full stdin JSON |
| `handlers/checkpoint-writer.cjs` | Stop | — | Write session checkpoint with budget summary and file changes. Dispatched via `dispatch.cjs`. | 10s | Full stdin JSON |
| `dispatch.cjs` | PostToolUse, Stop, SessionStart, UserPromptSubmit | varies | Central Node.js dispatcher. Loads `handlers.json`, dispatches to registered `.cjs` handler modules. | 10-40s | Full stdin JSON |
| `cost-meter.sh` | PostToolUse | Bash | Track token cost accumulation | 5s | (none — reads cost log) |
| `pre-completion-check.sh` | Stop | — | **Phase 7 NEW.** Block session stop if no verification evidence exists. Hard cap 3 re-entries. LEAN mode soft nudge. | 5s | (none — reads plan/contract/trace) |
| `post-session.sh` | Stop | — | Capture session lessons + model-change detection + cost log initialization + Phase 9 conversation-summary cache clear on session change | 5s | (none — reads memory) |
| `conversation-summary-cache.sh` | Stop | — | **Phase 9 NEW.** Spawns **background** worker that summarizes transcript via `claude -p --model haiku` (~60–120s wall) when throttle thresholds met. Hook itself returns instantly. Lock at `session-state/conversation-summary.lock`. Atomic write to `.claude/memory/conversation-summary.md`. | 5s | `HOOK_TRANSCRIPT_PATH` + `HOOK_SESSION_ID` |
| `conversation-summary-cache.sh` | UserPromptSubmit | — | **Phase 9 NEW.** Inject cached summary as `## Prior conversation summary` block (capped 4KB). Skips on session_id mismatch. | 2s | `HOOK_SESSION_ID` |

**Hook count:** 14 hook scripts + 8 Node.js handlers in `.claude/hooks/`. 13 shell hooks registered in `.claude/settings.json` events + 1 `pre-implement.sh` invoked manually by the developer agent. 8 `.cjs` handlers registered via `handlers.json` → `dispatch.cjs`. The shared parser shim at `lib/read-hook-input.sh` and the secret scrubber at `lib/secret-scrub.sh` are sourceable libraries. `conversation-summary-cache.sh` is registered under TWO events (Stop + UserPromptSubmit), branching on `HOOK_EVENT_NAME`. `SubagentStart`/`SubagentStop` are intentionally empty — hooks in these events would infinite-loop inside subagents.

## Env Var Bypasses

| Var | Effect |
|---|---|
| `MEOWKIT_BUILD_VERIFY=off` | Skip post-write-build-verify.sh |
| `MEOWKIT_LOOP_DETECT=off` | Skip post-write-loop-detection.sh |
| `MEOWKIT_PRECOMPLETION=off` | Skip pre-completion-check.sh |
| `MEOWKIT_HARNESS_MODE=LEAN` | PreCompletion falls back to soft nudge; BuildVerify still runs |
| `MEOWKIT_HARNESS_MODE=MINIMAL` | Skip BuildVerify + PreCompletion entirely |
| `MEOW_HOOK_PROFILE=fast` | Skip pre-ship, post-session, learning-observer (speed) |
| `MEOWKIT_SUMMARY_CACHE=off` | Skip conversation-summary-cache.sh (both Stop and UserPromptSubmit paths) |
| `MEOWKIT_SUMMARY_THRESHOLD=N` | Override 20KB transcript threshold for summarization |
| `MEOWKIT_SUMMARY_TURN_GAP=N` | Override 30-event minimum gap between summaries (variable kept for back-compat; semantic is JSONL events, ≈ 3–6 turns) |
| `MEOWKIT_SUMMARY_GROWTH_DELTA=N` | Override 5KB growth-delta minimum between summaries |
| `MEOWKIT_SUMMARY_BUDGET_SEC=N` | Background worker hard budget for `claude -p` (default 180s) |
| `MEOWKIT_SUMMARY_DEBUG=1` | Verbose stderr from conversation-summary-cache.sh |

## State Files

Hooks that maintain state write to `session-state/` (cleared per session by `project-context-loader.sh` when session_id changes):

| File | Writer | Reader | Purpose |
|---|---|---|---|
| `session-state/edit-counts.json` | handlers/loop-detection.cjs | (same) | Per-file edit counter, keyed by `{session_id}:{realpath}` |
| `session-state/precompletion-attempts.json` | pre-completion-check.sh | (same) | Forced-re-entry counter per active plan |
| `session-state/build-verify-cache.json` | handlers/build-verify.cjs | (same) | File-content-hash cache for skip-on-unchanged |
| `session-state/last-session-id` | project-context-loader.sh | (same) | Session change detection |
| `session-state/learning-observer.jsonl` | learning-observer.sh | post-session.sh | Churn pattern log |
| `session-state/active-plan` | meow:harness (Phase 5), meow:plan-creator | pre-completion-check.sh | Currently active plan slug |
| `session-state/conversation-summary.lock` | conversation-summary-cache.sh (Stop bg worker) | conversation-summary-cache.sh next Stop (5min stale GC) | Mutex preventing overlapping background summarizers |
| `.claude/memory/conversation-summary.md` | conversation-summary-cache.sh (Stop bg worker) | **Consumer 1:** conversation-summary-cache.sh (UserPromptSubmit) → emits to stdout → **Consumer 2: Claude Code context injection (the model itself)** for every meowkit agent. Cleared by project-context-loader.sh on session change. | Persistent conversation summary read by every turn |
| `session-state/detected-model.json` | handlers/model-detector.cjs | handlers/budget-tracker.cjs, handlers/auto-checkpoint.cjs | Model tier + density detection result |
| `session-state/budget-state.json` | handlers/budget-tracker.cjs | (same) | Accumulated session cost estimate |
| `session-state/auto-checkpoint-counter.json` | handlers/auto-checkpoint.cjs | (same) | Checkpoint interval counter |
| `.claude/session-state/tdd-mode` | tdd-flag-detector.sh | tdd-detect.sh, pre-implement.sh | TDD sentinel (cleared on new session by project-context-loader.sh) |
| `.claude/session-state/tdd-deprecation-warned` | tdd-detect.sh | (same) | Legacy profile deprecation one-shot flag (cleared on new session) |

## Hook Order Independence (Phase 7 P22)

Hooks in the same event must NOT rely on execution order. Cross-hook state passes through filesystem (`session-state/`), never in-memory or shared env vars. Each hook handles the case where another fails or runs first.

## See Also

- `lib/read-hook-input.sh` — canonical JSON-on-stdin parser shim (shell hooks)
- `lib/parse-stdin.cjs` — stdin JSON parser (Node.js hooks)
- `lib/shared-state.cjs` — atomic JSON state persistence (Node.js hooks)
- `handlers.json` — handler registry for `dispatch.cjs`
- `references/build-verify-commands.md` — per-language build-verify command table
- `docs/meowkit-rules.md` §3 — Argument Convention (Phase 7 rewrite)
- `.claude/settings.json` — authoritative hook registration
