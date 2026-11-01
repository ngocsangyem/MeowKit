---
contract_schema_version: 1.0.0
task: meowkit-v3-lean-runtime
sprint: 1
plan_ref: tasks/plans/261101-meowkit-v3-lean-runtime/plan.md
rubric_preset: cli-tool
status: amended
generator_signed: null
evaluator_signed: null
rounds: 1
created: 261101-1533
---

# Sprint 1 Contract — Memory diet: one plain-markdown team store, wiki removed

Testable translation of `phase-08-memory-diet.md` (Decisions D1–D3, Requirements 1–13).

## Scope (In)

- Team memory reduced to two committed markdown files, `.meowkit/memory/decisions.md` and `.meowkit/memory/gotchas.md`, created on first write
- Fixed read set (fix, investigate, review, plan-creator, cso) and write set (fix, review, retro, architect agent, memory skill)
- Wiki subsystem, recall composition, JSON curated stores, capture hook, prune hook, migrators and their CLI verbs removed
- Non-memory artifacts that lived under `.meowkit/memory/` moved to cache, state, telemetry, reports, backlog or beside their plan
- `mewkit validate --memory` lint (size cap, injection patterns, secret patterns)
- Zero-residue check wired into CI; Codex and Cursor bundles mirror the kit change
- Docs, docs site and CI updated to match

## Scope (Out)

- Any other v3 phase (context diet, node-only hooks, config.yaml, kit artifact, lazy Python, CLI surface cut, kit shape)
- Pinned v2.15 benchmark baseline (deferred by the user; tracked as an open item)
- A v2→v3 memory migration or compatibility layer
- New skills, new memory features, a search index or embedding store

## Acceptance Criteria

### [AC-01] Retired verbs are gone and fail loudly

**Given** a freshly built CLI
**When** the user runs `mewkit wiki`, `mewkit memory`, `mewkit index` or `mewkit query`
**Then** each exits non-zero, and `mewkit --help` lists none of them

- **Verification:** build the CLI, invoke each verb, assert exit code ≠ 0; grep `--help` output for the four verb names → 0 matches
- **Rubric tie-in:** functionality (weight 0.40)

### [AC-02] Memory lint rejects injection text

**Given** a project whose `.meowkit/memory/gotchas.md` contains a phrase from the shared injection pattern list (the same list the content-validation hook uses)
**When** the user runs `mewkit validate --memory`
**Then** the command exits non-zero and names the offending file

- **Verification:** temp project fixture + CLI invocation; assert exit code and file name in output
- **Rubric tie-in:** functionality (weight 0.40)

### [AC-03] Memory lint rejects secrets and oversize files, passes clean entries

**Given** three fixtures — one memory file with a secret-shaped token, one with more than 300 lines, one clean entry in the decision/gotcha entry format
**When** `mewkit validate --memory` runs against each
**Then** the first two exit non-zero without echoing the secret value, the clean one exits zero, and a project with no memory directory also exits zero

- **Verification:** CLI invocations against temp fixtures; assert exit codes; grep output for the fake secret → 0 matches
- **Rubric tie-in:** functionality (weight 0.40)

### [AC-04] Zero residue across shipped kit and CLI source

**Given** the finished change
**When** `node scripts/check-memory-wiki-residue.cjs` runs
**Then** it exits zero with 0 hits, where the oracle is pinned: the pattern is exactly `mewkit wiki|mk:wiki|knowledgeRecall|fixes\.json|review-patterns\.json|architecture-decisions\.json|security-findings\.json|render-views|seed-from-md|memory-read-rules|wiki-context-rules|immediate-capture|##(pattern|decision|note):|\.meowkit/memory/(docs-cache|qa-reports|retros|projects|security-reports|contributor-logs|freeze-dir)|wiki-index\.db|scan-patterns`, the scan roots are exactly `.claude/` and `packages/mewkit/src/`, and the only exclusions are test trees (`__tests__/`, `tests/`, `*.test.*`, `*.spec.*`) and release history (changelog, release notes)

- **Verification:** diff the script's pattern, roots and exclusions against the pinned oracle (any mismatch = FAIL); run the script; assert exit 0 and empty hit list; independently re-run the pinned pattern with `grep -rEn` over the same roots and exclusions → 0
- **Rubric tie-in:** product-depth (weight 0.25)

### [AC-05] Gate 2 verdict tooling and trace secret scrubbing survive the deletion

**Given** the memory and wiki source trees are deleted
**When** the verdict-gate tests and the trace-append scrub test run
**Then** the verdict-gate tests pass and a trace record carrying a fake secret is written with the secret scrubbed

