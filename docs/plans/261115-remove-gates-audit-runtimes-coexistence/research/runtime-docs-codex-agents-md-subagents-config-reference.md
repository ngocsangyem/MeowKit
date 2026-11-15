# Codex docs findings: AGENTS.md, Subagents, Configuration Reference

## Scope

Cite aliases (line numbers = Read tool numbers; all files under `tmp/runtime-docs-261115/`):
- `A:Lx` = `codex/agent-configuration-agents-md.md:Lx` (218 lines, read L1-218)
- `S:Lx` = `codex/agent-configuration-subagents.md:Lx` (563 lines read L1-563; file has 564 numbered lines in last chunk, final line is closing tag)
- `C:Lx` = `codex/config-file-config-reference.md:Lx` (3347 lines, read L1-3348 in 7 chunks of <=500)

Every line of all three files read. Doc text treated as DATA. Pages are vendor snapshots dated 2026-11-15 era; model names (gpt-6.1-sol etc.) as stated. Only these 3 files read; no MeowKit inspection.

---

## 1. AGENTS.md page (`A`)

### Discovery and merge
| Item | Statement | Cite |
|---|---|---|
| When built | Chain built at startup, once per run; TUI = once per launched session. Also "rebuilds on every run and at start of each TUI session"; no cache to clear | A:L9, A:L206 |
| Global scope | In Codex home (`~/.codex`, or `CODEX_HOME`): `AGENTS.override.md` if exists, else `AGENTS.md`; only first NON-EMPTY file used at this level | A:L11 |
| Project scope | From project root (typically Git root) down to cwd. No project root found -> only cwd checked | A:L12 |
| Per-dir filename order | `AGENTS.override.md`, then `AGENTS.md`, then names in `project_doc_fallback_filenames`. At most ONE file per dir | A:L12 |
| Override wins | In a dir with both override and base, base ignored (tree comment) | A:L104-111 |
| Merge order | Concatenated root -> down, joined with blank lines; later (closer to cwd) overrides earlier by position | A:L13 |
| Search end | Stops at current dir; no search below cwd | A:L83 |
| Empty files | Skipped | A:L15, A:L210 |
| Size cap | `project_doc_max_bytes`, default 32 KiB; stops adding files once combined size reaches limit | A:L15 |
| Past cap | "stops adding files" (L15); elsewhere "before truncation" (L159) and "Instructions truncated" symptom (L213). Exact truncate-vs-drop semantics of a file straddling the cap NOT stated | A:L15, L159, L213 |
| Fallback names | `project_doc_fallback_filenames = ["TEAM_GUIDE.md", ".agents.md"]` example; names not on list ignored for discovery | A:L153, L159 |
| Raise cap example | `project_doc_max_bytes = 65536` in `~/.codex/config.toml` | A:L154 |
| Config reload | Restart Codex / new command after config edit | A:L157, L212 |
| CODEX_HOME | Set to use different profile/home, e.g. `CODEX_HOME=$(pwd)/.codex codex exec ...`; check `echo $CODEX_HOME` on confusion | A:L193-199, L214 |
| Global override use | `~/.codex/AGENTS.override.md` = temporary global override without deleting base | A:L47 |
| Code review | `## Code Review Rules` section in nearest `AGENTS.md` used by Codex GitHub review | A:L124-143 |

### Verify what was loaded
- Ask: `codex --ask-for-approval never "Summarize the current instructions."` (A:L42, L203); nested: `codex --cd subdir ...` (A:L78, L204).
- Audit: `codex -c log_dir=./.codex-log` -> `./.codex-log/codex-tui.log`, or latest `session-*.jsonl` if session logging enabled (A:L205).
- `codex status` reports workspace root (A:L210).

---

## 2. Subagents page (`S`)

### Enablement, invocation, built-ins
| Item | Statement | Cite |
|---|---|---|
| Enabled by default | "Current Codex releases enable subagent workflows by default" (app/CLI/IDE) | S:L25 |
| Config switch | `agents.enabled` default `true`; `false` disables multi-agent tools | S:L373, L381 |
| Invocation | Ask directly ("spawn two agents"); Codex also delegates when applicable `AGENTS.md` or skill instructions request it | S:L45-48, L55-57, L120-121, L125-128 |
| Spawned only on request | Spawns after direct request or applicable project/skill instruction | S:L214-215 |
| CLI UI | `/subagents` switch/inspect threads; approval overlay shows source thread, `o` opens it | S:L57, L265, L305-308 |
| Built-ins | `default` (general fallback), `worker` (execution), `explorer` (read-heavy) | S:L335-339 |
| Cost | More tokens than single-agent runs | S:L30-31, L127-128 |
| Parallel advice | Parallel for read-heavy; careful with write-heavy (conflicts) | S:L95-98 |
| Orchestration | Codex handles spawn, route follow-ups, wait, close; waits for all results then consolidates | S:L198-203 |

