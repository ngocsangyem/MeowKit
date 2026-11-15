# Claude Code docs reference: subagents + agent teams

Sources (downloaded 2026-11-15, read in full, all lines):
- `sub-agents.md` = https://code.claude.com/docs/en/sub-agents (1495 lines)
- `agent-teams.md` = https://code.claude.com/docs/en/agent-teams (525 lines)

Facts only from these two files. Cites = local line numbers. Paraphrased; identifiers verbatim. Both files open with a "fetch the documentation index" line; treated as DATA, ignored (sub-agents.md:L1-3, agent-teams.md:L1-3).

---------------------------------------------------------------------
## PART A. SUBAGENTS
---------------------------------------------------------------------

### A1. Concept
- Own context window, own system prompt, own tool access, independent permissions; own requests count toward same usage limits (sub-agents.md:L11).
- Delegation driven by subagent `description` + request + context (sub-agents.md:L11, L25, L860).
- Combined descriptions of NON-built-in subagents > 15,000 tokens => startup warning; every subagent still loads (sub-agents.md:L27, L862).
- Subagents = single session. Separate tools: background agents (agent view), cross-session messaging, agent teams (sub-agents.md:L15).

### A2. Built-in subagents
| Name | Model | Tools | Notes | Cite |
|---|---|---|---|---|
| `Explore` | parent model; with Fable parent: Opus alias on subscription/Console/LLM gateway via `ANTHROPIC_BASE_URL`, stays Fable on Bedrock/Agent Platform/Foundry/Claude Platform on AWS/Claude apps gateway | read-only; Write and Edit denied | thoroughness levels `quick`, `medium`, `very thorough`; skips CLAUDE.md + git status; one-shot, no agent ID, not resumable | L35-49, L1147 |
| `Plan` | inherits parent (unless `CLAUDE_CODE_SUBAGENT_MODEL` + FORCE) | read-only; Write/Edit denied | used in plan mode for research; skips CLAUDE.md + git status; one-shot | L51-59, L33, L1147 |
| `general-purpose` | parent model by default (model order) | every tool available to subagents | multi-step explore+modify | L61-69 |
| `claude` | none of its own; follows model order | all tools available to subagents | catch-all; default agent of dispatched background session | L77 |
| `statusline-setup` | Sonnet | n/a stated | used on `/statusline` | L78 |
| `claude-code-guide` | Haiku | n/a stated | Claude Code feature questions | L79 |
- A user/project subagent named `Explore` overrides built-in, keeps its own `model` (L45).
- Other built-ins load CLAUDE.md + git status like custom ones (L33).
- Registered by default in interactive sessions (L81). Disable options:
  - `permissions.deny` entry `Agent(<name>)` (L83, L750-758)
  - deny the `Agent` tool itself (L84)
  - `CLAUDE_CODE_DISABLE_EXPLORE_PLAN_AGENTS=1` removes only Explore+Plan; needs v2.1.198+ (L85)
  - `CLAUDE_AGENT_SDK_DISABLE_BUILTIN_AGENTS=1` in non-interactive/SDK removes all built-in types (L86)
- Agent call omitting `subagent_type` fails `subagent_type is required` when no `general-purpose` subagent exists (L88).

### A3. Discovery locations and precedence (same name => higher priority wins)
| Prio | Location | Scope | Cite |
|---|---|---|---|
| 1 (highest) | Managed settings (`.claude/agents/` inside managed settings dir) | org-wide | L160, L228 |
| 2 | `--agents` CLI flag (JSON) | current session, not saved to disk | L161, L180 |
| 3 | `.claude/agents/` | current project | L162 |
| 4 | `~/.claude/agents/` | all projects | L163 |
| 5 (lowest) | plugin `agents/` dir | where plugin enabled | L164 |
- Project agents found by walking up from cwd to repo root; nested duplicates: closest to cwd wins (L168).
- `--add-dir` / `/add-dir` also loads that dir's `.claude/agents/` (L170); NOT watched, needs restart (L251).
- `.claude/agents/` and `~/.claude/agents/` scanned recursively; subfolder does NOT affect identity (identity = `name` only) (L174).
- Duplicate `name` within one `.claude/agents/` tree: only one loaded, by filesystem read order (no documented precedence); `/doctor` reports it (L176).
- Plugin `agents/` also recursive, but subfolder IS part of scoped id: `agents/review/security.md` in `my-plugin` => `my-plugin:review:security` (L178).
- File watcher: edits to `~/.claude/agents/` and `.claude/agents/` picked up within seconds, no restart. Restart needed when (a) first agent file in a newly created `agents` dir, (b) `--add-dir` dirs, (c) session started with `--disable-slash-commands` (L246-252). `/agents` just prints a reminder in current versions; on v2.1.197 and earlier it opened a wizard with Running/Library tabs (L147-148).
- Agent team teammates can reuse definitions from project/user/managed/plugin scope (agent-teams.md:L283).

### A4. File format
- Markdown, YAML frontmatter between `---`, body = system prompt (L94, L242, L289).
- Subagent receives ONLY body prompt + basic env details (working dir), NOT the Claude Code system prompt (L266, L1121).
- Multi-word fields are camelCase and must match exactly; unknown fields silently ignored. Debug: `claude --debug`, log `~/.claude/debug/<session-id>.txt`, search `does not recognize or apply`; names up to 5 unrecognized top-level fields; needs v2.1.296+ (L291-293).
- Files silently SKIPPED (L331-337):
  - no `name` (treated as docs)
  - opening `---` not on first line (treated as no frontmatter)
  - `name` starts with `-`, contains `:`, or >256 chars (debug-log error)
  - `name` without `description` (debug-log reason)
  - YAML does not parse (no fields read)
- Plugin agent with no `name` or unparseable frontmatter still loads under filename (L341).
- Pre-session check: `claude plugin validate <dir>` (e.g. `.claude/agents`); does not flag parse-OK-but-no-`name`; v2.1.233+ (L345).
- Subagent `cd` does not persist across Bash/PowerShell calls and does not affect main cwd (L270).

