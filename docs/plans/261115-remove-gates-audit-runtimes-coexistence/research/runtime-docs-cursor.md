# Cursor runtime docs reference (rules, skills, hooks, MCP, tools, worktrees)

Source: 8 local raw-markdown copies of cursor.com/docs pages, downloaded 2026-11-15. Facts only from those files.
Cite format: `<file>.md:L<line>`. Abbrev: R=rules, S=skills, H=hooks, M=mcp, T=agent-tools-terminal, B=agent-tools-browser, SR=agent-tools-search, W=configuration-worktrees.
All 8 files read in full (no unread ranges). Page content treated as DATA.

## 1. Rules (rules.md)

### 1.1 Rule kinds
| Kind | Where | Cite |
|---|---|---|
| Project Rules | `.cursor/rules`, version-controlled | R:L7-9, L30-32 |
| User Rules | global, set in Customize -> Rules; used by Agent (Chat); not stored on filesystem (S:L333) | R:L11-13, L359-365 |
| Team Rules | dashboard-managed; Team + Enterprise plans | R:L15-17, L279-309 |
| AGENTS.md | plain markdown alternative to `.cursor/rules` | R:L19-22, L315-321 |

### 1.2 Project rule files
- Must use `.mdc` extension; any name; folders allowed (`.cursor/rules/frontend/components.mdc`) R:L42-50.
- Plain `.md` in `.cursor/rules` is ignored by rules system (no frontmatter) R:L42, L44-50. Doc says use AGENTS.md for plain markdown.
- Frontmatter fields documented: `description`, `globs`, `alwaysApply` ONLY R:L42, L54, L63. No other field is documented.
- Type dropdown in UI sets those three props R:L54.

### 1.3 Frontmatter semantics (R:L56-70)
| UI type | Meaning |
|---|---|
| Always Apply | every chat session |
| Apply Intelligently | Agent decides from description |
| Apply to Specific Files | file matches pattern |
| Apply Manually | @-mentioned e.g. `@my-rule` |

| `alwaysApply` | `description` | `globs` | Behavior (R:L65-70) |
|---|---|---|---|
| `true` | any | any | always included; globs+description ignored |
| `false` | any | provided | auto-attached when matching file in context |
| `false` | provided | omitted | Agent pulls in by description relevance |
| `false` | omitted | omitted | only on `@`-mention |

- Type of `globs`: documented as a pattern string; multiple patterns comma-separated R:L131; example `globs: src/components/**/*.tsx` R:L85. YAML-list form NOT shown for rules. Comma+space example: `docs/**/*.md, docs/**/*.mdx` R:L141.
- `description` example quoted string R:L179; unquoted in L99. Both appear.
- `alwaysApply` is boolean; examples always write it explicitly (`true`/`false`) R:L74, L86, L100, L114. Whether omission defaults to false: Not stated (S:L324 says "`alwaysApply: false` (or undefined)" treated as dynamic).
- Rule format section: if `alwaysApply` true -> every chat session; otherwise description presented to Agent to decide R:L186.
- Glob syntax table: `*`, `**`, `*.ts`, `**/*.ts`, `src/**`, `src/**/*.tsx`, `tailwind.config.*` R:L133-142.
- Troubleshoot: "Apply Intelligently" needs description; "Apply to Specific Files" needs pattern to match referenced files R:L371.

### 1.4 Content / injection behavior
- Applied rule contents included at start of model context R:L28.
- `@file` mention inside rule body is NOT inlined; Agent reads file with tools when needed; same in editor, CLI, Cloud Agents R:L127, L375. Must-have context goes in the rule body.
- Size: keep rules under 500 lines; split into composable rules R:L155-156.
- `/create-rule` in chat creates rule file w/ frontmatter into `.cursor/rules` R:L148. Customize -> Rules -> Add Rule also R:L149.

### 1.5 AGENTS.md
- Project root, plain markdown, no metadata/frontmatter R:L317-321.
- Nested AGENTS.md in any subdirectory supported; applied when working with files in that dir or children R:L321, L342. Child combined with parents; more specific wins R:L357.
- Limits: no metadata/globs/alwaysApply mechanism R:L319. Whether AGENTS.md is read by Tab/CLI/Cloud: Not stated.

### 1.6 Team rules
- Admin dashboard; fields: "Enable this rule immediately" (draft if unchecked), "Enforce this rule" (cannot be disabled by users in Customize) R:L297-300.
- Free-form text; no folder structure R:L304. Support glob patterns (e.g. `**/*.py`); without glob applies to every conversation R:L305.
- Applies to Agent (Chat) across all repos R:L306.
- Precedence: Team Rules -> Project Rules -> User Rules; all merged; earlier wins on conflict R:L307.
- Doc warns AI guidance should not be sole security control R:L309.

### 1.7 Import / remote
- Rules not imported on their own. Import via plugin published through marketplace: Customize -> From GitHub Repository (repo needs `.cursor-plugin/marketplace.json`) or team marketplace, then install plugin R:L313.

### 1.8 Surfaces
- Rules do NOT impact Cursor Tab or other AI features R:L381-383.
- Referencing works in editor, CLI, Cloud Agents R:L127.
- Legacy `.cursorrules`: Not stated (page silent).
- Precedence between `.cursor/rules` and AGENTS.md: Not stated.

