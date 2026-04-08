# MeowKit Hooks Index

All hooks in `.claude/hooks/` with their registration, purpose, and input contract.

## Convention (Phase 7 — 260408)

Hooks consume input via **JSON on stdin** (per `code.claude.com/docs/en/hooks`) using the shared parser `lib/read-hook-input.sh`. Hooks also fall back to `$1` positional for back-compat with the legacy `"$TOOL_INPUT_FILE_PATH"` settings.json convention. Both forms coexist safely.

Every hook must be registered in `.claude/settings.json` — unregistered hooks are dead code.

## Hooks Table

| Hook | Event | Matcher | Purpose | Timeout | Input |
|---|---|---|---|---|---|
| `project-context-loader.sh` | SessionStart | — | Load project-context.md + LocalContext expansion (directory tree, tool availability, package scripts) + session-ID reset | 5s | `HOOK_SESSION_ID` |
| `gate-enforcement.sh` | PreToolUse | Edit\|Write | Gate 1 (plan approval) + Phase 4 sprint contract gate + suspicious-dir rejection | 10s | `HOOK_FILE_PATH` |
| `privacy-block.sh` | PreToolUse | Read, Edit\|Write | Block reads of sensitive files (.env, .key, credentials) | 5s | `HOOK_FILE_PATH` |
| `pre-task-check.sh` | PreToolUse | Bash | Scan bash commands for injection patterns | 5s | `HOOK_COMMAND` |
| `pre-ship.sh` | PreToolUse | Bash | Run tests/lint before git commit/push | 30s | `HOOK_COMMAND` |
| `post-write.sh` | PostToolUse | Edit\|Write | Security scan on every written file | 10s | `HOOK_FILE_PATH` |
| `learning-observer.sh` | PostToolUse | Edit\|Write | Detect churn patterns (same file edited 3+ times) | 5s | `HOOK_FILE_PATH` |
| `post-write-build-verify.sh` | PostToolUse | Edit\|Write | **Phase 7 NEW.** Auto-run compile/lint on source files. Cached by file hash. Errors feed back to agent via stdout. | 35s | `HOOK_FILE_PATH` |
| `post-write-loop-detection.sh` | PostToolUse | Edit\|Write | **Phase 7 NEW.** Warn at N=4, escalate at N=8 edits to same file. Prevents doom loops. | 3s | `HOOK_FILE_PATH` + `HOOK_SESSION_ID` |
| `cost-meter.sh` | PostToolUse | Bash | Track token cost accumulation | 5s | (none — reads cost log) |
| `pre-completion-check.sh` | Stop | — | **Phase 7 NEW.** Block session stop if no verification evidence exists. Hard cap 3 re-entries. LEAN mode soft nudge. | 5s | (none — reads plan/contract/trace) |
| `post-session.sh` | Stop | — | Capture session lessons + model-change detection + cost log initialization | 5s | (none — reads memory) |

**Hook count:** 13 hook scripts in `.claude/hooks/` (12 registered in `.claude/settings.json` events + 1 `pre-implement.sh` invoked manually by the developer agent, not via event). The shared parser shim at `lib/read-hook-input.sh` is not a hook itself — it's a sourceable library.

## Env Var Bypasses

| Var | Effect |
|---|---|
| `MEOWKIT_BUILD_VERIFY=off` | Skip post-write-build-verify.sh |
| `MEOWKIT_LOOP_DETECT=off` | Skip post-write-loop-detection.sh |
| `MEOWKIT_PRECOMPLETION=off` | Skip pre-completion-check.sh |
| `MEOWKIT_HARNESS_MODE=LEAN` | PreCompletion falls back to soft nudge; BuildVerify still runs |
| `MEOWKIT_HARNESS_MODE=MINIMAL` | Skip BuildVerify + PreCompletion entirely |
| `MEOW_HOOK_PROFILE=fast` | Skip pre-ship, post-session, learning-observer (speed) |

## State Files

Hooks that maintain state write to `session-state/` (cleared per session by `project-context-loader.sh` when session_id changes):

| File | Writer | Reader | Purpose |
|---|---|---|---|
| `session-state/edit-counts.json` | post-write-loop-detection.sh | (same) | Per-file edit counter, keyed by `{session_id}:{realpath}` |
| `session-state/precompletion-attempts.json` | pre-completion-check.sh | (same) | Forced-re-entry counter per active plan |
| `session-state/build-verify-cache.json` | post-write-build-verify.sh | (same) | File-content-hash cache for skip-on-unchanged |
| `session-state/last-session-id` | project-context-loader.sh | (same) | Session change detection |
| `session-state/learning-observer.jsonl` | learning-observer.sh | post-session.sh | Churn pattern log |
| `session-state/active-plan` | meow:harness (Phase 5), meow:plan-creator | pre-completion-check.sh | Currently active plan slug |

## Hook Order Independence (Phase 7 P22)

Hooks in the same event must NOT rely on execution order. Cross-hook state passes through filesystem (`session-state/`), never in-memory or shared env vars. Each hook handles the case where another fails or runs first.

## See Also

- `lib/read-hook-input.sh` — canonical JSON-on-stdin parser shim
- `references/build-verify-commands.md` — per-language build-verify command table
- `docs/meowkit-rules.md` §3 — Argument Convention (Phase 7 rewrite)
- `.claude/settings.json` — authoritative hook registration
