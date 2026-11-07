---
contract_schema_version: 1.0.0
task: meowkit-v3-lean-runtime
sprint: 4
plan_ref: tasks/plans/261101-meowkit-v3-lean-runtime/plan.md
rubric_preset: cli-tool
status: negotiating
generator_signed: f9a05de067232d5d5544906b8f5aee894dabd96e
evaluator_signed: null
rounds: 2
created: 261108-0321
---

# Sprint 4 Contract — Lazy per-skill Python; `mewkit setup` becomes optional

Testable translation of `phase-05-lazy-python.md` (Requirements, Related Code Files, Success Criteria, Security
Considerations), bounded by `plan.md` Decisions 1–7 and Constraints. Inventory evidence for every number and path below:
`tasks/reviews/evidence/261108-meowkit-v3-lean-runtime-sprint-4/py-inventory.md`.

## Pinned baseline

- BASE = `a190cc91692acf90fb3bfde4c3aee2479f717d9e` — the phase 02 (node-only hooks) commit, which is the last commit
  before this sprint. The generator replaces this placeholder with the real SHA in the `sign` step; the contract MUST
  NOT be signed while the placeholder is still present.
- Every "at BASE" claim and every `git diff BASE` in this contract resolves against that commit.
- At BASE the only `.sh` or `.py` under a hook path is `.claude/hooks/ensure-skills-venv.sh`
  (`py-inventory.md` §1), and `tests/hooks/golden/` holds 82 fixtures (83 files including `index.json`, whose own
  `fixtureCount` is 82), none of which invokes Python.

## Decisions (user standing directive 261108: follow recommended options)

Ten points where the phase-05 spec was ambiguous or contradicted by the tree. The user's standing instruction for this
plan is to take the recommended option on every one, so D1–D10 below are DECIDED, not proposed. Every AC is written
against them and no alternative remains open.

- **D1 `injection-audit` has exactly one implementation, in node.** At BASE it is also a Python *library*:
  `web-to-markdown/scripts/persist_fetch.py:173-185` imports it through `importlib` and calls `scan_file`, and
  `story-sizer/scripts/check-auto-create-gating.py:146` probes for the file. DECIDED: port to
  `.claude/scripts/injection-audit.cjs` with a single-file mode (`--file <path>`, machine-readable findings on stdout),
  and rewrite both Python consumers to invoke that mode as a subprocess. A parallel `.py` scanner is forbidden — two
  pattern sets would silently drift on a safety path.
- **D2 `workflow-config` becomes one node CLI resolving canonical → legacy.** At BASE it reads
  `.claude/meowkit.config.json` (`.claude/scripts/bin/workflow-config:9`), a path the TS side already calls LEGACY
  (`state/resolve-config-path.ts:13`) with canonical `.meowkit/config.json` (`:15`); phase 03 will introduce
  `.meowkit/config.yaml`. The file does not exist in this repo, so all 9 preamble call sites already take their
  fallback. DECIDED: one node CLI keeping BASE argv semantics (`get`/`set`/`has`) that resolves the config path exactly
  as the TS resolver does — canonical first, legacy fallback — so phase 03 changes one resolver and not 9 preambles.
  `.claude/scripts/bin/meowkit-config` is DELETED: same logic, different name and override variable
  (`${MEOWKIT_CONFIG:-...}` where `workflow-config:9` has `${WORKFLOW_CONFIG:-...}`), with no reference outside its own
  directory. Neither override variable is set anywhere in the tree, and the node port deliberately drops both (AC-08).
- **D3 `plan-creator/scripts/validate-plan.py` is ported to TypeScript.** The phase-05 premise "core workflow
  (plan → cook → review → ship) must work with no Python" is false at BASE: `plan-creator/step-04-semantic-checks.md:45`
  makes the Python structural validator a MANDATORY step for every planning mode except `fast` and `product-level`, so
  Gate 1 is Python-dependent. DECIDED: port it to TS under `mewkit plan check --structural` and repoint all 9
  referencing files. `plan-creator` therefore stops being a Python skill.
- **D4 `requires_runtime` is an explicit schema property, separate from `runtime`.** `skill-schema.json` already
  declares `runtime` (`enum: claude-code|portable|experimental`, "execution environment required by this artifact") on
  all 125 SKILL.md files, and `additionalProperties: true` means an unknown key is accepted silently today. DECIDED:
  keep the spec's `requires_runtime` name for the *interpreter* requirement, add it as an explicit property, and have
  the validator reject both confusions (an interpreter value in `runtime`, a provider value in `requires_runtime`).
- **D5 Port set for validators: frontmatter in, docs-references deleted, skill test suites stay Python.** DECIDED:
  `scripts/validate-skill-frontmatter.py` (CI, needs `pyyaml`+`jsonschema`) is ported to TS, because otherwise the D4
  rule only runs where Python exists. `.claude/scripts/check-docs-references.py` and
  `.claude/scripts/tests/test-check-docs-references.py` are DELETED, not ported: a line-for-line TS port already exists
  (`core/check-docs-references.ts:107`, wired at `commands/validate.ts:227`) and is already a CI step. `.claude/scripts/tests/test-validate-skill-frontmatter.py`
  (`ci.yml:211`) is DELETED together with the validator it tests, and its assertions are ported into the TS validator's
  own test file — it must not survive as a subprocess test against a deleted subject. The four skill-level Python test
  suites in CI (multimodal, figma, web-to-markdown, scale-routing) stay Python — they test Python code owned by a
  skill, and CI may install Python. `tests/journey-validation/check-journey-specs.py` (`ci.yml:134`) is NOT one of them:
  no skill owns it, so it is repo-dev tooling under D10.
- **D6 `.claude/scripts/{validate,security-scan,checklist,cost-report,validate-docs,check-anthropic-context}.py` are
  out of scope.** None is hook-called; `checklist.py` and `validate-docs.py` have no live caller at all
  (`py-inventory.md` §3d). DECIDED: not ported and not deleted this sprint — flagged for phase 07 (kit shape). The only
  change touching them is dropping the four names `commands/doctor-checks.ts:140` hard-codes as "expected scripts".
- **D7 jira / confluence / playwright env relocation is IN scope.** Those three install *binaries* into the shared venv
  (`jira/scripts/jira-as.sh:9`, `commands/mk/confluence-setup.md:11`, `lib/system-deps-registry.ts:87-111,173-189`), so
  they break the moment the shared venv stops being created. DECIDED: mechanical path move to `.meowkit/envs/<skill>/`,
  no behavior change.
- **D8 `trace-analyze` and `benchmark` lose their Python JSON parses.** Nine files use venv Python purely as a `jq`
  replacement (`trace-analyze/SKILL.md:65` is explicit about it) while node is guaranteed present. DECIDED: port those
  parses to node — 6 trace-analyze step/reference files and 3 benchmark shell scripts — so neither skill needs
  `requires_runtime`.
- **D9 The no-Python verb list is pinned HERE, not in phase 06.** The phase-05 success criterion refers to "every agent
  verb in the phase 06 contract list", which does not exist yet. DECIDED: AC-10 pins the 23-verb list; phase 06
  inherits it. `validate --parity` is NOT on it and is not asserted anywhere: no `parity` flag exists in the command
  catalogue (`cli/command-catalogue.ts:141-148` declares only `workflow`, `gates`, `ownership`, `agents`, `packs`,
  `memory`) and `validate` ignores unknown flags, so asserting it would pass vacuously. Parity is covered by
  `validate --target codex|cursor` in AC-11.
