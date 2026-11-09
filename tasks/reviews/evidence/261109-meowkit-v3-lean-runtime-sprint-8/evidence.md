# Sprint 8 — implementation evidence

**Status of this record: IMPLEMENTED — slices 1–6 complete, plus one review-fix round.** Source files WERE
edited; the kit tree is no longer byte-identical to `d17cc03b`. All of this sprint's work is uncommitted in
the working tree on `feat/v3-lean-runtime` at HEAD `d17cc03b`; the fix round made no commit either.

Read this file in four parts, written in the order the work happened and left in place rather than
rewritten:

1. **§1–§3 are the SIZING round**, written before the first edit. §1's "why this stopped" is a historical
   record of a stop that was later lifted by the orchestrator's decision to proceed in slices — it is **not**
   the current status. §2 (the 27-row command disposition table) and §3 (the reader inventory and the modes
   load-path finding) are the judgment artifacts the signed criteria require, and they remain live.
2. **§4 is the per-AC status**, refreshed after the fix round — it supersedes §1's "blocked" reading and is
   the one place to read what ran and what it measured.
3. **§5 and the "Slice 1–6" sections are the implementation record**, each with its own measurements and gate
   table. §5's "Files changed: None" is corrected in place.
4. **The final section is the review round 1 fix record** — the blocking defect, the guard that now catches
   its class, and the three record-keeping and reference items closed with it.

Base read: `tasks/contracts/261109-1402-meowkit-v3-lean-runtime-sprint-8.md` (status `signed`, 11 ACs,
`generator_signed: 0f4740db`, `evaluator_signed: f396f5f2`), including the evaluator's closing log note that
**eight** declarations must be removed, not six — `base.globs` also carries `scripts/**`
(`.meowkit/pack-manifest.json:23`) and the `base.commands` key (`:31`) beyond `workflow.yaml` in
`base.files` (`:7`).

Environment for every command below: `PATH=/opt/homebrew/opt/node@24/bin:$PATH`, cwd = repository root,
HEAD = `d17cc03bc820616bfd8285853c3515e67ecd84b1`.

---

## 1. Why this stopped before the first edit

The stop is a **sizing** finding, not a disagreement with any criterion. Two measurements drive it.

### 1.1 The rewrite surface is 625 tracked files

```
git grep -lE "\.claude/(commands|modes|rubrics|rules-conditional|schemas|scripts|benchmarks|workflow\.yaml|harness-substrate|capability-bootstrap|agent-memory)|agile-(feedback-cycle|sprint-commitment|story-gates)|workflow-evidence-rules|advice-supervision-rules|workflow-(slug|config|repo-mode|diff-scope|review-log)|setup-workflow|session-state" \
  -- . ':!tasks' ':!.claude/worktrees' | wc -l
→ 625
```

Per-path breakdown (tracked, excluding `tasks/` and `.claude/worktrees/`):

| Departing path / moved name | Files naming it | Owning AC |
|---|---|---|
| `.claude/scripts` | **143** | AC-06 |
| `.claude/rules-conditional` (path form) | 59 | AC-04 |
| `rules-conditional` members by bare name | **79** | AC-04 |
| `.claude/commands` | 25 | AC-02 |
| command-only `/mk:` targets (exact token) | **60** (39 non-docs + 21 docs) | AC-02 / AC-09 |
| `.claude/rubrics` | 21 (+25 bare `rubrics/`) | AC-04 |
| `.claude/workflow.yaml` | 15 | AC-04 |
| `.claude/benchmarks` | 12 | AC-05 |
| `.claude/schemas` | 5 | AC-05 |
| `.claude/agent-memory` | 5 | AC-05 |
| `.claude/modes` | 4 | AC-03 |
| `.claude/harness-substrate` | 2 | AC-05 |
| `.claude/capability-bootstrap` | 2 | AC-04 |
| `session-state` in hooks | 19 hook files | AC-08 |
| relocated paths named in docs | 38 (36 editable) | AC-09 |

The single largest item is not in the contract's Given at all: **`.claude/scripts/bin/` relocation
re-paths ~290 reference sites.** Measured callers outside `.claude/scripts/` itself:

| `bin/` entry | Referencing files | Note |
|---|---|---|
| `workflow-slug` | **71** | live name |
| `workflow-config` | **67** | live name |
| `setup-workflow` | **62** | live name |
| `workflow-review-log` | **48** | live name |
| `workflow-repo-mode` | **27** | live name |
| `workflow-diff-scope` | **15** | live name |
| `meowkit-diff-scope` | 1 | duplicate half, near-dead |
| `meowkit-repo-mode` | 0 | duplicate half, dead |
| `meowkit-slug` | 0 | duplicate half, dead |

Useful consequence for the next run: AC-06's "one name per job" is **cheap** — the `meowkit-*` half of the
3 duplicated jobs has 0–1 callers, so deleting it costs one edit. The expensive part is that the directory
must also *leave* `.claude/scripts/`, which re-paths the ~290 live sites.

### 1.2 No single AC is independently completable

Partial delivery cannot satisfy even one criterion, because the criteria are interlocked:

- **AC-01** (`≤8` entries) cannot pass until AC-02, AC-03, AC-04, AC-05 and AC-06 have all removed their
  entry — it is the conjunction of the other five.
- **AC-03**'s Then requires `gate-rules.md`'s reviewer path list to "name every directory those two paths'
  content moved to" — that set is only known once **AC-04** has placed `rules-conditional/*`.
- **AC-04**'s rules-subtotal clause (`≤25 501 B`, 99 B headroom) interacts with **AC-02**'s
  `security-rules.md:26` edit and **AC-06**'s `injection-rules.md:56` / `gate-rules.md:95` path edits — the
  three always-on edits share one 99-byte budget and must be landed together to be measurable.
- **AC-11** requires the whole repository green, which is the conjunction of all ten.

So stopping mid-way yields a tree with some of 11 removals half-applied across a subset of 625 reference
sites, `validate --packs` red, and **no commit to checkpoint from** (committing is forbidden by the task
instruction; `git checkout/reset/stash/restore/clean` are also forbidden). That state is not recoverable by
the next run without manual reconstruction, and it is strictly worse than an unmutated tree.

### 1.3 Two criteria additionally require interactive end-to-end runs

- **AC-07** requires a full `/mk:cook` run taken end to end in a throwaway project, plus Gate 1 probed in
  two project shapes and Gate 2 probed on a ship-capable change.
- **AC-08** requires one full session exercising a gate block, a checkpoint write, a model detection, a TDD
  sentinel read, a Gate 2 evidence lookup and a web fetch, then a zero-residue `git status` assertion.

Neither is a scripted assertion; both are multi-phase workflow runs on top of the finished tree.

### 1.4 Recommended amendment

The work is correct as specified; it is one sprint too wide for a single agent run. Recommended split,
ordered by the dependency graph above, each slice independently verifiable and committable:

| Slice | Content | Gate to pass before next |
|---|---|---|
| 8a-1 | AC-06 scripts redistribution incl. `bin/` relocation (~290 sites) + reader inventory | `check-no-python`, shebang property, `doctor`, Gate 2 structural checks |
| 8a-2 | AC-04 domain content moves (`rubrics/`, `rules-conditional/*`, `workflow.yaml`, `capability-bootstrap.md`) + move registry | `--workflow`, `--docs-refs`, dangling-rule-refs, cross-refs, budget ≤25 501 |
| 8a-3 | AC-02 commands fold + AC-10 needle (shared always-on edit) + AC-03 modes deletion | `--packs`, `--gates`, cross-refs, rule-survival + fail-on-delete probe |
| 8a-4 | AC-05 maintainer-content exclusion + `skill-schema.json` into the CLI package | `--frontmatter` in a `$TMPDIR` install, in-repo tools |
| 8a-5 | AC-08 runtime state under `.meowkit/` + privacy regex + new golden case | golden replay, zero-residue journey |
| 8a-6 | AC-07 `tasks/` descaffold + template rehome; AC-01 conjunction + README/RELEASING; AC-09 docs + projections; AC-11 repo green | full suite + all validators + both journeys |

AC-01's Given should be corrected to **eight** declared base entries when it is next edited, per the
evaluator's closing note.

---

## 2. Command disposition table (27 rows) — AC-02 artifact

Closed disposition set: `delete-duplicate`, `delete-and-rewrite-references`, `fold-into-existing-skill`,
`promote-to-skill`. Exactly one per row, with a named target. Measured reference load per command is the
exact-token count across tracked files outside `tasks/` and `.claude/worktrees/`.

### 2.1 The 11 same-name duplicates — all `delete-duplicate`

| # | Command | Disposition | Target (same-name skill) |
|---|---|---|---|
| 1 | `advise` | delete-duplicate | `mk:advise` |
| 2 | `autobuild` | delete-duplicate | `mk:autobuild` |
| 3 | `context-audit` | delete-duplicate | `mk:context-audit` |
| 4 | `cook` | delete-duplicate | `mk:cook` |
| 5 | `docs-init` | delete-duplicate | `mk:docs-init` |
| 6 | `fix` | delete-duplicate | `mk:fix` |
| 7 | `help` | delete-duplicate | `mk:help` |
| 8 | `orchestrate` | delete-duplicate | `mk:orchestrate` |
| 9 | `retro` | delete-duplicate | `mk:retro` |
| 10 | `review` | delete-duplicate | `mk:review` |
| 11 | `ship` | delete-duplicate | `mk:ship` |

### 2.2 The 10 settled by measurement — a skill or CLI verb already owns the whole job

| # | Command | Disposition | Target | Ref load |
|---|---|---|---|---|
| 12 | `plan` | delete-and-rewrite-references | `mk:plan-creator` | **32** repo / 14 docs |
| 13 | `status` → see 2.3 | — | — | 7 |
| 14 | `audit` | delete-and-rewrite-references | `mk:cso` (+`mk:review`) | 3 — incl. always-on `rules/security-rules.md:26` |
| 15 | `canary` | delete-and-rewrite-references | `mk:ship` | low |
| 16 | `test` | delete-and-rewrite-references | `mk:testing` | low |
| 17 | `validate` | delete-and-rewrite-references | `mk:lint-and-validate` | 1 |
| 18 | `docs-sync` | delete-and-rewrite-references | `mk:document-release` | low |
| 19 | `meow` | delete-and-rewrite-references | `mk:agent-detector` | low |
| 20 | `spawn` | delete-and-rewrite-references | `mk:team-config` | low |
| 21 | `upgrade` | delete-and-rewrite-references | `mewkit upgrade` verb | low |
| 22 | `budget` | delete-and-rewrite-references | `mewkit budget` verb + `mk:context-audit` | 5 |
| 23 | `confluence-setup` | fold-into-existing-skill | `mk:confluence` hub | 5 |

`plan` is the heaviest single rewrite (32 non-docs + 14 docs files) and is a pure dispatcher to
`mk:plan-creator` / `mk:visual-plan`, so D3 and the Out-of-Scope list forbid preserving the name.

### 2.3 The five that needed the bodies read — judgement, with the cap binding

Each of the five carries real procedure, so none qualifies for `delete-and-rewrite-references` on the
"a skill already does the whole job" test:

| Command | Lines | Body shape (read at HEAD) | Existing owner? |
|---|---|---|---|
| `arch` | 65 | 4-mode ADR lifecycle (`new`/`list`/`review`/`impact`) writing `docs/architecture/adr/` via the `architect` agent | no skill; the **architect agent** owns ADRs |
| `breakdown` | 54 | 5-phase spec→stories→tickets→tech-breakdown pipeline; carries its own frontmatter `description` and four explicit "NOT for" routes | no single skill |
| `delegate` | 89 | 6-field interactive `AskUserQuestion` wizard emitting a paste-ready subagent prompt; explicitly *not* `mk:spawn` | no skill |
| `design` | 52 | system-design consultation; components → ASCII data flow → docs-only output | overlaps `mk:improve-codebase-architecture` / `mk:brainstorming` |
| `status` | 77 | plan resolution (arg / slug / glob / multi-plan prompt) then dispatch to the `project-manager` agent | no skill; **project-manager agent** owns it |

**The ≤4 promotion cap binds here: five candidates, four slots.** Recommended resolution, lowest-cost
first — `design` is the one to not promote, because its job is the only one of the five already covered by
two existing skills (`mk:improve-codebase-architecture` for component/boundary work,
`mk:brainstorming` for consultation), making it `fold-into-existing-skill` rather than a 5th promotion:

| # | Command | Disposition | Target |
|---|---|---|---|
| 24 | `arch` | promote-to-skill | new `mk:arch` (ADR lifecycle; architect agent remains the author) |
| 25 | `breakdown` | promote-to-skill | new `mk:breakdown` |
| 26 | `delegate` | promote-to-skill | new `mk:delegate` |
| 27 | `status` | promote-to-skill | new `mk:status` |
| (23b) | `design` | fold-into-existing-skill | `mk:improve-codebase-architecture` |

Totals: 11 `delete-duplicate` · 11 `delete-and-rewrite-references` · 2 `fold-into-existing-skill`
(`confluence-setup`, `design`) · **4** `promote-to-skill` → 27 rows, one disposition each, cap satisfied.
This assignment is a recommendation carried by evidence, not a signed decision; the next run may reassign
within the closed set provided the cap and the no-pure-dispatcher clause hold.

---

## 3. Reader inventory — AC-06 artifact (and AC-03's recorded load-path finding)

### 3.1 Every top-level `.claude/` entry at BASE

Method: `git grep -l <path>` over `.claude`, `packages/mewkit/src`, `scripts`, `.github`, `tests`, `docs`,
excluding the file's own definition; "load path" means a committed code or prose path that causes the file
to be **read** (hook, handler, skill/agent instruction, rule, CLI code path, CI job).

