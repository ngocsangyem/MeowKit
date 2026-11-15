# D06 — deepseek-harness (`dsh`) and qwen-code: source-level harness study

Researcher: D06 agent. Date: 2026-11-15. Read-only. Repos: `deepseek-harness` @ `39163dd3` (2026-11-13), `qwen-code` @ `9d390e23` (2026-11-14), under `/Users/sangnguyen/Desktop/research-harness/`.
Citations: `dsh:` = deepseek-harness, `qw:` = qwen-code, paths relative to repo root, at the SHAs above. Line numbers are as of those SHAs.

## 1. Scope & coverage inventory

**Read deeply (code, with line citations)**
- dsh: `packages/core/agent-loop/src/{agent.ts (lines 380-751), constants.ts}`, `packages/core/tools` (docs + pipeline doc), `packages/llm/llm-retry/src/index.ts` (head), `packages/guard/repeat-tool-reminder/src/index.ts` (head), `packages/experimental/hook-protocol/src/{codec,runner}.ts`, `packages/experimental/hooks-claude-code/{README.md,src/index.ts grep}`, `packages/sandbox/sandbox-local/src/profiles.ts`, `packages/sandbox/sandbox-policy/src/index.ts` (head), `packages/compaction/compaction-basic/src/{config.ts,summarizer.ts}`, `packages/compaction/compaction-tool-result-pruner/src/config.ts`, `packages/context/agent-instructions/src/config.ts`, `packages/skill/skill-filesystem/src/index.ts` (roots + frontmatter), `packages/bundle/base/cordis.patch.yml` (whole composition), `packages/interaction/user-approval/src/index.ts` (head), docs: `architecture.md`, `tool-execution-pipeline.md`, `tool-catalog.md` (generated), `testing.md`, `benchmarks/AGENTS.md`, `SAFETY.md`, `THIRD_PARTY_NOTICES.md`, `BENCHMARK.md`, `README.md`, root `AGENTS.md`.
- qw: `packages/core/src/core/{agent-loop.ts (grep), client.ts (grep: MAX_TURNS, sessionTurnCount), prompts.ts (selected ranges), turn-budget.ts, stream-transport-retry.ts, reasoning-effort.ts (head)}`, `core/src/hooks/{types.ts, hookRunner.ts (1640-1830), hookRegistry.ts (290-330), hook-timeout.ts}`, `core/src/core/toolHookTriggers.ts (225-262)`, `core/src/services/{loopDetectionService.ts (consts), loop-protection.ts, chatCompressionService.ts (95-145), microcompaction (consts)}`, `core/src/permissions/{classifier.ts head, permission-manager.ts head}`, `core/src/config/{approval-mode.ts, storage.ts:17, config.ts 5895-5935}`, `core/src/skills/skill-manager.ts` (discovery), `core/src/extension/claude-converter.ts` (head+greps), `core/src/subagents/builtin-agents.ts` (names), `core/src/tools/agent/agent.ts` (schema comments 279-330), `core/src/tools/tool-names.ts`, `core/src/memory/*` (headers of extract-cadence, dream, secret-scanner, recall-experiment), `cli/src/config/hook-approvals.ts` (head), `cli/src/serve/sandbox-macos-restrictive-open.sb` (head), `docs/evaluation.md`, `docs/design/dsw-swe-verified-release-pipeline.md` (head), `AGENTS.md` (head).

**Skimmed (directory listings / greps only)**
- dsh: `packages/{subagent,team,jobs,goal,plan,mcp,spill,telemetry,session*,llm/*}`, `.agents/skills` (names), `docs/{postmortem,defensive-patterns}` (names), `benchmarks/*` (names + AGENTS.md), `python/`.
- qw: `core/src/{agents,memory (other files),telemetry,mods,omni,code-mode,providers,models}`, `cli/src/{ui,config (names),services (names)}`, `integration-tests/` (names), `.github/workflows` (names).

**Not opened**
- dsh: `packages/client/*`, `apps/*`, `website/`, `native/system` (Landlock/N-API source), `packages/experimental/*` except hooks, `packages/sandbox/sandbox-windows-acl`, `packages/llm/llm-pi-ai` internals, `packages/session/*` internals, all `tests/` bodies (only policy doc `docs/testing.md` read), `.agents/notes/*` rationale notes.
- qw: `packages/{desktop,web-shell,channels,live-host,managed-agent-server,sdk-*,vscode-ide-companion,zed-extension,chrome-extension,browser-use,cua-driver,mobile-*,omni}`, `core/src/{lsp,ide,ipc,board.ts,goals}`, provider adapters bodies, most of `client.ts` (6,897 lines; only grepped), `coreToolScheduler.ts` (8,650 lines; only partition helpers read), test bodies, CI workflow bodies.

**Not done / limits.** Did not run either repo (constraint). No numbers were reproduced. LOC counts are rough `wc -l` sums (see F-D06-02/03). Nothing in the files I read addressed me with instructions (no prompt-injection observed); AGENTS.md/CLAUDE.md of both repos were treated as data only.

## 2. Findings

### 2.1 Identity

**F-D06-01 — dsh is an original, Cordis-based harness; its claimed origin is consistent with the code. Not a fork of Claude Code/Codex/Gemini CLI.** VERIFIED
- MIT, "Copyright (c) 2026 DeepSeek" (`dsh:LICENSE:1-3`). Root package `@deepseek-ai/dsh-root` `0.2.2-rc.3`, Node >=24.9, pnpm monorepo (`dsh:package.json`). First commit 2026-06-10 "Initialize repo with README, AGENTS.md" (`git log --reverse`). 27,219 commits by 2026-11-13, many authors (top: 6,948 / 3,351 / 2,917). Tags `dsh-v0.2.2-alpha.2 … rc.3`.
- Built on vendored Cordis (Koishi ecosystem plugin framework) under `@deepseek-ai/*` names, each upstream LICENSE preserved (`dsh:THIRD_PARTY_NOTICES.md` vendored table). README: "everything-is-a-plugin" (`dsh:README.md:5`). Package names, notices and code agree.
- It *depends on* Anthropic's `@anthropic-ai/claude-agent-sdk` and ships the official Claude Code platform payload for a `subagent-claude-code` provider; notice states the project owner "authorizes distribution" of those (`dsh:THIRD_PARTY_NOTICES.md:184-199`). That is a dependency, not lineage.
- Status: "developer preview … THERE WILL BE COMPATIBILITY-BREAKING CHANGES" (`dsh:README.md:9`); `SAFETY.md`: "has not undergone a security audit and must not be treated as secure" (`dsh:SAFETY.md:5`).
- Why it matters: it is a 5-month-old, pre-stable, extremely plugin-fragmented codebase (382 `package.json` under `packages/`). Anything MeowKit targets here is a moving target.
- Counter-evidence sought: grep of notices/package names for Gemini/Codex forks — only the dependency above.

**F-D06-02 — dsh size: ≈1.1M lines of `.ts` under `packages/` (includes `tests/*.spec.ts` and client UI), but the agent kernel is small.** VERIFIED (counts approximate)
- Kernel: `core/agent-loop/src` 2,149 lines; `core/tools/src` 3,797; `core/system-prompt` 699; `compaction/*` ≈2,900; `guard/*` 315. Largest packages are UI/experimental (liveshare 18k, inspector 16k, ui-conversation 14.6k).
- Why it matters: "kernel + opt-in plugins" is the architectural shape; the loop itself does little (see F-D06-04).

