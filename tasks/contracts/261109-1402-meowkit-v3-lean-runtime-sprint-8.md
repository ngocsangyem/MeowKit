---
contract_schema_version: 1.0.0
task: meowkit-v3-lean-runtime
sprint: 8
plan_ref: tasks/plans/261101-meowkit-v3-lean-runtime/plan.md
rubric_preset: cli-tool
status: negotiating
generator_signed: 0f4740db0dd87bae973d6375c62cef98c2df8da4
evaluator_signed: null
rounds: 2
created: 261109-1402
---

# Sprint 8 Contract — Kit shape: two roots, host-native primitives, domain content inside its skill

Testable translation of `phase-07-kit-shape.md` Requirements 1–5, 8 (partly) and 9, plus the shape half of
its Success Criteria, bounded by `plan.md` Decisions 1–7 and Constraints and by the sprint-3 through
sprint-7 decisions still in force. **Round 2 splits the phase in two** (D15): this contract settles the kit's
**shape and removals**; the metadata budget (Requirement 7), the integration description rewrite with its
routing specs (Requirement 6) and the SubagentStart spike (Requirement 8) move to a **sprint 9** contract
proposed after this one lands and measured against the post-sprint-8 inventory. **Every number, path and
line citation below was measured at BASE.** The phase file and `research/cli-command-usage-evidence.md` §6
were written against v2.15, before the rule diet, the node-only hook port, `.meowkit/config.yaml`, the kit
artifact, lazy Python, the memory diet and the CLI surface shipped — so nine of their figures are stale at
BASE. Where the phase file and the tree disagree the tree wins and the disagreement is recorded here and in
the Negotiation Log.

## Pinned baseline

BASE = `de278a5ffab2d43b366951d091d9687e2366895a` — "feat(cli): project launcher, strict dispatch and a
generated CLI manual", the sprint-7 commit and the current `HEAD` of `feat/v3-lean-runtime`. Every "at BASE"
claim and every `git diff BASE` resolves against that commit.

Measured at BASE:

- **Shape.** The shipped kit is computed, not guessed: `scripts/kit-ship-set.cjs` walks the archive roots
  and applies `base.exclude` from `.meowkit/pack-manifest.json`. It yields **1228** files over four roots —
  `.claude`, `tasks`, `release-manifest.json` and two named `.meowkit` files. The shipped `.claude/` has
  **17** top-level entries: `agents/`, `hooks/`, `rules/`, `skills/`, `settings.json`, `statusline.cjs`
  (the six the target tree keeps) plus `agent-memory/`, `benchmarks/`, `capability-bootstrap.md`,
  `commands/`, `harness-substrate.md`, `modes/`, `rubrics/`, `rules-conditional/`, `schemas/`, `scripts/`
  and `workflow.yaml`. The repository's own `.claude/` has **25** entries; the other eight
  (`cache/`, `logs/`, `memory/`, `metadata.json`, `settings.json.bak`, `worktrees/`, `.brand-allowlist.txt`
  and the brand lint script) are already excluded from the ship set, so §6's "21 entries" is neither the
  repo count nor the shipped count today. Six of the eleven departing entries are **declared** base content:
  `agent-memory/**`, `schemas/**`, `modes/**`, `rubrics/**` and `rules-conditional/**` in `base.globs`
  (`pack-manifest.json:22-30`) and `workflow.yaml` in `base.files`, so removing a file is not enough on its
  own. `README.md:9` carries a counts banner ("125 skills · 42 agents · **27 commands** · **7 modes** ·
  7 rules · **5 conditional rules** · 27 hook scripts") and `README.md:107` a tree listing
  ("`modes/` 7 behavioral modes"); `RELEASING.md:173` carries a `modes/*` authoring row. All three describe
  the shipped shape and all three go stale in this sprint.
- **Always-listed bytes — corrected in round 2.** `scripts/check-always-on-budget.cjs` measures
  `.claude/rules/**.md` only: **25 501 B** against its 25 600-byte literal — **99 bytes of headroom**. The
  metadata half, re-measured by the evaluator with a YAML parse of each ship-set file's frontmatter and
  `Buffer.byteLength` over the scalar values, is **larger than round 1 claimed**: **125** shipped `SKILL.md`
  → **71 780 B** (avg **574**), **42** shipped agents → **14 311 B** (avg **341**). **Always-listed total =
  111 592 B**, not the 94 060 B round 1 stated; outside-rules is **86 091 B**, not 68 559 B. Round 1's
  54 168 B skill figure is reproduced by **no** field subset (`name`+`description` 47 531;
  `description` alone 45 752; `description`+`when_to_use` 70 001; `when_to_use` alone 24 249; all three
  71 780) and every one of the 125 files has a `when_to_use`, so it was an extraction artefact, not a
  missing field. The budget gate itself is **deferred to sprint 9** (D7, D15); this baseline exists so
  sprint 9 starts from the right number and the right extractor.
- **Integrations (sprint 9's subject, recorded here).** 24 integration skills and 22 integration agents,
  measured by the evaluator's extractor at **12 167 B** and **6 574 B** (round 1 said 12 407 and 6 636 —
  the same files, a different extractor).
- **Commands.** `.claude/commands/mk/` holds **27** files. **11** share a name with a skill (`advise`,
  `autobuild`, `context-audit`, `cook`, `docs-init`, `fix`, `help`, `orchestrate`, `retro`, `review`,
  `ship`); **16** do not (`arch`, `audit`, `breakdown`, `budget`, `canary`, `confluence-setup`, `delegate`,
  `design`, `docs-sync`, `meow`, `plan`, `spawn`, `status`, `test`, `upgrade`, `validate`).
- **Command references, by exact token and with scope.** **10** `/mk:` targets resolve to a command and to
  no skill — `arch`, `audit`, `breakdown`, `budget`, `confluence-setup`, `delegate`, `design`, `plan`,
  `status`, `validate`. Matching the exact token (so `/mk:plan` does not match `/mk:plan-creator`), files
  naming **any** of the ten are **30** in the shipped kit, **60** git-tracked outside `tasks/` and
  `.claude/worktrees/`, **21** of those 60 under `docs/` + `packages/docs/content/`. `/mk:plan` alone is
  **11** kit files, **32** repo files, **14** docs files. Round 1's "38 files / 39 for `/mk:plan`" was
  scopeless and internally impossible; the measured scopes above replace it. `/mk:audit` appears in an
  always-on safety rule (`rules/security-rules.md:26`). Two names resolve to neither a skill nor a command
  and both are non-references: a prose placeholder (`commands/mk/meow.md:24`, `[/mk:command]`) and a
  truncated stem in `commands/mk/confluence-setup.md`. So **BASE has zero genuinely dangling `/mk:`
  references**, and `scripts/check-skill-cross-refs.sh:17` is what keeps it that way — it resolves `mk:*`
  against a skill inventory **or** a command inventory, and it has a zero-match guard on skills only.
- **Command readers in the engine.** `core/check-packs.ts:52-54` requires `commands/mk/plan.md`,
  `commands/mk/upgrade.md` and `commands/mk/validate.md` in `SAFETY_PATHS`;
  `.meowkit/pack-manifest.json` `base.commands` declares `plan, upgrade, validate, status, cook, fix`;
  `core/check-gate-authority.ts:246-259` reads `.claude/commands/mk/` for same-name command/skill prose
  drift over `GOVERNED_DISPATCHERS` = {`fix`, `cook`, `plan`, `advise`}. With the directory gone that drift
  check has no subject and returns an empty list — a check that passes because it reads nothing.
- **Modes: no load path, named in eight places.** `.claude/modes/` holds 7 files, each headed "Activate
  with: `mode: <x>` in task context". **No hook, handler, skill, agent, rule, command, CLI command or CI
  job reads a mode file.** `MEOWKIT_MODE` does not exist as an env name (the matches are all
  `MEOWKIT_MODEL_HINT`, a different thing). Round 1's "named in exactly two places" was low by six: the
  eight are `rules/gate-rules.md:69`, the `check-gate-authority` test fixture, the `base.globs` entry
  `.meowkit/pack-manifest.json:27`, `README.md:9`, `README.md:107`, `RELEASING.md:173`,
  `docs/maintainer/docs-reference-contract.md:8` and `docs/operations/docs-references-inventory.md:79`.
  **None is a load path**, so the zero-reader finding stands unchanged — but each is a file an AC must edit.
  `checkGateAuthority` scans the whole `.claude` tree (`check-gate-authority.ts:385`), not a mode list, so
  its power does not depend on the directory existing.
- **Scripts.** The shipped kit carries **22** `.claude/scripts/` entries, including **5** `.py` files and
  **1** `.sh` file — `checklist.py`, `cost-report.py`, `security-scan.py`, `validate-docs.py`, `validate.py`
  and `rules-audit.sh`. **8 of the 9** `.claude/scripts/bin/` entries are `#!/usr/bin/env bash` with **no
  extension**, so an extension-based assertion misses every shell file in the directory the requirement is
  aimed at. The nine are **3 duplicated jobs** (`meowkit-` / `workflow-` × `diff-scope`, `repo-mode`,
  `slug`) plus **3 unpaired** (`setup-workflow`, `workflow-config`, `workflow-review-log`) — round 1's "five
  jobs twice over" was arithmetically impossible. Zero-caller scripts (grep over `.claude`,
  `packages/mewkit/src`, `scripts`, `.github`, `tests`, excluding each file's own definition): **4**, not
  §6's six — `checklist.py`, `cost-report.py`, `rules-audit.sh`, `validate-docs.py`. The three §6 names that
  are already gone are `memory-migrator.cjs`, `memory-topic-file-migrator.cjs` and `verify-env-loading.sh`.
  The rest have real callers: `injection-audit.cjs` **16** (including the always-on
  `rules/injection-rules.md:56` and `rules/gate-rules.md:95`, and `commands/doctor-checks.ts`),
  `skill-python.cjs` **21**, `validate-workflow-evidence.cjs` **9** (two of them safety-hook libraries),
  `validate-review-coverage.cjs` **4** (one a safety-hook library), `security-scan.py` **6**,
  `validate.py` **5**.
- **Python elsewhere in the kit is retained, and is the majority.** The shipped kit carries **80**
  `.py`/`.sh` files under `.claude/`, of which only **6** are `.claude/scripts/` members. The other **74**
  are skill-owned scripts (`multimodal` **14**, `web-to-markdown` **9**, `confluence` **5**, `story-sizer`
  **5**, `tech-graph` **5**, `agent-browser`/`benchmark`/`context-audit`/`evaluate`/`jira` **3** each, 19
  more elsewhere) — exactly what `skill-python.cjs` exists to run. `scripts/check-no-python.cjs` already
  documents the real invariant as "the kit's **core runtime** needs no Python", not "the kit ships no
  Python", and AC-11 measures changed `.py`/`.sh` files, which presumes they survive.
- **Domain content and its readers.** `rubrics/` → `skills/rubric/`, `skills/evaluate/` (incl.
  `scripts/recompute-score.py`), `skills/review/references/design-review.md`, plus this contract's own
  `rubric_preset`. `rules-conditional/` → **20+** files including `agents/athena.md`,
  `rules/gate-rules.md:69` and six skills. `workflow.yaml` → `core/check-workflow-drift.ts:99`, the
  `validate --workflow` flag (`cli/command-catalogue.ts:248`), four skill files, and the
  `Canonical source: .claude/workflow.yaml` pointer comment that `check-workflow-drift.ts:208` validates —
  present in exactly **two always-on rules** (`rules/meowkit-core.md:3`, `rules/gate-rules.md:3`) and four
  skill files. `capability-bootstrap.md` → `hooks/handlers/capability-bootstrap.cjs:16` (as
  `__dirname/../../capability-bootstrap.md`), `core/bootstrap.ts`, and two golden cases
  (`capabilitybootstrap-file-{present,absent}.json`).
- **Maintainer-only content that still ships.** `benchmarks/` (**7** files, read only by
  `skills/benchmark/scripts/*`), `schemas/` (**2** files: `skill-schema.json`, read by
  `core/check-skill-frontmatter.ts:90` from `<root>/.claude/schemas/` with a **fatal** "No schema at …"
  when absent; and `harness-metadata-schema.json`, read by `core/build-inventory.ts:396,424`),
  `harness-substrate.md` (**0** kit readers; read by `core/substrate.ts` and `maintainer/inventory.ts`),
  and `agent-memory/` — **3 files of this repository's own evaluator memory**, including
  `project_kit_delivery_constrains_trust.md`, published to every user today. `.claude/eval/*`,
  `.brand-allowlist.txt` and `scripts/lint-brand-prose.sh` are **already** excluded.
- **Root scaffolding — recomposed in round 2.** `tasks/` is an archive root carrying **13** shipped files:
  **7** `.gitkeep` markers (`active`, `autobuild-runs`, `backlog`, `contracts`, `guidelines`, `plans`,
  `reviews`), **5** `tasks/templates/*.md` (`bead-template.md`, `plan-phase.md`, `plan-quick.md`,
  `plan-template.md`, `pm-status-template.md`) and **1** `tasks/jira-workflows/README.md`. Round 1 said
  8 + 4 + 1, which left `pm-status-template.md` unaccounted for while the 13-file total still matched.
  `tasks/templates` is named by **8** kit files. `commands/init.ts` contains **zero** occurrences of
  `tasks`, so the directories arrive **because the artifact carries them**. `reinstall-empty-dirs` is a
  **dead option**: parsed (`commands/migrate.ts:74`), typed (`migrate/types.ts:138`) and conflict-checked
  against `--respect-deletions` (`migrate/migrate-mode-resolver.ts:23`), and **consumed by no migration
  logic at all** — it never had a `tasks/` implementation to lose.
- **Runtime state.** **19** hook files name `session-state`, in two inconsistent forms:
  `hooks/lib/shared-state.cjs:7-8` joins it to `CLAUDE_PROJECT_DIR` — **the project root**, the exact
  defect Requirement 9 names — as do `lib/checkpoint-utils.cjs:11`, `lib/resolve-model.cjs:16`,
  `lib/trace-log.cjs:32`, `lib/gate2-verdict-lookup.cjs:32,40` and seven handlers; while
  `lib/tdd-detect.cjs:28` and `lib/gate2-structural-checks.cjs:60-61` use `.claude/session-state/`.
  **Two of those are safety-hook libraries** (`gate2-check.cjs:66`, `gate2-structural-checks.cjs`), so the
  move touches Gate 2's evidence path. `lib/meowkit-paths.cjs` already exposes `sessionStateDir()` →
  `.meowkit/state` and is mirrored by `state/meowkit-state-paths.ts`, but only **6** files use it.
  `.claude/skills/.venv` is **absent** and `.meowkit/envs/` exists, so phase 05 already closed that half.
  The web-fetch cache is still `.claude/cache/web-fetches/`
  (`skills/web-to-markdown/scripts/persist_fetch.py:55`), matched by the privacy manifest regex
  `privacy-block.cjs:46` (`FETCH_ARTIFACT`), named in **~20** prose lines across `skills/web-to-markdown/`,
  and asserted by the golden case `privacy-read-webfetch-manifest.json`, which was recorded on the v2.15
  bash hook and expects exit **2** with `@@PRIVACY_BLOCK@@` for the old path.
- **Rule-survival coverage has a hole over the one safety clause this sprint edits.**
  `scripts/check-rule-survival.cjs` reads its needles from `scripts/rule-survival-oracle.cjs`, whose
  `ORACLE` is the 11 injection headings, the **12** security blocked-pattern table rows, the 9 gate
  conditions, the A1 status block and table, the 6 core-behaviour headings and 15 development phrases. The
  Enforcement prose at `rules/security-rules.md:26` — "**Reviewing existing code** (`/mk:review`,
  `/mk:audit`): flag as **WARN**, document it in the verdict, do not auto-fix" — is **not** a needle, and it
  is the one always-on safety-rule sentence AC-02 rewrites.