## 2. Skills (skills.md)

### 2.1 Discovery
| Location | Scope | Cite |
|---|---|---|
| `.agents/skills/` | project | S:L65 |
| `.cursor/skills/` | project | S:L66 |
| `~/.agents/skills/` | user, local machine | S:L67 |
| `~/.cursor/skills/` | user, local machine | S:L68 |
| `.claude/skills/`, `.codex/skills/`, `~/.claude/skills/`, `~/.codex/skills/` | compatibility load | S:L78 |

- Each skill = folder containing `SKILL.md` S:L80-87.
- Nested categories allowed: Cursor walks skills root recursively, picks up any `SKILL.md`; skill identity = folder holding SKILL.md, not parent category S:L107-125.
- Nested project dirs: `.cursor/skills/` or `.agents/skills/` anywhere in repo picked up; auto-scoped to files under that dir S:L127-139.
- Cloud Agents / remote SSH Agents Window / self-hosted workers do NOT get `~/.agents/skills/` or unsynced local skills S:L70-76. Only `~/.cursor/skills/` syncs (opt-in "Sync Skills for Cloud Agents") S:L278-296. Automation runs do not load synced skills S:L284.

### 2.2 SKILL.md frontmatter (S:L170-178)
| Field | Req | Constraint |
|---|---|---|
| `name` | yes | lowercase letters, numbers, hyphens only; must match parent folder name |
| `description` | yes | what + when; agent uses to judge relevance |
| `paths` | no | globs; comma-separated string OR list; skill surfaced only for matching files |
| `disable-model-invocation` | no | `true` => only included via explicit `/skill-name` |
| `icon` | no | badge icon when used as Custom Mode; default lightning |
| `color` | no | one of `default`,`green`,`cyan`,`blue`,`purple`,`magenta`,`orange`,`yellow`,`red`,`brand` |
| `metadata` | no | arbitrary key-value mapping |
- Legacy `globs` still accepted as fallback; new skills should use `paths` S:L212.
- Name max length / description max length / body size limit: Not stated.
- `allowed-tools`, `license`, `compatibility` fields: Not stated (not listed).
- Cloud Agents: unreadable SKILL.md, unparsable frontmatter, or missing description => run warning naming the skill; skill still invocable by name S:L180.

### 2.3 Invocation
- Auto: agent decides from context S:L27. Manual: `/` in Agent chat, attaches to one message S:L29. Custom Mode keeps skill on whole session (Option+Enter / Alt+Enter) S:L29, L218-231.
- Disable auto: `disable-model-invocation: true` S:L214-216.

### 2.4 Optional dirs S:L262-272
`scripts/` (executable), `references/` (loaded on demand), `assets/` (templates/data). Referenced by relative path from skill root S:L235.

### 2.5 Migration S:L318-333
- `/migrate-to-skills` built-in (Cursor 2.4) S:L320.
- Converts: dynamic rules (`alwaysApply: false` or undefined AND no `globs`) -> standard skills; slash commands (user + workspace) -> skills with `disable-model-invocation: true` S:L322-325.
- NOT migrated: `alwaysApply: true` rules, rules with `globs`, user rules S:L333. Output reviewed in `.cursor/skills/` S:L331.

### 2.6 Built-in skills (names occupied by Cursor) S:L35-55
`/automate /autopilot /canvas /create-hook /create-rule /create-skill /create-subagent /cursor-blame /loop /migrate-to-skills /review /review-bugbot /review-security /sdk /shell /split-to-prs /statusline /update-cli-config /update-cursor-settings`. (Worktree page adds `/worktree`, `/best-of-n`, `/apply-worktree`, `/delete-worktree` W:L191-211; not in S table.)
- Skills in Customize appear alongside rules under "Agent Decides" S:L276.
- Skills are an open standard (agentskills.io) S:L337.

## 3. Hooks (hooks.md) — exhaustive

### 3.1 Concept
- Spawned processes, JSON over stdio both directions; run before/after agent-loop stages; observe/block/modify H:L3.
- Defined in `hooks.json` at project/user level, or via plugins H:L3.
- Third-party (Claude Code) hook loading: page only points to separate page "Third Party Hooks" (`/docs/reference/third-party-hooks`) H:L18. Compatibility details / event-name mapping: Not stated in these files. Only compat signals here: exit code 2 "matches Claude Code behavior" H:L1496; env `CLAUDE_PROJECT_DIR` alias H:L1477; `loop_limit` default `null` for Claude Code hooks vs `5` for Cursor hooks H:L714.
- Cursor watches hooks config files, reloads on save; restart if still not loaded H:L172, L1489.