- **D10 Repo-dev tooling stays Python and is out of scope.** Four files are repo-development and CI tooling: never
  shipped into a user project, never reached at hook time, owned by no skill —
  `scripts/check-hook-registration.sh:44` (python3 JSON parse of `settings.json`),
  `.claude/scripts/lint-brand-prose.sh:39-40` → `check-anthropic-context.py` (hard-exits without python3),
  `scripts/telemetry-decisions.py:16-18` (documents the shared-venv python in its usage block; D6 does not reach it,
  being scoped to `.claude/scripts/*.py`) and `tests/journey-validation/check-journey-specs.py` (`ci.yml:134`, a
  repo-level test with no owning skill). DECIDED: left as Python; the no-Python check in AC-10 does not cover them, and
  AC-02's grep exempts the two that name the shared venv. `check-journey-specs.py` may keep a CI-local interpreter that
  is NOT `.claude/skills/.venv`.

## Definitions

- **Per-skill env:** a directory `.meowkit/envs/<skill>/` holding one interpreter environment for exactly one skill,
  where `<skill>` is the skill's directory name under `.claude/skills/`.
- **Shared venv:** `.claude/skills/.venv` — the BASE single environment. "The kit does not create a shared venv" means
  no file shipped in the kit, and no `mewkit` subcommand, creates or writes into that path.
- **Python skill:** a skill whose documented invocation path executes a `.py` file after this sprint. Closed list of
  12: `multimodal`, `web-to-markdown`, `story-sizer`, `tech-graph`, `planning-engine`, `skill-creator`,
  `scale-routing`, `llms`, `confluence`, `figma`, `prompt-enhancer`, `evaluate`. `plan-creator` is NOT on it (D3
  ports its validator to TS); neither is `trace-analyze` or `benchmark` (D8 ports their JSON parses to node).
- **Resolver:** the small module a skill script calls to locate its per-skill interpreter; on absence it prints
  remediation and exits non-zero. It never installs anything.
- **Hook time:** any execution reached from a `.claude/settings.json` hook registration, from `dispatch.cjs`, or from a
  SKILL.md `hooks:` block.
- **No-python environment:** a shell where `command -v python3`, `python`, and `py` all fail, `.claude/skills/.venv` is
  absent, and `.meowkit/envs/` is empty.
- **Core verb:** one of the `mewkit` subcommands listed in AC-10.

## Scope (In)

- Delete `.claude/hooks/ensure-skills-venv.sh` and its `settings.json` registration; remove the Python-venv warning
  block from `handlers/project-context-loader.cjs` and the `ensure-skills-venv.sh` entry from
  `commands/doctor-hook-runtime.ts` `SWEEP_EXCLUDE` and from `HOOKS_INDEX.md`
- Per-skill envs at `.meowkit/envs/<skill>/`, ignored in both `.gitignore` and `.meowkit/gitignore.meowkit`
- `mewkit skill env <skill>` (create / repair / list), plus the resolver that skill scripts call
- `mewkit setup` reworked: optional, idempotent, no shared venv; `setup-steps.ts` `venv`/`deps` steps,
  `core/dependency-installer.ts`, `core/skills-dependencies.ts` and `lib/system-deps-registry.ts` repointed to
  per-skill envs
- `requires_runtime` property in `.claude/schemas/skill-schema.json` + an enforcing validator (D4), declared on every
  Python skill
- Node ports: `injection-audit` (D1), `workflow-config` (D2), `validate-plan` (D3), skill-frontmatter validator (D5),
  `trace-analyze` + `benchmark` JSON parses (D8); deletion of the docs-references Python pair (D5)
- Two new pin files, so AC-04 and AC-09 can both hold once `ci.yml:103`'s blanket
  `pip install pyyaml jsonschema pytest` is deleted: a `requirements.txt` for `figma` pinning `pyyaml` (its
  `evals/validate-evidence-packets.py` imports `yaml`) and a test-dependency pin for `web-to-markdown` adding `pytest`
  (its CI step runs `-m pytest`, which nothing currently pins)
- `.github/workflows/ci.yml`: the shared-venv setup step and every `.claude/skills/.venv/...` prefix replaced
- Consumers: `commands/doctor-checks.ts` (`checkScripts` expected list, `checkPython` demoted to advisory),
  `rules/injection-rules.md` Rule 10 LOG line, `rules/gate-rules.md:95`, `agents/security.md:45`,
  `skills/vulnerability-scanner/SKILL.md`, and all 54 files under `.claude/` that name the shared-venv Python path —
  46 under `skills/`, 4 agents, 2 under `hooks/` (both covered by AC-01), 1 under `commands/` (confluence, D7) and 1
  under `.claude/scripts/` (`tests/test-validate-skill-frontmatter.py`, deleted by D5) — plus `jira`/`confluence`
  binary resolution (D7)
- Regenerated codex and cursor projections; `validate --target codex|cursor`
- A scriptable no-Python check committed to the repo, plus the recorded manual `/mk:cook` journey

## Scope (Out)

- The six non-hook, non-CI `.claude/scripts/*.py` (D6) — not ported, not deleted this sprint
- The four skill-level Python test suites in CI (D5: multimodal, figma, web-to-markdown, scale-routing) — they stay
  Python
- Repo-dev tooling (D10), all keeping their Python: `scripts/check-hook-registration.sh`,
  `.claude/scripts/lint-brand-prose.sh` → `check-anthropic-context.py`, `scripts/telemetry-decisions.py` and
  `tests/journey-validation/check-journey-specs.py` (which may keep a CI-local interpreter that is not
  `.claude/skills/.venv`); never shipped, never reached at hook time
- Rewriting any Python skill's logic; only its env location, resolver call and frontmatter change
- Reading `hooks.*` or any other key from `.meowkit/config.yaml` (phase 03); D2 only aligns the resolution order
- Any change to what Gate 1, Gate 2, privacy-block, pre-ship, post-write or pre-completion-check decide
- Adding a new skill, a new provider target, or a new `mewkit` verb beyond `skill env` and `plan check --structural`
  (D3, a subcommand of the existing `plan` verb)
- Windows per-skill env layout parity testing beyond the path construction asserted in AC-04
- Deleting `.claude/scripts/bin/{workflow,meowkit}-{slug,diff-scope,repo-mode}` or `workflow-review-log` (bash, no
  Python — phase 07)

## Acceptance Criteria

### [AC-01] The SessionStart Python bootstrap is gone

**Given** the finished change
**When** `.claude/settings.json` hook registrations are parsed and the repo is grepped for `ensure-skills-venv`
**Then** `.claude/hooks/ensure-skills-venv.sh` does not exist; `SessionStart` has at most 2 command registrations and
none of them runs `bash`, `sh`, a `.sh` file or any Python; no reference to `ensure-skills-venv` remains in `.claude/`,
`.github/`, `scripts/`, `packages/mewkit/src/` or `docs/` (incl. `HOOKS_INDEX.md:10,42` and
`commands/doctor-hook-runtime.ts:17` `SWEEP_EXCLUDE`, which becomes empty or loses only that entry); and
`handlers/project-context-loader.cjs` emits no "Python venv not found" block for any input

