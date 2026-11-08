---
contract_schema_version: 1.0.0
task: meowkit-v3-lean-runtime
sprint: 6
plan_ref: tasks/plans/261101-meowkit-v3-lean-runtime/plan.md
rubric_preset: cli-tool
status: signed
generator_signed: 79f9c7359f4665e2abd04ba933122fb2b6ec54ea
evaluator_signed: 6f62a9e03f53f4d5b4e18e05d6d27732852ac12a
rounds: 2
created: 261108-2347
---

# Sprint 6 Contract — Signed, digest-verified kit artifact and one shared emitter path

Testable translation of `phase-04-kit-artifact-and-emitters.md` (Requirements, Architecture, Related Code
Files, Implementation Steps, Success Criteria, Risk Assessment, Security Considerations), bounded by
`plan.md` Decisions 1–7 and Constraints. Every number, path and line citation is grounded in
`tasks/reviews/evidence/261108-meowkit-v3-lean-runtime-sprint-6/kit-artifact-inventory.md`.

## Pinned baseline

- BASE = `56488bc520f6a042472c8b4e6259d9ff0bdae863` — "feat(config): single config.yaml with local kit cache
  and safe install verbs", the sprint-5 commit and the current `HEAD` of `feat/v3-lean-runtime`.
- Every "at BASE" claim and every `git diff BASE` in this contract resolves against that commit.
- At BASE: there is no kit artifact, no manifest signature and no signing key anywhere in the tree; the
  release workflows run `npx semantic-release` with **no semantic-release config file present at all** and no
  step that builds or uploads a kit asset, so the only asset that ever reaches a release is the zip uploaded
  by the human-run `scripts/release.sh:113-137`; the CLI selects a release asset by
  `name.endsWith(".zip")` (`core/github-releases.ts:71`) and extracts it with `AdmZip.extractAllTo`
  **without a path-traversal guard** (`:133-134`); the ship-set is **17** `zip -x` patterns in
  `scripts/prepare-release-assets.cjs:75-103` (corrected in round 2 from the 22 of round 1) and the pack
  manifest has **no file-level exclusion field of any kind**; `packages/mewkit/src/emit/` and `src/kit/` do
  not exist; `init --target` accepts `codex` and `cursor` only and there is no `--delivery` flag, no
  `--offline` flag and no `versions` verb; `mewkit migrate` takes a positional **external** tool
  (`commands/migrate.ts:33` reads `args._[1]`; `cli/command-catalogue.ts:29`) and has no `--target` flag and
  no `claude-code` entry point; install metadata carries no `kitVersion`, `cliVersion`, `target`, `delivery`
  or `origin`; `.claude/meowkit.manifest.json` **does not exist in the repo** — it is written into installed
  projects, and its real reference sites are `core/compute-checksums.ts:26,40`,
  `core/install-metadata.ts:122,132` and `commands/doctor.ts:60` plus six test sites, not the four readers
  the phase names; `commands/init.ts` is **1042** lines, not the 982 the phase records.
- Also at BASE, and missed by round 1's inventory: the tree **already declares `claude-plugin` as a
  provider with status `supported`** across seven source files — `core/provider-projection.ts:46-53`
  (`bootstrapPlacement: "sessionstart-hook-via-plugin-build"`, all four capability levels `supported`) and
  `:79` (`ProjectedProvider`), `core/provider-adapter.ts:133` (`ADAPTED_PROVIDERS`), `core/bootstrap.ts:26`
  (`BootstrapProvider`), `core/provider-lifecycle.ts:92-99,122`, `core/provider-operations.ts:136,173`,
  `core/provider-invocation.ts:137`, `core/repo-context-adapter.ts:39-40`. Round 1 reported a grep for
  `claude-plugin` under `packages/mewkit/src` as empty; that grep was never run as quoted and the claim was
  false. What genuinely does not exist is the **plugin build and its distribution**: no `build-plugin` verb,
  no `plugin/` payload, no `marketplace.json` — while `README.md:52-63` documents a marketplace install flow
  for both runtimes, `vitest.config.ts:34` describes `plugin/**` as that verb's output, and `.gitignore:74`
  references the same sweep. The provider declarations are therefore a **capability contract awaiting a
  build**, not a second plugin implementation (D9).

## Decisions (user standing directive 261108: follow recommended options)

Fourteen points where the phase-04 spec is ambiguous, or is contradicted by the tree. The user's standing
instruction for this plan is to take the recommended option on every one, so D1–D14 are DECIDED, not
proposed. Every AC is written against them. **D1, D2, D4, D6, D8 and D9 are flagged as genuinely risky** —
each either changes a trust boundary, can block every install, or narrows a phase requirement — and each is
marked `[CHALLENGE]` so the evaluator knows where to push.

- **D1 `[CHALLENGE]` Signing is a detached ed25519 signature over the kit manifest, made with `node:crypto`,
  verified against a committed keyring, and an empty keyring REFUSES rather than skips.** The phase leaves
  the choice open ("minisign/ed25519 or Sigstore") and asks for an ADR. DECIDED, with no new npm dependency:
  the signature is a detached ed25519 signature over the manifest bytes, produced and verified by
  `node:crypto` (verified available on the pinned Node >= 24 runtime: sign/verify round-trips a 64-byte
  signature). Trusted public keys live in a **committed keyring file in the CLI source**, so the trust root
  ships with the engine rather than with the content it authenticates. The private key reaches the pipeline
  only as a GitHub Actions secret named `MEOWKIT_KIT_SIGNING_KEY`; both release workflows **fail closed**
  when it is absent — the artifact step errors and no artifact is published — and because both workflows are
  `workflow_dispatch` (stable) or `push: dev` + `workflow_dispatch` (beta), a failing artifact step cannot
  block a merge. A human generates the keypair with a small committed script that writes the private key to a
  path the human chooses and prints the public key; **no agent generates, reads, stores or commits a
  production private key**, and tests use ephemeral keypairs generated at test time. The real public key is
  committed later by the human, so the keyring may ship **empty**: in that state an install that finds a kit
  artifact **refuses** with a named "no trusted kit key" error and never skips verification and never falls
  back. The risk being accepted and the reason it is bounded: an empty keyring plus a published artifact would
  block every install — but CI fails closed, so a release built without the secret carries **no** artifact at
  all and D2's absence-fallback covers it. The only way to reach the refusal is an artifact signed by a key
  the keyring does not list, which is exactly the case that must refuse.
- **D2 `[CHALLENGE]` Dual-publish means "artifact when present, legacy path only when there is no artifact at
  all"; a bad artifact is a hard refusal, never a fallback.** The phase says "publish alongside existing
  assets (dual-publish during beta)" without saying what the CLI does when both exist. DECIDED: when a
  release carries a kit artifact, the CLI uses it. The legacy `*.zip` path of
  `core/github-releases.ts:71` is taken **only** when the release carries no kit artifact whatsoever, which
  is how older releases keep installing. An artifact that is present but fails its digest or its signature is
  a terminal refusal: the install stops, writes nothing, and names the failure. Falling back to the zip there
  would mean a tampered artifact silently downgrades the user to an unverified path, which is the attack the
  artifact exists to stop. Risk accepted and stated: a corrupt or mis-signed publish blocks every install of
  that version until a new release is cut, and `mewkit doctor` must say so in those words.
