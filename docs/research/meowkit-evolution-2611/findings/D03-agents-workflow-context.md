# D03 — Agents, 7-phase workflow/gates as design, always-on context, coexistence

**Baseline:** audited at `feat/rust-plan-state-verbs` @ `fc278b31`, then re-verified on `main` @ `c7ff0a9e` (checkout moved mid-run per coordinator). Diff of audited surfaces (`CLAUDE.md`, `README.md`, `.claude/rules`, `agents`, `skills/{cook,agent-detector,autobuild,fix,workflow-orchestrator}`, `hooks`): only `CLAUDE.md` (CLI wording `npx mewkit`→`mewkit`, `validate --substrate`), `rules/development-rules.md` (build cmds → `cargo build/test`), `agents/AGENTS_INDEX.md` (bless command), and hooks `lib/{memory-store-lint,meowkit-paths,session-context-report,validate-workflow-evidence}.cjs` + 2 tests + `core-closure.json`. NOT changed: `handlers/*` (model-detector), `lib/core/*` (plan-gate, pre-ship), `gate-enforcement.cjs`, all 42 agent files, cook/agent-detector/autobuild/fix/workflow-orchestrator. Re-run on main: always-on budget exit 0, rules 25,420 B (limit 25,600, 180 B headroom; was 25,417), skills 24,105, agents 9,707 unchanged; CLAUDE.md 8,961 B (was 8,971); SessionStart synthetic output 3,229 chars (was 3,200), still "Model: not detected"; stale-path scan identical set (88 tokens, same list; `gate-enforcement.sh` still at CLAUDE.md:23; `docs/project-context.md`, `.meowkit/memory`, `scripts/worktree.cjs` still absent). All F-/C- findings hold at main; figures quoted as 25,417/8,971/3,200 differ by ≤30 B. Only fc278b31-specific citation: the `npx mewkit` wording and `npm run build` default in `development-rules.md` (both retired on main); TS CLI `packages/mewkit/src` references in F-15/F-20 context (`context-budget.ts:9` "no kit-owned root CLAUDE.md ships") are fc278b31-only if `packages/mewkit/src` was removed on main (not re-checked; `packages/mewkit` now holds only `dist`/`node_modules`) — UNKNOWN whether the Rust CLI preserves that statement.

Auditor: D03. Date 2026-11-15. Checkout `/Users/sangnguyen/Desktop/MeowKit` branch `feat/rust-plan-state-verbs` HEAD `fc278b31`. Token figures are chars/4 ESTIMATES. D01 (hooks/security) and D02 (skills) not duplicated; referenced only.

## 1. Scope & coverage inventory