- **Verification:** `vitest run` on the review/verdict-gate tests and the trace-append record-shape test; assert pass
- **Rubric tie-in:** functionality (weight 0.40)

### [AC-06] Read and write sets are exactly the decided skills

**Given** the shipped kit
**When** the kit is searched for instructions that read or append `.meowkit/memory/`
**Then** reads appear only in fix, investigate, review, plan-creator and cso (plus the planner agent that runs plan-creator), and appends appear only in fix, review, retro, the architect agent and the memory skill. PASS requires zero deviations, unless a deviation is recorded under Amendments and approved by the human before the verdict is written; any unrecorded extra reader or writer is a FAIL

- **Verification:** grep `.claude/` for `.meowkit/memory/` read/append instructions; tabulate by skill/agent; compare against the decided sets and the Amendments section
- **Rubric tie-in:** product-depth (weight 0.25)

### [AC-07] No session artifact lands in the committed memory directory

**Given** the shipped kit after relocation
**When** the kit is searched for writers into `.meowkit/memory/`
**Then** the only files written there are `decisions.md` and `gotchas.md`; caches, reports, logs, design docs, backlog and session state point at their new homes, each writer and reader moved together

- **Verification:** (1) static: grep `.claude/` and hooks for `.meowkit/memory/` paths other than the two files → 0; spot-check freeze, docs-finder, qa, retro, cso, review triage and scout readers match their writers. (2) runtime: in a scratch project initialised from the built kit, after the AC-14 journey sessions finish, `git status --porcelain .meowkit/` lists only `config.yaml` and `memory/*.md` — no cache, report, log or state path
- **Rubric tie-in:** product-depth (weight 0.25)

### [AC-08] Safety enforcement is unchanged

**Given** the rewritten rules and hooks
**When** the diff of `security-rules`, `injection-rules`, `gate-rules`, `core-behaviors`, `development-rules`, `gate-enforcement.sh` and `privacy-block.sh` is inspected
**Then** only memory/wiki path wording changed; every enforcement bullet, exit code and block marker is byte-identical

- **Verification:** `git diff` of the listed files; assert no enforcement line removed or reworded
- **Rubric tie-in:** code-quality (weight 0.15)

### [AC-09] Codex and Cursor bundles stay consistent and brand-free

**Given** the mirrored bundles
**When** the migrate test suite and `validate --target codex|cursor` run
**Then** every manifest source path exists, no wiki skill or capture hook remains in either bundle, and the brand-free / pack-cleanliness tests pass

- **Verification:** `vitest run src/migrate`; CLI `validate --target codex` and `--target cursor`; assert pass
- **Rubric tie-in:** functionality (weight 0.40)

### [AC-10] Whole suite, typecheck, lint and kit validators are green

**Given** the finished change
**When** typecheck, lint, the full test suite and the kit validators (frontmatter, cross-refs, links, docs references, hook registration, workflow evidence, `validate --workflow`, inventory drift, CLI synopsis drift) run
**Then** all pass, except failures listed as pre-existing in the review verdict's evidence file — one line per failing test or check, each with the output of the same command re-run on a clean `main` checkout showing the same failure; any failure not on that list is a FAIL

- **Verification:** run each command; for any failure, re-run on a clean `main` checkout (separate worktree) and record it in the verdict evidence; compare the failure set against the recorded list
- **Rubric tie-in:** code-quality (weight 0.15)

### [AC-11] The memory skill and docs explain the store to a first-time user

**Given** a user who has never used the kit
**When** they read the memory skill and the memory-system docs page
**Then** both documents state each of six items, each findable by grep: (1) the two file paths `decisions.md` and `gotchas.md`; (2) the entry format with the `Why:`, `Apply when:` and `Source:` fields; (3) a "never" statement covering secrets and vulnerability detail; (4) the read set and the write set by name; (5) `validate --memory` and PR review as the protection; (6) `--prune` and its human-approved behaviour — and neither document mentions a removed command (`mewkit wiki`, `memory capture`, `render-views`, `seed-from-md`, `mewkit index`, `mewkit query`)

- **Verification:** grep each of the six items in `.claude/skills/memory/SKILL.md` and `docs/core/memory-system.md` (12 checks, all must hit); grep both files for the six removed commands → 0; link checker passes
- **Rubric tie-in:** ux-usability (weight 0.20)

### [AC-12] Unknown verbs give a helpful failure, not a silent success

**Given** a freshly built CLI
**When** the user runs an unknown subcommand
**Then** it exits non-zero with a message pointing at `--help`, while bare `mewkit` and existing verbs keep their exit codes