| Entry | Load-path readers | Destination | Owning AC |
|---|---|---|---|
| `agents/` | host | **stays** | — |
| `hooks/` | host | **stays** | — |
| `rules/` | host | **stays** | — |
| `skills/` | host | **stays** | — |
| `settings.json` | host | **stays** | — |
| `statusline.cjs` | host | **stays** | — |
| `commands/` | host menu; `check-packs.ts:52-54`, `base.commands`, `check-gate-authority.ts:246-259` | deleted | AC-02 |
| `modes/` | **ZERO** (see 3.2) | deleted | AC-03 |
| `rubrics/` | `skills/rubric/`, `skills/evaluate/` (+`scripts/recompute-score.py`), `skills/review/references/design-review.md` | → `skills/rubric/` | AC-04 |
| `rules-conditional/` | 20+ incl. `agents/athena.md`, 6 skills, `core/workflow-evidence-revision.ts` | → owning skills' `references/` | AC-04 |
| `workflow.yaml` | `check-workflow-drift.ts:99` + `:208` pointer, `validate --workflow`, 4 skill files | → `skills/workflow-orchestrator/` | AC-04 |
| `capability-bootstrap.md` | `hooks/handlers/capability-bootstrap.cjs:16`, `core/bootstrap.ts`, 2 golden cases | → beside its hook | AC-04 |
| `benchmarks/` | `skills/benchmark/scripts/*` only | excluded from ship set | AC-05 |
| `harness-substrate.md` | **0 kit readers**; `core/substrate.ts`, `maintainer/inventory.ts` | excluded from ship set | AC-05 |
| `schemas/` | `check-skill-frontmatter.ts:90` (installed-project, **fatal** if absent); `build-inventory.ts:396,424` | `skill-schema.json` → CLI package; `harness-metadata-schema.json` excluded | AC-05 |
| `agent-memory/` | `agents/project-manager.md`, `skills/tech-graph/SKILL.md`, `scripts/generate-release-manifest.cjs` | excluded from ship set (3 files of this repo's evaluator memory) | AC-05 |
| `scripts/` | 143 referencing files | redistributed, see 3.3 | AC-06 |

### 3.2 Modes load-path finding (AC-03's recorded check)

Method: grep for `.claude/modes`, `modes/<name>.md`, and each mode name as a bare token across `.claude`
(hooks, handlers, skills, agents, rules, commands), `packages/mewkit/src`, `scripts`, `.github`, `tests`.

| Mode file | Load-path readers found |
|---|---|
| `architect.md` | **0** |
| `audit.md` | **0** |
| `cost-saver.md` | **0** |
| `default.md` | **0** |
| `document.md` | **0** |
| `fast.md` | **0** |
| `strict.md` | **0** |

No `MEOWKIT_MODE` env name exists anywhere in the tree (every match is `MEOWKIT_MODEL_HINT`, an unrelated
variable). The eight places that *name* the directory — none a load path — are
`rules/gate-rules.md:69`, the `check-gate-authority` test fixture, `.meowkit/pack-manifest.json:27`,
`README.md:9`, `README.md:107`, `RELEASING.md:173`, `docs/maintainer/docs-reference-contract.md:8`,
`docs/operations/docs-references-inventory.md:79`.

### 3.3 The 22 `.claude/scripts/` entries

Destination set: `hooks/lib/` (hook-called) · owning skill's `scripts/` (skill-called) · repository
(CI/maintainer only) · deleted (zero callers).

| Script | Callers | Destination |
|---|---|---|
| `injection-audit.cjs` | **16** incl. always-on `rules/injection-rules.md:56`, `rules/gate-rules.md:95`, `commands/doctor-checks.ts` | `hooks/` |
| `lib/injection-audit-core.cjs` | 0 external (used by the above) | `hooks/lib/` |
| `lib/injection-audit-patterns.cjs` | 0 external (used by the above) | `hooks/lib/` |
| `skill-python.cjs` | **21** | `hooks/lib/` (lazy-Python entrypoint) |
| `validate-workflow-evidence.cjs` | **9**, incl. `hooks/lib/gate2-structural-checks.cjs` | `hooks/lib/` |
| `validate-review-coverage.cjs` | **4**, incl. `hooks/lib/gate2-structural-checks.cjs` | `hooks/lib/` |
| `lib/workflow-config-core.cjs` | 1 (`tests/ports/workflow-config-resolution.test.ts`) | `hooks/lib/` |
| `security-scan.py` | **6** (vulnerability-scanner, testing, skill-creator, ship, lint-and-validate) | `skills/lint-and-validate/scripts/` |
| `validate.py` | **5** (same cluster) | `skills/lint-and-validate/scripts/` |
| `checklist.py` | **0** | **deleted** |
| `cost-report.py` | **0** | **deleted** |
| `rules-audit.sh` | **0** | **deleted** |
| `validate-docs.py` | **0** | **deleted** |
| `lint-brand-prose.sh` | 4 (CI, brand tests) — already ship-excluded | repository |
| `check-anthropic-context.py` | 3 — already ship-excluded | repository |
| `bin/workflow-slug` | **71** | relocate (live name) |
| `bin/workflow-config` | **67** | relocate (live name) |
| `bin/setup-workflow` | **62** | relocate (live name) |
| `bin/workflow-review-log` | **48** | relocate (live name) |
| `bin/workflow-repo-mode` | **27** | relocate (live name) |
| `bin/workflow-diff-scope` | **15** | relocate (live name) |
| `bin/meowkit-diff-scope` | 1 (`packages/docs/.../ship.mdx`) | **deleted** (duplicate of `workflow-diff-scope`) |
| `bin/meowkit-repo-mode` | **0** | **deleted** (duplicate) |
| `bin/meowkit-slug` | **0** | **deleted** (duplicate) |

Shebang note for AC-06's property: **8 of the 9** `bin/` entries are `#!/usr/bin/env bash` with **no
extension**, which is why the property must be asserted by first line and not by file extension.

---

## 4. Per-AC status

Refreshed after the fix round. Every row is RUN; each names the command that produced the number and the
section where that run is recorded, so no row asserts a result the file does not carry.

| AC | Verifying command | Result | Measured evidence |
|---|---|---|---|
| AC-01 | `kit-ship-set.cjs` + `$TMPDIR` install + `validate --packs` | **PASS** | **1155** files, 3 roots, `.claude/` top level = `{agents, hooks, rules, skills, settings.json, statusline.cjs}` — **6** of ≤8; `validate --packs` `1 passed`; eleven departing entries absent from `base.files`/`base.globs`, `base.commands` key gone — §S1.7, §S2.7, §S3.9, §S4.3, §S6.3, §S6.5, and the fix round's re-measure |
| AC-02 | `ls .claude/commands` + cross-refs + `validate --packs` | **PASS** | directory absent; **27** rows, one disposition each, **4** promotions at the cap; 0 unresolved `/mk:` in the 40 non-docs files; `check-skill-cross-refs.sh` `OK` and fails on a planted phantom — §2, §S3.1, §S3.2, §S3.5, §S3.6, §S6.9 |
| AC-03 | `ls .claude/modes .claude/output-styles` + `validate --gates` + budget | **PASS** | both absent, no `output-styles/` created; zero-reader finding recorded; `validate --gates` `1 passed` and still flags a planted approval sentence; rules subtotal **25 417 B** ≤ 25 501 — §3.2, §S3.8, §S5.10 |
| AC-04 | `validate --workflow` + dangling-rule-refs + budget ≤25 501 | **PASS** | 4 relocations at one path each, readers run not grepped: `validate --workflow` **6 passed / no drift**, `validate --frontmatter` `1 passed`, `validate-rubric.sh` 11 rubrics valid, both capability-bootstrap golden cases green; `check-dangling-rule-refs` `OK` over **8657** files — §S2.1–§S2.4, §S2.8, and the fix round for the widened registry |
| AC-05 | ship set + `validate --frontmatter` in `$TMPDIR` | **PASS** | 5 maintainer artifacts withheld; **one** `skill-schema.json`, in `packages/mewkit/schemas/`, read from `src/` and `dist/`; `validate --frontmatter` green inside a materialised install; `dead-weight-audit-rules` marked `shipped: false` and its three unqualified citations qualified in the fix round — §S4.1–§S4.5, §S4.8 |
| AC-06 | shebang scan of 3 trees + `check-no-python` + `doctor` | **PASS** | `.claude/scripts{,/bin}` gone; 0 `.py`/`.sh` and 0 non-`node` shebangs under `.claude/hooks/`; 4 zero-caller scripts deleted; `check-no-python.cjs` 26 checks pass; `check-node-only-runtime.cjs` committed as the standing assertion — §3.3, §S1.1, §S1.6, §S1.8 |
| AC-07 | `$TMPDIR` install + Gate 1/Gate 2 probes | **PASS** | `tasks/` not in `ARCHIVE_TARGETS`, **0** `tasks/` files ship, `reinstall-empty-dirs` 0 hits; 5 templates + the workflow README at one new path each, all shipped; Gate 1 byte-identical with no `tasks/` and with an empty `tasks/plans/`, Gate 2 fails closed at exit 2; 0 stack frames — §S6.1, §S6.2, §S6.4 |
| AC-08 | golden replay + zero-residue `git status` | **PASS** | every writer on `meowkit-paths.cjs`; golden corpus **87/87** with no case re-recorded; driven session wrote only under `.meowkit/`; **the one defect the review found was here** — a shipped prose instruction, fixed and now guarded, see the fix round — §S5.1–§S5.7, §S5.10 |
| AC-09 | path resolution over the docs files + projections no-op | **PASS** | changelog pages byte-unchanged; `validate --docs-refs` `1 passed`; `link-checker.cjs` **268 files, all links valid**; `generate-cli-manual --check` PASS; `docs-manifest --check` matches 171 artifacts; `docs-references-inventory.md` refreshed in the fix round — §S6.6, §S6.7 |
| AC-10 | `check-rule-survival` + fail-on-delete probe + golden corpus | **PASS** | **61** pinned items OK; the new Enforcement-clause needle fails on deletion AND on semantic weakening, and correctly ignores an entrypoint rename; protected config namespaces still rejected — §S3.7, §S5.4 |
| AC-11 | full suite + all validators | **PASS** | build PASS, lint **0 errors** / 3 pre-existing warnings, typecheck PASS, `npm test` **299 files / 3374 tests**, hook node tests **47/47**; no `any`, no added file over 200 lines, no plan-artifact token in code — §S6.11, §S6.12, and the fix round's gate table |

## 5. Files changed

Corrected after implementation: this section's original "None" was true only of the sizing round. The
slice sections below each carry their own file lists and `git diff --stat` figures, and the review-fix round
at the end of this file carries its own. Nothing in this sprint is committed: all of it is working-tree
state on `feat/v3-lean-runtime` at HEAD `d17cc03b`.

---

# Slice 1 — scripts

The build was split into six sequential slices after the sizing finding above; this section records the
**first** one, which lands AC-06 in full and nothing else. The tree is no longer byte-identical to
`d17cc03b`: §1–§4 above describe the pre-implementation state and are kept as the record of why the split
happened, not as the current state. No commit was made (the task instruction forbids committing), so the
whole slice is one uncommitted working tree.

Environment: `PATH=/opt/homebrew/opt/node@24/bin:$PATH`, cwd = repository root, Node 24.

## S1.1 Where the 24 entries went

The reader inventory in §3.3 is the decision record; this table is what was executed against it. Two of its
rows were decided differently from §3.3 and the reason is recorded in S1.2.

| Entry at BASE | Destination | Mechanism |
|---|---|---|
| `injection-audit.cjs` | `.claude/hooks/lib/injection-audit.cjs` | `git mv` |
| `lib/injection-audit-core.cjs` | `.claude/hooks/lib/injection-audit-core.cjs` | `git mv` |
| `lib/injection-audit-patterns.cjs` | `.claude/hooks/lib/injection-audit-patterns.cjs` | `git mv` |
| `skill-python.cjs` | `.claude/hooks/lib/skill-python.cjs` | `git mv` |
| `validate-workflow-evidence.cjs` | `.claude/hooks/lib/validate-workflow-evidence.cjs` | `git mv` |
| `validate-review-coverage.cjs` | `.claude/hooks/lib/validate-review-coverage.cjs` | `git mv` |
| `lib/workflow-config-core.cjs` | `.claude/hooks/lib/workflow-config-core.cjs` | `git mv` |
| `bin/workflow-config` | `.claude/hooks/lib/workflow-config` | `git mv` (already node) |
| `bin/workflow-slug` | `.claude/hooks/lib/workflow-slug` | `git mv` + ported bash → node |
| `bin/workflow-repo-mode` | `.claude/hooks/lib/workflow-repo-mode` | `git mv` + ported bash → node |
| `bin/workflow-diff-scope` | `.claude/hooks/lib/workflow-diff-scope` | `git mv` + ported bash → node |
| `bin/workflow-review-log` | `.claude/hooks/lib/workflow-review-log` | `git mv` + ported bash → node |
| `bin/setup-workflow` | `.claude/hooks/lib/setup-workflow` | `git mv` + ported bash → node |
| `security-scan.py` | `.claude/skills/lint-and-validate/scripts/security-scan.py` | `git mv` |
| `validate.py` | `.claude/skills/lint-and-validate/scripts/validate.py` | `git mv` |
| `lint-brand-prose.sh` | `scripts/lint-brand-prose.sh` (repository) | `git mv` |
| `check-anthropic-context.py` | `scripts/check-anthropic-context.py` (repository) | `git mv` |
| `checklist.py` | deleted (0 callers) | `git rm` |
| `cost-report.py` | deleted (0 callers) | `git rm` |
| `rules-audit.sh` | deleted (0 callers) | `git rm` |
| `validate-docs.py` | deleted (0 callers) | `git rm` |
| `bin/meowkit-diff-scope` | deleted (duplicate job) | `git rm` |
| `bin/meowkit-repo-mode` | deleted (duplicate job) | `git rm` |
| `bin/meowkit-slug` | deleted (duplicate job) | `git rm` |

One name per job: the three duplicated jobs resolve to `workflow-diff-scope`, `workflow-repo-mode` and
`workflow-slug`; the three unpaired entries (`setup-workflow`, `workflow-config`, `workflow-review-log`) are
kept at their one name. `.claude/scripts/`, `.claude/scripts/bin/` and `.claude/scripts/lib/` no longer
exist.

## S1.2 Two destinations decided differently from §3.3, and why

**(a) `injection-audit.cjs` → `hooks/lib/`, not `hooks/`.** The criterion's destination set is closed and
reads "exactly one destination from `hooks/lib/`, the owning skill's `scripts/`, the repository, or
deleted". `hooks/` top level is not a member of that set, and putting an agent-invoked executable there
would also have made `check-hook-registration.sh` report it as an unregistered hook, which is answered by
widening an allowlist rather than by placing the file correctly.

**(b) The six `bin/` entries → `hooks/lib/`, with five ported to node.** The same closed set leaves
`hooks/lib/` as the only in-kit destination: the entries have 15–71 callers spread over eight skills, so no
single skill owns them, and they are invoked from installed projects, so the repository is not an option
either. `hooks/lib/` then had to satisfy the Node-only property, which `#!/usr/bin/env bash` does not — so
the five shell entries were reimplemented on node at the same names. `workflow-config` was already node.
Output parity against the BASE bash was checked by diff, not by reading: `workflow-slug`,
`workflow-repo-mode`, `workflow-diff-scope main` and `workflow-diff-scope HEAD~5` each produce output
**identical** to the BASE script extracted from `de278a5f`. `workflow-review-log` now resolves its
destination through `hooks/lib/meowkit-paths.cjs` rather than a hard-coded `.meowkit/telemetry`, and
`setup-workflow` resolves the launcher through `launcher-path-env.cjs`'s existing containment check — so
neither port adds a second path resolver.

`hooks/lib/` now holds two kinds of file and `HOOKS_INDEX.md` says so explicitly, because the tree's old
one-line description ("nothing invokes them") stopped being true.

## S1.3 Re-path counts

| Pass | Files | Sites |
|---|---|---|
| Bulk literal re-path (16 patterns) | 112 | 237 |
| Individual edits (prose, tree lists, path-segment forms, permissions) | 25 | 31 |
| Call sites converted from a bare interpreter to `skill-python.cjs` | 8 | 15 |
| **Total** | **137** | **283** |

Working tree: 137 files modified, 24 moved or deleted through the index.

Deliberately **not** re-pathed, with the reason:

- `scripts/record-port-golden-corpus.cjs`, `scripts/lib/port-corpus-env.cjs`,
  `scripts/lib/port-corpus-invoke.cjs`, `tests/ports/golden/index.json` — the recorder and its index name
  the **pinned pre-port subjects** and `git archive` them out of a historical SHA. Re-pointing them at
  today's paths would make the corpus describe the implementation it exists to compare against.
- `packages/mewkit/src/migrate/**`, `packages/mewkit/src/validate/**`,
  `packages/mewkit/src/kit/__tests__/kit-tamper-corpus.test.ts` — every occurrence is a synthetic fixture
  path (`.claude/scripts/x.cjs`, `validate-docs.cjs`, `canary.sh`) that stands for "some kit script", never
  a reference to a real file. Verified one by one.
- `packages/mewkit/src/migrate/modules/**` (the codex and cursor projections) — they carry their own
  namespaces (`.codex/scripts/`, `.cursor/scripts/`) and name no `.claude/scripts/` path, so this slice does
  not touch them. Their own layout is a separate question and is **left for the docs/projection slice**.
- `packages/docs/content/docs/changelog/*` — out of scope by a standing decision.
- `release-manifest.json` — a generated release artifact, already stale at BASE (it still lists
  `injection-audit.py`, `verify-env-loading.sh` and `scripts/bin/meowkit-config`).
- `packages/docs/content/docs/migration.mdx:48` — `.claude/scripts/` appears as an example of an *unmapped
  runtime path* the migrator neutralizes, which is still exactly what the migrator does. Flagged for the
  docs slice rather than rewritten here.

## S1.4 Collateral changes the redistribution forced

- `.meowkit/pack-manifest.json`: `base.globs` loses `scripts/**`; `base.exclude` loses
  `.claude/scripts/lint-brand-prose.sh` and `.claude/scripts/check-anthropic-context.py` (both files now
  live outside every archive root, so no exclusion is needed). This is one of the eight declarations the
  conjunction criterion counts; the other seven are untouched.
- `deletions.json`: the 24 retired `scripts/**` paths added, so an upgrade removes them from an existing
  install rather than relying only on the orphan sweep. `DEFAULT_ORPHAN_SCOPES` keeps `"scripts"` for the
  same reason it keeps `"rules-conditional"` — it is the sunset mechanism for a directory a release drops.
- `commands/doctor-checks.ts`: `checkScripts` reads `.claude/hooks/lib/` for `injection-audit.cjs`. `doctor`
  reports `[PASS] Scripts — 1 validation scripts found`.
- `scripts/lib/no-python-checks.cjs`: the planted-finding check runs the auditor from its new path.
- `.claude/skills/lint-and-validate/SKILL.md`: gains `requires_runtime: [python>=3.9]`. The two `.py` files
  are now skill-owned on a documented invocation path, which `validate --frontmatter` requires a runtime
  declaration for — it failed with one error until the key was added. `mewkit skill env --list` now shows
  `lint-and-validate   python>=3.9 · stdlib only`, and the 15 documented call sites across five files were
  converted from a bare `python3` (or the retired `.claude/skills/.venv/bin/python3`) to
  `node .claude/hooks/lib/skill-python.cjs <script>`, so the scripts reach the per-skill environment the
  declaration creates instead of bypassing it.
- `.claude/settings.json`: the dead `Bash(python .claude/scripts/*)` permission is removed. No permission is
  added — the existing `Bash(node .claude/hooks/*)` already covers the new invocation form.
- `clean-code/references/coding-standards.md`: the `validate-docs` and `checklist` rows are gone with the
  scripts. `vulnerability-scanner.mdx` and `clean-code.mdx` lose the three stale `injection-audit.py` /
  `validate-docs.py` / `checklist.py` rows.
- `packages/docs/docs-reference-manifest.json` regenerated (`docs-manifest.cjs --write`), 167 artifacts.

## S1.5 The always-on rules budget

Two always-on rules name the auditor, and `scripts` → `hooks/lib` is **+2 bytes** each, so the naive edit
*spent* 4 of the 99 bytes of headroom, which the scope forbids. Reclaimed in the same sentence:
`gate-rules.md`'s log line was rewritten from "Records live in `…` (STOP events) and in the active plan plus
`…`" to "`…` records STOP events; the active plan and `…` record overrides and gate exceptions" — 9 bytes
shorter, same two stores and same two event classes, and not a pinned survival needle (checked against
`rule-survival-oracle.cjs`).

```
node scripts/check-always-on-budget.cjs .
→ measured total: 25496 bytes (limit 25600)
  OK: 104 bytes of headroom.
```

**25 496 ≤ 25 501**, so the subtotal is below its BASE value and the headroom is not spent.

## S1.6 The Node-only-executable property is now asserted by a committed check

New: `scripts/check-node-only-runtime.cjs` + `scripts/lib/node-only-runtime-data.cjs`, wired into CI as
"Check the shared executables need node only". Three claims, all read off the **computed ship set**:

1. no shipped file under `.claude/scripts/`;
2. inside the node-only trees (`.claude/scripts`, `.claude/hooks`) no `.py`/`.sh` name **and** no first-line
   shebang naming a non-node interpreter — the shebang is the test because the shared executables carry no
   extension at all;
3. each of the **74** skill-owned interpreter scripts that shipped at BASE still ships from exactly its own
   path (a retention list, one-directional, so a skill adding a script later does not break it).

The 74 are machine-derived from the BASE ship set, not hand-listed. Positive control: planting
`#!/usr/bin/env bash` at `.claude/hooks/lib/.probe-tmp` makes the check exit 1 and name the file, so a green
result is evidence rather than an unexercised code path.

```
node scripts/check-node-only-runtime.cjs
→ ok    no shipped file under .claude/scripts/
  ok    80 shipped file(s) in the node-only trees, none interpreter-dependent
  ok    74 skill-owned interpreter script(s) still ship from their own paths
```

## S1.7 Ship-set effect, measured

`scripts/kit-ship-set.cjs` over the tracked tree, BASE vs now:

```
BASE 1218 tracked ship-set files → NOW 1222
removed: exactly the 22 shipped .claude/scripts/ entries
added:   the 15 relocated kit files + the 2 skill-owned .py
```

Shipped top-level `.claude/` entries: **17 → 16** (`scripts/` gone). The remaining eight departures belong to
the later slices.

Two pre-existing ship-set leaks surfaced while diffing and are **not** this slice's doing:
`.claude/hooks/.logs/hook-log.jsonl` and `.claude/skills/web-to-markdown/.pytest_cache/**` ship because no
`base.exclude` pattern covers them. Worth an exclusion in the maintainer-content slice.

## S1.8 Every caller exercised

| Caller / surface | Result |
|---|---|
| `node .claude/hooks/lib/injection-audit.cjs <dir>` and `--file` | both answer; `--file` emits the JSON finding object |
| the two always-on rules naming it | both name the new path; `check-dangling-rule-refs` and `validate-rule-availability` green |
| `mewkit doctor --hard-gates` | `[PASS] Scripts — 1 validation scripts found`; 26 passed, 5 warnings, **0 failed** |
| `node .claude/hooks/lib/skill-python.cjs` | prints its usage; runs both relocated `.py` end to end once the skill env exists |
| `hooks/lib/gate2-structural-checks.cjs` | both validator constants re-pointed; `.claude/hooks/__tests__` 36/36 pass under `node --test` |
| `validate-workflow-evidence.cjs --self-test` | `SELF_TEST_OK`, all four self-tests PASS |
| `validate-review-coverage.cjs` | argument check and the Gate 2 coverage suite pass |
| `workflow-config get / has / set` | `set` writes `.meowkit/state/workflow-state.json` in a throwaway project |
| the five ported `bin` entries | byte-identical output to the BASE bash where comparable (see S1.2) |
| `scripts/lint-brand-prose.sh` from its new home | `tests/changed-files-lint.test.sh` 9/9 pass |
| golden replay (`tests/ports`) | injection-audit and workflow-config parity suites green |

The doctor run needs the seven retired `MEOWKIT_*` names unset in the shell first; with them exported it
reports 7 failures that are entirely about the shell, not the kit.

## S1.9 Gate results for this slice

| Gate | Result |
|---|---|
| `npm run build` | PASS |
| `npm run lint` | PASS — 0 errors, 3 warnings (all pre-existing: unused `countFiles` etc.) |
| `npm run typecheck` | PASS — no output |
| `npm test` | PASS — 297 files / 3378 tests, 0 failures. Identical to the BASE baseline run (297 / 3378); no `withFileLock` flake appeared in either |
| `node scripts/check-no-python.cjs --allow-existing-envs` | PASS — all 26 checks with no interpreter on PATH |
| `node scripts/check-node-only-runtime.cjs` | PASS (S1.6) |
| `node scripts/check-always-on-budget.cjs .` | PASS — 25 496 B (S1.5) |
| `node scripts/check-kit-verbs.cjs` | PASS — 281 references resolve against 24 commands |
| `node scripts/check-dangling-rule-refs.cjs .` | PASS — 8257 files, 16 destinations loaded |
| `node scripts/check-rule-survival.cjs .` | PASS — 60 pinned items survive |
| `node scripts/check-env-reads.cjs` | PASS — 138 reads, every row agrees with the code |
| `node scripts/docs-manifest.cjs --check` | PASS after `--write` |
| `node scripts/harness-inventory.cjs --check` | PASS |
| `node scripts/generate-cli-manual.cjs --check` | PASS |
| `bash scripts/check-hook-registration.sh` | PASS — 6 hooks registered/allowlisted |
| `bash scripts/validate-rule-availability.sh` | PASS |
| `mewkit validate` (all) | 40 passed, 34 warnings, 1 n/a |
| `mewkit validate --packs / --workflow / --frontmatter / --docs-refs / --gates / --agents / --ownership` | all PASS |
| `mewkit doctor --hard-gates` | PASS (S1.8) |
| `bash scripts/check-skill-cross-refs.sh` | **FAIL, identical at BASE** — see below |
| control-character scan over 146 changed/new files | 0 hits |

`check-skill-cross-refs.sh` exits 1 both before and after this slice, with the same single finding:
`BROKEN_LOCAL_REF: .claude/skills/context-audit/SKILL.md -> scripts/harness-inventory.cjs`. The checker
resolves a `scripts/…` token relative to the naming file, and that line deliberately names a **maintainer**
script in the repository ("maintainer script, MeowKit repo only"). Verified by running the checker inside a
`git archive` of `de278a5f`: same exit code, same single line. It is a pre-existing defect unrelated to the
redistribution and outside this criterion; the repo-green criterion will have to settle it.

## S1.10 What the next slices need to know

1. **`hooks/lib/` is now the kit's shared-executable home**, not only a library directory. Anything later
   that reasons about "what is a hook" should read the new `HOOKS_INDEX.md` paragraph first.
2. **One of the eight base declarations is already removed** (`base.globs: scripts/**`) plus the two
   `base.exclude` entries. The conjunction slice should count seven remaining, not eight.
3. **The rules subtotal is 25 496 B, 5 bytes below its BASE value.** The remaining always-on edits
   (`security-rules.md:26`, the `gate-rules.md` reviewer path list) have 104 bytes to work in, not 99.
4. **`check-node-only-runtime.cjs` holds a frozen 74-path retention list.** A later slice that legitimately
   relocates a skill-owned `.py`/`.sh` must edit `scripts/lib/node-only-runtime-data.cjs` in the same change
   or the check fails — which is the intended behavior.
5. **Two ship-set leaks to fix in the maintainer-content slice:** `.claude/hooks/.logs/` and
   `.claude/skills/*/.pytest_cache/`.
6. **`check-skill-cross-refs.sh` is red at BASE** (S1.9). It is the one committed validator that is not green
   on arrival.
7. **The provider projections were not touched** and name no relocated path; the docs/projection slice owns
   whatever their `.codex/scripts/` and `.cursor/scripts/` layouts should become.
8. `packages/docs/content/docs/migration.mdx:48` still names `.claude/scripts/` as an unmapped-runtime
   example — a docs-slice judgement, not a dangling reference.

---

# Slice 2 — domain moves

The second of the six slices. It lands AC-04 in full and nothing else; the other nine criteria are
untouched. Still no commit (the task instruction forbids it), so slices 1 and 2 are one uncommitted
working tree on top of `d17cc03b`.

Environment: `PATH=/opt/homebrew/opt/node@24/bin:$PATH`, cwd = repository root, Node 24.22.2.

## S2.1 What moved

| At BASE | Now | Mechanism |
|---|---|---|
| `.claude/rubrics/**` (14 files incl. `composition-presets/`, `calibration-set/`) | `.claude/skills/rubric/rubrics/**` | `git mv` (directory) |
| `.claude/rules-conditional/agile-story-gates.md` | `.claude/skills/agent-detector/references/agile-story-gates.md` | `git mv` |
| `.claude/rules-conditional/agile-sprint-commitment.md` | `.claude/skills/agent-detector/references/agile-sprint-commitment.md` | `git mv` |
| `.claude/rules-conditional/agile-feedback-cycle.md` | `.claude/skills/agent-detector/references/agile-feedback-cycle.md` | `git mv` |
| `.claude/rules-conditional/advice-supervision-rules.md` | `.claude/skills/advise/references/advice-supervision-rules.md` | `git mv` |
| `.claude/rules-conditional/workflow-evidence-rules.md` | `.claude/skills/advise/references/workflow-evidence-rules.md` | `git mv` |
| `.claude/workflow.yaml` | `.claude/skills/workflow-orchestrator/workflow.yaml` | `git mv` |
| `.claude/capability-bootstrap.md` | `.claude/hooks/references/capability-bootstrap.md` | `git mv` |

`.claude/rules-conditional/` no longer exists. Each file lives at exactly one path; `ls` on every BASE
path returns ENOENT and on every new path returns the file.

`capability-bootstrap.md` went to `hooks/references/`, not `hooks/handlers/`: `references/` is already the
hooks tree's home for prose a handler reads (`build-verify-commands.md`, `summary-prompt-template.md`), and
`handlers/` is the directory `check-hook-registration.sh` and the ownership seeder enumerate as handler
files. The handler still resolves it relative to itself (`__dirname/../references/...`), so the
differently-rooted published layout keeps working.

`harness-substrate.md` was NOT moved: per the contract it leaves the shipped kit by **exclusion**, which is
the maintainer-content criterion's business, not this one. It was regenerated (see S2.5) because the
ownership registry changed under it.

## S2.2 The canonical pointer, and why it got shorter

The destination path is 37 bytes longer than `.claude/workflow.yaml`, and the pointer appears in two
always-on rules. A literal move would have put the rules subtotal at **25 554 B** — over the 25 501 B
ceiling, measured:

```
.claude/rules with the long pointer  → 25554 bytes
```

The shortening the decision licenses: the pointer is now **`Canonical source: workflow.yaml`** (31 B, 8 B
shorter than at BASE), changed in the same breath in all six prose sources, in the spec's own header
comment, and in `check-workflow-drift.ts`, where it is no longer a literal but
`` `Canonical source: ${SPEC_FILENAME}` `` next to the new `SPEC_REL` the loader reads. One constant, two
uses, no way to move the file without moving the pointer. The basename is unique in the kit and the full
path is spelled out in `skills/workflow-orchestrator/SKILL.md`, which is where the file now sits.

Options rejected on measurement: `Canonical source: skills/workflow-orchestrator/workflow.yaml` (60 B,
+42 over budget), `.../workflow-orchestrator/workflow.yaml` (53 B), `mk:workflow-orchestrator/workflow.yaml`
(56 B). `Canonical source: mk:workflow-orchestrator` (42 B) fits but names no file.

Result after every always-on edit in this slice:

```
node scripts/check-always-on-budget.cjs .
→ measured total: 25436 bytes (limit 25600)
  OK: 164 bytes of headroom.
```

**25 436 ≤ 25 501**, 60 B below BASE and 65 B below the ceiling the criterion pins — so the longer path is
paid for, not absorbed, and the remaining always-on edits have more room than they started with, not less.
The second always-on edit this slice forced is the reviewer path list: `.claude/rules-conditional/` had to
leave it, and the two destination directories had to enter it. Written out verbatim that is +29 B; written
as `.claude/skills/{advise,agent-detector,autobuild,cook,fix}/` the whole clause is **44 B shorter** than at
BASE while reaching one more directory than before (`advise`, `agent-detector` added; `cook`, `fix`,
`autobuild` unchanged; `.claude/modes/` deliberately left for the criterion that owns it).

## S2.3 Readers, run rather than grepped

| Reader | Result |
|---|---|
| `mewkit validate --workflow` | 6 passed — spec found and parsed at the new path, all six prose sources carry the new pointer |
| `--workflow` negative control | spec moved aside in a scratch copy → `[FAIL] Workflow spec loads … skills/workflow-orchestrator/workflow.yaml` |
| capability-bootstrap golden cases | `tests/hooks/golden-replay.test.ts` 86/86, both fixtures **unedited** |
| the handler itself | `require()`d and called: returns 1624 bytes starting `## Capability resolution` |
| `core/bootstrap.ts` drift test | passes — `BOOTSTRAP_FILENAME` is now `hooks/references/capability-bootstrap.md`, so `capabilities bootstrap --write` and the drift test agree on one path |
| `load-rubric.sh --list` / `--preset cli-tool` | lists 7 rubrics, composes `cli-tool` with weights |
| `validate-rubric.sh` (all) | `ALL_RUBRICS_VALID: 11 file(s) passed`, 3 presets sum to 1.0000 |
| `recompute-score.py` | `--rubrics-dir` default now the new path; `--help` parses |
| `mewkit validate --frontmatter` | 1 passed |
| `mewkit validate --docs-refs` | 1 passed |
| `--docs-refs` negative control | planted `docs/core/does-not-exist-rubrics.md` in a scratch `.claude/` prose file → `[FAIL] … skills/advise/SKILL.md:244` |
| `agents/athena.md` + the 6 `athena-*.ts` + `core/workflow-evidence-revision.ts` | all cite the new contract path; `athena-provider-parity` 136/136 (it **reads** the contract file, so a stale path was a hard ENOENT, not a soft miss) |
| `mewkit validate` (all) | 40 passed, 34 warnings, 1 n/a — identical to the slice-1 baseline |

## S2.4 The move registry

Six entries appended to the **existing** `scripts/dangling-rule-refs-data.cjs`; no second registry, and
`check-dangling-rule-refs.cjs` keeps its three rules:

- `advice-supervision-rules`, `workflow-evidence-rules` → `.claude/skills/advise/references/…`
- `agile-story-gates`, `agile-sprint-commitment`, `agile-feedback-cycle` →
  `.claude/skills/agent-detector/references/…`, flagged `citedByName`
- `capability-bootstrap` → `.claude/hooks/references/capability-bootstrap.md`

`citedByName` is new and needed: rule (b) turns a bare `<name>.md` in shipped prose into a violation, and
the three agile rules are **dispatched by name and then cited by name** — "per `agile-story-gates.md` 2",
"gated by `agile-sprint-commitment.md` 1" — in 12 kit files and 14 provider-bundle files. Without the flag
the registry entry would force either 26 full-path rewrites of prose that is citing a rule rather than
pointing at a file, or a dozen blanket file exemptions that would gut the check for every other entry.
Rules (a) and (c) still apply to them, and (c) is real teeth here: it requires the destination to be named
by a load step, which `skills/agent-detector/SKILL.md` does.

Two moves are **not** in the registry, and the reason is the registry's shape rather than a judgement call:
its needle is `${name}.md`. `rubrics/` is a directory and `workflow.yaml` is not an `.md` file, so neither
can be expressed without changing the check — and a `workflow.yaml` needle would additionally make the
budget-mandated short pointer a rule-(b) violation in six files, two of them always-on rules. Flagged for
the evaluator as the one place this slice does not satisfy "every move is appended" literally.

Teeth, observed live rather than asserted:

```
# before the entries were added to the test's DESTINATIONS list
  (c) no load step references the new location of advice-supervision-rules
  (c) no load step references the new location of workflow-evidence-rules
  (c) no load step references the new location of agile-story-gates …
  (c) no load step references the new location of capability-bootstrap

# planted in a scratch copy of the finished tree
echo 'Read `advice-supervision-rules.md`' >> .claude/skills/advise/SKILL.md
→ .claude/skills/advise/SKILL.md:240: (b) bare `advice-supervision-rules.md` — not its new path
  FAIL: 1 dangling-reference violation(s).
```

```
node scripts/check-dangling-rule-refs.cjs .
→ OK: no dangling references; all 22 destinations are loaded.   (16 → 22)
```

## S2.5 Collateral the moves forced

- **`.meowkit/pack-manifest.json`**: `base.files` loses `workflow.yaml`; `base.globs` loses `rubrics/**`
  and `rules-conditional/**`. Three more of the eight declarations gone (slice 1 took one), so the
  conjunction slice should count **four** remaining: `schemas/**`, `agent-memory/**`, `modes/**`,
  `base.commands`.
- **`.meowkit/harness-inventory.json`**: the five `rules-conditional/*` ownership entries removed (66 → 61
  artifacts). A skill reference file is not a registry artifact, so re-keying was not available — the
  ownership check reported `registry entry has no matching artifact on disk` for all five until they went.
  `scripts/seed-ownership-metadata.cjs` loses its `rules-conditional` enumeration and its
  `REGISTRY_PREFIXES` entry so the seeder cannot put them back.
- **`.claude/harness-substrate.md`** regenerated (`harness-inventory.cjs --substrate --emit`). Coverage is
  unchanged at **11/12** responsibilities; three rows lose the retired registry entries from their counts
  (Task state 7→5, Observability 12→11, Failure attribution 4→3, Gate enforcement 11→10) and none drops to
  zero.
- **`packages/mewkit/src/core/build-inventory.ts`**: the `rules-conditional/` bucket is gone (it would have
  enumerated an absent directory forever), and `check-stale-index.ts`'s `rulesConditional` field with it —
  it was computed and read by nothing, so no declared count depended on it.
- **`check-docs-references.ts`** drops `rules-conditional` from `SCAN_DIRS`, and
  `docs/maintainer/docs-reference-contract.md` drops it from the sentence that mirrors that list.
- **`tests/surface-contract.test.sh`**: invariant 3 no longer scans `rules-conditional/`. The invariant
  wants team-coordination rules to be skill-local, which is now true by construction.
- **`deletions.json`**: the 21 retired paths added, so an upgrade removes them from an existing install
  rather than relying on the orphan sweep alone. `find-orphans`'s `rules-conditional` scope and
  `context-budget.ts`'s `conditional` tier are **kept** — both are the sunset mechanism for a directory a
  release drops, exactly as `"scripts"` was kept in slice 1. `budget.ts`'s tier legend no longer names the
  retired directory ("conditional (loaded only on detection)").
- **`.claude/skills/agent-detector/SKILL.md`** pre-flight now probes `references/agile-story-gates.md`
  beside the skill instead of a directory that cannot exist; the docs page and the Agile workflow page say
  the same.
- **`.claude/skills/agent-detector/references/agile-story-gates.md`** had two `mk:project-manager`
  references. Inside `rules-conditional/` nothing resolved them; inside a skill, `check-skill-cross-refs.sh`
  does, and reported `PHANTOM: mk:project-manager` — `project-manager` is an **agent**, so the two lines now
  say so. A real latent defect the move surfaced.
- **`.claude/skills/advise/references/workflow-evidence-rules.md`** line 75 named `.meowkit/memory/…`, which
  the brand-token check reads as a brand mention; `advise` is one of four skills pinned brand-token-free, so
  the sentence now names the two memory files without the state-root path.
- **`.claude/.brand-allowlist.txt`**: the seven rubric entries re-pathed (full `.claude/`-rooted paths are
  the allowlist's only accepted form).
- **`packages/docs/docs-reference-manifest.json`** + `reference/skills/rubric.mdx` regenerated.

## S2.6 Re-path counts

| Pass | Files | Note |
|---|---|---|
| Bulk literal re-path over `.claude/`, `docs/`, `packages/docs/content/`, root md | 67 | 7 patterns, longest-first |
| Engine source + tests (TS/CJS/PY/SH), by hand | 24 | includes the two new `check-workflow-drift.ts` constants |
| Prose/behaviour edits the move forced (pre-flight, pointer, path list, citations) | 14 | S2.5 |
| Generated artifacts | 4 | substrate view, harness inventory, docs manifest, rubric.mdx |

Working tree after slices 1+2: **256** entries in `git status --porcelain`, of which 32 are moves or
deletions through the index.

Deliberately **not** re-pathed, with the reason:

- `packages/mewkit/src/migrate/modules/**` (the codex and cursor authored bundles) — they carry their own
  namespaces (`.codex/rubrics/`, `.codex/workflow.yaml`, `.agents/skills/rule-*`) and name no `.claude/`
  path this slice moved. Their `agile rules: rules-conditional/ not deployed` log string and their
  pre-flight wording now differ from the kit's; **the docs/projection slice owns that**, as it did for
  slice 1.
- `packages/mewkit/src/core/__tests__/check-gate-authority.test.ts` — `.claude/rules-conditional/x.md` is a
  synthetic file written into a throwaway project to prove the scanner fires on an arbitrary relative path,
  not a reference to a repo file. The criterion that owns the gate-authority fixture is the modes one.
- `packages/mewkit/src/core/__tests__/release-metadata.test.ts` — `rules-conditional/old-rule.md` is a
  synthetic deletion-list entry; a retired path is exactly what that list carries.
- `packages/mewkit/tests/find-orphans.test.ts` — the migration-sunset fixture.
- `docs/architecture/adr/260511-agile-scrum-conditional-rule-layer.md` — an ADR records what was decided
  when it was decided; rewriting its history would make it describe a tree it never approved.
- `scripts/validate-rule-availability.sh:77` — the comment says "the legacy `.claude/rules-conditional/`",
  which is now simply true.
- `release-manifest.json`, `packages/docs/content/docs/changelog/*` — generated artifact and standing
  exclusion, as in slice 1.

## S2.7 Ship-set effect, measured

```
scripts/kit-ship-set.cjs over the tracked tree
→ 1222 files (unchanged from slice 1 — moves are net-neutral)
  roots: .claude .meowkit release-manifest.json tasks
  .claude/ top level = 12 :: agent-memory agents benchmarks commands harness-substrate.md
                             hooks modes rules schemas settings.json skills statusline.cjs
  departing paths still shipped: 0
  new paths shipped: 21 (14 rubrics + 5 rules + workflow.yaml + capability-bootstrap.md)
```

Shipped `.claude/` top level: **17 at BASE → 16 after slice 1 → 12 now.** Six departures remain
(`agent-memory`, `benchmarks`, `commands`, `harness-substrate.md`, `modes`, `schemas`), which would leave
the six the target tree keeps.

## S2.8 Gate results for this slice

| Gate | Result |
|---|---|
| `npm run build` | PASS |
| `npm run lint` | PASS — 0 errors, 3 warnings (all pre-existing) |
| `npm run typecheck` | PASS — no output |
| `npm test` | PASS — **297 files / 3378 tests, 0 failures**, identical to the BASE and slice-1 baseline |
| `mewkit validate` (all) | 40 passed, 34 warnings, 1 n/a |
| `mewkit validate --workflow` | 6 passed |
| `mewkit validate --docs-refs` | 1 passed |
| `mewkit validate --packs` | 1 passed |
| `mewkit validate --gates` | 2 passed |
| `mewkit validate --frontmatter` | 1 passed |
| `node scripts/check-dangling-rule-refs.cjs .` | PASS — 8668 files, 22 destinations loaded |
| `node scripts/check-always-on-budget.cjs .` | PASS — **25 436 B** (S2.2) |
| `node scripts/check-rule-survival.cjs .` | PASS — 60 pinned items survive |
| `node scripts/check-kit-verbs.cjs` | PASS — 281 references, 24 commands |
| `node scripts/check-node-only-runtime.cjs` | PASS — 81 shipped files in the node-only trees, 74 skill-owned scripts retained |
| `node scripts/check-env-reads.cjs` | PASS — 138 reads |
| `node scripts/check-no-python.cjs --allow-existing-envs` | PASS — all 26 checks, no interpreter on PATH |
| `node scripts/docs-manifest.cjs --check` | PASS after `--write` |
| `node scripts/harness-inventory.cjs --check` | PASS |
| `node scripts/generate-cli-manual.cjs --check` | PASS |
| `node scripts/link-checker.cjs` | PASS — 264 files, all links valid |
| `bash scripts/validate-rule-availability.sh` | PASS |
| `bash scripts/check-hook-registration.sh` | PASS — 6 hooks |
| `bash tests/surface-contract.test.sh` | PASS — 0 failed |
| `bash tests/changed-files-lint.test.sh` | PASS — 9/9 |
| golden replay (`tests/hooks/golden-replay.test.ts`) | PASS — 86/86, fixtures unedited |
| port replay (`tests/ports`) | PASS — 58/58 |
| `node --test .claude/hooks/__tests__/*.test.cjs` | PASS — 36/36 |
| `mewkit doctor --hard-gates` | PASS — 26 passed, 5 warnings, 0 failed (retired `MEOWKIT_*` unset) |
| `bash scripts/check-skill-cross-refs.sh` | **FAIL, identical to BASE** — the one pre-existing finding, see below |
| control-character scan over 244 changed/new files | 0 hits |

`check-skill-cross-refs.sh` exits 1 with exactly the finding it exits 1 with at BASE:
`BROKEN_LOCAL_REF: .claude/skills/context-audit/SKILL.md -> scripts/harness-inventory.cjs`. The transient
second finding this slice introduced (`PHANTOM: mk:project-manager`) was a real defect the move exposed and
is fixed, so the checker is no worse than on arrival.

Scope note: `scripts/link-checker.cjs` resolves links only inside `packages/docs/content/docs/**.mdx` — it
never reads `.claude/`, so it is green but has **no reach** over the moved paths by construction. Its teeth
were confirmed inside its own scope (a planted `../../rubrics/schema.mdx` link in a docs page →
`❌ 1 broken link(s) found.`). The reference guard over `.claude/` is `check-dangling-rule-refs` plus
`check-skill-cross-refs`, both exercised above.

## S2.9 What the next slices need to know

1. **The rules subtotal is 25 436 B** — 65 B below the 25 501 B the criteria pin and 164 B below the CI
   literal. The commands slice's `security-rules.md:26` rewrite and the modes slice's remaining
   `gate-rules.md` edit have real room now.
2. **`gate-rules.md`'s reviewer path list already names the two directories `rules-conditional/` content
   moved to**, in brace form: `.claude/skills/{advise,agent-detector,autobuild,cook,fix}/`. The modes slice
   still owns removing `.claude/modes/` from that same clause, and the before/after directory-set comparison
   its criterion requires should be taken against this list, not against BASE's.
3. **`Canonical source: workflow.yaml` is now the pointer**, and `check-workflow-drift.ts` exports
   `SPEC_FILENAME` and `SPEC_REL`. Anything that adds a lifecycle prose source must carry that exact string.
4. **Four base declarations remain**, not seven: `schemas/**`, `agent-memory/**`, `modes/**` in
   `base.globs` and the `base.commands` key.
5. **The shipped `.claude/` top level is 12.** The six departures left are `agent-memory`, `benchmarks`,
   `commands`, `harness-substrate.md`, `modes`, `schemas`.
6. **`.claude/harness-substrate.md` is regenerated and currently tracked as modified.** The maintainer-content
   slice excludes it from the ship set; it must not also re-generate it from a stale inventory.
7. **The ownership registry no longer has a `rules-conditional/` prefix.** The commands slice will hit the
   same wall for `commands/mk/*.md`: 24 ownership entries and the seeder's `commands/` prefix go with the
   directory, or `validate --ownership` reports one FAIL per orphaned entry.
8. **`check-dangling-rule-refs-data.cjs` now has a `citedByName` flag.** A rule that is dispatched by name
   and cited by name in prose gets it; everything else is still held to rule (b).
9. **The provider bundles are drifting.** Slice 1 left their `.claude/scripts/` question open; slice 2 adds
   the agent-detector pre-flight wording and the `rules-conditional/` log string. The docs/projection slice
   inherits both.
10. **`check-skill-cross-refs.sh` resolves `mk:*` tokens inside `.claude/skills/` only.** Moving prose into
    a skill subjects it to that check for the first time — expect the commands slice to surface the same
    class of latent phantom when command bodies become skills.

---

# Slice 3 — commands, needle, modes

The third of the six slices. It lands AC-02 (except the 21 docs occurrences AC-09 owns), AC-10's
rule-survival needle, and AC-03 in full. Still no commit, so slices 1–3 are one uncommitted working
tree on top of `d17cc03b`.

Environment: `PATH=/opt/homebrew/opt/node@24/bin:$PATH`, cwd = repository root, Node 24.22.2.

## S3.1 Disposition table, as applied

Totals: **11** `delete-duplicate` · **11** `delete-and-rewrite-references` · **2**
`fold-into-existing-skill` · **4** `promote-to-skill` → 27 rows, one disposition each, cap
satisfied. The recommendation in §2 was applied unchanged; `design` is the one of the five
judgement cases that folds rather than promotes.

| # | Command | Disposition | Target, as applied |
|---|---|---|---|
| 1–11 | `advise` `autobuild` `context-audit` `cook` `docs-init` `fix` `help` `orchestrate` `retro` `review` `ship` | delete-duplicate | the same-name skill, unchanged |
| 12 | `plan` | delete-and-rewrite-references | `mk:plan-creator` (name **not** preserved) |
| 13 | `audit` | delete-and-rewrite-references | `mk:cso` — incl. the always-on `rules/security-rules.md` Enforcement clause |
| 14 | `canary` | delete-and-rewrite-references | `mk:ship` (no surviving reference) |
| 15 | `test` | delete-and-rewrite-references | `mk:testing` (no surviving reference) |
| 16 | `validate` | delete-and-rewrite-references | `mk:lint-and-validate` (no surviving reference) |
| 17 | `docs-sync` | delete-and-rewrite-references | `mk:document-release` (no surviving reference) |
| 18 | `meow` | delete-and-rewrite-references | `mk:agent-detector` (no surviving reference) |
| 19 | `spawn` | delete-and-rewrite-references | `mk:team-config` |
| 20 | `upgrade` | delete-and-rewrite-references | the `mewkit upgrade` verb |
| 21 | `budget` | delete-and-rewrite-references | the `mewkit budget` verb (+ `mk:context-audit` for the token half) |
| 22 | `confluence-setup` | fold-into-existing-skill | `mk:confluence` → `references/install-and-auth.md` "Guided setup" |
| 23 | `design` | fold-into-existing-skill | `mk:improve-codebase-architecture` → `references/system-design-consultation.md` |
| 24 | `arch` | promote-to-skill | new `mk:arch` (`.claude/skills/arch/SKILL.md`) |
| 25 | `breakdown` | promote-to-skill | new `mk:breakdown` |
| 26 | `delegate` | promote-to-skill | new `mk:delegate` |
| 27 | `status` | promote-to-skill | new `mk:status` |

None of the four promoted skills is a dispatcher: each carries the procedure the command carried
(ADR lifecycle modes, the 5-step spec→stories→tickets→breakdown pipeline, the 7-field prompt build
with its injection guard, plan resolution + the agent hand-off), and none has a body that delegates
to one other skill. `/mk:plan` is gone as a name, as D3 and Scope (Out) require.

## S3.2 Measured reference universe, and a drift from the contract's figure

Measured on the slice-1+2 tree by exact token (`/mk:plan` not matching `/mk:plan-creator`) over the
ten command-only targets, outside `tasks/` and `.claude/worktrees/`:

```
union 60  ·  non-docs 40  ·  docs (docs/ + packages/docs/content/) 20
```

The contract's split is **39 / 21**. The union is **60**, unchanged; the boundary moved by one file
because slices 1 and 2 re-pathed prose across it. This criterion took the **40**, AC-09 keeps the
**20**, the two sets are disjoint and their union is the measured 60 — so no occurrence is claimed
by neither criterion. Ten of the 40 were the command files themselves and left with the directory.

Per-target load at the start of this slice: `plan` 32 · `budget` 14 · `status` 14 · `audit` 4 ·
`breakdown` 4 · `confluence-setup` 5 · `delegate` 3 · `arch` 2 · `design` 2 · `validate` 2.
`arch`, `breakdown`, `delegate` and `status` needed **no rewrite** — their names now resolve to
skills.

## S3.3 Re-path counts

| Pass | Files | Note |
|---|---|---|
| Bulk exact-token substitution (`plan`→`plan-creator`, `audit`→`cso`, `spawn`→`team-config`, `confluence-setup`→`confluence`) | 20 | 23 matched; 3 reverted (synthetic test fixtures, below) |
| `budget` → the `mewkit budget` verb, by hand | 5 | 2 descriptions, 1 table, 1 shell print, 1 test expectation |
| Prose the rewrite made wrong (alias line, "that command", setup phrasing, example rows) | 9 | S3.4 |
| Engine source | 8 | `check-packs`, `pack-manifest`, `pack-resolver`, `check-gate-authority`, `validate`, `build-inventory`, `check-stale-index`, `maintainer/inventory` |
| Engine tests | 6 | fixtures whose subject was the command surface |
| Scripts, config, CI | 10 | cross-refs checker, ownership seeder, oracle, `ci.yml`, two shell tests, brand allowlist, pack manifest, harness inventory, `deletions.json` |
| Always-on rules | 2 | `security-rules.md` (the `/mk:audit` token), `gate-rules.md` (the reviewer path list) |
| Generated / index artifacts | 6 | substrate view, docs manifest + 4 spliced pages, `SKILLS_INDEX.md`, `README.md`, `docs/core/meowkit-architecture.md` counts |
| New files | 9 | 4 `SKILL.md`, 1 skill reference, 4 docs reference pages |
| Deleted through the index | 34 | 27 `commands/mk/*.md`, 7 `modes/*.md` |

Deliberately **not** re-pathed, with the reason:

- `packages/mewkit/src/migrate/__tests__/md-strip-mewkit.test.ts`,
  `portability-policy.test.ts`, `core/__tests__/check-generic-core-tokens.test.ts` — `mk:plan`
  there is an arbitrary prose token fed to a stripper or a classifier, not a reference to a kit
  surface; one of them asserts the token is *removed*. Rewriting them would change what the test
  feeds, not what it proves.
- `packages/mewkit/src/migrate/**` provider surfaces (`providers/claude-code/config.ts`,
  the command fixtures, `packages/mewkit/README.md:54`) — these describe a **project's own**
  `.claude/commands/`, which still exists as host-runtime content and is exactly what the
  migration layer maps onto a target provider. The kit shipping none does not remove the surface
  from the world.
- `.claude/skills/context-audit/scripts/inventory-context.sh` — the `commands` bucket measures the
  audited project's own command files. In a kit-only install it reports `[]`; removing it would
  make the audit silently blind to real overhead a user created.
- `release-manifest.json` — generated at release time, as in slices 1 and 2.
- `packages/mewkit/src/migrate/modules/{codex,cursor}/root/**` — the authored provider bundles.
  Slices 1 and 2 left them to the docs/projection slice; this slice adds one more drift (the
  codex `mk-help` alias line still names `.codex/commands/mk/plan.md`). The two
  `security-anchor-template.md` and two `context-engineering/SKILL.md` bundle copies **were**
  updated, because they mirror kit files token-for-token and a stale `mk:audit` / `mk:budget`
  there would be a reference to nothing.
- `README.md:9` (`7 modes`, `5 conditional rules`) and `README.md:107`, `RELEASING.md:173` and
  `:293` — AC-01 owns `README.md` and `RELEASING.md`, scheduled for slice 6. This slice touched
  `README.md` only through the count emitter (skills 125 → 129, see S3.6), and did **not** spend
  slice 6's edits. **`README.md` still advertises 7 modes and a `commands/` tree that no longer
  exist** — the single loudest leftover for the next slices.

## S3.4 Prose the rewrite made wrong, and what it says now

A literal token substitution leaves sentences that are now false. Each was rewritten rather than
left mechanically correct:

- `skills/help/SKILL.md` — "Alias: `/mk:plan` routes to `mk:plan-creator` (slash-command wrapper at
  `.claude/commands/mk/plan.md`)" described the exact dispatcher being removed. It now says
  `mk:plan-creator` *is* the planning entrypoint and its three subcommands are handled by that same
  skill, with no dispatcher to route through.
- `skills/cook/references/orchestration-rules.md` — "that command launches parallel agents" →
  "that one sets up parallel agents"; the `mk:delegate` paragraph no longer calls it a command.
- `skills/skill-creator/references/skill-authoring-rules.md` "Commands vs Skills" — the section
  that *defined* the three command patterns and the "a command is not a phantom skill" carve-out.
  It now states that the kit ships one surface, that every `mk:*` token resolves against the skill
  inventory or fails, why one surface (two descriptions of one behavior drift), that a project may
  still author its own commands, and the three shapes re-expressed as skills. The heading is
  unchanged because `CLAUDE.md:131` points at it by name.
- `skills/skill-template-secure/references/security-anchor-template.md` — the Rule-of-Two example
  row "`mk:audit` — reads code, no secrets, no writes" became **`mk:scout`**, not `mk:cso`: `mk:cso`
  writes audit reports, so renaming the token would have made the row's own classification false.
- `confluence-setup`'s four callers (`agents/confluence-page.md`,
  `skills/confluence/references/safety-framework.md`, `skills/intake/SKILL.md`,
  `skills/intake/references/confluence-handoff-protocol.md`) now point at the guided setup inside
  `mk:confluence` rather than at a bare hub reference, so the instruction still names a procedure.
