# Sprint 6 implementation evidence — signed kit artifact and one shared emitter path

Contract: `tasks/contracts/261108-2347-meowkit-v3-lean-runtime-sprint-6.md`, signed at `678f37f2`,
**Amendment 1 re-signed at `2b93b425`**. BASE = `56488bc520f6a042472c8b4e6259d9ff0bdae863`.

All command-level probes run against throwaway projects under `$TMPDIR`, driven through
`MEOWKIT_RELEASE_SOURCE` against a locally built release fixture, with the built CLI
(`node packages/mewkit/dist/index.js`) and `cwd` set to the temp project. Never against this
repository.

## Gate checks

| Check | Result |
|---|---|
| `pnpm build` | exit 0 |
| `pnpm lint` | **0 errors**, 3 warnings — all three pre-existing at BASE (`commands/capabilities.ts:7`, `commands/orient.ts:8`, `commands/validate.ts:447`); none in a file this sprint touched |
| `pnpm typecheck` | exit 0, 0 errors |
| `pnpm test` (vitest) | **287 files passed / 287; 3317 tests passed / 3317; 0 failed** |
| `node --test .claude/hooks/__tests__/*.test.cjs` | 36 pass / 0 fail |
| `node .claude/skills/worktree/scripts/worktree.test.cjs` | OK |
| `node .claude/skills/intake/scripts/sanitize-ticket.test.cjs` | OK |
| `node .claude/skills/prompt-enhancer/eval/run-canaries.test.cjs` | OK |
| `bash tests/changed-files-lint.test.sh` | OK |
| `mewkit validate --packs` | 1 passed |
| `mewkit validate --parity` / `--plugin` | 40 passed, 34 warnings, 1 n/a (unchanged shape from BASE) |
| `mewkit validate --ownership` / `--agents` / `--substrate` / `--workflow` / `--gates` | all pass |
| `scripts/check-kit-verbs.cjs` | PASS — 187 verb references, all resolving to one of 32 subcommands |
| `scripts/check-env-reads.cjs` | PASS — **138** reads, all classified |
| `scripts/check-always-on-budget.cjs` / `check-rule-survival.cjs` / `check-dangling-rule-refs.cjs` | all OK |
| `packages/mewkit/scripts/codex-compat-check.mjs` | Lane: OK |
| `mewkit doctor --hard-gates` | 26 passed, 5 warnings, **0 FAIL** under a clean environment (`env -i`). With this machine's exported shell variables it reports 7 `Removed setting:` FAILs — those are stale exports in the operator's shell, present at BASE, not a tree condition |
| `mewkit validate --target codex` / `--target cursor` | 16 passed + 1 warning / 3 passed, against targets produced by `init --target codex\|cursor` in `$TMPDIR` |
| Skipped-test set vs BASE | 19 → 19, unchanged. No assertion relaxed or skipped by this sprint |

## AC → evidence

### AC-01 — one artifact, one manifest, one ship-set source · PASS

- Build: `scripts/build-kit-artifact.cjs` (+ `scripts/kit-tar-writer.cjs`, `scripts/kit-ship-set.cjs`).
- Manifest derived from the artifact that was just written, not from the tree: `readTarMembers(tar)` then
  one entry per member. Tests: `packages/mewkit/src/kit/__tests__/kit-artifact-build.test.ts`
  "derives the manifest from the artifact, entry for entry, in both directions" — member count equals entry
  count, every per-file sha256 recomputed, and both directions checked (no entry without a file, no file
  without an entry).
- Real run against this repo: 1246 archive members, 1246 manifest entries, artifact sha256
  `7f23670…`, manifest sha256 `650df46…`.
- **Reproducibility, four named sources pinned:** member order (caller supplies a sorted list; nothing reads
  readdir order), member mtime (written `0`), uid/gid/mode (`0/0`, and mode derived from the file's own bytes
  — shebang → `0755`, else `0644` — so on-disk bits cannot reach the digest), gzip header (MTIME/XFL/OS
  written explicitly via `deflateRawSync`, not taken from `zlib.gzipSync`).
  Proven across **two separate source roots in two separate temp roots**, with mtimes pinned to epoch in one,
  `chmod 755` applied to a file in one, and a **1.1 s wall-clock gap** between the two builds. Identical
  artifact and manifest digests (`e38aaa62…` / `27f267f3…` from the manual run; the vitest form asserts the
  same). A back-to-back in-process build is explicitly not used as evidence.
- **One ship-set source:** `base.exclude` added to the pack manifest (`core/pack-manifest.ts`,
  `.meowkit/pack-manifest.json`). Both archives read it through `scripts/kit-ship-set.cjs`;
  `scripts/prepare-release-assets.cjs` no longer spells any `-x` pattern. Test
  `kit-release-wiring.test.ts` "gives the ship set one source, read by both archive builders" asserts both
  builders `require` it and that neither carries a `"-x", "…"` literal. Test
  `kit-artifact-build.test.ts` "takes its ship set from the pack manifest" adds one exclusion and observes the
  file leave the artifact.
- **17 BASE patterns, none lost:** `kit-release-wiring.test.ts` enumerates them, asserts `toHaveLength(17)`,
  and asserts each is present in `base.exclude`. The field now holds **30** patterns (17 carried + 13
  added), and the ship set is **1226** files.
- Both workflows carry the step, fail-closed, and now pass a version the build script accepts — see
  Review round 3, C6. Each still triggers only by `workflow_dispatch` (stable) or `push: dev` plus
  `workflow_dispatch` (beta); the dispatch block gained one optional `version` input, which adds no
  trigger.

### AC-02 — ed25519 signature, fail-closed at both layers, empty keyring refuses · PASS

- `scripts/kit-signing.cjs` (sign), `packages/mewkit/src/kit/kit-signature.ts` (verify),
  `packages/mewkit/src/kit/trusted-keys.ts` (the keyring, committed **empty**).
- **No dependency added:** `git diff BASE -- package.json packages/mewkit/package.json` is empty.
  `kit-signing.test.ts` "adds no dependency for signing, hashing or archiving" also asserts no
  `minisign`/`sigstore`/`tar`/`tweetnacl` in either manifest.
- Verify succeeds for a listed key; a correctly-formed signature from an unlisted key fails with
  `signature-untrusted-key`.
