# Claude Code Hooks reference: config and I/O (cited findings)

## Scope
File `claude/hooks.md` (Hooks reference, 4347 lines). Ranges read in full, every line: L1-L1271 and L3972-L4347 (chunks of <=500 lines). L1272-L3971 (per-event sections) NOT read. Cites below are `claude/hooks.md:L..`.

## 1. Events and when they fire
Cadences: per session SessionStart/SessionEnd; per turn UserPromptSubmit/Stop/StopFailure; per tool call PreToolUse/PostToolUse (EndConversation skips both) (L21-25).
| Event | Fires | Source |
| :- | :- | :- |
| SessionStart | session begins or resumes | L33 |
| Setup | `--init-only`, or `--init`/`--maintenance` with `-p` | L34 |
| UserPromptSubmit | prompt submitted, before Claude processes; also on turns Claude Code starts itself | L35 |
| UserPromptExpansion | user-typed command expands to prompt; can block | L36 |
| PreToolUse | before tool call; can block | L37 |
| PermissionRequest | tool call needs permission decision | L38 |
| PermissionDenied | auto mode denies a call | L39 |
| PostToolUse | after tool call succeeds | L40 |
| PostToolUseFailure | after tool call fails | L41 |
| PostToolBatch | after parallel tool batch resolves, before next model call | L42 |
| Notification | Claude Code sends notification | L43 |
| MessageDisplay | assistant text displayed | L44 |
| SubagentStart / SubagentStop | subagent spawned / finishes | L45-46 |
| TaskCreated / TaskCompleted | task being created / marked completed | L47-48 |
| Stop | Claude finishes responding | L49 |
| StopFailure | turn ends on API error | L50 |
| TeammateIdle | agent-team teammate about to idle | L51 |
| InstructionsLoaded | CLAUDE.md or `.claude/rules/*.md` loaded (start + lazy) | L52 |
| ConfigChange | config file changes mid-session | L53 |
| CwdChanged / DirectoryAdded / FileChanged | cwd change / `/add-dir` / watched file change | L54-56 |
| WorktreeCreate / WorktreeRemove | worktree being created (replaces default git) / removed | L57-58 |
| PreCompact / PostCompact | before / after compaction | L59-60 |
| PreModelSwitch / PostModelSwitch | before switch (can block) / after model changes | L61-62 |
| Elicitation / ElicitationResult | MCP asks user input / after user responds | L63-64 |
| SessionEnd | session terminates | L65 |
Events that can block via exit 2 (L1025-1059): PreToolUse, UserPromptSubmit, UserPromptExpansion, Stop, SubagentStop, TeammateIdle, TaskCreated, TaskCompleted, ConfigChange (not policy_settings), PostToolBatch, PreCompact, PreModelSwitch, Elicitation, ElicitationResult, WorktreeCreate, WorktreeRemove.

## 2. Settings shape, locations, merge
- Three nesting levels: event -> matcher group -> hook handlers (L225-229).
- Locations (L241-249): `~/.claude/settings.json` (all projects, local); `.claude/settings.json` (project, committable); `.claude/settings.local.json` (project, gitignored on save); managed policy; plugin `hooks/hooks.json`; skill frontmatter (rest of session once invoked); subagent frontmatter (while that subagent runs).
- Cloud sessions do not read local `~/.claude/settings.json` (L251).
- Settings/managed/plugin hooks also run inside subagents; tool events fire same hooks; input carries `agent_id`, `agent_type` (L255).
- Merge: entries merge across levels, not replace; user/project/local cannot remove managed hooks (L266).
- Dedupe: identical handler defined in more than one settings file runs once; a plugin's or skill's copy stays separate (L409).
- Matching hooks for an event run in parallel; >12 prompt/agent hooks -> 12 at once, rest queue; timeout starts when each starts (L407).
- Plugin `hooks/hooks.json` accepts optional top-level `description`; merges with user and project hooks (L649).
- `allowManagedHooksOnly` (managed): blocks user, project, local, plugin hooks (managed-`enabledPlugins` force-enabled plugins exempt) (L257-259). `strictPluginOnlyCustomization` can lock hooks to plugins/managed; non-plugin skills lose frontmatter hooks (L708).
- HTTP allowlists `allowedHttpHookUrls`, `httpHookAllowedEnvVars` apply to all sources (L268-271).
- Direct edits to hooks in settings files are normally picked up by file watcher (L736). Snapshot-at-startup: NOT stated in these ranges.
- Skill hook limits (v2.1.304+): per source 1,024 hooks, matchers total 16,384 chars; over limit -> skill registers none of its hooks (L711, L715).
- Disable: `"disableAllHooks": true` in settings; value after settings precedence applies, so project `false` overrides user `true`; `--settings '{"disableAllHooks": true}'` beats project/local; no per-hook disable; managed hooks only disabled by managed-level setting (L732-734).
- `/hooks` = read-only browser, labels source of each hook (L722-726).