### A5. Frontmatter fields (complete table; only `name`+`description` required) (L289-316)
| Field | Req | Type / allowed values | Default / behaviour | Cite |
|---|---|---|---|---|
| `name` | Yes | string, <=256 chars; no `:`; must not start `-`; filename need not match | hooks receive it as `agent_type`; `:` reserved for plugin ids | L298 |
| `description` | Yes | string | when Claude should delegate | L299 |
| `tools` | No | comma-separated string (`Read, Grep, Bash`) or YAML list | omitted => inherits every tool available to subagents; none resolving => usually fails launch ("Agent would be spawned with zero tools"); use `skills` not `Skill` to preload | L300 |
| `disallowedTools` | No | same format as `tools` | removed from inherited/specified list; entry with specifier e.g. `Bash(git push *)` still removes whole tool | L301, L508 |
| `model` | No | `sonnet`, `opus`, `haiku`, `fable`, full ID (e.g. `claude-opus-5-5`), `inherit` | omitted => subagent model order | L302 |
| `permissionMode` | No | `default`, `acceptEdits`, `auto`, `dontAsk`, `bypassPermissions`, `plan`; `manual` = alias of `default` | ignored for plugin subagents; see A9 | L303 |
| `maxTurns` | No | int | at limit output marked partial (v2.1.246+), Claude can resume | L304 |
| `autoCompactWindow` | No | int 100000..1000000 | v2.1.296+; plain integer (`200k` is read as 200 = invalid) | L305, L1215-1227 |
| `skills` | No | list of skill names | full skill content injected at startup; first 32 distinct names; unlisted skills still invocable via Skill tool | L306, L645 |
| `mcpServers` | No | list: name string (shares parent connection) or inline `{name: {config}}` | ignored for plugin subagents | L307, L558 |
| `hooks` | No | hook config scoped to subagent | ignored for plugin subagents | L308 |
| `memory` | No | `user`, `project`, `local` | cross-session memory dir | L309, L672-676 |
| `background` | No | `true` | keep in background even when Claude asks to wait | L310 |
| `omitClaudeMd` | No | `true` | start without user/project/local CLAUDE.md; managed policy files still load except for managed subagents; ignored when agent is main-session agent; v2.1.271+ | L311 |
| `effort` | No | `low`, `medium`, `high`, `xhigh`, `max` (model-dependent) | overrides session effort, not `CLAUDE_CODE_EFFORT_LEVEL` env var | L312 |
| `isolation` | No | `worktree` | temp git worktree branched by default from default branch (not parent HEAD); auto-cleaned if no changes | L313 |
| `color` | No | `red`, `blue`, `green`, `yellow`, `purple`, `orange`, `pink`, `cyan` | task list/transcript display | L314 |
| `initialPrompt` | No | string | auto-submitted first user turn when agent is MAIN session agent (`--agent` or `agent` setting); commands/skills processed; prepended to user prompt; ignored for plugin subagents | L315 |
| `experimental` | No | map; key `cacheTtl` = `5m` or `1h` | prompt cache lifetime; other values ignored; `1h` ignored when subscription uses usage credits; only read from subagent files; v2.1.248+; must be nested, not top-level | L316-327 |
- NOT stated as fields: `version`, `thinking`, `permissions`, `allowedTools`, `maxTokens`, `timeout`, `temperature`. Extended thinking: inherited from main conversation, "no per-subagent thinking setting" (L425).
- No field for turn-limit besides `maxTurns`; no field for hooks matcher other than inside `hooks`.

### A6. CLI `--agents` JSON
- Shape: object, top-level key = agent name (must not start with `-`), value = definition (L220).
- Definition fields (L222-224): `prompt` (system prompt = markdown body equivalent; may be empty, v2.1.281+), plus `description`, `tools`, `disallowedTools`, `model`, `permissionMode`, `mcpServers`, `hooks`, `maxTurns`, `autoCompactWindow`, `skills`, `initialPrompt`, `memory`, `effort`, `background`, `omitClaudeMd`, `isolation`.
- Ignored (not rejected) here: `color`, `experimental` (L224).
- Empty `prompt` + no `memory` + selected via `--agent` => session system prompt unchanged (L222).
- Non-interactive: `--agents ./agents.json` accepts file path (`claude -p --agents ./agents.json "..."`); interactive refuses a path; v2.1.281+ (L218).
- Example JSON uses `tools: ["Read","Grep","Glob","Bash"]` (array) (L189).
- Invalid config handling: errors doc "Invalid --agents configuration" (L226); details not on this page.
- `--strict-mcp-config` does not filter inline servers passed via `--agents` / SDK `agents` option (L589).
- Inline MCP in `--agents`/user/managed agents loads without folder-trust check (L602).
- Non-interactive flags: `--append-subagent-system-prompt` (v2.1.205+) appends to every subagent incl. nested, excluding fork; `--append-subagent-system-prompt-file` (v2.1.261+) (L268).