**F-D06-03 — qwen-code is a Gemini CLI fork, now heavily diverged, Apache-2.0, very high release cadence.** VERIFIED
- First commit 2025-04-15 "Initial commit of Gemini Code CLI" (`git log --reverse`). `LICENSE:190` "Copyright 2025 Google LLC"; 534 files in `packages/core/src` still carry "Copyright 2025 Google LLC" headers vs 1,699 mentioning Qwen. Newer files "Copyright 2026 Qwen Team" (e.g. `qw:packages/core/src/hooks/hook-timeout.ts:3`). Still uses `@google/genai` types (`prompts`, `loopDetectionService.ts:8`).
- Publisher: QwenLM (Alibaba Qwen team). `@qwen-code/qwen-code` 0.27.2 (`qw:package.json`); tags 867; latest `v0.27.3` 2026-11-13, `v1.0.0-preview.1` 2026-11-12, nightlies, separate `desktop-v*` and `sdk-typescript-v*` tags. 12,470 commits; 685 in first half of Nov 2026, ~1,000-1,400/month since June.
- Size: `packages/core/src` ≈503k lines, `packages/cli/src` ≈741k (tests excluded by path filter); 23 packages incl. desktop, web-shell, channels (Telegram/DingTalk/WeChat/Feishu), Java/Python/TS SDKs.
- Multi-protocol (OpenAI/Anthropic/Gemini/Qwen) per README. README says 1.0 Preview merges "agent harness capabilities of Qoder" (`qw:README.md`; DOCUMENTED, not checked in code beyond `qoder-converter.ts` existing).
- Why it matters: this is the more mature, production-distributed of the two, and the one explicitly built to ingest Claude Code artifacts (F-D06-20).

### 2.2 Agent loop

**F-D06-04 — dsh loop: no step cap, no loop breaker in the kernel; termination = "assistant message has no tool calls", or cancel/error; retry and doom-loop handling are plugins.** VERIFIED
- `step()` returns `completed` when `toolCalls.length === 0` (`dsh:packages/core/agent-loop/src/agent.ts` ~ lines 610-620 of the 380-751 read), `max-tokens` on that finish reason, else executes tools and loops. Turn exits when `turnEnds` and inbox empty (agent.ts ~395-405). Errors recorded as structured `turn/end` reasons; abort yields `interrupted: true` assistant messages and "records missing tool results" for failed steps (agent.ts 380-392, 480-520).
- Model-request retry is a waterfall `agent/request-error`; with no listener the default returns `undefined` → throw (`agent.ts:560-568`). Policy lives in plugin `llm-retry` (provider-owned `retryPolicy`, `retryableCodes`, jitter; each retry durably logged before its cancellable wait) (`dsh:packages/llm/llm-retry/src/index.ts:1-4,73,213`).
- Parallel tool calls: `DEFAULT_MAX_PARALLEL_TOOL_CALLS = 10` (`dsh:packages/core/agent-loop/src/constants.ts:6`), passed to `tools.execute`. Per-tool concurrency-safety semantics: PTC doc says "concurrency-safe bodies overlap" (`dsh:docs/tool-catalog.md`, tool-executor-ptc row).
- Doom-loop: `repeat-tool-reminder` is **advisory only** — injects a reminder at 3, 5, 8 consecutive identical (name+args) calls; header says "without vetoing or rewriting calls" (`dsh:packages/guard/repeat-tool-reminder/src/index.ts:1-5,33-35`; thresholds `dsh:packages/bundle/base/cordis.patch.yml:459-463`). No hard stop found in my reads (UNKNOWN whether any other plugin halts).
- Per-tool timeouts: `tool-call-timeout-policy` in base (`cordis.patch.yml:419`); bash sandbox `timeoutMs: 60000` (`cordis.patch.yml:250-253`).
- Why it matters for MeowKit: a production kernel keeps the loop trivial and moves policy to opt-in, replaceable plugins; "one loop, no phases".

