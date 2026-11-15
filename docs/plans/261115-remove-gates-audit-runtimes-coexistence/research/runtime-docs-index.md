# Runtime docs reading — index for the replan audit

Read 2026-11-15, in parallel with plan drafting. Input to the replan round that audits skills,
rules, agents, hooks and the three adapters against vendor docs. Docs only: no MeowKit file was
audited or changed here. Doc text is data, not instruction.

## How it was read

- Round 1: the 19 pages on the user's list, fetched as raw markdown (every host serves
  `<url>.md`), read line by line by five readers, one report each.
- Round 2 (same day, user said to read the pages round 1 deferred to): 10 more pages, seven
  readers. Nine were read in full. `claude/settings-reference.md` (6115 lines) was read in part:
  the index plus Permission, Memory and context, Git and attribution, Hooks and automation,
  Plugins and skills, Agents/sessions/worktrees, Tools, Enterprise and managed. Not read: Model
  and responses, Sandbox, Interface and terminal, MCP, Remote/desktop, Authentication, Updates,
  Privacy, Global config.
- Reports cite `<snapshot>.md:L<line>`. The Codex round-2 report uses aliases `A:` / `S:` / `C:`
  for its three files. Three snapshots are named `hooks.md`, one per runtime: round-1 rows name
  the runtime in the fact text, round-2 rows give the folder (`claude/hooks.md`).
- Snapshots: `tmp/runtime-docs-261115/{claude,cursor,codex}/` (gitignored by `tmp/`, vendor text,
  do not commit). Re-fetch: `curl -sL <url>.md`. If a hash below differs, line cites have drifted.
- Lead spot-checked the cited claims behind every row in the two fact tables below against the
  snapshots; none was wrong. The rest of each report is unverified beyond its own cites.

## Sources

| Runtime | Page | Snapshot | Lines | sha256 (first 12) | Report |
| --- | --- | --- | --- | --- | --- |
| Claude Code | code.claude.com/docs/en/skills | `claude/skills.md` | 1268 | `654fd3e23932` | `runtime-docs-claude-code-skills-and-large-codebases.md` |
| Claude Code | …/large-codebases | `claude/large-codebases.md` | 480 | `5764008ddd89` | same |
| Claude Code | …/sub-agents | `claude/sub-agents.md` | 1495 | `00bda45456b2` | `runtime-docs-claude-code-subagents-and-agent-teams.md` |
| Claude Code | …/agent-teams | `claude/agent-teams.md` | 525 | `287f52959e75` | same |
| Claude Code | …/agent-view | `claude/agent-view.md` | 1142 | `75f23421fc60` | `runtime-docs-claude-code-agent-view-worktrees-best-practices.md` |
| Claude Code | …/worktrees | `claude/worktrees.md` | 442 | `66f5501dc741` | same |
| Claude Code | …/best-practices | `claude/best-practices.md` | 634 | `ee235042febd` | same |
| Cursor | cursor.com/docs/rules | `cursor/rules.md` | 394 | `dae9d3ecd7e3` | `runtime-docs-cursor.md` |
| Cursor | …/skills | `cursor/skills.md` | 350 | `c4b7a775e268` | same |
| Cursor | …/hooks | `cursor/hooks.md` | 1507 | `a5f76c8eab2c` | same |
| Cursor | …/mcp | `cursor/mcp.md` | 423 | `33c58ca4e1a2` | same |
| Cursor | …/agent/tools/terminal | `cursor/agent-tools-terminal.md` | 45 | `aa4e8d89606a` | same |
| Cursor | …/agent/tools/browser | `cursor/agent-tools-browser.md` | 199 | `bdd6f305af99` | same |
| Cursor | …/agent/tools/search | `cursor/agent-tools-search.md` | 36 | `60b8b5e8b4e8` | same |
| Cursor | …/configuration/worktrees | `cursor/configuration-worktrees.md` | 240 | `cc4e372cea40` | same |
| Codex | learn.chatgpt.com/docs/build-skills | `codex/build-skills.md` | 244 | `95b5ef4d0581` | `runtime-docs-codex.md` |
| Codex | …/docs/hooks | `codex/hooks.md` | 1153 | `a50c60b697d8` | same |
| Codex | …/docs/agent-configuration/rules | `codex/agent-configuration-rules.md` | 138 | `b2c34d7dc85c` | same |
| Codex | developers.openai.com/blog/codex-as-a-platform | `codex/blog-codex-as-a-platform.md` | 114 | `d045ab02d574` | same (blog, non-normative) |

