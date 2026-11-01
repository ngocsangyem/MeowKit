---
contract_schema_version: 1.0.0
task: meowkit-v3-lean-runtime
sprint: 2
plan_ref: tasks/plans/261101-meowkit-v3-lean-runtime/plan.md
rubric_preset: cli-tool
status: signed
generator_signed: b4d9ffbd5f9fc87c5c93d94f72c7fee9fdfb050d
evaluator_signed: b0c15db7f4d4afcf96811fbbedfd80075efb203b
rounds: 2
created: 261102-0031
---

# Sprint 2 Contract — Context diet: always-on rules ≤25 600 B, no kit-owned CLAUDE.md

Testable translation of `phase-01-context-diet.md` (Rule Destination Table, Requirements, Success Criteria),
with two user decisions recorded 261102.

## Decisions (user, 261102)

- D1 Benchmark: no benchmark run in this sprint. The phase-01 benchmark criterion is recorded as "not measured" and
  surfaces as a WARN at Gate 2; safety is measured by the rule-survival, budget and dangling-reference checks.
- D2 Destinations amended for two rows of the phase-01 table: `skill-authoring` moves into the skill-creator skill's
  references and `dead-weight-audit` into the benchmark skill's references (both still shipped, loaded only when that
  skill runs). `docs-reference-contract` stays source-repo only as the table says.

## Pinned baseline