## 3. Matcher semantics
- `"*"`, `""`, or omitted = match all (L279, L195).
- Only letters/digits/`_`/`-`/space/`,`/`|` -> exact string or list split on `|` or `,` (L280). `Bash` also matches Monitor commands on PreToolUse/PermissionRequest (L280).
- Any other char -> JS regex, UNANCHORED, `RegExp.prototype.test`; `Edit.*` matches `Edit` and `NotebookEdit`; use `^Edit$` for whole match (L281-283). Case sensitivity: not stated.
- FileChanged and StopFailure: exact set is letters/digits/`_`/`|` only; hyphen/space/comma pushes to regex; only `|` separates (L285).
- Matcher on event without matcher support silently ignored (L337).
- Per-event matched field (L291-311): tool events (PreToolUse, PostToolUse, PostToolUseFailure, PermissionRequest, PermissionDenied) = tool name; SessionStart = `startup|resume|clear|compact|fork`; SubagentStart/SubagentStop = agent type; PreCompact/PostCompact = `manual|auto`; SessionEnd = reason; Setup = `init|maintenance`.
- No matcher support (always fires): UserPromptSubmit, PostToolBatch, Stop, TeammateIdle, TaskCreated, TaskCompleted, WorktreeCreate, WorktreeRemove, MessageDisplay, CwdChanged (L303, L311).
- MCP tools: `mcp__<server>__<tool>`; `mcp__memory` alone is exact-match and matches nothing, need `.*` (L345-355). Plugin MCP: `mcp__plugin_<plugin>_<server>__<tool>` (L357).
- Monitor: Bash-matcher hook also runs on Monitor commands but `allow`/`updatedInput` have no effect; `Bash|Monitor`, `.*`, or no matcher gives Monitor input with effect; v2.1.314+; PostToolUse Bash matcher does not run for Monitor (L390-395).
- `if` (L422-443): permission-rule syntax, one rule only (no `&&`/`||`/list); evaluated ONLY on PreToolUse, PostToolUse, PostToolUseFailure, PermissionRequest, PermissionDenied; on any other event a hook with `if` NEVER runs (L422, L427). Bash `if`: leading `VAR=value` stripped, each subcommand checked, `$()` and backticks checked; if input cannot be split, hook runs regardless; best-effort, use permission system for hard enforcement (L433-443). `Edit(src/**)` matches only top-level `src`; use `**/src/**` for any depth (L429). One `if` rule names one tool (L119).