| Claude Code | …/hooks (reference) L1-1271, L3972-4347 | `claude/hooks.md` | 4347 | `cf74269ef6d1` | `runtime-docs-claude-code-hooks-reference-config-and-io.md` |
| Claude Code | …/hooks L1272-2680 (SessionStart → SubagentStart) | same | | | `runtime-docs-claude-code-hooks-reference-events-session-to-subagentstart.md` |
| Claude Code | …/hooks L2681-3971 (SubagentStop → ElicitationResult) | same | | | `runtime-docs-claude-code-hooks-reference-events-subagentstop-to-elicitation.md` |
| Claude Code | …/memory | `claude/memory.md` | 667 | `524cff77043d` | `runtime-docs-claude-code-memory-settings-permissions.md` |
| Claude Code | …/settings | `claude/settings.md` | 344 | `bc72fdd5dc45` | same |
| Claude Code | …/permissions | `claude/permissions.md` | 839 | `3f504ff0e98e` | same |
| Claude Code | …/settings-reference (part, see above) | `claude/settings-reference.md` | 6115 | `1ccc167196c5` | `runtime-docs-claude-code-settings-reference-selected-sections.md` |
| Cursor | cursor.com/docs/reference/third-party-hooks | `cursor/reference-third-party-hooks.md` | 278 | `c2d2e67fd529` | `runtime-docs-cursor-third-party-hooks-and-subagents.md` |
| Cursor | …/subagents | `cursor/subagents.md` | 491 | `414149d06513` | same |
| Codex | learn.chatgpt.com/docs/agent-configuration/agents-md | `codex/agent-configuration-agents-md.md` | 218 | `9d1f87a2d1cb` | `runtime-docs-codex-agents-md-subagents-config-reference.md` |
| Codex | …/agent-configuration/subagents | `codex/agent-configuration-subagents.md` | 563 | `e7469d41c5a1` | same |
| Codex | …/config-file/config-reference | `codex/config-file-config-reference.md` | 3347 | `f6bef51b85be` | same |

Each report ends with an "Audit checkpoints" list and a "Not stated" list. Round 1: 34, 32, 32,
37, 36 items. Round 2: 20, 24, 22 (hooks reference), 38, 33, 17, 30.

## Facts that bear on the current plan (gate removal, ship check, completion check, coexistence)