### 3.2 Config file locations, merge, precedence
| Source | Path | Cite |
|---|---|---|
| Enterprise (MDM) macOS | `/Library/Application Support/Cursor/hooks.json` | H:L642 |
| Enterprise Linux/WSL | `/etc/cursor/hooks.json` | H:L643 |
| Enterprise Windows | `C:\\ProgramData\\Cursor\\hooks.json` (doc spelling, double backslash) | H:L644 |
| Team (Enterprise cloud) | dashboard; synced to `~/.cursor/managed/team_<team ID>/hooks/` | H:L645-646, L812 |
| Project | `<project-root>/.cursor/hooks.json` | H:L648 |
| User | `~/.cursor/hooks.json` (scripts commonly `~/.cursor/hooks/`) | H:L651, L116-127 |
| Plugin | from installed plugins; after all above; command hooks only | H:L655 |
- Priority high->low: Enterprise -> Team -> Project -> User H:L653.
- ALL matching hooks from every source run (additive, not override) H:L631.
- Response merge: any `deny` beats `ask` beats `allow`, regardless of source; `user_message` and `agent_message` concatenated; other fields (e.g. `followup_message`) last response wins, in priority order so lower-priority source overrides higher for those fields H:L631.
- Project hooks run in any trusted workspace; require workspace trust H:L649, L781.
- `hooks` object maps hook name -> array of hook definitions H:L657.

### 3.3 Working directory per source (H:L657-665)
| Source | cwd |
|---|---|
| Project | project root |
| User | `~/.cursor/` |
| Enterprise | enterprise config dir |
| Team | managed hooks dir |
| Plugin | plugin install dir (`CURSOR_PLUGIN_ROOT`); `stop` and `subagentStop` plugin hooks run from workspace root |
- Project command paths must be root-relative: `.cursor/hooks/script.sh`, NOT `./hooks/script.sh` H:L155, L665, L1491.
- `command` may be shell string, absolute path, or relative path H:L657.
- Windows desktop app runs hook commands via PowerShell; JSON piped (PowerShell script reads `$input`) H:L180.

### 3.4 hooks.json schema
Skeleton (composed from documented keys):
```json
{ "version": 1,
  "hooks": { "<eventName>": [ { "command": "...", "type": "command|prompt",
     "timeout": 30, "matcher": "regex", "loop_limit": 5, "failClosed": false } ] } }
```
| Key | Type | Default | Notes | Cite |
|---|---|---|---|---|
| `version` | number | required | positive integer; use `1` | H:L703-705 |
| `command` | string | required | script path or command | H:L711 |
| `type` | `"command"`\|`"prompt"` | `"command"` | | H:L712 |
| `timeout` | number | platform default | seconds | H:L713 |
| `loop_limit` | number\|null | `5` | stop/subagentStop only; `null` = no limit; `null` default for Claude Code hooks | H:L714 |
| `failClosed` | boolean | `false` | when true, crash/timeout/non-zero/no output blocks action | H:L715 |
| `matcher` | string | none | regex; `""` or `"*"` matches all | H:L716 |
- Prompt hook adds `prompt` (string) and optional `model` H:L214, L228. Note `prompt` hooks example has no `command` key H:L211-217 although `command` is listed "required" H:L711 (tension; not resolved by page).
- Dashboard (team) hooks: one script or one prompt per hook step; no `failClosed`/`matcher` options H:L810.
- Unknown-key behavior, `$schema`, `env` per-hook key: Not stated.

### 3.5 Exit codes and failure modes
| Exit | Meaning | Cite |
|---|---|---|
| `0` | success; use JSON stdout | H:L199 |
| `2` | block action (== `permission:"deny"`) | H:L200, L1496 |
| other non-zero | hook failed; action proceeds (fail-open) unless `failClosed:true` | H:L201, L1062 |
- Permission hooks (`beforeShellExecution`, `beforeMCPExecution`, `beforeReadFile`, `beforeTabFileRead`, `subagentStart`, `preToolUse`): invalid JSON or schema-mismatched response BLOCKS action even at exit 0 H:L199, L1062, L1163. This holds even with `failClosed:false` H:L715.
- Crash/timeout/non-zero-other: logged, allowed through by default H:L1062, L1163. `failClosed:true` recommended for security-critical `beforeMCPExecution` H:L1062.
- Empty-stdout behavior for permission hooks at exit 0: Not stated explicitly (implied "doesn't match schema" => block; not confirmed).

### 3.6 Event catalogue (21 names: Agent 18, Tab 2, App 1; H:L24-44)
Agent: `sessionStart sessionEnd preToolUse postToolUse postToolUseFailure subagentStart subagentStop beforeShellExecution afterShellExecution beforeMCPExecution afterMCPExecution beforeReadFile afterFileEdit beforeSubmitPrompt preCompact stop afterAgentResponse afterAgentThought` H:L24-35, L699.
Tab: `beforeTabFileRead afterTabFileEdit` H:L37-40. App lifecycle: `workspaceOpen` H:L42-44.
Names are camelCase (not PascalCase) in hooks.json.

### 3.7 Common input (all hooks) H:L826-854
`conversation_id`, `generation_id`, `model` (legacy slug), `model_id`(opt), `model_params`(opt array of `{id,value}`), `hook_event_name`, `cursor_version`, `workspace_roots` (string[]), `user_email` (string|null), `transcript_path` (string|null; null if transcripts disabled).
- `workspaceOpen` omits `conversation_id`, `generation_id`, `model`, `session_id`, `transcript_path`; keeps `hook_event_name`, `cursor_version`, `workspace_roots`, `user_email` H:L856.
- Docs example for permission-hook inputs include `cwd`, `tool_use_id`, `agent_message` (preToolUse) H:L866-879.