## 4. Handler fields
Five types: `command`, `http`, `mcp_tool`, `prompt`, `agent` (L399-405). Agent hooks experimental (L405, L4113-4115).
Common (all types) (L419-425):
| Field | Req | Meaning |
| :- | :- | :- |
| `type` | yes | one of the five |
| `if` | no | see section 3 |
| `timeout` | no | seconds; defaults: 600 command/http/mcp_tool; 30 prompt; 60 agent. Command/http/mcp_tool default 30 on UserPromptSubmit, PreModelSwitch, PostModelSwitch; 10 on MessageDisplay. SessionEnd shares 1.5 s budget, raised to per-hook timeout up to 60 s. Not enforced on `async: true` command hook |
| `statusMessage` | no | custom spinner message |
| `once` | no | true = remove after first successful run; failure/exit 2/timeout keeps it. HONORED ONLY in skill frontmatter; ignored in settings files and agent frontmatter |
Command (L449-456):
| Field | Req | Meaning |
| :- | :- | :- |
| `command` | yes | shell command; with `args` = executable spawned directly |
| `args` | no | when present: exec form, no shell, placeholders substituted as plain strings; absent: shell form |
| `async` | no | background, non-blocking |
| `asyncRewake` | no | background; wakes Claude on exit 2; stderr (or stdout if empty) shown as system reminder; timeout still enforced |
| `shell` | no | `"bash"` or `"powershell"`; default bash, or powershell on Windows without Git Bash; ignored when `args` set |
| `onFailure` | no | `"continue"` or `"block"`; v2.1.295+; `command`/`http` only (L936) |
HTTP (L503-508): `url` (req), `headers` (env interpolation `$VAR`/`${VAR}`, only vars in `allowedEnvVars`, others become empty), `allowedEnvVars`, `onFailure`. POST body = hook JSON, `Content-Type: application/json` (L510).
MCP tool (L543-547): `server` (req; plugin servers `plugin:<plugin>:<server>`), `tool` (req), `input` (`${path}` substitution from hook JSON). Not available on SessionStart-at-launch and Setup; skipped (L594). Tool `isError: true` -> non-blocking error (L573). On PreToolUse unreadable/oversize answer refuses tool call (L582).
Prompt/agent (L600-603, L4049-4055, L4132): `prompt` (req; `$ARGUMENTS` placeholder, JSON appended if absent), `model` (default = background-functionality model), `timeout`; prompt-only `continueOnBlock` (default false); agent has no `continueOnBlock`.
Exec vs shell form (L458-497): set `args` whenever a path placeholder is used; shell form needs double-quoted placeholders (L622). Windows exec form needs real `.exe`, not `.cmd`/`.bat` (L468). Both forms export `CLAUDE_PROJECT_DIR`, `CLAUDE_PLUGIN_ROOT`, `CLAUDE_PLUGIN_DATA` to process env (L489). Shell form: `sh -c` mac/Linux, Git Bash on Windows (L464).

## 5. Path, env, cwd
- `${CLAUDE_PROJECT_DIR}` = project root where session started (L609); stays put when Claude enters a worktree; input `cwd` follows worktree/`cd` (L617-618).
- `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PLUGIN_DATA}` (L610-611).
- Hook cwd = current directory with Claude Code env; if gone, falls back: session start dir, project root, home, temp (L411).
- Hook inherits parent env minus `OTEL_*` exporter vars; `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB=1` strips more; HIPAA sessions remove Anthropic credentials (L772). `$CLAUDE_CODE_REMOTE`="true" in remote web (L413). `$CLAUDE_EFFORT` mirrors `effort.level` (L758). No `$CLAUDE_MODEL` (L770). `$CLAUDE_PLUGIN_OPTION_<KEY>` for plugin user_config in shell form (L493).
- `CLAUDE_ENV_FILE`: NOT mentioned in my ranges.
- Mac/Linux: hook runs in own session, no controlling terminal; cannot open `/dev/tty` (L742). Use `systemMessage` or `terminalSequence` (L744).

## 6. Common input fields (stdin JSON; HTTP body) (L750-766)
| Field | Meaning |
| :- | :- |
| `session_id` | session id |
| `prompt_id` | UUID of current prompt; absent until first input |
| `transcript_path` | conversation JSON path; written async, may lag; use `last_assistant_message` on Stop/SubagentStop |
| `cwd` | cwd at invocation |
| `scratchpad_dir` | session scratchpad; may be absent; v2.1.257+ |
| `permission_mode` | `default|plan|acceptEdits|auto|dontAsk|bypassPermissions`; not all events |
| `effort` | object `{level}`; low/medium/high/xhigh/max |
| `hook_event_name` | event name |
| `agent_id` | subagent or in-process teammate id |
| `agent_type` | present with `--agent` or inside subagent; subagent type wins |
`model` only on SessionStart, not always (L768). `tool_name`, `tool_input`, `tool_use_id` event-specific (L796).