- **Runnable layer:** build script run with `MEOWKIT_KIT_SIGNING_KEY` unset → exit **1**, output directory
  **not created at all** (the key is resolved before any write). Asserted in
  `kit-signing.test.ts` "exits non-zero and writes nothing when the signing key is absent".
- **Static layer:** `kit-release-wiring.test.ts` "gives the artifact step no way to fail quietly" parses the
  step block out of each workflow, **strips comment lines** (so the step's own prose naming the forms cannot
  satisfy the check), and asserts it carries none of `continue-on-error`, `|| true`, `if: always()`,
  `if: failure()`, `set +e`, and no `if:` at all.
- **Key custody:** `scripts/generate-kit-signing-key.cjs` writes the private key to the caller's path at mode
  `0600`, refuses to overwrite, prints only the public key. Asserted by running it into a temp path and
  checking the private key is only there and stdout contains no private key. `git diff BASE` contains **0**
  matches for `BEGIN … PRIVATE KEY`. Tests use ephemeral keypairs generated per run.
- **Empty keyring refuses:** `verifyManifestSignature(bytes, goodSig, v, [])` throws `no-trusted-key` with
  "this CLI lists no trusted kit signing key". The check sits **after** signature well-formedness, so a
  release with no signature is still reported as unsigned rather than as "this CLI has no key" — different
  remedies, different messages.

### AC-03 — ten tamper shapes, ten refusals, nothing written outside quarantine · PASS

`packages/mewkit/src/kit/__tests__/kit-tamper-corpus.test.ts` — 13 tests, 10 of them the enumerated variants:

| # | Variant | Refused by |
|---|---|---|
| 1 | flipped bit in the artifact | `artifact-digest` |
| 2 | flipped bit in the manifest | `signature-untrusted-key` |
| 3 | signature from an unlisted key | `signature-untrusted-key` |
| 4 | truncated artifact | `artifact-digest` |
| 5 | truncated manifest | `signature-untrusted-key` |
| 6 | missing signature | `signature-absent` |
| 7 | member escaping via `..` | `member-path-unsafe` |
| 8 | member with an absolute path | `member-path-unsafe` |
| 9 | symlink member pointing outside | `member-path-unsafe` |
| 10 | inner file no longer matching its per-file digest | `file-digest` |

For each: non-zero refusal (`KitVerificationError`), a message naming the failed check and its subject, a
**before/after content hash of the whole destination tree required to be equal**, and quarantine content
asserted to be **exactly** `verification-failure.json` — never an extracted tree. Messages are asserted to
contain no stack frame, internal class name or temp path.

- Variants 2 and 5 are refused at the signature rather than at a digest, because the signature covers the
  manifest bytes and is checked first. That is the stronger answer, not a weaker one: a modified manifest is
  caught before it can be believed.
- **Verify-before-extract is structural**, not a comment: `verifyKitArtifact` returns the archive contents and
  `extractVerifiedArchive` is the only writer, and staging is `mkdtemp`-ed only after every check passes
  (`resolve-kit-content.ts`). There is no code path to the filesystem that skips the checks.
- **Nothing executes:** a canary member with a shebang that would `touch` a file is written and the file never
  appears. Plus a static check that the reader and verifier import no `child_process`/`node:vm`/`node:module`
  and call no `exec*`/`spawn*`/`createRequire`/`eval` — asserted on imports and call syntax, not on prose.
- **Legacy zip has the same guard:** `packages/mewkit/src/kit/extract-release-zip.ts` resolves every entry
  through `resolveSafeMemberPath` before any write and refuses the archive whole.
  `legacy-zip-guard.test.ts` builds a zip **byte by byte** (`tests/helpers/craft-zip.ts`) because adm-zip's own
  writer normalizes `..` away, confirms the reader returns `../escaped.md`, and asserts the guard rejects it
  and nothing lands outside. `github-releases.ts` no longer calls `.extractAllTo(`.
- **One guard, not two:** `validateWritableTargetPath` gained an optional `boundary`, so a caller whose
  destination is a staging directory does not have to write its own containment check.

### AC-04 — artifact when present, legacy path only when there is none, refusal when it is present and bad · PASS

Module level: `packages/mewkit/src/kit/__tests__/artifact-precedence.test.ts` + `kit-offline-cache.test.ts`.

**End to end**, over a loopback HTTP server serving two release fixtures built from the ship set — no
external network, and the real `downloadRelease` → `fetchKitArtifact` → `installFromArtifact` path:

| Release fixture | Outcome |
|---|---|
| carries artifact + manifest + signature | **REFUSED**: "Kit 9.9.9 was not installed: this CLI lists no trusted kit signing key, so no signature can be accepted. The install was stopped rather than downgraded to an unverified source, so nothing was written. Upgrade the mewkit CLI to a version that ships a trusted kit key, then re-run." Quarantine record = `9.9.9/no-trusted-key`. Project afterwards holds **only** `.meowkit` (the quarantine) — no extracted tree. |
| carries only the legacy zip | **INSTALLED** from a release tree (4 top-level entries). Project afterwards is empty of quarantine — nothing was refused. |

That is the amendment's requirement exactly: because the committed keyring is empty and no
environment variable, flag or file path may add a trusted key at runtime, a present artifact must
refuse end to end, and a zip-only release must install. **The trusted-artifact install is proven at
module level with an injected test keyring** (`installFromArtifact(..., KEYS)`), which is the only
layer where a trusted key exists.

- Precedence is wired in `core/github-releases.ts`: the artifact is taken when
  `release.kitArtifact !== null`, and a release stays installable on **either** source
  (`r.downloadUrl !== "" || r.kitArtifact !== null`), so an artifact-only release is visible and
  every older zip-only release still installs.
- `doctor` reads the quarantined record and nothing else — `listVerificationFailures(root)` is
  filesystem-only; there is no `fetch` on that path.
- `--offline` in a project holding a record **reports** it rather than installing the quarantined
  bytes.

### AC-05 — one project-local cache, `--offline` re-verifies · PASS

`packages/mewkit/src/kit/__tests__/kit-offline-cache.test.ts`.

- Store is `.meowkit/cache/artifacts/<version>/`, a subdirectory of the ONE cache sprint 5 shipped —
  asserted with `artifactStoreDir(root, v).startsWith(join(root, CACHE_REL))`.
- Offline install from the populated cache succeeds with no network and records `local-cache`.
- **Cache is not trusted for being local:** the cached artifact is corrupted on disk and the offline install
  throws the same `KitVerificationError` a download would.