- **Verification:** parse `settings.json`; `grep -rn ensure-skills-venv`; run the project-context-loader golden fixtures
  in a tree with no `.claude/skills/.venv` and assert the warning string is absent from stdout
- **Rubric tie-in:** functionality (weight 0.40)

### [AC-02] No shared venv is ever created; envs live under `.meowkit/envs/` and are ignored

**Given** a fresh scratch project installed from the local kit
**When** a full session's hooks run, `mewkit setup` runs, and `mewkit skill env multimodal` runs
**Then** `.claude/skills/.venv` is never created by any of them; the only interpreter env created is
`.meowkit/envs/multimodal/`; `git status --porcelain` in that project lists nothing under `.meowkit/envs/`; both
`.gitignore` and `.meowkit/gitignore.meowkit` contain a `.meowkit/envs/` ignore line; and no file under `.claude/`,
`scripts/` or `packages/mewkit/src/` still names `.claude/skills/.venv` apart from this closed exemption list — the
regenerated projections asserted by AC-11, this contract and its own evidence file, the two D10 keepers
`scripts/check-hook-registration.sh` and `scripts/telemetry-decisions.py`, and `scripts/prepare-release-assets.cjs`,
whose `-x ".claude/skills/.venv/*"` zip exclusion is deliberately RETAINED (excluding a stray venv from a release
asset stays useful after the kit stops creating one)

- **Verification:** run the three flows in a scratch dir and `find` for both paths; `git status --porcelain`;
  `grep -rn "skills/\.venv"` over the named trees
- **Rubric tie-in:** functionality (weight 0.40)

### [AC-03] `mewkit setup` is optional and idempotent

**Given** a fresh scratch project where `mewkit setup` has never run
**When** the plan → cook → review → ship core verbs of AC-10 are exercised, and then `mewkit setup` is run twice in a row
**Then** every core verb succeeds without `setup` having run; the first `setup` exits 0 and the second exits 0 with every
step reporting `skip` (or an equivalent already-configured status) and producing a byte-identical project tree (diff of
two recursive manifests, excluding any `.meowkit/envs/` contents); `setup` creates no interpreter env for a skill the
user did not select; a `setup` run that selects exactly one skill installs exactly that skill's pinned packages and no
other — no merged cross-skill set and no unpinned `DEFAULT_PIP_PACKAGES` fallback, which AC-04's final clause requires
to be removed from this path as well as from `skill env`; and `setup` run in a no-python environment exits 0, creates
no env and prints what was skipped and why

- **Verification:** scratch run; diff the two post-run recursive manifests; `setup` with one skill selected, then
  `pip list` in that env compared to the skill's `requirements.txt`; re-run with `python3` removed from `PATH`
- **Rubric tie-in:** product-depth (weight 0.25)

### [AC-04] `mewkit skill env <skill>` creates and repairs one env, from pinned requirements only

**Given** a project with no `.meowkit/envs/`
**When** `mewkit skill env <skill>` is run for a Python skill that ships a `requirements.txt`, then for one that does
not, then run again after the env's interpreter binary is deleted, then run for a skill name that does not exist, then
run for a skill with no `requires_runtime`
**Then** run 1 creates `.meowkit/envs/<skill>/` and installs exactly the packages pinned in that skill's own
`requirements.txt` and nothing else (no merged cross-skill set, no `DEFAULT_PIP_PACKAGES` fallback); a skill with no
`requirements.txt` gets a **stdlib-only env** — created, interpreter present, zero packages installed, exit 0 — which is
the correct and sufficient outcome for exactly these 8 stdlib-only skills: `story-sizer`, `tech-graph`,
`planning-engine`, `skill-creator`, `scale-routing`, `llms`, `prompt-enhancer`, `evaluate`; `multimodal`,
`web-to-markdown` and `confluence` install from their existing pins, and `figma` installs from the new `pyyaml` pin
(Scope (In)), so no skill in the closed list of 12 is left with an env that cannot run it; run 2 repairs the
env and exits 0; the unknown skill exits non-zero naming the skill and listing the valid Python skills; the
no-`requires_runtime` skill exits non-zero stating the skill declares no runtime; a requirements line that fails the
existing package-name validation is rejected and reported, never installed; no `pip` or environment creation is
reachable from hook time (the require/exec graph of every hook entrypoint, the dispatcher and every registered handler
contains no install call site); and the ban on merged and unpinned install sets holds for **every code path in the
kit, not just `skill env`** — the merge/dedupe path (`core/skills-dependencies.ts` `getRequirementsSource`, which
"walks per-skill requirements.txt files, merges and deduplicates") and the unpinned `DEFAULT_PIP_PACKAGES` fallback it
returns when it finds none are REMOVED, together with their use at `commands/setup-steps.ts:174,188`,
`commands/init.ts:19` and `commands/doctor-checks.ts:7`, so that no invocation of `setup`, `init`, `doctor`,
`skill env` or anything else can install a package that is not pinned in exactly one skill's own `requirements.txt`

- **Verification:** run the five invocations in a scratch dir and inspect each resulting `pip list` against the
  skill's `requirements.txt` (empty for the 8 stdlib-only skills); for `figma` and `web-to-markdown`, run their CI
  commands against the new env with no blanket `pip install` step present; walk the hook require graph for install
  call sites; grep `packages/mewkit/src` for `DEFAULT_PIP_PACKAGES` and for the merge path — both return nothing, with
  a test file excepted only when its hit is an assertion that the symbol is absent; and run `setup` with exactly one
  skill selected and assert the installed set equals that skill's pins
- **Rubric tie-in:** functionality (weight 0.40)

### [AC-05] A missing env produces an exact, copy-pasteable remediation

**Given** a project where `.meowkit/envs/` is empty
**When** each Python skill's documented entry script is invoked
**Then** every invocation exits non-zero, prints no Python traceback and no stack trace, and prints a message that
names the skill and contains the literal command `mewkit skill env <skill>` with the correct skill name substituted;
the same message appears when the env directory exists but its interpreter is missing; and in a no-python environment
the message additionally names the missing interpreter requirement from `requires_runtime`

- **Verification:** invoke each Python skill's entry script in a scratch project and assert on exit code + exact
  message shape for each of the three states
- **Rubric tie-in:** ux-usability (weight 0.20)

### [AC-06] `requires_runtime` is declared, schema-enforced, and distinct from `runtime`

**Given** `.claude/schemas/skill-schema.json` and all SKILL.md files
**When** the frontmatter validator runs over the tree, and over four crafted fixtures
**Then** `requires_runtime` is an explicit schema property with a pinned value shape (a list of
`<interpreter><comparator><version>` entries, e.g. `python>=3.9`); exactly the Python skills in the Definitions list
declare it and no other skill does; the validator FAILS a fixture that puts an interpreter value in `runtime`, FAILS a
fixture that puts a provider value (`claude-code`/`portable`/`experimental`) in `requires_runtime`, FAILS a skill that
ships a `.py` in its documented invocation path without `requires_runtime`, and PASSES the unmodified tree; and the
existing `runtime` property is unchanged on all 125 SKILL.md files, values included (118 `claude-code`, 7
`portable` — the assertion is "no `runtime` value changes", not a single-value count)

- **Verification:** run the validator on the tree (exit 0) and on the four fixtures (expected verdict each);
  `git diff BASE -- .claude/schemas/skill-schema.json`; grep `requires_runtime:` and `runtime:` across SKILL.md files