- `assets/README.md` — the casing list had "Commands: `/mk:cook` …" and "Skills: …" as two
  categories of one thing; they are now "Skill invocations" and "Skill names in prose".

## S3.5 The engine readers, removed with their subject

- **`check-packs.ts` `SAFETY_PATHS` — renamed, not dropped.** `commands/mk/plan.md` →
  `skills/plan-creator/SKILL.md`, `commands/mk/validate.md` → `skills/lint-and-validate/SKILL.md`,
  `commands/mk/upgrade.md` → `skills/help/references/cli.md` (the generated CLI reference is the
  kit-side surface that names the `mewkit upgrade` verb; the verb itself lives in the engine and has
  no kit path). Length is **25 before and 25 after** (15 literals + 7 always-on rules + 3
  entrypoints), measured against `git show de278a5f`.
- **`base.commands` removed**, from the manifest, the `PackBase` interface, the shape validator and
  `baseSeed`. Its guarantee did not evaporate: `base.globs` gains `skills/help/**`,
  `skills/lint-and-validate/**` and `skills/plan-creator/**`, so every profile still carries the
  three entrypoints the safety list names — whole skills, not a lone `SKILL.md` without its
  references. `validate --packs` reports no missing safety file.
- **`pairedCommands`, `GOVERNED_DISPATCHERS`, `COMMAND_DRIFT_PATTERNS`, `scanCommandForDrift`,
  `checkCommandDrift` and `CommandDriftFinding` deleted** (162 lines) together with their two
  `describe` blocks (10 tests) and both call sites in `validate.ts`. With no command there is no
  command/skill pair to drift, and the check would otherwise have reported *pass* over an empty
  inventory. `validate` now reports **39 passed** where slices 1–2 reported 40 — the missing PASS is
  exactly this check, and `npm test` is **3368** where it was 3378, exactly the 10 removed tests.
  Nothing was skipped or relaxed to get there.
