# 04 — Harness comparative study

Compiled 2026-11-15 from `findings/D06`, `D07`, `D09`, `D10` and `R2`. Baseline for MeowKit statements: `main` @ `c7ff0a9e`. Nothing here was re-executed; "VERIFIED" means read in source by the cited finding, not run. Citation form: `F-D06-04` = finding in D06; `R2 §4` = R2 section; `D10 §2C` = D10 matrix section.

## 1. Summary

- **Established (VERIFIED, source read):** none of the four source-read production-style harnesses (deepseek-harness, qwen-code, hermes-agent, rig) has a rigid plan→test→build→review state machine. Human approval gates *actions* (permission prompts), not *phases* (F-D06-26, F-D07-01, F-D07-17). None ships named specialist subagents as a default; two (dsh, hermes) use one generic delegate tool, rig's subagents are off by default (F-D06-19, F-D07-08, F-D07-24). This is design data, not proof that gates or specialists are worse: no harness has an A/B on either.
- **Established:** every source-read harness that discusses security says the OS is the real boundary and prompt/rule/approval/scanner layers are heuristics (F-D07-10, F-D06-16). MeowKit's own docs make the same split (F-D06-16); the open item is that on Claude Code the sandbox is off by default and Bash-only (D10 §2C, R2 §4).
- **Established (DOCUMENTED, R2-confirmed):** hook semantics diverge per host. On Claude Code a hook crash, timeout or non-2 exit **proceeds**; `onFailure:"block"` (v2.1.295+) does not apply to Stop/SubagentStop/TaskCompleted/TeammateIdle/async hooks (R2 §4). qwen-code denies on most non-zero plain-text exits but allows on a thrown error (F-D06-15). Same guard script, different failure behaviour per host.
- **Portable today:** instruction text, `SKILL.md`, MCP. **Not portable:** hooks (event names, decision JSON, trust), subagent definitions, sandbox/permission policy, telemetry (D10 F-D10-13, §7).
- **Things others do that MeowKit does not (design data):** CI-enforced always-loaded-context budgets (hermes), A/B before adding/dropping scaffolding (hermes, one rejected per its own source comment), verification-evidence ledger with bounded nudge (hermes), hard memory caps with injection scan (hermes). Grades are low: each is the project's own unreproduced practice (F-D07-03/04/05/02/06).
- **Outcome evidence is thin everywhere.** qwen publishes one flat SWE-bench series (76.40–77.80% over 7 releases, DOCUMENTED, not reproduced; F-D06-25); dsh publishes none (F-D06-24); hermes memory/skills benefit is unmeasured (F-D07-06/07). Hence almost every recommendation below is EXPERIMENT, not REMOVE.
- **Learn Harness Engineering** is educational plus structural validation; it contains no controlled experiment and no production data; its "harness before model" line is a heuristic (F-D09-01/04/07).
- **Native overlap is real but unmeasured.** Claude Code ships `/plan`, `/code-review`, `/security-review`, `/simplify`, `/verify`, `/loop`, memory, tasks, teams, and `claude plugin eval` (R2 §4). Equivalence with MeowKit's components is nominal until a head-to-head runs; `/verify` in particular is *not* build+lint+test (R2 §4).
- **Recommendations:** H-01 … H-08 (section 9). One IMPROVE on guard failure semantics, one claim-wording change, six EXPERIMENTs.

## 2. Systems studied

Closed-source hosts (Claude Code, Cursor) are **documentation-only**: every row or cell that depends on them is DOCUMENTED, never VERIFIED in source.

| System | What it really is | Publisher / license | Commit SHA | Source read vs docs | Coverage depth |
| --- | --- | --- | --- | --- | --- |
| deepseek-harness (`dsh`) | Original Cordis-plugin TypeScript harness, pre-stable ("compatibility-breaking changes"), not audited per its SAFETY.md; depends on Anthropic's agent SDK for one provider, not a fork (F-D06-01) | DeepSeek, MIT | `39163dd3` | Source | Deep on loop, tools pipeline, compaction, hooks bridge, sandbox profiles; packages, native sandbox source, tests bodies not opened (F-D06 §1) |
| qwen-code | Gemini CLI fork, heavily diverged, ingests Claude Code plugins, very high release cadence (F-D06-03) | QwenLM (Alibaba), Apache-2.0 | `9d390e23` | Source | Deep on hooks, loop detection, compaction, skills, permissions; `client.ts` and `coreToolScheduler.ts` only grepped (F-D06 §1) |
| hermes-agent | Python personal-agent platform (CLI, TUI, desktop, 25+ messaging platforms); coding is one use, not the identity (F-D07 §1) | Nous Research, MIT | `4b86af50c0` | Source | Deep on loop, prompt, memory, skills guard, approval, evals; gateway, apps, providers not opened |
| rig | Two things: `rig-core` Rust LLM library, and a minimal compile-time-plugin coding agent (Bevy ECS) (F-D07 §1, F-D07-17) | Playground Analytics, MIT | `8c1a2e19c` | Source (docs + selected files) | Medium; turn loop, retry code, shell execution, real compaction thresholds not read |
| Claude Code | Closed-source host; MeowKit's primary target | Anthropic | n/a | **Docs only** (S1–S15 in D10); re-verified for hook/skills/sandbox/command claims by R2 | Hook Stop/SubagentStart payload sections, OTel events after `tool_decision`, skill listing tail unread in D10 (D10 §8) |
| Cursor | Closed-source host | Anysphere | n/a | **Docs only** (hooks, rules, subagents, skills, headless, terminal) | Sandbox, permission syntax, OTel, eval flags not retrieved (D10 §1) |
| OpenAI Codex CLI | Open-source host with sandbox, hooks, OTel | OpenAI, Apache-2.0 | `81b995a6` | Source (selected crates); not executed | `hooks`, `protocol`, `otel`, `exec`, `agent-roles`, `config`, `memories`; discovery order and execpolicy syntax unread |
| Gemini CLI | Open-source host | Google, Apache-2.0 | `4ed06ed0` | Source + repo docs | Hooks, sandbox, policy engine docs; multi-hook combination not read |
| OpenCode | Open-source host with in-process TS plugins | sst, MIT | `1fa50dd2` | Source (types/plugin/permission); **no user docs in clone** | Shallow; enforcement paths not traced |
| Pi (pi-mono) | Deliberately minimal host | badlogic, MIT | `f6df849c` | Source + author post | Tools, prompt builder, docs read; prompt token count not measured |
| Goose | Open-source host | Block, Apache-2.0 | `2365bc5e` | **Docs only** (`documentation/docs/guides/**`); Rust unread | Shallow |
| Aider | Older open-source pair-programming CLI | Aider-AI, Apache-2.0 | `5dc9490b` (oldest of set, 2026-05-22) | Grep only | Shallow; no hook mechanism found by grep |
| Learn Harness Engineering | Course repository (lectures, projects, `harness-creator` skill) | walkinglabs, MIT | `a9342ff4` | Source | Lectures 01, 05, 11, `harness-creator`, README read; lectures 02–04, 06–10, 12–14 and projects 02–08 not read (F-D09 §1) |
| mattpocock/skills | Skill catalogue used as an external exemplar | Matt Pocock, MIT | `5863806d` (single squashed commit) | Source (repo files only; articles/talks not fetched) | All 39 SKILL.md measured |

**Not studied at source level:** Claude Code, Cursor (closed), Goose Rust, OpenCode enforcement, Aider beyond grep. **Not studied at all** (appear in no finding): GitHub Copilot agent, Windsurf, Cline/Roo, Amp, Devin and any other host not listed above. If the research directive named one of these, it is an open gap.

Cross-host reading rules: Qwen/Hermes/DeepSeek were skipped as *hosts* in D10 (they are D06/D07). Comparisons below treat dsh/qwen/hermes/rig as harness designs; their user bases and release channels are not comparable to Claude Code.

## 3. Mechanism-by-mechanism comparison

Cells cite finding IDs. "CC" = Claude Code (DOCUMENTED). MeowKit column states what is on `main` only where a finding says so; MeowKit internals belong to D01–D05 and are not restated.

### 3.1 Agent loop and termination