**F-D06-05 — qwen loop: hard turn cap + layered, mode-configurable loop detectors; default is WARN, not stop.** VERIFIED
- `MAX_TURNS = 100` (`qw:packages/core/src/core/client.ts:249`), `boundedTurns = Math.min(turns, MAX_TURNS)` (client.ts:5014), optional `maxSessionTurns` (client.ts:4996-5039). `DEFAULT_MAX_TOOL_CALLS_PER_TURN = 100` (`loopDetectionService.ts:202`).
- Detectors: consecutive-identical tool call stop at 5 (reminder at 3) (`loopDetectionService.ts:82`, `loop-protection.ts:~33`), content-chanting 10 (`:83`), thought repeat 3 (`:150`), file-read 8 (`:163`), stagnation/shell-inspection 8 (reminder 6) (`:167,173`), global duplicate 6 (`:179`), alternating patterns, invalid-params stagnation. `model.loopProtection` ∈ {off, warn, stop}, `DEFAULT_LOOP_PROTECTION = 'warn'` (`loop-protection.ts:~13,20`); "Budgets stop in every mode".
- Comment records origin: tolerance was "first kept below a DashScope server-side 'Repetitive tool calls detected' 400 (issue #5019), which no longer reproduces (#14828)" (`loopDetectionService.ts` ~ line 84-90). Evidence the detectors were driven by real failures, and later relaxed to warn when they over-triggered (INFERRED from #14828 wording).
- Retry: `DEFAULT_RETRY_OPTIONS.maxAttempts = 7, initialDelayMs = 1500` (`qw:packages/core/src/utils/retry.ts:100-102`); stream transport retry allow-list ECONNRESET/ETIMEDOUT/UND_ERR_* (`stream-transport-retry.ts:12-19`). Session recovery plans (`session-recovery.ts:23-51`).
- Scheduling: consecutive concurrency-safe calls merge into one parallel batch; each unsafe call is its own serial batch — `[Read, Read, Edit, Read] → [[Read,Read]‖, [Edit], [Read]]` (`qw:packages/core/src/core/coreToolScheduler.ts:1765-1780`).
- Per-turn user token budget directive (`+500k`) parsed from the user's own words only, not from attached files (`qw:core/turn-budget.ts:1-20,~60`) — a small prompt-injection-aware design.
- Counter-evidence: `client.ts` is 6,897 lines and `coreToolScheduler.ts` 8,650: the "simple loop" ideal is not what qwen shipped; complexity accreted (F-D06-26).

### 2.3 Tools

**F-D06-06 — dsh tool system: registry `ctx.tools`, JSON-Schema per tool, a single guarded pipeline with 3 waterfalls (pre-execute / execute / post-execute), monotonic guards, one-shot approval, spill of oversized output.** VERIFIED
- Pipeline (`dsh:docs/tool-execution-pipeline.md`): `tool/call` logged → `tools/pre-execute` (hooks, permission, sandbox) → monotonic guards (deny or abstain) → `tools/execute` (timeout/retry/metrics) → body → `projectContent` → `tools/post-execute` (accept/block/replace/add context) → `finalizeContent` → `tools/result`. "Absent or unanswerable [approval]: deny" (fail-closed).
- Tool catalog (generated) documents 77 `###` tool schemas (`dsh:docs/tool-catalog.md`, `grep -c '^### '`); which subset the default profile enables is composition-dependent (`cordis.patch.yml`). Core coding set: `bash` (one-shot, sandboxed; persistent PTY variant), `read`, `write`, `edit` (literal `old_string`/`new_string`, unique unless `replace_all`), optional `apply_patch`, `glob`, `grep` (packaged ripgrep, no shell), `read_image`, `skill`, `todo_write`, `subagent`(+`subagent_fork`), 4 control tools, 4 team-task tools, `workflow`, `run_code` (PTC), `web_fetch/search`, goal/schedule/jobs/LSP tools.
- Edit design: literal-replace + optional patch; read-before-write is an opt-in `fs-observation-policy`, **disabled in shipped compositions** ("mutations are unconditional unless a deployment enables it") (`dsh:docs/tool-catalog.md` tool-fs row).
- Output control: `compaction-tool-result-pruner` head 4096 / tail 1024 chars when >8192 (`dsh:packages/compaction/compaction-tool-result-pruner/src/config.ts:11-13`); `spill` stores full output (grep/glob results saved when capped).
- Tool schema set is made stable across turns; additions/removals are logged as `developer/message` tool-registry notices (`agent.ts` buildRequest). Deliberate cache-friendliness.

**F-D06-07 — qwen tool system: ~70 tool-name constants (142 lines in `tool-names.ts` incl. display aliases), `tool_search` for deferred schemas, edit via `old_string/new_string` with normalisation, PTY-backed shell, 50 MB/500 MB persistence limits, truncation preview of 2,000 chars with full-output digest.** VERIFIED
- Names include exec, edit, write_file, read_file, grep_search, glob, run_shell_command, todo_write, agent, skill, exit/enter_plan_mode, web_*, lsp, ask_user_question, cron_*, task_*, team_*, monitor, notebook_edit, tool_search, advisor, enter/exit_worktree, workflow, artifact, goal, omni_* media tools (`qw:packages/core/src/tools/tool-names.ts`). 217 `.ts` files under `tools/`.
- Truncation: `PREVIEW_SIZE_CHARS = 2000`, `MAX_SESSION_BYTES = 500MB`, `Full output sha256:` label (`qw:tools/truncation.ts:32-46`). Edit: `normalizeEditStrings` with line-based match fallback (`tools/edit.ts:324-351`); 0-match error text coaches "use read_file to verify" (`edit.ts:370`). Shell via `@lydell/node-pty` (`services/shellExecutionService.ts:15`).
- `tool_search` "Reviews function declarations for deferred tools" (`tools/tool-search.ts:153`): progressive disclosure of tool schemas, mirroring skills.
- Why it matters: both harnesses cap tool output hard and keep a head/preview; MeowKit's output-budget hooks are on the same side as production practice.

### 2.4 Context engineering

**F-D06-08 — dsh has no monolithic base prompt; the system prompt is assembled from ordered sections contributed by each mounted tool plugin; default persona is empty.** VERIFIED
- Registry `ctx.systemPrompt.section({name, order, text})`, concatenated by ascending order; 35+ plugins contribute sections (`dsh:packages/core/system-prompt/src/index.ts`; `grep systemPrompt.section(` across tool packages). Base profile: `personaPrefix: ''` — "The deployment persona is a deployment choice; plan-mode and tool plugins own their own prompt sections" (`dsh:packages/bundle/base/cordis.patch.yml:523-529`).
- So prompt size = (tool descriptions + guidance of whichever plugins are mounted). Total default size: UNKNOWN (needs `dsh --profile headless --dump-prompt`-style run; I did not run code). Runtime facts (cwd, sandbox mode) are injected as *user-role "runtime context"* messages, "without rewriting the stable system prompt" (`sandbox-policy/src/index.ts:11-14`) → cache stability by design.
- Project instructions: `AGENTS.md`, `CLAUDE.md`, plus `AGENTS.local.md`/`CLAUDE.local.md` (`dsh:packages/context/agent-instructions/src/config.ts:12-13`), maxBytes 65,536 (`cordis.patch.yml:308-311`). Loaded as *durable context messages* before the first request; nested files are projected when fs tools touch their directories (`agent-instructions/src/index.ts:1-8`). Instruction files are user-role context, not system prompt.

**F-D06-09 — dsh compaction: auto at 0.8×context window (ratio), retain 0.16, 65,536-token headroom, summary as final *user message* on the same prefix for KV-cache reuse, 1 compaction retry + 1 overflow retry; structured 8-section Markdown checkpoint.** VERIFIED
- `DEFAULT_THRESHOLD_RATIO = 0.8`, `DEFAULT_RETAIN_RATIO = 0.16` (`dsh:packages/compaction/compaction-basic/src/config.ts:20,23`), `headroomTokens ?? 65_536`, `compactionRetries ?? 1`, `maxOverflowRetries ?? 1` (`config.ts:~85-108`), per-model `modelPolicies`. Summarizer: instruction delivered "as the FINAL user message after the replayed conversation rather than as a distinct summarizer system prompt" so it shares the provider prefix cache (`summarizer.ts:27-34`); sections: Primary Request, Key Technical Concepts, Files and Code, Errors and Fixes, Pending Jobs, Current Work, Next Step (`summarizer.ts:36-58`). Also `image-offload`, `tool-result-pruner`, `/compact`.

**F-D06-10 — qwen context: ~17 KB base prompt (≈2.5k words); model-family-specific tool-call examples; QWEN.md + AGENTS.md; always-on-context budget warning; 3-tier compaction + microcompaction.** VERIFIED (size INFERRED from snapshot)
- Base prompt snapshot (no memory) = 17,137 bytes / 2,536 words (`qw:packages/core/src/core/__snapshots__/prompts.test.ts.snap` lines 1007-1146, `wc`). Token count ≈4k is INFERRED (not tokenised). Includes software-engineering workflow, git, sandbox, "reversibility and blast radius" (`prompts.ts:911-915`), tool guidance filtered by enabled tools (`prompts.ts:335-449`), optional output style. Overridable wholesale via `QWEN_SYSTEM_MD` (`prompts.ts:206-230,729-800`).
- **Per-model scaffolding:** `getToolCallExamples(model)` picks `qwenCoderToolCallExamples` / `qwenVlToolCallExamples` / `gemma4ToolCallExamples` / general by regex on the model id; env override `QWEN_CODE_TOOL_CALL_STYLE` (`prompts.ts:1379-1412`). Plan-mode reminder is a `<system-reminder>` message (`prompts.ts:1444-1504`).
- Context files: `DEFAULT_CONTEXT_FILENAME='QWEN.md'`, `AGENT_CONTEXT_FILENAME='AGENTS.md'`, `QWEN.local.md` gitignored (`qw:packages/core/src/utils/memory-constants.ts:7-15`). **`CLAUDE.md` is not in the default set**; `contextFileName` is configurable (`config.ts:1335,3938`).
- Budget: warn when always-on context (QWEN.md + auto-memory) exceeds min(15% of window, 10,000 tokens) (`config.ts:464,482,5895-5920`) — "Consider trimming long always-loaded context or moving details into on-demand files."
- Compaction: `DEFAULT_PCT = 0.85`, `AUTOCOMPACT_BUFFER 13_000`, `WARN_BUFFER 20_000`, `HARD_BUFFER 3_000`, `SUMMARY_RESERVE 20_000`, circuit-breaker `MAX_CONSECUTIVE_FAILURES = 3` (`qw:services/chatCompressionService.ts:112-145`); the comments cite Claude Code's `autoCompact.ts` constants as the model (provenance: qwen mirrors a reference implementation; the claim that it "matches claude-code" is the repo's own comment, not verified by me). Summary prompt: `<analysis>` then `<state_snapshot>` XML with 9 sections incl. `all_user_messages` (`prompts.ts:942-994`). `microcompact` replaces old tool results with `[Old tool result content cleared]` (`services/microcompaction/microcompact.ts:14`).

### 2.5 Skills / extensions / MCP