### A7. Tools: allowlist, denylist, inheritance
- Default: inherit built-in + MCP tools of main conversation, narrowed by two filters (L443). Forks skip both filters, get parent's exact tool pool (L445).
- `disallowedTools` applied first, then `tools` resolved against remaining pool; tool in both is removed (L466).
- Filter 1 removes from EVERY subagent even if listed in `tools` (L446-454): `Agent` (when at depth limit; fork keeps it listed but errors), `AskUserQuestion`, `EndConversation`, `EnterPlanMode`, `ExitPlanMode` (unless `permissionMode: plan`), `ScheduleWakeup`, `WaitForMcpServers`, `Workflow`.
- Filter 2 (background subagents, the default): keep every MCP tool + only these built-ins (L456): `Read`, `Grep`, `Glob`, `LSP`, `Bash`, `PowerShell`, `Edit`, `Write`, `NotebookEdit`, `WebFetch`, `WebSearch`, `TodoWrite`, `Skill`, `ToolSearch`, `EnterWorktree`, `ExitWorktree`, `Monitor`, `TaskStop`, `SendMessage`, `Artifact`, plus `SubagentHandback` for a subagent that reports through it. `Agent`/`ExitPlanMode` follow filter-1 conditions. Others removed silently (error only if `tools` then resolves to nothing). Same definition can resolve differently fg vs bg. `LSP` unavailable to bg before v2.1.280 (L458).
- `ListAgents` follows filters; fg subagent inherits it where cross-session messaging enabled; bg does not (L460).
- Teammates additionally keep `TaskCreate`, `TaskGet`, `TaskList`, `TaskUpdate`, `CronCreate`, `CronDelete`, `CronList`; without Task tools in session, subagents don't get task tools (L462).
- MCP tool entries (L492-496): `mcp__github__*` in `tools` = all tools of server; `mcp__github` or `mcp__github__*` in `disallowedTools` = withhold server; `mcp__*` in `disallowedTools` = withhold all MCP. Server names containing `__` (e.g. `reports__v2`): in `tools` write `mcp__reports__v2__*`; in `disallowedTools`, `mcp__reports` also removes `reports__v2` tools (L510-515).
- Example `tools: Read, Grep, Glob, Bash` => no edit/write/MCP tools (L468-476).
- Specifier-level command blocking must use `permissions.deny` Bash rule e.g. `Bash(git push *)`; applies to main + subagents (L508).
- Without `Skill` in `tools`/with it in `disallowedTools`, subagent cannot invoke skills (L645).

### A8. Restricting which subagents can be spawned
- Rename: v2.1.63 Task tool renamed Agent; `Task(...)` still works as alias in settings and agent defs (L521-523).
- `tools: Agent(worker, researcher), Read, Bash` = allowlist of spawnable types; others fail (L529-533). `Agent` bare = any; omit `Agent` = no spawning (L535-541).
- `Agent(agent_type)` allowlist applies ONLY to an agent running as main thread via `claude --agent`. In a subagent definition, `Agent` in `tools` allows nested spawning (depth-limited) but parenthesized type list is IGNORED (L543).
- Block specific agents: `permissions.deny` `Agent(<name>)`; also `claude --disallowedTools "Agent(Explore)"` (L750-763). Block forks only: `"Agent(fork)"` in `permissions.deny` (L1294).