- **No `$HOME` cache anywhere:** every `.ts` in `packages/mewkit/src/kit/` is scanned for `homedir()`,
  `process.env.HOME`, `$HOME`, `~/.meowkit` → zero matches.
- **Untracked:** asserted against the committed deny-all `.meowkit/.gitignore` (`^\*$`), which is the rule a
  pull request would have to change.
- **Fresh-project refusal** names the cache as empty for that version, names **both**
  `MEOWKIT_RELEASE_SOURCE` and `mewkit upgrade`, and states "No network request was made".
- `upgrade --offline` is wired in `commands/upgrade.ts` via `offlineRefusalFor(cwd)`, which refuses before
  anything reaches the network.
- End to end: the artifact store populated by a verified install is the same `.meowkit/cache/` the
  install already uses; the empty-keyring probe above shows the quarantine living under it and
  nothing else being written on a refusal.

### AC-06 — one emitter path serves three entry points and three targets · PASS

**The projection:** `packages/mewkit/src/emit/emit-target.ts` is the single function that lays down a
target's shape, with the per-target shape declared once in `emit/target-shape.ts`
(source, deliveries, entry points, owned paths). `emit/emit-bundle-target.ts` and
`emit/emit-active-overlay.ts` are the short call forms; nothing else writes a target's shape.

**Every entry point now routes through it**, and the old per-target writers have no other caller:

| Entry point | Was | Now |
|---|---|---|
| `init --target claude-code` | `smartUpdate(...)` in `init.ts` | `emitTarget({target:"claude-code", entryPoint:"init", release:{...}})` |
| `init --target codex\|cursor` | `reconcileApply{Codex,Cursor}Bundle(...)` ×6 sites | `emitCodexTarget` / `emitCursorTarget` |
| `upgrade` (claude-code) | `smartUpdate(...)` in `upgrade.ts` | `emitTarget({entryPoint:"upgrade"})` |
| `upgrade` (codex, cursor) | `reconcileApply*Bundle(...)` | `emit*Target("upgrade", ...)` |
| `migrate codex` | `applyActiveCodexOverlay(...)` | `emitActiveOverlay("codex", ...)` |
| `migrate cursor` | **no authored overlay at all** | `emitActiveOverlay("cursor", ...)` — the symmetric completion |

`applyActiveCodexOverlay` is retired, and `smartUpdate` is no longer imported by `init.ts` or
`upgrade.ts` — the lint warning that appeared when the imports went unused is itself the proof that
neither command writes the shape any more.

**Instrumented, not inferred.** `emit-target.ts` records every passage
(`emitterPassages()`), and `emit/__tests__/one-emitter-path.test.ts` (9 tests) asserts:
- the invocable surface is **eight** combinations — `init` + `upgrade` for `claude-code`, and
  `init` + `upgrade` + `migrate` for each of `codex` and `cursor`; `canAddress("claude-code","migrate")`
  is `false`;
- a recorded passage for each of the six authored-bundle combinations, in order;
- **no command module calls a per-target writer directly** (`init.ts`, `upgrade.ts`,
  `migrate-orchestrator.ts` are grepped for all three writers → zero matches), and no module anywhere
  does except the projection itself and one **named** exception, `commands/pack.ts` (see Deviations);
- the plugin envelope lives **inside** the projection, not beside it (`run-install.ts` does not call
  `emitPluginDelivery`).

**All eight combinations run end to end in `$TMPDIR`:**

```
init --target claude-code      exit=0   → .claude .meowkit tasks
init --target codex            exit=0   → .agents .codex .meowkit AGENTS.md
init --target cursor           exit=0   → .cursor .meowkit AGENTS.md
init --target claude-code --delivery plugin  exit=0 → + .claude-plugin/plugin.json
upgrade (claude-code)          exit=0
upgrade (codex)                exit=0
upgrade (cursor)               exit=0
migrate codex                  → "[+] Applied 10 authored codex artifact(s)"
migrate cursor                 → reached the projection (see Deviations for its unrelated exit code)
```

**Byte identity.** `init --target claude-code` then `upgrade`, versus a fresh `init` at the same
version, hashing every file under `.claude/` and `tasks/`:

```
init+upgrade = 3c2354e2ab67a3733bebfed135bc6efecdd3f90567b1584e93a466df02fc0511
fresh init   = 3c2354e2ab67a3733bebfed135bc6efecdd3f90567b1584e93a466df02fc0511
BYTE-IDENTICAL
```

**Refusals**, all three run against the built CLI:
- `init --target claude-codee` → "Unknown --target "claude-codee". The install targets are
  claude-code, codex, cursor. Nothing was written."
- `init --target codex --delivery plugin` → "--delivery is meaningful for --target claude-code only,
  and "codex" has a single on-disk shape, so passing --delivery plugin here would have no effect.
  Drop the flag, or change the target. Nothing was written."
- `migrate claude-code` → "`mewkit migrate` exports MeowKit to external coding-agent tools, and
  "claude-code" is not one of them — it is the kit's own runtime, so there is nothing to export it to.
  Use `mewkit init / mewkit upgrade` instead. Nothing was written."

**Narrowing still applies:** `mewkit validate --packs` passes **in an installed project**, and
`validate --target codex` (16 passed, 1 warning) and `--target cursor` (3 passed) pass against targets
`init --target` generated in `$TMPDIR`. Making that true required fixing a pre-existing packaging gap —
see Deviations item 11.

### AC-07 — plugin delivery from the provider declarations, mixed install refused · PASS

- **Manifest schema retrieved, not recalled.** `.claude-plugin/plugin.json`, its field table, the standard
  layout, path rules and the replace-vs-add semantics were fetched from the official plugin manifest
  reference and committed verbatim at
  `tasks/reviews/evidence/261108-meowkit-v3-lean-runtime-sprint-6/plugin-manifest-reference-retrieved.md`
  (698 lines). Retrieval route: Context Hub and Context7 both returned nothing for Claude Code plugins, so
  the published reference was fetched directly (`200`, 43 357 bytes). D9's STOP was therefore not triggered.
- From that reference, and asserted in `init-target-delivery.test.ts`: the manifest is written at
  `.claude-plugin/plugin.json`; `name` is the only required key and is kebab-case; **only declared top-level
  keys** are written (an unrecognized key is stripped by the host with a validator warning); and **no
  component path is named at all**, because `commands`, `agents`, `outputStyles`, `workflows`,
  `experimental.themes` and `experimental.monitors` *replace* their default directories when set — the kit
  writes into exactly those defaults, so declaring them would switch the host's own scan off.
