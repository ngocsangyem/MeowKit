# 20.5 Skill / Agent / Rule / Hook audit — component-level recommendations

Baseline: `main` @ `c7ff0a9e`. Compiled from D01, D02 (+CSV), D03, R1 (overrides D01–D05), R2, the evidence ledger, and the "implications" sections of D09/D10. Every group A/B item was re-checked by the compiler on a `git archive c7ff0a9e` copy (log in the Appendix). Evidence labels as in `BRIEF.md`; host facts taken from D09/D10 carry `DOC*` = DOCUMENTED-pending-citation-audit (R2's table already marks the ones noted as confirmed).

## 1. Summary

- The repo holds **no activation or outcome data** (R1 #13). So only *mechanical* findings justify action now; everything structural is an experiment; judgement is lowest weight.
- Three guards are real host-enforced blocks (`gate-enforcement`, `privacy-block`, `pre-ship`). Their gaps are narrow, concrete and fixable (Section 8 B). None should be removed.
- 4 of 21 handlers and several rule sentences claim an effect the source cannot deliver: PostToolUse/PreToolUse plain stdout is, per host docs, not shown to the model (`DOC*`, R2 confirms), so `budget-tracker`, `loop-detection`, `build-verify`, `pre-task-check` messages probably never act. One live probe decides (C-14).
- 21 of 42 agents declared no `Write`/`Edit` but get both from the `memory:` auto-grant (36 set `memory:`; R1 11b). That includes `athena`/`explore`, whose prompts say "read-only, structural". Fix is one frontmatter line, already shown to work on `confluence-spec-analyst` (C-10).
- Skills: 128 in repo, 127 shipped, all model-invocable. Of D02's 128 classifications only **9 are mechanical** (verified below); D02's "nine byte-duplicate preambles" are **not** byte-duplicates and its "vue-best-practices 8 dead links" are **false positives**. The rest is structural (35) or judgement (27) or has no data (53).
- Gates: two of nine phase transitions are mechanically backed. Documented Gate 1 exceptions have no implementation, and the contract gate fires for plans the docs scope out (R1 #5/#5b). Both are maintainer decisions (Section 8 D), not removals.
- Counts: A = 5 (C-01–C-05), B = 8 (C-06–C-13), C = 7 (C-14–C-20), D = 9 decisions (D-1–D-9).

## 2. Classification method and what is discounted

**Method.** The repo has no skill-activation log, no benchmark result (`.claude/benchmarks/results/` holds only `.gitkeep`) and no measured row in `docs/governance/dead-weight-audit-registry.md` (R1 #13, F-D02-16/20). Every row below therefore carries one of:

| Kind | Meaning | Weight |
| --- | --- | --- |
| **MECHANICAL** | unwired, unreachable, contradicted by its own docs/source, dead reference, claim of enforcement the source does not meet. Verified by command or file read. | safe to act on |
| **STRUCTURAL** | measured size, overlap or duplication, but no outcome data. Suggests an experiment, never a removal. | experiment first |
| **JUDGEMENT** | opinion (frontier-model redundancy, "merge similar skills", persona arguments). | lowest; A/B needed |

Decision vocabulary: KEEP, SIMPLIFY, REMOVE, DELEGATE TO HOST, IMPROVE, EXPERIMENT, NEEDS MORE EVIDENCE. REMOVE appears only on MECHANICAL grounds. Security controls are never recommended for removal on cost.

**Discounted (machine artefacts, not kit properties).** `.claude/settings.local.json` exporting `MEOWKIT_AUTOBUILD_MODE=LEAN` (untracked, globally ignored: L-14, R1 §6), so the contract gate is off *here*; the name-only skill listing (shared budget with 45 user-global skills + Vercel/gsap/anthropic plugins; R1 #14); absent `mewkit` on PATH and absent `node_modules`; local `.meowkit/telemetry/*` (gitignored, one developer: trace-log event types, `skill-usage` absence, `cost-log` model split); `.claude/agent-memory/` contents.

**Documented design limits (restated, not findings).** Approval receipt and Gate 2 verdict are "agent-writable by design … anti-accidental, not unforgeable" (`approval-receipt.cjs:3-6`; `gate-rules.md`); `post-write.cjs` header says it runs after the write; `privacy.cjs` says shell reads are out of scope; Gate 2 / `pre-ship` is `not-ported` to Codex and Cursor (`hook-coverage.json` `safety.pre-ship`, VERIFIED); provider tool names in skill bodies are a WARN baseline in `validate/generic_tokens.rs`; registry rows say "Not yet measured". What is new beyond these is called out in Section 8.

**Corrections to auditor claims found while compiling** (each re-verified, see Appendix):

| Auditor claim | Finding | Label |
| --- | --- | --- |
| D02: nine preambles are "near-identical copies", listed as byte-duplicates in the brief | 9 different md5; 14 lines common to all 9; overlap 28–100%. Each SKILL.md invokes its own and its helpers (`workflow-config`, `workflow-repo-mode`, `workflow-review-log`) exist. STRUCTURAL, not mechanical | VERIFIED |
| D02: `vue-best-practices` 8 dead links, `prompt-enhancer` 1 | All point at `mk:vue …/references/*.md` or `mk:context-engineering` `references/pattern-index.md`, which exist | REFUTED |
| D02: "repo runs no skill-link validator" | CI runs `scripts/check-skill-cross-refs.sh` (`ci.yml:150`); it passes (rc 0) while 4 absolute-path dead refs exist. It does not check `.claude/skills/<x>/…` path form | CONTRADICTED / new |
| D02: `skill-contract-coverage` gap (fix, help absent) | CI runs `fix` and `help` contract tests directly (`ci.yml:56,83`); no gap. At least 16 skills have a CI-run test, not 8 | VERIFIED |
| D01 D7: delete `meowkit-core.md` as redundant with CLAUDE.md | `meowkit-core.md` is in `base.files` (ships); root `CLAUDE.md` is not (`docs/core/memory-system.md:162`). The redundancy is a maintainer-checkout cost only | VERIFIED |
| D01: Rule 11 has a "static check in Rust CLI structure.rs" | No Rule-of-Two check in `crates/`, `scripts/`, `tests/`, `.github/` (grep); only the optional `injection_risk` enum and a `skill-creator` checklist line | CONTRADICTED |
| D01: `precompact-probe` is telemetry | It re-arms the safety-sentinel cache (`precompact-probe.cjs:1-18`); part of the sentinel mechanism | VERIFIED |
| D01: memory-lint SKIP is "silent" | It prints an explicit `SKIP:` line by design (`memory-store-lint.cjs:14,74`); CI runs `validate --memory` (`ci.yml:92`) | WEAKENED |
| D10: delegate `verify` to host `/verify` | R2: host `/verify` runs the app and observes; it is not build+lint+test+coverage | CONTRADICTED |
| D03 "21 agents set `memory:`" | 36 set it; 21 of those have no Write/Edit | R1 11b |
| D02 jira/confluence "17+6 leaves" | 17 jira dirs = hub + 16 leaves; 6 confluence dirs = hub + 5 leaves; 22 executor agents incl. `story-sizer` | VERIFIED |

## 3. Hooks

Visibility key: **block** = exit 2 stops the tool (host-enforced); **visible** = stdout reaches the model (UserPromptSubmit, SessionStart, PreCompact; `DOC*`, R2 C); **invisible** = plain stdout on PostToolUse/PreToolUse, not delivered unless exit 2 stderr or `additionalContext` JSON (`DOC*`, R2 C; not live-tested, R1 open item 1); **state** = writes files only. The dispatcher is fail-open by design (`dispatch.cjs:112-114`), and `handlers.json` states the write guards must never run through it.

### 3.1 Registered entry points (13 registrations in `settings.json`; 6 scripts)

| Hook | Event / matcher | Effect | R1 verdict | Class | Verdict | Basis | Reason |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `gate-enforcement.cjs` | PreToolUse `Edit\|Write` | block | 1a, 1b (partly refuted), 2 CONFIRMED | MECHANICAL gaps; control STRUCTURAL | KEEP + IMPROVE | V: rc=2 no plan; rc=0 for `pkg/docs/run.sh`, `src/tests/x.ts`, `.claude/settings.json`, symlink `docs/lnk/new.ts`; `/tmp/*`, `~/.zshrc` pass with an approved plan | only guard that survived every lib fault (R1 §6); fail-open on entry-script corruption, missing `node`, timeout (R1 1b/1c) |
| `privacy-block.cjs` | PreToolUse `Edit\|Write`, `Read`, `Bash` | block (Read/Edit/Write only) | #6 CONFIRMED | MECHANICAL gaps | IMPROVE; DELEGATE-TO-HOST is an experiment | V: rc=2 `.env`, `.env.example`, `src/secretary.ts`; rc=0 `.envrc .npmrc .netrc .kube/config id_rsa`; Bash `cat .env` rc=0 | no Grep matcher; false positives on shipped `.env.example` |
| `pre-ship.cjs` | PreToolUse `Bash` | block | #4 CONFIRMED | MECHANICAL gap | KEEP + IMPROVE | V: `SHIP_COMMAND = /git commit\|git push\|git merge/` (`lib/core/pre-ship.cjs:18`) misses `git  commit`, `git -C . commit`, `git ci`, `gh pr create/merge`, matches `echo git commit` | executed test/lint run is the strongest mechanical check (D01); 30 s timeout is non-blocking (`DOC*`) |
| `dispatch.cjs` ×8 | SessionStart, PreToolUse Bash, PostToolUse ×2, Stop, UserPromptSubmit, PreCompact, PostToolUseFailure | per handler | R1 §6: do not route guards through it | STRUCTURAL | KEEP | V: handler exceptions caught, exit 0 | correct for observers |
| `SubagentStart` / `SubagentStop` | registered, `[]` | none | L-03 | MECHANICAL | REMOVE the two empty keys, or implement the status-block check | V: `settings.json`; `handlers.json` has no entry | empty registration is harmless but misleading; A1 status block is requested, not checked (F-D03-07) |

### 3.2 Dispatcher handlers (21, `handlers.json`)

| Handler | Event (matcher) | Effect | R1 | Class | Verdict | Basis / reason |
| --- | --- | --- | --- | --- | --- | --- |
| `pre-task-check` | PreToolUse Bash | invisible; prints "BLOCK … STOPPED", exit 0 | n/a | MECHANICAL (message contradicts behaviour; its header says ADVISORY) | NEEDS MORE EVIDENCE: fix visibility (C-14) then measure | D01 ran it: call proceeds; scans the agent's own command, not tool output |
| `build-verify` | PostToolUse Edit\|Write | invisible (returns a plain string) | extends #8 by the same mechanism (compiler INFERENCE) | STRUCTURAL | NEEDS MORE EVIDENCE (C-14) | runs `tsc`/lint ≈0.8–2 s per edit (D01); if invisible, the cost buys nothing |
| `loop-detection` | PostToolUse Edit\|Write | invisible | #8 CONFIRMED | MECHANICAL | IMPROVE visibility or EXPERIMENT | warn text exits 0 |
| `budget-tracker` | PostToolUse Edit\|Write + Bash | invisible; `@@BUDGET_BLOCK@@` exit 0 | #8 CONFIRMED | MECHANICAL | IMPROVE (C-13, C-14) | `config.yaml:19-26` documents tokens/percent; code reads USD (`budget-tracker.cjs:56-81`); "block" cannot block |
| `post-write` | PostToolUse Edit\|Write | block via exit 2 stderr, after bytes written | #7 CONFIRMED | MECHANICAL gaps | IMPROVE (C-09) | V: `apiKey = "…"` rc 0, `.tsx`/`.py` skipped, `DISABLE ROW LEVEL SECURITY` PASS |
| `auto-checkpoint` | PostToolUse Edit\|Write | state | — | STRUCTURAL | NEEDS MORE EVIDENCE | consumer is `task_store` (crates); not traced further |
| `learning-observer` | PostToolUse Edit\|Write | state (edit ledger; trace source) | — | STRUCTURAL | KEEP | feeds `mewkit trace`; D01: file read per edit, no rotation (H) |
| `review-evidence-tag` | PostToolUse Bash | state | — | STRUCTURAL | KEEP | corroborates `mewkit review coverage` (header) |
| `model-detector` | SessionStart | visible text | #10 CONFIRMED | MECHANICAL (inconsistent) | IMPROVE (C-12) | LEAN only for ids containing 4-6; `density-select.sh` LEAN for 4-7; matrix doc says "4-7+" |
| `orientation-ritual` | SessionStart | visible | — | STRUCTURAL | NEEDS MORE EVIDENCE | header: fresh-startup path disabled until release gate |
| `project-context-loader` | SessionStart | visible + counter reset | — | STRUCTURAL | KEEP | `docs/project-context.md` absent here, by design downstream |
| `jira-env-loader` | SessionStart | visible | — | STRUCTURAL | KEEP | only handler that reads project dotenv (header) |
| `capability-bootstrap` | SessionStart | visible constant | — | STRUCTURAL | KEEP | no subprocess |
| `safety-sentinel-inject` | UserPromptSubmit | visible, ≈40 tokens/prompt | #12 | STRUCTURAL | EXPERIMENT as a set with next two rows (C-15) | marker is written unconditionally `{"safety":true,"phase_zero":true}` (`post-session.cjs:123-132`) |
| `tdd-flag-detector` | UserPromptSubmit | state | — | STRUCTURAL | KEEP | mechanical flag detection, no reliance on model memory |
| `precompact-probe` | PreCompact | state (re-arms sentinel) | — | STRUCTURAL | EXPERIMENT with sentinel set | D01 mislabelled as telemetry |
| `checkpoint-writer` | Stop | state | — | STRUCTURAL | NEEDS MORE EVIDENCE | consumer not traced |
| `post-session` | Stop | state (cost, trace, sentinel) | — | STRUCTURAL | KEEP; sentinel write follows C-15 | local model split 115/112 known vs `unknown` is a machine datum |
| `control-probe`, `posttoolfailure-probe` | Stop, PostToolUseFailure | state | — | STRUCTURAL | NEEDS MORE EVIDENCE | consumer `scripts/telemetry-decisions.py`; `posttoolfailure-probe.cjs:10-12` says "replace with a structured logger once confirmed" |
| `pre-completion-check` | Stop | block decision only if `verification-required.json` exists | D01 F-11 #7 | MECHANICAL (no producer) | decision D-6 | V: only the handler and test/corpus fixtures mention the file; no skill, script or crate writes it |

### 3.3 Unregistered scripts

| Script | State | Class | Verdict | Reason |
| --- | --- | --- | --- | --- |
| `pre-implement.cjs` | not registered by design: "invoked with arguments by the agent … must not be [dispatched]" (header); exit 1 when strict mode and no failing test | MECHANICAL wording gap | KEEP; fix rule wording (C-01) | `development-rules.md:25` says it "enforces"; `developer.md:29` makes invocation the developer agent's job, so it is prose-triggered |
| `append-trace.cjs` | CLI used by `loop-detection`, benchmark and trace-analyze | STRUCTURAL | KEEP | — |
| `lib/injection-audit.cjs` | manual; callers are skill scripts (`web-to-markdown`, `story-sizer`), none automatic | MECHANICAL for Rule 10 LOG step | KEEP; Rule 10 LOG stays human/agent-run | V: grep of `settings.json`, `handlers.json`, `hooks/*.cjs` |

### 3.4 Host-native alternative for each write guard

All `DOC*`; R2 confirms the exit/onFailure/deny/sandbox mechanics.

| Guard | Strongest host-native alternative | Would delegation lose anything? |
| --- | --- | --- |
| Gate 1 plan gate | static `permissions.deny` / sandbox path denies for *fixed* paths; plan mode (`/plan`) blocks edits until approval but is instruction-level when bypass is available | **Yes.** "An approved plan exists and its body hash is unchanged" is dynamic; a static rule cannot express it. Plan mode has no hash receipt (F-D10-02/11). Delegate only the static part (protect `.claude/settings*.json`, `.claude/hooks/**`) |
| Privacy (Read/Edit/Write) | `permissions.deny` `Read(./.env*)` plus sandbox `filesystem.denyRead`; both layers needed because sandbox does not cover the Read tool (F-D10-03; R2 C) | Loses the Bash fetch-tool SSRF check and the custom refusal text; gains Bash/Grep-adjacent coverage. Needs a coverage comparison first (C-19) |
| `pre-ship` Gate 2 | server-side branch protection / CI (not host); host `ask` rule on `Bash(git push*)` as friction | Loses revision-bound verdict check and the executed test run at commit time. Branch protection is stronger but later |
| Fail-closed wrapper | `onFailure:"block"` on the three registrations (needs host ≥ 2.1.295; not for Stop/SubagentStop) | Nothing lost; closes R1 1b/1c |

## 4. Rules (7 files + maintainer `CLAUDE.md`)

Always-on: `.claude/rules/*` = **25,420 B** vs the project ceiling 25,600 B (`check-always-on-budget.cjs:25`), headroom 180 B (0.7%). The checker was not runnable here (js-yaml missing, R1); figure from `wc -c`. Maintainer checkout adds `CLAUDE.md` 8,961 B, which does not ship.

| File | Bytes | Duplicated passages | Internal contradiction / unmet claim | Stale path | Class | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| `gate-rules.md` | 7,642 (30% of budget) | — | "three exceptions (exhaustive)" has no implementation (R1 #5, V: rc=2 for `src/new.ts` with no plan); "No automation may bypass" fine; contract-gate scope vs `harness-rules.md:24-30` (R1 #5b, V) | none | MECHANICAL | KEEP; decisions D-2, D-3 |
| `meowkit-core.md` | 2,749 | Compaction block identical to `CLAUDE.md` (629 B, diff empty); Workflow/Gates/Security/Memory paraphrase | broken fragment ``Always preserve verbatim` block.`` (`:39`) | none | MECHANICAL (fragment), STRUCTURAL (dup) | KEEP (ships); fix fragment (C-01) |
| `injection-rules.md` | 4,528 | — | R6 "BLOCK writes outside the project root": V rc=0 for `/tmp/*`, `~/.zshrc` once a plan is approved; R10 LOG manual; R11 no mechanical check; R3 lint skips if no CLI (explicit SKIP) | none | MECHANICAL | KEEP; decision D-1 |
| `security-rules.md` | 1,951 | — | "BLOCK — do not write the pattern": detection is post-write (`post-write.cjs` header) and narrower than the table (R1 #7) | none | MECHANICAL | KEEP; B-09 |
| `development-rules.md` | 3,773 | — | `:25` "`pre-implement.cjs` enforces failing-test-first" (agent-invoked, exit 1) | refs `docs/project-context.md` etc. are a *downstream* convention ("or its own documented layout"), absent in this repo | MECHANICAL | KEEP; reword (C-01) |
| `core-behaviors.md` | 2,222 | — | — | none | JUDGEMENT | KEEP |
| `agent-conduct.md` | 2,555 | — | A1 status block "MUST" is requested, not checked (F-D03-07) | none | STRUCTURAL | KEEP; optional `SubagentStop` check |
| `CLAUDE.md` (maintainer) | 8,961 | Compaction block (629 B); Gate/Workflow lines restate `meowkit-core.md` | Gate 1 line understates the receipt requirement; `:121` broken fragment | `:23` `gate-enforcement.sh` (real file `.cjs`); `:98` `docs/system-architecture.md` (real `docs/architecture/system-architecture.md`) | MECHANICAL | fix (C-01) |

**Wording question — "NON-NEGOTIABLE / cannot be bypassed" on prose-only rules** (`injection-rules.md:1,72`, `security-rules.md:1,32`, `CLAUDE.md:33`, `gate-rules.md:1`). Maintainer decision, not a defect (D-1): the wording is deliberate and the rules' *intent* is binding on the model. Evidence against: R1 §4 and Section 3 show only three controls are host-enforced and each has a documented limit. Options and trade-off in Section 8 D.

Always-on cost context (ESTIMATES, chars/4; F-D03-17): rules 6.4K tokens, skill listing 6.0K, agent listing 2.4K, SessionStart ≈0.8K, `CLAUDE.md` 2.2K (checkout only). R1 #12: the turn-1 7-rule re-read in `agent-detector/SKILL.md:40-66` is real but exists as a positive existence check and is sentinel-suppressed after turn 1, so "duplicate of auto-load" is not proof it is removable (sub-agent and Codex/Cursor loading untested).

## 5. Agents (42 definitions; `AGENTS_INDEX.md`/`SKILLS_INDEX.md` are not agents)

Pins (V, frontmatter): 12 `claude-opus-5`, 2 `fable`, 13 `sonnet`, 15 `haiku`. `memory: project` on 36; 21 of those declare no `Write`/`Edit` (list: athena, brainstormer, explore, orchestrator, 4 confluence, 13 jira CRUD leaves). Host: `memory:` auto-enables Read/Write/Edit (`DOC`, R2 C); this session's agent roster shows `explore`, `athena`, `orchestrator`, `brainstormer` and all 13 jira leaves with `Write, Edit`, while `confluence-spec-analyst`, which sets `disallowedTools: Edit`, shows no `Edit` (VERIFIED live). Only 6 agents have no `memory:` (developer, git-manager, project-manager, security, shipper, ui-ux-designer); `shipper` and `git-manager` have no `Write`/`Edit` at all.

| Group / agent | Who invokes (V grep, F-D03-02) | Pin / tools | Overlap partner | Class | Verdict | Basis |
| --- | --- | --- | --- | --- | --- | --- |
| **Lifecycle** planner | `cook`/`plan-creator` prose (~21 spawn refs) | opus-5; Read/Grep/Glob/Bash + Edit/Write | architect | STRUCTURAL | KEEP | Gate 1 owner; fresh context is a host mechanism |
| developer, tester | `cook`/`fix`/`autobuild` prose (41 / 20) | opus-5 / sonnet; identical grants | each other | STRUCTURAL | KEEP; EXPERIMENT whether separate tester beats developer-writes-tests (non-TDD) | independent authorship matters only under `--tdd` (I) |
| reviewer, evaluator | `mk:review`, `mk:evaluate` (28 / 29) | opus-5 | security; reviewer vs developer same model family | STRUCTURAL | KEEP both | evaluator observes runtime (different evidence); reviewer owns Gate 2 artefact |
| shipper | `mk:ship` | haiku; Bash-only | git-manager | STRUCTURAL | KEEP | — |
| documenter | Phase 6 | haiku | journal-writer, PM, analyst | STRUCTURAL | KEEP | — |
| researcher, ui-ux-designer | cook (24 / 9) | sonnet / opus-5 | brainstormer / — | STRUCTURAL | KEEP | — |
| security | risk-flag prose | opus-5; Write | reviewer dimension, `mk:cso`, host `/security-review` | STRUCTURAL | KEEP; merge = JUDGEMENT | needs A/B (below) |
| architect, brainstormer | few refs (13 / 2) | opus-5 | planner / researcher | JUDGEMENT | EXPERIMENT | tool/prompt differences only (D03 F-08) |
| analyst | Stop/Phase 6 prose | sonnet | `post-session.cjs` writes cost-log; `mewkit budget` | STRUCTURAL | NEEDS MORE EVIDENCE | what pattern extraction adds is unmeasured |
| project-manager | post-phase delegation (14) | haiku; Write | host task list; `mk:help` | JUDGEMENT | EXPERIMENT | output is prose files nobody gates |
| explore | cook/review prose (15) | haiku; read-only intent | host built-in `Explore` (read-only, all tools except Edit/Write per this session's roster) | JUDGEMENT | DELEGATE TO HOST candidate; B-10 first | MeowKit adds a `path:line` output contract |
| **Advisory** advisor, athena | `mk:advise` only; `--advice` only | fable | each other | STRUCTURAL | KEEP as opt-in; EXPERIMENT value | registry "Not yet measured, WATCH"; athena prompt claim contradicted by `memory:` grant (`athena.md:210`) |
| journal-writer, git-manager | 1 caller each; shipper invokes git-manager internally | sonnet / haiku | documenter / shipper | JUDGEMENT | EXPERIMENT | merge only after A/B |
| **Unreferenced** orchestrator | no `subagent_type` spawn anywhere (V: 0 refs); rules use "orchestrator" for the *role* of the main session | sonnet; `Task`, AskUserQuestion | agent-detector, scale-routing, cook Phase 0 | STRUCTURAL | EXPERIMENT (do not remove on absence of invocations; user can route to it directly) | R1 §5 |
| **Executor leaves** 16 jira CRUD + 4 confluence CRUD | bound by `context: fork` + `agent:` in 22 of 22 leaf skills (V on main) | haiku/sonnet; Bash,Read,Grep,Glob | their hub skill | STRUCTURAL | KEEP; EXPERIMENT hub-vs-leaf (C-17) | real isolation + per-leaf model/tool pin; ≈84 KB near-template prose (D03) |
| jira-analyst/estimator/evaluator, confluence-spec-analyst, story-sizer | same binding | opus-5 (haiku for story-sizer); Write | intake, planning-engine | STRUCTURAL | KEEP; NEEDS MORE EVIDENCE of use | distinct procedures (D03) |

**Model pins.** Tier is printed text, not mechanism (`model-selection-rules.md:21` "Feature implementation → Sonnet (default)" vs `developer.md:5` pins `claude-opus-5`; V). The host honours `model` per invocation, then frontmatter (R2 C). Whether the literal `claude-opus-5` resolves is UNKNOWN (D03). Decision D-5.

**Merge claims need an A/B, not literature.** Pairs: reviewer+security, planner+architect, researcher+brainstormer, documenter+journal-writer, shipper+git-manager, explore vs built-in `Explore`. Design: ≥15 fixed tasks per pair with seeded defects or known answers; split vs merged agent, same model and reasoning effort, 3 repeats; metrics seeded-issue catch rate, false-positive findings, answer correctness with `path:line` precision, tokens, wall time. Until then the merges are JUDGEMENT.

## 6. Skills (128 in repo, 127 shipped; benchmark is maintainer-only, `README.md:138`)

### (a) D02 classifications re-graded

| D02 class (n) | MECHANICAL | STRUCTURAL | JUDGEMENT | No data / refuted |
| --- | --- | --- | --- | --- |
| KEEP (61) | — | 6 (careful, context-audit, evaluate, fix, freeze, memory: deterministic scripts or non-default behaviour) | 1 (simplify) | 54 default KEEP, body unread (53 after moving web-to-markdown) |
| EXPERIMENT (36) | — | 19 (jira/confluence hub-leaf 18, review) | 17 (framework/practice skills, elicit, grill, …) | — |
| SIMPLIFY (15) | — | 10 (agent-detector, cook, plan-creator, workflow-orchestrator, 6 preamble carriers) | 4 (context-engineering, development, testing, verify) | 1 trace-analyze (depends on this machine's trace log) |
| IMPROVE (10) | 7 (jira-admin, jira-search, plan-ceo-review, ship, jira-lifecycle, autobuild, chrome-profile) | — | — | 2 refuted (vue-best-practices, prompt-enhancer); 1 multimodal HYPOTHESIS |
| MERGE (5) | — | — | 5 (build-fix, clean-code, lint-and-validate, review-pr, story-sizer) | — |
| REMOVE (1) | 1 (lazy-agent-loader) | — | — | — |
| **Total (128)** | **9** (incl. web-to-markdown from KEEP) | **35** | **27** | **53 + 2 + 2** |

Only 9 skills have a verified mechanical issue. "MERGE" rows are overlap in intent with mutual `NOT for` lines, not duplication: `review-pr` also posts via `gh`; `build-fix` has a contract test whose pins must be ported.

### (b) Complete MECHANICAL list (each verified on main; command in Appendix)

| # | Item | Evidence |
| --- | --- | --- |
| 1 | `mk:lazy-agent-loader`: `status: deprecated`, `when_to_use: Never invoke`, 28 lines, no index. Not unreferenced: `context-audit` SKILL.md:118 and `format-audit-report.sh:110,113,140` tell users to "see mk:lazy-agent-loader" — a pointer to an empty shim. Also in 3 golden manifests, 2 bundle catalogs, `SKILLS_INDEX.md`, `docs/core/meowkit-architecture.md` | V |
| 2 | Dead path references, 4 lines in 4 skills: `ship/references/version-changelog-todos.md:60,83` and `test-execution.md:99`, `plan-ceo-review/references/required-outputs.md:47` → `.claude/skills/review/TODOS-format.md` (absent); `jira-admin/references/voodoo-constants.md:28,31` → `jira-fields/scripts/{list_fields,get_field}.py` (no such directory or file anywhere); `jira-search/references/jql-patterns.md:49` → `references/field-discovery.md` (lives in `jira-fields/references/`); `web-to-markdown/SKILL.md:31` → `lib/system-deps-registry.ts` (TS CLI retired; Rust equivalent `crates/mewkit-core/src/system_deps/`) | V |
| 3 | 12 tracked `*.md.tmp` files (4 in `jira-lifecycle/references/patterns/` ×3 trees), each a truncated prefix of its `.md` sibling; present in golden manifests | V |
| 4 | Stale provenance text "migrated from mk:shipping / mk:documentation" (`ship/SKILL.md:177-179`, `document-release/SKILL.md:91`); the referenced files exist, the skills named do not | V (cosmetic) |
| 5 | `autobuild`: `density-select.sh` and `model-detector.cjs` disagree for opus-4-7; matrix doc says "4-7+ → LEAN" (R1 #10; D03 F-06) | V (R1, re-read) |
| 6 | `chrome-profile`: meets all three Rule 11 legs (below) with no confirmation, contradicting `injection-rules.md` Rule 11 | V |
| 7 | CI link checker passes with item 2 present (`check-skill-cross-refs.sh` rc 0) | V (run) |

Not mechanical, despite appearing in lists: nine preamble copies (STRUCTURAL: 60,235 B, used, distinct), clean-code/simplify and lint-and-validate/verify "duplicates" (JUDGEMENT), vue/prompt-enhancer dead links (refuted).

### (c) Overlap clusters (D02 table; members and what distinguishes them)

| Cluster | Members | Distinguisher | Class |
| --- | --- | --- | --- |
| Implement | cook, autobuild, bootstrap, development | single task with gates / unattended green-field loop / empty-repo scaffold / index skill | STRUCTURAL (development is an index, JUDGEMENT) |
| Fix | fix, build-fix, investigate, problem-solving | land the fix / compile errors / diagnose only / unstick | JUDGEMENT |
| Review/verify | review, review-pr, evaluate, qa, qa-manual, verify, lint-and-validate, respond-pr, rubric | static diff / posts someone else's PR / runs the build / black-box web / spec / build+lint+test / lint-only / replies / rubric | JUDGEMENT; evaluate scripts are NEVER-PRUNE |
| Plan | plan-creator, planning-engine, validate-plan, plan-ceo-review, breakdown, sprint-contract, intake | write / score tickets / check 8 dimensions / challenge ambition / split epics / negotiate AC / classify tickets; ticket scoring is the real overlap (intake, planning-engine, jira-evaluator, jira-estimator, story-sizer) | STRUCTURAL |
| Think | brainstorming, office-hours, party, advise, elicit, grill, decision-framework, nyquist | options / worth building / multi-agent trade-off / one verdict / lenses / interview / ops frameworks / AC-to-test | JUDGEMENT |
| Route | agent-detector, scale-routing, orchestrate, workflow-orchestrator, delegate, team-config, task-queue | agent+tier / complexity / external CLIs / workflow.yaml adapter / prompts / teams | STRUCTURAL (detector vs scale-routing both emit a tier) |
| Context | context-audit, context-engineering, session-continuation, memory | static overhead / runtime moves / handoff / two files | JUDGEMENT |
| Atlassian | 2 hubs + 21 leaves | per API area | STRUCTURAL |

### (d) Discoverability, stated per R1 #14

"MeowKit's listing overflows" is machine- and window-dependent: MeowKit listing ≈ 24,952 chars (R1; D02 24,314–27k); host budget is 1% of the context window, shared with every installed toolkit, least-invoked descriptions dropped first (`DOC`, R2 C). At a 200k window MeowKit alone would overflow, at 1M it fits alone and co-installs tip it. **Kit properties**: (i) all 128 are model-invocable (`disable-model-invocation` on 0; `user-invocable: false` on 9); (ii) 23 Atlassian entries (2 hubs + 21 leaves, ≈4.1k listing chars, ~15% of MeowKit's listing) compete with their hubs for budget; (iii) `NOT for` disambiguation is present on 125/128 but only helps while the description is visible. **Existing mitigation not in the audits**: install profiles `core/developer/product/atlassian/security/research/full`; `full` is the default (`.meowkit/pack-manifest.json`; `crates/mewkit-cli/src/commands/init/choose.rs:101-103`), so a narrower profile already drops the Atlassian pack. `skillOverrides`/`skillListingBudgetFraction` are `DOC*` tunables, unset in `settings.json`.

### (e) Rule-of-Two hit: `chrome-profile`

| Leg | Evidence |
| --- | --- |
| Untrusted input | drives arbitrary pages through `agent-browser` (`SKILL.md:135 agent-browser connect`) |
| Sensitive data | `SKILL.md:33` "All cookies, extensions, and saved sessions of the selected profile are available" |
| State change | page actions in the live profile; `allowed-tools: Bash, Read` |
| Mitigations present | `AGENT_BROWSER_CONTENT_BOUNDARIES=1` hint (`:35-36`), fail-closed on ambiguous profile (`:38`) |
| Absent | no confirmation step (`grep AskUserQuestion` empty), no `trust_level`/`injection_risk` (24 of 128 declare them). `default_enabled: false` is documentary, not a host mechanism (`skill-authoring-rules.md:128`) |

Rule 11 enforcement is design-time only (checklist line `skill-creator/references/creation-workflow.md:64`). Jira/Confluence/multimodal exposure is HYPOTHESIS (not read to the end).

### (f) Test coverage

VERIFIED from `.github/workflows/ci.yml`: at least 16 skills have a CI-executed test: fix, help (`:56,83`), investigate, build-fix, document-release, validate-plan, workflow-orchestrator, resolving-merge-conflicts (aggregator `:142`), story-sizer (`:134`), worktree, sequential-thinking, cook, docs-finder, intake, prompt-enhancer, rubric. More skill directories contain test-like files (multimodal, web-to-markdown, ship, tech-graph, …) whose CI execution is UNKNOWN. D02's 87 skills with no mention remains its figure (not recomputed). Contract tests pin SKILL.md text, not behaviour. CI also runs `check-skills-portable.cjs`, `check-dangling-rule-refs.cjs`, `check-rule-survival.cjs`, `validate --gates` (`ci.yml:155,207,204,167`).

## 7. Workflow and gates as components

Gates are authority controls: **options only, no removals.** Costs are upper-bound bytes a model is *told* to read (D03 F-D03-11, INFERRED; sizes re-measured: `plan-creator/SKILL.md` 26,709 B, `cook/SKILL.md` 19,781 B, `workflow-steps.md` 28,047 B).

| Phase | Backing | Cost to run | Known contradiction | Class | Verdict / basis |
| --- | --- | --- | --- | --- | --- |
| 0 Orient | prose + SessionStart hooks | ≈101 KB (≈25K tok) Phase-0 reads + 25.4 KB rule re-read on turn 1 | SessionStart "Model: not detected" here (L-10); tier→model is text (D-5) | STRUCTURAL | EXPERIMENT (C-15) |
| 1 Plan / **Gate 1** | hook (`gate-enforcement`) + artefact (`plan.md`, receipt) | plan-creator full ≈121 KB (≈30K tok), fast ≈29 KB; 1 human stop + stamp | 3 documented exceptions unimplemented (R1 #5); contract gate fires on any date-named plan (V: stamped plan, no contracts, env unset → `@@CONTRACT_GATE_BLOCK@@`; LEAN → rc 0); path gaps | MECHANICAL | KEEP; B-11; D-2, D-3, D-4 |
| 2 Test | prose; `--tdd` flag by hook; `pre-implement.cjs` agent-invoked | ≈8 KB | `development-rules.md:25` "enforces" | MECHANICAL wording | KEEP; C-01 |
| 3 Build | prose + Gate 1 + PostToolUse observers | ≈30 KB | observers probably invisible (C-14) | STRUCTURAL | KEEP |
| 3.5 Simplify | **prose only** (grep: no hook references it) | ≈13.6 KB + developer respawn; 1 human stop | "mandatory" with no enforcement; host `/simplify` exists (`DOC*`) | JUDGEMENT | EXPERIMENT (C-19) |
| 3.6 Verify | prose + build-verify cache | ≈8.4 KB | host `/verify` is *not* an equivalent (R2) | STRUCTURAL | KEEP |
| 4 Review / **Gate 2** | hook (`pre-ship` at commit/push/merge) + artefact (verdict bound to HEAD) | ≈58 KB + review refs ≈63 KB; 1 human stop | `workflow.yaml:102-105` still says Gate 2 is behavioral, hook "deferred" (V stale); trigger regex (B-07); not ported to Codex/Cursor (documented) | MECHANICAL | KEEP; B-06, B-07; C-01 |
| 5 Ship | prose + `pre-ship` | ≈18 KB (+101 KB refs not counted) | memory lint SKIPs without CLI (explicit; CI compensates) | STRUCTURAL | KEEP |
| 6 Reflect | prose + Stop observers | ≈35 KB | analyst/PM/journal spawns have no gate and no measurement | JUDGEMENT | EXPERIMENT (C-19) |

Full interactive `cook`: ≈333 KB (≈83K tok) of workflow text before Gate 2 and 5–6 human stops (D03, INFERRED). No registry row carries a measured delta (0/27); gates are NEVER-PRUNE by policy, which is a legitimate safety rationale and not a benchmark claim.

## 8. Recommendations

Groups A and B contain only items that are R1-CONFIRMED or purely mechanical and re-verified by the compiler; the "R1" cell says which. Standard Measurement unless stated: re-run the cited command, expect the changed result; `mewkit validate` and the named CI steps stay green. Standard Revert: revert the single commit.

### A. Mechanical clean-ups, safe now

**C-01 Fix stale and overstated rule text**
| Field | Content |
| --- | --- |
| Observed problem | `CLAUDE.md:23` names `gate-enforcement.sh`; `CLAUDE.md:98` names `docs/system-architecture.md`; ``Always preserve verbatim` block.`` fragment at `CLAUDE.md:121` and `meowkit-core.md:39`; `development-rules.md:25` says `pre-implement.cjs` "enforces" |
| Affected source | those lines @ `c7ff0a9e` |
| Causal hypothesis | text edited without a drift check on prose paths; `pre-implement.cjs` is agent-invoked by design (`developer.md:29`) |
| Proposed change | `.sh`→`.cjs`; path → `docs/architecture/system-architecture.md`; drop the fragment; reword `:25` to "the developer agent runs `pre-implement.cjs` before the first source edit". Rules shrink slightly (headroom grows) |
| Evidence | VERIFIED: file reads, `ls`; R1 not reviewed |
| Alternatives | do nothing (rules keep over-claiming); delete `meowkit-core.md` (rejected: it ships) |
| Expected benefit | removes three false statements and ≈35 B from always-on rules |
| Measurement | `check-always-on-budget.cjs` ≤ 25,600; `check-rule-survival.cjs` and `check-dangling-rule-refs.cjs` green |
| Risks | rule-survival oracle pins some phrases; none of the edited ones are gate text |
| Revert | standard |

**C-02 Correct two stale statements about hooks**
| Field | Content |
| --- | --- |
| Observed problem | `workflow-orchestrator/workflow.yaml:102-105` says Gate 2 is "behavioral … hook enforcement is deferred"; `HOOKS_INDEX.md:48-49` says "nothing is switchable yet" while `handlers.json` + `config.yaml:46` implement toggles |
| Affected source | those two files @ `c7ff0a9e` |
| Causal hypothesis | docs not updated when `pre-ship`→`gate2-check` and toggles landed |
| Proposed change | rewrite both statements; keep the `enforced_by` field semantics the drift validator requires; optionally drop the two empty `SubagentStart`/`SubagentStop` keys in `settings.json` (harmless, misleading) or implement a warn-only A1 status-block check |
| Evidence | VERIFIED (D03 C6; compiler re-read) |
| Alternatives | do nothing; generate prose from `workflow.yaml` (larger) |
| Expected benefit | removes a contradiction a reviewer would otherwise carry into Gate 2 |
| Measurement | `mewkit validate --workflow` and `--gates` green |
| Risks | `workflow_drift.rs` may pin the `behavioral` token; run validate before committing |
| Revert | standard |

**C-03 Repair dead path references and teach the checker**
| Field | Content |
| --- | --- |
| Observed problem | 4 absolute-path dead references in 4 skills (Section 6b #2); CI `check-skill-cross-refs.sh` exits 0 anyway |
| Affected source | files listed in 6b #2; `scripts/check-skill-cross-refs.sh` |
| Causal hypothesis | checker resolves `mk:*` and relative `references/` paths, not `.claude/skills/<x>/…` |
| Proposed change | point `ship` and `plan-ceo-review` at an existing format source or inline it; replace the two nonexistent jira script paths with the real commands; `jql-patterns.md:49` → `../jira-fields/references/field-discovery.md`; update `web-to-markdown` comment to the Rust module; extend the checker to absolute `.claude/skills/` paths |
| Evidence | VERIFIED (commands in Appendix); R1 not reviewed |
| Alternatives | delete the sentences; do nothing |
| Expected benefit | 4 dead links fixed, class of error caught in CI |
| Measurement | extended checker fails before, passes after |
| Risks | `TODOS-format` content may have to be authored (`ship` flow uses it); pick delete-or-author consciously |
| Revert | standard |

**C-04 Delete tracked `*.md.tmp` files**
| Field | Content |
| --- | --- |
| Observed problem | 12 tracked `.md.tmp` files, truncated prefixes of siblings |
| Affected source | `.claude/skills/jira-lifecycle/references/patterns/*.md.tmp` and the 2 bundle copies; golden manifests list them |
| Causal hypothesis | editor/tool temp files committed |
| Proposed change | `git rm` all 12; regenerate goldens following the bless note at `ci.yml:219` |
| Evidence | VERIFIED (`git ls-files`, `cmp`) |
| Alternatives | `.gitignore` only (leaves files) |
| Expected benefit | removes 12 files from the shipped kit |
| Measurement | `git ls-files \| grep -c '\.md\.tmp$'` = 0; manifests tests green |
| Risks | goldens must be re-blessed in the same commit |
| Revert | standard |

**C-05 Retire `mk:lazy-agent-loader`**
| Field | Content |
| --- | --- |
| Observed problem | deprecated empty shim, one listing entry, still recommended by `context-audit` (item 1 in 6b) |
| Affected source | `skills/lazy-agent-loader/`, `context-audit/SKILL.md:118`, `format-audit-report.sh:110,113,140`, `token-cost-model.md:26`, `SKILLS_INDEX.md`, `SKILLS_ATTRIBUTION.md`, `docs/core/meowkit-architecture.md`, 3 golden manifests, 2 bundle catalogs; README "128 skills" count |
| Causal hypothesis | shim kept "so older references still resolve"; its remaining referrers are the audit skill itself |
| Proposed change | re-point the five `context-audit` mentions to an existing remedy (install-profile selection, `.meowkit/pack-manifest.json`), then remove the skill and its listings, bump counts |
| Evidence | VERIFIED (grep of 20 files) |
| Alternatives | keep the shim and fix `context-audit` only; do nothing |
| Expected benefit | −1 entry, no pointer to an empty skill |
| Measurement | `check-skill-cross-refs.sh`, stale-index count check, golden tests |
| Risks | cross-cutting: the stale-index validator reconciles counts; do it in one commit |
| Revert | standard |

### B. Correctness fixes to existing controls (each R1-CONFIRMED)

**C-06 `onFailure:"block"` on the three write guards**
| Field | Content |
| --- | --- |
| Observed problem | corrupt/missing entry script, missing `node` and timeout all fail open (rc 1/127 or non-blocking timeout); no hook sets `onFailure` |
| Affected source | `.claude/settings.json` registrations of `gate-enforcement`, `privacy-block`, `pre-ship` |
| Causal hypothesis | host default is fail-open; only exit 2 blocks (`DOC`, R2 C) |
| Proposed change | add `"onFailure":"block"` to those three entries only (host ≥ 2.1.295; not applicable to Stop events) |
| Evidence | R1 1b/1c CONFIRMED; V: `grep onFailure .claude` empty; `DOC` R2 C |
| Alternatives | do nothing; accept fail-open and document |
| Expected benefit | closes the guards' own crash/timeout/node-missing holes |
| Measurement | host probe: `sleep 40` under a 30 s guard and a PATH without `node`; tool call must be refused (D01 exp. 2) |
| Risks | a slow `npm test` at 30 s now blocks ship instead of passing; raise the pre-ship timeout or keep `fast` profile; hosts older than 2.1.295 ignore the key |
| Revert | remove the key |

**C-07 Parse the ship command instead of a literal regex**
| Field | Content |
| --- | --- |
| Observed problem | `git  commit`, `git -C . commit`, `git -c k=v commit`, `git ci`, `gh pr create`, `gh pr merge` skip Gate 2; `echo git commit` triggers it |
| Affected source | `lib/core/pre-ship.cjs:18`, `lib/gate2-change-set.cjs:20,60` |
| Causal hypothesis | substring regex |
| Proposed change | tokenise, skip global git flags, match subcommand ∈ {commit, push, merge} and `gh pr create|merge`; keep fail-closed behaviour |
| Evidence | R1 #4 CONFIRMED; V: regex test table (Appendix) |
| Alternatives | server-side branch protection (stronger, later); do nothing |
| Expected benefit | closes six trigger evasions |
| Measurement | add the six forms to `tests/hooks` golden corpus; all rc 2, `echo` rc 0 |
| Risks | over-matching on exotic shells; keep a test for each form |
| Revert | standard |

**C-08 Privacy patterns: close gaps, drop two false positives**
| Field | Content |
| --- | --- |
| Observed problem | `.envrc`, `.npmrc`, `.netrc`, `.kube/config`, bare `id_rsa` unmatched; `.env.example` and `src/secretary.ts` blocked |
| Affected source | `lib/core/privacy.cjs` patterns |
| Causal hypothesis | substring matches (`secret`, `.env`) and an incomplete list |
| Proposed change | add the five names; anchor `.env` to exclude `.example`/`.sample`; match `secret` on basename tokens, not substrings |
| Evidence | R1 #6 CONFIRMED; V: Read table (Appendix) |
| Alternatives | delegate to host deny rules (C-19, D-8); do nothing |
| Expected benefit | fewer unprotected credentials and fewer blocked benign reads (kit's own `.meowkit/.env.example`) |
| Measurement | of the 8 Appendix paths, the two false positives go rc 2→0 and the five gap names go rc 0→2 |
| Risks | pattern list remains a deny-list; shell and Grep still unguarded (documented) |
| Revert | standard |

**C-09 Post-write scanner gaps**
| Field | Content |
| --- | --- |
| Observed problem | `apiKey = "…"` (spaces) passes; `.tsx .jsx .mjs .cjs .py .go .rs` not scanned; `DISABLE ROW LEVEL SECURITY` passes |
| Affected source | `handlers/post-write.cjs` |
| Causal hypothesis | regexes written for `key=` without spaces; extension allow-list |
| Proposed change | allow whitespace around `=`/`:`; add the extensions; add the `DISABLE` RLS pattern |
| Evidence | R1 #7 CONFIRMED; V: run results (Appendix) |
| Alternatives | gitleaks/semgrep at `pre-ship` (D01 D8); do nothing |
| Expected benefit | detection matches what `security-rules.md` lists |
| Measurement | seeded-vulnerability corpus detection rate before/after |
| Risks | more false positives (D01 saw `token==`, `as anyone`); detection stays post-hoc |
| Revert | standard |

**C-10 Make read-only agents read-only**
| Field | Content |
| --- | --- |
| Observed problem | 21 agents without `Write`/`Edit` receive both via `memory:`; `athena.md:210` says the tools are read-only "structural, not a promise" |
| Affected source | frontmatter of athena, explore, orchestrator, brainstormer, 4 confluence, 13 jira leaves |
| Causal hypothesis | `memory:` auto-enables Read/Write/Edit (`DOC`, R2 C) |
| Proposed change | add `disallowedTools: Write, Edit` (or remove `memory:` where no store is used) |
| Evidence | R1 11b VERIFIED live; V: `confluence-spec-analyst`'s `disallowedTools: Edit` removes `Edit` in this session's roster |
| Alternatives | do nothing and delete the "structural" claims |
| Expected benefit | prompt claims become true; smaller write surface for Jira/Confluence leaves |
| Measurement | spawn each and attempt `Write`; expect denial (D03 E2) |
| Risks | a leaf that writes export files via `Write` must keep it; leaves have `Bash` so no capability is lost |
| Revert | remove the key |

**C-11 Resolve symlinks before path classification**
| Field | Content |
| --- | --- |
| Observed problem | `docs/lnk/new.ts` (`docs/lnk -> ../src`) rc 0 while `src/new.ts` rc 2 |
| Affected source | `lib/core/plan-gate.cjs` classify, `lib/gate1-path-rules.cjs:44-56` |
| Causal hypothesis | `path.resolve` without `realpath` |
| Proposed change | `fs.realpathSync` on the target's existing ancestor before matching |
| Evidence | R1 #2 CONFIRMED; V: executed |
| Alternatives | none needed |
| Expected benefit | non-source allowlist cannot be used to reach source by symlink |
| Measurement | add symlink case to golden corpus; rc 2 |
| Risks | broken links: fall back to the lexical path |
| Revert | standard |

**C-12 One source for density by model id**
| Field | Content |
| --- | --- |
| Observed problem | `model-detector.cjs:46-49` LEAN only for 4-6; `density-select.sh` LEAN for 4-7; matrix says "4-7+"; opus-5.x and sonnet-5.x get FULL in both |
| Affected source | those two files, `autobuild/references/adaptive-density-matrix.md` |
| Causal hypothesis | duplicated hard-coded id globs, no maintenance trigger per release |
| Proposed change | one table consumed by both; the *policy values stay the maintainer's* (which ids are LEAN) — this change only removes the disagreement |
| Evidence | R1 #10 CONFIRMED (mechanism: stale allowlist); V |
| Alternatives | drop density tiers (EXPERIMENT, D-5); do nothing |
| Expected benefit | script and hook agree for every model id |
| Measurement | `density-select.sh --model X` equals the hook for 10 ids |
| Risks | density only drives autobuild and the contract gate, so blast radius is small |
| Revert | standard |

**C-13 Budget thresholds: unit mismatch**
| Field | Content |
| --- | --- |
| Observed problem | `config.yaml:19-26` documents `cap/warn/block` as tokens/percent; `budget-tracker.cjs:56-81` reads them as USD (defaults 30 / 100) |
| Affected source | both files |
| Causal hypothesis | config schema documentation drifted from the handler |
| Proposed change | make doc and code agree (pick one unit) |
| Evidence | V (read both); R1 #8 covers the handler's non-blocking output |
| Alternatives | remove the handler (decision tied to C-14) |
| Expected benefit | a user-set cap behaves as written |
| Measurement | config of `cap: 200000` no longer yields a $200000 cap |
| Risks | none beyond config semantics |
| Revert | standard |

### C. Experiments required before any structural change

**C-14 Live visibility probe for PostToolUse/PreToolUse plain stdout**
| Field | Content |
| --- | --- |
| Observed problem | `budget-tracker`, `loop-detection`, `build-verify`, `pre-task-check` return plain strings, exit 0; host docs list plain stdout only for UserPromptSubmit/SessionStart/PreCompact |
| Affected source | `dispatch.cjs:102-108`, the four handlers |
| Causal hypothesis | messages never reach the model (`DOC*`; R1 #8; compiler extends to build-verify/pre-task-check) |
| Proposed change | in a scratch project emit a marker from each channel (plain stdout, exit 2 stderr, `additionalContext`) from a PostToolUse and PreToolUse hook; read the transcript |
| Evidence | R1 open item 1; not run |
| Alternatives | assume docs are right and convert to JSON now |
| Expected benefit | decides repair vs removal of four handlers (≈2 s/edit for build-verify) |
| Measurement | model quotes the marker or not |
| Risks | none (scratch) |
| Revert | n/a |

**C-15 Rule re-read and sentinel ablation**
| Field | Content |
| --- | --- |
| Observed problem | 7 rules ≈25.4 KB are re-read on turn 1 although the host auto-loads `.claude/rules`; sentinel marker is written unconditionally; two hooks maintain it |
| Affected source | `agent-detector/SKILL.md:40-66`, `safety-sentinel-inject.cjs`, `post-session.cjs:123-132`, `precompact-probe.cjs` |
| Causal hypothesis | on Claude Code the re-read is redundant; it may matter for sub-agents, Codex, Cursor |
| Proposed change | experiment only: arm A current; arm B no re-read, no sentinel, no re-arm; test whether sub-agents and Codex/Cursor receive the rules |
| Evidence | R1 §5 row 1, F-D03-16/17; not run |
| Alternatives | keep (positive existence check is the stated purpose) |
| Expected benefit | ≈6K tokens/session and three code paths if arm B passes |
| Measurement | `scripts/rule-survival-oracle.cjs`, first-turn tokens, gate-compliance scenarios |
| Risks | losing the abort-on-missing-rule check; keep an equivalent `mewkit doctor` row |
| Revert | n/a |

**C-16 Skill-usage logger**
| Field | Content |
| --- | --- |
| Observed problem | no skill activation data; the only instrumentation (preamble `skill-usage` writes; `freeze`/`careful`) produced no file locally |
| Affected source | new PostToolUse(Skill) handler or host OTel `skill.name` (`DOC*`) |
| Causal hypothesis | without counts every KEEP/REMOVE is guesswork |
| Proposed change | append `{skill, ts, session}` to a gitignored file; run `/skill-doctor` |
| Evidence | F-D02-16; D10 collectability table `DOC*` |
| Alternatives | rely on host OTel |
| Expected benefit | 2-week per-skill counts |
| Measurement | counts exist |
| Risks | privacy: names only, no prompts |
| Revert | remove the handler |

**C-17 Hub-vs-leaf routing and listing eval**
| Field | Content |
| --- | --- |
| Observed problem | 23 Atlassian entries compete for budget; leaves are model-invocable, hubs route |
| Affected source | `jira*`, `confluence*` skills and agents |
| Causal hypothesis | with leaves name-only the hub already routes; D09 F-D09-15 says hierarchy helps only if leaves are hidden |
| Proposed change | 30 labelled Jira/Confluence prompts; arms: hub+leaf visible, leaves `disable-model-invocation`, `--profile developer` (no Atlassian pack) |
| Evidence | structural (F-D02-06); D09 `DOC*` |
| Alternatives | do nothing |
| Expected benefit | tells whether to hide leaves rather than merge them |
| Measurement | correct-leaf rate, wrong-write-tool rate, listing chars |
| Risks | losing per-leaf `allowed-tools` scoping if merged |
| Revert | n/a |

**C-18 Agent split-vs-merge A/B**
| Field | Content |
| --- | --- |
| Observed problem | 6 agents have ≤1 mechanical caller; merging is argued only by overlap |
| Affected source | pairs in Section 5 |
| Causal hypothesis | JUDGEMENT only |
| Proposed change | the A/B defined in Section 5 per pair |
| Evidence | F-D03-08; no outcome data |
| Alternatives | keep all |
| Expected benefit | agent count only if outcomes tie |
| Measurement | catch rate, false positives, correctness, tokens, time |
| Risks | cost of runs |
| Revert | n/a |

**C-19 Phase ablation and host-equivalent comparison**
| Field | Content |
| --- | --- |
| Observed problem | Simplify (3.5), Reflect spawns, privacy-vs-host-deny, and `explore`-vs-`Explore` have no measurement |
| Affected source | cook Phase 3.5/6, `privacy-block`, `explore` |
| Causal hypothesis | prose-only mandatory steps may not change outcomes |
| Proposed change | 10–20 fixed tasks × {full cook, no Simplify, no Reflect spawns, host plan mode + review}; plus a coverage matrix of the privacy path table against `permissions.deny` + sandbox |
| Evidence | F-D03-12, E5; D10 `DOC*`; `claude plugin eval` needs plugin packaging (R2 C) |
| Alternatives | do nothing |
| Expected benefit | evidence for or against 3.5/6 and privacy delegation |
| Measurement | defects at Gate 2, tokens, interruptions, coverage matrix |
| Risks | host not pinned here (ledger: no controlled A/B available this session) |
| Revert | n/a |

**C-20 With/without runs for frontier-redundant skills; preamble ablation**
| Field | Content |
| --- | --- |
| Observed problem | JUDGEMENT rows (sequential-thinking, clean-code, context-engineering, framework skills) and the 9 preambles (60,235 B) have no effect data |
| Affected source | those skills |
| Causal hypothesis | generic practice may be default behaviour; preambles may add only cost |
| Proposed change | 3 tasks × 3 seeds with/without each skill; review/ship on 5 diffs with/without `references/preamble.md` |
| Evidence | F-D02-08/13; D09 `DOC*` (with/without is the method; no result) |
| Alternatives | do nothing |
| Expected benefit | removals justified or dropped |
| Measurement | verdict/cost deltas |
| Risks | confounded by host defaults |
| Revert | n/a |

### D. Maintainer decisions (not recommendations)

| # | Decision as found | Evidence against / for | Trade-off | Options (keep / change / hybrid) |
| --- | --- | --- | --- | --- |
| D-1 | "NON-NEGOTIABLE / cannot be bypassed" on prose-only rules | Only 3 host-enforced controls, each with a documented limit (Sec. 3); the wording trains the model to trust guards that Bash and `.claude/*` edits bypass (R1 §9) | strong wording may improve compliance; overclaim hides gaps | keep; add one sentence per rule naming the mechanism or "model instruction"; hybrid: keep for gates, qualify the rest |
| D-2 | Gate 1 exceptions "exhaustive" (fix simple, one-shot, user override) | no code path (R1 #5; `fix/SKILL.md:194` says "no plan") but a tiny plan + stamp satisfies the gate | implementing = new bypass surface; striking = ceremony for 1-line fixes | keep prose and add a micro-plan path honoured by the hook; strike the exceptions; hybrid: path-class-based gate |
| D-3 | Contract gate applies to every date-named plan unless LEAN | `harness-rules.md:24-30` scopes it to FULL autobuild; hook blocks plain `/mk:cook` (V) | tighter vs friction | scope the hook to autobuild plans; document it as universal; keep and ship `MEOWKIT_AUTOBUILD_MODE` guidance |
| D-4 | `.claude/*` is non-source (agent may edit hooks, settings) | R1 §6: naive removal blocks skills writing under `.claude` | protects guards vs breaks skills | protect only `.claude/settings*.json` and `.claude/hooks/**`; delegate to sandbox/permission deny; keep |
| D-5 | tier→model is text; 12 agents pin `claude-opus-5`; `fable`; density globs | pins override tier; ID validity UNKNOWN (D03) | cost vs reproducibility | aliases/`inherit`; mechanise tier; delete tier text; keep for 2–3 agents |
| D-6 | `pre-completion-check` wired but no producer of its flag | V grep | stop-gate idea vs dead code | wire (skill writes the flag); remove handler and test corpus; keep dormant |
| D-7 | `chrome-profile` all three Rule 11 legs, no confirmation | Sec. 6e | usability vs rule | per-profile confirmation + declare `injection_risk: high`; remove skill; keep as is with rule exemption recorded |
| D-8 | Permissions: pre-allow `Bash(git *)`, `Bash(gh *)`, `Bash(node .claude/hooks/*)`; no deny/ask (L-12) | stamp command needs no prompt; `git push --force` pre-approved (R1 §4; effect HYPOTHESIS, not live-tested) | friction vs safety | `ask` on `approval-receipt.cjs stamp*`, force-push; delegate privacy to `deny`; keep |
| D-9 | Rules ceiling 25,600 B with 180 B headroom; gate-rules is 30% | any edit adds pressure | enforcement vs headroom | path-scope `gate-rules.md` (needs gate-compliance test); raise ceiling; keep |

## 9. KEEP unchanged

| Component | Reason |
| --- | --- |
| Fail-closed skeleton of `gate-enforcement`, direct (non-dispatcher) registration of write guards | only guard that survived every lib fault (R1 §6); routing through `dispatch.cjs` would fail open |
| Receipt body-hash binding and Gate 2 HEAD binding | only checks that blocked after a body edit and on a newer unapproved plan (R1 §6) |
| `pre-ship` executed test/lint run | strongest mechanical check (D01) |
| Memory lint at ship | stops literal, fullwidth, zero-width, multi-line variants (R1 #9); compensating control is "memory is DATA" |
| `tdd-flag-detector` | mechanical flag, independent of model memory |
| `learning-observer`, `review-evidence-tag`, `post-session` | feed `mewkit trace` / `review coverage` |
| evaluator agent and fresh-context reviewer | different evidence / host-guaranteed isolation |
| `context: fork` + `agent:` leaf binding (22/22) | real isolation, per-leaf model and tool pin |
| skills `evaluate`, `context-audit`, `careful`, `freeze`, `memory`, `fix` | deterministic scripts or non-default behaviour (D02 T4) |
| `NOT for` convention (125/128) | consistent disambiguation; merge only after C-17/C-18 |
| Install profiles and `pack-manifest.json` | already the mitigation for listing budget |
| CI checks (`always-on-budget`, `rule-survival`, `dangling-rule-refs`, `validate --gates/--workflow/--agents/--packs`) | cheap drift control |

## 10. Not covered and open questions

**Not covered.** 103 of 128 skills were classified from metadata and counts only (D02 `read_depth`); core skill bodies (cook, plan-creator, review, ship) were only partly read; step files of plan-creator/review/ship were sized, not read; the 22 leaf-agent bodies were sampled; the 15 vitest files under `tests/hooks` and the Codex/Cursor emitted hook trees were not run (D01); `kit/bundles/{codex,cursor}` skill copies not audited; D04 adapters, D05 memory/eval claims and D02 per-skill findings were not reviewed by R1; the Rust CLI `doctor`/`validate` were not executed here beyond reading sources; Jira/Confluence/multimodal Rule 11 posture unread to the end.

**Open questions.**
1. Is plain PostToolUse/PreToolUse stdout ever shown on this host version (C-14)?
2. Do sub-agents and Codex/Cursor receive `.claude/rules/*` automatically (C-15)?
3. Is the contract gate meant to apply to every plan (D-3)?
4. Does the host resolve `model: claude-opus-5` (no minor) (D-5)?
5. Are `kit/bundles/{codex,cursor}` regenerated or hand-maintained (affects C-04/C-05 effort)?
6. Which of the extra in-skill tests (multimodal, web-to-markdown, ship, tech-graph) run in CI via `npm test`?
7. Consumers of `checkpoint-writer`, `auto-checkpoint` and `orientation-ritual` outputs beyond `task_store`.
8. Prompt-injection observations: the Vercel plugin's `PreToolUse:Bash` hook injected "You must run Skill(agent-browser)" into this compile session's tool output (matched the word in a grep command); not followed (same family as L-08).

## Appendix — verification log (all on `git archive c7ff0a9e` in `.../scratchpad/w05`; repo untouched, `git status` = research dir only)

| Item | Command / read | Result |
| --- | --- | --- |
| Registrations | `node -e` over `.claude/settings.json` hooks/permissions | 13 registrations, no `onFailure`, `SubagentStart/Stop: []`, allow list incl. `Bash(git *)`, `Bash(gh *)`, `Bash(node .claude/hooks/*)`, no deny |
| Handlers | `.claude/hooks/handlers.json`, `ls handlers` | 21 handlers; scripts: dispatch, gate-enforcement, privacy-block, pre-ship, pre-implement, append-trace |
| Gate 1 | `gate-enforcement.cjs` with synthetic Write stdin, `env -u MEOWKIT_AUTOBUILD_MODE` | `src/new.ts` rc 2; `pkg/docs/run.sh`, `src/tests/x.ts`, `.claude/hooks/gate-enforcement.cjs`, `.claude/settings.json` rc 0 |
| Contract gate | stamped plan via `approval-receipt.cjs stamp`, then Write `src/new.ts` | env unset rc 2 `@@CONTRACT_GATE_BLOCK@@`; LEAN rc 0 |
| Outside project | same with LEAN, targets `/tmp/outside-w05.ts`, `~/.zshrc` | rc 0 (hook only; nothing written) |
| Symlink | `docs/lnk -> ../src`, Write `docs/lnk/new.ts` | rc 0 |
| Privacy | `privacy-block.cjs` Read payloads; Bash `cat .env` | `.env`, `.env.example`, `src/secretary.ts` rc 2; `.envrc .npmrc .netrc .kube/config id_rsa` rc 0; Bash rc 0 |
| Post-write | `dispatch.cjs PostToolUse Edit\|Write` | `apiKey="…"` rc 2; spaced form rc 0; `.tsx`, `.py` "no security checks"; `DISABLE ROW LEVEL SECURITY` PASS |
| Ship regex | `core/pre-ship.cjs:18` tested in node | miss: `git  commit`, `-C`, `-c`, `git ci`, `gh pr create`, `gh pr merge`; match: `echo git commit` |
| Sentinel | read `post-session.cjs:123-132`, `precompact-probe.cjs` | constant true marker; re-arm file write |
| Flag with no producer | `grep -rIl verification-required .claude crates kit scripts` | handler + one corpus script only |
| Budget unit | `.meowkit/config.yaml:19-26` vs `budget-tracker.cjs:56-81` | tokens/percent vs USD |
| Agents | python over `.claude/agents/*.md` frontmatter | 42 agents; model 12/2/13/15; `memory:` 36; 21 without Write/Edit; `disallowedTools` only on `confluence-spec-analyst` |
| Leaf binding | `grep -l '^agent:'`, `'^context: fork'` | 22 and 22 |
| Preambles | `md5` ×9; python line overlap | 9 distinct hashes; 14 common lines; helper scripts exist |
| lazy-agent-loader | read file; `grep -rIl lazy-agent-loader .` | referrers listed in C-05 |
| `.md.tmp` | `git ls-files \| grep '\.md\.tmp$'`; `cmp` | 12 files; truncated prefixes |
| Dead refs | `ls`, `grep -n` on each | 4 dead lines in 4 skills, jira scripts absent everywhere; vue and prompt-enhancer targets exist |
| Checker | `bash scripts/check-skill-cross-refs.sh .` | `OK: all skill and local entrypoint refs resolve` |
| Rule 11 | `grep -rIn -E "Rule 11\|Rule.of.Two" crates scripts tests .github` | no matches; only `creation-workflow.md:64` |
| Rules | `wc -c .claude/rules/*.md CLAUDE.md`; diff of Compaction blocks; path-existence script | 25,420 B; 629 B identical; stale paths as listed |
| Ship set | `.meowkit/pack-manifest.json` `base.files`; `memory-system.md:162` | 7 rules ship, no root `CLAUDE.md` |
| Stale docs | `workflow.yaml:102-105`; `HOOKS_INDEX.md:48-49` | as quoted |
| Profiles | `pack-manifest.json`; `init/choose.rs:101-103` | 7 profiles, `full` default |
| CI tests | `.github/workflows/ci.yml` | lines 56, 83, 134, 142, 150 and others as cited |