### Custom agent files
- Location: `~/.codex/agents/` (personal), `.codex/agents/` (project). Standalone TOML, one agent per file (S:L341-346).
- Name identity: `name` field is source of truth; filename match is only a convention (S:L413-415).
- Capabilities: custom agents can change model settings + instructions or disable supported capabilities; inherit parent's permissions, provider, MCP servers; file cannot override them (S:L345-348).

Field table (S:L350-411):
| Field | Type | Required | Default / note | Cite |
|---|---|---|---|---|
| `name` | string | YES | name used when spawning/referring | S:L351, L391 |
| `description` | string | YES | human-facing guidance on when to use | S:L352, L392 |
| `developer_instructions` | string | YES | core behavior instructions | S:L353, L393 |
| `model` | string | no | file value wins; else spawn value -> `[agents]` default -> parent | S:L356-359 |
| `model_reasoning_effort` | string | no | same resolution; file sets only `model` -> keeps previously resolved effort; if model lacks that effort set it in file | S:L356-364 |
| `model_reasoning_summary` | (see config ref) | no | listed as customizable | S:L395-398 |
| `model_verbosity` | (see config ref) | no | listed as customizable | S:L395-398 |
| `features.shell_tool` / `.apps` / `.plugins` / `.memories` / `.request_permissions_tool` | bool | no | set `false` to reduce capability | S:L400-403 |
| `skills.config` | array of {path, enabled} | no | disable individual skills; example `[[skills.config]] path=..., enabled=false` | S:L364-365, L402-403, L553-556 |
| `skills.bundled.enabled` | bool | no | `false` disables bundled skills | S:L403-404 |
| `skills.include_instructions` | bool | no | `false` omits automatic skills-instructions block | S:L404-405 |
| `sandbox_mode`, `approval_policy`, `model_provider`, `mcp_servers` | - | - | placed in agent file they do NOT override parent; service tier follows root session; configure MCP in parent | S:L407-411 |
| `nickname_candidates` | - | - | NOT mentioned anywhere on page | (absent) |

Managed requirements still apply to agent-file feature reductions (S:L405).

### Global `[agents]` settings
| Key | Type | Default | Cite |
|---|---|---|---|
| `agents.enabled` | bool | `true` | S:L373, L381; C:L819-821 |
| `agents.max_concurrent_threads_per_session` | number | unset -> "Codex chooses the default" (value not given); excludes primary thread | S:L374, L382; C:L824-828 |
| `agents.max_threads` | number | legacy alias of above | S:L382; C:L830-834 |
| `agents.default_subagent_model` | string | none; explicit spawn model wins | S:L375, L383; C:L836-840 |
| `agents.default_subagent_reasoning_effort` | string | none; explicit spawn effort wins | S:L376, L383; C:L842-846 |
| `agents.interrupt_message` | bool | `true`; false omits model-visible interrupt message | S:L377, L384; C:L848-852 |
| `agents.<name>.description` | string | role guidance when choosing agent type | C:L854-858 |
| `agents.<name>.config_file` | string path | TOML config layer for that role; relative path resolves from the config file declaring the role | C:L860-864 |
| `agents` table note | "Scalar setting names are reserved and can't be used as custom role names" | C:L813-817 |
`max_depth`, `job_max_runtime_seconds`: NOT on these pages.

### Inheritance / behavior
- No model/effort configured -> inherits parent model + effort (S:L157-158). Spawn/[agents] default selects model w/o effort -> that model's default effort (S:L158-161, L360-362).
- Subagents inherit sandbox policy (S:L283); app/IDE inherit composer permission mode (S:L298-299, L322-323).
- CLI: inherit parent turn's current sandbox + approval settings incl. `/permissions`, `--yolo`; custom agent file cannot replace (S:L314-316).
- Non-interactive / no fresh approval available: action needing new approval fails, error surfaces to parent (S:L310-312).
- Custom agent instructions can ask to avoid edits but do not create a read-only sandbox (S:L329-332).
- Skills inherit from parent (S:L364). Hooks, `.codex/rules`, AGENTS.md inside subagent: NOT stated on this page (but `SubagentStart`/`SubagentStop` hook events exist, C:L591).
- Name collision with built-in: custom takes precedence (S:L385). Project-vs-user collision, malformed file: NOT stated.
- Batch/CSV fan-out tools: NOT on this page. Multi-agent tool names (`spawn_agent`, `send_input`, `resume_agent`, `wait_agent`, `close_agent`) via `features.multi_agent` (C:L972-975). `sqlite_home` mentions "agent jobs" state DB (C:L346-349).
- Model choice guidance: `gpt-6.1-sol`, `gpt-6-luna` (S:L165, L175-176). Examples use `[agents] max_concurrent_threads_per_session = 8` / `6` in project `.codex/config.toml` (S:L435-440, L501-505).
- Web surface (ChatGPT Work) is hosted, no local sandbox/approval control (S:L289-292); not relevant to file install.