| # | Fact | Cite | Touches |
| --- | --- | --- | --- |
| 1 | Claude Code: a rule that cannot have exceptions belongs in a hook or deny rule, not CLAUDE.md; stacking IMPORTANT / ALL CAPS is listed as an outdated pattern that makes the model over-apply | `best-practices.md:L172,L617` | Phase 3 wording criteria |
| 2 | Claude Code: `prompt` / `agent` hooks are not deterministic; enforcement needs `command` or `http` plus `onFailure: "block"` | `best-practices.md:L307` | Phase 2 ship check |
| 3 | Claude Code: a Stop hook that blocks eight stops in a row is overridden | `best-practices.md:L288` | Phase 4 completion check |
| 4 | Claude Code: after entering a worktree `${CLAUDE_PROJECT_DIR}` stays at the starting project root; hook input `cwd` follows the worktree | `worktrees.md:L50-53` | ship check must resolve the repo from `cwd` |
| 5 | Claude Code: a subagent in a worktree under `.claude/worktrees/` does not load that worktree's root `CLAUDE.md` or `.claude/rules/` | `worktrees.md:L140` | parallel-execution prose |
| 6 | Claude Code: background sessions move into a worktree before the first edit (off with `worktree.bgIsolation: "none"`), and a permission prompt there waits until someone attaches | `agent-view.md:L585-603,L228` | any hook that returns `ask` |
| 7 | Claude Code: with a sparse worktree, `.claude` must be in `worktree.sparsePaths` or rules and settings are absent | `large-codebases.md:L232-236` | hooks silently missing |
| 8 | Codex PreToolUse: `permissionDecision: "ask"`, `decision: "approve"`, `continue: false`, `stopReason`, `suppressOutput` fail the hook run and the tool call continues | `hooks.md:L836-838` | fail-open path |
| 9 | Codex Stop / SubagentStop: `decision: "block"` continues the turn with `reason` as a new prompt; exit 2 with stderr does the same | `hooks.md:L1085-1119` | Phase 4 completion check |
| 10 | Codex: only `command` and `mcp_tool` handlers run; `prompt` and `agent` are parsed and skipped; default timeout 600 s, `SessionEnd` / `Interrupt` 1 s (max 3) | `hooks.md:L184-195` | hooks.json emit |
| 11 | Codex: project hooks load only from a trusted `.codex/` layer and are skipped until reviewed; a changed hook needs review again | `hooks.md:L59-68` | upgrade path, doctor row |
| 12 | Codex: hooks are a guardrail, not a complete enforcement boundary; hosted tools such as `WebSearch` are not covered | `hooks.md:L465-472` | docs claims |
| 13 | Cursor: exit 2 blocks; any other failure allows the action unless `failClosed: true`; permission hooks block on invalid JSON regardless | `hooks.md:L197-200,L715` | ship check, privacy block |
| 14 | Cursor: `loop_limit` default 5 for `stop` / `subagentStop` | `hooks.md:L714,L1336` | Phase 4 completion check |
| 15 | Cursor loads skills from `.claude/skills/`, `.codex/skills/` and their `~/` twins as well as `.cursor/skills/` and `.agents/skills/` | `skills.md:L65-78` | coexistence: one kit installed for two hosts lists every skill twice in Cursor |
| 16 | Cursor can load hooks from third-party tools such as Claude Code | `hooks.md:L18` | coexistence: double firing, confirmed by #45 |

Round 2 (cites give the folder):

