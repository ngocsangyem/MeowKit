# D10 — Host capability matrix (what a third-party toolkit can ENFORCE and OBSERVE)

Verified 2026-11-15. Host features change monthly; every row is dated to this session. Claude Code and Cursor are closed source: DOCUMENTED only (no reverse engineering). Codex, Gemini CLI, OpenCode, Pi, Goose, Aider: source cloned shallow and read (not executed).

## 1. Scope & coverage inventory

**Sources (S-ids used in tables).**

| Id | Source | Fetched | Coverage / caveat |
| --- | --- | --- | --- |
| S1 | https://code.claude.com/docs/en/hooks | 2026-11-15 | chars 0–200000 of 293529 read (summarised by fetch tool); Stop / SubagentStart payload sections NOT read |
| S2 | .../en/permissions | same | read in full via saved copy + grep |
| S3 | .../en/sandboxing | same | first 100000 of 110890 chars |
| S4 | .../en/settings | same | read in full |
| S5 | .../en/sub-agents | same | first 100000 of 116580 |
| S6 | .../en/skills | same | first 100000 of 119740 (listing-budget section NOT read) |
| S7 | .../en/memory | same | grep of saved copy |
| S8 | .../en/monitoring-usage | same | first 100000 of 176572 (events after `tool_decision` incl. compaction/subagent NOT read) |
| S9 | .../en/headless | same | read in full |
| S10 | .../en/cli-reference | same | grep of flag rows only |
| S11 | .../en/plugins-reference (manifest) | same | read in full |
| S12 | .../en/permission-modes | same | first 100000 of 120324 |
| S13 | .../en/commands | same | grep of 22 command rows |
| S14 | .../en/plugin-evals | same | grep only |
| S15 | .../en/sessions | same | read in full |
| C | github.com/openai/codex @ `81b995a6c9a4c978f399775cfa5ce50702368749` (2026-11-14), Apache-2.0 | | read `codex-rs/{hooks,protocol,otel,exec,agent-roles,config,memories}`; docs via learn.chatgpt.com/docs/{hooks,security} (security page had no sandbox content) |
| CU | cursor.com/docs/{hooks,context/rules,subagents,skills,cli/headless,agent/terminal} | same | docs only; sandbox/permissions/OTel pages NOT retrieved |
| G | github.com/google-gemini/gemini-cli @ `4ed06ed0ddc523a6d356a4ad35ddfea331041888` (2026-11-13, v0.70.0-nightly), Apache-2.0 | | read `docs/hooks`, `docs/cli/{sandbox,telemetry,cli-reference,gemini-md}`, `docs/reference/policy-engine.md`, `packages/core/src/hooks/types.ts` |
| O | github.com/sst/opencode @ `1fa50dd28cc860768fd89180cf40b2fb912b2813` (2026-11-14), MIT | | read `packages/core/src/{plugin/hooks,permission,managed-policy}.ts`, `packages/plugin/src/effect/*`; **no user docs in clone** |
| P | github.com/badlogic/pi-mono @ `f6df849c4ac3d89d68d227f73264de768232446c` (2026-11-14), MIT; pkg `@earendil-works/pi-coding-agent` 1.5.2 | | read `packages/coding-agent/{src/core/tools,system-prompt.ts,docs/*}`; plus author post https://mariozechner.at/posts/2025-11-30-pi-coding-agent/ |
| Go | github.com/block/goose @ `2365bc5e898a38133c373eef2d1357416acd66e2` (2026-11-13), Apache-2.0 | | read `documentation/docs/guides/**` only; Rust source NOT read |
| A | github.com/Aider-AI/aider @ `5dc9490bb35f9729ef2c95d00a19ccd30c26339c` (2026-05-22 — oldest of the set), Apache-2.0 | | grep of `aider/*.py`, `args.py` |

**Not done:** no host was executed (no behaviour reproduced; "VERIFIED" below = read in cloned source or read in a cloned doc file, never run). Qwen/Hermes/DeepSeek skipped per brief. Cursor sandbox, permission-file syntax, OTel, and CLI eval flags not retrieved. Goose/OpenCode Rust/TS enforcement paths not traced (docs/types only). Codex `AGENTS.md`/skills discovery precedence not read from source (only constants).

Labels: V=VERIFIED (cloned source/doc), D=DOCUMENTED (vendor docs, closed source), I=INFERRED, U=UNKNOWN.

## 2. Matrices

### A. Extension surfaces

| Surface | Claude Code | Codex CLI | Cursor | Gemini CLI | OpenCode | Pi | Goose | Aider |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Instruction file | CLAUDE.md; `AGENTS.md` read only when no CLAUDE.md/CLAUDE.local.md exists (v2.1.277+), unless `instructionFiles` set (D S7) | `AGENTS.md` (`AGENTS.override.md` exists in tests) (V core/src/agents_md.rs:43, core/tests/suite/agents_md.rs:79) | `.cursor/rules/*.mdc`, `AGENTS.md` root+nested (D CU rules) | `GEMINI.md` hierarchy (V docs/cli/gemini-md.md) | `AGENTS.md` discovery (V core/src/instance.ts:135) | `AGENTS.md`/`CLAUDE.md`, `AGENTS.override.md` same-dir (V docs/configuration.md:18,45) | `.goosehints` (V using-goosehints.md) | none; `--read` files (V args.py:736) |
| Precedence | managed policy → user → project → local; concatenated root→cwd, later = more specific; nested lazily; managed CLAUDE.md not excludable (D S7) | U (not read) | Team → Project → User, earlier wins on conflict (D) | global → workspace → JIT subdir (D) | U | U | global + local hints (D) | n/a |
| Rules w/ path scope | `.claude/rules/` with `paths:` (D S7) | U | `.mdc` globs/alwaysApply/agent-requested (D) | n/a | U | n/a | n/a | n/a |
| Skills (SKILL.md) | yes; enterprise > personal > project; plugin namespaced; `disable-model-invocation`, `user-invocable`, `paths`, `context: fork`; listing cap 1,536 chars/skill desc (D S6); budget section U | yes (`codex-rs/skills`); telemetry `codex.thread.skills.*truncated` implies a listing budget (V otel names) | yes; `.agents/skills`, `.cursor/skills`, + `.claude/.codex` compat; `disable-model-invocation` (D) | yes (docs/cli/skills.md) | yes (core/src/skill/discovery.ts); paths U | yes (docs/skills.md) | yes (using-skills.md) | no |
| Custom subagents | md+YAML; tools allow/deny, model, permissionMode, hooks, maxTurns, memory, isolation:worktree; precedence managed > `--agents` > project > user > plugin; nesting default 3 deep (`CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH`) (D S5) | TOML roles in `<config>/agents/*.toml` (V agent-roles/src/loader.rs:78); `agents.max_depth`/`max_threads` (V config_toml.rs:779-783) | md; reads `.cursor/.claude/.codex/agents`; `readonly`, `is_background`, model; nesting 1 level (D) | md subagents exposed as tools (D docs/core/subagents.md) | `agent.ts` (V); format U | **none by design** (author post) | subagents/recipes (docs) | none |
| Slash commands | merged into skills (D S6) | yes (`docs/slash_commands.md`) | yes | custom commands (docs) | `command.ts` (V) | prompt templates | slash_commands | built-in only |
| Plugins/marketplaces | plugin.json: skills/agents/hooks/MCP/LSP/monitors/bin; marketplaces; managed `enabledPlugins` (D S11) | plugins + marketplace (V core-plugins) | plugins (hooks run after others) (D) | extensions | plugin API (TS, in-process) (V) | packages/extensions (V docs/packages.md) | plugins `~/.agents/plugins` (Open Plugins spec) (D) | none |
| MCP | yes | yes | yes | yes | yes | yes (docs/mcp.md exists in 2026 — see Contradictions) | yes | no (U) |
| Output style / status line | both | TUI | n/a | themes | TUI | themes | n/a | n/a |