**F-D06-11 — dsh skills: `SKILL.md` + YAML frontmatter; roots `.dsh/skills`, `.agents/skills` (project), `~/.dsh/skills`, `~/.agents/skills`, custom dirs, bundled; model-invoked via `skill` tool, `disable-model-invocation` and `user-invocable` flags.** VERIFIED
- `dsh:packages/skill/skill-filesystem/src/index.ts:253-270` (roots), `:826-848` (name+description required; invalid skipped with warning), `:1019-1030` (invocation policy; legacy camelCase keys *rejected* with error). **`.claude/skills` is not a default root** — only via `customSkillDirs` config (INFERRED from the roots list). `tool-skill` injects catalogs via `agent.inject()` as user messages. Office skills add tools on load (`tool-office` "Declared … from the step after it successfully loads an Office skill").
- Extension model: Cordis plugins + "bundles" + profiles; `plugin_manager` tool lets the *agent* install bundles but requires danger-full-access or per-call approval (`dsh:docs/tool-catalog.md` plugin-manager row). `dsh-plugin` GitHub topic for discovery (`dsh:README.md`).

**F-D06-12 — qwen skills/extensions: `SKILL.md` in `.qwen/skills` and `.agents/skills`; `paths:` glob conditional activation; `disable-model-invocation`; `allowedTools`, `hooks`, `model` in frontmatter; extensions installable from Claude Code plugins, Gemini extensions, Qoder.** VERIFIED
- `SKILL_PROVIDER_CONFIG_DIRS = ['.qwen', '.agents']` (`qw:packages/core/src/config/storage.ts:17`); first dir wins on duplicate name (`skills/skill-manager.ts:~1120-1140`); `paths:` globs rebuild an activation registry (`skill-manager.ts:521-557`); `disableModelInvocation` skills hidden from the model (`:532-542`); `SkillConfig` fields `allowedTools`, `hooks`, `model` (`skills/types.ts:56-71`). Custom slash commands from `.toml` and `.md` (`cli/src/services/FileCommandLoader.ts:53,102-110`).
- Extension converters: `claude-converter.ts` ("Converter for Claude Code plugins to Qwen Code format", `:1-10`) maps plugin `commands/agents/skills/hooks` and `.mcp.json`; rewrites `.claude` path refs to `.qwen` in markdown/shell (`extension/variables.ts:206-207,262-263`); hostile-path hardening (`claude-converter.ts:573-600`, `archive-safety.ts`). Agent frontmatter schema "Mirrors Claude Code 2.1.168's `.claude/agents/<name>.md` schema verbatim" (`subagents/agent-frontmatter-schema.ts:10`). `claudeMcpImport.ts` imports Claude Code / Desktop MCP servers.
- Why it matters: qwen has already built the closest thing to a "MeowKit adapter" (a Claude-plugin → host converter) and it is lossy by construction (see §4 table and F-D06-21).

**F-D06-13 — MCP: both support it with explicit server identity and trust handling.** VERIFIED (shallow)
- dsh: tool identity is `(serverName, rawName)` with local namespace; "the remote name is untrusted … none of which may silently rename model-facing tools" (`dsh:packages/mcp/mcp-client/README.md:119`). qwen: `mcpApprovals.ts` (hash-bound, like hooks, F-D06-17), `mcp-server-secrets.ts`, workspace-budget and pooled transports (`qw:cli/src/config/`, `core/src/tools/mcp-*.ts`).

### 2.6 Hooks