- **Single source of truth:** `emit/plugin-manifest.ts` calls `getProjection("claude-plugin")` and derives the
  description from the declaration's own evidence string. The diff introduces **no second** capability,
  lifecycle, operations or invocation table — asserted by grepping both emitter files for
  `discoverable:|selectable:|invocable:|enforceable:` and `CLAUDE_PLUGIN_(LIFECYCLE|OPERATIONS|INVOCATION)\s*[=:]`
  → zero matches, plus a positive assertion that `getProjection(` is called.
- **Declarations stand unchanged:** `status: "supported"`, `bootstrapPlacement:
  "sessionstart-hook-via-plugin-build"`, all four levels `supported` — asserted, and exercised by the install.
- **Mixed install refused, not repaired:** `doctor-kit-checks.ts` `checkMixedDelivery` returns `fail` naming
  both installs and one concrete resolution, and explicitly does not choose.
- **Status claims reconciled:** `README.md:52-63`'s marketplace flow, `marketplace.json` and "staged into each
  release" replaced with `npx mewkit init --target claude-code --delivery plugin` plus an explicit statement
  that there is no `build-plugin` verb, no committed payload and no marketplace publication;
  `vitest.config.ts:34` and `.gitignore:74` reworded off the nonexistent verb;
  `visual-plan.mdx:131` **split** — the plugin half corrected, the marketplace half kept true.
  `grep -rn "build-plugin" README.md vitest.config.ts .gitignore visual-plan.mdx` now matches only the
  README sentence that says the verb does not exist. `check-kit-verbs.cjs` green.
- **Before/after pair captured.** `git diff BASE --stat` over all seven declaration files
  (`provider-projection.ts`, `provider-adapter.ts`, `bootstrap.ts`, `provider-lifecycle.ts`,
  `provider-operations.ts`, `provider-invocation.ts`, `repo-context-adapter.ts`) is **empty** — identical
  input, so identical output, which is the before/after pair in its strongest form. And
  `mewkit providers claude-plugin --lifecycle` on the finished tree exits **0** printing
  `Capability adapter — claude-plugin [supported]`, all four levels `supported`, and
  `bootstrap: sessionstart-hook-via-plugin-build`.
- **End to end:** `init --target claude-code --delivery plugin` in `$TMPDIR` exits 0 and writes
  `.claude-plugin/plugin.json` with `"version": "9.9.9"` (the installed kit version) and only the
  documented keys. A following `upgrade` **keeps** the plugin delivery and re-stamps the version,
  because provenance records the delivery the install chose.
- **Mixed install refused end to end:** `doctor` on a project carrying both reports
  `[FAIL] Delivery shape` naming both installs ("`.claude/skills/`" and "`.claude-plugin/plugin.json`")
  with one concrete resolution and an explicit "This command will not choose for you." The native-only
  project it was copied from reports `[PASS] Delivery shape — Native delivery.`

### AC-08 — provenance recorded for every install shape, and `mewkit versions` reports it · PASS

`packages/mewkit/src/core/__tests__/install-provenance.test.ts`.

- `InstallProvenanceSchema` added as its **own object** in `core/install-metadata.ts`:
  `{kitVersion, cliVersion, target, delivery, origin}`. `version` and `scope` are untouched in name, position
  and meaning — asserted directly, and corroborated by the whole 3296-test suite passing.
- `origin` is a **closed** enum of exactly four values; an out-of-enum value is a Zod validation error
  (asserted both ways).
- A pre-provenance record reads back with `provenance === undefined` and no error; `versions` reports
  `unknown` rather than inventing a value.
- `mewkit versions` is a new verb in `cli/command-catalogue.ts` and dispatched in `index.ts`. Live run in this
  repo prints `CLI 2.3.1 / Kit 2.10.3 / Target unknown / Delivery unknown / Origin unknown`, exit 0.
  `mewkit --help` lists it; `check-kit-verbs.cjs` resolves it (32 subcommands). Exits non-zero naming
  `mewkit init` with no install.
- **End to end, one install per target and delivery**, `mewkit versions --json` in each:

  | Install | Reported |
  |---|---|
  | `init --target claude-code` | `kitVersion 9.9.9, target claude-code, delivery native, origin local-release-dir` |
  | `init --target codex` | `kitVersion 2.3.1, target codex, delivery native, origin local-release-dir` |
  | `init --target cursor` | `kitVersion 2.3.1, target cursor, delivery native, origin local-release-dir` |
  | `init --target claude-code --delivery plugin` | `kitVersion 9.9.9, target claude-code, delivery plugin, origin local-release-dir` |

  All four **survive an `upgrade`** unchanged, and the artifact-origin value is exercised by the
  module-level verified install. For an authored-bundle target the kit version IS the CLI version,
  because that bundle ships inside the CLI package and there is no second thing to version.
- Running this end to end found **three real defects**, all fixed: an upgrade **dropped** provenance
  (the updater rebuilt the record without it); `versions` reported "nothing installed" in a
  provider-only project because it tested for `.claude/`; and provenance was never recorded for an
  external target at all. See Deviations items 8–10.
- `versions` in a directory with no install exits non-zero naming `mewkit init`, and
  `recordProvenance` writes **nothing** there — "has an install" is decided by the target's own
  declared writes, because a file claiming an install exists where none does is worse than no file.

### AC-09 — every exclusion justified by a reader grep, three narrowed by name · PASS

Reader-grep record: `tasks/reviews/evidence/261108-meowkit-v3-lean-runtime-sprint-6/ship-set-reader-greps.md`.
Test: `packages/mewkit/src/kit/__tests__/ship-set-exclusions.test.ts` (5 tests), computed over `git ls-files`
through the real matcher.

- Artifact carries none of `settings.json.bak`, the brand-lint unit (allowlist **and** both shipped scripts),
  `benchmarks/results/`, the eval unit (`.claude/eval/` **and** every `.claude/skills/*/eval/`), any
  `__tests__`/`tests/` directory, or any `*.test.*`.