### A9. Models
- Values: aliases `sonnet`, `opus`, `haiku`, `fable`; full ID (`claude-opus-5-5`, `claude-sonnet-5`); `inherit` (L349-353).
- Resolution order (L355-360): 1) per-invocation `model` param on Agent call (alias only; not full ID/`inherit`); 2) definition `model` (incl. `inherit`); 3) `CLAUDE_CODE_SUBAGENT_MODEL`; 4) main conversation model (or spawning subagent's for nested).
- Alias persists on resume/follow-up (L362). Mod `agent.spawn` hook model replaces per-invocation param (L362).
- `CLAUDE_CODE_SUBAGENT_MODEL` alone does not change Explore/Plan model (L364).
- Force all: `CLAUDE_CODE_SUBAGENT_MODEL` + `CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1` (v2.1.257+); then `model` field ignored and Claude cannot pass model; forks and skills-in-subagent with `model: inherit` still use parent model; FORCE alone => main model (Explore keeps its listed model) (L384-404).
- Nested subagent default = spawning (parent) subagent's model; applies to `inherit`/no model, Explore/Plan/general-purpose, forks (L366-376).
- Family alias same family as parent => runs parent's exact version; fix by full model ID (L408-411). `ANTHROPIC_DEFAULT_OPUS_MODEL` for unknown-family case (L411).
- `availableModels` allowlist blocked => newest permitted in family, else `CLAUDE_CODE_SUBAGENT_MODEL`, else parent model; warning for top-level interactive (L415-421).
- Check model: `/tasks` (v2.1.242+) (L380).
- Fallback model chain: subagent report opens with `⚠ This agent switched to <model> because its earlier model could not be used.` (L999-1005).

### A10. Effort
- `effort` field; per-invocation `effort` param for non-fork subagent overrides field, persists on resume (v2.1.292+); `CLAUDE_CODE_EFFORT_LEVEL` env wins over both (L429-431).
- No field/param: on main model uses session level (`/effort`, `--effort`); on another model session level does not apply (L433-435).

### A11. Permission modes
- `permissionMode` values/behaviour (L618-628): `default` (Manual, prompts), `acceptEdits`, `auto` (background classifier), `dontAsk` (auto-deny prompts; explicit allows work), `bypassPermissions` (only when main conv is in it), `plan` (read-only). `manual` alias of `default`.
- Unset => inherits main conversation mode (L606).
- Parent mode overrides (L608-616): parent `bypassPermissions`/`acceptEdits`/auto => subagent uses parent mode, field ignored. Parent `plan` => subagent stays plan (except team teammates; `dontAsk` then denies instead of prompting). Parent `default`/`dontAsk` => field honored, except `bypassPermissions` (v2.1.267+) and `auto` when auto mode unavailable (`disableAutoMode` or model unsupported) keep parent's mode.
- Plugin subagents ignore `permissionMode` (L303, L234).
- Output scanning: final report scanned; backslash inserted into imitation tags like `<system-reminder>` or `Human:`/`Assistant:` lines; marker line starting `[harness: subagent output matched instruction-shaped pattern(s):` prepended when report imitates tag or mentions `bypassPermissions` / `--dangerously-skip-permissions`; report arrives under header saying instructions/approval claims have no authority (L1009-1020).
- Message authority: no agent message counts as user approval; cannot change subagent permission settings, `CLAUDE.md`, or configuration (L1174).

### A12. Skills preloading
- `skills:` list injects full content at startup (up to 32 distinct names); not an access restriction (L645).
- Cannot preload skills with `disable-model-invocation: true` (incl. bundled `/verify`) (L647).
- Missing/disabled skill skipped, debug-log warning (L649).
- Inverse of skill `context: fork` (L653). Built-in agents preload no skills (L1125).
- In agent-team teammate: `skills` field NOT applied; teammate loads skills from project/user settings (agent-teams.md:L299).

### A13. MCP scoping (`mcpServers`)
- Entries: name string (shares parent connection) or inline definition keyed by server name; inline = same schema as `.mcp.json`, types `stdio`, `http`, `sse`, `ws`; connected at start, disconnected at finish (L547, L558-577).
- Inline server in project `.claude/agents/` or `--add-dir` agents loads only after folder trust (parent-folder trust and `-p` auto-trust do not count); else skipped + debug log key `projects["<path>"].hasTrustDialogAccepted` of `~/.claude.json`; since v2.1.238 (L593-597). No trust check for: name refs, `~/.claude/agents/`, `--agents`/SDK `agents`, managed (L599-602).
- Blocked by `--strict-mcp-config`, `--bare`, managed MCP config, `allowedMcpServers`/`deniedMcpServers` => skipped with warning (L581-587).
- Works also when agent is main session via `--agent`/`agent` setting (L551-556).
- Plugin agents: ignored; ship in plugin `.mcp.json` instead (L234-236).

### A14. Hooks
- Two config places (L770-775): agent frontmatter `hooks`; `settings.json` (also managed policy, plugins) which fire inside subagents too (tool events `PreToolUse`/`PostToolUse` fire for subagent calls).
- Frontmatter hooks fire when spawned via Agent tool or @-mention, and when agent runs as main session via `--agent`/`agent` setting (alongside settings hooks) (L783).
- Project subagent frontmatter hooks require workspace-trust of the folder containing the file; user-level and `--agents` do not; `--add-dir` outside trusted repo needs own trust; untrusted => subagent runs, hooks skipped, debug-log error; parent-folder trust insufficient; `-p` not trusted (L785-787).
- "All hook events supported" in frontmatter; common (L789-795): `PreToolUse` (matcher = tool name), `PostToolUse` (tool name), `Stop` (no matcher; converted to `SubagentStop` at runtime) (L817).
- Settings-level events (L823-828): `SubagentStart`, `SubagentStop`; matcher input = agent type name (frontmatter `name`; plugin-scoped id like `my-plugin:db-agent`). A scoped name has `:` so is evaluated as UNANCHORED regex; anchor `^my-plugin:db-agent$`. Matcher omitted => all agents.
- Hook entry shape: `{ "type": "command", "command": "..." }`; frontmatter shape `hooks: <Event>: - matcher: "..." hooks: - type: command command: "..."` (L706-717, L800-814).
- Hook input = JSON on stdin; Bash command at `tool_input.command`; exit code 2 blocks and feeds stderr to Claude (L720-744). Script must be executable on macOS/Linux or hook fails instead of blocking (L738). Windows: `shell: powershell` on hook entry (L746).
- Plugin subagents ignore `hooks`; plugin ships `hooks/hooks.json` (L234-236).
- `SubagentStart` hooks receive `name` as `agent_type` (L298).

### A15. Memory (`memory` field)
| Scope | Directory | Cite |
|---|---|---|
| `user` | `~/.claude/agent-memory/<name-of-agent>/` | L674 |
| `project` | `.claude/agent-memory/<name-of-agent>/` (VCS-shareable; recommended default) | L675, L688 |
| `local` | `.claude/agent-memory-local/<name-of-agent>/` (not VCS) | L676 |
- Part of auto memory: disabled by `autoMemoryEnabled` setting or `CLAUDE_CODE_DISABLE_AUTO_MEMORY` => field has no effect (L678).
- When on: prompt gets memory instructions; first 200 lines or 25KB of `MEMORY.md` (whichever first) injected; Read/Write/Edit auto-enabled (L680-684).
- Main conversation's auto memory NOT loaded into subagent (L1137).

### A16. Invocation / delegation
- Automatic: description matching; phrase like "use proactively" in `description` encourages it (L860).
- Natural language naming ("Use the test-runner subagent ...") - Claude decides (L870-879).
- @-mention: `@"code-reviewer (agent)"` via typeahead guarantees that subagent runs; or manual `@agent-<name>` (plugin: `@agent-my-plugin:code-reviewer`). Full message still goes to Claude which writes the task prompt (L881-891).
- Session-wide: `claude --agent <name>` (main thread takes tool restrictions + model; system prompt REPLACES default unless prompt empty; CLAUDE.md + project memory still load even with `omitClaudeMd`; `-p` with own prompt skips git status snapshot) (L893-903). Or `"agent": "<name>"` in `.claude/settings.json`; CLI flag wins (L919-927). Persists across resume; missing agent => warning, default tools (L903). Plugin disambiguation: `--agent my-plugin:security-reviewer`, `my-plugin:review:security` (L905-917).
- Chaining: Claude passes context between sequential subagents (L1048-1054). Parallel research: multiple subagents; results consume main context (L1032-1044).
- `/subtask <task>` starts a fork anytime (L1247).
- Transcript shows delegation as `code-improver(Suggest code improvements)` style row (L137).

### A17. Foreground vs background
- Default: subagent Claude spawns from main conversation starts in BACKGROUND (L310, L938).
- `claude -p`/SDK: Claude can wait; interactive/VS Code/desktop: waiting requires fork mode off (`CLAUDE_CODE_FORK_SUBAGENT=0`) (L940-947).
- `background: true` in frontmatter forces background (L310).
- `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1`: Claude waits for subagents; no background commands; Ctrl+B inert (L963). Ctrl+B moves a waited subagent to background (L961).
- Foreground: blocks main conv; permission prompts pass through. Background: prompts surface in main session naming the subagent; Esc denies one call; durable grants apply to whole session (L933-934, L969).
- Skill `context: fork` follows skills doc rules instead (L943).
- Bg results arrive as completion notification in later turn; Claude waits for it (L973). Panel/task-list retention: success row removed immediately + `/tasks to see subagents` hint 30s (v2.1.232+); fail/stop row kept 30s; `x` clears (L977-982).

### A18. Nesting, concurrency
- Default: subagents may spawn subagents up to THREE layers below main; at limit `Agent` withheld (fork keeps it but it errors) (L1077).
- `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` = layers (e.g. `"2"`); `1` turns nesting off (L1084-1094). Per-agent prevent: omit `Agent` from `tools` or add to `disallowedTools` (L1096).
- Interactive: only top-level summary returns (spawner waits for nested). `-p`/SDK: waits while fork mode on; fork off => nested start in background (L1081-1082).
- Concurrency: 20 running => `Concurrent subagent limit reached` (Claude told not to retry); `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS` positive integer; ultracode sessions exempt; v2.1.217+ (L1104). `/subtask` forks and resumes bypass the check (L1108-1109). No total-spawn cap (L1102). Workflow agents/teammates use their own limits (L1111).

### A19. Context a subagent receives (non-fork) (L1117-1138)
- Receives: its system prompt + env details; delegation task message; ALL CLAUDE.md hierarchy (incl. `~/.claude/CLAUDE.md`, project rules, `CLAUDE.local.md`, managed policy, `AGENTS.md`) except Explore/Plan/`omitClaudeMd`; git status snapshot (Explore/Plan skip; cannot be changed otherwise); preloaded skill content; sibling roster reminder (only if tools include `SendMessage` and another agent has a name).
- `omitClaudeMd` agents + Explore/Plan still get subdirectory CLAUDE.md and path-scoped rules when touching files there (L1128).
- Does NOT receive: conversation history, previously invoked skills, files already read, output style (except fork), main auto memory, parent's context-window size (own model's window) (L1117, L1134-1138).
- Rules for a subagent must be restated in the delegation prompt if needed (L1130).
- Fork = inherits full history, system prompt, tools, model; shares prompt cache; can use `isolation: "worktree"` on Agent call; cannot spawn forks (L1240-1288). Fork mode on by default from v2.1.302 (interactive terminal from v2.1.232) (L1297). Turn off: `CLAUDE_CODE_FORK_SUBAGENT=0` or `"Agent(fork)"` deny (L1292-1295).

