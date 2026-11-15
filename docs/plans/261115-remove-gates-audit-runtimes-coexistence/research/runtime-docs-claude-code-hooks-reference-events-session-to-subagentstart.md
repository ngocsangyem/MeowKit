# Claude Code hooks reference: SessionStart .. SubagentStart

## Scope
- File: `claude/hooks.md` (tmp/runtime-docs-261115/claude/hooks.md). Range L1272-L2680. Every line read (4 chunks, 1272-2680). Cites below = `claude/hooks.md:L..`.
- Common input fields, exit-code semantics, "Add context for Claude", JSON output generic fields live outside range (referenced via anchors only).

## SessionStart (L1276-1434)
- Fires on new session or resume. Only `command` and `mcp_tool` hook types supported (L1278-1280). Keep fast; runs every session (L1280).
- Matcher = how session started (L1282-1290):

| Matcher | Fires |
|---|---|
| `startup` | new session |
| `resume` | `--resume`, `--continue`, `/resume` |
| `clear` | `/clear` |
| `compact` | auto or manual compaction |
| `fork` | forked session (`--fork-session`, `/fork`, `/branch`, moved to background) |

- Interactive: hooks run in background at start/resume/clear; first Claude response and any prompt sent wait for hooks (L1292-1296). `/resume` switch waits (L1294). If `/clear` or conversation switch happens while hooks run, their output does not apply (L1294).
- Input beyond common (L1302-1309): `source` (startup|resume|clear|compact|fork), `model` (may be omitted, check first), `agent_type` (only with `claude --agent <name>`), `session_title` (only if custom title set).
- On `resume`/`fork` with >=1 Claude response, extra fields, need v2.1.251+ (L1313-1320): `seconds_since_last_response`, `context_tokens`, `prompt_cache_likely_expired`, `estimated_cache_write_usd`.
- Output fields (L1341-1349), plus generic JSON fields:

| Field | Meaning |
|---|---|
| `additionalContext` | string added to Claude's context at conversation start, before first prompt |
| `initialUserMessage` | first user message, `-p` non-interactive only |
| `sessionTitle` | like `/rename`; applies for source startup/resume/fork |
| `watchPaths` | absolute paths for FileChanged events |
| `reloadSkills` | bool; re-scan skill/command dirs after SessionStart hooks finish |

- Plain-text stdout is added to Claude's context (L1363). JSON goes under `hookSpecificOutput` with `hookEventName: "SessionStart"` (L1355-1360).
- Plugin-supplied `initialUserMessage`/`sessionTitle` ignored if plugin finishes installing after hooks ran (L1365).
- `reloadSkills`: skill discovery normally runs before SessionStart hooks finish, so skills a hook writes into `~/.claude/skills/` or `.claude/skills/` may be missing at first prompt (L1369).
- `CLAUDE_ENV_FILE`: path for persisting env vars for later Bash commands; append `export` lines with `>>` (L1386-1388). Available only to SessionStart, Setup, CwdChanged, FileChanged; not other events, not PowerShell-run hooks (L1434). File contents run as shell code before each Bash command (L1421). PowerShell gets vars only if every line is plain assignment (v2.1.296+) (L1425-1430).
- Blocking: not stated for SessionStart in this section (no decision control listed, L1341).

## Setup (L1436-1473)
- Fires only with `--init-only`, or `--init`/`--maintenance` with `-p`; not on normal startup (L1438). Matcher: `init` | `maintenance` (L1440-1445). `--init-only` also runs SessionStart `startup` hooks then exits (L1447).
- Input: common + `trigger` = `"init"`|`"maintenance"` (L1457).
- Cannot block; continues on any exit code; JSON output fields discarded on every exit code (`systemMessage`, `continue`, `additionalContext`) (L1471). With `-p` output only as `hook_response` events under `--output-format stream-json --verbose` (L1471).
- Has `CLAUDE_ENV_FILE` (L1473). Only `command` hooks run; `mcp_tool` skipped (L1473).