- **Docs.** **38** files name a path this sprint relocates or removes — the governing list is the
  Definitions' **relocated path** set, which includes `agent-memory/`: **13** under `docs/` and **25** under
  `packages/docs/content/`, **two** of them the changelog pages, so **36** are editable. Round 1's 37/35
  were correct for a narrower list that omitted `agent-memory/`.
- **Projections.** The codex projection mirrors `skills`, `agents`, `hooks`, `hooks.json`, `rules`,
  `scripts`; the cursor projection mirrors `skills`. Neither carries `commands/`, `modes/`, `rubrics/` or
  `rules-conditional/`, so a projection regenerating to a no-op is a real check and not a tautology.
- **Move registry.** `scripts/dangling-rule-refs-data.cjs` already records 19 earlier moves as
  `{name, to, inlined?, shipped?}` and is read by `scripts/check-dangling-rule-refs.cjs`. One entry,
  `dead-weight-audit-rules → .claude/skills/benchmark/references/`, points **into** a skill this sprint
  takes out of the shipped kit.

## Decisions (user standing directive 261101: take the recommended option)

Fifteen points where the phase is ambiguous, or is contradicted by the tree. The user's standing
instruction for this plan is to take the recommended option, so D1–D15 are DECIDED, not proposed.
**D2, D3, D5, D6, D8, D12 and D15 are marked `[CHALLENGE]`** — each narrows a phase requirement, reverses a
reserved decision, or rests on a measurement the phase file predates. **D7, D10 and D13 are retained as
DEFERRAL RECORDS**: their positions are decided, but the criteria that test them move to sprint 9 (D15).
Decision numbers are stable across rounds; round 2 replaces text in place and deletes no number.

- **D1 The shipped kit is the subject of every shape claim, and `scripts/kit-ship-set.cjs` is the one
  answer to what it contains.** The phase's "`.claude/` top level ≤ 8 entries" is measured on the
  **published** tree, not on this repository, which legitimately carries local state the ship set already
  excludes. Eleven of the 17 shipped entries leave; six remain (`agents/`, `hooks/`, `rules/`, `skills/`,
  `settings.json`, `statusline.cjs`), two under the ceiling. Removal is by **deletion** where the content
  is dead and by **`base.exclude`** where in-repo tooling still reads the file (the user's standing
  preference: prefer exclusion over moving a file a maintainer tool still reads). No entry may return via a
  second path: six of the eleven are declared in `base.globs` or `base.files`, so those declarations are
  updated in the same change and the pack checks and the archive cannot disagree.
- **D2 `[CHALLENGE]` `modes/` is deleted and no `output-styles/` directory is created.** The phase asks to
  "pick one: migrate surviving modes to native output-styles, or delete the dir", and the target tree
  reserves `output-styles/` for survivors. The load-path check the phase requires as the precondition
  returns **zero readers for all seven modes** — no hook, skill, agent, rule, command, CLI path or CI job
  reads a mode file, and there is no `MEOWKIT_MODE` env name. A migration therefore has no subject: an
  output-style ported from a file nothing loads would ship new always-listed bytes for behavior no path has
  ever selected. DECIDED: delete the directory, create no `output-styles/`, and keep the kit at six
  top-level entries. The cost accepted and stated: `fast` and `strict` read as if they were live
  behavior-level switches, and some users may have been reading them by hand; the release notes name the
  deletion, and the two names that do correspond to live behavior (`--fast` planning, `--tdd` strict mode)
  are already owned by the skills that implement them. The reviewer path list at `rules/gate-rules.md:69`
  drops both `.claude/modes/` and `.claude/rules-conditional/` — `checkGateAuthority` scans the whole
  `.claude` tree regardless, so the standing item loses no reach.
- **D3 `[CHALLENGE]` Every one of the 27 commands is dispositioned from a closed set, and at most four of
  the sixteen become skills.** The phase says "keep as a skill only if it has a distinct job; otherwise
  delete". DECIDED: the 11 same-name duplicates are deleted outright, and each of the other 16 takes exactly
  one disposition — `delete-duplicate`, `delete-and-rewrite-references` (a skill or a CLI verb already does
  the whole job), `fold-into-existing-skill`, or `promote-to-skill` — recorded in a committed disposition
  table naming the target for each. Ten are settled by measurement because a skill or verb already owns the
  job: `audit`→`mk:cso`, `canary`→`mk:ship`, `plan`→`mk:plan-creator`, `test`→`mk:testing`,
  `validate`→`mk:lint-and-validate`, `docs-sync`→`mk:document-release`, `meow`→`mk:agent-detector`,
  `spawn`→`mk:team-config`, `upgrade`→the `mewkit upgrade` verb, `budget`→the `mewkit budget` verb plus
  `mk:context-audit`; and `confluence-setup` folds into the `mk:confluence` hub, which Requirement 6 already
  makes the carrier of routing detail. The remaining five (`arch`, `breakdown`, `delegate`, `design`,
  `status`) are judged in the table, and **at most four of the sixteen may become new skills** — a cap,
  because every promotion adds a slash-menu entry and adds always-listed metadata that **sprint 9's budget
  has to pay for**, which is exactly why the cap stays here even though the budget gate moved (D7, D15).
  This is a `[CHALLENGE]` because it converts the phase's open "keep if distinct" into a bounded, enumerated
  decision, and because `/mk:plan` is rewritten across the measured scopes rather than preserved as a name:
  a dispatcher whose entire body delegates to `mk:plan-creator` is the duplicate-menu-entry defect the phase
  exists to remove, and leaving the name alive as a skill would re-create it under a new roof.
- **D4 `SAFETY_PATHS` entries are renamed to the surviving path, never dropped, and the vacated
  command-drift check goes with its subject.** `check-packs.ts:52-54`'s three command paths become the
  paths of whatever each disposition names, so the base safety invariant keeps the same number of entries.
  `pairedCommands` (`check-gate-authority.ts:246`) and `GOVERNED_DISPATCHERS` are **removed** rather than
  left to read an absent directory: a check whose inventory is empty reports pass while verifying nothing,
  which is worse than no check because it looks like coverage. The prose-drift concern it encoded is
  structurally gone — with no commands there is no command/skill pair to drift. `check-skill-cross-refs.sh`
  likewise loses its command-inventory branch, so a `mk:*` reference resolves against skills or fails.
- **D5 `[CHALLENGE]` Maintainer-only content leaves the shipped kit by exclusion, except
  `skill-schema.json`, which moves into the CLI package.** The phase says `benchmarks/`,
  `skills/benchmark/`, `eval/`, `schemas/`, `harness-substrate.md` and `.brand-allowlist.txt` go to "source
  repo only". For five of the six, exclusion is the correct mechanism and no file moves — in-repo tooling
  reads them at their current paths, and the user's standing preference is exclusion over relocation in
  exactly that case. `schemas/skill-schema.json` is the exception, measured:
  `core/check-skill-frontmatter.ts:90` reads it from `<root>/.claude/schemas/` and returns a **fatal** when
  it is absent, so excluding it would make `mewkit validate --frontmatter` fatal in every installed project.
  DECIDED: the schema is engine knowledge, not kit content — it ships **inside the CLI package** and the
  validator reads it from there, with no second copy anywhere. `harness-metadata-schema.json` needs no such
  treatment: its only reader, `build-inventory.ts`, is already maintainer-side. **`agent-memory/` is added
  to the exclusions, which the phase does not mention** — three files of this repository's own evaluator
  memory are published to every user today, which is both noise and a disclosure the memory-diet decision
  (`plan.md` Decision 7) never sanctioned. The cost accepted, and confirmed by the orchestrator as
  intended: an installed project loses `/mk:benchmark`, so every kit reference to it, and the
  `dead-weight-audit-rules` entry in the move registry, must be marked unshipped rather than silently
  dangling.
- **D6 `[CHALLENGE]` Each `.claude/scripts/` entry ends at one of four destinations, and the no-Python
  property is stated by **shebang** over the three paths the requirement owns — not by extension over the
  whole kit.** Destinations per Requirement 5: `hooks/lib/` when a hook calls it, the owning skill's
  `scripts/` when a skill calls it, the repository when only CI or a maintainer calls it, deleted when
  nothing calls it. The **4** zero-caller scripts are deleted. `injection-audit.cjs` and its two library
  files are hook-adjacent safety tooling named by two always-on rules, so they land in `hooks/` and both
  rule texts are updated in the same change. `skill-python.cjs` has 21 callers and is the lazy-Python
  entrypoint, so it lands beside the hooks that own the envs. The `bin/` duplication — 3 duplicated jobs
  plus 3 unpaired entries — is resolved to **one** name per job. **Round 2 corrects round 1's "zero `.py`
  and `.sh` anywhere under `.claude/`":** that clause was contradicted by the tree and by this decision's
  own retention of `skill-python.cjs`. The kit ships **80** such files, only **6** of them under
  `.claude/scripts/`; the other **74** are skill-owned scripts that `skill-python.cjs` exists to run, and
  `check-no-python.cjs`'s documented invariant is that the kit's **core runtime** needs no Python, not that
  the kit ships none. DECIDED: the property is **zero `.py`/`.sh` files and zero non-Node shebangs under
  `.claude/scripts/`, `.claude/scripts/bin/` and `.claude/hooks/`**, asserted by reading the first line of
  every file in those three trees — because **8 of the 9** `bin/` entries are `#!/usr/bin/env bash` with no
  extension and an extension check would miss every one of them. Whole-tree zero-Python is explicitly
  **not** decided here: it would reverse the lazy-Python decision for 74 files and is a different sprint.