---

## 3. Configuration Reference (`C`)

### 3.1 Layering, trust, project-level restrictions
- User config `~/.codex/config.toml`; project overrides in `.codex/config.toml`; "Codex loads project-scoped config files only when you trust the project" (C:L77).
- Project-local `.codex/config.toml` IGNORED keys: `openai_base_url`, `chatgpt_base_url`, `apps_mcp_product_sku`, `model_provider`, `model_providers`, `notify`, `profile`, `profiles`, `experimental_realtime_ws_base_url`, `otel` (C:L79-86). Put provider/notify/telemetry in user config (C:L85-86).
- `projects.<path>.trust_level` string `"trusted"|"untrusted"`; untrusted projects skip project-scoped `.codex/` layers incl. project-local config, hooks, rules (C:L1972-1975). Project entries with `trust_level="untrusted"` in user config remain supported (C:L93-94).
- Profile files: `$CODEX_HOME/profile-name.config.toml`, select with `--profile name` (C:L86-88). (Note: `profile`/`profiles` keys ignored at project level.)
- Full precedence order (CLI `-c`, profile, project, user, system): NOT on this page; points to Config basics "configuration-precedence" (S:L369). Marketplaces definable in system, cloud-managed, user, trusted-project config (C:L1695). `plugins.<plugin>.enabled`: trusted-project settings override user, cloud-managed, system defaults (C:L1724).
- JSON schema at config-schema.json; `#:schema` header line (C:L2023-2029). `experimental_instructions_file` -> renamed `model_instructions_file`, old key deprecated (C:L2031).

### 3.2 Hooks
| Key | Type | Default/notes | Cite |
|---|---|---|---|
| `features.hooks` | bool | enables lifecycle hooks from `hooks.json` OR inline `[hooks]`; `features.codex_hooks` deprecated alias. DEFAULT NOT STATED | C:L521-526 |
| `hooks` | table | inline hooks in `config.toml`, same event schema as `hooks.json` | C:L581-586 |
| `hooks.<Event>` | array<table> | matcher groups; events: `PreModelRequest`, `PostModelRequest`, `PreToolUse`, `PermissionRequest`, `PostToolUse`, `PreCompact`, `PostCompact`, `SessionStart`, `SessionEnd`, `SubagentStart`, `SubagentStop`, `UserPromptSubmit`, `Stop`, `Interrupt` | C:L587-592 |
| `hooks.<Event>[].hooks` | array<table> | handlers; command + MCP tool hooks supported; prompt and agent handlers parsed but SKIPPED | C:L594-598 |
| `...hooks[].async` | bool | default `false`; `SessionEnd` always sync | C:L600-604 |
| `...hooks[].additionalContextLimit` | int | default `2500`; `0` = pass full | C:L606-610 |
| `...hooks[].commandWindows` | string | Windows-only override; alias `command_windows` | C:L612-616 |
- `hooks.json` location, file schema, merge rule between `hooks.json` and inline `[hooks]`: NOT on these pages (defers to "Hooks guide", C:L585).
- Requirements side: `hooks.managed_dir` (abs path, mac/Linux, must exist), `hooks.windows_managed_dir`, same `hooks.<Event>` schema (C:L3040-3086; Event list there omits `Interrupt`, C:L3061). `allow_managed_hooks_only` bool: when true skips user, project, session, plugin hooks; managed still run (C:L2396-2399).
- Work Cloud: command/local-config/plugin hooks unsupported with cloud orchestration; only MCP managed hooks on coordinator; local-only threads keep existing hooks (C:L21).