### 3.8 Events: when / input / output / block
| Event | Fires when | Hook-specific input | Output fields | Blocks? | Cite |
|---|---|---|---|---|---|
| `sessionStart` | new composer conversation created; fire-and-forget | `session_id`, `is_background_agent`, `composer_mode` ("agent"/"ask"/"edit", opt) | `env` {k:v}, `additional_context` | NO. Schema accepts `continue`,`user_message` but not enforced; creation not blocked | H:L1338-1370 |
| `sessionEnd` | composer conversation ends; fire-and-forget | `session_id`, `reason` (`completed`/`aborted`/`error`/`window_close`/`user_close`), `duration_ms`, `is_background_agent`, `final_status`, `error_message`(opt) | none (response logged, unused) | NO | H:L1372-1402 |
| `preToolUse` | before ANY tool (Shell, Read, Write, MCP, Task...) | `tool_name`, `tool_input` (object), `tool_use_id`, `cwd`, `agent_message` (in example) | `permission` ("allow"/"deny"; "ask" accepted by schema, NOT enforced), `user_message`, `agent_message`, `updated_input` (object) | YES (deny / exit 2) | H:L860-895 |
| `postToolUse` | after successful tool | `tool_name`, `tool_input`, `tool_output` (JSON-stringified string, not raw terminal text), `tool_use_id`, `cwd`, `duration` (ms) | `updated_mcp_tool_output` (MCP tools only), `additional_context` | no (post) | H:L897-934 |
| `postToolUseFailure` | tool fails, times out, or is denied | `tool_name`, `tool_input`, `tool_use_id`, `cwd`, `error_message`, `failure_type` (`error`/`timeout`/`permission_denied`), `duration`, `is_interrupt` | `additional_context` | no | H:L936-968 |
| `subagentStart` | before spawning subagent (Task tool) | `subagent_id`, `subagent_type`, `task`, `parent_conversation_id`, `tool_call_id`, `subagent_model`, `is_parallel_worker`, `git_branch`(opt) | `permission` ("allow"/"deny"; "ask" unsupported -> treated as deny), `user_message` | YES | H:L970-1008 |
| `subagentStop` | subagent completes/errors/aborted; fires again per follow-up | `subagent_type`, `status` (`completed`/`error`/`aborted`), `task`, `description`, `summary`, `duration_ms`, `message_count`, `tool_call_count`, `loop_count`, `modified_files`, `agent_transcript_path` (string|null) | `followup_message` (consumed only when status=`completed`) | no; can continue | H:L1010-1056 |
| `beforeShellExecution` | before shell command | `command`, `cwd`, `sandbox` (bool) | `permission` ("allow"/"deny"/"ask"), `user_message`, `agent_message` | YES | H:L1058-1100 |
| `beforeMCPExecution` | before MCP tool | `tool_name`, `tool_input` (JSON string), `mcp_server_name`; plus `url`+`mcp_server_url` (HTTP/SSE) OR `command` (stdio) | same as above | YES | H:L1058-1100 |
| `afterShellExecution` | after shell cmd | `command`, `output`, `duration` (ms, excludes approval wait), `sandbox` | none documented | no | H:L1102-1121 |
| `afterMCPExecution` | after MCP tool | `tool_name`, `tool_input`, `mcp_server_name`, `mcp_server_url`(HTTP/SSE only), `result_json`, `duration` | none documented | no | H:L1123-1145 |
| `afterFileEdit` | after Agent edits a file | `file_path` (absolute), `edits[]` {`old_string`,`new_string`} | none documented | no | H:L1147-1157 |
| `beforeReadFile` | before Agent reads file | `file_path`, `content`, `attachments[]` {`type`: "file"/"rule", `file_path`} | `permission` ("allow"/"deny"), `user_message` | YES | H:L1159-1194 |
| `beforeTabFileRead` | before Tab reads file (Tab only) | `file_path`, `content` (no `attachments`) | `permission` ("allow"/"deny") | YES | H:L1196-1217 |
| `afterTabFileEdit` | after Tab edits (Tab only) | `file_path`, `edits[]` with `old_string`,`new_string`,`range`{`start_line_number`,`start_column`,`end_line_number`,`end_column`},`old_line`,`new_line` | none supported | no | H:L1219-1253 |
| `beforeSubmitPrompt` | after user hits send, before backend request | `prompt`, `attachments[]` {`type`,`file_path`} | `continue` (bool), `user_message` | YES (`continue:false`) | H:L1255-1281 |
| `afterAgentResponse` | after agent completes an assistant message | `text` | none documented | no | H:L1283-1292 |
| `afterAgentThought` | after thinking block completes | `text`, `duration_ms`(opt) | none supported | no | H:L1294-1314 |
| `stop` | agent loop ends | `status` (`completed`/`aborted`/`error`), `loop_count` | `followup_message` (non-empty => auto-submitted as next user message) | no; can continue | H:L1316-1336 |
| `preCompact` | before context compaction; observational | `trigger` ("auto"/"manual"), `context_usage_percent`, `context_tokens`, `context_window_size`, `message_count`, `messages_to_compact`, `is_first_compaction` | `user_message` | NO (cannot block/modify compaction) | H:L1404-1440 |
| `workspaceOpen` | once on workspace open + every workspace folder change; skipped when zero folders; desktop app and CLI | base fields only (see 3.7) | `pluginPaths` (string[] of absolute plugin dir paths) | n/a | H:L1442-1463 |