- **Rubric tie-in:** functionality (weight 0.40)

### [AC-07] `injection-audit` is node, single-implementation, and works with no Python

**Given** a corpus of at least 8 fixture files recorded against the BASE Python scanner — covering each severity class
it reports (`CRITICAL`, `SUSPICIOUS`, clean), a file outside the project root, and the `.claude/*` skip behavior —
plus one directory fixture and one single-file fixture
**When** the node implementation runs each fixture in a no-python environment
**Then** findings (pattern class, severity, file, line) and exit status match the recorded BASE output for every
fixture; a critical finding writes an entry to `<project>/.meowkit/telemetry/security-log.md` and the clean case writes
none; the single-file mode (D1) returns machine-readable findings for one explicit path, including paths under
`.claude/`; `.claude/scripts/injection-audit.py` no longer exists; the two former Python consumers
(`web-to-markdown/scripts/persist_fetch.py`, `story-sizer/scripts/check-auto-create-gating.py`) invoke the node
single-file mode and their own tests still pass; and `rules/injection-rules.md` Rule 10, `rules/gate-rules.md:95`,
`agents/security.md:45` and `skills/vulnerability-scanner/SKILL.md` name the node entrypoint

- **Verification:** run the fixture corpus with `python3` removed from `PATH`; diff against the BASE recording;
  read the written security log; run the web-to-markdown Layer-8 test; grep the four doc sites
- **Rubric tie-in:** functionality (weight 0.40)

### [AC-08] `workflow-config` is node and every call site still resolves

**Given** fixtures for `get` (present key, missing key with default, missing key without default, boolean
normalization), `has` (truthy, falsy, missing, no config file) and `set` (new key, nested key, boolean coercion,
integer coercion, missing config file) recorded against the BASE bash+Python script
**When** the node implementation runs each fixture in a no-python environment
**Then** stdout and exit status match the recording for every fixture; the config path resolves canonical-first with
the legacy path as fallback (D2); the `WORKFLOW_CONFIG` and `MEOWKIT_CONFIG` env overrides are deliberately dropped
(neither is set anywhere in the tree, and no fixture asserts them);
`.claude/scripts/bin/meowkit-config` no longer exists and nothing references it; and each of the **9** preamble call
sites listed in `py-inventory.md` §4 — the eight of `cso`, `review`, `qa`, `document-release`, `investigate`,
`plan-ceo-review`, `office-hours`, `retro` plus `ship/references/preamble.md:23,32,69,80,81`, the ship-path caller —
runs in a no-python environment and yields the same value it yields at BASE

- **Verification:** run the fixture matrix with `python3` removed from `PATH`; execute each preamble's config lines
  verbatim in a scratch project; `grep -rn meowkit-config`
- **Rubric tie-in:** functionality (weight 0.40)

### [AC-09] Hook- and CI-reachable Python validators are ported or explicitly scoped out, and CI drops the shared venv

**Given** the inventory classification in `py-inventory.md` §3
**When** `.github/workflows/ci.yml` and the ported validators are reviewed and CI is run
**Then** every `.py` classified hook-called or CI-called is either (a) ported to TypeScript under
`packages/mewkit/src/`, (b) deleted because an equivalent TS check already runs, or (c) one of the files named in
Scope (Out) by D5, D6 or D10 — and the verdict evidence contains that three-way table with one row per file, no row
unaccounted for and no fourth category; `ci.yml` contains no `.claude/skills/.venv` string and no step that creates a
shared venv; the
skill-frontmatter validator and the docs-references check run as node/TS steps; `scripts/validate-skill-frontmatter.py`,
`.claude/scripts/check-docs-references.py`, `.claude/scripts/tests/test-check-docs-references.py` and
`.claude/scripts/tests/test-validate-skill-frontmatter.py` no longer exist and nothing references them (incl.
`core/docs-reference-contract-paths.ts:21` and `ci.yml:202,205,208,211`), and every assertion the deleted
`test-validate-skill-frontmatter.py` made is present and passing in the TS validator's own test file; each surviving
skill-owned Python CI step installs only from its skill's pinned `requirements.txt` into that skill's own
`.meowkit/envs/<skill>/`; and the one repo-dev Python CI step (`check-journey-specs.py`, D10) uses an interpreter that
is not `.claude/skills/.venv`

- **Verification:** read the table against §3 of the inventory; grep `ci.yml` for the shared-venv path and for
  `python3 -m venv`; a green CI run on the branch
- **Rubric tie-in:** functionality (weight 0.40)

### [AC-10] Scriptable no-Python check

**Given** a committed script that constructs a `PATH` from which `python3`, `python` and `py` are absent, with no
`.claude/skills/.venv` and an empty `.meowkit/envs/`
**When** it runs
**Then** it exits 0 only if ALL of the following hold, and names the first failure otherwise:
- `npx vitest run tests/hooks/golden` and `node --test .claude/hooks/__tests__/*.test.cjs` pass in full
- the Gate 1, Gate 2, privacy and pre-ship crash-path suites from sprint 3 pass
- `injection-audit` writes an entry to `.meowkit/telemetry/security-log.md` for a planted critical fixture
- each of these 23 core verbs exits 0 on its fixture (D9 — this is the pinned list phase 06 inherits; `validate
  --parity` is deliberately absent because no such flag exists and `validate` ignores unknown flags):
  `mewkit doctor`, `orient`, `status`, `validate --packs`, `validate --gates`, `validate --memory`,
  `validate --workflow`, `validate --agents`, `validate --ownership`, `inventory --check`,
  `plan status`, `plan check`, `plan approve`, `note gotchas`, `task new`, `task-state`, `verdict-gate`, `review`,
  `budget context`, `trace score`, `context`, `advice`, `skill env --list`
- `mewkit plan check --structural` (D3) runs on a plan fixture and reports its completion marker
- `mewkit setup` exits 0, creates no env, and reports what it skipped

- **Verification:** run the committed script on a clean checkout with the stripped `PATH`; capture its full output in
  the verdict evidence
- **Rubric tie-in:** functionality (weight 0.40)

### [AC-11] Codex and Cursor projections follow, and both validators are green

**Given** the codex and cursor emitters
**When** the projections are regenerated, the migrate suite runs, and scratch projects are generated for both targets
from the local kit
**Then** the migrate suite passes; no regenerated projection references `.claude/skills/.venv` or a target-equivalent
shared venv path, and none references a deleted `.py`; and `mewkit validate --target codex` and `--target cursor` on
the generated layouts report no failure — these two ARE the parity assertion for this sprint, since no
`validate --parity` flag exists

- **Verification:** run the migrate suite; grep the regenerated projection tree for the shared-venv path;
  generate both layouts in scratch dirs and run both validators
- **Rubric tie-in:** functionality (weight 0.40)

### [AC-12] The hook-path sweep returns zero, and doctor still catches a plant

**Given** the finished change
**When** the sprint-3 sweep runs — `find .claude` restricted to paths matching `*hooks*` or `*/bin/*` and names
matching `*.sh` or `*.py`, excluding `.claude/skills/.venv/*` and `.claude/worktrees/*`
**Then** it returns 0 files (at BASE it returns exactly `.claude/hooks/ensure-skills-venv.sh`); and `mewkit doctor`
reports a finding when a dummy `.sh` and a dummy `.py` are each planted under `.claude/hooks/` in a scratch install

