# 20.7 Observability and evaluation architecture

Compiled 2026-11-15 from `findings/` (D05 Parts B/C primary; D06, D07, D09, D10; R1 and R2 override the auditors). Baseline: `main` @ `c7ff0a9e`. D05 read the tree at `fc278b31`; main differs under `.claude/` in 16 files, so D05 citations carry `@fc278b31` unless re-checked. Nothing here was re-run except the test counts in section 6 (VERIFIED by `git ls-files`/`git grep` on `c7ff0a9e`).

## Three things this document keeps apart

| Term | Question it answers | Evidence it produces | Can it say a mechanism helps? |
| --- | --- | --- | --- |
| Runtime observability | What happened in this run? | Events, counters, costs, traces | No |
| Behavioural evaluation | Was the outcome good? | Grader verdicts on a run's result (tests pass, rubric score) | Only for that run |
| Causal experimentation | Did a mechanism cause the difference? | Paired arms (with/without X), pinned model and effort, repeated trials, variance | Yes, within the tested tasks |

Logs are not grades, and grades without a control arm are not causes. MeowKit today has a partial version of the first, a written-but-never-run procedure for the second, and nothing for the third (F-D05-11).

## 1. Summary

1. **Observability is partial and partly misleading.** Of the signals MeowKit writes, two work as labelled, several are partial, three have no consumer, and the cost/budget pair is wrong: "budget" is `ceil(chars/4)` of some tool I/O at a stale price, never reset, and its "block" returns text with exit 0 that the host probably never shows the model (F-D05-09, R1 item 8; VERIFIED source, DOCUMENTED host behaviour, not tested live).
2. **Real cost and usage do not arrive on hook stdin.** They are reachable through statusline stdin, OpenTelemetry, headless `--output-format json`, and (unverified) the transcript (F-D05-09; D10 §2.D).
3. **Hosts differ sharply.** Codex emits skill invocation, hook runs, compaction and delegation natively; Claude Code emits tokens, cost, tool and permission decisions, delegation, but no dedicated skill, compaction-as-event or hook-run signal by default; Cursor telemetry is UNKNOWN (F-D10-07, D10 §2.D).
4. **Recommended boundary: option (c) plus a mechanical fix of (b).** Repair the signals that mislead, then delegate collection to host telemetry and keep in MeowKit only facts the host cannot know (gate and plan state, interventions). Do not build a backend (section 7).
5. **There is no outcome evidence anywhere.** No agent-outcome test, no with/without arm, empty benchmark results, and a dead-weight registry with no measured delta (R1 item 13). Absence in this repo is not evidence of no benefit.
6. **The host ships the with/without harness.** `claude plugin eval` runs a with-plugin arm and a no-plugin arm in fresh sessions, but only for plugin skills and agents, so it cannot ablate hooks, rules or gates (R2 §4). A headless harness is still needed for those (section 8).
7. **Machine artefacts are separated** (section 2.3): the 8,713-turn, $129.97 budget state and `LEAN` bypass log are this machine's data, not kit properties.

## 2. What MeowKit records today

### 2.1 Signal inventory

Status key: **works** = does what its name says and something reads it; **partial** = real but narrower than labelled; **no consumer** = written, nothing reads it; **wrong** = output misrepresents what it names.

| Signal | Producer (hook/handler) | Actual schema | Path and retention | Consumer | Status | Source |
| --- | --- | --- | --- | --- | --- | --- |
| `file_edited` trace | `learning-observer.cjs` (PostToolUse Edit/Write) | event + file path + `edit_count` | `.meowkit/telemetry/trace-log.jsonl`; rotate at 50 MB to `.gz`, rotated files never deleted | `mewkit trace score/audit` (counts, entropy) | partial: `edit_count` is cross-session cumulative, while loop-detection is per-session | F-D05-10 |
| `session_end` trace | `post-session.cjs` (registered on Stop) | `{recent_files}` = files in last 5 commits | same file | same | wrong name: fires every turn, not at session end; payload is a git proxy | F-D05-09/10 |
| Canonical events `harness_run_start`, `contract_signed`, `verdict_written`, `cost_sample`, `benchmark_result`, `friction`, `dead_weight_audit_needed` | skills / post-session (model change) | documented in trace schema | same | `mk:trace-analyze` | absent locally (0 rows); `cost_sample` emitted nowhere; `dead_weight_audit_needed` has no consumer in code | F-D05-10 |
| cost-log | `post-session.cjs` | cumulative snapshot per Stop; `model` is `unknown` in 111 of 226 rows | `cost-log.json`, capped at 1000 rows, whole file rewritten each Stop | `mewkit budget` (TS only at `fc278b31`; no Rust verb found) | wrong: monotonically rising cumulative value written once per turn; summing it gave $47,740 on this machine | F-D05-09 |
| budget-state | `budget-tracker.cjs` (PostToolUse) | `ceil(len/4)` of tool I/O for Edit, Write, Bash only; `tool_response` priced at the output rate; hard-coded old price table; `cache_*` always 0 | `state/budget-state.json`; nothing resets it per session | checkpoints, post-session | wrong: not cost, not per-session | F-D05-09 |
| Budget/loop "block" markers | `budget-tracker.cjs`, `loop-detection.cjs` via `dispatch.cjs` | plain-string stdout, exit 0 | stdout only | the model, in theory | wrong: blocks nothing; PostToolUse plain stdout is not shown to Claude (only `additionalContext` JSON or exit 2 stderr) | R1 item 8; R2 §4 |
| Loop counter | `loop-detection.cjs` | per-file edit counts | `state/edit-counts.json`, never pruned; trace emission deliberately removed | stdout marker above | partial (visibility as above) | F-D05-10 |
| hook-log probes | `control-probe`, `precompact-probe`, `posttoolfailure-probe` via `logHookEvent` | probe rows (226 control, 265 failure, 15 precompact on this machine) | `telemetry/hook-log.jsonl`, rotate 50 MB, never deleted | nobody; the probe questions are answered | no consumer | F-D05-10 |
| Checkpoints | `checkpoint-writer` (Stop), `auto-checkpoint` | estimates plus git state | `state/checkpoints/checkpoint-latest.json`, overwritten | resume orientation (not traced) | works, but carries the budget estimate | F-D05-10 |
| Review evidence | `review-evidence-tag.cjs` (PostToolUse Bash) | tag per `mewkit review read --session` call | `tasks/reviews/<s>/hook-evidence.jsonl` | `mewkit review coverage` | works, narrow: driving session only (self-documented) | F-D05-10 |
| Gate-bypass record | `gate-enforcement.cjs` | one line per `LEAN` contract bypass | `telemetry/lean-bypass.log` | nobody | no consumer. Keep: `gate-rules.md` requires a durable record of overrides | F-D05-10; gate-rules |
| Statusline | host stdin to `statusline.cjs` | real `cost.total_cost_usd`, context usage, rate limits, model name | display only, not persisted | human | works (the only real-cost consumer) | F-D05-09 |
| Injection audit | manual `node injection-audit.cjs` | `security-log.md` on CRITICAL | `telemetry/security-log.md` | human | not automatic; privacy-block and gate-enforcement log nothing | F-D05-10 |
| Edit ledger | `learning-observer.cjs` | per-file ledger | `state/learning-observer.jsonl`, never pruned | itself | works, unrelated to the memory design docs | F-D05-05 table |
| Model identity | `model-detector.cjs` -> `state/detected-model.json` | model id or `unknown/default` | overwritten | `resolve-model`, trace `model`, density/tier | partial: reads SessionStart `model`, which the host "doesn't always include"; 459 of 1556 trace rows empty | F-D05-10; R2 §4; L-10 |
| `mewkit trace score/audit/propose` | CLI over trace-log | structural metrics (event count, diversity) | reads trace-log | human | works, but measures structure, not outcomes | F-D05-10 |
| `mk:trace-analyze` / `analyst` | LLM scatter-gather over the same log | none stored | none | human gate | unverified (not run); input has two event types | F-D05-10 |