- **Verification:** CLI invocation of a nonsense verb, bare `mewkit`, and `mewkit status`; assert exit codes and message
- **Rubric tie-in:** ux-usability (weight 0.20)

### [AC-13] Always-on context sheds the two memory rules and the recall paragraph

**Given** the finished kit and a freshly built CLI
**When** the always-on rule set is listed and SessionStart bootstrap output is captured
**Then** `memory-read-rules.md` and `wiki-context-rules.md` are absent from `.claude/rules/`, the always-on rule byte total is at least 9 904 B lower than on `main`, and the captured bootstrap output contains no knowledge-recall paragraph

- **Verification:** `ls .claude/rules/` and `wc -c .claude/rules/*.md` on this branch vs a clean `main` worktree (record both totals); capture the bootstrap text the CLI emits at SessionStart and grep it for `recall` / `knowledgeRecall` → 0
- **Rubric tie-in:** product-depth (weight 0.25)

### [AC-14] A fix writes one gotcha that a later session finds and cites

**Given** a scratch project initialised from the built kit with a seeded bug whose root cause is non-derivable from the code alone
**When** a fresh agent session runs the fix skill on that bug, and then a second fresh session runs the fix skill on a similar bug
**Then** the first session appends exactly one entry to `.meowkit/memory/gotchas.md` with a heading line plus `Why:`, `Apply when:` and `Source:` fields, and the second session's transcript shows it grepping `.meowkit/memory/` and citing that entry

- **Verification:** run both sessions as isolated agent runs in the scratch project; save both transcripts and the resulting `gotchas.md` under the verdict evidence; assert one entry in the format and a grep + citation in the second transcript
- **Rubric tie-in:** functionality (weight 0.40)

## Out-of-Scope Clarifications

- Do not touch the telemetry opt-in prompt in skill preambles (later phase reader inventory)
- Do not move `.claude/cache/web-fetches` (later phase owns it with its privacy regex)
- Do not change the config schema or the `features.memory` key semantics (config phase); report it as an open item
- Do not edit the plan directory beyond phase checkboxes after Gate 2

## Rubric Bindings

- functionality: AC-01, AC-02, AC-03, AC-05, AC-09, AC-14
- product-depth: AC-04, AC-06, AC-07, AC-13
- code-quality: AC-08, AC-10
- ux-usability: AC-11, AC-12

## Negotiation Log