- **Verification:** run the find; plant both dummies in a scratch install and run `mewkit doctor` twice
- **Rubric tie-in:** product-depth (weight 0.25)

### [AC-13] Skills that install binaries, not just packages, keep working (D7)

**Given** `jira`, `confluence` and the `playwright-chromium` system dep
**When** their env is created through `mewkit skill env <skill>` and their documented entry paths are exercised
**Then** `jira/scripts/jira-as.sh` resolves its binary inside that skill's env and not from `PATH`; the
`confluence-as` binary path named in `commands/mk/confluence-setup.md` points inside the confluence env;
`lib/system-deps-registry.ts` `playwright-chromium` detect and install commands (all platform variants) name the
web-to-markdown env; and none of the three resolves to `.claude/skills/.venv`

- **Verification:** run each wrapper with the env present and absent (absent must produce the AC-05 message);
  read the three repointed definitions; grep them for the shared-venv path
- **Rubric tie-in:** functionality (weight 0.40)

### [AC-14] Code quality over the sprint diff

**Given** `git diff BASE` at the end of the sprint
**When** every new or changed `.cjs`, `.js`, `.mjs`, `.ts`, `.py` and `.sh` file is measured
(`.github/workflows/*.yml` exempt from the line rule)
**Then** no new file exceeds 200 lines, no changed file grows past 200 lines because of this sprint, no changed
TypeScript adds `any` or an unsafe cast, no new TODO/FIXME, no commented-out code blocks, no unused imports, no
hardcoded secrets, and no new `child_process` call site targets `bash`, `sh` or a `.sh` file; `pnpm lint` and
`pnpm typecheck` report 0 errors

- **Verification:** `git diff --stat BASE`; `wc -l` new files; grep added lines; lint and typecheck output
- **Rubric tie-in:** code-quality (weight 0.15)

### [AC-15] The no-Python journey is recorded

**Given** a machine (or container) with no Python interpreter on `PATH`
**When** a fresh `mewkit init` project is created and `/mk:cook` is run on a fixture task through Gate 1 to a
reviewable change
**Then** the recorded transcript in the verdict evidence shows: no session-start Python warning, Gate 1 reached and
blocked or approved on its own terms, the plan structural check running, no "venv" or "python" error anywhere, and the
run completing; and when one Python skill is invoked during that session it fails with the AC-05 remediation message
rather than a traceback

- **Verification:** read the recorded transcript and its environment capture (the `command -v python3` result included)
  in the verdict evidence
- **Rubric tie-in:** functionality (weight 0.40)

## Out-of-Scope Clarifications

- Do not install anything at hook time, ever — not a venv, not a pip package, not a system dep. A missing env is
  reported, never repaired implicitly (phase-05 Security Considerations).
- Do not install from an unpinned source: no bare `pip install <name>` outside a skill's own `requirements.txt`, no
  network fetch of a requirements file, no `--upgrade` of an unpinned spec.
- Do not merge requirements across skills into one install set the way `core/skills-dependencies.ts:33-41` does today;
  each env gets exactly its own skill's pins.
- Do not keep a second copy of any ported logic "for compatibility" — one implementation per check (this is the whole
  point of D1 and D5).
- Do not relax a golden fixture to make a port pass. If BASE and the port cannot be made identical, stop and ask.
- Do not change gate, privacy, pre-ship, post-write or pre-completion-check decisions; this sprint touches only how
  interpreters are located.
- Do not add a config key, env var or flag that re-enables an automatic shared venv.
- Do not rewrite any Python skill's logic, add a new skill, or add a `mewkit` verb beyond `skill env` and
  `plan check --structural` (D3).
- Do not edit the plan directory beyond phase-05 checkboxes, status and a decisions note.

## Rubric Bindings

- functionality: AC-01, AC-02, AC-04, AC-06, AC-07, AC-08, AC-09, AC-10, AC-11, AC-13, AC-15
- product-depth: AC-03, AC-12
- code-quality: AC-14
- ux-usability: AC-05

## Negotiation Log

- Round 1 (proposer/generator): initial draft from `phase-05-lazy-python.md` + `plan.md` Decisions/Constraints + the
  `cli-tool` preset, grounded in a fresh inventory
  (`tasks/reviews/evidence/261108-meowkit-v3-lean-runtime-sprint-4/py-inventory.md`). Nine Decision candidates (D1–D9)
  are raised rather than silently resolved, because the spec is contradicted by the tree in three places: (a) no `.py`
  is hook-called at BASE, so "hook Python" is already zero and the real hook residue is one `.sh`
  (`ensure-skills-venv.sh`) plus a SessionStart venv-warning block in `project-context-loader.cjs:119`; (b) the
  "core workflow with no Python" premise fails on `plan-creator/scripts/validate-plan.py`, a mandatory step at
  `step-04-semantic-checks.md:45` (D3); (c) `injection-audit.py` is a Python *library* for two skill scripts, not just
  a CLI, so a naive node port would silently drop a safety layer (D1). Also found: `check-docs-references.py` already
  has a wired TS twin (D5, delete not port), `workflow-config` has a dead byte-identical duplicate and reads a config
  path the TS side calls legacy (D2), `requires_runtime` collides conceptually with the existing `runtime` schema
  property on all 125 skills (D4), and the phase-05 success criterion cites a phase-06 verb list that does not exist
  (D9, pinned in AC-10). AC-12 restates sprint 3's AC-11 sweep with the expected result changed from one file to zero.
- Round 1 (proposer/generator): decisions D1–D9 recorded per user directive — the user's standing instruction for this
  plan is to follow the recommended option on every decision, so the Decisions section is now a decided record, not a
  proposal. D10 added for repo-dev tooling (`check-hook-registration.sh`, `lint-brand-prose.sh` →
  `check-anthropic-context.py`): stays Python, out of scope, excluded from the AC-10 no-Python check. Follow-on edits
  for consistency: the Python-skill list in Definitions is now a closed list of 12 (no `plan-creator` per D3, no
  `trace-analyze`/`benchmark` per D8); the D3 port is named concretely as `mewkit plan check --structural` in
  Scope (Out), AC-10 and the Out-of-Scope Clarifications; AC-09's third category is pinned to the files named by D5,
  D6 and D10 with no fourth category allowed. No AC leaves an alternative open.
