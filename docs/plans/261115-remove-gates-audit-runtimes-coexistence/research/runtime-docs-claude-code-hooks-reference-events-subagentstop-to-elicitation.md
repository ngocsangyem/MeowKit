# Claude Code hooks reference: SubagentStop to ElicitationResult

## Scope
File `/Users/sangnguyen/Desktop/MeowKit/tmp/runtime-docs-261115/claude/hooks.md`, L2681-L3971. Every line read (4 chunks). Cites `claude/hooks.md:L..` abbreviated `L..` below (all same file). "Common input fields" and "JSON output" are defined outside my range (not read).

## SubagentStop (L2681-2714)
- Fires when a subagent finishes responding. Matcher = agent type, same values as SubagentStart (L2683). `agent_type` is the matcher-filtered value (L2687).
- Also fires for Claude Code internal agents (prompt suggestions, `/btw` side questions); then `agent_type` = session's own agent name (`--agent`/`agent` setting) or empty string (L2689).
- Named-type matcher does not match empty `agent_type`; omitted/`""`/`"*"`/regex matching empty string do (L2691).
- Input beyond common (L2687, L2695, L2704-2710):

| Field | Meaning |
| :- | :- |
| `stop_hook_active` | as Stop |
| `agent_id` | subagent id |
| `agent_type` | matcher value |
| `agent_transcript_path` | subagent's own transcript, nested `subagents/` folder; `transcript_path` stays the main session's (L2687) |
| `last_assistant_message` | text of subagent's final response (L2687) |
| `background_tasks`, `session_crons` | as Stop; scoped to the PARENT session not subagent (L2695) |

- v2.1.271+: subagent using `SubagentHandback` tool delivers report via that tool first; `last_assistant_message` = closing text only, not the report. Report is the call's `message` input, visible to PreToolUse/PostToolUse matched on `SubagentHandback` as `tool_input.message` (L2693).
- Decision control: same as Stop (L2714). `decision:"block"`+`reason` keeps subagent running, `reason` delivered to subagent as next instruction; exit 2 stderr likewise; `hookSpecificOutput.additionalContext` with `hookEventName:"SubagentStop"` = non-error feedback that keeps it running (L2714). To inject context into parent after subagent returns, use PostToolUse on `Agent` tool (L2714).