Further defects carried from D05 (VERIFIED unless marked):

- **Schema doc vs code.** The trace schema documents `session_end {duration_seconds, total_cost_usd, error_count}` and a `cost_sample` event from `budget-tracker.sh`; the code emits `{recent_files}` and no `cost_sample` (`git grep` at `fc278b31`).
- **`trace-log.cjs` header** says the stream "may be committed"; `.gitignore:53` ignores `telemetry/` (CONTRADICTED).
- **Same word, two meanings:** `edit_count` (cumulative across sessions) vs loop-detection (per session).
- **Retention:** rotated `.gz` logs, `edit-counts.json`, the ledger and `state/` are never pruned; only cost-log is capped.
- **Registration with no handler:** `SubagentStart` and `SubagentStop` are registered with empty handler arrays (L-03), so delegation, the one thing the host reports well, is not recorded by MeowKit.

### 2.2 What the existing consumers can and cannot answer

`mewkit trace` and the analyst agent consume `file_edited` and `session_end` only. Every outcome-relevant canonical event is absent locally. So no current consumer can answer "was the run good" or "did a gate change the result" (F-D05-10, F-D05-11).

### 2.3 Machine artefacts, not kit properties

| Item | Why it is local |
| --- | --- |
| `turn_count 8713`, `estimated_cost_usd 129.97`, `warnings_emitted 4256`, 226 cost-log rows, 1556 trace rows | Counts of one machine's git-ignored files (F-D05-09/10). They prove the mechanism (no reset, per-turn append) but their size is this user's history |
| 325 `lean-bypass.log` lines | Caused by the untracked `settings.local.json` exporting `MEOWKIT_AUTOBUILD_MODE=LEAN` (L-14) |
| "Model: not detected", `unknown/default` | Host here is the desktop/Agent SDK app and SessionStart omitted `model` (L-10, INFERRED cause). The kit property is that detection depends on an optional field |
| `mewkit` absent on PATH, so `trace`/`budget` and memory lint skip | Machine setup (R1 §8) |

## 3. What the host exposes versus what MeowKit assumes

### 3.1 Assumptions that do not hold on Claude Code

| MeowKit assumes | Host reality | Label | Source |
| --- | --- | --- | --- |
| A hook can read the model | Only SessionStart may carry `model`, and "doesn't always include it"; no `$CLAUDE_MODEL` env | DOCUMENTED | R2 §4; F-D05 §2.1 |
| A hook can read token usage or cost | Not in hook input; real cost is in statusline stdin, OTel, or headless JSON | DOCUMENTED | F-D05-09 |
| PostToolUse stdout reaches the model | Plain stdout reaches Claude only on UserPromptSubmit, UserPromptExpansion, SessionStart, PostModelSwitch (and PreCompact); PostToolUse needs `additionalContext` or exit 2 | DOCUMENTED (not tested live) | R2 §4; R1 item 8 |
| Hooks run on Codex and Cursor | MeowKit hooks are not ported there (`hook-coverage.json`, per R1 §8), so MeowKit collects nothing on those hosts by itself | DOCUMENTED / INFERRED | R1 §8 |
| `transcript_path` is a usage source | Provided but written asynchronously, format "internal, changes between versions"; whether per-message usage fields exist is HYPOTHESIS | DOCUMENTED / HYPOTHESIS | F-D05 §2.1; D10 §2.D |

### 3.2 Candidate signals on Claude Code (MeowKit's primary host)

Status: **exposed** = host provides it directly; **derivable** = computable from exposed data or MeowKit artefacts; **unavailable** = neither. Cell source ids refer to D10 matrix D (rows carry no individual F-ID, so "D10-D" plus the doc section S8 = monitoring-usage page is the finding reference) and F-D05 where noted. Granularity and reliability marked INFERRED are mine from the cited mechanism.