### 3.3 Features (kit-relevant)
| Key | Meaning/default | Cite |
|---|---|---|
| `features.hooks` | see 3.2 | C:L521 |
| `features.multi_agent` | enables `spawn_agent` etc.; stable, on by default | C:L972-975 |
| `features.memories` | Memories; OFF by default | C:L617-621 |
| `features.shell_tool` | stable, on by default | C:L1089-1091 |
| `features.apps` | stable, on by default | C:L516-519 |
| `features.skill_mcp_dependency_install` | stable, on by default | C:L1100-1103 |
| `features.network_proxy` | bool\|table; experimental, off; `.enabled` default false | C:L1001-1010 |
| `features.unified_exec`, `view_image`, `shell_snapshot`, `goals`, `remote_plugin`, `fast_mode`, `ultrafast_mode`, `prefer_mxc`, `prevent_idle_sleep`, `code_mode.*`, `rollout_budget.*`, `context_management.experimental_mode`, `personality`(removed), `web_search*`(deprecated) | exist, read; not kit-relevant | C:L948-1127 |
- `features.request_permissions_tool`, `features.plugins` appear only on subagent page / requirements (S:L402; C:L2544).
- Rules-related feature flag, execpolicy keys in config.toml: no `[rules]` table in config.toml section; `.rules` files referenced only via requirements (`rules` merged "with `.rules` files", C:L3307-3310). `.codex/rules` file format/location NOT on these pages.

### 3.4 Skills
| Key | Type | Default | Cite |
|---|---|---|---|
| `skills.bundled.enabled` | bool | `true`; false in trusted project config disables bundled skills | C:L381-385 |
| `skills.include_instructions` | bool | `true` | C:L387-390 |
| `skills.max_context_tokens` | int>0 | 2% of model context window; explicit capped at `10000` | C:L393-397 |
| `skills.config` | array<object> | enable/disable by name or path; last matching rule wins | C:L399-403 |
| `skills.config.<i>.path` | abs path to one `SKILL.md` | - | C:L405-408 |
| `skills.config.<i>.name` | string | match all skills with exact name; specify `name` OR `path` per entry | C:L410-414 |
| `skills.config.<i>.enabled` | bool | - | C:L416-419 |
- No key for skill SCAN directories or repo/user/admin precedence (`.agents/skills/` not mentioned on these pages). `.agents/plugins/marketplace.json` for local marketplace root (C:L1701).

### 3.5 Instructions / project docs
| Key | Type | Default | Cite |
|---|---|---|---|
| `project_doc_max_bytes` | number | "max bytes read from AGENTS.md"; default 32 KiB stated on AGENTS page | C:L1376-1381; A:L15 |
| `project_doc_fallback_filenames` | array<string> | extra names when `AGENTS.md` missing | C:L1383-1386 |
| `project_root_markers` | array<string> | root marker filenames for parent search; default NOT stated | C:L1371-1375 |
| `developer_instructions` | string | extra developer instructions injected | C:L334-338 |
| `instructions` | string | reserved for future; prefer `model_instructions_file` or AGENTS.md | C:L328-332 |
| `model_instructions_file` | path | replacement for built-in instructions instead of `AGENTS.md` | C:L357-361 |
| `compact_prompt` / `experimental_compact_prompt_file` | string / path | compaction prompt | C:L352-355, L375-379 |