| # | Fact | Cite | Touches |
| --- | --- | --- | --- |
| 29 | Claude Code: exit 0 = success, exit 2 = block; any other exit code, a hook that does not start, or invalid JSON is a non-blocking error and the action goes ahead. Exit 1 does not block | `claude/hooks.md:L804,L896` | Phase 2 ship check: a crashed check lets the commit through |
| 30 | Claude Code: a timed-out PreToolUse hook does not block. `onFailure: "block"` on a `command` or `http` hook makes failure, crash and timeout block; needs v2.1.295+; no effect on Stop, SubagentStop, TaskCompleted, TeammateIdle or async hooks | `claude/hooks.md:L902,L936,L983-986` | Phase 2 ship check, privacy block (refines #2) |
| 31 | Claude Code Stop: input has `stop_hook_active`; after eight continuations in a row the next block is overridden; the count resets each time Claude calls a tool; `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP` raises it. `hookSpecificOutput.additionalContext` continues the turn as feedback, not as an error, under the same cap | `claude/hooks.md:L2840-2842,L2908-2921` | Phase 4 completion check (refines #3) |
| 32 | Claude Code: Stop does not run on user interrupt; an API error fires `StopFailure`, whose output and exit code are ignored | `claude/hooks.md:L2830-2832,L2934` | Phase 4: paths the completion check never sees |
| 33 | Claude Code: a PostToolUse hook matching `Edit\|Write` does not run when a Bash command or outside process rewrites the file; a PreToolUse hook matching `Read` does not run for files added with `@` | `claude/hooks.md:L2272,L1786` | Phase 4 "unverified edits" tracking; privacy block coverage |
| 34 | Claude Code PreToolUse: decision goes in `hookSpecificOutput.permissionDecision` (`allow` / `deny` / `ask` / `defer`); top-level `decision` with `approve` / `block` is deprecated for this event; several hooks: `deny` > `defer` > `ask` > `allow`; exit 2 routes as `deny` | `claude/hooks.md:L2006-2013,L2033` | every PreToolUse hook output |
| 35 | Claude Code: a hook `allow` does not bypass deny or ask rules; a hook that exits 2 stops the call before allow rules are evaluated | `claude/permissions.md:L637,L659` | privacy block, ship check |
| 36 | Claude Code: Read / Edit deny rules cover the built-in file tools, Bash file commands Claude Code recognises (`cat`, `head`, `tail`, `sed`, `tee`) and redirect targets, not `grep -r` or a subprocess; Bash deny rules are stated not to be a security boundary | `claude/permissions.md:L357,L252-262` | what the kit may claim about sensitive-file protection |
| 37 | Claude Code exit 2 per event: blocks PreToolUse, UserPromptSubmit, Stop, SubagentStop, PreCompact; PostToolUse / PostToolUseFailure only show stderr to Claude; SessionStart / SubagentStart / SessionEnd show stderr to the user only | `claude/hooks.md:L1025-1061` | each kit hook's exit code |
| 38 | Claude Code: hooks and project settings load from the working directory's `.claude/` with no parent-directory fallback; `settings.local.json` loads from the git root | `claude/permissions.md:L729-731` | session started in a subdirectory has no kit hooks |
| 39 | Claude Code: interactive sessions hold hooks until the folder is trusted; `-p` and SDK sessions treat the folder as trusted and run committed hooks | `claude/hooks.md:L4278-4279` | doctor row, docs claims |
| 40 | Claude Code: `disableAllHooks` follows settings precedence, so project `false` overrides user `true`; it also turns off the custom status line; managed `allowManagedHooksOnly` blocks user, project, local and agent-frontmatter hooks | `claude/hooks.md:L732-734`; `claude/settings-reference.md:L3631,L3640` | doctor row: kit hooks present but not running |
| 41 | Claude Code: hook entries merge across settings levels; the same handler defined in more than one settings file runs once; a plugin or skill copy stays separate | `claude/hooks.md:L266,L409` | global + project install of the kit |
| 42 | Claude Code timeouts: 600 s default for `command`; 30 s on UserPromptSubmit, where a timed-out hook's output is dropped and the prompt goes through; SessionEnd 1.5 s | `claude/hooks.md:L423,L1525-1527,L3683-3688` | hook `timeout` values |
| 43 | Claude Code: SubagentStop also fires for internal agents with an empty `agent_type`; an omitted matcher matches them. A `Stop` hook in agent frontmatter becomes `SubagentStop` | `claude/hooks.md:L2687-2691,L680` | Phase 4 completion check on subagents |
| 44 | Claude Code: `worktree.sparsePaths` must list `.claude`; gitignored files reach a worktree only through `.worktreeinclude`; `worktree.bgIsolation` default `"worktree"` blocks Edit / Write in the main checkout for background sessions; `permissions.blockWritesOutsideWorkingDirectories` removes `EnterWorktree` / `ExitWorktree` | `claude/settings-reference.md:L4767,L4815,L4829,L1104-1106` | parallel-execution prose (extends #6, #7) |
| 45 | Cursor: Claude Code hooks load when "Include Third-Party Plugins, Skills, and Other Configs" is on, which is the default; sources `.claude/settings.local.json`, `.claude/settings.json`, `~/.claude/settings.json`, ranked below `.cursor/hooks.json`; all matching hooks from every source run; priority only settles conflicting responses | `cursor/reference-third-party-hooks.md:L11,L15-35` | Phase 5: a dual install fires both hook sets in Cursor |
| 46 | Cursor maps eight Claude Code events (PreToolUse, PostToolUse, UserPromptSubmit, Stop, SubagentStop, SessionStart, SessionEnd, PreCompact); `Notification` and `PermissionRequest` are unsupported; `PostToolUseFailure` and `SubagentStart` are not in the table; tools `Bash` → `Shell`, `Edit` → `Write`, `Glob` unmapped; exit 2 blocks, other non-zero exits fail open; Stop `decision: "block"` + `reason` becomes an automatic follow-up; `loop_limit` is native-format only | `cursor/reference-third-party-hooks.md:L135-150,L167-169,L211-214,L233-248` | Phase 5; which kit hooks run twice |
| 47 | Cursor loads agents from `.claude/agents/` and `.codex/agents/` and their `~/` twins as well as `.cursor/agents/`; on a name clash `.cursor/` wins and project beats user | `cursor/subagents.md:L83-92` | Phase 5: agents cross-loaded |
| 48 | Codex: project `.codex/config.toml` loads only for a trusted project; an untrusted project skips project config, hooks and rules; project config ignores `notify`, `profile`, `profiles`, `model_provider`, `model_providers`, `otel` and four URL / SKU keys | `codex/config-file-config-reference.md:L77,L82-86,L1975` | adapter emit, doctor row |
| 49 | Codex: hooks come from `hooks.json` or inline `[hooks]`, gated by `features.hooks` (`features.codex_hooks` is a deprecated alias); `requirements.toml` `allow_managed_hooks_only` skips user, project, session and plugin hooks | `codex/config-file-config-reference.md:L521-526,L581-598,L2396-2399` | adapter emit, doctor row |

## Facts for the replan audit (skills, rules, agents, adapters)

| # | Fact | Cite |
| --- | --- | --- |
| 17 | Claude Code skills: every frontmatter field is optional; an unrecognised key is ignored without an error. claude.ai upload and the Skills API accept only `name`, `description`, `license`, `compatibility`, `metadata`, `allowed-tools` | `skills.md:L397,L431` |
| 18 | Claude Code skills: `description` + `when_to_use` share a 1,536-character cap in the listing; the listing budget is set by `skillListingBudgetFraction` / `SLASH_COMMAND_TOOL_CHAR_BUDGET` | `skills.md:L404-405,L1234-1240` |
| 19 | Claude Code skills: `allowed-tools` pre-approves tools for the invoking turn, it does not restrict; `disallowed-tools` removes tools while the skill is active | `skills.md:L410-411` |
| 20 | Claude Code agents: `name` at most 256 chars, no `:`; field names are camelCase and an unrecognised field is ignored without an error (`claude --debug` logs it) | `sub-agents.md:L291-298` |
| 21 | Claude Code agents: `Agent(type)` allowlists apply only to a `--agent` main-thread agent; `Task(...)` is an alias of `Agent` since v2.1.63 | `sub-agents.md:L523,L543` |
| 22 | Claude Code agents: plugin-shipped agents ignore `hooks`, `mcpServers`, `permissionMode` | `sub-agents.md:L234` |
| 23 | Agent teams: experimental, off unless `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`; a teammate's plan is approved on arrival unless its permission mode was changed after spawn; a definition's `skills` are not applied to a teammate | `agent-teams.md:L11,L188,L299` |
| 24 | Cursor rules: project rules must be `.mdc`; a plain `.md` in `.cursor/rules` is ignored; documented frontmatter is `description`, `globs`, `alwaysApply` only | `rules.md:L42,L54-65` |
| 25 | Cursor skills: `paths` replaces legacy `globs`; `disable-model-invocation: true` makes a skill slash-only | `skills.md:L174-175,L212` |
| 26 | Cursor hooks: project hook commands run from the project root (`.cursor/hooks/x`); `CLAUDE_PROJECT_DIR` is provided as an alias | `hooks.md:L155,L1477` |
| 27 | Codex skills: repo scan is `.agents/skills` from cwd up to the repo root, user `$HOME/.agents/skills`, admin `/etc/codex/skills`; same-name skills are not merged, both show; disable with `[[skills.config]]` in `~/.codex/config.toml`; optional `agents/openai.yaml` | `build-skills.md:L138-146,L183-207` |
| 28 | Codex rules: Starlark `prefix_rule(pattern, decision, justification, match, not_match)`; `forbidden` > `prompt` > `allow`; test with `codex execpolicy check`; experimental | `agent-configuration-rules.md:L7,L59-68,L127` |

Round 2:

| # | Fact | Cite |
| --- | --- | --- |
| 50 | Claude Code matchers: only letters, digits, `_`, `-`, space, `,`, `\|` = exact string or list; any other character = unanchored JavaScript regex; a matcher on an event without matcher support (UserPromptSubmit, Stop, PostToolBatch, TeammateIdle, TaskCreated, TaskCompleted, WorktreeCreate, WorktreeRemove, MessageDisplay, CwdChanged) is ignored silently | `claude/hooks.md:L279-283,L303,L311,L337` |
| 51 | Claude Code handler fields: `if` is evaluated only on tool events; `once` is honoured only in skill frontmatter; `suppressOutput` has no effect; `additionalContext` and plain stdout are capped at 10,000 characters | `claude/hooks.md:L422-425,L1086,L1102` |
| 52 | Claude Code: skill-frontmatter hooks register when the skill is invoked and stay for the rest of the session; agent-frontmatter hooks run only while that subagent runs; project-agent frontmatter hooks need the trust dialog | `claude/hooks.md:L680-681,L702` |
| 53 | Claude Code SessionStart: `source` is `startup` / `resume` / `clear` / `compact` / `fork`; only `command` and `mcp_tool` handlers; `CLAUDE_ENV_FILE` exists for SessionStart, Setup, CwdChanged and FileChanged only | `claude/hooks.md:L1280,L1306,L1434` |
| 54 | Claude Code UserPromptSubmit receives a typed `/skill` line as typed, not the expansion | `claude/hooks.md:L1554` |
| 55 | Claude Code SubagentStart cannot block, only adds context; matcher is the agent type; a plugin agent's type is `plugin:name`, which needs `^…$`; it also fires on subagent resume and per teammate message | `claude/hooks.md:L2645-2647,L2664` |
| 56 | Claude Code PostToolUse cannot undo; `decision: "block"` only adds `reason` beside the result. PostToolUseFailure does not fire for validation errors or permission denials | `claude/hooks.md:L2321,L2347,L2390` |
| 57 | Claude Code PreCompact can block (exit 2 or `decision: "block"`); on exit 0 its stdout becomes instructions for the summary, 10,000 characters per hook. SessionEnd cannot block and its JSON output is discarded | `claude/hooks.md:L3392,L3415,L3683` |
| 58 | Claude Code: a WorktreeCreate hook replaces git worktree creation and `.worktreeinclude`; it must print the path as the last non-empty stdout line; WorktreeRemove is not run for a subagent's hook-made worktree | `claude/hooks.md:L3259-3261,L3306-3311,L3324` |
| 59 | Claude Code async hooks cannot block: `decision`, `permissionDecision`, `continue` have no effect | `claude/hooks.md:L4158` |
| 60 | Claude Code rules: `paths` is the only frontmatter field read, others are ignored without error; an unscoped rule loads at launch with the priority of `.claude/CLAUDE.md`; user rules load before project rules and neither overrides | `claude/memory.md:L190,L249,L284` |
| 61 | Claude Code CLAUDE.md: target under 200 lines per file; delivered as a user message after the system prompt, no guarantee of strict compliance; a launch-loaded file over 4 MiB is skipped; path-scoped rules and subdirectory files have a per-file cap of 40,000 characters on a 200K window | `claude/memory.md:L90,L556,L584,L645-646` |
| 62 | Claude Code: `AGENTS.md` is not read when a `CLAUDE.md`, `.claude/CLAUDE.md` or `CLAUDE.local.md` exists in the working directory or above | `claude/memory.md:L360,L373` |
| 63 | Claude Code settings: precedence managed > `--settings` > local > project > user; list keys combine across files; strict JSON; edits to `permissions` and `hooks` reload live; project `permissions.allow`, `additionalDirectories` and most `env` values wait for trust, `deny` and `ask` do not | `claude/settings.md:L132,L178,L214-220,L228,L295`; `claude/permissions.md:L781` |
| 64 | Claude Code: `permissions.defaultMode` values `auto` and `bypassPermissions` have no effect from project or local settings | `claude/settings-reference.md:L1145` |
| 65 | Claude Code: `skillListingBudgetFraction` default 0.01, `skillListingMaxDescChars` default 1536; `attribution: false` needs v2.1.281+, an older client skips the whole settings file holding it; `includeCoAuthoredBy` is deprecated | `claude/settings-reference.md:L2614,L2630,L3447,L3472` |
| 66 | Cursor agents: documented frontmatter is `name` (default from filename), `description`, `model` (default `inherit`), `readonly`, `is_background`; subagents inherit all parent tools including MCP; nesting is one level below a direct subagent | `cursor/subagents.md:L120-129,L455-459,L468-471` |
| 67 | Codex custom agent: one TOML file per agent in `.codex/agents/` or `~/.codex/agents/`; required `name`, `description`, `developer_instructions`; the `name` key identifies it, not the filename; `sandbox_mode`, `approval_policy`, `model_provider`, `mcp_servers` in the file do not override the parent | `codex/agent-configuration-subagents.md:L314-316,L341-354,L407-415` |
| 68 | Codex AGENTS.md: global `AGENTS.override.md` else `AGENTS.md` in `CODEX_HOME`; then one file per directory from project root to cwd (`AGENTS.override.md`, `AGENTS.md`, fallback names); concatenated root-down; empty files skipped; stops adding at `project_doc_max_bytes`, 32 KiB by default | `codex/agent-configuration-agents-md.md:L9-15` |
| 69 | Codex: `approval_policy = "untrusted"` is no longer supported; `default_permissions` must not be combined with `sandbox_mode` or `[sandbox_workspace_write]`; hook events named in config include `PreModelRequest`, `PostModelRequest`, `PermissionRequest`, `PostCompact`, `SubagentStart`, `Interrupt` | `codex/config-file-config-reference.md:L92-93,L591,L1840` |

## Shape check of the shipped bundles (one pass, not an audit)

- `kit/bundles/codex/root/`: skills under `.agents/skills`, hooks in `.codex/hooks.json` with `type: "command"`, `timeout`, `statusMessage`, `commandWindows` — location and handler type match #10 and #27.
- `kit/bundles/cursor/root/.cursor/`: rules are `.mdc`; `hooks.json` has `version: 1` and per-hook keys `command`, `type`, `timeout`, `failClosed`, `matcher`, `loop_limit`; commands are `node .cursor/hooks/…` — matches #13, #24, #26.
- Not checked: frontmatter field by field, event-by-event input/output, Codex agent TOML, anything in the Rust adapters.

## Still not read

Round 2 closed the pages round 1 deferred to. What the round-2 reports point at and nobody read:

- Claude Code: `hooks-guide` (Stop-loop troubleshooting), `permission-modes`, `sandboxing`,
  `env-vars`, `plugins-reference`, and the skipped sections of `settings-reference`.
- Cursor: `plugins`.
- Codex: `config-file/config-advanced` (project instructions discovery, profiles, config layer
  order), `config-file/config-basic`, `permissions`, `agent-approvals-security`.

None is needed for the facts in the tables above. Read one only if the audit hits a "Not stated"
item that it would answer.

## Doc disagreements seen

- Cursor's third-party hooks page says Claude Code has only `SubagentStop`
  (`cursor/reference-third-party-hooks.md:L247`); Claude Code's hooks reference documents
  `SubagentStart` (`claude/hooks.md:L2645`).
- Claude Code settings index lists `permissions.defaultMode` as any-file; the body restricts
  `auto` and `bypassPermissions` (#64).
- Codex AGENTS.md page: chain built "once per run" vs "on every run", and "stops adding files" vs
  "truncation" (`codex/agent-configuration-agents-md.md:L9,L15,L206`).
- Codex: `Interrupt` is a hook event in `config.toml` but absent from the `requirements.toml`
  list; `[agents.<name>]` role entries and `.codex/agents/*.toml` files coexist unexplained.

## Unresolved questions

1. Answered by #45: yes, Cursor runs `.claude/settings.json` hooks by default beside
   `.cursor/hooks.json`. Still open: no de-duplication is stated, and the pages do not say which
   stdin fields, env vars (`CLAUDE_PROJECT_DIR`), cwd or timeout an imported hook gets, or whether
   the same Third-Party Imports setting governs agents and skills.
2. Codex: precedence between skill scopes, name and description limits, matcher anchoring, the
   default of `features.hooks`, how `hooks.json` and inline `[hooks]` combine, project-vs-user
   agent name clashes, and whether subagents inherit hooks and `.codex/rules` are not stated.
3. Claude Code: whether background sessions and teammates apply an agent definition's `hooks` /
   `permissionMode` / `memory` is still not stated. Also not stated: how object-valued settings
   keys other than `hooks` (`env`, `statusLine`) combine across scopes, whether path-scoped rules
   load in subagents, and Stop behaviour in `-p` mode.
4. Which Claude Code agent frontmatter fields Cursor ignores when it loads `.claude/agents/` is
   not stated; only five fields are documented (#66).