### A20. Worktree isolation
- `isolation: worktree` => Bash/PowerShell run inside worktree; commands resolving to main checkout fail; Bash commands redirecting git to main checkout blocked; commands whose git target can't be verified refused; PowerShell gets only working-dir check; `Monitor` same checks (L270-283).
- Main conv itself in worktree => same checks for all subagents (L285).
- Named-subagent-as-teammate ignores frontmatter `isolation`; runs in main working dir (L988).

### A21. Resume / continuation / transcripts
- Each invocation = new instance; to continue, ask Claude to resume; resumed keeps full history (L1142-1144).
- Resume via `SendMessage` tool, `to` = agent ID or name; `SendMessage` works without agent teams; only structured protocol messages (`shutdown_request`, `plan_approval_response`) need teams (L1150).
- Completed/`TaskStop`-ed subagent resumes in background; keeps original tool set; user-stopped (`x` in `/tasks`, SDK `stop_task`) is not auto-resumed, message refused (L1162-1166).
- Name staleness check; errors report new target; scoped to conversation; reset on `/clear` (L1172).
- Names after restart: survive only if given since last compaction (v2.1.299+); else use agent ID; lookup in `agent-{agentId}.meta.json` (L1190-1192).
- Transcripts: `~/.claude/projects/{project}/{sessionId}/subagents/agent-{agentId}.jsonl`; independent of main compaction; persist within session; deleted after `cleanupPeriodDays` (default 30) (L1176-1182).
- Auto-compaction per subagent; `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` applies; boundary logged as `{"type":"system","subtype":"compact_boundary","compactMetadata":{"trigger":"auto","preTokens":N}}` (L1196-1211). `CLAUDE_CODE_AUTO_COMPACT_WINDOW` overrides `autoCompactWindow` (L1215).
- `maxTurns` stop => partial output, resumable (L1148).
- Subagent names: with agent teams enabled Claude may pass `name` on Agent call; makes addressable (L986).
- API errors: fg partial output returned with note, or `Agent terminated early due to an API error`; bg marked failed with last output (L994-997).

### A22. Plugin subagent restrictions (L232-236)
- `hooks`, `mcpServers`, `permissionMode` ignored (also `initialPrompt` ignored, L315). Workaround: copy into `.claude/agents/` or `~/.claude/agents/`.
- Scoped names `plugin:name`, `plugin:sub:name`; lowest precedence (L164, L178).

### A23. Version floors (sub-agents.md)
| Feature | Floor | Cite |
|---|---|---|
| `CLAUDE_CODE_DISABLE_EXPLORE_PLAN_AGENTS` | v2.1.198 | L85 |
| `--agents` file path; empty `prompt` | v2.1.281 | L218, L222 |
| `--append-subagent-system-prompt` / `-file` | v2.1.205 / v2.1.261 | L268 |
| unknown-field debug check; `autoCompactWindow` | v2.1.296 | L293, L305 |
| `claude plugin validate` on dir | v2.1.233 | L345 |
| `maxTurns` partial marker | v2.1.246 | L304 |
| `omitClaudeMd` | v2.1.271 | L311 |
| `experimental.cacheTtl` | v2.1.248 | L316 |
| `CLAUDE_CODE_SUBAGENT_MODEL_FORCE` | v2.1.257 | L384 |
| per-invocation `effort` param | v2.1.292 | L431 |
| `bypassPermissions` exception for subagent mode | v2.1.267 | L615 |
| inline MCP trust check | v2.1.238 | L593 |
| `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS` | v2.1.217 | L1104 |
| `/tasks` shows model | v2.1.242 | L380 |
| fork mode default on | v2.1.302 (terminal v2.1.232) | L1297 |
| `/btw` from open transcript | v2.1.314 | L1270 |
| `Ctrl+Enter` mid-work message | v2.1.286 | L1275 |
| name survives restart | v2.1.299 | L1192 |
| Task tool renamed Agent | v2.1.63 | L523 |
| `LSP` in bg subagents | v2.1.280 | L458 |
| `/agents` wizard removed (<=v2.1.197 had it) | v2.1.197 | L148 |
- Experimental/deprecated/renamed: `Task` -> `Agent` (alias retained); `experimental` frontmatter map; `/agents` wizard replaced by reminder text. Nothing marked deprecated beyond that.

