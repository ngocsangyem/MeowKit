# Codex docs reference (skills, hooks, rules, platform blog)

Sources (local, downloaded 2026-11-15), cited as `file:Lnn`:
- `skills` = build-skills.md (244 lines, fully read)
- `hooks` = hooks.md (1153 lines, fully read)
- `rules` = agent-configuration-rules.md (138 lines, fully read)
- `blog` = blog-codex-as-a-platform.md (114 lines, fully read) -- NON-NORMATIVE

Facts only from these four pages. Gaps listed under "Not stated" per section.

---------------------------------------------------------------------
## 1. SKILLS (build-skills.md)

### 1.1 What / products
- Skill = directory with `SKILL.md` + optional scripts/references; builds on open agent skills standard (agentskills.io). skills:L5-8, L48
- Skills = authoring format; plugins = distribution (shared plugin directory for ChatGPT and Codex). skills:L10-16
- Standalone skills: ChatGPT desktop app, Codex CLI, IDE extension. Skills bundled in plugins also in Chat/Work across ChatGPT web/desktop/mobile. skills:L18-20
- Progressive disclosure: only name + description loaded first; full SKILL.md loaded on selection. skills:L33-35

### 1.2 Layout
| Path | Status | Cite |
|---|---|---|
| `my-skill/SKILL.md` | Required: instructions + metadata | skills:L58-60 |
| `scripts/` | Optional executable code | skills:L62-64 |
| `references/` | Optional docs | skills:L66-68 |
| `assets/` | Optional templates/resources | skills:L70-72 |
| `agents/openai.yaml` | Optional: appearance, invocation policy, deps | skills:L74-80, L207 |

### 1.3 SKILL.md frontmatter
- `name` and `description` MUST be present. skills:L48
- Minimal example: frontmatter `name: skill-name`, `description: ...` then body. skills:L123-130
- No other frontmatter fields, no length/charset/regex constraints on name/description stated (see Not stated).
- Description guidance: concise, clear scope/boundaries, front-load key use case + trigger words so matching survives shortening. skills:L101-103

### 1.4 Optional metadata file `agents/openai.yaml`
Purpose: UI metadata in ChatGPT desktop app, invocation policy, tool dependencies. skills:L207
Keys shown (all under 3 top-level maps), skills:L209-228:
| Key | Example / meaning |
|---|---|
| `interface.display_name` | optional user-facing name |
| `interface.short_description` | optional user-facing description |
| `interface.icon_small` | `./assets/small-logo.svg` |
| `interface.icon_large` | `./assets/large-logo.png` |
| `interface.brand_color` | `"#3B82F6"` |
| `interface.default_prompt` | optional surrounding prompt |
| `policy.allow_implicit_invocation` | bool, default `true`; `false` = no implicit invocation, explicit `$skill` still works. skills:L230 |
| `dependencies.tools[]` | items with `type` (`"mcp"`), `value` (`openaiDeveloperDocs`), `description`, `transport` (`streamable_http`), `url` |

### 1.5 Discovery locations (Codex)
Codex reads repo, user, admin, system locations. skills:L138
| Scope | Location | Cite |
|---|---|---|
| `REPO` | `$CWD/.agents/skills` | skills:L142 |
| `REPO` | `$CWD/../.agents/skills` (folder above CWD inside a Git repo) | skills:L143 |
| `REPO` | `$REPO_ROOT/.agents/skills` (topmost root) | skills:L144 |
| `USER` | `$HOME/.agents/skills` | skills:L145 |
| `ADMIN` | `/etc/codex/skills` | skills:L146 |
| `SYSTEM` | bundled with Codex; includes `skill-creator`, `skill-installer`; enabled by default | skills:L147 |
- Repo scan: `.agents/skills` in EVERY directory from CWD up to repo root. skills:L138
- Symlinked skill folders supported; Codex follows symlink target. skills:L149
- Duplicate `name`: NOT merged; both can appear in selectors. skills:L138
- Precedence ordering among scopes: NOT stated.
- Change detection: automatic; restart Codex if an update does not appear. skills:L132, L175-176
- Locations are "for authoring and local discovery"; distribution beyond one repo -> plugins. skills:L151-153

### 1.6 Listing / budget / invocation
- Codex initial list includes name, description AND file path per skill. skills:L37
- Default budget: at most 2% of model context window, or 8,000 chars if window unknown. skills:L38-39
- Over budget: descriptions shortened first; for large sets some skills may be omitted from initial list with a warning. skills:L40-42
- Config `skills.max_context_tokens` sets other budget, max 10,000 tokens. skills:L43-44
- Budget applies only to the initial list; selected skill still fully read. skills:L46
- Explicit invocation: ChatGPT `@skill`; Codex CLI/IDE `/skills` or `$` mention. skills:L95-97
- Implicit invocation: when task matches `description`. skills:L98-99
- Builtin creator: `$skill-creator` (Codex), `@skill-creator` (ChatGPT Work); default instruction-only. skills:L112-119
- Installer: `$skill-installer linear` (example); can pull from other repos. skills:L168-174
- Record & Replay can draft a skill from demonstration. skills:L107-110

### 1.7 Enable/disable (TOML)
File: `~/.codex/config.toml`. skills:L183
```toml
[[skills.config]]
path = "/abs/path/to/skill/SKILL.md"   # OR  name = "skill-name"
enabled = false
```
- Exactly ONE selector per entry: `path` (absolute, matches one SKILL.md) or `name` (matches all skills with that name). skills:L191-193
- Multiple matching entries: LAST wins. skills:L193
- Disable all bundled system skills for a project (in its TRUSTED `.codex/config.toml`):
```toml
[skills.bundled]
enabled = false
```
skills:L195-201. Restart Codex after config change. skills:L203

### 1.8 Plugins / distribution
- Plugins can include 1+ skills; optionally registered MCP server connections, bundled MCP server config, presentation assets. skills:L162-164
- Use plugins to distribute, bundle 2+ skills, or ship skill with a connector. skills:L157-160
- Plugin docs URL referenced (not in scope): developers.openai.com/plugins/build/plugins. skills:L15, L160