## InstructionsLoaded (L1475-1510)
- Fires when CLAUDE.md or `.claude/rules/*.md` loaded (session start eager; later lazy: nested CLAUDE.md, `paths:` frontmatter match). No blocking; async, observability (L1477). Does not fire for AGENTS.md read directly via Project instructions setting; fires when CLAUDE.md imports it (`load_reason` `include`) or symlinks it (L1479).
- Matcher runs on `load_reason` (L1481).
- Input (L1487-1494): `file_path`, `memory_type` (User|Project|Local|Managed), `load_reason` (session_start|nested_traversal|path_glob_match|include|compact), `globs` (path_glob_match only), `trigger_file_path`, `parent_file_path` (include only).
- No decision control; JSON fields (`systemMessage`, `continue`) discarded (L1510).

## UserPromptSubmit (L1512-1596)
- Fires when prompt submitted, before Claude processes it (L1514). Also fires for: scheduled-task/`/loop` firings, background subagent reporting back, messages from another session, Code Mode output (L1518-1523). No matcher mentioned in this section.
- Default timeout 30 s for command/http/mcp_tool (vs 600 s elsewhere) (L1525). On timeout (non-async): hook cancelled, output incl. `additionalContext` discarded, prompt still reaches Claude without context; `onFailure: "block"` on command/http hook blocks instead (L1527). SDK callback timeout blocks the prompt (L1529).
- `Esc` during check: prompt does not reach Claude, text returns to input (L1533); if a hook blocks at same moment, prompt stays blocked (L1535).
- Input: common + `prompt` (pasted text expanded in place; may be wrapped in `<pasted_content id=..>` lines) (L1539); `session_title` if custom title (L1541). Skill/custom command arrives as typed (e.g. `/deploy staging`), not expanded; blocking prevents command and its `!` shell injection (L1554). Use UserPromptExpansion to match command names (L1554).
- Context on exit 0, two ways (L1560-1563): plain-text stdout, or JSON `additionalContext`. Neither is a visible transcript entry; each injected as a system reminder starting with hook name (L1565).
- Block output (L1567-1575):

| Field | Meaning |
|---|---|
| `decision` | `"block"` stops prompt before Claude; omit to allow (top-level) |
| `reason` | shown to user on block; not added to context (except Code Mode block) |
| `additionalContext` | added to context alongside prompt (in `hookSpecificOutput`, L1585) |
| `sessionTitle` | sets session title |
| `suppressOriginalPrompt` | `true` omits prompt text from block message |

- Exit 2 blocks; stderr treated like `reason` (L1577). Block message by default ends with `Original prompt:` + text and is written to transcript file; `suppressOriginalPrompt` works for both decision:block and exit 2 (L1594). Text can still be in transcript and prompt history (L1596).

## UserPromptExpansion (L1598-1646)
- Fires when a user-typed command expands to a prompt, before reaching Claude (L1600). Covers `/skillname` typed directly, which bypasses PreToolUse (L1602). Matcher: `command_name`; empty = every prompt-type command (L1604).
- Input: `expansion_type` (`slash_command` | `mcp_prompt`), `command_name`, `command_args`, `command_source`, `prompt` (L1608).
- Output (L1629-1633): `decision: "block"` (prevents expansion), `reason` (shown to user), `additionalContext` (added alongside expanded prompt). Exit 2 blocks; stderr shown to user (L1635).

## MessageDisplay (L1648-1776)
- Runs while assistant message streams; per batch of completed lines (L1650). Display-only: transcript and Claude keep original (L1660). No matcher (L1662). Default timeout 10 s; failure/timeout displays original (L1658).
- Input: `turn_id`, `message_id`, `index`, `final`, `delta` (L1672-1676). `-p`/SDK: single call per message, `index` 0, `final` true (L1664).
- Output: `displayContent` replaces delta (L1698). No decision control; `systemMessage`/`continue` discarded (L1700).