Notes on enforcement:
- `preToolUse` `"ask"` accepted by schema, not enforced H:L892. `subagentStart` `"ask"` => deny H:L1007.
- `sessionStart` `continue`/`user_message` not enforced H:L1370.
- `loop_count` on `stop`/`subagentStop` starts at 0; default cap 5 auto-follow-ups per script; `loop_limit: null` removes cap; same limit for both H:L1054, L1336, L714.
- `afterShellExecution`/`afterMCPExecution`/`afterFileEdit`/`afterAgentResponse` output schema: page shows input only; output Not stated.
- `postToolUse` examples show `tool_name` values `Shell`; MCP tools named `MCP:<tool_name>` H:L77, L753.
- Output key for post-hook text injection is `additional_context` (snake_case) H:L934, L968, L1368.

### 3.9 Matchers H:L718-763
Regex; `""` or `"*"` = all. Tested against:
| Hook | Matched value |
|---|---|
| `preToolUse`/`postToolUse`/`postToolUseFailure` | tool type: `Shell`, `Read`, `Write`, `Grep`, `Delete`, `Task`, `MCP:<tool_name>` (list "includes", not necessarily complete) |
| `subagentStart`/`subagentStop` | subagent type (`generalPurpose`, `explore`, `shell`, ...) |
| `beforeShellExecution`/`afterShellExecution` | full shell command string |
| `beforeReadFile` | literal `Read` |
| `afterFileEdit` | literal `Write` |
| `beforeTabFileRead` | `TabRead` |
| `afterTabFileEdit` | `TabWrite` |
| `beforeSubmitPrompt` | `UserPromptSubmit` |
| `stop` | `Stop` |
| `afterAgentResponse` | `AgentResponse` |
| `afterAgentThought` | `AgentThought` |
- Not stated: matcher for `sessionStart`, `sessionEnd`, `preCompact`, `beforeMCPExecution`, `afterMCPExecution`, `workspaceOpen`. Regex flavor/anchoring (full vs partial match) Not stated; example `"curl|wget|nc "` implies substring H:L741, L749.
- Tool-name list does not include `Edit`/`Glob`/other names; `Write` is the edit-tool name in matcher context. Complete tool-name set: Not stated.

### 3.10 Prompt-type hooks H:L203-228
- `{ "type":"prompt","prompt":"...","timeout":10 }` H:L211-217.
- Returns `{ ok: boolean, reason?: string }`; fast model; `$ARGUMENTS` replaced with hook input JSON, auto-appended if absent; optional `model` override H:L224-228.
- Not available in cloud agents (command hooks only) H:L106-108; plugin hooks run command hooks only H:L655.

### 3.11 Environment variables for hook scripts H:L1469-1479
| Var | Presence |
|---|---|
| `CURSOR_PROJECT_DIR` | always; workspace root |
| `CURSOR_VERSION` | always |
| `CURSOR_USER_EMAIL` | if logged in |
| `CURSOR_TRANSCRIPT_PATH` | if transcripts enabled |
| `CURSOR_CODE_REMOTE` | string `"true"` in remote workspaces |
| `CURSOR_PLUGIN_ROOT` | plugin hooks |
| `CLAUDE_PROJECT_DIR` | always; alias of project dir (Claude compat) |
- `sessionStart` `env` output is passed to all later hooks in that session H:L1479.
- Terminal page: `CURSOR_AGENT` env var is set in Cursor terminal sessions (for shell rc detection) T:L17-18, L22. (Not in hooks page env table.)

### 3.12 Surface matrix
| Surface | Support | Cite |
|---|---|---|
| Agent Chat (IDE) | 18 agent events | H:L24-35 |
| Tab | `beforeTabFileRead`, `afterTabFileEdit` | H:L37-40 |
| App | `workspaceOpen` (desktop app + CLI) | H:L44, L1444 |
| Cloud agents (command hooks only) | YES: `beforeShellExecution afterShellExecution beforeReadFile afterFileEdit preToolUse postToolUse postToolUseFailure subagentStart subagentStop beforeSubmitPrompt preCompact afterAgentResponse afterAgentThought stop` | H:L56-75 |
| Cloud agents NOT | `sessionStart`, `sessionEnd`, `beforeMCPExecution`, `afterMCPExecution`, `beforeTabFileRead`, `afterTabFileEdit`, `workspaceOpen` | H:L86-92 |
| Self-hosted workers | same command-based project hooks; `sessionStart`/`sessionEnd` fire on claim/release | H:L104 |
- Cloud agents: project `.cursor/hooks.json` loaded; team + enterprise hooks on Enterprise; user `~/.cursor/hooks.json` NOT available H:L98-102.
- Cloud agents may start read-only; hooks do not run in those turns H:L54.
- HTTP MCP servers in cloud: `preToolUse`/`postToolUse` fire with `tool_name` = `MCP:<tool_name>`; `updated_input` ignored; `postToolUse` gets `tool_output` = `{"redacted":true}` (+`isError` if known); cannot return `updated_mcp_tool_output` H:L77-80.
- CLI: only `workspaceOpen` explicitly stated as running in CLI H:L1444. Whether other events fire in Cursor CLI: Not stated.
- Subagent coverage: `subagentStart`/`subagentStop` exist; whether per-tool hooks fire inside subagents: Not stated. `subagentStop` plugin hooks run from workspace root H:L663.
- `preToolUse` generic hook coexists with specific hooks (`beforeShellExecution` etc.); ordering/dedup between them: Not stated.