- **`check-skill-cross-refs.sh` lost its command inventory**: the `COMMANDS` variable, the
  `grep -qx` fallback, `.claude/commands` from the `find` roots, and the `command` allowlist entry
  (a placeholder in a deleted file). A `mk:*` token now resolves against skills or fails.
- **`build-inventory.ts` no longer enumerates `commands/mk/`**, and the ownership seeder lost its
  `commands/` enumeration and its `REGISTRY_PREFIXES` entry, so the seeder cannot put the entries
  back. `check-stale-index.ts` lost the `commands` bucket and the `README.md` commands CountSpec —
  a count token that cannot be found is a hard failure in that check, so the spec had to go with
  the artifact type rather than be left pointing at a number nothing produces.
- **`.meowkit/harness-inventory.json`: 27 `commands/mk/*` ownership entries removed** (61 → 34
  artifacts). The contract says 24; the tree had 27 at this point. `validate --ownership` is green.
- **`.meowkit/pack-manifest.json`: two bare `autobuild` ids removed** from `lifecycle-core`'s
  `artifactsExclude` and `product`'s `artifactsAdd`. They were the *command* id (the skill is
  `mk:autobuild`, listed beside them), so with the command gone the resolver threw
  `pack "lifecycle-core" references unknown artifact id "autobuild"` on every profile resolution —
  a real break the test suite caught before any check did.
- **`context-budget.ts`'s `commands/mk/**` tier line is kept**, and so is the migrate layer's
  `command` artifact type: both classify content a *pre-move or user-authored* project still has.
  Same reasoning that kept `"scripts"` in slice 1 and the `conditional` tier in slice 2.
- **`deletions.json` grew by 34** (27 commands + 7 modes), so an upgrade removes them from an
  existing install instead of leaving them to the orphan sweep.

**Teeth, observed rather than asserted.** With the command inventory gone, the cross-ref checker
immediately reported five real phantoms inside `.claude/skills/` that had been resolving against
the command directory — `mk:audit`, `mk:budget`, `mk:confluence-setup`, `mk:plan`, `mk:spawn`.
Those are the references this slice rewrote. On a full scratch copy of the finished `.claude/` with
one planted bad token:

```
echo 'See `mk:no-such-surface` for details.' >> .claude/skills/arch/SKILL.md
→ PHANTOM: mk:no-such-surface (no skill dir)
  exit 1
```

## S3.6 The four promotions and the surfaces that had to learn about them

- `.claude/skills/{arch,breakdown,delegate,status}/SKILL.md`, each with full governance frontmatter.
  `mk:breakdown` also declares `requires_external_service: ["jira", "confluence"]` and
  `default_enabled: true` — the tool-contract WARN fires without the first, and `true` is correct
  because the paste/file path through `mk:intake` needs no service.
- Two keywords were renamed on the first validate run because they collided with existing intents:
  `architecture-decision` → `adr-lifecycle` (clashed with `mk:party`) and `handoff` →
  `subagent-handoff` (clashed with `mk:ghpm`, `mk:pack`). `validate` is back to the slice-2
  warning count of 34.
- `.claude/agents/SKILLS_INDEX.md`: four rows added (`mk:breakdown` under Phase 1, `mk:status` under
  Phase 6, `mk:arch` and `mk:delegate` under Cross-Cutting), the three block headers bumped, the
  three category counts bumped, `**Total**` 125 → **129**. `missingRows` requires every skill id to
  appear in this index, so this is a check, not bookkeeping.
- `node scripts/harness-inventory.cjs --emit-counts` rewrote the skills count in `README.md` (two
  occurrences) and `docs/core/meowkit-architecture.md`. Both were hard FAILs of
  `checkStaleIndex` until it ran.
- `packages/docs/content/docs/reference/skills/{arch,breakdown,delegate,status}.mdx` created and
  spliced, and the three new ids added to that directory's `meta.json`.
  `node scripts/docs-manifest.cjs --check` requires a reference page per skill, so these four pages
  are a gate requirement of this slice even though AC-09 owns the docs universe.

## S3.7 The rule-survival needle, and its fail-on-delete probe

The Enforcement clause is now pinned. The needle is the **disposition**, not the entrypoint names
beside it:

```js
needle: "flag as **WARN**, document it in the verdict, do not auto-fix"
```

That choice is deliberate and documented in the oracle: the `/mk:review` / `/mk:cso` tokens are
routing surfaces and get renamed — this slice renamed one of them — and the sentence that stops a
reviewer from auto-fixing shipped code must not disappear with a rename. The oracle goes from 60 to
**61** pinned items.

```
node scripts/check-rule-survival.cjs .
→ rule-survival: 61 pinned item(s) checked against 7 always-on file(s)
  OK: every pinned safety item survives.

# scratch copy with the Enforcement clause's line deleted
→ FAIL: 1 pinned item(s) missing from the always-on set:
    MISSING: security-rules Enforcement clause (existing code: WARN, documented, never auto-fixed)
  exit 1
```

The clause's meaning is intact: `**Reviewing existing code** (`/mk:review`, `/mk:cso`): flag as
**WARN**, document it in the verdict, do not auto-fix — existing code may carry context the agent
lacks.` Only the second entrypoint token changed.

## S3.8 Modes

`.claude/modes/` is gone (7 files, `git rm`), and **no `.claude/output-styles/` was created** —
`ls` on both returns ENOENT. The zero-reader finding is the committed one in §3.2 above and is
unchanged by this slice; nothing was re-measured to justify the deletion after the fact.

The eight naming places, each against its owner:

| Place | Owner | State now |
|---|---|---|
| `rules/gate-rules.md:69` reviewer path list | this criterion | `.claude/modes/` removed from the clause |
| `check-gate-authority` test fixture | this criterion | re-pathed, see below |
| `.meowkit/pack-manifest.json` `base.globs` | AC-01 | `modes/**` removed in this slice (it is the declaration that would have re-shipped the directory) |
| `README.md:9`, `README.md:107`, `RELEASING.md:173` | AC-01 | **untouched — slice 6** |
| `docs/maintainer/docs-reference-contract.md:8`, `docs/operations/docs-references-inventory.md:79` | AC-09 | untouched — slice 6 |

**The reviewer path list, before and after.** Slice 2 had already rewritten it to brace form, so the
comparison is taken against that state, not against BASE. Before:
`.claude/rules/`, `.claude/modes/`, `.claude/agents/`, `.claude/skills/{advise,agent-detector,autobuild,cook,fix}/`.
After: the same set **minus `.claude/modes/`** and nothing else. The modes content moved nowhere —
it was deleted on a zero-reader finding — so there is no destination directory to add in its place,
which is the one case where a shrinking list is not a loss of reach. `checkGateAuthority` scans the
whole `.claude` tree (`check-gate-authority.ts`), so the standing item's mechanical half is
unaffected either way, proven here rather than asserted:

```
# full scratch copy of the finished .claude/ with one planted sentence
echo 'Fast mode auto-approves Gate 2 if tests pass.' >> .claude/skills/arch/SKILL.md
→ fail :: Automated gate-approval claims (1) :: .claude/skills/arch/SKILL.md:106
```

**The fixture.** `check-gate-authority.test.ts` wrote its synthetic prose files into
`.claude/modes/` and `.claude/rules-conditional/` — arbitrary relative paths chosen to prove the
scanner fires anywhere, which slice 2 deliberately left to this criterion. They are now
`.claude/skills/x/references/*.md` (and `plugin/modes/default.md` → `plugin/rules/default.md` for
the projection-parity case), so no fixture names a directory the kit cannot have.

**The always-on budget paid for both rule edits.** The path-list clause got 15 bytes shorter and the
`/mk:audit` → `/mk:cso` token 1 byte shorter:

```
node scripts/check-always-on-budget.cjs .
→ measured total: 25416 bytes (limit 25600)
  OK: 184 bytes of headroom.
```

**25 416 ≤ 25 501** — 85 B below the pin, 20 B below where slice 2 left it, and the 99-byte BASE
headroom is now 184.

## S3.9 Ship-set effect, measured

```
scripts/kit-ship-set.cjs over the tracked tree
→ 1193 files   (slice 2: 1222; −34 commands/modes, +5 new skill files)
  roots: .claude .meowkit release-manifest.json tasks
  .claude/ top level = 10 :: agent-memory agents benchmarks harness-substrate.md hooks
                             rules schemas settings.json skills statusline.cjs
  shipped under .claude/commands: 0
  shipped under .claude/modes:    0
```

Shipped `.claude/` top level: **17 at BASE → 16 → 12 → 10 now.** Four departures remain
(`agent-memory`, `benchmarks`, `harness-substrate.md`, `schemas`), which would leave the six the
target tree keeps.

Three shipped files still contain the string `commands/mk` or `.claude/commands`, all three
intentionally: `inventory-context.sh` and `skill-authoring-rules.md` (S3.3) and the generated
`release-manifest.json`. No shipped file names `.claude/modes`.

## S3.10 The move registry was not extended, and why

`scripts/dangling-rule-refs-data.cjs` is a registry of **rules that moved out of
`.claude/rules/`**: rule (a) of `check-dangling-rule-refs.cjs` matches the hardcoded prefix
`rules/<name>.md`, and rule (b) turns a bare `<name>.md` into a violation. Neither commands nor
modes ever lived in `.claude/rules/`, so an entry for `design` would make rule (a) search for
`rules/design.md` — a path that never existed — while rule (b) would flag any prose that mentions a
`design.md` anywhere in the kit. The two folds have real destinations and the four promotions have
real skill directories, but none can be expressed in that registry without changing the check's
shape, which D9 forbids. `deletions.json` is the artifact that records the 34 retirements, and it
was extended. This is the same class of limitation slice 2 flagged for `rubrics/` and
`workflow.yaml`, and it is flagged here for the evaluator rather than worked around.

## S3.11 Gate results for this slice

| Gate | Result |
|---|---|
| `npm run build` | PASS |
| `npm run lint` | PASS — 0 errors, 3 warnings (all pre-existing: `countFiles`, `buildCapabilities`, `path`) |
| `npm run typecheck` | PASS — no output |
| `npm test` | PASS — **297 files / 3368 tests, 0 failures**. 3378 → 3368 is exactly the 10 command-drift tests removed with their subject; no test skipped, no assertion relaxed |
| `mewkit validate` (all) | **39 passed, 34 warnings, 1 n/a, 0 failed** (40 → 39 = the removed command-drift check) |
| `mewkit validate --packs` | PASS — 1 passed, base safety invariant reports no missing file |
| `mewkit validate --gates` | PASS — 1 passed (was 2; the second was the removed check) |
| `mewkit validate --workflow` | PASS — 6 passed |
| `mewkit validate --frontmatter` | PASS — 1 passed, 0 warnings |
| `mewkit validate --docs-refs` | PASS — 1 passed |
| `mewkit validate --ownership` | PASS — 1 passed |
| `mewkit validate --memory / --agents / --substrate` | PASS |
| `bash scripts/check-skill-cross-refs.sh` | **FAIL, identical to BASE** — the one pre-existing finding, below |
| `node scripts/check-rule-survival.cjs .` | PASS — 61 pinned items; fail-on-delete probe exits 1 (S3.7) |
| `node scripts/check-always-on-budget.cjs .` | PASS — **25 416 B** (S3.8) |
| `node scripts/check-dangling-rule-refs.cjs .` | PASS — 8639 files, 22 destinations loaded |
| `node scripts/check-kit-verbs.cjs` | PASS — 292 references (281 → 292: the `mewkit budget` / `mewkit upgrade` rewrites), 24 commands |
| `node scripts/check-node-only-runtime.cjs` | PASS — 81 shipped files in the node-only trees, 74 skill-owned scripts retained |
| `node scripts/check-env-reads.cjs` | PASS — 138 reads |
| `node scripts/check-no-python.cjs --allow-existing-envs` | PASS — all 26 checks, no interpreter on PATH |
| `node scripts/check-memory-wiki-residue.cjs` | PASS — 0 hits |
| `node scripts/generate-cli-manual.cjs --check` | PASS |
| `node scripts/docs-manifest.cjs --check` | PASS after `--write` (171 artifacts) |
| `node scripts/harness-inventory.cjs --check` | PASS after `--emit-counts` and `--substrate --emit` |
| `node scripts/link-checker.cjs` | PASS — all links valid |
| `bash scripts/check-hook-registration.sh` | PASS — 6 hooks |
| `bash scripts/validate-rule-availability.sh` | PASS — 7 rule references resolve |
| `bash tests/surface-contract.test.sh` | PASS — 5/5 |
| `bash tests/spec-drift.test.sh` | PASS — 3/3 |
| `bash tests/help-skill-contract.test.sh` | PASS — 10/10 (was 11; the `/mk:help` wrapper assertion went with its subject) |
| `bash tests/changed-files-lint.test.sh` | PASS — 9/9 |
| golden replay + port replay | PASS — 144/144, fixtures unedited |
| `node --test .claude/hooks/__tests__/*.test.cjs` | PASS — 36/36 |
| `tests/journey-validation/check-journey-specs.py` | PASS — 12 journeys frozen, unchanged |
| `mewkit doctor --hard-gates` | PASS — 26 passed, 5 warnings, 0 failed (retired `MEOWKIT_*` unset) |
| `mewkit validate --target codex / --target cursor` | n/a — no generated layout in this tree, as at BASE |
| control-character scan over 301 changed/new files | 0 hits |

`check-skill-cross-refs.sh` exits 1 with exactly the finding it exits 1 with at BASE:
`BROKEN_LOCAL_REF: .claude/skills/context-audit/SKILL.md -> scripts/harness-inventory.cjs`. The five
`PHANTOM` findings the removal of the command inventory exposed were real and are fixed, so the
checker is no worse than on arrival and now has one inventory instead of two.

## S3.12 What the next slices need to know

1. **`README.md` is the biggest outstanding lie in the tree.** It still says `7 modes` and
   `5 conditional rules` on line 9 and lists `commands/ 27 slash commands` and `modes/ 7 behavioral
   modes` in the tree on 106–107, for three directories that no longer exist. AC-01 owns it; this
   slice touched only its skill counts (now 129) through the count emitter. `RELEASING.md:173` and
   `:293` likewise.
2. **Three base declarations remain**, not four: `schemas/**` and `agent-memory/**` in `base.globs`
   (`modes/**` and the `base.commands` key are gone). `base.globs` **gained** three entries —
   `skills/help/**`, `skills/lint-and-validate/**`, `skills/plan-creator/**` — which are the
   replacement for `base.commands`' guarantee and must not be read as a departing entry returning.
3. **`SAFETY_PATHS` now names `skills/help/references/cli.md`.** That file is generated by
   `scripts/generate-cli-manual.cjs`. A slice that moves or renames it moves a base safety path, and
   `validate --packs` will say so.
4. **The shipped `.claude/` top level is 10.** The four departures left are `agent-memory`,
   `benchmarks`, `harness-substrate.md` and `schemas` — all slice 4's, all by exclusion.
   `.claude/harness-substrate.md` was regenerated again here (the registry lost 27 entries); slice 4
   must exclude it from the ship set without regenerating it from a stale inventory.
5. **`skills/status/SKILL.md` names `tasks/templates/pm-status-template.md` twice**, so the
   descaffold slice has **9** kit files naming `tasks/templates`, not 8. The reference is real — the
   agent loads that template — so it must be re-pathed, not dropped.
6. **`check-stale-index.ts` has no `commands` CountSpec any more.** A doc that reintroduces an
   "N commands" sentence will not be checked, and will not be caught when it goes stale.
7. **The provider bundles drift further.** Added this slice: the codex `mk-help` alias line still
   names `.codex/commands/mk/plan.md`, and `providers/claude-code/config.ts` still declares a
   `commands` surface (correctly — it describes a *project's* commands, not the kit's). The
   docs/projection slice inherits the first and should leave the second.
8. **`check-skill-cross-refs.sh` now has exactly one inventory.** Any slice that moves prose into
   `.claude/skills/` subjects it to that checker for the first time; expect latent phantoms, as
   slice 2 predicted and this slice confirmed five times over.
9. **The always-on budget stands at 25 416 B** — 85 B below the 25 501 B pin and 184 B below the CI
   literal. No always-on rule edit is left in the sprint's plan, so later slices should only need
   this number to not regress.

## S3.13 File-size accounting

No new file exceeds 200 lines (largest: `skills/delegate/SKILL.md` at 128). No file crossed 200
because of this slice. Files already over 200 at BASE that grew here, with BASE and final counts:

| File | BASE | Now | Why |
|---|---|---|---|
| `.claude/agents/SKILLS_INDEX.md` | 257 | 261 | four promoted skills, one row each |
| `.claude/skills/skill-creator/references/skill-authoring-rules.md` | 216 | 234 | the "Commands vs Skills" rewrite (S3.4) |
| `.claude/skills/improve-codebase-architecture/SKILL.md` | 220 | 228 | the pointer to the folded design consultation |
| `packages/docs/content/docs/reference/skills/index.mdx` | 331 | 335 | generated splice, four new skill rows |

`.meowkit/harness-inventory.json` shrank 467 → 243 lines (27 command entries removed).

---

# Slice 4 — maintainer content

The fourth of the six slices. It lands AC-05 in full except the `docs/` and `packages/docs/content/`
occurrences of `/mk:benchmark`, which AC-09 owns and slice 6 carries — the same split slice 3 applied to
AC-02's docs share. Still no commit, so slices 1–4 are one uncommitted working tree on top of `d17cc03b`.

Environment: `PATH=/opt/homebrew/opt/node@24/bin:$PATH`, cwd = repository root, Node 24.22.2.

## S4.1 What left the shipped kit, and by what mechanism

Every departure is by `base.exclude`, so the file stays in the repository and in-repo tooling keeps
reading it at its current path. One file moves, because its reader cannot find it any other way.

| Content | Shipped files at slice 3 | Mechanism |
|---|---|---|
| `.claude/agent-memory/**` (this repository's evaluator memory) | 4 | `base.exclude: .claude/agent-memory/*` |
| `.claude/benchmarks/**` (canary corpus + README) | 7 | `base.exclude: .claude/benchmarks/*` (replaces the narrower `…/results/*`) |
| `.claude/skills/benchmark/**` | 9 | `base.exclude: .claude/skills/benchmark/*` |
| `.claude/harness-substrate.md` | 1 | `base.exclude: .claude/harness-substrate.md` |
| `.claude/schemas/**` | 2 | `base.exclude: .claude/schemas/*`; `skill-schema.json` moved out first (S4.2) |
| `.claude/hooks/.logs/**` (hook log) | 2 | `base.exclude: .claude/hooks/.logs/*` |
| `**/.pytest_cache/**` | 5 | `base.exclude: */.pytest_cache/*` |

`.claude/eval/*`, `.claude/skills/*/eval/*` and `.claude/.brand-allowlist.txt` were already excluded at
BASE and are unchanged.

`base.globs` lost `schemas/**` and `agent-memory/**`. With those two gone, **all eleven departing entries
now carry zero base declarations** — asserted by reading the manifest rather than by grep:

```
base.commands key: false
base.globs: hooks/** memory/** skills/help/** skills/lint-and-validate/** skills/plan-creator/**
agent-memory / benchmarks / capability-bootstrap.md / commands / harness-substrate.md / modes /
rubrics / rules-conditional / schemas / scripts / workflow.yaml  →  no base.files, no base.globs entry
```

The three `skills/*/**` globs are slice 3's replacement for the retired `base.commands` guarantee, not a
departing entry returning.

## S4.2 `skill-schema.json` moved into the CLI, and the install-time fatal is gone

`git mv .claude/schemas/skill-schema.json packages/mewkit/schemas/skill-schema.json`, beside the
`config-v1.json` schema the package already carried. `packages/mewkit/package.json` `files` gained
`"schemas"`, so the npm artifact publishes it.

`core/check-skill-frontmatter.ts` now resolves it once, at module scope:

```ts
const SCHEMA_PATH = fileURLToPath(new URL("../../schemas/skill-schema.json", import.meta.url));
```

`../../schemas/` reaches the package root from **both** `src/core/` and the compiled `dist/core/`, so
vitest and a published install read the same file through the same path and no build step copies anything.
The `root` parameter no longer contributes a schema path at all, which is what removes the fatal: at BASE
the function read `<root>/.claude/schemas/skill-schema.json` and returned `fatal: "No schema at …"` when it
was absent, so excluding the schema without this move would have made `validate --frontmatter` fatal in
every installed project. The remaining `fatal` names the CLI install, a condition a project cannot create.

`src/core/__tests__/helpers/skill-tree-fixture.ts` no longer plants a schema copy in its fixture — the
validator reads the real one, so the tests now run against the schema that ships.

Exactly one copy exists: `git ls-files | grep skill-schema.json` → `packages/mewkit/schemas/skill-schema.json`.

`harness-metadata-schema.json` did **not** move. It stays at `.claude/schemas/harness-metadata-schema.json`
for `core/build-inventory.ts`, and leaves the artifact with the directory. See S4.6 for the consequence that
decision has for one user-facing flag.

## S4.3 Ship-set effect, measured

```
scripts/kit-ship-set.cjs over the tree
→ 1163 files   (slice 3: 1193; −30)
  roots: .claude .meowkit release-manifest.json tasks
  .claude/ top level = 6 :: agents hooks rules settings.json skills statusline.cjs