## 7. Exit codes and output routing
- 0 = success, JSON applied. 2 = blocking on blockable events. Any other = non-blocking error, action proceeds, `<hook name> hook error` notice (L802-804).
- Table (L808-812): valid JSON + exit 2 = blocking, fields cannot override block; valid JSON + other code = fields alone decide; unparsable/invalid JSON + exit 0 = non-blocking error; + exit 2 = blocking with stderr as reason; plain/none + exit 2 = blocking, stderr is reason; plain/none + other = non-blocking, first stderr line in notice.
- Exit 2 blocks even with `permissionDecision: "allow"` (L849). Message = stderr unless JSON gives a blocking reason (L845). Claude sees stderr as `PreToolUse:Bash hook error: [cmd]: ...` (L868-872).
- Exit 0: Claude never sees stderr (L839). Plain stdout becomes context on UserPromptSubmit, UserPromptExpansion, SessionStart, PostModelSwitch (L836); PreCompact stdout = compaction instructions (L837).
- Exit 1 w/o valid JSON is NON-blocking; use exit 2 for policy (L896).
- Exit 2 on Stop/SubagentStop/TaskCompleted/plugin UserPromptSubmit with empty stdout and stderr "No such file or directory" = non-blocking (L818).
- Exit-2 effects for MeowKit events (L1025-1059): PreToolUse blocks call; UserPromptSubmit blocks prompt; Stop prevents stopping, conversation continues; SubagentStop prevents subagent stopping; PreCompact blocks compaction; PostToolUse and PostToolUseFailure "shows stderr to Claude", tool already ran; SessionStart and SubagentStart: stderr shown to user only, Claude does not see, proceeds (L1044, L1043, L1061).
- Timeouts (L900-902): timed-out command/http/mcp_tool hook canceled, output discarded; PreToolUse timeout does NOT block, falls to normal permission flow, "don't count on a stalled hook to act as a gate"; `onFailure: "block"` makes it block. PreModelSwitch timeout blocks.
- `onFailure: "block"` failures (L973-981): cannot start, exit not 0/2 (even with allow JSON), HTTP non-2xx/connection fail, timeout, invalid JSON output; plain stdout not a failure. Effect = same as exit 2 on that event (PermissionRequest: deny). NO effect on Stop, SubagentStop, TaskCompleted, TeammateIdle, nor async/asyncRewake hooks (L983-986).
- Windows without Git Bash: shell-form PreToolUse/PermissionRequest command hook with `onFailure` unset blocks on failure; only exit 0 or 2 is verdict (L940, L994-998).
- Background processes: print decision first, redirect child stdout/stderr; non-redirected child -> up to 10 s delay for non-async hook; allow-then-unredirected background process makes Claude Code block ("refusing to honor the suspect capture") (L913-917).
- HTTP (L1069-1074): 2xx empty = success; 2xx JSON object parsed (invalid = non-blocking error); 2xx other body = non-blocking; non-2xx / connection failure = non-blocking; timeout canceled. Block via 2xx + decision JSON (L1065).

## 8. JSON output
- Parse rule (non-async): stdout must be exactly one JSON object (maybe multi-line), nothing else; text not starting `{`/ending `}` = plain text; invalid `{...}` = parse failure (L828-832). Shell-profile echo noise breaks parsing (L1084).
- Universal fields (L1098-1104): `continue` (default true; false stops Claude entirely; does not block PreToolUse call, add `permissionDecision: "deny"`); `stopReason` (shown to user when continue false; Claude sees if conversation continues); `suppressOutput` (default false, "Has no effect"); `systemMessage` (warning to user); `terminalSequence` (OSC 0/1/2/9/99/777 and BEL only, otherwise ignored; interactive only, ignored in `-p`/SDK; not from async hooks; works on events that discard systemMessage) (L1104, L1126-1132).
- Size cap: `additionalContext`, `systemMessage`, `initialUserMessage` strings and plain stdout each 10,000 chars, measured separately; over cap saved to file, replaced by path + <=2,000 char preview (PreCompact stdout excepted); not configurable (L1086-1090, L1182).
- `additionalContext` in `hookSpecificOutput` (requires `hookEventName`) is wrapped in a system reminder; placement per event (L1157-1176); multiple hooks' values all delivered (L1178); `<system-reminder>` tag in string gets `<` escaped (L1180); doc advises factual phrasing, as imperative text may trigger injection defenses (L1192); replayed from transcript on resume, SessionStart re-runs (L1194).
- Decision patterns (L1200-1214): top-level `decision: "block"` + `reason` for UserPromptSubmit, UserPromptExpansion, PostToolUse, PostToolUseFailure, PostToolBatch, Stop, SubagentStop, ConfigChange, PreCompact (only value is `"block"`, omit to allow, L1229). PreToolUse uses `hookSpecificOutput.permissionDecision` allow/deny/ask/defer + `permissionDecisionReason`. SessionStart/SubagentStart/PostModelSwitch: context only, no decision. Stop/SubagentStop also accept `hookSpecificOutput.additionalContext` for non-error feedback that continues (L1202).
- Rewrite fields: PreToolUse `updatedInput`; PostToolUse `updatedToolOutput`; UserPromptSubmit cannot replace prompt (L1218-1223).
- Mixing: exit 2 keeps blocking effect, JSON still read (L1082). Precedence among several hooks' decisions: not stated here.