**F-D06-14 — dsh has two hook systems: native Cordis event waterfalls (full power, TS plugin) and an *experimental* Claude-Code-hooks bridge that supports only 7 events and runs command hooks serially.** VERIFIED
- Native extension points (`agent/pre-step`, `tools/pre-execute`, `tools/post-execute`, `agent/turn-stopping`, `agent/request-error`, `session/*`) can reject/rewrite (`dsh:docs/architecture.md` Events; `tool-execution-pipeline.md`).
- Bridge `@deepseek-ai/dsh-hooks-claude-code` (package lives under `packages/experimental/`): `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `Stop`, `SubagentStart`, `SubagentStop` only (`dsh:packages/experimental/hooks-claude-code/README.md:60-68`). Exit 2 = block with stderr as reason; other non-zero = non-blocking (`hook-protocol/src/codec.ts:2-5,66`); `deny > ask > allow` fold; default timeout 600,000 ms (`runner.ts:14-17`); config read once at startup, unreadable config ⇒ **no hooks, agent still starts**; hook that crashes ⇒ **logged, agent continues** (README "How hooks run and fail") ⇒ **fail-open**. `transcript_path` is always `''`. `SubagentStart/Stop` matcher is the constant `general-purpose`; `SubagentStop` cannot block. No `PreCompact`, `SessionEnd`, `Notification`, `PermissionRequest`.
- Counter-evidence: README says it is "A compatibility adapter, not a power tool."
- MeowKit impact: MeowKit's blocking write guards (`gate-enforcement`, `privacy-block`, `pre-ship`) could run here for `PreToolUse` on dsh tool names, but dsh tool names differ (`edit`/`write`/`bash` lowercase vs Claude `Edit`/`Write`/`Bash`) so matchers and tool-input field names would need translation (UNKNOWN: whether the bridge normalises names — `claude-code-mods/src/tool-names.ts` exists; not read).

**F-D06-15 — qwen hooks: 24 events, 4 hook types (command, HTTP, prompt, function), exit-code semantics differ subtly from Claude Code; PreToolUse infrastructure errors fail open; project hooks need hash-bound approval.** VERIFIED
- Events (`qw:packages/core/src/hooks/types.ts:24-70`): PreToolUse, PostToolUse, PostToolUseFailure, PostToolBatch, Notification, UserPromptSubmit, UserPromptExpansion, SessionStart, Stop, MessageDisplay, SubagentStart/Stop, PreCompact/PostCompact, SessionEnd, SessionDelete, PermissionRequest, PermissionDenied, StopFailure, TodoCreated, TodoCompleted, InstructionsLoaded, FileChanged.
- Timeouts: command 60 s, HTTP 600 s, prompt 30 s, function 5,000 ms (`hooks/hook-timeout.ts:14-30`).
- Exit codes: JSON path treats `exitCode === 2` as blocking and uses stderr only (`hookRunner.ts:1649-1652`); plain-text path: 0 ok, 1 non-blocking warn, **"All other non-zero exit codes (including 2) are blocking" → `deny`** (`hookRunner.ts:1804-1816`). So exit 127/126/3 from a broken hook script *denies* the tool call — fail-closed on script breakage, unlike Claude Code semantics for non-2 codes (the Claude side is DOCUMENTED knowledge only; I did not re-verify it live). A killed/timeout process (`exitCode === null`) is a failure, not success (`hookRunner.ts:1718-1734`).
- Infra errors: `PreToolUse hook error … return { shouldProceed: true }` — "Hook errors should not block tool execution" (`qw:core/toolHookTriggers.ts:245-250`) ⇒ **fail-open on thrown errors**. Two policies coexist (script-denies vs runner-throws-allows).
- Trust: user/system hooks always load; **project hooks only in trusted folders** (`hookRegistry.ts:297-314`) and additionally approval is persisted per project bound to a hash of the hooks block and env sources, changes return it to `pending` (`qw:packages/cli/src/config/hook-approvals.ts:35-47`). Precedence for execution: Project, User, System, Extensions (`hookRegistry.ts:~295`).
- PreToolUse can also return `updatedInput` (rewrite) and `ask` (`toolHookTriggers.ts:225-240`).

### 2.7 Security

**F-D06-16 — dsh security: OS-enforced *file-write* sandbox (Seatbelt / bwrap / Landlock / Windows ACL), approval = `ask|never`, escalation via `sandbox_permissions`; no command-string rule engine; network not covered by the sandbox profile I read; authors disclaim it as a security control.** VERIFIED (network INFERRED)
- macOS profile: `(allow default)`, `(deny file-write*)`, allow write only to `/dev/null` and workspace roots (`dsh:packages/sandbox/sandbox-local/src/profiles.ts:53-58`). Linux: bwrap first, Landlock launcher fallback (`profiles.ts:12-35`; `sandbox-local/src/index.ts:2`). Reads unrestricted; no network deny in that profile (INFERRED from the SBPL text).
- Modes `read-only | workspace-write | danger-full-access`; base default `workspace-write` + approval `ask`; env `DSH_PERMISSION_MODE` (`cordis.patch.yml:240-276`). Approval `never` rejects escalations automatically (`user-approval/src/index.ts:75`). In-process fs fence `fs-sandbox` shares writable roots with Seatbelt so they "can never drift apart" (`profiles.ts:44-50`).
- `grep -ri allowedCommands|commandRules|denyList` over `packages/` found nothing → no command allow/deny parsing like Claude/Qwen (INFERRED; shallow).
- `SAFETY.md:5,9`: not audited; "Do not rely on DeepSeek Harness as the sole security control for untrusted workloads." Telemetry default `FEEDBACK_ONLY` mode: session-log prefix released only after explicit user feedback; `DSH_TELEMETRY_DISABLED` opt-out (`cordis.patch.yml:203-232`).
- Why it matters: the only host-*enforced* controls are kernel sandbox + approval; everything else (guards, hooks) is a plugin in the same trust domain. Matches MeowKit's own honest split.

**F-D06-17 — qwen security: 5 approval modes incl. LLM classifier ("auto"), AST-based shell analysis, rule engine, bwrap/Landlock/Seatbelt/container sandbox, folder trust, hash-bound approval of project hooks and MCP.** VERIFIED
- `ApprovalMode`: plan, default, auto-edit, auto, yolo (`qw:core/src/config/approval-mode.ts:8-12`). Permission manager parses rules, compound commands, shell-operation semantics, read-only AST check (`permissions/permission-manager.ts:8-30`); `dangerousRules.ts`, `destructive-commands.ts`, `denialTracking.ts`. AUTO mode: 2-stage LLM classifier, stage 1 ≤256 tokens thinking off; unrecovered failure ⇒ `shouldBlock=true, unavailable=true` (fail-closed) (`permissions/classifier.ts:3-18`).
- Sandboxes: `sandbox/{bwrap,landlock}-execution.ts`, macOS `.sb` profiles incl. `restrictive-proxied` (network via proxy) and `restrictive-open` (`cli/src/serve/sandbox-macos-restrictive-*.sb`; `restrictive-open` = `(deny default)`, `(allow file-read*)`…), Docker/Podman via `SANDBOX` env. The sandbox is opt-in (settings/flag); default state UNKNOWN (not traced).
- Workspace trust gates project hooks/settings (`hookRegistry.ts:297-314`, `config.ts:2795,4051`); `SECURITY.md` is only a disclosure portal.
- Usage statistics `usageStatisticsEnabled ?? true` (`config.ts:3657`) sends to an aliyun RUM host (`telemetry/qwen-logger/qwen-logger.ts:83`) unless disabled — default-on telemetry (contrast dsh).
- Memory: team memory has a gitleaks-subset secret scanner before write (`memory/secret-scanner.ts:1-15`).

**F-D06-18 — Neither harness offers a prompt-level defence as primary control.** VERIFIED (absence INFERRED from reads)
- Both put authority in code (sandbox, approval, trust hashes). Only user-turn budget parsing ignoring attached text (F-D06-05) and "untrusted remote MCP names" (F-D06-13) are injection-aware in what I read. Hook payloads from third parties are stripped of ANSI/control chars before reaching the model (`hookRunner.ts:1790-1796`).

### 2.8 Subagents / multi-agent

**F-D06-19 — dsh: one generic `subagent(description, prompt, name?, cwd?)` tool; no specialist agent definitions; default max depth 1; children are separate Sessions with durable state; results returned via completion notice; team = shared task board only.** VERIFIED
- Schema: `dsh:docs/tool-catalog.md` tool-subagent (prompt "does not share this conversation's context, so include everything it needs"); `maxDepth` default 1 (`dsh:packages/subagent/subagent/README.md`); providers: in-process spawn/fork, ACP, DSH SDK, **Codex, Claude Code** (`README.md`). "Local spawn and fork children retain durable sessions…; ACP, DSH SDK, Codex, and Claude Code execute once."
- Team: 4 `team_task_*` tools on a shared board; "Task changes do not end inbox waits, add inbox messages, or start idle agents. Send an explicit message when an agent needs to act" (`dsh:docs/subsystems/agent-team.md`). Roster/mailbox types are "historical" — **the earlier mailbox design was retired** (F-D06-24). Worktree: experimental `create_worktree` tool only.
- No named role agents (reviewer/tester/…) in the shipped base — roles, if any, are prompts the parent writes. (Agent *presets* are config compositions, `packages/preset`.)

**F-D06-20 — qwen: Claude-Code-shaped subagents (`general-purpose`, `Explore`, `statusline-setup`, `review-agent`, `claude-code`, `codex`), user agents in `.qwen/agents/*.md`, `isolation: 'worktree'`, background by default, fork subagents, Agent Teams, script-driven workflows.** VERIFIED
- `qw:core/src/subagents/builtin-agents.ts:17,40,51,71,128,280,384,393`; frontmatter schema copies Claude Code's (`agent-frontmatter-schema.ts:10`); `.qwen/agents` (`subagent-manager.ts:94,1014`). Tool params `subagent_type`, `run_in_background`, `isolation:'worktree'` → temporary worktree under `.qwen/worktrees/agent-<hex>`, auto-removed if no changes (`tools/agent/agent.ts:279-309`); background default true (`agent.ts:417`); nested agents foreground-only (`agent.ts:417`). Also `agents/team/*` (mailbox, board lock, leader permission bridge), `agents/arena`, `agents/runtime/workflow-*` (script workflows with journal, budget, sandbox, stall watchdog).

### 2.9 Memory

**F-D06-21 — qwen has agentic auto-memory (extract/dream/recall) with team memory + secret scanner; its own tuning flags admit insufficient evidence ("not a user setting until paired runs show…"). dsh has no memory subsystem beyond session log/query.** VERIFIED
- qw: `memory/{extract,dream,recall,relevanceSelector,forget,store,team-memory-sync,secret-scanner,trusted-memory-filesystem}`. Extractor reads last 40 curated entries (`extract-cadence.ts:23`); skip-N-turns after no-op is "Off (0) unless set; not a user setting until paired runs show no missed or late memories" (`extract-cadence.ts:9-12`); recall selector skip is "not a user setting until an ablation shows recall quality is unchanged" (`recall-experiment.ts:7-8`). Meaning: they run paired/ablation evaluations on *memory cost knobs*, but this repo does **not** contain a measured benefit of memory on task success (UNKNOWN; `grep` of docs found only SWE-bench version table, F-D06-23).
- dsh: `session-query` tools (`session_search`, `session_event_read/trace`) let the agent search past sessions, opt-in (`tool-catalog.md` session-query row); `harness-dev-context`. No write-side memory plugin found (INFERRED from package list).

### 2.10 Observability

**F-D06-22 — dsh: append-only typed session event log is the single source of truth (JSONL, Zstd-compressed by default), OTel plugin gated on explicit feedback; qwen: full OTel (gen_ai attrs, traces/metrics/logs), local recording, default-on usage-stats to vendor.** VERIFIED
- dsh: durable events `turn/*`, `step/*`, `tool/*`, `request/header|context`, `hook/invoked|result` (`architecture.md`); hook bridge notes the log is "Zstandard-compressed … not readable by hook scripts" (`hooks-claude-code/README.md`, payload section). Token meter plugin `cordis.patch.yml:353`. Third-party plugin can subscribe to events in-process; external observers need the SDK JSON-RPC (`dsh-sdk-app`) or ACP.
- qw: `telemetry/{gen-ai-*.ts,metrics.ts,hook-lifecycle.ts,file-exporters.ts,sdk-exporters-{grpc,http}.ts,detailed-span-attributes.ts}`; `chatRecordingService`; hooks events `PostCompact`, `StopFailure`, `SessionEnd` give a script-level view; `context-usage.ts`.
- MeowKit impact: hooks are the only observation surface on qwen without code; on dsh only the 7 bridged events.

### 2.11 Model adaptation

**F-D06-23 — Neither harness removes scaffolding as models improve; both vary scaffolding by *provider/model family* (mostly protocol/capability, not "smartness").** VERIFIED (negative INFERRED)
- dsh: `agent-default-model`, per-model compaction `modelPolicies` (`compaction-basic/src/config.ts:~100-130`), reasoning effort `off|low|high|max` for DeepSeek (`llm-deepseek/src/config.ts:22-25,94-95`), `dsh-trim-cot-leakage` repo skill name. Image capability gates tools at execution ("refuses unless the exact routed model declares image input", tool-catalog). Hook/skill/prompt sections are composition choices, not capability-adaptive.
- qw: tool-call example blocks per model family (F-D06-10), reasoning-effort ladder low…max clamped per provider (`reasoning-effort.ts:18-38`), `modalityDefaults`, `tokenLimits`, `anthropic-reasoning.ts`, `deepseek-reasoning.ts` (qwen supports DeepSeek models). Fallback models: `advisor` tool + `advisor-policy.ts` (second-opinion model); classifier uses a "distinct session model" on deadline (`classifier.ts:16`).
- No evidence of "turn off X for stronger models". UNKNOWN whether anything like that exists in unread provider adapters.

### 2.12 Testing / evaluation

**F-D06-24 — dsh `BENCHMARK.md` is 3 lines and `benchmarks/` measures harness *performance* (latency, heap, scaling), not agent task success. Agent correctness is tested with recorded-session snapshot replay + opt-in real-API e2e; coverage gate is per-file 100%.** VERIFIED
- `dsh:BENCHMARK.md` content: only "Follow Get started with the Python SDK … run the `jsonrpc-agent` minimal variant. Use separate workspaces and session IDs for independent benchmark tasks." No scores, tasks, controls.
- `dsh:benchmarks/AGENTS.md`: "required, repository-level performance gates"; dirs `active-stream-reconnect, agent-continuation, conversation-fold, long-session-browser, session-corpus, session-open, terminal-io, user-text`; synthetic fixed inputs; budgets enforced; "environment variables must not override performance budgets". No SWE-bench/terminal-bench/HumanEval string anywhere in the repo except a bug note on read-guidance line ranges (grep).
- Test tiers (`dsh:docs/testing.md`): unit (vitest) with **per-file 100% coverage CI gate**; real-API e2e that self-skip without key ("We are DeepSeek — do not ration real-API tests… only a with-key run proves the agent works against a real model"); `test:snapshot` keyless replay of recorded sessions through shipped profiles, required for every "non-trivial model-, protocol-, or human-visible change"; "Verify the world, not the self-report … re-run the command or re-read the file externally… Assert untouched files are byte-identical"; "Prefer the real implementation over a mock … mock only LLM adapter, network, clock"; postmortems `docs/postmortem/0001-0003`.
- Reproducibility of any task-success number from the repo: **not applicable — none published**. A "benchmark" claim in README/BENCHMARK.md would be CONTRADICTED by contents if read as model-quality evidence.
- Why it matters: strongest published *testing philosophy* of the two (real entry path, world-verified e2e, no self-report), but zero outcome evidence on task success.

**F-D06-25 — qwen publishes one outcome series: SWE-bench Verified across 7 releases, same model, 3 trials each — spread 1.40 pp (76.40–77.80%) over 0.0.14→0.22.0 despite a very large codebase growth.** DOCUMENTED (not reproduced; raw trajectories live in release assets/OSS, not in repo)
- `qw:docs/evaluation.md`: 500 cases, 3 trials, "Qwen 3.7 Max" (name as given by the repo; I cannot verify the model), temp 1, top_p 0.95, `reasoning_effort=high`, 1M context, `max_iterations=500`, 7,200 s timeout. Table: 77.80 / 76.73 / 76.60 / 76.47 / 77.67 / 76.40 / 77.33 %; pass^3 65.8–69.2 %.
- Release pipeline: manifest frozen, 10 executors, Harbor/Docker trial per task, score written only if all 500 reach terminal state and `EXECUTION_ERROR + INFRA_FAILED < 10`, else `QUARANTINED` (`qw:docs/design/dsw-swe-verified-release-pipeline.md`).
- Reading (INFERRED, premises: same model/config; 3 trials; per-version noise unreported): releases from 0.0.14 to 0.22.0 added subagents, hooks, memory, skills, compaction changes (CHANGELOG/commit volume) yet SWE-bench Verified did not move beyond what looks like run noise. Either the benchmark is insensitive to those features (it is single-issue, no long-horizon), or they do not improve this metric. Neither reading supports "more scaffolding ⇒ better solve rate" and neither refutes that scaffolding helps on other tasks (UNKNOWN). Also stops at 0.22.0 while HEAD is 0.27.x.
- Other testing: ~3,596 `*.test.ts(x)` files; `integration-tests/` incl. fake OpenAI/DashScope servers, terminal-bench runner (`integration-tests/terminal-bench/terminal-bench.test.ts`, no results in repo), live-host tests, hook integration, perf baselines (`baselines/hosted-latency.json`).

### 2.13 Cross-cutting design lessons

**F-D06-26 — Neither production harness has rigid phase gates.** VERIFIED (absence)
- No plan→test→build→review state machine in either kernel. Closest: dsh `plan-mode` (an `exit_plan_mode` tool presenting plan for approve/keep-planning, `dsh:tool-catalog.md`), `goal` rounds (create/edit require human authority), qwen `enter/exit_plan_mode`, ApprovalMode `plan`, plan-mode shell policy (`qw:core/src/core/plan-mode-shell-policy.ts`), and `workflow`/`ralph` script loops. Human approvals gate *actions* (permission), not *phases*.
- Contradicts H3's premise only in the weak sense that no host ships gates; it does not show gated workflows lose (no A/B in either repo — UNKNOWN).

**F-D06-27 — Always-on prompt budgets: dsh minimal by construction; qwen ≈17 KB base + user files with an explicit budget warning.** VERIFIED
- dsh default persona empty, instruction files capped 64 KiB (F-D06-08). qwen warns when always-on > min(15% window, 10k tokens) (F-D06-10). Compare MeowKit's own always-on rules/CLAUDE.md (not measured here).

**F-D06-28 — Neither relies on specialist-role subagents; both treat subagents as context-isolation/offload.** VERIFIED
- dsh: one generic delegate tool, depth 1, tool description is "offload focused, independent work … so it does not consume this conversation's context". qwen: Claude-shaped set (Explore, general-purpose, review-agent) but the justification in tool text is the same. Neither repo contains data showing multi-agent beats single-agent (UNKNOWN).

**F-D06-29 — dsh *removed* its earlier Team mailbox/roster design; kept a task board.** VERIFIED (history INFERRED)
- "Historical roster value written by earlier Team builds"; "The following historical mailbox types remain readable; Team never delivers their pending records" (`dsh:docs/subsystems/agent-team.md`). Signals that a heavier multi-agent coordination layer was tried and replaced in ≤5 months. Rationale note exists at `.agents/notes/implemented/architecture/2026-10-19-team-task-board-inbox.md` (not read).

**F-D06-30 — qwen's own AGENTS.md leads with "Simplicity First … This is the principle we care about most … If you write 200 lines and it could be 50, rewrite it" while the codebase has 6.9k-line and 8.7k-line core files.** VERIFIED (`qw:AGENTS.md:3-14`, `wc -l`)
- Stated minimalism ≠ outcome. Useful warning for MeowKit's own H8.

**F-D06-31 — Real-world pain points show up as *detector tuning*, not more phases.** VERIFIED
- Loop protection relaxed to warn (#14828), tool-call dedupe tied to a provider 400 (#5019), compaction circuit breaker after 3 failures, `MAX_TURNS`. Problems solved with small mechanical guards + reminders.

## 3. Contradictions

| Item | Docs/claim | Source | Label |
| --- | --- | --- | --- |
| dsh "benchmark" | `BENCHMARK.md` suggests benchmarking the harness via Python SDK | 3-line file; `benchmarks/` = perf gates only; no task-success data | CONTRADICTED if read as quality benchmark |
| dsh hook bridge "run your existing Claude Code hooks.json" | README | Supports 7 events; `transcript_path` always `''`; matcher for subagents constant; experimental package | PARTIAL (documented limits, not contradicted) |
| qwen hook exit codes | JSON path: only exit 2 blocks (`hookRunner.ts:1649`) | plain-text path: every non-0/1 exit blocks (`:1804-1816`) | internal inconsistency, VERIFIED |
| qwen hook failure | "Hook errors should not block tool execution" (`toolHookTriggers.ts:245`) | script exit ≥2 does deny | two fail policies, VERIFIED |
| qwen "Simplicity First" | `AGENTS.md:3` | 6,897-line `client.ts`, 8,650-line `coreToolScheduler.ts` | stated vs observed |
| qwen loop protection | name suggests protection | default `warn` (`loop-protection.ts` DEFAULT) | semantics note |
| qwen skills dirs comment | "`.qwen > .agent > .cursor > ...`" (`skill-manager.ts:1123`) | `SKILL_PROVIDER_CONFIG_DIRS = ['.qwen','.agents']` | stale comment, VERIFIED |
| dsh `fs-observation-policy` (read-before-edit) | exists | disabled in shipped compositions (`tool-catalog.md`) | policy exists but off |

## 4. Extension-surface tables (MeowKit-targeting view)

Fidelity legend: ENFORCED = host executes it deterministically; ADVISORY = injected into model context only; N/A = no such surface.

### 4.1 deepseek-harness (`dsh`)

| Surface | Format / location | Enforceable? | Notes for a MeowKit adapter |
| --- | --- | --- | --- |
| Native plugin (Cordis TS) | npm package + `dsh.bundle`/`dsh.profile` in `package.json`; installed via `dsh plugin` | ENFORCED (full API: waterfalls on pre-step/pre-execute/post-execute/turn-stopping, guards) | Only route to Gate-style enforcement beyond command hooks. Requires writing TS against pre-stable APIs ("compatibility-breaking changes"). |
| Claude-hooks bridge | `configPath` to `hooks.json`/settings `hooks`; command hooks | ENFORCED for `PreToolUse` (deny/ask), `UserPromptSubmit`, `Stop`; context for `SessionStart`/`PostToolUse`; **fail-open** on crash/bad config | 7 events only; tool names differ; no `PreCompact`/`SessionEnd`; `.claude/settings.json` hooks could be pointed at directly, but MeowKit's `dispatch.cjs`/`handlers.json` observers would lose events outside the 7. Experimental package. |
| Skills | `SKILL.md` frontmatter `name`, `description`, `disable-model-invocation`, `user-invocable`; roots `.dsh/skills`, `.agents/skills`, `~/.dsh|agents/skills`, `customSkillDirs` | ADVISORY (model invokes `skill` tool); catalog injected via user messages | `.claude/skills` not default; MeowKit `mk:` skills could be mirrored to `.agents/skills`. Legacy camelCase keys rejected. Unknown extra frontmatter fields: UNKNOWN. |
| Agents dir | none (single generic `subagent` tool; presets are config) | N/A | MeowKit's 44 role agents have no native landing spot; must become skills or prompts. |
| Slash commands | `dsh-commands` plugin (e.g. `/goal`, `/compact`) | ENFORCED (code) | Command file format for user-defined commands: UNKNOWN (not read). |
| Instruction files | `AGENTS.md`, `CLAUDE.md`, `*.local.md`, cap 64 KiB, nested on touch | ADVISORY | MeowKit CLAUDE.md would be read as-is, as a user-role context message. |
| MCP | `mcp-client`/`mcp-manager`; stable `(server, rawName)` ids | ENFORCED transport; tool trust = model | Same MCP servers usable. |
| Settings/permissions | `cordis.patch.yml` rows, `DSH_PERMISSION_MODE`, presets | ENFORCED (sandbox + approval) | No Claude-style allow/deny rule file to target. |
| Observability | in-process events; SDK JSON-RPC; ACP | read-only | Third party outside process: SDK/ACP only. |

### 4.2 qwen-code

| Surface | Format / location | Enforceable? | Notes for a MeowKit adapter |
| --- | --- | --- | --- |
| Hooks | `.qwen/settings.json` / user / system / extension; command, HTTP, prompt, function types; 24 events | ENFORCED: PreToolUse deny/ask/updatedInput; UserPromptSubmit; Stop; PermissionRequest; PreCompact… | Superset of Claude's events. Project hooks need folder trust + hash-bound approval (a one-time human step on install/change). Exit-code semantics differ (non-0/1 ⇒ deny). Tool names differ (`run_shell_command`, `read_file`, `write_file`, `edit`). |
| Skills | `SKILL.md` in `.qwen/skills`, `.agents/skills`; `paths:` globs, `allowedTools`, `hooks`, `model` | ADVISORY (+ skill-scoped hooks `registerSkillHooks.ts`) | `.claude/skills` not scanned → copy/convert. |
| Agents | `.qwen/agents/*.md`, Claude-compatible frontmatter schema; built-ins `general-purpose`, `Explore`, `review-agent` … | ADVISORY prompts + tool allowlists (frontmatter `tools`/`disallowedTools`: converter parses them; enforcement path UNKNOWN) | Closest match to MeowKit's `.claude/agents/`; `isolation:worktree`, `background`, `skills`, `hooks` fields. |
| Commands | `.qwen/commands/*.toml` and `*.md` | prompt expansion + `UserPromptExpansion` hook | MeowKit `/mk:` command .md files could be mirrored. |
| Plugin/extension | `qwen-extension.json`-style; converters for Claude plugin (`commands/agents/skills/hooks/.mcp.json`), Gemini, Qoder; marketplace | install-time conversion; path rewrite `.claude→.qwen` | Existing path for shipping MeowKit as a Claude plugin; fidelity is whatever the converter maps (lossy for settings.json, rules, permissions — UNKNOWN beyond the five listed resource kinds). |
| Instruction files | `QWEN.md`, `AGENTS.md`, `.qwen/rules`(`rulesDiscovery.ts`); `contextFileName` configurable | ADVISORY; budget warning at 15%/10k tokens | `CLAUDE.md` needs `contextFileName` setting or a copy. |
| MCP | `.mcp.json` / settings; Claude import tool | transport ENFORCED; hash-bound approval | — |
| Settings | `.qwen/settings.json` precedence system/user/project(trusted) | ENFORCED | No reading of `.claude/settings.json`. |
| SDKs | TS/Python/Java SDK, ACP, headless | programmatic | Allows external orchestrator/observer. |

### 4.3 Per-mechanism MeowKit applicability (brief)

| Mechanism | Problem it solves | Usable by a host-layered toolkit? | Adapter needs | Cannot enforce on this host |
| --- | --- | --- | --- | --- |
| Pre-execute guard waterfall (dsh) / PreToolUse hook (qwen) | Block/rewrite a tool call deterministically | qwen: yes (hooks). dsh: only via bridge (fail-open) or native TS plugin | Tool-name/arg translation; trust approval on qwen | dsh bridge: guarantee of block when the hook script crashes; hook-script integrity |
| Stop hook / `agent/turn-stopping` | Force another step before finishing (e.g. verify) | both | map output schema | qwen `Stop` cap exists (`stopHookCap.ts`) — limit UNKNOWN |
| Skills | On-demand procedure loading | both (path copy) | dir mapping | Whether the model actually invokes them |
| Subagent definitions | Context isolation, role prompts | qwen yes; dsh no (generic only) | agent .md conversion | Tool restriction fidelity UNKNOWN |
| Plan/approval gate | Human approval before code | host plan-mode is tool-level, not file-state gate | Gate by hook reading plan file (qwen) | Plan-hash receipt freshness is MeowKit's own invention; host has none |
| Memory | Cross-session knowledge | qwen has its own auto-memory (could conflict/duplicate); dsh none | file-based memory read by instructions | Write validation by host |
| Compaction hooks | Preserve invariants across compaction | qwen `PreCompact/PostCompact`; dsh none in bridge | re-inject rules after compaction | Anything dsh-side beyond instruction re-projection |

## 5. Decisions proposed

| # | Class | Observed problem / evidence | Affected MeowKit source (not audited by me) | Causal hypothesis | Alternatives | Measure |
| --- | --- | --- | --- | --- | --- | --- |
| D-06-1 | NEEDS MORE EVIDENCE | Neither production harness has rigid phase gates; qwen SWE-bench flat over 7 releases (F-D06-25, -26) | Gate 1/Gate 2 rules, phase workflow | Gates protect against *human-process* failures (unreviewed ship), which SWE-bench does not measure | keep gates only at irreversible actions (ship/commit), make earlier phases advisory | A/B: gated vs adaptive on multi-file, ambiguous tasks; metrics = rework commits, escaped defects, tokens |
| D-06-2 | IMPROVE (measurement) | MeowKit claims need outcome evidence; dsh publishes none, qwen publishes one flat series | `mk:benchmark`, README claims | Without a fixed-model before/after series MeowKit's value is unfalsifiable | Reuse qwen's protocol (same model, 3 trials, pass@3/pass^3, quarantine rule) | Run host-native vs +MeowKit on same tasks |
| D-06-3 | EXPERIMENT | Always-on prompt size: qwen warns at min(15% window, 10k tokens) | `CLAUDE.md`, `.claude/rules/*`, injected hook context | Large always-on text dilutes attention and costs cache | Add a budget check to `mk:context-audit`-like tooling modelled on qwen's formula | tokens of always-on per session vs success on fixed tasks |
| D-06-4 | KEEP | Both hosts enforce via OS sandbox + approval; prompt rules are advisory | `security-rules.md`, `injection-rules.md` | Honest split already matches SAFETY.md of dsh | — | — |
| D-06-5 | IMPROVE | Hook exit semantics and fail-open/closed differ between hosts (F-D06-14/15) | `gate-enforcement.cjs`, `privacy-block.cjs`, `pre-ship.cjs` | A crashing guard silently allows on dsh bridge / qwen throw-path | Make guards fail closed explicitly by emitting a structured deny on any internal exception; add a self-test hook ping | Test: inject fault, assert deny |
| D-06-6 | DEFER | Targeting dsh: pre-stable APIs, experimental bridge, 7 events, no agents dir | adapter layer in `packages/mewkit` | High churn cost vs unknown user demand | Support qwen first (Claude-plugin converter + superset hooks) | Prototype: install MeowKit as plugin into qwen, run fixed task, diff behaviour |
| D-06-7 | EXPERIMENT | qwen already converts Claude plugins; MeowKit could ship a qwen-compatible plugin layout instead of a bespoke adapter | installer CLI | Reuse beats maintain-own-adapter | Own adapter | Count of MeowKit assets surviving conversion (hooks/agents/skills/commands) |
| D-06-8 | SIMPLIFY (candidate) | dsh dropped Team mailbox for a task board; qwen reminders at 3/5 repeats suffice as loop guard | multi-agent coordination, loop-related rules | Heavy coordination protocols were replaced by minimal state | Keep only task board + explicit messages | Compare coordination failures before/after |
| D-06-9 | REJECT (copying) | qwen's 24-event hook system, LLM classifier, arena, omni tools — no evidence they improve outcomes | — | Exists ≠ works | — | — |
| D-06-10 | NEEDS MORE EVIDENCE | Memory: qwen runs paired/ablation tests only on cost knobs; no benefit data | `.meowkit/memory` (absent in checkout) | Memory helps only if recalled and correct | Measure recall hit-rate and downstream pass rate | Same task set with/without memory dir |

## 6. Experiments proposed (to falsify my conclusions)

1. **Hook fail-open probe.** On dsh bridge and qwen, register a PreToolUse hook that exits 127 (missing interpreter) and one that throws; observe allow vs deny. Falsifies F-D06-14/15 fail-semantics claims. (Needs executing the hosts — outside this read-only task.)
2. **Tool-name translation test.** Run MeowKit `gate-enforcement.cjs` unchanged on qwen (hooks in `.qwen/settings.json`) and dsh bridge; record which `tool_name` values arrive and whether `Write|Edit` matchers fire. Falsifies "adapter is cheap".
3. **Prompt-size measurement.** Dump the dsh default assembled system prompt + tool schemas and qwen's with default settings; tokenise. Fills F-D06-08 UNKNOWN and tests "dsh is minimal".
4. **Scaffold ablation on qwen.** Same model; run SWE-bench Verified subset with skills/memory/subagents/loop-protection toggled (qwen exposes flags) — tests whether flat score (F-D06-25) is insensitivity vs no-effect, and whether `warn` vs `stop` matters.
5. **Gated vs adaptive workflow A/B** on tasks longer than SWE-bench (multi-file features), host fixed.
6. **Claude-converter fidelity audit.** Convert MeowKit into a plugin via qwen's converter; diff the output tree vs source to list dropped assets.

## 7. Unresolved questions

- dsh: total default system-prompt + tool-schema size; default enabled tool count per profile (headless vs web); whether any plugin hard-stops identical-call loops; hook-bridge tool-name normalisation; custom slash-command file format; whether `sandbox-policy` restricts network anywhere; contents of `.agents/notes` rationale (e.g. team mailbox retirement).
- dsh: why `benchmarks/` carries no task-success suite; is one planned or private?
- qwen: is the sandbox on by default per platform; exact behaviour when a Claude `settings.json` permission rule set is converted; whether subagent `tools`/`disallowedTools` are enforced by the scheduler (not read); how `Stop` hook cap (`stopHookCap.ts`) limits forced continuation.
- qwen: raw per-trial data behind the SWE-bench table, variance estimate, and results for 0.23-0.27 (not in repo).
- Whether qwen's "Qwen 3.7 Max" is a released model (not verified; model names in repo docs are taken as the repo states them).
- Claude Code's own exit-code semantics for non-2 non-zero codes were not re-verified live; comparison in F-D06-15 relies on my prior knowledge (stale risk) and on dsh's `codec.ts` stating "both reference schemas … every other exit is a non-blocking error".
