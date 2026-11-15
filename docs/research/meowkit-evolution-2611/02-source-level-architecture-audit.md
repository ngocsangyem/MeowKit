# 20.2 MeowKit source-level architecture audit

Baseline: `main` @ `c7ff0a9e` (the TypeScript CLI is retired; Rust `mewkit` is the only CLI). Compiled from
`findings/D01`–`D05`, corrected by `findings/R1`, with counts and 20 citations re-checked on main by the compiler
(appendix). Evidence labels as in `BRIEF.md`. Finding IDs are in brackets, for example [F-D01-03]; R1 rows are
cited as [R1 #n].

## 1. Summary

- MeowKit is, at this commit, **a Claude Code–first prompt-and-hook kit plus a native CLI that installs it and
  keeps small state records**. Almost all of its behaviour is prose a model is asked to follow. The mechanical
  layer is small: 13 hook registrations, of which three are write/ship/read guards (VERIFIED).
- Two workflow transitions are mechanically backed: **Gate 1** (plan + fresh approval receipt before a source
  `Edit|Write`) and **Gate 2 paperwork** at `git commit|push|merge`, plus an **executed** test/lint/typecheck run
  at ship. Simplify, Verify (as a phase), Reflect, model-tier routing, the subagent status protocol, TDD
  ordering and most injection rules are model instruction only [F-D03-10, F-D01-09].
- Those guards are **accident guards, not security boundaries**: Bash is an unguarded write path, `.claude/` and
  `docs/`/`tests/` segments are exempt, the receipt/verdict/contract are agent-writable, and the maintainer says so
  in source headers (documented limit, not a discovery) [F-D01-03/04/05, R1 #2–4].
- The write guards fail closed on faults *inside their libraries*; they fail open if the entry script is corrupted,
  deleted, times out, or `node` is missing, because no hook sets `onFailure` [R1 #1b/1c].
- Observers that claim to "block" (budget, loop detection, pre-task-check, pre-completion-check, the Stop gate)
  cannot: they print text with exit 0, or are unreachable (`verification-required.json` is never written) [R1 #8,
  F-D01-11].
- Adaptive density and tier routing are weakly mechanised: an unmaintained model-id allowlist that gives newer
  models *more* scaffolding, and a SessionStart model field the host does not always send [R1 #10, F-D03-06].
- Portability is real at the **distribution** level (one CLI emits Claude/Codex/Cursor bundles; gate core
  libraries are byte-identical copies) and thin at the **behaviour** level (Codex registers 2 hook handlers, no
  Gate 2) [F-D04-09].
- Solid and demonstrated: fail-closed guard skeleton, stale-receipt detection, real test/lint run at ship, Rust
  settings merge that keeps foreign hooks, hardened zip extraction, ownership-based uninstall (section 8).
- No outcome measurement exists anywhere in the repo, so no benefit claim is established either way (section 11).
- Verdict on the hypothesis (section 10): **partially supported**; two words (*portable*, *adaptive*) are
  aspirational, *verifiable execution* and *bounded autonomy* hold only in narrow, accident-level senses.

## 2. Environment and baseline record

Full record: `evidence-ledger.md` (Environment record, Baseline change). Facts used here:

| Item | Value | Label |
| --- | --- | --- |
| Baseline | `main` @ `c7ff0a9e`; `fc278b31` is an ancestor; research started on `fc278b31` and the checkout moved mid-run | VERIFIED (ledger) |
| Re-verified by compiler | `git rev-parse` = `c7ff0a9e`, branch `main`, tree clean apart from `docs/research/meowkit-evolution-2611/` | VERIFIED |
| CLI | Rust workspace `0.1.0`, 3 crates, 83,651 lines of `.rs` (`git ls-files '*.rs'`); `packages/mewkit` ships no source on main | VERIFIED |
| Host | Claude Code (desktop/Agent SDK in this session); host behaviours not reproduced are marked DOCUMENTED/INFERRED | — |
| Not available here | `mewkit` on PATH, `node_modules`, controlled model A/B runs | VERIFIED (ledger) |

Citations that existed only at `fc278b31` are tagged; TS-CLI findings (merge dropping gates, no checksum) are
historical for the retired npm 2.3.1 and live only for people still running `npx mewkit` [F-D04-05/06].

## 3. The four-layer model checked against source

Layers: **L1** foundation model, **L2** host harness (Claude Code: permissions, hook runner, skill/agent loaders,
subagent tool, host memory), **L3** MeowKit engineering layer (skills, agents, rules, hooks, workflow, memory),
**L4** MeowKit CLI and adapters (Rust).

Mechanism key: **M** model instruction only (prose); **A** artefact-backed (a file must exist or a validator
accepts it); **H** hook-backed (host calls MeowKit code at an event); **N** host-native (MeowKit only configures
a host feature); **C** CLI-backed (Rust code does the work when invoked); **X** absent.

| # | Responsibility | Claimed mechanism | Actual mechanism | Evidence | Label |
| --- | --- | --- | --- | --- | --- |
| 1 | Plan gate (Gate 1) | "Hard stop, no bypass" (`gate-rules.md`, `CLAUDE.md`) | **H + A**: PreToolUse `Edit\|Write`; blocks source paths without plan, fresh receipt, signed contract. Fail-closed for lib/stdin faults. Bypassed by Bash writes, `.claude/*`, any `*/docs/*`, `*/tests/*`, `*.test.*` path, symlinked docs dir, `touch` of an old stamped plan. The three documented exceptions have no code | `gate-enforcement.cjs:31-32`; `plan-gate.cjs:80,99,115-128`; `gate1-path-rules.cjs:44-53`; F-D01-02/04; R1 #1a,#2,#5 | VERIFIED |
| 2 | Review gate (Gate 2) | Verdict approved by a human before ship | **H + A**: `pre-ship.cjs` on regex `/git commit\|git push\|git merge/`; checks a verdict file exists, no FAIL/BLOCK, names HEAD. Misses `git  commit`, `-C`, `-c`, aliases, `gh pr create/merge`. Forgeable with two small files. Not ported to Codex; Cursor UNKNOWN. Proves "paperwork present", not human approval (source says so) | `core/pre-ship.cjs:18`; `gate2-check.cjs:1-12`; R1 #3b,#4; F-D01-07; F-D04-09 | VERIFIED |
| 3 | Contract gate (autobuild) | Required only in FULL autobuild density (`harness-rules.md` Rule 3) | **H + A** inside Gate 1, applied to **every** date-named plan dir, not only autobuild. Off with `MEOWKIT_AUTOBUILD_MODE=LEAN` (a local file on this machine, section 9). Which scope is intended is an open maintainer question | `check-contract-signed.cjs:96-108`; `plan-gate.cjs:126-128`; R1 #5b, §7 | VERIFIED / OPEN |
| 4 | TDD | "`pre-implement.cjs` enforces failing-test-first" (`development-rules.md:25`) | **M**: opt-in flag; `tdd-flag-detector` writes a sentinel; `pre-implement.cjs` is not registered anywhere and exits 1, not 2 | `settings.json`, `handlers.json` (no entry); F-D01-11 #1 | VERIFIED |
| 5 | Simplify (Phase 3.5, "mandatory") | Mandatory before review | **M**: no hook, no artefact check | F-D03-10 | VERIFIED |
| 6 | Verify (Phase 3.6, "mandatory") | Mandatory before review | **M** as a phase. Related mechanics exist separately: PostToolUse `build-verify` observer (fail-open) and, at ship, a real `npm test`/lint/`tsc` run (row 7) | F-D03-10; F-D01-01 | VERIFIED |
| 7 | Ship | Commit/PR after Gate 2 | **H**: same `pre-ship` hook also runs executed test/lint/typecheck; a failing `npm test` blocked with rc=2 in test. 30 s hook timeout; a timeout is non-blocking on the host (DOCUMENTED); `fast` profile skips the run | `preship-checks.cjs`; F-D01-07; R1 #1c | VERIFIED / DOCUMENTED |
| 8 | Reflect (Phase 6) | Docs, memory, analysis after ship | **M**; Stop observers write cost/checkpoint records | F-D03-10; F-D05-10 | VERIFIED |
| 9 | Model-tier routing | Tier → model | **M** for the tier line; the real mechanism is the `model:` frontmatter pin on each agent (12 `claude-opus-5`, 2 `fable`, 13 `sonnet`, 15 `haiku`) = **N**. `developer` always runs Opus whatever the tier | agent frontmatter count (compiler); F-D03-05 | VERIFIED |
| 10 | Adaptive density | Newer models get LEAN | **H-lite + script**: `model-detector.cjs` (LEAN only for ids containing `4-6`/`4.6`) and `density-select.sh` (also `4-7`) disagree; opus-5.x, sonnet-5.x, fable → FULL. Consumers: autobuild and the contract gate only. SessionStart model field is not always sent (49% of local sessions `unknown`) | `model-detector.cjs:44-49`; `density-select.sh:71-74,108`; R1 #10; F-D03-06 | VERIFIED |
| 11 | Memory read | Grep `.meowkit/memory/` at task start | **M**: no hook or CLI reads memory; missing store = silent no-op | F-D05-03 | VERIFIED |
| 12 | Memory write | Lint-checked, PR-reviewed | **C**: `mewkit note` (shape + secret + ~38 injection patterns + NFKC); pre-ship runs a store lint that **skips** without the CLI. Tripwire for literal payloads; paraphrase and Cyrillic confusables pass | `memory-store-lint.cjs:74`; R1 #9; F-D05-04 | VERIFIED |
| 13 | Injection defence (Rules 1–11) | "Non-negotiable" | Mostly **M**. Mechanical parts: `pre-task-check` (advisory, scans the agent's own Bash command, exit 0), fetch quarantine inside `web-to-markdown` (real, skill-local), Rule 11 lint in the CLI, memory lint. Rule 10 `injection-audit.cjs` is manual; nothing calls it | F-D01-09 | VERIFIED |
| 14 | Sensitive-file protection | Rule 4, hook-enforced | **H**: `privacy-block` on Read/Edit/Write path regex, fail-closed. Not on Grep; Bash `cat .env` passes; misses `.envrc .npmrc id_rsa .kube/config`; false positives `secretary.ts`, `.env.example`. Approval flow is prose | `privacy-block.cjs:16-18`; R1 #6; F-D01-08 | VERIFIED |
| 15 | Security scan of written code | `security-rules.md` "BLOCK — do not write" | **H after the fact**: PostToolUse `post-write` regex scan, ts/js/vue/swift/sql/sh only; runs after bytes are on disk; gaps (`apiKey = "…"`, `DISABLE ROW LEVEL SECURITY`) | R1 #7; F-D01-10 | VERIFIED |
| 16 | Budget | Cap at configured limit | **H, inert**: chars/4 estimate priced at output rate, cumulative across sessions ($137 in local state), returns text with exit 0; PostToolUse plain stdout is likely not shown to the model. Host statusline shows true cost | `budget-tracker.cjs:72-82`; `dispatch.cjs:102-108`; R1 #8 | VERIFIED / DOCUMENTED |
| 17 | Loop detection | Warn/stop on repeated edits | **H, inert**: same delivery path as row 16; counter is cross-session | R1 #8; F-D05-10 | VERIFIED |
| 18 | Subagent status protocol (A1) | Every subagent ends with a status block | **M**: `SubagentStart`/`SubagentStop` are registered with empty arrays; nothing parses the block | `settings.json`; F-D03-07; L-03 | VERIFIED |
| 19 | Agent tool isolation ("read-only" agents) | `athena`, `explore` "write nothing, structurally" | **N, defeated**: 36 agents set `memory: project`, which the host documents as auto-enabling Write/Edit; this session's agent list shows `explore` with Write/Edit although frontmatter omits them | `athena.md:210`; R1 #11b | VERIFIED |
| 20 | Orchestration / parallelism | Orchestrator routes; parallel agents, worktrees | **M + N**: spawn rules are prose; 22 jira/confluence leaves are bound by host `context: fork` + `agent:`; `orchestrator` agent is never spawned; worktree isolation is the host's | F-D03-02/03; 22 `context: fork` skills (compiler count) | VERIFIED |
| 21 | Skill routing | `agent-detector` "every message, no exceptions" | **N** (host skill listing) + **M**. `agent-detector` is `user-invocable: false`, no hook invokes it; scoring weights are prose. `mewkit capabilities resolve` is lexical keyword matching | F-D02-10; F-D04-14 | VERIFIED |
| 22 | Session orientation | Resume from durable state | **H + C**: SessionStart dispatcher (model-detector, orientation-ritual, project-context-loader, capability-bootstrap, jira-env-loader), inject-only, fail-open; orientation calls `mewkit orient` with a 5 s timeout and falls back to text | `handlers.json`; F-D04-13 | VERIFIED |
| 23 | Checkpointing | Resume after clear/compact | **H**: `checkpoint-writer` (Stop), `auto-checkpoint` (plan/contract/review writes) overwrite `state/checkpoints/checkpoint-latest.json`; estimates + git state | F-D05-10 | VERIFIED |
| 24 | Telemetry / trace | Trace score/audit/propose | **H + C**: two event types recorded (`file_edited`, `session_end`, the latter per turn); `mewkit trace` computes structural metrics; probes have no consumer | F-D05-10 | VERIFIED |
| 25 | Install / upgrade / uninstall | Safe, reversible lifecycle | **C**: Rust CLI; checksum + URL-prefix + extraction limits; ownership-based uninstall; dry-run default | `kit/mod.rs:29`; `extract.rs:13-15,38`; F-D04-06/07 | VERIFIED |
| 26 | Provider adapters | Portable intent, no false parity | **C**: authored Codex/Cursor bundles copied by `init`; structural checks only. Overclaims in `providers --lifecycle` (section 6) | F-D04-09/10/11 | VERIFIED |

Reading the table by layer: L1 supplies all reasoning; L2 supplies tool permissions, hook execution, skill
listing, subagent isolation and per-agent model pins (rows 9, 19, 20, 21); L3 is mostly M with three H guards
(rows 1, 2/7, 14) plus inert observers; L4 does the work that must be exact (rows 12, 25, 26, plan approval,
`doctor --hard-gates`).

## 4. Runtime flow as implemented (Claude Code, flat-copy install)

```
SessionStart  -> dispatch.cjs (15 s): model-detector, orientation-ritual -> `mewkit orient` (5 s, optional),
                 project-context-loader, jira-env-loader, capability-bootstrap        [inject-only, fail-open]
UserPromptSubmit -> dispatch.cjs: safety-sentinel-inject ("Safety baseline: verified (cached)"), tdd-flag-detector
Per tool call
  Read          -> privacy-block (5 s)                                                [exit 2 = block, fail-closed]
  Edit | Write  -> gate-enforcement (10 s) + privacy-block (5 s)                      [exit 2 = block, fail-closed]
                   ... tool runs ...
                -> dispatch PostToolUse (40 s): build-verify, loop-detection, budget-tracker, auto-checkpoint,
                   learning-observer, post-write (exit 2 -> stderr to model, file already written)
  Bash          -> pre-ship (30 s) + privacy-block + dispatch PreToolUse:Bash (pre-task-check, advisory)
                   ... tool runs ...
                -> dispatch PostToolUse:Bash: budget-tracker, review-evidence-tag
Stop (each turn) -> dispatch: checkpoint-writer, post-session (cost-log row, sentinel write), control-probe,
                    pre-completion-check (opt-in; flag file never written)
PreCompact / PostToolUseFailure -> dispatch: probes only (logging, no consumer)
Not hooked: MultiEdit, NotebookEdit, Glob, Grep, WebFetch, Task, MCP tools; SubagentStart/Stop are empty
```

Sources: `settings.json` hook block and `handlers.json` (22 registrations over 21 handler files, compiler-run);
timeouts are the `settings.json` values. [F-D01-01]

Measured costs (auditor measurements on this machine; absolute numbers are machine-dependent):

| Event | Measured | Source |
| --- | --- | --- |
| Bare `node` start | ~135 ms floor | F-D01-01 |
| `gate-enforcement` / `privacy-block` | ~136 ms each | F-D01-01 |
| `pre-ship` on a non-ship Bash command | 269 ms; on a ship command it runs the project's tests (unbounded up to the 30 s timeout) | F-D01-01/07 |
| Dispatcher PreToolUse:Bash / PostToolUse:Bash / UserPromptSubmit | 147 / 153 / 147 ms | F-D01-01 |
| PostToolUse Edit|Write | 0.8–2.0 s (dominated by `build-verify` running tsc/eslint) | F-D01-01 |
| SessionStart | 1.64 s, ~818 est. tokens injected (D01) / 3.2–3.6 KB of stdout in scratch runs (D03, R1) | F-D01-01, F-D03-17, R1 #12 |
| Serial pre-call cost, Bash | ~0.4–0.55 s (3 node spawns); Edit/Write ~1–2.3 s total | F-D01-01 |
| Always-on context, flat install | rules 25,420 B (limit 25,600; the compiler re-ran `wc -c`), skill listing ~24.3 KB metadata, agents ~9.7 KB, SessionStart ~3–4 KB: ≈ 64 KB ≈ 16 k tokens (chars/4, ESTIMATE); the dev checkout adds `CLAUDE.md` (≈9 KB) | F-D03-17/18; R1 #12 |

Per-prompt sentinel text is about 40 tokens on turns after the first Stop (D01) and 0 on turn 1 (D03); the two
auditors measured different turns, not different facts. A full interactive `cook` asks the model to read roughly
333 KB (~83 k tokens, upper bound, INFERRED) of workflow text before Gate 2 and to stop for 5–6 human approvals
[F-D03-11].

## 5. Component inventory (re-counted on main by script)

| Component | Count on main | Command / basis | README claim | Match |
| --- | --- | --- | --- | --- |
| Skills | 128 directories, 128 `SKILL.md`; 1,055 tracked files under `.claude/skills` | `find .claude/skills -mindepth 1 -maxdepth 1 -type d`; `git ls-files` | 128 | yes |
| Skill runtime tag | 121 `runtime: claude-code`, 7 `runtime: portable` | `grep -l` | not claimed | informational |
| Agent files | 44 in `.claude/agents/` | `ls` | 42 | see next row |
| Agent definitions | **42** (files with `name:`); the other 2 are `AGENTS_INDEX.md` and `SKILLS_INDEX.md` (no frontmatter) | `grep -l '^name:'` | 42 | yes. The 42-vs-44 gap is the two index files [F-D03-01, R1 §7] |
| Agent model pins | 12 `claude-opus-5`, 2 `fable`, 15 `haiku`, 13 `sonnet` | frontmatter count | not claimed | informational |
| Agents with `memory:` | 36 (not 21: 21 is the subset without Write/Edit in `tools:`) | `grep -l '^memory:'`; R1 #11b | not claimed | D03's number corrected |
| Executor-leaf agents bound by skill `context: fork` + `agent:` | 22 of 22 (16 jira, 5 confluence, `story-sizer`) | `grep -l` | not claimed | informational |
| Rules | 7 files, 25,420 B | `ls`, `wc -c` | 7 | yes |
| Hook files on disk | 100 under `.claude/hooks` (99 tracked; `.logs/` holds 2 runtime files, 1 tracked) | `find`, `git ls-files` | "27 hook scripts" | basis below |
| Hook entry scripts | 6: `dispatch`, `gate-enforcement`, `privacy-block`, `pre-ship`, plus `pre-implement` and `append-trace`, which are **not event-registered** | `ls`; `settings.json` | | |
| Hook handlers | 21 files, 22 registrations in `handlers.json` | `ls handlers`; `handlers.json` | | |
| "27 hook scripts" | = 6 entry scripts + 21 handlers; libraries (51 files), 12 test files, 4 reference files and 3 JSON/markdown indexes are not counted. Only 3 of the 27 are guards | arithmetic [F-D01-11 #9] | 27 | yes, but the unit hides that 2 entry scripts never run on events and 15+ handlers are telemetry/context |
| Hook registrations in `settings.json` | 13 command registrations across 7 events; `SubagentStart`/`SubagentStop` = `[]` | node read of `settings.json` | | |
| CLI verbs (Rust enum `Command`) | **23**: init, upgrade, uninstall, doctor, providers, versions, self-update, orient, plan, note, task, task-state, validate, verdict-gate, review, advice, trace, budget, setup, skill, pack, capabilities, backups | `crates/mewkit-cli/src/main.rs:45-99` | | `inventory` does not exist (old doc claim removed on main) [F-D04-01] |
| Rust source | 83,651 lines in `.rs` files; 1,662 `#[test]` attributes; 108 integration-test files under `crates/*/tests/` | `git ls-files`, `git grep` | | |
| TypeScript tests (tracked) | 41 `*.test.ts(x)` (15 in `tests/hooks`, 6 in `tests/release`, 5 in `src/__tests__/hooks`, …); no TS CLI source remains | `git ls-files` | | |
| Shell tests | 19 `*.test.sh` | `git ls-files` | | skill-contract and registration pins |
| Hook node tests | 11 `.test.cjs` in `.claude/hooks/__tests__` (90 tests, 88 pass in a scratch copy; the 2 failures were copy artefacts and passed in the repo) | F-D01-13 | | |
| Python tests | 18 `test_*.py` / `*_test.py` | `git ls-files` | | |
| LLM-outcome tests | **0** | F-D05-03, R1 #13 | | |

Figures that changed against the first-pass auditors: TS LOC is 0 on main; test-file totals differ from D05's
fc278b31 numbers (257 vitest files) because most TS tests left with the TS CLI. Two counting rules are
undefined in README: what "hook scripts" counts, and whether the two agent index files belong to "agents".

## 6. Documentation vs implementation contradictions

### 6a. Stale references (text points at something that moved or never existed)

| Document claim | Citation | Reality | Evidence |
| --- | --- | --- | --- |
| `gate-enforcement.sh` enforces the contract substep | `CLAUDE.md:23` | the file is `gate-enforcement.cjs` | VERIFIED (compiler `sed`) |
| Gate 2 "enforced_by behavioral … Hook enforcement is deferred" | `workflow.yaml:102` | Gate 2 is hook-backed by `pre-ship` → `gate2-check` | VERIFIED; F-D03-10 |
| `docs/project-context.md`, `project-overview.md`, `code-standards.md`, `deployment-guide.md` are the agent constitution / key docs | `CLAUDE.md` Documentation; 41 agent refs | none of the four exists in `docs/` | VERIFIED (`ls`); F-D03-15 |
| Committed team memory `.meowkit/memory/{decisions,gotchas}.md` | `CLAUDE.md`, `README.md:33`, rules | `.meowkit/memory/` absent; the only committed entry was deleted to keep the packaged `.meowkit/` clean | VERIFIED; L-02, F-D05-01 |
| `HOOKS_INDEX.md`: "nothing is switchable yet" | `HOOKS_INDEX.md` | toggles exist (`handlers.json` `toggleKey`) | VERIFIED; F-D01-11 #8 |
| `pre-implement.cjs` "enforces" failing-test-first | `development-rules.md:25` | unregistered, exit 1 | VERIFIED |
| Trace schema: `session_end` carries duration/cost, `cost_sample` exists; trace stream "may be committed" | trace schema doc, `trace-log.cjs` | payload is `{recent_files}`, `cost_sample` is emitted nowhere; telemetry is git-ignored | VERIFIED; F-D05 §4 |
| Cook gotcha "use `Task()`, not `Agent()`" | `cook/SKILL.md` | host names the tool `Agent`; `Task` is an alias | DOCUMENTED; F-D03-15 |
| README "`mewkit doctor` warns when it detects both" (plugin + flat copy) | `README.md:60` | no plugin check in Rust `doctor` (`grep -i plugin crates/mewkit-cli/src/commands/doctor` is empty) | VERIFIED |

### 6b. Behavioural overclaims (the text promises behaviour the code does not produce)

| Claim | Citation | What the code does | Evidence |
| --- | --- | --- | --- |
| "No bypass. No exceptions." Gate 1 | `gate-rules.md`, `CLAUDE.md` | Bash writes, `.claude/*`, doc/test-segment paths, env hatches (receipt-only, contract-only), `touch` on an old plan all pass | VERIFIED [R1 #2]; maintainer-documented for forgeability only |
| Three exhaustive Gate 1 exceptions (`/mk:fix` simple, one-shot, user override) | `gate-rules.md`; `fix/SKILL.md:194` | no exception path; no plan → `NO_PLAN`; "quick"/"fix simple" cannot write a source file | VERIFIED [R1 #5] |
| Contract needed only in FULL autobuild | `harness-rules.md` Rule 3 | contract gate fires for every date-named plan when not LEAN | VERIFIED [R1 #5b]; OPEN intent |
| `athena`/`explore` are read-only "structurally" | `athena.md:210` | `memory: project` re-grants Write/Edit | VERIFIED [R1 #11b] |
| STANDARD → Sonnet | `model-selection-rules.md` | `developer`, `planner`, `reviewer` pinned `claude-opus-5` | VERIFIED [F-D03-05] |
| Newer Opus ≥ 4.7 → LEAN | `adaptive-density-matrix.md` | opus-5.x → FULL in both implementations; 4.7 differs between them | VERIFIED [R1 #10] |
| Detection from SessionStart drives density | `model-selection-rules.md` Rule 5 | `density-select.sh` reads env only; the host often omits `model` | VERIFIED / DOCUMENTED [F-D03-06] |
| Budget "block" at the cap; loop "stop" | `.meowkit/config.yaml`, handlers | text + exit 0; cap exceeded 4,733 times in local state with no effect | VERIFIED [R1 #8, F-D01-11 #6] |
| Stop gate (`pre-completion-check`) as a gate | `providers --lifecycle` (`capability/lifecycle.rs:109-112`) | opt-in flag file that nothing writes; fail-open; switchable off in committed config | VERIFIED [F-D04-10, F-D01-11 #7] |
| `providers --lifecycle`: `subagent_stop` "SubagentStop hook in shipped settings.json (observe)" | `capability/lifecycle.rs:132-136` | `settings.json` registers `SubagentStop: []`; nothing observes | VERIFIED (compiler; new beyond D04) |
| `providers claude-plugin` is a distinct delivery; "nothing is copied into your project" | `README.md:72`; `kit_dir.rs:57` | the same files as flat-copy plus one `.claude-plugin/plugin.json` (the README's own lines 84–86 say so; line 72 contradicts them) | VERIFIED [F-D04-07] |
| `curl \| sh` installs the CLI | `README.md:40-52` | `installer-pins.json` is `{"stable":null,"beta":null}`; no `mewkit-v*` release exists; v2.15.0 kit has no `checksums.txt` so `init` refuses without `--allow-unverified-kit` | VERIFIED [F-D04-03] |
| `agent-detector` runs "every message, no exceptions" | `agent-detector/SKILL.md` | `user-invocable: false`, no hook invokes it; skills load at the model's discretion | INFERRED [F-D02-10] |
| 7 rules "re-read" at turn 1 as a positive existence check | `agent-detector/SKILL.md:44-66` | real, but sentinel-suppressed after turn 1 and the sentinel is written unconditionally at every Stop (`post-session.cjs:128-134`) | VERIFIED; R1 #12 weakens "pure duplicate" |

## 7. Implementation gaps that matter (ranked)

Ranking is by consequence for a deliberate or careless agent, using R1's priority list; R1 verdicts in the last
column. "Documented limit" marks what the maintainer already states.

| Rank | Gap | Class | R1 verdict | Documented limit? |
| --- | --- | --- | --- | --- |
| 1 | Bash and `.claude/` are unguarded write paths; `Bash(node .claude/hooks/*)`, `Bash(git *)`, `Bash(gh *)` pre-allowed; no `permissions.deny`, no `sandbox` | effective but bypassable | CONFIRMED [#2,#3,#6; L-12] | privacy scope limit and receipt "agent-writable" yes; Bash coverage for Gate 1 not stated in the rules |
| 2 | Guard failure modes outside the library: corrupted/deleted entry script, no `node`, timeout are non-blocking; no hook sets `onFailure` | wired but ineffective in those cases | CONFIRMED for entry-script/node/timeout; REFUTED as "fail-closed in general" [#1b/1c] | `hook-coverage.json` says "not probed" |
| 3 | Gate 1 exceptions have no implementation; contract gate scope contradicts the docs | documented but unwired | CONFIRMED [#5,#5b] | no |
| 4 | Gate 2 trigger regex evasions; Gate 2 absent from Codex | wired but narrow | CONFIRMED [#4]; coverage from F-D04-09 | partly (parity limits) |
| 5 | Privacy coverage gaps and false positives; no Grep/Bash coverage | effective but narrow | CONFIRMED [#6] | scope limit in header |
| 6 | Post-write scanner after the fact, narrow extensions, spacing/RLS gaps | effective but narrow | CONFIRMED [#7] | "runs after write" in header |
| 7 | Budget and loop output likely never reach the model | wired but ineffective | CONFIRMED by source and host docs; not tested live [#8] | no |
| 8 | `memory:` grants Write/Edit to the agents advertised as read-only | effective, contradicts claim | WEAKENED count (36 not 21), effect VERIFIED live [#11b] | no |
| 9 | Memory lint paraphrase/cross-script evasion | effective but evadable | CONFIRMED (partly) [#9] | "memory is DATA" rule is the stated control |
| 10 | Model detection absent in half of local sessions; density allowlist stale | wired but ineffective | CONFIRMED, mechanism = stale allowlist [#10] | no |
| 11 | Install path unpublished (no pins, no binary release, kit zip without checksums) | documented but unwired | VERIFIED by D04 (not reviewed by R1) | possibly pending a cutover: UNKNOWN |
| 12 | Subagent status protocol unchecked; `SubagentStop` empty | documented but unwired | VERIFIED [F-D03-07] | no |

Also unwired or inert: `pre-completion-check` flag file never written; `injection-audit.cjs` has no caller;
`/mk:memory --prune` is prose only [F-D05-06]; `cost_sample` trace event emitted nowhere [F-D05-09].

## 8. What is solid (demonstrated working as designed)

| Mechanism | Evidence | Label |
| --- | --- | --- |
| Gate 1 fails closed on faults in required libraries and on unreadable stdin: rc=2 for missing `plan-discovery`, syntax error in `gate1-path-rules`, throw in `plan-gate`, empty/garbage/closed stdin; handlers installed first (`gate-enforcement.cjs:31-32`) | R1 #1b | VERIFIED (executed in a scratch copy) |
| Source write with no plan is blocked, also under LEAN | R1 #1a | VERIFIED |
| Stale-receipt detection: body edit after stamping → rc=2 "stale"; a newer unapproved plan → rc=2; this is the only check that held after a body edit | R1 #2, §6 | VERIFIED |
| Gate 2 binds the verdict to the shipped revision (names HEAD) and blocks wrong-revision ship | R1 §4(c) | VERIFIED |
| Executed `npm test`/lint/`tsc` at ship blocks on a failing suite (rc=2) | F-D01-07 | VERIFIED |
| Gate 1 downgrade hatch is announced, logged to `security-log.md`, refused if it cannot be logged, and cannot be set from the project config | F-D01-06, F-D04-12 | VERIFIED |
| Gate core libraries are byte-identical across `.claude/hooks/lib`, `kit/bundles/codex`, `kit/bundles/cursor`, enforced by `sync-hook-core.cjs --check` | F-D04-09 | VERIFIED |
| Hooks run inside subagents: a Gate 1 block reached a subagent in a live test | F-D01-02 | VERIFIED (live) |
| Rust settings merge keys on matcher + command + args: a foreign `node` hook is kept and all kit hooks are registered (the TS merge dropped them) | F-D04-05; `fc278b31:…/merge-settings.ts` | VERIFIED |
| Hardened kit download: URL must start with the project's releases prefix (`kit/mod.rs:29`), SHA-256 from the same release, refusal without it, symlinks/duplicates/traversal/>20,000 entries/>512 MB rejected (`extract.rs:13-15,38`) | F-D04-06 | VERIFIED (source); documented limit: same-origin checksum, no signatures (`RELEASING.md`) |
| Ownership-based uninstall: dry-run by default; `--yes` removed 1,219 files and restored `settings.json` to the user's two keys; user `CLAUDE.md`, `AGENTS.md`, hooks and `permissions.deny` untouched | F-D04-07 | VERIFIED (trial) |
| `doctor --hard-gates` runs the real hooks on a scaffold and caught the TS merge defect that plain `doctor`/`validate` passed | F-D04-05 | VERIFIED |
| Codex install keeps a user `AGENTS.md` and writes a marked block; Cursor uses a rules file | F-D04-07 | VERIFIED |
| `mewkit note` rejects literal, fullwidth, zero-width and multi-line injection variants and secrets | R1 #9 | VERIFIED |
| Always-on rule bytes are enforced in CI by a budget script (limit 25,600; used 25,420) | `check-always-on-budget.cjs:25`; F-D03-18 | VERIFIED |
| Executor leaves use a real host isolation mechanism (`context: fork` + `agent:`) | F-D03-02/03 | VERIFIED + DOCUMENTED |
| Honest hedging exists in places: receipt header, Gate 2 header, `providers --lifecycle` "cannot guarantee a block", README Codex "deter but do not block" | `approval-receipt.cjs:3-6`; `gate2-check.cjs:1-12`; F-D04-10 | VERIFIED |

## 9. Machine artefacts vs kit properties

Not properties of the shipped kit (cause is this machine or session):

| Observation | Cause | Source |
| --- | --- | --- |
| Contract gate off, density LEAN on every trace row, 325 `lean-bypass` log lines | untracked `.claude/settings.local.json` exports `MEOWKIT_AUTOBUILD_MODE=LEAN`; `git ls-files --error-unmatch` fails and the file is globally ignored | L-14; compiler re-check |
| 81 of 128 skills name-only in this session's listing | the host's shared listing budget (about 1% of the context window) is also consumed by ~45 user-global skills and the Vercel, Anthropic, gsap and logo plugins; the window size is unknown | R1 #14; F-D02-02 |
| Two toolkits give contradictory instructions (plan directories, workflow chain, commit rules, report paths); same-named agents shadowed; mandatory-voiced Vercel plugin injections | user-global `~/.claude` toolkit and third-party hooks | L-07, L-08, L-09; F-D03-19 |
| "CLI not available"; pre-ship memory lint skipped; orientation `none` | `mewkit` not on PATH here | L ledger; F-D01-12 |
| `js-yaml` missing, budget checker not runnable in the archive; stale `target/debug` binary | no `node_modules`; old build | R1 §1 |
| `budget-state.json` ($137, 9,190 turns), 49% sessions `unknown` model, learning-ledger size | local runtime state of one developer over four days | F-D01-11 #6; F-D03-06 |
| Gate 1 blocked the research scratch directory | by design (out-of-root = gated) but surfaced here because the work location is outside the repo | L-11 |

Kit properties (hold on a clean install): every path/trigger/coverage row (R1 #2, #4, #6, #7), the contract-gate scope
(R1 #5b), entry-script fail-open and absent `onFailure` (R1 #1b), the density allowlist (R1 #10), the 36-agent
`memory:` effect, PostToolUse stdout not model-visible, `settings.json` allow rules (L-12), the unpublished
pins and checksum-less kit asset, and the README/rules contradictions of section 6.

Restated documented limits, not discoveries: receipt and verdict are agent-writable ("anti-accidental, not
unforgeable"), post-write runs after the write, privacy hook does not see shell reads, the memory-is-DATA model,
"Not yet measured" registry rows, hooks not ported to Codex/Cursor (`hook-coverage.json`), Codex "experimental",
bundle checks "structural parity", release checksums "detect corruption, not a tampered release".

## 10. Verdict on the architectural hypothesis

Hypothesis tested: "MeowKit is a portable, host-native agent engineering toolkit focused on verifiable
execution, bounded autonomy, secure integration, and adaptive engineering practices."

| Word | Verdict | Basis |
| --- | --- | --- |
| **Portable** | **Weakly supported; mostly aspirational.** Portable distribution (one CLI, three targets, shared gate core, ownership lifecycle) but not portable behaviour: 121 of 128 skills declare `runtime: claude-code`; Codex registers 2 hook handlers and no Gate 2; Cursor has fail-closed gates but Gate 2 logic is not found and lifecycle reporting under-claims; bundles ship 521 (Codex) / 231 (Cursor) dangling-reference notes; README headline says "for Claude Code" | F-D04-09/10/11; F-D02-19. VERIFIED |
| **Host-native** | **Supported for Claude Code.** MeowKit configures host primitives (hooks, skills, agents, rules, `memory:`, `context: fork`) and runs no agent loop of its own. Counter-points: it re-implements some host features in prose (task lists, worktrees, exploration agent), depends on Node for every hook, and its `memory:` frontmatter silently changes host tool grants | F-D03-16; R1 #11b. VERIFIED / INFERRED |
| **Verifiable execution** | **Narrowly supported.** What is verifiable: a plan revision was stamped, a verdict file bound to HEAD exists, tests/lint/typecheck actually ran at ship, hard gates fire on a scaffold (`doctor --hard-gates`). What is not: that a human approved (the code says so), that simplify/verify/review happened, or that any of it improves outcomes | R1 #3, §4; F-D03-10. VERIFIED |
| **Bounded autonomy** | **Supported for accidents, not for a deliberate agent.** Gate 1 stops an unplanned or scope-drifted source edit through `Edit\|Write`; the same agent can use Bash, edit `.claude/`, or stamp its own receipt; budget and loop limits do not bind; destructive git/shell and outside-project writes have no hook control and `git *` is pre-allowed | R1 #2–#4,#8, §9. VERIFIED |
| **Secure integration** | **Supported for install-time hygiene; weak for run-time.** Verified checksum/URL/extraction limits, correct settings merge, ownership uninstall, doctor probes. Gaps: no signatures (documented), release without `checksums.txt` forces `--allow-unverified-kit`, a compromised kit asset runs arbitrary Node through hooks, `chrome-profile` meets all three Rule-of-Two conditions with no human gate, memory lint is a tripwire | F-D04-06, F-D02-14, R1 #9. VERIFIED |
| **Adaptive** | **Not established.** Density/tier selection is a stale model-id allowlist plus prose; detection fails in half the local sessions; routing scores and the scale CSV are computed by the model; nothing measures whether adapting helps | R1 #10; F-D03-06; F-D05-11. VERIFIED (mechanism); UNKNOWN (value) |

**Most accurate description the evidence supports.** MeowKit is a Claude Code–first workflow kit: roughly 128
skills, 42 agents, 7 always-on rules and 27 hook scripts installed into a project's `.claude/`, plus a native Rust
CLI of 23 verbs that installs, upgrades and removes the kit, stamps plan approvals and keeps small task, trace and
memory records. Most of its workflow is instructions to the model; three hooks mechanically check that a plan
revision was approved before source edits, that review paperwork exists and tests pass before `git` ship commands,
and that sensitive files are not read through the file tools. These are accident guards rather than security
boundaries, and the maintainer documents that the approval artefacts are agent-writable. Codex and Cursor receive a
smaller authored bundle with weaker enforcement, and no measurement shows whether any part improves outcomes.

**Runtime in the making?** `mewkit orient`, `task-state`, `task` store, `plan approve/archive`, `trace`,
`backups` and `journal`/`lock` modules in `mewkit-core` form a durable-state substrate (`tasks/`, `.meowkit/state/`)
that is read at SessionStart and written by hooks and skills [F-D04-13, F-D05-10]. Evidence of a runtime
proper (a loop that schedules work, mediates every tool call, or owns session state) is absent: the hooks remain
the only mechanical interposition and all state writers are advisory. INFERRED: this is resume-and-record
state, which is consistent with "host-native"; it would become drift only if verbs started deciding what the model
may do (for example by making `plan approve` the sole path to a gate) without the host's permission system being
the enforcement point. The two places it already edges that way are the receipt stamp (the CLI and the agent run
the same script, `approval-receipt.cjs:146-148`) and the hook-to-CLI calls in orientation and memory lint, which
degrade to "skip" when the binary is missing.

## 11. Not covered and open questions

Not covered by any auditor or reviewer:

- The 15 vitest hook files and golden corpus (`tests/hooks`) were not run (no `node_modules`); 9 failures in D05's
  fc278b31 full run were attributed to a scratch repo with no git history (INFERRED, not re-run in the real tree).
- D02 classified 103 of 128 skills from metadata only; the skill bodies were not executed. No skill-activation
  data exists.
- Rust `upgrade` end to end, Windows paths, `install.ps1`, live Codex and Cursor behaviour, and `review`/`advice`/
  `budget` internals.
- Whether sub-agents and other hosts receive `.claude/rules/*` automatically (decides whether the turn-1 re-read is
  redundant) [R1 §10].
- R1 did not review D04 beyond the TS merge claim, nor D02's per-skill classification.

Open questions:

1. Intended scope of the contract gate: every plan, or FULL autobuild only? (maintainer decision) [R1 §7]
2. Is the unpublished binary release and null installer pin intentional, pending a cutover? [F-D04-03]
3. Does PostToolUse plain stdout ever reach the model on the current host? A live nonce test would settle rows 16–17.
4. Does `claude-opus-5` (no minor) resolve as an agent `model:` value? [F-D03-05]
5. Does `memory:` override an explicit `tools:` allowlist on every host build? The live listing says yes. [R1 #11b]
6. Does a timed-out or non-startable hook block on current Claude Code, given the kit's own "not probed"? [R1 #1c]
7. Does the desktop app omit `model` on SessionStart (49% `unknown` locally)? [F-D03-06]
8. Does a project-level `.claude-plugin/plugin.json` alone make the host load a plugin? [F-D04-07]
9. How many users run the 22 Jira/Confluence leaves? (no telemetry) [F-D03-03]

Prompt-injection observations across the inputs: none in the files compiled from; the live session's third-party
hook injections are recorded in L-08.

## Appendix: compiler spot-checks on `main` @ `c7ff0a9e`

| # | Citation reused | Checked by | Result |
| --- | --- | --- | --- |
| 1 | `core/pre-ship.cjs:18` `SHIP_COMMAND = /git commit\|git push\|git merge/` | `grep -n` | ok |
| 2 | `gate1-path-rules.cjs:44-53` (NON_SOURCE incl. `*/docs/*`, `.claude/*`; TEST_FILE globs) | `sed -n 40,58p` | ok (arrays at 44-53) |
| 3 | `plan-gate.cjs:70-77,155-175` (R1, D01) | `wc -l`, `sed` | **corrected**: file is 132 lines; `classify` is 71-99, out-of-root → `'gated'` at 80, final `'gated'` at 99, `NO_PLAN` at 115, receipt check at 122, contract at 126-128. L-11's `plan-gate.cjs:79` and L-04's `:97` are off by one and two lines |
| 4 | `check-contract-signed.cjs:96-108` (contract block, LEAN log) | `sed -n 94,110p` | ok |
| 5 | `approval-receipt.cjs:3-6,146-148` (agent-writable header; `mewkit plan approve` runs the file) | `sed` | ok |
| 6 | `budget-tracker.cjs:75-81` returns `@@BUDGET_BLOCK@@` text | `sed -n 72,82p` | ok (block text at 72-75) |
| 7 | `dispatch.cjs:102-108` plain stdout/exit aggregation, `:112-114` fatal → exit 0 | `sed -n 100,116p` | ok (fatal handler at 110-114) |
| 8 | `model-detector.cjs:46-49` LEAN only for `4-6`/`4.6` | `sed -n 44,50p` | ok (lines 45-49) |
| 9 | `density-select.sh` LEAN for `opus-4-6/4.6/4-7` | `grep -n` | ok (lines 13, 71, 108) |
| 10 | `memory-store-lint.cjs:74` `SKIP … exit 0` | `sed -n 72,76p` | ok |
| 11 | `post-session.cjs:131-132` unconditional sentinel `{"safety":true,"phase_zero":true}` | `sed -n 128,134p` | **corrected** to `:128-134` (append at 130-133) |
| 12 | `pre-completion-check` reads only `verification-required.json`; no writer | `grep -rn` over `.claude` and `crates` | ok (one reader, no writer) |
| 13 | `agent-detector/SKILL.md:44-66` re-read and abort text | `sed -n 44,66p` | ok |
| 14 | `check-always-on-budget.cjs:25` limit 25,600 and rules size | `sed`, `wc -c` | ok (25,420 B now; D03 first-pass 25,417 B) |
| 15 | `athena.md:210` "your tools are read-only, so this is structural" | `sed -n 208,211p` | ok |
| 16 | `workflow.yaml` Gate 2 "Hook enforcement is deferred" | `grep -n` | ok at `:102` |
| 17 | `CLAUDE.md:23` `gate-enforcement.sh` | `sed -n 21,25p` | ok |
| 18 | `settings.json` `permissions.allow`, `env`, empty `SubagentStart/Stop`, 13 registrations | `node -e` | ok; no `permissions.deny`, no `sandbox` |
| 19 | `installer-pins.json` `{"stable":null,"beta":null}` | `cat` | ok |
| 20 | `kit/mod.rs:29` download prefix; `extract.rs:13-15,38` limits and symlink refusal | `grep -n` | ok |
| 21 | `capability/lifecycle.rs` Stop `[gate]` text and `subagent_stop` text | `grep`, `sed` | ok: Stop at `:109-112`; **new**: `subagent_stop` "observe" at `:132-136` conflicts with the empty `SubagentStop` array |
| 22 | README "doctor warns when it detects both" | `grep -i plugin` over `doctor/` | ok (no match); README `:72` vs `:84-86` contradict each other on "nothing is copied" |
| 23 | Counts: skills 128, agent files 44 / definitions 42 / memory 36 / models 12-2-15-13, rules 7, hooks 100, handlers 21 (22 registrations), verbs 23, `#[test]` 1,662, `.rs` lines 83,651, `context: fork` 22 | shell counts | ok; hook count basis for "27" derived (6 + 21) |