- **D3 Removing the legacy flat-copy path is OUT of scope.** The phase itself defers it ("Remove legacy
  flat-copy after one beta cycle"). DECIDED: `commands/init.ts` keeps the flat-copy path and shrinks only as
  far as routing through the shared emitter requires. It is **1042** lines at BASE, not the 982 the phase
  records, and AC-13 forbids it growing.
- **D4 `[CHALLENGE]` One cache, and it is the project-local `.meowkit/cache/` that sprint 5 shipped — the
  phase's `~/.meowkit/cache/kits/<ver>/` is rejected.** The phase names a home-directory cache; sprint 5
  shipped `.meowkit/cache/` (`core/kit-cache.ts:30-33`) and made it the **trusted kit source** whose whole
  trust property is that it is untracked and therefore unreachable from a pull request, re-checked per run
  with `git ls-files` (`core/kit-cache-trust.ts:29-38`). DECIDED: there is exactly one cache, project-local,
  and the verified artifact plus its manifest and signature are kept under a per-version subdirectory of it.
  Three reasons: a home cache would be a **second** source of "the kit's own bytes" while `uninstall` and
  `doctor --adopt` already read the project one, and two sources of that answer is the defect sprint 5 closed;
  a home cache is shared by every project on the machine, so one project's install would write the bytes
  another project's deletion decisions are checked against; and kit versions are per-project, so a
  single-version-per-machine cache is the wrong shape. Cost accepted and stated plainly: there is **no
  cross-project download reuse**, so `--offline` works only in a project that has installed at least once.
  The "fresh project, no network" case is already served at BASE by `MEOWKIT_RELEASE_SOURCE`
  (`core/local-release-source.ts:26-33`), and the `--offline` refusal must name it (AC-05, AC-14) rather than
  leave the user guessing.
- **D5 Verify before extract; extraction reuses the existing path-safety helper; nothing from the artifact
  executes during install — and the legacy zip extract gets the same guard.** The phase's Security
  Considerations require all three. DECIDED as written, plus one addition the tree forces: at BASE the legacy
  zip is extracted by `AdmZip.extractAllTo` with no traversal guard
  (`core/github-releases.ts:133-134`), so shipping a tamper-proof artifact path while leaving an unguarded
  extract beside it would be incoherent. The guard built on `migrate/portable-installer-path-safety.ts` is
  applied to **both** extraction paths. Verification order is asserted structurally, not by comment: on a
  verification failure no byte is written outside the cache's own quarantine area (AC-03).
- **D6 `[CHALLENGE]` The legacy manifest is dropped with a one-shot migration, and the phase's reader list is
  wrong in two of four entries.** `.claude/meowkit.manifest.json` does not exist in the repo at BASE — it is
  written into installed projects, so the phase's "647 KB" is an installed-project figure. The phase names
  `core/install-metadata.ts`, `core/release-metadata.ts`, `core/pack-manifest.ts` and `commands/doctor.ts`;
  the middle two **never reference it** (they read `release-manifest.json` at `core/release-metadata.ts:10`
  and `pack-manifest.json` at `core/pack-manifest.ts:9`), and the reader the phase omits is
  `core/compute-checksums.ts:26,40`. DECIDED: the four sites updated are
  `core/compute-checksums.ts`, `core/install-metadata.ts`, `commands/doctor.ts` and the six test sites that
  write or remove the file; nothing writes the file any more and the legacy read branch is removed. The risk
  is real — removing that branch destroys the only ownership baseline a v2 install that never upgraded has,
  and an install with no baseline is one where `uninstall` refuses everything. DECIDED mitigation, the same
  shape sprint 5 used for `config.json`: `upgrade` reads the legacy manifest **one last time** to seed
  `.meowkit/metadata.json`, snapshots first, then removes it; and `doctor` run before that upgrade reports the
  project as migration-pending and names `mewkit upgrade`, never treating a legacy-only project as unowned.
- **D7 The ship-set gets one source of truth, created this sprint, because the phase's premise does not
  exist.** The phase says the source of truth is "pack manifest with file-level exclusion (phase 01)"; the
  pack manifest at BASE has **no exclusion field of any kind** (only skill-artifact-level
  `artifactsExclude`, `core/pack-manifest.ts:18-23`), and the live ship-set is the **17** `zip -x` patterns
  of `scripts/prepare-release-assets.cjs:75-103`. DECIDED: a file-level exclusion field is added to the pack
  manifest's `base` block and **both** the artifact build and the existing zip build read it, so "no second
  list" becomes true rather than assumed. `migrate/discovery/exclusions.ts` is explicitly **not** merged into
  it: that list describes a *user's* tree during discovery, a different question, and collapsing the two would
  couple install discovery to release packaging.
- **D8 `[CHALLENGE]` Three of the phase's exclusions are narrowed, because a reader grep shows they break
  shipped content.** The phase requires each exclusion be verified with a reader grep before removal; the
  greps changed three answers. (a) `.claude/eval/track-m-adapter-core.cjs` is `require`d by
  `.claude/skills/brainstorming/eval/run-scenarios.cjs` and `.claude/skills/prompt-enhancer/eval/run-canaries.cjs`,
  both shipped — DECIDED: `.claude/eval/` and every `.claude/skills/*/eval/` are excluded **together as one
  unit**, since excluding either alone leaves a broken `require`. (b) `.claude/benchmarks/` is read by the
  **user-invocable** `/mk:benchmark` skill (`skills/benchmark/SKILL.md`, `scripts/run-canary.sh`,
  `git-index-audit.sh`, `compare-runs.sh`) and by `.claude/scripts/rules-audit.sh` — DECIDED: only
  `.claude/benchmarks/results/` (run output) is excluded; `canary/` and the README ship, because a skill's
  input corpus is product content, not a maintainer artifact. This **narrows a phase requirement** and is
  stated rather than done quietly. (c) `.claude/.brand-allowlist.txt` is read by two shipped scripts,
  `.claude/scripts/lint-brand-prose.sh` and `.claude/scripts/check-anthropic-context.py` — DECIDED: all three
  are excluded as one unit; excluding the data alone would ship two scripts that fail on a missing file.
  `settings.json.bak` has no reader (only `migrate/discovery/exclusions.ts`, which already excludes it) and
  the `__tests__`/`tests/`/`*.test.*` set is run from the **repo** in CI (`ci.yml:43,55,58,61,107,117-119,258`;
  vitest deliberately skips `.claude/**/*.test.cjs` at `vitest.config.ts:47`), so excluding them from the
  **artifact** removes nothing CI needs — and AC-09 asserts the repo still has them.
- **D9 `[CHALLENGE]` `--delivery` is a real two-valued flag through the emitter; the existing `claude-plugin`
  provider declarations are its single source of truth; every status claim the sprint does not make true is
  corrected in the same change.** Round 1 asserted that nothing plugin-shaped existed; that was wrong, and the
  correction changes the decision rather than just a citation. At BASE the tree already declares
  `claude-plugin` with status `supported` and all four capability levels `supported`
  (`core/provider-projection.ts:46-53,79`, `core/provider-adapter.ts:133`, `core/bootstrap.ts:26`,
  `core/provider-lifecycle.ts:92-99,122`, `core/provider-operations.ts:136,173`,
  `core/provider-invocation.ts:137`, `core/repo-context-adapter.ts:39-40`), while the build those declarations
  presuppose — a `build-plugin` verb, a `plugin/` payload, a `marketplace.json` — does not exist.
  DECIDED, per the orchestrator's rulings of 261109:
  (i) **One plugin shape.** `--delivery plugin` **consumes** those declarations as the single source of truth
  for the plugin provider shape — capability levels, bootstrap placement, lifecycle, operation shapes and
  invocation surface — and defines **no second** plugin-shape definition anywhere. A parallel definition would
  be the "no second list" defect D7 exists to prevent, one layer up. The declarations stay the contract; this
  sprint supplies the build that makes them true. What they do **not** define is the on-disk manifest file
  format, so that one artefact — the manifest's path and required field set — is still retrieved through
  `mk:docs-finder` from current Claude Code documentation and never from training data; if it cannot be
  retrieved the generator STOPS and asks rather than inventing it.
  (ii) **Status claims must be true at sprint end.** Because the sprint delivers the plugin build, the
  `claude-plugin` `supported` status and `bootstrapPlacement: "sessionstart-hook-via-plugin-build"` **stand**,
  and `README.md:63`, `vitest.config.ts:34` and `.gitignore:74` are reconciled to name the **real** verb
  (`init --target claude-code --delivery plugin`) rather than the `build-plugin` verb that will still not
  exist. Every neighbouring declaration the sprint does **not** make true is corrected in the same change,
  not left standing: `README.md:52-63`'s marketplace install flow for both runtimes and its `marketplace.json`
  and "staged into each release" claims (marketplace publication stays out of scope), and
  `packages/docs/content/docs/reference/skills/visual-plan.mdx:131`'s "there is no plugin/marketplace build
  step", which is true at BASE and false at sprint end for the plugin half and still true for the marketplace
  half — so it is split rather than deleted. `doctor` **refuses** a mixed native+plugin install rather than
  repairing it, per the phase's Risk Assessment. Still out of scope: a `build-plugin` verb, marketplace
  publication, release staging of a plugin payload. This remains the largest unknown in the sprint and the
  most likely amendment.
- **D10 `mewkit versions` is a new verb, not an alias.** `status` already prints a "version and config
  summary" (`cli/command-catalogue.ts:19`) and `upgrade --list` lists available versions (`:153`). DECIDED:
  the phase's `mewkit versions` is added as its own verb reporting *installed* CLI / kit / target versions;
  `status` is unchanged and gains no alias (sprint 5 D14 forbids aliases). `cli/command-catalogue.ts` and the
  committed `scripts/check-kit-verbs.cjs` check must agree, so the verb cannot ship undeclared.
- **D11 Provenance is an added object, not a rename.** The phase asks for
  `{kitVersion, cliVersion, target, scope, delivery, origin}`; `InstallMetadataSchema`
  (`core/install-metadata.ts:28-42`) already has `version` and `scope` and every reader uses them. DECIDED:
  `version` and `scope` stay exactly where they are — `version` *is* the kit version and renaming it would
  break every reader for no gain — and a provenance object is added carrying `kitVersion`, `cliVersion`,
  `target`, `delivery` and `origin`, with `origin` a closed enum over the four ways content can arrive:
  verified artifact, legacy release zip, local release directory, local cache. An open-string `origin` would
  make the field unassertable.
- **D12 `--offline` re-verifies the cached artifact rather than trusting it.** DECIDED: `--offline` is a new
  flag on `init` and `upgrade` that resolves the artifact from the project cache only, and runs the **same**
  digest and signature verification it would run on a download, because a cached file is a local file and is
  not trusted more for being local. When the cache holds no artifact for the requested version, `--offline`
  refuses with a named error pointing at `MEOWKIT_RELEASE_SOURCE` and `mewkit upgrade` (D4) and never reaches
  the network to "help".
- **D13 The docs universe is the twelve pages that name the install, and every one of them is accounted for.**
  Round 1 listed eight pages plus two deliberately-excluded changelog pages; at BASE
  `grep -rl "npx mewkit init" packages/docs/content/docs` returns **twelve** files, so two were unaccounted
  for. DECIDED, with all twelve classified so "every command shown runnable as written" is a property of the
  docs tree and not of a subset:
  **Updated (nine)** — `installation.mdx`, `quick-start.mdx`, `migration.mdx`, `cli/index.mdx`,
  `cli/commands.mdx`, `cli/project-setup.mdx`, `reference/configuration.mdx`, `workflows/new-project.mdx`,
  and **`reference/skills/visual-plan.mdx`**, which is brought IN because `:131` asserts "there is no
  plugin/marketplace build step" — a truth claim this sprint falsifies for the plugin half (D9(ii)).
  **Deliberately not updated (three), each with its reason** — `reference/skills/bootstrap.mdx` names
  `npx mewkit init` three times (`:19`, `:38`, `:255`) only to draw a boundary between the CLI and the
  bootstrap skill; nothing it says about the install changes, and it is still covered by AC-12's parse-only
  command probe. `changelog/index.mdx` and `changelog/archive.mdx` record what past releases did and are
  immutable.
- **D14 One sprint, 14 ACs, and no file crosses 200 lines because of it.** The sprint is wide but single-seam:
  the artifact, its verification and the emitter all meet in one install path, and splitting at the
  artifact/emitter seam would leave the emitter half's ACs depending on unsigned work. 14 leaves one slot
  under the evaluator's 15-criterion ceiling for an amendment, which D9 makes likely.

## Definitions

- **Kit artifact:** the single release asset carrying the kit content for one version, published as a GitHub
  release asset only (`plan.md` Decision 4). Distinct from the legacy `*.zip` asset, which stays published
  during the beta cycle.
- **Kit manifest:** the signed document naming the artifact's version, its own digest, and a sha256 for every
  file inside the artifact. The signature covers the manifest bytes; the manifest covers the artifact; so one
  signature check plus one digest check authenticates every file.
- **Keyring:** the committed list of trusted public keys in the CLI source. The trust root ships with the
  engine, never with the content it authenticates. It may legitimately be **empty** (D1).
- **Hard refusal:** the install stops, **writes nothing outside quarantine**, exits non-zero, names the
  failing check and the next action, and does **not** fall back to another source. Amended in round 2: round 1
  said "writes nothing", which contradicted AC-04's requirement that `doctor` be able to explain *which*
  version is unusable without re-fetching. A refusal therefore writes exactly one thing, and only inside
  quarantine — the **verification-failure record** below.
- **Verification-failure record:** the single file a hard refusal may write, inside quarantine. It carries the
  version the attempt was for, which check failed (signature absent / malformed / untrusted key, artifact
  digest, manifest digest, per-file digest, unsafe member path), the subject file where the check is per-file,
  and when the attempt happened. It carries no artifact bytes and no key material, it is **not** installable
  content, and `--offline` never installs from a quarantine that holds one — it reports it. This is what lets
  `doctor` say "this version failed verification" with no network and no second fetch.
- **Quarantine:** the location a downloaded artifact occupies while unverified. Nothing outside it is written
  until verification passes, which is what makes "verify before extract" assertable rather than asserted. It
  lives inside the one cache of D4, so it is untracked and is never installed from unverified.
- **Emitter path:** the single projection from kit content to a target's on-disk shape. One projection, three
  entry points (`init`, `upgrade`, `migrate`) — the phase's Key Insight 3.
- **Target / delivery:** target is `claude-code` | `codex` | `cursor`; delivery is `native` | `plugin` and is
  meaningful for `claude-code` only (D9).
- **Ship set:** the files the artifact contains, derived from the one exclusion source of D7.
- **Origin:** how the installed content arrived — verified artifact, legacy release zip, local release
  directory, or local cache. A closed enum (D11).
- **Reader grep:** the evidence required before a path is excluded from the ship set — a search for every
  reference to it across the shipped kit, recording whether the referrer ships (D8).

## Scope (In)

- An artifact build step producing the kit artifact plus its manifest (per-file sha256 + artifact digest)
  plus a detached ed25519 signature, wired into both release workflows and failing closed without the
  signing secret (D1)
- A committed keyring in the CLI source, and a committed human-run keypair-generation script that writes the
  private key to a caller-chosen path and prints only the public key (D1)
- Artifact fetch / verify / cache / extract on the CLI side, with verification strictly before extraction and
  extraction guarded by the existing path-safety helper, applied to the legacy zip extract too (D5)
- A tamper test corpus: bit flip in the artifact, bit flip in the manifest, signature by an untrusted key,
  truncated artifact, truncated manifest, absent signature, path-traversal entry inside the artifact,
  per-file digest mismatch for one inner file
- The one project-local cache of D4 extended with per-version artifact storage, and `--offline` on `init` and
  `upgrade` re-verifying what it finds there (D12)
- The verification-failure record written inside quarantine on a hard refusal, and the `doctor` reading of it
  (D-definitions, AC-04)
- `init --target claude-code|codex|cursor [--delivery native|plugin]`, routed through one shared emitter path
  that `upgrade` also uses for every target and that `migrate` also uses for the two external targets it can
  address; the existing `--profile` / `--skill-packs` selection keeps working
- The plugin delivery layout, built from the existing `claude-plugin` provider declarations as its single
  source of truth, and `doctor`'s refusal of a mixed native+plugin install (D9)
- Reconciling every plugin-related status claim the sprint touches: `README.md:52-63`,
  `vitest.config.ts:34`, `.gitignore:74` and
  `packages/docs/content/docs/reference/skills/visual-plan.mdx:131` (D9(ii))
- A file-level exclusion field on the pack manifest's `base` block, read by both the artifact build and the
  existing zip build (D7); the ship-set exclusions of the phase as narrowed by the reader greps of D8
- Provenance in install metadata and the new `mewkit versions` verb (D10, D11)
- Retirement of `.claude/meowkit.manifest.json`: no writer, the three real reference sites plus six test
  sites updated, a one-shot `upgrade` migration that seeds `.meowkit/metadata.json` from it, and a `doctor`
  migration-pending finding (D6)
- The nine updated docs-site pages of D13, with the other three of the twelve classified and recorded
- Regenerated codex and cursor projections; `mewkit validate --packs`, `validate --target codex|cursor` and
  `scripts/check-kit-verbs.cjs` green

## Scope (Out)

- Removing the legacy flat-copy path from `commands/init.ts` — the phase defers it by one beta cycle (D3)
- Unpublishing the legacy `*.zip` asset, or any change that makes an older release stop installing (D2)
- A home-directory kit cache at any path, and any second cache of kit bytes (D4)
- Skipping or soft-failing signature verification for any reason, including an empty keyring, a
  prerelease channel, a `--force` flag, or an env var. There is no bypass surface, so none is implemented (D1)
- Falling back to the legacy zip when an artifact is present but fails a check (D2)
- Any agent-generated, agent-read or committed private key; any production key material in the repo, in a
  test fixture, or in a log line (D1)
- Sigstore, minisign, or any new npm dependency for signing or verification (D1)
- A `mewkit build-plugin` verb, a `plugin/` payload committed or staged into a release, and plugin
  marketplace publication (D9)
- A second definition of the plugin shape anywhere. `--delivery plugin` reads the existing `claude-plugin`
  provider declarations; it does not restate, fork or shadow them (D9(i))
- Changing what the `claude-plugin` declarations *claim* — their capability levels and bootstrap placement are
  consumed as given; the sprint makes them true rather than editing them down (D9(ii))
- A `--delivery` value for `codex` or `cursor`; those targets have one delivery shape each (D9)
- A `migrate claude-code` entry point. `mewkit migrate` exists to export to **external** tools and takes a
  positional tool (`commands/migrate.ts:33`, `cli/command-catalogue.ts:29`); adding a `claude-code` value
  would be a new verb surface, which is phase 06's business (AC-06)
- Installing from, or trusting, a quarantine that holds a verification-failure record
- Merging `migrate/discovery/exclusions.ts` into the ship-set source (D7)
- Excluding `.claude/benchmarks/canary/` or the benchmark README, excluding `.claude/eval/` without the
  per-skill `eval/` dirs, or excluding `.brand-allowlist.txt` without both scripts that read it (D8)
- Removing any test, eval or benchmark file from the **repo**; the exclusions are from the artifact only (D8)
- Renaming `version` or moving `scope` in install metadata (D11)
- A `mewkit status` alias, a `mewkit audit` alias, or any other alias (D10, sprint 5 D14)
- Updating `packages/docs/content/docs/changelog/*` (D13)
- Reaching the network on any path other than `init` and `upgrade`, and reaching it at all under `--offline`
- Phase 07's `.claude/` top-level entry reduction (25 entries at BASE), and phase 06's CLI surface cut
- Deleting or rewriting `.meowkit/memory/`, `telemetry/`, `state/`, `cache/`, `envs/`, `backups/` or `.env`
  from any command path (sprint 5 D12 still binds)

## Acceptance Criteria

### [AC-01] The release builds one artifact plus a manifest with a sha256 for every file, from one ship-set source

**Given** a clean checkout at the finished tree and the artifact build step invoked for a known version
**When** the artifact, its manifest, and the ship set the manifest describes are read
**Then** exactly one kit artifact and one manifest are produced; the manifest names the version, carries the
artifact's own sha256, and carries one entry per file inside the artifact with that file's sha256 — the entry
count equals the file count inside the artifact exactly, with no entry for a file that is absent and no file
without an entry; recomputing every digest from the artifact reproduces the manifest byte-for-byte, so the
manifest is derived rather than hand-maintained; the ship set is derived from the **single** exclusion source
of D7 — which replaces the **17** `zip -x` patterns at `scripts/prepare-release-assets.cjs:75-103`, not the 22
round 1 miscounted — and the existing zip build reads the same field, proven by a test that adds one exclusion
to that field and observes both outputs change, so no second list exists; the build is **reproducible against
the four named sources of non-determinism** — archive member order, member mtimes, member uid/gid/mode, and
the gzip header timestamp — each pinned rather than left to the filesystem, so two builds of the same commit
from **separate checkouts in separate temp roots with a clock gap between them** yield identical artifact and
manifest digests; a back-to-back build in one process is explicitly **not** sufficient evidence, because it
passes trivially; and both release workflows carry the artifact step, each still triggered only by
`workflow_dispatch` (stable) or `push: dev` plus `workflow_dispatch` (beta), so no merge path is affected

- **Verification:** build from two separate checkouts in two temp roots with a clock gap and compare manifest
  + artifact digests; additionally assert each of the four non-determinism sources is pinned by perturbing it
  (touch member mtimes, change file mode, reverse the input walk order, build in a different second) and
  requiring the digest to stay equal; count artifact members against manifest entries both ways; recompute
  every per-file sha256 and diff against the manifest; assert the exclusion source holds the 17 BASE patterns
  with none lost; add one exclusion to it and assert the artifact and the zip both drop the file; read both
  workflow files and assert the artifact step and the unchanged trigger blocks
- **Rubric tie-in:** functionality (weight 0.40)

### [AC-02] The manifest is signed with an ed25519 key the pipeline cannot run without, and an empty keyring refuses rather than skips

**Given** the committed keyring, the committed keypair-generation script, the build script the workflows
invoke, both workflow files as text, and a test harness holding an ephemeral keypair generated at test time
**When** the signature is produced and verified; the **build script** is run with the signing secret absent;
the workflow files are read; the generation script is run; and an install is attempted against an artifact
while the keyring is empty
**Then** the signature is a detached ed25519 signature over the manifest bytes, produced and verified using
only the platform crypto already available — `git diff BASE` adds **no** dependency to any `package.json`
and no vendored crypto implementation; verification succeeds for a key in the keyring and fails for a
correctly-formed signature from a key that is not; and fail-closed is proven at **both** layers, because
round 1 asserted it only at a layer no test can invoke — (a) **runnable layer:** with
`MEOWKIT_KIT_SIGNING_KEY` unset the build script the workflow invokes exits non-zero and leaves **zero**
artifact and manifest files behind, publishing neither an unsigned artifact nor a partial one, and not warning
and continuing; (b) **static layer:** the artifact step in each workflow file carries no `continue-on-error`,
no `|| true`, no `if: always()`, no `if: failure()` and no `set +e`, and is not inside a composite that
supplies one, so a non-zero exit from (a) actually fails the job; the generation script writes the private key
only to the path its caller names and prints only the public key, and no test fixture, log line, snapshot or
committed file in the sprint diff contains private key material (asserted by scanning the whole diff for
private-key encodings, not by inspection); and with an **empty** keyring an install that finds an artifact is
a hard refusal naming the missing trusted key, with verification neither skipped nor deferred, while a release
carrying no artifact at all still installs through AC-04's fallback

- **Verification:** sign and verify with an ephemeral keypair; verify a signature from a second ephemeral key
  absent from the keyring and assert failure; run the **build script** with `MEOWKIT_KIT_SIGNING_KEY` unset
  and assert non-zero exit plus an empty output directory; parse both workflow files and assert the artifact
  step carries none of the five continue-on-failure forms; run the generation script into a temp path and
  assert the private key is only there; scan `git diff BASE` for private-key encodings and for `package.json`
  dependency additions; empty the keyring in a fixture and assert the refusal text and exit code
- **Rubric tie-in:** functionality (weight 0.40)

### [AC-03] Every tamper shape is refused before anything is extracted, and nothing from the artifact executes

**Given** a valid artifact plus manifest plus signature, and **ten** tampered variants, enumerated so the
probe count is unambiguous (round 1 said "eight" while listing ten): (1) a flipped bit in the artifact, (2) a
flipped bit in the manifest, (3) a signature made by a key absent from the keyring, (4) a truncated artifact,
(5) a truncated manifest, (6) a missing signature, (7) a member whose path escapes the destination via `..`,
(8) a member with an absolute path, (9) a symlink member pointing outside the destination, (10) an inner file
that no longer matches its per-file digest
**When** an install is attempted against each variant
**Then** all **ten** are hard refusals — ten refusal assertions, which is the number AC-14 also uses: non-zero
exit, a message naming which check failed and on which file, and **no file written outside quarantine**,
asserted by snapshotting the destination tree before and after each attempt and requiring byte equality, which
is what makes "verify before extract" a property rather than a claim; the only write any of the ten may make
is the single verification-failure record inside quarantine, and the quarantine content after a refusal is
asserted to be exactly that record plus the unverified bytes — never an extracted tree; variants (7), (8) and
(9) are refused by the existing path-safety helper rather than a second implementation, and the same guard is
proven active on the legacy zip extraction path, which has none at BASE
(`core/github-releases.ts:133-134`); no refusal falls back to another source (D2); and no code from the
artifact is executed during install at all — no member is spawned, required, imported or evaluated, asserted
on the install code path rather than by reading the artifact

- **Verification:** run the install against each of the ten variants, asserting exit code, message, a
  before/after tree hash of the destination, and the exact quarantine content after the refusal; assert the
  path-safety helper is the one rejecting variants (7)–(9); extract a crafted traversal zip through the legacy
  path and assert refusal; assert the install path contains no execution of an artifact member (static check
  over the extract/apply code plus a canary executable member that must never run)
- **Rubric tie-in:** functionality (weight 0.40)

### [AC-04] Artifact when present, legacy path only when there is none, refusal when it is present and bad

**Given** three release fixtures — one carrying artifact + manifest + signature, one carrying only the legacy
zip (an older release), and one carrying an artifact whose signature is invalid
**When** `init` and `upgrade` run against each
**Then** the first installs from the artifact and records the artifact origin; the second installs through the
existing zip path unchanged and records the zip origin, so an older release keeps working; the third is a hard
refusal that does **not** install from the zip even though the zip is present and valid, with a message saying
the artifact failed verification and that the install was stopped rather than downgraded; and `mewkit doctor`
on a project blocked by the third case explains that **this version** cannot be installed until a new release
is published, rather than reporting a generic network or asset error — which it can do with **no network and
no second fetch** because the refusal left the verification-failure record inside quarantine, naming the
version and the failed check, and `doctor` reads that record and nothing else. Round 1 made this leg
unsatisfiable by defining a refusal as writing nothing at all; the amended definition permits exactly this one
in-quarantine write and forbids everything else, so the three constraints — "writes nothing outside
quarantine", "no network outside `init`/`upgrade`", and "`doctor` names the version" — now hold together.
The record is not installable content: a subsequent `--offline` run in that project **reports** the recorded
failure and refuses rather than installing from the quarantined bytes

- **Verification:** build the three fixtures, run `init` and `upgrade` against each, and assert installed
  content, recorded origin, exit code and message per case; assert the third case wrote nothing outside
  quarantine and that quarantine holds the record with the right version and failed check; run `doctor` in the
  third case with the network blocked and assert the explanation names the version and performs no request;
  run `--offline` in that project and assert it reports the failure rather than installing
- **Rubric tie-in:** functionality (weight 0.40)

### [AC-05] There is exactly one cache, it is the project-local untracked one, and `--offline` re-verifies what it holds

**Given** a project that has installed once (so the cache is populated) and a fresh project that has not
**When** `init --offline` and `upgrade --offline` run in each, with the network unreachable, and the tree is
searched for any other cache location
**Then** the populated project installs with no network access at all, and the artifact it takes from the
cache is put through the **same** digest and signature verification a download gets — proven by corrupting
the cached artifact and observing the same refusal as AC-03, so a local file is not trusted for being local;
the cache lives under the project-local `.meowkit/cache/` that sprint 5 shipped, keyed by version, and
`git check-ignore` plus `git ls-files` confirm nothing under it is tracked, preserving the trust property
`uninstall` and `doctor --adopt` already depend on; **no** code path reads or writes a kit cache under
`$HOME`, asserted by searching the sprint diff for a home-relative cache path rather than by inspection; and
the fresh project's `--offline` run **refuses** with a named error that states the cache is empty for this
version and names both `MEOWKIT_RELEASE_SOURCE` and `mewkit upgrade` as the two ways forward, without
touching the network

- **Verification:** install once, then re-install `--offline` with network blocked; corrupt the cached
  artifact and assert the AC-03 refusal; `git check-ignore -v` and `git ls-files` over the cache; grep the
  sprint diff for home-directory cache paths; run `--offline` in a fresh project with network blocked and
  assert the message, the two named next actions, and that no request was attempted
- **Rubric tie-in:** functionality (weight 0.40)

### [AC-06] One emitter path serves three entry points and three targets

**Given** a fresh project for each of `--target claude-code`, `--target codex` and `--target cursor`, and the
entry points that **actually exist per target** — `init` and `upgrade` for all three, plus `migrate` for
`codex` and `cursor` only, because `mewkit migrate` takes a positional **external** tool
(`commands/migrate.ts:33` reads `args._[1]`; `cli/command-catalogue.ts:29` — "Export MeowKit to external
coding-agent tools") and has no `--target` flag and no `claude-code` value
**When** each existing combination is run — **eight** in total: `init` and `upgrade` for each of the three
targets, plus `migrate codex` and `migrate cursor`
**Then** each target's on-disk shape is produced by **one** projection, reached from every entry point that
can address that target — two for `claude-code`, three for `codex` and `cursor` — asserted by instrumenting
the single projection and requiring each command to go through it, not by comparing outputs that could
coincide. Round 1's "nine combinations" and "all three entry points" named three invocations that cannot be
made; the claim is restated as the entry points that exist rather than by inventing a `migrate claude-code`,
which Scope (Out) now forbids as a phase-06 surface change. `init --target claude-code` then `upgrade` is
byte-identical to a fresh `init --target claude-code` at the same version for every kit-owned file, so upgrade
and install cannot drift; the codex and cursor outputs remain equal to the committed projections
(`mewkit validate --target codex|cursor` green); an unknown `--target` value is refused by name with the three
valid values listed, `migrate claude-code` is refused by name as not an external tool rather than silently
treated as unknown, and `--delivery` passed with `codex` or `cursor` is refused as meaningless for that target
rather than silently ignored; and the existing `--profile` / `--skill-packs` narrowing still applies on every
path, with `mewkit validate --packs` green

- **Verification:** run the eight invocable combinations; instrument the projection and assert every one
  reaches it; diff `init`-then-`upgrade` against fresh `init`; `mewkit validate --target codex`,
  `--target cursor`, `--packs`; run an unknown target, `migrate claude-code`, and a `--delivery codex`
  combination and assert all three refusals
- **Rubric tie-in:** functionality (weight 0.40)

### [AC-07] Plugin delivery is built from the existing provider declarations, mixed installs are refused, and every status claim is true at sprint end

**Given** a fresh project; the seven source files that already declare `claude-plugin` as a `supported`
provider (`core/provider-projection.ts:46-53,79`, `core/provider-adapter.ts:133`, `core/bootstrap.ts:26`,
`core/provider-lifecycle.ts:92-99,122`, `core/provider-operations.ts:136,173`,
`core/provider-invocation.ts:137`, `core/repo-context-adapter.ts:39-40`); the on-disk plugin manifest field
set as retrieved from current official documentation via the docs-retrieval path, never from model recall; and
a project that already has a native install
**When** `init --target claude-code --delivery plugin` runs; then `doctor` runs on a project carrying both a
native and a plugin install; and `README.md`, `vitest.config.ts`, `.gitignore` and
`packages/docs/content/docs/reference/skills/visual-plan.mdx` are read
**Then** the plugin run emits the documented layout — the manifest at the documented path with the documented
required fields populated, and every component kind the kit ships discoverable from it — produced by the same
emitter as `--delivery native` rather than a parallel writer, and `--delivery native` output is unchanged from
AC-06; the plugin **shape** is taken from those seven declarations as the **single source of truth** and the
sprint diff introduces **no second definition** of the provider's capability levels, bootstrap placement,
lifecycle, operation shapes or invocation surface — asserted by requiring the emitter to read them rather than
restate them, and by asserting the diff adds no second `claude-plugin` capability table; the one thing the
declarations do not define, the manifest's on-disk field set, comes from the recorded documentation retrieval
and from nowhere else; `doctor` on the mixed project **refuses** with a message naming both installs and one
concrete way to resolve it, and does not attempt a repair; and **every status claim about the plugin is true
at sprint end**, which round 1 got backwards by treating the `supported` declaration as stale: because this
sprint delivers the plugin build, `claude-plugin`'s `status: "supported"` and
`bootstrapPlacement: "sessionstart-hook-via-plugin-build"` **stand unchanged and are exercised by the install
above**, while the references that name a verb which will still not exist are reconciled to the real one
(`init --target claude-code --delivery plugin`) — `README.md:63`, `vitest.config.ts:34`, `.gitignore:74` — and
every neighbouring claim the sprint does **not** make true is corrected in the same change rather than left
standing: `README.md:52-63`'s marketplace install flow for both runtimes, its `marketplace.json` and its
"staged into each release" claim, and `visual-plan.mdx:131`'s "there is no plugin/marketplace build step",
which becomes false for the plugin half and stays true for the marketplace half and is therefore split rather
than deleted; `scripts/check-kit-verbs.cjs` stays green

- **Verification:** run the plugin install and validate the emitted manifest against the field set recorded
  from official documentation in the evidence file (with the retrieval recorded, so the schema is auditable);
  assert both deliveries come from one emitter and that the emitter reads the seven declarations rather than
  restating them; grep the sprint diff for any second `claude-plugin` capability/lifecycle/operations table;
  run `mewkit providers claude-plugin --lifecycle` before and after and
  assert the declared levels are unchanged; build a mixed-install fixture and assert the `doctor` refusal text
  and exit code; grep `README.md`, `vitest.config.ts`, `.gitignore` and `visual-plan.mdx` for the
  `build-plugin` verb, for `marketplace.json`, for the marketplace install commands, and for the
  "no plugin/marketplace build step" sentence, asserting each is either true at sprint end or corrected; run
  `check-kit-verbs.cjs`
- **Rubric tie-in:** product-depth (weight 0.25)

### [AC-08] Provenance is recorded for every install shape, and `mewkit versions` reports it

**Given** installs produced by each of the four origins — verified artifact, legacy release zip, local
release directory, local cache — across the three targets and both deliveries
**When** the install metadata is read and `mewkit versions` is run in each project
**Then** every install records kit version, CLI version, target, delivery and origin, with origin drawn from
a **closed** set of exactly those four values so an unexpected value is a validation error rather than a free
string; the pre-existing `version` and `scope` fields are unchanged in name, position and meaning, and every
BASE reader of them still works (asserted by the existing suite passing, not by inspection); a project
installed before this sprint reads back without provenance and without error, reported as unknown rather than
crashing or inventing a value; `mewkit versions` prints the installed CLI version, the installed kit version
and the target and delivery, exits zero in an installed project, and exits non-zero with a message naming
`mewkit init` in a project with no install; and the verb is declared in the CLI catalogue so help lists it and
`scripts/check-kit-verbs.cjs` resolves it

- **Verification:** produce one install per origin and run `mewkit versions` in each, asserting every field;
  hand-write an out-of-enum origin and assert the validation error; read a pre-sprint metadata fixture;
  run `versions` in an uninstalled directory; `mewkit --help` and `check-kit-verbs.cjs`
- **Rubric tie-in:** product-depth (weight 0.25)

### [AC-09] Every ship-set exclusion is justified by a reader grep, and the three unsafe ones are narrowed by name

**Given** the finished artifact and a committed reader-grep record for every excluded path
**When** the artifact's member list is compared against the exclusion source and against the repo
**Then** the artifact contains none of `settings.json.bak`, the brand-lint unit (the allowlist **and** both
shipped scripts that read it), `benchmarks/results/`, the eval unit (`.claude/eval/` **and** every
`.claude/skills/*/eval/`), any `__tests__` or `tests/` directory, or any `*.test.*` file — each one carrying a
committed reader grep showing what referenced it and whether the referrer ships; `workflow.yaml` **is**
present, because nine shipped files read it; the three narrowings of D8 are asserted by name —
`.claude/benchmarks/canary/` and the benchmark README **are** present because the user-invocable benchmark
skill reads them, `.claude/eval/track-m-adapter-core.cjs` is excluded only together with the two shipped
skill eval scripts that `require` it, and `.brand-allowlist.txt` only together with both scripts that read
it; **no** excluded file is removed from the **repo** — the full CI suite including the node-run `.claude`
tests still passes on the finished tree; and installing the artifact into a fresh project yields a tree where
no shipped file references an excluded path, proven by resolving every reference the shipped kit makes to an
excluded name and finding zero live ones

- **Verification:** list artifact members and assert each excluded pattern has zero matches and `workflow.yaml`
  one; read the committed reader-grep record and re-run each grep; `git ls-files` for every excluded path to
  prove it is still in the repo; run the full CI suite; install the artifact and grep the installed tree for
  references to excluded names
- **Rubric tie-in:** product-depth (weight 0.25)

### [AC-10] The legacy per-file manifest is gone, its real readers are updated, and no install loses its baseline

**Given** the finished tree, a scratch project in the v2 shape whose only ownership baseline is a legacy
`.claude/meowkit.manifest.json`, and that project's copy before and after `upgrade`
**When** `init` and `upgrade` run on fresh projects, `doctor` runs on the legacy project before any upgrade,
and `upgrade` then runs on it
**Then** no command writes `.claude/meowkit.manifest.json` any more and no shipped file reads it — asserted
across the whole tree, with the three real reference sites (`core/compute-checksums.ts`,
`core/install-metadata.ts`, `commands/doctor.ts`) and the six test sites updated, and with the phase's two
mistaken readers (`core/release-metadata.ts`, `core/pack-manifest.ts`) correctly left alone because they
never referenced it; `.meowkit/metadata.json` is the only ownership record; `doctor` on the legacy project
reports it as migration-pending and names `mewkit upgrade` as the next action rather than reporting the
project as unowned or healthy; `upgrade` on it snapshots first, seeds `.meowkit/metadata.json` from the legacy
manifest so every previously-owned path keeps its owner and checksum, reports by name anything it could not
carry, and only then removes the legacy file; and after that migration `uninstall --dry-run` classifies the
same files the legacy baseline described, so no install loses its baseline in the transition

- **Verification:** grep the finished tree for the legacy filename; `init` + `upgrade` in scratch projects
  and assert the file is never created; build the legacy fixture, run `doctor` and assert the
  migration-pending finding and its named action; run `upgrade` and diff the seeded metadata against the
  legacy manifest entry by entry; confirm the snapshot holds the original; run `uninstall --dry-run` before
  and after and compare the classification
- **Rubric tie-in:** functionality (weight 0.40)

### [AC-11] Projections, validators and the committed checks are all green on the finished tree

**Given** the finished tree
**When** the committed validators and checks are run
**Then** `mewkit validate --packs`, `mewkit validate --target codex`, `mewkit validate --target cursor`,
`scripts/check-kit-verbs.cjs`, `scripts/check-env-reads.cjs` and `mewkit doctor` hard gates all pass; the
codex and cursor projections under the migrate modules are regenerated and regenerating them again is a
no-op (`git diff --exit-code`), so a projection cannot silently lag the kit; any new environment name
introduced this sprint — the signing secret included — is classified in the committed env classification the
previous sprint established, so the env-read check cannot be satisfied by a name nothing accounts for; and the
full test suite passes with no skipped or relaxed assertion introduced by this sprint, asserted by diffing the
set of skipped tests against BASE

- **Verification:** run each named command and assert exit 0; regenerate projections and `git diff
  --exit-code`; diff the env classification against the names the sprint adds; diff the skipped-test set
  against BASE
- **Rubric tie-in:** functionality (weight 0.40)

### [AC-12] The install documentation describes what the CLI now does, and nothing else

**Given** **all twelve** docs-site pages that name the install at BASE — the nine D13 updates, plus
`reference/skills/bootstrap.mdx` and the two changelog pages, deliberately not updated — so the claim covers
the docs tree rather than a subset (round 1 accounted for only ten of the twelve)
**When** every `mewkit` command and flag appearing in any of the twelve is extracted and **resolved against
`cli/command-catalogue.ts`** — resolution, not execution, because running install commands lifted from
documentation would perform real installs and real network fetches
**Then** every extracted verb resolves to a declared command and every extracted flag resolves to a flag
declared for that command, with no flag that does not exist and none spelled differently from the catalogue —
and a deliberately planted bad flag in a scratch copy makes the check fail, so it has teeth; each of the nine
updated pages states the verified-artifact install, the target and delivery options, the offline install and
its project-local-cache precondition, and `mewkit versions`; the artifact's verification is described as
unconditional, with no documented bypass, because none exists; the plugin delivery page states exactly what
this sprint ships and does not promise marketplace publication or a `build-plugin` verb; the three
not-updated pages are asserted **unchanged by diff** with their recorded reason — `bootstrap.mdx` names the
install only to draw a CLI-versus-skill boundary (`:19`, `:38`, `:255`) and the two changelog pages record
what past releases did; and no page documents the home-directory cache path the phase proposed and D4 rejected

- **Verification:** extract every `mewkit` command and flag from all twelve pages and resolve each against
  `cli/command-catalogue.ts`, asserting zero unresolved verbs and zero unresolved flags, and asserting the
  resolver fails on a planted bad flag; **execute nothing**; grep the docs tree for a documented bypass, for
  `build-plugin`, for `marketplace.json`, and for a home-directory cache path;
  `git diff BASE -- packages/docs/content/docs/changelog packages/docs/content/docs/reference/skills/bootstrap.mdx`
  is empty
- **Rubric tie-in:** product-depth (weight 0.25)

### [AC-13] Code quality over the sprint diff

**Given** `git diff BASE` at the end of the sprint
**When** every new or changed `.ts`, `.cjs`, `.js`, `.mjs`, `.sh`, `.py`, `.yml` and `.json` file is measured
(generated projections under the migrate modules, and generated manifest or schema output, exempt from the
line rule)
**Then** no new file exceeds 200 lines; no changed file crosses 200 lines because of this sprint; every file
already over 200 at BASE that grew is listed by name with its BASE and final count in the evidence, and
`commands/init.ts` — **1042** lines at BASE, not the 982 the phase records — does not grow; no changed
TypeScript adds an `any` or an unsafe cast; no new TODO or FIXME, no commented-out code, no unused import, no
hardcoded secret and no key material; no code comment, test name or file name introduced by this sprint
references a plan artifact (phase number, sprint number, criterion identifier or decision number) — the reason
for a piece of code is stated as the invariant it protects, not as where it was decided; and `pnpm lint` and
`pnpm typecheck` report 0 errors

- **Verification:** `git diff --stat BASE`; `wc -l` on new and changed files; grep added lines for `any`,
  casts, TODO/FIXME, key encodings; grep the diff's comments, test names and new file names for plan-artifact
  tokens; lint and typecheck output
- **Rubric tie-in:** code-quality (weight 0.15)

### [AC-14] Every refusal names the check that failed, what it was checking, and the next action

**Given** each refusal this sprint introduces — the **ten** tamper refusals of AC-03 (the same ten the
evaluator probes there, not the eight round 1 miscounted), the present-but-bad artifact of AC-04, the
empty-keyring refusal of AC-02, the offline cache-miss and the quarantined-failure report of AC-05 and AC-04,
the unknown target, the `migrate claude-code` refusal and the misplaced `--delivery` of AC-06, the
mixed-install refusal of AC-07, the uninstalled `mewkit versions` of AC-08, and the migration-pending finding
of AC-10 — **twenty** messages in total, enumerated so the probe count is unambiguous
**When** each message is read
**Then** each one names the check that failed, the artifact or file it was checking, and one concrete next
action — never only "verification failed"; a signature failure says whether the signature was absent, malformed
or from an untrusted key, since those have different remedies; a digest failure names the file whose digest
differed; the offline refusal names both ways forward (a local release directory, or a networked upgrade); the
present-but-bad refusal states that the install was **stopped** rather than downgraded, so the user is not
left believing an unverified install happened; no message prints a stack trace, an internal class name, a
temp path or a raw crypto error string; and no message contains key material, a file digest a user cannot act
on, or the signing secret's value

- **Verification:** trigger each path in a scratch project and assert the message contains the failed check,
  the subject file and the named next action, and contains no stack frame, class name, temp path or key
  material
- **Rubric tie-in:** ux-usability (weight 0.20)

## Out-of-Scope Clarifications

- Do not add a way to skip signature or digest verification — not a flag, not an env var, not a prerelease
  exemption, not an "empty keyring means trust anything" branch. The absence of a bypass surface is the
  property being bought; adding one and defaulting it off still adds it.
- Do not fall back to the legacy zip when an artifact is present and fails a check. A silent downgrade to an
  unverified path is precisely the attack the artifact exists to stop.
- Do not unpublish or stop reading the legacy zip asset. Older releases must keep installing through it.
- Do not generate, read, store, print or commit a production private key, in any form, from any agent path.
  Tests use ephemeral keypairs; the human-run script writes to a path its caller names.
- Do not add an npm dependency for signing, verification, archiving or hashing. The platform crypto already
  available is the whole implementation.
- Do not create a second cache, and do not put a kit cache under `$HOME`. One project-local, untracked cache,
  because the trust property `uninstall` and `doctor --adopt` rely on is that a pull request cannot reach it.
- Do not trust the cache more than a download. Re-verify what comes out of it.
- Do not extract before verifying, and do not write outside quarantine before verification passes.
- Do not write a second path-traversal guard. Reuse the existing helper, and put the legacy extraction behind
  it too rather than leaving a known hole beside a hardened path.
- Do not execute, require, import, spawn or evaluate anything from the artifact during install.
- Do not remove the flat-copy path from `init`, and do not let `init` grow past its BASE line count.
- Do not exclude a path from the ship set without a committed reader grep, and do not exclude one whose grep
  shows a shipped referrer. `.claude/benchmarks/canary/` is a user-invocable skill's input corpus;
  `.claude/eval/track-m-adapter-core.cjs` is `require`d by two shipped skills; `.brand-allowlist.txt` is read
  by two shipped scripts. Narrow the exclusion or take the referrer with it.
- Do not delete a test, eval or benchmark file from the repo. The exclusions are from the artifact.
- Do not create a second ship-set list. One field, two consumers.
- Do not rename `version` or move `scope` in install metadata, and do not make `origin` a free string.
- Do not implement a `build-plugin` verb, a committed `plugin/` payload, or marketplace publication — but do
  stop the tree from claiming a verb that does not exist.
- Do not invent the plugin manifest schema from recall. Retrieve it from current official documentation and
  record the retrieval; if it cannot be retrieved, stop and ask.
- Do not add a verb or alias beyond `versions`.
- Do not update the changelog pages.
- Do not reference a plan artifact — phase number, sprint number, criterion identifier or decision number — in
  a code comment, a test name, a file name or a migration name. State the invariant instead.
- Do not relax or skip a test to make this sprint pass. If BASE behavior and the result cannot be reconciled,
  stop and ask.

## Rubric Bindings

- functionality: AC-01, AC-02, AC-03, AC-04, AC-05, AC-06, AC-10, AC-11
- product-depth: AC-07, AC-08, AC-09, AC-12
- code-quality: AC-13
- ux-usability: AC-14

## Negotiation Log

- Round 1 (proposer/generator): initial draft from `phase-04-kit-artifact-and-emitters.md` plus `plan.md`
  Decisions 1–7 and Constraints plus the `cli-tool` preset, grounded in a fresh inventory
  (`tasks/reviews/evidence/261108-meowkit-v3-lean-runtime-sprint-6/kit-artifact-inventory.md`). BASE is
  pinned to the real SHA `56488bc520f6a042472c8b4e6259d9ff0bdae863`. Fourteen Decisions are recorded rather
  than left open, per the user's standing directive to take the recommended option; six are marked
  `[CHALLENGE]`.
  The user ruled directly on five of them before drafting: signing shape and key custody (D1), dual-publish
  precedence (D2), legacy flat-copy deferral (D3), cache reconciliation (D4) and verify-before-extract (D5).
  The spec is contradicted by the tree in nine further places, each of which drove a Decision or a
  constraint: (a) the phase's `~/.meowkit/cache/kits/<ver>/` collides with the project-local
  `.meowkit/cache/` sprint 5 shipped as the **trusted kit source**, whose trust property is being untracked
  (`core/kit-cache-trust.ts:29-38`) — reconciled to one project-local cache with the lost cross-project reuse
  stated (D4); (b) `.claude/meowkit.manifest.json` does not exist in the repo at all, and two of the four
  readers the phase names never reference it while the real third reader
  (`core/compute-checksums.ts:26,40`) is omitted (D6); (c) the phase's ship-set "source of truth" — a pack
  manifest with file-level exclusion — does not exist; the live list is 17 `zip -x` patterns in
  `scripts/prepare-release-assets.cjs:75-103` (D7; this entry said 22 in round 1 and is corrected here);
  (d) three of the phase's exclusions break shipped
  content, found by the reader greps the phase itself mandates: `.claude/eval/track-m-adapter-core.cjs` is
  `require`d by two shipped skills, `.claude/benchmarks/` is the input corpus of the user-invocable benchmark
  skill, and `.brand-allowlist.txt` is read by two shipped scripts (D8); (e) the plugin *build* does not
  exist although `README.md:52-63`, `vitest.config.ts:34` and `.gitignore:74` all say it does — round 1 also
  claimed nothing plugin-shaped existed at all, which round 2 corrects: the `claude-plugin` **provider
  declarations** do exist and are `supported`, and `--delivery plugin` consumes them (D9); (f) there is no
  semantic-release config file anywhere, so the release workflows publish no asset at all and the zip reaches
  releases only through the human-run `scripts/release.sh:113-137` — the artifact step has to be added to the
  workflows rather than to a plugin config that does not exist (AC-01); (g) the legacy zip is extracted by
  `AdmZip.extractAllTo` with no traversal guard (`core/github-releases.ts:130-134`), so hardening only the
  artifact path would leave a known hole beside it (D5); (h) install metadata has none of the six provenance
  fields the phase lists, and two of the six already exist under different names and positions that every
  reader depends on (D11); (i) `commands/init.ts` is 1042 lines, not the 982 the phase records.
  Also decided: `--offline` re-verifies the cache rather than trusting it (D12), `mewkit versions` is a verb
  and not an alias of `status` (D10), the docs scope is the eight pages that actually name the install and the
  two changelog pages are left alone (D13), and the sprint stays at 14 ACs leaving one slot under the
  evaluator's ceiling for the amendment D9 makes likely (D14).
- Round 1 (reviewer/evaluator): clarifications needed — seven items. The Decisions are accepted as decided,
  including the four the orchestrator ruled on directly: `--delivery plugin` stays in scope with the manifest
  schema retrieved from current Claude Code documentation and a STOP-and-ask if it cannot be retrieved (D9);
  one project-local cache with fresh-offline served by `MEOWKIT_RELEASE_SOURCE` (D4); the reader-grep
  narrowing of three exclusions (D8); and the empty-keyring hard refusal (D1). Fifteen grounding claims were
  re-derived at BASE `56488bc5`; eleven hold exactly (`commands/init.ts` = 1042; the unguarded
  `AdmZip.extractAllTo` at `core/github-releases.ts:133-134`; the `.zip` asset selector at `:71`; the absent
  `.claude/meowkit.manifest.json` with exactly the three real reference sites plus six test sites, and
  `core/release-metadata.ts` / `core/pack-manifest.ts` genuinely not referencing it; `PackBase` carrying
  `files`/`globs`/`commands` and no exclusion field, with `artifactsExclude` the only one; both workflow
  trigger blocks; `packages/mewkit/src/{emit,kit}/` absent; the 88-line path-safety helper;
  `core/kit-cache-trust.ts` re-checking `git ls-files` per run; `MEOWKIT_RELEASE_SOURCE` at
  `core/local-release-source.ts:26-33`; `README.md:63`, `vitest.config.ts:34` and `.gitignore:74` all naming a
  `build-plugin` verb that does not exist). The rubric bindings are valid against the real `cli-tool` preset
  (functionality 0.40, product-depth 0.25, ux-usability 0.20, code-quality 0.15; every preset rubric has at
  least one AC). Four claims did not hold, and three ACs name a probe that cannot be run as written:
  - AC-04: the contract cannot have all three of "a present-but-bad artifact writes nothing", "no network on
    any path other than `init` and `upgrade`", and "`doctor` explains that *this version* cannot be installed
    until a new release is published". `doctor` can only know that if the refused attempt left a record, which
    the hard-refusal definition currently forbids, or if it re-fetched, which Scope (Out) forbids. Name the
    third option explicitly — e.g. the refusal writes a verification-failure record inside the cache
    quarantine area, which the "writes nothing **outside quarantine**" wording already permits but the
    definition's "writes nothing" does not — and say which version and which failed check that record carries,
    or drop the `doctor` leg from AC-04.
  - AC-06: `migrate` has no `claude-code` entry. `mewkit migrate <tool>` takes a positional *external* tool
    and exists to "Export MeowKit to external coding-agent tools" (`cli/command-catalogue.ts:29`;
    `commands/migrate.ts:33` reads `args._[1]`, and there is no `--target` flag on it), so "the nine command
    combinations" includes three that cannot be invoked. Restate the three-entry-point assertion as the entry
    points that exist per target — `init` and `upgrade` for `claude-code`, all three for `codex` and `cursor`
    — or define what `migrate claude-code` is and add it to the catalogue in scope.
  - AC-07: the tree already declares `claude-plugin` as a **supported** provider, and the inventory's
    "`grep -rn "buildPlugin\|build-plugin\|claude-plugin" packages/mewkit/src` → empty" is wrong — it matches
    in at least seven source files: `core/provider-projection.ts:46-53` (status `supported`,
    `bootstrapPlacement: "sessionstart-hook-via-plugin-build"`, all four levels `supported`) and `:79`
    (`ProjectedProvider`), `core/provider-adapter.ts:133` (`ADAPTED_PROVIDERS`), `core/bootstrap.ts:26`
    (`BootstrapProvider`), `core/provider-lifecycle.ts:122`, `core/provider-operations.ts:173`,
    `core/provider-invocation.ts:137` and `core/repo-context-adapter.ts:39-40`. Two consequences the AC must
    settle: (i) whether `--delivery plugin` consumes those declarations as the single source of truth for the
    plugin shape or defines a second one — a second one is the "no second list" defect D7 exists to prevent,
    one layer over; and (ii) whether `provider-projection.ts`'s `supported` claim, which rests on the same
    nonexistent plugin build as `README.md:63`, is corrected in the same breath as the three stale references
    the AC already lists, or is deliberately left standing with a reason.
  - AC-12: the docs scope of eight pages plus two deliberately-excluded changelog pages does not cover the
    tree. At BASE `grep -rl "npx mewkit init" packages/docs/content/docs` returns **twelve** files: the ten
    the contract accounts for plus `reference/skills/bootstrap.mdx` and `reference/skills/visual-plan.mdx`,
    which are in neither list. Either bring them into scope or record them as deliberately out with the
    reason, so "every command shown runnable as written" is a property of the docs tree rather than of a
    subset. Separately, the verification "extract every `mewkit` command from the eight pages and run each
    against the built CLI" would perform real installs and real network fetches from documentation text; name
    the parse-only check instead (resolve each extracted command and flag against `cli/command-catalogue.ts`),
    since that is what "asserting it parses" can actually mean without side effects.
  - AC-01: the ship-set count is wrong and the reproducibility probe is too weak to prove anything.
    `scripts/prepare-release-assets.cjs` carries **17** `"-x"` patterns at BASE (first at `:75`, last at
    `:103`), not the 22 stated in the Pinned baseline, in D7 and in the Round 1 proposer entry — correct the
    number in all three places, since the whole contract's claim is that every number is grounded. And
    "building twice from the same commit produces identical digests" passes trivially when both builds run
    back to back in one process: state the non-determinism the test must defeat — archive member order, member
    mtimes, uid/gid/mode, and the gzip header timestamp — and require the two builds to come from separate
    checkouts or temp roots with a clock gap, so a digest equality is evidence rather than a coincidence.
  - AC-02: "run the artifact step with the secret unset and assert non-zero exit and zero artifacts" names a
    layer the test suite cannot invoke — a workflow step is not runnable from vitest. Split it: assert the
    fail-closed behavior on the build script the workflow invokes, with `MEOWKIT_KIT_SIGNING_KEY` unset, AND
    assert statically that the workflow step carries no `continue-on-error`, no `|| true`, no `if: always()`
    and no `set +e`, so "the artifact step fails and publishes no artifact" is proven at both layers rather
    than at the one that happens to be testable.
  - AC-03: "eight tampered variants" enumerates ten cases — the path-escape entry bundles a `..` traversal, an
    absolute path and an outward-pointing symlink. Restate the count as the number of refusal assertions and
    reconcile AC-14's "the eight tamper refusals of AC-03" with it, so the evaluator's probe count is not
    ambiguous. Minor citation drift to fix while there: `.claude/**/*.test.cjs` is excluded at
    `vitest.config.ts:47`, not `:46` (D8).
  Nothing in this round reopens a Decision, and no `[CHALLENGE]` Decision is contested: D1's empty-keyring
  refusal, D2's no-fallback rule, D4's single project-local cache, D6's corrected reader list, D8's three
  narrowings and D9's scope boundary are all accepted as reasoned and as grounded in the tree. The seven items
  are an ambiguity, a non-existent command path, a wrong grep with a design consequence, an incomplete file
  set, a wrong count plus a weak probe, an untestable layer, and a count mismatch.
- Round 2 (proposer/generator): all seven items addressed, every change a replacement rather than a deletion,
  and the three orchestrator rulings of 261109 folded into the Decisions they belong to. No AC added, no AC
  removed — still 14, per D14.
  **Every reviewer finding was independently re-derived at BASE before being accepted, and all seven held.**
  Confirmed: `grep -c '"-x"' scripts/prepare-release-assets.cjs` = **17**, first at `:75`, last at `:103`;
  `.claude/**/*.test.cjs` is at `vitest.config.ts:**47**` and `plugin/**` at `:48`;
  `grep -rl "npx mewkit init" packages/docs/content/docs` = **twelve** files;
  `commands/migrate.ts:33` is `const tool = args._[1]` with no `--target` flag anywhere on the verb; and
  `claude-plugin` matches in **eight** non-test source files with `status: "supported"` at
  `core/provider-projection.ts:46-53` — round 1's inventory quoted a grep as empty that was never run in that
  form, which is a method failure, not a typo, and §6 of the evidence file is rewritten to say so.
  Item-by-item: **AC-04** — the three-way contradiction is resolved by naming the third option rather than
  dropping the `doctor` leg. The "Hard refusal" definition becomes "writes nothing **outside** quarantine", a
  new **verification-failure record** definition says exactly what the one permitted write carries (version,
  which check failed, subject file, timestamp — no artifact bytes, no key material), and it is declared
  non-installable so `--offline` reports it instead of installing from quarantined bytes; `doctor` reads that
  record and nothing else, which is how it names the version with no network and no second fetch.
  **AC-06** — the three uninvocable combinations are gone. The assertion is restated as the entry points that
  exist per target (`init` + `upgrade` for `claude-code`; all three for `codex` and `cursor`), **eight**
  invocable combinations not nine, with `migrate claude-code` added to Scope (Out) as a phase-06 surface
  change and a named refusal rather than a silent unknown-tool error.
  **AC-07** — rewritten around the corrected grep and the orchestrator's first two rulings: the eight
  `claude-plugin` declarations are the **single source of truth** for the plugin shape and the sprint diff must
  add no second capability/lifecycle/operations table (the D7 defect one layer up), with only the on-disk
  manifest field set coming from the recorded documentation retrieval; and because the sprint delivers the
  build, the `supported` status and `sessionstart-hook-via-plugin-build` placement **stand and are exercised**
  rather than corrected — while every neighbouring claim the sprint does not make true is corrected in the
  same change, which widens the reconciliation set from `README.md:63` alone to `README.md:52-63` (the
  marketplace flow, `marketplace.json`, "staged into each release"), `vitest.config.ts:34`, `.gitignore:74`
  and `visual-plan.mdx:131`, the last split rather than deleted because it is half-true at sprint end.
  **AC-12** — the universe is all twelve pages: nine updated (D13 now brings `visual-plan.mdx` IN precisely
  because `:131` is a truth claim this sprint falsifies), three deliberately unchanged with their reasons
  recorded and asserted by diff. The probe becomes **catalogue resolution, never execution** — every extracted
  verb and flag resolved against `cli/command-catalogue.ts`, with a planted bad flag required to fail the
  check so it has teeth, and nothing run, since executing install commands lifted from documentation would
  perform real installs and real fetches.
  **AC-01** — 17 corrected in all three places (Pinned baseline, D7, the round-1 proposer entry above), and
  the reproducibility probe now names the non-determinism it must defeat: archive member order, member mtimes,
  member uid/gid/mode and the gzip header timestamp, each pinned and each perturbed in the test, with the two
  builds required to come from separate checkouts in separate temp roots with a clock gap — a back-to-back
  in-process build is explicitly declared insufficient.
  **AC-02** — fail-closed is split across the two layers the reviewer identified: the **build script** the
  workflow invokes is run with `MEOWKIT_KIT_SIGNING_KEY` unset and must exit non-zero leaving zero output
  files, and the workflow step is asserted **statically** to carry none of `continue-on-error`, `|| true`,
  `if: always()`, `if: failure()` or `set +e`, nor to sit inside a composite supplying one — so the claim is
  proven where it is testable and where it actually takes effect.
  **AC-03** — the ten cases are enumerated and numbered, the count is stated as **ten refusal assertions**,
  the quarantine content after each refusal is now itself asserted (record plus unverified bytes, never an
  extracted tree), and AC-14 is reconciled to the same ten with its full message set enumerated at **twenty**.
  The `vitest.config.ts:46` → `:47` citation drift in D8 is fixed, and the unguarded-extract citation is
  corrected to `core/github-releases.ts:133-134` in the Pinned baseline, D5 and AC-03. The round-1 log entries
  above keep their original wording with the correction noted inline, because a negotiation log is a record of
  what each round actually claimed.
  Nothing in this round changes a Decision's direction; D9 is the only one whose *reasoning* moved, and it
  moved because a round-1 grep was wrong rather than because the scope changed. The evidence file is updated
  in the same pass (17 patterns, the corrected plugin grep with all eight files, `vitest.config.ts:47`, the
  twelve docs pages with their classification, and the `migrate` positional-tool fact).

- Round 2 (reviewer/evaluator): **accepted**, subject to the two literal corrections below, which change no
  criterion's meaning and are to be applied before signing. All seven round-1 items are resolved on the
  merits, each by replacement rather than deletion, and each resolution was re-derived at BASE rather than
  taken on the proposer's word:
  - **AC-04 resolved.** The three-way contradiction is closed the right way round — by naming the third
    option, not by dropping the `doctor` leg. The "Hard refusal" definition now reads "writes nothing
    **outside** quarantine", the **verification-failure record** is defined with an exact payload (version,
    failed check, subject file, timestamp; no artifact bytes, no key material), it is declared
    non-installable, Scope (Out) forbids installing from or trusting a quarantine holding one, and AC-04's
    probe asserts `doctor` explains the blocked version **with the network blocked and no request made**. The
    three constraints now hold together, and `--offline` reporting the record rather than installing from it
    closes the loop the round-1 wording left open.
  - **AC-06 resolved.** The three uninvocable combinations are gone; eight invocable combinations replace
    nine; `migrate claude-code` is in Scope (Out) as a phase-06 surface change **and** carries a named refusal
    rather than a silent unknown-tool error, which is the stronger of the two options offered.
  - **AC-07 resolved** per the orchestrator's rulings: the declarations are the single source of truth, the
    diff may add no second capability/lifecycle/operations table, only the on-disk manifest field set comes
    from the recorded documentation retrieval, the `supported` status stands **because the sprint makes it
    true** and is exercised by the install, and the reconciliation set is widened to every neighbouring claim
    the sprint does not make true. Ruling (a) is satisfied: `README.md:52-61` really does carry a
    `claude plugin marketplace add` / `codex plugin marketplace add` flow (verified) and is in the
    reconciliation set while marketplace publication stays out of scope.
  - **AC-12 resolved.** All twelve pages are classified, nine updated, three unchanged-by-diff with reasons.
    Bringing `visual-plan.mdx` IN because `:131` is a truth claim this sprint falsifies is the correct call —
    verified: `:131` reads "there is no plugin/marketplace build step". Holding `bootstrap.mdx` OUT is also
    correct — verified: its three mentions (`:19`, `:38`, `:255`) only draw the CLI-versus-skill boundary and
    say nothing about install mechanics. The probe is now catalogue **resolution, never execution**, with a
    planted bad flag required to fail it, which gives it teeth without performing installs from documentation
    text.
  - **AC-01 resolved.** 17 is corrected in all three places. The reproducibility probe now names the four
    sources of non-determinism, requires each to be perturbed, and requires two builds from separate
    checkouts in separate temp roots with a clock gap, declaring a back-to-back in-process build insufficient.
  - **AC-02 resolved.** Fail-closed is split across the runnable layer (the build script with the secret
    unset, exiting non-zero and leaving zero output files) and the static layer (five continue-on-failure
    forms, plus the composite caveat round 1 did not ask for).
  - **AC-03 resolved.** Ten numbered variants, "ten refusal assertions", quarantine content asserted after
    each refusal, and AC-14 reconciled to the same ten with its full message set enumerated at twenty. The
    `vitest.config.ts:46 → :47` and `github-releases.ts:130-134 → :133-134` citation drifts are fixed in the
    live clauses, and leaving the round-1 log entries' original wording with the correction noted inline is
    the right treatment of a negotiation record.
  Corrected counts re-derived independently at BASE: `grep -c '"-x"' scripts/prepare-release-assets.cjs` =
  **17**, first `:75`, last `:103` — matches. `grep -rl "npx mewkit init" packages/docs/content/docs` =
  **twelve** files, and the nine/one/two classification accounts for each — matches.
  `.claude/**/*.test.cjs` at `vitest.config.ts:47` — matches. `commands/migrate.ts:33` = `args._[1]` with no
  `--target` on the verb — matches. All seven cited `claude-plugin` sites resolve to real declarations,
  including the two the filtered grep does not surface by name (`provider-lifecycle.ts:92-99`
  `CLAUDE_PLUGIN_LIFECYCLE` with `session_start` re-evidenced for the plugin payload, and
  `provider-operations.ts:136` `CLAUDE_PLUGIN_OPERATIONS`) — all match.
  **Correction 1 — the plugin declaration count is seven files, not eight.** The evidence file's own command,
  `grep -rn "claude-plugin" packages/mewkit/src | grep -v __tests__ | grep -v "/modules/"`, returns **10
  matches in 7 distinct files** (`provider-projection.ts` ×3, `repo-context-adapter.ts` ×2, and one each in
  `provider-adapter.ts`, `bootstrap.ts`, `provider-lifecycle.ts`, `provider-operations.ts`,
  `provider-invocation.ts`). "Eight" is the row count of the evidence table, which splits
  `provider-projection.ts` across two rows. Change "eight" to "seven" in the Pinned baseline, in D9, in
  AC-07's **Given**, in the round-2 proposer entry and in the evidence §6b heading; the enumerated list itself
  is complete and correct and does not change. This is the same class of error round 1 flagged, in a contract
  whose stated property is that every number is grounded — and because AC-07's **Given** binds to "the eight
  source files", the evaluator would otherwise probe a set whose cardinal does not match its own membership.
  For the avoidance of doubt at grading time: AC-07's declaration set **is** the seven enumerated files.
  **Correction 2 — pin AC-07's probe, per orchestrator ruling (b).** `mewkit providers claude-plugin
  --lifecycle` **does** resolve at BASE: `providers` routes the positional to `args.provider`
  (`index.ts:221-227`), `--lifecycle` is declared for it (`cli/command-catalogue.ts:302`), and the built CLI
  exits 0 printing `Capability adapter — claude-plugin [supported]`, all four support levels `supported`, and
  `bootstrap: sessionstart-hook-via-plugin-build` — exactly the declarations AC-07 must hold unchanged. So
  drop the hedge "(or the equivalent projection reader)" from AC-07's Verification and pin the command, since
  a probe with an unnamed alternative is a probe the evaluator cannot be held to.
  No Decision is reopened and no `[CHALLENGE]` is contested. D9 is the only Decision whose reasoning moved,
  and it moved because a round-1 grep was wrong rather than because the scope changed; its direction is
  unchanged. Two cautions carried into grading rather than renegotiated: the plugin manifest field set is
  still unretrieved, so D9's STOP-and-ask is live and this remains the most likely amendment; and AC-01's
  reproducibility plus AC-09's whole-CI-suite requirement are the two widest probes in the sprint, so they are
  where a thin implementation will show first. Contract is clear to sign at round 2 of 2 once the two
  corrections are in.

## Amendments (if any)

None. This contract is still `negotiating`; round-2 changes are in-place revisions of unsigned criteria, as
the `amend` action defines. The Amendments section is for post-sign changes only.
