---
title: Hooks
description: MeowKit's lifecycle hooks — what they enforce, when they run.
persona: C
---

# Hooks

MeowKit uses lifecycle hooks to enforce discipline at the tool level. Some hooks are registered in `.claude/settings.json` (automatic), others are invoked by skills.

## Registered hooks (automatic)

These run automatically via Claude Code's hook system:

| Hook                   | Type        | Trigger     | What it does                                                                              | Blocks?      |
| ---------------------- | ----------- | ----------- | ----------------------------------------------------------------------------------------- | ------------ |
| `post-write.sh`        | PostToolUse | Edit, Write | Security scan: secrets, `any` type, SQL injection, XSS, destructive patterns              | Yes (exit 2) |
| `learning-observer.sh` | PostToolUse | Edit, Write | Detect churn patterns (file edited 3+ times); feeds into post-session retroactive capture | No           |
| `post-session.sh`      | Stop        | Session end | Capture session data to `.claude/memory/`                                                 | No           |
| `ensure-skills-venv.sh` | SessionStart | Session start | Idempotent bootstrap — creates `.claude/skills/.venv` if absent                         | No           |
| `tdd-flag-detector.sh`  | UserPromptSubmit | Prompt submit | Detects `--tdd` flag in user prompts, writes sentinel to `session-state/tdd-mode`      | No           |

## Skill-embedded hooks

These are registered in SKILL.md frontmatter and run when those skills are active:

| Hook               | Skill        | Trigger     | What it does                                      |
| ------------------ | ------------ | ----------- | ------------------------------------------------- |
| `check-freeze.sh`  | mk:freeze  | Edit, Write | Block edits outside frozen directory              |
| `check-careful.sh` | mk:careful | Bash        | Warn on destructive commands (rm -rf, DROP TABLE) |

## Skill-invoked scripts

These run when specific skills call them:

| Script              | Phase     | What it does                       | Blocks?                  |
| ------------------- | --------- | ---------------------------------- | ------------------------ |
| `pre-task-check.sh` | Any       | Prompt injection pattern detection | Yes (BLOCK on injection) |
| `pre-implement.sh`  | Phase 2-3 | TDD gate — opt-in (see note below) | Only when TDD enabled    |
| `pre-ship.sh`       | Phase 5   | Test + lint + typecheck            | Yes                      |
| `cost-meter.sh`     | Any       | Token usage tracking               | No                       |

### `pre-implement.sh` invocation model

`pre-implement.sh` is **NOT** wired to a Claude Code `PreToolUse` event. It is invoked manually by the cook skill via a Bash tool call (see `mk:cook/references/workflow-steps.md` Phase 3 pre-check). This is **behavioral enforcement**, not mechanical — if a different workflow doc is followed, the hook is not invoked.

The hook is a no-op unless TDD mode is ON via:

- `MEOWKIT_TDD=1` env var (CI / shell rc, highest precedence)
- `.claude/session-state/tdd-mode` sentinel file containing `on` (written by slash command `--tdd`)
- (legacy) `MEOW_PROFILE=fast` still bypasses with a deprecation warning, removed in next major

When TDD is OFF (the default), the hook exits 0 silently. When ON, it requires a failing test to exist for the feature being implemented and blocks otherwise. Bypass mechanisms: drop `--tdd`, unset `MEOWKIT_TDD`.

## Hook runtime profiling

The `MEOW_HOOK_PROFILE` environment variable controls which hooks are active. Set it in your `.env` file or shell before starting a Claude Code session.

| Profile    | Hooks Active                                                                | Use When                              |
| ---------- | --------------------------------------------------------------------------- | ------------------------------------- |
| `strict`   | All hooks                                                                   | COMPLEX tasks, security-critical work |
| `standard` | All except `cost-meter.sh`, `post-session.sh`                               | Default — everyday development        |
| `fast`     | `gate-enforcement.sh`, `privacy-block.sh`, `project-context-loader.sh` only | Rapid iteration, prototyping          |

```bash
# Set in .env or shell
MEOW_HOOK_PROFILE=fast
```

### Per-hook profile classification

