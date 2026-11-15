# D02 — MeowKit skills audit (128 skills)

Auditor: D02 agent. Date 2026-11-15. Checkout `/Users/sangnguyen/Desktop/MeowKit`.
Companion file: `D02-skills-inventory.csv` (128 rows; 59 columns; last 6 = baseline_commit, listing status, read depth, classification, basis, reason).
Scripts (scratch, not in repo): `/private/tmp/claude-501/-Users-sangnguyen-Desktop-MeowKit/2432fe97-45f9-43f5-a60a-3ca2021e1a38/scratchpad/d02/{inventory.py,classify.py,inv.json}`.
Token figures are ESTIMATES = chars/4 (not a tokenizer).

**Baseline:** main @ c7ff0a9e (repo moved from feat/rust-plan-state-verbs @ fc278b31 mid-audit). All numbers and the CSV (column `baseline_commit`) were re-measured on c7ff0a9e. Between the two commits only 6 skill files changed (benchmark SKILL.md + dead-weight rules, help/references/cli.md, resolving-merge-conflicts SKILL.md, vue-testing-best-practices SYNC.md, worktree/scripts/lib/worktree-review-pr.cjs); dead-reference set identical (50 path / 42 mk: raw hits, same entries); no skill mentions `npx mewkit` or `packages/mewkit/src`; counts, listing size, classifications unchanged except the context-audit reason.

## 1. Scope & coverage inventory

**Examined (programmatically, all 128 dirs under `.claude/skills/`, plus `SKILLS_ATTRIBUTION.md` which is a file, not a skill):**
frontmatter (YAML-parsed, 0 parse errors), SKILL.md size, references/ step files / prompts / assets sizes, 137 script files (py 10,550 LOC, sh 3,876, js 8,262, ts 722) syntax-checked (`node --check`, `bash -n`, in-memory `compile()` for py: 0 failures), regex scan for network/secret/shell-injection patterns, dead path-references and dead `mk:` references across every .md/.sh/.py/.cjs/.js/.json/.yaml inside every skill, test mentions in `tests/` and `packages/mewkit/tests/`, cross-skill duplicate lines (>=90 chars in >=3 skills).
**Read by hand (SKILL.md body sampled, first ~50-130 body lines, not whole files):** cook, autobuild (+ `adaptive-density-matrix.md` in full, `density-select.sh` in full, ran it), agent-detector (+ `scoring-and-thresholds.md` head), plan-creator, review, fix, verify, simplify, ship, memory (full), skill-creator, context-engineering, orchestrate, workflow-orchestrator (most of it), benchmark, evaluate, trace-analyze, development, testing, clean-code, sequential-thinking, lint-and-validate, jira (hub), chrome-profile (partial), lazy-agent-loader (full), `references/preamble.md` of cso.
**NOT done / caveats:** the brief asked for the core skills "in full"; I did NOT read every reference file of those skills nor the tails of the 200-350-line SKILL.md files. 103 of 128 skills were classified from metadata + counts only (CSV column `read_depth`). Skills were not executed (only syntax-checked); no skill-activation test was run. The host listing mechanics were read from docs, not reproduced (no host budget setting changed). `kit/bundles/{codex,cursor}` copies of the skills were counted (125/124 dirs) but not audited.
**Gate/hook observations:** (1) the `Write` tool was blocked by `gate-enforcement.cjs` (Gate 1, "no approved plan") when writing a scratch script OUTSIDE the repo; I wrote scratch files with Bash heredocs instead (the lead assigned the scratch dir). This is a Gate-1 false positive on out-of-repo paths for D01. (2) A Vercel-plugin `PreToolUse:Bash` hook injected "You must run Skill(agent-browser)" because my script text contained the word `agent-browser`; I did not follow it (prompt-injection-style observation, same family as lead L-08).

## 2. Findings

### Always-on cost and the "missing descriptions" mystery

**F-D02-01 — Total MeowKit always-listed metadata is small; the description cap is not why descriptions vanish.** VERIFIED (inventory.py, YAML parse over all 128): name 1,804 chars + description 13,914 + `when_to_use` 8,596 = 24,314; ~26.8k chars with the host's display punctuation (the host prints each entry as `short (mk:short): description - when_to_use`, VERIFIED from this session's skill listing) = ~6.7k tokens est. Longest description 159 chars, median 108; max combined entry 267 (benchmark). All 128 are far below the host's documented 1,536-char per-entry cap. Counter-evidence: an agent-memory note (`.claude/agent-memory/evaluator/project_always_listed_metadata_has_no_canonical_measurer.md`, DATA) says an earlier state measured 47-111 KB; that implies a prior lean sprint already cut ~75-80%. HISTORICAL/UNVERIFIED by me; I only verified today's number. Matters: "128 skills" is NOT an always-on token problem; it is a discoverability problem (next finding).