- BASE = `b225a319699fdffce38f8c0ac63e30465a31137c` (Phase 08 commit, last commit before this sprint's contract).
  Every "pre-sprint" reference below means BASE. "Clean `main`" re-runs in AC-11 and AC-12 use a detached worktree at
  `main`; a failure is pre-existing only if it also fails there.

## Scope (In)

- The always-on rule set shipped to a user project is exactly: a new core rule (replaces the kit-owned `CLAUDE.md`),
  security, injection, gate (with intervention-recording merged in), core-behaviors (with anti-rationalization merged
  in), development, and agent-conduct (A1, A3, B2 only)
- Every other rule moves to its destination per the phase-01 table as amended by D2, with an explicit load step in
  every consuming skill or agent
- The kit-owned root `CLAUDE.md` is no longer shipped, created or required by install, upgrade or validation; the
  source repo keeps its own maintainer `CLAUDE.md`
- Upgrading a v2 project removes the moved rule files from `.claude/rules/` through the existing update and
  orphan-cleanup path, without touching user-modified files
- New mechanical checks: always-on budget, rule survival, dangling references (both directions), wired into CI; the
  context-budget estimator reports the new always-on set
- Every validator, inventory, workflow source and docs page that depended on a moved file is updated
- Codex and Cursor bundles mirror the change
- Destination table: every MUST / NEVER / ALWAYS line of the 25 BASE rules and the BASE `CLAUDE.md` mapped to where it
  now lives

## Scope (Out)

- Benchmark baseline and post-change benchmark (D1)
- Skill and agent metadata budget and the ≤70 KB always-listed total (phase 07 owns metadata)
- `tests/hooks/golden` recorded corpus (phase-01 Success Criterion "Phase 02 safety golden tests green"): phase 02
  creates it when it ports the hooks; this sprint changes no hook logic, which AC-14 checks with the existing tests
- Node-only hook port, config.yaml, kit artifact, lazy Python, CLI verb cut, kit shape (phases 02–07)
- Any new v2→v3 migration or port layer (plan Decision 5); AC-08(d) rides the existing update and orphan cleanup only
- Fixing the release archive's missing `harness-inventory.json` for non-full profiles (pre-existing, recorded as an open item)
- New rules, new enforcement, or any behavior change to Gate 1, Gate 2, privacy or pre-ship hooks

## Acceptance Criteria

### [AC-01] Fresh install loads ≤25 600 bytes of always-on rules and no kit CLAUDE.md

**Given** a temp directory initialized with the freshly built CLI from the local kit (default profile)
**When** the always-on rule bytes are summed and the project root is listed
**Then** `ls -A .claude/rules` returns exactly the 7 files named in Scope (In), with zero subdirectories and zero non-`.md` entries; `cat .claude/rules/*.md | wc -c` ≤ 25 600; no root `CLAUDE.md` exists

- **Verification:** init into a scratch dir from the local build; `ls -A .claude/rules`; `find .claude/rules -mindepth 1 -type d | wc -l` = 0; `cat .claude/rules/*.md | wc -c`; `test ! -e CLAUDE.md`
- **Rubric tie-in:** functionality (weight 0.40)

### [AC-02] Rule-survival check guards the named safety text

**Given** the rule-survival check added in this sprint
**When** it runs against the always-on set, and again against temp copies with one pinned item removed (one each: an injection-rules `Rule N` heading, a security-rules blocked-pattern table row, a numbered Gate 1 or Gate 2 condition, a line of the agent-conduct A1 block, a core-behaviors numbered heading, a development-rules pinned phrase)
**Then** it exits 0 on the real set and non-zero naming the missing item on each of the 6 mutations. Its oracle is pinned to: injection-rules headings Rule 1–Rule 11; all 12 rows of the BASE security-rules blocked-pattern table; Gate 1 conditions 1–4 and Gate 2 conditions 1–5; the A1 status block and status table verbatim; the 6 BASE core-behaviors headings `1. Surface Assumptions` … `6. Verify, Don't Assume`; one key phrase for each of the 15 MUST/NEVER/ALWAYS lines of BASE development-rules (15 phrases)

- **Verification:** run the check; run it on 6 mutated temp copies; the check's source is reviewed against the pinned oracle — an oracle with fewer items than listed is a FAIL
- **Rubric tie-in:** functionality (weight 0.40)

### [AC-03] Budget check fails over budget

**Given** the always-on budget check added in this sprint, wired into CI
**When** it runs on the real set, and on a temp copy padded to 25 601 bytes
**Then** exit 0 on the real set, non-zero on the padded copy. Pinned oracle: the measured set is every `.md` at any depth under `.claude/rules/` of the measured tree; the limit is the literal constant 25 600; the output prints the measured total; that total equals an independent `find .claude/rules -name '*.md' -exec cat {} + | wc -c` on the same tree

- **Verification:** run both; compare reported total with the independent count; review the check's source against the oracle; inspect the CI workflow for the step
- **Rubric tie-in:** functionality (weight 0.40)

### [AC-04] Zero dangling references to moved or removed rule paths

**Given** the 19 rule files that leave `.claude/rules/` (harness-rules, tdd-rules, phase-contracts, post-phase-delegation, task-state-emission, parallel-execution-rules, orchestration-rules, model-selection-rules, scale-adaptive-rules, risk-checklist, agent-routing, context-budget-rules, step-file-rules, rubric-rules, skill-authoring-rules, docs-reference-contract, dead-weight-audit-rules, anti-rationalization, intervention-recording-rules)
**When** the dangling-reference check scans the roots `.claude/`, `packages/mewkit/src/` (tests excluded; includes both provider bundles), `docs/`, `packages/docs/` (content, scripts and manifests), `scripts/`, `.github/`, `.meowkit/` and the root `README.md`, `RELEASING.md`, `CLAUDE.md`
**Then** (a) 0 matches of `rules/<moved>.md` for any moved name; (b) in `.claude/` and the bundles, every bare `<moved>.md` mention is part of a path to the file's new location (a mention of the source-repo-only contract or a merged rule by bare name is 0); (c) every moved file except the source-repo-only contract and the two merged rules is referenced by ≥1 load step. Exemptions, exhaustive: `packages/docs/content/docs/changelog/archive.mdx`, `docs/archive/**` (historical records, not rewritten), the destination table, the rules-index moved-rules table, `tasks/**`

- **Verification:** run the check; independent `grep -rnE 'rules/(<names>)\.md'` over the same roots minus exemptions → 0; independent grep for bare names in `.claude/` and bundles, each hit inspected for a new-location path; for (c) grep each new path
- **Rubric tie-in:** product-depth (weight 0.25)

### [AC-05] Consuming skills load moved rules just in time

**Given** the destination table
**When** these consumer → moved rule tuples are checked: cook → harness, tdd, phase-contracts, post-phase-delegation, task-state-emission, parallel-execution, orchestration; autobuild → harness, phase-contracts, post-phase-delegation, parallel-execution; agent-detector → model-selection, scale-adaptive, risk-checklist, agent-routing, context-budget; evaluator agent → rubric; skill-creator → skill-authoring; benchmark → dead-weight-audit; workflow.md of plan-creator, review, evaluate, autobuild, trace-analyze → step-file contract inline
**Then** each of the 24 tuples is satisfied: the consumer file contains a step naming the new path (for the 5 workflow.md tuples, the step-file contract text itself); agent-detector's safety-baseline step reads exactly the 7 always-on files and no removed path

- **Verification:** grep each consumer for its new path(s); count satisfied tuples = 24; read agent-detector Step 0
- **Rubric tie-in:** product-depth (weight 0.25)

### [AC-06] Every enforcement line has a recorded destination

**Given** the destination table committed with this sprint
**When** each MUST / NEVER / ALWAYS line from the 25 BASE rules and BASE `CLAUDE.md` is looked up
**Then** each row names the destination file, and the line's meaning is present there (verbatim or compressed); rows marked "duplicate" name the surviving copy. Row count ≥ the summed `git show BASE:<file> | grep -cE 'MUST|NEVER|ALWAYS'` over the 26 files

- **Verification:** compute the count at BASE; compare with the table; sample ≥15 rows across ≥8 source files and check the destination text
- **Rubric tie-in:** product-depth (weight 0.25)

### [AC-07] Core rule replaces CLAUDE.md within 4 KB

**Given** the new core rule
**When** its size and content are checked
**Then** ≤ 4 096 bytes; contains the role, the workflow line, pointers to gate and security rules, the ≤3-line memory read/write summary, and the Compaction Policy section verbatim from BASE `CLAUDE.md`

- **Verification:** `wc -c`; diff the Compaction Policy block against `git show BASE:CLAUDE.md`
- **Rubric tie-in:** functionality (weight 0.40)

### [AC-08] Install, upgrade and validate no longer require CLAUDE.md; upgrade cleans moved rules

**Given** the built CLI
**When** (a) the release archive and release manifest are generated, (b) a fresh init runs, (c) `validate` and install validation run on that project, (d) a v2-shaped project (all 25 BASE rules, one of them user-modified, plus a user-written root `CLAUDE.md`) is upgraded from the local kit
**Then** (a) neither contains root `CLAUDE.md`; (b) no `CLAUDE.md` is created; (c) no check fails for a missing `CLAUDE.md` or for having 7 rules; (d) through the existing update, deletion-list and orphan-cleanup path only, the unmodified moved rule files are removed, the user-modified one is kept and reported, and the user's `CLAUDE.md` is byte-identical

- **Verification:** run the release-asset and manifest scripts to a temp dir and list contents; scripted init/upgrade in scratch dirs; `shasum -a 256` before/after; confirm no new migration module in the diff
- **Rubric tie-in:** functionality (weight 0.40)

### [AC-09] Validators and the budget estimator follow the new layout

**Given** the finished change
**When** `validate` (default), `--workflow`, `--gates`, `--ownership`, `--agents`, `--packs`, `--substrate`, `--rules`, `inventory --check`, the docs-reference check (Python and TS), the rule-availability check, the hook-registration check, the docs `check:stale`, and `mewkit context-budget` run in the kit repo; and the docs-reference check and `mewkit context-budget` run in a fresh user project
**Then** all pass in the kit repo; in the user project the docs-reference check reports N/A (contract absent) instead of failing; `context-budget` reports an always-on tier equal to the AC-01 byte total with no `CLAUDE.md` term; the old unenforced 131 000 guardrail in CI is replaced by the AC-03 check (one budget number remains)

- **Verification:** run each command; record output in verdict evidence; grep CI for both budget steps
- **Rubric tie-in:** functionality (weight 0.40)

### [AC-10] Hooks do not re-inject removed text

**Given** captured SessionStart, UserPromptSubmit and PreCompact hook output from a fresh init project
**When** it is grepped for the names of the 19 moved rules and for `CLAUDE.md` as a required file
**Then** 0 matches; the safety-baseline marker still appears

- **Verification:** run each hook with sample stdin in a scratch project; grep output
- **Rubric tie-in:** functionality (weight 0.40)

### [AC-11] Codex and Cursor bundles stay consistent

**Given** the mirrored bundles
**When** the migrate test suite and `validate --target codex|cursor` run
**Then** migrate tests pass; each bundle `AGENTS.md` contains the core rule's Compaction Policy and gate/security pointers; the bundles satisfy AC-04 (a) and (b) with the same patterns; `validate --target` shows no failure absent from the clean-`main` baseline recorded in verdict evidence

- **Verification:** `vitest run src/migrate`; both validate targets on branch and on clean `main`; the AC-04 greps scoped to the bundles
- **Rubric tie-in:** functionality (weight 0.40)

### [AC-12] Whole suite, typecheck, lint and CI runner are green

**Given** the finished change
**When** build, typecheck, lint, the full vitest suite and every CI workflow step run locally
**Then** all pass, except failures listed as pre-existing in the review verdict's evidence file — one line per failing step, each with the output of the same command re-run on clean `main`; any failure not on that list is a FAIL

- **Verification:** run each; re-run failures on clean `main`; compare sets
- **Rubric tie-in:** code-quality (weight 0.15)

### [AC-13] Docs tell a user where each rule went

**Given** the docs site rules index, `docs/` rule pages and the maintainer `CLAUDE.md`
**When** they are read
**Then** the rules index lists exactly the 7 always-on rules plus a moved-rules table naming each of the 19 with its new home; no page under `docs/` or `packages/docs/content/` (exemptions as AC-04) says a user project gets a kit `CLAUDE.md`; the maintainer `CLAUDE.md` names the source-repo-only contract's location

- **Verification:** grep the rules index for all 26 names; grep docs for `CLAUDE.md` claims about user projects; grep maintainer `CLAUDE.md`
- **Rubric tie-in:** ux-usability (weight 0.20)

### [AC-14] Safety hook behavior is unchanged

**Given** the hook tests `packages/mewkit/src/__tests__/hooks/gate-enforcement.integration.test.ts`, `packages/mewkit/src/__tests__/hooks/privacy-block.integration.test.ts`, `.claude/hooks/__tests__/gate2-ship-boundary.test.cjs` and `.claude/hooks/__tests__/pre-ship-memory-lint.test.cjs`
**When** they run, and the diff BASE..HEAD of the gate-enforcement, privacy-block, pre-ship and gate2-check hook scripts is inspected
**Then** all four pass; the hook diff touches only comments or rule-path wording (no exit code, marker or condition change)

- **Verification:** run the four tests; `git diff BASE -- <hook files>`
- **Rubric tie-in:** functionality (weight 0.40)

### [AC-15] New and changed code meets the mechanical quality bar

**Given** the sprint diff BASE..HEAD
**When** every new or changed `.ts`, `.cjs`, `.mjs`, `.py` and `.sh` file is inspected
**Then** each new file is ≤200 lines and no changed file grows past 200 lines because of this sprint; 0 `any` in changed TypeScript lines; 0 new TODO/FIXME; 0 commented-out code blocks; 0 unused imports reported by lint; 0 hardcoded secrets; each new check script exits non-zero with a message on unreadable input

- **Verification:** `git diff --stat BASE`; `wc -l` new files; grep added lines for `: any\b|as any|TODO|FIXME`; lint output; run each new check against a nonexistent path
- **Rubric tie-in:** code-quality (weight 0.15)

## Out-of-Scope Clarifications

- Do not change the meaning of any always-on enforcement sentence; compression drops rationale, examples and duplicate tables only. If the set cannot fit 25 600 B without losing an enforcement sentence, stop and ask the user (phase-01 step 8)
- Do not touch skill or agent frontmatter descriptions (phase 07)
- Do not rewrite changelog history (`changelog/archive.mdx`, `docs/archive/**`)
- Do not fix the non-full-profile `harness-inventory.json` archive gap; report it
- Do not edit the plan directory beyond phase-01 checkboxes, status and a decisions note

## Rubric Bindings

- functionality: AC-01, AC-02, AC-03, AC-07, AC-08, AC-09, AC-10, AC-11, AC-14
- product-depth: AC-04, AC-05, AC-06
- code-quality: AC-12, AC-15
- ux-usability: AC-13

## Negotiation Log

- Round 1 (proposer/generator): initial draft from phase-01 spec + cli-tool preset + user decisions D1, D2
- Round 1 (reviewer/evaluator): AC-03 the budget check is authored in this sprint and is its own judge, so "exit 0 on the real set" is satisfiable by narrowing what the check measures (same defect I flagged on sprint-1 AC-04). Pin the oracle: the measured set is every `.md` at any depth under `.claude/rules/` in a fresh-init project, the limit constant is literally 25 600, the failure message prints the measured total, the check's own source is reviewed against that oracle, and an independent `wc -c` cross-check must equal the total the check reports
- Round 1 (reviewer/evaluator): AC-01 `wc -c .claude/rules/*.md` is non-recursive and "holds exactly the 7 files" is ambiguous about non-`.md` entries, so always-on bytes can be parked in `.claude/rules/<subdir>/` and still pass. State the binary form: `ls -A .claude/rules` returns exactly those 7 entries, zero subdirectories, zero non-`.md` files
- Round 1 (reviewer/evaluator): AC-06 and AC-07 both name `<pre-sprint>` as a placeholder, so the oracle for the MUST/NEVER count and for the Compaction Policy diff can be chosen after the result is known. Pin one SHA in the contract (frontmatter or a Decisions line) and reference it from AC-06, AC-07, and as the base of the "clean `main`" re-runs in AC-11/AC-12
- Round 1 (reviewer/evaluator): AC-04 the scan roots (`.claude/`, provider bundles, CLI source) omit the surfaces that actually hold prefixed references today — an independent grep for `rules/<moved>.md` finds live hits in `docs/governance/rules-index.md:78-80`, `docs/core/meowkit-architecture.md:243,442`, `docs/core/ecosystem-harness.md:89`, `docs/operations/docs-references-inventory.md`, `docs/operations/autobuild-runbook.md:150`, `packages/docs/docs-reference-manifest.json:39`, `packages/docs/content/docs/reference/rules-index.mdx:129,157,176`, `packages/docs/content/docs/guide/{rubric-library,adaptive-density}.mdx`, `packages/docs/content/docs/core-concepts/workflow.mdx:4` (`sourceOfTruth`), and `.meowkit/harness-inventory.json`. None of those is in the roots and none is asserted by AC-13, so AC-04 can pass over stale docs. Name the full root list AND name the exemption: `packages/docs/content/docs/changelog/archive.mdx` is a historical record and must NOT be rewritten — without an explicit carve-out the only way to satisfy a "0 hits" rule is to rewrite changelog history
- Round 1 (reviewer/evaluator): AC-11 "0 references to moved rule names as rule files" is not binary, and it overlaps AC-04 with a different pattern over the same files (the bundles live under `packages/mewkit/src/migrate/modules/`, which AC-04 already scans as CLI source). The bundles today carry both forms: a prefixed path at `.../cursor/root/.cursor/skills/mk-context-audit/SKILL.md:16` (`rules/context-budget-rules.md`) and bare-filename prose at `.../mk-context-engineering/SKILL.md:47,67` ("see `context-budget-rules.md` … if present"). Use AC-04's pattern verbatim and state explicitly whether bare-filename prose mentions must be repointed to the new path or may stand
- Round 1 (reviewer/evaluator): AC-09 and AC-14 are bound to code-quality but assert that validators still pass and that hook behavior did not regress — neither maps to any of the 7 mechanical maintainability criteria in the code-quality rubric (file size, function length, TODO/FIXME, type safety, dead code, secrets, boundary error handling). This is the same misbinding I flagged on sprint-1 AC-07. As drafted, the 0.15-weight rubric has no AC that exercises it, so I would have to grade it unanchored. Re-bind AC-09 and AC-14 to functionality and add one real code-quality AC over the sprint diff: every new/changed `.ts` file and every new check script ≤200 lines, zero `any` in changed TypeScript, zero new TODO/FIXME, zero commented-out blocks or unused imports, zero hardcoded secrets. AC-12 may stay on code-quality for the lint/typecheck half
- Round 1 (reviewer/evaluator): AC-05 is not binary as written — "each names an explicit step" leaves me judging what counts as explicit. Supply the checklist of (consumer file → moved rule → new path) tuples: the 7 cook/autobuild rules, the 5 agent-detector rules, evaluator → rubric, skill-creator → skill-authoring (D2), benchmark → dead-weight-audit (D2), and the 5 step-file skills named individually (plan-creator, review, evaluate, autobuild, trace-analyze). Then PASS is a count of satisfied tuples, not an impression
- Round 1 (reviewer/evaluator): MISSING-AC the context-budget estimator. phase-01 Related Code Files names `core/context-budget.ts` ("measure `meowkit-core.md`") and `mewkit context-budget` is a shipped verb (`packages/mewkit/src/commands/budget.ts:148`), yet no AC asserts it reports the new always-on set instead of a stale number for an absent `CLAUDE.md` — AC-09's command list omits it and AC-12 only requires its unit test to stay green. Add it to AC-09 (or its own AC), and state whether the new AC-03 check replaces this estimator, sits beside it, or updates its cap — `.github/workflows/ci.yml:179` records the existing guardrail as unenforced at 131000, and two budget numbers will drift
- Round 1 (reviewer/evaluator): AC-14 names "the existing gate-enforcement, privacy-block and pre-ship/Gate 2 hook tests" but I can only find `packages/mewkit/src/__tests__/hooks/gate-enforcement.integration.test.ts` and `.../privacy-block.integration.test.ts` — there is no pre-ship/Gate 2 hook test file, and `tests/hooks/golden` (named by phase-01 Success Criterion "Phase 02 safety golden tests green") does not exist yet. Name the exact test paths AC-14 runs, and record the golden corpus in Scope (Out) with the phase-02 reason so that Success Criterion is a decision rather than an omission
- Round 1 (reviewer/evaluator): AC-02 pins its oracle on injection Rule 1–11, the 12 security rows, Gate 1/Gate 2 conditions and A1 — matching the phase-01 criterion — but core-behaviors (merged with anti-rationalization) and development-rules are also compressed in this sprint and are both named in the plan's MUST-keep constraint, with only the sampled AC-06 table behind them. Decision needed, not a reversal: either extend the pinned oracle with the 6 numbered core-behaviors headings and the development-rules NEVER/ALWAYS section headings, or record why the AC-06 table alone covers those two files
- Round 1 (reviewer/evaluator): AC-08 (d) requires a v2-shaped project to be upgraded with moved rules cleaned, while plan Decision 5 is "No v2→v3 migration/port". Confirm in the AC that (d) is satisfied by the existing `smart-update` + orphan-cleanup path over `rules/` and licenses no new v2→v3 migration layer — otherwise the AC reads as authorization for scope the user excluded
- Round 2 (proposer/generator): BASE pinned (b225a319) for AC-06, AC-07 and the clean-`main` re-runs; AC-01 uses `ls -A` = 7 entries, no subdirs; AC-03 oracle pinned (recursive set, literal 25 600, printed total = independent count, source reviewed); AC-04 roots widened to docs, docs site, scripts, CI, `.meowkit/` and root files, with exhaustive exemptions (changelog archive, `docs/archive/**`, destination table, moved-rules table, `tasks/**`) and a ruling on bare-name prose (must point at the new path in `.claude/` and bundles); AC-11 reuses AC-04's patterns; AC-05 is a 24-tuple checklist; AC-02 oracle extended to the 6 core-behaviors headings and 15 development-rules phrases (generator accepts the stricter option, no reversal of a user decision); AC-08(d) bound to the existing update/orphan path, Decision 5 in Scope (Out); AC-09 re-bound to functionality and gains `context-budget` + one budget number in CI; AC-14 names the 4 existing test files, re-bound to functionality, golden corpus in Scope (Out) with the phase-02 reason; new AC-15 code-quality over the diff
- Round 2 (reviewer/evaluator): accepted — all 12 Round-1 clarifications resolved; 15 ACs are testable via CLI/grep/test run, every pinned oracle verified against BASE rather than asserted, and all four cli-tool rubrics are bound (functionality 9, product-depth 3, code-quality 2, ux-usability 1) with code-quality now exercising its own mechanical criteria through AC-15
- Round 2 (reviewer/evaluator): oracle verification I ran before accepting — BASE `b225a319699fdffce38f8c0ac63e30465a31137c` resolves and is an ancestor of HEAD (the phase-08 commit); BASE core-behaviors carries exactly the 6 headings AC-02 names, `## 1. Surface Assumptions` through `## 6. Verify, Don't Assume`; BASE development-rules `grep -cE 'MUST|NEVER|ALWAYS'` = 15, matching AC-02's "15 phrases" exactly; AC-06's 26 = 25 BASE rules + BASE `CLAUDE.md`; AC-05's tuples sum to 24 and cover all 16 non-exempt moved files, consistent with AC-04 (c); an independent grep for `rules/<moved>.md` outside AC-04's declared roots returns only two test files (`packages/mewkit/tests/find-orphans.test.ts:154`, `src/__tests__/memory/producer-consumer-characterization.test.ts:78`), both excluded by "tests excluded" — so the widened root list is complete, not merely wider
- Round 2 (reviewer/evaluator): binding correction to AC-14, not a new clarification — two of the four named test paths do not exist. `packages/mewkit/src/__tests__/hooks/` is not a directory; the hook integration tests live at the repo root in `src/__tests__/hooks/gate-enforcement.integration.test.ts` and `src/__tests__/hooks/privacy-block.integration.test.ts` (root `src/` holds only `__tests__`; the CLI source is `packages/mewkit/src/`). The wrong prefix came from my own Round-1 line, so I correct it here rather than spend the hard-cap round on it. AC-14 is graded against these two paths plus the two `.claude/hooks/__tests__/` files, which I confirmed exist
- Round 2 (reviewer/evaluator): recorded grading interpretation for AC-04 (a), non-blocking — the pattern is a substring match, so it fires on any destination whose parent directory segment is `rules`. The source-repo-only location of `docs-reference-contract` is still unnamed, while AC-09 requires the docs-reference validator to read it and AC-13 requires the maintainer `CLAUDE.md` to name its location; both produce live references by design. I will grade AC-04 (a) as excluding the contract's own new path, and the generator records that path in the verdict evidence. If the chosen path does sit under a `rules/` segment, say so before the verdict rather than after
- Round 2 (reviewer/evaluator): recorded implementation note for AC-04 vs AC-08 (d), non-blocking — the root `deletions.json`, `release-manifest.json` and root `CHANGELOG.md` are outside AC-04's declared roots by design, because AC-08 (d)'s cleanup works by the deletion list NAMING the old paths; `deletions.json` already carries `rules/memory-read-rules.md` and `rules/wiki-context-rules.md` from phase 08, and this sprint adds the 19 moved rules the same way. The dangling-reference check must not be widened to the repo root, or it will flag the very entries that make the upgrade cleanup work
- Round 2 (reviewer/evaluator): nothing blocking, no escalation to the user. Both items I had flagged as needing a user decision were resolved by the generator taking the stricter option, and neither reverses a user decision: the AC-02 oracle now covers the two remaining compressed always-on files (closing the gap behind the plan's MUST-keep constraint), and AC-04's roots now cover the doc surfaces that actually hold the references, with an exhaustive exemption list that protects changelog history. Ready to `sign`

## Amendments (if any)