| Hook                        | strict | standard | fast |
| --------------------------- | :----: | :------: | :--: |
| `gate-enforcement.sh`       |   ✅   |    ✅    |  ✅  |
| `privacy-block.sh`          |   ✅   |    ✅    |  ✅  |
| `project-context-loader.sh` |   ✅   |    ✅    |  ✅  |
| `post-write.sh`             |   ✅   |    ✅    |  ❌  |
| `pre-ship.sh`               |   ✅   |    ✅    |  ❌  |
| `pre-task-check.sh`         |   ✅   |    ✅    |  ❌  |
| `pre-implement.sh`          |   ✅   |    ✅    |  ❌  |
| `cost-meter.sh`             |   ✅   |    ❌    |  ❌  |
| `post-session.sh`           |   ✅   |    ❌    |  ❌  |
| `learning-observer.sh`      |   ✅   |    ✅    |  ❌  |

:::warning Safety-critical hooks never skip
`gate-enforcement.sh` and `privacy-block.sh` are active in **all** profiles, including `fast`. These enforce the two hard gates and sensitive file protection — they cannot be disabled by profile selection.
:::

## Hook configuration

Hooks are registered in `.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "sh .claude/hooks/post-write.sh \"$TOOL_INPUT_FILE_PATH\""
          }
        ]
      },
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "sh .claude/hooks/learning-observer.sh \"$TOOL_INPUT_FILE_PATH\""
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          { "type": "command", "command": "sh .claude/hooks/post-session.sh" }
        ]
      }
    ]
  }
}
```

## JSON-on-stdin Convention (260408 Migration)