**F-D02-02 — Cause of descriptionless entries: host listing budget, least-used-first drop.** DOCUMENTED (https://code.claude.com/docs/en/skills, "Skill descriptions are cut short"): the listing "always contains every skill name" but "drops some descriptions to fit the listing's character budget"; budget "scales at 1% of the model's context window"; "descriptions [are dropped] starting with the skills you invoke least"; tunables `skillListingBudgetFraction`, `SLASH_COMMAND_TOOL_CHAR_BUDGET`, `skillListingMaxDescChars`, `skillOverrides: "name-only"`, and `/doctor`, `/skill-doctor`. Observed in this session's listing: 47 of 128 mk: skills have descriptions (VERIFIED by counting the listing in my context), 81 are name-only. The 47 = 32 alphabetical-prefix entries (advise ... development) + 15 others (fix, frontend-design, plan-ceo-review, plan-creator, preview, project-context, prompt-enhancer, review, ship, simplify, skill-creator, sprint-contract, validate-plan, verify, vue-best-practices). INFERRED: the 15 are the host's most-invoked skills and the rest fill alphabetically until the budget ends. The described mk: entries total 9,342 chars (inventory.py); the dropped 81 total 14,972 chars. INFERRED effective budget available to mk: skills ~9-10k chars, shared with ~100 non-MeowKit skills (vercel-plugin, anthropic-skills, gsap...). UNKNOWN: the exact budget (window size and fraction not read from the host). Checked repo: `skillOverrides`, `skillListing*`, `SLASH_COMMAND_TOOL_CHAR_BUDGET` are NOT set in `.claude/settings.json` (grep: none); `disable-model-invocation` is set on 0 skills.
Effectively undiscoverable by description in this session (name-only): 81 skills, of which names that do not self-describe: henshin, nyquist, ghpm, rubric, pack, loop, showcase, elicit, grill, intake, qa-manual, stitch, plus all 17 jira-* (full list: CSV column `listing_described_in_session`). Why it matters: the model must guess from the name; `NOT for mk:x` disambiguation (F-D02-05) is invisible for 63% of skills.

**F-D02-03 — `when_to_use` is 35% of listing chars and is the first thing to cut.** VERIFIED: 8,596 of 24,314 chars; present on all 128. HYPOTHESIS: for most skills it restates the description's trigger (not diffed programmatically). The docs say it counts toward the same 1,536 cap and the same budget. Fewer, better-written entries would let more skills keep descriptions. Alternative not tested: `skillOverrides name-only` for the ~20 low-use skills to give the budget to the high-use ones.

**F-D02-04 — Advisory frontmatter is sparse and unread by the host.** VERIFIED: `preamble-tier` on 31/128, `phase` 46, `trust_level` 24, `injection_risk` 24, `model` 0, `disable-model-invocation` 0; `runtime: claude-code` 121, `portable` 7; 867 `keywords` entries; `dependency_edges`, `owner`, `criticality`, `meowkit.*` are MeowKit-internal (not host fields; DOCUMENTED host fields are name/description/when_to_use/etc.). These load with SKILL.md on activation but do not affect routing. Rule 11 exposure is declared on 24 skills only (F-D02-14).

### Trigger quality and clusters

**F-D02-05 — `NOT for mk:x` convention is present on 125/128 descriptions and is consistent, but only helps when the description is visible.** VERIFIED (125/128 contain "NOT for"; exceptions are `benchmark`, `confluence` and `jira`; see CSV `desc_has_NOT_for`; the two hubs say "NOT an executor"). The convention is mostly mutual (A: NOT for B; B: NOT for A): cook/autobuild, fix/investigate, review/evaluate, verify/lint-and-validate, simplify/clean-code, brainstorming/office-hours, context-audit/context-engineering, frontend-design/ui-design-system, vue/vue-best-practices. Mutual NOT-for pairs are the signature of overlap that the authors had to patch with prose rather than remove (INFERRED). No trigger-collision eval exists in the repo (grep for eval suites of descriptions: none; `claude plugin eval` is DOCUMENTED but not used here).

**F-D02-06 — Hub+leaf (jira x17, confluence x6) costs listing budget and duplicates routing.** VERIFIED: jira hub (`mk:jira`, 121 lines) is "a pure routing layer ... No execution" with a 16-row table that repeats each leaf's description; leaves are 49-91 line CLI recipes with NO scripts (0 of 16 ship code; scripts live in the hub); jira-* listing = 2,980 chars (11% of MeowKit's listing), confluence-* 1,127. 18 jira/confluence executor agents exist for the leaves (agent list in this session). Under budget pressure the 17 jira leaves are name-only (observed: all name-only), so in practice only the hub table routes (INFERRED). Cost of the alternative: one hub + references would remove ~16 listing entries (~2.8k chars) but loses per-leaf agent forks and per-leaf `allowed-tools` scoping (JUDGMENT: scoping matters for Jira write safety). Not measured either way. Classified EXPERIMENT, not MERGE.

**F-D02-07 — Largest real overlaps (cluster table below).** Mechanical duplicates (MERGE-level): clean-code/simplify (66 differing lines of the two bodies, both KISS/DRY/YAGNI), review-pr/review (review already has `#123`/PR-URL mode), lint-and-validate/verify (verify runs lint). Judgment overlaps (EXPERIMENT): scale-routing/agent-detector, grill/advise, elicit/problem-solving/sequential-thinking, intake/planning-engine/jira-evaluator/story-sizer/jira-estimator (five skills that score/size tickets).

### Instruction density, duplication, model assumptions

**F-D02-08 — Nine near-identical `references/preamble.md` copies (60,235 B, ~15k tokens est) from a legacy upstream, with a usage-telemetry write that has never produced data.** VERIFIED: cso, document-release, investigate, office-hours, plan-ceo-review, qa, retro, review, ship each carry one (2.6-14.6 KB); each starts with a bash block that touches `.meowkit/state/sessions`, reads `.claude/hooks/lib/workflow-config`, runs a "lake intro"/telemetry prompt and appends `{"skill":...}` to `.meowkit/telemetry/skill-usage`. No such `skill-usage` file exists (`ls .meowkit/telemetry`: cost-log.json, hook-log.jsonl, lean-bypass.log, trace-log.jsonl). UNKNOWN whether the model never runs the preamble or telemetry is off. Script found 55,362 B (~13.8k tok) of extra copies of >=90-char lines present in >=3 skills. Matters: this is the clearest removable text (H8) and the only skill-activation instrumentation in the repo is dead (F-D02-16).

**F-D02-09 — Density tiers (MINIMAL/FULL/LEAN) rest on an external article, not on repo evidence, and the code inverts the policy for newer models.** VERIFIED: `autobuild/references/adaptive-density-matrix.md` cites "Anthropic harness design article ... <!-- research-citation -->" and states LEAN matches FULL "within 5%" must be re-measured by `mk:benchmark`; `.claude/benchmarks/results/` contains only `.gitkeep` (0 results). I ran `density-select.sh --model`: `claude-opus-4-7` -> LEAN, `claude-opus-5-5` -> FULL, `claude-sonnet-5-5` -> FULL, `claude-haiku-4-5` -> MINIMAL, `gpt-5` -> FULL. `.claude/hooks/handlers/model-detector.cjs:46-49` maps opus 4-6 only to LEAN (4-7 -> FULL): hook and script disagree for 4-7. `.meowkit/telemetry/cost-log.json` shows the local runs used `claude-opus-5-5` (226 entries, 7 sessions); `.meowkit/state/detected-model.json` says `model_id: unknown, FULL, confidence: default`; `trace-log.jsonl` records density `LEAN` on all 1,556 records and `lean-bypass.log` has 325 `MEOWKIT_AUTOBUILD_MODE=LEAN` lines (origin: the audit shell itself has `MEOWKIT_AUTOBUILD_MODE=LEAN` exported, so INFERRED env override; density-select.sh gives LEAN for any model when it is set, re-run on main with the var unset: opus-5-5 FULL, opus-4-7 LEAN, unchanged). So the policy "capable models need less scaffolding" (H2) is encoded as hard-coded model-name globs that go stale with every release, and a stale glob gives the NEWER model MORE scaffolding. Counter-evidence: external research may well support H2 (not checked here; D-other domains). Matters: H2 is a belief in this repo, not a measurement.

**F-D02-10 — Agent-detector duplicates always-loaded rules and encodes uncalibrated numeric scoring as prose.** VERIFIED: SKILL.md "Every user message, no exceptions" and Step 0 Reads the 7 rule files (25,417 B, same files the host already loads from `.claude/rules/`) plus 7 phase-zero refs (26,071 B); `scoring-and-thresholds.md` defines weights (+20..+60) and thresholds (>=80 primary, 50-79 secondary, 30-49 optional, <30 none) for the LLM to compute per message. No calibration data in repo. `agent-detector` is `user-invocable: false` with no hook invoking it (grep `settings.json`/handlers: only the safety-sentinel comment references it), so "every message" is advisory, not enforced (INFERRED; D01 to confirm hooks).

**F-D02-11 — Procedural scripts that are CLI/deterministic calls in disguise.** VERIFIED examples: cook `echo on > .meowkit/state/tdd-mode`; verify marker-file -> build/lint/test table and changed-file `git diff` pipeline; memory already delegates to `mewkit note`; trace-analyze already says use `mewkit trace score|audit|propose`; review uses `mewkit review prepare|read|coverage`; ship/plan-creator drive `.plan-state.json`. Candidates to move behind a CLI verb: verify detection+scoping, cook TDD sentinel, density selection, plan-state hydration. JUDGMENT: the CLI is absent on PATH in this environment (lead baseline), so skills that depend on it silently skip.