- Round 1 (proposer/generator): initial draft from phase-08 spec + cli-tool preset
- Round 1 (reviewer/evaluator): AC-04 the residue script is authored in this sprint and is untracked today, so "the script exits 0" is satisfiable by weakening the script — pin the oracle in the AC: the 16 residue tokens of phase-08 Req 13 verbatim, scan roots `.claude/` and `packages/mewkit/src/`, test trees and release history the only exclusions, and the script's own diff reviewed alongside the result
- Round 1 (reviewer/evaluator): AC-06 the clause "any other writer is listed as a deviation for human decision" makes the AC non-binary — a deviation list could be read as passing. State the binary rule: PASS requires zero deviations from the D3 read/write sets, unless a deviation is recorded as a contract Amendment and approved BEFORE the verdict is written; an unrecorded extra reader or writer is a FAIL
- Round 1 (reviewer/evaluator): AC-07 is bound to code-quality but asserts relocation completeness, which is spec-feature coverage, not any of the 7 mechanical maintainability criteria in the code-quality rubric — re-bind to product-depth (or justify the binding); code-quality still holds AC-08 and AC-10
- Round 1 (reviewer/evaluator): AC-07 covers only the static grep; phase-08 Success Criterion "Journey C" asserts the runtime outcome (`git status --porcelain .meowkit/` after a full session shows only `config.yaml` and `memory/*.md`). Add that command as a second assertion in AC-07 or as its own AC — a static grep cannot prove a hook or skill does not create a stray path at runtime
- Round 1 (reviewer/evaluator): AC-10 the escape hatch "except failures demonstrated to also fail on `main`" is open-ended — name where the pre-existing failures are recorded (verdict evidence file, one line per failure with the `main` re-run output) and state that any failure not on that list is a FAIL
- Round 1 (reviewer/evaluator): AC-11 "they can find ..." is not probeable as written — I cannot grade a hypothetical reader. Convert the six items into a binary checklist of named, greppable headings/sections in `mk:memory` SKILL.md and the memory-system docs page, and make "no reference to removed commands" explicit by naming them (`wiki`, `memory capture`, `render-views`, `seed-from-md`, `index`, `query`)
- Round 1 (reviewer/evaluator): MISSING-AC phase-08 Success Criterion "always-on bytes drop by the 9 904 B of the two rules, and SessionStart output no longer contains a recall paragraph" has no binding — add an AC asserting both halves: the two deleted rule files are absent from the always-on rule set, and captured SessionStart/bootstrap output contains no recall paragraph (grep → 0 matches)
- Round 1 (reviewer/evaluator): MISSING-AC phase-08 Success Criterion "Journey A" (a `/mk:fix` run appends one entry to `gotchas.md` in the research §5 format; a new session's read-set skill greps that entry and cites it) has no binding — AC-06 only inspects instruction text, which cannot distinguish a wired write path from a documented one. Add the end-to-end journey as an AC, or move it to Scope (Out) with a stated reason so the gap is a decision rather than an omission
- Round 2 (proposer/generator): AC-04 oracle pinned (pattern, roots, exclusions, independent grep); AC-06 made binary (zero deviations unless a human-approved Amendment precedes the verdict); AC-07 re-bound to product-depth and gains the runtime `git status --porcelain .meowkit/` assertion; AC-10 pre-existing failures recorded in verdict evidence with `main` re-run output, anything unlisted fails; AC-11 converted to 12 greppable checks plus 6 named removed commands; added AC-13 (two rules gone, ≥9 904 B drop, no recall paragraph) and AC-14 (fix journey write + later-session grep and cite)
- Round 2 (reviewer/evaluator): accepted — all 8 Round-1 clarifications resolved; 14 ACs each testable via CLI/grep/test run, every cli-tool preset rubric bound (functionality 6, product-depth 4, code-quality 2, ux-usability 2), and the phase-08 Success Criteria are covered without added scope (entry-format fields match research §5; benchmark baseline remains the only Scope-Out deferral)
- Signed by generator: 6a9cee72e37250f80043bc46dfa35f2bd2f9df51
- Signed by evaluator: a525516ccd4943a8901aa825d4c2f7913d0ab6be

## Amendments (if any)

### Amendment 1 — 261101-1730

**Trigger:** the AC-07 runtime check failed after the AC-14 sessions. `git status --porcelain --ignored .meowkit/`
showed `.meowkit/memory/` as ignored, because the shipped `.meowkit/gitignore.meowkit` template and the
`DEFAULT_GITIGNORE` fallback in `packages/mewkit/src/commands/setup-steps.ts` both ignore the committed memory
directory. v3 memory is committed, so the entries contradict Scope (In) item 1. No `config.yaml` writer exists
yet (Phase 03), so `config.yaml` cannot appear.

**Scope added (human-approved 261101: "Fix gitignore now"):**
- Remove `.meowkit/memory/` from `.meowkit/gitignore.meowkit` and from `DEFAULT_GITIGNORE`.
- The setup step's "entries already present" check stops keying on `.meowkit/memory/` (it keys on `.meowkit/telemetry/`).
- Unchanged: `scripts/prepare-release-assets.cjs` still excludes `.meowkit/memory/*` from the release archive (a
  project's memory never ships in the kit).
- Out: rewriting the `.gitignore` of projects that already installed v2 (no v2→v3 migration layer, per Scope (Out)).

**AC-07 runtime assertion, revised** (overrides the original Verification step (2); the static step (1) is unchanged):
in a scratch project whose `.gitignore` is generated from the amended template, after the AC-14 journey sessions,
`git status --porcelain .meowkit/` lists only `memory/*.md` (and `config.yaml` only once Phase 03 ships a writer),
and `git status --porcelain --ignored .meowkit/` shows `state/`, `telemetry/` and `cache/` as ignored with
`memory/` not ignored. Any other listed path fails.

### Amendment 2 — 261101-1900

**Trigger:** the AC-06 tabulation found two writers outside the decided write set, both appending to
`.meowkit/memory/decisions.md`: `mk:party` (a Decision Record after a deliberation reaches a decision) and
`mk:plan-creator archive` (one decision entry when an archived plan carries a Red Team Review or Validation Log).

**Decision (human-approved 261101: "Amend to allow both"):** both writers are kept and added to the decided
write set. Each writes `decisions.md` only, one entry per run, in the standard entry format, under the same
non-derivable rule. Neither gains a read of `.meowkit/memory/`; `plan-creator` stays in the read set as before.

**AC-06, revised** (overrides the write-set clause; the read-set clause is unchanged): appends appear only in fix,
review, retro, the architect agent, the memory skill, `mk:party` (decisions.md) and `mk:plan-creator` archive
(decisions.md). Any other writer fails.

**AC-11 follow-through:** item (4) names the revised write set, so the memory skill and the memory-system docs page
list `mk:party` and `mk:plan-creator archive` as `decisions.md` writers.