## PreToolUse (L1778-2151)
- Fires after Claude creates tool params, before the call is processed. Matches any tool name except `EndConversation`: Bash, PowerShell, Edit, Write, Read, Glob, Grep, Agent, Workflow, WebFetch, WebSearch, AskUserQuestion, ExitPlanMode, plus MCP tools (L1780).
- Does NOT fire for `@`-referenced files in prompt (inserted without tool call), incl. hooks matching `Read` (L1786). Mitigation: `Read` deny rule, or `CLAUDE_CODE_DISABLE_FILE_MENTIONS=1` (v2.1.299+, ignored in project/local settings) (L1790-1791). Does not fire for `EndConversation` (L1786).
- SDK callback timeout on PreToolUse blocks the call (L1795).
- Input: common + `tool_name`, `tool_input`, `tool_use_id` (L1799). MCP tools also get `mcp_server` {name, source} (v2.1.274+); base trust on `source`, not name/prefix (L1801).
- File tools: `tool_input.file_path` always absolute; `~`/relative expanded before hooks (L1803-1805). Windows: backslash separators; forward-slash comparisons never match, tool proceeds (L1806-1808).

### tool_input per tool (L1824-1998)
| Tool | Fields (type) |
|---|---|
| Bash (L1830-1835) | `command` str; `description` str opt; `timeout` num ms opt (over max is clamped); `run_in_background` bool |
| PowerShell (L1862-1867) | same four as Bash. Match `Bash\|PowerShell` to cover both; on Windows w/o Git Bash Bash tool not registered, Bash-only matcher never fires (L1869-1873) |
| Write (L1879-1882) | `file_path` str abs; `content` str |
| Edit (L1888-1893) | `file_path` str abs; `old_string` str; `new_string` str; `replace_all` bool |
| Read (L1899-1903) | `file_path` str abs; `offset` num opt; `limit` num opt |
| Glob (L1909-1912) | `pattern` str; `path` str opt |
| Grep (L1918-1925) | `pattern` str; `path` opt; `glob` opt; `output_mode` (`content`/`files_with_matches`/`count`, default files_with_matches); `-i` bool; `multiline` bool |
| WebFetch (L1931-1935) | `url` str; `prompt` str; `offset` num opt (v2.1.290+) |
| WebSearch (L1941-1946) | `query` str; `allowed_domains` arr; `blocked_domains` arr; `mode` (`standard`/`extended`, v2.1.282+, may be absent) |
| Agent (L1952-1957) | `prompt` str; `description` str; `subagent_type` str; `model` str opt alias |
| AskUserQuestion (L1983-1986) | `questions` arr (1-4; each `question`,`header`,`options`,`multiSelect`); `answers` obj opt (not set by Claude; supply via `updatedInput`) |
| ExitPlanMode (L1992-1996) | `plan` str (injected); `planFilePath` str (injected); `allowedPrompts` arr DEPRECATED, accepted but ignored (before v2.1.205 carried permissions). Model's literal input typically empty (L1990) |

- Bash edit diff: PostToolUse gets `tool_response.bashEditDiff` (v2.1.269+) when `bashEditDiffEnabled` on or auto/bypassPermissions mode; best effort, public beta, "not to enforce policy" (L1837-1843). Fields: `changedFiles` (max 200), `files` (diffs of up to 5), `moreFiles`, `unavailable`, `skipped`, `shared` (L1849-1854).
- Agent PostToolUse `tool_response` (foreground): `status` (completed|async_launched), `agentId`, `content`, `resolvedModel`, `modelsUsed`, `totalTokens`, `totalDurationMs`, `totalToolUseCount`, `usage` (L1961-1971). Background: `status: async_launched`, `agentId`, `description`, `prompt`, `outputFile`, `resolvedModel`, no usage (L1975). v2.1.271+ subagent in auto mode reports via `SubagentHandback`; read it with PreToolUse/PostToolUse matcher `SubagentHandback`, `tool_input.message` (L1973).

### Decision control (L2000-2059)
- Decision lives in `hookSpecificOutput` (L2002). Fields (L2006-2009):

| Field | Meaning |
|---|---|
| `permissionDecision` | `allow` / `deny` / `ask` / `defer` |
| `permissionDecisionReason` | ask: shown to user (in `-p` where no one can answer and call denied, Claude reads it in tool result); deny: shown to Claude; allow/defer: debug log only |
| `updatedInput` | replaces ENTIRE input object (include unchanged fields); permission rules and Bash auto-background eligibility evaluated on hook's input; combine with allow or ask; ignored for defer; with no `permissionDecision`, auto mode can deny changed call |
| `additionalContext` | added to Claude's context alongside tool result; ignored when defer |