All meowkit hooks now read input as JSON on stdin (per [Claude Code hook docs](https://code.claude.com/docs/en/hooks)), parsed via the shared shim `lib/read-hook-input.sh`. The shim exports `HOOK_TOOL_NAME`, `HOOK_FILE_PATH`, `HOOK_COMMAND`, `HOOK_SESSION_ID`, `HOOK_EVENT_NAME`, `HOOK_TRANSCRIPT_PATH`, and other fields. Hooks also honor legacy `$1` positional args for back-compat — both forms coexist safely.

Phase 7 of the harness plan migrated all 10 pre-existing hooks and added 4 new middleware hooks to this convention.

## Shared Hook Libraries

Sourceable libraries in `.claude/hooks/lib/` — not hooks themselves:

- `lib/read-hook-input.sh` — JSON-on-stdin parser. Source with `. lib/read-hook-input.sh`; never execute directly. Requires Bash 3.2+. Falls back to system `python3` if venv unavailable. Gracefully degrades (empty vars + warning) if no Python found.
- `lib/secret-scrub.sh` — shared secret redaction. Exports a `scrub_secrets()` function covering Anthropic/OpenAI/AWS/GH/GL/Slack/JWT/PEM patterns. Sourced by hooks that persist content (`conversation-summary-cache.sh`, `append-trace.sh`).

## Middleware Hooks (Phase 7)

### `post-write-build-verify.sh`

Fires on **PostToolUse Edit|Write**. Classifies the written file by extension (`ts/tsx` → `tsc --noEmit|eslint`; `js` → `eslint`; `py` → `ruff check|mypy`; `go` → `go build ./...`; `rs` → `cargo check`; `rb` → `ruby -c|rubocop`). Errors emitted to stdout as `@@BUILD_VERIFY_ERROR@@ … @@END_BUILD_VERIFY@@` blocks (fed back to agent). Results cached by file content hash — unchanged files are skipped. Skips `node_modules/`, `vendor/`, `dist/`, `tasks/`, `docs/`, `.claude/`, test files, and map/lock files.

- **Opt-out:** `MEOWKIT_BUILD_VERIFY=off`
- **Timeout override:** `MEOWKIT_BUILD_VERIFY_TIMEOUT=N` (default 30s for TS; 35s hook registration timeout)
- **Density:** runs in LEAN; skipped in MINIMAL (`MEOWKIT_HARNESS_MODE=MINIMAL`)
- **Source:** `.claude/hooks/post-write-build-verify.sh`

### `post-write-loop-detection.sh`

Fires on **PostToolUse Edit|Write**. Counts per-file edits keyed `{session_id}:{realpath}` in `session-state/edit-counts.json`. Warns at N≥4 (`@@LOOP_DETECT_WARN@@`) and escalates at N≥8 (`@@LOOP_DETECT_ESCALATE@@`) — doom-loop prevention per LangChain harness research. Never blocks; messages are fed back via stdout.

- **Opt-out:** `MEOWKIT_LOOP_DETECT=off`
- **Timeout:** 3s
- **Source:** `.claude/hooks/post-write-loop-detection.sh`

### `pre-completion-check.sh`

Fires on the **Stop** event (not SubagentStop). Hard gate: if no verification evidence exists (no evaluator verdict file, no signed sprint contract, no test-pass markers in the trace log), emits `{"decision":"block","reason":"…"}` JSON to block session close. 3-attempt re-entry guard per active plan slug via `session-state/precompletion-attempts.json`; after 3 attempts soft-nudges and allows stop to prevent infinite loop. LEAN density mode: soft nudge only. MINIMAL: skipped entirely.

- **Opt-out:** `MEOWKIT_PRECOMPLETION=off`
- **Density:** `MEOWKIT_HARNESS_MODE=LEAN` → soft nudge; `MEOWKIT_HARNESS_MODE=MINIMAL` → skip
- **Timeout:** 5s
- **Source:** `.claude/hooks/pre-completion-check.sh`

## Conversation Summary Cache (Phase 9 — Dual-Event)

### `conversation-summary-cache.sh`

Registered under both **Stop** and **UserPromptSubmit**. Branches on `$HOOK_EVENT_NAME`.

**Stop path:** checks throttle conditions (transcript size > `MEOWKIT_SUMMARY_THRESHOLD` AND event delta ≥ `MEOWKIT_SUMMARY_TURN_GAP` OR growth delta ≥ `MEOWKIT_SUMMARY_GROWTH_DELTA`). When conditions are met, spawns a detached `nohup bash worker &` + `disown` (fire-and-forget) that runs `claude -p --model haiku` on the tailed transcript (~60–120s wall time). The hook itself returns in <100ms — the agent is never blocked by Haiku latency. The worker scrubs secrets via `lib/secret-scrub.sh` and atomically writes `.claude/memory/conversation-summary.md`. Lock at `session-state/conversation-summary.lock` prevents overlapping workers (5-minute stale GC).

**UserPromptSubmit path:** reads the cache file, verifies `session_id` match, and emits a `## Prior conversation summary\n{body}\n---\n` block capped at 4KB to stdout (injected into context by Claude Code). Skips on session ID mismatch.

**Throttle defaults:**

| Env var                        | Default        | Semantic                                                                           |
| ------------------------------ | -------------- | ---------------------------------------------------------------------------------- |
| `MEOWKIT_SUMMARY_THRESHOLD`    | `20480` (20KB) | Min transcript size in bytes                                                       |
| `MEOWKIT_SUMMARY_TURN_GAP`     | `30`           | Min JSONL event delta between summaries (≈ 3–6 turns; "TURN_GAP" is a legacy name) |
| `MEOWKIT_SUMMARY_GROWTH_DELTA` | `5120` (5KB)   | Min transcript growth in bytes                                                     |
| `MEOWKIT_SUMMARY_BUDGET_SEC`   | `180`          | Background worker hard budget for `claude -p`                                      |

**Consumer chain:** background worker → `.claude/memory/conversation-summary.md` → UserPromptSubmit hook → stdout → Claude Code context injection → every meowkit agent.

**Cost:** ~$0.01–$0.02 per long session. Saves ~48KB/turn of full-transcript re-read.

**User-facing inspector:** `/mk:summary` (see [CLI Commands](/cli/commands)).

**Security:** summary is DATA per `injection-rules.md`. Output is secret-scrubbed before write. Prompt template forbids instruction-shaped content in the summary body.

**Graceful degradation:** if `claude` CLI is missing or summarization fails, the hook exits 0 silently.

- **Opt-out:** `MEOWKIT_SUMMARY_CACHE=off` (disables both Stop and UserPromptSubmit paths)
- **Debug:** `MEOWKIT_SUMMARY_DEBUG=1` — verbose stderr
- **Source:** `.claude/hooks/conversation-summary-cache.sh`

## Node.js Dispatch System (v2.3.0)

`dispatch.cjs` is a central Node.js dispatcher registered in `settings.json` alongside existing shell hooks. It reads `handlers.json` at runtime and dispatches to handler modules sequentially for each event.

**Usage in settings.json:**
```
node dispatch.cjs <EventName> [Matcher]
```

**Graceful degradation:** if `handlers.json` is missing or a handler throws, `dispatch.cjs` exits 0 — it never blocks Claude Code.

**Security note:** `gate-enforcement.sh` and `privacy-block.sh` are intentionally outside the dispatcher. They stay as independent entries in `settings.json`.

### Handler Modules

| Handler | File | Event | Matcher | Stdin Fields Used | Output |
|---------|------|-------|---------|-------------------|--------|
| model-detector | `handlers/model-detector.cjs` | SessionStart | — | `model` | Writes `session-state/detected-model.json`; stdout model tier line |
| orientation-ritual | `handlers/orientation-ritual.cjs` | SessionStart | — | — | Resumes from checkpoint if exists |
| build-verify | `handlers/build-verify.cjs` | PostToolUse | Edit\|Write | `tool_input.file_path` | Runs compile/lint; cached by file hash |
| loop-detection | `handlers/loop-detection.cjs` | PostToolUse | Edit\|Write | `tool_input.file_path` | Warns at 4 edits, escalates at 8 |
| budget-tracker | `handlers/budget-tracker.cjs` | PostToolUse | Edit\|Write, Bash | `tool_input`, `tool_response` | Estimates cost; warns $30, blocks $100 |
| auto-checkpoint | `handlers/auto-checkpoint.cjs` | PostToolUse | Edit\|Write | `tool_input.file_path` | Checkpoint every 20 calls |
| checkpoint-writer | `handlers/checkpoint-writer.cjs` | Stop | — | — | Sequenced checkpoint with git state |

> **Note:** The `memory-loader.cjs` handler was removed in v2.4.1. Memory is now loaded on-demand by consumer skills — there is no per-turn auto-injection.

### Shared Libraries

| Library | File | Purpose |
|---------|------|---------|
| parse-stdin | `lib/parse-stdin.cjs` | Parses Claude Code JSON-on-stdin once; `dispatch.cjs` passes result to all handlers |
| shared-state | `lib/shared-state.cjs` | In-process state bag for cross-handler state sharing |
| checkpoint-utils | `lib/checkpoint-utils.cjs` | Read/write checkpoint files; shared by orientation-ritual and checkpoint-writer |

## State Files Table

| File                                        | Writer                                           | Purpose                                                        |
| ------------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------- |
| `session-state/edit-counts.json`            | `post-write-loop-detection.sh`                   | Per-file edit counter, keyed `{session_id}:{realpath}`         |
| `session-state/precompletion-attempts.json` | `pre-completion-check.sh`                        | Pre-completion re-entry guard per plan slug                    |
| `session-state/build-verify-cache.json`     | `post-write-build-verify.sh`                     | File-content-hash cache for skip-on-unchanged                  |
| `session-state/conversation-summary.lock`   | `conversation-summary-cache.sh` (Stop bg worker) | Phase 9 mutex preventing overlapping background summarizers    |
| `.claude/memory/conversation-summary.md`    | `conversation-summary-cache.sh` (Stop bg worker) | Phase 9 cache — read by UserPromptSubmit hook every turn       |
| `session-state/learning-observer.jsonl`     | `learning-observer.sh`                           | Churn pattern log                                              |
| `session-state/active-plan`                 | `mk:harness`, `mk:plan-creator`              | Currently active plan slug (read by `pre-completion-check.sh`) |
| `session-state/last-session-id`             | `project-context-loader.sh`                      | Session change detection                                       |

## Env Var Bypasses

| Var                              | Effect                                                                |
| -------------------------------- | --------------------------------------------------------------------- |
| `MEOWKIT_BUILD_VERIFY=off`       | Skip `post-write-build-verify.sh`                                     |
| `MEOWKIT_LOOP_DETECT=off`        | Skip `post-write-loop-detection.sh`                                   |
| `MEOWKIT_PRECOMPLETION=off`      | Skip `pre-completion-check.sh`                                        |
| `MEOWKIT_HARNESS_MODE=LEAN`      | PreCompletion falls back to soft nudge; BuildVerify still runs        |
| `MEOWKIT_HARNESS_MODE=MINIMAL`   | Skip BuildVerify + PreCompletion entirely                             |
| `MEOW_HOOK_PROFILE=fast`         | Skip `pre-ship`, `post-session`, `learning-observer` (speed)          |
| `MEOWKIT_SUMMARY_CACHE=off`      | Skip `conversation-summary-cache.sh` (both Stop and UserPromptSubmit) |
| `MEOWKIT_SUMMARY_THRESHOLD=N`    | Override 20KB transcript threshold for summarization                  |
| `MEOWKIT_SUMMARY_TURN_GAP=N`     | Override 30-event minimum gap between summaries                       |
| `MEOWKIT_SUMMARY_GROWTH_DELTA=N` | Override 5KB growth-delta minimum between summaries                   |
| `MEOWKIT_SUMMARY_BUDGET_SEC=N`   | Background worker hard budget for `claude -p` (default 180s)          |
| `MEOWKIT_SUMMARY_DEBUG=1`        | Verbose stderr from `conversation-summary-cache.sh`                   |