---------------------------------------------------------------------
## PART B. AGENT TEAMS
---------------------------------------------------------------------

### B1. Status and enablement
- EXPERIMENTAL, disabled by default; known limits around session resumption, task coordination, shutdown (agent-teams.md:L9-11, L507).
- Enable: env `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` in shell or `settings.json`:
  `{"env": {"CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"}}` (L48-56).
- Requires interactive session; with `-p` (incl. Agent SDK) no teammates spawn; a named subagent runs as ordinary subagent (L60).
- SIDE EFFECT: when enabled, a subagent Claude gives a `name` launches as a TEAMMATE, even without user asking; no confirmation (L58, L245-247; sub-agents.md:L988). Exceptions: call is a fork, or passes `isolation` on the call itself (L245).
- Turn off: set var to `"0"`; reapplied on settings save, no new session needed; user `settings.json` `0` overrides shell export but project/local/`--settings`/managed settings with `1` win (L462-477). After off, names still work as `SendMessage` address (L479).

### B2. Architecture (L251-279)
| Component | Role |
|---|---|
| Team lead | main session; spawns teammates, coordinates; fixed for session lifetime (L255, L515) |
| Teammates | separate Claude Code instances |
| Task list | shared work items teammates claim/complete |
| Mailbox | inter-agent messaging |
- Mailbox: `~/.claude/teams/{team-name}/inboxes/{agent-name}.json`; entries validated on read; invalid ones reported as errors and removed, valid still delivered (L260). Message reported sent only if mailbox write succeeds; failure returns error to sender (L262).
- Team name = `session-` + first 8 chars of session ID (L266).
- Team config: `~/.claude/teams/{team-name}/config.json`; removed when session ends; holds runtime state (session IDs, tmux pane IDs); do not hand-edit/pre-author (overwritten) (L268, L273).
- Task list: `~/.claude/tasks/{team-name}/`; STAYS on disk after session; retention via `cleanupPeriodDays` (L269).
- Config `members` array: name + agent ID; lead's agent type is `team-lead`; teammate carries the agent type lead named (built-in or definition), omitted if none (L277). Teammates can read it to discover members.
- No project-level equivalent: `.claude/teams/teams.json` is NOT recognized config (L279).
- Reusable roles => use subagent definitions (L275).
- Dependencies auto-managed: completing a task unblocks dependents (L264).