### B. Hook / lifecycle events

| | Claude Code | Codex | Cursor | Gemini | OpenCode | Pi | Goose | Aider |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Mechanism | out-of-process cmd/http/mcp_tool/prompt/agent (D S1) | out-of-process cmd + MCP-tool; `prompt`/`agent` types **skipped** (D learn.chatgpt.com/docs/hooks) | cmd + prompt hooks (D) | cmd (V docs/hooks) | **in-process TS** plugin hooks (V) | **in-process TS** extension events (V docs/extensions.md) | cmd, Open Plugins spec (D) | **none** (V: no hook code) |
| Events | SessionStart/End, Setup, UserPromptSubmit/Expansion, Stop/StopFailure, PreToolUse, PermissionRequest/Denied, PostToolUse/Failure/Batch, SubagentStart/Stop, TaskCreated/Completed, TeammateIdle, ConfigChange, InstructionsLoaded, Cwd/File/Directory changed, WorktreeCreate/Remove, Pre/PostCompact, Pre/PostModelSwitch, Notification, MessageDisplay, Elicitation(+Result) (D S1) | PreToolUse, PermissionRequest, PostToolUse, Pre/PostCompact, SessionStart/End, UserPromptSubmit, SubagentStart/Stop, Stop, Interrupt, Pre/PostModelRequest (V protocol/src/protocol.rs:1828-1843) | sessionStart/End, preToolUse, postToolUse(+Failure), subagentStart/Stop, beforeShellExecution, afterShellExecution, beforeMCPExecution, beforeReadFile, afterFileEdit, beforeSubmitPrompt, preCompact, stop, afterAgentResponse/Thought (D) | BeforeTool, AfterTool, BeforeAgent, AfterAgent, Notification, SessionStart/End, PreCompress, BeforeModel, AfterModel, BeforeToolSelection (V hooks/types.ts:43-55) | tool `execute.before/after`, shell `create.before`, permission `evaluate`, session, aisdk hooks (V plugin/src/effect/*) | session_start, tool_call (can block), tool_result (can modify), input, context, session_before_{switch,fork,compact,tree}, project_trust, resources_discover… (V docs/extensions.md) | SessionStart/End, Stop, UserPromptSubmit, PreToolUse, PreToolUseResult, PostToolUse(+Failure), BeforeReadFile, AfterFileEdit, Before/AfterShellExecution (D hooks.md:135-153) | – |
| Can block | PreToolUse, UserPromptSubmit, Stop, SubagentStop, PreCompact, TaskCreated/Completed, PreModelSwitch, … ; **cannot**: PostToolUse, SessionStart, SubagentStart, PermissionRequest(uses decision obj) (D S1) | PreToolUse (deny), PermissionRequest, UserPromptSubmit, Stop; `PostToolUse` replaces result; Pre/PostModelRequest diagnostic only (D) | permission hooks (beforeShell/MCP/ReadFile/preToolUse deny; `ask` not enforced on preToolUse), beforeSubmitPrompt (D) | BeforeTool, BeforeAgent, BeforeModel, AfterModel (exit 2) (V reference.md:104-240) | tool `execute.before` only — "Only tool execute.before may fail" (V core/src/plugin/hooks.ts:23) | `tool_call` (D docs/extensions.md:82) | PreToolUse, Stop only (D hooks.md:244) | – |
| Modify tool input | `updatedInput` (PreToolUse) (D S1) | `updatedInput` only with `permissionDecision:allow`; "allow" w/o it and "ask" are **rejected as unsupported** → status Failed (V hooks/src/events/pre_tool_use.rs:485,602) | `updated_input` (D) | BeforeTool input rewrite (I; fields not read) | via hook event object (I) | `tool_result` chain-modifiable (V) | U | – |
| Inject context | `additionalContext` on 11 events, 10,000-char cap (D S1) | `additionalContext` on SessionStart/PreToolUse/PostToolUse/UserPromptSubmit/SubagentStart; large output spilled to disk (D) | sessionStart/postToolUse etc. (D) | BeforeAgent etc. (D) | I | `before_agent_start`, `context` (V) | U | – |
| Payload | session_id, prompt_id, transcript_path, cwd, permission_mode, effort, agent_id/type, tool_*; `model` only on SessionStart (optional); no token usage field seen (D S1) | session_id, transcript_path, cwd, hook_event_name, **model**, turn_id, tool_*, permission_mode (D) | conversation_id, generation_id, model, cursor_version, workspace_roots, user_email, transcript_path (D) | JSON stdin; env `GEMINI_PROJECT_DIR` + alias `CLAUDE_PROJECT_DIR` (D hooks/index.md:140-144) | typed objects incl. sessionID, agent, model.providerID (V) | typed ctx | session_id, tool_call_id (D hooks.md:167-174) | – |
| Failure semantics | **fail-open default**: exit≠0/≠2, crash, timeout proceed; `onFailure:"block"` (command/http; v2.1.295+) makes failure block; **not** for Stop/SubagentStop/TaskCompleted/TeammateIdle/async (D S1). Timeout 600s cmd, 30s prompt, 60s agent; UserPromptSubmit 30s; SessionEnd 1.5s total | exit 2 blocks if stderr non-empty, else status Failed (V pre_tool_use.rs:268-283); other exit → Failed, no block (V :285); timeout default 600s, SessionEnd/Interrupt 1s (V discovery.rs:968, session_end.rs:20); **managed/system hooks fail-closed on unknown attribution** (V engine/mod.rs:189) | fail-open default; `failClosed:true` per hook; permission hooks block on invalid JSON/schema regardless (D) | exit ≠0,≠2 = warning, continue (V reference.md:13-14); timeout default 60000 ms | `execute.before` failure rejects call; other hooks cannot fail (V) | I | `on_failure: allow` (default) \| `block` for PreToolUse only; timeout 30s default (D hooks.md:126-127) | – |
| Combining | matching hooks **parallel**; identical handler dedup'd across files; precedence deny > defer > ask > allow; exit 2 beats allow rules; hooks never override deny rules (D S1,S2:635-659) | N async cap 8 concurrent (V command_runner.rs:54); combine rule not read | deny > ask > allow; messages concatenated; last wins for other fields; order Enterprise > Team > Project > User > plugin (D) | U | callbacks per event (V) | chained (D :420) | PreToolUse chain; `PreToolUseResult` observation (D) | – |
| In subagents | yes: settings/managed/plugin hooks fire with agent_id; frontmatter hooks scoped (D S1) | SubagentStart/Stop events; tool hooks inherited U | subagentStart can block; hooks "can block" nested launches (D) | U | U | n/a (no subagents) | U | – |
| Headless/SDK/IDE/cloud | `-p` runs project hooks **even in untrusted folder**; `--bare` skips all hooks; hooks from `--settings` also skipped under `--bare` (D S9); cloud sessions read only committed project settings / server-managed (D S4) | `exec` runs hooks (I); trust required | cloud agents: command hooks only; no sessionStart/End, MCP, user-level (D) | U | in-process | in-process (print/json/rpc modes) | U | – |
| Trust gate for project hooks | **none for settings-file hooks** (used in untrusted folders and `-p`); required only for project subagent-frontmatter hooks and `allow` rules (D S2:806-815) | yes: hash-bound review in `/hooks`; project `.codex/` layer must be trusted; `--dangerously-bypass-hook-trust` (D; V `HookTrustStatus` Managed/Untrusted/Trusted/Modified protocol.rs:1887) | project hooks only in trusted workspaces (D) | yes: fingerprint; changed hook = new untrusted (D hooks/index.md:154-156) | n/a (code plugin) | `project_trust` for `.pi/` resources (V docs/security.md) | none stated; "run trusted hooks only" (D) | – |
| Disable | `disableAllHooks` (project false beats user true; cannot disable managed); managed `allowManagedHooksOnly`; `--bare`/`--safe-mode`/`--settings` (D S1,S2:825) | `[features] hooks=false`; admin can force off; `allow_managed_hooks_only` in requirements.toml (D) | enterprise MDM hooks; "block until hooks ready" (D) | settings | – | `--no-extensions` (I) | remove plugin | – |

### C. Enforcement primitives

| | Claude Code | Codex | Cursor | Gemini | OpenCode | Pi | Goose | Aider |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Permission rules | allow/ask/deny, deny>ask>allow regardless of specificity; any-scope deny beats allow (D S2:56-58, 767-773). Bash rule = command-text match, "isn't a security boundary around the program" (D S2:252) | `AskForApproval` {untrusted, on-request(default), granular, never} (V protocol.rs:1191-1213) + exec policy (crate `execpolicy`; syntax not read) | allow/deny in CLI permissions (D; syntax U) | policy engine TOML allow/deny/ask_user; non-interactive ask_user = deny; 3 tiers incl. admin; workspace tier currently disabled (D reference/policy-engine.md:111-131) | `Permission.Ruleset` allow/ask/deny + `ManagedPolicy` statements "earliest-loaded wins" (V permission.ts, managed-policy.ts) | **none by design** | Autonomous (default) / Manual / Smart / Chat; per-tool permissions (D goose-permissions.md:29-35) | `--yes-always` only |
| Managed policy users can't override | managed-settings.json/MDM/server-managed; `allowManaged*Only`; deny can't be overridden at any level; exceptions only restrict (D S2:761, S4) | `requirements.toml` incl. managed hooks, `allow_managed_hooks_only`, otel `log_user_prompt` lock (D; V config_requirements.rs:1249,1992) | enterprise MDM/team dashboard; headless-disable "usage policy not security boundary" (D) | admin tier policies (D) | managed policy (V) | no | custom distributions (docs) | no |
| Modes | default, acceptEdits, plan, auto (classifier, Sonnet 5 default, deny on no-verdict, pauses after 3 consecutive/20 total blocks), dontAsk, bypassPermissions; `disableBypassPermissionsMode`/`disableAutoMode` (D S2:78-87, S12) | sandbox_mode read-only(default)/workspace-write/danger-full-access (V config_types.rs:104-114); `ApprovalsReviewer::AutoReview` (V :183); plan collaboration mode (V :675) | Run modes; `--force`/`--yolo` (D) | default, auto_edit, yolo, plan (D cli-reference:57) | per-agent rulesets | YOLO | see left | – |
| OS sandbox | seatbelt (macOS), bubblewrap+socat (Linux/WSL2); **Bash/PowerShell/Monitor + children only**; Read/Edit/Write/WebFetch are NOT sandboxed; hooks/MCP/LSP outside; native Windows none; default off; reads of `~/.ssh` allowed by default; net via proxy allowlist; escape retry `dangerouslyDisableSandbox` unless `allowUnsandboxedCommands:false` (D S3) | seatbelt/landlock/bwrap + seccomp + managed network proxy + windows-sandbox crates (V dirs `linux-sandbox`, `bwrap`, `windows-sandbox-rs`, `network-proxy`); default read-only | seatbelt/Landlock claimed; rules U (D) | Seatbelt (`sandbox-exec`), Docker, Podman, gVisor/runsc, LXC (V docs/cli/sandbox.md:77) | **none found** (grep of `packages/core/src`: no sandbox impl) (I) | none; "sandboxing largely security theater", use containers (D post; V docs/security.md) | none found (docs) (I) | none |
| Protected paths | `.git .vscode .idea .husky .devcontainer .claude`(exceptions) `.gitconfig .bashrc .zshrc .npmrc .mcp.json .claude.json`; prompted/classified/denied by mode; **allowed in bypassPermissions** (D S12, S2:85) | `.git`, `.codex`, `.agents` read-only under project root by default (V protocol/src/permissions.rs:50-52,878-880) | `.vscode/`, `.git/hooks/` rejected in print mode w/o `--force` (D) | U | U | none | none | none |
| Bash-written files vs file rules | Read/Edit deny rules cover Bash redirections, `tee`, recognised `cat/sed/head/tail`; **not** scripts that open files themselves (python/node) or `grep -r .` — "enable the sandbox" for that (D S2:357,309) | sandbox covers all subprocesses (I) | U | sandbox if enabled | – | – | – | – |
| Worktree isolation | `--worktree`, subagent `isolation: worktree` (D S5,S10) | `worktree` crate (V dir) | worktrees (U) | `--worktree` (V cli-reference:54) | `worktree.ts` (V) | no | no | no |

**Strongest native mechanism per MeowKit control, with bypasses.**

| MeowKit control | Strongest native mechanism (Claude Code) | Known bypass / limit | Other hosts |
| --- | --- | --- | --- |
| Plan gate on source writes (dynamic: "approved plan exists") | PreToolUse hook (exit 2 / deny) on Edit\|Write\|NotebookEdit — deny holds in every mode incl. bypassPermissions (D S2:659); **plus** a Bash PreToolUse hook; **plus** `onFailure:"block"` (v2.1.295+) so a crashing hook can't fail-open; ideally registered in managed settings so agent/user can't remove it | Hook is a real boundary for the built-in file tools only. With Bash the agent can write via `python -c`, `sed -i`, heredoc, `git apply`, etc.; Bash hook can only pattern-match command text (rule docs say text match is not a boundary: S2:252). Static sandbox `denyWrite` can't express a dynamic condition. Project-settings hooks run in untrusted folders and can be removed by editing `.claude/settings.json` (protected path → prompt in default mode, silent in bypass). Cloud sessions ignore user/local settings (S4). | Codex: PreToolUse covers shell, `apply_patch`, MCP, local function tools but vendor says "guardrail, not a complete enforcement boundary" (D); managed hooks fail-closed (V). Cursor: preToolUse/beforeShellExecution + `failClosed`; subagents/tab/cloud gaps (D). Gemini: BeforeTool; fail-open except exit 2 (V). OpenCode/Pi: in-process only; no sandbox (V). Goose: PreToolUse with `on_failure:block` (D). Aider: none. |
| Sensitive-file read block | Native `permissions.deny: Read(./.env)` (+ recognised Bash cat/redirect) AND `sandbox.filesystem.denyRead` for subprocesses. Deny evaluated in all modes. Native beats a custom Read hook | Read tool is not sandboxed and sandbox `denyRead` doesn't stop Read tool (D S3) — need both layers; inherited env secrets visible to sandboxed commands unless `sandbox.credentials` set (D S3) | Codex: sandbox read scopes + `.git/.codex` default ro (V); Gemini policy `deny`; others hook-only or none |
| Pre-ship / commit gate | PreToolUse Bash with `if: Bash(git commit *)`/`git push` + `onFailure:"block"`; durable layer = git hooks (`.git/hooks` is a protected path) and server-side CI / branch protection | Any other invocation form (`git -c alias…`, scripts, API pushes) evades text match; hooks are not run by `--no-verify`-style paths; project hooks removable (see above). **Only server-side checks are host-independent.** | Same shape on Codex/Cursor/Gemini/Goose; Pi/OpenCode need code plugin |
| Post-write security scan | PostToolUse hook → `additionalContext` or `decision:block` feedback; cannot undo the write (D S1); not enforcement | Observation after the fact; async hooks can't block; Codex states PostToolUse "can't undo side effects" (D) | Same everywhere; real enforcement = CI/pre-commit |

### D. Observability — what exists and what a toolkit can collect

**Host-exposed telemetry**

| Host | OTel signals | Prompts/tool args default | Notes |
| --- | --- | --- | --- |
| Claude Code (D S8) | Enable `CLAUDE_CODE_ENABLE_TELEMETRY=1` + `OTEL_*_EXPORTER`. Metrics: `claude_code.session.count`, `lines_of_code.count`, `pull_request.count`, `commit.count`, `cost.usage`, `token.usage` (attrs model, query_source, speed, effort, agent.name, skill.name, plugin.name, mcp_server.name), `code_edit_tool.decision`, `active_time.total`. Events: `user_prompt`, `assistant_response`, `tool_result`, `tool_decision` (source: config/hook/user_*/classifier), `api_request` (tokens, cost_usd, duration, effort), `api_error` (attempt), `api_refusal`, raw-body events. Traces (beta, `CLAUDE_CODE_ENHANCED_TELEMETRY_BETA=1`): `claude_code.interaction/llm_request/tool/tool.blocked_on_user/tool.execution/hook` (hook span = detailed beta tracing only) | **All gated OFF** (`OTEL_LOG_USER_PROMPTS`, `_TOOL_DETAILS`, `_TOOL_CONTENT`, `_RAW_API_BODIES`); prompt length always recorded | Repo `.claude/settings*.json` can't enable telemetry or set the endpoint; managed `env` can force it. No dedicated skill-activation, compaction, or hook-run event visible (events after `tool_decision` unread) |
| Codex (V otel names, `rg` of `codex-rs/{otel,core}`) | Rich: `codex.turn.token_usage*`, `codex.turn_cost`/`turn.cost_microusd`, `codex.api_request`, `codex.tool_decision`, `codex.tool_result`, `codex.hooks.run(.duration_ms)`, `codex.skill_invocation`, `codex.skill.injected`, `codex.compaction`, `codex.multi_agent.spawn`, `codex.approval.requested`, `codex.sandbox_outcome`, `codex.guardian.review`, `codex.thread.skills.truncated`, `codex.user_prompt`, `codex.goal.*` | `otel.log_user_prompt` option; lockable by `requirements.toml` (V config_requirements.rs:1249,1992); default not read (U) | The most MeowKit-relevant signals (hook runs, skill invocation, compaction, delegation) are native |
| Gemini (V docs/cli/telemetry.md) | logs/metrics/traces; `gemini_cli.config`, `gemini_cli.user_prompt`, … | `logPrompts` default **true** (V telemetry.md:47) | opposite privacy default to Claude Code |
| Goose (D env-vars) | OTLP traces/metrics/logs per-signal exporter env | U | |
| Pi | `@earendil-works/pi-telemetry` vendor-neutral contracts (V); in-process span API; session JSONL documented (docs/session-format.md) | n/a | |
| OpenCode | `openTelemetry` config key (V config/normalize.ts:49); signals U | U | |
| Cursor | **UNKNOWN** — no OTel page retrieved; hooks carry `transcript_path`, `model` | | |
| Aider | analytics (PostHog opt-in), `--llm-history-file`, `--chat-history-file` (V args.py) | | |

