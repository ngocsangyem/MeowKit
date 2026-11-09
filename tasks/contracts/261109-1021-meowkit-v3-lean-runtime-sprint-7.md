---
contract_schema_version: 1.0.0
task: meowkit-v3-lean-runtime
sprint: 7
plan_ref: tasks/plans/261101-meowkit-v3-lean-runtime/plan.md
rubric_preset: cli-tool
status: negotiating
generator_signed: null
evaluator_signed: null
rounds: 2
created: 261109-1021
---

# Sprint 7 Contract — CLI surface: keep what the kit calls, make the call path reliable, drop the rest

Testable translation of `phase-06-cli-surface.md` (Requirements 1–7, Related Code Files, Implementation
Steps, Success Criteria, Risk Assessment, Security Considerations), bounded by `plan.md` Decisions 1–7 and
Constraints, and by the sprint-6 decisions still in force. Every number, path and line citation below was
measured at BASE, not read from the phase file; where the phase file and the tree disagree the tree wins and
the disagreement is recorded.

## Pinned baseline

BASE = `4f02804f985550599ab87a166b56516342c0144a` — "feat(kit): signed kit artifact with verified install and
one shared emitter path", the sprint-6 commit and the current `HEAD` of `feat/v3-lean-runtime`. Every "at
BASE" claim and every `git diff BASE` resolves against that commit.

Measured at BASE:

- **Surface.** `cli/command-catalogue.ts` declares **29** commands over 328 lines. Still present:
  `context` (subcommands `resolve`/`check`/`record`), `explain-support` ("Alias of `providers`"), `status`
  ("Print version and config summary"), `docs-manifest`, `inventory`, `providers`, `budget`, `orient`, and
  the `versions` verb sprint 6 added. `memory`, `wiki`, `index` and `query` are already **gone**, and
  `grep -rn "node:sqlite" packages/mewkit/src scripts .claude/hooks` returns **zero** hits, so nothing in
  the tree still needs a SQLite-capable runtime.
- **Dispatch.** An unknown **verb** already exits 2 (`index.ts:516-525`: it prints `Unknown command: <x>`,
  prints help, exits 2) — the phase's "unknown command exits 0" is already fixed and is not this sprint's
  work. An unknown **subcommand** is not: **14** verbs declare subcommands at BASE
  (`cli/command-catalogue.ts:13,15,17,18,21,25,28,29,36,52,55,56,57,73` — round 1 of this contract said 13
  and probed 13, omitting `pack`). Probed with an unknown subcommand, `visual-plan` exits **2**, `task` and
  `trace` exit **0** (silent accept — the exact defect the phase names), and the remaining **eleven** exit
  **1**, `pack` among them (`Unknown pack subcommand: zzbogus` plus its usage line in a project with a pack
  manifest; the "requires meowkit with a pack-manifest.json" precondition message, also exit 1, in one
  without). So one verb of fourteen has the required exit code and none treats the valid-subcommand list as a
  usage error. Three of the fourteen have a **valid bare form** that must not change: `doctor` (`:18`, whose
  bare form is the CI hard gate at `ci.yml:380`), `budget` (`:15`) and `backups` (`:73`). `CommandSpec`
  (`cli/catalogue-types.ts`) has **no** field declaring whether a subcommand is required. Across
  `.claude/hooks/`, `.claude/scripts/`, `scripts/`, `tests/` and `.github/` there are **zero** exit-code
  comparisons against 1 (`=== 1`, `== 1`, `-eq 1`); every committed caller tests `!== 0`.