- `allow` skips permission prompt EXCEPT actions no mode auto-approves and reads from network paths; also not for SDK `always_ask` tools unless mode approves; deny and ask rules still evaluated whatever the hook returns (L2006). `AskUserQuestion`/`ExitPlanMode` need `updatedInput` with `allow` (L2006, L2071).
- `deny` prevents call; `ask` prompts user; `defer` ends turn, requires `-p` (L2006).
- Precedence with multiple hooks: `deny` > `defer` > `ask` > `allow` (L2011).
- Exit 2 = same as `deny`; Claude sees stderr as reason (L2013).
- `ask` prompt labelled `[settings]` / `[plugin:<name>]` / `[skill]` (L2015).
- DEPRECATED: top-level `decision`/`reason` for PreToolUse; `"approve"` -> `"allow"`, `"block"` -> `"deny"`. PostToolUse/Stop keep top-level (L2033).
- Auto mode: `updatedInput` without `permissionDecision` may be denied ("a hook changed this call's input after auto mode reviewed it"); on repeat identical call hook's `updatedInput` dropped (L2037-2046). `command` hooks in settings/plugins can change Bash, PowerShell, Monitor, Edit, Write, NotebookEdit without that denial in such sessions, with exceptions (L2050).
- Auto mode `ask` goes to the permission prompt, classifier doesn't decide; protected-path writes/unsandboxed commands may be classifier-denied first (L2054-2056). `SubagentHandback`: no prompt, runs even if classifier objects; `deny` stops it, subagent told up to 3 times to retry, then ends without report (L2057-2059).
- Non-interactive: `AskUserQuestion`/`ExitPlanMode` offered in `-p` only with a permission host (e.g. `canUseTool`); hook satisfies by returning `allow` + `updatedInput` answers; `allow` alone insufficient (L2063-2071). MCP tool with `_meta["anthropic/requiresUserInteraction"]`: `allow` cannot skip prompt, with or without `updatedInput` (L2095).
- `defer` (L2097-2151): for `claude -p` subprocess integrations. Honored only in `-p` and only when Claude makes a single tool call in the turn; interactive = warning logged, result ignored; multiple calls = ignored with warning, normal permission flow (L2101-2104). Turn ends with `stop_reason: "tool_deferred"`, `deferred_tool_use` {id,name,input}; resume with `claude -p --resume <session-id>`, hook fires again (L2108-2125). No timeout/retry limit; session kept per `cleanupPeriodDays` (30 d default) (L2130). `tool_deferred_unavailable` when tool missing on resume; PreToolUse does not fire; `CLAUDE_CODE_DROP_UNAVAILABLE_DEFERRED_TOOL=1` drops (L2142-2151).

## PermissionRequest (L2153-2261)
- Fires when Claude Code is about to ask for permission. In sessions that can't show a prompt (e.g. background subagents in non-interactive mode) hooks still run; if no hook decides, call is denied (L2155). With `--permission-prompt-tool`/SDK `canUseTool`, hooks run alongside host, first decision wins (L2155). Not run for sandbox network requests (L2160); not for `EndConversation` (L2170). Matcher: tool name, same as PreToolUse (L2162).
- Input: `tool_name`, `tool_input` (no `tool_use_id`), `mcp_server` for MCP, optional `permission_suggestions` (L2166).
- Output `decision` object inside `hookSpecificOutput` (L2197-2205, L2213-2221): `behavior` allow|deny; `updatedInput` (allow only; re-checked vs deny/ask rules); `updatedPermissions` (allow only); `message` (deny only, tells Claude); `interrupt` (deny only, stops Claude). Deny/ask rules still win over allow (L2201).
- Exit 2 without `decision` object leaves flow unchanged, stderr discarded (L2209).
- Permission update entry types (L2229-2236): `addRules`, `replaceRules`, `removeRules`, `setMode` (default, auto, acceptEdits, dontAsk, bypassPermissions, plan, manual=alias default), `addDirectories`, `removeDirectories`. `destination`: `session`, `localSettings` (.claude/settings.local.json), `projectSettings` (.claude/settings.json), `userSettings` (~/.claude/settings.json) (L2254-2259). `bypassPermissions` setMode often no-op; never persisted as defaultMode (L2248-2250).