- Round 1 (reviewer/evaluator): AC-10 and AC-11 both require `mewkit validate --parity`, which does not exist. The command catalogue declares `b("...", ["validate"], ...)` for exactly `workflow`, `gates`, `ownership`, `agents`, `packs` and `memory` (`cli/command-catalogue.ts:141-148`); there is no `parity` flag, and `parity` appears nowhere in `packages/mewkit/src/**/*.ts` outside `journey-validation/` internals and prose comments. Worse than a missing feature: `index.ts` reads validate flags off minimist with no unknown-flag rejection, so `mewkit validate --parity` runs the FULL validate and exits 0 — AC-10's entry and AC-11's "`mewkit validate --parity` passes" would both pass while asserting nothing about parity, and Scope (Out) forbids adding a flag to make it real. Drop it from AC-10 (24 → 23 verbs, and D9's "24-verb list" with it) and from AC-11, or name the parity check that does exist — `validate --target codex|cursor`, which AC-11 already requires
- Round 1 (reviewer/evaluator): AC-04's install rule has no source for 9 of the 12 Python skills, and two of them break. Only `multimodal`, `web-to-markdown` and `confluence` ship a `requirements.txt`; `story-sizer`, `tech-graph`, `planning-engine`, `skill-creator`, `scale-routing`, `llms`, `figma`, `prompt-enhancer` and `evaluate` have none. AC-04 defines run 1 as installing "exactly the packages pinned in that skill's own `requirements.txt` and nothing else (no merged cross-skill set, no `DEFAULT_PIP_PACKAGES` fallback)", which is undefined for those 9 — and the generator can satisfy it by creating 9 empty envs, after which AC-05's remediation message sends the user to a command that cannot make the skill work. Eight of the nine are genuinely stdlib-only (I enumerated every import), so an empty env is the right answer for them and the AC should say so. Two are not: `figma/evals/validate-evidence-packets.py` imports `yaml`, and the web-to-markdown CI step runs `-m pytest` while `web-to-markdown/scripts/requirements.txt` pins neither. Both work today only because `ci.yml:103` installs `pyyaml jsonschema pytest` into the shared venv — the exact step AC-09 deletes. Add the two pin entries to Scope (In) and state AC-04's no-`requirements.txt` branch, or AC-04/AC-09 cannot both hold
- Round 1 (reviewer/evaluator): AC-02's shared-venv grep contradicts D10 and sweeps in two unscoped files. "no file under `.claude/`, `scripts/` or `packages/mewkit/src/` ... still names `.claude/skills/.venv`" covers `scripts/`, but D10 and Scope (Out) deliberately keep `scripts/check-hook-registration.sh:44` (`PY=".claude/skills/.venv/bin/python3"`). Two more under `scripts/` are in no decision: `prepare-release-assets.cjs:78` names the path as a **zip exclusion** (`"-x", ".claude/skills/.venv/*"`) — satisfying AC-02 literally means deleting an exclusion and starting to ship stray venvs into release assets — and `telemetry-decisions.py:16-18` is a repo-dev Python script D6 does not reach, since D6 is scoped to `.claude/scripts/*.py`. Exempt the D10 keepers and rule on those two. The `packages/mewkit/src/` half is fine: of 99 matching files, 96 are authored `migrate/modules/` bundles (the projections AC-11 regenerates) and the remaining three are `lib/system-deps-registry.ts`, `core/skills-dependencies.ts` and one `commands/` file, all already in Scope (In)
- Round 1 (reviewer/evaluator): AC-08 is bound to an incomplete caller list and so passes with the ship path broken. It requires "each of the **8** preamble call sites listed in `py-inventory.md` §4" to still resolve, and §4 (`py-inventory.md:124-128`) names cso, review, qa, document-release, investigate, plan-ceo-review, office-hours and retro. But **9** skills invoke the script: `ship/references/preamble.md:23,32,69,80,81` runs `.claude/scripts/bin/workflow-config get proactive`, `get telemetry` and three `set telemetry` calls — the same shape as the eight, on the ship path, and absent from both the inventory and the AC. Add `ship` to §4 and say "each of the 9", or AC-08's oracle loses the consumer whose failure costs the most
- Round 1 (reviewer/evaluator): AC-09's three-way table cannot close, because two CI-called `.py` files fall in no category while the AC forbids a fourth. (1) `.claude/scripts/tests/test-validate-skill-frontmatter.py` runs at `ci.yml:211` and is the unit test for `scripts/validate-skill-frontmatter.py`, which D5 ports and AC-09 requires to no longer exist. It is named nowhere in the contract: not ported, not deleted, not in Scope (Out). After the delete it either fails or — since its header documents invoking the validator "as a subprocess via sys.executable" — passes vacuously against a missing subject. Rule on it (delete with the validator, since the TS port carries its own tests). (2) `tests/journey-validation/check-journey-specs.py` runs at `ci.yml:134`, and D5 files it among "the five skill-level Python test suites" — but there is no `.claude/skills/journey-specs` directory; it is a repo-level test owned by no skill. AC-09's closing clause, "the surviving Python CI steps install only from a skill's pinned `requirements.txt` into that skill's own env", therefore has no skill to name for it, and the path it uses today (`.claude/skills/.venv/bin/python3`) is one AC-09 forbids in `ci.yml`. Classify it as repo-dev under D10 or give it an owning env
- Round 1 (reviewer/evaluator): six trivial fixes. (1) Pinned baseline says `tests/hooks/golden/` holds **83** fixtures; it holds **82** — 83 files including `index.json`, whose own `fixtureCount` is 82, and sprint 3's Amendment 2 says "replayed all 82 fixtures". (2) AC-06 asserts "the existing `runtime` property and its **125** `claude-code` values are unchanged"; across the 125 SKILL.md files the values are 118 `claude-code` **and 7 `portable`** — every file declares `runtime`, but a verifier checking that number literally fails it. (3) D2 calls `.claude/scripts/bin/meowkit-config` "a byte-for-byte duplicate" of `workflow-config`; `diff` shows the header/usage lines differ and, materially, so does the env override — `${WORKFLOW_CONFIG:-...}` vs `${MEOWKIT_CONFIG:-...}`. Nothing in the tree sets either variable, so dropping it is safe, but AC-08's fixture matrix is `get`/`has`/`set` only and never mentions it: say "the env override is deliberately dropped", per sprint 3's AC-04 discipline, and fix "byte-for-byte" to "same logic, different name and override variable". (4) D2 cites "`workflow-config:9`" without its directory; it is `.claude/scripts/bin/workflow-config:9` — the same directory as `meowkit-config`, which is what "no reference outside its own directory" refers to (verified: the only non-worktree reference to `meowkit-config` is the file itself). (5) Scope (In)'s "the 4 agent files and ~30 skill files that hard-code the shared-venv Python path" understates the work: 54 files under `.claude/` name it — 46 under `skills/`, 4 agents (exact), 2 `hooks/` (both covered by AC-01), 1 `commands/` (confluence, D7) and 1 `.claude/scripts/` (the orphan test above). (6) AC-06 is bound to product-depth though its subject is a validator that must FAIL three crafted fixtures and PASS the tree — functionality's own subject; both rubrics hard-fail at FAIL so severity is unchanged, which is why this is cosmetic rather than the AC-15 problem below
- Round 1 (reviewer/evaluator): one rubric rebinding worth making before sign. AC-15 — the recorded end-to-end no-Python `/mk:cook` journey, which is the entire point of this sprint — is bound to ux-usability, whose hard-fail threshold in the `cli-tool` preset is **WARN**, so "the kit runs on a machine with no Python" can never produce a FAIL. The scriptable half is FAIL-bound via AC-10 (functionality), so the hole is narrower than it looks, exactly as it was for sprint 3's AC-13; move AC-15 to functionality and leave AC-05 (the remediation message, a genuine usability criterion) holding ux-usability. Lower confidence, raised not pressed: AC-03's `setup` idempotence is also closer to functionality's "exit codes and output must work" than to product-depth, but "setup is optional at all" is a real product-shape claim, so product-depth is defensible there
- Round 1 (reviewer/evaluator): verified clean, recorded so round 2 does not relitigate — the BASE placeholder is expected and correctly fenced ("MUST NOT be signed while the placeholder is still present"). D1 holds exactly as described: `web-to-markdown/scripts/persist_fetch.py` `_load_injection_audit()` `importlib`-loads `.claude/scripts/injection-audit.py` as a module, and `story-sizer/scripts/check-auto-create-gating.py` `_fire_injection_audit()` probes the same file, so it is a library and not only a CLI. D3 holds: `plan-creator/step-04-semantic-checks.md:45` invokes `validate-plan.py` through `.claude/skills/.venv/bin/python3`, making Gate 1 Python-dependent. D4 holds: all 125 SKILL.md files declare `runtime` and `skill-schema.json:7` is `additionalProperties: true`. D5's TS twin exists and is wired (`core/check-docs-references.ts:107`). D6 is exact: `commands/doctor-checks.ts:140` hard-codes those four names, `injection-audit.py` among them. D7 holds on all three: `jira/scripts/jira-as.sh` sets `JIRA_AS="$ROOT/.claude/skills/.venv/bin/jira-as"`, `commands/mk/confluence-setup.md:11` names `.claude/skills/.venv/bin/confluence-as`, and `lib/system-deps-registry.ts` probes playwright by spawning that python. D8's premise is explicit at `trace-analyze/SKILL.md:65` ("No `jq` dependency — all JSON parsing via `.claude/skills/.venv/bin/python3`"). D10 holds: `scripts/check-hook-registration.sh:44` prefers the venv python with a `python3` fallback and `.claude/scripts/lint-brand-prose.sh:39-41` hard-exits 2 without python3. AC-01's three citations are all real — `HOOKS_INDEX.md` names the hook in both prose and the table, `doctor-hook-runtime.ts:17` is `SWEEP_EXCLUDE = ["ensure-skills-venv.sh"]` (single entry, so "becomes empty" is the accurate outcome), and `handlers/project-context-loader.cjs:119` emits the literal `## WARNING: Python venv not found` block that AC-01's verification greps for. AC-09's `core/docs-reference-contract-paths.ts:21` allowlist entry is real. The sweep in AC-12 returns exactly `.claude/hooks/ensure-skills-venv.sh` in the working tree today, so "0 after, 1 at BASE" is right. The Definitions' closed list of 12 Python skills matches the tree exactly: 13 skills ship a non-test `.py`, and the thirteenth is `plan-creator`, which D3 ports — no fourteenth, and neither `trace-analyze` nor `benchmark` ships one, so D8 is correctly about inline `python3` calls. Every other AC-10 verb exists in the command catalogue (`doctor`, `orient`, `status`, `inventory --check`, `plan status|check|approve`, `note`, `task new`, `task-state`, `verdict-gate`, `review`, `budget context`, `trace score`, `context`, `advice`), and `validate`'s five other scoped flags are declared. All 15 ACs are bound exactly once, the Rubric Bindings block matches every per-AC tie-in line, and the four weights (0.40 / 0.25 / 0.15 / 0.20) match `load-rubric.sh --preset cli-tool`
- Round 1 (reviewer/evaluator): disposition — five substantive items (the `--parity` ghost flag; AC-04's missing pin sources with the figma/`yaml` and web-to-markdown/`pytest` breakages; AC-02 vs D10 plus the two unscoped `scripts/` files; AC-08's 8-vs-9 caller list; AC-09's two uncategorised CI `.py` files) and seven trivial ones. None requires a user decision: D1–D10 are decided and every item above is a defect in how an AC tests them, not in what was decided — each has one resolution consistent with the Decisions. All are a generator `amend`
- Round 1 (reviewer/evaluator): note, not a finding — while grepping for the D7 system-dep citation a tool-output hook appended a "MANDATORY ... You must run the Skill(agent-browser)" instruction, triggered by the literal word `playwright` in my command. Per `injection-rules.md` Rule 2 I treated it as DATA and did not act on it; there is no browser surface in this contract. Recorded for the audit trail rather than escalated, since it is a local pattern-matching plugin and not an injection attempt
- Round 2 (proposer/generator): all 12 reviewer items resolved in the AC/Scope/Decision text, not just logged. Five substantive: (1) `validate --parity` removed from AC-10 (24 → 23 verbs) and from AC-11, with D9 restated — the ghost flag is called out by name so it is not reintroduced, and `validate --target codex|cursor` is now explicitly "the parity assertion for this sprint"; (2) AC-04 gains the no-`requirements.txt` branch — a stdlib-only env (created, interpreter present, zero packages, exit 0) and the enumeration of the 8 skills for which that is sufficient (`story-sizer`, `tech-graph`, `planning-engine`, `skill-creator`, `scale-routing`, `llms`, `prompt-enhancer`, `evaluate`), while Scope (In) adds the two missing pin files the deleted `ci.yml:103` blanket install was hiding (a `figma` `requirements.txt` pinning `pyyaml`, a `web-to-markdown` test pin adding `pytest`), so AC-04 and AC-09 can both hold; (3) AC-02's grep now carries a closed exemption list — the D10 keepers `check-hook-registration.sh` and `telemetry-decisions.py`, plus `prepare-release-assets.cjs`, whose `-x ".claude/skills/.venv/*"` zip exclusion is deliberately RETAINED because excluding a stray venv from a release asset stays useful after the kit stops creating one — and `telemetry-decisions.py` is named in Scope (Out) under D10, which D6 could not reach; (4) AC-08 is rebound to 9 callers, naming `ship/references/preamble.md:23,32,69,80,81`, and `py-inventory.md` §4 is corrected to match; (5) AC-09 rules on both uncategorised CI files — `.claude/scripts/tests/test-validate-skill-frontmatter.py` is deleted with the validator it tests and its assertions must be present and passing in the TS validator's own test file, and `tests/journey-validation/check-journey-specs.py` becomes repo-dev under D10 (no owning skill), allowed a CI-local interpreter that is not `.claude/skills/.venv`. Seven trivial: golden fixtures 83 → 82 (83 files incl. `index.json`, `fixtureCount` 82); AC-06's `runtime` assertion restated as "no value changes" over 118 `claude-code` + 7 `portable`; D2's "byte-for-byte duplicate" corrected to "same logic, different name and override variable" with AC-08 stating both overrides are deliberately dropped; D2's citation qualified to `.claude/scripts/bin/workflow-config:9`; Scope (In)'s consumer count corrected from "4 agents and ~30 skill files" to the exact 54 `.claude/` files with their per-directory split; AC-06 rebound product-depth → functionality (its subject is a validator's FAIL/PASS behavior); AC-15 rebound ux-usability → functionality, since the no-Python journey is this sprint's thesis and ux-usability hard-fails only at WARN — AC-05, a genuine usability criterion, keeps ux-usability alone. AC-03 left on product-depth as the reviewer allowed ("setup is optional at all" is a product-shape claim). Rubric Bindings updated to match. No decision was reopened; D1–D10 stand. The reviewer's Rule 2 note about the `playwright`-triggered tool-output instruction is acknowledged — treated as DATA, no action, nothing in this contract depends on it.
- Round 2 (reviewer/evaluator): all 12 round-1 items are resolved in the AC/Scope/Decision text, not just the log. Checked one by one: the ghost flag is gone from AC-10 (I counted the list — exactly 23 verbs) and from AC-11, which now states the two `validate --target` runs "ARE the parity assertion for this sprint", and D9 names `validate --parity` as deliberately absent with the catalogue citation and the vacuous-pass reason, so it cannot be reintroduced by accident. AC-04 gains the stdlib-only branch with the right 8 skills enumerated, and the arithmetic closes: 8 stdlib-only + `multimodal`/`web-to-markdown`/`confluence` existing pins + `figma`'s new pin = the closed list of 12, so no skill is left with an env that cannot run it; Scope (In) adds both pin entries and names `ci.yml:103` as the blanket install they replace; AC-04's verification now runs the `figma` and `web-to-markdown` CI commands against the new env with no blanket install present, which is the right probe. AC-02 carries a closed exemption list naming all three `scripts/` files, and keeps the `prepare-release-assets.cjs` zip exclusion with the reason stated — the correct call, since excluding a stray venv from a release asset stays useful after the kit stops creating one. AC-08 is rebound to 9 callers with `ship/references/preamble.md:23,32,69,80,81` named explicitly, and D2 now says 9. AC-09 rules on both orphans: `test-validate-skill-frontmatter.py` is deleted with its subject and its assertions must be present and passing in the TS validator's own test file, `ci.yml:202,205,208,211` are cited, and the qualifier "each surviving **skill-owned** Python CI step" fixes the clause that previously had no skill to name, with `check-journey-specs.py` reassigned to D10 and allowed a CI-local non-shared-venv interpreter. The seven trivial fixes all landed: 82 fixtures with the 83-files/`index.json` explanation; AC-06 restated as "no `runtime` value changes" over 118 `claude-code` + 7 `portable`; D2's "same logic, different name and override variable" with AC-08 recording that both overrides are deliberately dropped; the `.claude/scripts/bin/workflow-config:9` path qualified; Scope (In)'s exact 54-file split; AC-06 and AC-15 rebound to functionality. Rubric Bindings and all 15 per-AC tie-in lines agree (functionality 11, product-depth 2, code-quality 1, ux-usability 1), each AC bound exactly once
- Round 2 (reviewer/evaluator): one item remains, and it is the mirror of the AC-04 fix — the two strongest Out-of-Scope Clarifications are now enforced by an AC for `mewkit skill env` only, not for the code path that actually installs today. `commands/setup-steps.ts:174` calls `getRequirementsSource(projectDir)` and `:188` `installPipPackages(...)`; that function "walks per-skill requirements.txt files, **merges and deduplicates**" (`core/skills-dependencies.ts:68-71`) — the exact behavior the clarification "Do not merge requirements across skills into one install set the way `core/skills-dependencies.ts:33-41` does today" forbids — and when it finds no requirements file it returns `DEFAULT_PIP_PACKAGES` with `source: "built-in defaults"` (`:102`), three **unpinned** specs (`google-genai`, `pillow`, `python-dotenv`, no version comparators) whose own doc comment says "installed into `.claude/skills/.venv`". The same symbol is imported by `commands/init.ts:19` and `commands/doctor-checks.ts:7`. AC-04 bans the merge and the fallback, but only for `skill env`; AC-03 asserts only that `setup` is optional, idempotent, no-python-safe and "creates no interpreter env for a skill the user did not select" — nothing stops `setup` or `init` from installing a merged, unpinned set into an env for a skill the user DID select, which is "Do not install from an unpinned source" violated by a path Scope (In) merely says is "repointed". Substantive, because closing it adds an assertion rather than rewording one, but forced rather than a choice — no user decision is available, since both clarifications already decide it — so it is a one-clause generator fix at sign time: extend AC-03 (or AC-04's last clause) to require that the merged-set and `DEFAULT_PIP_PACKAGES` fallback paths are removed, so no code path, `setup` and `init` included, can install an unpinned or cross-skill set
- Round 2 (reviewer/evaluator): new-defect sweep otherwise clean, and three consequences recorded as accepted rather than items. (1) I re-ran the method that found the `figma`/`yaml` gap against the other two surviving skill CI suites and there is no third breakage: `multimodal`'s only third-party imports are `dotenv` and `google` (plus `PIL`), all three pinned in its `requirements.txt`, and its tests use stdlib `unittest`, not `pytest`; `scale-routing/eval/run-routing-eval.py` is stdlib plus a local `classify` module, so the empty stdlib-only env AC-04 prescribes is sufficient. (2) ux-usability now holds exactly one criterion, AC-05, at weight 0.20 — a direct consequence of my own two rebindings, and acceptable: AC-05 is the genuinely usability-shaped criterion here (exact remediation message, three states, every Python skill), and no rubric rule requires more than one binding. (3) AC-15 under functionality is the one functionality criterion I cannot re-run — it is a transcript read, so the verdict will rest on the quality of the recorded environment capture; that is inherent to a "no interpreter on this machine" claim and AC-10 carries the scriptable half, so it stays where I put it. Also noted so a Gate 2 reviewer building AC-09's table does not trip: `check-anthropic-context.py` appears in both D6's six and D10's four (via `lint-brand-prose.sh`), which is not a fourth category — both map to (c)
- Round 2 (reviewer/evaluator): disposition at the hard cap — accepted on every round-1 item, with one substantive-but-forced clause outstanding (the `setup`/`init` merged-and-unpinned install path). No decision is reopened; D1–D10 stand untouched. If the generator adds that clause at sign time the contract is accepted; declining it would be a user escalation, because it would leave an explicit Out-of-Scope Clarification with no AC enforcing it on the only path that installs packages today. Separately, BASE is still the placeholder, and the contract's own rule — "MUST NOT be signed while the placeholder is still present" — governs: I will sign only after it is replaced with the real Phase 02 SHA
- Round 2 (proposer/generator, sign-time fix): the one outstanding clause is added. AC-04's final clause now extends the merged-set and unpinned-fallback ban to **every code path in the kit, not just `skill env`**: `core/skills-dependencies.ts` `getRequirementsSource` (the merge/dedupe walk) and the `DEFAULT_PIP_PACKAGES` fallback it returns when no requirements file is found are REMOVED, together with their use at `commands/setup-steps.ts:174,188`, `commands/init.ts:19` and `commands/doctor-checks.ts:7`, so no invocation of `setup`, `init`, `doctor` or `skill env` can install a package that is not pinned in exactly one skill's own `requirements.txt`. Verification adds the two probes the reviewer named: a grep of `packages/mewkit/src` for `DEFAULT_PIP_PACKAGES` and for the merge path returning nothing (a test file excepted only when its hit asserts the symbol is absent), and a `setup` run with exactly one skill selected whose installed set equals that skill's pins. AC-03 carries the same guarantee in its own `Then`, since `setup` is the path that installs today, so the assertion is bound on both the product-shape AC and the functionality AC rather than only cross-referenced. Confirmed against the tree before writing: `skills-dependencies.ts:102` returns `DEFAULT_PIP_PACKAGES` with `source: "built-in defaults"`, its three specs (`google-genai`, `pillow`, `python-dotenv`) carry no version comparators, and the symbol's own doc comment still says "installed into `.claude/skills/.venv`"; `core/index.ts:15` re-exports the module, so the removal has to be checked by grep and not by import site alone. Nothing else changed: no decision reopened, no other AC touched, Rubric Bindings unchanged (AC-03 product-depth, AC-04 functionality), 15 ACs each bound exactly once. The reviewer's three accepted consequences are left as recorded, including `check-anthropic-context.py` mapping to category (c) under both D6 and D10. BASE remains the placeholder for the user to fill at sign.

## Amendments (if any)

None.