### 3.6 Approvals, sandbox, permissions
- `approval_policy`: `on-request | never | { granular = { sandbox_approval, rules, mcp_elicitations, request_permissions, skill_approval } (bools) }`. `untrusted` UNSUPPORTED (explicit setting rejected as retired); `on-failure` deprecated; use `on-request` interactive, `never` non-interactive (C:L161-195, L92-94). Default NOT stated.
- `approvals_reviewer` `user | auto_review`, default `user` (C:L197-201). `auto_review.policy` string (C:L203-207).
- `sandbox_mode`: `read-only | workspace-write | danger-full-access`; default NOT stated (C:L221-225).
- `[sandbox_workspace_write]`: `writable_roots` array<string>; `network_access` bool; `exclude_tmpdir_env_var` bool; `exclude_slash_tmp` bool (C:L227-249).
- `default_permissions` string: built-ins `:read-only`, `:workspace`, `:danger-full-access`; custom needs `[permissions.<name>]`; "Don't combine with `sandbox_mode` or `[sandbox_workspace_write]`" (C:L1837-1841).
- `permissions.<name>`: `description`, `extends` (named/`:read-only`/`:workspace`; not `:danger-full-access`), `workspace_roots`, `filesystem` (path/glob -> read|write|deny; `glob_scan_max_depth`; `":workspace_roots"` subpaths), `network.*` (enabled, proxy_url, enable_socks5, socks_url, enable_socks5_udp, allow_upstream_proxy, dangerously_*, mode limited|full, domains, unix_sockets, allow_local_binding) (C:L1843-1970). Permission profiles = "beta" (C:L90).
- `allow_login_shell` default true (C:L209-213). `windows.sandbox` `mxc|elevated|unelevated` (C:L251-255).
- `shell_environment_policy`: `inherit` all|core|none; `ignore_default_excludes` bool (default `true`: keeps KEY/SECRET/TOKEN vars before filters); `filters` map include|exclude; legacy `exclude`, `include_only` (don't mix with `filters` in same layer); `set` map; `experimental_use_profile` bool (C:L1330-1369).

### 3.7 MCP servers `[mcp_servers.<id>]` (compact, C:L629-811)
Transport: `command`, `args`, `env`, `env_vars`, `cwd` (stdio); `url`, `auth` (oauth|chatgpt), `oauth.{client_id,client_secret,callback_url,callback_port}`, `bearer_token_env_var`, `http_headers`, `http_headers_helper`, `env_http_headers` (HTTP). Control: `enabled`, `required`, `startup_readiness` (connection|catalog), `startup_timeout_sec` (default 10s), `startup_timeout_ms`, `tool_timeout_sec` (default 60s), `enabled_tools`, `disabled_tools`, `supports_parallel_tool_calls` (false), `tool_input_schema_max_bytes` (5000), `omit_tools_from` (direct|deferred|code_mode), `default_tools_approval_mode` (auto|prompt|writes|approve), `tools.<tool>.approval_mode`, `tools.<tool>.output_token_limit`, `scopes`, `oauth_resource`, `environment_id` (default `local`). Global: `mcp_optional_startup_grace_ms` default 1000 (C:L624-628).

### 3.8 Other kit-relevant keys
- `notify` array<string>: command invoked for notifications, receives JSON payload; IGNORED at project level (C:L304-308, L82-85).
- `profiles` / `profile`: ignored at project level; profile files `$CODEX_HOME/<name>.config.toml` (C:L82-88).
- `[memories]`: `version` v1|v2 (default v2 fresh home, v1 if `$CODEX_HOME/memories/` exists), `dual_write`, `generate_memories` (true), `use_memories` (true), `disable_on_external_context` (false), `max_raw_memories_for_consolidation` 256 (cap 4096), `max_unused_days` 30 (0-365), `max_rollout_age_days` 30 (0-90), `max_rollouts_per_startup` 16 (cap 128), `min_rollout_idle_hours` 6 (1-48), `min_rate_limit_remaining_percent` 25 (0-100), `extract_model`, `consolidation_model`, `consolidation_service_tier` (C:L866-946). Enabled by `features.memories` (off by default).
- `log_dir` default `$CODEX_HOME/log`; setting explicitly enables `codex-tui.log` (C:L340-344).

### 3.9 Everything else (existence only, read)
Model/provider: `model`, `review_model`, `model_provider`, `model_providers.*` (incl. gcp, amazon-bedrock), `model_context_window`, compaction keys, `model_reasoning_effort/summary`, `model_verbosity`, `service_tier`, `personality`(deprecated), `oss_provider` (C:L104-166, L1130-1328). Browser/computer: `browser_use.*`, `computer_use.*` (C:L257-302). Updates/telemetry: `check_for_update_on_startup`, `feedback`, `analytics`, `otel.*` (C:L309-326, L1423-1541). `apps.*`, `tool_suggest.*` (C:L420-514). `tui.*`, `desktop.custom_file_handlers.*`, `file_opener`, `history.*`, `tool_output_token_limit`, `thread_unload_delay_secs` (60), `background_terminal_max_timeout` (300000) (C:L1387-1422, L1542-1790). `marketplaces.*`, `plugins.*` (C:L1691-1755). `web_search` (default cached), `tools.web_search` (C:L1825-1835). `goals.max_goal_token_budget` (C:L983-988). Auth: `cli_auth_credentials_store`, `mcp_oauth_*`, `forced_login_method`, `forced_chatgpt_workspace_id` (C:L1796-1817, L2009-2018). `notice.*` (acknowledgement tracking, C:L1977-2008). `allow_symlinked_codex_home` default false (C:L214-219). `sqlite_home` (C:L345-349). `suppress_unstable_features_warning` (C:L1123-1128). `hide_agent_reasoning`, `show_raw_agent_reasoning` (C:L1773-1783).

### 3.10 Work Cloud preamble (C:L7-73)
Table of how settings behave under "Local computer access with Work Cloud": managed hooks, rules, MCP, plugins stay Global; precedence for local execution = MDM/legacy managed-device > Agent Security > device system requirements file (C:L58-60). Not relevant to file install except as managed-override context.

---

## 4. `requirements.toml` (C:L2033-3346)

Admin-enforced; users cannot override (C:L2035, L2045-2047). Omitted keys unconstrained (C:L2043). `[features]` in requirements pins flags by same canonical keys (C:L2040-2041). Codex 0.138.0+ needed for `allowed_permission_profiles`/managed `default_permissions` (C:L2049-2051).

Constraints that could block/override a kit install:
| Key | Effect | Cite |
|---|---|---|
| `allowed_approval_policies` | allowlist (`on-request`, `never`, `granular`; `untrusted` only permits derived stricter policy) | C:L2220-2224, L2057-2060 |
| `allowed_sandbox_modes` | allowlist for `sandbox_mode`; `remote_sandbox_config[]` per-hostname override (first match wins) | C:L2344-2347, L2372-2388 |
| `allowed_permission_profiles.<name>` / `default_permissions` | bool table; omitted/false = denied; default `:workspace` only if both `:workspace` and `:read-only` explicitly allowed | C:L2261-2277 |
| `allowed_web_search_modes` | disabled always allowed | C:L2390-2394 |
| `allowed_approvals_reviewers`, `guardian_policy_config`, `auto_review.required_on_models`/`ignore_rules` | reviewer constraints; `ignore_rules` makes Codex ignore `allow` prefix rules for listed model slugs | C:L2226-2259 |
| `additional_developer_instructions` | managed developer message, max 10,000 est. tokens | C:L2238-2242 |
| `allow_managed_hooks_only` | when true skips user/project/session/plugin hooks, keeps managed | C:L2396-2399 |
| `hooks.managed_dir` / `windows_managed_dir` + `hooks.<Event>` | managed hooks | C:L3040-3086 |
| `features.<name>` | pins flags e.g. `multi_agent`, `memories`, `plugins`, `apps`, `guardian_approval` | C:L2426-2436, L2533-2546 |
| `mcp_servers.<id>.identity` (command string/matcher or url matcher) | MCP allowlist: server name AND identity must match; unlisted servers DISABLED | C:L3094-3159 |
| `plugins.<plugin>.mcp_servers...` | plugin-bundled MCP allowlist; present table disables unmatched | C:L3162-3233 |
| `marketplaces.restrict_to_allowed_sources` + `allowed_sources` | marketplace allowlist | C:L3236-3287 |
| `rules.prefix_rules[]` (`pattern[]` token/any_of, `decision` prompt\|forbidden only, `justification`) | restrictive command rules merged with `.rules` files; cannot `allow` | C:L3306-3345 |
| `permissions.<name>`, `permissions.filesystem.deny_read` | admin profiles; deny_read not weakenable by local config | C:L2337-2342, L3088-3091 |
| `network_proxy` (alias `experimental_network`) `enabled, http_port, socks_port, domains, allowed_domains, denied_domains, managed_allowed_domains_only, unix_sockets, allow_local_binding, review_domains...` | managed command-network policy; can start proxy without `features.network_proxy` | C:L2944-3038 |
| `apps.<id>.enabled`, `apps.<id>.tools.<tool>.approval_mode` | managed apps | C:L3290-3304 |
| `models.new_thread.{model,model_reasoning_effort,service_tier}` | defaults not enforcement; ignored if user overrides via `--model`/`--config`/`--profile` | C:L2062-2065, L2308-2330 |
| Enforced exact values: `sqlite_home`, `log_dir`, `model_catalog_json`, `check_for_update_on_startup`, `allow_login_shell`, `model_provider`, `model_providers`, `cli_auth_credentials_store`, `chatgpt_base_url`, `feedback.enabled`, `enforce_residency`, `allowed_login_methods`, `allowed_chatgpt_workspaces` | user cannot override | C:L2135-2218, L2279-2295 |
| `config_server.*` | enroll with config server (HTTPS base_url + `/codex/config/bundle`); only from local requirements | C:L2081-2132, L2167-2183 |
| Browser/computer/app/otel/windows: `browser_use.*`, `computer_use.*`, `in_app_browser`, `application.*`, `otel.*`, `windows.*` | read; not kit-relevant | C:L2349-2370, L2567-2942 |

---

## Answers to open questions
1. Project `.codex/config.toml` loads only when project trusted (C:L77); untrusted projects skip project `.codex/` layers incl. config, hooks, rules (C:L1975). Ignored at project level: `openai_base_url`, `chatgpt_base_url`, `apps_mcp_product_sku`, `model_provider`, `model_providers`, `notify`, `profile`, `profiles`, `experimental_realtime_ws_base_url`, `otel` (C:L82-86).
2. Yes: inline `[hooks]` in `config.toml` using same schema as `hooks.json` (C:L581-586). Gate: `features.hooks` ("hooks loaded from `hooks.json` or inline `[hooks]`"; `features.codex_hooks` deprecated alias) (C:L521-526). Default NOT stated. How the two sources combine NOT stated.
3. Required fields: `name`, `description`, `developer_instructions` (S:L350-354, L389-393). Name from `name` key, filename only convention (S:L413-415). Custom vs built-in name collision: custom wins (S:L385). Project-vs-user collision and malformed-file behavior NOT stated.
4. Not stated for hooks or `.codex/rules`. Stated: skills inherit (S:L364); sandbox/approval/provider/MCP inherited, not overridable (S:L314-316, L345-348). Hook events `SubagentStart`/`SubagentStop` exist (C:L591).
5. Default 32 KiB (`project_doc_max_bytes`) (A:L15). Past cap: "stops adding files once combined size reaches the limit" (A:L15); also described as "truncation" (A:L159, L213). Whether a straddling file is cut or dropped NOT stated.
6. No. Only `skills.config` enable/disable by path/name (last match wins) and `skills.bundled.enabled`, `skills.include_instructions`, `skills.max_context_tokens` (C:L381-419). No scan-dir key, no repo/user/admin precedence.

## Not stated
- `hooks.json` path/schema/merge with inline hooks; `features.hooks` default; `.codex/rules` format/location, execpolicy `.rules` syntax; whether hooks/rules/AGENTS.md apply inside subagents.
- Skill discovery dirs (`.agents/skills`) and precedence; `[agents] max_depth`, `job_max_runtime_seconds`, default thread cap value; CSV/batch fan-out; `nickname_candidates`.
- Project-vs-user agent name collision; malformed agent TOML behavior; `agents.<name>` role entry vs `.codex/agents/*.toml` relationship; `config_file` relative-path semantics beyond "from declaring config file" (C:L863).
- Layer precedence order (CLI `-c`, profile, project, user, system); defaults for `approval_policy`, `sandbox_mode`, `project_root_markers`.
- How a file straddling the AGENTS.md cap is handled; whether `project_doc_max_bytes` applies to global file.
- Global (`~/.codex/`) variant of project-trust/hook handling beyond trust statement.

## Anomalies
- No text addressing an AI/agent as an instruction found. Page footers link llms.txt index (A:L3, S:L3, C:L3); example prompts (S:L135, L222, L493, L560) are user-prompt samples, not actions for the reader.
- AGENTS rebuild timing wording inconsistent: "once per run" (A:L9) vs "on every run and at start of each TUI session" (A:L206).
- Truncation wording inconsistent: "stops adding files" (A:L15) vs "truncation" (A:L159, L213).
- `config_server` entries duplicated with differing descriptions in requirements table (C:L2081-2132 vs L2167-2183).
- `hooks.<Event>` event list in config.toml includes `Interrupt` (C:L591); requirements list omits it (C:L3061).
- `agents.<name>.*` role declarations (C:L853-864) exist alongside `.codex/agents/*.toml` files (S:L341-346); relationship not explained. Subagent page says agent file is "standalone" (S:L341, L350).
- Docs use model names `gpt-6.1-sol`, `gpt-6-luna`, `GPT-6 Astra` (S:L165-181); unverifiable here; `config.toml` `model_verbosity` says "GPT-5 Responses API" (C:L1327).
- `project_doc_max_bytes` description omits default; default only on AGENTS page (C:L1377-1381 vs A:L15).
- Subagent page section structure uses `ContentModeSwitch` tags: text for app/cli/ide mixed with web; "Custom agents" section sits inside an app/cli/ide-only block (S:L327-564), so custom agents documented for local clients only.

## Audit checkpoints
1. Project AGENTS.md: one file per dir wins; `AGENTS.override.md` in same dir shadows `AGENTS.md` (A:L12, L104-111). Kit must not leave an override in a dir expecting `AGENTS.md` to load.
2. Combined AGENTS.md chain (global + root..cwd) must stay under `project_doc_max_bytes` (32 KiB default) or later/deeper files may be cut (A:L15); check whether kit raises it and writes it only in user/trusted config (C:L1377).
3. Non-`AGENTS.md` instruction filenames only count if listed in `project_doc_fallback_filenames` (A:L159).
4. Empty instruction files are skipped; a global `AGENTS.override.md` that is empty falls through to `AGENTS.md` (A:L11, L15).
5. Global install target is `CODEX_HOME` (default `~/.codex`); verify installer honors `CODEX_HOME` (A:L11, L193).
6. Agent TOML (`.codex/agents/*.toml`, `~/.codex/agents/*.toml`) must define `name`, `description`, `developer_instructions` as strings (S:L350-354, L389-393).
7. Agent `name` value, not filename, identifies the agent; check no two files share a `name` (collision behavior undefined) (S:L413-415).
8. Agent files setting `sandbox_mode`, `approval_policy`, `model_provider`, `mcp_servers` have no effect on the parent; do not rely on them for isolation/read-only (S:L407-411, L329-332, L314-316).
9. Agent `model`/`model_reasoning_effort` must be valid for the user's account/model; if only `model` set, effort inherited from earlier resolution (S:L356-364).
10. Agent files naming a built-in (`default`, `worker`, `explorer`) override it (S:L385).
11. Agent-level capability reduction only via `features.{shell_tool,apps,plugins,memories,request_permissions_tool}=false`, `skills.config`, `skills.bundled.enabled`, `skills.include_instructions` (S:L400-405); `[[skills.config]]` needs `path` (abs `SKILL.md`) or `name`, plus `enabled` (C:L405-419).
12. `[agents]` keys: `enabled`, `max_concurrent_threads_per_session` (or legacy `max_threads`), `default_subagent_model`, `default_subagent_reasoning_effort`, `interrupt_message`; custom role names `agents.<name>` must not collide with those scalar names (C:L813-852).
13. `[agents.<name>]` entries: `description` string, `config_file` path relative to declaring config file (C:L853-864); a global `~/.codex/config.toml` should use paths that resolve from `~/.codex/`.
14. Hooks may live in `hooks.json` and/or inline `[hooks]`, gated by `features.hooks` (alias `codex_hooks` deprecated); verify the kit enables it and uses the non-deprecated name (C:L521-526).
15. Hook handlers: only `command` and MCP-tool types execute; `prompt`/`agent` handler types are parsed but skipped (C:L594-598).
16. Hook event names must be from the documented list (C:L591); `commandWindows`/`command_windows` for Windows overrides (C:L612-616).
17. `allow_managed_hooks_only=true` in requirements disables user/project/session/plugin hooks, so kit hooks silently do nothing under it (C:L2396-2399).
18. Project `.codex/` (config, hooks, rules) load only for trusted projects; kit-installed project files are inert if `projects."<path>".trust_level` is `"untrusted"`/unset-untrusted (C:L77, L1975).
19. Project `.codex/config.toml` must not contain `notify`, `profile(s)`, `model_provider(s)`, `otel`, `openai_base_url`, `chatgpt_base_url`, `apps_mcp_product_sku`, `experimental_realtime_ws_base_url` (ignored) (C:L82-86); these belong in `~/.codex/config.toml`.
20. `approval_policy` must not be `untrusted`; `on-failure` deprecated; valid: `on-request`, `never`, granular table with 5 bool keys (C:L92-93, L161-195).
21. `sandbox_mode` in {`read-only`,`workspace-write`,`danger-full-access`}; do not combine `default_permissions` with `sandbox_mode`/`[sandbox_workspace_write]` (C:L221-225, L1840).
22. `[sandbox_workspace_write]` keys limited to `writable_roots`, `network_access`, `exclude_tmpdir_env_var`, `exclude_slash_tmp` (C:L227-249).
23. `skills.config` last-match-wins; do not set both `name` and `path` ambiguity: "either name or path" per entry (C:L402, L413).
24. `shell_environment_policy`: do not mix `filters` with legacy `exclude`/`include_only` in the same layer (C:L1345, L1351, L1357).
25. `mcp_servers.<id>` fields must be from the documented list (3.7); under managed `mcp_servers` requirements any server not matching name+identity is disabled (C:L3097).
26. `developer_instructions` (config) is a string; `instructions` reserved/unused; `model_instructions_file` REPLACES built-in instructions (C:L328-338, L357-361).
27. `experimental_instructions_file` is deprecated -> `model_instructions_file` (C:L2031).
28. Memories: `features.memories` off by default; `memories.*` keys valid only with documented names (C:L617-621, L866-946).
29. Requirements `rules.prefix_rules[].decision` may only be `prompt` or `forbidden` (C:L3335-3338).
30. Merge behavior when kit edits existing `config.toml`: `.codex/config.toml` for project, `~/.codex/config.toml` for user (C:L77); keys of other tools (e.g. `notice.*`, `projects.*` trust entries) are written by Codex itself and should be preserved (C:L1972-2008).