## PostToolUse (L2263-2380)
- Fires immediately after a tool completes SUCCESSFULLY (L2265). Matcher tool name, same as PreToolUse; omit or `"*"` for all (L2267-2270). Does not fire for `Edit|Write` when Bash or outside process rewrites the file; use FileChanged (L2272).
- After interrupt: `Ctrl+Enter` gives hooks 10 s; `Esc` cancels hooks; command hook still running at 10 s killed regardless of `timeout`; `async: true` can't block/rewrite (L2276-2282).
- Input: `tool_name`, `tool_input`, `tool_response` (tool-specific structured object, e.g. Write `{filePath,type}`), `tool_use_id`, `duration_ms` optional (excludes permission prompts and PreToolUse hooks) (L2288-2313). Paths absolute, native separators (L2288).
- Output (L2319-2326):

| Field | Meaning |
|---|---|
| `decision` | `"block"` adds `reason` next to tool result; Claude still sees original output |
| `reason` | explanation shown to Claude on block |
| `additionalContext` | added to Claude's context alongside result |
| `classifierContext` | note for auto-mode classifier, not Claude (v2.1.236+); cap 2,000 chars per call, sync responses only |
| `updatedToolOutput` | replaces tool output seen by Claude; must match tool output shape, mismatched built-in value ignored; MCP not validated |
| `updatedMCPToolOutput` | MCP only; prefer `updatedToolOutput` |

- Cannot undo: tool already ran; `updatedToolOutput` changes only what Claude sees; telemetry keeps original (L2347). Use PreToolUse to prevent/modify (L2347).

## PostToolUseFailure (L2382-2442)
- Fires when a started tool fails (threw, or MCP error result) (L2384). Matcher tool name (L2386). NOT fired for pre-execution rejections (unknown tool, schema/validation failure -> `tool_use_error`, permission denial) (L2390).
- Input: same `tool_name`/`tool_input`, `tool_use_id`, plus `error` (string; format tool-dependent), `is_interrupt` (opt bool; cancelling a running tool does not fire this hook), `duration_ms` (opt) (L2394-2419). For Bash/PowerShell `error` first line `Exit code N` then interleaved output; may be bare message if shell couldn't start; long strings middle-truncated (L2421-2425). Treat everything but `tool_name`, `is_interrupt`, `Exit code N` as display text (L2421).
- Output: `additionalContext` only (hookSpecificOutput) (L2431-2441). No block semantic stated.

## PostToolBatch (L2444-2499)
- Fires once after all tool calls in a batch resolve, before next model request; no matcher (L2446). Input: `tool_calls` array each {`tool_name`,`tool_input`,`tool_use_id`,`tool_response`}; `tool_response` is serialized tool_result content, differs from PostToolUse's structured object (L2450-2480).
- Output: `additionalContext` injected once before next model call (L2488). `decision: "block"` or `continue: false` stops agentic loop before next model call; message from `reason`/`stopReason` or stderr on exit 2; shown as transcript warning, stays in conversation (L2499).

## PermissionDenied (L2501-2547)
- Fires only when auto mode denies a call (incl. no-verdict denials); NOT for manual dialog denials, PreToolUse blocks, or `deny` rules (L2503). Matcher tool name (L2505).
- Input: `tool_name`, `tool_input`, `tool_use_id`, `reason`, `mcp_server` (MCP) (L2509). `reason` forms: `[RuleName]`, "Auto mode could not evaluate...", `Classifier unavailable` (L2530).
- Output: `hookSpecificOutput.retry: true` makes Claude Code tell model it may retry; denial itself not reversed; ignored for no-verdict denials (L2534-2547).

## Notification (L2549-2641)
- Matcher = notification type; omit for all (L2551). Types (L2555-2570): `permission_prompt` (waited ~6 s), `idle_prompt` (~60 s after finish), `auth_success`, `auth_storage_failure` (v2.1.288+), `elicitation_dialog`, `elicitation_url_dialog`, `elicitation_complete`, `elicitation_response`, `agent_needs_input`, `agent_completed`, `quota_auto_resume_fired|stale|disabled` (v2.1.234+), `plugin_notification`.
- Fires even with desktop notifications disabled (L2553). Input: `message`, optional `title`, `notification_type` (L2627). Cannot block/modify; `systemMessage`/`continue` discarded, `terminalSequence` still emitted (L2641).