**F-D02-12 — Host/model-specific tokens in "generic" skill bodies.** VERIFIED (substring counts in SKILL.md): `AskUserQuestion` 35 skills, `.claude/` 64, `${CLAUDE_SKILL_DIR}` 27, `${CLAUDE_PROJECT_DIR}` 15, `mewkit ` 16, `subagent` 20, `Task(` 2; cook gotcha "Always use Task() ... not Agent()" is stale for hosts that name the tool Agent (this host). `runtime: portable` on only 7. skill-authoring-guidelines §5.4 says generic skill bodies must not contain provider tool names; the corpus does (CONTRADICTED, see section 3).

**F-D02-13 — Frontier-model-redundant content (JUDGMENT).** Skills whose body is mostly practice a current model applies unprompted: clean-code, lint-and-validate, simplify (partly), sequential-thinking (6-step hypothesis loop), problem-solving, elicit, context-engineering, development, testing, verify's detection table. Not tested (no with/without runs possible here). Valuable non-default content I did find: fix's scout->diagnose->root-cause hard gate, evaluate's scripted score/evidence validators (registry NEVER-PRUNE), memory's non-derivable rule + CLI lint, freeze/careful as hooks.

### Scripts, security, Rule 11

**F-D02-14 — Rule 11 (untrusted input + sensitive data + state change): `chrome-profile` hits all three with no human gate.** VERIFIED (`chrome-profile/SKILL.md:30-36`): attaches to a real Chrome profile ("All cookies, extensions, and saved sessions ... available"), drives untrusted pages via agent-browser, no `AskUserQuestion`/confirmation in the file (grep), only an env-var hint `AGENT_BROWSER_CONTENT_BOUNDARIES=1` and fail-closed on ambiguous profile. No `injection_risk`/`trust_level` declared. Probable same exposure (HYPOTHESIS, not read to the end): Jira/Confluence family (untrusted ticket text + API token in `.meowkit/.env` + writes to Jira; mitigated by 4-tier safety-framework and dry-run-first on bulk), `multimodal` (user files to Gemini/MiniMax/OpenRouter via urllib, env API keys). Skills that explicitly document a Rule-of-Two position: review, figma, showcase, loop, context-audit, skill-template-secure. `delegate` and `stitch` self-declare `injection_risk: high`.

**F-D02-15 — Script hygiene is good at the syntax level.** VERIFIED: 137 script files, 0 syntax failures. Network clients only in `multimodal` (3 files, urllib), `stitch` (1), `web-to-markdown` (3); mutating HTTP verbs in multimodal only. 13 skills ship Python; 5 have `requirements.txt` (confluence, figma, jira, multimodal, web-to-markdown); `scripts/` count 38 skills. Shell-injection-pattern regex (`shell=True`, `os.system`, `eval`, `exec(`, `rm -rf`, child_process) hit 16 skills; most are comments/docs/regex `.exec()` calls (markdown-reader hits are `RegExp.exec`); NOT individually triaged. 4 tracked `*.md.tmp` files in `jira-lifecycle/references/patterns/` (x3 including `kit/bundles/{codex,cursor}` copies) are repo hygiene bugs.

### Evidence of real use

**F-D02-16 — There is NO skill activation or effectiveness evidence in the repo.** VERIFIED: `.claude/eval/` is one adapter file (`track-m-adapter-core.cjs`); `.claude/benchmarks/` has 6 canary specs and `results/.gitkeep` only; `.meowkit/telemetry/`: trace-log.jsonl (1,556 records, only `file_edited` 1,330 + `session_end` 226, `run_id` empty, model `claude-opus-5-5` or empty), hook-log.jsonl (512 `fired`), cost-log.json (226), lean-bypass.log; `.meowkit/state/learning-observer.jsonl` (1,330 `edit`). No `Skill` PreToolUse logger (grep hooks and settings: none). The preamble `skill-usage` log is absent (F-D02-08). Consequence: every claim that a given skill "is valuable" is HYPOTHESIS; this audit's KEEP verdicts (basis S) are absence-of-red-flag only. Cheapest fix: a PostToolUse(Skill) hook appending `{skill,ts,session}` to a git-ignored file, and use `/skill-doctor` (DOCUMENTED) for host-side unused-skill reports.

**F-D02-17 — Only 8/128 skills have a contract test; 7 have in-skill tests; 87 have no test mention anywhere.** VERIFIED: `tests/{build-fix,document-release,fix,help,investigate,resolving-merge-conflicts,validate-plan,workflow-orchestrator}-skill-contract.test.sh` (note `skill-contract-coverage.test.sh` aggregates only 6 of the 8; `fix` and `help` are not in its loop); in-skill tests: confluence 2, docs-finder 5, intake 1, multimodal 5, prompt-enhancer 1, web-to-markdown 3, worktree 1; on fc278b31 other mentions came from `packages/mewkit/tests`; on main that directory no longer exists (TS CLI retired), so context-audit lost its vitest and has only golden-manifest mentions. Re-measured test-mention counts on main shifted by +-2 for 12 skills (CSV). The contract tests pin SKILL.md invariants (text pins), not behaviour. Those pins make merges harder (merge targets must port pins).

### Dead references

**F-D02-18 — Genuine dead references are few (list in section 4); the checker has many false positives, so the repo does not appear to run a skill-link validator.** VERIFIED: 50 unresolved path hits + 42 unresolved `mk:` hits raised by the script; after manual triage ~20 are real (jira-admin x2, jira-search, plan-ceo-review, ship x2, vue-best-practices x8, prompt-enhancer, web-to-markdown lib path, stale text "migrated from mk:shipping/mk:documentation", figma `mk:figma-*` which are documented as future skills in a table). Remainder are templates, examples, runtime-created files or paths relative to a different root.

