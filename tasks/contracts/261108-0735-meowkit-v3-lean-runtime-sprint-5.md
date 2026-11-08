---
contract_schema_version: 1.0.0
task: meowkit-v3-lean-runtime
sprint: 5
plan_ref: tasks/plans/261101-meowkit-v3-lean-runtime/plan.md
rubric_preset: cli-tool
status: signed
generator_signed: 8cac33b66674fd02c67c52b7e11a21d769b2eeec
evaluator_signed: cc1cd520a462656cf5cad3873e96d6bbd1bf1107
rounds: 2
created: 261108-0735
---

# Sprint 5 Contract — One committed project config; ownership-aware update / uninstall / backups

Testable translation of `phase-03-config-and-ownership.md` (Requirements 1–12, Architecture, Related Code Files,
Success Criteria, Security Considerations), bounded by `plan.md` Decisions 1–7 and Constraints. Every number, path
and line citation below is grounded in
`tasks/reviews/evidence/261108-meowkit-v3-lean-runtime-sprint-5/env-inventory.md`.

## Pinned baseline

- BASE = `085cb5bd2ee855431f68d0481958da9114ab92e5` — the phase 05 commit ("feat: give each Python skill its own
  lazily created environment"), the last commit before this sprint and the current `HEAD` of
  `feat/v3-lean-runtime`.
- Every "at BASE" claim and every `git diff BASE` in this contract resolves against that commit.
- At BASE the name universe is whatever the committed scan of AC-01 yields: **84 names** under the method and
  exclusions AC-01 pins (73 `MEOWKIT_`, 10 `MEOW_`, 1 `MK_`) — against the 65 `plan.md` records and the 72 this
  contract claimed in round 1, both of which were wrong. `.claude/settings.json` declares 9 `env` keys, 2 of them
  read by nothing; `.claude/hooks/handlers.json` carries **22** entries in `handlers[]` over 21 distinct camelCase
  `toggleKey`s (`budgetTracker` appears twice) and nothing reads any of them, while `.claude/settings.json`
  registers 13 hook commands; `tests/hooks/golden/` holds 82 fixtures;
  `.meowkit/config.json` is an install descriptor whose `features` block has no reader; no snapshot module and no
  `uninstall`/`backups` verb exists; ownership metadata covers `.claude/` only.

## Decisions (user standing directive 261108: follow recommended options)

Fourteen points where the phase-03 spec is ambiguous, or is contradicted by the tree. The user's standing
instruction for this plan is to take the recommended option on every one, so D1–D14 are DECIDED, not proposed.
Every AC is written against them. **D3, D9, D10, D11, D12, D13 and D14 are flagged as genuinely risky** — each
either risks data loss, breaks an existing user setup, or narrows a phase requirement — and each is marked
`[CHALLENGE]` so the evaluator knows where to push.

- **D1 One grammar, two readers, one fixture corpus.** `.meowkit/config.yaml` is YAML as the phase specifies, but
  every hook at BASE requires only `node:` builtins and sibling `.cjs` (verified over all of `.claude/hooks`),
  while `packages/mewkit` already depends on `js-yaml@^4.1.0`. DECIDED: the config grammar is a deliberately
  small YAML subset — 2-level nesting, scalars `boolean|integer|string`, no anchors, no multi-line scalars, no
  arrays-of-maps, no tabs. The CLI parses it with `js-yaml`; hooks parse it with a vendored dependency-free
  reader. Anything outside the subset is a *validation error with a line number*, never a silent partial parse,
  and AC-05 proves the two readers agree on a shared corpus. A hook that reached for an npm YAML parser would be
  the first dependency on a runtime path and is forbidden.
- **D2 No safety entrypoint reads the project config — structurally, not by validation.** The phase's own Key
  Insight 3 ("a committed file is changeable by anyone with a PR") is strongest if the committed file is
  *unreachable* from `gate-enforcement.cjs`, `privacy-block.cjs` and `pre-ship.cjs`. DECIDED: those three and
  their require graphs read no `.meowkit/config.yaml` and no `~/.meowkit/config.yaml` through the general
  loader. `tests/hooks/env-allowlist.test.ts` already proves the *env* set is closed per entrypoint
  (`:17-37`) and that no safety path reads a dotenv file (`:62-69`); this sprint extends the same file with a
  config-path clause rather than inventing a second mechanism. Req 2's "the loader rejects `hooks.<protected>`"
  still holds for the loader — it is defence in depth for the observer path, not the thing keeping the gate shut.
- **D3 `[CHALLENGE]` `autobuild.mode` in the project config sets DENSITY ONLY and cannot bypass the contract
  gate.** At BASE `lib/check-contract-signed.cjs:19` is `BYPASS_MODES = ['LEAN', 'MINIMAL']` and `:130` reads
  `env.MEOWKIT_AUTOBUILD_MODE`; a match skips the sprint-contract gate and logs it. A committed key with that
  power is exactly what Key Insight 3 forbids. DECIDED: `autobuild.mode` is a legal project-config key read by
  observers (`build-verify`, `model-detector`, `pre-completion-check`) and by the density selector; the
  contract-gate bypass continues to read **only** the env var (and the user-scope file of D4). The cost, stated
  plainly: a project config saying `mode: LEAN` will still face a contract gate, and `mewkit doctor` must say so
  out loud (AC-11) rather than letting the user discover it as a block.
- **D4 The Gate 1 presence-only hatch reaches `gate-enforcement.cjs` through a single-key reader, not the
  loader.** Req 4 wants the hatch available from `~/.meowkit/config.yaml`, which conflicts with D2 if the general
  loader is used. DECIDED: `gate-enforcement.cjs` consults exactly one additional path, `~/.meowkit/config.yaml`,
  through a dedicated reader that can return exactly one boolean (`gate1PresenceOnly`) and cannot surface any
  other key; the project config remains unreachable. Env `MEOWKIT_GATE1_PRESENCE_ONLY=1` keeps working unchanged.
  Every use of either form appends one line to `.meowkit/telemetry/security-log` (intervention-recording Rule 1).
  The closed env set in `tests/hooks/env-allowlist.test.ts` widens by zero names.
  Two edge cases close the hole the reviewer found: (a) **scope collapse** — when the resolved project root is
  `$HOME` (a dotfiles-style repo, or a container where `HOME` is the workspace; `state/meowkit-root-resolver.ts`
  keys off `.git`, so a `~` holding a `.git` resolves as root), `<root>/.meowkit/config.yaml` and
  `~/.meowkit/config.yaml` are the same file and the "user scope is outside the repo" premise is false. DECIDED:
  when the two resolve to the same file — compared by realpath/inode, never by string — the hatch is **refused**,
  Gate 1 stays strict, and the refusal is warned on stderr and logged; the env var remains the only way to
  downgrade in that layout, since an env var is not PR-editable. (b) **unloggable downgrade** — DECIDED: the hatch
  **fails closed**. If the `.meowkit/telemetry/security-log` append fails for any reason (missing, read-only, or
  unwritable `.meowkit/`, as AC-12's clone-without-init can present), the downgrade does not happen and Gate 1
  blocks as normal. An unrecorded gate downgrade would violate intervention-recording Rule 1, so "cannot log"
  must mean "cannot downgrade" rather than "downgrade quietly".
- **D5 Config keys are kebab-case and identical to the handler file's base name; `handlers.json` is rewritten to
  match.** At BASE the 21 `toggleKey`s are camelCase (`learningObserver`) while the phase success criterion says
  `hooks.learning-observer: false`. DECIDED: the `toggleKey` values become the kebab-case names, so the registry
  entry *is* the config key — no translation table, nothing to drift. `budgetTracker`'s two registrations become
  one `budget-tracker` key switching off both.
- **D6 The protected (never-disableable) set is seven names, and includes the investigate guard.** Req 2 lists
  `gate-enforcement`, `privacy-block`, `pre-ship`, `gate2-check` and "the careful/freeze guards". The tree also
  has `.claude/skills/investigate/bin/check-report-path.cjs`, which exits 2 on a wrong report path — the same
  hard-block semantics as careful and freeze, and a golden group of its own (`guard-investigate`, 3 fixtures).
  DECIDED: the rejected key set is `gate-enforcement`, `privacy-block`, `pre-ship`, `gate2-check`,
  `check-careful`, `check-freeze`, `check-report-path`. `gate2-check` is on the list although it is a *library*
  under `.claude/hooks/lib/` reached from `pre-ship.cjs`, not a registration, because a user will reasonably try
  the name.
- **D7 Three on/off env names collapse into `hooks.<name>`; one value key survives.**
  `MEOWKIT_BUILD_VERIFY` (`handlers/build-verify.cjs:66`), `MEOWKIT_LOOP_DETECT` (`loop-detection.cjs:17`) and
  `MEOWKIT_PRECOMPLETION` (`pre-completion-check.cjs:93`) are each nothing but a switch for one handler that
  already has a `toggleKey`. DECIDED: they are not separate config keys — they become
  `hooks.build-verify|loop-detection|pre-completion-check: false`. Only `MEOWKIT_BUILD_VERIFY_TIMEOUT`
  (`build-verify.cjs:80`) carries a value, and becomes `buildVerify.timeoutMs`.
- **D8 The env allowlist has six classes, not one.** Req 6 names credentials plus `CLAUDE_*` plus the hatch. The
  tree needs more, because a committed file cannot hold a per-invocation value and Python skills must not need a
  YAML parser. DECIDED classes: (a) **credentials** — the credential names of inventory §2b, including the four
  `MEOWKIT_GEMINI_API_KEY[_2-4]` forms; (b) **host** — `CLAUDE_*`; (c) **safety-path** — exactly the names already
  written out in `tests/hooks/env-allowlist.test.ts` (`MEOWKIT_GATE1_PRESENCE_ONLY`, `MEOWKIT_AUTOBUILD_MODE`,
  `MEOWKIT_HOOK_PROFILE`, `MEOW_HOOK_PROFILE`, `MEOWKIT_CLI`); (d) **runtime handoff** — `MEOWKIT_RUN_ID`,
  `MEOWKIT_HARNESS_VERSION`, `MEOWKIT_MODEL_HINT`, `MEOWKIT_HOOK_DEBUG`, `MEOWKIT_COMMAND`;
  (e) **skill-scoped runtime options** — the six `MEOWKIT_WEB_FETCH_*`, `MEOWKIT_CONTEXT_WINDOW`,
  `MEOWKIT_AUDIT_OUT_DIR`, `MEOWKIT_COST_LOG`, `MK_SHOWCASE_PREFS_PATH`, `MEOW_CONFLUENCE_STDOUT_FILTER`, the
  multimodal provider/model names of D9's composition finding, plus the test-only names in inventory §2f;
  (f) **supported behavior override** — a toggle that also has a config key but stays readable from env at the
  top of the precedence chain, because losing it silently would turn an enforcement mode off. At BASE this class
  holds exactly one name: `MEOWKIT_TDD` (D9).
  `MEOWKIT_HOOK_PROFILE`/`MEOW_HOOK_PROFILE` get **no** config key: `pre-ship.cjs` reads them and D2 forbids a
  config read there, so one source is correct and two would diverge silently. `MEOW_PROFILE` is dropped (its own
  deprecation notice at `lib/tdd-detect.cjs:26` announced removal in the next major; this is it).
- **D9 `MEOWKIT_TDD` KEEPS WORKING — this reverses round 1's D9 — and the reader-less names are deleted loudly.**
  Round 1 dropped the env read on the strength of `plan.md` Decision 5 ("no env-var compat layer"). The reviewer
  showed that is unsafe rather than merely breaking: `lib/tdd-detect.cjs:36-39` makes `MEOWKIT_TDD` the
  **highest-precedence** tier and one of only two sources that can turn TDD *on*, so an unread `MEOWKIT_TDD=1`
  falls through to `default OFF` and `pre-implement.cjs`'s failing-test-first enforcement stops without a word.
  An enforcement mode must never disable itself silently. DECIDED: `MEOWKIT_TDD` stays a **supported** env
  override in allowlist class (f), at the same highest precedence it has today, so the documented `MEOWKIT_TDD=1`
  and every CI job using it keep working; `tdd` is additionally a config key, below it (AC-04). Decision 5's "no
  compat layer" still holds for everything else — this is one deliberately supported override, not a fallback
  shim, and it is named in the allowlist data rather than special-cased in code.
  Separately, every name the AC-01 scan classifies reader-less is deleted from every doc, agent, skill and
  settings file — including `MEOWKIT_TDD_FLAG_DETECTOR` and `MEOWKIT_MEMORY_BUDGET`, which are *declared in
  `.claude/settings.json`* and read by nothing — and the deletion is **loud**: a still-exported removed name
  produces a `doctor` finding, asserted by AC-04. Two corrections to round 1's drop list, both from re-deriving
  the reader column: `MEOWKIT_MAX_PROJECT_CONTEXT_BYTES` is a **live** read at
  `handlers/project-context-loader.cjs:37` and becomes the config key `projectContext.maxBytes`; and the
  multimodal names are read through **prefix composition** (`skills/multimodal/scripts/env_utils.py:14` is
  `os.getenv(f'MEOWKIT_{name}') or os.getenv(name)`, with `provider_router.py:28-36` supplying the suffixes), so
  roughly sixteen names a literal-name grep reports as reader-less are in fact read — they are allowlisted under
  class (e), not dropped. **`pm.auto` is removed from the config schema**: it has no code reader, and shipping a
  new declared-and-unread key in the sprint whose purpose is deleting them is incoherent. It stays documented as
  prose-only, outside the schema, and AC-02 asserts it is absent from the schema.
- **D10 `[CHALLENGE]` The committed config is never written by an agent; `workflow-config set` writes session
  state.** At BASE `.claude/scripts/bin/workflow-config` mutates the config file at runtime, and its 11 skill
  preambles do so 34 times (`set telemetry …` 32×, `set skip_eng_review true` 2×). A committed, schema-validated,
  human-owned file that an agent rewrites mid-run shows up in the user's diff and invites exactly the PR-edited
  gate weakening Key Insight 3 warns about. DECIDED: `telemetry` and `proactive` become committed config keys
  under `workflow.*`; `skip_eng_review` does **not** become a config key (it suppresses a review step) and moves
  to session state; `workflow-config get|has` resolves session state → project config → user config → default,
  and `workflow-config set` writes **only** `.meowkit/state/workflow-state.json`. Risk being accepted: a user who
  today runs `workflow-config set telemetry off` to persist a preference gets a per-project state write instead
  of a committed one, and must edit `config.yaml` to make it durable — which is the point, and must be said in
  the error path (AC-15).
- **D11 `[CHALLENGE]` `.meowkit/.gitignore` is deny-all + allowlist exactly as Req 8 writes it — nothing added;
  the root-`.gitignore` append keeps only its non-`.meowkit` lines.** At BASE the shape is the opposite —
  `.meowkit/gitignore.meowkit` is an append template of per-class ignores whose own comment argues for per-class
  over whole-dir. DECIDED: adopt Req 8's shape, `.meowkit/.gitignore` is authoritative for everything under
  `.meowkit/`, the per-class `.meowkit/*` lines are removed from the root template (keeping `.env`, `.env.local`,
  `session-state/`, `tasks/reports/`, `.claude/logs/`), and `commands/setup-steps.ts` `stripStaleMemoryIgnore`
  gains a sibling that strips the superseded `.meowkit/*` lines from an existing project's root `.gitignore`.
  **Round 1's `!release-manifest.json` line is withdrawn.** `plan.md` **Decision 3, user-confirmed 261101**, is
  "`.meowkit/` gitignored except `config.yaml`, `memory/*.md`, `bin/mewkit`, `*.example`" — adding a tracked
  manifest departs from a decision the user confirmed, not merely from Req 8's literal nine lines as round 1
  claimed, and `ReleaseManifestSchema` (`core/release-metadata.ts:20-25`) carries no signature or digest field, so
  a committed copy would be an unauthenticated, PR-editable ownership baseline — exactly the data-loss shape D12
  exists to prevent. The ownership baseline therefore stays **local and untracked**, and D12 supplies the
  authenticity that commitment cannot. Risk still being accepted: a deny-all file stops tracking any `.meowkit/`
  file a user had committed that is not on the allowlist — `pack-manifest.json` and `harness-inventory.json`
  among them. Already-tracked files keep being tracked, so this bites only on a fresh clone, and AC-08 pins the
  exact tracked set so the regression is visible rather than discovered later.
- **D12 `[CHALLENGE]` Uninstall spans two roots; `.meowkit/` user data is report-never-delete; deletion requires
  kit-content agreement, not just baseline agreement.** Ownership metadata at BASE is `.claude/`-relative only
  (`core/compute-checksums.ts:52`), so `uninstall` has no baseline for `.meowkit/`. DECIDED: metadata is extended
  to the kit-shipped `.meowkit/` subset (`gitignore.meowkit`, `mcp.json.example`, `.env.example`,
  `pack-manifest.json`, and `bin/mewkit` once phase 06 ships it), and the classes `memory/`, `telemetry/`,
  `state/`, `cache/`, `envs/`, `backups/`, `.env` are **never deleted by any flag, `--force` included** — they
  are reported and left.
  The baseline-authenticity problem is solved by making the baseline insufficient on its own. At BASE the
  deletion gate is "`owner === "meowkit"` AND `hashFile(dest) === entry.checksum`"
  (`core/smart-update.ts:339-345`) — both facts come from the metadata file, so a baseline that lies about a user
  file satisfies both. DECIDED: **a file is deletable only when the metadata says it is kit-owned AND its on-disk
  content is byte-identical to the trusted kit source's content for that path.** A user-authored file matches no
  kit content, so no tampered or adopted baseline can make it `clean`; a baseline can then only ever narrow what
  is deleted, never widen it past real kit content.
  **USER DECISION (2026-11-08): the trusted source is a local kit cache.** Round 2 pinned it to "the kit content
  carried by the running `mewkit` installation", and the evaluator showed that source does not exist:
  `packages/mewkit/package.json` publishes `files: ["dist", "portable-manifest.json", "NOTICE"]` — no kit content
  — and the kit is fetched only over the network into a timestamped tmpdir
  (`core/github-releases.ts:87-88`) that `commands/upgrade.ts:334` deletes via `cleanupDownload`
  (`github-releases.ts:127-133`). That is not an oversight but `plan.md` **Decision 4, user-confirmed 261101**
  ("Kit artifact on GitHub release only; npm `mewkit` ships the CLI only"). Asked directly, the user chose
  **option (a), local kit cache**: `init` and `upgrade` keep a copy of the kit they installed under
  `.meowkit/cache/`, never committed, and that copy is what `uninstall` and `doctor --adopt` check against.
  The user-visible consequence, accepted with the decision: the trust clause **narrows** from "no in-project file
  is trusted" to "no **tracked** in-project file is trusted". The property being relied on is that D11's deny-all
  `.meowkit/.gitignore` keeps `cache/` untracked, so a pull request cannot introduce or alter it — which is the
  actual threat model — rather than that the source lives outside the project.
  Rules on the cache itself, all asserted rather than assumed: it is **never tracked** (AC-08) and
  **never deleted by `uninstall`**, with or without `--force`, because `cache/` is already in the
  never-delete class above; a `.meowkit/cache/` path that `git ls-files` reports as tracked is **not trusted**,
  and `uninstall` re-checks that per run instead of trusting the ignore file to still be present; and when the
  cache is **missing, incomplete, or records a version other than the one `.meowkit/metadata.json` reports**,
  `uninstall` **refuses for every affected path** — reporting, never deleting — and `mewkit doctor` emits a
  finding naming `mewkit upgrade` (which re-fetches and rewrites the cache) as the next action. Refusal is
  per-path and never a silent fallback to baseline-only deletion.
  `doctor --adopt` uses the same source and nothing else: it rebuilds `.meowkit/metadata.json` by comparing
  on-disk files against `.meowkit/cache/`, and where the cache is absent or version-mismatched it **refuses**
  with a named reason. It must never adopt by treating present content as clean — a teammate's edited file would
  be recorded `owner: meowkit`. A fresh clone has no cache, because the cache is untracked, so both `uninstall`
  and `--adopt` refuse there, which is the safe outcome; `uninstall` names `--adopt` and `--adopt` names
  `mewkit upgrade`. No network is involved in any of this: the fetch happens at `init`/`upgrade` only, and
  deletion needs none.
- **D13 `[CHALLENGE]` Req 12 is split: `--json` and `--dry-run` for all seven mutating commands; the non-TTY
  exit-3 rule only for the destructive ones.** Req 12 says every mutating command exits 3 in a non-TTY session
  without `--yes`. Applied literally that breaks CI and scripted use of `mewkit init` and `mewkit setup`, neither
  of which destroys anything (`init` already refuses to overwrite without `--force`). DECIDED: the mutating set
  is the closed list `init`, `upgrade`, `setup`, `uninstall`, `backups restore`, `pack add|remove`, `migrate`,
  and every one of them gains `--json` and `--dry-run` (at BASE `--dry-run` exists for `init`, `plan` and
  `migrate` only, no mutating command has `--json`, and `upgrade` calls `smartUpdate` with `dryRun`/`force`
  hardcoded false at `commands/upgrade.ts:290`). The non-TTY-without-`--yes` → preview + exit 3 rule applies to
  the destructive subset only: `uninstall`, `backups restore`, `upgrade --force`, `init --force`. Narrowing a
  signed phase requirement is the risk here; it is stated rather than silently done.
- **D14 `[CHALLENGE]` No `mewkit audit` alias, and the committed launcher stays in phase 06.** Req 7 of the
  phase asks for `mewkit audit` as an alias of `doctor`; phase 06 exists to *cut* CLI surface, and `plan.md`
  requires every shipped `mewkit <verb>` to resolve. DECIDED: no alias — two verbs with one behavior is the
  thing phase 06 removes. And Req 9's "hooks resolve the CLI through the committed launcher" depends on
  `.meowkit/bin/mewkit`, which phase 06 creates (there is no `.meowkit/bin` at BASE) while phase 06 depends on
  phase 03. DECIDED: this sprint ships only the half that does not need the launcher — the no-CLI graceful
  degradation and the `mewkit doctor` hint (AC-12) — plus the `!bin/` and `!bin/mewkit` allowlist lines, which
  `plan.md` Decision 3 already sanctions, for phase 06 to land into. Verbs added this sprint: exactly `uninstall`
  and `backups`.
- **D15 One sprint holds, at 15 ACs; every round-2 probe folds into an existing AC.** The reviewer offered a
  split at the AC-07|AC-08 seam and noted that 15 is the evaluator's per-session criterion ceiling, so an
  amendment that *adds* an AC forces verification across two sessions. DECIDED: stay at one sprint and exactly
  15 ACs. The reason is not breadth but coupling — the uninstall half cannot be verified without the config half
  it reads (`uninstall`/`backups` need `--json`/`--dry-run` and the config-derived paths), the gitignore reshape
  and the `config.json` retirement are the same edit to `commands/setup-steps.ts` and `core/smart-update.ts`, and
  AC-14/AC-15 would have to be restated in both halves, which duplicates the two criteria most likely to drift.
  Splitting would therefore buy a smaller session at the cost of a second contract whose ACs depend on unsigned
  work. Consequence accepted and stated: every round-2 addition is folded into an existing AC's `Then` or
  `Verification` — the tampered-baseline probe into AC-10 and AC-11, the two hatch cells into AC-06, the
  removed-name error into AC-04, the existing-install upgrade path into AC-02 — and no AC is added. If the
  evaluator's session cannot hold 15 criteria at this depth, the right response is to verify in two passes over
  one contract rather than to split the contract, because the second pass then still reads signed criteria.

## Definitions

- **Project config:** `<root>/.meowkit/config.yaml` — committed, human-owned, schema-validated.
- **User config:** `~/.meowkit/config.yaml` — outside any repo, therefore outside an untrusted clone's reach,
  EXCEPT when the project root is `$HOME` itself, in which case it is the project config and D4/AC-06 refuse it.
- **Behavior toggle:** a value that changes what the kit does for a user preference reason. Distinguished from a
  credential, a per-invocation runtime handoff and a skill-scoped runtime option by the six classes of D8.
- **Safety entrypoint:** `.claude/hooks/gate-enforcement.cjs`, `.claude/hooks/privacy-block.cjs`,
  `.claude/hooks/pre-ship.cjs` — the three registered directly in `.claude/settings.json`, outside
  `dispatch.cjs`.
- **Guard:** a hard-blocking check registered from a SKILL.md `hooks:` block —
  `skills/careful/bin/check-careful.cjs`, `skills/freeze/bin/check-freeze.cjs`,
  `skills/investigate/bin/check-report-path.cjs`.
- **Observer:** one of the 21 distinct handlers in `.claude/hooks/handlers.json` (22 entries in `handlers[]`,
  `budgetTracker` registered twice), run through `dispatch.cjs`, fail-open by contract.
- **Protected key:** one of the seven names in D6. Rejected from every source with a validation error.
- **Mutating command / destructive command:** the two closed lists in D13.
- **Ownership class:** the `uninstall` verdict for one tracked file — `clean` (on disk, checksum equals
  `baseChecksum`, **and** the content agrees with the trusted kit source for that path, per D12), `modified`
  (on disk, checksum differs), `orphan` (on disk, not in metadata, inside a kit-owned scope), `missing` (in
  metadata, not on disk).
- **Trusted kit source:** the **local kit cache** at `.meowkit/cache/`, written by `init` and `upgrade` and never
  committed. It holds the kit content of the release version that install actually laid down — the `.claude/` tree
  and the kit-shipped `.meowkit/` subset, byte-for-byte as shipped — together with the version string it was taken
  from, recorded so a cache from a different release is detectable rather than silently compared. It is a
  **derived, rebuildable** artifact, which is why `.meowkit/cache/` is the right taxonomy class
  (`.claude/hooks/lib/meowkit-paths.cjs` already defines `cache/` as exactly that) and why it is re-fetchable by
  `mewkit upgrade`. The trust property is **untracked**, not out-of-project: D11's deny-all `.meowkit/.gitignore`
  ignores `cache/`, so a pull request against the project cannot introduce or alter it, which is the threat model.
  Therefore: a **tracked** in-project file is never a trusted kit source — not a committed
  `release-manifest.json`, not `metadata.json`, not a `.meowkit/cache/` path that `git ls-files` reports as
  tracked (which AC-08 asserts cannot happen and `uninstall` re-checks per run rather than trusting the
  `.gitignore` to still be there).
- **Snapshot:** a copy of every file a command is about to write or delete, taken before the first mutation,
  under `.meowkit/backups/<id>/` with a manifest of source path + pre-mutation checksum.
- **Clone-without-init:** a fresh `git clone` of a project whose `.claude/` and allowlisted `.meowkit/` files are
  committed, with no `mewkit` on `PATH`, no `node_modules`, no `.meowkit/cache/` (it is untracked, so a clone
  never has one) and no network. Note on where the network is actually needed: only `init` and `upgrade` fetch
  anything (`core/github-releases.ts:87-96`). Once the cache exists, `uninstall`, `backups` and `doctor --adopt`
  need **no** network at all — they read `.meowkit/cache/`. A clone-without-init has no cache, so those three
  refuse rather than reaching the network, which is the whole point of AC-12 remaining an offline journey.

## Scope (In)

- `packages/mewkit/src/config/{schema,load-config,precedence}.ts` — zod schema, loader, precedence; JSON Schema
  exported to `packages/mewkit/schemas/config-v1.json` and referenced by the config's own `$schema`
- A vendored, dependency-free YAML-subset reader for hooks, plus the shared fixture corpus proving it agrees with
  the `js-yaml` path (D1)
- `.claude/hooks/lib/meowkit-paths.cjs` gains the toggle/config read helper; `lib/handler-registry.cjs`
  `selectHandlers` (`:67`) filters on `hooks.<kebab-name>`; `handlers.json` `toggleKey` values become kebab-case
  (D5)
- The single-key `gate1PresenceOnly` reader for `gate-enforcement.cjs` (D4), and the `security-log` line for each
  use
- `.claude/settings.json`: the `env` block drops every behavior toggle and both dead keys, keeping only
  `CLAUDE_CODE_FORK_SUBAGENT`
- Every `.claude/**` reader and every prose instruction for a toggle moves to the config key: the handler reads
  in inventory §2a (incl. `handlers/project-context-loader.cjs:37` → `projectContext.maxBytes`), the 36
  `MEOWKIT_TDD` docs — which keep documenting the env override and gain the `tdd:` key beside it (D9) — the 10
  `MEOWKIT_PM_AUTO` docs, which are repointed at prose-only wording with no schema key,
  `skills/autobuild/scripts/{density-select,budget-tracker}.sh`,
  `skills/benchmark/scripts/run-canary.sh`, `skills/prompt-enhancer/scripts/scout-context.py`
- Deletion of every name the AC-01 scan classifies reader-less (D9) from docs, agents, skills, `settings.json`
  and the `init`/`setup` prompts that collect some of them — with a `doctor` finding for each, so a still-exported
  removed name is reported rather than ignored (AC-04). `MEOWKIT_TDD` is NOT on this list (D9 reversal), and the
  multimodal names read by prefix composition are allowlisted rather than deleted
- `commands/init.ts` writes `config.yaml` (every key a commented stub) and `.meowkit/.gitignore`;
  `commands/setup-steps.ts` root-`.gitignore` template loses its `.meowkit/*` lines and gains the strip migration
  (D11)
- `.meowkit/config.json` dropped from the KIT SOURCE TREE, and an installed project's copy MIGRATED by `upgrade`
  (values carried across, unmigratable values reported by name, snapshot first) rather than deleted — AC-02;
  `index.ts:53` (`status`), `core/validate-install.ts:57`, `commands/doctor.ts:57`,
  `commands/doctor-checks.ts:253`, `commands/validate.ts:263` and `core/smart-update.ts:240` repointed;
  `state/resolve-config-path.ts` becomes the `config.yaml` resolver (D10's state file is separate)
- `.claude/scripts/bin/workflow-config` repointed per D10, and its 11 preamble callers checked
- `core/snapshot.ts`, wired into `init`, `upgrade` and `uninstall` before their first mutation
- `commands/uninstall.ts` and `commands/backups.ts`, with a fixture project carrying one file of each ownership
  class
- Ownership metadata extended to the kit-shipped `.meowkit/` subset, and the deletion gate at
  `core/smart-update.ts:339-345` strengthened to require agreement with the trusted kit source (D12).
  `release-manifest.json` is NOT committed and NOT added to the gitignore allowlist (D11)
- The **local kit cache** at `.meowkit/cache/` (user decision 261108, D12): `init` and `upgrade` write the kit
  content of the release they installed plus the version string it came from, so the trusted source exists
  offline. Touch points: `core/github-releases.ts:87-96` (the fetch whose result is currently thrown away) and
  `commands/upgrade.ts:334` `cleanupDownload`, which must populate the cache **before** removing the tmpdir;
  `core/snapshot.ts` excludes `.meowkit/cache/` because it is re-derivable (AC-09); `commands/doctor.ts` reports a
  missing or version-mismatched cache and names `mewkit upgrade` as the re-fetch
- `commands/doctor.ts`: config validation report, drift report, `--adopt`, and the `autobuild.mode`-vs-gate
  disclosure of D3
- `--json` and `--dry-run` across the seven mutating commands; exit 3 for the four destructive ones in a non-TTY
  without `--yes` (D13); `cli/command-catalogue.ts` updated so help and the verb-resolution validator agree
- A committed CI check for non-allowlisted `MEOWKIT_`/`MEOW_`/`MK_` reads in the shipped kit
- `tests/hooks/env-allowlist.test.ts` extended with the config-path clause (D2)
- Regenerated codex and cursor projections; `mewkit validate --target codex|cursor`
- The recorded clone-without-init journey

## Scope (Out)

- Any `gates.*` or `paths.*` key, in any config, at any scope — rejected, never implemented
- A config key for `MEOWKIT_HOOK_PROFILE` / `MEOW_HOOK_PROFILE` (D8: `pre-ship.cjs` reads them and D2 forbids a
  config read there)
- A config key for `skip_eng_review` (D10), for `pm.auto` (D9 — prose-only, no schema key), or for any name in
  D8 classes (c), (d), (e) or (f)
- A committed `release-manifest.json`, a committed ownership baseline of any kind, or trust in any **tracked**
  in-project file — manifest, metadata, or a `.meowkit/cache/` path that `git ls-files` reports (D11, D12).
  The untracked `.meowkit/cache/` is the single exception the user decision of 261108 created, and the narrowing
  from "no in-project file" to "no tracked in-project file" is recorded there
- Committing, snapshotting, or deleting `.meowkit/cache/`; a network fetch on any path other than `init` and
  `upgrade`; and a baseline-only deletion fallback when the cache is absent or version-mismatched (D12 refuses
  per path instead)
- Splitting this sprint, or adding a 16th AC (D15)
- The committed launcher `.meowkit/bin/mewkit` and any hook-side CLI resolution through it — phase 06 (D14).
  This sprint writes only the `!bin/mewkit` allowlist line and the no-CLI degradation
- `mewkit audit` or any other alias (D14)
- A v2 compatibility layer beyond the two named exceptions: the `MEOWKIT_TDD` supported override (D9) and the
  one-shot `upgrade` migration of an installed `config.json` (AC-02). No other `MEOWKIT_*` behavior-toggle
  fallback, no ongoing `config.json` read, no separate migration command (`plan.md` Decision 5)
- Changing what Gate 1, Gate 2, privacy-block, pre-ship, the three guards, post-write or pre-completion-check
  **decide**; this sprint changes only where their non-safety settings come from
- Deleting or rewriting `.meowkit/memory/`, `telemetry/`, `state/`, `cache/`, `envs/`, `backups/` or `.env` from
  any command path (D12)
- Emitter provenance in the metadata file — phase 04
- Windows path parity beyond the path construction asserted in AC-08 and AC-09
- The six non-hook `.claude/scripts/*.py` left open by sprint 4 D6, and the repo-dev Python of sprint 4 D10

## Acceptance Criteria

### [AC-01] The env-name universe is closed, classified, and nothing is unaccounted for

**Given** a **committed scan script** that is the single definition of the name universe — it greps
`\b(MEOWKIT|MEOW|MK)_[A-Z0-9][A-Z0-9_]*` over the trees `.claude packages scripts tests docs .github .meowkit`,
excluding `node_modules`, `.git`, `.claude/worktrees/**` (a duplicate checkout), `packages/mewkit/src/migrate/modules/**`
(generated projections), `**/dist/**` and `packages/docs/.next/**` (build output), and discarding any match ending
in `_` as a prefix fragment rather than a name
**When** it is run at BASE and again on the finished tree, and both results are diffed against a committed
classification table
**Then** the universe is **the count the script yields, recorded in the evidence file — 84 at BASE** (73
`MEOWKIT_`, 10 `MEOW_`, 1 `MK_`), and the hard-coded 72 of round 1 is gone; the table has exactly one row per
name, every row carries a non-empty class drawn from the six D8 allowlist classes, the toggle→config-key class or
the drop class, and no name appears in two classes or none; the four scope rules are applied as stated and each
is testable from the script alone — a prefix fragment (`MEOWKIT_BUDGET_`, `MEOWKIT_SUMMARY_`, `MEOW_CONFLUENCE_`,
`MEOW_JIRA_`) is **not** a name; a key appearing only in an `.env.example` **is** a name and is classified
(`MEOWKIT_IMAGE_GEN_MODEL`, in `.claude/skills/multimodal/.env.example` and `.meowkit/.env.example`); prose in
`packages/docs/**` **is** in the universe, because that tree ships its own `MEOWKIT_*` documentation that can go
stale (`MEOWKIT_HARNESS_MODE` and `MEOWKIT_MEMORY_STALENESS_MONTHS` live only there), while `RELEASING.md` and
`tasks/**` are **out**, because a changelog is an immutable historical record and `tasks/**` is workflow
artefacts — which is why `MEOWKIT_THING`, `MEOWKIT_SECRET_BACKDOOR` and `MEOWKIT_WIKI_SLUG`, counted in round 1,
are not names here; the reader column is derived **composition-aware**, so a name read as
`os.getenv(f'MEOWKIT_{name}')` (`skills/multimodal/scripts/env_utils.py:14`, suffixes at
`provider_router.py:28-36`) is recorded as read rather than reader-less — a literal-name grep produces false
drops and must not be the method; the four names round 1 left in no class are classified —
`MEOWKIT_MAX_PROJECT_CONTEXT_BYTES` as a toggle with config key `projectContext.maxBytes` because it is a live
read at `handlers/project-context-loader.cjs:37`, `MEOWKIT_HARNESS_MODE` and `MEOWKIT_MEMORY_STALENESS_MONTHS` as
drops (docs prose only), `MEOWKIT_IMAGE_GEN_MODEL` under allowlist class (e); bare `MEOWKIT_SUMMARY` is recorded
as **not a name** (zero standalone occurrences — it is the prefix of `MEOWKIT_SUMMARY_MODE`); the exceptions the
table deliberately keeps are present with their reason (`MEOW_PROFILE` dropped although `lib/tdd-detect.cjs:49`
reads it, `MEOWKIT_HOOK_PROFILE` allowlisted rather than made a key, `MEOWKIT_TDD` both a key and an override per
D9, `pm.auto` documented prose-only with no schema key per D9); and **this table is the data AC-07's CI check
reads**, so the two cannot contradict each other — a name classified here and absent from the check's allowlist,
or vice versa, fails both

- **Verification:** run the committed script at BASE and on the finished tree; diff each name set against the
  table; assert row count equals name count, no empty class cell, no duplicate name; assert the allowlist AC-07's
  check loads is generated from this table rather than maintained separately; and for every name the table calls
  reader-less, confirm absence under the composition-aware method, not only the literal one
- **Rubric tie-in:** product-depth (weight 0.25)

### [AC-02] One committed config exists, with a schema, commented stubs, and no forbidden key surface

**Given** a fresh `mewkit init` project
**When** `.meowkit/config.yaml`, `packages/mewkit/schemas/config-v1.json` and the zod schema are read
**Then** the config carries a `$schema` pointing at the published JSON Schema and every schema key is present as
a **commented** stub (so an uncommented file is the user's own choices, not the kit's defaults), covering exactly
`tdd`, `autobuild.mode`, `budget.{cap,warn,block}`, `buildVerify.timeoutMs`, `projectContext.maxBytes`,
`workflow.{telemetry,proactive}` and `hooks.<name>` for each of the 21 kebab-case observer names of D5 — and
**`pm.auto` is absent**, asserted by name, because it has no code reader and this sprint deletes
declared-and-unread keys rather than adding one (D9); the schema declares **no** `gates.*` and **no** `paths.*`
property and `additionalProperties` is false at every level, so a future unknown key is a loud error rather than
a silent accept; the JSON Schema is generated from the zod schema rather than hand-maintained (a drift test
proves regenerating it is a no-op); `mewkit status` reports the new config without the deleted `features` block;
and `.meowkit/config.json` is gone **from the kit source tree** — no file in `packages/mewkit/src` or `.claude/`
ships or reads it — which is a distinct claim from what happens to an installed project's copy, covered next.

**Given** a scratch project in the v2.15 shape, with a **tracked and committed** `.meowkit/config.json` carrying
non-default `features` values (`commands/setup-steps.ts:58` deliberately never ignored it) and no `config.yaml`
**When** `mewkit upgrade` runs on it, and separately `mewkit doctor` runs on it before any upgrade
**Then** `upgrade` migrates it rather than discarding it: every value that has a `config.yaml` equivalent is
carried across and appears **uncommented** in the new file (it is now the user's explicit choice), every value
with no equivalent is **reported by name** as not carried and why — nothing is silently dropped — the original
file is captured in the AC-09 snapshot before anything is written, and only then is it removed from the project;
`doctor` run before the upgrade reports the project as migration-pending and names `mewkit upgrade` as the next
action rather than merely noting a missing config; `core/validate-install.ts:57`'s `check("config.json exists", …)`
becomes a `config.yaml` check that reports migration-pending instead of failing for a project that still has only
the old file; and in no path does `uninstall` delete that user-committed file — it is removed by the migration
that replaces it, or not at all

- **Verification:** `mewkit init` in a scratch dir, read the emitted config and assert every line is commented and
  that `pm.auto` does not appear in the file or in `config-v1.json`; run the zod→JSON-Schema regeneration and
  `git diff --exit-code`; grep `packages/mewkit/src` and `.claude/` for `config.json`; `mewkit status`; then build
  the v2.15-shaped fixture with known `features` values, run `doctor` (assert the migration-pending finding and
  its named next action), run `upgrade`, and diff the resulting `config.yaml` plus the report against the input
  value by value; confirm the snapshot holds the original; run `uninstall --yes --force` on a copy that still has
  the old file and assert it survives
- **Rubric tie-in:** product-depth (weight 0.25)

### [AC-03] The loader rejects secrets, absolute paths, protected hook keys, `gates.*`, `paths.*` and out-of-grammar YAML

**Given** a fixture config for each rejection class
**When** the loader runs over each one
**Then** every one is rejected with a non-zero result and a named error, specifically: a key or value matching
`keys|token|secret|password`; any absolute path value (POSIX `/…` and Windows `C:\…`); `hooks.<x>` for each of the
seven protected names of D6, including `gate2-check` which is a library and not a registration; any `gates.*` key;
any `paths.*` key — `paths.plans: src` by name, from the phase success criteria; and any construct outside the D1
grammar (a tab, a 3-level nest, an anchor, an array of maps). No rejection is a warning and none is a partial
load: a rejected config yields zero applied keys, never the keys that happened to parse before the bad one

- **Verification:** run the loader over the fixture set from both the CLI and the hook reader and assert
  exit/result plus the error identifier for each; assert the applied-key count is 0 for every rejected fixture
- **Rubric tie-in:** functionality (weight 0.40)

### [AC-04] Precedence is exactly env override > CLI flag > project > user > default, a malformed config degrades safely, and a removed name is loud

**Given** a matrix in which `tdd`, `autobuild.mode` and one `hooks.<name>` are each set at zero, one, two, three
and four of the levels (supported env override / `--tdd` session sentinel / project / user), plus a project config
that is malformed, plus a shell that still exports `MEOWKIT_TDD=1` and one that still exports a removed name
**When** each cell is resolved, the malformed case is exercised through a full hook session, and `mewkit doctor`
runs in each of the two stale-env shells
**Then** the resolved value is the highest present level in every cell and the resolver reports which level
answered; `tdd` resolves **`MEOWKIT_TDD` env > `--tdd` session sentinel > project > user > default OFF**, which
preserves the BASE order of `lib/tdd-detect.cjs:36-55` with `MEOWKIT_TDD` still at the top (D9 reversal) and only
the `MEOW_PROFILE` tier removed — so `MEOWKIT_TDD=1` alone still turns strict mode on and
`pre-implement.cjs` still enforces failing-test-first, with an explicit cell proving a project config of
`tdd: false` does **not** override an exported `MEOWKIT_TDD=1`; with the malformed config in place every observer
uses its own default and still runs, every safety entrypoint and all three guards still block — the 82 golden
fixtures pass unchanged, including all 13 `gate1`, 12 `gate2-preship`, 5 `privacy`, 2 `guard-careful`, 3
`guard-freeze` and 3 `guard-investigate` cases — and `mewkit doctor` reports the parse error with its file and
line; and a **removed** behavior toggle that is still exported is detected and reported rather than ignored:
`mewkit doctor` emits one finding per still-exported removed name — tested on at least one real removed name,
`MEOWKIT_LOOP_DETECT` (now `hooks.loop-detection`), and one of the reader-less drops — each naming the removed
name, the config key that replaced it or the fact that it has no replacement, and the file to edit, at a non-zero
`doctor` exit for the finding class, which is the "error with a pointer, not a fallback" the Out-of-Scope
Clarifications promise

- **Verification:** run the precedence matrix asserting value + answering level per cell, including the
  `MEOWKIT_TDD=1` vs `tdd: false` cell and a `pre-implement.cjs` invocation proving enforcement is on; place the
  malformed config and run `npx vitest run tests/hooks/golden` plus `mewkit doctor`; export
  `MEOWKIT_LOOP_DETECT=off` and one dropped name and assert the `doctor` findings, their text and the exit code
- **Rubric tie-in:** functionality (weight 0.40)

### [AC-05] The hook reader and the CLI reader cannot disagree

**Given** a committed corpus of at least 12 config fixtures covering every scalar type, both nesting levels, an
empty file, a comments-only file, a file with a BOM, CRLF line endings, a duplicate key, and one fixture per D1
out-of-grammar construct
**When** each fixture is parsed by the vendored hook reader and by the `js-yaml`-backed CLI loader
**Then** the two produce the same verdict and, when accepted, the same key/value map for every fixture — compared
structurally, not by string — and the hook reader's require graph contains no `node_modules` path, so the kit
still has zero npm dependencies on a hook path

- **Verification:** a test that feeds the corpus to both readers and deep-equals the results; walk the hook
  reader's require graph and assert every resolved path is a `node:` builtin or a file under `.claude/`
- **Rubric tie-in:** functionality (weight 0.40)

### [AC-06] No committed file can weaken a gate, and the one escape hatch is user-scoped and logged

**Given** the three safety entrypoints, the three guards, and a project `config.yaml` that tries every weakening
it can express — `hooks.gate-enforcement: false`, `hooks.privacy-block: false`, `hooks.pre-ship: false`,
`hooks.check-freeze: false`, `gates.presenceOnly: true`, `paths.plans: src`, `autobuild.mode: LEAN`
**When** that config is in place and the gate, privacy, pre-ship and guard golden fixtures are replayed; and
separately the hatch is set from the user config, from the env var, from a layout where the project root **is**
`$HOME`, and in a project whose `.meowkit/telemetry/security-log` cannot be appended to
**Then** every block still fires with its BASE exit code and marker (`@@GATE_BLOCK@@`, `@@PRIVACY_BLOCK@@`); the
loader has already rejected the config, and independently of that rejection no file in the require graph of the
three safety entrypoints reads `<root>/.meowkit/config.yaml` at all — `tests/hooks/env-allowlist.test.ts` is
extended to assert that, beside its existing closed env set (which gains zero names) and its existing "reads no
dotenv file" clause; `autobuild.mode: LEAN` in the project config does **not** bypass the contract gate while the
env var still does (D3); the user-config hatch is honored only from `~/.meowkit/config.yaml`, only for
`gate1PresenceOnly`, and the reader it uses cannot return any other key; each use of either hatch form appends
exactly one line naming the source to `.meowkit/telemetry/security-log`; **scope collapse is refused** — in a
layout where the resolved project root and `$HOME` are the same directory, so that `<root>/.meowkit/config.yaml`
and `~/.meowkit/config.yaml` are the same file (compared by realpath/inode, never by string, with a symlinked
`~/.meowkit` as a second fixture), `gate1PresenceOnly: true` from that file is **ignored**, Gate 1 stays strict
and blocks, a warning naming the collapse is written to stderr, and the refusal is itself logged — while
`MEOWKIT_GATE1_PRESENCE_ONLY=1` still works in that layout, because an env var is not PR-editable; and the hatch
**fails closed** — when the security-log append fails (missing, read-only or unwritable `.meowkit/`, the state
AC-12's clone-without-init can present) the downgrade does not happen, Gate 1 blocks, and the failure to log is
reported, so there is no code path on which a gate downgrade happens unrecorded

- **Verification:** replay the gate/privacy/pre-ship/guard golden groups with the hostile config present; run the
  extended env-allowlist test; set the hatch from each source and read the security log; assert the project-config
  LEAN case still blocks on the contract while the env case logs a bypass; build a root-equals-`$HOME` fixture
  and a symlinked-`~/.meowkit` fixture and assert refusal + strict Gate 1 + the stderr warning for each; make the
  telemetry path unwritable (chmod and missing-parent variants) and assert the hatch does not apply
- **Rubric tie-in:** functionality (weight 0.40)

### [AC-07] Every observer toggle actually switches its observer off, and no non-allowlisted env read survives

**Given** a scratch project and the 21 kebab-case observer names of D5
**When** `hooks.<name>: false` is set for each name in turn and the handler's own event is fired, and then the CI
env-read check runs over the shipped kit
**Then** for each of the 21 names the handler does not run (asserted on its own observable effect — its output,
its state file, or its absence from the dispatcher's selection — not merely on the config value); `budget-tracker`
is switched off for **both** its `Edit|Write` and `Bash` registrations by the single key; `hooks.learning-observer:
false` disables that observer, as the phase success criteria require, and `hooks.gate-enforcement: false` instead
produces a loader error while Gate 1 still blocks (AC-06); every `toggleKey` in `handlers.json` is kebab-case and
equals its handler's file base name, and `lib/handler-registry.cjs` `validate()` rejects an entry whose
`toggleKey` is camelCase or does not match its handler file, and `handlers.json` still has its BASE **22** entries
over 21 distinct keys unless a registration is deliberately added or removed, in which case the change is named;
and the committed CI check finds **0** `MEOWKIT_`/`MEOW_`/`MK_` reads in `.claude/**` and
`packages/mewkit/src/**` outside the allowlist, where the allowlist is **the AC-01 classification table itself**,
loaded as data rather than restated as a regex inside the check — so a name cannot be allowlisted here while
being absent or differently classified there, and the check's reader detection is the same composition-aware
method AC-01 pins (otherwise `env_utils.py`'s `os.getenv(f'MEOWKIT_{name}')` reads are invisible to it)

- **Verification:** 21 per-key tests firing each handler's event; a `handlers.json` shape test asserting 22
  entries / 21 keys; run the committed CI check on the finished tree, on a planted literal violation, and on a
  planted **composed** violation (a new `os.getenv(f'MEOWKIT_{…}')` suffix not in the table) — it must fail on
  both plants; assert the check and AC-01's table resolve to the same file
- **Rubric tie-in:** functionality (weight 0.40)

### [AC-08] `init` emits the config and a deny-all `.meowkit/.gitignore`, and the tracked set is exactly the allowlist

**Given** a fresh `git init` directory
**When** `mewkit init` runs and `git status --porcelain --ignored` is read, and separately an existing project
whose root `.gitignore` carries the BASE per-class `.meowkit/*` lines is re-run through setup
**Then** `.meowkit/.gitignore` contains exactly the nine lines Req 8 writes — `*`, `!.gitignore`, `!config.yaml`,
`!.env.example`, `!mcp.json.example`, `!bin/`, `!bin/mewkit`, `!memory/`, `!memory/*.md` — and nothing else, with
`!release-manifest.json` **absent**, asserted by name, because round 1's extra line departed from `plan.md`
Decision 3 (user-confirmed 261101) and would commit an unauthenticated ownership baseline (D11); the files
git would track under `.meowkit/` are exactly `.gitignore`, `config.yaml`, `.env.example`, `mcp.json.example`
and any `memory/*.md` — `release-manifest.json`, `pack-manifest.json`, `harness-inventory.json`, `metadata.json`,
`envs/`, `state/`, `telemetry/`, `backups/` and `.env` are all ignored, and so is **`cache/`**, which after the
user decision of D12 holds the trusted kit source and whose untracked status is the entire basis of that trust —
so the assertion is made on a project where `init` has populated the cache, `git check-ignore -v` names the
`.meowkit/.gitignore` `*` rule for a path inside it, and `git ls-files .meowkit/cache` is **empty**;
`.claude/` is tracked and
`.claude/logs/` is not; the root `.gitignore` receives only the non-`.meowkit` entries (`.env`, `.env.local`,
`session-state/`, `tasks/reports/`, `.claude/logs/`); and on the existing project the superseded `.meowkit/*`
lines are stripped from the root `.gitignore` while any line a user negated with `!` is left untouched, in the
same shape as the existing `stripStaleMemoryIgnore` (`commands/setup-steps.ts:118-129`)

- **Verification:** `mewkit init` in a scratch git repo, then `git status --porcelain --ignored` and
  `git check-ignore -v` per path; a second scratch project seeded with the BASE root `.gitignore` plus a user
  `!` negation, run through setup, then diff
- **Rubric tie-in:** functionality (weight 0.40)

### [AC-09] Nothing mutates without a snapshot, and restore is checksum-equal

**Given** a fixture project with a known set of file checksums
**When** `init`, `upgrade` and `uninstall` each run against it, then `mewkit backups list` and
`mewkit backups restore <id>` run
**Then** each of the three commands creates exactly one `.meowkit/backups/<id>/` before its first write or
delete, containing every file it is about to touch and a manifest of path + pre-mutation checksum — and a
`--dry-run` of any of them creates **no** backup directory, because it writes nothing; `backups list` reports each
snapshot with its id, timestamp, originating command and file count, and supports `--json`; `restore <id>` returns
every file in that snapshot to byte-identical content (compared by checksum, not by size or mtime) and reports
what it restored; a restore whose target file has since been modified is itself snapshotted first, so restore is
undoable; a snapshot id that does not exist exits non-zero naming the id and listing the available ids; a
failure midway through a mutation leaves the snapshot complete and readable; and **no snapshot contains any
`.meowkit/cache/` content** — the trusted kit source of D12 is derived and rebuildable by `mewkit upgrade`, so
snapshotting it would multiply every backup by the size of a whole kit for no recovery value, and `restore`
therefore neither writes nor removes anything under `.meowkit/cache/`, leaving the cache byte-identical across a
snapshot/restore cycle

- **Verification:** run the three commands in a fixture project **with a populated cache**, checksum every file
  before and after a `restore`, assert equality; assert no snapshot manifest lists a `.meowkit/cache/` path and
  that the cache is byte-identical before and after the restore; run each with `--dry-run` and assert no
  `backups/` entry appears; interrupt one mutation and read the snapshot; `backups restore` with a bad id
- **Rubric tie-in:** functionality (weight 0.40)

### [AC-10] `uninstall` classifies correctly, is dry-run by default, and cannot destroy user data

**Given** a fixture project holding at least one file of each ownership class — `clean`, `modified`, `orphan`,
`missing` — plus populated `.meowkit/memory/`, `telemetry/`, `state/`, `envs/`, `.env`, a user-authored file
inside `.claude/skills/`, and a **populated `.meowkit/cache/`** written by `init` for the version
`.meowkit/metadata.json` records, which is the trusted kit source every deletion is checked against (D12)
**When** `mewkit uninstall` runs with no flags, then with `--yes`, then with `--yes --force`, then in a project
with no ownership baseline, then in a project whose `.meowkit/metadata.json` has been **hand-edited** to list a
user-authored file as `owner: meowkit` with a `checksum` and `baseChecksum` matching that file's real content,
and then in three cache-degraded projects — cache absent, cache present but recording a different version than
`metadata.json`, and a cache path forced into git tracking
**Then** the no-flag run **changes nothing on disk** and prints the four classes with a count and the file list
per class; the `--yes` run — whose fixture has the populated cache, which is what makes a non-empty `clean` class
possible at all — deletes exactly the `clean` files, **refuses** every `modified` file with a message naming it,
**reports** every `orphan` without deleting it, and **skips** every `missing` one; `--yes --force` additionally
overwrites/deletes the `modified` files and nothing more; in **no** invocation — `--force` included — is any file
under `.meowkit/memory/`, `telemetry/`, `state/`, `cache/`, `envs/`, `backups/` or `.meowkit/.env` deleted or
modified, so the trusted kit source survives the uninstall that consults it, and the user-authored file under
`.claude/skills/` is classified `orphan` and survives; the baseline-less project refuses with a message naming
`mewkit doctor --adopt` rather than guessing ownership;
**the tampered-baseline project does not lose the file** — because deletion requires both the metadata claim and
agreement with the trusted kit source for that path (D12), and a user-authored file matches no kit content, so it
is reported rather than deleted, with a message saying the baseline's claim was not corroborated; the same holds
for a baseline produced by `doctor --adopt`, which can never classify a user-authored file `clean`; each of the
three cache-degraded projects **deletes nothing** and instead refuses **per affected path** with a message naming
`mewkit upgrade` as the re-fetch — the absent cache, the version-mismatched cache (detected from the version the
cache records against the one `metadata.json` reports, not from content luck) and the git-tracked cache path,
which is distrusted because `git ls-files` reports it even though the ignore rule should have prevented it, and
`uninstall` makes that check per run rather than trusting `.meowkit/.gitignore` to still be in place; and every
run supports `--json` whose class lists match the human output exactly

- **Verification:** build the fixture, run the eight invocations, and after each diff a recursive checksum
  manifest against the expected set; assert the protected `.meowkit/` subtrees — `cache/` included — are
  byte-identical in all eight; hand-edit the metadata to claim a user file (matching checksums, so the BASE gate
  at `core/smart-update.ts:339-345` would pass) and assert the file survives `--yes --force` and is named in the
  output; for the three cache-degraded runs assert zero deletions, the per-path refusal text and the
  `mewkit upgrade` pointer, with the tracked-cache case produced by `git add -f` on a cache path; run all of them
  with the network unreachable, since deletion must need none; compare `--json` to the text output
- **Rubric tie-in:** functionality (weight 0.40)

### [AC-11] `doctor` reports config validity, drift, and adopts a baseline only when it is authentic

**Given** five projects: one valid, one with a malformed config, one with drifted files (a modified kit file and
an orphan), one that has a **populated `.meowkit/cache/`** for the recorded version but **no**
`.meowkit/metadata.json` (the teammate who ran `init`/`upgrade` and then lost or never had the baseline), and one
clone-without-init with neither a baseline nor a cache — which is every clone, since the cache is untracked
**When** `mewkit doctor` runs on each and `mewkit doctor --adopt` runs on the last two, with the network
unreachable throughout, because adoption must not need it
**Then** doctor reports, as distinct findings: the config's validation result with file and line on failure, the
per-class drift counts, the migration-pending state of AC-02's v2.15 fixture, and — when the project config sets
`autobuild.mode: LEAN` — an explicit statement that the density setting does not bypass the contract gate (D3),
so a user never discovers that as an unexplained block, and, whenever the cache is missing or records a version
other than `metadata.json`'s, a finding naming `mewkit upgrade` as the re-fetch (D12); the **successful** `--adopt`
on the fourth project rebuilds `.meowkit/metadata.json` **only** by comparing on-disk files against
`.meowkit/cache/` — the untracked local kit cache the user chose as the trusted source (D12) — and never against
a tracked in-project file, so no committed or PR-editable manifest can seed a baseline; after it,
`mewkit upgrade --dry-run` and `mewkit uninstall` classify that project's files identically to a normally
installed twin, and any file that does not match cached kit content is recorded `orphan` or `user`, never
`meowkit`; on the fifth project — no baseline and no cache — `--adopt` **refuses** with a named reason, writes no
metadata at all, and names `mewkit upgrade` as what would produce a cache; and a project seeded with a
**hand-edited** `release-manifest.json`, a hand-edited `metadata.json`, or a `.meowkit/cache/` path forced into
git tracking gains nothing from any of them — `--adopt` ignores each as an untrusted source and the subsequent
`uninstall` still refuses to delete the file it falsely claims

- **Verification:** run doctor on the five fixtures with the network unreachable and diff the finding sets,
  asserting the cache findings and their `mewkit upgrade` pointer; run `--adopt` on the fourth and compare
  `uninstall --json` class lists against a normally installed twin; on the fifth assert non-zero exit, no metadata
  written, and the `mewkit upgrade` pointer; plant a tampered `release-manifest.json`, a tampered
  `metadata.json`, and a `git add -f`-tracked cache path, and assert `--adopt` output and the follow-on
  `uninstall --yes --force` leave the claimed file in place in each case
- **Rubric tie-in:** product-depth (weight 0.25)

### [AC-12] Clone-without-init: gates still block, observers point at doctor, nothing crashes

**Given** a fresh `git clone` of a project whose `.claude/` and allowlisted `.meowkit/` files are committed, with
no `mewkit` on `PATH`, no `node_modules`, no `.meowkit/cache/` — a clone never has one, because D12's trusted kit
cache is untracked — and the network unreachable
**When** a full session's hooks run — SessionStart, a blocked Edit, a Read of a sensitive path, a ship-shaped Bash
command, Stop — and `mewkit doctor`'s hint is followed
**Then** Gate 1 blocks the edit with exit 2 and `@@GATE_BLOCK@@`, privacy-block blocks the read with
`@@PRIVACY_BLOCK@@`, pre-ship blocks the ship, and all three guards behave as their golden fixtures record — with
no CLI present and no config read (D2), so none of them is affected by the missing CLI; the observers run,
print a hint naming `mewkit doctor` exactly once per session rather than once per event, and no observer or
dispatcher emits a stack trace, a `MODULE_NOT_FOUND`, or a non-zero exit (the dispatcher is fail-open by
contract, `dispatch.cjs:111-115`); the pre-ship memory-store lint degrades to its existing
`SKIP: mewkit CLI not found` line (`lib/memory-store-lint.cjs:48`) rather than blocking or passing silently; and
the recorded transcript in the verdict evidence includes the environment capture proving `command -v mewkit`
and the network were both unavailable

- **Verification:** clone into a scratch dir with a stripped `PATH` and no network, drive the five events, and
  capture stdout/stderr/exit for each; grep the capture for `Traceback|MODULE_NOT_FOUND|ENOTFOUND`; count the
  doctor-hint occurrences
- **Rubric tie-in:** functionality (weight 0.40)

### [AC-13] Mutating commands preview and emit JSON; destructive ones refuse to run blind

**Given** the seven mutating commands of D13 and the four destructive ones
**When** each is run with `--dry-run`, with `--json`, and (destructive only) in a non-TTY session without `--yes`
**Then** every one of the seven accepts both flags, is declared for them in `cli/command-catalogue.ts`, and
appears with them in `mewkit --help`; `--dry-run` writes nothing at all — a recursive checksum manifest before and
after is identical, including no snapshot (AC-09) and no log append; `--json` emits parseable JSON on stdout whose
planned-change list matches the human preview item for item, with no human-formatted text mixed into stdout; each
of the four destructive commands in a non-TTY without `--yes` prints the preview and exits **3**, distinct from
both success (0) and failure (non-zero, non-3); `init` and `setup` without `--yes` in a non-TTY continue to
succeed, because narrowing the exit-3 rule to destructive commands is the decision taken in D13; and every
`mewkit <verb>` named anywhere in the shipped kit still resolves to an implemented subcommand, with `uninstall`
and `backups` the only verbs added and no alias (D14)

- **Verification:** run the flag matrix in scratch dirs under `script`/no-TTY; diff before/after checksum
  manifests for each `--dry-run`; `jq` each `--json`; assert exit 3 exactly; run the kit-verb resolution validator
- **Rubric tie-in:** functionality (weight 0.40)

### [AC-14] Code quality over the sprint diff

**Given** `git diff BASE` at the end of the sprint
**When** every new or changed `.cjs`, `.js`, `.mjs`, `.ts`, `.py`, `.sh` and `.json` file is measured
(`.github/workflows/*.yml`, generated projections under `packages/mewkit/src/migrate/modules/` and generated
schema output exempt from the line rule)
**Then** no new file exceeds 200 lines; no changed file crosses 200 lines because of this sprint, and any file
already over 200 at BASE that grew is listed by name with its BASE and final count in the evidence; no changed
TypeScript adds an `any` or an unsafe cast; no new TODO/FIXME, no commented-out code block (the commented key
stubs in `config.yaml` are data, not code, and are exempt by name), no unused import, no hardcoded secret, and no
new `child_process` call site targeting `bash`, `sh` or a `.sh` file; and `pnpm lint` and `pnpm typecheck` report
0 errors

- **Verification:** `git diff --stat BASE`; `wc -l` on new files; grep added lines; lint and typecheck output
- **Rubric tie-in:** code-quality (weight 0.15)

### [AC-15] Every rejection and every refusal tells the user what to change

**Given** each rejection from AC-03, each refusal from AC-10 and AC-11, the malformed-config report from AC-04,
and the `workflow-config set` path changed by D10
**When** each message is read
**Then** each one names the offending key or file, the scope it came from (project config, user config, env, CLI
flag), and a concrete next action — never only "invalid config"; a schema failure names the file and the line
number; a protected-key rejection says which hook cannot be disabled and why rather than only that the key is
unknown; `uninstall`'s refusal of a `modified` file names the file and the `--force` flag, and its baseline-less
refusal names `mewkit doctor --adopt`; `workflow-config set telemetry off` states that it wrote session state and
that `.meowkit/config.yaml` is where the preference becomes durable (D10), so the behavior change is visible at
the moment it matters; and no message in any of these paths prints a stack trace or a raw YAML parser exception

- **Verification:** trigger each path in a scratch project and assert the message contains key/file, scope and
  the named next action, and contains no `at Object.<anonymous>` or parser class name
- **Rubric tie-in:** ux-usability (weight 0.20)

## Out-of-Scope Clarifications

- Do not add a `gates.*` or `paths.*` key, at any scope, for any reason. A configurable `tasks/plans` path is a
  Gate 1 bypass, because `gate1-path-rules.cjs` exempts writes under it.
- Do not make a safety entrypoint or a guard read the project config, even "read-only, just for the profile". The
  property being bought is that an untrusted clone's committed file is unreachable from those paths.
- Do not let the project config bypass the contract gate or Gate 1 through any key, including `autobuild.mode`.
- Do not write a v2 compatibility shim beyond the two exceptions D9 and AC-02 name. No `MEOWKIT_*`
  behavior-toggle fallback other than the supported `MEOWKIT_TDD` override, no ongoing `.meowkit/config.json`
  read after the one-shot `upgrade` migration, and no silent default when a name was removed: a removed name is a
  `doctor` finding with a pointer, not a fallback and not silence (AC-04).
- Do not turn an enforcement mode off silently, ever. If a source that could enable strict mode stops being read,
  the user must be told in the same session — this is the reason D9 was reversed.
- Do not delete or rewrite `.meowkit/memory/`, `telemetry/`, `state/`, `cache/`, `envs/`, `backups/` or `.env`
  from any command path. `--force` widens what may be overwritten among *kit-owned* files only.
- Do not adopt an ownership baseline by assuming on-disk content is clean. Refuse instead.
- Do not trust a **tracked** in-project file for any deletion decision, and do not commit one. Deletion requires
  agreement with the trusted kit source — the untracked `.meowkit/cache/` of the 261108 user decision — and a
  baseline alone, adopted, inherited or hand-edited, is never sufficient (D12).
- Do not delete, snapshot or commit `.meowkit/cache/`, and do not fall back to baseline-only deletion when it is
  missing or records another version. Refuse per path and point at `mewkit upgrade`.
- Do not reach the network outside `init` and `upgrade`. `uninstall`, `backups` and `doctor --adopt` read the
  local cache and must work with the network unreachable.
- Do not honour the Gate 1 hatch from a file that is also the project config, and do not downgrade a gate when the
  downgrade cannot be logged. Both cases fail closed (D4, AC-06).
- Do not declare a config key that nothing reads. That is the defect this sprint exists to remove, which is why
  `pm.auto` is prose-only.
- Do not relax a golden fixture to make a config change pass. If BASE and the result cannot be made identical,
  stop and ask.
- Do not add a `mewkit` verb beyond `uninstall` and `backups`, and do not add an alias for an existing verb.
- Do not implement the committed launcher or hook-side CLI resolution through it — phase 06.
- Do not introduce an npm dependency on a hook path, including a YAML library.
- Do not edit the plan directory beyond phase-03 checkboxes, status and a decisions note.

## Rubric Bindings

- functionality: AC-03, AC-04, AC-05, AC-06, AC-07, AC-08, AC-09, AC-10, AC-12, AC-13
- product-depth: AC-01, AC-02, AC-11
- code-quality: AC-14
- ux-usability: AC-15

## Negotiation Log

- Round 1 (proposer/generator): initial draft from `phase-03-config-and-ownership.md` + `plan.md` Decisions 1–7
  and Constraints + the `cli-tool` preset, grounded in a fresh inventory
  (`tasks/reviews/evidence/261108-meowkit-v3-lean-runtime-sprint-5/env-inventory.md`). BASE is pinned to the real
  SHA `085cb5bd2ee855431f68d0481958da9114ab92e5`, not a placeholder. Fourteen Decisions are recorded rather than
  left open, per the user's standing directive to take the recommended option; seven are marked `[CHALLENGE]`
  because they risk data loss, break an existing setup, or narrow a phase requirement.
  The spec is contradicted by the tree in eight places, each of which drove a Decision: (a) `handlers.json`
  toggle keys are camelCase while the phase success criterion is kebab-case (D5); (b) `MEOWKIT_AUTOBUILD_MODE` is
  both a density preference and a contract-gate bypass at `lib/check-contract-signed.cjs:19,130`, so Req 1's
  `autobuild.mode` key cannot simply exist (D3); (c) Req 4's user-scope hatch requires `gate-enforcement.cjs` to
  read a config file, which the structural property of D2 forbids — resolved with a single-key reader (D4);
  (d) hooks have zero npm dependencies and cannot `require` a YAML parser, so there must be two readers and a
  corpus proving they agree (D1, AC-05); (e) `.meowkit/config.json` is an install descriptor with a dead
  `features` block, not a preference file, so "one project config" has to rule on it (D9/D2 of the Scope);
  (f) `workflow-config set` writes the config at runtime from 11 skill preambles, which a committed human-owned
  file cannot tolerate (D10); (g) ownership metadata is `.claude/`-relative only
  (`core/compute-checksums.ts:52`), so `uninstall` and `--adopt` have no baseline for `.meowkit/` (D12);
  (h) Req 9's clone-without-init depends on the phase-06 launcher while phase 06 depends on phase 03 (D14).
  Also found and folded in: the investigate guard blocks like careful/freeze but is missing from Req 2's
  protected list (D6); three of the four on/off env names are nothing but handler switches and collapse into
  `hooks.<name>` (D7); the name universe is 72 and not 65, of which 28 have no reader at all — two of them
  declared in `.claude/settings.json` (D9, AC-01); Req 12's non-TTY exit-3 rule applied literally breaks scripted
  `init`/`setup`, so it is narrowed to destructive commands and the narrowing is disclosed (D13); and Req 7's
  `mewkit audit` alias contradicts phase 06's surface cut (D14). `tests/hooks/env-allowlist.test.ts` is treated
  as the existing enforcement point to extend rather than a mechanism to reinvent, since it already proves the
  per-entrypoint env set is closed in both directions and that no safety path reads a dotenv file.

- Round 1 (reviewer/evaluator): clarifications requested — 7 items. Independently re-derived every count and
  citation. **Verified correct:** the 82 golden fixtures and all AC-04 group counts exactly (`gate1` 13,
  `gate2-preship` 12, `privacy` 5, `stdin-unreadable` 6, `guard-careful` 2, `guard-freeze` 3,
  `guard-investigate` 3, `index.json` `fixtureCount` 82); 21 distinct `toggleKey`s with `budgetTracker` twice;
  9 `.claude/settings.json` `env` keys incl. both dead ones; 13 settings hook commands; `check-contract-signed.cjs:19,130`;
  `gate-enforcement.cjs:126,135`; `build-verify.cjs:66,80`; `loop-detection.cjs:17`; `pre-completion-check.cjs:93`;
  `tdd-detect.cjs:26,36-55`; `upgrade.ts:290` (`dryRun`/`force` hardcoded false); `setup-steps.ts:123-129`
  (`stripStaleMemoryIgnore`); `compute-checksums.ts` `classifyLayer`; all six `resolveConfigPath` readers
  (`index.ts:53`, `validate-install.ts:57`, `doctor.ts:57`, `doctor-checks.ts:253`, `validate.ts:263`,
  `smart-update.ts:240-241`); `meowkit-root-resolver.ts` does **not** key off `config.json`, so the deletion blast
  radius on root resolution is nil; `cli-tool` preset weights match the Rubric Bindings exactly (0.40/0.25/0.20/0.15,
  all four bound). Phase-03's six Success Criteria are all covered (AC-07, AC-06, AC-03, AC-07, AC-09/AC-10, AC-12),
  and D6's seventh protected name plus D3's env-only bypass both *strengthen* the gate posture — accepted as such.
  The seven items below are what blocks signature.
  1. **D11+D12 / AC-11, AC-10, AC-08 — committing `release-manifest.json` creates an unauthenticated, PR-editable
     ownership baseline, which re-opens the data loss D12 exists to prevent.** `ReleaseManifestSchema`
     (`core/release-metadata.ts:20-25`) carries `version`, per-file `checksum` and a `deletions[]` list and **no
     signature or digest field**. D11 adds `!release-manifest.json` to a committed allowlist; D12 has
     `doctor --adopt` rebuild `.meowkit/metadata.json` from the installed copy. A PR that rewrites `files[]` then
     records a teammate's authored file as `owner: meowkit` with a matching checksum, so `uninstall --yes` deletes
     it as `clean` — and `smart-update.ts:339-345`'s deletions gate (`owner === "meowkit"` AND
     `hashFile(dest) === entry.checksum`) is satisfied for the same file. D12 forecloses the *content-sniffing*
     form of this attack and D11 re-opens the *committed-manifest* form. AC-11 only probes the **absent** manifest
     ("remove the manifest and assert `--adopt` exits non-zero"), never a **tampered** one. Specify: (a) how an
     installed manifest's authenticity is established — cross-check against the published release digest for the
     version recorded in `.meowkit/metadata.json` (name that surviving version source explicitly, since
     `config.json`'s `version` is being deleted), or declare a committed manifest untrusted and have `--adopt`
     refuse offline, which contradicts D11's stated reason for the allowlist line and so forces a choice; and
     (b) add a tampered-manifest fixture to AC-11 plus an AC-10 assertion that no adopted baseline can classify a
     user-authored file `clean`. Also: `!release-manifest.json` departs from **`plan.md` Decision 3
     (user-confirmed 261101** — `.meowkit/` gitignored except `config.yaml`, `memory/*.md`, `bin/mewkit`,
     `*.example`), not merely from "Req 8's literal nine lines" as D11 states. Name the user-confirmed decision so
     the drift is visible in the record.
  2. **D4 / AC-06 — the user-scope hatch collapses into project scope when the project root is `$HOME`, which is a
     gate weakening.** D4 buys the property "the project config remains unreachable" from `gate-enforcement.cjs`
     by reading the hatch from `~/.meowkit/config.yaml` only. But when the resolved root equals `$HOME` —
     a dotfiles-style repo, or a container/CI where `HOME` is the workspace; `meowkit-root-resolver.ts` keys off
     `.git`, so a `~` with a `.git` resolves as root — `<root>/.meowkit/config.yaml` and `~/.meowkit/config.yaml`
     are the **same file**, and a committed, PR-editable config can then set `gate1PresenceOnly: true`. That is
     exactly the Key Insight 3 downgrade D2/D4 exist to prevent, and AC-06 has no cell for it. AC-06 must assert
     that when the two paths resolve to the same file (compare realpath/inode, not string) the hatch is **refused**
     and Gate 1 stays strict, and state what is logged. Same AC: state whether the hatch fails **closed** when the
     `.meowkit/telemetry/security-log` append fails — AC-12's own clone-without-init scenario can present a missing
     or read-only `.meowkit/`, and an unlogged gate downgrade there would break intervention-recording Rule 1.
  3. **AC-01 — the pinned name universe is wrong, and one *live hook* env read is in no class at all.** Re-running
     the inventory's own method (`.claude packages scripts tests docs .github`, excluding `node_modules`,
     worktrees, `migrate/modules`) yields **77 matches / 73 real names** after discarding four prefix fragments
     (`MEOWKIT_BUDGET_`, `MEOWKIT_SUMMARY_`, `MEOW_CONFLUENCE_`, `MEOW_JIRA_`) — not 72, and not 62/9/1 (actual
     64/12/1). Four real names are in the tree and in **none** of §2a–2g: `MEOWKIT_MAX_PROJECT_CONTEXT_BYTES`,
     which is a **live read at `.claude/hooks/handlers/project-context-loader.cjs:37` inside the shipped kit** and
     looks like a missing §2a toggle row (`projectContext.maxBytes`); plus `MEOWKIT_HARNESS_MODE`,
     `MEOWKIT_MEMORY_STALENESS_MONTHS` and `MEOWKIT_SUMMARY` (`packages/docs/content/docs/`, an unscanned tree with
     its own `MEOWKIT_*` prose) and `MEOWKIT_IMAGE_GEN_MODEL` (`.claude/skills/multimodal/.env.example`).
     Conversely `MEOWKIT_THING`, `MEOWKIT_SECRET_BACKDOOR`, `MEOWKIT_TEST_MCP_*` and `MEOWKIT_WIKI_SLUG`, which §1
     and §2g count, appear only in `RELEASING.md` and `tasks/` — outside the scope §1 names. Consequences: AC-01's
     "every one of the 72 names" is pinned to a number that cannot be satisfied, and **AC-01 and AC-07 contradict
     each other** — AC-07's CI check demands 0 non-allowlisted reads in `.claude/**` and will trip on
     `MEOWKIT_MAX_PROJECT_CONTEXT_BYTES`, a name AC-01's table does not contain. Replace the hard-coded 72 with
     "the count the committed scan command yields at BASE, recorded in the evidence file"; state that scan command
     and its exclusions verbatim in AC-01; rule on how prefix fragments, `.env.example` keys and changelog prose
     are treated; say whether `packages/docs/**` and `RELEASING.md` are in or out of the universe; and classify the
     four missing names.
  4. **D9 / AC-04, AC-15 — dropping `MEOWKIT_TDD` silently relaxes strict mode, and no AC tests the loud error the
     contract promises.** At BASE `lib/tdd-detect.cjs:36-39` makes `MEOWKIT_TDD` the **highest-precedence** tier and
     one of only two sources that can turn TDD *on*. After D9 it is simply unread, so a user or CI job exporting
     `MEOWKIT_TDD=1` falls through to `default OFF` and `pre-implement.cjs`'s failing-test-first enforcement
     silently stops — an enforcement mode turning itself off without a word. The Out-of-Scope Clarifications already
     commit to "A removed name is an error with a pointer, not a fallback", but **no AC asserts it for any removed
     name**: AC-04 proves only the new precedence, and AC-15's path list omits the removed-env case. Add to AC-04 or
     AC-15 an assertion that a still-exported removed behavior toggle is **detected and reported** — a `doctor`
     finding for all 28 dropped names and the three §2a on/off names, and for `MEOWKIT_TDD` a session-visible
     warning naming `tdd:` in `config.yaml` — with the exit code and the visibility stated. A clean break is
     accepted; a silent one that disables enforcement is not.
  5. **AC-02 / Scope — the existing-install upgrade path is untested, and `pm.auto` ships a *new* dead declared
     key.** (a) Every config AC is written against a **fresh `mewkit init`** (AC-02, AC-08's first half). No AC
     exercises an existing v2.15 project, where `.meowkit/config.json` is **tracked and committed**
     (`commands/setup-steps.ts:58` deliberately does not ignore it) while D11's new `.meowkit/.gitignore`
     allowlists only `config.yaml`. "`.meowkit/config.json` deleted" in Scope is ambiguous between the kit source
     tree and the installed project; if the latter, it deletes a user-committed file, a case D12's never-delete
     class does not cover. Say which, and add the upgrade-an-existing-install case to AC-08 or AC-09 — including
     what `core/validate-install.ts:57`'s `check("config.json exists", …)` becomes for a project that still has
     one. (b) `pm.auto` is admitted to have **no code reader** (D9, §2a), yet AC-02 puts it in a schema with
     `additionalProperties: false` while AC-01 deletes `MEOWKIT_TDD_FLAG_DETECTOR` and `MEOWKIT_MEMORY_BUDGET`
     *precisely because* they are declared-and-unread. AC-01 currently only requires a table row stating the
     reason, which is self-certifying rather than testable. Either name the probe that proves `pm.auto` resolves
     (e.g. it is readable through the `readConfig` helper the repointed prose instructs the agent to use, asserted
     like any other key) or drop it with the other reader-less names. Do not ship a new dead declared key in the
     sprint whose purpose is deleting them.
  6. **Pinned baseline fact error — "33 observer registrations".** `.claude/hooks/handlers.json` has **22**
     entries in `handlers[]` (21 distinct `toggleKey`s, `budgetTracker` twice), not 33; `.claude/settings.json`
     registers 13 commands, so 22+13=35 and 33 corresponds to nothing reproducible. The numbers AC-07 actually
     depends on (21, and the double `budgetTracker`) are correct, so this is a one-number fix — but the contract
     opens by claiming "Every number, path and line citation below is grounded", and inventory §3 carries the same
     33. Correct both.
  7. **Sprint size — record the split decision rather than leaving it implicit.** 15 ACs matches sprints 3 and 4,
     and the ACs are individually coherent, so this is not a rejection. But the breadth is materially larger: a
     whole config subsystem and two readers, 21 toggle migrations, 28 name deletions across 36+ docs, a gitignore
     reshape with a migration, a new snapshot module, two new verbs, ownership-metadata extension,
     `--json`/`--dry-run` across seven commands, a CI check, regenerated projections and a recorded clone journey.
     Either split at the clean AC-07|AC-08 seam (AC-01–07 config/env/toggles; AC-08–15 filesystem ownership,
     uninstall, backups, CLI UX — with AC-14/AC-15 restated per half, since they span both) or record in a Decision
     why one sprint holds. Note for whichever shape is chosen: 15 ACs is the evaluator's per-session criterion
     ceiling, so an amendment adding an AC (items 1–5 above each plausibly add one) must either replace an existing
     AC or force the verification across two sessions — which is itself an argument for the split.

- Round 2 (proposer/generator): all 7 reviewer items resolved in the Decision/Scope/AC text, not only logged. No
  AC added — every probe folds into an existing `Then` or `Verification`, which is itself recorded as D15.
  1. **`release-manifest.json` is NOT committed; deletion now needs a trusted kit source.** Round 1's
     `!release-manifest.json` allowlist line is withdrawn from D11 and from AC-08, which asserts its absence by
     name, and the departure is attributed to **`plan.md` Decision 3 (user-confirmed 261101)** rather than to
     "Req 8's literal nine lines". The baseline stays local and untracked. The reviewer's deeper point — that an
     unauthenticated baseline satisfies the BASE deletion gate (`owner === "meowkit"` AND
     `hashFile(dest) === entry.checksum`, `core/smart-update.ts:339-345`) because both facts come from the file
     being attacked — is answered by making the baseline insufficient instead of making it authentic: D12 now
     requires that a file's on-disk content also agree with the content the **running CLI itself ships** for that
     path, a source outside the project and not PR-editable, and refuses for any path where the CLI cannot
     produce it. A user-authored file matches no kit content, so no tampered or adopted baseline can classify it
     `clean`. This is the simplest sound option available and needs no digest or signature. (**Corrected in round 2b:**
     this line also claimed "no network", which was false as written — the kit was only ever obtainable over the
     network. After the 261108 user decision the claim becomes true for the operations that matter: `init` and
     `upgrade` fetch and populate `.meowkit/cache/`; `uninstall`, `backups` and `doctor --adopt` read that cache
     and need no network at all.) `--adopt`
     uses the same single source and refuses otherwise, so a clone with neither a baseline nor a usable CLI kit
     gets a refusal from both `uninstall` and `--adopt`. Probes added: AC-10 gains a fifth invocation against a
     **hand-edited** `metadata.json` that claims a user file with matching checksums (so the BASE gate would pass)
     and asserts the file survives `--yes --force` and is named; AC-11 gains a fifth fixture, the no-baseline
     no-CLI case, plus planted tampered `release-manifest.json`/`metadata.json` which `--adopt` must ignore. The
     new term **trusted kit source** is in Definitions; Scope (Out) forbids a committed baseline and any trust in
     an in-project manifest.
  2. **Hatch scope collapse and unloggable downgrade both fail closed.** D4 and AC-06 gain two cells. When the
     resolved project root is `$HOME`, `<root>/.meowkit/config.yaml` and `~/.meowkit/config.yaml` are the same
     file (`state/meowkit-root-resolver.ts` keys off `.git`, so a `~` with a `.git` resolves as root) and the
     "user scope is outside the repo" premise fails: compared by **realpath/inode, never by string**, with a
     symlinked `~/.meowkit` as a second fixture, the hatch is **refused**, Gate 1 stays strict, the collapse is
     warned on stderr and the refusal is logged; the env var still works there because it is not PR-editable. And
     the hatch **fails closed** when the `.meowkit/telemetry/security-log` append fails — the state AC-12's
     clone-without-init can present — because an unrecorded gate downgrade would breach intervention-recording
     Rule 1. The Definitions entry for *user config* now carries the exception, and Out-of-Scope forbids both.
  3. **AC-01 re-derived from a committed scan script with an explicit scope.** The hard-coded 72 is gone. AC-01
     now names the script, its trees (`.claude packages scripts tests docs .github .meowkit`) and its exclusions
     (`node_modules`, `.git`, `.claude/worktrees/**`, `migrate/modules/**`, `**/dist/**`,
     `packages/docs/.next/**` — the last added because it is Next.js build output that duplicates the content
     tree), and pins the universe to what the script yields: **84 at BASE** (73 `MEOWKIT_` / 10 `MEOW_` / 1
     `MK_`). The four scope rules the reviewer asked for are stated and each is checkable from the script alone:
     a match ending in `_` is a prefix fragment and not a name (the four the reviewer listed); an `.env.example`
     key **is** a name (`MEOWKIT_IMAGE_GEN_MODEL`); `packages/docs/**` **is** in scope because it ships its own
     `MEOWKIT_*` documentation that can go stale, while `RELEASING.md` and `tasks/**` are **out** as immutable
     history and workflow artefacts — which removes `MEOWKIT_THING`, `MEOWKIT_SECRET_BACKDOOR` and
     `MEOWKIT_WIKI_SLUG` that round 1 wrongly counted. All four unclassified names are classified:
     `MEOWKIT_MAX_PROJECT_CONTEXT_BYTES` becomes the toggle key `projectContext.maxBytes` (live read at
     `handlers/project-context-loader.cjs:37`, confirmed, and now also in AC-02's key list and Scope (In)),
     `MEOWKIT_HARNESS_MODE` and `MEOWKIT_MEMORY_STALENESS_MONTHS` are drops (`packages/docs/content/docs/` prose
     only), `MEOWKIT_IMAGE_GEN_MODEL` goes to allowlist class (e). On the fifth name I reached a different
     answer and show the work: **bare `MEOWKIT_SUMMARY` is not a name** — zero standalone occurrences; it is the
     prefix of `MEOWKIT_SUMMARY_MODE`, which greedy `grep -o` resolves to the longer token. AC-01 records that.
     One finding of my own that changes the method rather than a row: the multimodal names are read through
     **prefix composition** — `skills/multimodal/scripts/env_utils.py:14` is
     `os.getenv(f'MEOWKIT_{name}') or os.getenv(name)` with suffixes at `provider_router.py:28-36` — so a
     literal-name reader scan produces roughly sixteen **false** reader-less verdicts. AC-01 therefore requires
     the reader column to be composition-aware, and those names are allowlisted under class (e) rather than
     dropped. The AC-01/AC-07 contradiction is closed structurally: AC-07's CI check now **loads AC-01's table as
     its allowlist**, so neither can disagree with the other, and AC-07's verification plants a *composed*
     violation as well as a literal one.
  4. **D9 reversed: `MEOWKIT_TDD` keeps working.** The reviewer is right that this was unsafe and not merely
     breaking — `lib/tdd-detect.cjs:36-39` makes it the highest-precedence tier and one of only two sources that
     can turn TDD on, so an unread `MEOWKIT_TDD=1` would silently stop `pre-implement.cjs`'s enforcement. D9 is
     rewritten: `MEOWKIT_TDD` is a **supported** env override in a new D8 allowlist class (f) at the same top
     precedence it has today, with `tdd` as a config key beneath it. AC-04's title and matrix now read
     `MEOWKIT_TDD` env > `--tdd` sentinel > project > user > default OFF, with an explicit cell proving
     `tdd: false` does not override an exported `MEOWKIT_TDD=1` and a `pre-implement.cjs` invocation proving
     enforcement is actually on. Only the `MEOW_PROFILE` tier is removed. Separately AC-04 now asserts the loud
     error the contract promised but never tested: `mewkit doctor` emits one finding per still-exported removed
     name, tested on a real removed name (`MEOWKIT_LOOP_DETECT`) and one reader-less drop, each naming the name,
     its replacement key or the absence of one, and the file to edit, at a non-zero exit for that finding class.
     A new Out-of-Scope line states the general rule: never turn an enforcement mode off silently.
  5. **Existing-install upgrade path tested; `pm.auto` removed from the schema.** AC-02 gains a second
     Given/When/Then over a v2.15-shaped project with a **tracked and committed** `.meowkit/config.json`
     (`commands/setup-steps.ts:58` never ignored it): `upgrade` migrates it — every value with an equivalent
     carried across and written **uncommented** because it is now the user's explicit choice, every value without
     one reported by name, the original captured in the AC-09 snapshot first, and only then removed — while
     `doctor` run beforehand reports migration-pending and names `upgrade` as the next action, and
     `core/validate-install.ts:57`'s `check("config.json exists", ...)` becomes a `config.yaml` check that reports
     migration-pending rather than failing. The ambiguity the reviewer flagged is resolved explicitly in both
     AC-02 and Scope (In): the file is dropped from the **kit source tree**, and an installed project's copy is
     **migrated, never deleted** — `uninstall` leaves it alone in every invocation, which AC-02 verifies with
     `--yes --force`. And `pm.auto` is **out of the schema**: AC-02 asserts its absence by name from both the
     emitted config and `config-v1.json`, D9 records it as prose-only, and Scope (Out) plus a new Out-of-Scope
     line forbid declaring any key nothing reads — the reviewer's point that shipping a new dead key in the
     sprint whose purpose is deleting them is incoherent is accepted without qualification.
  6. **Count fixed: 22, not 33.** The Pinned baseline now reads "22 entries in `handlers[]` over 21 distinct
     camelCase `toggleKey`s (`budgetTracker` appears twice), while `.claude/settings.json` registers 13 hook
     commands"; the Definitions entry for *observer* and AC-07 carry the same number, and AC-07's shape test
     asserts 22 entries / 21 keys. `env-inventory.md` §3 is corrected to match, and its §1/§2 are rewritten to the
     AC-01 method (84 names, the composition finding, the four newly classified names, the `MEOWKIT_SUMMARY`
     correction). The round-1 claim "every number is grounded" was false for this one; it is now grounded.
  7. **D15 records why one sprint holds.** Not breadth but coupling: the uninstall half cannot be verified
     without the config half it reads, the gitignore reshape and the `config.json` retirement are the same edits
     to `commands/setup-steps.ts` and `core/smart-update.ts`, and AC-14/AC-15 would need restating in both halves
     — duplicating the two criteria most likely to drift. The consequence is accepted and stated: 15 ACs, every
     round-2 addition folded into an existing AC, and if one evaluator session cannot hold 15 criteria at this
     depth the right answer is two verification passes over one signed contract rather than a second contract
     whose ACs depend on unsigned work. Rubric Bindings are unchanged (functionality 10, product-depth 3,
     code-quality 1, ux-usability 1), each AC bound exactly once, BASE still the real SHA.

- Round 2 (reviewer/evaluator): six of seven items **accepted** on re-verification; **one blocking issue remains**
  (item 1's mechanism names a source that does not exist in this architecture). Hard cap reached — this does not go
  to a round 3; it goes to the user.
  **Accepted, with what I re-derived independently:**
  - **Item 3 — accepted, and the generator is right where it corrected me.** I re-ran the committed
    `scan-env-names.sh` at BASE: **84 names, byte-identical to `universe-at-base.txt`** (`diff` clean), split
    **73 `MEOWKIT_` / 10 `MEOW_` / 1 `MK_`** exactly as AC-01 states. The method is now reproducible from the
    repo instead of asserted, which is what item 3 asked for. **Bare `MEOWKIT_SUMMARY` is not a name — conceded:**
    my round-1 hit was a substring artefact of `grep -rln "MEOWKIT_SUMMARY"` matching `MEOWKIT_SUMMARY_MODE`; a
    word-boundary scan yields only `MEOWKIT_SUMMARY_` (fragment, 2×) and `MEOWKIT_SUMMARY_MODE` (2×), zero
    standalone. The composition finding is **real, material, and the generator's own, not mine**:
    `skills/multimodal/scripts/env_utils.py:14` is `os.getenv(f'MEOWKIT_{name}') or os.getenv(name)`, and the
    suffixes live in `provider_router.py:21-42` (`PROVIDER_KEY_MAP` 3, `CHAIN_ENV_MAP` 4, `MODEL_ENV_MAP` 7) plus
    direct `_env('X')` literals. I enumerated the union: **exactly 16 names**, so "roughly sixteen" is precise,
    not rounded. All 16 are present in the 84 as literals (`.env.example`/docs), so the *universe* was never
    wrong — the *reader column* was, and in the dangerous direction: §2g had dropped
    `MEOWKIT_MINIMAX_SPEECH_VOICE`, `MEOWKIT_OPENROUTER_FALLBACK_ENABLED` and `MEOWKIT_IMAGE_PROVIDER_CHAIN` as
    reader-less when composed readers exist. Deleting live user config was the failure that finding prevents.
    Making AC-07's CI check **load AC-01's table as its allowlist** closes the AC-01/AC-07 contradiction
    structurally rather than by keeping two lists in sync, and planting a *composed* violation as well as a
    literal one is the right probe for a check that cannot see composed names by regex. `MEOWKIT_MAX_PROJECT_CONTEXT_BYTES`
    → `projectContext.maxBytes` confirmed against the live read at `handlers/project-context-loader.cjs:37`.
  - **Item 2 — accepted.** AC-06 now carries both cells: the root-equals-`$HOME` collapse compared by
    **realpath/inode, never by string**, with a symlinked `~/.meowkit` as a second fixture, the hatch refused,
    Gate 1 left strict, the collapse warned on stderr and the refusal logged; and the hatch **fails closed** when
    the `security-log` append fails. Keeping the env var working in the collapsed layout is correct — it is not
    PR-editable, which is the actual threat model.
  - **Item 4 — accepted, and the reversal is the right call.** AC-04 restores `MEOWKIT_TDD` at top precedence
    (`MEOWKIT_TDD` env > `--tdd` sentinel > project > user > default OFF), preserving the BASE order of
    `tdd-detect.cjs:36-55` with only the `MEOW_PROFILE` tier removed, and adds the two cells that matter: a
    project `tdd: false` must **not** override an exported `MEOWKIT_TDD=1`, and a `pre-implement.cjs` invocation
    proving enforcement is actually on rather than merely resolved. The loud-removed-name finding is now tested on
    a real removed name (`MEOWKIT_LOOP_DETECT`) and a reader-less drop, each naming the replacement key and the
    file to edit at a non-zero exit — the promise that round 1 found untested is now probed.
  - **Item 5 — accepted.** AC-02's second Given/When/Then covers the v2.15 project with a tracked, committed
    `.meowkit/config.json`, and resolves the ambiguity the right way: dropped from the **kit source tree**,
    **migrated and never deleted** in an installed project, verified under `--yes --force`, snapshotted first,
    values carried across **uncommented** (correctly — a migrated value is the user's explicit choice, not a kit
    default), unmigratable values reported by name, and `validate-install.ts:57` turned into a migration-pending
    report rather than a hard failure. `pm.auto` out of the schema, absence asserted by name in both the emitted
    config and `config-v1.json`, with a general Out-of-Scope line forbidding any key nothing reads.
  - **Item 6 — accepted.** 22 entries / 21 distinct `toggleKey`s (`budgetTracker` twice) and 13 settings hook
    commands now appear in the Pinned baseline, the *observer* Definition and AC-07's shape test consistently.
  - **Item 7 — accepted.** D15 argues coupling rather than breadth, which is the correct axis: the uninstall half
    reads the config half, and the gitignore reshape and `config.json` retirement are the same edits to
    `commands/setup-steps.ts` and `core/smart-update.ts`. Two verification passes over one signed contract is
    sounder than a second contract whose ACs depend on unsigned work. Rubric Bindings re-checked: 15 ACs, each
    bound exactly once, 10/3/1/1 against `cli-tool`'s 0.40/0.25/0.20/0.15.
  **BLOCKING — item 1: the direction is right, but the "trusted kit source" does not exist in this architecture.**
  Withdrawing `!release-manifest.json`, attributing the departure to `plan.md` Decision 3, and keeping the
  baseline local and untracked are all accepted. So is the *reasoning*: making the baseline **insufficient**
  rather than **authentic** is a better answer than the digest/signature I asked for, because it removes the
  in-project manifest from the trust path entirely instead of trying to certify it, and the resulting property is
  baseline-independent — a baseline can then only ever narrow what is deleted, never widen it past real kit
  content. AC-10's fifth invocation and AC-11's fifth fixture are the right probes. The defect is the *source*.
  Definitions pins it to "the kit content carried by the running `mewkit` installation itself", and the running
  installation carries none:
  - `packages/mewkit/package.json` publishes `files: ["dist", "portable-manifest.json", "NOTICE"]` — no kit
    content. `assets/` holds only `design-tokens.json` and is not even in `files[]`.
  - The kit is obtained **only** over the network: `core/github-releases.ts:87` `downloadRelease` `fetch`es the
    release asset into `join(tmpdir(), "meowkit-release-${version}-${Date.now()}")` (`:88`), and
    `commands/upgrade.ts:334` calls `cleanupDownload(sourceDir)`, which is `rmSync(tempDir, {recursive, force})`
    (`github-releases.ts:127-133`). Timestamped temp dir, deleted after use — there is **no persistent local kit
    cache anywhere** (no `homedir()` kit path exists in `core/` or `state/`).
  - This is not an oversight to patch around: it is **`plan.md` Decision 4, user-confirmed 261101** — "Kit
    artifact on GitHub release only; npm `mewkit` ships the CLI only; CLI and kit version independently."
  - The committed launcher of D14/phase 06 cannot serve either: `.meowkit/bin/mewkit` is in-project, and the new
    Definition correctly excludes any in-project file.
  Consequences, which is why this blocks rather than being a wording fix: round 2 claims the mechanism "needs no
  digest, signature or network" — the network claim is false, and with the stated per-path refusal fallback the
  offline case degrades to **refusing every path**. Then `clean` (whose Definition now *requires* kit-content
  agreement) is empty, so AC-10's `--yes` cell — "deletes exactly the `clean` files" — cannot pass as written
  unless that fixture is granted network access, which no AC states; and AC-11's `--adopt` **success** case
  ("after which `upgrade --dry-run` and `uninstall` classify identically to a normally installed project") has no
  source to adopt from. AC-11's no-baseline-no-CLI refusal and AC-12's network-off journey stay correct and are in
  fact what expose the gap: offline is a first-class supported state in this sprint.
  Resolving it is a **user decision, not a reviewer's**, because every available option moves a user-confirmed
  decision or a disclosed risk, and the 2-round cap is spent. Escalate with these options: **(a)** install writes
  an **untracked** local kit copy under `.meowkit/` (e.g. `cache/`) as the trusted source — a PR cannot introduce
  or alter it, which is precisely the threat model, and D11's deny-all keeps it untracked; this needs the
  Definition's "no in-project file" clause narrowed to "no *tracked* in-project file", and that narrowing is
  exactly the kind of thing that must be user-visible rather than reviewer-approved; **(b)** require the network
  for any deletion and disclose that `uninstall` refuses offline, which contradicts round 2's own "no network"
  claim and weakens the offline story; **(c)** defer the kit-content requirement and ship `uninstall` with
  baseline-only deletion plus the tamper risk disclosed — I do **not** recommend (c): it reinstates the data loss
  item 1 was raised about. Whichever is chosen, AC-10's `--yes` cell and AC-11's `--adopt` success case must state
  the source they assume, and Definitions must name a source that exists.

- User decision (261108): option (a) local kit cache — asked directly after the evaluator escalated item 1, the
  user chose "Local kit cache (Recommended)" verbatim over (b) require the network for deletion and (c) ship
  baseline-only deletion with the tamper risk disclosed. `init` and `upgrade` keep a copy of the kit they
  installed under `.meowkit/cache/`, never committed — D11's deny-all `.meowkit/.gitignore` keeps it untracked —
  and that copy is the trusted source `uninstall` and `doctor --adopt` check content against. The accepted,
  user-visible consequence is that the trust clause **narrows** from "no in-project file is trusted" to "no
  **tracked** in-project file is trusted": the property relied on is that a pull request cannot introduce or alter
  an untracked file, which is the actual threat model, rather than that the source lives outside the project.
  Neither `plan.md` Decision 3 nor Decision 4 is disturbed — the cache is not committed, and the kit artifact is
  still distributed on GitHub releases only; the cache is a local, derived copy of what install already fetched.
- Round 2b (proposer/generator): the user decision applied. Nine edits, no AC added, still 15 ACs, `rounds: 2`,
  unsigned.
  **Definitions** — *trusted kit source* is re-pinned from "the kit content carried by the running `mewkit`
  installation" (which the evaluator proved does not exist: `packages/mewkit/package.json` publishes
  `files: ["dist", "portable-manifest.json", "NOTICE"]`, and `core/github-releases.ts:87-88` fetches into a
  timestamped tmpdir that `commands/upgrade.ts:334` deletes) to `.meowkit/cache/`, stating exactly what it holds:
  the kit content of the installed release version — the `.claude/` tree and the kit-shipped `.meowkit/` subset,
  byte-for-byte as shipped — plus the version string it came from, recorded so a cache from another release is
  detectable rather than silently compared. The entry names `cache/` as the correct taxonomy class because
  `meowkit-paths.cjs` already defines it as derived and rebuildable, and states the narrowed clause: a **tracked**
  in-project file is never trusted, including a `.meowkit/cache/` path that `git ls-files` reports.
  *Ownership class* now says "agrees with the trusted kit source" rather than "with what the running CLI ships".
  *Clone-without-init* gains "no `.meowkit/cache/`" with the reason (it is untracked, so a clone never has one)
  and a note on where the network is actually needed.
  **D12** — rewritten around the cache, carrying the user decision and its date, the evaluator's three citations
  for why the previous source did not exist, and `plan.md` Decision 4 (user-confirmed 261101) as the reason that
  was architectural rather than an oversight. Cache rules stated and all delegated to ACs: never tracked
  (AC-08), never deleted by `uninstall` with or without `--force` (it is already in the never-delete class), a
  tracked cache path is distrusted and re-checked per run rather than trusting the ignore file to still exist,
  and when the cache is missing, incomplete or records a version other than `metadata.json`'s, `uninstall`
  refuses **per affected path** — never a silent baseline-only fallback — while `doctor` emits a finding naming
  `mewkit upgrade` as the re-fetch. `--adopt` reads the cache and nothing else, refuses otherwise, and names
  `mewkit upgrade`.
  **AC-10** — the fixture now carries a populated `.meowkit/cache/` for the version `metadata.json` records, and
  the `--yes` cell says so explicitly, since that is what makes a non-empty `clean` class possible at all (the
  evaluator's point that the previous wording could not pass offline). Three cache-degraded invocations added to
  the same AC — absent cache, version-mismatched cache, and a cache path forced into tracking with `git add -f` —
  each asserting zero deletions, the per-path refusal text and the `mewkit upgrade` pointer; eight invocations
  total; `cache/` added to the subtrees asserted byte-identical after every run, so the uninstall that consults
  the trusted source cannot destroy it; and every run executed with the network unreachable.
  **AC-11** — the `--adopt` success fixture is now "populated cache, no `metadata.json`" and the AC names
  `.meowkit/cache/` as its source; the no-baseline-no-cache refusal stays and additionally asserts the
  `mewkit upgrade` pointer; the tampered-source plant list gains a `git add -f`-tracked cache path beside the
  hand-edited `release-manifest.json` and `metadata.json`; and the whole AC now runs with the network unreachable.
  **AC-08** — the tracked-set assertion is made on a project where `init` has populated the cache, and requires
  `git check-ignore -v` to name the `*` rule for a path inside `.meowkit/cache/` with `git ls-files .meowkit/cache`
  **empty** — the untracked status of the cache is the entire basis of the trust, so it is asserted rather than
  assumed.
  **AC-09** — snapshots **exclude** `.meowkit/cache/`, which is the recommended choice and taken: the cache is
  re-derivable by `mewkit upgrade`, so including it would multiply every backup by the size of a whole kit for no
  recovery value. `restore` neither writes nor removes anything under it, and the AC asserts the cache is
  byte-identical across a snapshot/restore cycle, with the AC-09 fixture also now carrying a populated cache.
  **AC-12** — unchanged in substance and still valid; its `Given` now states the clone has no cache and why, so
  the offline journey and the cache decision cannot be read as contradicting each other.
  **Network wording** — round 2's "needs no digest, signature or network" is corrected in place with an
  inline round-2b note rather than rewritten, since the log is append-only history: the network claim was false
  as written, and is true after this decision for the operations that matter — fetch happens at `init`/`upgrade`
  only, and deletion needs none.
  **Scope** — Scope (In) adds the cache with its touch points (`core/github-releases.ts:87-96` and
  `commands/upgrade.ts:334`, which must populate the cache before removing the tmpdir), the snapshot exclusion and
  the doctor finding; Scope (Out) narrows the trust line to tracked files, records the one exception the user
  decision created, and forbids committing, snapshotting or deleting the cache, any network fetch outside
  `init`/`upgrade`, and a baseline-only fallback. Out-of-Scope Clarifications gain the matching three lines.
  Nothing else moved: no decision reopened, Rubric Bindings unchanged (functionality 10, product-depth 3,
  code-quality 1, ux-usability 1), each AC bound exactly once, BASE still
  `085cb5bd2ee855431f68d0481958da9114ab92e5`, `status: negotiating`, `rounds: 2`, both signature fields null.

- Round 2b (reviewer/evaluator): accepted — the user decision of 2026-11-08 ("Local kit cache", my option (a)) is
  applied faithfully and closes the single blocking item. Verified only the decision's application; the six items
  accepted in round 2 were re-checked for regression, not reopened.
  1. **Definitions name a source that exists.** *Trusted kit source* is now the local kit cache at
     `.meowkit/cache/`, written by `init` and `upgrade`. It reuses an existing taxonomy class rather than
     inventing one: `.claude/hooks/lib/meowkit-paths.cjs:8` already defines `cache/` as "derived, rebuildable
     artifacts" and `:48` already exposes `cacheDir`. D12 states the narrowing explicitly — "no **tracked**
     in-project file is trusted" — attributes it to the user decision, and records the property it rests on
     (D11's deny-all keeps `cache/` untracked, so a pull request cannot introduce or alter it, which is the actual
     threat model) rather than the out-of-project premise that round 2 could not supply.
  2. **AC-10 and AC-11 state the cache as their source.** AC-10's `Given` carries a populated `.meowkit/cache/`
     for the version `.meowkit/metadata.json` records, and the `--yes` cell says so in the clause that was
     unsatisfiable before — "whose fixture has the populated cache, which is what makes a non-empty `clean` class
     possible at all". AC-11's successful `--adopt` rebuilds metadata "**only** by comparing on-disk files against
     `.meowkit/cache/` … and never against a tracked in-project file", with any non-matching file recorded
     `orphan` or `user`, never `meowkit` — which closes the adopt-side half of the data-loss vector as well as the
     uninstall-side half.
  3. **Degraded cache refuses per path and points at `mewkit upgrade`.** All three degradations are probed as
     separate invocations — cache absent, cache recording a version other than `metadata.json`'s, and a cache path
     forced into tracking by `git add -f` — each deleting nothing and refusing **per affected path** with the
     `mewkit upgrade` pointer; D12 adds *incomplete* to the same rule, and Scope (Out) forbids "a baseline-only
     deletion fallback when the cache is absent or version-mismatched". Two details are better than what I asked
     for: the version mismatch is detected from the version the cache **records** against the one `metadata.json`
     reports, "not from content luck"; and the tracked-cache check is re-made with `git ls-files` **per run**
     instead of trusting `.meowkit/.gitignore` to still be in place — which is what defeats a pull request that
     allowlists `cache/` and then commits content into it.
  4. **AC-08 shows `cache/` untracked, non-vacuously.** The assertion is made on a project where `init` has
     already populated the cache, with `git check-ignore -v` naming the `.meowkit/.gitignore` `*` rule for a path
     inside it and `git ls-files .meowkit/cache` **empty** — so it proves the ignore actually covers real content
     rather than an empty directory.
  5. **AC-09 excludes the cache from snapshots** and asserts it both ways: no snapshot manifest lists a
     `.meowkit/cache/` path, and the cache is byte-identical before and after a restore. The rationale is sound —
     the cache is re-derivable by `mewkit upgrade`, so snapshotting it would multiply every backup by the size of
     a whole kit for no recovery value.
  6. **The network wording is corrected, and now proved rather than asserted.** D12 states "the fetch happens at
     `init`/`upgrade` only, and deletion needs none"; Scope (Out) forbids a network fetch on any path other than
     those two; and AC-10 and AC-11 both **run with the network unreachable**, so the claim is a probe rather than
     a sentence. D12 also records why round 2's source did not exist — `files: ["dist", "portable-manifest.json",
     "NOTICE"]`, `github-releases.ts:87-88` fetching into a timestamped tmpdir, `upgrade.ts:334` deleting it via
     `cleanupDownload` (`:127-133`) — and attributes it to `plan.md` Decision 4 rather than to an oversight.
  7. **No regression.** 15 ACs, each bound exactly once, Rubric Bindings unchanged at functionality 10 /
     product-depth 3 / code-quality 1 / ux-usability 1 against `cli-tool`'s 0.40/0.25/0.20/0.15. BASE still the
     real SHA `085cb5bd`. All six round-2 resolutions intact: the committed scan's 84 names (73/10/1), the
     `MEOWKIT_TDD` env > `--tdd` sentinel > project > user > default OFF precedence, `pm.auto` absent by name,
     22 entries over 21 `toggleKey`s, AC-06's realpath/inode and fail-closed cells, and D15. No contradiction
     between `cache/` sitting in the never-delete class and `upgrade` refreshing it: D12 scopes the protection to
     `uninstall` and describes `upgrade` as the path that "re-fetches and rewrites the cache".
  Residual risk, stated for the record rather than as an objection: the trust anchor is now a local untracked
  directory, so an actor with filesystem write access to the project could alter it — but such an actor can
  already modify the kit and the metadata directly, so this widens no practical exposure. The threat model the
  sprint defends is the PR-editable committed file, and an untracked `cache/` plus the per-run `git ls-files`
  re-check covers it. Evaluator accepts; proceeding to sign.

## Amendments (if any)

None yet.