## SubagentStart (L2643-2679)
- Fires when Claude spawns subagent via Agent tool, resumes a subagent, and each time an in-process agent-team teammate handles a new message (L2645). Matcher = agent type: built-in names (`general-purpose`, `Explore`, `Plan`); custom = frontmatter `name`, not filename (L2645). Plugin agents = `plugin:name` (e.g. `my-plugin:reviewer`); anchor regex `^...$` for exact match (L2647).
- Input: common + `agent_id`, `agent_type` (L2651).
- Cannot block subagent creation; may inject context (L2664). Output: `additionalContext` (hookSpecificOutput, `hookEventName: "SubagentStart"`) added to subagent context before its first prompt (L2666-2676).
- Re-run for same subagent: context injected again only if not already in subagent context; copy from launch persists; re-injected after auto-compaction discards it (L2679).

## Answers to open questions
1. PreToolUse `permissionDecision` valid: `allow`, `deny`, `ask`, `defer` (L2006). Deprecated top-level `approve`/`block` map to allow/deny (L2033). `ask` in non-interactive/background: page says only that in a `-p` run where no one can answer the prompt Claude Code denies the call and Claude reads the reason in tool result (L2007); `ask` in auto mode goes to the prompt (L2054). `defer` exists, `-p` only, single tool call only (L2101).
2. Precedence `deny` > `defer` > `ask` > `allow` (L2011). Deny/ask permission rules still evaluated regardless of hook (L2006).
3. SessionStart `source`: startup, resume, clear, compact, fork (L1306). Both `additionalContext` (JSON) and plain stdout are added to context (L1345, L1363). `CLAUDE_ENV_FILE` available (L1386, L1434).
4. UserPromptSubmit: plain stdout and JSON `additionalContext` both injected as system reminder, invisible in transcript (L1560-1565). Block via `decision:"block"` or exit 2: prompt never reaches Claude; `reason`/stderr shown to user, not added to context (L1571-1577); block message with original prompt written to transcript (L1594).
5. SubagentStart cannot block, only add context (L2664). Input `agent_id`, `agent_type` (L2651).
6. PostToolUse cannot undo (L2347). `decision:"block"` only adds `reason` beside the result; Claude still sees original (L2321). `updatedToolOutput` (all tools) and `updatedMCPToolOutput` (MCP only, prefer first) replace what Claude sees (L2325-2326).

## Not stated (in this range)
- Exit code 2 behavior generally, exit 0 vs other codes, JSON output generic fields (`continue`, `stopReason`, `systemMessage`, `suppressOutput`), stdout size limits / injected-context size cap, "Add context for Claude" delivery rules (anchors only, L1345, L1573, L2009).
- Common input fields list (anchor only).
- Whether SessionStart can block; any SessionStart/UserPromptSubmit matcher support for UserPromptSubmit (none stated).
- `ask` behavior in background subagent for PreToolUse beyond L2007; PreToolUse behavior in other non-interactive contexts.
- Hook `timeout` defaults beyond UserPromptSubmit 30 s, MessageDisplay 10 s (600 s default mentioned L1525); `async` details; `onFailure` semantics (anchor only).
- Output size caps for `additionalContext` (only `classifierContext` 2,000 chars, L2373).
- Tool schemas for NotebookEdit, Monitor, Workflow, Skill, TodoWrite, others not given here.

## Anomalies
- No instructions addressed to an AI/agent found in range. Doc is plain reference.
- Example hook configs use `"args": []` alongside `command` (L1717, L1746-1753), field not defined in range.
- L1731, L1766 examples reference models/versions (`claude-opus-5`, v2.1.2xx-v2.1.319) fine as data.
- Doc mentions `SubagentHandback` as a Claude Code tool (L1965, L1973, L2057) - subagent reports in auto mode may not appear in `PostToolUse(Agent).content`.
- PostToolUse `tool_response` shape differs from PostToolBatch shape (L2480).