- `workflow.yaml` **is** present; 35 shipped files read it (`git grep -l`, worktrees excluded).
- The three narrowings asserted by name: `.claude/benchmarks/canary/` and the benchmark README **ship**;
  `.claude/eval/*` and `.claude/skills/*/eval/*` are both in the pattern set; the allowlist and both reader
  scripts are all three in it.
- **Nothing removed from the repo:** `git ls-files` still contains every excluded path; 360 tracked files
  match the excluded patterns; the full CI suite passes on the finished tree.
- No shipped **executable** resolves an excluded path (prose mentions and the exclusion source itself are
  excluded from that check, with the reason stated in the test).

### AC-10 — legacy per-file manifest retired, readers updated, no baseline lost · PASS

- **No writer:** the dual-write at `core/smart-update.ts:518` and `legacyManifestFromInstallMeta` are gone;
  `writeManifest`/`readManifest` removed from `core/compute-checksums.ts`.
- **No install-path reader:** the `legacy-manifest` branch and `readLegacyManifestMetadata` removed from
  `core/install-metadata.ts`; `MetadataSource` is now `"new" | "legacy-metadata" | "none"`.
  `readPriorInstallState` reports "no recorded baseline" instead of guessing — which makes the run protective
  rather than destructive.
- **Three real reference sites updated:** `core/compute-checksums.ts` (keeps only the exported filename for
  its skip set), `core/install-metadata.ts`, `commands/doctor.ts` (now `hasLegacyManifest(...)`). The phase's
  two mistaken readers (`core/release-metadata.ts`, `core/pack-manifest.ts`) correctly left alone.
- **Six test sites updated:** `core/__tests__/{install-metadata,smart-update,smart-update-deletions,smart-update-migration}.test.ts`,
  `tests/smart-update-orphan-callback.test.ts`, and the two `tests/install/*.test.ts` fixture removals (now
  unnecessary, so deleted). New fixture helper `packages/mewkit/tests/helpers/superseded-baseline.ts` — the
  writer lives in test code so "nothing in the shipped tree writes it" stays true.
- **One-shot migration:** `core/legacy-manifest-migration.ts` `migrateLegacyBaseline(root)` carries every
  entry (`sha256` → both `checksum` and `baseChecksum`, so a carried path does not compare as modified on the
  very next upgrade), reports anything it could not carry **by path and reason**, and removes the old file
  **only after** the canonical record is published. Existing canonical entries win over carried ones.
  Called from `commands/upgrade.ts` **after** the snapshot and **before** `smartUpdate`.
- **`doctor` migration-pending:** `checkBaselineMigration` reports the project as owned-but-pending and names
  `mewkit upgrade`, never as unowned or healthy.
- Asserted in `smart-update-migration.test.ts`: the carry runs, carries > 0 entries with zero uncarried, the
  user edit survives, ownership is `meowkit-modified`, and the superseded file is **gone**.
- **End to end in `$TMPDIR`**, on a project whose ONLY baseline is the superseded file (1205 recorded
  paths, canonical record deleted):

  | Step | Result |
  |---|---|
  | `doctor` BEFORE | `[WARN] Ownership record` — "still the superseded meowkit.manifest.json … Run `mewkit upgrade` to carry the baseline forward", with the fix line naming the same command. Not "unowned", not "healthy". |
  | `uninstall --dry-run` BEFORE | **refuses everything**: "No ownership baseline: .meowkit/metadata.json is absent, so which files are the kit's cannot be known." This is exactly the risk the migration exists to prevent. |
  | `upgrade` | `Snapshot …-upgrade — 1206 file(s)` taken FIRST, then "Carried 1205 recorded path(s) into the canonical ownership record", then one path named that it could not carry. Exit 0. |
  | superseded file | **gone** |
  | canonical record | 1117 files, version 9.9.9, provenance present |
  | `doctor` AFTER | `[PASS] Ownership record — Canonical, with no superseded baseline left behind.` |
  | `uninstall --dry-run` AFTER | a real classification: "1082 file(s) would be removed with --yes", plus files listed as "the baseline records it as yours", plus the never-removed state list |

  The classification went from "nothing can be known" to a complete one, so no install loses its
  baseline in the transition.

### AC-11 — projections, validators and the committed checks green · PASS (per Amendment 1)

Everything in the Gate-checks table above passes. Amendment 1 replaced the projection-regeneration leg,
which named a command that does not exist, with the two probes that do:

- `packages/mewkit/scripts/codex-compat-check.mjs` → `Lane: OK`
- `mewkit validate --target codex` → 16 passed, 1 warning, and `--target cursor` → 3 passed, both against
  targets produced by `mewkit init --target codex|cursor` in throwaway `$TMPDIR` projects

`mewkit validate --packs` passes on the finished tree, **in a published kit** (the ship set itself) and
**in an installed project** — the last two required fixing a pre-existing packaging gap, Deviations item 11.
The new environment name `MEOWKIT_KIT_SIGNING_KEY` is classified `credential` with a `readerUnverifiable`
entry stating that its reader lives under `scripts/`, outside the trees the scan walks, deliberately so the
key is unreachable from the installed kit. `check-env-reads.cjs` and the env-universe test both pass
(**138** reads). Skipped-test set unchanged, 19 → 19.

### AC-12 — documentation describes what the CLI now does · PASS (per Amendment 1)

`packages/mewkit/src/cli/__tests__/docs-command-resolution.test.ts` (6 tests).

- All **twelve** pages accounted for: nine updated, `reference/skills/bootstrap.mdx` unchanged-but-current,
  two changelog pages unchanged-and-historical.
- **Resolution, never execution.** Every `mewkit` invocation in a code span or unindented fenced line is
  resolved against `cli/command-catalogue.ts`: zero unresolved verbs, zero unresolved flags across the ten
  current-surface pages. A planted `--no-such-flag` makes the check fail, so it has teeth.
  Two extractor subtleties, both load-bearing: flag names with the same spelling declared on several commands
  are **unioned** (keyed by name alone the last entry wins and `upgrade --list` reads as undeclared), and only
  **unindented** fenced lines count (an indented fence quoting the CLI's own interactive output contains
  "mewkit updated source since last install", which is prose).