```

The 30 removed are exactly the seven rows of S4.1 summed (4+7+9+1+2+2+5 = 30). **Nothing else left**:
the shipped `.claude/` top level is now exactly the six the target tree keeps, two under AC-01's ceiling of
eight, and no other root or prefix changed count.

Shipped `.claude/` top level across the sprint: **17 at BASE → 16 → 12 → 10 → 6.**

## S4.4 Fresh `$TMPDIR` install, and `validate --frontmatter` inside it

The project under test is the **computed ship set materialised** into a throwaway `$TMPDIR` directory —
1163 files, copied by `shipSetFiles(root, excludeMatcher(shipSetExclusions(root)))`, which is the archive's
own definition of its contents. `init` was deliberately not used: it would install a *published* release
rather than this tree, so it cannot test this tree's exclusions, and it reaches the network.

```
$TMPDIR project root           :: .claude  .meowkit  release-manifest.json  tasks
$TMPDIR .claude/ top level     :: agents hooks rules settings.json skills statusline.cjs
ls .claude/schemas             :: No such file or directory

node <abs>/packages/mewkit/dist/index.js validate --frontmatter
→ Structure
    [PASS] Skill frontmatter
  1 passed            exit=0, no fatal

node <abs>/packages/mewkit/dist/index.js validate --packs
→ Packs
    [PASS] Pack coherence
  1 passed            exit=0 — base safety invariant reports no missing file

node <abs>/packages/mewkit/dist/index.js validate      (all)
→ 21 passed, 1 warnings
```

**Disclosure:** `node packages/mewkit/dist/index.js init --help` was run once from the repository root
before this approach was settled on. Sprint 7 D11 forbids running `init` in or against this repository
"not even with `--help`", so that single invocation is a contract violation. It is read-only — the help
renderer prints the flag table and exits — and `git status` shows no `.claude/` or `.meowkit/` change
attributable to it, but it is recorded here rather than left for the evaluator to find.

## S4.5 Every in-repo reader still works from this repository

| Reader | Result |
|---|---|
| `core/substrate.ts` via `validate --substrate` | PASS — 2 passed, 1 warning |
| `scripts/harness-inventory.cjs --check` | PASS — "Docs match the inventory" |
| `scripts/harness-inventory.cjs --substrate` | PASS — full coverage table, `Untagged: 0 registry + 171 frontmatter` |
| `scripts/docs-manifest.cjs --check` | PASS after `--write` (171 artifacts; the regen is the hash of the kit prose this slice edited) |
| `core/build-inventory.ts` via `validate --ownership` in-repo | PASS — 1 passed |
| `check-skill-frontmatter.ts` in-repo | PASS — `validate --frontmatter`, 1 passed, 0 warnings |

`.claude/harness-substrate.md` was **not** regenerated in this slice (slice 3 note 4): its diff against
`HEAD` is still slice 3's 11/11, and the substrate reader was run read-only, without `--emit`.

## S4.6 One decided consequence, surfaced rather than worked around

With `harness-metadata-schema.json` out of the artifact, the **scoped** `mewkit validate --ownership`
fails in an installed project:

```
(in the $TMPDIR install)
  [FAIL] Governance metadata installed
         Missing/unreadable .claude/schemas/harness-metadata-schema.json
  0 passed, 1 failed
```

A default `validate` run degrades the same condition to a WARN whose text reads "Ownership metadata not
installed … run `mewkit upgrade`" — advice a user can no longer act on, because no upgrade will ever deliver
the file again. The contract decided the exclusion on the basis that `build-inventory.ts` is maintainer-side,
which is true of the *module* but not of the `--ownership` flag it backs.

Nothing was changed about it here. Altering a governance check's severity or its message is not inside this
criterion, and lowering it would weaken a check CI runs against this repository, where the schema does
exist and the FAIL is correct. It is flagged for the evaluator as a decision for the repo-green slice or an
amendment: either `--ownership` reports "maintainer-only check" in an install, or the governance schema
follows `skill-schema.json` into the CLI package.

## S4.7 The retention list split rather than shrank

`scripts/check-node-only-runtime.cjs`'s third claim held a frozen 74-path list asserted one way: each path
must still **ship**. Three of them belong to `skills/benchmark/`, which this slice withholds, so the claim
as written would have demanded that a withheld skill ship.

`scripts/lib/node-only-runtime-data.cjs` now carries two lists and the check asserts each where its claim
belongs: `RETAINED_SKILL_SCRIPTS` (**71**) must still ship from their own paths, and
`RETAINED_UNSHIPPED_SKILL_SCRIPTS` (**3**) must still **exist in the repository** and must **not** ship.
71 + 3 = 74, so no path was dropped and no file moved — the lazy-Python decision is untouched, and a later
change that deletes a benchmark script still fails the check.

```
node scripts/check-node-only-runtime.cjs
→ ok    no shipped file under .claude/scripts/
  ok    79 shipped file(s) in the node-only trees, none interpreter-dependent
  ok    71 skill-owned interpreter script(s) still ship from their own paths
  ok    3 skill-owned interpreter script(s) kept in the repository, withheld from the kit