## Audit checkpoints
1. SessionStart matcher values must be among startup|resume|clear|compact|fork (L1284-1290); no other values valid.
2. SessionStart hooks must be `type: command` or `mcp_tool` only (L1280).
3. SessionStart output context via plain stdout OR `hookSpecificOutput.additionalContext` with `hookEventName:"SessionStart"` (L1363, L1355-1360); hook that must run on resume/compact needs matching matcher or none.
4. SessionStart hook writing env vars must append to `$CLAUDE_ENV_FILE` with `>>` and tolerate unset var (L1388-1393); var unavailable to PreToolUse/PostToolUse hooks (L1434).
5. SessionStart/Setup hooks should be fast; SessionStart blocks first response (L1280, L1292).
6. UserPromptSubmit hook script must finish under 30 s or set `timeout`; timeout discards its context silently (L1525-1527).
7. UserPromptSubmit blocking: `{"decision":"block","reason":...}` or exit 2 (stderr = reason); `reason` is user-facing, not model context (L1571-1577). Hook output that must reach Claude uses `additionalContext`/plain stdout.
8. UserPromptSubmit sees raw slash-command text, not expanded skill (L1554); a prompt-keyword hook will not see skill body; use UserPromptExpansion for command_name matching.
9. UserPromptSubmit also fires for scheduled tasks, background subagent reports, cross-session messages (L1518-1523); hooks must tolerate non-typed prompts.
10. PreToolUse deny decision must be `hookSpecificOutput.permissionDecision:"deny"` (+ `permissionDecisionReason`) or exit 2; top-level `decision:"block"`/`"approve"` is deprecated (L2013, L2033).
11. `hookEventName:"PreToolUse"` must accompany hookSpecificOutput (L2019-2020).
12. PreToolUse `updatedInput` replaces whole input; hook returning partial object loses fields (L2008).
13. PreToolUse `allow` does not override deny/ask rules (L2006); `ask` interplay with `-p` denies call (L2007); `defer` only meaningful in `-p` (L2101).
14. PreToolUse matchers `Edit|Write`, `Read`, `Bash` valid tool names (L1780); `Read` hook does not see `@`-mentioned files (L1786); on Windows w/o Git Bash use `Bash|PowerShell` (L1869-1873).
15. Edit/Write/Read path checks use `tool_input.file_path` (absolute, backslashes on Windows; normalize before comparing) (L1803-1808). Edit fields `old_string`/`new_string`/`replace_all`; Write fields `file_path`/`content` (L1888-1893, L1879-1882).
16. Bash hook reads `tool_input.command` (L1832); PostToolUse Bash may carry `tool_response.bashEditDiff` (best-effort, not for enforcement) (L1839-1843).
17. PostToolUse `Edit|Write` hook will not fire when Bash or external process modifies file (L2272).
18. PostToolUse `decision:"block"` does not undo or hide output; only appends `reason` (L2321, L2347). Gate/blocking logic placed in PostToolUse cannot prevent the action.
19. PostToolUse does not run on failure; failure handling needs a PostToolUseFailure hook (L2265, L2270). PostToolUseFailure does not fire for validation errors or permission denials (L2390); `error` field starts `Exit code N` for Bash (L2423); output limited to `additionalContext` (L2433).
20. PostToolUse hook running longer than 10 s after an interrupt is killed unless `async` (L2282).
21. SubagentStart matcher is the agent frontmatter `name` (plugin agents `plugin:name`) (L2645-2647); cannot block, only `additionalContext` into the subagent (L2664-2668); fires also on resume and per teammate message (L2645), so hook output must be idempotent.
22. Hooks on Setup/InstructionsLoaded/Notification/MessageDisplay cannot block or inject context; their `systemMessage`/`continue` are discarded (L1471, L1510, L1700, L2641).
23. `PermissionRequest` blocking requires a `decision` object; exit 2 alone does nothing (L2209). PermissionDenied only fires in auto mode (L2503).
24. PostToolBatch has no matcher; block there uses `decision:"block"` / `continue:false` (L2446, L2499).