Examined (all VERIFIED by reading/running unless stated):
- `.claude/agents/*.md` (44 files = 42 agents + `AGENTS_INDEX.md` + `SKILLS_INDEX.md`): scripted inventory (frontmatter, size, invocation grep). Bodies read in full or in large part: orchestrator, planner (headings), architect (headings), brainstormer (headings), advisor/athena (headings + key lines), reviewer, evaluator, security, developer, tester, documenter, journal-writer, project-manager, analyst, explore, researcher, jira-time (leaf template).
- Rules: `CLAUDE.md`, `.claude/rules/*.md` (7), user-global `~/.claude/CLAUDE.md` + `~/.claude/rules/*.md` (8).
- Skills read: `cook/SKILL.md`, `cook/references/{workflow-steps,phase-contracts}.md` (full/near-full); `agent-detector/SKILL.md` + `references/{model-selection-rules,agent-routing,scoring-and-thresholds}.md`; `autobuild/references/adaptive-density-matrix.md`, `scripts/density-select.sh`, `step-00-tier-detection.md`; `fix/SKILL.md` + `workflow-quick/standard`; `workflow-orchestrator/workflow.yaml`; `scale-routing/SKILL.md` + CSV.
- Hooks (only as far as workflow needs): `settings.json` registrations, `handlers.json`, `model-detector.cjs`, `resolve-model.cjs`, `post-session.cjs` (model part), `gate-enforcement.cjs` + `lib/core/plan-gate.cjs`, `lib/gate2-check.cjs` wiring, `safety-sentinel-inject.cjs` header.
- Ran (scratch copy under `/private/tmp/claude-501/.../scratchpad/d03/proj`, never the repo): `dispatch.cjs SessionStart` and `UserPromptSubmit` with synthetic stdin; `gate-enforcement.cjs` with synthetic Edit inputs; `scripts/check-always-on-budget.cjs .` (read-only on repo).
- Docs fetched: Claude Code sub-agents, memory, skills, hooks pages (code.claude.com/docs/en/...).
- Local telemetry `.meowkit/telemetry/{cost-log.json,trace-log.jsonl}` (gitignored, one developer's, 2026-11-12..15).
- Repo outcome evidence: `docs/governance/{rule-rationale,dead-weight-audit-registry}.md`, `.claude/benchmarks/`, `docs/journal*/`.

NOT done: did not read the bodies of planner/architect/brainstormer/advisor/athena beyond headings and key lines; did not read each of 22 leaf agent bodies (diffed one, sampled sizes); did not read `plan-creator`/`review`/`ship` step files (sized only); did not read `autobuild` steps beyond density; no live subagent was spawned, so host behaviours (tool grants from `memory:`, model resolution of `claude-opus-5`) rest on docs + the session's own agent listing; did not run the Rust CLI `doctor`; Part C measured SessionStart with no project-context and no active task (real sessions add up to 12 KB project-context + orientation); desktop-app vs CLI stdin difference not reproduced live.

## 2. Findings

### Part A — Agents

**F-D03-01 — 44 vs 42 resolved.** 42 agent definitions + 2 index files in `.claude/agents/`. README "42 agents" is correct; the "44" is a file count including `AGENTS_INDEX.md`/`SKILLS_INDEX.md`. VERIFIED (`ls`, `AGENTS_INDEX.md` toon header `[42]`). Matters: hosts that load every `.md` in the dir see index files as agents only if they have frontmatter (they have none) — low risk. Counter-evidence: none.

**F-D03-02 — Agent inventory** (VERIFIED, `inv.py`). Models pinned in frontmatter: 12 `claude-opus-5`, 2 `fable`, 13 `sonnet`, 15 `haiku`. Bytes: 213,205 total; lifecycle/support 20 agents = 129,253 B; 22 executor leaves = 83,952 B (39%). Leaves are NOT "1-line": 54–194 lines, 1.8–9.4 KB each (jira-time 58 lines). Listing cost (name+description+tools, my format): 11,634 chars (~2.9K tok) for 42, of which 22 leaves = 2,783 chars (~0.7K tok). The project's own checker counts name+description = 9,707 B. Host warns only above 15,000 tokens of descriptions (DOCUMENTED, sub-agents page) — MeowKit is ~5x under.

| Class | Agents | Mechanical invoker? | Evidence class |
|---|---|---|---|
| Lifecycle (prose-spawned via `Task(subagent_type=…)` in cook/autobuild/fix references) | planner, developer, tester, reviewer, evaluator, shipper, documenter, analyst, security, architect, researcher, ui-ux-designer, project-manager, explore | No. Model must follow prose. Strict-grep spawn refs: developer 41, evaluator 29, reviewer 28, researcher 24, planner 21, tester 20, explore 15, security 14, PM 14, architect 13, documenter 12, shipper 11, ui-ux 9 | VERIFIED (grep) |
| Opt-in/specialist, 1-2 callers | advisor (only `mk:advise`, by design), athena (`--advice` only, 12 refs), brainstormer (2), journal-writer (1: fix/workflow-deep), git-manager (1: cook text; also "cook never spawns it", shipper does) | No | VERIFIED |
| Unreferenced as spawn target | `orchestrator` (3 refs, all documentation: benchmark SKILL, model-selection-rules, after-detection; no `Task(subagent_type="orchestrator")` anywhere) | n/a | VERIFIED |
| Executor leaves (22: 16 jira-*, 5 confluence-*, story-sizer) | each bound by skill frontmatter `context: fork` + `agent: <same name>` — the ONLY `agent:` bindings in the skill tree (22 of 22) | Yes (host mechanism, DOCUMENTED skills page: "skill content is injected into the agent you specify", no conversation history) | VERIFIED + DOCUMENTED |

**F-D03-03 — Executor-leaf pattern.** Each leaf = thin skill (`context: fork`, `agent: X`) + agent file. The agent adds: a fixed tool grant (`Bash, Read, Grep, Glob` [+Write]), a pinned model (haiku/sonnet/opus-5), a Rule-of-Two note, a 1-line "Required Context", gotchas placeholder `(none yet — grow from observed failures)`, and the A1 status block. Diff of jira-time vs jira-ops after normalising names shows the same skeleton (VERIFIED). What it buys: real context isolation (fresh context, skill body as prompt) and per-leaf model choice (cheap haiku for read-only searches). What it costs: 22 listing entries (~0.7K tok always), 84 KB of near-duplicate prose to maintain, `requires_external_service: jira` leaves are `default_enabled: false` yet agent files are always listed. Alternative: a single `jira` agent + skill-level `model`/`allowed-tools`, or leaves as plain skills with `context: fork` and `agent: general-purpose`/built-in. INFERRED: per-leaf agent adds only model+tool pinning; skill frontmatter can express `allowed-tools` and (host) `model`. Counter-evidence sought: do leaves differ materially? evaluator/analyst/estimator (opus-5, 160–190 lines) do have distinct procedures; the 14 haiku/sonnet CRUD leaves (54–99 lines) are template-identical. NEEDS MORE EVIDENCE on whether Jira users exist/use it (no telemetry of leaf use).

**F-D03-04 — Tool grants are not the isolation the prompts claim: `memory: project` silently adds Write+Edit.** 21 agents set `memory: project`. Host docs: "Read, Write, and Edit tools are automatically enabled so the subagent can manage its memory files" (DOCUMENTED, sub-agents page, persistent-memory section; page does not say how it interacts with an explicit `tools` allowlist). This session's agent listing (runtime ground truth) shows `athena`, `explore`, `orchestrator` with `Write, Edit` although their frontmatter `tools:` list neither (athena `Read, Grep, Glob`; explore `Read, Grep, Glob, Bash`; orchestrator `Read, Grep, Glob, Task, AskUserQuestion`) — VERIFIED by comparison. Yet `athena.md:210` says "You write nothing (your tools are read-only, so this is structural, not a promise)" and `explore.md` description says it "never writes files". CONTRADICTED. Matters: the read-only contracts of the three agents most advertised as read-only are prompt-only. Fix is one line (`disallowedTools: Write, Edit` or drop `memory:`). Memory utility: `.claude/agent-memory/` is gitignored and contains 4 files, all under `evaluator/`; the other 20 `memory: project` agents have no accumulated memory (VERIFIED `find`) — so the grant is paid for by 1 of 21 agents. Also each such agent loads its `MEMORY.md` (first 200 lines/25 KB) on spawn (DOCUMENTED).

**F-D03-05 — Model routing: tier is an instruction, not a mechanism; two mechanisms exist and disagree with it.**
- The tier ("declare `Task complexity: [T|S|C] → model`") is printed text (`cook/references/workflow-steps.md` Phase 0 step 2; `model-selection-rules.md` Rule 1). No hook, CLI verb or script maps tier → model for a spawn. VERIFIED (grep: `model=` appears only as a template `Agent(subagent_type="[agent]", model="[detected-model]")` in `after-detection.md:7`; host honours a per-invocation `model` alias with top priority, DOCUMENTED).
- What actually sets a subagent's model: `model:` in each agent's frontmatter (DOCUMENTED order: per-invocation param > frontmatter > `CLAUDE_CODE_SUBAGENT_MODEL` > main model). So `developer`, `planner`, `reviewer`, `architect`, `security`, `evaluator`, `ui-ux-designer`, `brainstormer` always run on `claude-opus-5` regardless of tier. A TRIVIAL typo routed to `developer` runs on Opus. `model-selection-rules.md` says "Feature implementation → STANDARD (Sonnet)"; `developer.md` pins `claude-opus-5`. CONTRADICTED (VERIFIED both files).
- `claude-opus-5` (no minor) as a model ID: host docs give `claude-opus-5-5` as the full-ID example; whether the bare `claude-opus-5` resolves is UNKNOWN (verify: spawn `developer` and read the transcript's model).
- Fixed values: valid aliases per docs are `sonnet|opus|haiku|fable|<full id>|inherit`. Pinning 12 agents to one concrete ID couples the kit to one model generation (H2).

**F-D03-06 — "Model: not detected (defaulting to STANDARD/FULL)" trace.**
1. `model-detector.cjs` reads `ctx.model` (SessionStart stdin) → `CLAUDE_MODEL`/`CLAUDE_MODEL_ID` env → `MEOWKIT_MODEL_HINT`; else default STANDARD/FULL and prints the "not detected" line (`model-detector.cjs`, VERIFIED). Reproduced: stdin without `model` → exact line.
2. Host docs: "Only SessionStart hooks can receive a `model` field, and Claude Code doesn't always include it" (DOCUMENTED, hooks page). `resolve-model.cjs` header states the host exports no model env var to end-of-session hooks. INFERRED: the desktop app omits `model` on SessionStart (not reproduced live — UNKNOWN; verify by logging raw SessionStart stdin from the desktop app).
3. Local telemetry supports an intermittent failure: of 227 sessions, 115 recorded `claude-opus-5-5`, 112 recorded `unknown` (`cost-log.json`, VERIFIED); `.meowkit/state/detected-model.json` currently holds `confidence: default`.
4. Handler classification bugs found by running it with synthetic stdin: `claude-opus-5-5` → COMPLEX/FULL (keyword); `claude-sonnet-5-5` → STANDARD/FULL; `fable` → "not detected"; `claude-opus-4-6` → COMPLEX/LEAN. The LEAN rule exists only for the literal strings 4-6/4.6 (`model-detector.cjs` keyword branch) and `density-select.sh` (opus 4-6/4-7). `adaptive-density-matrix.md` says "opus-4-6, opus-4-7+ → LEAN". So for the Opus 5.x model the lead actually uses, both implementations give FULL — the opposite of the document's own "dead-weight thesis" (newer model → less scaffolding). VERIFIED.
5. Consumers of `detected-model.json`: `budget-tracker.cjs` (tier → cost estimate), `auto-checkpoint.cjs`, `checkpoint-writer.cjs`, `resolve-model.cjs` (cost-log). `density-select.sh` and `autobuild/step-00` do NOT read it; they read only env `MEOWKIT_MODEL_HINT|CLAUDE_MODEL|ANTHROPIC_MODEL` (VERIFIED). So the SessionStart detection that is supposed to drive autobuild density does not reach autobuild; the only effect on behaviour is a text line the model may or may not act on. `harness-rules.md:64` admits `CLAUDE_MODEL` is not exported to hooks (verified 260408).
Matters: the tier/density machinery (3 files + CSV + handler) has no mechanical consumer that changes agent behaviour.

**F-D03-07 — Subagent Status Protocol (A1) is requested, not checked.** Grep for `DONE_WITH_CONCERNS` across `.claude/hooks`, `packages/mewkit/src`, `crates`, `scripts`, `tests` hits only `scripts/rule-survival-oracle.cjs` (verifies the rule text survives edits). `settings.json` registers `SubagentStart: []` and `SubagentStop: []` (empty). No parser of the status block. VERIFIED. The host has `SubagentStop` hooks, so a checker is feasible; none exists. Effect on outcomes: UNKNOWN (no data).

**F-D03-08 — Overlap analysis** (what differs in prompt/tool grants; does the split give real isolation or independent judgement?).

| Pair/group | What actually differs | Isolation? | Independent judgement? | Call |
|---|---|---|---|---|
| orchestrator (agent) vs agent-detector (skill) vs scale-routing (skill) vs cook Phase 0 | All four: classify complexity, assign tier, detect TDD, route. Agent: sonnet, has `Task`+`AskUserQuestion`, never spawned (F-02). agent-detector: "every message, no exceptions", numeric scoring weights (`scoring-and-thresholds.md`) with no script — the model "computes" them; also reads 6 refs + 7 rules at turn 1. scale-routing: 13-row keyword CSV (e.g. "users","posts","sharing" → social/high) with Rule 4 "domain match level=high forces COMPLEX regardless of any other signal incl. manual classification". No code runs the CSV match. | n/a | n/a | MERGE to one Phase-0 routine (EXPERIMENT: remove agent-detector scoring + orchestrator agent, keep risk flags + model self-classification) |
| planner vs architect vs brainstormer vs advisor vs athena | planner: plan files (Gate 1 owner), opus-5, Bash/Edit/Write. architect: ADR files + `docs/architecture/`, same tools/model. brainstormer: read + web, no write, options only. advisor: fable, interviews user one question/turn, respawned every turn (`advisor.md` "Turn Mechanism"), only via `mk:advise`. athena: fable, "no gate authority", GUIDE/RESCUE/REVIEW/RECHECK, only `--advice`. | planner/architect: shared tools & model, differ only in owned artifact (prompt-only). athena/advisor: different (stronger) model tier = genuine independent model, but 0 measured value (registry row: "Not yet measured", WATCH). brainstormer: tool difference only (no Write by grant — but see F-04, memory re-adds it). | athena (different model, fresh context) plausible; planner≠architect only a renamed prompt | architect→SIMPLIFY (skill or planner mode); brainstormer→MERGE into researcher/planner; athena/advisor→EXPERIMENT |
| reviewer vs evaluator vs security vs mk:review/mk:evaluate/mk:cso | reviewer: opus-5, 5-dimension structural verdict, owns `*-verdict.md`; thin wrapper over `mk:review` (agent file says "invoke the mk:review skill"). evaluator: drives the running build with rubrics, skeptic persona, owns `*-evalverdict.md`, has `AskUserQuestion`. security: PASS/BLOCK, owns `*-security-verdict.md`, platform checklists; duplicates `security-rules.md`, `mk:cso`, `mk:vulnerability-scanner`, host `/security-review`. | Subagent = fresh context (real). Same underlying model family as the developer (opus-5 reviewer reviewing opus-5 developer) → correlated judgement. evaluator is the only one that observes runtime behaviour (different evidence), the real differentiator. | reviewer: weak (same model, same instructions); evaluator: strong because evidence differs | KEEP evaluator; KEEP reviewer (fresh-context read + Gate 2 artefact) but SIMPLIFY agent+skill duplication; security→MERGE into reviewer dimension unless risk flag |
| developer vs tester | Identical tool grants (`Read,Grep,Glob,Bash,Edit,Write`); developer opus-5, tester sonnet. Default mode: tester optional ("does not block developer"). Differentiator = ownership of test files + TDD red phase (opt-in). | Fresh context only if spawned; in default mode tester rarely spawned. | Independent authorship of tests is real value ONLY under `--tdd` | KEEP tester but EXPERIMENT whether separate agent beats developer writing tests |
| documenter vs journal-writer vs project-manager vs analyst | documenter: `docs/` (haiku). journal-writer: `docs/journal/` failure narrative (sonnet). PM: `status-reports/*.md` read-only aggregation (haiku, Write only). analyst: cost-log + patterns; cost-log is written by `post-session.cjs`, not by the agent (analyst.md schema says so). All four are Phase 6 prose writers. | Isolation low-value: output is prose files nobody gates. | none needed | analyst→REMOVE agent (hook writes cost-log; `mewkit budget` exists); journal-writer→MERGE into documenter; PM→DELEGATE TO HOST (TaskList/status) or keep skill only; documenter KEEP |
| explore vs researcher | explore: local codebase, no web, haiku, "never writes files" (not enforced, F-04). researcher: web+docs, sonnet. Host ships built-in `Explore` (read-only, "All tools except Edit, Write…", per this session's listing) and `Plan`. | MeowKit `explore` ≈ built-in `Explore` + a `path:line` output contract and a NEEDS_CONTEXT rule | built-in has stricter tool grant | explore→DELEGATE TO HOST (`Explore`) |

**F-D03-09 — Agent classification** (call / evidence class):

| Agent | Call | Evidence class |
|---|---|---|
| planner, developer, reviewer, evaluator, shipper, tester | KEEP (reviewer, tester: EXPERIMENT on separation value) | INFERRED (isolation real via host; outcome effect UNMEASURED) |
| orchestrator | REMOVE (never spawned; duplicate of agent-detector) | VERIFIED (grep) |
| architect, brainstormer | SIMPLIFY/MERGE into planner modes / researcher | INFERRED |
| athena, advisor | EXPERIMENT (opt-in, no measured value; registry WATCH) | VERIFIED (registry) |
| security | SIMPLIFY (risk-flag triggered only) | INFERRED |
| explore | DELEGATE TO HOST (`Explore`) | VERIFIED (listing) |
| researcher | KEEP | INFERRED |
| documenter | KEEP; journal-writer MERGE; analyst REMOVE; project-manager DELEGATE TO HOST | INFERRED |
| git-manager | MERGE into shipper (1 caller, shipper already owns commit/PR) | VERIFIED (grep) |
| ui-ux-designer | KEEP (conditional on frontend) | INFERRED |
| 14 haiku/sonnet CRUD leaves (jira/confluence) | SIMPLIFY (template→one parameterised agent or skill-only fork) | VERIFIED (diff) |
| evaluator-type leaves (jira-analyst/estimator/evaluator, confluence-spec-analyst, story-sizer) | KEEP; NEEDS MORE EVIDENCE of use | UNKNOWN usage |

### Part B — Workflow and gates as design

**F-D03-10 — The real state machine** (VERIFIED from cook SKILL, workflow-steps, workflow.yaml, hook sources):

| Transition | Instruction-only | Artefact-backed | Hook-backed |
|---|---|---|---|
| Phase 0 Orient (tier declaration, scout summary, TaskCreate x phases) | yes | no | SessionStart emits context only |
| 0→1 Plan | yes (plan-creator steps) | `tasks/plans/*/plan.md` | no |
| **Gate 1** (1→3) | AskUserQuestion prompt is instruction | `plan.md` + `approval:` receipt (`mewkit plan approve`, binds `plan_hash`) | **Yes**: PreToolUse `gate-enforcement.cjs` → `lib/core/plan-gate.cjs`: any Edit/Write to a path not classed doc/test/kit/contract is blocked unless a plan exists and receipt is fresh (+contract check). Reproduced in scratch: `src/foo.ts` and `README.md` blocked; `docs/a.md`, `tests/a.test.ts` allowed |
| 2 Test (TDD only) | yes | failing tests | `pre-implement.cjs` only if the *developer* invokes it via Bash (`developer.md` step 3) → instruction-triggered |
| 3 Build | yes | none | none beyond Gate 1; PostToolUse build-verify observer |
| 3.5 Simplify | yes ("MANDATORY") | none | **none** (grep of handlers, pre-completion-check, pre-ship: no simplify check) |
| 3.6 Verify | yes ("MANDATORY") | `build-verify-cache.json` state only | **none** requiring it |
| **Gate 2** (4→5) | AskUserQuestion prompt | `tasks/reviews/*-verdict.md` bound to HEAD | **Yes** at commit/push/merge: `pre-ship.cjs` → `lib/core/pre-ship.cjs:27` → `lib/gate2-check.cjs` (fail-closed). `workflow.yaml` still says `gate_2: enforced_by: behavioral … Hook enforcement is deferred` → CONTRADICTED (stale) |
| 5 Ship | explicit user request | PR | pre-ship |
| 6 Reflect | explicit close request | docs/plan archive | Stop observers (post-session, pre-completion-check nudge) |
| Autobuild contract substep | | `tasks/contracts/*-sprint-*.md` | gate-enforcement contract branch |

D01 owns correctness of the hooks; here only the mapping matters: **2 of 9 phase transitions are mechanically backed (Gate 1 for source edits, Gate 2 at git ship commands); Simplify, Verify, Review-as-process, Reflect, tier declaration are prose.**

**F-D03-11 — Per-phase cost, interruptions, exceptions, evidence** (load = bytes of SKILL+steps+references+agent body a model is told to read; upper bound, INFERRED; tokens = bytes/4):

| Phase | Load (B / ~tok) | Human interruptions forced | Exceptions that exist | Evidence it improves outcomes |
|---|---|---|---|---|
| 0 Orient | 101,506 / 25.4K (agent-detector 9.8K + 6 refs + scale-routing + cook SKILL 19.8K + workflow-steps 28.0K + intent-detection + failure-catalog); plus 25.4K duplicate re-read of the 7 already-loaded rules on turn 1 | 0 (but scout summary + clarifying questions required) | skip when input is a plan path | rationale asserted only |
| 1 Plan / Gate 1 | full 120,957 / 30.2K (plan-creator SKILL 26.7K + workflow + 12 step files 97K); fast 29,473 / 7.4K | 1 (Gate 1 AskUserQuestion) + `mewkit plan approve` stamp + clarifying questions | gate-rules lists 3; hook honours none (F-12) | asserted |
| 2 Test | testing SKILL 2.5K + tester body 5.3K | 1 ("Post-Test-RED" non-auto, TDD only) | optional in default mode | asserted (tdd-rules) |
| 3 Build | 29,902 / 7.5K (orchestration-rules 10.4K + subagent-patterns 8.9K + developer body 10.5K) | 0 | parallel only COMPLEX | asserted |
| 3.5 Simplify | 13,622 / 3.4K (skill + developer respawn) | 1 ("Post-Build" proceed?) non-auto | none ("mandatory") | asserted ("Reviewers catch logic errors better on simplified code") |
| 3.6 Verify | 8,435 / 2.1K | 0 | scope to changed files | asserted |
| 4 Review / Gate 2 | 58,457 / 14.6K (review SKILL 17.3K + step files 28.3K + reviewer body + review-cycle) + review references 62.8K not counted | 1 (Gate 2) ≤3 fix cycles; plus 2 structural scripts | **none** (gate-rules) | asserted; rubric "leniency drift" cited from Anthropic research, no local measurement |
| 5 Ship | 17,895 / 4.5K (+ship references 101 KB not counted) | 1 (explicit ship request) | — | asserted |
| 6 Reflect | 34,859 / 8.7K | 1 (explicit close request) | non-blocking | asserted |

A full interactive cook run therefore asks a model to load ~333 KB (~83K tokens) of workflow text before Gate 2 (phases 0,1-full,3,3.5,3.6,4 summed), ~5–6 human stops (Gate 1, Post-Build, Gate 2, ship request, close request, + Post-Test under TDD).

**F-D03-12 — "Effect measured" vs "rationale asserted".** Repo-side evidence: `docs/governance/dead-weight-audit-registry.md` has 27 rows; **0 rows carry a numeric measured delta** (all `N/A`/"not measured"/"Not yet measured"); `.claude/benchmarks/results/` is empty (0 files); `mk:benchmark` is self-described "Experimental/manual … does not provide a fully automated runner"; local `trace-log.jsonl` contains only `file_edited` (1,332) and `session_end` (227) events — no gate/phase events to analyse. `docs/journal*` (7 files) are build narratives, not outcome comparisons. `rule-rationale.md` is token-optimisation history. The load-bearing external citation ("dead-weight thesis", leniency drift) appears as `<!-- research-citation -->` placeholders (`adaptive-density-matrix.md` Anti-patterns table, `developer.md`) — no citation resolved in-repo. VERIFIED. H1/H3/H4 remain UNSUPPORTED locally. Gates are marked NEVER-PRUNE by policy (Rule 4) — a safety-net rationale, legitimately not benchmark-measured; but Simplify/Verify/Reflect/orchestrator have no such exemption and no measurement either.

**F-D03-13 — Minimum ceremony for a 3-file bug fix** (rules as written; both entry paths).
Path A `/mk:fix` (standard, because >2 files): mode select → memory grep `.meowkit/memory/` (dir absent in this checkout) → mk:investigate → scout (mandatory) → root-cause proof → complexity assessment → `mk:plan-creator "bug fix: …"` (SKILL 26.7K + fast workflow) → **Gate 1 human approval** → `mewkit plan approve` → edit → iron-law before/after verify → regression test (BLOCK if missing) → prevention gate → reviewer (workflow-standard Step 5) → evidence JSON write at `.meowkit/state/evidence/…` → Step 6 learn (`mewkit note` if non-derivable) → PM delegation (Moderate+) → fix summary report. Then to commit: **Gate 2 verdict + human approval** (hook-enforced at `git commit`).
Path B `/mk:cook`: Phase 0 (tier line, scout summary, 7 TaskCreate) → plan → Gate 1 → developer → Simplify subagent → Verify → reviewer subagent + 2 validators → Gate 2 → PM (background) → stop → ship on request → Reflect (documenter + planner sync + analyst + memory).
Artefacts minimum: plan.md (+phase file), approval receipt, verdict file with HEAD binding, evidence JSON (fix) , status report (PM). Approvals: Gate 1, Gate 2 (+ Post-Build prompt in cook).
Threshold workability: CLAUDE.md ">2 files OR >30 min" is the only quantified trigger; `orchestrator.md` uses "Standard: multi-file … never skip planner for standard"; `model-selection-rules.md` "Standard = feature <5 files"; `fix` uses "single file / >2 files"; cook `quick` runs "do not create a plan" (F-14). File count is cheap to game and says nothing about risk; the hook ignores it entirely (blocks even a 1-line src typo, F-14).

**F-D03-14 — Gate 1 exceptions are unreachable in installed behaviour.** `gate-rules.md` lists three exhaustive Gate 1 exceptions (`/mk:fix` simple; scale-routing one-shot; explicit user override). `mk:fix --quick`: "Do not create a plan" (`workflow-quick.md:21`); cook Usage: "Quick runs do not create a plan"; but `cook/SKILL.md` HARD GATE: "`--fast` … still requires plan". The enforcement code `plan-gate.cjs` (VERIFIED, lines ~95-117): any gated path with no plan → `NO_PLAN` block *before* the hatch is consulted; the only downgrade (`MEOWKIT_GATE1_PRESENCE_ONLY` / user config) still requires plan presence. The block message itself says "or /mk:fix for simple fixes" — which then cannot edit. Reproduced: `src/foo.ts` and `README.md` blocked with no plan. CONTRADICTED: documented no-plan paths (quick, TRIVIAL tier, fix simple) cannot write a source file in a protected project.

**F-D03-15 — Stale/contradictory references (programmatic).** Script `stale.py` extracted path-like tokens from CLAUDE.md, `.claude/rules/*.md`, `.claude/agents/*.md`; 88 non-existent (after dropping placeholders), of which 41 are `docs/project-context.md`. Genuine stale in this checkout (rest are runtime state/env/generated, e.g. `.meowkit/state/*`, `.meowkit/.env`):

| Reference | Where | Reality |
|---|---|---|
| `gate-enforcement.sh` | CLAUDE.md:23 | file is `gate-enforcement.cjs` |
| `docs/system-architecture.md` | CLAUDE.md | exists at `docs/architecture/system-architecture.md` |
| `docs/project-context.md` (41 refs; "loaded by ALL agents"; every lifecycle agent's Required Context) | CLAUDE.md, agents | absent in this checkout; SessionStart prints "No project-context.md found" |
| `docs/project-overview.md`, `code-standards.md`, `deployment-guide.md` | CLAUDE.md, development-rules.md | absent here |
| `.meowkit/memory/{decisions,gotchas}.md` | CLAUDE.md, meowkit-core.md, injection-rules, agent-conduct, architect, planner, PM | absent here (lead's baseline); CLAUDE.md says "committed" |
| `scripts/worktree.cjs` | SKILLS_INDEX.md | absent |
Prose contradictions: (a) `workflow.yaml` Gate 2 "behavioral/hook deferred" vs `gate-rules.md`/`pre-ship` hook (F-10); (b) Phase 6 membership: SKILL.md/workflow.yaml = analyst+documenter+mk:memory; `workflow-steps.md` Phase 6 = planner sync-back + documenter, no analyst; (c) two things named "Verify": Phase 3.6 `mk:verify` vs "Phase 4.5 Verify (Browser)"; (d) cook gotcha "Subagent patterns using Agent() not Task()" vs host: `Task` renamed `Agent` in v2.1.63, `Task(...)` still an alias (DOCUMENTED) — stale advice; (e) `CLAUDE.md` and `meowkit-core.md` duplicate Workflow/Gates/Security/Memory/Compaction text nearly verbatim, both containing the same stray fragment "Always preserve verbatim` block." (VERIFIED in both); (f) `CLAUDE.md`'s "Gate 1 — an approved plan must exist" vs `gate-rules.md`'s receipt/hash requirement (the shorter one understates); (g) `agent-detector` "Priority HIGHEST … ALWAYS every user message" vs `user-invocable: false` and host semantics where a skill loads only when the model chooses it (DOCUMENTED skills page) — it cannot be guaranteed per message. Host offers `/doctor prompt-audit` for stale references/conflicts (DOCUMENTED memory page).

**F-D03-16 — Host duplication.** Workflow instructions that restate host features:

| MeowKit instruction | Host feature | Call |
|---|---|---|
| `TaskCreate` per phase, `TaskList`/`TaskUpdate` (cook Phase 0/3) | host TaskCreate/TaskList tools | DELEGATE TO HOST (already used; drop the 7-phase pre-creation ritual) |
| Plan-then-approve (Gate 1 prompt) | `ExitPlanMode` plan mode | NEEDS MORE EVIDENCE: host plan mode lacks plan-hash receipt; keep receipt, drop duplicate prose |
| "Simplify" subagent, "Verify" pass | this session's Bash tool text references `/verify` and `/simplify`; origin (host vs user config) UNKNOWN | UNKNOWN; verify availability on a clean install |
| Worktrees (`mk:worktree`, parallel rules) | `EnterWorktree`/`ExitWorktree` tools; `isolation: worktree` on Agent | DELEGATE TO HOST |
| Exploration agent | built-in `Explore`, `Plan` | DELEGATE TO HOST |
| Security audit | host `/security-review` (listed in this session) | partial overlap |
| Stale-reference lint of instructions | `/doctor prompt-audit` | DELEGATE TO HOST |
| Turn-1 re-Read of the 7 rule files (`agent-detector` step 0) | rules w/o `paths:` frontmatter "are loaded at launch" (DOCUMENTED memory page); none of MeowKit's 7 has `paths:` | REMOVE (25.4K duplicated; the `safety-sentinel-inject` hook + `session-sentinels.jsonl` exist only to suppress turns 2..N of this duplicate) |

### Part C — Always-on context budget (flat-copy install, before first user token)

**F-D03-17 — Measurement** (chars; tokens = /4 ESTIMATE):

| Source | Chars | ~Tokens | Method |
|---|---|---|---|
| `.claude/rules/*.md` (7, none path-scoped) | 25,417 | 6.4K | `wc -c`, `check-always-on-budget.cjs` |
| `CLAUDE.md` (dev checkout only; `context-budget.ts:9` "no kit-owned root CLAUDE.md ships") | 8,971 | 2.2K | `wc -c` |
| SessionStart stdout (synthetic stdin, empty project) | 3,200 | 0.8K | ran `dispatch.cjs SessionStart` in scratch copy: model line, "No project-context.md", config block, "MeowKit CLI not available", directory tree depth 2, tools list, readiness, jira env note, capability-resolution text. Real sessions add up to 12,288 B project-context (`DEFAULT_MAX_BYTES`) + orientation block — NOT measured |
| UserPromptSubmit per turn | 0 on turn 1 (measured); small cached marker (`## Safety baseline: verified…`) on later turns after Stop writes the sentinel; `--tdd` sentinel only on flag | ~0.0–0.1K | ran `dispatch.cjs UserPromptSubmit`; marker size NOT measured |
| Skill listing metadata (127 shipped skills: name+description+when_to_use) | 24,105 | 6.0K | checker; host caps each entry at 1,536 chars (DOCUMENTED) |
| Agent listing (42 agents: name+description; +tools clause my format) | 9,707 (11,634) | 2.4K (2.9K) | checker / `inv.py` |
| **Total flat install (rules+SessionStart+skills+agents w/ tools)** | **64,356** | **~16.1K** | sum |
| Total in this dev checkout (+CLAUDE.md) | 73,327 | ~18.3K | |
| User-global toolkit in lead's environment (`~/.claude/CLAUDE.md` 4,246 + 8 rules 32,230) | 36,476 | ~9.1K | `wc -c` |
| Combined co-installed | ~100K | ~25K | sum |
Not counted: Claude Code system prompt/tool schemas, plugin skills (vercel etc.), MCP schemas, per-agent `MEMORY.md`.

**F-D03-18 — Project's own ceilings.** `scripts/check-always-on-budget.cjs .` exits 0: rules 25,417 / limit 25,600 (183 B = 0.7% headroom); rules+skills+agents = 59,229 / limit 70,000 (10,771 headroom). CI runs it (`.github/workflows/ci.yml:201`). `tests/always-on-budget-ceilings.test.ts` tests the checker against synthetic scratch trees (it does NOT assert the real tree) — the real-tree gate is the CI script. VERIFIED. Implications: (1) 183 B headroom means any rule edit that adds text fails CI — pressure to shrink rules or to move enforcement to hooks; (2) ceilings cover metadata bytes only, not agent `tools:` lines, SessionStart output, or the 101 KB Phase-0 reads; (3) the 7 rules are loaded twice on turn 1 (auto-load + agent-detector re-Read, F-16).

### Part D — Coexistence

**F-D03-19 — Concrete collisions in the lead's environment** (`~/.claude` read for names only; `ls`/`wc`; settings key names only).

| Surface | MeowKit | User-global | Behaviour |
|---|---|---|---|
| Agent names (exact) | brainstormer, git-manager, journal-writer, planner, project-manager, researcher, tester, ui-ux-designer (8) | same 8 + code-reviewer, code-simplifier, debugger, docs-manager, fullstack-developer | DOCUMENTED: project `.claude/agents/` priority 3 beats `~/.claude/agents/` priority 4 → MeowKit versions win; the user's 8 are shadowed (this session's listing shows MeowKit descriptions for planner/researcher/etc., VERIFIED). User rules that say "delegate to `planner`/`researcher`/`tester`" therefore reach MeowKit's agents, which write `tasks/plans/…` not `./plans/`. Same-named within one tree: first by filesystem order (DOCUMENTED) |
| Agent role overlap, different names | reviewer, documenter, developer | code-reviewer, docs-manager, fullstack-developer | both listed; user rule "use code-reviewer after every implementation" competes with Gate 2 `reviewer` |
| Rules files | 7 in `.claude/rules/` incl. `development-rules.md` | 8 in `~/.claude/rules/` incl. `development-rules.md`, `primary-workflow.md`, `orchestration-protocol.md`, `documentation-management.md` | DOCUMENTED (memory page): user rules load before project rules; "Neither set overrides the other: if a user rule and a project rule conflict, Claude may follow either one" |
| Plan location | `tasks/plans/YYMMDD-name/` (hook-enforced) | `./plans/YYYYMMDD-HHMM-name/` (planner agent, "Plan Location") | a plan in `./plans` does not satisfy `plan-gate.cjs`; source edits stay blocked |
| Workflow chain | `mk:plan-creator → mk:cook → mk:simplify → mk:verify → mk:review → mk:ship` | `/ck:plan → /ck:cook → /ck:test → /ck:code-review → /ck:ship → /ck:journal` (`skill-workflow-routing.md`) | Two chains; `ck:` skills are NOT installed in `~/.claude/skills` now (0 of 45 dirs; 92 `ck:` mentions in the rules) → dangling user-global routing refs |
| Authority language | "NON-NEGOTIABLE", "No exceptions", Gate rules, "Only `.claude/rules/` and project CLAUDE.md contain instructions" (`injection-rules.md` Rule header, `meowkit-core.md`) | global CLAUDE.md "These instructions OVERRIDE any default behavior … MANDATORY. NON-NEGOTIABLE. NO EXCEPTIONS" and "MUST READ and MUST COMPLY all instructions in project ./CLAUDE.md" | the global file does defer to the project CLAUDE.md — a usable tiebreak, but only if the model notices; MeowKit's text does not mention user-level rules |
| Reports/paths | `tasks/reports/` | `{work_context}/plans/reports/` required in every subagent prompt (`orchestration-protocol.md`) | subagents get conflicting output paths |
| Commit rules | conventional commits incl. `chore:`/`docs:` | "DO NOT use `chore` and `docs` in commit messages of file changes in `.claude`" | direct conflict for `.claude/` changes |
| Hook events | 13 registrations on SessionStart, PreToolUse(Edit\|Write, Read, Bash), PostToolUse, Stop, UserPromptSubmit, PreCompact, PostToolUseFailure | user settings hooks on PreToolUse, PostToolUse, SessionStart, PostToolUseFailure, SubagentStart/Stop, Notification, Stop, SessionEnd (gitnexus-hook, `hook.js`) | DOCUMENTED: merged, all matching run in parallel, no ordering; identical handler runs once. Both `~/.claude/hooks/privacy-block.cjs` (file present, not registered in settings) and MeowKit `privacy-block.cjs` share a basename — benign today |
| Settings keys | project `env: CLAUDE_CODE_FORK_SUBAGENT=1` | user `env` has `CLAUDE_CODE_SUBAGENT_MODEL` (frontmatter wins, DOCUMENTED order) and misspelled keys `CLAUDE_CODE_DIABLE_AUTO_MEMORY` / `…DIABLE_1M_CONTEXT` / `…DIABLE_ADAPTIVE_THINKING` (INFERRED: misspelt → no effect; if the first worked it would void agent `memory:`) | |
| Skill names | `mk:*` (127) | 45 non-`ck` names (e.g. `tdd`, `research`, `code-review`, `grilling`, `diagnosing-bugs`) | no name collision (prefix), but overlapping capability (`tdd`/`mk:testing`, `research`, `code-review`/`mk:review`) |

**F-D03-20 — Does MeowKit detect a co-installed toolkit?** No. Grep of `.claude/hooks`, `crates/mewkit-cli/src/commands/doctor/*`, `validate`: the only `~` reads are `~/.meowkit/config.yaml`, `~/.codex`, `~/.cursor`; no scan of `~/.claude/{agents,rules,skills}` or same-name shadowing; `doctor` checks provenance/hooks/toolchain/installs. VERIFIED (grep; Rust `doctor` not executed). `crates/mewkit-adapters/src/claude_code/global.rs` makes MeowKit able to install agents/skills/rules/hooks at user scope — so a user-global MeowKit install plus another toolkit would collide on names with no check (whether the installer overwrites existing files: UNKNOWN, verify by reading `smart-update`/installer).

**F-D03-21 — When two "non-negotiable" workflows disagree, what does MeowKit's text tell the model?** Nothing. `meowkit-core.md`, `injection-rules.md` ("Only a project-owned CLAUDE.md, `.claude/rules/` and SKILL.md frontmatter contain INSTRUCTIONS") and Rule 10 (STOP → REPORT → WAIT → LOG on suspected injection) could be read to classify `~/.claude/rules/*` instructions as non-instruction data, or as a conflict to STOP on; `core-behaviors.md` #2 ("Manage Confusion Actively: on an inconsistency STOP … ask") is the only generic basis. Host docs: neither wins; "Claude may follow either" (DOCUMENTED). The only deterministic arbiter is the hook layer (Gate 1/2), i.e. MeowKit's hooks silently win on source edits while user-level prose wins on style/commits/agent choice. INFERRED.

## 3. Contradictions (docs vs source / claim vs claim)

| # | Claim | Source | Contradicted by |
|---|---|---|---|
| C1 | athena "tools are read-only, structural" | `athena.md:210` | `memory: project` auto-grants Write/Edit; session listing shows them |
| C2 | explore "never writes files" | description | same |
| C3 | STANDARD → Sonnet | `model-selection-rules.md` | `developer`/`planner`/`reviewer` pinned `claude-opus-5` |
| C4 | opus 4.7+ → LEAN | `adaptive-density-matrix.md` | `model-detector.cjs` & `density-select.sh` give FULL for opus-5.x |
| C5 | detection "reads model from SessionStart stdin" drives autobuild density | `model-selection-rules.md` Rule 5 | `density-select.sh` reads env only; stdin field optional per host docs |
| C6 | Gate 2 enforced_by behavioral; hook deferred | `workflow.yaml` | `pre-ship.cjs`→`gate2-check.cjs` registered (settings.json) |
| C7 | quick/fix-simple/TRIVIAL need no plan | cook Usage, `workflow-quick.md`, gate-rules exceptions | `plan-gate.cjs` blocks without plan; reproduced |
| C8 | cook `--fast` "still requires plan" | cook HARD GATE | cook Usage "Quick runs do not create a plan" |
| C9 | Phase 6 = analyst+documenter+memory | SKILL/workflow.yaml | workflow-steps Phase 6 lists planner sync-back+documenter |
| C10 | `gate-enforcement.sh` | CLAUDE.md:23 | `.cjs` |
| C11 | "42 agents" vs 44 files | README | resolved (F-01) |
| C12 | project-context.md is the "agent constitution loaded by ALL agents" | CLAUDE.md, 41 refs | file absent; SessionStart says so |
| C13 | agent-detector fires every message | SKILL | skills load on model discretion (host) |
| C14 | Task vs Agent naming gotcha | cook SKILL | host alias both valid |

## 4. Decisions proposed

| # | Decision | Class | Observed problem / affected source | Causal hypothesis | Alternatives | Measure |
|---|---|---|---|---|---|---|
| D1 | Make read-only agents read-only: add `disallowedTools: Write, Edit` (or drop `memory:`) on athena, explore, orchestrator (if kept), brainstormer | IMPROVE | F-04; `athena.md:210`; 21 agents `memory: project`, 1 has memory | `memory:` re-adds Write/Edit | drop `memory:` for 20 agents with empty store | spawn agent, call Write → expect deny |
| D2 | Remove turn-1 7-rule re-Read, then `safety-sentinel-inject`, `session-sentinels.jsonl` plumbing | REMOVE | F-16/17: 25.4K duplicated tokens/session; rules auto-load | host loads rule files at launch | keep as post-compaction re-anchor (PreCompact already exists) | tokens at turn 1 before/after; rule-survival oracle |
| D3 | Merge Phase-0 routing: delete `orchestrator` agent; reduce agent-detector to risk flags + tier self-declaration; drop numeric scoring weights & CSV hard override | MERGE/SIMPLIFY | F-02, F-08: 3 routers, none mechanically run | model self-classifies as well; CSV substring matches ("users","posts") force COMPLEX | keep CSV as advisory hint | misroute rate on 20 labelled tasks; Phase-0 token load |
| D4 | Either mechanise tier→model (hook/skill passes `model` alias on Agent calls) or delete tier theatre; at minimum fix contradictions C3/C4 | IMPROVE or REMOVE | F-05/06 | pinned `model:` ignores tier; detection absent in desktop | per-agent `model: inherit` + user setting; `CLAUDE_CODE_SUBAGENT_MODEL` | cost per task by tier; % sessions with `unknown` model (49% now) |
| D5 | Stop pinning `claude-opus-5` literals; use aliases/inherit | SIMPLIFY | F-05 | couples to one generation; ID validity UNKNOWN | keep for 2-3 agents needing strongest | spawn test, transcript model |
| D6 | Reconcile Gate 1 exceptions with `plan-gate.cjs`: either implement a hook-honoured micro-plan/receipt path for TRIVIAL/quick, or delete the exceptions and quick-mode no-plan prose | IMPROVE | F-14, C7/C8 | prose promises a path the hook refuses; users will hit blocks on 1-line fixes | scale gate by path class instead of file count | time-to-first-edit for 1-file typo; # of `GATE_BLOCK` per typo |
| D7 | Replace ">2 files OR >30 min" with risk-flag + blast-radius trigger already present in `risk-checklist.md` | SIMPLIFY | F-13 | file count ≠ risk; 4 definitions in circulation | keep count as hint | agreement across 4 files; plan-created-per-task |
| D8 | Simplify (3.5) and Verify (3.6): keep Verify (cheap, mechanical, maps to host/CI), make Simplify conditional on diff size or EXPERIMENT-remove | EXPERIMENT | F-10/12: "mandatory", no hook, no measurement; extra developer-agent respawn (13.6 KB) | rationale asserted only | host `/simplify` if present | A/B: review findings and defects with/without Simplify over N tasks |
| D9 | Collapse leaves: one parameterised `jira` agent (+ `confluence`) or skill-only fork; keep the 5 analytical leaves | SIMPLIFY | F-03: 22 agents, 84 KB, 0.7K tok listing | CRUD leaves are template clones | gate listing by `default_enabled` (leaves are default_enabled:false yet listed) | listing tokens; Jira task success unchanged |
| D10 | Agent consolidation: analyst REMOVE (hook writes cost-log), journal-writer→documenter, git-manager→shipper, explore→host `Explore`, PM→host task list/skill, brainstormer→researcher | MERGE/REMOVE/DELEGATE | F-08/09 | 6 agents with ≤1 mechanical caller | keep as skills | agent count 42→~28; always-listed tokens; task success on 10 canary tasks |
| D11 | Workflow Reflect + Status: drop automatic PM background delegation after Gate 2 and analyst spawn | SIMPLIFY | cook SKILL "Status Report", Phase 6 | prose artefacts nobody gates | opt-in | tokens/run |
| D12 | Check A1 status block with a `SubagentStop` hook (warn-only) or drop the protocol's "MUST" | IMPROVE | F-07 | rule unenforced | keep as convention | % subagent replies with valid block |
| D13 | Coexistence: `doctor`/SessionStart check listing `~/.claude/{agents,rules,CLAUDE.md}` name collisions and `plans` vs `tasks/plans`, print one line; add to `meowkit-core.md` a precedence sentence ("project hooks and gates win; ask on workflow conflict") | IMPROVE | F-19–21 | no detection, no tie-break | `/doctor prompt-audit` (host) | doctor reports collisions on lead's machine (expect 8 agent + 1 rule-name) |
| D14 | Fix stale refs (CLAUDE.md `.sh`, doc paths), de-duplicate CLAUDE.md vs `meowkit-core.md`, resolve `workflow.yaml` Gate 2 note, rename 4.5 "Verify (Browser)" | IMPROVE | F-15 | drift across 6 lifecycle sources (drift-check only greps tokens) | generate prose from `workflow.yaml` | `/doctor prompt-audit` clean; `validate` drift check passes |
| D15 | Path-scope or shrink `gate-rules.md` (7.6K, largest rule); rules headroom is 183 B | SIMPLIFY | F-18 | always-on text most of which matters only near gates | JIT-load on `tasks/**` edits via `paths:` | rules bytes; gate-compliance on gate scenarios |
| D16 | Keep: Gate 1/Gate 2 artefact+hook backing (receipt binding, pre-ship check), evaluator agent, fresh-context reviewer, `context: fork` leaf mechanism | KEEP | F-10, F-08 | real mechanisms (artefact + hook / host isolation) | — | NEVER-PRUNE policy; adversarial tests are D01's |
| D17 | Workflow effect claims for Simplify/Verify/Reflect/orchestrator/athena | NEEDS MORE EVIDENCE | F-12: 0/27 registry rows measured | | | see Experiments |

## 5. Experiments proposed (to falsify my own conclusions)

1. **E1 Gate prose vs hook on trivial edit:** in a fresh project with kit installed, ask model to fix a typo in `src/x.ts` using `/mk:fix --quick`, `/mk:cook --fast`, and plain prompt; record whether blocked and tokens/turns to completion. Falsifies F-14 if the model finds a compliant no-plan path.
2. **E2 Subagent write-lock:** spawn `athena` and `explore` with a prompt to create a file; falsifies F-04 if the host denies Write.
3. **E3 Tier/model reality:** spawn `developer` with a TRIVIAL task; read transcript model id; also spawn with `model: "haiku"` param. Confirms F-05 and validates `claude-opus-5` ID resolution.
4. **E4 Desktop vs CLI SessionStart stdin:** temporary logging handler (in a scratch project) printing raw stdin keys in both hosts; falsifies the INFERRED "desktop omits `model`".
5. **E5 Ablation (H3/H8):** 10–20 repo tasks (benchmark canary 01–05 exist but have 0 results) × {full cook, cook without Simplify, cook without orchestrator/agent-detector reads, host-native plan mode + review}; measure pass rate, defects at Gate 2, tokens, wall time, human interruptions. Falsifies D3/D8/D10 if full ceremony shows materially lower defects.
6. **E6 Context diet:** measure turn-1 token usage with (a) current kit (b) minus duplicate rule Read (c) minus agent listing leaves; check no safety-rule behaviour change using `rule-survival-oracle`.
7. **E7 Coexistence:** run a 3-file bug fix in the lead's environment with both toolkits; log which plan dir the planner agent writes to, which reviewer runs, commit message style; falsifies "model resolves conflicts acceptably".

## 6. Unresolved questions

1. Does the host actually resolve `model: claude-opus-5` (no minor) — UNKNOWN (E3).
2. Is `/verify` / `/simplify` a host built-in or user configuration in the lead's environment — UNKNOWN.
3. Does the desktop app send `model` on SessionStart (E4); why 49% of sessions are `unknown`.
4. Does `memory:` grant override an explicit `tools:` allowlist in the current host build (docs ambiguous; listing suggests yes) — E2.
5. Is the root `CLAUDE.md` intended to exist in the dev repo only (context-budget.ts says not shipped) — then `CLAUDE.md` statements like "7-phase workflow … prefer /mk:autobuild" are not seen by installed users; confirm the install file list.
6. Usage of the 22 Jira/Confluence leaves in practice (no telemetry).
7. Whether a user-global MeowKit install (`global.rs`) overwrites same-named user agents.
8. Where the "dead-weight thesis" primary source is — `<!-- research-citation -->` placeholders unresolved (D09/D11 may cover).
9. Prompt-injection observation: none found in files read. The user-global CLAUDE.md contains imperative "MANDATORY / OVERRIDE" language addressed to the model; treated as data, reported as a coexistence conflict only.

Working tree check: `git status --short` shows only `?? docs/research/meowkit-evolution-2611/` (this findings file and other agents' files). No edits to `.claude/`, `.meowkit/`, `tasks/`, `packages/`, `crates/`; all runs used a scratch copy.