| System | Termination and limits | Source |
| --- | --- | --- |
| dsh | Kernel loop ends on a message with no tool calls, cancel, or error; **no step cap or loop breaker in kernel**; retry and repeat-call reminders are plugins; repeat reminder at 3/5/8 identical calls is advisory | F-D06-04 |
| qwen | `MAX_TURNS=100`, per-turn tool-call cap, layered loop detectors (identical call stop at 5, reminder at 3); `loopProtection` default `warn`; later relaxed after over-triggering (#14828); retry max 7 | F-D06-05, F-D06-31 |
| hermes | Bounded iteration budget (parent 500, subagent 50), wall-clock wrap-up notice at 80%, stop gate checks verification evidence (nudge ≤3, no block) | F-D07-01/02 |
| rig | Plugin-composed; model that calls a nonexistent tool 3 times fails the turn; retry up to 4 with backoff; turn loop file not read | F-D07-19 |
| CC / Codex / others | Not covered by D06/D07; CC `--max-turns`, `--max-budget-usd` exist for print mode (DOCUMENTED); Goose `--max-turns` | D10 §2E |
| MeowKit | Phase workflow with two human gates over the host loop; not a loop mechanism | see D03 |

### 3.2 Tool system and scheduling

| System | Notes | Source |
| --- | --- | --- |
| dsh | Registry + one guarded pipeline (pre-execute, execute, post-execute); parallel cap 10; `read-before-write` policy exists but is **disabled in shipped compositions**; output pruned head 4096/tail 1024 above 8192 chars; tool schema set kept stable across turns for cache | F-D06-04/06 |
| qwen | ~70 tool names, `tool_search` defers schemas, consecutive concurrency-safe calls batch, unsafe calls serial; preview 2,000 chars + digest | F-D06-05/07 |
| hermes | Output caps (50,000 bytes terminal), spill-to-disk, per-turn budget; path-scoped parallel safety; stale-overwrite blocker; core-tool deferral measured (F-D07-05) | F-D07-12/05 |
| rig | Each call declares a `Footprint`; conflicting calls in one reply wait; all-or-nothing multi-edit; default for undeclared = "may change anything" | F-D07-20/21 |
| MeowKit | Output-limit hooks are on the same side as production practice (F-D06-07); no declarative footprint (host feature) | F-D06-07, F-D07 D9 |

### 3.3 Context assembly, compaction, budgets

| System | Always-on prompt | Compaction | Budget guard | Source |
| --- | --- | --- | --- | --- |
| dsh | No monolithic base prompt; sections contributed per mounted plugin; default persona empty; total size UNKNOWN | auto at 0.8 window, summary as final user message on shared prefix (cache), 8-section checkpoint | instruction files capped 64 KiB | F-D06-08/09 |
| qwen | ~17 KB base prompt (~2.5k words); per-model-family tool-call examples | 85%, circuit breaker after 3 failures, microcompaction | **warns when always-on context > min(15% window, 10k tokens)** | F-D06-10 |
| hermes | ~3.2k tokens system + 9.5k tokens tools (`cli-code.claude` snapshot); persona file 667 bytes | aux-model summary, protected head/tail; `evals/compaction/` measures recall after compaction | **CI-enforced prompt/tools snapshot**; context file cap 20,000 chars / 6% of window | F-D07-03/11/13 |
| rig | One fixed ~1.7 KB prompt, no dynamic content; tool rules live in tool descriptions | clear-then-summarize near window with note-before-clear; trigger within 16k tokens | cache-prefix guard test in cassette suite | F-D07-18/19 |
| CC | Documented skill-listing budget 1% of window, 1,536-char per-entry cap, least-invoked dropped first (R2 §4); `PreCompact` hook text becomes compaction instructions | `/compact`, Pre/PostCompact hooks | `/doctor`, `/context` inspection | R2 §4, D10 §2F |
| MeowKit | Always-on volume (CLAUDE.md + rules + skill/agent listing) **not measured by any finding** | n/a | none found | F-D09-12 notes listing overflow observed in-session (INFERRED) |

### 3.4 Project instruction files and precedence

| System | File(s) read | Precedence / notes | Source |
| --- | --- | --- | --- |
| CC | `CLAUDE.md`; `AGENTS.md` only when no CLAUDE.md exists (v2.1.277+) unless `instructionFiles` set; context, "not enforced configuration" | managed > user > project > local; concatenated root→cwd | D10 §2A, R2 §4 |
| Codex | `AGENTS.md`, `AGENTS.override.md` | discovery order UNKNOWN | D10 §2A |
| Cursor | `.cursor/rules/*.mdc`, `AGENTS.md` | Team > Project > User | D10 §2A |
| Gemini | `GEMINI.md` hierarchy | global → workspace → JIT | D10 §2A |
| qwen | `QWEN.md`, `AGENTS.md`; **CLAUDE.md not default** (configurable) | — | F-D06-10 |
| dsh | `AGENTS.md`, `CLAUDE.md`, `*.local.md`; user-role context message; cap 64 KiB | nested files projected on touch | F-D06-08 |
| hermes | One type wins: `.hermes.md` > AGENTS.md chain > CLAUDE.md > `.cursorrules`; injection-scanned, blocked on match | trust split project vs user | F-D07-11 |
| rig | `AGENTS.md` per dir + `RIG_HOME`; **CLAUDE.md ignored** | — | F-D07-18 |
| Pi / OpenCode / Goose / Aider | `AGENTS.md`/`CLAUDE.md` (Pi), `AGENTS.md` (OpenCode), `.goosehints`, none (Aider `--read`) | — | D10 §2A |

### 3.5 Skills

| System | Format and location | Invocation | Listing / disclosure | Source |
| --- | --- | --- | --- | --- |
| CC | `SKILL.md`; enterprise > personal > project; `disable-model-invocation`, `paths`, `context: fork` | model + user | 1% budget, 1,536-char cap | D10 §2A, R2 §4 |
| dsh | `SKILL.md`; `.dsh/skills`, `.agents/skills`; **`.claude/skills` not a default root** | `skill` tool; flags | catalogue injected as user messages | F-D06-11 |
| qwen | `.qwen/skills`, `.agents/skills`; `paths:` globs, `allowedTools`, `hooks`, `model`; **`.claude/skills` not scanned** | model + user | first dir wins | F-D06-12 |
| hermes | Agent Skills dirs; index in prompt, `skill_view` loads body; 44 bundled, 141 optional; agent-authored skills guarded by scan + audit ledger | model + `/skill` | cached index per session | F-D07-07 |
| rig | Agent Skills, no scan, no agent authoring; one bundled skill | model + `/skill:name` | listed once per session for cache stability | F-D07-22 |
| Codex / Cursor / Gemini / OpenCode / Pi / Goose | `SKILL.md`; Cursor also reads `.claude/.codex` compat | — | Codex telemetry implies a truncation budget (`thread.skills.truncated`, name only); others UNKNOWN | D10 §2A, F-D09-11 |
| Pocock (exemplar) | 39 skills, median 75 lines, 24 of 39 `disable-model-invocation` | mostly user | no evals in repo | F-D09-08/09 |

### 3.6 Hooks and lifecycle events (blocking and failure semantics)

| System | Mechanism and events | Blocking | Failure semantics | Trust for project hooks | Source |
| --- | --- | --- | --- | --- | --- |
| CC | Out-of-process command/http/mcp_tool/prompt/agent; ~30 events | PreToolUse, UserPromptSubmit, Stop, … exit 2 or deny JSON; PostToolUse cannot block | **Fail-open** for non-2 exit, crash, timeout; `onFailure:"block"` (v2.1.295+) for command/http, **not** for Stop/SubagentStop/TaskCompleted/TeammateIdle/async; plain PostToolUse stdout does **not** reach the model (needs `additionalContext` JSON or exit-2 stderr) | **none for settings-file hooks** (used in untrusted folders and `-p`) | D10 §2B, R2 §4 |
| Codex | Out-of-process cmd + MCP; `prompt`/`agent` types skipped | PreToolUse deny; `allow` without `updatedInput` and `ask` **rejected** → Failed | exit 2 blocks only if stderr non-empty; other exits Failed, no block; managed hooks fail-closed on unknown attribution | hash-bound review; `--dangerously-bypass-hook-trust` | D10 §2B |
| Cursor | Command + prompt hooks | deny reliable; `ask` not enforced on preToolUse | fail-open default; `failClosed:true` per hook | trusted workspace only | D10 §2B |
| Gemini | Command hooks | BeforeTool/BeforeAgent/BeforeModel exit 2 | exit ≠0,≠2 = warning, continue | fingerprint; changed hook = untrusted | D10 §2B |
| qwen | 24 events; command/HTTP/prompt/function | PreToolUse deny/ask/`updatedInput` | JSON path: only exit 2 blocks; **plain-text path: every non-0/1 exit blocks** (so exit 127 denies); thrown infrastructure error **allows**; two policies coexist | folder trust + hash-bound approval | F-D06-15 |
| dsh | Native Cordis waterfalls (full power) + *experimental* Claude-hooks bridge, 7 events | PreToolUse, UserPromptSubmit, Stop; SubagentStop cannot block | bridge: crashed hook logged, agent continues; unreadable config → no hooks, agent starts (**fail-open**); `transcript_path` always `''` | n/a | F-D06-14 |
| hermes | Python plugin hooks (~35+), no shell-script format | `pre_tool_call`, `pre_verify`, gateway hooks | "Hook failures never block" (exception → proceed); a few explicit fail-closed | in-process, full privilege | F-D07-09 |
| rig | Compile-time Bevy plugins; stages incl. Gate/Review | in-process Gate can refuse | approval plugin **off by default** | n/a | F-D07-17/23 |
| OpenCode / Pi | In-process TS | OpenCode: only `execute.before` may fail; Pi: `tool_call` | — | Pi `project_trust` | D10 §2B |
| Goose | Open Plugins spec; PreToolUse, Stop only block | `on_failure: allow` (default) or `block` | opt-in block | none stated | D10 §2B |
| Aider | none | — | — | — | D10 §2B |

### 3.7 Permissions, sandbox, trust

| System | Permission model | OS sandbox | Secrets/read control | Source |
| --- | --- | --- | --- | --- |
| CC | allow/ask/deny, deny > ask > allow in all modes; Bash rule "isn't a security boundary"; auto mode classifier | seatbelt/bwrap, **Bash + children only, Read/Edit/Write not sandboxed, off by default** | `permissions.deny Read(...)` plus `sandbox.filesystem.denyRead`: both needed | D10 §2C, R2 §4 |
| Codex | `AskForApproval` + exec policy; managed `requirements.toml` | seatbelt/landlock/bwrap + seccomp + network proxy; default read-only | sandbox read scopes; `.git`/`.codex` read-only by default | D10 §2C |
| Gemini | policy engine TOML, 3 tiers incl. admin | Seatbelt, Docker, Podman, gVisor, LXC | policy deny | D10 §2C |
| qwen | 5 approval modes incl. LLM classifier (fail-closed); AST shell analysis | bwrap/landlock/Seatbelt/container, **opt-in** (default UNKNOWN) | folder trust; hash-bound hook and MCP approval | F-D06-17 |
| dsh | `ask|never` approval, no command-string rule engine | Seatbelt/bwrap/Landlock/ACL, **file-write only**, no network deny seen; SAFETY.md disclaims | — | F-D06-16 |
| hermes | hardline regex floor, deny globs, `smart` LLM guardian; SECURITY.md: "only security boundary … is the operating system" | docker/ssh/modal/daytona backends (shell/file tools only) | memory and context files injection-scanned | F-D07-10/11 |
| rig | none by default; approval, redact plugins off | none shipped | `RedactPlugin` placeholder substitution (off) | F-D07-23 |
| Pi / OpenCode / Goose / Aider | Pi none by design; OpenCode rulesets; Goose modes; Aider `--yes-always` | none found | — | D10 §2C |

### 3.8 Subagents and multi-agent

| System | Shape | Specialist roles? | Isolation | Source |
| --- | --- | --- | --- | --- |
| CC | Custom md subagents; managed > `--agents` > project > user > plugin; nesting default 3 | yes (user-defined) | `isolation: worktree` | D10 §2A, R2 §4 |
| dsh | One generic `subagent(description, prompt)`; `maxDepth` 1; Team = task board only; **earlier mailbox/roster design retired** | no | durable child sessions; experimental worktree tool | F-D06-19/29 |
| qwen | Claude-shaped agents (`general-purpose`, `Explore`, `review-agent`, …); `.qwen/agents/*.md`; background default | built-ins only | temp worktree | F-D06-20 |
| hermes | `delegate_task` generic children, `MAX_DEPTH=1`, blocks `memory`, `clarify`, `delegate_task` in children; parent sees summary only | no | optional worktree | F-D07-08 |
| rig | `task`/`wait` plugin, off by default, depth unbounded, ancestry-based cancel | no | child processes (`helpers`) | F-D07-24 |
| Codex / Cursor | TOML roles (Codex), md (Cursor, depth 1) | user-defined | worktree crate | D10 §2A |
| Pi | none by design | — | — | D10 §2A |

### 3.9 Memory

| System | Mechanism | Bounds and safety | Outcome evidence | Source |
| --- | --- | --- | --- | --- |
| hermes | `MEMORY.md` 2,200 / `USER.md` 1,375 chars, frozen snapshot per session, FTS5 over raw sessions, background review fork every 10 turns | injection scan on write, drift detection, file lock, entry pinning, declarative-facts guidance | **none found** | F-D07-06 |
| qwen | agentic extract/dream/recall, team memory, secret scanner | cost knobs gated by paired runs/ablations in code comments | no benefit measurement in repo | F-D06-21 |
| dsh | `session_search` tools only; no write-side memory | — | n/a | F-D06-21 |
| rig | sessions, compaction, resume; no memory plugin | — | n/a | F-D07-22 |
| CC / Codex / Gemini | CC auto memory (200 lines / 25 KB); Codex `memories` crates; Gemini `auto-memory.md` | — | not assessed | D10 §2F |
| MeowKit | two committed Markdown files per CLAUDE.md; **`.meowkit/memory/` absent in the `fc278b31` checkout** (L-02); not re-checked on `main` by these findings | memory-is-DATA rule | none | L-02 |

### 3.10 Observability

| System | Surface | Default privacy | Source |
| --- | --- | --- | --- |
| CC | OTel metrics/events/traces (beta spans); tokens, cost, tool decisions, delegation; no dedicated skill-activation, compaction or hook-run event seen in the part read | prompts/tool args off | D10 §2D |
| Codex | Rich OTel: `codex.hooks.run`, `skill_invocation`, `compaction`, `multi_agent.spawn`, `sandbox_outcome` | `log_user_prompt` lockable; default UNKNOWN | F-D10-07 |
| Gemini | OTel; `logPrompts` default **true** | opposite of CC | F-D10-08 |
| dsh | Append-only typed event log is source of truth; telemetry feedback-gated | opt-in | F-D06-22 |
| qwen | Full OTel; default-on usage stats to vendor host | default on | F-D06-17/22 |
| hermes | Trajectory JSONL, batch runner; outbound metrics consent-gated (logic unread) | consent | F-D07-14 |
| rig | GenAI tracing, usage plugin (on), effect log (off) | opt-in content | F-D07-25 |
| Cursor | UNKNOWN | UNKNOWN | D10 §2D |

### 3.11 Model adaptation

| System | What varies | Evidence it was measured | Source |
| --- | --- | --- | --- |
| hermes | Execution-discipline and tool-use blocks injected for GPT/Gemini/Qwen/DeepSeek-class models, not Claude; one block (Nemotron) **dropped after 5 runs on/off, <1 pt, p=0.14 on three suites** (as stated in a source comment) | project's own, not reproduced | F-D07-04 |
| qwen | Tool-call examples per model family; reasoning-effort ladder clamped per provider | none | F-D06-10/23 |
| dsh | Per-model compaction policies, reasoning effort; no "turn off X for stronger models" | none | F-D06-23 |
| rig | Catalogue carries per-model limits; one fixed prompt | none | F-D07-19 |
| Anthropic (DOCUMENTED) | "Skills developed for prior models are often too prescriptive for Claude Fable 5"; harness post removed sprints when Opus 4.6 improved | vendor statements; single-run anecdotes | R2 §4 |

### 3.12 Testing and evaluation

| System | What is tested | Task-success evidence | Source |
| --- | --- | --- | --- |
| dsh | Per-file 100% coverage CI gate, recorded-session replay, real-API e2e ("verify the world, not the self-report"); `benchmarks/` = latency/heap gates | **none**; `BENCHMARK.md` is 3 lines (CONTRADICTED if read as quality benchmark) | F-D06-24 |
| qwen | ~3,596 test files, fake-provider integration tests, release-gated SWE-bench pipeline | one series, same model 3 trials × 7 releases, spread 1.40 pp (DOCUMENTED) | F-D06-25 |
| hermes | 8,061 test files; CI guards for prompt surface and docs drift; `evals/` incl. compaction recall and core-tool deferral A/B | partial: one A/B (288 runs, 3 models) | F-D07-05/15 |
| rig | cassette record/replay, plugin corpus, 5,736 tests | none (kernel correctness only) | F-D07-25 |
| CC | `claude plugin eval`: fresh isolated `-p` sessions, with/without-plugin arm, graders (regex, tool_used, file_exists, llm, baseline); applies to plugin skills/agents only | n/a (tool, not result) | R2 §4, F-D10-05 |
| Others | `codex exec --ignore-user-config --ephemeral --output-schema`; Goose `--max-turns`; Gemini internal `evals/` | none | D10 §2E |

## 4. The ten questions per mechanism

Method note. "Evidence it works" is graded strictly: *exists* in a harness is not *works*. "Necessary in MeowKit?", "needs adapter", "runtime cost", "security risk" are INFERRED from the cited findings unless marked; MeowKit-side facts come from D01–D05 and are outside this deliverable's source reads. Split into two tables of the same rows.

### 4A. Problem · where implemented · evidence it works · limitations · necessary?

| Mechanism | Problem solved | Where implemented | Evidence it works | Limitations | Necessary in MeowKit? |
| --- | --- | --- | --- | --- | --- |
| Loop and termination | Runaway or stuck loops | dsh reminders (advisory); qwen detectors + 100-turn cap; hermes budget; rig 3-unavailable-call fail | qwen detectors born from a provider 400 (#5019) then relaxed (#14828): real failures drove tuning, not benefit data (F-D06-05/31); otherwise none | Defaults are warn, not stop (qwen); dsh has no hard stop in what was read | Host already provides turn/budget limits (`--max-turns`, `--max-budget-usd`, print mode only). INFERRED: not a MeowKit mechanism |
| Tool scheduling and output caps | Context bloat; conflicting edits | rig footprints; hermes spill + stale-write guard; qwen/dsh truncation; dsh stable schema set | hermes core-tool deferral: schema 47.4→21.0 KB, accuracy 0.923 vs 0.916 flat, tokens −7 to −23%, one real regression (`clarify`) (DOCUMENTED, n≈3–6/cell, single author; F-D07-05). No other | Footprints need host support; deferral test is the project's own | Output caps: already adopted (F-D06-07). Footprints: host feature, cannot be built by MeowKit |
| Context assembly and budgets | Always-on dilution, cache loss | hermes CI snapshot; qwen 15%/10k warning; rig fixed prompt; dsh empty persona | Direct study: LLM-generated context files −0.5%/−2% (n.s.), developer-written +2.4% (p=0.21, n.s.), cost +20%/+23% (R2 §2, 2602.11988). Context length alone hurts, 5 LLMs (2510.05381) | Studies are Feb 2026-era agents; do not test MeowKit-style gates | Measurement of MeowKit's always-on volume: yes (it is unmeasured). Budget enforcement: NEEDS MORE EVIDENCE |
| Compaction | Window overflow | dsh, qwen, hermes, rig, CC | hermes has a recall-after-compaction eval (scorecard numbers unread); others none | Summaries lose invariants | Host-owned; MeowKit's only lever is `PreCompact`/`PostCompact` re-injection (qwen, CC, Codex, Gemini have events; dsh bridge does not) |
| Instruction files | Project conventions | all | See row above; CC treats CLAUDE.md as "context, not enforced configuration" (R2 §4) | Delivery differs per host (rig ignores CLAUDE.md; hermes loads it only as fallback; CC reads AGENTS.md only when no CLAUDE.md) | Yes as portable text layer; a per-host delivery check is not shown to exist |
| Skills | On-demand procedure | all but Aider | SkillsBench live version: 87 tasks, +16.6 pp curated (SE +11.6), 13/87 tasks negative, **self-generated −8.1 to −11.5 pp below no-skill** (R2 §2, 2602.12670). Selection accuracy falls with library size: synthetic, GPT-4o/4o-mini only, single author (2601.04748; R2: Weak) | Frontier 100–130-skill selection accuracy UNKNOWN; CC drops least-used descriptions at 1% budget | Format yes (portable). Catalogue size: NEEDS MORE EVIDENCE (see D02 deliverable) |
| Hooks and guards | Deterministic block/inject | CC, Codex, Cursor, Gemini, Goose, qwen, dsh bridge (partial), hermes/OpenCode/Pi in-process | Mechanism documented and read in source; **no harness measures that guards reduce bad outcomes** | Fail-open on CC default; Bash bypass classes (D10 F-D10-02); post-tool hooks cannot undo writes | Yes for irreversible actions (INFERRED); the claim "enforced" needs scoping (see H-01, H-02) |
| Permissions, sandbox, trust | Contain a misbehaving or injected agent | OS sandboxes (dsh, Codex, Gemini, hermes backends); CC deny rules; qwen classifier | 2510.09023: 12 prompt-level defences bypassed, >90% ASR under adaptive attack (R2 §2): strong for *research defences*, INFERRED for MeowKit's prose rule on 2026 models | CC sandbox off by default, Bash-only; managed tier is the only tamper-resistant tier (F-D10-09) | Yes (security is not removed on cost grounds); the boundary is the host's |
| Subagents / multi-agent | Context isolation, parallelism | see 3.8 | Matched-budget SE: one source, 20-instance SWE-bench subset, all MAS −2% to −15% (2512.08296); CAID +3.6 to +25.6 pp at 1.7–4.3× cost, Claude-only gain ≈ +6 pp (R2 §2); research system +90.2% at ~15× tokens, non-SE. R2 grade: weak RESEARCH-SUPPORTED for "not reliably better", HYPOTHESIS for 2026 models | Persona prompting: no benefit on 2023 QA (2311.10054, 2023 models) | Isolation: plausible and host-provided. Named specialists: NEEDS MORE EVIDENCE; none of four harnesses ships them by default |
| Memory | Cross-session knowledge | hermes (smallest), qwen (largest), CC auto memory | **None** that memory raises success in any studied harness. Structured memory +4.7 pp SWE-bench Verified self-reported (2602.21611); memory can propagate errors (2505.16067) (R2 §2) | Benefit and harm both small-sample, 2025–26 models | NEEDS MORE EVIDENCE; do not add retrieval sophistication |
| Observability | Debug, cost, measure | OTel (CC, Codex, Gemini, qwen, rig), typed event log (dsh) | n/a (enabler, not intervention) | Defaults diverge (Gemini logs prompts); CC lacks dedicated skill/compaction/hook events in the part read | Consume host OTel where it exists; hooks only for MeowKit-specific facts |
| Model adaptation | Fit scaffolding to model | hermes per-family blocks; qwen examples | One measured negative (Nemotron block dropped, p=0.14) | Mostly protocol/capability fitting, not "turn off for strong models" | Evidence for H2 direction only; MeowKit's adaptive density received no model name in this host (L-10) |
| Testing / evaluation | Know whether a change helped | hermes A/B harness; qwen release series; CC `plugin eval` | Tools exist; outcome claims for harness features: weak (qwen flat series) | Eval of MeowKit needs packaging as a plugin for `plugin eval` (INFERRED, D10 F-D10-05) | Yes; MeowKit has no outcome measurements at all (WRITING-GUIDE) |

### 4B. Can host provide? · adapter? · runtime cost · security risk · validating experiment

| Mechanism | Can the host already provide it? | Custom adapter needed? | Runtime cost | Security risk | Validating experiment |
| --- | --- | --- | --- | --- | --- |
| Loop and termination | Yes (CC print-mode limits; qwen/hermes built in) | No | Negligible | Low; doom-loop reminders are advisory | Fault: identical-call loop with/without reminder (qwen flags) on a fixed task set |
| Tool scheduling and caps | Yes (host-owned; footprints only in rig) | Hooks can cap output on CC/qwen/Codex/Gemini; not rig/Pi | Saves tokens | Low | Reproduce `core_tool_deferral` for one model (D07 E5) |
| Context assembly | Partly (CC `/context`, `/doctor`) | Counting tool outside host | Tokens ≈ always-on size; cost +20% reported for context files | Large always-on text can bury safety rules (INFERRED) | Tokenise MeowKit always-on set; vary under fixed task set (D06 E3, D07 E3) |
| Compaction | Yes | Re-injection hook, per-host event names | Extra tokens each compaction | Rule loss across compaction (INFERRED) | Sentinel rule survives `/compact` on each host |
| Instruction files | Yes | Per-host file name/precedence | Cached prefix | Hermes blocks matched files; others treat as context | Sentinel-rule test per host (D07 E: C5, D07 D11) |
| Skills | Yes | Dir mapping (`.agents/skills`; qwen/dsh do not scan `.claude/skills`) | Listing budget; descriptions dropped when over (R2 §4) | Third-party skills run with agent privileges; Snyk: 76 of 3,984 confirmed malicious, 13.4% critical (R2 §4) | With/without per skill via `claude plugin eval`; trigger tests (D09 E2, E4) |
| Hooks and guards | Native deny/permission rules cover file tools, not dynamic "plan approved" | **Yes per host**: event names, decision JSON, tool names, trust step | Process spawn per call | Fail-open on CC default; project hooks run unreviewed on CC (F-D10-10) | Fault injection: exit 1, timeout, missing `node` ⇒ assert deny (D10 E1) |
| Permissions, sandbox | Yes (host-owned; CC off by default) | Managed-settings deployment for tamper resistance | Sandbox I/O overhead UNKNOWN | Core of the security story | Bypass battery: `sed -i`, heredoc, `python -c`, `git apply`, MCP, subagent (D10 E3) |
| Subagents | Yes (CC, Codex, qwen, Cursor); dsh/hermes generic only | Convert `.claude/agents/*.md`→TOML (Codex); none for dsh | CAID 1.7–4.3× cost; MAS error amplification 4.4×–17.2× (R2 §2) | Subagents inherit hooks on CC (R2 §4); tool allowlist enforcement UNKNOWN on qwen | Arms: named specialists vs generic child vs single agent (D07 E2) |
| Memory | Partly (CC auto memory, Codex memories) | Write path via `mewkit note` | Prompt bytes if injected; hermes: ≈3.5K chars | Poisoning (AgentPoison >80% ASR, R2 §2); hermes scans on write | Same tasks with empty / capped / current memory (D07 E1) |
| Observability | Yes (OTel) | Parity mapping for hosts without OTel | Low | Prompt logging defaults differ | Map each MeowKit trace field to OTel attribute (D10 E7) |
| Model adaptation | No (harness-level) | Model id not always in hooks: CC `SessionStart.model` optional (R2 §4) | Low | Low | Paired runs ≥5 per arm per model family (D07 D4) |
| Testing / evaluation | Yes on CC (`plugin eval`), Codex flags | Package a plugin manifest for CC | cases × runs × 2 + judge calls (D10 F-D10-05) | Eval arms run MeowKit hooks too | `--ablation with-without`, pinned model, ≥5 runs (D10 E4) |

## 5. Extension surfaces and honest portability

### 5.1 Surface per host

Fidelity: **ENFORCED** = host executes it deterministically; **ADVISORY** = enters model context or relies on removable project config. Rows are from D10 (CC/Codex/Cursor/Gemini/OpenCode/Pi/Goose/Aider), D06 (dsh/qwen), D07 (hermes/rig).

| Host | Surface → format/location | Enforceable or advisory | Notes |
| --- | --- | --- | --- |
| Claude Code (DOCUMENTED) | Hooks in `.claude/settings.json`/plugins/skill and agent frontmatter | ENFORCED for file tools; Bash only by command-text match | Project-tier; removable by user/agent edits; managed tier tamper-resistant (F-D10-09) |
| | `permissions.deny`, sandbox | ENFORCED (deny all modes; sandbox Bash-only, off by default) | `denyRead` does not stop the Read tool (R2 §4) |
| | Skills / agents / commands (md + YAML), plugin manifest | ADVISORY (agent frontmatter `tools` allowlist is host-enforced per docs) | Plugin agents ignore `hooks`, `mcpServers`, `permissionMode` frontmatter (D10 F-D10-12) |
| | CLAUDE.md, `.claude/rules/` | ADVISORY ("context, not enforced") | Rules without `paths` load at launch |
| | MCP, OTel, `claude plugin eval` | transport ENFORCED; telemetry read-only; eval needs plugin packaging | |
| Codex (V, partly D) | Hooks (cmd/MCP), TOML agents, `AGENTS.md`, skills, requirements.toml | ENFORCED for PreToolUse deny; vendor: "guardrail, not a complete enforcement boundary" | `ask` unsupported on PreToolUse |
| Cursor (DOCUMENTED only) | `.cursor/rules/*.mdc`, hooks, md agents, skills; reads `.claude/agents` | deny hooks ENFORCED; `ask` not on preToolUse | Sandbox/OTel unknown |
| Gemini | `GEMINI.md`, hooks, policy engine, skills, extensions | ENFORCED (exit 2, policy deny, sandbox) | `CLAUDE_PROJECT_DIR` aliased |
| qwen | `.qwen/settings.json` hooks (24 events), `.qwen/agents`, `.qwen/skills`, `.qwen/commands`, Claude-plugin converter | ENFORCED hooks; agent tool allowlist enforcement UNKNOWN | Converts commands/agents/skills/hooks/`.mcp.json` only; `.claude/settings.json` permissions, rules **not read** (F-D06-12, §4.2) |
| dsh | Native TS plugin (full API); Claude-hooks bridge (7 events, experimental); skills; MCP | Native ENFORCED; bridge fail-open | No agents directory; pre-stable API (F-D06 §4.1) |
| hermes | Python plugins (hooks, tools), skills, AGENTS.md/CLAUDE.md fallback, memory provider | Hooks can block; fail-open default | No shell-script hook format (F-D07 §4) |
| rig | Rust plugin crates, AGENTS.md, skills, headless `rig -p --json` | In-process Gate; compile-time | CLAUDE.md ignored; no project settings |
| OpenCode / Pi | In-process TS plugins/extensions | Enforceable in-process only | No out-of-process hooks (F-D10-04) |
| Goose / Aider | Goose: Open Plugins hooks; Aider: none | Goose PreToolUse/Stop; Aider cannot enforce | — |

### 5.2 What is portable and what is not

| Layer | Portable? | Honest scope |
| --- | --- | --- |
| Instruction text | Yes, with per-host file mapping | Delivery differs: rig ignores CLAUDE.md; hermes loads it only as fallback; CC reads AGENTS.md only when CLAUDE.md is absent; qwen needs `contextFileName` (F-D07 C5, F-D06-10, R2 §4) |
| `SKILL.md` | Yes (format) | Directory roots differ; qwen/dsh skip `.claude/skills`; listing-budget behaviour on non-CC hosts UNKNOWN (F-D09-11) |
| MCP | Yes | Trust handling differs (rig trusts project MCP servers by default; qwen/dsh hash/identity binding) (F-D06-13, F-D07-23) |
| Hooks | **No** | Stdin-JSON + exit 2 shape recurs, but event names, decision fields, tool names and failure behaviour differ (F-D10-04) |
| Subagent definitions | **No** | md (CC, Cursor, Gemini), TOML (Codex), none (dsh, Pi) |
| Sandbox/permission policy | **No** | Host-owned; four of eight hosts have no usable sandbox (F-D10-15) |
| Telemetry | **No** | Codex richest; CC partial; Cursor unknown; defaults diverge (F-D10-08) |
| Plan-approval receipt = human approval | **Not host-enforceable anywhere** | Only an `ask` prompt is a real human-in-loop primitive, and Codex rejects `ask` on PreToolUse (F-D10-16) |

### 5.3 Where MeowKit's blocking guards would behave differently

MeowKit's write guards block by exiting 2 (D10 F-D10-01). `main` registers them without `onFailure` and with no `permissions.deny` or `sandbox` key (L-12).

| Condition | CC | Codex | qwen | dsh bridge | Gemini | Goose |
| --- | --- | --- | --- | --- | --- | --- |
| Guard exits 2 with stderr | block | block (needs stderr non-empty) | block | block | block | block |
| Guard exits 1 or 127, or `node` missing | **proceeds** | Failed, no block | plain-text path: **denies** (non-0/1) | non-blocking error | warning, continue | allow (default) |
| Guard crashes or times out | **proceeds** unless `onFailure:"block"` (not for Stop/SubagentStop/TaskCompleted/TeammateIdle/async) | Failed; managed hooks fail-closed | thrown error **allows**; killed process = failure | logged, continues | continues | allow unless `on_failure:block` |
| Event not supported | n/a | `prompt`/`agent` hooks skipped | superset of CC | only 7 events: no PreCompact/SessionEnd/Notification | different names | PreToolUse, Stop only block |
| Hook `ask` decision | ask prompt honoured | rejected → Failed | supported | n/a | n/a | n/a |
| Project-hook trust | **none** (also in `-p` and untrusted folders) | hash-bound review | folder trust + hash approval | n/a | fingerprint | none stated |
| Tool names in matchers | `Edit`/`Write`/`Bash` | host names | `edit`, `write_file`, `run_shell_command` | `edit`/`write`/`bash` lowercase | different | different |

Consequence (INFERRED from the table): the same `gate-enforcement.cjs` is **fail-open on CC by default, partly fail-closed on qwen, and untranslated on dsh**. Cross-host parity for enforcement cannot be claimed; the claim that survives is "guardrail on hosts where the hook is registered and the event matches" (D10 D10-3, D10-5). Also, a plan gate is a real boundary only for the host's own file tools; with Bash available it is heuristic unless Bash is sandboxed (F-D10-02), and managed settings are required for tamper resistance (F-D10-09).

## 6. Host-native features that overlap MeowKit components

"Exact" means same observable behaviour; "nominal" means same name or intent only. No finding contains a head-to-head, so nothing is marked exact.

| Host feature (CC, DOCUMENTED, R2-confirmed to exist) | Overlapping MeowKit component | Overlap | Unmeasured |
| --- | --- | --- | --- |
| `/plan`, plan mode | Gate 1 (`mk:plan-creator`, plan receipt) | **Nominal.** Native plan approval is not a file-state gate; plan mode is instructed-only when bypass is available (D10 §2F); MeowKit's receipt is "agent-writable by design" and not a human-approval proof (L-13, F-D10-16) | Whether a plan-file gate beats native plan mode on rework or escaped defects |
| `/code-review` (effort levels, `--fix`) | `mk:review` / Gate 2 verdict | Nominal (intent) | Defect-detection rate; verdict value over native; fresh-context review evidence is Weak (single author, R2 §6d) |
| `/security-review` | `mk:cso`, `security` agent | Nominal | Finding overlap and false-positive rate |
| `/simplify` (parallel review agents, applies fixes) | `mk:simplify` | Nominal | Behaviour preservation, token cost |
| `/verify` | `mk:verify` | **Not the same.** R2: native `/verify` runs the app and observes it; MeowKit's `mk:verify` is build+lint+test+type+coverage | Complementary? Which catches more bugs at what cost |
| `/loop`, `/goal` | `mk:loop` | Nominal | — |
| Auto memory (200 lines / 25 KB), `/memory` | `mk:memory`, `.meowkit/memory/*` | Nominal | Any benefit of either (none measured in any harness) |
| `TaskCreate`/`/tasks` | `mk:task-queue`, task files | Nominal | — |
| Subagents, agent teams, `/batch`, worktrees | Named agents (44 files), `mk:worktree`, parallel execution rules | Nominal; worktree isolation is a host feature | Specialist vs generic (see H-07) |
| `claude plugin eval` | `mk:benchmark` (experimental/manual, no automated runner per its own description), `mk:evaluate` | **Different class.** Native tool provides isolated with/without arms and graders; MeowKit has no outcome measurement (WRITING-GUIDE) | Whether MeowKit packaged as a plugin runs under it unchanged (D10 F-D10-05: INFERRED not packaged as a plugin) |
| `/rewind`, checkpoints | none found | — | — |

Codex has native review subcommands and guardian auto-review; Gemini has plan mode and checkpointing (D10 §2F). Cursor equivalents UNKNOWN.

## 7. What production harnesses do not do, and do

**Standing caveat.** Absence or presence in another harness is design data, not proof of benefit. Each row names the evidence grade of the *observation*, then the grade of any *benefit claim*.

### 7.1 Not done by the studied harnesses; done by MeowKit

| MeowKit practice | Observation in others | Grade of the observation | Grade of benefit/harm |
| --- | --- | --- | --- |
| Rigid phase gates (Gate 1/Gate 2) | No phase state machine in dsh/qwen (F-D06-26), hermes loop (F-D07-01), rig (F-D07-17). Closest: plan mode, goal rounds, action approvals | VERIFIED (absence INFERRED from reads) | **UNKNOWN**: no A/B in any repo. Gates guard human-process failures (unreviewed ship) that SWE-bench-style metrics do not measure (F-D06 D-06-1, INFERRED) |
| Named specialist subagents | dsh generic delegate; hermes generic leaf/orchestrator; rig opt-in generic; qwen Claude-shaped built-ins incl. `review-agent` (F-D06-19/20/28, F-D07-08/24) | VERIFIED | UNKNOWN. Delegation justified as context offload, not persona. Persona prompting no benefit on 2023 QA (R2 §2). dsh *retired* a mailbox/roster design in ≤5 months (F-D06-29) |
| Always-on rule volume | dsh empty persona, rig ~1.7 KB, hermes ~3.2k tokens, qwen ~17 KB with a 15%/10k warning (F-D06-08/10, F-D07-03/18) | VERIFIED sizes; MeowKit's own volume **not measured** | Context-file study: no significant success gain, +20% cost (R2 §6b): RESEARCH-SUPPORTED, single primary, does not test rule/gate content |
| Large skill and agent catalogue | hermes bundles 44, Pocock 39, rig 1 | VERIFIED | Weak: selection accuracy vs count (R2 §6e); the host budget, not description length, is binding (F-D09-12 INFERRED) |

Also note stated minimalism is not outcome: qwen's AGENTS.md leads with "Simplicity First" while core files are 6.9k and 8.7k lines (F-D06-30).

### 7.2 Done by the studied harnesses; not done by MeowKit

| Practice | Where | Grade of observation | Grade of benefit |
| --- | --- | --- | --- |
| Reliance on OS sandbox as the boundary; prompt rules disclaimed as heuristics | hermes SECURITY.md checked against code; dsh SAFETY.md; Codex/Gemini ship sandboxes (F-D07-10, F-D06-16, F-D10-15) | VERIFIED | Matches research on adaptive attacks (2510.09023, R2 §6c): strong for research defences, INFERRED for 2026 frontier models. MeowKit on CC has no `sandbox` key (L-12) |
| CI-enforced prompt/tool footprint | hermes `test_prompt_surface.py` + snapshot; rig cache-prefix guard; qwen runtime warning (F-D07-03/25, F-D06-10) | VERIFIED | HYPOTHESIS: footprint creep is silent without a test |
| Measured A/B before adding or dropping scaffolding | hermes Nemotron block (5 runs/arm, p=0.14, dropped) and core-tool deferral (288 runs) (F-D07-04/05); qwen release series (F-D06-25) | DOCUMENTED-in-source, not reproduced; single projects | Evidence that surface trimming was ~accuracy-neutral; n small, author-run |
| Verification-evidence ledger + bounded re-prompt | hermes passive SQLite ledger, `max_verify_nudges` 3 (F-D07-02) | VERIFIED | HYPOTHESIS; no effectiveness data |
| Bounded, scanned memory | hermes 2,200/1,375 char caps, frozen snapshot, injection scan, drift detection (F-D07-06) | VERIFIED | UNKNOWN benefit; the elaboration is in safety, not retrieval |
| Governance rubric for surface growth ("footprint ladder": extend → skill → plugin → MCP → core tool last) | hermes `AGENTS.md` (F-D07-16) | VERIFIED | HYPOTHESIS |
| World-verified tests ("verify the world, not the self-report") | dsh `docs/testing.md` (F-D06-24) | VERIFIED (policy doc) | Policy, not outcome |

## 8. Critical study of the Learn Harness Engineering repository

Everything here is from D09 at `a9342ff4`; lectures and projects not listed in section 2 were not read.

### 8.1 What each part is

| Part | What it actually is | Class | Cite |
| --- | --- | --- | --- |
| Lecture 01 | Ordering heuristic plus two external anecdotes and an unsourced FastAPI story | Educational example / heuristic | F-D09-01 |
| `code/*.ts` demos | Deterministic simulations; the "model" is hard-coded `if` branches; lecture 05 itself says "a teaching simulation, not a measurement" | Educational example | F-D09-02 |
| Lecture 05 (continuity) | Pattern; cites LangChain TB2.0 52.8→66.5% (same model, bundled changes, no per-change ablation) | Educational + confounded third-party behavioural | F-D09 T1, R2 §4 |
| Lecture 11 (observability) | 260-line logger demo, 5-line rubric, 12-line contract template; **no OpenTelemetry code**, only prose | Educational; runtime signals not implemented | F-D09-03 |
| `harness-creator` scoring | 25 boolean file-existence / substring checks; "self-check" requires ≥90 from its own generator; 10 evals never executed | Structural validation only | F-D09-04 |
| Memory reference | Design pattern text; no source, no injection treatment, "local overrides win" | Design pattern | F-D09-05 |
| Projects 01–08 | Learner exercises, n=1 per arm | Educational exercise | F-D09-07 |
| Controlled experiment / production evidence | **None in the repository** | — | F-D09 T1 |

### 8.2 Lecture 01: harness before model

The thesis ("don't swap the model first", "nine times out of ten the problem lives in one of those layers", an AGENTS.md "might be more effective than upgrading") is a **heuristic** (check cheap things first), not a **causal claim**: no failure-attribution base rate is given and "nine out of ten" has no citation (F-D09-01, INFERRED assessment). The README's "controlled experiment" label is CONTRADICTED by Anthropic's own post: one prompt, one run per arm, author's judgement, 20 min / $9 vs 6 h / $200, not presented as controlled (F-D09-01; R2 §4 confirms the figures). The same post says harness components encode assumptions about what the model cannot do and that sprints were removed when the model improved, i.e. harness benefit is model-relative, which supports H2 rather than the lecture (F-D09-01).

Counter-evidence on direction: LLM-generated context files did not improve success and cost >20% more; developer-written files gave +2.4%, not significant (R2 §2, 2602.11988). The "AGENTS.md beats a model upgrade" sentence is thus unsupported for hand-written files and contradicted in direction for generated ones (F-D09 T4).

A causal test would need a fixed task set, pre-registered success checks independent of self-report, a model × harness grid with ≥5 trials per cell and cost-normalised reporting (F-D09-01; D09 E1).

### 8.3 Lecture 11: implemented versus described

Implemented: a seeded-failure logger comparison, a rubric, a contract template. Described only: OpenTelemetry integration; the "dark mode 45 minutes, 3–4 cycles" scenario is hypothetical; the cost table is quoted from Anthropic's DAW run (3 h 50 / $124.70, single run). Project 06 has no tests (F-D09-03).

### 8.4 `harness-creator` scoring

Structural only. Needles are substring matches (e.g. "Startup Workflow" or "Before writing code"), gameable by headings. SKILL.md concedes: "structural benchmark … Real effectiveness still needs before/after agent sessions" (F-D09-04). Its report labels ("Bottleneck") read as causal but are the lowest structural score. Decision from D09: REJECT as a MeowKit quality metric (D09 D7).

### 8.5 Memory material

Layered pattern (instruction / auto-memory / extraction), two-step save, index capped ~200 lines/25 KB. No primary-source citation, no staleness verification, no treatment of memory as untrusted data. "Local overrides win" lets repo-local files override org policy (F-D09-05). MeowKit's "memory is DATA" and org precedence rules are stricter than this reference (INFERRED).

### 8.6 Pi and minimalism

The course makes no performance claim about Pi; its Pi page is descriptive with subjective scores (F-D09-06). Primary sources: Pi README has no benchmark claims; Zechner's post runs Opus 4.5 on Terminal-Bench 2.0 (5 trials) but compares against harnesses *each with its own model*, so harness and model are confounded; scores are in images; he says benchmarks don't reflect real-world performance; "<1000 tokens" is unmeasured (F-D09-06; F-D10-14). The 2026 source has drifted: MCP docs, project trust, extension events that can block tools (F-D10-14, contradictions). Verdict: "a minimal harness can be competitive on one benchmark" is weak; "minimal beats rich" is UNKNOWN (no matched-model ablation). mini-SWE-agent (>74% SWE-bench Verified, ~100 lines) varies model under one harness, so it too does not isolate scaffold size (F-D09-01 counter-evidence).

## 9. Lessons for MeowKit

### 9.1 Lessons (problem → evidence → grade → meaning → experiment)

| # | Problem | Evidence | Grade | What it would mean for MeowKit | Experiment |
| --- | --- | --- | --- | --- | --- |
| L1 | A blocking guard that fails open gives no protection when it crashes | CC default fail-open (R2 §4); qwen two policies (F-D06-15); hermes fail-open (F-D07-09); MeowKit registers no `onFailure` (L-12) | DOCUMENTED (CC) + VERIFIED (qwen/hermes source) | Guards need explicit failure semantics per host | Fault-injection on each host (D10 E1, D06 E1) → H-01 |
| L2 | "Enforced" claims exceed what hooks guarantee | Bash bypass classes; sandbox Bash-only; project tier removable (F-D10-02/09) | DOCUMENTED, INFERRED | Scope wording: guardrail vs boundary; managed tier for tamper resistance | Bypass battery (D10 E3) → H-02 |
| L3 | Unknown always-on prompt cost | hermes CI snapshot, qwen 15%/10k warning; context-file cost +20% | VERIFIED sizes elsewhere; MeowKit UNKNOWN | Measure first; budget only if numbers justify | Tokenise always-on set per host (D06 E3) → H-03 |
| L4 | Scaffolding may help weak models, not strong ones | hermes Nemotron p=0.14; Anthropic "too prescriptive" for Fable 5 (R2 §4); harness post removals | DOCUMENTED-in-source + vendor | Test dropping per-model; MeowKit's density hook got no model name here (L-10) | Paired runs per model tier → H-04 |
| L5 | "Done" claimed without verification | hermes passive ledger + ≤3 nudges (F-D07-02); `/verify` is a different native feature (R2 §4) | VERIFIED mechanism; benefit HYPOTHESIS | An evidence record plus bounded nudge is a cheap addition candidate; keep human Gate 2 | Rate of claimed-done-without-test, with/without nudge → H-05 |
| L6 | Native commands may duplicate MeowKit skills | CC ships `/code-review`, `/simplify`, `/security-review`, `/verify` (R2 §4) | DOCUMENTED existence; equivalence UNKNOWN | Decide by head-to-head, not by name | `claude plugin eval --ablation with-without` → H-06 |
| L7 | Specialist agents may not earn their cost | No harness ships them; CAID gains ≈ +6 pp at 1.7–4.3× cost (R2 §2); dsh retired mailbox | Weak RESEARCH-SUPPORTED / HYPOTHESIS (R2 §6a) | Maintainer decision: options keep / change / hybrid, not a reversal | Named vs generic vs single (D07 E2) → H-07 |
| L8 | Duplicate observability and secret-read mechanisms | Native OTel (Codex, CC), native deny rules hold in all modes (F-D10-03/07) | DOCUMENTED | Add native layer; keep MeowKit hook for patterns native rules cannot express | Secret-read coverage matrix (D10 E2); OTel parity (D10 E7) → H-08 |
| L9 | Memory benefit is unproven everywhere | hermes none; qwen none; dsh none (F-D07-06, F-D06-21); poisoning risk (R2 §2) | UNKNOWN benefit | Do not add retrieval sophistication; measure what exists first | Empty vs capped vs current memory (D07 E1) — no recommendation yet; NEEDS MORE EVIDENCE |
| L10 | Instruction delivery differs per host | rig ignores CLAUDE.md; hermes fallback; CC conditional AGENTS.md (F-D07 C5, R2 §4) | VERIFIED / DOCUMENTED | Sentinel-rule test per host before claiming rules reach the model | Sentinel test → H-02 |
| L11 | Surface growth is silent | hermes footprint ladder + CI | VERIFIED practice, HYPOTHESIS benefit | Governance idea only | Count added surfaces per release (D07 D10) — DEFER |
| L12 | Skill catalogue may exceed the host listing budget | CC 1% budget, drops least-used descriptions (R2 §4); selection decay evidence Weak (R2 §6e); F-D09-12 in-session observation | DOCUMENTED mechanism; magnitude HYPOTHESIS | Belongs to the skills deliverable; cross-reference only | `/doctor` + trigger tests (D09 E2/E4) |

### 9.2 Tempting imitations to reject (architecture by imitation)

| Imitation | Why reject (evidence) |
| --- | --- |
| Remove Gate 1 / Gate 2 because production harnesses have none | Absence is design data, not a result; no A/B exists (F-D06-26). Gates are an explicit maintainer decision; options only, no reversal recommended |
| Strip specialist agents because hermes/dsh/rig ship none | Same reason; hermes/rig have different product shapes (personal agent platform, minimal coding agent) (F-D07 §1) |
| Copy qwen's 24-event hooks, LLM classifier, arena (D06 D-06-9) | Exists ≠ works; no outcome evidence; MeowKit cannot add host events |
| Adopt Pi-style "no permissions, YOLO" | Pi's author's own stance has drifted toward trust and blocking extensions (F-D10-14); sandbox is the premise, not an omission |
| Target dsh via its Claude-hooks bridge now | Experimental, 7 events, fail-open, no agents directory, pre-stable APIs (F-D06-14, D06 D-06-6 DEFER) |
| Port hooks to Pi/OpenCode as scripts | Only in-process TS plugins exist (D10 D10-9) |
| Build vector/LLM retrieval memory | Leading open agent keeps ~3.5K chars frozen plus FTS5; no benefit evidence (F-D07-06) |
| LLM-authored skills and curator by default | hermes's own prompts document hoarding and self-imposed negative claims; benefit unmeasured; live SkillsBench: self-generated skills −8.1 to −11.5 pp (F-D07-07, R2 §2). DEFER, with constraints listed in D07 D6 |
| Rely on Skills-Guard-style regex scan as a boundary | hermes calls it a review aid; builtin trust-by-origin (F-D07-07, C1) |
| Use `harness-creator` score as a metric | Structural only (F-D09-04) |
| Treat `--bare` as the "stock Claude Code" arm | It also drops reminders, skill list and hooks, and needs an API key (F-D10-06) |
| Heavy Team mailbox protocols | dsh retired theirs (F-D06-29) |
| Copy the "Simplicity First" slogan as proof | Stated minimalism ≠ outcome (F-D06-30) |
| Treat rig's compile-time plugin model as an adapter path | Rust crate + cargo build per plugin; project settings never read (F-D07-17/26, §4) |

## 10. Recommendations

Decision vocabulary per WRITING-GUIDE. Every recommendation here is a change to MeowKit or to its claims, never a security-control removal on cost grounds. `Affected source` cites only paths a finding or ledger item cites; others are marked for the owning deliverable.

### H-01 — Make blocking guards fail closed (IMPROVE)

| Field | Content |
| --- | --- |
| Observed problem | A guard that crashes, times out or cannot start (missing `node`) is skipped on CC; qwen allows on thrown errors; dsh bridge continues |
| Affected source | `.claude/settings.json` hook registrations of `gate-enforcement`, `privacy-block`, `pre-ship` @ `c7ff0a9e` (no `onFailure`, L-12); hook scripts themselves |
| Causal hypothesis | Fail-open default turns infrastructure faults into gate bypass (F-D10-01) |
| Proposed change | Register the write/commit guards with `onFailure:"block"` where the host supports it (CC ≥ 2.1.295); independently wrap guard entry so any internal exception emits a structured deny / exit 2 (works on older versions and other hosts). Do not rely on `onFailure` for Stop/SubagentStop/TaskCompleted/TeammateIdle/async hooks (R2 §4) |
| Evidence | F-D10-01 (DOCUMENTED, R2-confirmed), F-D06-14/15 (VERIFIED), F-D07-09 (VERIFIED) |
| Alternatives | Do nothing; document the fail-open default only; deploy via managed settings (F-D10-09) |
| Expected benefit | Guards cannot be silently disabled by infrastructure faults |
| Measurement | Fault injection: exit 1, sleep past timeout, throw, remove `node` from PATH; assert the tool call is denied, per host (D10 E1) |
| Risks | False blocks lock the workflow (a broken guard now stops all edits); need a documented escape that does not weaken the gate |
| Revert | Remove `onFailure` and wrapper |

### H-02 — State enforcement scope per host and test instruction delivery (SIMPLIFY claims + IMPROVE)

| Field | Content |
| --- | --- |
| Observed problem | "Enforced" is stated without noting Bash bypass classes, project-tier removability and per-host hook differences; instruction files are not read the same way on every host |
| Affected source | README and `.claude/rules/gate-rules.md` wording; adapter documentation (owned by D01/D04 deliverables) |
| Causal hypothesis | False assurance and silent rule non-delivery (F-D10-02/09/13; F-D07 C5) |
| Proposed change | Publish a portability table: text layers portable; hooks per-host adapters; sandbox/policy host-owned; plan gate enforceable for host file tools only, heuristic with Bash unless sandboxed. Add a per-host sentinel-rule test showing a CLAUDE.md/AGENTS.md rule reaches the prompt |
| Evidence | F-D10-02, -04, -09, -13, -15, -16 (DOCUMENTED/VERIFIED); F-D07 C5 (VERIFIED) |
| Alternatives | Keep wording; scope claims only to Claude Code |
| Expected benefit | No parity claim the matrix contradicts |
| Measurement | Checklist audited against adapter code; sentinel rule appears in each host's assembled prompt |
| Risks | Narrower marketing; none for security |
| Revert | Restore prior wording |

### H-03 — Measure always-on context, then decide on a budget (EXPERIMENT)

| Field | Content |
| --- | --- |
| Observed problem | MeowKit's always-loaded volume (CLAUDE.md + rules + skill/agent listing + hook-injected text) is unmeasured; hermes enforces a snapshot, qwen warns at 15%/10k tokens; context-file cost +20% (R2 §2) |
| Affected source | CLAUDE.md, `.claude/rules/*`, skill and agent listing (counts from D02/D03) |
| Causal hypothesis | Always-on text costs cache and tokens and may dilute attention; magnitude UNKNOWN |
| Proposed change | Tokenise the always-on set on each target host; run a fixed task set with a trimmed variant; only if the delta justifies, add a CI check modelled on hermes's snapshot test |
| Evidence | F-D07-03, F-D06-10 (VERIFIED); 2602.11988 via R2 (RESEARCH-SUPPORTED, single primary, does not test gate content) |
| Alternatives | Do nothing; rely on `mk:context-audit` |
| Expected benefit | Know the number; avoid silent growth |
| Measurement | Always-on tokens; pass rate and tokens per task, ≥5 runs per arm |
| Risks | Trimming rules that carry real protection; do not trim security rules on size alone |
| Revert | Restore trimmed text |

### H-04 — Test per-model scaffolding before assuming it is needed (EXPERIMENT)

| Field | Content |
| --- | --- |
| Observed problem | MeowKit applies workflow density by tier, but hermes found one scaffold block gave <1 pt (p=0.14); on this host the model name was not detected (L-10) |
| Affected source | tiering/density logic and rules (D03/D05); not re-read here |
| Causal hypothesis | Scaffolding helps weaker models and costs tokens on stronger ones (H2) |
| Proposed change | A/B each scaffolding block (e.g. phase 3.5/3.6 steps, rule sets) against off on ≥2 model tiers |
| Evidence | F-D07-04 (DOCUMENTED-in-source, own unpublished run); Anthropic Fable 5 prompting guidance (R2 §4, vendor statement) |
| Alternatives | Keep uniform scaffolding |
| Expected benefit | Evidence-based drops or keeps |
| Measurement | Paired runs ≥5/arm per model, pass rate, tokens, wall time |
| Risks | Under-powered tests; confounds from host version |
| Revert | None needed; experiment only |

### H-05 — Add a verification-evidence record with a bounded nudge (EXPERIMENT)

| Field | Content |
| --- | --- |
| Observed problem | "Done" without fresh verification is a plausible failure; hermes records verification commands per session and nudges ≤3 times, never blocks |
| Affected source | `mk:verify` and the pre-ship path (owned by D01/D03); not read here |
| Causal hypothesis | A deterministic evidence record catches unsupported completion more cheaply than another review agent |
| Proposed change | Prototype outside production: log verification commands run after code edits; at Stop, one bounded nudge if none. Keep human Gate 2 |
| Evidence | F-D07-02 (VERIFIED mechanism; benefit HYPOTHESIS); R2 §4: native `/verify` is a different feature, so no native substitute is implied |
| Alternatives | Reviewer-only; do nothing |
| Expected benefit | Lower rate of claimed-done-without-test |
| Measurement | Rate of completion claims without verification and of post-merge fixes, with vs without nudge |
| Risks | Stop hooks are outside `onFailure:"block"` coverage (R2 §4); nudge loops (cap at 3) |
| Revert | Remove hook |

### H-06 — Head-to-head against native review/simplify/verify/security-review (EXPERIMENT)

| Field | Content |
| --- | --- |
| Observed problem | Names and intents overlap with CC natives; value of MeowKit variants unknown |
| Affected source | `mk:review`, `mk:simplify`, `mk:verify`, `mk:cso` (owned by D02) |
| Causal hypothesis | MeowKit variants add repo-specific gates in some cases and duplicate in others |
| Proposed change | `claude plugin eval --ablation with-without`, pinned `--model`/`--judge-model`, ≥5 runs per case; arms: stock, native command, MeowKit skill. Requires packaging a minimal plugin manifest (INFERRED not currently a plugin) |
| Evidence | F-D10-05, F-D10-06, F-D10-11 (DOCUMENTED, R2 confirmed the tool and command list) |
| Alternatives | Custom `-p` harness; do nothing |
| Expected benefit | Keep/simplify/delegate decisions with data |
| Measurement | Δ pass rate, tokens, variance per arm; `--bare` is not the stock arm (F-D10-06) |
| Risks | Eval cost (cases × runs × 2 + judge); fresh-context review evidence is itself Weak (R2 §6d) |
| Revert | None |

### H-07 — Compare named specialists with generic children (EXPERIMENT; maintainer decision, options only)

| Field | Content |
| --- | --- |
| Observed problem | The 44-file agent roster is a design choice; no harness in this study ships such a roster by default and none has data on it |
| Affected source | `.claude/agents/*` (counts from D03) |
| Causal hypothesis | Context isolation and tool restriction, not persona, carry any benefit (F-D07 D8, INFERRED) |
| Proposed change | Run three arms on the same tasks: named specialists, one generic child with the same prompt, single agent. Options after results: keep / reduce to roles with distinct tool access / hybrid. No change is proposed before data |
| Evidence | F-D06-19/20/28, F-D07-08/24 (VERIFIED absence); R2 §6a (Weak; contested by CAID Claude-only +6 pp) |
| Alternatives | Keep as is |
| Expected benefit | Know whether roster size earns its cost |
| Measurement | Pass rate, tokens, wall time, merge conflicts |
| Risks | Tool-restriction enforcement differs by host (qwen UNKNOWN); results from 2025–26 models may not transfer |
| Revert | None |

### H-08 — Layer native deny rules and host telemetry beside, not instead of, MeowKit hooks (DELEGATE TO HOST, partial)

| Field | Content |
| --- | --- |
| Observed problem | `main` has no `permissions.deny` and no `sandbox` key (L-12); native deny holds in all modes and covers recognised Bash reads; host OTel exposes tokens, cost, delegation |
| Affected source | `.claude/settings.json` @ `c7ff0a9e`; `privacy-block.cjs`; trace/observer hooks (D01/D05) |
| Causal hypothesis | Native rules are evaluated regardless of hooks (F-D10-03) and a second layer covers hook faults |
| Proposed change | Add native `Read(...)` deny and `sandbox.filesystem.denyRead` for secret paths; keep `privacy-block` for patterns native rules cannot express. For tokens/cost/delegation, prefer host OTel where it exists and keep hooks for MeowKit-specific facts (gate state) |
| Evidence | F-D10-03, F-D10-07, D10 D10-2/6 (DOCUMENTED); read-only coverage unverified |
| Alternatives | Hooks only; do nothing |
| Expected benefit | Two independent layers; less custom telemetry |
| Measurement | Secret-read coverage matrix on Read tool, `cat`, `python -c`, `grep -r`, `find -exec` in default and bypassPermissions modes (D10 E2); OTel parity (D10 E7) |
| Risks | Sandbox/credential defaults need configuration (`sandbox.credentials`, inherited env); users on hosts without these rules lose nothing, since the hook stays |
| Revert | Remove added settings |

## 11. Not covered and open questions

**Not covered**
- Source of Claude Code and Cursor (closed). Goose Rust, OpenCode enforcement, Aider beyond grep, any host not listed in section 2.
- No host or harness was executed; no experiment in this document has been run. This session cannot pin model versions or run a host without MeowKit (evidence ledger, host capabilities).
- MeowKit's own always-on volume, hook latency, gate behaviour and component sizes: owned by D01–D05 and not re-derived here.
- Lectures 02–04, 06–10, 12–14 and projects 02–08 of Learn Harness Engineering; Pocock's articles and talks; Terminal-Bench leaderboard numbers (D09 §1).
- Claude Code hook Stop/SubagentStart payloads, OTel events after `tool_decision`, the tail of the skills page (D10 §8); R2 confirmed the hook-semantics, skill-budget, sandbox and command claims but not these unread parts.

**Open questions**
1. Which hosts beyond the eight in D10 did the research directive intend (Copilot agent, Windsurf, Cline, Amp)? None were studied.
2. Does qwen's agent `tools`/`disallowedTools` frontmatter get enforced by its scheduler? Does its sandbox default on? (F-D06 §7)
3. Default enabled tool count and total assembled prompt size for dsh; whether any dsh plugin hard-stops identical-call loops (F-D06 §7).
4. Hermes commit volume (17,230 in 30 days) and how much is automated; whether any memory/skill benefit result lives outside the repo (F-D07 §7).
5. Whether a bundled CC command shadows a same-named MeowKit skill (D10 §8, E6).
6. Whether MeowKit runs unchanged under `claude plugin eval` once packaged (D10 F-D10-05).
7. Whether `.meowkit/memory/` exists on `main` (absent at `fc278b31`, L-02; not re-checked here).
8. Do fresh-context review findings (single author, R2 §6d) hold for other labs and for 2026 models? Needed before removing or adding any reviewer.

Prompt-injection observations: none in the findings consulted; no reference repo addressed the compiler.