```

The node-only scan fell 81 → 79 because `.claude/hooks/.logs/` departed; both files were shebang-free, so
the property itself is unchanged.

## S4.8 Unshipped surfaces are marked, not left dangling

`dead-weight-audit-rules` in `scripts/dangling-rule-refs-data.cjs` now carries `shipped: false`, and the
flag's doc comment states the two cases it covers: a destination outside `.claude/`, or one inside a skill
the kit withholds. `check-dangling-rule-refs.cjs` is unchanged in shape (D9) and still reports all 22
destinations loaded.

Six shipped kit files presented `/mk:benchmark` or a `skills/benchmark/` path as available. Each now says
where it runs:

| File | Change |
|---|---|
| `.claude/agents/SKILLS_INDEX.md:145` | row gains "Maintainer-only: runs from the MeowKit repository and is not part of an installed kit" |
| `.claude/skills/autobuild/references/adaptive-density-matrix.md:64` | "`mk:benchmark`, available only in the MeowKit repository" |
| `.claude/skills/autobuild/references/adaptive-density-matrix.md:83,86` | both See-Also rows marked "MeowKit repository only" |
| `.claude/skills/rubric/references/calibration-guide.md:113` | "an installed project runs the replay by hand" |
| `.claude/skills/rubric/rubrics/calibration-set/README.md:63` | "in the MeowKit repository only" |
| `.claude/skills/trace-analyze/references/trace-schema.md:31` | producer marked "MeowKit repository only" |
| `.claude/skills/benchmark/SKILL.md` | a four-line note under the title stating the skill and its corpus ship nowhere |

`.claude/skills/skill-creator/references/skill-authoring-rules.md`'s Validation line no longer names
`.claude/schemas/skill-schema.json`; it names the schema the CLI carries and says why it travels with the
validator.

Not touched, and deliberately: `.claude/agents/project-manager.md:83` names
`.claude/agent-memory/project-manager/MEMORY.md` as a path that does **not** exist by design — the exclusion
makes that sentence more true, not stale. `.claude/skills/tech-graph/` uses "agent-memory" as a diagram
type, not a path. The **docs** occurrences of `/mk:benchmark` (`docs/` ×3, `packages/docs/content/` ×8 plus
the generated reference page) are AC-09's and are slice 6's.

## S4.9 The three new ship-set assertions, and the split the growth forced

`ship-set-exclusions.test.ts` was 152 lines at BASE. The seven departure patterns plus three new tests took
it to **214**, crossing the 200-line limit, so the file was split by claim rather than trimmed:

| File | Lines | Claim |
|---|---|---|
| `src/kit/__tests__/ship-set-exclusions.test.ts` | 109 | what the artifact WITHHOLDS (5 tests) |
| `src/kit/__tests__/ship-set-completeness.test.ts` | 94 | what it must still CARRY, and what stays in the checkout (4 tests) |
| `src/kit/__tests__/helpers/ship-set-view.ts` | 55 | the two views both files read |

The helper exists because the two views disagree on purpose and both files need both: the tracked-paths view
is the only one that can assert a file is still in the checkout, and the matcher view is the only one that
sees content git never tracked. No assertion was dropped in the split — 5 + 4 = the 9 the single file ended
with, and the suite went 297 → 298 files at the same 3371 tests.

The three new tests are:

1. **"ships the frontmatter schema from the CLI, not from the project"** — `.claude/schemas/skill-schema.json`
   is not shipped and exactly one tracked file is named `skill-schema.json`.
2. **"withholds the local state the archive walk reaches but git does not track"** — `agent-memory/**`, the
   hook log and the pytest cache are **untracked**, so the file's tracked-paths view cannot see them at all;
   they are asserted against `excludeMatcher` directly, the only view that does. This is also why
   `agent-memory/`'s departure is asserted on the matcher rather than on a tracked-file list: the archive
   walks the filesystem, which is exactly how three untracked classes were reaching every install.
3. **"ships no skill without its own data"** — for every shipped `SKILL.md`, no tracked file under that
   skill's `references/`, `scripts/`, `assets/`, `data/`, `templates/` or `rubrics/` may be excluded
   (`eval/`, `tests/`, `__tests__/` and `*.test.*` are a skill's verification, not its input). It is empty,
   and it fails if a future exclusion splits a skill from its data — the failure no structural check caught,
   because both halves look deliberate on their own. Its converse asserts `benchmark` is not a shipped skill,
   so the corpus and its reader left together.

The two BASE assertions that benchmarks ship (`…/benchmarks/canary/`, `…/benchmarks/README.md`) were removed
with their subject; the "removes nothing from the repository" test — now in the completeness file — gained
five paths in their place, so every newly excluded tracked file is still proven present in the checkout.

## S4.10 Gate results for this slice

| Gate | Result |
|---|---|
| `npm run build` | PASS |
| `npm run lint` | PASS — 0 errors, 3 warnings (all pre-existing: `countFiles`, `buildCapabilities`, `path`) |
| `npm run typecheck` | PASS — no output |
| `npm test` | PASS — **298 files / 3371 tests, 0 failures**. 3368 → 3371 is exactly the three new ship-set tests; the extra file is the split half (S4.9). Nothing skipped, no assertion relaxed |
| built-CLI `validate` (all, in-repo) | PASS — 39 passed, 34 warnings, 1 n/a, 0 failed |
| built-CLI `validate --packs / --frontmatter / --ownership / --gates` | all PASS (1 passed each) |
| `$TMPDIR` install + `validate --frontmatter` | PASS — exit 0, no fatal, with no `.claude/schemas/` present (S4.4) |
| `$TMPDIR` install + `validate --packs` | PASS |
| `node scripts/kit-ship-set.cjs` listing | 1163 files, 6 `.claude/` entries, departures absent, nothing else lost (S4.3) |
| `bash scripts/check-skill-cross-refs.sh` | **FAIL, identical to BASE** — the one pre-existing finding, below |
| `node scripts/check-always-on-budget.cjs .` | PASS — **25 416 B**, 184 B of headroom; unchanged by this slice, 85 B below the 25 501 B pin |
| `node scripts/check-rule-survival.cjs .` | PASS — 61 pinned items survive |
| `node scripts/check-dangling-rule-refs.cjs .` | PASS — all 22 destinations loaded |
| `node scripts/check-kit-verbs.cjs` | PASS — 291 references resolve against 24 commands |
| `node scripts/check-node-only-runtime.cjs` | PASS — 79 / 71 / 3 (S4.7) |
| `node scripts/check-env-reads.cjs` | PASS — 138 reads |
| `node scripts/check-no-python.cjs --allow-existing-envs` | PASS — all 26 checks, no interpreter on PATH |
| `node scripts/check-memory-wiki-residue.cjs` | PASS — 0 hits |
| `node scripts/generate-cli-manual.cjs --check` | PASS — manual matches the catalogue, no regen needed |
| `node scripts/docs-manifest.cjs --check` | PASS after `--write` (171 artifacts) |
| `node scripts/harness-inventory.cjs --check` | PASS |
| `node scripts/link-checker.cjs` | PASS — all links valid |
| `bash scripts/check-hook-registration.sh` | PASS — 6 hooks |
| `bash scripts/validate-rule-availability.sh` | PASS — 7 rule references resolve |
| `bash tests/surface-contract.test.sh` | PASS — failed: 0 |
| `bash tests/spec-drift.test.sh` | PASS — failed: 0 |
| `bash tests/help-skill-contract.test.sh` | PASS — failed: 0 |
| `bash tests/changed-files-lint.test.sh` | PASS — failed: 0 |
| golden replay (`tests/hooks/golden-replay.test.ts`) | PASS — 86/86, fixtures unedited |
| golden + port suites (`tests/hooks`, `tests/ports`) | PASS — 18 files / 353 tests |
| `node --test .claude/hooks/__tests__/*.test.cjs` | PASS — 36/36 |
| `tests/journey-validation/check-journey-specs.py` | PASS — 12 journeys frozen, unchanged |
| `mewkit doctor --hard-gates` | PASS — 26 passed, 5 warnings, 0 failed (retired `MEOWKIT_*` unset) |
| `mewkit validate --target codex / --target cursor` | n/a — no generated layout in this tree, as at BASE and as in slice 3 |
| control-character scan over 311 changed/new text files | 1 hit, **pre-existing** — see below |

`check-skill-cross-refs.sh` exits 1 with the finding it exits 1 with at BASE:
`BROKEN_LOCAL_REF: .claude/skills/context-audit/SKILL.md -> scripts/harness-inventory.cjs`. Unchanged by
this slice.

The control-character hit is a U+200B at `check-skill-frontmatter.ts:105`, inside the comment
`Validate every \`*​/SKILL.md\``, where it stops the glob from closing the block comment. It is present at
BASE on the same line (`git show HEAD:…` line 88) and was not introduced here.

`check-kit-verbs.cjs` reports **291** references where slice 3 recorded 292. No `mewkit` reference was
removed by this slice — the only edited line containing one (`skill-authoring-rules.md`'s Validation
sentence) still contains exactly one — so the one-reference drift is not attributable to a removal here. The
check is green either way: every reference resolves.

## S4.11 File-size accounting

Two new files, both well under 200: `ship-set-completeness.test.ts` at **94** and
`helpers/ship-set-view.ts` at **55**.

| File | BASE | Now | Note |
|---|---|---|---|
| `src/kit/__tests__/ship-set-exclusions.test.ts` | 152 | 109 | reached 214 with the new assertions, then split (S4.9) |
| `scripts/check-node-only-runtime.cjs` | — (new in slice 1) | 121 | +11 for the withheld-script claim |
| `scripts/lib/node-only-runtime-data.cjs` | — (new in slice 1) | 122 | +14 for the second list and its comment |
| `.claude/skills/benchmark/SKILL.md` | 223 | 228 | already over 200 at BASE; +5 for the unshipped note |
| `packages/mewkit/src/core/check-skill-frontmatter.ts` | 151 | 169 | +18 for the resolved schema path and its comment; under 200 |

**No file crossed 200 because of this slice.**

## S4.12 What the next slices need to know

1. **The shipped `.claude/` top level is 6** — `agents hooks rules settings.json skills statusline.cjs` —
   and the ship set is 1163 files over the same four roots. AC-01's conjunction slice needs the roots
   reduced to two next (`tasks/` is slice 6's descaffold), not the `.claude/` set.
2. **All eleven base declarations are gone.** `base.globs` is now `hooks/** memory/** skills/help/**
   skills/lint-and-validate/** skills/plan-creator/**` and there is no `base.commands` key. AC-01's
   "absent from `base.files`/`base.globs`/`base.commands`" clause can be asserted by reading those five
   lines.
3. **`base.exclude` gained seven patterns and lost one** (`.claude/benchmarks/results/*`, subsumed). It is
   still the only list of what the kit withholds; no second matcher or ship-set list was added.
4. **`validate --ownership` fails in an installed project** and the default run's WARN tells the user to
   run an upgrade that cannot fix it (S4.6). This needs a decision before the sprint lands — it is the one
   place where AC-05's exclusion left a user-facing message wrong.
5. **`packages/mewkit/schemas/` is now npm-published** (`files` gained `"schemas"`), so `config-v1.json`
   ships with the CLI too. A slice that moves a schema must keep the `../../schemas/` relative depth, which
   is what makes `src/` and `dist/` resolve identically.
6. **The node-only retention list is 71 + 3.** A slice that withholds another skill owning a `.py`/`.sh`
   moves its entries from `RETAINED_SKILL_SCRIPTS` to `RETAINED_UNSHIPPED_SKILL_SCRIPTS`; deleting the
   entry instead silently drops the claim.
7. **`.claude/harness-substrate.md` and `.claude/schemas/harness-metadata-schema.json` are still tracked**
   and still read from the checkout. The descaffold and repo-green slices must not "tidy" either away now
   that nothing ships them.
8. **The ship-set test is where a departure is proved.** It has a tracked-paths view and a matcher view, and
   untracked content (`agent-memory/`, the hook log, pytest caches) is only visible to the second. A future
   exclusion of untracked content must be asserted there.
9. **`init` must not be run from this repository, including `--help`** — slice 4 did it once and disclosed
   it (S4.4). The `$TMPDIR` install technique that actually tests this tree is to materialise
   `shipSetFiles(...)` into a throwaway directory and run the built CLI against it by absolute path.
10. `docs/` and `packages/docs/content/` still present `/mk:benchmark` as available — **3** files under
    `docs/` and **9** under `packages/docs/` (one of them the changelog archive, one the generated
    `reference/skills/benchmark.mdx`, one the generated `docs-reference-manifest.json`). The changelog
    archive also names `.claude/schemas/skill-schema.json`. Changelog pages are immutable; the rest is
    AC-09's.
11. **The ship-set tests now live in three files, not one.** A slice that adds a withholding claim edits
    `ship-set-exclusions.test.ts`; one that adds a carry claim edits `ship-set-completeness.test.ts`; both
    read `helpers/ship-set-view.ts`.

# Slice 5 — runtime state

The fifth of the six slices. It lands AC-08 in full, plus the orchestrator's decision on the one
user-facing message slice 4 left wrong. Still no commit, so slices 1–5 are one uncommitted working
tree on top of `d17cc03b`.

Environment: `PATH=/opt/homebrew/opt/node@24/bin:$PATH`, cwd = repository root, Node 24.22.2.

## S5.1 Every runtime writer now goes through the one resolver

`lib/meowkit-paths.cjs` gained **one** function and **one** constant — no second resolver:

| Addition | What it is |
|---|---|
| `sessionStateFile(rel, root)` | a marker to READ: canonical first, then a pre-move path that exists, else canonical |
| `LEGACY_STATE_RELS` | `['session-state', '.claude/session-state']` — read-only, never a write target |

`state/resolve-state-dir.ts` gained the mirror (`resolveSessionStateFile`, `LEGACY_SESSION_STATE_RELS`),
so the hooks and the CLI answer the question the same way. The shape is the one
`state/resolve-inventory-path.ts` already uses for the inventory: canonical write, pre-move read.

Nineteen hook files named `session-state`; **zero** do now except the two deliberate mentions below.

| File | Was | Now |
|---|---|---|
| `lib/shared-state.cjs:7-8` | `<CLAUDE_PROJECT_DIR>/session-state` | `sessionStateDir()` write, `sessionStateFile()` read |
| `lib/checkpoint-utils.cjs:11` | `…/session-state/checkpoints` | `sessionStateDir()/checkpoints`; a second export, `LATEST_READ_FILE`, carries the pre-move read |
| `lib/resolve-model.cjs:16` | `session-state/detected-model.json` | `sessionStateFile('detected-model.json')` |
| `lib/trace-log.cjs:32` | `session-state/last-session-id` | `sessionStateFile('last-session-id')` |
| `lib/gate2-verdict-lookup.cjs:32,40` | both pointer forms at the project root | both through `sessionStateFile` |
| `lib/tdd-detect.cjs:28` | `.claude/session-state/tdd-mode` | `SENTINEL_BASENAME` + `sentinelWritePath` + `sentinelPaths` |
| `lib/gate2-structural-checks.cjs:60-61` | `.claude/session-state/evidence` only | `evidenceRoots(root)` — pre-move roots, then the canonical one, last-present-wins unchanged |
| `lib/hook-logger.cjs:17` | `.claude/hooks/.logs` | `telemetryDir(root)` |
| `handlers/post-session.cjs` ×3 | hand-joined | resolver |
| `handlers/project-context-loader.cjs:71,86` | hand-joined; cleared 2 markers at one path | resolver; clears both markers in **every** location |
| `handlers/pre-completion-check.cjs:26-27` | two `session-state/*.json` rels | basenames + resolver |
| `handlers/precompact-probe.cjs:35` | hand-joined | `sessionStateDir` |
| `handlers/safety-sentinel-inject.cjs:54` | hand-joined | `sessionStateFile` |
| `handlers/checkpoint-writer.cjs:25` | hand-joined | `sessionStateFile` |
| `handlers/learning-observer.cjs:14` | `session-state/learning-observer.jsonl` | `sessionStateDir()` + basename |
| `handlers/orientation-ritual.cjs:90` | `LATEST_FILE` | `LATEST_READ_FILE` |
| `handlers/budget-tracker.cjs:75` | message named `session-state/budget-state.json` | names `.meowkit/state/budget-state.json` |
| `handlers/loop-detection.cjs:5`, `handlers/model-detector.cjs:9` | comments | comments name the state class |

CLI side: `core/task-record.ts` (pointer read/write/clear), `commands/budget-cost-log.ts`,
`commands/budget.ts`, `commands/doctor.ts`.

**Turning a mode OFF now reaches every copy.** `tdd-flag-detector` deletes the sentinel from the
canonical path *and* both pre-move paths, and `project-context-loader` does the same for `tdd-mode`
and `tdd-deprecation-warned`. A single-path delete would have left a pre-move sentinel keeping strict
mode on after the user switched it off — the silent-relax failure that detector exists to prevent.
`clearActiveTaskPointer` likewise unlinks the pointer wherever it resolved.

## S5.2 Two mentions of `session-state` survive on purpose

1. `lib/meowkit-paths.cjs:23,27` — the pre-move list itself, and the comment explaining it.
2. `lib/gate2-check.cjs:70` — `Fix: set session-state/active-plan.json {"path": …}`.

The second is the one place the move could not be made invisible. That exact string is the recorded
block body of `preship-commit-no-active-plan-pointer`, and the contract forbids re-recording a case to
accommodate a path move. Keeping the message byte-identical is what made the read fallback
**mandatory rather than optional**: with it the advice still resolves, so a frozen message stays true
instead of becoming wrong. A comment at the line says so and names the canonical path.

**Disclosed:** a user following that advice in a fresh project creates a project-root `session-state/`
directory that nothing else writes. It is read, so nothing breaks, and `doctor` then reports it as a
deletable leftover (S5.6) — but the text is pre-move and only a re-recorded corpus could change it.
Flagged for the evaluator rather than resolved by re-recording.

## S5.3 The web-fetch cache, and the `.claude/cache/` class with it

`persist_fetch.py:55` now writes `.meowkit/cache/web-fetches/`, and `privacy-block.cjs:46` moved in the
same change to `/(?:\.meowkit|\.claude)\/cache\/web-fetches\/index\.jsonl$|\.quarantined$/` — **both**
roots, so nothing blocked at BASE became readable and a stale cache in a pre-move install stays
protected. Prose followed in `web-to-markdown/{SKILL.md,references/gotchas.md,references/security.md}`
(19 occurrences).

Two more writers under `.claude/cache/` were found while measuring and moved with it, because AC-08
asserts that **no** `.claude/cache/` is created, not only that the fetch cache leaves:
`web-to-markdown/scripts/robots_cache.py` (`web-to-markdown/robots-cache.json`) and the
`agent-detector` detection cache. `agents/security.md`'s R3 question now names `.meowkit/cache/`.

The hook-fire log moved for the same reason: `.claude/hooks/.logs/hook-log.jsonl` was a hook write
inside the kit tree, and it is the one path that made the zero-residue check fail before the move. It
is an append log, so it lands in the telemetry class beside the trace log, still a separate file and
still uncompressed. `scripts/telemetry-decisions.py` reads the new path.

## S5.4 One new golden case, and why the corpus did not need re-recording

`privacy-read-webfetch-manifest-state-cache` asserts exit **2** with `@@PRIVACY_BLOCK@@` for
`.meowkit/cache/web-fetches/index.jsonl`. The BASE tree matched only the pre-move root, so it **cannot**
produce that block: the fixture is authored, not recorded, and says so — `"base": null`, a reason in
the case definition, and a new `authoredAfterBase` map in `tests/hooks/golden/index.json`. The recorder
now skips such a case instead of overwriting an authored expectation with a BASE run that was never
capable of asserting it; `fixtureCount` stays **82** and `groups.privacy` stays **5**, which is what
makes "nothing was re-recorded" readable from the index.

The pre-move case `privacy-read-webfetch-manifest` is **unchanged**, which is the proof the widened
pattern took nothing away.

**No fixture file was edited.** Three recorded side-effect PATHS moved, so the replay reads them from
the class that content lives in now, in `tests/hooks/lib/state-relocation.ts`:

```
.claude/session-state/ → .meowkit/state/
session-state/         → .meowkit/state/
.claude/hooks/.logs/   → .meowkit/telemetry/
```

Two properties keep that from hiding the thing it accommodates:

1. A write still landing at the recorded path resolves to `[write landed at the pre-move path …]`,
   which no recording matches — so a hook that kept writing the old location **fails**.
2. `migrateSeededState` moves state a fixture's SETUP seeded at a pre-move path before the hook runs.
   Without it, `learningobserver-third-edit` compared a hook reading one directory against a ledger
   seeded in another — a difference in the fixture's inputs, not in the code. Migrating first models
   the only state an upgraded install can be in.

Recorded content is still compared whole. Streams are untouched by any of this.

## S5.5 `harness-metadata-schema.json` moved into the CLI — the orchestrator's first option

`git mv .claude/schemas/harness-metadata-schema.json packages/mewkit/schemas/`, beside
`skill-schema.json` and `config-v1.json`. Resolved once, at module scope, exactly as slice 4 resolved
the frontmatter schema:

```ts
export const METADATA_SCHEMA_PATH = fileURLToPath(new URL("../../schemas/harness-metadata-schema.json", import.meta.url));
```

`loadSchemaEnums()` and `loadResponsibilityEnum()` lost their `claudeDir` parameter — the enums
describe what the engine enforces, so they no longer come from the project being checked.

`checkOwnership`'s install-signal branch is **gone with its subject**: the schema can no longer be
absent from a project, so there is nothing for its absence to signal. `missingInfraSeverity` is
removed from `checkOwnership` (it stays on `checkPacks`, whose subject is still installed content),
and `validate.ts:790` drops the `warn` downgrade. A failure now names the CLI install, a condition a
project cannot create. In-repo CI keeps its teeth: the governance-data FAILs (missing registry record,
missing field, out-of-enum value, unknown dir, stale entry) are untouched, and they now run against
the enum set that actually ships rather than against a fixture copy — `build-inventory.test.ts` no
longer plants a schema.

`.claude/schemas/` is empty and removed (`rmdir`, not a recursive delete). `base.exclude` keeps
`.claude/schemas/*` as a standing guard that nothing reappears there; the ship-set test asserts the
prefix never ships. Both schemas are now in `deletions.json`, so an upgrade removes the pristine
copies a pre-move install still has on disk — slice 4 moved `skill-schema.json` without that entry.

**Proof in the materialised install** (S5.7): `validate --ownership` → `[PASS] Ownership coverage`,
`validate` (all) → `21 passed, 1 warnings`, and `grep -iE "\[FAIL\]|mewkit upgrade|not installed"`
over the full run returns **nothing**. The wrong advice slice 4 flagged is gone, not re-worded.

## S5.6 Upgrade sunset, by mechanism rather than by list

| Residue in an existing install | Mechanism | Why that one |
|---|---|---|
| `.claude/schemas/{skill,harness-metadata}-schema.json` | `deletions.json` | kit-installed, pristine, now gone — exactly what the deletions pass removes |
| `.claude/hooks/.logs/**` | existing `hooks` orphan scope | the scope already covers it; a file the release stopped shipping is flagged and removed on the next upgrade |
| `.claude/session-state/**`, `session-state/**` | read fallback + a `doctor` WARN | see below |

`deletions.json` is structurally the wrong tool for runtime state: the pass removes a path only when
the PRE-WRITE installed metadata marks it kit-owned and pristine, and a hook-written marker was never
in that metadata, so an entry for it is a guaranteed no-op. `session-state` was deliberately **not**
added to `DEFAULT_ORPHAN_SCOPES` either: that would delete a recorded `evidence/<slug>/workflow-evidence.json`
a user may still need to ship with, and the confirmation prompt is not worth that risk when the
fallback already keeps the install working. So `doctor`'s state-taxonomy check flipped instead:

```
was  [pass/warn] Runtime state directory       "Ephemeral runtime files use project-root session-state/."
     [warn/pass] Legacy Claude session state   ".claude/session-state/ is legacy; prefer project-root session-state/."
now  [pass/warn] Runtime state directory       "Ephemeral session markers use .meowkit/state/."
     [warn/pass] Pre-move session state        "session-state/ and .claude/session-state/ are read-only
                                                leftovers; move anything you need into .meowkit/state/
                                                and delete them."
```

A WARN, not a FAIL: the directory is read, so nothing is broken — it is simply never written again.

## S5.7 The zero-residue journey, and how it was run

AC-08 asks for "one full session". No live Claude session is available here, so **each hook entrypoint
was driven directly with its own stdin payload** — the method is recorded rather than implied. The
project is the computed ship set materialised into a throwaway `$TMPDIR` directory
(`shipSetFiles(root, excludeMatcher(shipSetExclusions(root)))`, 1163 files), committed, with the
built CLI invoked by absolute path. `init`/`upgrade`/`uninstall` were **not** run, in any form.

One thing the archive does not carry had to be stood up: `.meowkit/.gitignore`, the deny-all file
`core/install-meowkit-dir.ts` writes. Without it the check would measure a project no install ever
produces.

```
dispatch.cjs SessionStart / UserPromptSubmit(--tdd) / PostToolUse(Edit) / Stop / PreCompact /
PostToolUseFailure          → exit 0 each, zero stack frames on stderr
gate-enforcement.cjs        → exit 2, @@GATE_BLOCK@@, "No approved plan found in tasks/plans/."
pre-implement.cjs parser    → exit 0
pre-ship.cjs (commit)       → exit 2, @@GATE_BLOCK@@, fails closed with no pointer
privacy-block.cjs (new path)→ exit 2, @@PRIVACY_BLOCK@@
privacy-block.cjs (old path)→ exit 2
append-trace.cjs            → exit 0

find for `session-state`            → nothing
find for `.claude/cache*`           → nothing
find for `.claude/hooks/.logs*`     → nothing

what the session wrote:
  .meowkit/cache/web-fetches/index.jsonl
  .meowkit/state/{budget-state.json, build-verify-cache.json, checkpoints/checkpoint-latest.json,
                  detected-model.json, edit-counts.json, last-model-id.txt, last-session-id,
                  learning-observer.jsonl, session-sentinels.jsonl, tdd-mode}
  .meowkit/telemetry/{cost-log.json, hook-log.jsonl, trace-log.jsonl}

git status --porcelain -- .claude .meowkit   → EMPTY
ls .claude/skills/.venv                      → No such file or directory
ls .meowkit/envs                             → absent (no env built; lazy Python unreversed)
```

Gate 2's pointer lookup was exercised from **both** locations on the same inputs and produced the same
verdict class: with `.meowkit/state/active-plan.json` and with `session-state/active-plan.json`, the
block moves from "no active-plan pointer" to "no review verdict for plan 'plan.md'" identically.

## S5.8 Ship-set effect, measured

```
scripts/kit-ship-set.cjs over the tree
→ 1163 files   (slice 4: 1163; unchanged)
  roots: .claude .meowkit release-manifest.json tasks
  .claude/ top level = 6 :: agents hooks rules settings.json skills statusline.cjs
  contains .claude/session-state  : false
  contains .claude/cache          : false
  contains .claude/schemas        : false
  contains .claude/hooks/.logs    : false
```

The count is unchanged because every path this slice moved was already withheld by `base.exclude` or
had never existed as a file. What changed is that three of those four prefixes can no longer be
created at all, so the exclusions guarding them are now standing guards rather than live filters.

## S5.9 One check had to learn that a path is not a brand

`check-generic-core-tokens.ts` requires a set of "cleaned light-touch skills" — `advise` among them —
to carry no brand token in their bodies. `advise` names its own state directory in five places, and
`.meowkit/state/<advise-run>/` contains `meowkit`, so relocating state made a provider-neutral skill
read as branded for naming the directory its own output lands in.

The rule gained one narrow exemption, `isStateTreePath`: a match preceded by `.` and followed by `/`
is a filesystem path, not brand prose. The dot-prefixed, slash-terminated form cannot be anything
else, and the rule's subject — vendor and product NAMES in canonical prose — is untouched. Reverting
`advise` to `session-state/` was the alternative and was rejected: it would leave two answers in the
tree for one question.

## S5.10 Gate results for this slice

| Gate | Result |
|---|---|
| `npm run build` | PASS |
| `npm run lint` | PASS — 0 errors, 3 warnings (all pre-existing: `buildCapabilities`, `path`, `countFiles`) |
| `npm run typecheck` | PASS — no output |
| `npm test` | PASS — **298 files / 3372 tests, 0 failures, 0 skipped**. 3371 → 3372 is exactly the new golden case |
| built-CLI `validate` (all, in-repo) | PASS — 39 passed, 34 warnings, 1 n/a, 0 failed |
| built-CLI `validate --ownership / --packs / --gates / --frontmatter / --docs-refs / --workflow / --memory` | all PASS in-repo |
| `$TMPDIR` install — `validate` (all) | PASS — 21 passed, 1 warnings; **no FAIL and no "run mewkit upgrade" advice** |
| `$TMPDIR` install — `--ownership / --packs / --gates / --frontmatter / --docs-refs / --memory` | all PASS (1 passed each) |
| `$TMPDIR` install — `--target codex / --target cursor` | n/a — no generated layout, as at BASE and in slices 3–4 |
| zero-residue journey | PASS — `git status --porcelain -- .claude .meowkit` empty (S5.7) |
| golden replay (`tests/hooks/golden-replay.test.ts`) | PASS — **87/87**; fixtures unedited, one new authored case |
| golden + port suites (`tests/hooks`, `tests/ports`) | PASS — 18 files / 355 tests (was 353; +2 from the new case and its index assertions) |
| `node --test .claude/hooks/__tests__/*.test.cjs` | PASS — 36/36 |
| `node scripts/check-always-on-budget.cjs .` | PASS — **25 417 B**, 183 B of headroom; +1 B vs slice 4 (`.meowkit/state` is one byte longer than `session-state`), 84 B below the 25 501 B pin |
| `node scripts/check-rule-survival.cjs .` | PASS — every pinned safety item survives |
| `node scripts/check-dangling-rule-refs.cjs .` | PASS — all 22 destinations loaded |
| `node scripts/check-kit-verbs.cjs` | PASS — 291 references resolve against 24 commands |
| `node scripts/check-node-only-runtime.cjs` | PASS — 79 / 71 / 3, unchanged |
| `node scripts/check-env-reads.cjs` | PASS — 138 reads |
| `node scripts/check-no-python.cjs --allow-existing-envs` | PASS — all 26 checks |
| `node scripts/check-memory-wiki-residue.cjs` | PASS — 0 hits |
| `node scripts/generate-cli-manual.cjs --check` | PASS — manual matches the catalogue |
| `node scripts/docs-manifest.cjs --check` | PASS after `--write` (171 artifacts; the regen is the hash of the kit prose this slice edited) |
| `node scripts/harness-inventory.cjs --check` | PASS |
| `node scripts/link-checker.cjs` | PASS |
| `bash scripts/check-hook-registration.sh` | PASS — 6 hooks |
| `bash scripts/validate-rule-availability.sh` | PASS — 7 rule references resolve |
| `bash tests/{surface-contract,spec-drift,help-skill-contract,changed-files-lint}.test.sh` | PASS — failed: 0 each |
| `tests/journey-validation/check-journey-specs.py` | PASS — 12 journeys frozen, unchanged |
| `mewkit doctor --hard-gates` | PASS — 26 passed, 5 warnings, 0 failed (retired `MEOWKIT_*` unset) |
| `bash scripts/check-skill-cross-refs.sh` | **FAIL, identical to BASE** — `BROKEN_LOCAL_REF: .claude/skills/context-audit/SKILL.md -> scripts/harness-inventory.cjs`, the one pre-existing finding |
| `bash tests/resolve-model.test.sh` | **FAIL, identical to BASE** — see below |
| control-character scan over 392 changed/new text files | 1 hit, **pre-existing** — U+200B at `check-skill-frontmatter.ts:105`, present at BASE and not touched here |
| plan-artifact token scan over added lines | 0 — the single grep hit is a pre-existing illustrative `tasks/plans/260610-x/phase-02-*.md` sample in skill prose, not a reference to this plan |

`tests/resolve-model.test.sh` fails 7/7 **at BASE**: it `source`s `resolve-model.cjs` as a shell script
and calls a `resolve_model` shell function that the node port does not define. Verified by running the
BASE copy of the test against the BASE helper in a clean `git archive` extraction of `d17cc03b` — same
7 failures. It is not in this slice's gate list and is a stale shell-era harness, not a regression;
recorded here so the repo-green slice can retire or port it.

## S5.11 File-size accounting

Two new files: `tests/hooks/lib/state-relocation.ts` at **63** and
`tests/hooks/golden/privacy-read-webfetch-manifest-state-cache.json` at **23**.

| File | BASE | Now | Note |
|---|---|---|---|
| `tests/hooks/lib/replay-harness.ts` | 194 | 195 | reached 253 with the relocation logic, then split into `state-relocation.ts` |
| `tests/hooks/golden-replay.test.ts` | 195 | 198 | +3 header lines naming the side-effect deviation; under 200 |
| `.claude/hooks/lib/meowkit-paths.cjs` | 58 | 86 | the read resolver and the pre-move list |
| `.claude/hooks/lib/tdd-detect.cjs` | 68 | 84 | sentinel write path + the all-locations list |
| `packages/mewkit/src/state/resolve-state-dir.ts` | 50 | 74 | the TS mirror |
| `packages/mewkit/src/core/check-generic-core-tokens.ts` | 86 | 104 | the state-path exemption and its reason |
| `packages/mewkit/src/core/task-record.ts` | 526 | 534 | already over 200 at BASE; +8 for the read/write path split |
| `packages/mewkit/src/core/build-inventory.ts` | 495 | 473 | already over 200 at BASE; **shrank** 22 — the install-signal branch left with its subject |
| `packages/mewkit/src/commands/doctor.ts` | 425 | 428 | already over 200 at BASE; +3 |
| `packages/mewkit/src/core/substrate.ts` | 235 | 234 | already over 200 at BASE; −1 |
| `packages/mewkit/src/commands/budget.ts` | 306 | 307 | already over 200 at BASE; +1 |
| `packages/mewkit/src/core/__tests__/build-inventory.test.ts` | 247 | 230 | already over 200 at BASE; −17 |

**No file crossed 200 because of this slice.**

## S5.12 What slice 6 needs to know

1. **AC-08 is closed and AC-05's `--ownership` consequence is closed with it.** `validate --ownership`
   passes in an installed project, and the default run carries no "run `mewkit upgrade`" advice for
   this. Nothing is left pending from slice 4's S4.6.
2. **`.meowkit/state/` is the canonical session-marker class; `session-state/` and
   `.claude/session-state/` are READ-ONLY pre-move paths.** Any new reader uses
   `sessionStateFile` / `resolveSessionStateFile`; any new writer uses `sessionStateDir` /
   `resolveStateDir(root, "state")`. Adding a hand-joined path re-opens the defect.
3. **`gate2-check.cjs:70` still names `session-state/active-plan.json` and must stay byte-identical** —
   it is the recorded block body of a golden case. Do not "tidy" it; the read fallback is what keeps
   it true (S5.2).
4. **docs are still AC-09's and still stale on this subject.** `docs/core/meowkit-rules.md`'s five
   path rows were corrected here because this slice moved their subject, but the rest of `docs/` and
   `packages/docs/content/` still name `session-state/`, `.claude/cache/web-fetches/`,
   `.claude/hooks/.logs/` and `.claude/schemas/`. The changelog pages are immutable.
5. **`release-manifest.json` is stale at 1272 files / 17 deletions** and has been since slice 1. It is
   regenerated by the release pipeline (`scripts/generate-release-manifest.cjs` reads
   `deletions.json`), so the repo-green slice should decide whether this sprint regenerates it or
   leaves it to the release.
6. **`deletions.json` covers slices 1–3 plus the two schemas, and nothing else slice 4 excluded.**
   `benchmarks/`, `agent-memory/` and `harness-substrate.md` are withheld from the artifact but have
   no deletion entry and are not in `DEFAULT_ORPHAN_SCOPES`, so an existing install keeps them on
   disk. `skills/benchmark/**` is covered by the `skills` orphan scope. That gap is slice 4's and is
   a decision for the repo-green slice: `agent-memory/` in a user's project may be their own content.
7. **`tests/resolve-model.test.sh` is BASE-broken** (S5.10) — a shell-era test sourcing a `.cjs` file.
   Either port it to `node --test` or retire it, with the reason recorded.
8. **The golden corpus has a third documented deviation**, applied to side effects rather than
   streams, and a new `authoredAfterBase` concept for a case the BASE tree cannot produce. A future
   authored case sets `authoredAfterBase: "<reason>"` on the case definition and hand-writes the
   fixture with `"base": null`; the recorder then leaves both alone.
9. **The brand check now exempts `.<name>/` paths.** A skill required to be provider-neutral may name
   `.meowkit/...` paths. Do not reintroduce a `session-state/` spelling to satisfy that check.

# Slice 6 — descaffold, docs, full green

Closes **AC-07** (`tasks/` descaffold), **AC-01**'s `README.md` / `RELEASING.md` half, **AC-09** (docs,
projections, generated artifacts) and **AC-11** (repo green), and applies the four orchestrator
decisions on slice 5's disclosures. Measured on the slice-1-through-5 tree, `HEAD` = `d17cc03b`,
BASE = `de278a5f`.

## S6.1 `tasks/` is no longer an archive root, and the 13 files it carried are accounted for

The thirteen shipped `tasks/` files arrived because the ship set walked the root, so the root left the
walk rather than the files leaving one by one. `scripts/kit-ship-set.cjs` `ARCHIVE_TARGETS` drops
`"tasks"`, and the five now-dead `tasks/*` patterns leave `base.exclude` with it — a pattern over a
path no archive walks withholds nothing and reads as coverage it does not provide.

| BASE file | Disposition |
|---|---|
| `tasks/{active,autobuild-runs,backlog,contracts,guidelines,plans,reviews}/.gitkeep` (7) | `git rm` — the directories are created by their first writer |
| `tasks/templates/plan-quick.md` | → `.claude/skills/plan-creator/assets/plan-quick.md` |
| `tasks/templates/plan-phase.md` | → `.claude/skills/plan-creator/assets/plan-phase.md` |
| `tasks/templates/bead-template.md` | → `.claude/skills/plan-creator/assets/bead-template.md` |
| `tasks/templates/pm-status-template.md` | → `.claude/skills/status/assets/pm-status-template.md` |
| `tasks/templates/plan-template.md` | `git rm` — it was a **9-line redirect** whose own body pointed at `.claude/skills/plan-creator/assets/plan-template.md`, which already exists. Moving it would have put two files of that name in one skill; the canonical one is the single new path AC-07 asks for, and the redirect was the second answer |
| `tasks/jira-workflows/README.md` | → `.claude/skills/jira-lifecycle/references/workflow-cache-layout.md` |

```
ls tasks/                 → contracts  plans  reports  reviews     (this repo's own run output only)
git ls-files tasks/ minus plans/contracts/reviews → (none)
each of the 6 rehomed files, by name  → present
```

**The 8 references.** Seven files name a template and all **10** of their path references resolve
(`plan-creator/assets` + `status/assets`, checked by `existsSync`, 0 broken): `agents/planner.md`,
`agents/project-manager.md`, `skills/autobuild/step-05-iterate-or-ship.md`,
`skills/autobuild/step-06-run-report.md`, `skills/cook/references/post-phase-delegation.md`,
`skills/status/SKILL.md`, `skills/worktree/SKILL.md`. The eighth,
`skills/plan-creator/references/research-phase.md`, named `tasks/templates/report.md` — **a file that
never existed at BASE**. The line is removed rather than re-pointed: the bullet list under it already
*is* the report format, so the reference was decoration over a dangling path.

`skills/status/SKILL.md` named `pm-status-template` **twice** (the agent prompt at :74 and the Related
list at :114). Both now name `.claude/skills/status/assets/pm-status-template.md`, so nothing dangles.

`workflow-cache-layout.md` arrived with **zero readers** — AC-07 asks for it inside "a skill that reads
it", so two pointers were added: `skills/jira-lifecycle/SKILL.md`'s authoritative-source list and a
paragraph in `references/workflow-discovery.md` stating that the cache directory is created by the
first discovery run. Both are **body** edits; the integration frontmatter drift check below is 0.

**`reinstall-empty-dirs` removed from all five sites** — `commands/migrate.ts` (the arg type and the
option pass-through), `migrate/types.ts` (the zod field), `migrate/migrate-mode-resolver.ts` (the
mutual-exclusion throw), `index.ts` (the dispatch cast) and `cli/command-catalogue.ts` (the flag row).
`git grep reinstall-empty-dirs -- packages/mewkit/src` → empty. The generated CLI manual and
`docs/cli/index.mdx` dropped the row through their generators; `docs/cli/commands.mdx` and
`docs/cli/portability.mdx` are hand-authored and were edited.

**One doctor check left with its subject.** `checkStateTaxonomy`'s "Autobuild run ledger" warned when
`tasks/autobuild-runs/` was absent. With no scaffold the directory is absent in every fresh install
until the first autobuild run creates it (`skills/autobuild/step-00-tier-detection.md:42` does
`mkdir -p`), so the check would have warned permanently and advised the user to create a directory the
kit creates itself. It is removed rather than inverted: absence is no longer a condition anyone can
act on. No test asserted it.

**Lazy creation, run rather than reasoned:**

```
mewkit task new --type feature "add a widget"   in an EMPTY $TMPDIR project
→ ✓ Created: <tmp>/tasks/active/261109-add-a-widget.feature.md
  find . -type f → ./tasks/active/261109-add-a-widget.feature.md     (nothing else)
  mewkit task list → 1 task found
```

`readTemplate`'s per-type lookup is retained and its comment corrected: the kit ships no file under
any of those four names (it did not at BASE either), so `null` is the normal answer and the lookup
exists so a team that authors its own task shape still gets it picked up.

## S6.2 Both gates behave identically without `tasks/`

Run with `CLAUDE_PROJECT_DIR` pointed at throwaway `$TMPDIR` projects.

| Case | Exit | Marker | First body line |
|---|---|---|---|
| Gate 1, source edit, **no `tasks/` at all** | **2** | `@@GATE_BLOCK@@` | `No approved plan found in tasks/plans/.` |
| Gate 1, source edit, **empty `tasks/plans/`** | **2** | `@@GATE_BLOCK@@` | `No approved plan found in tasks/plans/.` |

Byte-identical: exit code, marker and message class. An absent directory is "no plan", never an error.

```
Gate 2, ship-capable commit, no verdict, no tasks/   → exit 2, @@GATE_BLOCK@@
  "Ship-capable change (e.g. src/a.ts) with no active-plan pointer."
  "Fix: set session-state/active-plan.json {"path": "tasks/plans/<plan-dir>"}."
```

That `session-state/` spelling is **deliberately byte-identical** to BASE (slice 5's note 3): it is the
recorded block body of a golden case, and the read fallback in `meowkit-paths.cjs` is what keeps the
advice true. No stack frame appeared on any of the three runs
(`grep -c 'at .*:[0-9]*:[0-9]*'` → 0).

## S6.3 Ship-set effect, measured

```
scripts/kit-ship-set.cjs over the finished tree
→ 1155 files   (slice 5: 1163; −8 = 7 .gitkeep + 1 redirect template;
                the other 6 files moved into .claude/ and are still shipped)
  roots (3): .claude  release-manifest.json  .meowkit/{pack-manifest,harness-inventory}.json
  .claude/ top level = 6 :: agents hooks rules settings.json skills statusline.cjs
  contains tasks/                 : false
  contains .claude/{commands,modes,schemas,scripts,benchmarks,agent-memory,rubrics,rules-conditional} : false (each)
```

**Materialised `$TMPDIR` install** (the computed ship set copied file-by-file — `init` is never run in
or against this repository, sprint 7 D11):

```
project root        :: .claude  .meowkit  release-manifest.json
CLAUDE.md           :: absent
tasks/              :: absent
manifest in .claude :: none
validate (all)      :: 21 passed, 1 warnings, 0 failed
validate --packs / --gates / --frontmatter / --docs-refs / --memory / --ownership :: 1 passed each
```

`release-manifest.json` is an **archive** root, not an install root: `core/release-metadata.ts:41` reads
it from the extracted release `sourceDir` and the installer never copies it into the project, so a real
install delivers exactly the two directories AC-01 names. The materialised view is the archive, which is
why it shows three.

Each of the eleven departing entries is absent from `base.files`, `base.globs` and `base.commands`
(`base.commands` no longer exists as a key, slice 3), so nothing returns through a pack declaration:

```
agent-memory  benchmarks  capability-bootstrap.md  commands  harness-substrate.md
modes  rubrics  rules-conditional  schemas  scripts  workflow.yaml     → absent (all 11)
base.exclude : 28 patterns (was 33; the 5 tasks/* patterns left with the root)
```

## S6.4 Four kit tests had the removed root as their subject

Each is rewritten to assert the stronger property, not relaxed:

- **`ship-set-completeness.test.ts`** — "ships no run output from `tasks/`, only its templates and the
  homes they live in" became "ships **nothing** under `tasks/`, and the templates that lived there have
  skill homes". The class is now structurally impossible rather than filtered, so the test also asserts
  `isExcluded("tasks/plans/260101-x/plan.md") === false` — a pattern-based claim would otherwise pass
  for the wrong reason. Each of the six rehomed files is asserted present in the ship set **and**
  unique inside `.claude/`.
- **`helpers/ship-set-view.ts`** — `underArchiveRoot` drops `tasks/`. It also gained
  `.meowkit/harness-inventory.json`, which `ARCHIVE_TARGETS` has carried since sprint 7 while this
  helper did not — a pre-existing drift that would have hidden an exclusion over that file.
- **`kit-release-wiring.test.ts`** — the "keeps every exclusion pattern the zip build carried" list goes
  17 → **14**, with the reason stated, plus a new assertion that **no** `tasks/` pattern may return
  (a returning pattern means the root came back).
- **`kit-artifact-build.test.ts`** — the "an added pattern drops the file" fixture used
  `tasks/reports/secret.md` as its subject. It now uses `.claude/logs/secret.md`: still a real
  excluded class under a real archive root, so the claim is unchanged.
- **`legacy-zip-guard.test.ts`** — the "good member path" example `tasks/templates/x.md` became
  `.meowkit/pack-manifest.json`. A path-shape test, so only the example changed.

## S6.5 `README.md` and `RELEASING.md` — every count measured

The banner at BASE read "125 skills · 42 agents · **27 commands** · **7 modes** · 7 rules ·
**5 conditional rules** · 27 hook scripts". It now reads:

```
129 skills · 42 agents · 7 rules · 27 hook scripts · 4-layer+ security
```

Measured, and reconciled with the committed check:

| Token | Value | Source |
|---|---|---|
| skills | **129** | `check-stale-index.ts` `countSpecs` measures `.claude/skills/*/SKILL.md` in the **repository**, and `validate --agents` FAILs on drift. 128 of the 129 ship — `benchmark` is maintainer-only — so the Project Structure tree states both: "129 skills (mk: namespace) — 128 ship; benchmark is maintainer-only" |
| agents | **42** | 44 files under `.claude/agents/` minus `AGENTS_INDEX.md` and `SKILLS_INDEX.md`; unchanged from BASE |
| rules | **7** | `ls .claude/rules/*.md` |
| hook scripts | **27** | 6 entrypoints + 21 handlers, the same metric and the same number as BASE; the 40 `lib/` files are their libraries, so the tree line now says "lifecycle hooks + handlers — plus their libraries" |
| commands / modes / conditional rules | **removed from the banner** | the directories do not exist |

Tried and rejected: writing 128 in the banner. `validate --agents` reported
`[FAIL] Count drift: README.md (skills) — declared 128, found 129`, and changing the check's subject
to the ship set would also move the `SKILLS_INDEX.md` total and the architecture-overview count, which
are repository indexes. The repo count stays the token; the shipped count is stated beside it.

Other `README.md` corrections, each a claim the earlier slices falsified:

- Project Structure dropped `commands/`, `modes/`, `scripts/` and the `tasks/ Task templates` line, and
  gained `statusline.cjs` — the tree now lists the six entries the ship set computes.
- "the same emitter writes the kit's skills, agents, **commands** and hooks" → "skills, agents and hooks".
- `init` "scaffolds `.claude/`" → "scaffolds `.claude/` and `.meowkit/` … the only two directories it adds".
- The Setup section claimed `mewkit setup` "creates the Python venv at `.claude/skills/.venv`". That
  directory is **absent** (phase 05). It now names what `setup-steps.ts` actually does — `.mcp.json`,
  `.meowkit/.env`, `.gitignore`, `docs/project-context.md`, and per-skill environments under
  `.meowkit/envs/<skill>/` created on demand.
- Requirements: "Python 3.9+ (stdlib only, for validation scripts)" → optional, only for the skills that
  run Python, because `check-no-python.cjs` proves the core runtime needs none.

`RELEASING.md`: the architecture diagram and the five "`.claude/` and `tasks/`" scope sentences now name
`.claude/` alone; the release-zip contents line names the three real roots and states that no `tasks/`
scaffold ships; the brand-grep command drops `.claude/commands`; and the surface-mapping table loses its
`commands/**` and `modes/*` rows, whose source surfaces no longer exist.

## S6.6 Docs — resolved, not rewritten

**Command-only `/mk:` targets.** AC-02 kept the 40 non-docs files, AC-09 the **20** docs files. All 20
are rewritten by exact token, and the resolver (every `/mk:<name>` in `docs/` + `packages/docs/content/`
against `.claude/skills/*/SKILL.md`) now reports **0 unresolved outside the changelog**:
`plan`→`plan-creator`, `audit`→`cso`, `canary`→`ship`, `test`→`testing`,
`validate`→`lint-and-validate`, `docs-sync`→`document-release`, `meow`→`agent-detector`,
`spawn`→`team-config`, `design`→`improve-codebase-architecture`, and `budget` / `upgrade` to the
`mewkit budget` / `mewkit upgrade` **verbs**. Four prose edits beyond the token swap:
`agent-skill-architecture.mdx`'s "`mk:cso`, `mk:audit`" pair collapsed to one entry;
`skill-template-secure.mdx`'s Rule-of-Two row became **`mk:scout`** (not `mk:cso`, which writes reports
— the same reasoning slice 3 applied to the kit copy of that row); `context-isolation.md`'s
"Use `mk:spawn` … The command enforces" became "`mk:team-config` … The skill enforces".

**Removed and relocated paths.** `.claude/session-state/` and bare `session-state/` → `.meowkit/state/`;
`.claude/cache/web-fetches` → `.meowkit/cache/web-fetches`; `.claude/cache/agent-detection-cache.json`
→ `.meowkit/cache/`; `.claude/hooks/.logs/` → `.meowkit/telemetry/`; `.claude/skills/.venv/...` →
`node .claude/hooks/lib/skill-python.cjs` or `.meowkit/envs/<skill>/`. The retired
`ensure-skills-venv.sh` row left `reference/hooks.mdx` — that file does not exist anywhere in the tree.
`docs/core/meowkit-rules.md`'s Python example had WRONG and RIGHT **identical** after an earlier slice's
substitution; the WRONG side is a bare `python` invocation again, which is what the rule is about.

A mechanical sweep also damaged three things, each restored by hand and worth naming because the
pattern recurs:

1. `meowkit-rules.md`'s path table has a **"wrong path"** column that legitimately names the old
   answers. The sweep rewrote the wrong column to the right one, turning five rows into tautologies.
   Restored: the canonical column says `.meowkit/...`, the wrong column still says
   `session-state/` · `.claude/session-state/` · `.claude/cache/web-fetches/`.
2. `philosophy.mdx` read "project-local under `.meowkit/` and `session-state/`" → the sweep made it
   "`.meowkit/` and `.meowkit/state/`". Now just `.meowkit/`.
3. `guide/session-state-vs-resume.mdx` is named after the directory. The slug and the concept word stay
   (meta.json routes to it and inbound links exist); every **path** is `.meowkit/state/`, and one
   orienting line at the top says where the directory went and that the two pre-move spellings are
   read-only leftovers.

**`/mk:benchmark` is marked unshipped, not deleted** (AC-05's stated consequence). The reference page
carries a `Maintainer-only` callout; `trigger-registry.md`'s row, both `cheatsheet.mdx` rows,
`reference/skills/index.mdx`'s hand-written row, `rubric.mdx`, `using-meowkit-productively.mdx`'s two
rows, and `trace-and-benchmark.mdx`'s section opener all say it in words. The `.claude/benchmarks/...`
paths in those pages are **left as they are**: the files exist in this repository, which is where the
procedure runs.

**What still names a removed path, and why.** A grep of `docs/` + `packages/docs/content/` +
`README.md` + `RELEASING.md` for the twelve patterns returns **20 lines**, excluding the changelog,
`docs/journals/` and `docs/reference/sub-agents.md`. Every one is deliberate:

| Lines | Where | Why it stays |
|---|---|---|
| 7 | `meowkit-rules.md` path table + taxonomy prose | the old paths are the **wrong-answer** column and the named read-only leftovers |
| 7 | `benchmark.mdx`, `trace-and-benchmark.mdx` | `.claude/benchmarks/` exists in this repo; the pages are marked maintainer-only |
| 2 | `adr/260511-...md` | a dated ADR, plus the superseded-path note added to its Status line |
| 1 | `meowkit-architecture.md:55` | inside the dated "Component Inventory (Verified …)" table, which `check-stale-index.ts` documents as a historical snapshot that must not be bumped. **Changed, then reverted** when that comment was read: falsifying an audit record is worse than a stale row, and the path it names (`.claude/commands/meow/*.md`) has not matched the live layout since v2.4 |
| 1 | `docs-references-inventory.md:25` | a struck-through history row, annotated "Resolved by deletion" |
| 1 | `session-state-vs-resume.mdx:6` | the orienting line that names the pre-move spellings |
| 1 | `migration.mdx:33` | "**Your own** `.claude/commands/` files are not converted" — a user's host surface, which the kit shipping none does not remove from the world (slice 3's standing decision) |

`docs/reference/sub-agents.md` is excluded by inspection, not by convenience: its `~/.claude/agent-memory/`
and `.claude/commands` mentions are **vendored host documentation** about Claude Code's own subagent
memory feature, not about this kit. `docs/core/memory-system.md:166` is the same host feature.

## S6.7 Generated artifacts and provider bundles

| Artifact | Result |
|---|---|
| `scripts/generate-cli-manual.cjs` | regenerated, then `--check` PASS (the `--reinstall-empty-dirs` row left) |
| `MEOWKIT_WRITE_SYNOPSIS=1` synopsis regen | `docs/cli/index.mdx` −1 line; `synopsis-drift.test.ts` 2 passed |
| `scripts/docs-manifest.cjs --write` → `--check` | PASS — 171 artifacts, "manifest and 171 reference page(s) match the live `.claude/` tree"; 0 reference pages and 0 index pages needed re-splicing after the write, so the GENERATED regions were already current |
| `scripts/harness-inventory.cjs --check` | PASS — "Docs match the inventory" |
| `validate --target codex` / `--target cursor` | n/a in-repo and in the install — no generated layout, as at BASE and in slices 3–5 |

**There is no projection generator.** `RELEASING.md` states the Codex and Cursor bundles are
hand-authored with no porter, and nothing under `scripts/` or `package.json` writes
`packages/mewkit/src/migrate/modules/`. So "regenerate the projections" resolves to: run the generators
that do exist (above), and fix the bundle drift this sprint caused by hand. Four fixes:

- the 12 bundle references to `tasks/templates/*` now name bundle-local paths, with
  `pm-status-template.md` mirrored into `mk-autobuild/assets/` and `plan-quick.md` + `bead-template.md`
  into `mk-plan-creator/assets/` (both bundles already carried `assets/plan-template.md`, so the
  location is the bundles' own convention);
- `codex/.agents/skills/mk-help/SKILL.md` still read "Alias: … slash-command wrapper at
  `.codex/commands/mk/plan.md`" — slice 3's recorded drift. It now carries the same sentence the kit's
  `help/SKILL.md:107` carries;
- `research-phase.md` in both bundles lost the same never-existing `tasks/templates/report.md` line.

**Not done, measured and left open:** the bundles still narrate `session-state/` in **55 files / 94
occurrences**. Their hooks do **not** — `grep session-state` over both bundles' `hooks/*.cjs` is empty —
so this is stale prose, not a broken path. It is outside this slice's named surface (`docs/` and
`packages/docs/content/`), slice 5 owned AC-08 and chose not to touch it, `RELEASING.md` explicitly
permits the bundles to carry "different TDD sentinel paths", and no committed check covers it. A
94-occurrence sweep of hand-authored files with no generator and no check is recorded here for sprint 9
rather than taken on unverified at the end of a slice.

## S6.8 The four slice-5 disclosures

**(a) `tests/resolve-model.test.sh` — ported, then deleted.** It was BASE-broken: a shell test that
`source`s a `.cjs` file and calls a `resolve_model` shell function the node port never defined (7/7
failures at BASE, verified by slice 5 against a clean extraction). No other test covered
`resolve-model.cjs` — `git grep resolveModel` found only `migrate/model-taxonomy.ts` and its own test,
a different subject. So the intent is ported to **`.claude/hooks/__tests__/resolve-model.test.cjs`**,
inside the tree the gate list already runs: 11 `node:test` cases covering the artifact happy path,
**artifact-wins-over-env** (the ordering is the point — an env export must not rewrite what every
record claims the session ran on), the env fallback, the three-step env chain order, `unknown` →
fallback, the `unknown` **warning**, the shell-metachar sanitiser, a truncated-write textual salvage,
an unrecoverable body, and — new, because the state move made it possible to regress — that **both
pre-move artifact locations are still read**. `tests/resolve-model.test.sh` is `git rm`'d; its only
remaining mention is an immutable changelog line.

**(b) `deletions.json` — `benchmarks/**` and `harness-substrate.md` added; `agent-memory/` deliberately
not.** The list is consumed by exact `.claude/`-relative path (`smart-update.ts:335`), not by glob, so
the nine BASE-tracked paths are enumerated: `benchmarks/README.md`,
`benchmarks/canary/full/06-small-app-build-spec.md`, the five `benchmarks/canary/quick/0{1..5}-*.md`,
`benchmarks/results/.gitkeep` and `harness-substrate.md`. **126 entries** total. The pass is safe because
it removes a path only when the pre-write installed metadata marks it `owner: "meowkit"` **and** the
on-disk hash is still pristine, and it is suppressed by `--no-cleanup`.

`agent-memory/` is **not** added, as instructed. A user's `.claude/agent-memory/<agent>/` may hold their
own subagent memory — it is a host feature (`docs/reference/sub-agents.md` documents `project` scope
writing exactly there), so a path that is this repository's evaluator memory *here* may be the user's
own content *there*. The exclusion stops us publishing ours; a deletion entry would delete theirs. It
stays on disk in an existing install and the `skills` orphan scope does not reach it.

**(c) `release-manifest.json` — left to the release pipeline.** No check enforces its freshness: it is
written by `scripts/generate-release-manifest.cjs`, which only `scripts/prepare-release-assets.cjs:34`
invokes, at release time, and no CI job, test or validator compares it against the tree. Regenerating
it in a sprint commit would stamp a version and a timestamp that no release produced. It stays stale at
1272 files / 17 deletions and the release regenerates it from the finished `deletions.json`.

**(d) `gate2-check.cjs:70` is byte-identical.** `git diff de278a5f -- .claude/hooks/lib/gate2-check.cjs`
shows no change to that line; the message is reproduced verbatim in S6.2 from a live run.

## S6.9 The pre-existing `check-skill-cross-refs.sh` finding is closed

`BROKEN_LOCAL_REF: .claude/skills/context-audit/SKILL.md -> scripts/harness-inventory.cjs` — the skill
pointed at a **repo-root maintainer script** that no installed project has, and the checker resolves any
`scripts/...` token in a `SKILL.md` as a kit entrypoint. The checker is right to: a `SKILL.md` naming an
unresolvable script is a broken route.

Fixed by naming the **verb** instead of the path: `mewkit validate --substrate`, run to confirm it
exists and does the job (`2 passed, 1 warnings`). An intermediate attempt used
`mewkit inventory --substrate`, which `CLAUDE.md` names but the CLI does **not** implement
(`Unknown command: inventory`) — caught by running it rather than trusting the prose, and recorded here
because that line in `CLAUDE.md` is wrong independently of this sprint.

```
bash scripts/check-skill-cross-refs.sh .
→ OK: all skill and local entrypoint refs resolve          (exit 0 — FAIL at BASE and in slices 1–5)
```

## S6.10 One kit template carried a stale path into the provider bundles

Mirroring `pm-status-template.md` into both bundles made four bundle denied-token tests fail —
`cursor-output-brand-free`, `cursor-bundle-lint`, and the codex/cursor pack-cleanliness pairs — on a
`.claude` path inside the template. Reading the file to fix the bundles surfaced a second, kit-side
defect the bundles had made visible:

- line 40 read ``Source: `.claude/memory/cost-log.json` `` — **wrong since the telemetry move**. The
  log is `.meowkit/telemetry/cost-log.json` (`commands/budget-cost-log.ts:12`,
  `handlers/post-session.cjs:60`). Corrected in the kit copy.
- line 63's attribution names `.claude/skills/cook/references/post-phase-delegation.md`, which is
  correct in the kit and a denied token in a bundle. The bundle copies name their own
  `mk-cook/references/post-phase-delegation.md` instead.

The four suites then pass (390 tests). The finding is worth recording on its own: the bundles' brand
lint caught a stale kit path that no kit-side check looks for, because the kit is allowed to say
`.claude/...` and nothing verifies that what follows it exists under the current taxonomy.

## S6.11 Gate results for this slice

| Gate | Result |
|---|---|
| `npm run build` | PASS |
| `npm run lint` | PASS — **0 errors**, 3 warnings (all pre-existing: `buildCapabilities`, `path`, `countFiles`) |
| `npm run typecheck` | PASS — no output |
| `npm test` | PASS — **298 files / 3372 tests, 0 failed, 0 skipped**. Test count unchanged from slice 5: the 11 new `resolve-model` cases run under `node --test`, not vitest |
| built-CLI `validate` (all, in-repo) | PASS — **39 passed, 34 warnings, 1 n/a, 0 failed** |
| built-CLI `validate --packs / --gates / --frontmatter / --docs-refs / --memory / --workflow / --ownership / --substrate` | all PASS in-repo (packs/gates/frontmatter/docs-refs/memory/ownership 1 each, workflow 6, substrate 2 + 1 warn) |
| built-CLI `validate --agents` | PASS — 2 passed; `[PASS] Index counts & completeness` is the README-count gate |
| `$TMPDIR` install — `validate` (all) | PASS — **21 passed, 1 warnings, 0 failed** |
| `$TMPDIR` install — `--packs / --gates / --frontmatter / --docs-refs / --memory / --ownership` | all PASS (1 passed each) |
| `$TMPDIR` install — `--target codex / --target cursor` | n/a — no generated layout, as at BASE and in slices 3–5 |
| `$TMPDIR` install — project root | `.claude  .meowkit  release-manifest.json`; **no `CLAUDE.md`, no `tasks/`, no manifest inside `.claude/`** |
| golden replay (`tests/hooks/golden-replay.test.ts`) | PASS — **87/87**, no fixture edited and no case re-recorded |
| `tests/hooks` + `tests/ports` + `src/kit` + `src/commands/__tests__` | PASS — 52 files / 593 tests |
| `node --test .claude/hooks/__tests__/*.test.cjs` | PASS — **47/47** (36 at slice 5; +11 the ported model-resolution cases) |
| `node scripts/check-always-on-budget.cjs .` | PASS — **25 417 B**, 183 B of headroom; **unchanged from slice 5**, 84 B below the 25 501 B pin |
| `node scripts/check-rule-survival.cjs .` | PASS — every pinned safety item survives |
| `node scripts/check-dangling-rule-refs.cjs .` | PASS — all 22 destinations loaded |
| `node scripts/check-kit-verbs.cjs` | PASS — 292 references resolve against 24 commands |
| `node scripts/check-node-only-runtime.cjs` | PASS — 3 skill-owned interpreter scripts kept in the repo, withheld from the kit |
| `node scripts/check-env-reads.cjs` | PASS — 138 reads, every row agrees with the code |
| `node scripts/check-no-python.cjs --allow-existing-envs` | PASS — **all 26 checks**, no Python interpreter on PATH |
| `node scripts/check-memory-wiki-residue.cjs` | PASS — 0 hits |
| `node scripts/generate-cli-manual.cjs --check` | PASS — manual matches the catalogue |
| `node scripts/docs-manifest.cjs --check` | PASS after `--write` — 171 artifacts; **0 of 171 reference pages and 0 of 3 index pages** needed re-splicing, so the generated regions were already current |
| `node scripts/harness-inventory.cjs --check` | PASS — "Docs match the inventory" |
| `node scripts/link-checker.cjs .` | PASS — all links valid |
| `bash scripts/check-skill-cross-refs.sh .` | **PASS** — the BASE finding is closed (S6.9) |
| `bash scripts/check-hook-registration.sh` | PASS — 6 hooks |
| `bash scripts/validate-rule-availability.sh` | PASS — 7 rule references resolve |
| `bash tests/{surface-contract,spec-drift,help-skill-contract,changed-files-lint}.test.sh` | PASS — failed: 0 each |
| `tests/journey-validation/check-journey-specs.py` | PASS — 12 journeys frozen, unchanged; `journey-specs.jsonl` diff vs BASE empty |
| `mewkit doctor --hard-gates` | PASS — **26 passed, 5 warnings, 0 failed** (the 7 retired `MEOWKIT_*` names unset, as slice 5) |
| changelog immutability | `git diff de278a5f -- packages/docs/content/docs/changelog` → **empty** |
| integration surface frozen | 0 frontmatter drift over the 11 touched jira/confluence files; the only body edits are the two `workflow-cache-layout.md` pointers |
| skipped-test set vs BASE | **20 → 20**, unchanged; no assertion weakened, no test deleted except the BASE-broken shell test, which was ported first |
| plan-artifact token scan over added lines | **0** — the single grep hit is the pre-existing illustrative `tasks/plans/260610-x/phase-02-*.md` sample in `help/SKILL.md`'s example output, a fictional plan, as slice 5 recorded |
| `any` / unsafe cast / TODO / FIXME in added TypeScript | 0 |
| removed-path grep over `docs/` + `README.md` + `RELEASING.md` | **20 lines, every one deliberate** — the wrong-answer column, the maintainer-only benchmark pages, two dated records, a struck-through history row, the orienting line and a user's own host surface (S6.6) |

## S6.12 File-size accounting

One new file: `.claude/hooks/__tests__/resolve-model.test.cjs` at **101** lines. Six moved files
unchanged in length. One deleted: `tests/resolve-model.test.sh` (95).

| File | BASE | Now | Note |
|---|---|---|---|
| `packages/mewkit/src/kit/__tests__/kit-release-wiring.test.ts` | 200 | **200** | reached 202 with the new assertion and its four-line comment; the comment was cut to two lines rather than letting a file cross 200 |
| `packages/mewkit/src/kit/__tests__/ship-set-completeness.test.ts` | 93 | 96 | |
| `packages/mewkit/src/commands/task-utils.ts` | 150 | 154 | the corrected `readTemplate` comment |
| `packages/mewkit/src/commands/doctor.ts` | 425 | 423 | already over 200 at BASE; **shrank** 2 — the ledger check left with its subject |
| `packages/mewkit/src/cli/command-catalogue.ts` | 392 | 391 | already over 200 at BASE; −1 |
| `packages/mewkit/src/index.ts` | 493 | 492 | already over 200 at BASE; −1 |
| `README.md` | 142 | 138 | |
| `RELEASING.md` | 753 | 751 | already over 200 at BASE; −2 |
| `docs/core/meowkit-rules.md` | 336 | 338 | already over 200 at BASE; +2 |
| `.claude/skills/help/references/cli.md` | 514 | 513 | generated — exempt from the line rule |
| `packages/docs/docs-reference-manifest.json` | 2921 | 2989 | generated — exempt |

**No file crossed 200 because of this slice.**

## S6.13 What is NOT closed

1. **Provider-bundle `session-state/` prose — 55 files, 94 occurrences, left open with the
   measurement** (S6.7). Stale narration, not a broken path: neither bundle's hooks name it.
2. **`CLAUDE.md:102` names `mewkit inventory --substrate`, a verb the CLI does not implement**
   (S6.9). Found by running it. Independent of this sprint and not in any AC, so it is reported
   rather than fixed; the kit prose that pointed at the missing script now names
   `mewkit validate --substrate`, which exists.
3. **`release-manifest.json` is stale at 1272 files / 17 deletions**, by decision (S6.8c) — the
   release pipeline regenerates it from the finished `deletions.json`.
4. **AC-02's "plant a bad `mk:*` reference in a scratch copy" negative control** was run in slice 3,
   not re-run here; this slice only re-ran `check-skill-cross-refs.sh` positively after closing its
   one finding.
5. **AC-07's `/mk:cook` end-to-end run in a throwaway project** is not performed: it needs an
   interactive model session, which this slice cannot drive. Everything mechanical around it is
   verified — both gates with no `tasks/`, lazy directory creation by `task new`, and the full
   87-case golden corpus — so what is missing is the interactive confirmation, named here rather
   than implied.

## S6.14 The brand linter was red at BASE, is less red now, and caught a real regression

`scripts/lint-brand-prose.sh` is **not** in this slice's gate list but **is** in CI (`ci.yml:253`,
`LINT_MODE=diff`), so it was run. It fails at BASE: a `git archive de278a5f` extraction run against
BASE's own copy of the linter (`.claude/scripts/lint-brand-prose.sh`, before slice 1 moved it) exits 1
with **6** violations — `agents/AGENTS_INDEX.md:9`, `skills/benchmark/references/dead-weight-audit-rules.md:95`,
`skills/context-audit/SKILL.md:47` and three in the generated `skills/help/references/cli.md`.

On the finished tree it reported **12**. The seven extra were all slice 4's unshipped-marking prose —
"available only in the MeowKit repository", "(MeowKit repository only…)", "Runs from the MeowKit
repository only." — across `autobuild/references/adaptive-density-matrix.md` (3),
`benchmark/SKILL.md`, `rubric/references/calibration-guide.md`,
`rubric/rubrics/calibration-set/README.md` and `trace-analyze/references/trace-schema.md`. The
disclosure is right and the wording was not: shipped prose may not name the product as its own
subject. Each now says **"this repository"**, which carries the same meaning — not in your install —
with no brand token.

```
scripts/lint-brand-prose.sh   BASE: 6 violations   now: 5
```

The five are the BASE set minus `context-audit/SKILL.md:47`, which S6.9 closed. The remaining five are
left and named: `AGENTS_INDEX.md:9` is inside a GENERATED marker comment, and the three `cli.md` lines
are generated from the command catalogue's own descriptions, so fixing them means changing user-facing
CLI help text — out of this sprint's scope and red at BASE.

Worth recording as a finding rather than a chore: relocating `rubrics/` into `skills/rubric/rubrics/`
(slice 2) moved a file **into** the linter's scan roots, so prose that had always been non-compliant
became visible for the first time. A relocation can turn a dormant violation into a CI failure without
anyone editing the text.

## S6.15 One test failure that was a build race, not a regression

The first full-suite run after the last edits reported
`tests/install/kit-verbs.test.ts` 2 failed with `Error: packages/mewkit/dist is not built; run
npm run build first` at `check-kit-verbs.cjs:82`. Cause: `npm run build` was run in a second shell
while the suite was executing, so `dist/` was absent for the moments that test read it. The file
passes on its own (2 tests), and a clean re-run of the whole suite with no concurrent build is
**298 files / 3372 tests, 0 failed, exit 0**. Recorded because "it was flaky" is the kind of claim
that has to name its cause.

---

# Review round 1 fixes

Round 1's verdict (`tasks/reviews/261101-meowkit-v3-lean-runtime-verdict.md`, FAIL on Correctness, 7.5/10)
raised one blocking defect, its follow-up guard, and six WARN items. This round closes R1, R1-followup/W3,
W1, W2, W6(a) and W6(b), plus the pre-existing stale verb the verdict logged as follow-up 3 at the one
**shipped** site it names. **W4** (projection sync) and **W5** (the pre-existing Gate 2 fail-open) are left
untouched as recorded follow-ups, `gate2-check.cjs:70`'s message text is byte-unchanged, and
`release-manifest.json` is left to the release pipeline (W6(c)).

No commit was made. The verdict file was not edited — the reviewer owns it.

## F1. R1 — the shipped `--tdd` instruction created a retired state root and failed to write the sentinel

| File | Line | Was | Is |
|---|---|---|---|
| `.claude/skills/cook/SKILL.md` | 83 | `mkdir -p .claude/session-state && echo on > .meowkit/state/tdd-mode` | `mkdir -p .meowkit/state && echo on > .meowkit/state/tdd-mode` |
| `.claude/benchmarks/canary/quick/05-tdd-feature-spec.md` | 17 | same line, blockquoted | same fix |

`cook/SKILL.md` is in the ship set (`shipSetFiles` → `includes(".claude/skills/cook/SKILL.md") === true`);
the canary is not (`.claude/benchmarks/` → 0 shipped files), so it is the maintainer-only copy of the same
instruction.

**The whole ship set and the docs were swept for any other instruction of this shape**, not just the two the
verdict named:

```
$ grep -rnE "(mkdir[^&|]*|touch [^&|]*|> *|>> *)(\.claude/cache/|\.claude/hooks/\.logs|session-state)" \
    .claude docs packages/docs/content README.md RELEASING.md | grep -v worktrees | grep -v changelog
.claude/benchmarks/canary/quick/05-tdd-feature-spec.md:17: > mkdir -p .claude/session-state && echo on > …
.claude/skills/cook/SKILL.md:83: mkdir -p .claude/session-state && echo on > …
```

Two hits, both fixed, zero elsewhere. The surviving `session-state` mentions are the three the verdict
already dispositioned as legitimate — `meowkit-paths.cjs`'s comment and `LEGACY_STATE_RELS` (read fallback,
no writer) and `gate2-check.cjs:70`'s message text — plus `bead-template.md:40`'s prose
("`session-state/build-progress.json`"), which the verdict records as stale at BASE and record-only. None of
the four is an instruction to create or write a path, and none was touched.

**Reproduction of the fix, in a `$TMPDIR` project containing only `.meowkit/`:**

```
$ D=$(mktemp -d "$TMPDIR/tddfix.XXXXXX"); mkdir -p "$D/.meowkit"; cd "$D"
$ bash -c 'mkdir -p .meowkit/state && echo on > .meowkit/state/tdd-mode'; echo "EXIT=$?"
EXIT=0
$ find . -mindepth 1 | sort
./.meowkit
./.meowkit/state
./.meowkit/state/tdd-mode
$ cat .meowkit/state/tdd-mode
on
$ find . -name session-state | wc -l
0
```

Exit **0** against the verdict's exit 1; the sentinel exists, so `--tdd` arms strict mode on a fresh install;
and no `session-state` path is created, which is AC-08's Then-clause as written.

## F2. R1-followup / W3 — a committed check now asserts that kit *instructions* write to the right place

New: `packages/mewkit/src/kit/__tests__/retired-state-write-instructions.test.ts` (76 lines), beside the
ship-set assertions it extends and reading the same `helpers/ship-set-view.ts` views.

Two tests. The first exercises a pure line detector against positive and negative controls, so the claim
cannot pass by scanning nothing; the second runs it over the published kit **and** over every tracked file
under `.claude/` (the wider list is why the maintainer canary is covered — the two copies of that
instruction drifted together, which is exactly how R1 reached a shipped file).

Retired roots asserted: `session-state`, `.claude/cache/`, `.claude/hooks/.logs`. Write shapes detected:
`mkdir`, `touch`, `tee` (with flags), and `>`/`>>` redirects. A redirect must have a non-space character
before it, so a Markdown blockquote marker is not misread as one — and a blockquoted `mkdir` still is caught,
which the canary line required. Reading, naming and advising a retired path all remain legal: the negative
controls pin `LEGACY_STATE_RELS`, `gate2-check.cjs:70`'s advice line, `bead-template.md:40`'s prose, and the
corrected instruction itself.

**It bites.** Each probe planted the pre-fix line back into one real file, ran the test, and restored the
file from a scratch copy (no `git` restore was used):

```
$ # pre-fix line planted at .claude/skills/cook/SKILL.md:83
AssertionError: expected [ Array(1) ] to deeply equal []
+   ".claude/skills/cook/SKILL.md:83: mkdir -p .claude/session-state && echo on > .meowkit/state/tdd-mode",
      Tests  1 failed | 1 passed (2)

$ # pre-fix line planted at .claude/benchmarks/canary/quick/05-tdd-feature-spec.md:17
+   ".claude/benchmarks/canary/quick/05-tdd-feature-spec.md:17: > mkdir -p .claude/session-state && echo on > …",
      Tests  1 failed | 1 passed (2)

$ # real tree, both files restored
✓ packages/mewkit/src/kit/__tests__/retired-state-write-instructions.test.ts (2 tests)
      Tests  2 passed (2)
```

The second test also asserts it scanned >900 files, so an empty or mis-filtered file list fails rather than
reporting pass — the phantom-pass pattern the contract's D4 condemns and W1 found reintroduced.

## F3. W1 — the move registry now protects all five of this sprint's moves

Three changes, all in the existing registry and its checker; no second registry was created.

1. **Rule (a)'s pattern widened** — `scripts/check-dangling-rule-refs.cjs:29`:
   `rules/(<names>)\.md` → `rules(?:-conditional)?/(<names>)\.md`. This is what makes the three agile
   entries protective: they are `citedByName`, which exempts them from rule (b) on purpose, and rule (a)
   could not match their old `rules-conditional/` prefix, so they had nil value.
2. **Tombstones added** — `scripts/dangling-rule-refs-data.cjs`, new `RETIRED_PATHS` export (3 entries) for
   the two shapes the `{name, to}` schema cannot express plus the directory form of the third:

   | Retired location | Current location |
   |---|---|
   | `.claude/rubrics/` | `.claude/skills/rubric/rubrics/` |
   | `.claude/workflow.yaml` | `.claude/skills/workflow-orchestrator/workflow.yaml` |
   | `.claude/rules-conditional/` | `.claude/skills/agent-detector/references/` |

3. **New rule (d)** in the checker: a retired location may be named only on a line that also names its
   current location — a mapping line (a canonical-path table, the destination table, a "do not use" column)
   is a reference a reader can follow, not a dangling one. That is what keeps
   `docs/core/meowkit-rules.md:21` legal without exempting the whole file.

Rule (d) found one live stale reference on its first run, which is the answer to the verdict's "the check is
genuinely green on the real tree": it was green because it was not looking.

```
$ node scripts/check-dangling-rule-refs.cjs .
  scripts/validate-rule-availability.sh:77: (d) retired location: .claude/rules-conditional/
FAIL: 1 dangling-reference violation(s).
```

That comment claimed the conditional-rule tree "was merged into `.claude/rules/` in v2.8.4"; it now names
`.claude/skills/agent-detector/references/`, which is where that content actually lives. One exemption was
added for `docs/architecture/adr/260511-agile-scrum-conditional-rule-layer.md` — a dated decision record
whose own header already says its paths are the ones that existed then.

**All four of the verdict's planted references are now caught (4/4).** Each probe wrote one untracked file
(`.claude/skills/cook/references/zz-reference-probe.md`), ran the check, and the file was removed afterwards:

| Planted old-path reference | Result |
|---|---|
| `.claude/capability-bootstrap.md` | caught — rule (b), "bare `capability-bootstrap.md` — not its new path", exit 1 |
| `.claude/rubrics/composition-presets/cli-tool.md` | caught — `(d) retired location: .claude/rubrics/`, exit 1 |
| `.claude/workflow.yaml` | caught — `(d) retired location: .claude/workflow.yaml`, exit 1 |
| `.claude/rules-conditional/agile-story-gates.md` | caught twice — `(a) old rule path: rules-conditional/agile-story-gates.md` **and** `(d)`, exit 1 |

Clean real tree afterwards:

```
$ node scripts/check-dangling-rule-refs.cjs .
dangling-rule-refs: 8657 file(s) scanned under /Users/sangnguyen/Desktop/MeowKit
OK: no dangling references; all 22 destinations are loaded, 3 retired locations unreferenced.

$ bash scripts/validate-rule-availability.sh
OK: 7 rule reference(s) all resolve to files on disk
```

## F4. W2 — the three shipped citations of the withheld audit rules are qualified

Each now carries the qualifier slice 4 used for the same path at
`adaptive-density-matrix.md:83` ("this repository only"):

| File | Line | Now reads |
|---|---|---|
| `.claude/skills/autobuild/references/adaptive-density-matrix.md` | 68 | `… per \`…/dead-weight-audit-rules.md\` Rule 6 (this repository only)` |
| `.claude/skills/cook/references/harness-rules.md` | 60 | `… are in \`…/dead-weight-audit-rules.md\` (this repository only — an installed kit does not carry it, and the audit is a maintainer procedure)` |
| `.claude/skills/advise/references/advice-supervision-rules.md` | 403 | `(\`…/dead-weight-audit-rules.md\` Rule 6 — this repository only)` |

`harness-rules.md:60` got the longer form because it is the one the verdict flagged as load-bearing prose
("the procedure and thresholds *are in* that path"), so the qualifier has to say what an installed reader
should conclude. The other citations of that path are all inside `.claude/benchmarks/` or
`.claude/skills/benchmark/`, which do not ship, and `docs/governance/rules-index.md` already labels it
maintainer-only. Registry entry unchanged: still `shipped: false`.

## F5. The one shipped site naming a verb that does not exist

`.claude/skills/agent-detector/references/context-budget-rules.md:64` named `inventory --substrate`. There
is no `inventory` command; the real verb is `mewkit validate --substrate`, verified by running the built CLI
rather than by reading the catalogue:

```
$ node packages/mewkit/dist/index.js inventory --substrate
Unknown command: inventory
$ node packages/mewkit/dist/index.js validate --substrate
  [PASS] Substrate view in sync
  [PASS] Substrate coverage
2 passed, 1 warnings      (EXIT=0)
```

The line now reads `` the substrate view (`mewkit validate --substrate`) ``. Root `CLAUDE.md` was **not**
edited, and the other stale occurrences the verdict lists (`packages/docs/.../telemetry.mdx:63-65`, the
changelog) are left as recorded follow-ups — this round touched the shipped site only.

## F6. W6 — the record

- **(a) This file's header and §4.** The header no longer claims "PRE-IMPLEMENTATION SIZING + BLOCKED"; it
  states that slices 1–6 ran, that source was edited, and how to read the four parts of the record, keeping
  §1's stop as the historical note it is. §4's eleven "NOT RUN" rows are replaced with the measured result
  and an evidence pointer each. §5's "Files changed: None" is corrected in place rather than deleted.
- **(b) `docs/operations/docs-references-inventory.md`.** `:56` and `:57` attributed emission to
  `commands/mk/docs-sync.md` and `commands/mk/retro.md`, both gone with the command surface; they now name
  `mk:document-release` and `mk:retro`, the skills that own those outputs per the disposition table (§2.2).
  The `:4` header's grep no longer sweeps `commands`, `scripts` or `modes`, and says when it was re-scoped.
- **(c) `release-manifest.json`** is deliberately untouched — the release pipeline regenerates it, and it is
  the verdict's accepted deviation 6.

`packages/docs/docs-reference-manifest.json` was regenerated because the `cook` SKILL.md edit changes its
`sourceHash`: `docs-manifest.cjs --check` reported exactly `changed skill/mk:cook — sourceHash` before the
write and `manifest and 171 reference page(s) match the live .claude/ tree` after it.

## F7. Gate results for the fix round

| Gate | Result |
|---|---|
| `npm run build` | PASS |
| `npm run lint` | PASS — **0 errors**, 3 warnings, all three pre-existing at BASE |
| `npm run typecheck` | PASS |
| `npm test` | PASS — **299 files / 3374 tests** (298/3372 at the review's measurement, +1 file / +2 tests for the new guard) |
| `node --test .claude/hooks/__tests__/*.test.cjs` | PASS — 47/47 |
| golden replay (`tests/hooks/golden-replay.test.ts`) | PASS — **87/87**, no case re-recorded |
| `node scripts/check-dangling-rule-refs.cjs .` | PASS — 8657 files, 22 destinations loaded, 3 retired locations unreferenced |
| `node scripts/check-rule-survival.cjs .` | PASS — 61 pinned items over 7 always-on files |
| `node scripts/check-always-on-budget.cjs .` | PASS — **25 417 B** of 25 600, 183 B headroom, ≤ the 25 501 B pin |
| `bash scripts/check-skill-cross-refs.sh` | PASS — all skill and local entrypoint refs resolve |
| `node scripts/check-kit-verbs.cjs .` | PASS — 293 references over 24 commands |
| `node scripts/docs-manifest.cjs --check` | PASS — 171 artifacts match the live tree (after the regenerate above) |
| `node scripts/generate-cli-manual.cjs --check` | PASS — `cli.md` matches the command catalogue |
| `node scripts/link-checker.cjs` | PASS — 268 markdown files, all links valid |
| `node scripts/check-no-python.cjs . --allow-existing-envs` | PASS — 26 checks, no interpreter on PATH |
| `node scripts/check-node-only-runtime.cjs .` | PASS |
| `mewkit validate --packs/--gates/--workflow/--frontmatter/--docs-refs` | PASS — 1 / 1 / 6 (no drift) / 1 / 1 |
| `bash scripts/validate-rule-availability.sh` | PASS — 7 rule references resolve |

## F8. Files changed in this round

| File | Change |
|---|---|
| `.claude/skills/cook/SKILL.md` | `:83` — `mkdir` target corrected |
| `.claude/benchmarks/canary/quick/05-tdd-feature-spec.md` | `:17` — same correction |
| `packages/mewkit/src/kit/__tests__/retired-state-write-instructions.test.ts` | **new**, 76 lines — the instruction-write guard |
| `scripts/check-dangling-rule-refs.cjs` | widened rule (a); new rule (d); header and OK line updated |
| `scripts/dangling-rule-refs-data.cjs` | new `RETIRED_PATHS` (3); one exemption; `citedByName` comment corrected |
| `scripts/validate-rule-availability.sh` | `:76-79` — stale comment repointed at the current location |
| `.claude/skills/autobuild/references/adaptive-density-matrix.md` | `:68` — qualifier |
| `.claude/skills/cook/references/harness-rules.md` | `:60` — qualifier |
| `.claude/skills/advise/references/advice-supervision-rules.md` | `:403` — qualifier |
| `.claude/skills/agent-detector/references/context-budget-rules.md` | `:64` — real verb |
| `docs/operations/docs-references-inventory.md` | `:4`, `:56`, `:57` — emitters and scan scope |
| `packages/docs/docs-reference-manifest.json` | regenerated (one `sourceHash`) |
| this file | header, §4, §5 and this section |

Not changed, on purpose: the verdict file (reviewer-owned), `release-manifest.json`, `gate2-check.cjs:70`,
anything behind W4 or W5, root `CLAUDE.md`, and every golden fixture.