| Signal | Status | Mechanism | Granularity | Reliability | Privacy default | Cite |
| --- | --- | --- | --- | --- | --- | --- |
| Task lifecycle | derivable | `TaskCreated`/`TaskCompleted` hooks (host tasks, not MeowKit plans); MeowKit plan/verdict files for its own lifecycle | per task | `onFailure` does not cover TaskCompleted (R2 §4); MeowKit files are agent-writable | n/a | D10-D; R2 |
| Model identity | exposed, partial | `SessionStart.model` (optional), `PreModelSwitch` from/to, OTel `api_request.model`, stream-json `system/init` | per session / per request | SessionStart optional (R2); OTel strongest | not sensitive | D10-D; R2 |
| Model configuration (effort) | exposed | common hook stdin `effort`; OTel `effort` attribute | per event | good | not sensitive | F-D05 §2.1; D10-D |
| Context usage | derivable | statusline `context_window.*`; per-request tokens via OTel/JSON; no per-hook context-% field seen (UNKNOWN) | per request / per render | statusline interactive only | not sensitive | F-D05 §2.1; D10-D |
| Compaction events | exposed | `PreCompact`/`PostCompact` hooks; OTel `query_source: compact` | per compaction | good | not sensitive | D10-D |
| Skill activation | partial | OTel `skill.name` attribute on cost/token events; tool details if `OTEL_LOG_TOOL_DETAILS` set; PreToolUse on the `Skill` tool (INFERRED, not seen documented as an event) | per request (OTel) | indirect; no dedicated event | tool details off by default | D10-D; F-D10-07 |
| Agent delegation | exposed | `SubagentStart/Stop` hooks (`agent_id`), OTel agent attributes, stream-json `parent_tool_use_id`; hooks also run inside subagents | per subagent | good; MeowKit leaves its handlers empty (L-03) | not sensitive | D10-D; R1 §7 |
| Tool execution | exposed | PreToolUse/PostToolUse(+Failure) with `duration_ms`; OTel `tool_result` | per call | good | args/content off by default | D10-D; F-D10-08 |
| Hook invocation | partial | `--include-hook-events` stream (SessionStart/Setup always, others need the flag); `claude_code.hook` span only in detailed beta tracing | per hook run | beta, headless-oriented | not sensitive | D10-D |
| Permission decisions | exposed | OTel `tool_decision` (source, classifier verdict, mode); `PermissionRequest`/`PermissionDenied` hooks; headless `permission_denials` | per decision | good | not sensitive | D10-D |
| Errors | exposed | `PostToolUseFailure` hook; OTel `api_error`, `api_refusal` | per error | good | message text may leak content (UNKNOWN) | D10-D; F-D05-10 |
| Retries | exposed | OTel `api_error.attempt`; stream `system/api_retry` | per attempt | good | not sensitive | D10-D |
| Token usage | exposed | OTel `token.usage`; `--output-format json`; statusline; **not** hook stdin | per request / per session | good | not sensitive | F-D05-09; D10-D |
| Cost | exposed | statusline `cost.total_cost_usd`; OTel `cost.usage`; JSON `total_cost_usd` (client-side estimate, "can differ from your bill") | per session / per request | estimate, not billing | not sensitive | F-D05-09; D10-D |
| Budget consumption | derivable | from cost above; host cap `--max-budget-usd` exists only in print mode | per session | MeowKit's own figure is wrong (section 2.1) | n/a | D10-E; F-D05-09 |
| Verification results | derivable | Bash PostToolUse exit codes for test/lint/build commands; MeowKit verdict and evidence files (narrow, F-D05-10). No host concept | per command | heuristic: command matching is MeowKit's to write | command text and output are content | INFERRED from F-D05-10, D10-D |
| Task outcomes | unavailable | no host signal; only graders or a human can state it | per task | n/a | n/a | F-D05-11 |
| Cross-agent dependencies | partial | parent/child ids exist (`agent_id`, `parent_tool_use_id`); a dependency graph between tasks is not exposed | per edge | structural only | not sensitive | D10-D; INFERRED |

**Where real cost and usage are reachable (Claude Code).**

| Channel | Works for | Limits | Cite |
| --- | --- | --- | --- |
| Hook stdin | nothing cost-related | no token/cost field (excerpt read, not exhaustive) | F-D05 §2.1 |
| Statusline stdin | interactive sessions: `total_cost_usd`, context, rate limits | display path; MeowKit does not persist it; a statusline script could | F-D05-09 |
| OTel `cost.usage` / `token.usage` / `api_request` | any mode with telemetry on | repo `.claude/settings*.json` cannot enable it or set the endpoint; managed `env` can; off by default | D10-D |
| `--output-format json` / stream-json | headless runs, per model | client-side estimate; only for `-p` | D10-D |
| Transcript JSONL | possibly per-message usage | unstable format, async lag; usage fields unverified | HYPOTHESIS (F-D05 §2.1) |

### 3.3 Other hosts (what is known)

| Host | Native telemetry | Hooks as MeowKit-collected source | Privacy default | Cite |
| --- | --- | --- | --- | --- |
| Codex | Richest OTel: token usage, turn cost, `hooks.run`, `skill_invocation`, `skill.injected`, `compaction`, `multi_agent.spawn`, `tool_decision`, `approval.requested`, `sandbox_outcome` (VERIFIED by string names in cloned source, not executed) | SessionStart, tool, subagent, compact events; MeowKit hooks not ported | `log_user_prompt` option, admin-lockable; default UNKNOWN | F-D10-07/08 |
| Cursor | UNKNOWN (no OTel page retrieved) | hooks carry `model`, `conversation_id`, `generation_id`, `transcript_path`; subagent and after-response events | UNKNOWN | D10-D |
| Gemini CLI | logs, metrics, traces | AfterModel/AfterTool etc. | `logPrompts` default **true** | F-D10-08 |
| Goose, Pi, OpenCode, Aider | Goose OTLP env; Pi vendor-neutral telemetry package and session JSONL; OpenCode `openTelemetry` key, signals UNKNOWN; Aider opt-in analytics and history files | in-process or none | UNKNOWN except where stated | D10-D |

A cross-host design cannot assume one privacy default or one signal set (F-D10-08).

## 4. OpenTelemetry and other standards