## 9. Hooks in skills and agents (L676-718)
- Same config format in frontmatter `hooks:` key (L689, L678).
- Subagent hooks: only while that subagent runs, removed on finish; a `Stop` hook there is converted to `SubagentStop` (L680).
- Skill hooks: registered on invocation, persist rest of session; `once: true` removes after first success (L681).
- Project skill frontmatter hooks follow workspace-trust rule of settings hooks; registered on invocation even in `-p` in untrusted folder (L700). Project subagent frontmatter hooks run only after workspace trust dialog accepted; `-p` does not count (L702).
- Agent-definition hooks vs background session / teammate: not stated (see Q2).

## 10. Prompt and agent hooks (L3972-4154)
- Supported on all five types: PermissionDenied, PostToolBatch, PostToolUse, PostToolUseFailure, PreToolUse, Stop, SubagentStop, TaskCompleted, TaskCreated, TeammateIdle, UserPromptExpansion, UserPromptSubmit (L3976-3989). PermissionRequest: no `agent` (skipped) (L3991). command/http/mcp_tool only (no prompt/agent): ConfigChange, CwdChanged, DirectoryAdded, Elicitation(+Result), FileChanged, InstructionsLoaded, MessageDisplay, Notification, PostCompact, PostModelSwitch, PreCompact, PreModelSwitch, SessionEnd, StopFailure, SubagentStart, WorktreeCreate/Remove (L3993-4012). SessionStart and Setup: command and mcp_tool only (L4014).
- Prompt hook: LLM returns JSON `{ok, reason, impossible}`; `reason` required when ok false; `impossible` lets Stop/SubagentStop end turn; agent hooks ignore it (L4059-4073). Determinism statement: none; the page says the LLM decides (L4021).
- `ok:false` per event (L4075-4085): Stop/SubagentStop reason fed back, turn continues (unless `impossible`); PreToolUse denies (default ends turn; `continueOnBlock: true` returns reason as tool error); PostToolUse default ends turn; PostToolBatch/UserPromptSubmit/UserPromptExpansion end turn; PostToolUseFailure/TaskCreated reason as tool error; PermissionRequest and PermissionDenied no effect.
- Agent hook: subagent with Read/Grep/Glob etc., up to 50 turns, returns `{ok}`; default timeout 60; `ok:false` handled as prompt hook with `continueOnBlock: true` (L4123-4134).

## 11. Async hooks (L4156-4264)
- `async: true` only on `type: "command"` (L4162). Cannot block or control: `decision`, `permissionDecision`, `continue` have no effect (L4158). `terminalSequence` does not work (L1131).
- Timeout not enforced on async (enforced for `asyncRewake`) (L4185). In `-p`, running async hooks killed at teardown, outcome `cancelled` (L4189).
- Only `additionalContext` and `systemMessage` delivered, on next turn, not shown to user; idle session waits, except `asyncRewake` exit 2 wakes immediately (L4196, L4262). Wrong-typed fields dropped (L4203). Each execution is a separate process (L4263). Async SessionStart dedupes unchanged output (L4264).