## Stop (L2828-2930)
- Fires when the main agent finishes responding. Does NOT run on user interrupt. API errors fire StopFailure instead (L2830-2832).
- `/goal` is a built-in shortcut for a session-scoped prompt-based Stop hook (L2836).
- Matcher: not stated in this section (no matcher text).
- Input beyond common (L2840-2846): `stop_hook_active` (true when already continuing due to a stop hook; check it or process transcript to avoid blocking on a never-resolving condition, L2840); `last_assistant_message` (Claude's final text; prefer it over reading `transcript_path`, transcript may lack final message at Stop time on some versions, L2844); `background_tasks`; `session_crons` (arrays distinguish done vs paused-waiting; present when task registry reachable, empty if none, L2846).
- `background_tasks` entry fields (L2850-2860): `id`, `type` (`shell`,`subagent`,`monitor`,`workflow`,`teammate`,`cloud session`,`MCP task`, or raw discriminant), `status`, `description` (cap 1000 chars + `… [+N chars]`), `command` (shell only, cap 1000), `agent_type` (subagent only), `server`/`tool` (monitor, MCP task), `name` (workflow).
- `session_crons` entry (L2864-2869): `id`, `schedule` (cron expr), `recurring` (bool), `prompt` (cap 1000).
- Cap: 8 consecutive continuations; the next block is overridden and turn ends; count resets each time Claude calls a tool; raise with env `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP` (L2842).
- Decision control (L2904-2912):

| Field | Effect |
| :- | :- |
| `decision` | `"block"` prevents stopping; omit to allow |
| `reason` | required with block; tells Claude why to continue |
| `hookSpecificOutput.additionalContext` (`hookEventName:"Stop"`) | non-error feedback; conversation continues; labelled "Stop hook feedback", no hook-error notification (L2910, L2921) |

- Exit 2: stderr is fed to Claude as the explanation to continue (L2912). `additionalContext` is under the same loop protections (`stop_hook_active`, 8-cap) (L2921).
- stdout/stderr destinations, timeout for Stop: not stated here.

## StopFailure (L2932-2958)
- Fires instead of Stop when turn ends due to API error (L2934). Output and exit code ignored except `terminalSequence` (L2934). No decision control; notification/logging only (L2958).
- Matcher: `error` field is used for matcher filtering (L2938).
- Input: `error` (`rate_limit`,`overloaded`,`authentication_failed`,`oauth_org_not_allowed`,`account_on_hold`,`billing_error`,`invalid_request`,`model_not_found`,`server_error`,`max_output_tokens`,`cloud_credential_error`,`unknown`); `error_details` (optional); `last_assistant_message` (optional; here the rendered API error string, not Claude's output) (L2942-2944).

## TeammateIdle (L2960-3006)
- Fires when an agent-team teammate is about to go idle after its turn (L2962). No matchers (L2964).
- Input: `teammate_name`; `team_name` (DEPRECATED, session-derived, to be removed); `agent_id` (common field, identifies in-process teammate, may be absent, needs v2.1.290+) (L2968, L2984-2986).
- Exit 2: teammate gets stderr as feedback and keeps working instead of idling (L2992). JSON `{"continue":false,"stopReason":"..."}`: stops teammate entirely like Stop; `stopReason` shown to user (L2993).
- Agent-teams-enabled requirement: not stated in this section (links to agent-teams doc only).

## TaskCreated (L2716-2769)
- Fires when a task is being created via `TaskCreate` tool. In a session without the Task tools the event does not fire (L2718). No matchers (L2720).
- Input: `task_id`, `task_subject`, optional `task_description`, `teammate_name`, `team_name` (DEPRECATED, L2746); `agent_id` = subagent or in-process teammate creating the task, may be absent, v2.1.290+ (L2724, L2740-2747).
- Block: exit 2 (stderr returned as message) or JSON `{"decision":"block","reason":"..."}` (reason returned as message). Either way task is deleted and message returned to Claude as the tool's error. `continue:false` ignored; Claude keeps working (L2751-2754).

## TaskCompleted (L2771-2826)
- Fires when task is being marked completed: (a) any agent marks completed via TaskUpdate; (b) agent-team teammate finishes turn with in-progress tasks (L2773). No matchers (L2775).
- Input same as TaskCreated (teammate_name = completer; `team_name` deprecated; `agent_id` v2.1.290+) (L2779, L2796-2803).
- Exit 2: task not marked completed; stderr fed to model as feedback (L2809). JSON `{"continue":false,"stopReason":"..."}`: when teammate turn-end triggered it, stops teammate like Stop, `stopReason` shown to user; when TaskUpdate triggered it, `continue:false` ignored, exit 2 still blocks (L2810).

## StopFailure/Stop vs teammate note
None beyond above.

## ConfigChange (L3008-3083)
- Fires when settings file, managed policy file, or skill file changes during session; policy only when `managed-settings.json` or file in `managed-settings.d/` changes (L3010-3012).
- Matcher = source: `user_settings`, `project_settings`, `local_settings`, `policy_settings`, `skills` (L3014-3022).
- No hook run for: changes saved via "don't ask again", `/permissions`, `/model` in the saving session (other sessions loading same file do run); server-managed settings, macOS managed prefs, Windows registry policy; WSL `wslInheritsWindowsSettings` Windows-side changes (L3024-3028). Hooks not run when server-managed settings arrive/refresh (L3081).
- Input: `source`, optional `file_path` (L3052).
- Block: exit 2 or `decision:"block"`; new settings not applied to running session (L3067-3071). `reason` accepted but never shown (L3072). `policy_settings` cannot be blocked; hook still fires, decision ignored (L3081). `systemMessage` and `continue` discarded; blocked change surfaces no message, only debug-log line (L3083).

## CwdChanged (L3085-3118)
- Fires when a shell command in the main conversation changes cwd (e.g. `cd`) (L3087). No matchers (L3091). Has `CLAUDE_ENV_FILE`; vars persist to later Bash commands until next CwdChanged (L3089).
- Input: `old_cwd`, `new_cwd` (L3095). Output: `watchPaths` (abs-path array replaces dynamic FileChanged watch list; `[]` clears) (L3110-3114). No decision control, cannot block (L3116). `systemMessage` shown as terminal notification interactively, not in SDK stream; `continue` discarded (L3118).

## DirectoryAdded (L3120-3164)
- Fires after `/add-dir` or SDK `register_repo_root` (L3122). Not fired for `--add-dir` flag (SessionStart covers), `/permissions` Workspace tab, or already-included dir (L3124-3128).
- Not awaited: add completes immediately, hook runs in background, 600s default timeout; hook commands run unsandboxed (L3130-3132).
- Matcher: `slash_command`, `register_repo_root` (L3136-3139). Input: `directory` (abs), `source` (same two values) (L3145-3148).
- No decision control, cannot block; `continue` discarded; `slash_command`: `systemMessage` delivered to Claude as context next turn, failed-hook count in transcript; `register_repo_root`: debug log only (L3161-3164).

## FileChanged (L3166-3241)
- Fires on filesystem-watcher change of a watched file, regardless of what changed it (Edit/Write, Bash, external) (L3168). Has `CLAUDE_ENV_FILE` (L3209).
- Matcher serves two roles: split on `|` into literal filenames in working directory to build watch list (regex not useful); then filters hook groups by basename using standard matcher rules (L3172-3173). Watcher starts only when something names a file (matcher with a file, or SessionStart/CwdChanged returning `watchPaths`); omitted matcher matches every watched file and adds none; `"*"` is registered as literal file `*` (L3207).
- Input: `file_path` (abs), `event` (`change`,`add`,`unlink`) (L3213-3218). Output `watchPaths` (L3233-3237). No decision control (L3239). `systemMessage` shown interactively; `continue` discarded (L3241).
- Loop warning: hook that rewrites the watched file re-fires; guard needed (L3195).

## WorktreeCreate (L3243-3311)
- Fires when Claude Code creates a worktree: `claude --worktree`; `EnterWorktree` tool; subagent `isolation: "worktree"`; workflow agent in own worktree; background session isolation; `claude remote-control` in worktree mode (L3245-3252).
- Not fired for: `git worktree add` via Bash (use PreToolUse Bash matcher); plugin hook with `--worktree --tmux` (worktree made before plugins load; define in settings file instead). Before v2.1.300 plugin hook did not run with `--worktree` alone either (L3254-3257).
- Defining the hook REPLACES default git worktree behavior (enables SVN/Perforce/Mercurial) (L3259). Consequently `.worktreeinclude` NOT processed; copy files like `.env` inside the hook (L3261).
- Matcher: not stated.
- Input: `name` (slug, e.g. `bold-oak-a3f2`, user-specified or auto) (L3290).
- Output: no allow/block model; success/failure decides. Command hook: print path as LAST NON-EMPTY stdout line; ANSI stripped; send other output to stderr. HTTP hook: `hookSpecificOutput.hookEventName:"WorktreeCreate"`, `worktreePath` (abs) in body (L3304-3307). `systemMessage` and `continue` discarded (L3265).
- Failure: hook fails or no path => creation fails with error (L3309). Relative path resolved against hook's run dir, `.`/`..` collapsed; not-enterable => error naming path, session exits code 1 (L3309). Absolute path with `.`/`..` segments refused; any path passing through a symlink below repo root refused (L3311).

## WorktreeRemove (L3313-3379)
- Fires when Claude Code cleans up a worktree that YOUR WorktreeCreate hook created: interactive session exit (prompted remove, or unnamed + no changes/untracked), background-session delete, `ExitWorktree` tool, remote-control worktree-mode cleanup (no changes/commits) (L3315-3322).
- NOT fired when subagent or workflow agent finishes: worktree kept, you remove it yourself (L3324).
- `ExitWorktree` refuses hook-created worktree unless `discard_changes: true`; hook is last check; no prompt before hook for ExitWorktree/remote-control (L3326). Git-based change detection finds nothing in non-git dirs; hook must check for work itself (L3328).
- Without hook: exit/`ExitWorktree` falls back to `git worktree remove --force`-style on returned path (non-git-recognized worktree stays on disk); remote-control keeps worktree, prints `worktree removal failed, kept: <path>` (L3332-3334).
- Hook exit 0 = counted removed (nothing else read; hook must delete dir). Non-zero: removal fails if `worktree_path` still exists, stays on disk, no git fallback; if dir deleted before non-zero exit = removed (L3336-3337, L3376).
- Cannot block in the allow/deny sense; failure leaves worktree (and background session) in place; refusal message in agent view shows e.g. `exited 1` and start of stderr (L3376-3378). Branches of hook-created worktrees never deleted by Claude Code; delete in hook (L3339). JSON output (`systemMessage`,`continue`) discarded (L3339).
- Input: `worktree_path` (abs, the path WorktreeCreate returned) (L3364). Background-session delete: stored path verified, symlink/through-symlink refused; hook runs for non-empty worktree only on user confirm in agent view (L3341).
- Matcher: not stated.

## PreCompact (L3381-3415)
- Fires before a compact operation (L3383). Matcher: `manual` (`/compact`), `auto` (auto-compact at window, and idle compaction) (L3385-3390).
- CAN block: exit 2 (stderr shown to user for manual `/compact`) or `"decision":"block"` (L3392). Auto + proactive: skipped, conversation continues uncompacted; auto triggered to recover from API context-limit error: underlying error surfaces and request fails (L3394). `systemMessage`,`continue` discarded (L3396).
- Input: `trigger`, `custom_instructions` (manual: user's text or `null`; auto: `null`) (L3400).
- Output: on exit 0 without block, STDOUT is used as instructions for the compaction summary; keep under 10,000 chars per hook; longer is cut with a marker (L3415).

## PostCompact (L3417-3443)
- Fires after compaction completes; matcher `manual`/`auto` same as PreCompact (L3419-3426). Input: `trigger`, `compact_summary` (L3430). No decision control; cannot affect result; `systemMessage`,`continue` discarded (L3419, L3443).

## PreModelSwitch (L3445-3598)
- Fires before requested model switch (v2.1.251+): `/model`, picker, Option/Alt+P, `/config` Model, fast mode if it changes model, SDK/Remote Control `set_model` / `apply_flag_settings` (L3449-3455). Not for automatic fallback or resume restore (L3457).
- Matcher: canonical name of target model, `[1m]` suffix ignored; exact, `|` list, or regex; if canonical name unknown, ALL hooks run, so check `to_model` (L3459-3463).
- Input: `from_model`, `to_model`, `requested_model` (string|null), `source` (`command`,`picker`,`sdk`), `context_tokens`, `prompt_cache_warm`, `cache_ttl` (`5m`/`1h`), `estimated_cache_write_usd`, `pricing` (`configured`,`catalog`,`default`) (L3533-3543).
- Decision: exit 2 or top-level `decision:"block"` cancels (L3567). `hookSpecificOutput.permissionDecision` `allow`/`deny`/`ask`; no `defer`, `updatedInput`, `additionalContext` (L3569). `permissionDecisionReason` (L3571-3574). `ask` prompt only in interactive `/model`; elsewhere (incl. `-p`, `/config`, `set_model`) treated as refusal (L3576). Precedence `deny` > `ask` > `allow` (L3590). `systemMessage` shown regardless (L3592).
- Timeout: default 30s; timeout BLOCKS the switch (L3596). Other non-0/2 exit without JSON = non-blocking error, switch proceeds except hooks whose failure blocks (L3598).

## PostModelSwitch (L3600-3651)
- Fires after session model changes (v2.1.251+): requested switch, auto fallback, `opusplan` plan-mode change, resume restore (L3604-3609). Not for one-turn fallback-chain substitution (L3611). Cannot block (L3604). Matcher as PreModelSwitch (L3613).
- Input: PreModelSwitch fields; `source` adds `auto`, `resume`; `requested_model` null when `auto`, saved setting when `resume` (L3639-3641).
- Output: plain stdout (exit 0) or `additionalContext` delivered with next request (L3645-3649). If not finished within 5s after next prompt, sent without it and attached to following request; several switches => only last target's output delivered (L3651).

## SessionEnd (L3653-3696)
- Fires when session ends; matcher filters on `reason` (L3655-3656). `reason`: `clear`, `resume` (interactive `/resume` switch), `logout`, `prompt_input_exit`, `other`; `bypass_permissions_disabled` removed in v2.1.234, not sent, drop from matchers (L3660-3667).
- Input: `reason` (L3671). No decision control; cannot block termination; JSON output such as `systemMessage` discarded (L3683).
- Timeout: default 1.5s overall (on exit, `/clear`, interactive `/resume`) (L3685). Per-hook `timeout` raises overall budget to highest per-hook timeout in settings files, max 60s; hooks without own `timeout` keep default; plugin-hook timeouts don't raise budget (L3687). Env `CLAUDE_CODE_SESSIONEND_HOOKS_TIMEOUT_MS` overrides budget and becomes default per-hook timeout (L3688). Before v2.1.268 env raised only overall budget; hook without `timeout` still cancelled at 1.5s (L3696).

## Elicitation (L3698-3805)
- Fires when an MCP server requests user input mid-task; hooks can answer programmatically, skipping dialog (L3700). Matcher = MCP server name (L3704).
- Input: `mcp_server_name`, `message`, optional `mode` (`form`/`url`), `url`, `elicitation_id`, `requested_schema` (L3708, L3720-3741).
- Output (exit 0, `hookSpecificOutput` with `hookEventName:"Elicitation"`, `action` `accept`+`content` / `decline` / `cancel`); no output + exit 0 = dialog shown (L3747-3754). URL-mode `accept` skips dialog, URL never opens (L3781). `reason`,`systemMessage`,`continue` discarded (L3783).
- Decline alternatives: exit 2 (hookSpecificOutput ignored) or top-level `decision:"block"` (overrides `action`); a decline from one hook overrides accept/cancel from another; user/server never see why (L3787-3803). Top-level `decision` was ignored v2.1.105 until fix in v2.1.284 (L3805).

## ElicitationResult (L3894-3970)
- Fires after user responds to elicitation; may observe/modify/block (L3896). NOT run when an Elicitation hook answered (L3898). Matcher = MCP server name (L3900).
- Input: `mcp_server_name`, `action`, optional `mode`, `elicitation_id`, `content` (L3904).
- Output: `hookSpecificOutput` with `action` (`accept`+`content` replaces whole content object; `decline`; `cancel` still sends user's values) (L3921-3928, L3944). `hookSpecificOutput` without `action` ignored (L3944). Also runs when user declined/cancelled; your action replaces theirs, so check input `action` (L3946). Exit 2 or top-level `decision:"block"` also block (L3968). `reason`,`systemMessage`,`continue` discarded (L3970).

## Answers to open questions
1. Stop: input `stop_hook_active`, `last_assistant_message`, `background_tasks`, `session_crons` (L2840). `decision:"block"`+`reason` keeps Claude working, reason tells it why (L2908-2909). Cap 8 consecutive continuations, reset on each tool call, env `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP` (L2842). Avoid loop: check `stop_hook_active` or transcript (L2840).
2. Stop = main agent only (L2830); SubagentStop is separate event for subagents (L2683). SubagentStop adds `agent_id`, `agent_type`, `agent_transcript_path` (nested `subagents/`); `transcript_path` stays main session (L2687). Also fires for internal agents (L2689).
3. User interrupt: no Stop (L2830-2831). API error: StopFailure instead (L2831-2832, L2934). Headless/`-p`: not stated for Stop (only `-p` mention is PreModelSwitch `ask`, L3576).
4. PreCompact can block (exit 2 or `decision:"block"`) (L3392); `trigger` = `manual`/`auto` (L3387-3389). Stdout on exit 0 becomes compaction-summary instructions, <10,000 chars/hook (L3415); `custom_instructions` is INPUT (user's `/compact` text or null), not an output field (L3400). PostCompact receives `trigger`, `compact_summary`; no control (L3430, L3443).
5. WorktreeCreate defining it replaces default git creation (L3259); must print abs path as last non-empty stdout line (command) or `hookSpecificOutput.worktreePath` (http) (L3306-3307); failure/no path => creation fails, session exits 1 on unusable path (L3309). WorktreeRemove: no allow/deny block; non-zero exit leaves worktree if dir still exists (L3337); not run for subagent/workflow-agent completion (L3324).
6. TeammateIdle exit 2: teammate keeps working with stderr feedback (L2992). TaskCreated exit 2: blocks + deletes task, stderr to Claude as tool error (L2751-2753). TaskCompleted exit 2: not completed, stderr as feedback (L2809). Fields: see sections. Agent-teams enablement: TeammateIdle is defined as agent-team event (L2962); TaskCreated needs Task tools available (L2718); TaskCompleted also fires on plain TaskUpdate (L2773); an explicit enable flag is not stated.
7. SessionEnd reasons: `clear`,`resume`,`logout`,`prompt_input_exit`,`other` (+ removed `bypass_permissions_disabled`) (L3660-3667). Default timeout 1.5s, up to 60s via per-hook timeout or env (L3685-3688). Cannot block (L3683).

## Not stated
- Matcher support/values for Stop, SubagentStop-beyond-SubagentStart values, StopFailure beyond `error` field list, WorktreeCreate/Remove (not in range; check other section).
- Stop behavior in headless/`-p`/SDK mode.
- Whether SubagentStop has its own cap env var (only Stop's cap stated; SubagentStop "same decision control" L2714 but cap not restated).
- Stdout/stderr destinations and default timeouts for Stop, SubagentStop, TeammateIdle, Task*, PreCompact (general rules live outside range).
- Explicit setting/env to enable agent teams for TeammateIdle/Task hooks.
- Whether Stop fires when stop-hook blocking is repeated beyond cap (only "ends the turn", L2842).
- WorktreeCreate matcher/failure exit-code mapping beyond "fails or no path".

## Anomalies
- No text addressed to an AI/agent as instruction found. Examples contain shell scripts with `rm -rf` (L3353) and `npm test` (L3820), as documentation samples only; not acted on.
- Doc inconsistency: Stop section lists `decision:"block"` as the Stop mechanism while TaskCreated says `continue:false` ignored; TaskCompleted/TeammateIdle `continue:false` honored only for teammate turn-end (L2810, L2993). Event-specific semantics of `continue` differ.
- PreCompact `custom_instructions` is input only; stdout (not JSON field) feeds summary (L3400, L3415). SessionEnd/PreCompact etc. discard `systemMessage`.

## Audit checkpoints
1. A Stop hook that blocks must emit `decision:"block"` with non-empty `reason`, or exit 2 with stderr text (L2908-2912).
2. A Stop/SubagentStop completion-check hook should read `stop_hook_active` and avoid re-blocking when true and condition unresolved (L2840).
3. Expect forced stop after 8 consecutive block continuations unless `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP` raised; counter resets on tool call (L2842).
4. Stop does not run on user interrupt and API errors go to StopFailure; completion check cannot rely on Stop in those cases (L2830-2832).
5. Hooks needing the final text should use `last_assistant_message`, not `transcript_path` (L2844).
6. Stop script should consider `background_tasks`/`session_crons` non-empty as "paused, not done" (L2846).
7. SubagentStop hook receives `agent_id`/`agent_type`/`agent_transcript_path`; matcher on SubagentStop is agent type and does not match empty `agent_type` unless matcher omitted/`*`/empty-matching regex (L2687, L2691).
8. SubagentStop block feeds `reason` to the subagent, not the parent; parent-context injection needs PostToolUse on `Agent` (L2714).
9. StopFailure hook output/exit code is ignored except `terminalSequence`; must not be relied on to block or recover (L2934, L2958).
10. PreCompact hook that blocks uses exit 2 or `decision:"block"`; any stdout on exit 0 becomes summary instructions, so a PreCompact script must not print stray stdout; cap 10,000 chars (L3392, L3415).
11. PostCompact hook cannot alter compaction; `systemMessage` discarded (L3419, L3443).
12. SessionEnd hook must finish within 1.5s default or declare `timeout` (max budget 60s; plugin-provided timeouts do not raise it) (L3685-3687).
13. SessionEnd cannot block and its JSON output is discarded; matcher values limited to `clear`,`resume`,`logout`,`prompt_input_exit`,`other`; no `bypass_permissions_disabled` (L3660-3667, L3683).
14. A WorktreeCreate hook replaces git worktree creation and `.worktreeinclude` handling; it must print the absolute worktree path as the last non-empty stdout line with no `.`/`..` segments and no symlink below repo root (L3259-3261, L3306, L3311).
15. A WorktreeCreate hook defined only in a plugin does not run with `--worktree --tmux` (L3257).
16. WorktreeRemove fires only for hook-created worktrees, is not run when a subagent/workflow agent finishes (those worktrees persist), and exit 0 must have deleted the directory (L3315, L3324, L3336).
17. WorktreeCreate-created branches are never deleted by Claude Code; WorktreeRemove must delete them (L3339).
18. TeammateIdle/TaskCreated/TaskCompleted use exit 2 + stderr for blocking; `continue:false` ignored for TaskCreated and for TaskCompleted triggered by TaskUpdate (L2751, L2810, L2992).
19. TaskCreated/TaskCompleted/TeammateIdle do not support matchers; do not configure one expecting filtering (L2720, L2775, L2964).
20. `team_name` is deprecated on TeammateIdle/TaskCreated/TaskCompleted; scripts should not depend on it (L2746, L2802, L2985).
21. ConfigChange blocking cannot stop `policy_settings`; block shows no message to user or Claude (L3081, L3083).
22. Matcher-less events (CwdChanged, TaskCreated, TaskCompleted, TeammateIdle) vs matcher events (SessionEnd, PreCompact, PostCompact, Elicitation, ElicitationResult, ConfigChange, DirectoryAdded, PreModelSwitch, PostModelSwitch): any `matcher` on a matcher-less event is meaningless (L2720, L2775, L2964, L3091).