**Collectability matrix (Claude Code, which is MeowKit's primary host).** host-exposed / derivable / unavailable

| Signal | Status on Claude Code | How |
| --- | --- | --- |
| Task lifecycle | derivable | `TaskCreated/TaskCompleted` hooks; SessionStart/Stop; MeowKit's own files (not host data) |
| Model identity/config | host-exposed (partial) | `SessionStart.model` (optional), `PreModelSwitch.from/to_model`, `effort` object on tool events, OTel `api_request.model/effort`; stream-json `system/init` |
| Context usage | derivable | `/context` is interactive; `SessionStart` resume payload has `context_tokens`; per-request tokens via OTel/`--output-format json` usage; no per-hook "context %" field seen (U) |
| Compaction events | host-exposed | `PreCompact`/`PostCompact` hooks; OTel `query_source: compact` |
| Skill activation | partial | `skill.name` attribute on OTel cost/token events; `tool_result`/tool params with `OTEL_LOG_TOOL_DETAILS`; PreToolUse on `Skill` tool (I) — no dedicated event seen |
| Agent delegation | host-exposed | `SubagentStart/Stop` hooks, `agent_id`/`parent_agent_id` OTel attrs, stream-json `parent_tool_use_id` |
| Tool execution | host-exposed | PreToolUse/PostToolUse(+Failure) with `duration_ms`; OTel `tool_result` |
| Hook invocation | partial | `--include-hook-events` stream (SessionStart/Setup always; others need flag) (D S10); `claude_code.hook` span beta; no per-hook outcome via OTel by default |
| Permission decisions | host-exposed | OTel `tool_decision` (source, classifier_verdict, permission_mode); `PermissionRequest/PermissionDenied` hooks; headless `permission_denials` |
| Errors/retries | host-exposed | OTel `api_error.attempt`; stream `system/api_retry` (D S9) |
| Tokens / cost | host-exposed | `--output-format json` `total_cost_usd` + per-model (client-side estimate, "can differ from your bill") (D S9); OTel `cost.usage`/`token.usage` |
| Transcript | host-exposed but **unstable** | `~/.claude/projects/<proj>/<id>.jsonl`; format "internal… changes between versions" (D S15); use `transcript_path` + export interfaces; written async/lags (D S1) |

### E. Evaluation hooks

| Host | Headless | Pin model/effort | Clean config | Structured out | Limits | Built-in eval |
| --- | --- | --- | --- | --- | --- | --- |
| Claude Code | `claude -p` (D S9) | `--model`, `--effort low…max`, settings `modelSettings`; `CLAUDE_CODE_SUBAGENT_MODEL(_FORCE)` (D S10,S5) | `--bare` (skips hooks/skills/subagents/plugins/MCP/auto-memory/CLAUDE.md; no OAuth — needs `ANTHROPIC_API_KEY`; **to become default for -p**), `--setting-sources`, `--safe-mode`, `CLAUDE_CONFIG_DIR`, `--no-session-persistence`, `--strict-mcp-config`, `--disable-slash-commands`, `--tools` (D S9,S10) | `--output-format json\|stream-json`, `--json-schema` | `--max-turns`, `--max-budget-usd` (print only) | **`claude plugin eval`**: fresh isolated `-p` session per case, graders (regex, tool-called, file-created, `llm` rubric, `baseline`), **no-plugin baseline arm** (`--ablation with-without`), `--model` pin, `--judge-model`, OS sandbox on Bash; `experimental.evals` dir (D S14, S11). Needs MeowKit packaged as a *plugin*; it installs into `.claude/` today (I) |
| Codex | `codex exec` (V exec/src/cli.rs) | `-c` overrides, `--model` (I) | `--ignore-user-config`, `--ignore-rules`, `--ephemeral`, `CODEX_HOME`, `--strict-config` (V exec/src/cli.rs:21-54; home-dir/lib.rs:6) | `--json`, `--output-schema`, `--output-last-message` (V :58-79) | goal budgets telemetry (V); max-turn flag U | none found |
| Cursor | `agent -p` (D) | `--model` (U) | U | `--output-format json/stream-json` (D) | U | none found |
| Gemini | `-p`; `--output-format json/stream-json` (V cli-reference:52,70) | `--model` | U (`--extensions`, `--skip-trust`) | json | U | repo has `evals/` + `docs/behavioral-evals.md` (internal) |
| OpenCode | `run --format json` (V cli/src/run) | U | U | json | U | – |
| Pi | `--print`, `--mode json\|rpc`, SDK (V docs/cli.md:47-53) | `--model sonnet:high` (V) | `--no-context-files` style flag (docs/cli.md:217) | JSONL events | U | `packages/evals` dir exists (not read) |
| Goose | `goose run`, `--output-format json/stream-json`, `--max-turns`, `--no-session`, `--provider/--model` (V goose-cli-commands.md:215-456) | yes | U | yes | `--max-turns` | `evals/` dir (not read) |
| Aider | `--message`, `--yes-always`, `--test-cmd`, `--lint-cmd`, `--reasoning-effort`, `--config` (V args.py) | yes | `--config`, `--env-file` | no JSON | no | benchmark harness in repo history (not in clone) (U) |

**Verdict:** controlled with/without-MeowKit experiments are feasible on Claude Code (native baseline-arm eval; `--bare` for the "without" arm), Codex (`--ignore-user-config --ephemeral`, native `--output-schema`), Goose, Gemini (partial). Cursor: UNKNOWN. Pi/OpenCode: feasible via json/rpc modes but no baseline tooling.

### F. Host-native equivalents of MeowKit workflow features (duplication risk)

| MeowKit feature | Claude Code native (D S13 unless noted) | Codex | Others |
| --- | --- | --- | --- |
| Plan mode / Gate 1 | `/plan`, plan mode (blocks edits until approval; **not** blocked when bypass available: instructed only) (D S12). Native plan approval ≠ MeowKit human-approval receipt | `ModeKind::Plan` (V config_types.rs:675) | Gemini plan mode (V docs/cli/plan-mode.md); Pi: none by design; Goose Chat mode |
| Task/todo tracking | `TaskCreate/TaskList` tools, `/tasks` | `update_plan` tool (D hooks doc) | Pi: none (TODO.md) |
| Code review | `/code-review`(= `/review`) effort levels, `--fix`, multi-agent `ultra`; `/ultrareview` cloud | `codex review`-type CLI subcommands `--uncommitted/--base/--commit` (V exec/src/cli.rs:305-321); `codex.task.review` | Gemini none verified |
| Security review | `/security-review` (branch diff vs origin default) | guardian auto-review of approvals (V `codex.guardian.*`) | – |
| Simplify | `/simplify` (4 parallel review agents, applies fixes) | – | – |
| Verify | `/verify` (build+run app, observe) | – | – |
| Memory | auto memory (first 200 lines/25KB of MEMORY.md; `/memory`; subagent `memory:`) (D S7,S5) | native memories pipeline crates `memories/{read,write}` (V README) | Gemini `auto-memory.md` (V docs/cli) |
| Compaction controls | `/compact [instr]`, `PreCompact` hook (text stdout becomes compaction instructions), `/context` | Pre/PostCompact hooks (V) | Gemini PreCompress; Pi `session_before_compact` can cancel/customize (V) |
| Multi-agent / teams / background | subagents, agent teams, background subagents, `/batch` (5–30 worktree agents), `/workflows`, `/loop`, `/goal`, agent view | `spawn_agent`, `codex.multi_agent.*`, max_depth/threads | Cursor subagents+background; Pi none by design |
| Checkpoints / rewind | `/rewind` (code + conversation) | – | Gemini checkpointing + rewind docs (V) |
| Worktrees | `--worktree`, `isolation: worktree` | worktree crate | Gemini `-w` |

Duplication flag (INFERRED from table): MeowKit `simplify`, `verify`, `review`, `cso`, `loop`, `memory`, `task-queue`, `worktree`, `plan` overlap in *name and intent* with Claude Code natives. Whether MeowKit's variants add measurable value over them is not established by this domain (needs D-experiments).

## 3. Findings

**F-D10-01 — Claude Code settings-file hooks fail open by default and run in untrusted folders.** D (S1: "Default is fail-open… A PreToolUse timeout does not block"; S2:806: settings-file hooks "Used" in both untrusted-parent and `-p` cases). Block-on-failure exists only via `onFailure:"block"` (command/http; v2.1.295+; version-dependent) and does not apply to Stop/SubagentStop/TaskCompleted/TeammateIdle/async. Why it matters: MeowKit's write guards (`gate-enforcement`, `privacy-block`, `pre-ship`) exit with 2 to block; any crash/timeout/node-missing silently disables them unless registered with `onFailure:"block"`. Counter-evidence sought: found Codex managed hooks are fail-closed on unknown attribution (V engine/mod.rs:189) and Goose has opt-in `on_failure:block` — so fail-closed is achievable but opt-in everywhere.

**F-D10-02 — A PreToolUse hook on Edit|Write is a real boundary only for the host's own file tools.** D S2:252,357 (Bash rules "aren't a security boundary"; Read/Edit deny rules don't cover scripts that open files themselves; "enable the sandbox"). D S3: sandbox covers Bash+children only, not Read/Edit/Write. Consequence: the plan gate is enforceable for Edit/Write; with Bash available, it is advisory-with-heuristics unless Bash is sandboxed to deny writes under source paths (static) — which cannot express "plan approved". INFERRED: a dynamic gate + Bash = best effort. Counter-evidence: hooks run before permission rules and exit 2 holds even in bypassPermissions (D S2:659).

**F-D10-03 — Native deny rules + sandbox beat a custom Read hook for secrets.** D S2:56-60 (deny>ask>allow, any scope, all modes), S3 (`filesystem.denyRead`, `credentials.mode`). Both layers are needed (Read tool unsandboxed; sandbox doesn't gate Read tool). Candidate DELEGATE TO HOST for `privacy-block`; needs a coverage comparison (see Experiments).

**F-D10-04 — Hooks are portable in shape, not in names.** V/D: stdin-JSON + exit 2 = block on Claude Code, Codex, Gemini, Goose, Cursor. Event names differ (PreToolUse vs BeforeTool vs beforeShellExecution); decision JSON differs (Codex rejects `allow` without `updatedInput` and rejects `ask` → Failed, V pre_tool_use.rs:485,602; Cursor accepts `ask` but doesn't enforce it on preToolUse, D). Gemini even aliases `CLAUDE_PROJECT_DIR` (D hooks/index.md:144) and Cursor reads `.claude/agents` — vendors are converging on CC conventions, but a MeowKit hook written for CC cannot be copied. Pi and OpenCode have no out-of-process hooks (V).

**F-D10-05 — Claude Code ships a native with/without-plugin eval harness.** D S14: `claude plugin eval` with fresh isolated `-p` sessions, `--ablation with-without`, `--model` pin, graders incl. LLM rubric and tool-called checks. This directly addresses H1/H2 measurement for a skill/plugin bundle; MeowKit currently installs into `.claude/` (I — not packaged as plugin), so using it requires a plugin manifest. Counter-evidence: tool is documented, not run; cost = cases×runs×2 + judge calls (D S14:46).

**F-D10-06 — `--bare` makes clean-arm runs possible but changes the arm in other ways.** D S9: skips hooks/skills/CLAUDE.md/auto-memory/MCP/plugins, drops system reminders and the skill list, disables background tasks, needs API key (no OAuth). So "without MeowKit" via `--bare` is not "stock Claude Code"; it is "stock minus reminders/skills list". Use `--setting-sources user` / `CLAUDE_CONFIG_DIR` for a closer stock arm. Version-dependent: pre-v2.1.286 bare behaved differently.

**F-D10-07 — Codex exposes the most MeowKit-relevant telemetry natively** (V otel string names in `codex-rs/{otel,core}`): `codex.hooks.run`, `codex.skill_invocation`, `codex.compaction`, `codex.multi_agent.spawn`, `codex.tool_decision`, `codex.turn.token_usage`, `codex.sandbox_outcome`. Claude Code exposes tokens/cost/tool decisions/delegation but, per read portion of S8, no dedicated skill, compaction or hook-run event (hook span only in detailed beta tracing). A MeowKit "observability" layer on Codex should consume OTel, not re-implement.

**F-D10-08 — Telemetry privacy defaults diverge.** Claude Code: prompts/tool args/tool content off by default (D S8). Gemini: `logPrompts` default `true` (V telemetry.md:47). Codex: `log_user_prompt` exists and is admin-lockable; default U. A cross-host observability design cannot assume the same default.

**F-D10-09 — Managed policy is the only tamper-resistant tier on Claude Code, Codex, Cursor.** D: CC `allowManagedHooksOnly`, `allowManagedPermissionRulesOnly`, managed CLAUDE.md non-excludable (S2:761, S7:292); Codex `requirements.toml` `[hooks] managed_dir`, `allow_managed_hooks_only` (D) and fail-closed attribution (V); Cursor enterprise MDM (D). A repo-shipped toolkit (MeowKit as committed `.claude/`) lives in the *project* tier: removable by the user, by `disableAllHooks` ordering (project false wins over user true, S2:825), and potentially by the agent editing `.claude/settings.json` (protected path: prompt in default/acceptEdits, classifier in auto, silent in bypassPermissions — D S12). Counter-evidence: sandbox write-denies `.claude` settings for Bash (D S3).

**F-D10-10 — Project-hook trust is a host-specific hole.** Claude Code uses settings-file hooks without trust (D S2:806); Codex (hash review), Gemini (fingerprint), Cursor (trusted workspace) require approval. MeowKit guards that rely on project hooks run in every cloned CC repo (good for enforcement) but the same property means a malicious repo's hooks run unreviewed — security-posture asymmetry worth documenting.

**F-D10-11 — Claude Code natively covers much of MeowKit's workflow surface.** D S13: `/plan`, `/code-review`, `/security-review`, `/simplify`, `/verify`, `/batch`, `/goal`, `/loop`, `/rewind`, auto memory, TaskCreate/`/tasks`, `/workflows`, agent teams, worktrees. Overlap is by intent; quality equivalence UNKNOWN. Candidate DELEGATE TO HOST items below.

**F-D10-12 — Same-name precedence on Claude Code (answer to Q1).** D S5/S6/S1:
- Agents: managed > `--agents` > project (`.claude/agents`, nearest cwd wins) > user > plugin (lowest). Plugin agents **ignore** `hooks`, `mcpServers`, `permissionMode` frontmatter (S5).
- Skills: enterprise > personal > project; plugin skills namespaced `plugin:skill` (no collision); nested `.claude/skills` coexist, addressed by path; `--add-dir` clashes get prefix (S6). So a project skill named `review` is **shadowed by a user/enterprise `review`** and by built-in bundled `/code-review`? (bundled-vs-custom collision rule not read: UNKNOWN).
- Hooks: all sources merge (user+project+local+managed+plugin+skill+agent frontmatter); matching hooks run **in parallel**; byte-identical handlers across settings files run once, plugin/skill copies run separately; decisions combine deny > defer > ask > allow; exit 2 = deny; a hook allow never beats a deny/ask rule (S1, S2:635-659). Order of execution is not a thing (parallel) → hooks must not depend on each other (relevant to MeowKit's `dispatch.cjs` multiplexer: it serialises handlers itself).
- Settings lists (`permissions.allow`, etc.) merge across scopes; scalars: managed > CLI `--settings` > local > project > user (S4).

**F-D10-13 — Cross-host standards (answer to Q2).** Honoured:
| Standard | CC | Codex | Cursor | Gemini | OpenCode | Pi | Goose | Aider |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `AGENTS.md` | yes, conditional (v2.1.277+, only if no CLAUDE.md; setting to read both) D | yes V | yes D | U (GEMINI.md default) | yes V | yes V | file present in repo; reads `.goosehints` D; AGENTS.md read U | no |
| `SKILL.md` (agentskills.io) | yes D | yes V | yes D | yes D | yes V | yes D | yes D | no |
| MCP | yes | yes | yes | yes | yes | yes | yes | U |
| Hook schema | CC-style | CC-like names | camelCase own | own names | none (TS) | none (TS) | Open Plugins spec, CC-like | none |
| Subagent md | md | TOML | reads CC/Codex dirs | md | U | none | recipes | none |
Bound on portability: instruction text, SKILL.md skills and MCP are the portable layer; hooks, subagents, permission/sandbox policy and telemetry are not.

**F-D10-14 — Pi minimalism, as design data (answer to Q3).** V source + author post (D, https://mariozechner.at/posts/2025-11-30-pi-coding-agent/):
- Tools: 8 defined (`read bash powershell edit write grep find ls`, V src/core/tools/index.ts:94-105); default-active 4 (`read bash edit write`, V agent-session.ts:3820). Post says four defaults + read-only extras.
- System prompt: static preamble "You are a coding assistant running inside pi…" + tool list + rules + docs pointers + project context files + skills (V system-prompt.ts:150-170). Author claims prompt+tools "below 1000 tokens" (D). I did not tokenise it (UNKNOWN exact count); structure is consistent with a few hundred words before context files.
- Deliberately omitted (author's stated reasons, D): MCP (token overhead e.g. ~13.7k for Playwright MCP), sub-agents (opaque, poor context transfer), plan mode (use PLAN.md for observability), permission prompts (YOLO; sandboxing "security theater", use containers), built-in todos (use TODO.md), background bash (use tmux). Origin: Claude Code grew ~80% unused functionality and changed prompt/tools per release.
- Evidence of benefit: post reports Terminal-Bench 2.0 run with Opus 4.5 but gives **no numeric score** in the text (leaderboard screenshot dated 2025-12-02) — UNKNOWN; not proof of superiority.
- Drift: the 2026 source has MCP docs (docs/mcp.md, `packages/mcp`), project trust, a telemetry package and extension events that can block tool calls (V docs/extensions.md:82; docs/security.md). The minimal stance has partly eroded by 2026 (see Contradictions).

**F-D10-15 — Sandbox availability differs more than hook availability.** V/D: Codex and Gemini ship OS/container sandboxes (Codex seatbelt/landlock/bwrap+seccomp+network proxy; Gemini seatbelt/Docker/Podman/gVisor/LXC); Claude Code has seatbelt/bwrap but **off by default** and Bash-only (D S3); Cursor claims one (rules U); OpenCode, Pi, Goose, Aider: none found. MeowKit's "enforced security" claim has only a soft foundation on four of eight hosts. (H7 evidence.)

**F-D10-16 — Gate 2 / Gate 1 "approval" cannot be host-enforced anywhere.** INFERRED from tables: no host exposes a "human typed approval" primitive to hooks except ask/permission prompts (CC `permissionDecision:"ask"`; `PermissionRequest`; Cursor `ask` not enforced on preToolUse). A hook can force a prompt (`ask`) on commit/push, which is a real human-in-loop primitive on Claude Code (D S1 precedence ask>allow) — but not on Codex PreToolUse (ask rejected as unsupported, V). MeowKit's file-based "receipt" is advisory by construction (matches `gate-rules.md` own admission).

## 4. Contradictions

| Item | Claim A | Claim B | Resolution |
| --- | --- | --- | --- |
| Pi "no MCP" | Author post (2025-11-30): MCP omitted | `packages/coding-agent/docs/mcp.md` + `pi mcp add` in 2026 source (V) | Design stance drifted in a year; the post is not current state. |
| Pi "no permission/YOLO" | post | `docs/security.md` adds project trust + `tool_call` blocking extensions (V) | Still no approval prompts by default; guardrails now available by extension. |
| Claude Code `-p` + trust | Hooks in untrusted folders: "Used" (S2:806) | Project subagent frontmatter hooks and `allow` rules: not used | Not a contradiction; two classes of project content. Easy to misstate. |
| Cursor hooks "block" | preToolUse listed as can-block | `ask` "accepted but not enforced" on preToolUse; subagentStart treats ask as deny (D) | Only deny is reliable. |
| Codex hooks docs vs source | docs: PreToolUse "allow" supported with updatedInput | source: bare allow without input and `ask` → Failed (V pre_tool_use.rs:485,602) | docs ⊂ source behaviour; consistent but narrower than CC's decision set. |
| Codex docs "prompt/agent hooks" | protocol enum lists `Prompt`/`Agent` handler types (V protocol.rs:1847-1852) | docs say they are skipped (D) | Declared but not executed (per docs; not traced in source). |
| `learn.chatgpt.com` vs `developers.openai.com/codex` | 308 redirect | sub-pages (agents-md, skills, subagents) 404 | Codex doc URLs unstable; relied on source instead. |

## 5. Decisions proposed

| # | Decision | Class | Observed problem | Affected source | Causal hypothesis | Alternatives | Measurement |
| --- | --- | --- | --- | --- | --- | --- | --- |
| D10-1 | Register write/commit guards with `onFailure:"block"` (CC ≥2.1.295) and document the fail-open default for older versions | IMPROVE | Hook crash/timeout/missing node → guard silently off (F-01) | `.claude/settings.json` registration of `gate-enforcement`, `privacy-block`, `pre-ship` | Fail-open default turns infrastructure faults into gate bypass | Wrapper script that emits exit 2 on any internal error (works on all versions) | Fault-injection: make hook throw; assert tool call denied (see E1) |
| D10-2 | Replace/augment `privacy-block` Read hook with native `permissions.deny Read(...)` + `sandbox.filesystem.denyRead`; keep hook only for patterns native rules can't express | DELEGATE TO HOST (partial) | Duplicate mechanism; native deny holds in all modes and covers Bash `cat`/redirect | `privacy-block.cjs` | Native evaluated before/regardless of hooks (S2:56,635) | Keep hook (portable to hosts lacking deny rules) | Red-team set of 20 read paths (Read tool, cat, python open, grep -r, find -exec) → coverage % per mechanism (E2) |
| D10-3 | State in docs that the plan gate is enforceable only for host file tools; with Bash it is heuristic unless Bash is sandboxed | SIMPLIFY (claims) | "Enforced" overstates; Bash bypass classes exist (F-02) | README/`gate-rules.md` wording; `gate-enforcement.cjs` Bash handling | – | Make Bash matcher stricter (more false positives) | E3 bypass battery |
| D10-4 | Use `claude plugin eval` (+ `--ablation with-without`, pinned `--model`) as primary H1/H2 harness; package a minimal MeowKit plugin for it | EXPERIMENT | No controlled baseline exists | new eval dir outside production; plugin manifest | Native harness gives with/without arms for free | Custom `-p --bare` harness | Δ pass-rate with vs without per skill/hook on same cases |
| D10-5 | Per-host portability tiers in README: instructions + SKILL.md + MCP = portable; hooks = per-host adapters; sandbox/policy = host-owned | SIMPLIFY (claims) | H6 "no false parity" | adapters docs | F-04, F-13 | – | Checklist audited against adapter code |
| D10-6 | Consume host OTel (Codex/CC) rather than build custom hooks for tokens/cost/delegation/compaction; use hooks only for MeowKit-specific facts (gate state) | DELEGATE TO HOST | Overlap with `analyst`, trace hooks | `.claude/hooks/dispatch.cjs` observers | F-07 | Keep hooks as universal fallback for hosts without OTel (Cursor U, Aider) | Parity check: MeowKit trace totals vs OTel totals on 10 runs |
| D10-7 | For `simplify`, `verify`, `review`, `cso` skills: run head-to-head vs native `/simplify`, `/verify`, `/code-review`, `/security-review` before deciding keep/remove | NEEDS MORE EVIDENCE | Name/intent overlap (F-11) | those skills | MeowKit variants may add repo-specific gates or may duplicate | Remove outright | E4 |
| D10-8 | Recommend managed-settings deployment for any claim of tamper resistance; otherwise label project-tier controls "guardrails" | KEEP + document | F-09 | docs | – | – | – |
| D10-9 | Do not port MeowKit hooks to Pi/OpenCode as out-of-process scripts; they need in-process TS plugins or are advisory-only | REJECT (naive port) | F-04 | adapters | – | – | – |

## 6. Experiments proposed (each can falsify a conclusion above)

- **E1 fail-open test (falsifies F-01):** hook that `process.exit(1)` / sleeps past timeout / throws; with and without `onFailure:"block"`; record whether Write proceeds. Also kill `node` from PATH.
- **E2 secret-read coverage (falsifies F-03):** corpus: Read tool, `cat`, `head`, `python -c open()`, `grep -r`, `find -exec cat`, `git show`, `env`. Matrix: {deny rule only, sandbox denyRead only, both, MeowKit hook}; metric = % blocked. Run in default and bypassPermissions.
- **E3 plan-gate bypass battery (falsifies F-02):** attempt source write by `sed -i`, heredoc, `python`, `git apply`, `tee`, symlink, `cp`, MCP tool, subagent with different tools; with/without sandbox `denyWrite`; count successes.
- **E4 native-vs-MeowKit (falsifies F-11 dup claim):** same 20 tasks, `claude plugin eval --ablation with-without`; arms: stock, native `/code-review`/`/simplify`, MeowKit skill. Pin model/effort; ≥5 runs/case; report Δ and variance; judge model pinned.
- **E5 trust (falsifies F-10):** clone repo with benign sentinel hook; `claude -p` untrusted vs interactive; confirm sentinel fires/doesn't.
- **E6 same-name precedence (falsifies F-12):** project vs user agent/skill/hook with identical names; observe which prompt/definition loads; two hooks returning allow/deny/ask simultaneously.
- **E7 observability parity:** run identical task with OTel enabled; map each MeowKit trace field to an OTel attribute; list unmatched.

## 7. Honest portability summary (what engineering intent can be carried)

| Intent | Claude Code | Codex | Cursor | Gemini | OpenCode | Pi | Goose | Aider |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Instructions / rules text | native | native (AGENTS.md) | native (rules/AGENTS.md) | native (GEMINI.md) | native | native | native (.goosehints) | `--read` only |
| Skills (SKILL.md) | native | native | native | native | native | native | native | none |
| Subagent definitions | native | native but TOML (convert) | native, also reads `.claude/agents` | native | partial | none (by design) | partial | none |
| Hard gate on source writes | native via hook (strong for file tools; Bash heuristic; managed tier for tamper-resistance) | native via hook + sandbox (vendor: guardrail) | native hooks (+failClosed), caveats | native hook (exit 2) + policy engine + sandbox | in-process plugin only; no sandbox | in-process extension only; none by default | PreToolUse hook (+on_failure:block); no sandbox | not possible |
| Sensitive-read block | native deny + sandbox | sandbox/policy | hooks (beforeReadFile) | policy deny | plugin/permission rules | extension only | hook BeforeReadFile | not possible |
| Commit/ship gate | hook on Bash (+git hooks/CI) | hook on Bash (+git/CI) | beforeShellExecution | BeforeTool | plugin | extension | PreToolUse | `--lint-cmd/--test-cmd` post-edit only |
| Post-write scan | advisory (PostToolUse) | advisory | advisory | advisory | advisory | advisory | advisory (After*) | `--lint-cmd`/`--test-cmd` |
| Telemetry | OTel (partial for skills/hooks) + hooks | OTel (richest) | hooks only (U) | OTel | OTel config | in-process | OTLP | files only |
| Plan-approval receipt = human approval | advisory (file); only ask-prompt is real | advisory | advisory | advisory | advisory | n/a | advisory | n/a |

Categories: **native** = host mechanism carries the intent; **advisory-only** = relies on model compliance or removable project-tier config; **not at all** = host lacks the primitive. Cross-host parity can honestly be claimed for text layers (instructions, skills, MCP), not for enforcement.

## 8. Could not verify (UNKNOWN + what would verify)

1. Claude Code hook sections Stop (`stop_hook_active`), SubagentStart/Stop payload, full "common input fields" (S1 chars 200000+ unread) — re-fetch with offset 200000.
2. Claude Code OTel events after `tool_decision` (compaction, subagent_completed, skill/hook events) — fetch S8 offset 100000.
3. Skill listing total budget on Claude Code (S6 tail) — fetch offset 100000.
4. Whether bundled `/code-review` etc. shadow a project skill of the same name — test (E6).
5. Cursor: sandbox rules, permission-file syntax, OTel, headless config isolation, skill listing budget.
6. Codex: AGENTS.md/skills discovery order, execpolicy syntax, default `log_user_prompt`, PreToolUse coverage of every file-write path (docs admit "specialized paths can opt out"); would need reading `core/src/tools/handlers/*` or running.
7. Gemini: how multiple hooks combine; whether AGENTS.md is read; BeforeTool input-rewrite field names.
8. OpenCode: user docs absent from clone — skill/agent file formats, permission config syntax, OTel signals; whether any sandbox exists outside `packages/core`.
9. Goose: Rust enforcement behaviour (docs only); Goose reads AGENTS.md?
10. Pi: exact system-prompt token count; Terminal-Bench numeric result; `packages/evals` contents.
11. Aider: any hook mechanism beyond git commit hooks (none found by grep).
12. All "VERIFIED" items are read-in-source, none executed; behaviour-level claims (e.g. exit-code handling in `core/hook_runtime.rs` after the parse step) were not traced end to end.
13. Prompt-injection observations: none of the fetched docs or repos addressed the agent with instructions.

**Status:** DONE_WITH_CONCERNS (see section 8).