### B3. Spawning and models
- Spawn by natural-language prompt; Claude decides count unless specified; no hard limit on teammates; suggests start 3-5; 5-6 tasks per teammate (L149-152, L403-421).
- Claude launches teammate when it calls the Agent tool with `name` while teams enabled (L245).
- Model order (L156-161): 1) model named in spawn prompt; 2) subagent definition `model` (`inherit` = lead's); 3) `CLAUDE_CODE_SUBAGENT_MODEL` if not `inherit`; 4) lead's current model. Before v2.1.251 env var was first (L167). Mod `agent.spawn` hook overrides source 1 (L163).
- `CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1` => sources 1-2 dropped (v2.1.257+) (L165).
- `teammateDefaultModel` REMOVED in v2.1.234; leftover ignored (L171).
- `availableModels` allowlist substitution: family alias => newest permitted version (Anthropic API / Claude Platform on AWS); else lead's model (L173-176).
- Teammate on lead's model inherits lead's effort; split-pane since v2.1.186 (L178).
- Model + fast mode fixed at spawn; `/model`, `/fast` while viewing teammate affect lead and don't run from that view (L202-204).

### B4. Using subagent definitions as teammates (L281-304)
- Name the agent type in spawn prompt ("using the security-reviewer agent type"). Scopes: project, user, managed, plugin.
| Definition part | In-process teammate | Split-pane teammate | Cite |
|---|---|---|---|
| `tools` | applied; `SendMessage` added; Task tools (`TaskCreate`,`TaskGet`,`TaskList`,`TaskUpdate`) added when session has them | applied (limits to list) | L293 |
| `model` | applied if spawn prompt names none | same | L294 |
| `disallowedTools` | applied; `SendMessage`/Task tools stay even if named | not stated | L295 |
| `effort` | applied | not stated | L296 |
| `autoCompactWindow` | applied (v2.1.296+) | ignored | L297 |
| body | APPENDED to default system prompt | REPLACES default system prompt | L298 |
| `skills` | NOT applied (loads project/user skills) | NOT applied | L299 |
| `mcpServers` | ignored (project/user MCP load) | applied | L300 |
- `hooks`, `permissionMode`, `memory`, `background`, `isolation`, `color`, `maxTurns`, `omitClaudeMd`, `initialPrompt`, `experimental`: NOT mentioned in teammate-application list (not stated).
- Re-bringing back a stopped in-process teammate on message: restores saved conversation; project/`--add-dir` definitions re-applied only if the agent file's folder is trusted (parent trust not enough); else comes back with only the tools Claude Code adds to every in-process teammate (L302-304). After session resume, teammates are NOT brought back (L302, L509).
- Peer subagents named by Claude can message each other (agent-teams.md:L39).

### B5. Display modes (L94-145)
| Mode | Behaviour |
|---|---|
| in-process (default) | all in main terminal; agent panel below prompt; Up/Down select, Enter view + message, Esc clear (Esc in transcript interrupts turn), `x` stop, Ctrl+T toggle task list |
| split panes | own pane each; needs tmux or iTerm2 + `it2` CLI with Python API enabled (iTerm2 > Settings > General > Magic > Enable Python API) |
- Setting: `teammateMode` in `~/.claude/settings.json`; values stated: `"auto"` (split panes when inside tmux/iTerm2, else in-process), `"tmux"` (panes in separate tmux session), `"iterm2"` (L118-137). Default = in-process (L116). Single session flag: `claude --teammate-mode auto` (experimental, absent from `--help`) (L142-145).
- Idle rows: hide 30s after whole panel idle, reappear on next turn; >3 idle collapse to `N idle agents` row (L84-86, L450).
- `tmux -CC` in iTerm2 suggested entry; tmux works best on macOS (L103).

### B6. Plan approval (L180-190)
- Teammate spawned while lead is in plan mode works in plan mode until plan ready; sends plan approval request to lead.
- If teammate's permission mode unchanged since spawn, Claude Code APPROVES AUTOMATICALLY on arrival without lead review; teammate exits plan mode, gets lead's current permission mode (Manual if lead in plan).
- If user put an in-process teammate in plan mode via Shift+Tab, the lead reviews plan (approves or sends back); user not asked.
- Teammate permission prompts surface in lead session; user does not approve a teammate's plan (L323).
- Protocol messages named: `plan_approval_response`, `shutdown_request` (sub-agents.md:L1150).

### B7. Permissions (L306-332)
- No per-teammate mode at spawn; teammate starts with lead's mode incl. `bypassPermissions`; lead `dontAsk` => teammate starts Manual (split-pane lead Manual/`dontAsk` needs v2.1.317+) (L316, L516).
- In-process non-plan teammate follows lead's mode while lead is `acceptEdits`/`auto`/`bypassPermissions`; Manual on teammate doesn't change that (L312).
- In-process: lead's live allow/deny rules apply (`--disallowedTools`, `--tools`, `--allowedTools`). Split-pane: `--disallowedTools` and `--tools` passed (v2.1.309+); `--allowedTools` NOT passed; use `permissions.allow` via `--settings` (L318-321).
- `SendMessage` content tagged as from another Claude session; teammates cannot approve prompts or relay consent; auto-mode classifier treats relayed approval as untrusted and reviews each message (incl. `shutdown_request`/plan approval response) before delivery (L327-333).

### B8. Context and communication (L334-347)
- Teammate loads same project context as regular session: CLAUDE.md, MCP servers, skills. `--setting-sources` on lead restricts teammates (split-pane since v2.1.281). Receives spawn prompt; lead's conversation history does NOT carry over.
- Delivery automatic; idle notification includes final answer; API-error end notifies lead with error text.
- Messaging: to one teammate by name; broadcast = one message per recipient (no broadcast primitive stated). Lead assigns names; user can specify names in spawn prompt.
- Messaging tool: `SendMessage` (L293, L327); `SendMessage` `to` = name or `main` (sub-agents.md:L1126).

### B9. Tasks (L206-217)
- States: pending, in progress, completed; dependencies show blocked; teammates don't self-claim blocked tasks, lead/user can assign.
- Assignment: lead assigns, or self-claim next unassigned unblocked task; claiming uses FILE LOCKING (race protection).
- Without Task tools, agents coordinate by messages only (L210). Task tools: `TaskCreate`, `TaskGet`, `TaskList`, `TaskUpdate`.
- Known issue: teammates may fail to mark tasks completed, blocking dependents (L510).

### B10. Shutdown / cleanup (L219-229, L511)
- Ask lead by name; lead sends shutdown request; teammate approves or rejects with explanation. Finishes current request/tool call first (slow).
- Shared dirs cleaned automatically at session end (config dir removed; task dir kept) (L229, L268-269).
- Orphaned tmux: `tmux ls`, `tmux kill-session -t <session-name>` (L496-503).

### B11. Hooks tied to teams (L231-237)
| Event | Fires | Exit code 2 |
|---|---|---|
| `TeammateIdle` | teammate about to go idle | send feedback, keep teammate working |
| `TaskCreated` | task being created | prevent creation, send feedback |
| `TaskCompleted` | task being marked complete | prevent completion, send feedback |
- Matcher/input schema for these not on this page (links to hooks doc).

### B12. Token cost (L26, L42, L349-353)
- Significantly more tokens than single session; scales linearly with active teammates; each teammate separate Claude instance.
- In-process teammate requests are outside main conversation cache TTL bucket: 5-minute cache default (even on subscription); `subagentPromptCacheTtl` = `1h` to extend (1h writes billed higher) (L353).

### B13. Comparison table (L36-42)
| | Subagents | Agent teams |
|---|---|---|
| Context | own window; results return to caller | own window; fully independent |
| Communication | return result to caller; named subagents can also message each other | teammates message each other directly |
| Coordination | main agent manages all | self-coordination + shared task list (for agents with Task tools) |
| Best for | focused tasks, only result matters | complex work needing discussion |
| Token cost | lower | higher |
- Guidance: sequential tasks, same-file edits, many dependencies => single session or subagents (L26).

### B14. Limitations (L507-517)
1. No session resumption with in-process teammates (`/resume`, `/rewind` don't restore).
2. Task status can lag.
3. Shutdown can be slow.
4. ONE team per session; no extra named teams; no sharing across sessions.
5. NO nested teams: teammates cannot spawn teammates; only lead manages team.
6. No background subagents from in-process teammates (error if definition sets `background: true`; `run_in_background: true` fails or runs foreground).
7. Lead fixed; no promotion/transfer.
8. No per-teammate permission modes at spawn.
9. Split panes require tmux or iTerm2.

### B15. Best practices stated (L388-441)
- Give teammates task-specific detail in spawn prompt (they don't inherit history).
- Start with research/review before parallel implementation.
- Avoid file conflicts: each teammate owns a different set of files (L437).
- Lead may start implementing itself; remedy phrase "Wait for your teammates to complete their tasks before proceeding" (L425-429).
- Monitor and steer; don't run unattended too long.
- Claude may use subagents instead of a team; panel doesn't distinguish; ask explicitly for "an agent team" (L76).

---------------------------------------------------------------------
## NOT STATED (page silent or ambiguous)
---------------------------------------------------------------------
- No documented field for per-agent `version`, `timeout`, `thinking`, `temperature`, `tags`, `allowedTools` in subagent frontmatter.
- Whether `tools` may be written with spaces after commas only vs both: text says "comma-separated string such as `Read, Grep, Bash` or a YAML list" (L300); no stricter grammar.
- Whether `description` has a length cap (only the 15,000-token aggregate is stated).
- Whether `name` is case-sensitive or must be lowercase/kebab-case (only length, `:`, leading `-` rules; example names are kebab-case).
- Whether `model: inherit` + `CLAUDE_CODE_SUBAGENT_MODEL` interplay beyond the order list.
- Hook event matcher/input schema for `TeammateIdle`, `TaskCreated`, `TaskCompleted` (hooks doc only).
- Which frontmatter fields (other than tools, model, disallowedTools, effort, autoCompactWindow, body, skills, mcpServers) apply to a teammate; `hooks`, `permissionMode`, `memory` etc. unspecified.
- `SendMessage` argument schema beyond `to` (and structured `shutdown_request`, `plan_approval_response`).
- Exact `TeamCreate`-style tooling: no team-creation tool name is given; teams form via Agent tool + `name`.
- Whether a project-level agents directory other than `.claude/agents/` exists (e.g. Codex/Cursor bundles): not covered.
- Plugin agent `agents/` frontmatter beyond restrictions: see plugin components doc (not read).
- Behaviour of the `Agent(...)` allowlist for agents that are teammates: unspecified.
- Which hook "all events" exist: link only.

---------------------------------------------------------------------
## AUDIT CHECKPOINTS (testable against `.claude/agents/*.md` and delegation/team prose)
---------------------------------------------------------------------
1. Every agent file starts with `---` on line 1; else treated as docs, skipped (sub-agents.md:L334).
2. Every agent file has both `name` and `description`; missing `description` => skipped (L336).
3. `name` <=256 chars, no `:`, not starting `-` (L335); same `name` not declared twice anywhere under `.claude/agents/` (L176).
4. Frontmatter keys exactly camelCase from the table (`maxTurns`, `disallowedTools`, `permissionMode`, `mcpServers`, `omitClaudeMd`, `autoCompactWindow`, `initialPrompt`); misspelled keys are silently ignored (L291).
5. No fields outside the documented set (A5) appear and are presumed functional (e.g. `version`, `allowedTools`, `permissions`, `timeout`); flag as inert.
6. `model` values are only `sonnet`/`opus`/`haiku`/`fable`/full ID/`inherit` (L302); no stale/other aliases.
7. `permissionMode` values only `default`, `acceptEdits`, `auto`, `dontAsk`, `bypassPermissions`, `plan`, `manual` (L303); none misspelled (e.g. `bypass`, `ask`).
8. `effort` only `low|medium|high|xhigh|max` (L312); `color` only the 8 listed (L314); `memory` only `user|project|local` (L309); `isolation` only `worktree` (L313).
9. `tools` is comma-separated string or YAML list; entries are real tool names; no `Skill` used for preloading (use `skills`) (L300).
10. Agents intended read-only omit `Write`/`Edit` (or use `disallowedTools`); do not rely on `Bash(...)` specifiers in `disallowedTools` (removes whole tool) (L508).
11. Agents that rely on spawning list `Agent` (or legacy `Task`) in `tools`; `Agent(type)` allowlists are only effective for `--agent` main-thread agents and are ignored in subagents (L543).
12. Any agent expecting `AskUserQuestion`, `EnterPlanMode`, `Workflow`, `ScheduleWakeup` as a subagent is wrong: always stripped (L446-454).
13. Agents expecting tools beyond the background built-in set (A7 filter 2) behave differently in background (default) runs (L456).
14. Agents that need hooks, `mcpServers`, `permissionMode` are NOT shipped via plugin agents (ignored there) (L234).
15. Agent files with frontmatter `hooks` use `PreToolUse`/`PostToolUse`/`Stop`; `Stop` is mapped to `SubagentStop`; scripts are executable and exit 2 to block (L795, L738).
16. Settings-level subagent hooks use `SubagentStart`/`SubagentStop` with matcher = agent `name`; plugin-scoped ids are unanchored regex (L828).
17. `skills:` entries refer to skills without `disable-model-invocation: true`; <=32 names (L645-647).
18. Agent prompts that expect the Claude Code system prompt, conversation history, or output style are wrong: subagents get body + env + CLAUDE.md + task message only (L266, L1117-1136).
19. Delegation prose tells the model to put all needed context in the delegation prompt (subagent sees no history) (L1117, L1130).
20. Descriptions are short and routing-specific; combined non-built-in descriptions < 15,000 tokens; "use proactively" wording used where auto-delegation wanted (L27, L860).
21. Prose does not assume foreground waiting; background is default; waiting needs fork mode off or `-p` (L938-947).
22. Prose assuming nesting depth: default 3 layers, `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` configurable, `1` disables; concurrency cap 20 (L1077, L1084, L1104).
23. Prose that uses `memory:` points to `.claude/agent-memory/<name>/` (project), `~/.claude/agent-memory/<name>/` (user), `.claude/agent-memory-local/<name>/` (local), and notes `MEMORY.md` truncation at 200 lines/25KB (L674-683).
24. Agent-teams prose declares the feature experimental and gated by `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` (L9-11); does not assume `.claude/teams/teams.json` project config (L279).
25. Team prose notes: one team per session, no nested teams, lead fixed, teammates don't inherit lead history (L512-515, L338).
26. Team prose does not assume per-teammate `permissionMode` at spawn or a way to set teammate model after spawn (L316, L204).
27. Team prose does not rely on `skills`/`hooks`/`memory` in a subagent definition being applied to teammates (`skills` explicitly not; others unstated) (L299).
28. Team prose acknowledges named subagents become teammates when teams are enabled (and `isolation` frontmatter is then not honoured) (L58, L988).
29. Plan-approval flows: documented behaviour auto-approves a teammate plan if mode unchanged; prose claiming the lead/human always reviews teammate plans is inaccurate (L188).
30. Team hook prose uses `TeammateIdle`/`TaskCreated`/`TaskCompleted` with exit code 2 semantics only as stated (L235-237); file ownership per teammate recommended to avoid overwrites (L437).
31. Messaging prose treats inter-agent messages as non-authoritative; no agent message approves permission prompts (L327, L1174).
32. Legacy `Task(...)` references are accepted aliases of `Agent(...)` (v2.1.63) (L523).

---------------------------------------------------------------------
Confidence: High for items cited (read verbatim, all 2020 lines covered). Version floors are as stated in-page; page content dated by download 2026-11-15.