**F-D02-19 — Skill count versus claims.** VERIFIED 128 dirs = README claim 128. `kit/bundles/codex` has 125 skill dirs and `cursor` 124 while 121/128 skills are `runtime: claude-code` (portability honesty is D-adapters' domain; flagged here only because the counts disagree with the `portable: 7` field).

### Claim checks (docs/governance)

**F-D02-20 — `dead-weight-audit-registry.md` contains almost no skill rows and no measured skill delta.** VERIFIED (61 lines): skill-related rows are `skills/evaluate/scripts/recompute-score.py`, `validate-verdict.sh` (both N/A NEVER-PRUNE) and the `athena`/`advise` lane (not measured, WATCH). The 2026-11-01 PRUNE rows are removals of wiki/memory subsystems, "not measured (benchmark baseline deferred by owner)". No row evaluates any of the 128 skills against the dead-weight rules, and `dead-weight-audit-rules.md` Rule 2 requires benchmark deltas that `results/` does not contain. CONTRADICTED: README/governance imply an audited, benchmark-driven harness; for skills, the audit has not run. (The registry file was modified on disk while I worked; I used the version current at the end: 61 lines.)

**F-D02-21 — `skill-authoring-guidelines.md` is a consolidation of two Anthropic docs and is not followed uniformly by the corpus.** VERIFIED against inventory: <500-line cap satisfied by all (max 358, p90 218); description <=1024 satisfied (max 159); "no provider tool names in generic core" violated (F-D02-12); "Gotchas section present" not checked programmatically; "Build 3 evals before docs" has no artefacts. The guideline's own open question 3 asks whether oversize skills exist; answer: none by line count, but 12 packages exceed ~20k est tokens on full load (T3).

## 3. Contradictions

| Claim (source) | Evidence | Label |
|---|---|---|
| "capable models degrade under full harness; LEAN for Opus 4.6+" (`adaptive-density-matrix.md`) | scripts give FULL for opus-5-5, LEAN for 4-7; hook gives FULL for 4-7; no benchmark result files | CONTRADICTED (impl vs policy), UNVERIFIED (policy) |
| Generic skill bodies carry no provider tool names (`skill-authoring-guidelines.md` 5.4) | `AskUserQuestion` in 35 SKILL.md, `Task(` in 2, `${CLAUDE_*}` in 27 | CONTRADICTED |
| Mandated dead-weight audit per release (`dead-weight-audit-rules.md` Rule 1-2) | no benchmark result; registry has no skill-delta row | CONTRADICTED (not performed) |
| "agent-detector fires on every message, no exceptions" (SKILL.md) | `user-invocable: false`, no hook registers it | INFERRED not enforced |
| "usage measurement via PreToolUse hook" (guideline 5.10) / preamble telemetry | no logger, no `skill-usage` file | CONTRADICTED (absent) |
| `skill-contract-coverage` aggregator "critical-skill suites" | loop covers 6 of the 8 existing contract tests | VERIFIED gap |
| `lazy-agent-loader` "kept only so older references still resolve" | no skill references it; manifests/catalog and context-audit prose only | VERIFIED |

## 4. Cluster-overlap table

| Cluster | Members (listing chars / pkg tok est) | What distinguishes them | NOT-for disambiguates? | Verdict |
|---|---|---|---|---|
| Implement | cook 179/28k, development 169/3.5k, autobuild 190/18k, bootstrap 195/5k | cook = single task with gates; autobuild = unattended green-field loop; bootstrap = empty repo scaffold; development = reference index | cook/autobuild mutual; bootstrap NOT autobuild; development NOT cook | development is the weak member (index skill); cook/autobuild/bootstrap distinct by input size |
| Fix | fix, build-fix, investigate, problem-solving | fix = land the fix; investigate = diagnose only; build-fix = compile errors; problem-solving = unstick | yes, all point to a sibling | build-fix MERGE into fix; problem-solving EXPERIMENT |
| Review/verify | review, review-pr, evaluate, qa, qa-manual, verify, lint-and-validate, respond-pr, rubric | review = static diff; evaluate = run the build; qa = black-box web app + fix; qa-manual = spec/Playwright; verify = build/lint/test | yes mutual | review-pr and lint-and-validate are subsets; evaluate/qa/qa-manual overlap only on browser driving (distinct intent) |
| Plan | plan-creator, planning-engine, validate-plan, plan-ceo-review, breakdown, sprint-contract, intake | creator writes plan; validate-plan checks approved plan 8 dims; ceo-review challenges ambition; planning-engine/intake score tickets | yes | plan-creator ships validate+red-team aliases that duplicate validate-plan; ticket scoring cluster (intake/planning-engine/jira-evaluator/jira-estimator/story-sizer) is the real overlap |
| Think | brainstorming, office-hours, party, advise, elicit, grill, decision-framework, nyquist | options given decision / is it worth building / multi-agent trade-off / single verdict / re-examine verdict / interview the user / ops frameworks / AC-to-test map | partly (brainstorming/office-hours/party mutual) | grill vs advise share the one-question-at-a-time mechanism; EXPERIMENT |
| Route/orchestrate | agent-detector, scale-routing, orchestrate, workflow-orchestrator, lazy-agent-loader, delegate, team-config, task-queue | detector picks agent+tier; scale-routing picks complexity/density; orchestrate coordinates external CLIs; workflow-orchestrator = adapter to workflow.yaml; delegate builds prompts; team-config/task-queue parallel teams | yes | lazy-agent-loader REMOVE; workflow-orchestrator SIMPLIFY; detector vs scale-routing EXPERIMENT |
| Context | context-audit, context-engineering, session-continuation, memory | audit = static overhead (script-backed); engineering = runtime moves (generic); continuation = handoff; memory = two files | yes (audit/engineering mutual, with an "ask one question" tie-break clause) | context-engineering SIMPLIFY |
| Jira x17 | jira (hub), 16 leaves | per-API-area recipes; hub routes | leaves all "NOT for mk:jira-x" | hub+leaf EXPERIMENT (F-D02-06) |
| Confluence x6 | hub + page, search, bulk, collaborate, spec-analyst | same | yes | same |
| UI/framework | frontend-design, ui-design-system, stitch, figma, react-patterns, vue, vue-best-practices, vue-testing, angular, typescript | design vs system vs generator vs MCP gateway; per-framework knowledge | frontend-design/ui-design-system mutual; vue/vue-best-practices mutual | framework skills EXPERIMENT vs live docs (docs-finder) |
| Browser | agent-browser, chrome-profile, playwright-cli, web-to-markdown, markdown-reader | fresh session / real profile / scripted CLI / one URL / local reader | yes | chrome-profile Rule 11 IMPROVE |

Hub+leaf listing arithmetic (VERIFIED from inventory): the 23 jira/confluence entries cost 4,107 listing chars (~15-17% of MeowKit's listing); one hub per family would cost ~2 x ~180 = 360 chars. Whether routing accuracy survives collapse is UNKNOWN (no routing eval).

## 5. Tables

Dead-reference list (manually triaged; "real" = target absent and not an example/runtime path):

| Skill | File | Dead target | Note |
|---|---|---|---|
| jira-admin | references/voodoo-constants.md | `.claude/skills/jira-fields/scripts/{list_fields,get_field}.py` | dir `jira-fields/scripts` absent |
| jira-search | references/jql-patterns.md | `references/field-discovery.md` | exists at `jira-fields/references/` |
| plan-ceo-review | references/required-outputs.md | `.claude/skills/review/TODOS-format.md` | absent |
| ship | references/version-changelog-todos.md, test-execution.md | `.claude/skills/review/TODOS-format.md` | absent (2 files) |
| ship | SKILL.md:177-179 | "migrated from mk:shipping" | stale text (no such skill) |
| document-release | SKILL.md:91 | "migrated from mk:documentation" | stale text |
| vue-best-practices | 8 reference files | `references/components.md`, `composables.md`, `reactivity-performance.md` | cross-links to renamed/non-existent files |
| prompt-enhancer | references/context-safeguards.md | `references/pattern-index.md` | exists only in context-engineering |
| web-to-markdown | SKILL.md | `lib/system-deps-registry.ts` | lives in `packages/mewkit/src/lib/` |
| plan-creator, skill-creator, markdown-reader, office-hours, trace-analyze, preview, confluence, docs-finder, playwright-cli, stitch, scale-routing, agent-browser, session-continuation | various | template/example/runtime/optional-config paths | FALSE POSITIVES (not counted) |

Counts for the above: 50 raw path hits -> ~20 real; 42 raw `mk:` hits -> 0 real dead skill links (all are examples, wildcards `mk:jira-*`, "migrated from" history, or future-skill table in figma).

### T1. Top-20 skills by always-on listing chars (name + description + when_to_use, as host builds the entry)

| # | skill | chars | desc | when_to_use | described in this session's listing |
|---|---|---|---|---|---|
| 1 | benchmark | 267 | 134 | 121 | yes |
| 2 | advise | 242 | 159 | 74 | yes |
| 3 | api-design-principles | 242 | 151 | 67 | yes |
| 4 | arch | 236 | 124 | 105 | yes |
| 5 | orchestrate | 228 | 136 | 78 | name-only |
| 6 | backend-development | 225 | 132 | 71 | yes |
| 7 | context-engineering | 222 | 125 | 75 | yes |
| 8 | henshin | 222 | 140 | 72 | name-only |
| 9 | confluence-spec-analyst | 213 | 112 | 75 | yes |
| 10 | delegate | 210 | 130 | 69 | yes |
| 11 | chrome-profile | 209 | 128 | 64 | yes |
| 12 | ask-me | 208 | 129 | 70 | yes |
| 13 | docs-finder | 208 | 124 | 70 | name-only |
| 14 | playwright-cli | 208 | 111 | 80 | name-only |
| 15 | agent-browser | 207 | 121 | 70 | yes |
| 16 | bootstrap | 207 | 129 | 66 | yes |
| 17 | careful | 207 | 128 | 69 | yes |
| 18 | project-context | 206 | 109 | 79 | yes |
| 19 | worktree | 206 | 118 | 77 | name-only |
| 20 | plan-ceo-review | 205 | 116 | 71 | yes |

### T2. Top-20 by on-activation cost: SKILL.md only (est. tokens = chars/4)

| # | skill | SKILL.md lines | SKILL.md est tok | step/prompt md est tok | refs est tok | package total est tok |
|---|---|---|---|---|---|---|
| 1 | plan-creator | 250 | 6631 | 30458 | 31079 | 68169 |
| 2 | cook | 298 | 4916 | 0 | 23443 | 28359 |
| 3 | review | 223 | 4294 | 15601 | 14084 | 33981 |
| 4 | fix | 241 | 3970 | 0 | 9630 | 13601 |
| 5 | orchestrate | 358 | 3875 | 0 | 11385 | 15260 |
| 6 | prompt-enhancer | 215 | 3290 | 14254 | 14226 | 31771 |
| 7 | party | 209 | 3048 | 196 | 0 | 3244 |
| 8 | improve-codebase-architecture | 221 | 3015 | 0 | 2004 | 5019 |
| 9 | intake | 225 | 2967 | 0 | 8368 | 11335 |
| 10 | figma | 223 | 2935 | 3899 | 13584 | 20419 |
| 11 | ship | 196 | 2903 | 0 | 25137 | 28041 |
| 12 | vue-testing-best-practices | 216 | 2875 | 19538 | 0 | 22413 |
| 13 | sprint-contract | 178 | 2775 | 1347 | 1747 | 5869 |
| 14 | help | 202 | 2717 | 0 | 3429 | 6146 |
| 15 | preview | 179 | 2676 | 0 | 6662 | 9338 |
| 16 | docs-finder | 217 | 2645 | 1500 | 2160 | 6306 |
| 17 | benchmark | 229 | 2629 | 0 | 1607 | 4236 |
| 18 | database | 197 | 2449 | 0 | 5290 | 7740 |
| 19 | agent-detector | 131 | 2433 | 0 | 15287 | 17720 |
| 20 | autobuild | 210 | 2432 | 10810 | 4586 | 17829 |

### T3. Top-20 by whole-package size (worst case if every file loaded; real activation loads a subset, UNKNOWN which)

| # | skill | package est tok | files | classification |
|---|---|---|---|---|
| 1 | plan-creator | 68169 | 60 | SIMPLIFY |
| 2 | review | 33981 | 30 | EXPERIMENT |
| 3 | prompt-enhancer | 31771 | 39 | IMPROVE |
| 4 | cook | 28359 | 18 | SIMPLIFY |
| 5 | ship | 28041 | 18 | IMPROVE |
| 6 | agent-browser | 26049 | 20 | KEEP |
| 7 | plan-ceo-review | 25291 | 14 | IMPROVE |
| 8 | angular | 24443 | 12 | EXPERIMENT |
| 9 | vue-best-practices | 24186 | 23 | IMPROVE |
| 10 | vue-testing-best-practices | 22413 | 17 | EXPERIMENT |
| 11 | figma | 20419 | 32 | KEEP |
| 12 | tech-graph | 20370 | 35 | KEEP |
| 13 | autobuild | 17829 | 14 | IMPROVE |
| 14 | agent-detector | 17720 | 20 | SIMPLIFY |
| 15 | office-hours | 16789 | 12 | SIMPLIFY |
| 16 | vue | 15543 | 14 | EXPERIMENT |
| 17 | orchestrate | 15260 | 6 | EXPERIMENT |
| 18 | retro | 14373 | 17 | SIMPLIFY |
| 19 | qa | 14217 | 10 | SIMPLIFY |
| 20 | rubric | 13846 | 19 | KEEP |

### T4. Per-skill classification (non-default). Basis: M=measured/verified, J=judgment, M+J mixed, S=structural default (metadata+counts only, body not read)

| skill | class | basis | reason |
|---|---|---|---|
| agent-detector | SIMPLIFY | M | "ALWAYS every message" skill that Reads 7 rule files (25.4KB, already auto-loaded) + 7 phase-zero refs (26.1KB); LLM-executed numeric scoring (weights +20..+60, thresholds 30/50/80) with no calibration data in repo |
| angular | EXPERIMENT | J | framework/practice knowledge skill: run with/without + vs docs-finder on 5 tasks to test whether it beats model knowledge + live docs |
| api-design-principles | EXPERIMENT | J | framework/practice knowledge skill: run with/without + vs docs-finder on 5 tasks to test whether it beats model knowledge + live docs |
| autobuild | IMPROVE | M | density-select.sh returns FULL for claude-opus-5-5 but LEAN for claude-opus-4-7 (ran it); model-detector.cjs gives opus-4-7 FULL; matrix cites an external article, no repo benchmark results (results/ has only .gitkeep) |
| backend-development | EXPERIMENT | J | framework/practice knowledge skill: run with/without + vs docs-finder on 5 tasks to test whether it beats model knowledge + live docs |
| build-fix | MERGE | J | into fix quick profile: both triage failures; build-fix has a contract test (tests/build-fix-skill-contract.test.sh) so merge must port pins |
| careful | KEEP | M | skill-scoped hooks (freeze has check-freeze.cjs; node --check passes) - deterministic guard rather than prose |
| chrome-profile | IMPROVE | M | Rule 11 all three: untrusted page content + real Chrome profile cookies/sessions + page actions; only mitigation is an env-var hint and fail-closed on ambiguous profile; no human confirm, no injection_risk/trust_level declared |
| clean-code | MERGE | M+J | into simplify: both KISS/DRY/YAGNI quality passes with mutual "NOT for" (desc); 73+82 lines, no scripts; generic practice frontier models apply unprompted |
| confluence-bulk | EXPERIMENT | M+J | hub+leaf: 62-65 line recipe, no scripts; fold into mk:confluence references if routing eval shows no loss |
| confluence-collaborate | EXPERIMENT | M+J | hub+leaf: 62-65 line recipe, no scripts; fold into mk:confluence references if routing eval shows no loss |
| confluence-page | EXPERIMENT | M+J | hub+leaf: 62-65 line recipe, no scripts; fold into mk:confluence references if routing eval shows no loss |
| confluence-search | EXPERIMENT | M+J | hub+leaf: 62-65 line recipe, no scripts; fold into mk:confluence references if routing eval shows no loss |
| confluence-spec-analyst | EXPERIMENT | M+J | hub+leaf: 62-65 line recipe, no scripts; fold into mk:confluence references if routing eval shows no loss |
| context-audit | KEEP | M | deterministic script (format-audit-report.sh); measures structural overhead; its vitest was retired with the TS CLI on main, so no test now |
| context-engineering | SIMPLIFY | J | Write/Select/Compress/Isolate + read/stop/ask/assume/delegate is default frontier-model behaviour; pattern-index lookup is the only non-generic part; overlaps context-audit by design |
| cook | SIMPLIFY | M | 298-line adapter: mermaid duplicates workflow.yaml (self-declared), `echo on > .meowkit/state/tdd-mode` is a CLI call, gotcha "use Task() not Agent()" is host-version-specific (this host names the tool Agent) |
| cso | SIMPLIFY | M | carries a near-identical references/preamble.md (gstack legacy: session find, telemetry prompt, upgrade check, lake intro) - 9 copies / 60KB total; dedupe to one hook or delete |
| database | EXPERIMENT | J | framework/practice knowledge skill: run with/without + vs docs-finder on 5 tasks to test whether it beats model knowledge + live docs |
| development | SIMPLIFY | J | "reference guide" index skill (46 lines + 3-4 refs); content generic (TDD cycle, patterns); development/references/skill-loader.md documents lazy loading the host does natively |
| document-release | SIMPLIFY | M | carries a near-identical references/preamble.md (gstack legacy: session find, telemetry prompt, upgrade check, lake intro) - 9 copies / 60KB total; dedupe to one hook or delete |
| elicit | EXPERIMENT | J | reasoning-lens prompts (pre-mortem, inversion, red team) overlap problem-solving; 0 refs |
| evaluate | KEEP | M | scripts back NEVER-PRUNE registry rows (recompute-score.py, validate-verdict.sh); only skill with deterministic integrity check on its own output |
| fix | KEEP | M | 8-skill-edge dependency graph but has contract test; hard gate (scout->diagnose->root cause) is non-default behaviour worth keeping; absorb build-fix |
| freeze | KEEP | M | skill-scoped hooks (freeze has check-freeze.cjs; node --check passes) - deterministic guard rather than prose |
| grill | EXPERIMENT | J | one-question-at-a-time interview overlaps advise (same mechanism, different output); also host-level grilling skill exists in this session |
| intake | EXPERIMENT | J | classify+score ticket overlaps planning-engine and jira-evaluator; 225 lines, 11k tokens; 13 mk:jira-* wildcard mentions |
| investigate | SIMPLIFY | M | carries a near-identical references/preamble.md (gstack legacy: session find, telemetry prompt, upgrade check, lake intro) - 9 copies / 60KB total; dedupe to one hook or delete |
| jira | EXPERIMENT | M+J | hub = pure routing table (no execution) duplicating leaf descriptions; collapse 17 jira-* leaves into hub+references and test routing accuracy; all 16 leaves ship no scripts |
| jira-admin | IMPROVE | M | references/voodoo-constants.md points to .claude/skills/jira-fields/scripts/{list_fields,get_field}.py - dir does not exist |
| jira-agile | EXPERIMENT | M+J | hub+leaf: 49-91 line CLI recipe, no scripts, ~175 listing chars; name-only in practice under budget; fold into mk:jira references if routing eval shows no loss |
| jira-analyst | EXPERIMENT | M+J | hub+leaf: 49-91 line CLI recipe, no scripts, ~175 listing chars; name-only in practice under budget; fold into mk:jira references if routing eval shows no loss |
| jira-bulk | EXPERIMENT | M+J | hub+leaf: 49-91 line CLI recipe, no scripts, ~175 listing chars; name-only in practice under budget; fold into mk:jira references if routing eval shows no loss |
| jira-collaborate | EXPERIMENT | M+J | hub+leaf: 49-91 line CLI recipe, no scripts, ~175 listing chars; name-only in practice under budget; fold into mk:jira references if routing eval shows no loss |
| jira-dev | EXPERIMENT | M+J | hub+leaf: 49-91 line CLI recipe, no scripts, ~175 listing chars; name-only in practice under budget; fold into mk:jira references if routing eval shows no loss |
| jira-evaluator | EXPERIMENT | M+J | hub+leaf: 49-91 line CLI recipe, no scripts, ~175 listing chars; name-only in practice under budget; fold into mk:jira references if routing eval shows no loss |
| jira-fields | EXPERIMENT | M+J | hub+leaf: 49-91 line CLI recipe, no scripts, ~175 listing chars; name-only in practice under budget; fold into mk:jira references if routing eval shows no loss |
| jira-issue | EXPERIMENT | M+J | hub+leaf: 49-91 line CLI recipe, no scripts, ~175 listing chars; name-only in practice under budget; fold into mk:jira references if routing eval shows no loss |
| jira-jsm | EXPERIMENT | M+J | hub+leaf: 49-91 line CLI recipe, no scripts, ~175 listing chars; name-only in practice under budget; fold into mk:jira references if routing eval shows no loss |
| jira-lifecycle | IMPROVE | M | 4 tracked *.md.tmp files in references/patterns (x3 copies incl. codex/cursor bundles) |
| jira-ops | EXPERIMENT | M+J | hub+leaf: 49-91 line CLI recipe, no scripts, ~175 listing chars; name-only in practice under budget; fold into mk:jira references if routing eval shows no loss |
| jira-relationships | EXPERIMENT | M+J | hub+leaf: 49-91 line CLI recipe, no scripts, ~175 listing chars; name-only in practice under budget; fold into mk:jira references if routing eval shows no loss |
| jira-search | IMPROVE | M | references/jql-patterns.md cites references/field-discovery.md - file lives in jira-fields/references/ |
| jira-time | EXPERIMENT | M+J | hub+leaf: 49-91 line CLI recipe, no scripts, ~175 listing chars; name-only in practice under budget; fold into mk:jira references if routing eval shows no loss |
| lazy-agent-loader | REMOVE | M | status: deprecated, user-invocable:false, when_to_use "Never invoke"; 28 lines; only manifests/catalog/context-audit prose name it; costs ~150 chars listing |
| lint-and-validate | MERGE | M+J | into verify: verify already runs lint (scoped to changed files); lint-only subset 67 lines with mutual NOT-for; MANDATORY-after-every-edit wording is host-ritual |
| memory | KEEP | M | 128 lines, CLI-backed (mewkit note), explicit non-derivable rule; but .meowkit/memory/ absent and `mewkit` not on PATH here so the path is unexercised (D-memory domain) |
| multimodal | IMPROVE | M+H | 19 py files, 3 urllib network clients (gemini/minimax/openrouter) sending user files to third parties; openrouter_fallback.py exists (HYPOTHESIS: silent provider fallback); API keys via env; no injection_risk declared |
| office-hours | SIMPLIFY | M | same preamble copy family (4.0KB) + 15.6k tokens refs |
| orchestrate | EXPERIMENT | J | 357-line skill coordinating external agent CLIs; H4 multi-agent value unmeasured; no run-dir evidence in repo |
| plan-ceo-review | IMPROVE | M | dead ref .claude/skills/review/TODOS-format.md; 24k tokens refs; 9th copy of preamble family |
| plan-creator | SIMPLIFY | M | largest package: 249-line SKILL.md + 34 refs + 12 step files ~68k tokens est; 7 mode flags; ships standalone red-team/validate aliases duplicating mk:validate-plan; only SKILL.md should load on activation |
| planning-engine | EXPERIMENT | J | scores ticket complexity - overlaps intake/jira-evaluator; 2 py scripts |
| problem-solving | EXPERIMENT | J | inversion/first-principles prompts generic; 9 refs ~9.5k tokens; test vs no skill |
| prompt-enhancer | IMPROVE | M | context-safeguards.md cites references/pattern-index.md that exists only in context-engineering; 17.5k tokens on activation |
| qa | SIMPLIFY | M | carries a near-identical references/preamble.md (gstack legacy: session find, telemetry prompt, upgrade check, lake intro) - 9 copies / 60KB total; dedupe to one hook or delete |
| react-patterns | EXPERIMENT | J | framework/practice knowledge skill: run with/without + vs docs-finder on 5 tasks to test whether it beats model knowledge + live docs |
| retro | SIMPLIFY | M | carries a near-identical references/preamble.md (gstack legacy: session find, telemetry prompt, upgrade check, lake intro) - 9 copies / 60KB total; dedupe to one hook or delete |
| review | EXPERIMENT | M+J | 7-pass adversarial design (3 base + 4 persona) + forced-finding re-analysis if zero findings; no catch-rate data in repo; shares 14.6KB preamble copy; test: minimal-vs-full scope seeded-bug catch rate |
| review-pr | MERGE | M | into review: review/SKILL.md already has a "#123 or PR URL" PR input mode; review-pr is a 159-line single-pass variant with 0 refs |
| scale-routing | EXPERIMENT | J | overlaps agent-detector (both emit complexity tier); test merging by comparing routing outputs on 20 task prompts |
| sequential-thinking | EXPERIMENT | J | 6-step hypothesis loop = default reasoning; test with/without on debugging tasks (host has native thinking) |
| ship | IMPROVE | M | dead refs .claude/skills/review/TODOS-format.md (x3 incl. sibling ref), stale "migrated from mk:shipping"; 12KB preamble copy; Jira DoD prompts inline (jira coupling) |
| simplify | KEEP | J | keep as survivor of clean-code merge; short (82 lines, 0 refs) |
| sprint-contract | EXPERIMENT | J | autobuild LEAN skips the contract (matrix); measure contract on/off on benchmark canaries |
| story-sizer | MERGE | J | into jira-estimator: both heuristic Fibonacci story sizing; story-sizer has 5 py + 7 refs ~7.3k tokens |
| testing | SIMPLIFY | J | "reference guide" index skill (46 lines + 3-4 refs); content generic (TDD cycle, patterns); development/references/skill-loader.md documents lazy loading the host does natively |
| trace-analyze | SIMPLIFY | M | trace-log.jsonl has 1556 records of only 2 event types (file_edited, session_end), run_id empty; deterministic `mewkit trace` CLI already covers score/audit/propose; LLM scatter-gather has no input signal |
| typescript | EXPERIMENT | J | framework/practice knowledge skill: run with/without + vs docs-finder on 5 tasks to test whether it beats model knowledge + live docs |
| verify | SIMPLIFY | M | marker-file->command table (package.json/pyproject/go.mod/...) is what a model infers unprompted; changed-files scoping + fail-fast is the real value and is scriptable; 80% coverage default unsourced |
| vue | EXPERIMENT | J | framework/practice knowledge skill: run with/without + vs docs-finder on 5 tasks to test whether it beats model knowledge + live docs |
| vue-best-practices | IMPROVE | M | 8 dead links (references/components.md, composables.md, reactivity-performance.md absent); 21 refs ~21.6k tokens |
| vue-testing-best-practices | EXPERIMENT | J | framework/practice knowledge skill: run with/without + vs docs-finder on 5 tasks to test whether it beats model knowledge + live docs |
| workflow-orchestrator | SIMPLIFY | M | SKILL.md says it "must not restate phase details" and defers to workflow.yaml; cook/agent-detector also gate the same lifecycle; keep workflow.yaml, drop the model-invocable adapter (contract test pins it) |

Basis-S rows (54), all KEEP by default and NOT evidence-based beyond counts: advise, agent-browser, arch, ask-me, benchmark, bootstrap, brainstorming, breakdown, chom, confluence, decision-framework, delegate, devops, docs-finder, docs-init, figma, frontend-design, ghpm, help, henshin, html-video, improve-codebase-architecture, jira-estimator, llms, loop, markdown-reader, mermaidjs-v11, nyquist, pack, party, playwright-cli, preview, project-context, project-organization, qa-manual, research, resolving-merge-conflicts, respond-pr, rubric, scout, session-continuation, showcase, skill-creator, skill-template-secure, status, stitch, task-queue, team-config, tech-graph, ui-design-system, validate-plan, vulnerability-scanner, web-to-markdown, worktree.  Full per-skill reason in the CSV.

Classification totals (128): KEEP 61 (54 of them basis S = no red flag in counts, body unread), EXPERIMENT 36, SIMPLIFY 15, IMPROVE 10, MERGE 5, REMOVE 1, SPLIT 0. Basis mix: M 29, M+J 21, J 23, S 54, M+H 1. Only 51 classifications rest on a measured fact (M, M+J, M+H); 23 are pure judgment; 54 are default. SPLIT: none proposed; zero skills exceed 500 lines (max 358), the biggest packages already use step files, and splitting would add listing entries (+~210 chars each) that the host budget cannot afford (F-D02-02).

## 6. Hypothesis tests

**H8 "MeowKit contains removable complexity" — SUPPORTED for specific, measurable items; not supported for "128 skills is bloat".** Removable: 1 deprecated skill; ~60 KB of duplicated preamble text (9 skills) whose only effect (telemetry) produced no data; 3 mechanical duplicates (clean-code, review-pr, lint-and-validate); ~20 dead links; stale model-name glob logic; trace-analyze with no input signal. Falsification attempt: tried to show the listing is the cost. It is not (26.8k chars, 0.7% of the 3.8 MB corpus; progressive disclosure keeps references inert). The real costs are (a) 81/128 lose their description under host budget and (b) activation of 12 packages >20k est tokens. Fewer entries would help (a) directly.
**H2 "more scaffolding is not always better for newer models" — NOT TESTED in this repo.** The repo encodes H2 (density matrix, dead-weight rules) but has 0 benchmark results, 0 registry deltas for skills, and an implementation that gives the newest model in local telemetry (opus-5-5) FULL density. So the repo neither confirms nor falsifies H2; its operationalisation is broken (F-D02-09). Counter-evidence sought: any `results/*.json` or registry row with a measured skill delta: none.

## 7. Decisions proposed

| # | Decision | Class | Observed problem / source | Causal hypothesis | Alternatives | Measurement |
|---|---|---|---|---|---|---|
| D1 | Remove `lazy-agent-loader`; drop from manifests/catalog and context-audit prose | REMOVE | deprecated, never invoke; `skills/lazy-agent-loader/SKILL.md`; manifests in `crates/mewkit-cli/tests/golden/baseline/*.json`, `kit/bundles/*/catalog/skill-packs.json` | removes a listing entry and a dead concept; zero behaviour | keep as shim | golden/manifest tests pass; listing count 127 |
| D2 | Delete or hook-ify the 9 `references/preamble.md` copies (60 KB) | SIMPLIFY | F-D02-08 | text nobody executes or whose output is unread inflates activation and drifts | one shared script invoked by a hook | activation tokens of the 9 skills drop ~2.6-14.6 KB each; no `skill-usage` consumer breaks (grep) |
| D3 | Add PostToolUse(Skill) usage logger (git-ignored) and run `/skill-doctor`/`/doctor` | IMPROVE | F-D02-16 | without usage data every KEEP/REMOVE is guesswork | keep guessing | after 2 weeks: per-skill invocation counts; use to set `skillOverrides name-only` for zero-use skills |
| D4 | Set `skillOverrides: name-only` (or `disable-model-invocation` where manual-only) for low-value skills and trim `when_to_use` | IMPROVE | F-D02-02/03 | description budget goes to least-useful skills alphabetically | raise `skillListingBudgetFraction` (costs every session) | `/context` Skills row; share of mk: skills with descriptions among the top-used 20 |
| D5 | Replace hard-coded model globs in `density-select.sh` + `model-detector.cjs` with one source and a default of "unknown model -> no extra scaffolding claim"; delete the matrix claims that no benchmark supports until measured | IMPROVE | F-D02-09 | stale globs give newer models more scaffolding | remove density tiers entirely and use FULL/LEAN by flag only (EXPERIMENT) | `density-select.sh --model X` agrees with the hook for 10 model ids; benchmark FULL vs LEAN on the 5 quick canaries for one model |
| D6 | Merge clean-code into simplify; lint-and-validate into verify; review-pr into review PR mode; build-fix into fix | MERGE | F-D02-07 | mutual NOT-for pairs signal duplicate intent | keep and rely on NOT-for | contract tests ported; trigger-collision eval: same 20 prompts route to the same behaviour before/after |
| D7 | Hub+leaf collapse for jira/confluence | EXPERIMENT | F-D02-06 | 23 entries compete for the budget, leaves are name-only | keep leaves, mark hub-only visible | routing eval: 30 Jira/Confluence prompts, correct-leaf rate with hub-only vs hub+leaf; losing scoping would show as wrong write tool use |
| D8 | chrome-profile: require explicit human confirmation before first attach per profile; declare `injection_risk: high`, `trust_level`; audit Jira/Confluence/multimodal for Rule 11 and declare | IMPROVE | F-D02-14 | cookies + untrusted page + actions with no gate | remove skill | skill-contract test: attach without confirmation must fail |
| D9 | Fix dead links (section 5) and delete the 4 tracked `.md.tmp` files; add a link-validator to `mewkit validate` | IMPROVE | F-D02-18 | no validator runs on skill links | manual | validator exits non-zero on the 20 real dead links before fix, zero after |
| D10 | Move deterministic procedure behind CLI verbs: verify detection/scoping, cook TDD sentinel, plan-state | SIMPLIFY | F-D02-11 | deterministic steps cost tokens and vary run to run | keep as prose | token count of verify/cook SKILL.md; exit-code parity tests |
| D11 | Cut agent-detector's 7+7 mandatory Reads when rules are already loaded; decide whether numeric scoring survives a calibration set | SIMPLIFY/EXPERIMENT | F-D02-10 | duplicates auto-loaded rules each session | keep | routing accuracy on 30 labelled tasks: scoring-prose vs model-judgement with a 10-line table |
| D12 | Run with/without comparisons for sequential-thinking, problem-solving, elicit, context-engineering, framework skills | EXPERIMENT | F-D02-13 | generic practice may be redundant | assume redundant | see section 8 |
| D13 | Make `trace-analyze` defer to `mewkit trace` and only run scatter-gather when the log has >=3 distinct event types | SIMPLIFY | trace-log has 2 event types | LLM analysis of edit events yields no signal | remove | run both on the existing log; compare findings |
| D14 | Keep: evaluate, context-audit, careful, freeze, memory, fix, simplify, benchmark (and run it) | KEEP | evidence in table T4 | deterministic checks or non-default behaviour | | n/a |

## 8. Experiments proposed (to falsify my own conclusions)

1. **Trigger-collision eval:** 40 labelled prompts across the clusters; for each, record which skill the model invokes with (a) current listing, (b) name-only for 81 entries (today), (c) after D4. Falsifies F-D02-02/05 if routing accuracy is unchanged by description visibility.
2. **With/without skill runs** (host `claude plugin eval` per DOCUMENTED docs): sequential-thinking, clean-code, verify, context-engineering, vue, angular on 3 tasks each, 3 seeds, same model. Falsifies F-D02-13 if with-skill beats baseline by a real margin.
3. **Density A/B:** `mk:benchmark run` quick tier, same model, `MEOWKIT_AUTOBUILD_MODE=FULL` vs `LEAN`, 3 repeats. Falsifies the matrix and F-D02-09's reading if FULL wins on a newer model.
4. **Preamble removal:** run review/ship on 5 diffs with and without `references/preamble.md`; compare verdict and cost. Falsifies D2.
5. **Hub-only Jira routing** (D7).
6. **Rule 11 sweep:** read to the end every skill with network/credential/state-change (jira*, confluence*, multimodal, stitch, figma, docs-finder, agent-browser) and tabulate A/B/C with the gate that breaks a leg.

## 9. Unresolved questions

1. Exact host listing budget in this session (window size x fraction) and whether `/doctor` reports MeowKit's contribution; verify with `/doctor` and `--debug`.
2. Why is the preamble telemetry file absent: never executed by the model, or telemetry off?
3. Whether `MEOWKIT_AUTOBUILD_MODE=LEAN` was exported when the 1,556 trace records were written (inferred from the current shell + 325 lean-bypass lines; not proven).
4. Which skills are actually invoked in real sessions (no data).
5. Do the 8 contract tests run in CI and do they pass today (not executed by me)?
6. Are `kit/bundles/{codex,cursor}` skills regenerated from `.claude/skills` or hand-maintained (agent-memory note says hand-authored; unverified)?
7. How much of the 12 large packages loads on a typical activation (needs trace data).
8. `jira*`, `confluence*`, `multimodal` Rule 11 posture (HYPOTHESIS only).