### 3.13 Distribution / admin
- Project: commit `.cursor/hooks.json`; trusted workspace required H:L771-781.
- MDM: place `hooks.json` + scripts in user home or global dirs (3.2 table); org-managed, Cursor does not deploy H:L783-798.
- Cloud distribution (Enterprise): dashboard; sync every 30 min; OS targeting; one script/prompt per hook step; no `failClosed`/`matcher`; written to `~/.cursor/managed/team_<team ID>/hooks/` and rewritten each sync; Windows names lacking `.ps1`/`.bat`/`.cmd` get `.ps1` H:L800-812.
- "Block until hooks are ready" dashboard toggle: waits without timeout for enterprise/team/project/user hooks before first prompt; default waits only short time H:L814.

### 3.14 Debugging
- Customize -> Hooks tab; "Hooks" output channel H:L1485.
- Check relative paths per source H:L1490-1492.

### 3.15 Gaps / experimental flags
- No hook event is labeled experimental/beta/deprecated in this page. Version-gating text: none for hooks (only `cursor_version` input; example "1.7.2" is illustrative H:L851).
- Stated no-ops: `sessionStart`/`sessionEnd`/`preCompact` non-blocking; `afterTabFileEdit`/`afterAgentThought` no output.
- Not stated: timeout default numeric value ("platform default"); max stdout size; hook concurrency/ordering within one event array; whether array entries run sequentially or parallel.

## 4. MCP (mcp.md)

### 4.1 Config
| Scope | Path | Cite |
|---|---|---|
| Project | `.cursor/mcp.json` | M:L194 |
| Global | `~/.cursor/mcp.json` | M:L198 |
- Top key `mcpServers` -> name -> server object M:L59-97. Merge/precedence between project and global: Not stated.
- Programmatic: `vscode.cursor.mcp.registerServer()` M:L187.

### 4.2 Transports (M:L19-25)
`stdio` (local, Cursor-managed, single user, manual auth), `SSE` (OAuth), `Streamable HTTP` (OAuth).
| Transport | Keys | Cite |
|---|---|---|
| stdio | `type` (doc says Required, `"stdio"`; examples at L60-83 omit it), `command` (req), `args`, `env`, `envFile` | M:L167-177 |
| remote HTTP/SSE | `url`, `headers`, optional `auth` | M:L86-98, L108-123 |
- `envFile` stdio only; remote servers do not support it M:L179.
- Static OAuth: `auth` object with `CLIENT_ID` (req), `CLIENT_SECRET` (opt), `scopes` (opt array; else discovers `scopes_supported` via `/.well-known/oauth-authorization-server`) M:L125-129.
- Redirect URLs: `https://www.cursor.com/agents/mcp/oauth/callback` (web/Cursor Agents), `http://localhost:8787/callback` (desktop) M:L135-141.
- OAuth: auth code + PKCE; RFC 9728 / RFC 8707; DCR registers public client; refresh-token behavior; `offline_access` scope hint M:L245-247.

### 4.3 Interpolation M:L200-239
Fields resolved: `command`, `args`, `env`, `url`, `headers` (and `auth` values per L149). Syntax: `${env:NAME}`, `${userHome}`, `${workspaceFolder}` (folder containing `.cursor/mcp.json`), `${workspaceFolderBasename}`, `${pathSeparator}`, `${/}`. Hook doc also mentions `${CURSOR_PLUGIN_ROOT}` expansion in MCP commands H:L1100 (not defined on mcp page).
- Not stated: `${input:...}`, `${workspaceRoot}`, default-value syntax.

### 4.4 Enable/disable, approval, limits
- Enable/disable via Customize toggle; disabled servers don't load/appear M:L290, L373-381.
- Tool approval default: asks before each MCP tool use M:L294; follows terminal Run Modes (Auto-review: allowlisted run immediately, rest via classifier) M:L298-300.
- Tools, Prompts, Resources, Roots, Elicitation, Apps supported M:L31-38.
- Tool-count / tool-name length limits: Not stated.
- Enterprise: Team MCP distribution (Dashboard > Plugins & MCPs; available to Cloud Agents); MCP Allowlist (command entries for stdio, URL entries for remote, per-server tool allowlists; empty = all tools); network modes Allow all/Allowlist/Deny all/No sandbox M:L253-286.
- Cloud Agents keep separate MCP sign-ins M:L366-371.
- Logs: Output panel -> "MCP Logs" M:L358-362.
- Hook link: `beforeMCPExecution`/`afterMCPExecution` give `mcp_server_name` = key in `mcp.json` H:L1095.

## 5. Terminal / Browser / Search tools