- **Sub-help.** `<cmd> <sub> --help` runs the subcommand with `--help` as noise, every time:
  `plan status --help` → exit 1 "plan status: missing <plan-dir>"; `task new --help` → exit 1 "Description is
  required"; `trace score --help` → exit **0** "Could not find .claude/ directory."; `capabilities list
  --help` → exit 1, and its message still tells the user to run `npx mewkit init`. There is no
  per-subcommand usage anywhere: `cli/render-help.ts:61-62` prints subcommand **names** on one dim line and
  nothing else.
- **Node floor, three answers and a fourth in CI.** `engines.node` is `>=24` in both `package.json` files
  (root `:44`, `packages/mewkit` `:60`); `README.md:93` says "Node.js 20+"; `commands/doctor-checks.ts:22-25`
  checks `major >= 20` and labels the check "Node.js >= 20"; `.github/workflows/ci.yml` pins
  `node-version: 24` in **four** job blocks (`:22`, `:282`, `:335`, `:362`) and tests no other version. No
  ADR for the floor exists — `docs/architecture/adr/` holds four ADRs, the newest `260715-gate2-approval-receipt.md`.
- **Call path.** `.claude/runtime.json` is written **only** by `core/smart-update.ts:528`, and only when
  `resolveInProjectExecutable` (`core/hook-runtime.ts:127-136`) finds `node_modules/.bin/mewkit` or
  `node_modules/mewkit/dist/index.js`; an `npx` install has neither, so no descriptor is written and
  `handlers/orientation-ritual.cjs:87` prints `[orientation fallback: installed runtime unavailable —
  checkpoint cache, verify live before acting]`. **That line is printing in this repo right now.** The
  read-side trust gate (`hook-runtime.ts:40-60`, mirrored in the handler at `:22-40`) requires the
  descriptor's executable to be absolute, to `realpath` on **both** sides into the project root, and to be a
  file.
- **Launcher slot already reserved, launcher absent.** `core/install-meowkit-dir.ts` `KIT_DIR_GITIGNORE` is
  deny-all with `!bin/` and `!bin/mewkit` re-included, so sprint 3 already decided the launcher is committed
  — but no launcher exists, `.meowkit/bin/` is absent in this repo, and nothing writes it. The project-local
  kit cache is `.meowkit/cache/` (`core/kit-cache.ts` `CACHE_REL`), untracked by both the deny-all file and
  root `.gitignore:55`. A home directory is already in use by the CLI, but it is `~/.mewkit/`
  (`migrate/reconcile/portable-registry.ts:12`), not the `~/.meowkit/cache` the phase names.
- **Invocation forms.** `.claude/` (excluding `worktrees/`, which `scripts/check-kit-verbs.cjs` skips) holds
  **41** `npx mewkit` occurrences across **28** files, and **204** occurrences of a bare `mewkit <word>`
  form. `command -v mewkit` resolves to nothing in a fresh `npx`-installed project, so the bare form in
  shipped prose is currently an instruction that fails.
- **Contract check.** `scripts/check-kit-verbs.cjs` exists (114 lines), imports `CLI_CATALOGUE` from the
  build output, walks `.claude` only, and matches `/\b(?:npx\s+)?mewkit\s+([a-z][a-z0-9-]*)/` — **one**
  token, so it checks the **verb only**. It carries a visible `NOT_A_VERB` prose allowlist of ~70 words. It
  is green at BASE.
- **Maintainer verbs in CI.** `ci.yml:213` runs `inventory --check` and `ci.yml:296` runs
  `docs-manifest --check` — the phase cites `:264` for the second, which is stale. `validate` is called from
  CI with eleven different single-check flags (`:88`, `:150`, `:153`, `:159`, `:162`, `:165`, `:168`, `:178`,
  `:181`, `:225`, `:228`) and never with `--mode authoring`.
- **Kit references to the verbs being moved or removed.** `mewkit context` **0** in `.claude`,
  `mewkit explain-support` **0**, `mewkit status` **0**, `mewkit providers` **0**, `mewkit budget` **0**,
  `mewkit docs-manifest` **0**; `mewkit inventory` **5** (`harness-substrate.md:1` generated banner,
  `agents/AGENTS_INDEX.md:9` generated banner, `schemas/harness-metadata-schema.json:84`,
  `skills/benchmark/references/dead-weight-audit-rules.md:95`, `skills/context-audit/SKILL.md:47`);
  `mewkit orient` **1** (`capability-bootstrap.md:19`, in the `npx` form). `budget context` is a
  **subcommand of `budget`** and is unrelated to the `context` verb — `ci.yml:186` names it in a comment.
- **Docs.** Six docs-site pages name a verb this sprint removes or moves — `cli/commands.mdx`,
  `cli/index.mdx`, `cli/knowledge.mdx`, `cli/portability.mdx`, `cli/project-setup.mdx`, `cli/telemetry.mdx`
  — plus the two changelog pages (`changelog/index.mdx`, `changelog/archive.mdx`), which record what past
  releases shipped.
- **Defects.** `commands/budget.ts:248` prints "Could not find .claude/memory/cost-log.json" while the
  reader it guards resolves the telemetry state directory (`commands/budget-cost-log.ts:9`). `status` is
  dispatched at `index.ts:388` and still prints `project: [object Object]`.
- **CLI manual.** `.claude/skills/help/` contains **only** `SKILL.md`; there is no `references/` directory
  and no generated CLI manual anywhere in the kit.

## Decisions (user standing directive 261101: take the recommended option)

Twelve points where the phase is ambiguous, or is contradicted by the tree. The user's standing instruction
for this plan is to take the recommended option, so D1–D12 are DECIDED, not proposed. **D1, D2, D5, D6 and
D7 are marked `[CHALLENGE]`** — each either narrows a phase requirement, changes a trust boundary, or rests
on a mechanism this sprint has not yet proven.

- **D1 `[CHALLENGE]` The Node floor is 24 everywhere, and the ADR says so.** The phase offers two options
  (lazy-import the `node:sqlite` users so Node 20 works, or declare 24 everywhere) and asks for an ADR. The
  first option no longer has a subject: `node:sqlite` has **zero** references left in the tree, so there is
  nothing to move behind a lazy import. The remaining question is which number to declare, and the answer is
  the lowest version anything actually tests — CI pins `node-version: 24` in all four job blocks and tests
  no other version, so declaring 20 would publish a floor no run has ever exercised and would re-create the
  same three-answer defect one version lower. DECIDED: 24, in `engines` (already there, unchanged), in the
  README, in the `doctor` check and its label, and in the docs. The risk accepted and stated: v3 is already a
  breaking major (`plan.md` Constraints), and users on Node 20 lose a floor the published artifact never
  satisfied anyway. The ADR records the measurement, the rejected option and the cost.
- **D2 `[CHALLENGE]` The launcher is a committed Node file executed through the runtime descriptor; PATH
  exposure is a separate, stated property, and the bare form in prose depends on it.** The phase asks for a
  committed shim, for every kit invocation to use the **bare** `mewkit` form resolved through it, and for
  `command -v mewkit` to resolve in a hook environment. Those are two mechanisms, not one: a descriptor makes
  the **hook** able to execute the CLI, while prose that says `mewkit plan approve` needs the name on
  **PATH** in the agent's tool environment. DECIDED: (i) `.meowkit/bin/mewkit` is a single committed Node
  CommonJS file with a `node` shebang, written by `init`, pinned to the CLI version that installed the kit,
  and recorded in `.claude/runtime.json` as the descriptor's executable — it is inside the project, so it
  passes the existing realpath-containment gate unchanged and no second trust check is written; (ii) the
  bare form resolves because the kit's **SessionStart** handler appends a PATH assignment to the
  `CLAUDE_ENV_FILE` the host passes it, so the 41 rewritten call sites are runnable as written.
  Round 2 replaces round 1's STOP-and-ask: the mechanism is **confirmed in current official documentation**
  (the hooks reference's "SessionStart → Persist environment variables" section — the host passes
  `CLAUDE_ENV_FILE`, `export` lines appended there are run as shell code before each later Bash command, and
  the section's own worked example is a PATH edit; the environment-variables reference lists
  `CLAUDE_ENV_FILE` as populated dynamically by SessionStart and three sibling events). No user-level
  configuration is needed, so D2(ii)'s "committed mechanism" premise holds. DECIDED with six properties,
  each of which is a failure mode the documentation names rather than a preference:
  (a) the write is an **append** (`>>`), never a truncate, because the file is shared with every other hook
  in the session and a truncate would silently delete another hook's variables;
  (b) the line carries the **fully expanded** PATH value and does **not** interpolate `$PATH`, because one
  unescaped `$PATH` makes PowerShell commands receive **none** of the session's variables from **any** hook —
  the convenient form degrades unrelated tooling;
  (c) Windows PowerShell is a stated **non-target** for the bare form, since PowerShell never receives a
  variable whose value contains `/` or `\`; there, and whenever `CLAUDE_ENV_FILE` is unset (the documented
  example guards on it), the handler **fails closed** to the `mewkit doctor` hint, and the runtime descriptor
  of (i) still serves hooks, so orientation never depends on PATH;
  (d) the directory written is derived from `CLAUDE_PROJECT_DIR` and realpath-contained in the project by the
  **existing** gate, with no second containment implementation;
  (e) the directory is **prepended**, so a project's pinned launcher wins over a global `mewkit`, and it
  contains **only** `mewkit`, so prepending cannot shadow `git`, `node` or any other binary a Bash command
  resolves — the directory listing is asserted, not just the resolution;
  (f) safety hooks are spawned by the host rather than through the Bash tool and MUST NOT resolve any
  executable through this PATH entry, so Gate 1 and Gate 2 behavior is independent of it (AC-07 asserts the
  gate still blocks when the CLI cannot be resolved at all).
  AC-06 probes all six in a `$TMPDIR` fresh init. The residual risk, accepted and stated: the bare form is
  unavailable on PowerShell by construction, so a Windows PowerShell user reads prose naming a form their
  shell cannot resolve — mitigated only by (c)'s doctor hint, and recorded here as the known cost rather than
  presented as full parity.
- **D3 The launcher resolves, in order, the project's own CLI then a version-pinned local CLI store, and
  otherwise prints the doctor hint — and it never reaches the network.** Resolution order: the project's
  `node_modules` entry (the installed-dependency case), then the version-pinned CLI store the install
  populated, then refusal with the `mewkit doctor` hint and a non-zero exit. The store is written at
  **install** time only; no launcher path, on any branch, fetches, spawns a package manager, or reads a
  credential. This is distinguished from sprint 6 D4 deliberately: D4 forbids a second cache of **kit
  content**, because that is the baseline deletion decisions are checked against; a CLI **engine** binary is
  not kit content, is never the subject of an ownership decision, and must be resolvable from a fresh clone
  where the project cache is untracked and therefore absent.
- **D4 Exit codes get one invariant: 0 ran and succeeded, 1 ran and failed, 2 the invocation was wrong.**
  The phase requires "unknown command or subcommand → exit 2 with the list of valid subcommands" and leaves
  the absent-subcommand case open. DECIDED: an unknown subcommand **and** an absent **required** subcommand
  both print the verb's valid subcommands and exit **2**, because both are invocation errors and splitting
  them across 1 and 2 leaves callers unable to tell "you typed it wrong" from "it ran and failed".
  Round 2 restores the "required" qualifier round 1's AC-02 dropped, and names where it lives: **`CommandSpec`
  (`cli/catalogue-types.ts`) carries no such field at BASE**, so the sprint adds one — a boolean on the
  command declaration saying whether the bare form is itself a valid invocation — and the catalogue becomes
  the single declared source the "enumerate and probe every one" assertion reads. Without a declared source
  that assertion is unimplementable, and a hand-carried list beside the catalogue would be a second list.
  **A verb whose bare form is valid today keeps it**: `doctor` (declares `provenance`, and its bare form is a
  CI hard gate — `ci.yml:380` runs `doctor --hard-gates`, which AC-13 requires to pass), `budget` (declares
  `context`) and `backups` (declares `list`/`restore`) are declared not-required and behave exactly as at
  BASE. What changes is the **unknown**-subcommand path: `task` and `trace` move from 0, eleven verbs from 1,
  and `visual-plan` is already 2. The cost accepted: a caller that reads a usage error's exit 1 as meaningful
  would change behavior — measured today as zero such callers, and AC-02 keeps that measured rather than
  assumed.
- **D5 `[CHALLENGE]` The contract check grows to verb + subcommand inside the existing script; no parallel
  script is added.** `scripts/check-kit-verbs.cjs` already does the verb half, is already in CI, and already
  owns the prose-allowlist problem; a second script would be a second answer to one question (the "no second
  list" defect sprint 6 D7 exists to prevent). DECIDED: the same script learns subcommands from the same
  catalogue import and resolves the second token when, and only when, the verb declares subcommands and the
  token is not flag-shaped. Every prose exception stays **visible in the file** as the existing
  `NOT_A_VERB` list is, never a silent skip, and each new entry must correspond to a real occurrence in the
  tree. This narrows nothing from the phase but does change a committed check that is green today, so a
  false positive blocks CI — which is the correct direction of failure and is stated rather than discovered.
- **D6 `[CHALLENGE]` Two whole verbs move to repo scripts; `validate --mode authoring` stays on the CLI.**
  The phase groups `docs-manifest`, `inventory` and `validate --mode authoring` as maintainer surface that
  "move to a repo script and leave the published CLI". DECIDED for the two verbs: `docs-manifest` (0 kit
  references, CI only) and `inventory` (CI plus 5 kit references, all of them maintainer prose or a
  generated banner) become repo scripts, and `ci.yml:213` and `ci.yml:296` call them. **Narrowed, and stated
  rather than done quietly** — and what this narrows is a phase-file Requirement, not one of `plan.md`'s
  user-confirmed Decisions 1–7, none of which mentions `validate`. Round 2 replaces round 1's design argument
  with the measurement: `--mode` is **not a separable branch**. It selects a **whole-run profile** that is
  otherwise auto-detected from the filesystem — `detectValidateMode` (`commands/validate.ts:126-129`) returns
  `authoring` if and only if `packages/mewkit/src` exists, and authoring is documented (`:72-82`) as the full
  coherence suite layered **over** the consumer checks across a **956-line** command. Extracting it would
  mean exporting that command twice, and CI never passes `--mode authoring` at all: it calls `validate` with
  eleven single-check flags (`ci.yml:88,150,153,159,162,165,168,178,181,225,228`) and relies on the
  auto-detection. The compensating action is bound to criteria rather than merely disclosed: the flag's
  declared text is corrected to name it a maintainer mode — `command-catalogue.ts:9`
  (`usage: "validate [--mode authoring|flat-copy]"`) and `:165` ("Force authoring or flat-copy mode instead
  of auto-detecting") — asserted by AC-09, and the generated manual presents it as a maintainer mode,
  asserted by AC-11.
- **D7 `[CHALLENGE]` `context`, `explain-support` and `status` are removed; `providers`, `budget` and
  `orient` stay.** `context` has 0 kit references and 0 CI references (`ci.yml:186` names `budget context`,
  a different thing); `explain-support` is a declared alias and sprint-5 D14 forbids aliases; `status` has 0
  kit references, prints `[object Object]`, and its two jobs are already served by `doctor` and by the
  `versions` verb sprint 6 added. `providers` stays because it is the non-alias half of the pair; `budget`
  stays because the phase's own Requirement 7 asks for its error text to be fixed; `orient` stays because
  the SessionStart path is what AC-06 makes work. The risk accepted: removing three verbs is breaking, and
  `context`'s three subcommands have no replacement — the phase's mitigation, keeping the code available to
  repo scripts, is **not** taken for `context` because nothing calls it; the code is removed and git history
  is the record.
- **D8 The `[object Object]` defect is closed by removal, not by a fix.** The phase's Requirement 7 says
  "status object printing (**if kept**)". D7 does not keep it, so no formatting fix is written, and AC-12
  asserts the defect is unreachable rather than corrected.
- **D9 One generated CLI manual, generated by a repo script, with a staleness check in CI.**
  `.claude/skills/help/references/cli.md` is generated from the catalogue and regenerating it on the finished
  tree is a no-op (`git diff --exit-code`), so the manual cannot lag the surface. It lives under a skill's
  `references/`, which is loaded on demand and not always-listed, so the phase-01 always-on budget is
  unaffected and AC-13 keeps that check green.
- **D10 The docs universe is the six pages that name a removed or moved verb, plus the two changelog pages,
  which are immutable.** All eight are accounted for so the claim is a property of the docs tree rather than
  of a subset, and the docs check resolves commands against the catalogue rather than executing them —
  executing documented install commands would perform real installs.
- **D11 Every fresh-install journey runs in a throwaway project under `$TMPDIR`.** `init`, `upgrade` and
  `uninstall` are never run in or against this repository, not even with `--help`, because this repo IS an
  installed project and its `.claude/` is the product source. Each journey creates its own temp directory,
  asserts there, and removes nothing from the repository.
- **D12 Thirteen ACs.** The sprint is wide but single-seam: every item meets at the CLI's own front door
  (the catalogue, the dispatcher, the call path into it). Thirteen leaves two slots under the evaluator's
  15-criterion ceiling. Round 1 expected D2(iii) to consume one of them; round 2 closed that unknown with a
  documented mechanism instead, and its probes are clauses of AC-06 rather than a fourteenth criterion,
  because they verify the same property AC-06 already owns — that a fresh init project can actually reach its
  CLI. The two slots therefore stay free.

## Definitions

- **Launcher:** the committed project-local executable at `.meowkit/bin/mewkit` that resolves and runs a
  pinned CLI. Its properties are: committed, inside the project, pinned to a version, and network-free on
  every branch.
- **Runtime descriptor:** `.claude/runtime.json`, the install-written file naming the executable a hook may
  run, re-validated on read by the existing realpath-containment gate.
- **Fallback line:** the literal `[orientation fallback: installed runtime unavailable` prefix the
  SessionStart handler prints when no trusted runtime is found. Its absence is the observable signal that
  the launcher executed.
- **Invocation error:** a command the user spelled wrong — an unknown verb, an unknown subcommand, or an
  absent required subcommand. Exit 2, by D4.
- **Shipped kit:** the `.claude/` tree as published, excluding `worktrees/`, which is local scratch and is
  already skipped by the committed check.
- **Contract check:** `scripts/check-kit-verbs.cjs`, extended by D5 to resolve verb **and** subcommand.
- **Maintainer verb:** a command only this repository's CI and maintainers invoke, with zero agent-facing
  use.
- **Fresh init journey:** a throwaway project created under `$TMPDIR`, installed into, asserted against, and
  discarded (D11).
- **Clone-without-init journey:** the sprint-3 journey — a fresh clone of a project whose `.claude/` and
  committed `.meowkit/` members are tracked, with no install step run and the network unreachable.

## Scope (In)

- The contract check extended to verb + subcommand, resolving every `mewkit <verb> <sub>` the shipped kit
  names, with 0 misses on the finished tree (D5)
- Strict dispatch: one exit-code invariant; an unknown subcommand, and an absent subcommand on a verb the
  catalogue declares as **requiring** one, exit 2 with the valid subcommand list — plus the field on the
  command declaration that makes "requires a subcommand" a declared fact rather than an assumption (D4)
- A committed check that no caller of the CLI depends on an invocation error's exit code being 1 (D4, AC-02)
- Per-subcommand `--help`, printing that subcommand's usage from the catalogue without running it
- A Node-floor ADR under `docs/architecture/adr/` and the alignment of `engines`, README, the `doctor` check
  and its label, and the docs to the one number it picks (D1)
- The committed launcher `.meowkit/bin/mewkit`, written by `init`, pinned, network-free, recorded in the
  runtime descriptor and executed by the SessionStart orientation handler (D2, D3)
- The SessionStart `CLAUDE_ENV_FILE` append that puts the launcher's directory first on PATH for the agent's
  tool environment, with all six properties of D2(ii) — append-only, fully expanded value, PowerShell and
  unset-variable fail-closed to the doctor hint, `CLAUDE_PROJECT_DIR`-derived and realpath-contained,
  prepended and single-binary, and never a resolution path for a safety hook (D2)
- Rewriting the 41 `npx mewkit` occurrences in the shipped kit to the bare form
- Removal of `context`, `explain-support` and `status` from the catalogue, the dispatcher and the tree (D7)
- `docs-manifest` and `inventory` moved to repo scripts, with `ci.yml:213` and `ci.yml:296` updated, the
  5 kit references to `mewkit inventory` rewritten to name what a maintainer now runs, and the two remaining
  occurrences outside the kit and the docs site updated — `packages/mewkit/README.md:30` and
  `scripts/terminology-linter.cjs:29` (D6, AC-09)
- The `validate --mode` declaration text corrected at both sites to name a maintainer mode, and the generated
  manual presenting it as one (D6, AC-09, AC-11)
- The generated CLI manual at `.claude/skills/help/references/cli.md` plus its staleness check (D9)
- The `budget` error-path text, and the `doctor` Node check and label (Requirement 7, D1, D8)
- The six docs-site pages that name a removed or moved verb (D10)
- A fresh-init journey and a clone-without-init journey, both under `$TMPDIR` (D11)

## Scope (Out)

- Lazy-importing `node:sqlite` users, or any Node-20 compatibility work. There are no `node:sqlite`
  references left to move, and D1 declares 24 (D1)
- Declaring any floor the CI matrix does not test (D1)
- Removing `providers`, `budget` or `orient`, or adding an alias for anything (D7, sprint 5 D14)
- A formatting fix for `status`; it is removed, so its defect is unreachable (D8)
- Keeping `context`'s code in a repo script. Nothing calls it (D7)
- Moving `validate --mode authoring` out of the CLI, or splitting any single command across two homes (D6)
- A second kit-to-CLI check script, a second verb list, or a second plugin/provider shape (D5)
- Any launcher branch that reaches the network, spawns a package manager, reads a credential, or runs an
  executable outside the project without the existing containment gate (D3)
- A second path-containment implementation. The launcher is validated by the gate `core/hook-runtime.ts`
  already enforces (D2(i))
- A kit-content cache under `$HOME`; sprint 6 D4 still binds. The CLI store of D3 holds engine bytes only
  and is never an ownership baseline (D3)
- Running `init`, `upgrade` or `uninstall` in or against this repository, including with `--help` (D11)
- Executing commands lifted from documentation text (D10)
- Editing `packages/docs/content/docs/changelog/*` (D10)
- Enabling fresh-startup orientation, or any change to what `orient` reports. This sprint makes the existing
  path execute; it does not change its content
- Phase 07's kit-shape work — `.claude/` top-level entry reduction, the `commands/` and `modes/` directories,
  and the metadata budget
- Deleting or rewriting `.meowkit/memory/`, `telemetry/`, `state/`, `cache/`, `envs/`, `backups/` or `.env`
  from any command path (sprint 5 D12 still binds)

## Acceptance Criteria

### [AC-01] The contract check resolves verb and subcommand, and reports zero misses

**Given** the finished tree and the extended `scripts/check-kit-verbs.cjs`, which at BASE matches one token
and therefore checks the verb only
**When** the check is run over the shipped kit, and then run again over a scratch copy carrying three planted
faults — a `mewkit <verb>` that no longer exists, a `mewkit <verb> <sub>` whose verb exists and whose
subcommand does not, and a `mewkit <verb> <sub>` where the verb declares no subcommands at all
**Then** the finished tree reports **0** unresolved references and exits 0, having resolved both tokens
wherever the verb declares subcommands; each of the three planted faults is reported with its file, line and
the exact reference, and the check exits non-zero — so the second token is genuinely checked rather than
collected; a flag-shaped second token (`--json`, `--check`) is not treated as a subcommand; the verb and
subcommand lists both come from the **one** catalogue import the script already uses, so no second list
exists anywhere in the repository; every prose exception the extension needs is a visible entry in the
script with a real occurrence behind it, not a regex that silences a class; and the check remains the single
kit-to-CLI contract check — `git diff BASE` adds no second script that resolves kit CLI references

- **Verification:** run the check on the finished tree asserting exit 0 and a 0-miss report; run it on a
  scratch copy with each of the three planted faults and assert the file, line, reference and non-zero exit;
  plant a flag-shaped second token and assert it is not reported; grep the diff for any new script importing
  the catalogue to resolve kit references; read the script's exception list and confirm each entry matches a
  real tree occurrence
- **Rubric tie-in:** functionality (weight 0.40)

### [AC-02] One exit-code invariant: an invocation error is always 2, with the valid subcommands named

**Given** every verb in the catalogue that declares subcommands — **14** at BASE
(`command-catalogue.ts:13,15,17,18,21,25,28,29,36,52,55,56,57,73`), **13** in the finished catalogue once
`context` is removed (AC-09) — of which `visual-plan` exits 2 on an unknown subcommand, `task` and `trace`
exit **0**, and the remaining **eleven** exit 1; round 1 said thirteen and accounted for only ten of the
exit-1 group, the unaccounted verb being **`pack`**, measured at BASE as exit **1** printing
`Unknown pack subcommand: zzbogus` plus `Usage: mewkit pack <list|add|remove> …` in this repository, and
exit 1 with the "requires meowkit with a pack-manifest.json" precondition message in a project without a
pack manifest — so its unknown-subcommand path is partly masked by a precondition and must be probed in both
project shapes
**When** each is invoked with an unknown subcommand, then with no subcommand at all, then in its normal
successful form, then in a form that runs and fails; an unknown verb is invoked; and every committed
invocation of the CLI in `.claude/hooks/`, `.claude/scripts/`, `scripts/`, `tests/` and `.github/` is read
**Then** an unknown subcommand exits exactly **2** and prints the verb's valid subcommands, so a user is told
what they could have typed; an **absent** subcommand exits 2 with the same list **for the verbs the catalogue
declares as requiring one**, while a verb whose bare form is valid behaves exactly as at BASE — named
explicitly: bare `doctor` still runs (`ci.yml:380` runs `doctor --hard-gates` as a CI hard gate AC-13
requires to pass), bare `budget` still prints its report, bare `backups` still behaves as at BASE; which
verbs require a subcommand is read from the **catalogue's own declaration** (the field D4 adds to
`CommandSpec`), so the enumeration has a declared source and no list is carried beside it; an unknown verb
still exits 2 as at BASE; a command that ran and succeeded exits 0 and one that ran and failed exits 1, so
the three codes mean exactly one thing each; **no** verb in the finished catalogue exits 0 or 1 on an unknown
subcommand — asserted by enumerating the catalogue and probing every one, not by sampling, so a verb added
later cannot quietly reintroduce the silent accept; the subcommand list printed comes from the catalogue
rather than a hand-written string per command; **every committed caller of the CLI is exit-code-agnostic for
an invocation error** — measured at BASE as **zero** `=== 1`, `== 1` or `-eq 1` exit-code comparisons across
those five trees (the only forms present are `!== 0`, e.g. `hooks/lib/gate2-change-set.cjs:25`,
`hooks/handlers/post-session.cjs:48`, `scripts/lib/no-python-checks.cjs:113,124`), and a committed check or
test keeps it true rather than relying on a suite that spawns the CLI nowhere today; and no message prints a
stack trace or an internal class name

- **Verification:** enumerate subcommand-bearing verbs from the built catalogue and, for each, run an unknown
  subcommand, a bare verb, and a known-good invocation, asserting exit code and that the printed subcommand
  list equals the catalogue's; probe `pack` both in a project with a pack manifest and in one without; assert
  bare `doctor`, `budget` and `backups` match their BASE behavior, including `doctor --hard-gates` exit 0;
  run an unknown verb; assert at least one run-and-fail path still exits 1; grep the five committed trees for
  `=== 1`, `== 1` and `-eq 1` exit-code comparisons and assert zero, as a committed check; grep the outputs
  for stack frames and class names; `init`, `upgrade` and `uninstall` are probed only in a throwaway
  `$TMPDIR` project, never here
- **Rubric tie-in:** functionality (weight 0.40)

### [AC-03] `<cmd> <sub> --help` prints that subcommand's usage and runs nothing

**Given** the four measured BASE behaviors — `plan status --help` exits 1 "missing <plan-dir>",
`task new --help` exits 1 "Description is required", `trace score --help` exits **0** "Could not find
.claude/ directory.", `capabilities list --help` exits 1 and tells the user to run `npx mewkit init` — and
every other verb/subcommand pair in the finished catalogue
**When** `--help` is passed after a subcommand, in an empty directory with no `.claude/` present
**Then** every pair prints that **subcommand's** own usage — its name, its arguments and the flags the
catalogue declares for it — exits **0**, and performs no side effect: no file is created or modified in the
working directory, no network request is made, and the subcommand's own work does not run, asserted by a
before/after tree hash of the working directory rather than by reading the output; the absence of `.claude/`
never changes the result, because help is a question about the CLI and not about the project; `--help` before
the subcommand (`mewkit <cmd> --help`) still prints the verb's help as it does at BASE; and the usage text
comes from the catalogue, so a subcommand cannot ship with help that disagrees with the dispatcher

- **Verification:** enumerate every verb/subcommand pair from the built catalogue and run `<cmd> <sub>
  --help` in an empty temp directory, asserting exit 0, the subcommand's name in the output, and a
  before/after tree hash equality; assert the four BASE cases specifically; assert `<cmd> --help` is
  unchanged; block the network for the run
- **Rubric tie-in:** ux-usability (weight 0.20)

### [AC-04] One Node floor, recorded in an ADR and true in every place that states one

**Given** the four disagreeing statements at BASE — `engines.node` `>=24` in both `package.json` files
(root `:44`, `packages/mewkit` `:60`), `README.md:93` "Node.js 20+", `commands/doctor-checks.ts:22-25`
checking `major >= 20` with the label "Node.js >= 20", and `ci.yml` pinning `node-version: 24` in four job
blocks — and the measurement that `node:sqlite` has zero references left in the tree
**When** the ADR is read, and every statement of a supported Node version in the repository is extracted
**Then** an ADR exists under `docs/architecture/adr/` naming the chosen floor, the measurement that the
`node:sqlite` constraint no longer exists, the rejected option and the cost to users below the floor; every
statement of a Node version in `engines`, the README, the `doctor` check **and its label**, the docs site and
the published package metadata states that one number — asserted by extracting them and requiring a single
distinct value, so "aligned" is a property rather than four edits that happen to agree; the CI matrix tests
that floor, so no published floor is untested; `doctor` on a runtime below the floor **fails** that check
with a message naming the required version and the version found, and on a runtime at or above it passes;
and the value is read from one source rather than restated — `git diff BASE` introduces no second hardcoded
floor constant

- **Verification:** read the ADR and assert it names the floor, the measurement, the rejected option and the
  cost; extract every Node-version statement across `package.json` files, README, `doctor` source and label,
  docs and CI, and assert one distinct value; run `doctor` with a stubbed-low and a stubbed-at-floor version
  and assert the fail and pass plus the message content; grep the diff for a second floor constant
- **Rubric tie-in:** functionality (weight 0.40)

### [AC-05] The launcher is committed, pinned, contained and network-free on every branch

**Given** a throwaway project under `$TMPDIR` after a fresh install, and the launcher source as text
**When** the project's git state is inspected; the launcher is run with its resolution targets present, then
with the project's own CLI absent, then with every target absent; and the launcher is run with the network
unreachable
**Then** `.meowkit/bin/mewkit` exists, is executable, is **tracked** by git (the deny-all
`.meowkit/.gitignore` already re-includes `!bin/` and `!bin/mewkit`, so this asserts the file arrives rather
than that the rule exists), and carries the CLI version that installed the kit; it resolves the project's own
CLI first, then the version-pinned local CLI store, and when neither is present it exits non-zero with a
message naming `mewkit doctor` and the version it was looking for — never a stack trace and never a silent
exit 0; with the network unreachable **every** branch behaves identically, because no branch reaches it:
asserted on the launcher text as well as at runtime, by requiring that it contains no network call, no
package-manager spawn, no `npx`, and no credential read; the executable it hands to a hook is validated by
the **existing** containment gate rather than a second implementation, so a launcher moved or symlinked
outside the project is rejected by that gate; and the launcher does not grow a second copy of the CLI — it
resolves one, and `git diff BASE` adds no vendored CLI bundle

- **Verification:** `git ls-files .meowkit/bin/mewkit` in the fresh project and `git check-ignore -v` on it;
  run the launcher with each resolution target removed in turn, asserting the message, the named next action
  and the exit code; run every branch with the network blocked and assert no request was attempted; grep the
  launcher text for network, package-manager, `npx` and credential forms; point a descriptor at a launcher
  outside the project and assert the existing gate rejects it; grep the diff for a vendored CLI
- **Rubric tie-in:** functionality (weight 0.40)

### [AC-06] A fresh init project runs orientation through the launcher, with no fallback line

**Given** a throwaway project created under `$TMPDIR` — never this repository (D11) — installed fresh, the
SessionStart orientation handler invoked in that project's environment, and a `CLAUDE_ENV_FILE` the handler
is given that already contains an unrelated line written by another hook
**When** the handler runs; then runs again after the launcher has been made untrusted (moved outside the
project boundary); then runs with `CLAUDE_ENV_FILE` **unset**; and then runs with the env-file write
suppressed
**Then** `.claude/runtime.json` exists, names the committed launcher as its executable, and passes the
existing read-side trust gate; the handler **executes** the launcher and its output contains **no**
`[orientation fallback: installed runtime unavailable` line — the defect visible in this repository at BASE —
asserted by matching that literal prefix against the handler's output; the orientation content printed is the
installed runtime's own bounded, read-only output rather than the checkpoint cache; when the launcher is made
untrusted the handler falls back to the **labeled** checkpoint cache exactly as it does at BASE — the
fallback is repaired, not removed, so a tampered descriptor still cannot cause an untrusted execution; and
the bare `mewkit` form resolves in that project's agent tool environment, so the invocations AC-08 rewrote
are runnable as written — with each of D2's six properties probed rather than assumed: the env file holds
**exactly one** line added by this handler and the pre-existing unrelated line is **still present**
(append, never truncate); that line assigns a PATH value with the entries **fully expanded** and contains no
literal `$PATH`; `command -v mewkit` inside a Bash tool command resolves to the committed launcher, and the
PATH entry is **first** so a global `mewkit` elsewhere on PATH does not win; the directory that entry names
contains **only** `mewkit`, asserted by listing it, so `git`, `node` and every other binary still resolve to
what they resolved to before; with `CLAUDE_ENV_FILE` unset the handler writes nothing, exits cleanly and
prints the `mewkit doctor` hint rather than erroring, and orientation still works because it goes through the
descriptor and not through PATH; and with the write suppressed the bare form is unavailable and the doctor
hint appears instead of a silently broken invocation. Gate 1 and Gate 2 remain independent of this PATH entry
(AC-07)

- **Verification:** create and install a throwaway `$TMPDIR` project; read `.claude/runtime.json` and assert
  the executable and that the trust gate accepts it; run the handler and assert the fallback prefix is absent
  and that the launcher process was invoked; diff the env file before and after and assert exactly one added
  line, the unrelated line intact, and no literal `$PATH`; run `command -v mewkit` in a Bash tool command and
  assert it resolves to the committed launcher even with a decoy `mewkit` later on PATH; list the PATH entry's
  directory and assert it holds only `mewkit`; re-run with `CLAUDE_ENV_FILE` unset and with the write
  suppressed, asserting the doctor hint, a clean exit and working orientation; move the launcher outside the
  project, re-run, and assert the labeled fallback returns; remove the temp project afterwards
- **Rubric tie-in:** functionality (weight 0.40)

### [AC-07] The clone-without-init journey works through the committed launcher

**Given** the sprint-3 journey: a throwaway project installed under `$TMPDIR`, committed, then cloned to a
second directory with **no** install step run in the clone, no `node_modules`, the untracked
`.meowkit/cache/` therefore absent, and the network unreachable
**When** the SessionStart observers run in the clone, Gate 1 is exercised on a source edit, and the launcher
is invoked directly
**Then** the committed launcher is present in the clone because it is tracked, and it is the path the clone
uses; when the pinned CLI is resolvable from the local CLI store the clone's hooks execute it and orientation
works with no network; when it is not, the launcher and the observers print the `mewkit doctor` hint and the
**safety behavior is unchanged** — Gate 1 still blocks the source edit with its existing exit code and
marker, because a missing CLI must never relax a gate; in neither case does anything in the clone reach the
network, and in neither case does a hook crash; and no step of this journey runs `init`, `upgrade` or
`uninstall` against this repository

- **Verification:** build the two-directory journey under `$TMPDIR`; with the network blocked, run the
  observers and assert either real orientation or the doctor hint and never a crash; attempt a source edit
  and assert Gate 1's existing block exit code and marker in both the resolvable and unresolvable cases;
  assert `.meowkit/cache/` is absent in the clone and that the launcher is tracked; assert no network request
  was attempted
- **Rubric tie-in:** functionality (weight 0.40)

### [AC-08] The shipped kit tells agents to run the bare form, and `npx mewkit` is gone from it

**Given** the **41** `npx mewkit` occurrences across **28** files in the shipped kit at BASE, and the 204
bare `mewkit <word>` occurrences already there
**When** the finished shipped kit is searched, and every CLI invocation it names is resolved
**Then** `npx mewkit` occurs **zero** times in the shipped kit; every rewritten site names the bare form and
nothing else — no `npx`, no hardcoded absolute path, no `node path/to/dist`; each rewritten invocation still
names the same verb and subcommand it named at BASE, so the rewrite changed the call form and not the
instruction, asserted by comparing the extracted (verb, subcommand) multiset before and after and requiring
it to differ only where AC-09 removed a verb; the contract check of AC-01 is green over the rewritten text;
and the rewrite is confined to the shipped kit — `docs/` and `packages/docs/` changelog pages keep their
historical `npx` forms, because they record what a past release did

- **Verification:** `grep -rn "npx mewkit" .claude` excluding `worktrees/` and assert zero; extract every
  invocation from the shipped kit before and after and diff the (verb, subcommand) multisets; grep the
  rewritten sites for absolute paths and `node .*dist`; run the AC-01 check; `git diff BASE` on the changelog
  pages is empty
- **Rubric tie-in:** product-depth (weight 0.25)

### [AC-09] Three verbs are gone, two moved, and nothing still names them as runnable

**Given** `context` (0 kit and 0 CI references; `ci.yml:186` names `budget context`, which is a subcommand of
`budget` and stays), `explain-support` (a declared alias), `status` (0 kit references, prints
`[object Object]`), and the two maintainer verbs `docs-manifest` (CI only, `ci.yml:296`) and `inventory`
(`ci.yml:213` plus 5 kit references); and the two surfaces round 1's closing clause missed, both measured:
**`packages/mewkit/README.md:30`**, which documents `` `mewkit status` | Print version, channel, and config ``
and is the README **published with the npm package**, so it would ship documenting a removed verb, and
**`scripts/terminology-linter.cjs:29`**, whose comment names `mewkit inventory --check`, the call D6 moves to
a repo script. Those two are the complete remainder: across `README.md`, `packages/mewkit/README.md`,
`scripts/` and `tests/` there are exactly **two** occurrences of a removed or moved verb at BASE, and the
root `README.md` has none
**When** each removed verb is invoked, each maintainer script is run from this repository, CI's two call
sites are read, and the shipped kit, the six docs-site pages, both READMEs, `scripts/` and `tests/` are
searched
**Then** `mewkit context`, `mewkit explain-support` and `mewkit status` are **invocation errors** exiting 2
with the unknown-command message, are absent from the catalogue, from `--help`, and from the dispatcher, and
their command sources are deleted rather than orphaned; `providers`, `budget` and `orient` still work, and
`budget context` still works, so the removal did not catch a neighbour; `docs-manifest` and `inventory` are
absent from the published CLI and present as repo scripts whose output is **equivalent to BASE** — the
manifest drift check and the inventory check each produce the same verdict on the same tree as the BASE verb
did, asserted by comparing their output on this tree, not by assuming; `ci.yml` calls the two scripts and no
longer calls the verbs; the 5 kit references to `mewkit inventory` name what a maintainer now runs, and the
two generated banners are regenerated rather than hand-edited; the `--mode` flag's declared text is corrected
to name a maintainer mode at **both** declaration sites (`command-catalogue.ts:9` usage string and `:165`
summary), so the surface a user reads matches D6's narrowing rather than only the contract recording it; and
**no** shipped kit file, no docs-site page outside the two changelog pages, no CI workflow, **no published
package README and no `scripts/` or `tests/` comment** still presents a removed or moved verb as runnable —
the universe is those five surfaces, enumerated so the claim is a property of the repository rather than of
the trees round 1 happened to list

- **Verification:** invoke each removed verb and assert exit 2 and the message; invoke `providers`, `budget`,
  `budget context` and `orient` and assert they still work; run both repo scripts and diff their verdicts
  against the BASE verbs' output on this tree; read `ci.yml` and assert the two call sites changed and no
  other `mewkit docs-manifest`/`mewkit inventory` call remains; grep the shipped kit, the six docs pages, the
  workflows, both READMEs, `scripts/` and `tests/` for each removed or moved verb and assert zero live
  occurrences, `packages/mewkit/README.md:30` and `scripts/terminology-linter.cjs:29` included by name;
  read both `--mode` declaration sites and assert the corrected text; regenerate the two banners and assert
  `git diff --exit-code`
- **Rubric tie-in:** product-depth (weight 0.25)

### [AC-10] The removals and the strict dispatch are reflected in the docs, and nothing documented is unrunnable

**Given** the **eight** docs-site pages that name a removed or moved verb at BASE — `cli/commands.mdx`,
`cli/index.mdx`, `cli/knowledge.mdx`, `cli/portability.mdx`, `cli/project-setup.mdx`, `cli/telemetry.mdx`,
and the two changelog pages `changelog/index.mdx` and `changelog/archive.mdx`, which are immutable records of
past releases
**When** every `mewkit` command and flag in all eight is extracted and **resolved** against the finished
catalogue — resolution, not execution, because running documented install commands would perform real
installs and real network fetches
**Then** every command and flag on the six updated pages resolves to a declared command, a declared
subcommand of it, and a flag declared for it, with nothing spelled differently from the catalogue — and a
deliberately planted bad flag in a scratch copy makes the check fail, so it has teeth; those six pages
document the Node floor of AC-04, the launcher-based call path, the exit-code invariant of AC-02, and the
per-subcommand help of AC-03, and document no removed verb as available; the two changelog pages are
asserted **unchanged by diff** with their reason recorded; and no page documents a network-fetching launcher
or a bare form that only works after a global install

- **Verification:** extract every `mewkit` command and flag from all eight pages, resolve each against the
  built catalogue asserting zero unresolved verbs, subcommands and flags on the six, and assert the resolver
  fails on a planted bad flag; **execute nothing**; `git diff BASE -- packages/docs/content/docs/changelog`
  is empty; grep the docs for each removed verb
- **Rubric tie-in:** product-depth (weight 0.25)

### [AC-11] One generated CLI manual, and it cannot go stale

**Given** the finished catalogue and `.claude/skills/help/`, which at BASE contains only `SKILL.md` and no
`references/` directory
**When** the manual is generated, the generator is run again on the finished tree, and the manual is compared
against the catalogue
**Then** `.claude/skills/help/references/cli.md` exists and lists **every** command in the catalogue with its
summary, its subcommands and the flags declared for it — entry count equal to the catalogue's command count
exactly, with no entry for a command that does not exist and no command without an entry, so the manual is
derived rather than maintained; it names no removed verb; it presents `validate --mode` as a **maintainer
mode** — carrying the corrected declaration text of AC-09 rather than BASE's "Force authoring or flat-copy
mode instead of auto-detecting", so D6's narrowing reaches the surface an agent actually reads and is not
only recorded in this contract; regenerating the manual is a **no-op** (`git diff --exit-code`), and a
committed check in CI fails when the catalogue changes without the manual being regenerated, proven by
changing the catalogue in a scratch copy and observing the check fail; the manual is the **only** generated
full-surface CLI reference in the shipped kit, so agents learn verbs from one place; and it lives under a
skill's `references/`, loaded on demand, so the always-on context budget check stays green

- **Verification:** generate and assert entry count against the catalogue both ways; assert the manual's
  `validate --mode` text equals the corrected declaration and names a maintainer mode; regenerate and
  `git diff --exit-code`; change the catalogue in a scratch copy and assert the staleness check fails; grep
  the shipped kit for a second full-surface CLI reference; run the always-on budget check
- **Rubric tie-in:** product-depth (weight 0.25)

### [AC-12] Every error path this sprint touches names a real path, a real version, and a next action

**Given** the measured defects — `commands/budget.ts:248` printing "Could not find
.claude/memory/cost-log.json" while its reader resolves the telemetry state directory
(`commands/budget-cost-log.ts:9`), the `doctor` Node check labelled "Node.js >= 20" against an `engines`
floor of 24, and `status` printing `project: [object Object]`
**When** each path is triggered: `budget` in a project with no cost log, `doctor` on a runtime below the
floor, and `mewkit status`
**Then** the `budget` message names the path the code actually reads and one next action, and the path it
names **exists in the resolution the reader performs** — asserted by comparing the message against the
resolved path, not by eye; the `doctor` check's label and its failure text both name the AC-04 floor and the
version found; `mewkit status` is an invocation error (exit 2, unknown command) and the `[object Object]`
output is therefore **unreachable** — asserted by searching the finished tree for the removed printer rather
than by formatting it, since the phase scopes that fix to "if kept" and it is not kept; and across all three,
plus the invocation errors of AC-02 and the launcher refusals of AC-05, no message prints a stack trace, an
internal class name, a temp path, or a path the code does not read

- **Verification:** run `budget` with no cost log in a temp project and assert the message equals the
  resolved path and names a next action; run `doctor` with a stubbed below-floor version and assert the label
  and text; run `mewkit status` and assert exit 2; grep the finished tree for the status printer; collect
  every message from these paths plus AC-02 and AC-05 and assert no stack frame, class name, temp path or
  unread path appears
- **Rubric tie-in:** ux-usability (weight 0.20)

### [AC-13] The whole repository is green, and the diff stays inside the quality limits

**Given** `git diff BASE` at the end of the sprint and the committed checks
**When** the full suite and every validator are run, and every new or changed `.ts`, `.cjs`, `.js`, `.mjs`,
`.sh`, `.py`, `.yml`, `.json` and `.md` file is measured (the generated CLI manual and generated banners
exempt from the line rule)
**Then** the full test suite passes with **no** skipped or relaxed assertion introduced by this sprint —
asserted by diffing the skipped-test set against BASE, not by reading the summary; `pnpm lint` and
`pnpm typecheck` report 0 errors; `mewkit validate --packs`, `--target codex`, `--target cursor`,
`--frontmatter`, `--docs-refs`, `--gates`, `--memory`, `scripts/check-kit-verbs.cjs`,
`scripts/check-env-reads.cjs`, `scripts/check-always-on-budget.cjs`, `scripts/check-no-python.cjs`,
`scripts/check-dangling-rule-refs.cjs`, `scripts/check-memory-wiki-residue.cjs` and `mewkit doctor` hard
gates all pass, and the codex and cursor projections regenerate to a no-op (`git diff --exit-code`), so no
projection lags the reduced surface; no new file exceeds 200 lines and no changed file crosses 200 because of
this sprint, with every file already over 200 at BASE that grew listed by name with its BASE and final count;
no changed TypeScript adds an `any` or an unsafe cast; no new TODO or FIXME, no commented-out code, no unused
import, no hardcoded secret and no key material; and no code comment, test name, file name or script name
introduced by this sprint references a plan artifact — phase number, sprint number, criterion identifier,
decision number, round or amendment — the reason for a piece of code being stated as the invariant it
protects

- **Verification:** run the suite, lint, typecheck and each named validator and check, asserting exit 0;
  diff the skipped-test set against BASE; regenerate projections and `git diff --exit-code`;
  `git diff --stat BASE` plus `wc -l` on new and changed files; grep added lines for `any`, casts, TODO,
  FIXME and secret encodings; grep the diff's comments, test names and new file names for plan-artifact
  tokens
- **Rubric tie-in:** code-quality (weight 0.15)

## Out-of-Scope Clarifications

- Do not add a Node-20 compatibility path, a lazy import for a module no longer referenced, or a second
  hardcoded floor constant. One floor, one source, recorded in an ADR.
- Do not let the launcher reach the network on any branch, spawn a package manager, read a credential, or
  run an executable the existing containment gate has not accepted. A hook-time fetch is the failure mode the
  committed launcher exists to remove.
- Do not write a second path-containment check. The realpath-both-sides gate already enforced on the runtime
  descriptor is the one gate.
- Do not create a second cache of kit content, and do not put kit content under `$HOME`. The pinned CLI store
  holds engine bytes only and is never an ownership baseline.
- Do not run `init`, `upgrade` or `uninstall` in or against this repository, not even with `--help`. This
  repository is an installed project and its `.claude/` is the product source. Journeys run in throwaway
  `$TMPDIR` projects.
- Do not add a second kit-to-CLI contract check, a second verb list, or a regex that silences a class of
  unresolved references. Extend the committed check and keep every exception visible with a real occurrence
  behind it.
- Do not silence a usage error. An unknown subcommand, and an absent subcommand on a verb that requires one,
  exit 2 and name the valid subcommands; an exit 0 on a mistyped invocation is the defect being removed.
- Do not run a subcommand in order to print its help. Help is answered from the catalogue, with no side
  effect and no `.claude/` requirement.
- Do not remove `providers`, `budget`, `orient` or `budget context`, and do not add an alias for anything.
- Do not keep `context`'s implementation in a repo script. Nothing calls it; git history is the record.
- Do not split `validate` across two homes to move `--mode` out of the CLI. It selects a whole-run profile
  the command auto-detects from the filesystem, not a separable branch, and CI never passes it. Correct the
  flag's declared text and the generated manual instead.
- Do not write a formatting fix for `status`. It is removed; a fix would be code for an unreachable path.
- Do not hand-edit a generated file — the CLI manual or either generated banner. Change the generator and
  regenerate.
- Do not rewrite `npx mewkit` outside the shipped kit. Changelog and journal pages record what a past release
  did, and rewriting them would falsify it.
- Do not execute commands extracted from documentation. Resolve them against the catalogue.
- Do not weaken, relax or skip a test, and do not let a missing CLI relax a gate. If BASE behavior and the
  required result cannot be reconciled, stop and ask.
- Do not reference a plan artifact — phase number, sprint number, criterion identifier, decision number,
  round or amendment — in a code comment, a test name, a file name or a script name. State the invariant.
- Do not truncate the `CLAUDE_ENV_FILE`, write a `$PATH`-interpolating line into it, append more than the one
  PATH line, or put anything but `mewkit` in the directory that line prepends. Each of those is a documented
  failure mode: a truncate deletes another hook's variables, an unescaped `$PATH` strips PowerShell commands
  of every hook-set variable, and a shared directory on the front of PATH shadows binaries the user never
  asked to replace.
- Do not make orientation, Gate 1 or Gate 2 depend on the PATH entry. Hooks resolve the CLI through the
  runtime descriptor; PATH exists only so prose the agent runs in Bash resolves.
- Do not treat an absent subcommand as an error on a verb whose bare form is valid today. `doctor`, `budget`
  and `backups` keep their BASE behavior, and `doctor --hard-gates` must stay a passing CI gate.
- Do not carry a hand-written list of which verbs require a subcommand beside the catalogue. Declare it on
  the command and read it from there.

## Rubric Bindings

- functionality: AC-01, AC-02, AC-04, AC-05, AC-06, AC-07
- product-depth: AC-08, AC-09, AC-10, AC-11
- ux-usability: AC-03, AC-12
- code-quality: AC-13

## Negotiation Log

- Round 1 (proposer/generator): initial draft from `phase-06-cli-surface.md` plus `plan.md` Decisions 1–7 and
  Constraints plus the `cli-tool` preset (functionality 0.40, product-depth 0.25, ux-usability 0.20,
  code-quality 0.15 — `.claude/rubrics/composition-presets/cli-tool.md`), with every claim measured at BASE
  `4f02804f985550599ab87a166b56516342c0144a` rather than taken from the phase file. Twelve Decisions are
  recorded rather than left open, per the user's standing directive; five are marked `[CHALLENGE]`.
  The phase file is contradicted by the tree in nine places, each of which drove a Decision or an AC:
  (a) the phase's "unknown command … exits 0" is already fixed — an unknown **verb** exits 2 at
  `index.ts:516-525`; what is broken is the **subcommand** level, where `task` and `trace` exit 0,
  `visual-plan` exits 2 and ten verbs exit 1, so the work is restated at that level (D4, AC-02);
  (b) the phase's first Node option — move the `node:sqlite` users behind a lazy import — has no subject
  left: `node:sqlite` has zero references in the tree, so the only open question is which number to declare,
  and CI tests exactly one (24) (D1, AC-04);
  (c) the phase's `~/.meowkit/cache` collides with sprint 6 D4, which forbids a second cache of kit content;
  the collision is resolved by distinguishing kit content from CLI engine bytes and by keeping the launcher's
  store out of every ownership decision (D3);
  (d) the phase asks for both a committed launcher and the **bare** `mewkit` form; those are two mechanisms,
  since a runtime descriptor serves hooks while prose needs PATH — both are required and the PATH mechanism
  is the sprint's largest unknown, with a STOP-and-ask if no committed mechanism exists (D2, AC-06, AC-08);
  (e) `.meowkit/.gitignore` already re-includes `!bin/` and `!bin/mewkit`, so the launcher slot is reserved
  and only the file is missing — AC-05 therefore asserts the file arrives, not that the rule exists;
  (f) `scripts/check-kit-verbs.cjs` already exists and checks the verb only, so the phase's
  `scripts/check-kit-cli-contract.*` would be a second answer to one question; the existing check is
  extended instead (D5, AC-01);
  (g) the phase's CI citation for `docs-manifest --check` is `:264`; it is at `ci.yml:296`, and
  `inventory --check` at `:213` is a second call site the phase does not name (D6, AC-09);
  (h) the phase's `validate --mode authoring` extraction is narrowed and the narrowing is stated:
  `validate` stays a user verb called from CI with eleven other flags, and splitting one command across two
  homes removes nothing a user sees (D6);
  (i) the phase's `status` fix is conditional ("if kept") and `status` is not kept, so the
  `[object Object]` defect is closed by removal and AC-12 asserts unreachability instead of formatting
  (D7, D8).
  Also decided: one exit-code invariant across the whole surface rather than per-command behavior (D4); the
  defect list is reduced to the two live items plus a removal (D8); the generated manual lives under a
  skill's `references/` so the always-on budget is unaffected (D9); the docs universe is the eight pages that
  name a removed or moved verb, with the two changelog pages immutable (D10); every fresh-install journey
  runs in a throwaway `$TMPDIR` project and never against this repository (D11); and the sprint stays at 13
  ACs, two under the ceiling, because D2(iii) makes an amendment likely (D12).
- Round 1 (reviewer/evaluator): clarifications on AC-02 (three), D2/AC-06, D6 and AC-09. Verified
  independently at BASE and accepted without change: D7's removals (`mewkit context` **0**,
  `mewkit explain-support` **0**, `mewkit status` **0** in `.claude` excluding `worktrees/`; zero occurrences
  of any of the three in `scripts/`, `.github/`, `tests/` or `docs/`), `budget context` protected by AC-09's
  neighbour clause and present at `command-catalogue.ts:15`, the docs universe (exactly **8** pages under
  `packages/docs/content/docs` name a removed or moved verb — the six named plus the two changelog pages, so
  D10's "property of the docs tree" claim holds), the invocation counts (**41** `npx mewkit` across **28**
  files in `.claude` excluding `worktrees/`), the catalogue size (**29** commands, 328 lines), and D1/AC-04,
  which would catch a regression: the single-distinct-value extraction across `engines`, README, the `doctor`
  check **and its label**, docs and CI, plus the no-second-floor-constant grep, is a property assertion rather
  than four edits that agree.
- Round 1 (reviewer): AC-02 the absent-subcommand clause as written contradicts AC-13 and would break a CI
  gate. D4 says an absent **required** subcommand exits 2; AC-02 drops "required" and asserts "the unknown
  subcommand and the absent subcommand both exit exactly **2**", asserted "by enumerating the catalogue and
  probing every one". `doctor` declares a subcommand (`provenance`, `command-catalogue.ts:18`) and its bare
  form is a CI hard gate — `.github/workflows/ci.yml:380` runs `node packages/mewkit/dist/index.js doctor
  --hard-gates`, and AC-13 requires `mewkit doctor` hard gates to pass. `budget` (`:15`, sub `context`) and
  `backups` (`:73`, subs `list`/`restore`) have the same shape. State (i) where "required" is declared — there
  is no such field on `CommandSpec` (`cli/catalogue-types.ts`), so either add one or carry an explicit list,
  because without a declared source the "enumerate and probe every one" assertion is unimplementable; and
  (ii) a clause that every verb whose bare form is valid today still behaves as at BASE, naming `doctor`,
  `budget` and `backups`.
- Round 1 (reviewer): AC-02 the no-caller-depends-on-exit-1 check is asserted by proxy and the proxy does not
  exist. D4 states "such a caller surfaces as a failing test rather than as a silent change" via AC-13, but no
  committed test spawns the CLI to assert an exit code — `grep -rln "dist/index\.js|execFileSync.*mewkit|
  spawnSync.*mewkit" packages/mewkit/src tests` matches no test file. Add an explicit static clause to AC-02:
  every committed invocation of the CLI in `.claude/hooks/`, `.claude/scripts/`, `scripts/`, `tests/` and
  `.github/` is exit-code-agnostic for an invocation error. This is measured to pass today — the only forms
  present are `status !== 0` (`hooks/lib/gate2-change-set.cjs:25`, `hooks/handlers/post-session.cjs:48`,
  `scripts/lib/no-python-checks.cjs:113,124`, and four others) and there are **zero** `=== 1`, `== 1` or
  `-eq 1` exit-code comparisons across those trees — so the clause is cheap and its value is that it stays
  true, not that it is hard.
- Round 1 (reviewer): AC-02 the enumeration count is off by one. **14** verbs declare subcommands at BASE, not
  13: `capabilities`, `budget`, `skill`, `doctor`, `task-state`, `advice`, `context`, `task`, `visual-plan`,
  `review`, `plan`, `trace`, `pack`, `backups` (`command-catalogue.ts:13,15,17,18,21,25,28,29,36,52,55,56,57,
  73`). The BASE tally `visual-plan` 2 + `task`/`trace` 0 + "the other ten" 1 sums to 13, so one of the
  fourteen was not probed and its BASE exit code is unstated. Restate as 14 at BASE (13 in the finished
  catalogue once `context` is removed), name which verb the "ten exit 1" group excludes, and give its measured
  BASE behavior.
- Round 1 (reviewer): D2(ii)/(iii) the PATH mechanism is **confirmed by current official documentation** — make
  it concrete and drop the STOP-and-ask. The Claude Code hooks reference ("SessionStart → Persist environment
  variables") states that SessionStart hooks receive a `CLAUDE_ENV_FILE` path, that `export` lines appended
  there persist for later shell commands — "Each Bash command runs the file's contents as shell code before the
  command itself" — and its own worked example is a PATH edit (`export PATH="$PATH:./node_modules/.bin"`). The
  environment-variables reference lists `CLAUDE_ENV_FILE` as "populated dynamically by SessionStart, Setup,
  CwdChanged, and FileChanged hooks". So no user-level config is needed and the committed-mechanism premise of
  D2(ii) holds. Replace the STOP-and-ask with a decided mechanism naming: (a) the write is **append** (`>>`),
  never a truncate, because the file is shared with every other hook in the session; (b) the line is a
  **plain assignment with the PATH fully expanded**, not `$PATH`-interpolating — the same docs state that one
  line with an unescaped `$PATH` makes PowerShell commands receive **none** of the session's variables from
  any hook, so the convenient form silently degrades other tooling; (c) Windows PowerShell is a stated
  non-target for the bare form, because the same section states PowerShell never receives a variable whose
  value contains `/` or `\` — there, and whenever `CLAUDE_ENV_FILE` is unset (the docs' own example guards
  `[ -n "$CLAUDE_ENV_FILE" ]`), the handler **fails closed** to the `mewkit doctor` hint and the descriptor
  path still serves hooks; (d) the directory written is derived from `CLAUDE_PROJECT_DIR` and realpath-contained
  in the project by the existing gate, with no second containment implementation; (e) the directory is
  **prepended** so the pinned project launcher wins over a global `mewkit`, and it contains **only** `mewkit`,
  so prepending cannot shadow `git`, `node` or any other binary a Bash command resolves — assert the directory
  listing, not just the resolution; (f) safety hooks are spawned by Claude Code rather than through the Bash
  tool and must not resolve any executable through this PATH entry, so Gate 1/Gate 2 behavior is independent
  of it. Then give AC-06 (or a 14th AC) a clause that probes it in a `$TMPDIR` fresh init: the env file
  contains exactly the expected appended line, `command -v mewkit` resolves to the committed launcher in a
  Bash tool command, and with the write suppressed the doctor hint appears instead of a broken bare form.
- Round 1 (reviewer): D6 the narrowing is accepted, and the measured reason it needs is available — put it in,
  and add the missing probe. The phase requirement this narrows is a phase-file Requirement, not a `plan.md`
  user-confirmed Decision (`plan.md` Decisions 1–7 do not mention `validate`), so a disclosed narrowing with a
  measured reason is in order — but "splitting one command across two homes removes nothing a user sees" is a
  design argument, and the measurement is stronger: `--mode` is not a separable branch but a **whole-run
  profile auto-detected from the filesystem** (`commands/validate.ts:125-129` — `detectValidateMode` returns
  `authoring` iff `packages/mewkit/src` exists; `:72-82` documents authoring as the full coherence suite
  layered over the consumer checks across a 956-line command), and CI calls `validate` with eleven
  single-check flags and never `--mode authoring`. State it that way. Separately, the compensating action is
  disclosed but not probed: no AC asserts the flag summary is corrected to name a maintainer mode
  (`command-catalogue.ts:9` `usage: "validate [--mode authoring|flat-copy]"` and `:165` "Force authoring or
  flat-copy mode instead of auto-detecting"), nor that the generated manual of AC-11 presents it as such. Bind
  that to AC-09 or AC-11.
- Round 1 (reviewer): AC-09 the removed-verb universe has a hole on a user-visible surface. The closing clause
  covers "no shipped kit file, no docs-site page outside the two changelog pages, and no CI workflow" —
  `packages/mewkit/README.md:30` is none of the three and documents `` `mewkit status` | Print version,
  channel, and config ``; it is the README published with the npm package, so it would ship documenting a
  removed verb. `scripts/terminology-linter.cjs:29` also carries a comment naming `mewkit inventory --check`,
  which D6 moves to a repo script. Extend the universe to the published package README and to `scripts/`
  comments, or state why each is excluded.
- Round 2 (proposer/generator): all six clarifications addressed, every change a replacement rather than a
  deletion. No AC added and none removed — still 13, per D12. **Every reviewer finding was independently
  re-derived at BASE before being accepted, and all six held.** Confirmed: `CommandSpec`
  (`cli/catalogue-types.ts`) carries `name`, `summary`, `subcommands?`, `usage?` and `passThrough?` and
  **no** required-subcommand field; `ci.yml:380` is `node packages/mewkit/dist/index.js doctor --hard-gates`;
  `grep -rnE "(=== 1|== 1|-eq 1)"` over `.claude/hooks`, `.claude/scripts`, `scripts`, `tests` and `.github`
  returns **zero** exit-code comparisons; the fourteenth subcommand-bearing verb is **`pack`**, measured at
  exit **1** both with a pack manifest (`Unknown pack subcommand: zzbogus` + usage) and without (the
  pack-manifest precondition message), so round 1's "the other ten exit 1" was eleven;
  `detectValidateMode` is at `commands/validate.ts:126-129` keyed on `packages/mewkit/src` existing, inside a
  **956**-line command, and `--mode authoring` appears in no CI call; `packages/mewkit/README.md:30`
  documents `mewkit status` and `scripts/terminology-linter.cjs:29` names `mewkit inventory --check`, and a
  sweep of both READMEs, `scripts/` and `tests/` finds **exactly those two** occurrences, the root
  `README.md` having none.
  Item by item: **(1)** D4 and AC-02 restore the "required" qualifier and name its source — a field added to
  `CommandSpec`, so the enumeration reads a declared fact instead of guessing; `doctor`, `budget` and
  `backups` are named as declared not-required with BASE behavior preserved, and the CI hard gate is cited in
  both places. **(2)** AC-02 gains an explicit static clause over the five committed trees with the measured
  zero, kept true by a committed check rather than by a suite that spawns the CLI nowhere — the proxy round 1
  relied on. **(3)** The Pinned baseline and AC-02 restate the count as 14 at BASE and 13 in the finished
  catalogue, name `pack` and give both of its measured BASE exit paths. **(4)** D2's STOP-and-ask is replaced
  by the decided `CLAUDE_ENV_FILE` mechanism carrying all six properties, each stated as the documented
  failure mode it avoids, with the PowerShell non-target and the unset-variable case failing closed to the
  doctor hint; AC-06 probes all six in a `$TMPDIR` fresh init, including a decoy `mewkit` later on PATH and a
  listing of the prepended directory; the residual cost — no bare form on PowerShell — is recorded rather
  than papered over, and D12 notes the ceiling slots stayed free because the probes belong to a property
  AC-06 already owns. **(5)** D6 swaps the design argument for the measurement (whole-run profile,
  filesystem-detected, 956-line command, never passed by CI) and binds the compensating action: AC-09
  asserts both corrected declaration sites, AC-11 asserts the generated manual presents it as a maintainer
  mode. **(6)** AC-09's universe becomes five enumerated surfaces including the published package README and
  `scripts/`/`tests/` comments, with the two remaining occurrences named and the root README's absence
  recorded, so the closing clause is a property of the repository rather than of the trees round 1 listed.
  One thing round 2 does **not** do, and says so: it does not verify the `CLAUDE_ENV_FILE` documentation
  independently — the reviewer's citation of the hooks and environment-variables references is taken as the
  evidence, and if the mechanism proves absent at build time that is an amendment, not a silent fallback.
- Round 2 (reviewer): **accepted.** All six round-1 clarifications are resolved in the criteria and decision
  text rather than only in the log, and the amendments introduce no new contradiction. Checked individually:
  **(1)** D4 restores "required" and AC-02's Then clause now reads "an **absent** subcommand exits 2 … **for
  the verbs the catalogue declares as requiring one**, while a verb whose bare form is valid behaves exactly
  as at BASE", naming bare `doctor`, `budget` and `backups` and citing `ci.yml:380` in both D4 and AC-02 — the
  round-1 contradiction with AC-13's `mewkit doctor` hard gate is closed, and the Out-of-Scope list carries a
  matching guard. The scope of change is now stated correctly as the **unknown**-subcommand path only.
  **(2)** AC-02 carries the static clause over the five committed trees with the measured zero and keeps it
  true by a committed check rather than by the non-existent CLI-spawning suite; independently re-confirmed —
  zero `=== 1` / `== 1` / `-eq 1` exit-code comparisons across `.claude/hooks/`, `.claude/scripts/`,
  `scripts/`, `tests/` and `.github/`, only `!== 0` forms. **(3)** The count is restated as 14 at BASE / 13
  finished with the fourteenth named (`pack`) and both of its BASE exit paths given, including the
  pack-manifest precondition that masks one of them — a better answer than round 1 asked for, since it makes
  the probe two-shaped. **(4)** D2's STOP-and-ask is gone, replaced by the decided mechanism with all six
  properties, and AC-06 probes each one in a `$TMPDIR` fresh init in testable form: a pre-existing unrelated
  line still present (append), exactly one added line, no literal `$PATH`, `command -v mewkit` resolving to
  the committed launcher **against a decoy `mewkit` later on PATH** (which is what makes "prepended" an
  assertion rather than a hope), a directory listing proving the entry holds only `mewkit`, and the
  `CLAUDE_ENV_FILE`-unset and write-suppressed runs failing closed to the doctor hint with orientation still
  working through the descriptor. The PowerShell non-parity is recorded as a cost rather than claimed as
  parity. For the record, the documentation evidence is the reviewer's and was read directly at review time:
  the hooks reference section "SessionStart → Persist environment variables" ("Each Bash command runs the
  file's contents as shell code before the command itself", with a PATH edit as its worked example, and the
  PowerShell plain-assignment and `/`-or-`\` restrictions) and the environment-variables reference entry for
  `CLAUDE_ENV_FILE` ("populated dynamically by SessionStart, Setup, CwdChanged, and FileChanged hooks").
  **(5)** D6 now carries the measurement (`detectValidateMode`, `commands/validate.ts:126-129`, keyed on
  `packages/mewkit/src`; authoring documented at `:72-82` as the full coherence suite over the consumer
  checks inside a 956-line command; CI passes eleven single-check flags and never `--mode authoring`) and the
  compensating action is bound to criteria — AC-09 asserts both declaration sites, AC-11 asserts the generated
  manual presents it as a maintainer mode. The narrowing remains a departure from a phase-file Requirement,
  not from a `plan.md` user-confirmed Decision, and is disclosed as such. **(6)** AC-09's universe is five
  enumerated surfaces; its new factual claim is independently verified — exactly **two** occurrences of a
  removed or moved verb across both READMEs, `scripts/` and `tests/` (`packages/mewkit/README.md:30`,
  `scripts/terminology-linter.cjs:29`), and the root `README.md` has none.
  **D4's unnamed `CommandSpec` field: accepted.** The contract declares every property a probe needs — the
  field lives on the command declaration, the catalogue is the single declared source, AC-02 reads
  requiredness from it, and an Out-of-Scope guard forbids a hand-carried list beside it. A chosen identifier
  would add no probe and no constraint the criteria do not already impose, and naming an internal symbol is
  the generator's implementation choice under D5's "one source" discipline.
  Two residuals recorded as accepted-with-note, neither a pass condition and neither worth a further round:
  D4's "eleven verbs from 1" counts `context`, which AC-09 removes, so only ten surviving verbs actually
  change that path — descriptive prose, while AC-02's Given states the 14/13 split exactly; and AC-13's
  enumerated validator list does not name the new exit-code-agnosticism check from AC-02, which AC-02 owns and
  AC-13's "the full suite and every validator are run" covers generically.
  Contract validator green after the amendment (13 ACs, `status=negotiating`, `preset=cli-tool`). Ready to
  `sign`; the reviewer has made no commit, per the review-only constraint on this round.

## Amendments (if any)

None.
