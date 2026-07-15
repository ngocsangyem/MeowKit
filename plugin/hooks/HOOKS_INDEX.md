# Hooks Index

All hooks in `.claude/hooks/` with their registration, purpose, and input contract.

## Convention (Phase 7 — 260408)

Hooks consume input via **JSON on stdin** (per https://code.claude.com/docs/en/hooks). Shell hooks use the shared parser `lib/read-hook-input.sh`. Node.js hooks use `lib/parse-stdin.cjs`.

Non-security hooks are dispatched via `dispatch.cjs` + `handlers.json` registry. Security hooks (`gate-enforcement.sh`, `privacy-block.sh`) remain independent bash entries in `settings.json` to avoid dispatcher SPOF risk.

Every hook must be registered in `.claude/settings.json` — unregistered hooks are dead code.

## Hooks Table

| Hook | Event | Matcher | Purpose | Timeout | Input |
|---|---|---|---|---|---|
| `ensure-skills-venv.sh` | SessionStart | — | Bootstrap `.claude/skills/.venv` Python venv if missing. Idempotent — no-op when venv already exists. Prevents Python skill failures on fresh clone (H11 fix). | 30s | `CLAUDE_PROJECT_DIR` env |
| `project-context-loader.sh` | SessionStart | — | Load project-context.md + LocalContext expansion (directory tree, tool availability, package scripts) + session-ID reset | 5s | `HOOK_SESSION_ID` |
| `capability-bootstrap.sh` | SessionStart | — | Emit the always-visible capability-resolution guidance into agent context by `cat`-ing the committed constant (generated via `mewkit capabilities bootstrap --write`) — no CLI spawn at runtime. Silent no-op when the file is absent, so a partial install never errors. | 5s | `CLAUDE_PROJECT_DIR` env |
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
| `handlers/orientation-ritual.cjs` | SessionStart | — | Emit session orientation context (active plan, pending tasks). Reads `session-state/checkpoints/checkpoint-latest.json` directly (single-file, no pointer indirection). Dispatched via `dispatch.cjs`. | 10s | Full stdin JSON |
| `handlers/checkpoint-writer.cjs` | Stop | — | Write session checkpoint with budget summary and file changes. Single-file overwrite via atomic .tmp+rename. Dispatched via `dispatch.cjs`. | 10s | Full stdin JSON |
| `dispatch.cjs` | PostToolUse, Stop, SessionStart, UserPromptSubmit | varies | Central Node.js dispatcher. Loads `handlers.json`, dispatches to registered `.cjs` handler modules. | 10-40s | Full stdin JSON |
| `pre-completion-check.sh` | Stop | — | **Phase 7 NEW.** Block session stop if no verification evidence exists. Hard cap 3 re-entries. LEAN mode soft nudge. | 5s | (none — reads plan/contract/trace) |
| `post-session.sh` | Stop | — | Capture session lessons + model-change detection + cost log initialization | 5s | (none — reads memory) |
| `jira-env-loader.sh` | SessionStart | — | Validate presence of `.claude/.env` and 3 `MEOW_JIRA_*` vars (token, email, site URL). Emits "[mk:jira] env OK" or "[mk:jira] {key} missing". Does NOT export — wrapper `scripts/jira-as.sh` handles per-call export per "each hook is a separate subprocess" constraint. | 5s | JSON stdin via `lib/read-hook-input.sh` |
| `control-probe.sh` | Stop | — | Telemetry control signal — fires on every Stop to disambiguate "event unsupported" from "logger broken" when comparing PreCompact/PostToolUseFailure probe counts. Never blocks. | 5s | Full stdin JSON |
| `posttoolfailure-probe.sh` | PostToolUseFailure | — | Log PostToolUseFailure hook fires to verify the host runtime supports the event. Telemetry-only; never blocks. | 5s | Full stdin JSON |
| `precompact-probe.sh` | PreCompact | — | Telemetry + safety-baseline re-arm: logs the fire, then appends a `precompact_rearm` marker so the next turn re-reads the safety baseline that compaction dropped from context. No-op without a session id; never blocks. | 5s | Full stdin JSON |

**Hook count:** 18 shell hook scripts + 8 Node.js `.cjs` handlers in `.claude/hooks/handlers/`. Shell hooks registered in `.claude/settings.json` events + `pre-implement.sh` invoked manually by the developer agent. `.cjs` handlers registered via `handlers.json` → `dispatch.cjs` (build-verify, loop-detection, budget-tracker, auto-checkpoint, checkpoint-writer, model-detector, orientation-ritual, immediate-capture-handler) + 1 direct `dispatch.cjs` entry. The shared parser shim at `lib/read-hook-input.sh`, the secret scrubber at `lib/secret-scrub.sh`, and `lib/checkpoint-utils.cjs` are sourceable libraries. `SubagentStart`/`SubagentStop` are intentionally empty — hooks in these events would infinite-loop inside subagents.
**Tombstoned (v2.4.0):** `memory-loader.cjs`, `memory-filter.cjs`, `memory-parser.cjs`, `memory-injector.cjs` — auto-inject memory pipeline removed; memory now loads on-demand per skill. Removed because the auto-inject path widened the prompt-injection surface (memory content is DATA, but injecting it into every prompt blurred the DATA-vs-INSTRUCTIONS boundary).

**Additional registered handler (not in hooks table above):**
| Handler | Event | Purpose |
|---|---|---|
| `handlers/immediate-capture-handler.cjs` | UserPromptSubmit | Detects `##decision:`, `##pattern:`, `##note:` prefixes in user prompts and writes entries to typed memory files (architecture-decisions.json, fixes.json, review-patterns.json, quick-notes.md). |

## Env Var Bypasses

| Var | Effect |
|---|---|
| `MEOWKIT_BUILD_VERIFY=off` | Skip handlers/build-verify.cjs |
| `MEOWKIT_LOOP_DETECT=off` | Skip handlers/loop-detection.cjs |
| `MEOWKIT_PRECOMPLETION=off` | Skip pre-completion-check.sh |
| `MEOWKIT_AUTOBUILD_MODE=LEAN` | PreCompletion falls back to soft nudge; BuildVerify still runs |
| `MEOWKIT_AUTOBUILD_MODE=MINIMAL` | Skip BuildVerify + PreCompletion entirely |
| `MEOW_HOOK_PROFILE=fast` | Skip pre-ship, post-session, learning-observer (speed) |
| `MEOWKIT_MAX_PROJECT_CONTEXT_BYTES=N` | project-context.md byte cap at SessionStart (default 12288 = ~12KB ≈ ~3K tokens). `0` disables the cap. |
| `MEOWKIT_SKIP_SAFETY_SENTINEL=off` | Disable agent-detector sentinel — force full 10-file Read on every turn. Default `on` skips reads on turns 2..N of same session. |
| `MEOWKIT_MEMORY_PRUNE=off` | Disable auto-prune of stale memory `.md` entries on Stop. Default `on`. Severity-critical/security entries and dateless entries are NEVER pruned. |
| `MEOWKIT_MEMORY_PRUNE_AGE_DAYS=N` | Override 90-day cutoff for memory auto-prune. |

## State Files

Hooks that maintain state write to `session-state/` (cleared per session by `project-context-loader.sh` when session_id changes):

| File | Writer | Reader | Purpose |
|---|---|---|---|
| `session-state/edit-counts.json` | handlers/loop-detection.cjs | (same) | Per-file edit counter, keyed by `{session_id}:{realpath}` |
| `session-state/precompletion-attempts.json` | pre-completion-check.sh | (same) | Forced-re-entry counter per active plan |
| `session-state/build-verify-cache.json` | handlers/build-verify.cjs | (same) | File-content-hash cache for skip-on-unchanged |
| `session-state/last-session-id` | project-context-loader.sh | (same) | Session change detection |
| `session-state/learning-observer.jsonl` | learning-observer.sh | (self — edit-frequency state) | Per-file edit ledger; self-read to compute the canonical `file_edited` trace `edit_count`. No external reader; verbose churn record debug-gated (`MEOWKIT_HOOK_DEBUG=1`). |
| `session-state/active-plan.json` | mk:autobuild (Phase 5), mk:plan-creator | pre-completion-check.sh, handlers/checkpoint-writer.cjs | Active plan state `{ "path": "...", "slug": "..." }` |
| `session-state/active-plan` | legacy (migration fallback only) | pre-completion-check.sh | Deprecated raw active-plan value; remove after migration |
| `session-state/verification-required.json` | mk:cook, mk:autobuild | pre-completion-check.sh | Verification enforcement marker `{ "required": true, "slug": "...", ... }` |
| `session-state/detected-model.json` | handlers/model-detector.cjs | handlers/budget-tracker.cjs, handlers/auto-checkpoint.cjs | Model tier + density detection result |
| `session-state/budget-state.json` | handlers/budget-tracker.cjs | (same) | Accumulated session cost estimate |
| `session-state/checkpoints/checkpoint-latest.json` | handlers/checkpoint-writer.cjs (Stop), handlers/auto-checkpoint.cjs (PostToolUse phase transitions) | handlers/orientation-ritual.cjs (SessionStart resume/clear/compact) | Single-file checkpoint with model tier, density, plan path, git state, budget. Atomic .tmp+rename; last-writer-wins; sequence display-only. |
| `.claude/session-state/tdd-mode` | tdd-flag-detector.sh | tdd-detect.sh, pre-implement.sh | TDD sentinel (cleared on new session by project-context-loader.sh) |
| `.claude/session-state/tdd-deprecation-warned` | tdd-detect.sh | (same) | Legacy profile deprecation one-shot flag (cleared on new session) |
| `session-state/session-sentinels.jsonl` | post-session.sh (Stop, verification line), precompact-probe.sh (PreCompact, re-arm line) | handlers/safety-sentinel-inject.cjs (UserPromptSubmit) | Single append-only log, two line shapes per session: verification `{session_id, safety, phase_zero, ts}` (Stop) and re-arm `{session_id, event:"precompact_rearm", ts}` (PreCompact). Reader emits the cached-skip marker only when the latest verification is MORE RECENT (later file position) than the latest re-arm — so compaction forces a fresh safety-baseline re-read on the next turn. The Stop hook's unconditional verification write needs no change: a re-arm post-dates it, and the post-re-read verification then post-dates the re-arm. Matching verification → mk:agent-detector step-0/0b skip their 5-file Read loops on turns 2..N. Truncated by project-context-loader.sh on session change. |
| `session-state/last-prune-date` | post-session.sh (Stop) | (same) | Daily rate-limit token for memory auto-prune. Holds YYYY-MM-DD of last successful prune; advanced only on Python exit 0. |
| `session-state/prune-log.md` | lib/memory-prune.py (via post-session.sh Stop) | observability only | Append-only count log of pruned entries (`{file} \| {date} \| {N} entries pruned`). NO entry content is ever logged — breaks the injection-rules.md Rule 11 carrier chain. Lives OUTSIDE `.claude/memory/` deliberately. |

## Telemetry / Canonical Event Stream

| Stream | Writer | Reader | Status |
|---|---|---|---|
| `.claude/memory/trace-log.jsonl` | `append-trace.sh` (called by `post-session.sh`, `learning-observer.sh`) | `mk:trace-analyze`, `pre-completion-check.sh` | **Canonical structured event stream.** One typed JSONL record per event. Lock `.claude/memory/.trace-log.lock`; rotates at 50 MB. Never injected into prompt context. |
| `.claude/hooks/.logs/hook-log.jsonl` | `lib/hook-logger.sh` | `scripts/telemetry-decisions.py` (dead-weight-audit gate) | Hook-fire telemetry. Has a reader — keep writing; not debug-gated. |
| `session-state/learning-observer.jsonl` | `learning-observer.sh` | self (edit-frequency state → `file_edited` trace) | Reader-less churn record is debug-gated (`MEOWKIT_HOOK_DEBUG=1`); edit ledger feeds the canonical trace. |

`trace-log.jsonl` is the single canonical event stream — do not spawn parallel JSONL control planes (`skill-usage.jsonl`, `eureka.jsonl`, `reviews.jsonl`). Durable workflow evidence lives under `tasks/`; reusable knowledge under `.claude/memory/*.json`.

## Hook Order Independence (Phase 7 P22)

Hooks in the same event must NOT rely on execution order. Cross-hook state passes through filesystem (`session-state/`), never in-memory or shared env vars. Each hook handles the case where another fails or runs first.

## See Also

- `lib/read-hook-input.sh` — canonical JSON-on-stdin parser shim (shell hooks)
- `lib/parse-stdin.cjs` — stdin JSON parser (Node.js hooks)
- `lib/shared-state.cjs` — atomic JSON state persistence (Node.js hooks)
- `handlers.json` — handler registry for `dispatch.cjs`
- `references/build-verify-commands.md` — per-language build-verify command table
- Argument convention: hooks receive JSON on stdin only; positional args are not used. See `lib/read-hook-input.sh` for the shared parser used by every shell hook.
- `.claude/settings.json` — authoritative hook registration