- **D7 `[CHALLENGE] DEFERRED TO SPRINT 9 — decided position recorded.** The metadata budget is ONE
  CI-enforced always-listed total of **70 000 bytes decimal**, measured by extending the existing
  `check-always-on-budget.cjs`; the phase's per-item caps are reported, not gates. The decided reasoning
  stands: a second enforced number is a second answer to one question, and per-item caps enforced alongside
  a total mean a legitimate 300-byte description fails CI while the total has headroom, so the script prints
  every item descending by size instead. **70 000 and not 71 680** — the orchestrator confirmed the decimal
  reading of the phase's own arithmetic (25 600 B written as "25.6 KB"), and no rounding to 70 KiB is
  available. The numbers sprint 9 inherits, corrected in round 2: the always-listed total at BASE is
  **111 592 B** (rules 25 501 + skills 71 780 + agents 14 311), not 94 060, so the cut is **≥41 592 B
  (37 %)**, not ≥24 060 (26 %); with the rules subtotal pinned at **≤25 501 B** the metadata must come down
  to **≤44 499 B** across **124** shipped skills (after AC-05 removes `skills/benchmark/`) and 42 agents —
  roughly **308 B per skill** at 150 B per agent, i.e. a rewrite of essentially all **166** metadata blocks,
  not a trim of the worst offenders. The phase's caps re-derived at the measured counts still sum to
  **65 780**, so the gate remains achievable. Sprint 9 must also measure with the **named extractor** in
  the Definitions, because three plausible extractors give three different totals.
- **D8 `[CHALLENGE]` `workflow.yaml` moves into `skills/workflow-orchestrator/`, and the canonical pointer
  comment is shortened so the always-on budget does not regress.** The phase lists the move; the
  measurement is that the destination path is 25 bytes longer than the source and the pointer appears in
  two always-on rules against 99 bytes of headroom, so a literal move spends half the remaining budget on a
  comment. DECIDED: move the file, update `check-workflow-drift.ts`'s read path and its `canonicalPointer`
  constant together, and shorten the pointer form so the two rule files do not grow. This is a
  `[CHALLENGE]` because it changes a string that a committed drift check compares exactly, in a file whose
  budget has 99 bytes of slack — if the shortened form cannot satisfy both the check and the budget, the
  move stops and the contract is amended rather than the budget quietly raised.
- **D9 Every move is recorded in the existing move registry, and no second registry is created.**
  `scripts/dangling-rule-refs-data.cjs` already carries 19 entries as `{name, to, inlined?, shipped?}` and
  is already in CI. This sprint's moves are appended there, `dead-weight-audit-rules` is marked
  `shipped: false` because its destination skill leaves the shipped kit, and `check-dangling-rule-refs.cjs`
  is unchanged in shape.
- **D10 DEFERRED TO SPRINT 9 — decided position recorded.** Integrations stay in the default install and
  their metadata shrinks by rewriting, never by removal. `plan.md` Decision 6 is user-confirmed, so no
  integration skill, agent or hub moves to a pack or flips to `default_enabled: false` beyond what
  `external-service` already sets; each leaf gets a one-line description naming its hub (`mk:jira` /
  `mk:confluence`) and its verb set, and the hub carries the routing detail. Sprint 9 owns the rewrite, the
  **≥6** Jira/Confluence routing cases, and the visible raising of `check-journey-specs.py`'s frozen count
  and `j01…j12` id set. **This sprint touches no integration description and adds no journey spec**, so
  nothing here can pre-empt that measurement.
- **D11 The six-plus Jira/Confluence journey cases extend a declared frozen set, and their routing result
  is a recorded live run, not a CI assertion — DEFERRED TO SPRINT 9 with D10.** `check-journey-specs.py`
  hardcodes 12 journeys and `j01…j12` and is run by CI at `ci.yml:141`, so the frozen count and id set are
  raised **in the validator, visibly**, in the same change that adds the specs. The new cases carry
  `oracle: "model:routing"` with `oracle_layers: ["live"]`, because the deterministic layer checks
  structural parity and cannot select a route. The orchestrator's answer on how the live run is graded:
  sprint 9 must **name the branch it takes** — either the run is made executable by the build agent
  (`claude -p` against the hub skill with a named model id, both runs' outputs recorded in sprint evidence),
  or, if that is not feasible on the host, the specs plus the structural CI check stand and the live run
  becomes an **explicit** deferral with its reason recorded. An unqualified "run live" verification line is
  the one thing a contract cannot be graded on, so sprint 9 may not leave it unqualified.
- **D12 `[CHALLENGE]` No root scaffolding is achieved by removing `tasks/` from the archive and rehoming the
  templates; `init.ts` needs no scaffolding edit.** The phase's Related Code Files names
  `commands/init.ts` ("no tasks scaffold"). Measured, `commands/init.ts` contains **zero** occurrences of
  `tasks` — the thirteen `tasks/` files arrive because the ship set carries them. DECIDED: `tasks/` leaves
  the archive roots, the **7** `.gitkeep` markers are deleted, the **5** `tasks/templates/*.md` and the
  `tasks/jira-workflows/README.md` move into the skills that read them (8 kit files name
  `tasks/templates`), and `reinstall-empty-dirs` is removed. **Round 2 corrects round 1's reason for that
  removal:** the flag is not a live option losing its subject — it is a **dead option**, parsed
  (`commands/migrate.ts:74`), typed (`migrate/types.ts:138`) and conflict-checked against
  `--respect-deletions` (`migrate/migrate-mode-resolver.ts:23`), but **consumed by no migration logic at
  all**, so it never had a `tasks/` implementation to lose. The removal is still right and AC-07's
  assertion still testable; only the stated reason changes. Every skill and CLI path that writes under
  `tasks/` creates its own directory on first write, and the gate hooks treat an absent `tasks/` as
  "no plan" — the same block, never an error.
- **D13 DEFERRED TO SPRINT 9 — decided position recorded.** The SubagentStart spike answers whether the
  hook loops on Claude Code, against current official documentation via `mk:docs-finder`, writes the answer
  and its citation into the rule that currently asserts the loop
  (`skills/cook/references/orchestration-rules.md:99,113`), leaves `settings.json`'s empty
  `"SubagentStart": []` array empty, and ships no injector — a hook written in the same sprint as its own
  feasibility study has no independent check. The single host observation recorded in round 1 (a
  third-party SubagentStart hook firing exactly once into a sub-agent context while this contract was
  drafted) is **existence evidence only, not throttling evidence**, and sprint 9 must carry that
  qualification so it cannot be read as a green light. **This sprint registers nothing and shortens no rule
  on the strength of it.**
- **D14 Eleven ACs in this contract, and the deferral is a split rather than a cut.** The shape half of the
  phase fits in eleven criteria, four under the evaluator's 15-criterion ceiling. Round 1's "nothing else
  is deferrable" was reasoned against a 26 % metadata cut; at the corrected 37 % across 166 blocks the
  judgement changes, and D15 records why. Nothing in this contract is further deferrable: each of the
  eleven removes a published artifact or a root-pollution defect, and a half-done removal leaves two
  answers in the tree.
- **D15 `[CHALLENGE]` The phase ships as two sprints: shape and removals here, budget and integrations
  next.** The orchestrator's decision, taken on the evaluator's recommendation. The risk a split removes is
  not volume — it is that the budget gate would **measure a denominator this same sprint is restructuring**:
  AC-02 promotes up to four new skills (new metadata), AC-05 takes `skills/benchmark/` out of the shipped
  inventory (less metadata), the deferred integration rewrite would touch 46 of the files the budget counts,
  and AC-03, AC-04 and AC-06 each change `.claude/rules/**` bytes against **99 bytes** of headroom. One
  question with a moving answer is the defect pattern D7 itself invokes. DECIDED: this contract carries
  AC-01–AC-11 (shape, removals, scaffolding, runtime state, docs, safety, repo-green); **sprint 9** carries
  the metadata budget (D7), the integration rewrite and routing specs (D10, D11) and the SubagentStart spike
  (D13), proposed after this sprint lands and measured against the **settled** inventory with the extractor
  the Definitions name. The safety and zero-residue criteria stay here because they share the golden corpus
  with the removals. The cost accepted and stated: the plan's "always-listed total ≤ 70 KB" acceptance
  criterion is **not** met when this sprint lands, so sprint 8 is explicitly a partial delivery of
  `plan.md`'s Acceptance Criteria and the release that satisfies them is sprint 9's.

## Definitions

- **Shipped kit:** the file set `scripts/kit-ship-set.cjs` produces from the archive roots minus
  `base.exclude` — the published artifact, not this repository's working tree.
- **Always-listed (sprint 9's measurement, defined here so it is fixed before it is used):** bytes a session
  loads or lists before any skill runs — every `.md` under `.claude/rules/`, plus `name` + `description` +
  `when_to_use` from every shipped `SKILL.md`, plus `name` + `description` from every shipped agent.
  **Extraction method, named because three plausible extractors give three different totals:** the
  frontmatter of each **ship-set** file is YAML-parsed and `Buffer.byteLength` is taken over the **scalar
  values** of those fields — never a line-based or regex extraction. Measured that way, BASE is
  **111 592 B** (rules 25 501 + 125 skills 71 780 + 42 agents 14 311). Round 1's 94 060 B was an extraction
  artefact and is superseded.
- **Load path:** a committed code or prose path that causes a file's contents to be read — a hook, a
  handler, a skill or agent instruction, a rule, a CLI code path, or a CI job. A name appearing in prose
  that nothing opens is **not** a load path.
- **Disposition:** one of `delete-duplicate`, `delete-and-rewrite-references`, `fold-into-existing-skill`,
  `promote-to-skill`, assigned to exactly one command, with a named target (D3).
- **Relocated path — the governing list for every "nothing still names it" claim:** `.claude/modes`,
  `.claude/commands`, `.claude/rubrics`, `.claude/rules-conditional`, `.claude/schemas`, `.claude/scripts`,
  `.claude/benchmarks`, `.claude/workflow.yaml`, `.claude/harness-substrate.md`,
  `.claude/capability-bootstrap.md` and `.claude/agent-memory`. A path qualifies whether the file moved, was
  deleted, or left the shipped kit by exclusion. **38** files name one of these at BASE.
- **Node-only-executable property:** within `.claude/scripts/`, `.claude/scripts/bin/` and `.claude/hooks/`,
  no file has a `.py` or `.sh` extension **and** no file's first line is a shebang naming an interpreter
  other than `node`. Asserted by reading first lines, because 8 of 9 `bin/` entries are extensionless bash
  (D6). Skill-owned scripts elsewhere under `.claude/` are outside this property and are retained.
- **Runtime state:** anything a hook, skill or CLI path writes during a session that is not an authored
  artifact — session markers, caches, model metadata, telemetry, Python envs. Its home is `.meowkit/`
  (`hooks/lib/meowkit-paths.cjs`).
- **Zero-residue journey:** after a fresh install in a throwaway project plus one full session,
  `git status --porcelain -- .claude .meowkit` lists no new untracked and no modified path except
  `.meowkit/memory/*.md`. Output under `tasks/` is expected and outside this check.
- **Fresh init journey:** a throwaway project created under `$TMPDIR`, installed into, asserted against and
  discarded. `init`, `upgrade` and `uninstall` are never run in or against this repository, not even with
  `--help` (sprint 7 D11, still binding).
- **Safety hook:** `gate-enforcement.cjs`, `privacy-block.cjs`, `pre-ship.cjs` and the Gate 2 libraries
  they call. Their observable contract is exit 2 with `@@GATE_BLOCK@@` or `@@PRIVACY_BLOCK@@`.

## Scope (In)

- Reducing the shipped `.claude/` top level from 17 entries to ≤8 by deletion or `base.exclude`, with
  `base.files`, `base.globs` and `base.commands` updated in the same change, and the shipped-shape
  statements in `README.md:9`, `README.md:107` and `RELEASING.md:173` brought current (D1)
- Deleting `.claude/commands/`: 11 same-name duplicates removed, the other 16 dispositioned from the closed
  set with a committed table, ≤4 promoted to skills, and every git-tracked occurrence of a command-only
  `/mk:` target rewritten — the **39** non-docs files here, the **21** docs files in AC-09 (D3)
- Renaming the three command entries in `SAFETY_PATHS` to their surviving paths, and removing
  `pairedCommands`/`GOVERNED_DISPATCHERS` and the command-inventory branch of
  `check-skill-cross-refs.sh` along with their subject (D4)
- Deleting `.claude/modes/` with the load-path check recorded, creating no `output-styles/`, and updating
  all eight places that name the directory (D2)
- Moving `rubrics/`, `rules-conditional/*`, `workflow.yaml` and `capability-bootstrap.md` into their owning
  skill or beside their hook, with every reader and the shortened canonical pointer updated (D8, D9)
- Taking `benchmarks/`, `skills/benchmark/`, `harness-substrate.md`, `harness-metadata-schema.json` and
  `agent-memory/` out of the shipped kit by exclusion, and moving `skill-schema.json` into the CLI
  package so `validate --frontmatter` keeps working in installed projects (D5)
- Redistributing all 22 `.claude/scripts/` entries to the four destinations, deleting the 4 zero-caller
  scripts, resolving the 3 duplicated `bin/` jobs to one name each, and establishing the
  **Node-only-executable property** over `scripts/`, `scripts/bin/` and `hooks/` (D6)
- Removing `tasks/` from the archive roots, deleting the 7 `.gitkeep` markers, rehoming the 5 named
  templates and `tasks/jira-workflows/README.md` into their reading skills, and removing the dead
  `reinstall-empty-dirs` option (D12)
- Moving every `session-state/` path onto `meowkit-paths.cjs`'s `.meowkit/state/`, and the web-fetch cache
  to `.meowkit/cache/web-fetches/` with the privacy manifest regex and a new golden case in the same change
- Adding a rule-survival needle for the `security-rules.md` Enforcement clause AC-02 rewrites, so the one
  always-on safety sentence this sprint edits is covered by the check AC-10 leans on
- Updating the 36 editable docs files that name a relocated path
- Regenerating the codex and cursor projections and the generated CLI manual, and keeping every committed
  validator green, with the rules subtotal pinned at ≤25 501 B

## Scope (Out)

- **The always-listed metadata budget, its gate and the description rewrites. Deferred to sprint 9** with
  the corrected baseline (111 592 B, 70 000 B decimal target, the named extractor) and the per-skill
  arithmetic recorded in D7. No description is shortened in this sprint (D7, D15)
- **The integration description rewrite and the ≥6 Jira/Confluence routing journey specs. Deferred to
  sprint 9** (D10, D11, D15). This sprint touches no integration skill or agent description and adds no
  journey spec, so it cannot pre-empt the before/after measurement
- **The SubagentStart spike. Deferred to sprint 9** (D13, D15). This sprint registers no SubagentStart
  handler and shortens no rule on the strength of the question
- Creating `.claude/output-styles/`, or porting a mode file to any other format. Nothing loads one (D2)
- Keeping `/mk:plan` alive as a skill name, or any other dispatcher-shaped skill whose body delegates to
  one other skill. That is the duplicate-menu-entry defect being removed (D3)
- Promoting more than four of the sixteen non-duplicate commands to skills (D3)
- Dropping a `SAFETY_PATHS` entry, or leaving a check that reads an inventory that no longer exists (D4)
- Moving any integration skill or agent to a pack, deleting one, or changing `default_enabled`.
  `plan.md` Decision 6 is user-confirmed (D10)
- Removing, relocating or rewriting any of the **74** skill-owned `.py`/`.sh` scripts, or reversing the
  lazy-Python decision. The Node-only-executable property covers three paths, not the whole tree (D6)
- Raising the 25 600-byte rules literal, or spending the 99-byte rules headroom (D8)
- A second move registry, a second ship-set list, a second copy of `skill-schema.json`, or a second
  path-resolution helper beside `meowkit-paths.cjs` (D5, D9)
- Moving any of the five always-on safety rules out of `.claude/rules/`, or changing what a safety hook
  blocks, its exit code, or its marker (`plan.md` Constraints)
- Adding any `gates.*`, `paths.*` or protected `hooks.*` key to project config, or any committed file that
  can redirect a safety hook (`plan.md` Constraints)
- Un-blocking the old `.claude/cache/web-fetches/` path. The privacy regex matches the old path **and** the
  new one, so the existing golden case stays green and no previously blocked read becomes allowed
- Running `init`, `upgrade` or `uninstall` in or against this repository, including with `--help`
  (sprint 7 D11)
- Editing `packages/docs/content/docs/changelog/*` (sprint 7 D10)
- Phase 01's rule-text work, phase 06's CLI surface work, and any new skill, agent or verb that is not a
  disposition target from D3
- Referencing a plan artifact — phase number, sprint number, criterion identifier, decision number, round
  or amendment — in a code comment, test name, file name or script name

## Acceptance Criteria

### [AC-01] The shipped kit has two roots and ≤8 `.claude/` entries, computed from the one ship-set source

**Given** the shipped kit at BASE — **1228** files, four archive roots, and **17** top-level `.claude/`
entries of which eleven leave (`agent-memory/`, `benchmarks/`, `capability-bootstrap.md`, `commands/`,
`harness-substrate.md`, `modes/`, `rubrics/`, `rules-conditional/`, `schemas/`, `scripts/`,
`workflow.yaml`), **six** of them declared base content (`agent-memory/**`, `schemas/**`, `modes/**`,
`rubrics/**`, `rules-conditional/**` in `base.globs` at `pack-manifest.json:22-30`, and `workflow.yaml` in
`base.files`) — and the three shipped-shape statements outside the kit: `README.md:9`'s counts banner
("125 skills · 42 agents · 27 commands · 7 modes · 7 rules · 5 conditional rules · 27 hook scripts"),
`README.md:107`'s tree listing, and `RELEASING.md:173`'s `modes/*` authoring row
**When** `scripts/kit-ship-set.cjs` is run on the finished tree, a fresh install is performed into a
throwaway `$TMPDIR` project, and the installed project's roots and `.claude/` top level are listed
**Then** the shipped `.claude/` top level has **≤8** entries and the finished set is exactly the six the
target tree names plus any entry an AC below explicitly keeps — asserted by listing, so the claim is the
set and not the count alone; the fresh install adds **only** `.claude/` and `.meowkit/` to the project root,
with no `CLAUDE.md`, no `tasks/` and no manifest inside `.claude/`; each of the eleven departing entries is
absent from the shipped kit **and** absent from `base.files`, `base.globs` and `base.commands`, so no entry
returns through a pack declaration the archive does not carry — `mewkit validate --packs` is green and its
base safety invariant reports no missing file; `base.exclude` remains the **only** list of what the kit
withholds, with `git diff BASE` adding no second ship-set list or second archive matcher; **this criterion
owns `README.md` and `RELEASING.md`** — both are outside AC-09's docs universe (`docs/` +
`packages/docs/content/`) and would otherwise be named by no criterion — so `README.md:9`'s banner states
the finished counts, and neither file names a relocated path or a removed directory; and every entry removed
by **deletion** rather than exclusion has no file left behind anywhere in the repository under its old path

- **Verification:** run `scripts/kit-ship-set.cjs` on the finished tree and assert the `.claude/` top-level
  set and its size; install into a throwaway `$TMPDIR` project and list the project root and `.claude/`;
  grep `base.files`, `base.globs` and `base.commands` for each departing entry; run
  `mewkit validate --packs`; grep the diff for a second exclusion list or archive walker; read `README.md`
  and `RELEASING.md` and assert the banner's counts against the finished inventory and zero relocated
  paths; `ls` each deleted path
- **Rubric tie-in:** functionality (weight 0.40)

### [AC-02] `commands/` is gone, every command is dispositioned, and every `/mk:` reference still resolves

**Given** the **27** commands at BASE — **11** sharing a skill name (`advise`, `autobuild`,
`context-audit`, `cook`, `docs-init`, `fix`, `help`, `orchestrate`, `retro`, `review`, `ship`) and **16**
not — and the **10** command-only `/mk:` targets measured **by exact token with their scope** (`/mk:plan`
not matching `/mk:plan-creator`): files naming any of the ten are **30** in the shipped kit, **60**
git-tracked outside `tasks/` and `.claude/worktrees/`, **21** of those 60 under `docs/` +
`packages/docs/content/`; `/mk:plan` alone is **11** kit files, **32** repo files, **14** docs files. Round
1's scopeless "38 files / 39 for `/mk:plan`" is superseded. Also given `/mk:audit` inside the Enforcement
clause of the always-on `rules/security-rules.md:26`, and the three engine readers of the directory
(`check-packs.ts:52-54`, `base.commands`, `check-gate-authority.ts:246-259`)
**When** the shipped kit is searched for `.claude/commands`, every `/mk:<name>` reference in the kit and in
the non-docs repository is resolved against the skill inventory, the disposition table is read, and the
committed checks are run
**Then** `.claude/commands/` does not exist in the repository or the shipped kit; the disposition table
names **all 27** commands with exactly one disposition each from the closed set and a named target, so no
command is left undecided and none has two answers; **at most 4** of the 16 carry `promote-to-skill`;
**this criterion owns the 39 non-docs git-tracked files** (the measured 60 minus AC-09's 21), the 30 kit
files included, and **AC-09 owns the 21 docs files** — the two sets are disjoint and their union is the
measured 60, so no occurrence is claimed by neither criterion and neither can pass on its own slice while
the other's references dangle; across those 39, **every** `/mk:<name>` reference resolves to a skill
directory — **0** unresolved — and the two BASE non-references
(`commands/mk/meow.md:24`'s `[/mk:command]` placeholder and the truncated stem in
`commands/mk/confluence-setup.md`) are gone with their files rather than inherited; the `/mk:audit` rewrite
inside `rules/security-rules.md:26` leaves the Enforcement clause's meaning intact — WARN, document in the
verdict, do not auto-fix — and is covered by the needle AC-10 requires; the three `SAFETY_PATHS` command
entries are **renamed, not dropped** — the list has the same length and `validate --packs` reports no
missing safety file; `pairedCommands`, `GOVERNED_DISPATCHERS` and `check-skill-cross-refs.sh`'s
command-inventory branch are **removed**, so no check reports pass while reading an empty inventory —
proven by planting an unresolvable `mk:*` reference in a scratch copy and observing
`check-skill-cross-refs.sh` fail; no promoted skill's body merely delegates to one other skill; and the
slash menu has no duplicate name, because there is exactly one surface left

- **Verification:** `ls .claude/commands` and grep the shipped kit for `commands/mk`; read the disposition
  table and assert 27 rows, one disposition each, ≤4 promotions, every target resolvable; enumerate by
  exact token the git-tracked files naming any of the ten outside `tasks/`, `.claude/worktrees/`, `docs/`
  and `packages/docs/content/`, assert the set is this criterion's 39 and resolve every reference in it
  against `.claude/skills/*/SKILL.md` with zero misses; run `scripts/check-skill-cross-refs.sh` on the
  finished tree and on a scratch copy with a planted bad reference; read `rules/security-rules.md`'s
  Enforcement clause before and after; assert `SAFETY_PATHS` length and run `validate --packs`; grep the
  diff for the removed check functions; read each promoted skill and assert it carries procedure, not a
  single delegation line
- **Rubric tie-in:** functionality (weight 0.40)

### [AC-03] `modes/` is deleted on a recorded zero-reader finding, and no behavior surface replaces it

**Given** the seven mode files at BASE, the measurement that **no hook, handler, skill, agent, rule,
command, CLI path or CI job reads one** and that no `MEOWKIT_MODE` env name exists, and the **eight** places
the directory is named — `rules/gate-rules.md:69`, the `check-gate-authority` test fixture, the `base.globs`
entry `.meowkit/pack-manifest.json:27`, `README.md:9`, `README.md:107`, `RELEASING.md:173`,
`docs/maintainer/docs-reference-contract.md:8` and `docs/operations/docs-references-inventory.md:79`. Round
1 said "exactly two places" and was low by six; **none of the eight is a load path**, so the zero-reader
finding is unchanged
**When** the committed load-path finding is read, the finished tree is searched, and the gate-authority
check is run over the finished `.claude` tree and over the generated projections
**Then** `.claude/modes/` does not exist and **no `.claude/output-styles/` directory is created**, so the
shipped top level stays at the AC-01 set; the load-path finding is committed as part of the reader inventory
of AC-06, naming for each of the seven modes the readers found (zero) and the method used, so the deletion
rests on a recorded check and not on a name-match count; all eight naming places are updated with a named
owner for each and none left to another criterion by assumption — this criterion owns
`rules/gate-rules.md:69` and the test fixture, **AC-01** owns `README.md` and `RELEASING.md`, **AC-01** owns
the `base.globs` entry, and **AC-09** owns the two `docs/` pages; `rules/gate-rules.md`'s reviewer path list
no longer names `.claude/modes/` or `.claude/rules-conditional/` and **does** name every directory those
two paths' content moved to, so the standing Gate-2 item covers the same prose it covered at BASE —
asserted by comparing the set of directories the list reaches before and after; `mewkit validate --gates` is
green and `checkGateAuthority` still flags a planted automated-approval sentence placed in a surviving prose
file, so its reach is unchanged by the deletion; and `.claude/rules/**` is **no larger** than at BASE in
bytes (**≤25 501 B**)

- **Verification:** `ls .claude/modes .claude/output-styles` and assert both absent; read the committed
  load-path finding; check each of the eight naming places against its named owner and assert none still
  names the directory; diff the directory set reachable from the `gate-rules.md` path list before and after;
  run `mewkit validate --gates` on the finished tree and on a scratch copy with a planted approval
  sentence; run `scripts/check-always-on-budget.cjs` and compare the total against 25 501
- **Rubric tie-in:** functionality (weight 0.40)

### [AC-04] Domain content lives inside its owning skill, and every reader points at the new path

**Given** `rubrics/` (readers: `skills/rubric/`, `skills/evaluate/` incl. `scripts/recompute-score.py`,
`skills/review/references/design-review.md`, and every contract's `rubric_preset`), `rules-conditional/*`
(**20+** readers incl. `agents/athena.md`, six skills and
`core/workflow-evidence-revision.ts`), `workflow.yaml` (readers: `check-workflow-drift.ts:99`, the
`validate --workflow` flag, four skill files, and the `Canonical source:` pointer that
`check-workflow-drift.ts:208` compares, present in `rules/meowkit-core.md:3` and `rules/gate-rules.md:3`),
and `capability-bootstrap.md` (`hooks/handlers/capability-bootstrap.cjs:16`, `core/bootstrap.ts`, two
golden cases)
**When** every moved file's new path is resolved, every reader is read, the move registry is read, and
`mewkit validate --docs-refs`, `scripts/check-dangling-rule-refs.cjs`, `check-skill-cross-refs.sh`,
`scripts/link-checker.cjs` and `mewkit validate --workflow` are run
**Then** none of the four lives at its BASE path and each lives at exactly **one** new path inside the skill
or hook directory that owns it — no file exists at both; **every** reader named above resolves to the new
path, asserted by running each reader rather than by grepping for the string: the capability-bootstrap
golden cases still pass unchanged, `validate --workflow` still finds and parses the spec,
`validate --frontmatter` and the rubric-reading skills still load their data; the canonical pointer comment
is updated in both always-on rules **and** in `check-workflow-drift.ts`'s constant together, and
`scripts/check-always-on-budget.cjs` reports a rules total **no larger than 25 501 B** — so the longer path
is paid for and not absorbed by the 99-byte headroom; every move is appended to the **existing**
`scripts/dangling-rule-refs-data.cjs` registry with its `to` path, and `git diff BASE` adds no second
registry; and `scripts/check-dangling-rule-refs.cjs`, `check-skill-cross-refs.sh`, `--docs-refs` and the
link checker all report **zero** stale references — proven to have teeth by planting an old-path reference
in a scratch copy and observing a failure

- **Verification:** `ls` each BASE path and each new path; run the two capability-bootstrap golden cases,
  `validate --workflow`, `validate --frontmatter` and one rubric-reading skill path; read both rule pointer
  comments and the drift-check constant; run `check-always-on-budget.cjs` and compare to 25 501; read the
  move registry entries; run all four reference checks on the finished tree and on a scratch copy with a
  planted old-path reference
- **Rubric tie-in:** product-depth (weight 0.25)

### [AC-05] Maintainer-only content leaves the shipped kit, and no shipped skill loses its data

**Given** the maintainer-only content that still ships at BASE — `benchmarks/` (7 files, read only by
`skills/benchmark/scripts/*`), `harness-substrate.md` (0 kit readers; read by `core/substrate.ts` and
`maintainer/inventory.ts`), `schemas/harness-metadata-schema.json` (read by
`core/build-inventory.ts:396,424`), `agent-memory/` (**3 files of this repository's own evaluator
memory**), and `schemas/skill-schema.json`, whose reader `core/check-skill-frontmatter.ts:90` returns a
**fatal** when it is absent from `<root>/.claude/schemas/` — and the orchestrator's confirmation that
`skills/benchmark/` leaving the shipped kit is **intended**, because the phase makes benchmarks
source-repo-only and `/mk:benchmark` runs from this repository
**When** the shipped kit is computed, `mewkit validate --frontmatter` is run **inside a fresh `$TMPDIR`
install**, and every in-repo tool that reads one of these paths is run from this repository
**Then** none of `benchmarks/`, `skills/benchmark/`, `harness-substrate.md`,
`harness-metadata-schema.json` or `agent-memory/` appears in the shipped kit; **no shipped skill is left
without its data directory** — `skills/benchmark/` leaves with `benchmarks/`, asserted by resolving every
shipped skill's own `references/`, `scripts/`, `assets/` and `data/` paths and requiring each to be
present in the ship set; `validate --frontmatter` in the fresh install **passes** and reports no fatal,
because `skill-schema.json` is read from the CLI package, and `git diff BASE` shows exactly **one** copy of
that schema in the repository; every in-repo tool still works from this repository — `core/substrate.ts`'s
reader, `scripts/harness-inventory.cjs` and `scripts/docs-manifest.cjs` all exit 0 with output equivalent
to BASE on this tree; **no** shipped kit file, docs page outside the two changelog pages, or rule presents
`/mk:benchmark` or any other now-unshipped surface as available in an installed project, and the
`dead-weight-audit-rules` registry entry is marked unshipped rather than left pointing into an excluded
skill; and `agent-memory/`'s departure is asserted on the **archive**, so no future install publishes this
repository's evaluator memory

- **Verification:** compute the ship set and assert each path absent; resolve every shipped skill's own
  data paths against the ship set; install into `$TMPDIR` and run `validate --frontmatter` asserting exit 0
  and no fatal; `git grep -l skill-schema.json` and assert one copy; run the three in-repo tools and diff
  their output against BASE; grep the shipped kit, rules and docs for `/mk:benchmark` and for each excluded
  path; read the registry entry's `shipped` field
- **Rubric tie-in:** product-depth (weight 0.25)

### [AC-06] Every script reaches one of four destinations, and three named trees are Node-only by shebang

**Given** the **22** shipped `.claude/scripts/` entries at BASE — **5** `.py` and **1** `.sh` among them,
the **4** zero-caller scripts (`checklist.py`, `cost-report.py`, `rules-audit.sh`, `validate-docs.py`),
`injection-audit.cjs` with **16** callers including the always-on `rules/injection-rules.md:56` and
`rules/gate-rules.md:95` and `commands/doctor-checks.ts`, `skill-python.cjs` with **21**,
`validate-workflow-evidence.cjs` with **9** and `validate-review-coverage.cjs` with **4** (two and one of
those being safety-hook libraries) — the **9** `.claude/scripts/bin/` entries, which are **3 duplicated
jobs** (`meowkit-` / `workflow-` × `diff-scope`, `repo-mode`, `slug`) plus **3 unpaired** (`setup-workflow`,
`workflow-config`, `workflow-review-log`), **8 of the 9** being `#!/usr/bin/env bash` with **no extension** —
and the **74** skill-owned `.py`/`.sh` files elsewhere under `.claude/` that `skill-python.cjs` exists to
run, which **stay**
**When** the committed reader inventory is read, every caller of every moved script is executed, and the
first line of every file under `.claude/scripts/`, `.claude/scripts/bin/` and `.claude/hooks/` is read in
the shipped kit
**Then** a committed reader-inventory table names **every** top-level `.claude/` entry at BASE and **every**
one of the 22 scripts with its readers (kit, CLI source and CI) and exactly one destination from
`hooks/lib/`, the owning skill's `scripts/`, the repository, or deleted — so the redistribution is a
recorded decision per file, not a residue; `.claude/scripts/` is absent from the shipped kit; the 4
zero-caller scripts are deleted and no file references them; the **Node-only-executable property** holds —
within `.claude/scripts/`, `.claude/scripts/bin/` and `.claude/hooks/` the shipped kit has **zero** `.py`
and `.sh` files **and zero files whose shebang names any interpreter other than `node`**, asserted by
**shebang** rather than by extension, because 8 of the 9 `bin/` entries carry no extension and an
extension check would miss every one of them; the **74** skill-owned scripts outside those three trees are
**unchanged in count and location**, asserted explicitly, so the lazy-Python decision is not reversed by a
side effect; every caller still resolves and still works — the two always-on rules name
`injection-audit.cjs`'s new path and running it from that path produces BASE-equivalent output, `doctor`
still finds it, the lazy-Python entrypoint still resolves for its 21 callers, and the Gate 2 structural
checks that call the two validators still produce their BASE verdicts; `scripts/bin/` carries **one** name
per job — the 3 duplicated jobs resolved to 3 entries and the 3 unpaired entries kept or dispositioned in
the table; and `scripts/check-no-python.cjs` is green against its own documented invariant, that the kit's
core runtime needs no Python

- **Verification:** read the inventory table and assert full coverage of both lists with one destination
  each; compute the ship set and assert no `.claude/scripts/` member; read the first line of every file in
  the three named trees and assert no `.py`/`.sh` name and no non-`node` shebang; count and list the
  skill-owned `.py`/`.sh` files and assert 74 at unchanged paths; grep the tree for each deleted script
  name; run `injection-audit.cjs` from its new path and diff against BASE output; run `doctor`; run a
  skill-python invocation; exercise the Gate 2 structural checks and compare verdicts to BASE; list
  `scripts/bin/` and assert one name per job; run `check-no-python.cjs`
- **Rubric tie-in:** product-depth (weight 0.25)

### [AC-07] A fresh install creates no `tasks/`, and both gates behave identically without it

**Given** the **13** `tasks/` files the archive carries at BASE, decomposed correctly in round 2 as **7**
`.gitkeep` markers (`active`, `autobuild-runs`, `backlog`, `contracts`, `guidelines`, `plans`, `reviews`),
**5** `tasks/templates/*.md` — `bead-template.md`, `plan-phase.md`, `plan-quick.md`, `plan-template.md`,
**`pm-status-template.md`** — and **1** `tasks/jira-workflows/README.md`; round 1's "8 + 4 + 1" left
`pm-status-template.md` unaccounted for while the 13 total still matched. Also given the **8** kit files
that name `tasks/templates`, the measurement that `commands/init.ts` contains **zero** occurrences of
`tasks`, and `reinstall-empty-dirs` as a **dead option** — parsed (`commands/migrate.ts:74`), typed
(`migrate/types.ts:138`), conflict-checked (`migrate/migrate-mode-resolver.ts:23`), consumed by no
migration logic
**When** a throwaway `$TMPDIR` project is installed fresh; Gate 1 is exercised by attempting a source edit
with no plan present and no `tasks/` directory at all; Gate 2 is exercised by attempting a commit of a
ship-capable change with no verdict and no `tasks/`; a plan is then created through the normal skill path;
and a `/mk:cook` run is taken end to end in that project
**Then** the installed project has **no** `tasks/` directory and the shipped kit has no `tasks/` archive
root; **each of the 5 named templates and the workflow README is present at exactly one new path inside a
skill that reads it**, asserted per file by name rather than by count, so none is left behind while the
total matches; all 8 references resolve; `reinstall-empty-dirs` is gone and no CLI path still parses,
types or validates it; **Gate 1 blocks the source edit with the same exit code and the same
`@@GATE_BLOCK@@` marker as it does when `tasks/plans/` exists but is empty** — an absent directory is "no
plan", never an error, asserted by comparing the exit code, the marker and the message class against the
empty-directory case rather than only against a non-zero exit; **Gate 2 fails closed** the same way for the
missing-verdict case, with exit 2 and its marker; creating a plan through the skill path creates
`tasks/plans/<dir>/` on first write and the gate then passes with an approved plan; the `/mk:cook` run
completes without any step failing on a missing directory; and no hook crashes or prints a stack trace in
any of these runs

- **Verification:** install into `$TMPDIR`; `ls tasks` and assert absent; compute the ship set and assert no
  `tasks/` root; locate each of the 5 named templates and the README at its new path and resolve the 8
  references; grep the CLI for `reinstall-empty-dirs` across parse, type and resolver sites; attempt a
  source edit with no `tasks/` and with an empty `tasks/plans/`, comparing exit code, marker and message
  class; attempt a ship-capable commit with no verdict and assert exit 2 and the marker; create a plan and
  re-run the gate; take `/mk:cook` end to end; grep every run's stderr for stack frames
- **Rubric tie-in:** functionality (weight 0.40)

### [AC-08] All runtime state is under `.meowkit/`, and a full session leaves no residue

**Given** the **19** hook files naming `session-state` at BASE in two inconsistent forms —
`hooks/lib/shared-state.cjs:7-8` writing `<CLAUDE_PROJECT_DIR>/session-state/` (the project-root pollution
the requirement names), with `lib/checkpoint-utils.cjs:11`, `lib/resolve-model.cjs:16`,
`lib/trace-log.cjs:32` and `lib/gate2-verdict-lookup.cjs:32,40` on the same root form, against
`lib/tdd-detect.cjs:28` and `lib/gate2-structural-checks.cjs:60-61` on `.claude/session-state/` — the
existing `.meowkit/state` resolver `lib/meowkit-paths.cjs` used by only **6** files, and the web-fetch cache
`.claude/cache/web-fetches/` (`persist_fetch.py:55`) matched by `privacy-block.cjs:46` and asserted by the
golden case `privacy-read-webfetch-manifest.json`
**When** a throwaway `$TMPDIR` project is installed, committed, and taken through one full session that
exercises a gate block, a checkpoint write, a model detection, a TDD sentinel read, a Gate 2 evidence
lookup and a web fetch; the golden corpus is replayed; and `git status --porcelain -- .claude .meowkit` is
read
**Then** **no** path under the project root named `session-state` is created, and **no** `.claude/cache/`
is created — every runtime write lands under `.meowkit/` through `meowkit-paths.cjs`, with `git diff BASE`
adding no second state-path resolver and leaving no file computing a `session-state` path by hand; the
web-fetch cache is `.meowkit/cache/web-fetches/` and the privacy manifest regex moves in the **same**
change, matching the **new** `index.jsonl` and quarantine paths **and still** the old ones — a **new**
golden case asserts that reading the new `.meowkit/cache/web-fetches/index.jsonl` exits **2** with
`@@PRIVACY_BLOCK@@`, and the **existing** `privacy-read-webfetch-manifest` case still passes unchanged, so
no path that was blocked at BASE becomes readable; the full golden corpus (Gate 1, Gate 2, privacy,
careful/freeze, crash paths) passes with no case re-recorded to accommodate this change — asserted by
diffing the corpus's expected blocks against BASE; Gate 2's evidence and active-plan lookups resolve under
the new taxonomy and produce their BASE verdicts on the same inputs; the **zero-residue** check holds —
`git status --porcelain -- .claude .meowkit` lists no new untracked and no modified path except
`.meowkit/memory/*.md`; and `.claude/skills/.venv` is absent while per-skill envs are under
`.meowkit/envs/`

- **Verification:** install into `$TMPDIR`, commit, run the full session, then `find` the project root for
  `session-state` and `.claude/cache` and assert none; grep the finished hooks for a hand-computed
  `session-state` path and for a second resolver; replay the whole golden corpus and diff expected blocks
  against BASE; run the new golden case and the existing web-fetch case; exercise the Gate 2 lookups and
  compare verdicts to BASE; run `git status --porcelain -- .claude .meowkit`; `ls .claude/skills/.venv` and
  `.meowkit/envs`
- **Rubric tie-in:** functionality (weight 0.40)

### [AC-09] Docs and projections match the new shape, and nothing documented points at a path that is gone

**Given** the **38** files that name a **relocated path** at BASE — the governing list being the
Definitions' relocated-path set, which **includes `agent-memory/`** that AC-05 removes; round 1's 37/35
figures were correct only for a narrower list that omitted it — split **13** under `docs/` and **25** under
`packages/docs/content/`, **two** of the latter the immutable changelog pages, leaving **36** editable. Also
given the **21** docs files naming a command-only `/mk:` target, which AC-02 assigns to this criterion, and
the codex and cursor projections, which mirror `skills`, `agents`, `hooks`, `hooks.json`, `rules` and
`scripts` but carry no `commands/`, `modes/`, `rubrics/` or `rules-conditional/`
**When** every `.claude/` path and every `/mk:` target named in `docs/` and `packages/docs/content/` is
**resolved** against the finished tree — resolution, not execution, because documented install commands
would perform real installs — and the projections, the generated CLI manual and the generated banners are
regenerated
**Then** all **36** editable files are updated so that every `.claude/` path they name exists in the
finished tree, with **0** unresolved paths, and a planted bad path in a scratch copy makes the resolver
fail, so it has teeth; the **21** docs occurrences of a command-only `/mk:` target resolve to a skill —
this criterion owns them and AC-02 owns the other 39, so their union is the measured 60 and neither
criterion passes on a slice; the two changelog pages are asserted **unchanged by diff**, with their reason
recorded — they record what past releases shipped; `mewkit validate --docs-refs` and
`scripts/link-checker.cjs` are green; `docs/maintainer/docs-reference-contract.md` and
`docs/operations/docs-references-inventory.md` name the new paths, so the contract that governs which
`docs/*` paths may appear in `.claude/` is itself current; the codex and cursor projections regenerate to a
**no-op** (`git diff --exit-code`) and `mewkit validate --target codex` and `--target cursor` are green, so
no projection lags the reduced surface; and the generated CLI manual and the generated banners regenerate to
a no-op and name no removed command, path or verb

- **Verification:** extract every `.claude/` path and every `/mk:` target from all 38 files and resolve
  against the finished tree, asserting zero misses on the 36 and failure on a planted bad path; assert the
  21-file `/mk:` set is disjoint from AC-02's 39 and that their union is 60;
  `git diff BASE -- packages/docs/content/docs/changelog` is empty; run `validate --docs-refs`,
  `link-checker.cjs`, `--target codex`, `--target cursor`; regenerate the projections, the CLI manual and
  the banners and `git diff --exit-code`; grep the manual for removed names
- **Rubric tie-in:** ux-usability (weight 0.20)

### [AC-10] Every safety invariant is byte-identical, and the one safety clause this sprint edits has a probe

**Given** `plan.md`'s Constraints — the five always-on safety rules stay enforceable in `.claude/rules/`,
Gate 1, Gate 2 and privacy hard-block behavior is identical (exit 2, `@@GATE_BLOCK@@`,
`@@PRIVACY_BLOCK@@`), safety hooks stay independent of the dispatcher and fail closed on crash, and no
committed file may disable or redirect a safety hook — against this sprint's reach into
`rules/security-rules.md:26` (the `/mk:audit` reference inside the Enforcement clause "**Reviewing existing
code** (`/mk:review`, `/mk:audit`): flag as **WARN**, document it in the verdict, do not auto-fix"),
`rules/gate-rules.md:69` (the reviewer path list), `rules/injection-rules.md:56` and `gate-rules.md:95`
(the `injection-audit.cjs` path), the two Gate 2 libraries that read `session-state`, and the privacy
manifest regex — and the measured gap that `scripts/rule-survival-oracle.cjs`'s `ORACLE` (11 injection
headings, **12** security blocked-pattern rows, 9 gate conditions, the A1 status block and table, 6
core-behaviour headings, 15 development phrases) carries **no needle for that Enforcement clause**
**When** the whole golden corpus is replayed; each safety entrypoint is run with a crashing dependency and
with malformed stdin; a project config carrying `gates.*`, `paths.*` and a protected `hooks.*` key is
installed; and the five always-on rule files are compared against BASE
**Then** all five safety rules are still files under `.claude/rules/` — none moved into a skill, none
inlined elsewhere — and each still carries its enforcement clauses, asserted by the committed rule-survival
check; **the Enforcement clause AC-02 edits is covered** — a needle for the WARN / document-in-the-verdict /
do-not-auto-fix prose is added to `scripts/rule-survival-oracle.cjs` **in the same change**, and
`scripts/check-rule-survival.cjs` **fails** when that clause is removed from a scratch copy, so the one
always-on safety sentence this sprint rewrites has a probe rather than a disclosure; the Gate 1, Gate 2,
privacy and careful/freeze golden cases all pass with their **BASE** exit codes, markers and message bodies,
with no case re-recorded by this sprint; each safety entrypoint still **fails closed** — exit 2 and its
marker — on a crashing dependency, on malformed stdin, and when the CLI cannot be resolved at all; the
config keys that could redirect a gate are still **rejected**, so nothing this sprint moved opened a
redirect path; the `@@PRIVACY_BLOCK@@` path still blocks every file class it blocked at BASE, the relocated
web-fetch cache included; and `mewkit validate --gates` reports no prose granting approval authority to
anything that is not a human, in any of this sprint's rewritten rule, skill or agent text

- **Verification:** read the added needle and run `scripts/check-rule-survival.cjs` on the finished tree and
  on a scratch copy with the Enforcement clause deleted, asserting pass then fail; replay the full golden
  corpus and diff exit codes, markers and bodies against BASE; run each safety entrypoint with a stubbed
  crash, with malformed stdin and with no resolvable CLI, asserting exit 2 and the marker each time; install
  a config with `gates.*`, `paths.*` and a protected `hooks.*` key and assert rejection; run the privacy
  path over every BASE-blocked file class plus the new cache path; run `mewkit validate --gates`
- **Rubric tie-in:** functionality (weight 0.40)

### [AC-11] The whole repository is green, the rules subtotal is unchanged, and the diff stays inside the limits

**Given** `git diff BASE` at the end of the sprint, the committed checks, and the rules subtotal of
**25 501 B** that AC-03 and AC-04 each pin — a pin this criterion restates because the metadata gate that
also pinned it in round 1 is deferred to sprint 9 (D7, D15), and without restating it the pin would survive
in only two criteria
**When** the full suite and every validator are run, and every new or changed `.ts`, `.cjs`, `.js`, `.mjs`,
`.sh`, `.py`, `.yml`, `.json` and `.md` file is measured (generated files — the CLI manual, the generated
banners and the regenerated projections — exempt from the line rule)
**Then** the full test suite passes with **no** skipped or relaxed assertion introduced by this sprint,
asserted by diffing the skipped-test set against BASE rather than by reading the summary; `pnpm lint` and
`pnpm typecheck` report 0 errors; `mewkit validate --packs`, `--target codex`, `--target cursor`,
`--frontmatter`, `--docs-refs`, `--gates`, `--memory`, `--workflow`, `scripts/check-kit-verbs.cjs`,
`scripts/check-env-reads.cjs`, `scripts/check-always-on-budget.cjs`, `scripts/check-no-python.cjs`,
`scripts/check-rule-survival.cjs`, `scripts/check-dangling-rule-refs.cjs`,
`scripts/check-skill-cross-refs.sh`, `scripts/check-memory-wiki-residue.cjs`,
`tests/journey-validation/check-journey-specs.py` and `mewkit doctor` hard gates all pass;
`check-always-on-budget.cjs` reports a rules total **≤25 501 B**, so the 99-byte headroom is intact for
sprint 9; **no integration skill or agent description, and no journey spec, is changed by this sprint** —
asserted by `git diff BASE` over the 46 integration files and `journey-specs.jsonl` being empty, so the
deferred measurement starts from the inventory sprint 9 is told to expect; no new file exceeds 200 lines and
no changed file crosses 200 because of this sprint, with every file already over 200 at BASE that grew
listed by name with its BASE and final count; no changed TypeScript adds an `any` or an unsafe cast; no new
TODO or FIXME, no commented-out code, no unused import, no hardcoded secret and no key material; and no code
comment, test name, file name or script name introduced by this sprint references a plan artifact — phase
number, sprint number, criterion identifier, decision number, round or amendment — the reason for a piece of
code being stated as the invariant it protects

- **Verification:** run the suite, lint, typecheck and each named validator and check, asserting exit 0;
  run `check-always-on-budget.cjs` and assert ≤25 501; `git diff BASE` over the 46 integration files and
  `journey-specs.jsonl` and assert empty; diff the skipped-test set against BASE; `git diff --stat BASE`
  plus `wc -l` on new and changed files; grep added lines for `any`, casts, TODO, FIXME and secret
  encodings; grep the diff's comments, test names and new file names for plan-artifact tokens
- **Rubric tie-in:** code-quality (weight 0.15)

## Out-of-Scope Clarifications

- Do not shorten a skill, agent or integration description, do not wire the always-listed budget gate, and
  do not add a journey spec. All three are sprint 9's, and touching them here moves the denominator sprint 9
  measures (D7, D10, D11, D15).
- Do not register a SubagentStart hook, write an injector, or shorten a rule on the strength of the spike
  question. Sprint 9 records the outcome (D13).
- Do not create `.claude/output-styles/` or port a mode file anywhere. The load-path check returns zero
  readers for all seven, so there is nothing to carry forward — and a new always-listed surface for behavior
  no path selects is the cost this sprint exists to remove.
- Do not keep a dispatcher alive as a skill. A skill whose body delegates to one other skill is the
  duplicate-menu-entry defect under a new roof; rewrite the references instead, `/mk:plan`'s measured
  scopes included.
- Do not promote more than four of the sixteen commands. Every promotion adds a menu entry and metadata
  sprint 9's budget has to pay for.
- Do not drop a `SAFETY_PATHS` entry. Rename it to the surviving path so the base safety invariant keeps the
  same length.
- Do not leave a check reading an inventory that no longer exists. An empty inventory reports pass while
  verifying nothing, which looks like coverage and is not.
- Do not remove, relocate or rewrite any of the 74 skill-owned `.py`/`.sh` scripts. The Node-only property
  is a shebang property over `.claude/scripts/`, `.claude/scripts/bin/` and `.claude/hooks/`, and
  whole-tree zero-Python would reverse the lazy-Python decision — a different sprint.
- Do not assert the Node-only property by file extension. 8 of the 9 `.claude/scripts/bin/` entries are
  extensionless bash, so an extension check passes while the directory the requirement targets is full of
  shell.
- Do not raise the 25 600-byte rules literal or spend the 99-byte headroom. If the shortened canonical
  pointer cannot satisfy both the drift check and the budget, stop and amend.
- Do not create a second move registry, a second ship-set list, a second copy of `skill-schema.json`, or a
  second state-path resolver beside `meowkit-paths.cjs`. Each of those is one question with two answers.
- Do not exclude a shipped skill's data directory while shipping the skill. A skill without its data is a
  runtime failure that no structural check catches.
- Do not un-block the old `.claude/cache/web-fetches/` path. The regex matches old and new, so a stale cache
  in a pre-move install stays protected and the existing golden case stays green.
- Do not re-record a golden case to accommodate a path move. The corpus is the record of v2.15 behavior; if
  a move cannot keep a case green, the move is wrong.
- Do not edit an always-on safety rule's enforcement prose without a needle or a named before/after
  comparison for it. A disclosed edit with no probe is the gap this contract closes in AC-10.
- Do not move a safety rule out of `.claude/rules/`, change what a safety hook blocks, change its exit code
  or its marker, or add a config key that could redirect one.
- Do not run `init`, `upgrade` or `uninstall` in or against this repository, not even with `--help`. This
  repository is an installed project and its `.claude/` is the product source. Journeys run in throwaway
  `$TMPDIR` projects.
- Do not execute commands extracted from documentation. Resolve them against the finished tree.
- Do not edit `packages/docs/content/docs/changelog/*`.
- Do not weaken, relax or skip a test. If BASE behavior and a required result cannot be reconciled, stop and
  ask.
- Do not reference a plan artifact — phase number, sprint number, criterion identifier, decision number,
  round or amendment — in a code comment, test name, file name or script name. State the invariant.

## Rubric Bindings

- functionality: AC-01, AC-02, AC-03, AC-07, AC-08, AC-10
- product-depth: AC-04, AC-05, AC-06
- ux-usability: AC-09
- code-quality: AC-11

## Negotiation Log

- Round 1 (proposer/generator): initial draft from `phase-07-kit-shape.md` plus `plan.md` Decisions 1–7 and
  Constraints plus the `cli-tool` preset (functionality 0.40, product-depth 0.25, ux-usability 0.20,
  code-quality 0.15 — `.claude/rubrics/composition-presets/cli-tool.md`), with every claim measured at BASE
  `de278a5ffab2d43b366951d091d9687e2366895a` rather than taken from the phase file or from
  `research/cli-command-usage-evidence.md` §6, both of which predate sprints 1–7. Fourteen Decisions are
  recorded rather than left open, per the user's standing directive; six are marked `[CHALLENGE]`.
  **The phase file and §6 are contradicted by the tree in nine places**, each of which drove a Decision or
  an AC:
  (a) §6's "21 `.claude/` top-level entries" is neither figure that matters now — the repository has **25**
  and the **shipped kit has 17**, so every shape claim is restated on the ship set
  `scripts/kit-ship-set.cjs` computes (D1, AC-01);
  (b) the always-listed total is **94 060 B**, not 219.5 KB — the rule diet already landed (**25 501 B**
  against a 25 600 literal, **99 bytes** of headroom), and the phase's "72.6 KB outside rules" is **68 559
  B** over **125** skills and **42** agents, not 105+24 and 23+21; the caps re-derived at the measured
  counts sum to **65 780** (D7, AC-07);
  (c) the phase's "six scripts with zero callers" is **four** — `memory-migrator.cjs`,
  `memory-topic-file-migrator.cjs` and `verify-env-loading.sh` are already gone, and the live surprise is
  that **five Python files and one shell file still ship** from `.claude/scripts/`, which the plan's own
  hooks-and-bin criterion would not catch (D6, AC-06);
  (d) the phase's modes question ("confirm with a load-path check before deleting") is **answered**: zero
  readers for all seven, no `MEOWKIT_MODE` env name, and the only two mentions are a reviewer path list and
  an arbitrary test fixture — so the migrate-to-output-styles option has no subject and the dir is deleted
  with no replacement surface (D2, AC-03);
  (e) the phase assigns "no tasks scaffold" to `commands/init.ts`, but **no `init` code creates `tasks/`** —
  the 13 files, eight of them `.gitkeep`, arrive because the archive carries them, so Requirement 1 is a
  ship-set change plus a template rehome, and `migrate.ts:23`'s `reinstall-empty-dirs` loses its subject
  (D12, AC-09);
  (f) `schemas/**` cannot simply leave the shipped kit: `core/check-skill-frontmatter.ts:90` reads
  `skill-schema.json` from the installed project and returns a **fatal** when absent, so
  `validate --frontmatter` would break in every install — the schema moves into the CLI package while the
  other five maintainer artifacts leave by exclusion (D5, AC-05);
  (g) the phase's `agent-memory/` silence is a live defect: **three files of this repository's own evaluator
  memory ship to every user today**, so the exclusion list grows by an entry the phase does not name
  (D5, AC-05);
  (h) moving `workflow.yaml` lengthens the `Canonical source:` pointer that `check-workflow-drift.ts:208`
  compares exactly, in **two always-on rules** with **99 bytes** of headroom between them — so the move
  carries a budget condition and a stop-and-amend rule rather than being a file rename (D8, AC-04);
  (i) the phase's "add ≥6 Jira/Confluence cases, all pass before and after" meets a **deliberately frozen**
  journey set — `check-journey-specs.py` hardcodes 12 and `j01…j12` and is run by CI — and a **live-only**
  routing oracle, since the deterministic runner checks structural parity and cannot select a route; so the
  frozen count is raised by declaration and the before/after result is a recorded live run, not a CI
  assertion (D11, AC-08).
  Also decided: the disposition of all 27 commands comes from a closed set with a ≤4 promotion cap, and
  `/mk:plan`'s 39 files are rewritten rather than the name preserved (D3); `SAFETY_PATHS` entries are
  renamed and the now-subjectless command-drift check is removed with its subject rather than left to
  phantom-pass (D4); every move is appended to the existing move registry, with
  `dead-weight-audit-rules` marked unshipped because its destination skill leaves the kit (D9);
  integrations shrink by rewriting only, with the routing risk bound to AC-08 rather than disclosed (D10);
  the SubagentStart spike produces a recorded outcome and registers nothing, with the single host
  observation qualified as existence evidence only (D13); and the sprint stays at **14** ACs, one under the
  ceiling, with AC-08's live before/after run named as the first thing to defer if it must shrink — because
  the plan already owns a whole-corpus routing measurement — and with the reasoning that no other
  requirement is deferrable, since each removes a published artifact or a root-pollution defect and a
  half-done removal leaves two answers in the tree (D14).
  One thing round 1 does **not** do, and says so: it does not pre-assign the five undecided command
  dispositions (`arch`, `breakdown`, `delegate`, `design`, `status`). Each needs the command body read
  against the candidate skill's `when_to_use`, which is implementation judgment; the contract bounds it with
  a closed disposition set, a named target per row, a ≤4 promotion cap, the no-pure-dispatcher clause, and
  the AC-07 budget that every promotion has to fit inside.
- Round 1 (reviewer/evaluator): seven clarifications — AC-07/D7 (the always-listed total), AC-06 (the
  no-Python clause), AC-02 (the reference-rewrite universe), AC-09 (the `tasks/` decomposition), sprint width,
  the three open questions, and AC-13's coverage of the one safety-rule edit. Re-measured independently at
  BASE `de278a5f` and **accepted without change**: the rules subtotal (`check-always-on-budget.cjs` →
  **25 501 B** against the 25 600 literal, **99 bytes** of headroom); the ship set
  (`kit-ship-set.cjs(root, excludeMatcher(shipSetExclusions(root)))` → **1228** files, four roots
  `.claude`/`tasks`/`release-manifest.json`/`.meowkit/pack-manifest.json`, **17** `.claude/` top-level entries
  that are exactly the eleven departing plus the six surviving, so AC-01's set-not-count assertion has the
  right subject); `agent-memory/` shipping as exactly the **3** evaluator memory files, and
  `agent-memory/**` being a declared `base.globs` entry (`pack-manifest.json:26`) alongside `schemas/**`,
  `modes/**`, `rubrics/**`, `rules-conditional/**` and `workflow.yaml` in `base.files` — so AC-01's
  "absent from `base.files`/`base.globs`/`base.commands`" clause is a real check and not a formality;
  `skill-schema.json`'s install-time fatal (`check-skill-frontmatter.ts:90` reads
  `<root>/.claude/schemas/skill-schema.json` and returns `fatal: "No schema at …"` when absent, so D5's
  CLI-package relocation is forced and correct); the modes finding (**zero** load path for all seven, no
  `MEOWKIT_MODE` env name anywhere in the tree); the `tasks/` provenance (`commands/init.ts` contains **zero**
  occurrences of `tasks`, so D12's "ship-set change, not an `init.ts` edit" holds); the command inventory
  (**27** files, **11** sharing a skill name, **10** command-only `/mk:` targets that are exactly the named
  set, **2** non-references); the script inventory (**22** files under `.claude/scripts/`, **5** `.py` and
  **1** `.sh`, and the zero-caller set being exactly `checklist.py`, `cost-report.py`, `rules-audit.sh`,
  `validate-docs.py`); the journey set (**12** specs, **0** Jira or Confluence, `check-journey-specs.py:30,44`
  hardcoding `j01…j12` and the count, run by CI at `ci.yml:141`); the integration universe (**24** skills,
  **22** agents — measured **12 167 B** and **6 574 B** against the contract's 12 407 and 6 636, within
  extraction noise); the agent metadata (**42** agents with frontmatter out of 44 `.md` under
  `.claude/agents/`, **14 311 B**, avg **341** — the contract's 14 391/343 confirmed); the docs universe
  (**37** files naming a path in the contract's own list, **12** under `docs/`, **25** under
  `packages/docs/content/`, **2** of them changelog); and the existence of every committed check the ACs
  name. Also confirmed as **correctly bounded**: the 99-byte rules headroom cannot be silently spent — AC-03,
  AC-04 and AC-07 each pin the rules subtotal at or below **25 501 B**, stricter than the 25 600 literal that
  Scope (Out) forbids raising, and the two rule-byte **additions** this sprint makes are each net-negative at
  the destination (`.claude/hooks/injection-audit.cjs` is shorter than `.claude/scripts/injection-audit.cjs`
  at both `injection-rules.md:56` and `gate-rules.md:95`, and D8's shortened pointer plus AC-03's path-list
  shortening pay for the `workflow.yaml` move). And **no AC moves security, injection or gate content out of
  always-on**: AC-13 keeps all five safety rules as files under `.claude/rules/` under
  `scripts/check-rule-survival.cjs`, Scope (Out) forbids the move, and the only in-scope edits to an always-on
  safety rule are a path string, a reviewer path list and one `/mk:` target name — no enforcement clause
  relocates.
- Round 1 (reviewer): AC-07 / D7 / Definitions — the always-listed total at BASE is **111 592 B**, not
  94 060 B, so the cut this sprint owns is **≥41 592 B (37 %)**, not ≥24 060 B (26 %). Measured on the ship
  set with a YAML parse of each file's frontmatter and `Buffer.byteLength` over the scalar values the
  Definitions name: rules **25 501 B** (confirmed), **125** shipped `SKILL.md` → **71 780 B** (avg **574**),
  **42** shipped agents → **14 311 B** (avg **341**). The agent figure is the contract's; the skill figure is
  **17 612 B higher** than the contract's 54 168 B (avg 433), and no field subset reproduces 54 168 —
  `name`+`description` is **47 531**, `description` alone **45 752**, `description`+`when_to_use` **70 001**,
  `when_to_use` alone **24 249**, all three **71 780**, and every one of the 125 files has a `when_to_use`, so
  the gap is not a missing-field artefact. Outside-rules is therefore **86 091 B**, not 68 559 B. The ≤70 000
  gate stays achievable — the phase's caps re-derived at the measured counts still sum to 65 780 — but with
  the rules subtotal pinned at 25 501 the metadata must come down to **≤44 499 B** across **124** shipped
  skills (after AC-05 removes `skills/benchmark/`) and 42 agents, i.e. roughly **308 B per skill** at 150 B
  per agent. That makes AC-07 a rewrite of essentially all **166** metadata blocks, not a trim of the worst
  offenders, and D14's "nothing else is deferrable" was reasoned against the smaller number. Restate the
  Given, D7's arithmetic and the Definitions' 94 060, and **name the extraction method in the Definitions** —
  YAML-parsed scalar values of `name` + `description` + `when_to_use` from the ship-set inventory, byte
  length, no line-based parsing — because three plausible extractors give three different totals and AC-07's
  gate is a single number compared against one of them.
- Round 1 (reviewer): AC-06 the no-Python clause is contradicted by the tree and by D6's own retention, and is
  simultaneously too narrow on the shell it is actually about. The shipped kit carries **80** `.py`/`.sh`
  files under `.claude/`, of which only **6** are the `.claude/scripts/` members the Given names; the other
  **74** are skill scripts (`multimodal` **14**, `web-to-markdown` **9**, `confluence` **5**, `story-sizer`
  **5**, `tech-graph` **5**, `agent-browser`/`benchmark`/`context-audit`/`evaluate`/`jira` **3** each, and 19
  more). Those are exactly what `skill-python.cjs` exists to run — D6 keeps it for its callers and D6 calls it
  "the lazy-Python entrypoint", which has nothing to run if the Python leaves — and `check-no-python.cjs`
  already documents the real invariant as "the kit's **core runtime** needs no Python", not "the kit ships no
  Python". AC-14 also measures "every new or changed … `.sh`, `.py`" file, which presumes they survive. In the
  other direction, **8 of the 9** `.claude/scripts/bin/` entries are `#!/usr/bin/env bash` with **no
  extension** (`meowkit-{diff-scope,repo-mode,slug}`, `setup-workflow`,
  `workflow-{diff-scope,repo-mode,review-log,slug}`), so an assertion "by extension over the whole shipped
  tree" misses every shell file in the directory the requirement is aimed at. Restate the clause as a property
  over the paths the requirement owns — zero `.py`/`.sh` **and** no non-Node shebang under
  `.claude/scripts/`, `.claude/scripts/bin/` and `.claude/hooks/`, asserted by **shebang**, not by extension —
  or, if whole-tree zero-Python is genuinely intended, say so explicitly, name the 74 files, and reverse the
  lazy-Python decision in a Decision of its own, because that is a different sprint from redistributing 22
  scripts.
- Round 1 (reviewer): AC-02 the reference-rewrite universe has no declared scope and its two numbers exclude
  each other. "the **10** command-only `/mk:` targets named across **38** files (`/mk:plan` alone in **39**
  files)" cannot both hold — 39 does not fit inside 38 — and neither number matches a measured scope. By
  exact token (`/mk:plan` not matching `/mk:plan-creator`): files naming **any** of the ten are **30** in the
  shipped kit, **60** git-tracked outside `tasks/` and `.claude/worktrees/`, **21** of those under `docs/` +
  `packages/docs/content/`; `/mk:plan` alone is **11** kit files, **32** repo files, **14** docs files. AC-02
  asserts "**0** unresolved, including the 38 rewritten files" as a pass condition, and AC-12 separately owns
  the docs tree, so as written each criterion can pass on its own slice while the other's references dangle —
  the measured kit figure (30) is not the measured repo figure (60) and the docs overlap (21) is claimed by
  neither. State the number **with its scope** for each of the two claims, and say which of AC-02 and AC-12
  owns the `docs/` + `packages/docs/content/` occurrences of a command-only target.
- Round 1 (reviewer): AC-09 the `tasks/` decomposition is wrong in a way that silently leaves a file behind.
  The total **13** is right, but it is **7** `.gitkeep` markers and **5** `tasks/templates/*.md`, not 8 and 4 —
  the Given's own parenthesis lists exactly seven directory names (`active`, `autobuild-runs`, `backlog`,
  `contracts`, `guidelines`, `plans`, `reviews`) under the word "eight", and the templates are
  `bead-template.md`, `plan-phase.md`, `plan-quick.md`, `plan-template.md` and **`pm-status-template.md`**.
  An agent rehoming "four templates" leaves `pm-status-template.md` neither rehomed nor accounted for, and the
  AC's `13`-file assertion still passes because the total is unchanged. Restate as 7 + 5 + 1 and enumerate the
  five template names, so the rehome is checkable per file rather than per count.
- Round 1 (reviewer): sprint width — the proposer's own concern is well founded and the measurement above
  turns it into a concrete risk, so the recommendation is to **split**. The risk a split removes is not
  volume, it is that **AC-07 measures a budget whose denominator the same sprint is restructuring**: AC-02
  promotes up to four new skills (new metadata), AC-05 takes `skills/benchmark/` out of the shipped inventory
  (less metadata), AC-08 rewrites 46 of the same files AC-07 is counting, and AC-03/AC-04/AC-06 each change
  `.claude/rules/**` bytes that AC-04 and AC-07 both pin at ≤25 501 against **99 bytes** of headroom — and the
  cut is now 37 %, across 166 metadata blocks, not 26 %. One question with a moving answer is the defect
  pattern D7 itself invokes. Proposed shape: **8a — shape and removals** (AC-01–AC-06, AC-09, AC-10, AC-12,
  AC-13, AC-14 scoped), which settles the inventory first; **8b — metadata budget, integrations and the
  spike** (AC-07, AC-08, AC-11, AC-14 scoped), measured against the settled inventory. The safety and
  zero-residue criteria stay with 8a because they share the golden corpus. If the sprint stays whole instead,
  AC-07 must state the **order** explicitly — the budget gate is wired and the total measured only after
  AC-02's promotions and AC-05's exclusions have landed — and carry that sequencing as a pass condition, not
  as a note, or the first green run of the new gate will be against an inventory that changes under it.
- Round 1 (reviewer): the three open questions are answered by the orchestrator; adopt them in round 2 and
  state which branch question (iii) took. (i) The budget is **70 000 B decimal**, as proposed — D7's decimal
  reading of the phase's own arithmetic is confirmed, and no rounding to 71 680 is available. (ii)
  `skills/benchmark/` leaving the shipped kit is **intended**: the phase makes benchmarks source-repo-only and
  `/mk:benchmark` runs from this repository, so AC-05's "no shipped skill loses its data" clause and the
  `dead-weight-audit-rules` unshipped marking are the right shape and need no narrowing. (iii) The live
  before/after routing run must be made **executable by the build agent** — `claude -p` against the hub skill
  with a named model id, both runs' outputs recorded in sprint evidence — if that is feasible on this host;
  if it is not, AC-08 keeps the ≥6 specs plus the structural CI check and the live run becomes the **explicit**
  D14 deferral with its reason recorded, never a silent gap. Name the branch taken in AC-08 rather than
  leaving "run live" unqualified, because a non-executable verification line is the one thing this contract
  cannot be graded on.
- Round 1 (reviewer): AC-13 the one always-on safety-rule text this sprint rewrites is not covered by the
  check AC-13 leans on. AC-02 rewrites `/mk:audit` at `rules/security-rules.md:26` — inside the Enforcement
  clause "**Reviewing existing code** (`/mk:review`, `/mk:audit`): flag as **WARN**, document it in the
  verdict, do not auto-fix". `scripts/check-rule-survival.cjs` reads its needles from
  `scripts/rule-survival-oracle.cjs`, whose `ORACLE` is the 11 injection headings, the **12** security
  blocked-pattern table rows, the 9 gate conditions, the A1 status block and table, the 6 core-behaviour
  headings and 15 development phrases — the Enforcement prose is **not** a needle, so AC-13's "each still
  carries its enforcement clauses, asserted by the committed rule-survival check" does not reach the one
  clause being edited. Either add a needle for the WARN/document/do-not-auto-fix clause in the same change, or
  state in AC-13 that this clause is asserted by direct before/after comparison and name it — a disclosed
  edit with no probe is the gap this contract is otherwise careful to close.
- Round 1 (reviewer): four corrections to record in round 2. They do not change what an AC tests, so none is a
  separate clarification, but each is a stated number or reason the tree does not support. (a) **D12's reason
  for removing `reinstall-empty-dirs` is not the one the code shows.** The flag is parsed
  (`commands/migrate.ts:74`), typed (`migrate/types.ts:138`) and conflict-checked against
  `--respect-deletions` (`migrate/migrate-mode-resolver.ts:23`), and **consumed by no migration logic at
  all** — it has no implementation for `tasks/` or for anything else, so it never had the subject D12 says it
  loses. The removal is right and AC-09's assertion is testable; say "dead option, parsed and validated but
  never consumed" instead. (b) **AC-03's "named in exactly two places" is low by six.** Besides
  `rules/gate-rules.md:69` and the `check-gate-authority` fixture, `modes/**` is a declared **`base.globs`**
  entry (`.meowkit/pack-manifest.json:27`) and `.claude/modes` is named by `README.md:107`,
  `RELEASING.md:173`, `docs/maintainer/docs-reference-contract.md:8` and
  `docs/operations/docs-references-inventory.md:79`. None is a load path, so the zero-reader finding stands
  unchanged — but two of them are files an AC must edit, and `README.md`/`RELEASING.md` are named by no AC at
  all. (c) **AC-12's Given path list omits `agent-memory/`**, which AC-05 removes; including it makes the docs
  universe **38** files and **36** non-changelog rather than 37 and 35. The 37/35 figures are correct for the
  list exactly as written, so state which list governs the count. (d) **AC-06's "nine `scripts/bin/` entries
  that are five jobs twice over"** is arithmetically impossible and factually **3** duplicated jobs
  (`meowkit-` / `workflow-` × `diff-scope`, `repo-mode`, `slug`) plus **3** unpaired (`setup-workflow`,
  `workflow-config`, `workflow-review-log`). The one-name-per-job clause is testable as written; the Given
  should say 3 pairs + 3 singletons so the agent does not go hunting for two more pairs.
- Round 2 (proposer/generator): all seven clarifications and all four corrections addressed, every change a
  replacement rather than a deletion, and **every reviewer finding independently re-derived at BASE before
  being accepted — all eleven held.** Re-confirmed here: the always-listed metadata extraction (**125**
  shipped `SKILL.md` → **71 780 B**, **42** agents → **14 311 B**, total **111 592 B**, and round 1's
  54 168 reproduced by no field subset); `base.globs` declaring `agent-memory/**`, `schemas/**`, `modes/**`,
  `rubrics/**` and `rules-conditional/**` at `pack-manifest.json:22-30` with `workflow.yaml` in
  `base.files`; `README.md:9`'s counts banner, `README.md:107`'s tree line and `RELEASING.md:173`'s
  `modes/*` row, none of which any round-1 AC owned; the docs universe at **38** files once `agent-memory/`
  joins the governing list — **13** under `docs/`, **25** under `packages/docs/content/`, **2** changelog,
  **36** editable; the five templates including `pm-status-template.md`; `reinstall-empty-dirs` parsed at
  `commands/migrate.ts:74`, typed at `migrate/types.ts:138`, conflict-checked at
  `migrate/migrate-mode-resolver.ts:23` and consumed nowhere; the `bin/` composition as 3 duplicated jobs
  plus 3 unpaired entries with 8 of 9 extensionless bash; the 74 skill-owned `.py`/`.sh` files
  `skill-python.cjs` exists to run; and the `rule-survival-oracle.cjs` `ORACLE` carrying no needle for the
  `security-rules.md:26` Enforcement clause.
  **The sprint is SPLIT, per the orchestrator's decision on the width finding (D15, new).** This contract is
  shape and removals: **eleven** ACs — the former AC-01–AC-06, AC-09, AC-10, AC-12, AC-13 and a scoped
  AC-14, renumbered contiguously AC-01–AC-11. The metadata budget, the integration rewrite with its routing
  specs and the SubagentStart spike move to a **sprint 9** contract proposed after this lands and measured
  against the settled inventory. Decision numbers are **stable**: D7, D10, D11 and D13 are retained in place
  as **deferral records** carrying their decided positions and sprint 9's inherited numbers, so nothing is
  silently dropped; D14 is restated for eleven ACs and D15 records the split, its reason (the budget would
  measure a denominator this same sprint restructures — new skills from AC-02, one fewer from AC-05, 46
  rewritten files, and rules bytes against 99 bytes of headroom) and its cost (`plan.md`'s "≤70 KB
  always-listed" acceptance criterion is **not** met when sprint 8 lands, so sprint 8 is an explicit partial
  delivery). Scope (In) loses the three deferred bullets, Scope (Out) gains them as named deferrals, and the
  Out-of-Scope list leads with "do not shorten a description, wire the budget gate, or add a journey spec".
  Item by item: **(C1)** the corrected **111 592 B** and the **named extractor** (YAML-parsed frontmatter
  scalars of `name` + `description` + `when_to_use` over the ship-set inventory, `Buffer.byteLength`, never
  line-based) are carried into the Pinned baseline, the Definitions and D7, together with the arithmetic
  sprint 9 inherits — ≥41 592 B (37 %) to cut, ≤44 499 B of metadata across 124 skills and 42 agents, ≈308 B
  per skill at 150 B per agent, a rewrite of all 166 blocks. AC-11 additionally asserts that **no**
  integration description and **no** journey spec changed in this sprint, so sprint 9's denominator is the
  one it is told to expect. **(C2)** AC-06 is restated as the **Node-only-executable property** — zero
  `.py`/`.sh` **and** no non-`node` shebang under `.claude/scripts/`, `.claude/scripts/bin/` and
  `.claude/hooks/`, asserted by first line because 8 of 9 `bin/` entries are extensionless bash — with an
  explicit clause that the **74** skill-owned scripts are unchanged in count and location, a Definitions
  entry for the property, and D6 recording that whole-tree zero-Python is **not** decided because it would
  reverse the lazy-Python decision. **(C3)** AC-02's Given carries the exact-token counts **with scope**
  (30 kit / 60 git-tracked outside `tasks/` and `worktrees/` / 21 docs; `/mk:plan` 11 / 32 / 14) and its Then
  assigns ownership: **AC-02 owns the 39 non-docs files, AC-09 owns the 21 docs files**, the sets are
  disjoint, their union is the measured 60, and both criteria assert the partition so neither can pass on a
  slice. **(C4)** AC-07 restates `tasks/` as **7** `.gitkeep` + **5** templates + **1** README with the five
  template names enumerated, and asserts the rehome **per file by name** rather than by count, so
  `pm-status-template.md` cannot be left behind under a matching total. **(C5)** the split, as above.
  **(C6)** the three answers are recorded in the deferral notes: (i) **70 000 B decimal** in D7; (ii)
  `skills/benchmark/` leaving the shipped kit is **intended**, recorded in D5 and AC-05's Given; (iii) the
  live routing run's branch is sprint 9's to name — `claude -p` against the hub with a named model id and
  both runs recorded, or an explicit deferral with its reason — and D11 forbids leaving it unqualified.
  **(C7)** AC-10 now requires a **needle** for the `security-rules.md:26` Enforcement clause added to
  `scripts/rule-survival-oracle.cjs` in the same change, with `check-rule-survival.cjs` asserted to **fail**
  when that clause is deleted from a scratch copy — a probe, not a disclosure — and Scope (In) and the
  Out-of-Scope list carry the matching entries. Corrections: **(a)** D12's reason is now "dead option,
  parsed and validated but never consumed", with all three citations; **(b)** AC-03's Given states **eight**
  naming places and its Then assigns a named owner to each — this criterion for the rule path list and the
  fixture, AC-01 for `README.md`, `RELEASING.md` and the `base.globs` entry, AC-09 for the two `docs/`
  pages; **(c)** AC-09 states that the **Definitions' relocated-path list governs**, giving 38 / 36 and
  recording that 37 / 35 were right for the narrower list; **(d)** AC-06's Given says **3 duplicated jobs
  plus 3 unpaired entries**.
  Round 2 also records two deliberate consequences of the split rather than leaving them implicit: the
  rules-subtotal pin at **≤25 501 B** now lives in AC-03, AC-04 **and AC-11** — round 1 had it in AC-07,
  which is leaving — and the ≤4 promotion cap stays in D3 even though the budget gate moved, because the
  cap's purpose is to bound what sprint 9 has to pay for. One thing round 2 does **not** do, and says so: it
  does not pre-assign the five undecided command dispositions (`arch`, `breakdown`, `delegate`, `design`,
  `status`), which need each command body read against the candidate skill's `when_to_use`; the contract
  bounds that judgement with the closed disposition set, a named target per row, the ≤4 cap and the
  no-pure-dispatcher clause.
- Round 2 (reviewer): **accepted.** All seven round-1 clarifications and all four corrections are resolved in
  criterion or decision text, each by replacement rather than deletion, and each re-verified at BASE
  `de278a5f`. **(C1)** D7 and the Definitions now carry **111 592 B** (rules 25 501 + 125 skills 71 780 + 42
  agents 14 311) and the **named extractor** — YAML-parsed frontmatter, `Buffer.byteLength` over the scalar
  values, ship-set inventory, never a line-based or regex extraction — which is the measurement I reproduced;
  the corrected arithmetic (≥41 592 B, ≤44 499 B of metadata, ~308 B per skill over 166 blocks, caps still
  summing to 65 780) travels with the deferral instead of being lost in it. **(C2)** the Node-only-executable
  property is now a **shebang** property over `.claude/scripts/`, `.claude/scripts/bin/` and `.claude/hooks/`,
  AC-06 asserts the **74** skill-owned scripts are unchanged in count and location, and Scope (Out) forbids
  touching them — so the clause no longer contradicts D6's own retention of `skill-python.cjs`, and the 8
  extensionless `bash` entries in `bin/` are now inside the property rather than outside it. **(C3)** the
  reference universe is scoped and **partitioned**: AC-02 owns **39** non-docs git-tracked files, AC-09 owns
  **21** docs files, both state the union is the measured **60** and both verification lines assert
  disjointness — the failure mode where each criterion passes on its own slice is closed. **(C4)** AC-07
  carries **7 + 5 + 1** with all five template names, and asserts the rehome per file by name, so
  `pm-status-template.md` cannot hide behind a matching total. **(C5)** the split is D15, and I re-checked
  it leaves **no orphan**: phase-07 Requirements 1, 2, 3, 4, 5 and 9 land in AC-07, AC-02, AC-04, AC-03,
  AC-06 and AC-08; Requirements 6, 7 and 8 are each held by a numbered deferral record (D10+D11, D7, D13)
  that D15 routes to sprint 9; the phase's maintainer-only content, docs/projection, safety and repo-green
  work land in AC-05, AC-09, AC-10 and AC-11; of the six Success Criteria, the four this sprint owns are
  bound and the two deferred ones (≤70 KB total, ≥6 routing cases) are the deferrals — and **D15 states
  plainly that `plan.md`'s always-listed criterion is therefore not met when sprint 8 lands**, which is the
  disclosure a split needs to avoid reading as a silent miss; of the three Risk Assessment rows, the moved-path
  risk is AC-04's, the mis-routing risk travels with D10/D11 and is **not incurred** here because AC-11
  asserts no integration description and no journey spec changes, and the deleted-slash-command risk is D2's
  release-note clause. **(C6)** all three answers are recorded where the work is: 70 000 B decimal in D7,
  the intended `skills/benchmark/` departure in D5 and AC-05's Given, and D11's prohibition on sprint 9
  leaving the live-run branch unqualified. **(C7)** AC-10 requires the needle in
  `scripts/rule-survival-oracle.cjs` **in the same change** and requires `check-rule-survival.cjs` to **fail**
  when the clause is deleted from a scratch copy — the one always-on safety sentence this sprint rewrites now
  has a probe. Corrections (a)–(d) are all carried, and (b)'s owner assignment in particular closes the gap
  I found: `README.md` and `RELEASING.md` had been named by no criterion, and AC-01 now owns them with the
  `README.md:9` counts banner — verified present and stating `125 skills · 42 agents · 27 commands · 7 modes
  · 7 rules · 5 conditional rules · 27 hook scripts`, every one of those counts affected by this sprint.
  Re-verified at BASE and unchanged: the rules subtotal pin at **≤25 501 B** survives the split in **three**
  criteria (AC-03, AC-04 and the restated pin in AC-11's Given), the 25 600-byte literal and the 99-byte
  headroom are both protected by Scope (Out), and **no criterion moves security, injection or gate content
  out of always-on** — the five safety rules stay as files under `.claude/rules/` under
  `check-rule-survival.cjs`, and the three in-scope edits to an always-on rule are a path string
  (`injection-rules.md:56`, `gate-rules.md:95`, shorter at the destination), a reviewer path list
  (`gate-rules.md:69`) and one `/mk:` target name (`security-rules.md:26`, now needled). The five undecided
  dispositions (`arch`, `breakdown`, `delegate`, `design`, `status`) are **gradeable as bounded**: a closed
  four-value set, exactly one value per row across 27 rows, a named and resolvable target per row, a ≤4
  promotion cap and the no-pure-dispatcher clause are each checkable by reading the committed table against
  the finished tree, which is all an evaluator needs — the budget's departure removes a cost signal, not a
  bound, and sprint 9 recomputes the total with the named extractor so no number is stranded.
  One correction to carry into implementation, recorded rather than negotiated because AC-01's own Then
  already asserts the property over all eleven departing entries: **AC-01's and D1's "six of them declared
  base content" is low — eight are declared.** The `base.globs` array (`.meowkit/pack-manifest.json:21-30`)
  contains **`scripts/**` at line 23** alongside the five AC-01 names (`schemas/**` :24, `agent-memory/**`
  :26, `modes/**` :27, `rubrics/**` :28, `rules-conditional/**` :29), and beyond the globs
  `workflow.yaml` is `base.files` :7 and `commands` is `base.commands` :31. So the declarations to remove are
  six globs plus one file plus the commands key, not five plus one. AC-01's Then — "each of the eleven
  departing entries is absent from `base.files`, `base.globs` and `base.commands`" — and its verification grep
  over all eleven both catch `scripts/**` regardless, so no pass condition is weakened and this is not a
  round-3 item; the Given's count is simply wrong and an agent reading only the Given would leave
  `scripts/**` declared against an archive that no longer carries it. Accepted on that basis, with the note
  that the next edit of AC-01 should say eight.

## Amendments (if any)

None.