### 5.1 Terminal (T)
- Sandbox + Run Mode govern execution; details (platform reqs, network modes, env vars, `sandbox.json`) are on another page not provided T:L3-7. Sandbox config schema: Not stated here.
- `CURSOR_AGENT` env var set in Cursor shell sessions; used to skip heavy prompts (p10k) T:L17-34.
- `beforeShellExecution`/`afterShellExecution` input includes `sandbox` boolean H:L1070, L1112.
- Terminal tool name seen by `preToolUse` matcher: `Shell` H:L753, L867.

### 5.2 Browser (B)
- Browser tools run via an MCP server extension B:L94, L131. Tool names given in text: `browser_navigate` B:L175 (others not named; capabilities: Navigate, Click, Type, Scroll, Screenshot, Console Output, Network Traffic B:L24-50).
- Network Traffic currently only in Agent panel B:L50.
- Approval modes: Manual approval (default), Allow-listed actions, Auto-run; settings at Cursor Settings > Agents > Auto-Run; allow list + block list; best-effort protection B:L105-127.
- Enterprise: governed by MCP allowlist/denylist; toggle "browser features" under MCP Configuration; Origin Allowlist (v2.1+; feature must be enabled per org; `Enable Browser Automation Features (v2.0+)`); empty list = allow all B:L5, L139-167.
- Origin allowlist limits: link navigation, redirects, JS navigation can leave allowlist; manual user navigation allowed but tools then blocked B:L171-188.
- Session persistence per workspace (cookies, localStorage/sessionStorage, IndexedDB) B:L52-60.
- Recommended models: Sonnet 4.5, GPT-5, Auto B:L135 (possibly stale).
- `@browser` mention used in prompts B:L72.
- Whether MCP hooks (`beforeMCPExecution`) fire for browser tools: Not stated.

### 5.3 Search (SR)
- Instant Grep: automatic, local index, no config, full regex + word boundary SR:L5-15. Explore subagent (own context, faster model) SR:L17-23; matches hook subagent type `explore` H:L997.
- Multi-root workspaces supported; worktrees disabled for multi-root; Cloud Agents no multi-root SR:L29.
- Instant Grep tagged beta via changelog link SR:L7 (link anchor `#instant-grep-beta`; status text itself not stated).
- Grep tool name for hooks: `Grep` H:L753.

## 6. Worktrees (W)
- UI-native worktrees only in Agents Window; IDE uses Worktree Skills W:L3.
- Config file: `.cursor/worktrees.json`; checked when worktree created in Agents Window, IDE, or CLI W:L19. Lookup order: (1) worktree path, (2) project root path W:L21-24.
- Keys W:L28-37: `setup-worktree-unix` (macOS/Linux, takes precedence over `setup-worktree` on Unix), `setup-worktree-windows` (Windows, precedence), `setup-worktree` (generic fallback).
- Each key value: array of shell commands (run sequentially in the worktree) OR string filepath to script relative to `.cursor/worktrees.json` W:L34-37, L106.
- Env var: `ROOT_WORKTREE_PATH` (Unix `$ROOT_WORKTREE_PATH`, PowerShell `$env:ROOT_WORKTREE_PATH`, cmd `%ROOT_WORKTREE_PATH%`) W:L49, L135, L156. Other env vars: Not stated.
- Do not symlink dependencies (can break main worktree) W:L54.
- Debug: Output panel -> `Worktrees Setup` W:L163.
- Discovery (Cursor 3.5): mtime checkpoints; startup rescan; removes `worktree.discoveryComplete` flag W:L167.
- Cleanup (3.5+): settings `cursor.worktreeCleanupIntervalHours` (example 6), `cursor.worktreeMaxCount` (default 25, machine-wide across workspaces); externally created worktrees (`git worktree add`, `/worktree` skills) also eligible for deletion W:L171-187.
- IDE commands: `/worktree <task>`, `/best-of-n <models> <task>` (own worktree per model; compare only, no merge), `/apply-worktree`, `/delete-worktree`; `git worktree list` W:L189-233.
- Parallel agents: each task own checkout; start several agents on same repo without conflicts W:L7-9.
- Not stated: worktrees.json schema validation, timeout, failure behavior when setup script errors, branch naming, worktree dir location.

## 7. Experimental / version-gated / renamed items
- `/migrate-to-skills` introduced Cursor 2.4 S:L320.
- Worktree discovery/cleanup behaviors: Cursor 3.5+ W:L167, L171.
- Browser: automation v2.0+, origin allowlist v2.1+ B:L163-164.
- `globs` in skills is legacy; `paths` is current S:L212.
- Skills dirs `.agents/skills/` listed first (newer open-standard dir); `.claude/`+`.codex/` dirs are compat S:L65, L78.
- Instant Grep changelog anchor suffix "beta" SR:L7.
- Hook page has no stated experimental/deprecated markers.