| Question | Answer | Label / cite |
| --- | --- | --- |
| What does Claude Code emit natively? | Metrics (sessions, lines changed, PRs, commits, `cost.usage`, `token.usage` with model/effort/agent/skill/plugin attributes), events (`user_prompt`, `assistant_response`, `tool_result`, `tool_decision`, `api_request`, `api_error`, `api_refusal`), beta traces including `claude_code.hook`; all prompt/tool-content gates off by default | DOCUMENTED, first 100k of 176k chars of the page read (D10 S8); events after `tool_decision` unread |
| Codex | the richest set (section 3.3) | VERIFIED strings |
| What gaps remain on Claude Code? | no dedicated skill-activation, hook-run (default) or compaction-count event seen; Cursor unknown | D10-D; F-D10-07 |
| What could MeowKit add? | (1) document the exact `CLAUDE_CODE_ENABLE_TELEMETRY` and `OTEL_*` settings; (2) a CLI that reads what a collector wrote and normalises it to one schema, never a collector; (3) hook-side events only for facts the host cannot know: plan state, gate decision, intervention records. Whether run-level labels (arm, task id) can be attached through standard OTel resource-attribute env vars on each host is UNKNOWN | INFERRED; D10-6 |
| Can the repo turn telemetry on? | Not on Claude Code via `.claude/settings*.json`; only managed settings or the user's environment | DOCUMENTED (D10-D) |
| What OTel does not solve | **Evaluation**: it records that a run happened and what it cost, not whether the result was right. **Reproducibility**: model, version and effort must be pinned by the experiment, and telemetry cannot make a non-deterministic run repeatable (qwen's own series spans 1.40 pp with identical config, F-D06-25). **Causal attribution**: no control arm exists in a log of one configuration | INFERRED from the definitions above; F-D06-25 |
| Other reference designs | deepseek-harness: append-only typed JSONL event log as single source of truth, OTel plugin gated on explicit feedback (F-D06-22). hermes-agent: ShareGPT-style trajectory JSONL for dataset generation, not for quality grading; outbound metrics behind a consent gate, and ungated outbound telemetry is rejected by its contributor rules (F-D07-14). qwen-code: full OTel plus default-on usage statistics to a vendor host (F-D06-22 and the usage-statistics note) | VERIFIED, shallow |

## 5. Privacy and security of telemetry

What lands on disk today (all `.meowkit/telemetry/` and `.meowkit/state/`, git-ignored; DOCUMENTED by D05, VERIFIED on reviewed hooks only):

| Data | Redaction | Export path | Retention | Source |
| --- | --- | --- | --- | --- |
| Absolute paths of every edited file (including `/Users/<name>/...`) in trace, ledger, edit-counts, checkpoints | none; scrub patterns cover keys, emails, JWT, DB URLs, not paths | none found in reviewed hooks | rotate at 50 MB, rotated files never deleted; ledger and edit-counts never pruned | F-D05 §2.2 |
| Tool arguments and responses | not logged raw (char counts only) | none | n/a | F-D05 §2.2 |
| Prompts | not logged | none | n/a | F-D05 §2.2 |
| Attacker payloads | `security-log.md` quotes them by design, only via manual audit | none | none | F-D05 §2.2 |
| Session ids, model, git branch and hash | none | none | as above | F-D05 §2.2 |

Findings and limits:

- **No network path was found** in the reviewed hooks, and the CLI has no export verb at `fc278b31`. Not examined: Rust `trace.rs` internals (D05 coverage list). VERIFIED for reviewed files only.
- **The stated "may be committed" comment contradicts the ignore rule.** The risk is not that the logs are committed but that an unreviewed comment says they may be. Whether ignored telemetry could enter the kit release set (the owner's note says `tasks/` and `.meowkit/` ship) is UNKNOWN; the ship-set tests are the place to check.
- **Redaction is regex-based and false-positive tolerant**; it does not touch paths. Local, ignored, low risk (D05 decision D13 = DEFER).
- **Raw prompt and tool-argument logging would be the new risk.** Prompts can contain secrets and attacker text; logged tool arguments can contain file contents; logs read back later by a model or an analyst agent become an injection channel (INFERRED; the memory-lint evasion results, R1 item 9, show text filters are tripwires, not boundaries). Claude Code keeps prompts, tool details and raw bodies off by default, Gemini turns prompt logging on by default, Codex makes it admin-lockable (F-D10-08).
- **Collection and access:** project-tier hooks can be disabled or edited by the user or the agent; only managed policy is tamper-resistant on Claude Code, Codex and Cursor (F-D10-09). Telemetry kept by hooks is therefore advisory evidence, not an audit trail.

Data-minimisation rules the evidence supports (INFERRED from the above, proposed as O-09):

1. Log identifiers, counts, durations and outcome codes; never prompt text, tool arguments, tool output or file contents by default.
2. Log paths relative to the repo root, or a hash, not absolute home paths (DEFER-level, local risk).
3. Any export is opt-in, named in the task, and off by default (hermes and deepseek precedent, F-D07-14, F-D06-22).
4. Anything fed back to a model must pass through the same "data, not instructions" treatment as memory, and attacker payload text is recorded by reference (file, line, rule id), not verbatim.
5. Every log has a retention rule and a named consumer, or it is not written.

## 6. Evaluation today

### 6.1 Test taxonomy

The four classes the question asks for, with counts. D05 counted `fc278b31`; the TS CLI was then retired, so I recounted `c7ff0a9e` with `git ls-files`/`git grep` (VERIFIED, my commands). Class assignment follows D05's description of test content, not a per-file audit.

| Class | What it checks | `fc278b31` (D05) | `c7ff0a9e` (recounted) |
| --- | --- | --- | --- |
| Structural | file presence, frontmatter, budgets, registration, ship sets; `.test.sh` skill-contract scripts | in the 257 TS files and 19 shell | 41 TS/JS test files; 19 `*.test.sh` |
| CLI behaviour | Rust CLI verbs, parity fixtures, memory scan | 157 Rust test files, 1154 `#[test]` | 266 Rust files with `#[test]` (1662 attributes; 108 `.rs` files under `tests/`) |
| Hook behaviour | spawned hooks, exit codes, memory lint | 12 hook `.cjs` tests plus TS spawn tests | 12 files under `.claude/hooks/__tests__`; hook tests also in the 41 TS files |
| Agent outcome (LLM does a task, with a grade) | does the agent finish the work | **0** | **0** |
| Other | Python skill-script tests | 26 | 18 files |
| Live-run specs, never recorded | 19 journey specs (prompt, expected route, allowed and forbidden artefacts) plus a side-effect oracle | 19 | 19 lines in `journey-specs.jsonl`; no stored live-run results found |

D05's one full run (on `fc278b31`): 2998 vitest tests, 9 failed, assessed as an artefact of running in an uncommitted scratch repo (INFERRED; not re-run in the real checkout). None of the 2998 exercises an LLM (F-D05 §3.3). I did not re-run any suite for this document.

**Plain statement: there is no agent-outcome test, and no with/without arm, anywhere in the repository.** The tests establish that the machinery behaves as coded. They do not establish that the machinery helps (F-D05 §3.2; R1 item 13). This is absence of evidence of benefit, not evidence of no benefit.

### 6.2 State of the evaluation components

| Component | State | Source |
| --- | --- | --- |
| `mk:benchmark` | self-described "experimental/manual"; `run-canary.sh` writes a manifest of `PENDING` tasks and instructions, "intentionally a half-impl"; 6 canary specs; `results/` holds only `.gitkeep` (re-verified on main); canary 03 references a fixture that is not in the tree; README reads as if it produces results | F-D05 §3.1 |
| Thresholds | Rule 3 says 0.02 delta, Rule 5 says "<1 point"; with 5 tasks and 1 trial that is inside noise (INFERRED) | F-D05 §3.1 |
| `mk:evaluate` and rubric | define a live-app grading procedure; no stored verdicts; `calibration-set/` has only a README | F-D05-11, §3.2 |
| `evaluator` agent | active verifier by design; no recorded verdict, so "catches bugs structural review misses" is asserted, not measured | F-D05 §3.2 |
| Dead-weight audit registry | process defined; every "Measured delta" is N/A or "not measured (baseline deferred by owner)"; Athena "Not yet measured" | R1 item 13 |
| `.claude/eval/track-m-adapter-core.cjs` | 30-line adapter-runner helper behind an env opt-in, no tasks | F-D05 §3.1 |
| Design intent | compare MeowKit against MeowKit-minus-component, not against the native host | F-D05 §3.1 |

### 6.3 What comparable projects measured

| Project | Practice | Weight | Source |
| --- | --- | --- | --- |
| qwen-code | one outcome series: SWE-bench Verified over 7 releases, same model, 3 trials, quarantine rule if infrastructure failures reach 10; scores 76.40 to 77.80 percent while the codebase grew; no per-feature ablation | DOCUMENTED, not reproduced; shows noise scale and a usable protocol, says nothing about scaffolding on other tasks | F-D06-25 |
| deepseek-harness | `benchmarks/` measures harness performance, not task success; agent correctness via recorded-session snapshot replay; "verify the world, not the self-report"; no task-success score published | VERIFIED | F-D06-24 |
| hermes-agent | prompt-surface snapshot test fails CI on any prompt or tool-list change; an on/off scaffolding A/B (5 runs each) excluded one model family (under 1 point, p=0.14); core-tool deferral A/B over 288 live runs, accuracy 0.923 vs 0.916 | VERIFIED as artefacts, not reproduced; small n, single-author harness | F-D07-03/04/05 |
| learn-harness-engineering | lecture 11 is concepts plus a 260-line simulated logger, no OTel code; `harness-creator` score is 25 file-presence and substring checks, its 10 evals never executed | VERIFIED; structural only, not an outcome metric | F-D09-03/04 |

## 7. Architectural boundary: should MeowKit own an observability backend?

### 7.1 Options

| Option | What it means | Evidence for | Evidence against | Cost (INFERRED) | Risk | Rating |
| --- | --- | --- | --- | --- | --- | --- |
| (a) Keep current local logs as is | no change | works for `file_edited`, checkpoints, statusline | cost and budget signals wrong; "block" invisible; per-turn `session_end`; schema doc wrong; 3 logs without consumers (section 2.1) | none | misleading output keeps being trusted (a figure labelled cost that is not cost) | reject: leaves verified defects |
| (b) Fix existing signals and stop | mechanical repairs O-01 to O-06 | each defect is VERIFIED and small | does not give true cost, cross-host data, or any outcome signal | small | low; stays CC-only | necessary, not sufficient |
| (c) Delegate collection to host telemetry; CLI only normalises, inspects, exports | MeowKit documents and reads host OTel/JSON/statusline; hooks record only gate, plan and intervention facts | host already emits tokens, cost, delegation, tool and permission decisions (D10-D); Codex emits skills, hook runs, compaction (F-D10-07); D10-6 proposes the same | repo cannot enable OTel on Claude Code (managed env or user only); Cursor UNKNOWN; CC lacks default skill, hook-run and compaction-count signals | small to medium: docs, one normaliser verb, parity check | depends on user setup; schemas change monthly (D10 header) | **best** |
| (d) Build a MeowKit backend | own collector, store, query, dashboards | none found | no consumer exists for current logs (INFERRED demand signal); retention and privacy duties (section 5); duplicates host OTel; Rust CLI maintenance; peers gate outbound telemetry behind consent (F-D07-14) | large, ongoing | PII and attacker text at rest; second source of truth that drifts | reject |

### 7.2 The 14-question decision framework applied to (c) with (b) as precondition

The questions are the research directive's architectural decision framework, verbatim in substance. Answers are for option (c) plus the (b) repairs. (Corrected by the lead: the first draft of this table used a reconstructed question list.)

| # | Question | Answer for (c) + (b) | Label |
| --- | --- | --- | --- |
| 1 | What exact problem exists? | The cost, budget and "block" signals are misleading; three logs have no consumer; true cost is not captured; there is no outcome data | VERIFIED (D05 Part B; R1 claim 8) |
| 2 | Where is it demonstrated in source code? | `budget-tracker.cjs`, `loop-detection.cjs`, the per-Stop cost-log write in `post-session.cjs`, the trace schema doc versus emitted events — see section 2 | VERIFIED |
| 3 | What is the observed impact? | Recorded spend above the configured cap with no effect, thousands of warnings never acted on, a cost log whose rows cannot be summed, model recorded as unknown in about half of local sessions | VERIFIED (local telemetry, counts only) |
| 4 | What alternative explanations exist? | Part of the picture is this machine (LEAN override, CLI not on PATH); the computation defects are in code and independent of the machine. Whether post-tool output reaches the model rests on host docs, not a live probe | INFERRED / DOCUMENTED |
| 5 | What evidence supports the diagnosis? | Source read by D05, re-run by R1; host-doc claims confirmed by R2 | VERIFIED + DOCUMENTED |
| 6 | Can the host already solve it? | Yes for tokens, cost, delegation, tool use, permission decisions, errors; partly for skills and hooks; no for task outcomes | DOCUMENTED (D10 matrix D) |
| 7 | Can an existing MeowKit component solve it? | Yes in part: the statusline command already receives real cost; the trace verbs already exist. Repair the existing handlers before adding anything | VERIFIED |
| 8 | Can the mechanism be simplified? | Yes: replace the estimated cost with the host figure, drop logs that have no consumer (keep `lean-bypass.log`) | INFERRED |
| 9 | Is a new component necessary? | At most one normalise-and-inspect verb. A backend is not | INFERRED |
| 10 | What is the security impact? | Less content on disk than a backend; unredacted paths are logged today; data-minimisation rules in section 5 | VERIFIED / INFERRED |
| 11 | What is the maintenance burden? | One normaliser and its docs; host event names change often, so the mapping needs dated upkeep | DOCUMENTED |
| 12 | What is the runtime overhead? | No always-on context if nothing is injected. Making the budget signal model-visible adds text per tool call and must be measured first | INFERRED |
| 13 | How will improvement be measured? | Estimate versus host cost on five or more sessions; MeowKit totals versus host telemetry totals on ten runs | EXPERIMENT |
| 14 | How can the change be reverted? | Delete the normaliser and docs; restore the handlers from git | INFERRED |

Outcome class: **DELEGATE TO HOST** for token, cost, delegation, tool, permission, retry and error signals; **IMPROVE** for the signals MeowKit alone can know; **REJECT** for a backend.

## 8. Minimum viable outcome-evaluation capability

What is needed, what the host gives, what MeowKit can reuse, what is missing. Experiment designs are in deliverable 12; this section only fixes the capability list.

| Need | Host provides | MeowKit reusable | Missing |
| --- | --- | --- | --- |
| Task set with hidden graders | nothing | 6 canary specs, 19 journey specs, rubric `schema.md` | hermetic fixtures (canary 03 fixture absent), hidden tests per task |
| Headless invocation | `claude -p`; `codex exec`; Goose `run` (D10-E) | none; nothing in the repo drives a host | driver script and arm definitions |
| Pinned model and effort | `--model`, `--effort`, per-case model in plugin eval, `CLAUDE_CODE_SUBAGENT_MODEL` | trace `model` field (empty in 459 of 1556 rows locally) | a recorded pin per run, written by the driver, not inferred by a hook |
| Clean-config isolation | `--bare` (skips hooks, skills, subagents, plugins, MCP, CLAUDE.md; needs `ANTHROPIC_API_KEY`), `--setting-sources`, `CLAUDE_CONFIG_DIR`; Codex `--ignore-user-config --ephemeral` | none | a definition of the "without" arm; `--bare` is not stock Claude Code (F-D10-06), so use `--setting-sources`/`CLAUDE_CONFIG_DIR` for a closer stock arm |
| Repeated trials and variance | plugin eval runs 3 runs per case | none | N, variance reporting, the quarantine rule from qwen (F-D06-25) |
| Graders | plugin eval graders: regex, tool-used, tool-order, file-exists, `llm` rubric, `baseline`; no custom code | `side-effect-oracle.sh` (unrequested side effects), rule-survival oracle script, `compare-runs.sh`, `render-run-delta.cjs`, `benchmark_result` event | programmatic graders over hidden tests; judge model pinned and recorded |
| Cost capture | `--output-format json` total cost and per-model usage (client estimate); OTel | none usable (budget estimate is wrong) | capture of JSON cost per trial; reconciliation against OTel |
| Isolation per trial | `--no-session-persistence`, worktrees | worktree rules exist for parallel work | a fresh worktree per trial |

**The native harness, with limits.** `claude plugin eval` needs Claude Code 2.1.269 or later and git 2.31 or later, runs fresh isolated `-p` sessions, three runs per case, a with-arm and a no-plugin without-arm, graders as listed, per-case `model`, `--judge-model`, and requires the plugin to ship an `evals/` directory (DOCUMENTED, R2 §4; D10 had grep-only coverage, R2 is authoritative). Limits that matter here:

1. It applies to **plugin skills and agents only**. Hooks, rules, gates and the CLAUDE.md layer are not an ablation unit (INFERRED from "plugin skills/agents only"; `skillOverrides` does not feed it). Hook and gate value needs the headless harness.
2. MeowKit must be packaged as a plugin with an `evals/` directory. The README lists a plugin install path (ledger, provider targets); whether its manifest and layout work with plugin eval is UNKNOWN (D10 inferred it installs into `.claude/`, not verified on main).
3. Cost is cases x runs x 2 arms plus judge calls (D10 F-D10-05); a 128-skill bundle makes the "which skill" question large.
4. It tests selection and tool use (`tool_used`, `tool_order`), which is also the instrument R2 names for measuring MeowKit's skill-listing loss.

**What remains unmeasurable without new work:** whether gates reduce escaped defects, whether memory changes outcomes (no read-side instrumentation exists, F-D05-02), whether the evaluator agent catches what structural review misses. These need the headless harness and a trace of memory reads.

Realistic noise guidance (INFERRED from F-D06-25 and F-D07-04/05): a 3-trial series on 500 tasks still moved 1.40 pp with no config change, hermes used 5 runs per arm, and a 5-task, 1-trial canary cannot detect the 0.02 threshold in the benchmark rules. Treat any harness result below that scale as noise.

## 9. Recommendations

Groups: A mechanical defects in existing signals; B delegate/boundary; C experiments; D maintainer decisions. Baseline `c7ff0a9e`; D05 line citations are `@fc278b31` and must be re-confirmed with `git show` or on main before editing. "Revert" in every case is `git revert` of the single change.

### A. Defects that make existing signals misleading

**O-01 Budget and loop "block" output is not delivered to the model — IMPROVE (after O-10)**

| Field | Content |
| --- | --- |
| Observed problem | `@@BUDGET_BLOCK@@` and loop markers are plain strings, exit 0; on this machine 4256 warnings emitted, nothing stopped, and PostToolUse plain stdout is not shown to Claude |
| Affected source | `budget-tracker.cjs:75-81`, `loop-detection.cjs`, `dispatch.cjs:102-108` @ c7ff0a9e (R1 item 8; D05 lines @fc278b31) |
| Causal hypothesis | The handlers assume UserPromptSubmit-style stdout visibility on a PostToolUse event |
| Proposed change | Run the O-10 probe first. If confirmed invisible: either emit `additionalContext` JSON (or exit 2 stderr) where the message should reach the model, or stop printing it. Repair versus removal is a separate decision from measuring whether the warning changes behaviour (R1 section 5) |
| Evidence | R1 item 8 (CONFIRMED source; DOCUMENTED host rule; not tested live); F-D05-09 |
| Alternatives | do nothing (message stays inert); delete the handlers; delegate budget enforcement to host `--max-budget-usd` (print mode only) |
| Expected benefit | a signal that is either seen or absent, never silently dropped |
| Measurement | O-10 nonce probe; after the fix, the model repeats a nonce from the marker |
| Risks | model-visible text adds context cost and can be treated as instruction (injection-rules apply to tool output); none to security controls |
| Revert | revert the handler change |

**O-02 The "cost" figure is not cost — IMPROVE**

| Field | Content |
| --- | --- |
| Observed problem | `estimated_cost_usd` is chars/4 of Edit, Write, Bash I/O at an old output-rate price table, ignores model output and all other tools, never resets per session (`turn_count 8713` here) |
| Affected source | `budget-tracker.cjs:25-62`; state in `state/budget-state.json` (D05 @fc278b31) |
| Causal hypothesis | Hooks lack usage data, so a proxy was built and kept as a dollar figure |
| Proposed change | Key the state by `session_id` and reset on a new id; rename fields to say "estimated tool-I/O tokens" and drop the dollar value, or label it explicitly as a proxy; real dollars come only from host data (O-07) |
| Evidence | F-D05-09 (VERIFIED + DOCUMENTED) |
| Alternatives | delete the tracker (DELEGATE TO HOST: statusline already shows true cost); keep as is |
| Expected benefit | no figure that reads as spend but is not |
| Measurement | O-11 reconciliation against host cost on 5+ sessions; a unit test that two session ids do not accumulate |
| Risks | checkpoints and post-session read the field; changing names needs those readers updated (grep first) |
| Revert | revert |

**O-03 `session_end` fires per turn and `cost-log` appends a cumulative value per Stop — IMPROVE**

| Field | Content |
| --- | --- |
| Observed problem | `post-session.cjs` runs on Stop (each turn end), appends the cumulative snapshot; 226 rows over 7 sessions, rising from 0.17 to 129.95; naive sum $47,740 |
| Affected source | `post-session.cjs:60-80` (D05 @fc278b31); registration in `.claude/settings.json` |
| Causal hypothesis | Stop was used as a proxy for session end |
| Proposed change | Write one row per `session_id` on the SessionEnd event (host budget for SessionEnd is 1.5 s total, D10-B, so keep it minimal) or rename the event to `turn_end` and stop writing cost-log |
| Evidence | F-D05-09; D10 matrix B (SessionEnd timeout) |
| Alternatives | delete cost-log (no consumer outside `mewkit budget`, which has no Rust verb found) |
| Expected benefit | one meaningful row per session, no cumulative double counting |
| Measurement | row count equals session count in a fixture; `budget` totals match per-session sums |
| Risks | SessionEnd may not fire on crash or kill (UNKNOWN) |
| Revert | revert |

**O-04 Schema docs and counters disagree with code — IMPROVE (docs/code)**

| Field | Content |
| --- | --- |
| Observed problem | schema says `session_end {duration, cost, errors}` and a `cost_sample` event; code emits `{recent_files}` and no `cost_sample`; `trace-log.cjs` says "may be committed" while `telemetry/` is ignored; `edit_count` cumulative vs loop-detection per session |
| Affected source | trace-analyze schema doc; `trace-log.cjs` header; `learning-observer.cjs`, `loop-detection.cjs` (D05 @fc278b31) |
| Causal hypothesis | schema written for a plan that was not fully implemented; counters share a name |
| Proposed change | make the schema list only emitted events with real payloads; add a doc-vs-code check; rename or document the two counters |
| Evidence | F-D05-09/10, section 4 contradictions |
| Alternatives | implement the documented events (larger; no consumer exists) |
| Expected benefit | `mk:trace-analyze` and humans stop reasoning from fields that do not exist |
| Measurement | a test that every documented event name has an emitter |
| Risks | none |
| Revert | revert |

**O-05 Logs with no consumer, no retention — SIMPLIFY**

| Field | Content |
| --- | --- |
| Observed problem | `hook-log.jsonl` probes (the probes' own question, "does the event fire", is answered); `dead_weight_audit_needed` has no consumer; rotated `.gz` logs, `edit-counts.json`, ledger and `state/` never pruned; `lean-bypass.log` has no reader |
| Affected source | `posttoolfailure-probe`, `precompact-probe`, `control-probe`, `hook-logger.cjs`, `trace-log.cjs` (D05 @fc278b31) |
| Causal hypothesis | probes were left after their purpose was met; no retention policy was written |
| Proposed change | convert probes to a counter or remove permanent logging (D05 D9); add a retention rule for rotated files and state; **keep `lean-bypass.log`** because `gate-rules.md` requires a durable record of overrides, and add a way to read it (`mewkit trace` or a one-line report) |
| Evidence | F-D05-10; D05 D9/D13 |
| Alternatives | keep all; delete all logging |
| Expected benefit | bounded disk, every log has a named reader |
| Measurement | each remaining log has a consumer listed in a table like section 2.1 |
| Risks | removing a probe loses the only evidence that PostToolUseFailure fires; record that result in the docs first |
| Revert | revert |

**O-06 Model identity depends on an optional field and defaults silently — IMPROVE**

| Field | Content |
| --- | --- |
| Observed problem | `model-detector` reads SessionStart `model`, which the host does not always include; result `unknown/default` here; 459 of 1556 trace rows have `model:""`; routing then defaults to STANDARD/FULL |
| Affected source | `model-detector.cjs:46-49`, `resolve-model.cjs` (D05 @fc278b31; R1 item 10 on the density allowlist) |
| Causal hypothesis | model is available on hook stdin only at SessionStart and only sometimes |
| Proposed change | record a `model_source` (`hook`, `statusline`, `driver`, `unknown`) next to every model value and never write a guessed id; in a measured run the driver supplies the pinned model (section 8) |
| Evidence | F-D05-10; R2 §4; L-10 |
| Alternatives | read statusline `model.display_name` (interactive only) or transcript |
| Expected benefit | density and tier decisions, and any benchmark, know whether the model is known |
| Measurement | share of trace rows with `model_source != unknown` over 10 sessions |
| Risks | none to security |
| Revert | revert |

### B. Delegate and boundary decisions

**O-07 Delegate collection to host telemetry (option c) — DELEGATE TO HOST**

| Field | Content |
| --- | --- |
| Observed problem | MeowKit re-implements, badly, signals the host reports (tokens, cost, delegation, tools, permissions) and leaves SubagentStart/Stop empty |
| Affected source | `.claude/hooks/dispatch.cjs` observers; `handlers.json`; CLI `trace`/`budget` verbs |
| Causal hypothesis | observers were written before host telemetry covered these signals, or without checking |
| Proposed change | document the `CLAUDE_CODE_ENABLE_TELEMETRY`/`OTEL_*` setup and the headless JSON and statusline channels; add one CLI verb that reads collected output and prints a per-session summary; keep hooks only for gate state, plan state, verdicts and intervention records; keep hook-side fallback only where the host has no OTel (Cursor UNKNOWN) |
| Evidence | F-D10-07/08, D10-D, D10-6 (DOCUMENTED / VERIFIED strings); F-D05-09 |
| Alternatives | keep hooks everywhere; build a backend (O-08) |
| Expected benefit | true cost and token data; fewer MeowKit-owned observers to maintain |
| Measurement | O-11 parity: MeowKit totals vs OTel totals on 10 runs |
| Risks | OTel is off unless the user or managed policy enables it, so some users get no data; event names change monthly; privacy defaults differ per host |
| Revert | delete the verb and docs; hooks unchanged |

**O-08 Do not build a MeowKit observability backend — REJECT**

| Field | Content |
| --- | --- |
| Observed problem | question of ownership of collection, storage and query |
| Affected source | none (no code proposed) |
| Causal hypothesis | a backend would duplicate host OTel and add retention and privacy duties |
| Proposed change | none; record the decision |
| Evidence | section 7.1; three current logs have no consumer (F-D05-10); peers gate outbound telemetry (F-D07-14, F-D06-22) |
| Alternatives | revisit only if a consumer (the O-12 harness) shows a query the host cannot answer |
| Expected benefit | avoids a second source of truth |
| Measurement | list of unanswered questions after O-07 |
| Risks | later rework if hosts drop OTel |
| Revert | n/a |

**O-09 Telemetry data-minimisation rules and per-host privacy defaults — IMPROVE (docs and tests)**

| Field | Content |
| --- | --- |
| Observed problem | absolute paths in every log, no retention, a "may be committed" comment, and three hosts with different prompt-logging defaults |
| Affected source | `trace-log.cjs`, docs for hooks and adapters |
| Causal hypothesis | privacy rules were never written for telemetry |
| Proposed change | adopt the five rules in section 5; document Claude Code off, Gemini `logPrompts` true, Codex lockable; add a test that no hook writes prompt text or tool output |
| Evidence | F-D05 §2.2; F-D10-08 |
| Alternatives | do nothing (local, ignored files; D05 rates the risk low) |
| Expected benefit | a safe default before any export path exists |
| Measurement | test passes; a grep of logs for a sentinel prompt string finds nothing |
| Risks | none |
| Revert | revert |

### C. Experiments

**O-10 Live probe: does PostToolUse plain stdout reach the model — EXPERIMENT**

| Field | Content |
| --- | --- |
| Observed problem | R1 item 8 is DOCUMENTED, never tested live |
| Affected source | a throwaway hook in a scratch project (not production) |
| Causal hypothesis | plain stdout on PostToolUse is dropped |
| Proposed change | emit a nonce from a PostToolUse hook three ways (plain stdout, `additionalContext`, exit 2); ask the model afterwards to quote it |
| Evidence | R1 item 8; R2 §4 |
| Alternatives | trust the docs |
| Expected benefit | settles O-01 and O-13 on fact |
| Measurement | model quotes nonce or does not, per channel |
| Risks | none |
| Revert | delete scratch project |

**O-11 Reconcile MeowKit estimates with host cost and usage — EXPERIMENT**

| Field | Content |
| --- | --- |
| Observed problem | estimate error is unbounded and unmeasured; transcript usage fields unverified |
| Affected source | none in production; a scratch session set |
| Causal hypothesis | chars/4 at the wrong rate differs from true cost by a large, model-dependent factor |
| Proposed change | on 5+ sessions compare budget estimate, statusline `total_cost_usd`, OTel `cost.usage`, and headless JSON; check whether `transcript_path` lines contain usage; compare MeowKit trace totals with OTel on 10 runs (D10 E7) |
| Evidence | F-D05 experiment 4; D10 E7; HYPOTHESIS on transcript |
| Alternatives | skip: delete the estimate (O-02 alternative) |
| Expected benefit | decides keep-vs-delete for the tracker and which cost source a normaliser should read |
| Measurement | ratio and variance per model; list of unmatched fields |
| Risks | cost of the sessions |
| Revert | n/a |

**O-12 Outcome-evaluation pilot — EXPERIMENT (designs in deliverable 12)**

| Field | Content |
| --- | --- |
| Observed problem | no agent-outcome test and no with/without arm exist (section 6) |
| Affected source | a new harness outside shipped directories; reuse list in section 8 |
| Causal hypothesis | a pinned-model, repeated-trial comparison on fixtured tasks can detect an effect of MeowKit, or its absence, above run noise |
| Proposed change | build the section 8 capability list in this order: fixtures with hidden graders for the 5 quick canaries, driver, pin record, per-trial worktree, JSON cost capture; arms and ablations per deliverable 12 (including `claude plugin eval` for skills) |
| Evidence | D05 D12; D10-4; F-D06-25 and F-D07-04/05 as protocol precedents; R2 §4 |
| Alternatives | extend the benchmark stub (D05 REJECT); keep unmeasured |
| Expected benefit | first outcome numbers for H1, H2, H3, H8 |
| Measurement | pass rate with variance per arm, cost per arm |
| Risks | result applies to the tested model, host version and tasks only; vendor-side changes between runs |
| Revert | delete the harness directory |

### D. Maintainer decisions

**O-13 Should the budget threshold actually stop work?**
- As found: `block` threshold 100 with a `@@BUDGET_BLOCK@@` label; behaviour is text with exit 0.
- Evidence against the label: O-01, F-D05-09 (VERIFIED; visibility DOCUMENTED).
- Trade-off: a hard stop on a proxy figure (O-02) would block legitimate work on a wrong number; an advisory needs a delivery channel; a real cap exists in the host for print mode only.
- Options: (i) advisory, delivered via a visible channel, renamed from "block"; (ii) enforce via PreToolUse exit 2 once the figure is real (O-07 data); (iii) remove and rely on host statusline and `--max-budget-usd`. Not decided here.

**O-14 Should the repo ship telemetry enablement?**
- As found: on Claude Code the repo cannot enable OTel; managed settings or user env can (D10-D).
- Trade-off: a shipped enabling snippet helps data capture but writes a user's usage data to a destination they choose; default-off keeps privacy.
- Options: (i) docs only; (ii) a CLI verb that prints the env snippet; (iii) nothing. Security note: do not default raw prompts or tool content on.

**O-15 Where does the evaluation harness live, and which arms?**
- As found: `.claude/benchmarks/` and `.claude/eval/` ship inside the kit; the owner's note says `tasks/` and `.meowkit/` also ship, so plan work must leave nothing there.
- Trade-off: a harness inside shipped directories adds weight to every install; outside, it is invisible to users but cheap to maintain.
- Options: (i) separate repo or non-shipped directory, plus plugin eval for skills; (ii) inside the kit as an opt-in; (iii) plugin eval only (cannot ablate hooks and gates, section 8).

## 10. Not covered and open questions

Not covered by any finding I compiled from:

- Rust `note/append.rs`, `trace.rs`, and the Rust `budget` display (D05 coverage list); whether any Rust verb replaces `mewkit budget` (D05 found none).
- Claude Code OTel events after `tool_decision` and the Stop/SubagentStart payload sections (D10 S1/S8 partial reads); `claude plugin eval` JSON format and CI behaviour beyond R2's summary.
- Cursor OTel, sandbox and permission syntax; Goose, OpenCode and Pi enforcement and signal detail.
- Memory read-side instrumentation (no hook records a memory read, F-D05-02); belongs to the memory deliverable.
- Whether ignored telemetry reaches the kit release set.
- A re-run of any test suite on main; counts in section 6 are file and attribute counts only.

Open questions:

1. Does plain PostToolUse stdout reach the model on the current host build? (O-10)
2. Do transcript JSONL lines carry per-message usage? (O-11)
3. Can standard OTel resource-attribute environment variables label runs (arm, task id) on each host?
4. Is `mewkit budget` meant to exist in the Rust CLI, or is cost-log retired with the TS CLI?
5. Does MeowKit's plugin install path satisfy `claude plugin eval` (manifest, `evals/` directory)?
6. The 14-question framework text: the section 7.2 list is a reconstruction and should be checked against the directive.
7. R1 open: is the density matrix and model detection meant to track new model ids? (R1 item 10; belongs to the workflow deliverable.)
