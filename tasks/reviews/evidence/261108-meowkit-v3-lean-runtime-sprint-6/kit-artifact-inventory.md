# Sprint 6 grounding inventory — kit artifact and emitters

BASE = `56488bc520f6a042472c8b4e6259d9ff0bdae863` (`feat/v3-lean-runtime` HEAD, "feat(config): single
config.yaml with local kit cache and safe install verbs"). Every count and path below was read at BASE.
Commands are recorded so each row is re-derivable.

## 1. Release pipeline as it exists

| Fact | Evidence |
|---|---|
| Release workflows are `workflow_dispatch` only (stable) and `push: dev` + `workflow_dispatch` (beta) | `.github/workflows/release.yml:5-6`, `.github/workflows/release-beta.yml:3-6` |
| Both workflows run `npx semantic-release` with no step that builds or uploads a kit asset | `release.yml:46-51`, `release-beta.yml:46-51` |
| **No semantic-release config file exists** — no `.releaserc*`, no `release.config.*`, no `release` key in any `package.json` | `git ls-files \| grep -i 'releaserc\|release.config'` → empty; `grep -n '"release"' packages/*/package.json` → empty |
| The asset that actually reaches a GitHub release is built and uploaded by a **human-run script**, not CI | `scripts/release.sh:113-137` (`gh release create … dist/meowkit-release.zip`) |
| Archive builder: zip of `.claude`, `tasks`, `release-manifest.json`, `.meowkit/pack-manifest.json` | `scripts/prepare-release-assets.cjs:52-57` |
| Ship-set exclusions live as **17** `zip -x` patterns in that script | `grep -c '"-x"' scripts/prepare-release-assets.cjs` → `17`; first `:75`, last `:103`. **Corrected 261109** — round 1 of the contract said 22, which was a miscount of the array's lines rather than its `-x` flags |
| Manifest generator (per-file sha256 already exists for the zip path) | `scripts/generate-release-manifest.cjs` (157 lines) |
| CLI picks the release asset by `name.endsWith(".zip")` | `packages/mewkit/src/core/github-releases.ts:71` |
| Download extracts with `AdmZip.extractAllTo(extractDir, true)` — **no path-traversal guard** | `core/github-releases.ts:133-134` |
| Temp dir is deleted after install | `core/github-releases.ts:143-150` (`cleanupDownload`) |
| Offline install source already exists as a directory env pointer | `core/local-release-source.ts:26-33` (`MEOWKIT_RELEASE_SOURCE`), classified at `env-name-classification.json:443` |
| `node:crypto` ed25519 sign/verify available on the pinned runtime (Node >= 24) | `node -e "crypto.generateKeyPairSync('ed25519') … crypto.verify(null,…)"` → `ok 64 true` |

## 2. Cache (sprint 5 shipped it; the phase spec proposes a different location)

| Fact | Evidence |
|---|---|
| Project-local kit cache at `.meowkit/cache/`, written by `init`/`upgrade` | `core/kit-cache.ts:30-33,51-72` |
| It is the **trusted kit source** for deletion and `doctor --adopt` | `core/kit-cache.ts:91-100`, `core/kit-cache-trust.ts:40-79` |
| Trust property is "untracked", re-checked per run with `git ls-files` | `core/kit-cache-trust.ts:29-38` |
| Cache states already modelled: `ok` / `absent` / `version-mismatch` / `tracked` | `core/kit-cache-trust.ts:18` |
| `--adopt` flag already documented against it | `cli/command-catalogue.ts:234` |
| The phase spec instead names `~/.meowkit/cache/kits/<ver>/` | `phase-04-kit-artifact-and-emitters.md:11` |

## 3. Legacy `.claude/meowkit.manifest.json`

**It does not exist in the repo at BASE** (`ls .claude/meowkit.manifest.json` → no such file). It is a file the
CLI *writes into an installed project*, so the phase's "647 KB" is an installed-project figure, not a repo one.

Real references (`grep -rn "meowkit.manifest" packages/mewkit/src packages/mewkit/tests tests`):

| Site | Role |
|---|---|
| `core/compute-checksums.ts:26` (`MANIFEST_FILENAME`), `:40` (self-exclusion) | the writer/reader of the file |
| `core/install-metadata.ts:122`, `:132` | legacy-manifest read branch + projection onto the canonical shape |
| `commands/doctor.ts:60` | `hasManifest` existence probe |
| `core/__tests__/smart-update-migration.test.ts:86` | asserts the file is written |
| `packages/mewkit/tests/smart-update-orphan-callback.test.ts:43,111,113` | fixture writes/removes it |
| `tests/install/uninstall-ownership.test.ts:81`, `tests/install/doctor-adopt.test.ts:39` | fixtures remove it |

The phase names four readers — `core/install-metadata.ts`, `core/release-metadata.ts`, `core/pack-manifest.ts`,
`commands/doctor.ts`. Two of those four **do not reference it at all**: `core/release-metadata.ts` reads
`release-manifest.json` (`:10`) and `core/pack-manifest.ts` reads `pack-manifest.json` (`:9`). The real third
reader the phase omits is `core/compute-checksums.ts`.

## 4. Ship-set exclusion candidates and their readers

| Candidate | Size / count | Readers found by grep | Verdict forced by the readers |
|---|---|---|---|
| `.claude/settings.json.bak` | 875 B | only `migrate/discovery/exclusions.ts` (already excludes it) | safe to exclude |
| `.claude/.brand-allowlist.txt` | 2 040 B | `.claude/scripts/lint-brand-prose.sh`, `.claude/scripts/check-anthropic-context.py` (both shipped), `tests/changed-files-lint.test.sh`, `.github/workflows/ci.yml` | exclude only **together with both shipped scripts** |
| `.claude/scripts/lint-brand-prose.sh` | 5 397 B | `.github/workflows/ci.yml` | same unit as above |
| `.claude/benchmarks/` | 8 files / 32 KB | `.claude/skills/benchmark/{SKILL.md,scripts/run-canary.sh,scripts/git-index-audit.sh,scripts/compare-runs.sh}`, `.claude/scripts/rules-audit.sh`, `.claude/agents/SKILLS_INDEX.md` | **cannot** be excluded wholesale; `canary/` is the shipped skill's input |
| `.claude/eval/` | 1 file (`track-m-adapter-core.cjs`) | `require`d by `.claude/skills/brainstorming/eval/run-scenarios.cjs` and `.claude/skills/prompt-enhancer/eval/run-canaries.cjs` | excluding it alone breaks two shipped skills; exclude with the per-skill `eval/` dirs or not at all |
| per-skill `eval/` | `.claude/skills/{scale-routing,brainstorming,prompt-enhancer}/eval` | `prompt-enhancer/eval/run-canaries.test.cjs` runs in CI (`ci.yml:61`) | exclusion is from the **artifact**, not the repo |
| `__tests__` / `tests/` dirs | `hooks/__tests__` 4, `skills/web-to-markdown/tests` 3, `skills/multimodal/scripts/tests` 5, `skills/docs-finder/scripts/tests` 5, `skills/confluence/scripts/tests` 2 | CI runs them from the repo (`ci.yml:55,107,117-119,258,374`) | safe to exclude from the artifact |
| `*.test.*` under `.claude` | 7 files | vitest deliberately excludes `.claude/**/*.test.cjs` (`vitest.config.ts:**47**`; `plugin/**` is `:48`) | safe to exclude from the artifact; CI runs them with `node` (`ci.yml:43,58,61,258`) |
| `workflow.yaml` (must be KEPT) | — | `.claude/rules/{meowkit-core,gate-rules}.md`, `.claude/skills/{workflow-orchestrator,autobuild,cook}/**` (9 files) | keep |

## 5. Ship-set "single source of truth"

`.meowkit/pack-manifest.json` has keys `schemaVersion`, `base`, `packs`, `profiles` only. `base` carries
`files`, `globs`, `commands` — **no exclusion field of any kind**. The only per-artifact exclusion is
`packs.<name>.artifactsExclude` (skill-artifact names, `core/pack-manifest.ts:18-23`), used once
(`lifecycle-core`, 7 entries). So the phase's "pack manifest with file-level exclusion (phase 01)" does not
exist at BASE; the live ship-set list is the 22 `zip -x` patterns of `prepare-release-assets.cjs`.

A second, unrelated exclusion list exists for *user-tree discovery*: `migrate/discovery/exclusions.ts`
(names `settings.json.bak`). Different purpose; not the ship set.

## 6. Plugin delivery

**Correction, 261109.** Round 1 of this file carried the row *"any `delivery`/`.claude-plugin`/`plugin.json`
support in the CLI → none (`grep -rn "buildPlugin\|build-plugin\|claude-plugin" packages/mewkit/src` →
empty)"*. That grep was **never run in that form** — the command actually run searched only
`buildPlugin\|build-plugin` — and the claim is **false**. The row is replaced below. The method failure worth
recording: a three-alternation grep was reported from the output of a two-alternation one, so the quoted
command was not the evidence. Re-derived commands are given per row.

### 6a. What genuinely does not exist — the plugin BUILD and its distribution

| Claim in the tree | Reality at BASE |
|---|---|
| `README.md:63` — "The plugin distribution is generated by `mewkit build-plugin` (the `plugin/` payload + `marketplace.json` for both runtimes) and staged into each release" | no `build-plugin` verb in `packages/mewkit/src`, `cli/command-catalogue.ts` or `scripts/` (`grep -rn "buildPlugin\|build-plugin" packages/mewkit/src packages/mewkit/package.json scripts` → empty); `plugin/` absent (`ls -d plugin` → No such file); no `marketplace.json` anywhere (`find . -name marketplace.json -not -path "./node_modules/*"` → empty) |
| `README.md:52-61` — a `claude plugin marketplace add` / `codex plugin marketplace add` install flow | documents a distribution channel that has never been published |
| `vitest.config.ts:34-35` excludes `plugin/**` "generated … via `mewkit build-plugin`" | excludes a path that cannot exist |
| `.gitignore:74` — "Swept into `plugin/agent-memory/` by build-plugin" | same |
| phase spec Overview assumes `mewkit build-plugin` exists | it does not |

### 6b. What DOES exist — the `claude-plugin` provider declarations (7 non-test source files)

`grep -rn "claude-plugin" packages/mewkit/src | grep -v __tests__ | grep -v "/modules/"` → 10 matches in 8 files:

| Site | What it declares |
|---|---|
| `core/provider-projection.ts:46-53` | `provider: "claude-plugin"`, `status: "supported"`, `bootstrapPlacement: "sessionstart-hook-via-plugin-build"`, all four levels (`discoverable`/`selectable`/`invocable`/`enforceable`) `supported` |
| `core/provider-projection.ts:79` | `ProjectedProvider = "claude-code" \| "claude-plugin" \| "codex"` |
| `core/provider-adapter.ts:133` | `ADAPTED_PROVIDERS = ["claude-code", "claude-plugin", "codex"]` |
| `core/bootstrap.ts:26` | `BootstrapProvider` includes it |
| `core/provider-lifecycle.ts:92-99`, `:122` | `CLAUDE_PLUGIN_LIFECYCLE` = Claude Code's map with `session_start` re-evidenced as "propagated into the plugin payload during plugin generation" |
| `core/provider-operations.ts:136`, `:173` | `CLAUDE_PLUGIN_OPERATIONS = { ...CLAUDE_CODE_OPERATIONS }` |
| `core/provider-invocation.ts:137` | `CLAUDE_PLUGIN_INVOCATION` registered |
| `core/repo-context-adapter.ts:39-40` | repo-context adapter entry |

So the provider is a **capability contract awaiting a build**, not a second plugin implementation. Sprint 6
consumes these declarations as the single source of truth for the plugin shape (contract D9(i)) and supplies
the build that makes the `supported` status true (D9(ii)). What they do **not** define is the on-disk plugin
manifest field set, which is why that one artefact still comes from retrieved official documentation.

### 6c. Status claim that this sprint falsifies in the docs tree

`packages/docs/content/docs/reference/skills/visual-plan.mdx:131` — "**Install via `npx mewkit init`/`upgrade`**
— there is no plugin/marketplace build step". True at BASE; false for the plugin half at sprint end and still
true for the marketplace half, so it is split rather than deleted (contract D13, AC-07, AC-12).

## 7. Emitters, converters, flags

| Fact | Evidence |
|---|---|
| `packages/mewkit/src/emit/` and `packages/mewkit/src/kit/` **do not exist** | `ls` → No such file or directory |
| Provider IR exists | `migrate/ir/{index,types,rule-classifier,source-lifter}.ts` |
| Converters exist | `migrate/converters/{direct-copy,fm-strip,fm-to-fm,md-strip,md-to-mdc,mcp-json-to-codex-toml,index}.ts` |
| Path-safety helper to reuse | `migrate/portable-installer-path-safety.ts` (88 lines, boundary + symlink-component rejection) |
| `init --target` exists but takes `codex` / `cursor` only, each on its own offline reconcile path; `claude-code` is the implicit default, not a value | `commands/init.ts:64,717-733,443-497,534-586` |
| No `--delivery` flag, no `--offline` flag | `cli/command-catalogue.ts` (searched; absent) |
| No `versions` verb; `status` prints "version and config summary"; `upgrade --list` lists available versions | `cli/command-catalogue.ts:19,153` |
| `mewkit migrate` takes a **positional external tool** and has **no `--target` flag and no `claude-code` value** — so there is no `migrate claude-code` entry point | `commands/migrate.ts:33` (`const tool = args._[1]`); `cli/command-catalogue.ts:29` ("Export MeowKit to external coding-agent tools") |
| Shipped-kit verb resolution is a committed CI check reading the catalogue | `scripts/check-kit-verbs.cjs:11-26`, `ci.yml:210` |

## 8. Install metadata (provenance target)

`InstallMetadataSchema` at `core/install-metadata.ts:28-42` carries `schemaVersion`, `tool`, `version`,
`scope?`, `installedAt`, `files[]`, `settings?`, `profile?`, `packs?`. There is **no** `kitVersion`,
`cliVersion`, `target`, `delivery` or `origin` field. `InstallFileEntrySchema:15-25` carries
`installedVersion?` per file.

## 9. Line counts at BASE (the 200-line rule)

| File | Lines |
|---|---|
| `commands/init.ts` | 1042 (the phase says 982 — it has grown) |
| `commands/upgrade.ts` | 470 |
| `commands/doctor.ts` | 420 |
| `commands/providers.ts` | 324 |
| `commands/migrate.ts` | 97 |
| `core/smart-update.ts` | 624 |
| `core/install-metadata.ts` | 273 |
| `core/pack-manifest.ts` | 174 |
| `core/github-releases.ts` | 152 |
| `core/compute-checksums.ts` | 155 |
| `core/kit-cache.ts` | 100 |
| `core/kit-cache-trust.ts` | 79 |
| `core/local-release-source.ts` | 53 |
| `core/release-metadata.ts` | 87 |
| `scripts/prepare-release-assets.cjs` | 117 |
| `scripts/generate-release-manifest.cjs` | 157 |
| `scripts/release.sh` | 145 |

## 10. Docs-site pages naming `npx mewkit init` — **twelve**, all classified

`grep -rl "npx mewkit init" packages/docs/content/docs` returns twelve files. Round 1 of this file listed only
ten; the two missing ones are marked below.

| Page | Class (contract D13) | Reason |
|---|---|---|
| `installation.mdx` | updated | primary install page |
| `quick-start.mdx` | updated | install commands |
| `migration.mdx` | updated | install/upgrade path |
| `cli/index.mdx` | updated | verb surface |
| `cli/commands.mdx` | updated | verb + flag reference |
| `cli/project-setup.mdx` | updated | install flow |
| `reference/configuration.mdx` | updated | cache/offline references |
| `workflows/new-project.mdx` | updated | install step |
| `reference/skills/visual-plan.mdx` | **updated (added 261109)** | `:131` asserts "there is no plugin/marketplace build step" — a truth claim this sprint falsifies for the plugin half |
| `reference/skills/bootstrap.mdx` | **not updated (added 261109)** | names `npx mewkit init` at `:19`, `:38`, `:255` only to draw a CLI-versus-skill boundary; nothing it says about the install changes. Still covered by the parse-only command probe |
| `changelog/index.mdx` | not updated | immutable record of a past release |
| `changelog/archive.mdx` | not updated | same |

## 11. Other

- `.claude/` has 25 top-level entries at BASE (phase 07 targets <= 8; out of scope here).
- `.claude/skills/benchmark` is user-invocable (`/mk:benchmark`), so its canary corpus is product input.