## 8. Audit checkpoints (test against a `.cursor/` tree)
1. Every file in `.cursor/rules/` intended as a rule ends in `.mdc`; any `.md` there is inert (R:L42).
2. Rule frontmatter uses only `description`, `globs`, `alwaysApply`; any other key is undocumented (R:L42, L63).
3. Rule meant to always apply has `alwaysApply: true`; its `globs`/`description` are ignored (R:L67).
4. Rule meant for file-scope has `alwaysApply: false` plus `globs` (comma-separated string); no `description` needed (R:L68, L131).
5. Agent-selected rule has `description` and no `globs` with `alwaysApply: false` (R:L69).
6. Manual-only rule has `alwaysApply: false` and neither `description` nor `globs` (R:L70).
7. Rules with `globs` AND `description` AND `alwaysApply:false`: behavior is documented only as glob auto-attach (R:L68); flag as ambiguous.
8. No rule body relies on `@file` being inlined; mentions are pointers only (R:L127).
9. No rule exceeds 500 lines (R:L155).
10. Rules assumed to affect Tab are wrong: rules never apply to Tab (R:L381-383).
11. Skills live at `.cursor/skills/<name>/SKILL.md` (or `.agents/skills/`, or `.claude/skills/` compat) (S:L65-78).
12. Each SKILL.md `name` is lowercase/digits/hyphens and equals its parent folder name (S:L172).
13. Each SKILL.md has non-empty `description` (S:L173, L180).
14. Skills meant to be explicit-only carry `disable-model-invocation: true` (S:L175).
15. Skill file-scoping uses `paths` (not legacy `globs`) (S:L174, L212).
16. Skill extras only under `scripts/`, `references/`, `assets/` and referenced by skill-root-relative paths (S:L235, L266-270).
17. No skill name collides with a built-in (`/review`, `/loop`, `/shell`, `/create-rule`, ...) (S:L35-55).
18. `hooks.json` has top-level `"version": 1` and `"hooks"` object keyed by exact camelCase event names (H:L705, L24-44).
19. Every event key in `hooks.json` is one of the 21 documented names (H:L24-44, L699); anything else (e.g. PascalCase Claude names) is unrecognized by this page.
20. Each hook entry has `command` (or `type:"prompt"` + `prompt`); optional keys limited to `type`, `timeout`, `matcher`, `loop_limit`, `failClosed` (H:L709-716).
21. `timeout` values are seconds (H:L713); `loop_limit` only on `stop`/`subagentStop` (H:L714).
22. Project-level hook commands are project-root-relative (`.cursor/hooks/x`), not `./hooks/x` (H:L155, L665).
23. Hook scripts are executable (`chmod +x`) and read JSON from stdin, write JSON to stdout (H:L136-169, L180).
24. Blocking hooks either exit `2` or print `permission:"deny"`; `preToolUse` "ask" is not enforced, `subagentStart` "ask" becomes deny (H:L200, L892, L1007).
25. Permission-hook scripts always emit schema-valid JSON on exit 0; invalid JSON blocks (H:L199).
26. Security-critical hooks (`beforeMCPExecution`, `beforeReadFile`, shell guards) set `failClosed: true` since other non-zero exits fail open (H:L201, L715, L1062).
27. `beforeSubmitPrompt` uses `continue`/`user_message` shape, not `permission` (H:L1271-1281).
28. `stop`/`subagentStop` continuation uses `followup_message`; loop guard via `loop_count` and `loop_limit` (default 5) (H:L1336, L714).
29. Context injection uses `additional_context` (sessionStart/postToolUse/postToolUseFailure only); `env` only from `sessionStart` (H:L934, L968, L1368).
30. `matcher` values match the per-event target strings (`Shell`/`Read`/`Write`/`Grep`/`Delete`/`Task`/`MCP:<name>` for tool hooks; command text for shell hooks; subagent type; fixed literals `Read`,`Write`,`TabRead`,`TabWrite`,`UserPromptSubmit`,`Stop`) (H:L751-763).
31. Hooks that must work in cloud agents use only the 14 cloud-supported events and `command` type; `sessionStart`/`sessionEnd`/MCP-hooks/Tab/`workspaceOpen` don't run there (H:L56-92, L106-108).
32. Scripts needing project root use `CURSOR_PROJECT_DIR` (or alias `CLAUDE_PROJECT_DIR`), not a hardcoded path (H:L1471, L1477).
33. `mcp.json` uses top-level `mcpServers`; stdio entries have `command`(+`args`,`env`,`envFile`), remote have `url`(+`headers`,`auth`); `envFile` absent on remote entries (M:L59-97, L179).
34. `mcp.json` interpolation uses only `${env:NAME}`, `${userHome}`, `${workspaceFolder}`, `${workspaceFolderBasename}`, `${pathSeparator}`, `${/}`, only in `command|args|env|url|headers|auth` (M:L202-209, L149).
35. No literal secrets in `mcp.json`; use `${env:...}` (M:L165, L408).
36. `.cursor/worktrees.json` uses only `setup-worktree`, `setup-worktree-unix`, `setup-worktree-windows`; values are command arrays or script paths relative to `.cursor/worktrees.json` (W:L28-37).
37. Worktree setup scripts copy env via `ROOT_WORKTREE_PATH`, and do not symlink dependencies (W:L49, L54).

## Unresolved / Not stated (summary)
- Third-party hook loading detail + Claude event-name mapping live on a separate page not in the set (H:L18); not captured.
- Legacy `.cursorrules`; AGENTS.md vs rules precedence; skill name/description length limits; hook timeout numeric default; hook ordering within an event; whether events fire in CLI beyond `workspaceOpen`; matchers for several events; output schema for after* hooks.
- `command` "required" vs prompt-hook example without `command` (H:L711 vs L211-217).