### 1.9 Best practices (stated)
One job per skill; prefer instructions over scripts unless determinism/tooling needed; imperative steps with explicit inputs/outputs; test prompts against description. skills:L234-237

### 1.10 Skills: Not stated
- Frontmatter limits (name length/charset/format, description max length), extra/unknown frontmatter keys, `allowed-tools` or similar fields.
- Precedence/shadowing order between REPO/USER/ADMIN/SYSTEM.
- Whether `.codex/skills` or `~/.codex/skills` are scanned (only `.agents/skills`, `/etc/codex/skills`).
- Whether `agents/openai.yaml` is read by CLI for anything beyond `allow_implicit_invocation` (page says it configures ChatGPT desktop app UI + policy + deps).
- Behavior when `skills.max_context_tokens` is a config-reference key location (only linked).
- Admin skills: how `/etc/codex/skills` interacts on non-Linux.
- Skill file size limits; SKILL.md body size.

---------------------------------------------------------------------
## 2. HOOKS (hooks.md)

### 2.1 Overview / run model
- Hooks = extensibility framework; run scripts or MCP tools during the agentic loop. hooks:L5-6
- Matching hooks from multiple files ALL run; multiple matching command hooks per event launch CONCURRENTLY (one can't stop another starting). hooks:L16-18
- Non-managed hooks must be reviewed + trusted before they run. hooks:L19
- Default: Codex waits for a sync command hook before continuing. hooks:L577-579
- Commands run with session `cwd` as working directory. hooks:L196
- Repo-local hooks: prefer git-root-resolved path (e.g. `$(git rev-parse --show-toplevel)/.codex/hooks/...`) not relative `.codex/hooks/...`, since Codex may start in a subdirectory. hooks:L197-199

### 2.2 Event inventory (all names)
| Group | Events | Cite |
|---|---|---|
| During a turn | `PreToolUse`, `PermissionRequest`, `PostToolUse`, `PreCompact`, `PostCompact`, `UserPromptSubmit`, `SubagentStop`, `Stop` | hooks:L25 |
| Per model request attempt | `PreModelRequest`, `PostModelRequest` | hooks:L26 |
| Active-turn interrupt | `Interrupt` (not for subagents) | hooks:L27 |
| Session/subagent start | `SessionStart`, `SubagentStart` | hooks:L28 |
| Main thread end | `SessionEnd` (not for subagents) | hooks:L29 |
Total: 13 events. No `Notification`, `SessionStop`, etc. listed.

### 2.3 Enablement
- Hooks ENABLED BY DEFAULT. hooks:L315
- Disable in `config.toml`: `[features]` `hooks = false`. hooks:L317-320
- `hooks` is the feature key; `codex_hooks` = deprecated alias (still works). hooks:L322-323
- Admin force-off via `requirements.toml` `[features].hooks = false`. hooks:L323-324
- Force-on for managed hooks: pin `[features].hooks = true` in `requirements.toml` alongside `[hooks]`. hooks:L341-343

### 2.4 Config locations / formats / merge
- Discovered next to active config layers as `hooks.json` OR inline `[hooks]` tables in `config.toml`. hooks:L33-36
- Four typical: `~/.codex/hooks.json`, `~/.codex/config.toml`, `<repo>/.codex/hooks.json`, `<repo>/.codex/config.toml`. hooks:L45-48
- Multiple sources: ALL loaded; higher-precedence layers do NOT replace lower-precedence hooks (additive). hooks:L50-51
- Single layer with both `hooks.json` + inline `[hooks]`: merged, startup warning; prefer one. hooks:L52-53
- Plugins: bundled lifecycle config via plugin manifest or default `hooks/hooks.json`. hooks:L38-41
- Project-local hooks load ONLY if project `.codex/` layer is trusted; untrusted projects still load user + system hooks. hooks:L59-61

### 2.5 Trust / review
- Codex lists hooks, requires review+trust of exact definition before a non-managed hook runs; trust recorded against current hash; new/changed hooks flagged and SKIPPED until trusted. hooks:L65-68
- `/hooks` (CLI): inspect sources, review new/changed, trust, disable individual non-managed hooks; startup warning if review needed. hooks:L70-72
- Managed hooks (system, MDM, cloud, `requirements.toml`): marked managed, trusted by policy, cannot be disabled from user hook browser. hooks:L74-75
- Flag `--dangerously-bypass-hook-trust`: run enabled hooks without persisted trust for that invocation. hooks:L77-79
- Plugin hooks: same trust flow; CLI `/hooks`; desktop "Review hooks" in composer or Settings > Hooks; plugin update changing a bundled script forces re-review even if definition unchanged. hooks:L410-414, L55-57

### 2.6 Config shape (3 levels)
event -> matcher group -> handlers. hooks:L83-88
JSON skeleton (`hooks.json`): top-level optional `description`; `hooks` map keyed by event name; each value = array of `{ "matcher": "...", "hooks": [ handler,... ] }`. hooks:L90-177
```json
{ "description": "optional", "hooks": { "PreToolUse": [ { "matcher": "Bash", "hooks": [ { "type": "command", "command": "...", "timeout": 30, "statusMessage": "..." } ] } ] } }
```
Inline TOML equivalent: `[[hooks.<Event>]]` with `matcher = "..."`, then `[[hooks.<Event>.hooks]]` with handler keys. hooks:L203-229
```toml
[[hooks.PreToolUse]]
matcher = "^Bash$"
[[hooks.PreToolUse.hooks]]
type = "command"
command = '...'
timeout = 30
statusMessage = "..."
```
- Matcher omitted entirely is legal (examples for `SessionEnd`, `UserPromptSubmit`, `Stop` have no matcher). hooks:L107-117, L154-173

### 2.7 Handler schema
| Key | Applies | Meaning / default | Cite |
|---|---|---|---|
| `type` | all | `command` or `mcp_tool`; `prompt` and `agent` parsed but SKIPPED | hooks:L194-195 |
| `command` | command | shell command string | hooks:L99-100 |
| `timeout` | all | seconds; default `600` for most | hooks:L183-184 |
| `timeout` (SessionEnd, Interrupt) | | default `1`s, max `3`s (Interrupt configured range 1-3) | hooks:L185, L1134-1135 |
| `statusMessage` | all | optional message shown while running | hooks:L186 |
| `additionalContextLimit` | command | approx token threshold for `additionalContext`; default `2500`; positive int = custom; `0` = pass full context; ignored + config warning for events that can't produce additional context | hooks:L187-189, L562-567 |
| `commandWindows` | command | Windows-only override; TOML accepts `command_windows` or `commandWindows` | hooks:L190-191 |
| `async` | command | `true` = background run | hooks:L192-193 |
- JSON hook-file keys use camelCase (`statusMessage`, `additionalContextLimit`, `commandWindows`); managed TOML example uses `command_windows` and `statusMessage`. hooks:L362-364
- `hooks.json` top-level `description` is metadata only. hooks:L181-182

### 2.8 MCP tool handler (`type = "mcp_tool"`)
| Field | Meaning | Cite |
|---|---|---|
| `type` | must be `mcp_tool` | hooks:L266 |
| `server` | required; name of already-connected MCP server | hooks:L267 |
| `tool` | required; tool name on that server | hooks:L268 |
| `input` | optional JSON object of arg templates; default `{}` | hooks:L269 |
| `timeout` | optional active execution timeout, seconds, default `600` | hooks:L270 |
| `statusMessage` | optional | hooks:L271 |
- Templating: `${field.nested}` dotted read from hook event; whole-value placeholder keeps JSON type; placeholder inside larger string renders as text; objects/arrays expanded recursively. hooks:L275-298
- Uses existing MCP connection; does not start/reconnect servers. hooks:L302
- Blocks only if tool returns a blocking decision; errors, missing server, unavailable tool do NOT block. hooks:L303-305
- Synchronous; do not request tool approval nor trigger other hooks. hooks:L305-306
- Shorter of hook/server timeout applies; elicitation wait excluded from timeout. hooks:L307-308
- `SessionStart` MCP hooks may run before server ready -> then don't block. hooks:L309-310
- `SessionEnd` does NOT support MCP tool hooks. hooks:L311
- Same trust review and output contract as command hooks. hooks:L234-235
- Example in doc has matcher `Write|Edit` and `input.patch = "${tool_input.command}"`. hooks:L247-255

### 2.9 Matcher semantics
- `matcher` = regex string. `"*"`, `""`, or omitted = match every occurrence. hooks:L418-420
| Event | Matcher filters | Values / notes | Cite |
|---|---|---|---|
| `PermissionRequest` | tool name | `Bash`, `apply_patch` (also `Edit`/`Write`), MCP tool names | hooks:L426 |
| `PostToolUse` | tool name | see tool coverage | hooks:L427 |
| `PostCompact` | compaction trigger | `manual` or `auto` | hooks:L428 |
| `PreModelRequest`, `PostModelRequest` | not supported | | hooks:L429 |
| `PreCompact` | compaction trigger | `manual` or `auto` | hooks:L430 |
| `PreToolUse` | tool name | see tool coverage | hooks:L431 |
| `SessionEnd` | end reason | currently only `other` | hooks:L432 |
| `SessionStart` | start source | `startup`,`resume`,`clear`,`compact`,`fork` | hooks:L433 |
| `SubagentStart` | subagent type (`agent_type`) | values depend on subagent | hooks:L434, L730 |
| `SubagentStop` | subagent type (`agent_type`) | | hooks:L435, L1059 |
| `UserPromptSubmit` | not supported | configured matcher ignored | hooks:L436 |
| `Stop` | not supported | ignored | hooks:L437 |
| `Interrupt` | not supported | ignored | hooks:L438 |
- Example matchers: `Bash`, `^apply_patch$`, `Edit|Write`, `mcp__filesystem__read_file`, `mcp__filesystem__.*`, `startup|resume|clear|compact|fork`, `manual|auto`. hooks:L444-450
- `apply_patch` hook input still reports `tool_name: "apply_patch"` even if matched via `Edit`/`Write`. hooks:L764-766
- Matcher for tool events applies to `tool_name` AND matcher aliases. hooks:L764, L847

### 2.10 Tool coverage (PreToolUse / PostToolUse)
| Tool path | Pre | Post | Match as | Cite |
|---|---|---|---|---|
| Shell commands | Yes | Yes | `Bash` | hooks:L460 |
| Unified exec (`exec_command`) | Yes | Yes | `Bash`; later `write_stdin` poll can deliver original command's PostToolUse | hooks:L461 |
| `apply_patch` | Yes | Yes | `apply_patch`, `Edit`, or `Write` | hooks:L462 |
| MCP tools | Yes | Yes | e.g. `mcp__filesystem__read_file` | hooks:L463 |
| Other local function tools | Yes | Yes | function name e.g. `update_plan`; `spawn_agent` also matches `Agent` | hooks:L464 |
| Hosted tools (e.g. `WebSearch`) | No | No | not on local function-tool hook path | hooks:L465 |
- `write_stdin` does not re-run PreToolUse (transport for existing unified-exec session). hooks:L467-469
- Some specialized tool paths can opt out; "treat tool hooks as a useful guardrail, not a complete enforcement boundary". hooks:L471-472

### 2.11 Common input (stdin JSON, one object)
| Field | Type | Notes | Cite |
|---|---|---|---|
| `session_id` | string | subagent hooks use parent session id | hooks:L482 |
| `transcript_path` | string\|null | format not stable | hooks:L483, L496-497 |
| `cwd` | string | session working dir | hooks:L484 |
| `hook_event_name` | string | | hooks:L485 |
| `model` | string | Codex extension; active model slug | hooks:L486 |
| `turn_id` | string | Codex extension; listed per turn-scoped event | hooks:L488-489 |
| `permission_mode` | string | `default`,`acceptEdits`,`plan`,`dontAsk`,`bypassPermissions`; present on SessionStart, PreToolUse, PermissionRequest, PostToolUse, UserPromptSubmit, SubagentStart, SubagentStop, Stop, Interrupt | hooks:L491-494 |

### 2.12 Common output (stdout JSON)
Applies to `SessionStart`, `PreCompact`, `PostCompact`, `UserPromptSubmit`, `SubagentStop`, `Stop`; `SubagentStart` accepts same for `systemMessage` + hook-specific context only. hooks:L503-506
```json
{ "continue": true, "stopReason": "optional", "systemMessage": "optional", "suppressOutput": false }
```
| Field | Effect | Cite |
|---|---|---|
| `continue` | `false` marks that hook run as stopped | hooks:L519 |
| `stopReason` | recorded as stop reason | hooks:L520 |
| `systemMessage` | surfaced as warning in UI/event stream | hooks:L521 |
| `suppressOutput` | parsed, NOT implemented | hooks:L522 |
- Exit 0 + no output = success, continue. hooks:L524
- `PreToolUse`/`PermissionRequest`: support `systemMessage` only; `continue`, `stopReason`, `suppressOutput` unsupported -> hook run marked failed, error reported, tool call continues. hooks:L526-529
- `PostToolUse`: supports `systemMessage`, `continue:false`, `stopReason`; `suppressOutput` parsed-unsupported. hooks:L531-532

### 2.13 Per-event reference
| Event | Fires when | Matcher target | Extra stdin fields | stdout handling | Can block? | Cite |
|---|---|---|---|---|---|---|
| `SessionStart` | session starts/resumes/clears/compacts/forks | `source` | `source` (`startup`/`resume`/`clear`/`compact`/`fork`) | plain text = extra developer context; JSON: common fields + `hookSpecificOutput.hookEventName="SessionStart"`, `additionalContext` | `continue:false` after compact -> turn ends w/o another model request | hooks:L655-689 |
| `SessionEnd` | main thread ends (archive/delete open convo, normal close, idle 30 min not open in any client); not subagents | `reason` (only `other`) | `reason` | advisory; output doesn't steer or keep thread open; always sync even if async:true | No; timeout/error reported as hook failure | hooks:L691-726 |
| `SubagentStart` | subagent starts | `agent_type` | `turn_id`,`agent_id`,`agent_type`,`permission_mode` | plain text = developer context for subagent; JSON `systemMessage` + `hookSpecificOutput.additionalContext` (`hookEventName:"SubagentStart"`) | No: `continue:false` parsed, does not stop subagent | hooks:L728-756 |
| `PreToolUse` | before supported tool | tool_name+aliases | `turn_id`,`tool_name`,`tool_use_id`,`tool_input` | plain text ignored; see 2.14 | Yes (deny) | hooks:L758-838 |
| `PermissionRequest` | Codex about to ask approval (shell escalation, managed-network); not for commands needing no approval | tool_name+aliases | `turn_id`,`tool_name`,`tool_input`,`tool_input.description` (string\|null) | plain text ignored; see 2.15 | Yes (deny) / allow / abstain | hooks:L840-898 |
| `PostToolUse` | after tool produced output (also Bash non-zero exit) | tool_name+aliases | `turn_id`,`tool_name`,`tool_use_id`,`tool_input`,`tool_response` | plain text ignored; see 2.16 | Cannot undo; block replaces result with feedback | hooks:L900-951 |
| `PreModelRequest` | before each model request attempt (incl. retries) | none | `model`,`turn_id`, plus `agent_id`,`agent_type` when available | diagnostic only | No (can't change context or block) | hooks:L967-973 |
| `PostModelRequest` | after attempt outcome | none | above + `status` (`completed`/`failed`/`cancelled`), `error` (string\|null), `token_usage` (nullable) | diagnostic only | No | hooks:L967-981 |
| `PreCompact` | before compaction | `trigger` (`manual`/`auto`) | `turn_id`,`trigger` | plain text ignored; common output | `continue:false` -> stops before compacting | hooks:L983-999 |
| `PostCompact` | after compaction | `trigger` | `turn_id`,`trigger` | plain text ignored; common output | `continue:false` -> stops after compacting | hooks:L1001-1017 |
| `UserPromptSubmit` | before prompt sent | none | `turn_id`,`prompt` | plain text = developer context; JSON common + `additionalContext` | Yes: `decision:"block"`+`reason`, or exit 2 + stderr | hooks:L1019-1055 |
| `SubagentStop` | subagent stopping | `agent_type` | `turn_id`,`agent_id`,`agent_type`,`agent_transcript_path` (string\|null),`stop_hook_active` (bool),`last_assistant_message` (string\|null) | JSON REQUIRED on exit 0; plain text invalid | `decision:"block"`+`reason` = continue subagent flow; exit 2+stderr same | hooks:L1057-1089 |
| `Stop` | turn about to stop | none | `turn_id`,`stop_hook_active`,`last_assistant_message` | JSON REQUIRED on exit 0; plain text invalid | `decision:"block"` does NOT reject turn; it continues, creating new continuation prompt (reason = prompt text) | hooks:L1091-1123 |
| `Interrupt` | user interrupts active main-thread turn; not idle threads/subagents | none | common + `turn_id`,`permission_mode` | exit 0 no output, or JSON `{"systemMessage":...}`; plain text invalid | No (can't prevent interruption/restart turn) | hooks:L1125-1142 |
- `Stop`/`SubagentStop`: any matching hook returning `continue:false` takes precedence over continuation decisions of other matching hooks. hooks:L1087-1089, L1122-1123
- After compaction of a ROOT session, `SessionStart` hooks matching `source:"compact"` run before next model request, including mid-turn auto compaction (context delivered to immediate continuation). hooks:L684-688
- Forked thread -> `source:"fork"`; resume with supplied history still `source:"resume"`. hooks:L665-666
- `SessionEnd` example stdin keys: `session_id`,`transcript_path`,`cwd`,`hook_event_name`,`reason`. hooks:L714-721
- `SessionEnd`: hook can still read session transcript; switching conversations or `thread/unsubscribe` doesn't immediately end session. hooks:L699-701

### 2.14 PreToolUse output
| Output | Effect | Cite |
|---|---|---|
| `hookSpecificOutput.hookEventName="PreToolUse"` + `permissionDecision:"deny"` + `permissionDecisionReason` | blocks tool call | hooks:L782-790 |
| `{"decision":"block","reason":"..."}` | older shape, accepted, blocks | hooks:L792-799 |
| exit code `2` + reason on stderr | blocks | hooks:L801 |
| `hookSpecificOutput.additionalContext` | model-visible context, no block | hooks:L803-813 |
| `permissionDecision:"allow"` + `updatedInput` | rewrite call without blocking | hooks:L815-828 |
- `updatedInput` for Bash and `apply_patch` MUST include string `command`; for MCP/other local function tools it is the replacement arguments object; only valid with `permissionDecision:"allow"`, other shapes = errors. hooks:L830-834
- Parsed but NOT supported (hook run failed, error reported, tool call CONTINUES): `permissionDecision:"ask"`, legacy `decision:"approve"`, `continue:false`, `stopReason`, `suppressOutput`. hooks:L836-838
- Implication: unsupported/failed hook output = fail-open (tool continues); only explicit deny/block/exit 2 blocks. (derived from hooks:L528-529, L836-838)

### 2.15 PermissionRequest output
- Allow: `hookSpecificOutput:{hookEventName:"PermissionRequest", decision:{behavior:"allow"}}`. hooks:L865-876
- Deny: same with `decision:{behavior:"deny", message:"..."}`. hooks:L878-890
- Multiple hooks: any `deny` wins; else any `allow` proceeds without approval prompt; none decide -> normal approval flow. hooks:L892-894
- `updatedInput`, `updatedPermissions`, `interrupt` reserved, "fail closed today". hooks:L896-898
- Don't rely on `tool_input.description` existing for every tool. hooks:L862-863

### 2.16 PostToolUse output
- JSON: `systemMessage`; `decision:"block"`+`reason`; `hookSpecificOutput:{hookEventName:"PostToolUse", additionalContext}`. hooks:L924-935
- `decision:"block"` does not undo the command; Codex records feedback, REPLACES tool result with that feedback, continues model from the hook message. hooks:L939-941
- exit code 2 + stderr feedback also works. hooks:L943
- `continue:false`: stop normal processing of original result; Codex replaces result with feedback/stop text. hooks:L945-947
- `updatedMCPToolOutput`, `suppressOutput` parsed-unsupported -> run failed, error reported, normal processing continues. hooks:L949-951
- Cannot undo side effects of tool already run. hooks:L905

### 2.17 Code mode (nested tool calls from JavaScript)
| Hook result | Code mode sees | Cite |
|---|---|---|
| PreToolUse blocks | tool promise rejects before tool runs | hooks:L961 |
| PreToolUse `updatedInput` | runs with rewritten input | hooks:L963 |
| PostToolUse `decision:"block"` or exit 2 | tool runs, then promise rejects with hook reason | hooks:L964 |
| PostToolUse `continue:false` | feedback becomes model-visible result; promise not rejected | hooks:L965 |

### 2.18 Exit-code semantics (collected)
- Exit 0 + no output: success, continue. hooks:L524
- Exit 2 + stderr text: block/continuation reason for `PreToolUse`, `PostToolUse`, `UserPromptSubmit`, `SubagentStop`, `Stop`. hooks:L801, L943, L1055, L1085, L1116
- Exit 2 for `SessionStart`, `PermissionRequest`, compact events, `SubagentStart`, `Interrupt`, model-request hooks: NOT stated.
- Other non-zero exits: not described except SessionEnd "timeout or error exit reported as hook failure". hooks:L725-726
- `Stop`/`SubagentStop`: JSON on stdout required on exit 0, plain text invalid. hooks:L1072-1073, L1103-1104
- `Interrupt`: plain text invalid. hooks:L1137-1138
- Plain-text-as-context (accepted): `SessionStart`, `SubagentStart`, `UserPromptSubmit`. Plain text ignored: `PreToolUse`, `PermissionRequest`, `PostToolUse`, `PreCompact`, `PostCompact`. hooks:L668, L741, L777, L860, L922, L995, L1013, L1030

### 2.19 Large output / spilling
- Default cap per model-visible hook-output message ~2,500 tokens; excess saved to `<temp_dir>/hook_outputs/<session_id>/<uuid>.txt`, model gets head+tail preview with path ("spilling"); if file write fails, truncated preview. hooks:L536-542
- `additionalContextLimit` only affects `additionalContext`; tool feedback and continuation prompts keep default limit. hooks:L569-570
- Each matching handler evaluated independently. hooks:L564-565
- Avoid secrets in hook output (may be written to disk). hooks:L572-573
- Avoid `additionalContextLimit = 0` unless hook enforces its own cap. hooks:L545-548

### 2.20 Async (background) hooks
- `async: true` (JSON) / `async = true` (TOML) on command handlers only. hooks:L579-616
- Same input, matcher, trust, timeout (600 default; Interrupt 1s default / 3s max), large-output handling. hooks:L618-622
- Delivery: at next safe point; active turn -> after current model request + tool calls, available to next model request; no active turn -> next user turn; does not start a new turn. hooks:L626-633
- Output: `additionalContext` added to model context; `systemMessage` shown as warning. hooks:L635-637
- Cannot block, approve, rewrite or control the triggering operation; use sync for policy/permission/prompt rejection/continuation. hooks:L639-641
- Max 8 concurrent background hooks per session; extras wait. hooks:L645-646
- Order not guaranteed; unfinished hooks cancelled at session end and undelivered output discarded. hooks:L647-650
- `SessionEnd` always sync. hooks:L651

### 2.21 Managed hooks (`requirements.toml`)
```toml
allow_managed_hooks_only = true
[features]
hooks = true
[hooks]
managed_dir = "/enterprise/hooks"
windows_managed_dir = 'C:\enterprise\hooks'
[[hooks.PreToolUse]]
matcher = "^Bash$"
[[hooks.PreToolUse.hooks]]
type = "command"
command = "python3 /enterprise/hooks/pre_tool_use_policy.py"
command_windows = 'py -3 C:\enterprise\hooks\pre_tool_use_policy.py'
timeout = 30
statusMessage = "..."
```
hooks:L346-365
- `managed_dir` macOS/Linux; `windows_managed_dir` Windows. hooks:L369-370
- Codex does not distribute scripts in `managed_dir`; enterprise tooling must install/update. hooks:L371-372
- Managed commands should use absolute script paths under managed dir. hooks:L373-374
- `allow_managed_hooks_only = true`: skip user, project, session, plugin hooks; still load managed hooks from `requirements.toml` and other managed config layers. hooks:L343-344, L375-377
- Cloud orchestration (Work Cloud w/ local computer access): enterprise `mcp_tool` hooks configured in Agent Security; supports only Global MCP hooks; NOT command/prompt/agent handlers, local-config/plugin/local-dir hooks, environment-scoped hooks, or `SessionEnd` MCP hooks; personal accounts and Work Cloud without local access don't use them. hooks:L332-334
- Cloud hooks: explicit denial blocks; `PreToolUse` error/timeout/malformed response can let tool run; MCP hooks give only part of audit trail. hooks:L336

### 2.22 Plugin-bundled hooks
- Default file `hooks/hooks.json` in plugin root; manifest `.codex-plugin/plugin.json` `hooks` key can override. Value: `./`-prefixed path, array of such paths, inline hooks object, or array of inline objects. hooks:L384-388
- Manifest example: `{ "name": "repo-policy", "hooks": "./hooks/hooks.json" }`. hooks:L391-395
- Manifest paths relative to plugin root and must stay inside it; manifest `hooks` entries REPLACE default `hooks/hooks.json`. hooks:L397-399
- Env vars for plugin hook commands: `PLUGIN_ROOT`, `PLUGIN_DATA` (Codex-specific), plus `CLAUDE_PLUGIN_ROOT`, `CLAUDE_PLUGIN_DATA` for compat. hooks:L401-408
- Same event schema; trust review applies. hooks:L410-411

### 2.23 Schemas
- Generated wire-format schemas: openai/codex repo `codex-rs/hooks/schema/generated` (link only). `main` branch schemas may include fields not in current release; this page = release behavior reference. hooks:L1146-1150
- Final "Plain-text aliases" section contains only a stub `string | null`. hooks:L1152-1154

### 2.24 Hooks: Not stated
- Debugging/logging/trace instructions for hooks (only `/hooks` UI and warnings).
- Env vars given to ordinary (non-plugin) hooks; no `CODEX_PROJECT_DIR`-style var documented.
- Shell used to execute `command`; quoting rules on Windows beyond `commandWindows`.
- Platform support matrix beyond macOS/Linux/Windows managed dir and `commandWindows`.
- Stdout JSON size/parse-failure behavior for events other than PreToolUse/PostToolUse/SubagentStop/Stop.
- Exit codes other than 0 and 2 (see 2.18); behavior on timeout for non-SessionEnd events (cloud doc says PreToolUse timeout can let tool run).
- Ordering/priority between hook sources; trust-hash algorithm; where trust is persisted.
- `hooks.json` JSON schema beyond example (no `version` key).
- Whether matcher regex is anchored or full-match (examples use both `Bash` and `^Bash$`).
- Whether `PreToolUse` hooks fire for subagent tool calls (only SubagentStart/Stop semantics given).
- How `updatedInput` with `apply_patch` string `command` is interpreted.
- Event-specific TOML key casing rules beyond the examples.

---------------------------------------------------------------------
## 3. RULES (agent-configuration-rules.md)

- "Rules" = control which commands Codex can run OUTSIDE the sandbox. rules:L5
- Status: EXPERIMENTAL, may change. rules:L7
- Applies to Codex local `.rules`; do not assume Local computer access with Work Cloud reads local rule files. rules:L13
- Work Cloud local executors: managed command rules via `rules` TOML field in Agent Security; Work cloud containers use Work Cloud policies. rules:L11
- Managed requirements: `requirements.toml` can enforce restrictive `prefix_rule` entries. rules:L54-55

### 3.1 File location / loading
- Create `.rules` file under a `rules/` folder next to an active config layer, e.g. `~/.codex/rules/default.rules`. rules:L15
- Codex scans `rules/` under EVERY active config layer at startup, including Team Config locations and user layer `~/.codex/rules/`. rules:L46
- Project-local rules `<repo>/.codex/rules/` load ONLY if project `.codex/` layer trusted. rules:L46
- Restart Codex after adding rules. rules:L44
- TUI allow-list additions write to `~/.codex/rules/default.rules`. rules:L48
- Smart approvals (default on): Codex may propose a `prefix_rule` during escalation; review carefully. rules:L50-52
- Language: Starlark (Python-like, side-effect-free; no filesystem). rules:L139

### 3.2 `prefix_rule()` fields
```python
prefix_rule(
    pattern = ["gh", "pr", "view"],
    decision = "prompt",
    justification = "...",
    match = ["gh pr view 7888"],
    not_match = ["gh pr --repo openai/codex view 7888"],
)
```
rules:L20-41
| Field | Req? | Detail | Cite |
|---|---|---|---|
| `pattern` | REQUIRED | non-empty list; each element a literal string OR list-union of literals (e.g. `["view","list"]`) for alternatives at that position | rules:L61-63 |
| `decision` | default `"allow"` | `allow` (run outside sandbox w/o prompt), `prompt` (prompt each matching invocation), `forbidden` (block w/o prompting) | rules:L64-67 |
| `justification` | optional | non-empty human-readable; may show in approval prompts/rejection; for `forbidden` include alternative (e.g. "Use `rg` instead of `grep`.") | rules:L68 |
| `match` | default `[]` | example commands that should match; validated at load | rules:L69 |
| `not_match` | default `[]` | examples that should NOT match; validated at load | rules:L69 |
- Matching: command's argument list (execvp-style list) vs `pattern` as EXACT PREFIX (e.g. `gh pr --repo openai/codex view 7888` does not match `["gh","pr","view"]`). rules:L38-39, L71-72
- Precedence among multiple matching rules: most restrictive wins: `forbidden` > `prompt` > `allow`. rules:L64

### 3.3 Shell wrappers
- `bash -lc`, `bash -c`, and `zsh`/`sh` equivalents get special handling. rules:L81
- Split only if script is linear chain of plain words (no variable expansion, `VAR=...`, `$FOO`, `*`) joined by `&&`, `||`, `;`, `|`; parsed with tree-sitter, each command evaluated separately, most restrictive wins. rules:L85-97
- Example: allowing `["git","add"]` does not allow `git add . && rm -rf /` because `rm -rf /` evaluated separately. rules:L99
- NOT split when script uses redirection (`>`,`>>`,`<`), substitutions (`$(...)`, backticks), env vars (`FOO=bar`), wildcards (`*`,`?`), control flow; then whole thing treated as `["bash","-lc","<full script>"]` and rules apply to that single invocation. rules:L105-121

### 3.4 Test
```shell
codex execpolicy check --pretty --rules ~/.codex/rules/default.rules -- gh pr view 7888 --json title,body,comments
```
rules:L129-133
- Emits JSON with strictest decision + matching rules incl. `justification`; multiple `--rules` flags combine files; `--pretty` formats output. rules:L135

### 3.5 Rules: Not stated
- File extension variants beyond `.rules`; filename requirements (only `default.rules` example, any name under `rules/` implied by "a `.rules` file under a `rules/` folder").
- Other Starlark functions besides `prefix_rule` (none documented).
- Interaction between rules and `PreToolUse`/`PermissionRequest` hooks, or exact sandbox/approval-policy interplay beyond "outside the sandbox".
- Merge/precedence across config layers (only "most restrictive" among matching rules).
- Exact format of `requirements.toml` rules entries (linked only).
- Windows paths for rules.

---------------------------------------------------------------------
## 4. PLATFORM BLOG (blog-codex-as-a-platform.md) -- NON-NORMATIVE

All lines below are "blog" claims.
- blog: open-source Codex harness (github.com/openai/codex) powers App, CLI, IDE extension. blog:L5-7
- blog: harness = agent loop: conversation state, streaming execution, tools, enforcing configured sandbox + approval policies, carrying work across turns. blog:L13-19
- blog: Codex app-server exposes documented client protocol: create threads, start turns, receive events, handle approval requests. blog:L19
- blog: open-source components published: Codex CLI, app-server, official Codex SDK; "open-source components guide" lists locations. blog:L35
- blog: open-source layer is harness + integration surface; model access and managed services separate. blog:L37
- blog integration layers: `codex exec` (scripts/CI/one-off, structured output); Codex SDK (start/resume/stream programmatically); app-server (persistent conversations, stream events, interrupt, expose tools, approval handling). blog:L41-49, L115
- blog: apps can expose application-owned MCP services as context/tools. blog:L31
- blog: host app decides where agent runs, file/tool access, approval requirements, observation, result return. blog:L33
- blog example "Relay": sample ops app on app-server using application-owned MCP tools with human approval before writes. blog:L74-78
- blog: public implementations cited (GitHub/JetBrains IDE, Cisco SDK, Thrive Holdings/Crete). blog:L99-103
- Blog does NOT mention skills, hooks, plugins, AGENTS.md, subagents, config files, `.codex/` or `.agents/` paths, or guidance for third-party toolkits installing content into Codex. (Whole file read.)
- Blog Not stated: any normative extension-point file surface; any statement about third-party toolkit integration beyond SDK/exec/app-server/MCP.

---------------------------------------------------------------------
## 5. Experimental / deprecated / version-gated markers
- Rules: experimental, may change. rules:L7
- Feature key `codex_hooks`: deprecated alias of `hooks`. hooks:L322-323
- PreToolUse legacy shape `{decision:"block",reason}` called "older block shape" but still accepted. hooks:L792-799
- Legacy `decision:"approve"`: parsed, unsupported. hooks:L836-837
- Parsed but unimplemented: `suppressOutput`; `permissionDecision:"ask"`; `updatedMCPToolOutput`; `continue:false` for PreToolUse/PermissionRequest/SubagentStart; `prompt` and `agent` handler types (skipped). hooks:L194-195, L522, L836-838, L949
- Reserved/fail-closed: `updatedInput`, `updatedPermissions`, `interrupt` on `PermissionRequest`. hooks:L896-898
- `SessionEnd` matcher only `other` "for now". hooks:L703
- Schema `main` branch may be ahead of release. hooks:L1146-1147
- Cloud/enterprise hooks require "managed policy and remote hooks enabled" workspace. hooks:L332

---------------------------------------------------------------------
## 6. Audit checkpoints (testable against a Codex install tree)

Skills
1. Each skill dir contains `SKILL.md` with frontmatter keys `name` and `description` (both present). skills:L48
2. Project skills live under `<repo>/.agents/skills/<skill>/` (not `.codex/skills`). skills:L142-144
3. Global/user skills live under `$HOME/.agents/skills/`. skills:L145
4. Admin-wide skills (if any) at `/etc/codex/skills`. skills:L146
5. Optional skill metadata file is `agents/openai.yaml` inside the skill dir; keys limited to `interface`, `policy`, `dependencies`. skills:L207-228
6. Implicit-invocation opt-out expressed as `policy.allow_implicit_invocation: false` in `agents/openai.yaml`. skills:L217-219, L230
7. Skill names are unique across scanned locations (duplicates are not merged and both appear). skills:L138
8. Skill descriptions front-load trigger words and are short enough for the ~2%-of-context / 8,000-char list budget. skills:L38-42, L101-103
9. Any skill disable is `[[skills.config]]` in `~/.codex/config.toml` with exactly one of `path` (absolute, to SKILL.md) or `name`, plus `enabled = false`. skills:L183-193
10. Bundled system skills disabled per project only via `[skills.bundled] enabled = false` in trusted `<repo>/.codex/config.toml`. skills:L195-201

Hooks
11. Hooks file is `<repo>/.codex/hooks.json` and/or `~/.codex/hooks.json`, or inline `[hooks]` in `config.toml`; not both in one layer. hooks:L33-53
12. Top-level shape: optional `description`, then `hooks` -> EventName -> array of `{matcher?, hooks:[handler]}`. hooks:L90-177
13. TOML inline form uses `[[hooks.<Event>]]` + `[[hooks.<Event>.hooks]]`. hooks:L203-229
14. Every event key is one of: PreToolUse, PermissionRequest, PostToolUse, PreCompact, PostCompact, UserPromptSubmit, SubagentStop, Stop, PreModelRequest, PostModelRequest, Interrupt, SessionStart, SubagentStart, SessionEnd (exact case). hooks:L25-29
15. No handler uses `type` other than `command` or `mcp_tool` (`prompt`/`agent` are skipped). hooks:L194-195
16. `timeout` values are in SECONDS (not ms); SessionEnd/Interrupt timeout <= 3. hooks:L183-185, L1134-1135
17. `matcher` is a regex string; none set on UserPromptSubmit, Stop, Interrupt, PreModelRequest, PostModelRequest (ignored/unsupported). hooks:L429, L436-438
18. SessionStart matcher values restricted to `startup|resume|clear|compact|fork`; Pre/PostCompact to `manual|auto`; SessionEnd to `other`. hooks:L428-433
19. Tool-event matchers use `Bash`, `apply_patch` (or `Edit`/`Write` aliases), or `mcp__<server>__<tool>`; no matcher targets hosted tools like `WebSearch`. hooks:L460-465
20. No command hook relies on exit-code semantics other than 0 (ok) and 2 (+stderr = block/continue) for PreToolUse/PostToolUse/UserPromptSubmit/Stop/SubagentStop. hooks:L801, L943, L1055, L1085, L1116
21. PreToolUse deny emitted as `hookSpecificOutput.permissionDecision:"deny"` (+`permissionDecisionReason`) or `{decision:"block",reason}` or exit 2; never `permissionDecision:"ask"`, `decision:"approve"`, `continue:false`, `stopReason`, `suppressOutput` (those fail the run and let the tool proceed). hooks:L779-838
22. PermissionRequest decisions use `hookSpecificOutput.decision.behavior` = `allow`|`deny` (+`message`); no `updatedInput`/`updatedPermissions`/`interrupt`. hooks:L865-898
23. `Stop` and `SubagentStop` command hooks print JSON (not plain text) on exit 0, and treat `decision:"block"` as "continue with reason as new prompt", not "reject". hooks:L1072-1073, L1103-1120
24. Context injection is only emitted by SessionStart/UserPromptSubmit/SubagentStart (plain text or `hookSpecificOutput.additionalContext`) and PreToolUse/PostToolUse (`additionalContext` JSON only). hooks:L668, L741, L803-813, L930-937, L1030
25. `updatedInput` only appears with `permissionDecision:"allow"`; Bash/apply_patch variants carry a string `command`. hooks:L830-834
26. Hook scripts are referenced via git-root-resolved or absolute paths, not bare relative `.codex/hooks/...`. hooks:L197-199
27. Docs/tests do not claim hooks are a complete enforcement boundary (stated as a guardrail; hosted tools uncovered; some tool paths opt out). hooks:L465, L471-472
28. Project hooks assume trust gating: after install/changes, hooks need `/hooks` review before running (hash-based); install flow must not expect them to auto-run. hooks:L63-72
29. Plugin-bundled hooks use `hooks/hooks.json` at plugin root or `hooks` key in `.codex-plugin/plugin.json` with `./`-prefixed in-root paths; scripts reference `PLUGIN_ROOT`/`PLUGIN_DATA` (or `CLAUDE_PLUGIN_*`). hooks:L384-408
30. Hooks feature not disabled: no `[features] hooks = false` (or `codex_hooks = false`) in emitted config. hooks:L315-324
31. Async hooks (`async: true`) are used only for non-blocking observers (never for policy/permission/prompt rejection). hooks:L639-641

Rules
32. Rule files are `*.rules` under `<layer>/rules/` (e.g. `~/.codex/rules/default.rules`, `<repo>/.codex/rules/*.rules`), written in Starlark. hooks-n/a; rules:L15, L46, L139
33. Each rule is `prefix_rule(pattern=[...], decision=..., justification=..., match=[...], not_match=[...])`; `pattern` non-empty; `decision` in `allow|prompt|forbidden` (default allow). rules:L61-69
34. `match`/`not_match` examples in a rule file satisfy the rule (Codex validates at load; a violation breaks the rule file). rules:L69
35. Rule files verified via `codex execpolicy check --pretty --rules <file> -- <cmd...>`; project rules only load when project `.codex/` is trusted. rules:L46, L127-135

Platform
36. (blog, non-normative) integration surfaces named are `codex exec`, Codex SDK, app-server, MCP; blog documents no file-based extension surface for toolkits. blog:L41-49

---------------------------------------------------------------------
## 7. Cross-page unresolved questions
- Skill frontmatter constraints and scope precedence not documented (skills).
- Whether any hook/rules/skill content exists for `AGENTS.md`, subagent definitions, `config.toml` agent tables: none of the four pages cover them.
- Exact trust model for project `.codex/` layer ("trusted") not defined on these pages.