## 12. Security (L4266-4291)
- Command hooks run with full user permissions (L4272).
- Workspace trust: interactive session holds back ALL settings-file hooks (incl. user's) until trust dialog accepted; `-p`/SDK treats folder as trusted, so repo `.claude/settings.json` hooks run in never-trusted folders; mitigations `--bare`, `--settings '{"disableAllHooks": true}'` (L4278-4281).
- Practices: validate inputs, quote vars, block `..`, absolute paths (`${CLAUDE_PROJECT_DIR}`), skip `.env`/`.git/`/keys (L4287-4291).
- PowerShell: `"shell": "powershell"`, pwsh preferred then powershell.exe (L4295). Placeholders rewritten to `${env:NAME}` in shell-form PowerShell; bare `$CLAUDE_PROJECT_DIR` not rewritten (L4318-4320).
- Debug: `claude --debug-file <path>` or `--debug` -> `~/.claude/debug/<session-id>.txt`; `Hooks:` lines with duration v2.1.296+; verbose via `CLAUDE_CODE_DEBUG_LOG_LEVEL=verbose` (L4334-4345).

## Answers to open questions
1. Stop blocking override after N consecutive blocks, `stop_hook_active` field: NOT stated in my ranges. Page only points to the guide's troubleshooting for "Stop hooks that keep blocking" (L4347). `stop_hook_active` absent from common input fields (L750-766); per-event Stop schema is in unread L1272+.
2. Agent-definition hooks in background session / teammate: NOT stated for frontmatter hooks. Stated: subagent frontmatter hooks run only while that subagent runs (L249, L680); settings/managed/plugin hooks run inside subagents (L255); `agent_id` identifies subagent or in-process teammate (L761).
3. PreToolUse allow/ask/deny conflict winner: NOT stated in my ranges. Related only: exit 2 beats JSON `allow` in same hook (L849); decision values allow/deny/ask/defer (L1205). Multi-hook precedence probably in unread PreToolUse section.
4. Timeout or non-zero non-2 exit: action proceeds (non-blocking) unless `onFailure: "block"` (L804, L902, L973-981). PreToolUse timeout does not block (L902). PreModelSwitch timeout blocks (L900).

## Not stated (in my ranges)
- Snapshot-at-startup of hook config (only: file watcher picks up edits, L736). `CLAUDE_ENV_FILE`. Matcher case sensitivity. Multi-hook decision precedence. `stop_hook_active`. Per-event input schemas, Stop/SubagentStop/PreCompact/SessionStart output details, PostToolUseFailure input (unread ranges).
- Behavior for hooks in agent frontmatter under background/teammate runs.
- Whether Cursor/Codex runtimes read these hooks (page covers Claude Code only).

## Anomalies
- `suppressOutput` is documented as "Has no effect" (L1102).
- `once` ignored in settings files and agent frontmatter (L425), only skills.
- `if` on non-tool events makes hook never run (L422), silent trap.
- L1192 advises writing `additionalContext` as factual statements, not imperatives (advice to hook authors; not acted on). L7/L1-3 doc-index fetch note is boilerplate. No text addressing an AI agent with commands found.
- Page lists many versions (v2.1.229-v2.1.314) gating fields (`onFailure` 2.1.295, `args` exec form undated).

## Audit checkpoints
1. Every MeowKit hook uses `type: "command"`; valid types are command/http/mcp_tool/prompt/agent (L399-405).
2. SessionStart and SubagentStart hooks cannot block; exit 2 only shows stderr to user (L1043-1044, L1061).
3. Hooks that must block must exit 2 (or exit 0 with JSON deny); exit 1 is non-blocking (L896).
4. PreToolUse gates must not rely on timeout or crash to block; need `onFailure: "block"` (v2.1.295+) (L902, L936).
5. Matcher `Edit|Write`, `Read`, `Bash` are exact-string lists, not regex (L280); `Bash` also matches Monitor commands (L280, L390).
6. Matchers on UserPromptSubmit, Stop are ignored (L311, L337); SubagentStart/Stop matcher = agent type (L298, L301); SessionStart matcher = source values (L294).
7. `if` fields exist only on tool events; on others the hook never runs (L422).
8. Script paths via `${CLAUDE_PROJECT_DIR}`, ideally exec form with `args` (L609, L622); cwd may differ from project root (L618).
9. PostToolUse/PostToolUseFailure exit 2 only surfaces stderr; tool already ran, cannot block (L1038-1039).
10. Stop-hook scripts that exit 2 keep Claude going; guard against infinite loops (loop-guard behavior unstated in L1-1271/L3972+; check guide, L4347).
11. Stdout for JSON-emitting hooks is a single JSON object, no stray text (L828, L1084).
12. `additionalContext`/`systemMessage`/plain stdout <= 10,000 chars each (L1086).
13. PreCompact: stdout becomes compaction instructions; exit 2 or `decision: "block"` blocks compaction (L837, L1050, L1202).
14. `async: true` hooks cannot gate anything; do not use for enforcement (L4158).
15. Agent/skill frontmatter `Stop` hooks fire as SubagentStop (L680); `once` only works in skill frontmatter (L425).
16. Hooks do not run in interactive sessions until workspace trust accepted; run un-trusted in `-p` (L4278-4279).
17. `disableAllHooks` can silence MeowKit hooks (L732); `allowManagedHooksOnly` blocks non-managed hooks (L257-259).
18. Identical handlers in multiple settings files run once; plugin/skill copies run separately (L409), so double registration across plugin + settings duplicates.
19. Hook scripts must not write to `/dev/tty`; use `systemMessage`/`terminalSequence` (L742-744).
20. Hook scripts spawning background children must redirect stdio and print decision first (L913-917).