- Updated pages state the verified-artifact install, target and delivery, the offline install **and** its
  project-local-cache precondition, and `mewkit versions`.
  Pages: `installation.mdx` (new "Verified install", "Offline install", "What is installed here", "Delivery
  shape" sections), `quick-start.mdx`, `migration.mdx`, `cli/index.mdx` (generated synopsis),
  `cli/commands.mdx` (`upgrade --offline` + a `versions` section), `cli/project-setup.mdx`,
  `reference/configuration.mdx` (`.meowkit/cache/` as the one cache), `workflows/new-project.mdx`,
  `reference/skills/visual-plan.mdx`.
- Verification described as unconditional; asserted that no page documents a bypass
  (`--skip-verif`, `--no-verify`, a skip env var) and none documents a home-directory cache path.
- Asserted that no page names `build-plugin`, `marketplace.json` or `plugin marketplace add`.
- `git diff BASE -- changelog/` and `-- bootstrap.mdx` are **empty** (asserted in the test).
- **Changelog exemption is now contractual.** Amendment 1 exempts the two changelog pages from
  resolution and requires them asserted unchanged by diff instead; the implementation already did exactly
  that, so no change was needed. Confirmed: resolution runs over the ten current-surface pages, and
  `git diff BASE -- changelog/` is empty (asserted in the test). Those pages name verbs that were real
  then and are retired now (`build-plugin`, `index`, `memory`, `orchviz`, `query`, `wiki`); a changelog
  mentioning only surviving verbs would be a false history.

### AC-13 — code quality over the diff · PASS

- **`commands/init.ts`: 1042 at BASE → 1037 final. It SHRANK.** Routing it through the projection removed
  more than the new flags added; the orphan-confirmation prompt moved to `commands/init-orphan-prompt.ts`
  as a unit.
- **No new file exceeds 200 lines.** Largest new file: `kit-tamper-corpus.test.ts` at 175 (it crossed 200
  mid-sprint and the archive-crafting helper was extracted to `tests/helpers/craft-kit-bundle.ts`).
- **No changed file crossed 200 because of this sprint.** `core/github-releases.ts` crossed (152 → 237) and
  was split: `kit/extract-release-zip.ts` and `kit/select-release-assets.ts` extracted, leaving it at **185**.
- Files already over 200 at BASE that grew, by name:

  | File | BASE | Final |
  |---|---|---|
  | `env-name-classification.json` | 630 | 637 |
  | `packages/mewkit/src/commands/upgrade.ts` | 470 | 527 |
  | `packages/mewkit/src/index.ts` | 525 | 535 |
  | `packages/mewkit/src/commands/doctor.ts` | 420 | 425 |
  | `packages/mewkit/src/cli/command-catalogue.ts` | 320 | 329 |
  | `packages/mewkit/src/core/__tests__/install-metadata.test.ts` | 264 | 268 |
  | `packages/mewkit/src/migrate/migrate-orchestrator.ts` | 755 | 763 |

  `upgrade.ts` is 527 after the three preflight legs moved to `commands/upgrade-preflight.ts` (96 lines).
  Five shrank: `commands/init.ts` 1042 → **1037**, `core/smart-update.ts` 624 → 605,
  `core/install-metadata.ts` 273 → 260, `core/compute-checksums.ts` 155 → 145,
  `migrate/modules/codex-reconcile-apply.ts` 327 → 309.
- No `any`, no unsafe cast, no `@ts-ignore`, no `eslint-disable` in any added line or new file (greps over
  `git diff BASE -- '*.ts'` and over every new source file).
- No new TODO/FIXME, no commented-out code, no unused import (lint clean in every touched file), no hardcoded
  secret, no key material (`git diff BASE` → 0 matches for a private-key header).
- **No plan-artifact reference** in any new code comment, test name or file name: greps for phase numbers,
  criterion identifiers, decision numbers, "sprint", "round" and "amendment" over every new source file
  return nothing. Two such references were introduced and removed during the work.
- Kebab-case file names throughout.
- `pnpm lint` 0 errors, `pnpm typecheck` 0 errors.

### AC-14 — every refusal names the check, the subject and the next action · PASS

`packages/mewkit/src/kit/kit-refusal.ts` is a closed `KitCheck` union with one `WHAT_FAILED` and one
`NEXT_ACTION` string per check, composed by `refusalMessage(check, version, subject)` into
"Kit `<v>` was not installed: `<what failed>` (`<subject>`). The install was stopped rather than downgraded to
an unverified source, so nothing was written. `<next action>`".

| Message | Where | Checked |
|---|---|---|
| 10 tamper refusals | `kit-refusal.ts` | `kit-tamper-corpus.test.ts` — failed check, subject, "stopped rather than downgraded", and no stack frame / class name / temp path |
| present-but-bad artifact | same | `artifact-precedence.test.ts` — states the install was **stopped**, not downgraded |
| empty keyring | `kit-signature.ts` | `kit-signing.test.ts` — "no trusted kit signing key", remedy is to upgrade the CLI |
| offline cache miss | `kit-offline.ts` | `kit-offline-cache.test.ts` — names **both** `MEOWKIT_RELEASE_SOURCE` and `mewkit upgrade`, plus "No network request was made" |
| quarantined-failure report | `kit-offline.ts` | `kit-offline-cache.test.ts` — reports rather than installs |
| unknown target | `init-target-delivery.ts` | lists the three valid values + "Nothing was written" |
| `--delivery` on the wrong target | same | "meaningful for --target claude-code only" + "Nothing was written" |
| unknown `--delivery` | same | lists `native, plugin` |
| `migrate claude-code` | `commands/migrate.ts` | run live: "is not one of them — it is the kit's own runtime" + names `mewkit init / mewkit upgrade` |
| mixed install | `doctor-kit-checks.ts` | names both installs + one concrete resolution, no repair |
| uninstalled `mewkit versions` | `commands/versions.ts` | names `mewkit init`, exit 1 |
| migration-pending | `legacy-manifest-migration.ts` | names `mewkit upgrade` and that it snapshots first |

Signature failures are three distinct checks (`signature-absent`, `signature-malformed`,
`signature-untrusted-key`) because the remedies differ; digest failures name the subject file. The
verification-failure record is asserted to contain no key material and no long base64 run.

All twenty enumerated messages are now present and exercised: the ten tamper refusals, the
present-but-bad artifact, the empty keyring, the offline cache miss, the quarantined-failure report, the
unknown target, the `migrate claude-code` refusal, the misplaced `--delivery`, the mixed install, the
uninstalled `mewkit versions`, and the migration-pending finding — with the last six confirmed against the
built CLI in `$TMPDIR` rather than only in a unit. Two further refusals the projection adds carry the same
shape: an emit with no release resolved ("needs an extracted release") and one with no authored bundle
("needs its authored bundle"), both raised instead of writing a partial target.

## Review round 3 — findings fixed

The review returned FAIL on Correctness with two Major findings. Both are fixed, with the coverage
holes that let them through closed in the same change.

### C6 — both release pipelines could not publish · FIXED

`KIT_VERSION` resolved to `github.ref_name`, because neither workflow declared the
`workflow_dispatch` input the expression's first operand named. So the value was always a branch
name — `main` or `dev` — which the artifact build rejects, and the step is deliberately fail-closed,
so every release run failed before `semantic-release` could publish anything.

Fixed in three parts:
- `scripts/kit-version.cjs` (new) holds the kit's version **and** the one definition of what a kit
  version looks like. Root `package.json` is the single source of truth — `scripts/release.sh:52-59`
  refuses a release that disagrees with it and `scripts/sync-versions.cjs` stamps it onward — so the
  fallback reads it from there instead of guessing from a ref.
- `scripts/build-kit-artifact.cjs:69` now tests against the **exported** `KIT_VERSION_PATTERN` rather
  than its own copy of the regex, so the fallback and the rejection cannot disagree.
- Both workflows declare `workflow_dispatch.inputs.version` (optional), add a
  `Resolve kit version` step with `id: kit-version`, and pass
  `${{ inputs.version || steps.kit-version.outputs.version }}`. The step keeps **no** `if:`, no
  `continue-on-error`, no `|| true` and no `set +e`.

Verified: `node scripts/kit-version.cjs` → `2.15.0`; `build-kit-artifact.cjs main` → exit 1
`Invalid version format: main`; `build-kit-artifact.cjs 2.15.0` gets past the version guard and
stops at the absent signing key, which is the correct next refusal.

### V6 — the test asserted the step's text, never its expression · CLOSED

`kit-release-wiring.test.ts` gained a `describe` block that parses the `KIT_VERSION` expression,
splits its operands, and for each one checks what it can actually produce:
- no operand may name `ref_name`, `ref`, `sha`, `head_ref` or `base_ref` — this assertion fails on
  the old form;
- operand 1 must be `inputs.version` **and** the workflow must declare that input as optional, since
  an undeclared input is always empty and makes the fallback unconditional;
- operand 2 must be `steps.kit-version.outputs.version`, the producer step must exist with that `id`
  and write to `$GITHUB_OUTPUT`, and its value is resolved by **running the committed script**, then
  fed to the build script's own validator and to the build script itself;
- a positive control asserts `main` and `dev` are still rejected by both, so the check cannot pass by
  the guard having stopped biting.

### C7 — a 100-byte member path was silently truncated · FIXED

`writeString` reserved a terminator byte for every field, which is right for the numeric ustar fields
and wrong for `name` and `prefix`, which are not NUL-terminated when full. A 100-byte path was written
as 99, and because the manifest is derived from the archive that was just built, the truncated name is
what gets hashed, listed and signed — verification would pass on an artifact that installs one file at
the wrong path and leaves the right path missing. That is exactly what the writer's own comment said it
refuses.

Fixed in `scripts/kit-tar-writer.cjs`: the helper is split into `writeTerminated` (numeric fields,
`length - 1`) and `writeName` (`name` and `prefix`, full width, and **raises** on a value that does not
fit rather than shortening it). `NAME_FIELD` / `PREFIX_FIELD` are named constants, the split search
bound is corrected to 155, and the byte-vs-code-unit guard carries a comment saying it fires for
non-ASCII paths (S22).

Verified through the shipped reader (`readKitArchive`), not a local parser: 99, 100 and 101-byte paths
round-trip exactly; a 189-byte path needing the prefix field round-trips; a 151-byte path with no legal
split point raises; a 110-byte base behind a legal prefix raises.

### V7 — no test pinned the name-field boundary · CLOSED

`kit/__tests__/kit-tar-member-path.test.ts` (new, 90 lines) pins the boundary: 99/100/101-byte
round-trips, a prefix-split round-trip, and two refusal assertions — all through the shipped
`readKitArchive`, so a round-trip means the writer and the install's reader agree. The 100-byte case
is the one that failed before the fix. It is its own file because adding it to
`kit-artifact-build.test.ts` pushed that file to 220 lines, over the 200-line guard, and these
assertions need neither the signing key nor the release fixtures the build tests build.

### C9 — the ship set published this repository's own plan artifacts · FIXED

`.meowkit/pack-manifest.json` `base.exclude` gained `tasks/contracts/*.md`, `tasks/plans/*.md` and
`tasks/plans/*/*` (27 → **30** patterns). The ship set drops from 1247 to **1226** files; the only
things still shipping under those two directories are `tasks/contracts/.gitkeep` and
`tasks/plans/.gitkeep`, so each keeps a home for run output written later. `tasks/templates/` — the
reason `tasks/` is archived at all — is unaffected.

`ship-set-exclusions.test.ts` gained the converse assertion the reviewer asked for: no `tasks/` run
output ships, checked as a property of the computed set rather than per pattern, because `tasks/` is
archived WHOLE and anything new dropped under it ships by default. Verified end to end: a fresh
`init` in `$TMPDIR` yields empty `tasks/contracts/` and `tasks/plans/`, and `validate --packs` passes
in the ship set and in the installed project.

### W4 — `upgrade.ts` had taken +102 lines · FIXED

The offline refusal, the baseline carry-forward and the provenance re-stamp moved to
`commands/upgrade-preflight.ts` (96 lines) as four named functions — `offlineRefusal`,
`carryBaselineForward`, `readInstalledShape`, `restampProvenance`. `upgrade.ts` is **572 → 527**.
No behavior change; the full suite is green and the end-to-end upgrade legs were re-run.

### S21 — the `pack.ts` exception now records its reason where someone would violate it · FIXED

`commands/pack.ts:168` carries the invariant inline: the shared projection exists so the three
install entry points cannot disagree about what a target's shape IS, and this adds a named **subset**
to a shape already on disk, bounded by `allowedPaths` with deletion off — so routing it through the
projection would make a partial write look like one of those three full ones.

### C8 — not fixed, by scope

Left as the contract scopes it. No upload step and no semantic-release config, so no release carries
the three assets and every install keeps taking the legacy zip path. The reviewer's FAIL condition for
C8 is a **documentation claim that users receive verified installs today**, so the three pages that
made that claim in the present tense were corrected: `installation.mdx` now opens its "Verified
install" section with a "Not live yet" callout naming the two missing pieces (no artifact on any
release, no key in the CLI) and pointing at `mewkit versions` for the origin a project actually used;
`quick-start.mdx` and `workflows/new-project.mdx` are reworded to "once releases carry the signed kit
artifact … no release carries it yet". Grepped: no page claims a live verified install.

