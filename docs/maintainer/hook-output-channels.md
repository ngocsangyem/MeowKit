# Hook output channels

Where each kit hook's output goes on each runtime, and whether the model can see it. A hook
whose text is meant for the model must use a channel the host documents as model-visible;
anything else reaches only the user (transcript) or a state file.

Every row is **documented, not probed**: it follows the host documentation, not a live run
(see `host-probe-log.md`, P1; the tool-event `additionalContext` row cites the hooks reference). Checked 2026-11-16.

## Host rules this table relies on

| Host | Model-visible | User or transcript only |
|---|---|---|
| Claude Code | `hookSpecificOutput.additionalContext` on PreToolUse, PostToolUse, PostToolUseFailure, UserPromptSubmit, SessionStart; exit 2 + stderr on PostToolUse; plain stdout on UserPromptSubmit and SessionStart; Stop `decision: "block"` + `reason` | plain stdout on PreToolUse and PostToolUse; any stderr at exit 0 |
| Codex | Stop `decision: "block"` + `reason`, or exit 2 + stderr | `systemMessage` |
| Cursor | `sessionStart` `additional_context`; `stop` / `subagentStop` `followup_message` | `user_message`; telemetry files |

Claude Code caps one hook's model-visible text at 10,000 characters; the dispatcher truncates
`context` to fit.

## How a Claude Code observer reaches the model

A handler returns `{ context: "..." }`. `dispatch.cjs` then:

- on PreToolUse, PostToolUse and PostToolUseFailure, sends it as `hookSpecificOutput.additionalContext`;
- on UserPromptSubmit and SessionStart, writes it as plain stdout, or as `additionalContext` when a JSON document goes out;
- when any observer exits non-zero, writes it to stderr (exit 2 on PostToolUse shows stderr; the host ignores stdout JSON then);
- on any other event (Stop, PreCompact), drops it and reports that on stderr, since the dispatcher has no model-visible field for it there.

stdout is either plain text or one JSON document. When a document goes out, leftover plain
stdout rides in it: as more `additionalContext` on UserPromptSubmit and SessionStart, and as
`systemMessage` (shown to the user) elsewhere, so a user notice such as `budget-tracker`'s is
not lost. Tests: `tests/hooks/model-context-channel.test.ts`.

## Claude Code handlers (`.claude/hooks/handlers.json`)

| Handler | Event | Audience | Channel |
|---|---|---|---|
| `pre-task-check` | PreToolUse Bash | model (on a finding) | `additionalContext`; clean result is plain stdout (transcript) |
| `build-verify` | PostToolUse Edit\|Write | model (on a failure) | exit 2 + stderr |
| `loop-detection` | PostToolUse Edit\|Write | model (at 4, 8, then every 4 edits) | `additionalContext` |
| `post-write` | PostToolUse Edit\|Write | model | BLOCK finding: exit 2 + stderr; warnings only: `additionalContext` |
| `budget-tracker` | PostToolUse Edit\|Write, Bash | user | plain stdout (transcript); state `budget-state.json`. Kept from the model on purpose |
| `auto-checkpoint` | PostToolUse Edit\|Write | state | checkpoint files |
| `learning-observer` | PostToolUse Edit\|Write | state | telemetry |
| `review-evidence-tag` | PostToolUse Bash | state | trace |
| `verification-evidence` | PostToolUse Bash, SessionStart | state | evidence ledger |
| `checkpoint-writer` | Stop | state | checkpoint file |
| `post-session` | Stop | state | cost log, trace, sentinel |
| `control-probe` | Stop | state | telemetry |
| `pre-completion-check` | Stop | model (opt-in) | `decision: "block"` + `reason` |
| `model-detector` | SessionStart | model | plain stdout |
| `orientation-ritual` | SessionStart | model | plain stdout |
| `project-context-loader` | SessionStart | model | plain stdout |
| `jira-env-loader` | SessionStart | model | plain stdout |
| `capability-bootstrap` | SessionStart | model | plain stdout |
| `safety-sentinel-inject` | UserPromptSubmit | model | plain stdout |
| `tdd-flag-detector` | UserPromptSubmit | state | TDD sentinel file |
| `precompact-probe` | PreCompact | state | telemetry |
| `posttoolfailure-probe` | PostToolUseFailure | state | telemetry |

Guards registered outside the dispatcher (`privacy-block`, `pre-ship`, write guards) answer with
the host's permission decision; their channel is the decision itself.

## Codex hooks (`kit/overlays/codex/files/.codex/hooks.json`)

| Hook | Event | Audience | Channel |
|---|---|---|---|
| `privacy-block` | PreToolUse Bash | model + user | permission decision |
| `pre-ship` | PreToolUse Bash | model + user | permission decision |
| `completion-check` | SessionStart, PostToolUse Bash | state | session baseline, evidence |
| `completion-check` | Stop (opt-in) | model | `decision: "block"` + `reason`; a notice is `systemMessage` (user) |

## Cursor hooks (`kit/overlays/cursor/files/.cursor/hooks.json`)

| Hook | Event | Audience | Channel |
|---|---|---|---|
| `session-context` | sessionStart | model | `additional_context` |
| `completion-check` | sessionStart, postToolUse, stop | state; model on stop (opt-in) | `followup_message` |
| `stop-followup` | stop | model | `followup_message` |
| `subagent-lifecycle` | subagentStart, subagentStop | user; model on stop | `user_message`; `followup_message` |
| `telemetry-observers` | sessionEnd, postToolUse, postToolUseFailure, afterFileEdit, afterShellExecution, afterMCPExecution | state | telemetry files |
| `privacy-read-gate`, `shell-gate`, `mcp-gate`, `tool-gate`, `pre-ship` | before* / preToolUse | model + user | permission decision |

Codex and Cursor have no per-edit observers (`build-verify`, `loop-detection`, `budget-tracker`,
`pre-task-check`); nothing there writes model text to a channel the host does not show.