S19, S20, S23, S24 and S25 are left for a follow-up. S24 (the env-read count) is corrected in the
gate table above.

## Deviations

Items 1–3 of the previous round are **closed**: AC-06 is implemented, the command-level legs run end to end
in `$TMPDIR`, and the AC-12 changelog narrowing is now contractual (Amendment 1).

1. **`commands/pack.ts` is a named exception to the one-writer rule.** `pack add|remove` calls `smartUpdate`
   directly to re-lay a pack SUBSET of an already-installed target. It is not one of the three install entry
   points whose agreement the projection guarantees, so routing it would widen AC-06's declared entry-point
   set and change its "eight combinations" count. It is listed by name in
   `emit/__tests__/one-emitter-path.test.ts` (`NAMED_EXCEPTIONS`) rather than matched by a loose pattern, so
   a reader can see and argue with it. **Recommended follow-up:** either route it as a fourth entry point or
   record why a subset re-lay is a different operation.

2. **`migrate codex` and `migrate cursor` exit 1 on a pre-existing, unrelated defect.** Both reach the
   projection — the log shows `[+] Applied 10 authored codex artifact(s)` — and then one artifact fails:
   `codex/config/CLAUDE: Unsafe path: target escapes <project>`. Diagnosed: `migrate` computes the
   **global** config path (`~/.codex/AGENTS.md`) during a **project**-scoped run, and the path guard
   correctly refuses it. The guard refusing is desirable behavior — it stopped a throwaway project's export
   from writing into the operator's real home directory. Not introduced here:
   `portable-installer.ts`, `provider-registry-utils.ts` and `provider-registry.ts` are all
   `git diff BASE` **unchanged**, and the guard's project-scope default is byte-identical to BASE (the only
   change is an added optional `boundary` parameter). Reproduced with and without a root `CLAUDE.md`.
   **Out of scope** (migrate's scope selection), and worth its own fix.

3. **Archive member mode is derived from content, not preserved from disk** — recorded in Amendment 1.
   `0755` when the file starts with `#!`, else `0644`, because AC-01 requires a `chmod` perturbation to leave
   the digest equal. Two shipped files lose an execute bit they do not need
   (`.claude/hooks/handlers.json`, `.claude/hooks/HOOKS_INDEX.md` — data and an index). Every
   shebang-bearing script keeps it.

4. **`base.exclude` is optional in the schema, required by both builders** — recorded in Amendment 1.
   Making it required broke five suites whose synthetic fixtures describe an *installed* project, which
   publishes nothing. Both archive builders throw when it is absent, so the one-source property is enforced
   where a release is cut.

5. **Static checks are asserted on code, not on prose.** Four checks had to be rewritten after matching
   their own explanatory comments (the workflow's continue-on-failure forms, `extractAllTo`, the
   "nothing is spawned" claim, and the brand-allowlist reader scan). Each now strips comments or matches
   call syntax. Flagged because the first drafts *passed for the wrong reason*.

6. **`mewkit doctor --hard-gates` shows 7 FAILs in this operator's shell** from exported variables the tree
   has retired. Under `env -i` it is 26 passed / 5 warnings / **0 FAIL**. Environment, not tree, and present
   at BASE.

7. **No commits**, per instruction. The whole change is in the working tree.

### Defects found by running end to end, and fixed

Driving the real commands surfaced four things no module-level test had caught. Each is a behavior fix, not
a test adjustment.

8. **An upgrade dropped provenance.** `smartUpdate` rebuilds the install record by hashing the tree, and the
   record it built carried no `provenance` — so every upgraded project reported `target: unknown`, and a
   plugin-delivered project looked native again. Fixed: the updater carries the prior provenance forward
   (`core/smart-update.ts`), and `upgrade` re-stamps it with this run's kit version and origin
   (`commands/upgrade.ts`). Verified: all four installs keep their provenance across an upgrade, and the
   plugin project keeps its delivery and gets the new version stamped into `plugin.json`.

9. **`versions` reported "nothing installed" in a provider-only project.** It tested for `.claude/`, which a
   `codex`- or `cursor`-only install does not have — making the command useless in exactly the projects whose
   target is worth asking about. Fixed in `commands/versions.ts`.

10. **Provenance was never recorded for an external target.** `recordProvenance` required an existing
    canonical record, which only a `claude-code` install writes. Fixed: it now writes a record when the
    target's **own declared writes** are present (`emit/target-shape.ts`), with an empty `files` list because
    per-file ownership for those targets lives in the provider ledger. A directory with neither a record nor
    any of the target's writes still gets nothing — a file claiming an install exists where none does is
    worse than no file.

11. **A published kit could not pass its own pack check.** The governance registry
    `harness-inventory.json` moved from `.claude/` to `.meowkit/` in an earlier sprint, but the archive
    target list and the installer's `.meowkit/` file list never followed — so a release stopped carrying it,
    and an installed project reported all 233 artifacts as belonging to no pack while the source tree it came
    from passed. The pack manifest's own `base.files` has declared it shipped content all along: two
    declarations about one file, and only one was honored. Fixed in the single ship-set source
    (`scripts/kit-ship-set.cjs`) and in `KIT_MEOWKIT_FILES` (`core/install-meowkit-dir.ts`).
    Pre-existing — `ARCHIVE_TARGETS` was copied verbatim from the BASE zip build, so the legacy zip never
    shipped it either. Verified: `validate --packs` now passes on the finished tree, in the ship set itself,
    and in an installed project.

### Fixture caveat (not a product defect)

The `$TMPDIR` release fixture is materialized from the live ship set, but its `release-manifest.json` is the
repository's committed copy, which lists 1272 files against the fixture's 1247. Re-running `init` in an
already-installed project therefore sees the difference as orphans and reaches the orphan prompt, which needs
a TTY. A real release regenerates `release-manifest.json` to match what it ships, so this is a property of
the fixture. It is why the mixed native+plugin `doctor` probe builds that state directly instead of by a
second `init`.
