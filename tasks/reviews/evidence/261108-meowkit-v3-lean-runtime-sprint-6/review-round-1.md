# Review: MeowKit v3 Lean Runtime — Sprint 6, "signed kit artifact and one shared emitter path"

## Verdict: FAIL

**This file is EVIDENCE for a human. It approves nothing.** Gate 2 is NOT approved and cannot be
approved by this file, by any agent, or by any script. Only a human clears a gate
(`gate-rules.md`, "The Gate Authority Invariant").

**One release-blocking Major defect. One latent Major defect. No security hard-stop — the security
work in this sprint is the strongest in the plan so far and I could not break it.**

The verification design is genuinely good. Verify-before-extract is structural rather than
conventional, both extract paths go through one guard, the trust root ships with the engine, the
empty keyring refuses instead of accepting, and nothing from the artifact is executed. I probed each
of those and they hold. The reason this verdict is FAIL is narrower and more mundane: **the release
step that is supposed to produce the artifact cannot succeed even once**, and because the step is
(correctly) fail-closed, it now blocks both publish pipelines.

- **C6 (Major, release-blocking).** `KIT_VERSION: ${{ github.event.inputs.version || github.ref_name }}`
  in both workflows. Neither workflow declares a `workflow_dispatch` input named `version`, so the
  expression always falls through to `github.ref_name` — `main` for stable, `dev` for beta — and
  `build-kit-artifact.cjs:65` rejects both against its version regex and exits 1. I ran the real
  script with each value: `Invalid version format: main` / `Invalid version format: dev`, exit 1.
  The step carries no `if:` and no `continue-on-error` (correctly, and asserted), so that exit fails
  the job **before** `npx semantic-release` — no npm publish, no GitHub release, for either channel.
  Two working release pipelines become two that cannot publish at all.
- **C7 (Major, latent).** `kit-tar-writer.cjs:36-38` writes at most `length - 1` bytes into a ustar
  name field. For the 100-byte name field and the 155-byte prefix field that is one byte short, and
  `header()`'s own guards admit exactly that boundary (`> 100`, `> 155`). A repo-relative path of
  exactly 100 bytes is therefore **silently truncated to 99** and ships under the wrong name —
  precisely what the comment at `:40-44` promises it refuses. Proven, not reasoned: a 100-byte path
  is recorded as 99 bytes, `MATCH: false`. Dormant today (longest shipped path is 90 bytes, 10
  characters of headroom) and invisible when it fires, because the manifest is derived from the
  archive, so the truncated name is what gets signed and verified.

Beyond those, the sprint delivers what it claims. I reproduced the whole gate independently and the
developer's numbers hold (3307 tests, one more than the claimed 3306).

## Binding

| Field | Value |
|---|---|
| Reviewed revision (`git rev-parse HEAD`) | `2b93b425170216ca9fdf28f211c3a2d3d0b398f9` (branch `feat/v3-lean-runtime`) |
| Reviewed content | **The UNCOMMITTED working tree on top of that commit**, excluding `tasks/plans/`. Every commit since BASE is a contract signature/amendment commit; the entire implementation is unstaged or untracked. The named SHA is the base the working tree sits on, NOT a commit containing the reviewed change. |
| Sprint base (BASE) | `56488bc520f6a042472c8b4e6259d9ff0bdae863` — pinned by the contract |
| Diff shape | 40 tracked files changed (+689 / −308), 0 tracked deletions, 47 untracked new source/script/test files plus 4 untracked evidence files |
| Contract | `tasks/contracts/261108-2347-meowkit-v3-lean-runtime-sprint-6.md` — signed at `678f37f2`, Amendment 1 re-signed at `2b93b425`, 14 ACs, D1–D14 |
| Implementer evidence read as CLAIMS | `tasks/reviews/evidence/261108-meowkit-v3-lean-runtime-sprint-6/` — `evidence.md` (AC-01…AC-14, deviations 1–11), `kit-artifact-inventory.md`, `plugin-manifest-reference-retrieved.md`, `ship-set-reader-greps.md` |
| Orchestrator rulings applied | `migrateLegacyBaseline` must carry `meta.settings` (verified present, `core/legacy-manifest-migration.ts:174`); `commands/pack.ts` stays a named exception to the one-writer rule (reason judged below) |
| Known out-of-scope carried as follow-ups, not graded | `migrate codex\|cursor` computing the global `~/.codex` path in a project-scoped run; `upgrade` not refreshing `pack-manifest.json` / `harness-inventory.json`; the one-level `pnpm lint` glob |
| Scope gate | **full** |
| Review artifacts | This markdown section ONLY. No source edited, no git mutation, no staging. One read-only probe script written to the session scratchpad, never into the repo. |
| Score | 7.4/10 — Major (2), Critical (0), four WARNs. 13 of 14 ACs met as written; AC-01's workflow leg is met in text and broken in execution. |

## Dimension Summary

| Dimension | State | One-line basis |
|---|---|---|
| Correctness | **FAIL** | C6 makes both release workflows fail on every run, blocking `semantic-release`; C7 silently truncates a 100-byte member path, contradicting the writer's own documented contract |
| Maintainability | WARN (1) | no `any`, no unsafe cast, no `@ts-ignore`, no `eslint-disable`, no plan-artifact reference anywhere; every new file under 200 lines; W4 is `upgrade.ts` taking +102 lines on a file already 2.9× the limit |
| Performance | PASS | verification is two sha256 passes plus one gunzip over a ~1250-file archive, bounded by the install it replaces; the emitter adds one in-process array push per passage |
| Security | PASS | verify-before-extract is structural; one traversal guard serves both extract paths; no runtime way to add a trusted key; empty keyring refuses; zero private-key matches in the diff; nothing from the artifact is executed; workflow step fail-closed |
| Coverage | WARN (2) | 3307/3307 green and the tamper corpus is real adversarial work, but V6 is the exact hole C6 walked through — the release-wiring test asserts the step's *text* and never evaluates its version expression |

## Gate Authority — standing checklist item

> Does any prose in this change grant approval authority to something that is not a human — in any
> wording?

**No, and the question is N/A by scope.** This change touches **zero** files under `.claude/rules/`,
`.claude/rules-conditional/`, `.claude/modes/`, `.claude/agents/`, `.claude/skills/cook/`,
`.claude/skills/fix/` or `.claude/skills/autobuild/` — in fact zero files under `.claude/` at all. I
confirmed by intersecting the full change set against those paths: empty. `validate --gates` passes
(2 passed), but I am not resting the answer on the lint, per the checklist.

Separately confirmed on the standing naming rule: **no new code comment, test name or file name
references a plan artifact.** I grepped every new and changed `.ts`/`.cjs`/`.js`/`.json`/`.yml` file
for phase numbers, `AC-nn`, `D-nn`, "sprint", "round", "amendment" and "red-team". The only hits are
pre-existing and unrelated — `mk:sprint-contract` is a skill name in `.meowkit/pack-manifest.json`,
and the "Phase 2/3/4" strings in `commands/init.ts:964,977,1005` are the installer's own interactive
wizard steps. I verified none of those lines is added by this diff.

## Correctness — FAIL

### [C6 — MAJOR, blocking] The artifact step cannot succeed in either workflow, and it fails the job

`.github/workflows/release.yml:58` and `.github/workflows/release-beta.yml:58`:

```yaml
KIT_VERSION: ${{ github.event.inputs.version || github.ref_name }}
```

Neither workflow declares any `workflow_dispatch` input (`release.yml:6` and
`release-beta.yml:6` are bare `workflow_dispatch:` with nothing beneath them). So
`github.event.inputs.version` is always empty and `KIT_VERSION` always resolves to
`github.ref_name`:

| Workflow | Trigger | `KIT_VERSION` | `build-kit-artifact.cjs` result |
|---|---|---|---|
| `release.yml` | `workflow_dispatch` on `main` | `main` | exit 1 — `Invalid version format: main` |
| `release-beta.yml` | `push: [dev]` | `dev` | exit 1 — `Invalid version format: dev` |
| `release-beta.yml` | `workflow_dispatch` on `dev` | `dev` | exit 1 — `Invalid version format: dev` |

Verified by running the real script with each value, not by reading the regex. The guard is
`scripts/build-kit-artifact.cjs:65-68`, and it fires **before** `signingKeyFromEnv()` at `:74`, so
the job does not even reach the secret.

The fail-closed property is what makes this total rather than silent. The step deliberately carries
no `if:`, no `continue-on-error`, no `|| true` — correct, and asserted by
`kit-release-wiring.test.ts:49-61`. Consequence: the step fails, the job fails, and
`npx semantic-release` (`release.yml:61`, `release-beta.yml:61`) never runs. **No npm publish and no
GitHub release on either channel, for every run, from the moment this lands.** The sprint converts
two functioning publish pipelines into two that cannot publish.

The contract's AC-01 leg — "both release workflows carry the artifact step, each still triggered only
by `workflow_dispatch` (stable) or `push: dev` plus `workflow_dispatch` (beta)" — is satisfied as
*text*. It is not satisfied as *behavior*, and the AC's purpose ("so no merge path is affected")
reads as a statement that the step is safe to add, which it is not in its current form.

**Fix.** Declare the input and give the fallback a value the script accepts. Minimal form, both
workflows:

```yaml
on:
  workflow_dispatch:
    inputs:
      version:
        description: Version to build the kit artifact for
        required: false
```
…and replace the `KIT_VERSION` expression with one that cannot resolve to a branch name — read the
version from `package.json` (`${{ fromJSON(...) }}` or a prior `id:` step emitting an output) and use
`github.event.inputs.version` only as an override. Then add the V6 test below, so the expression is
checked against the script's own validator rather than against a substring.

**Note the deeper ordering question this exposes, which is design, not a defect to fix blind:** the
artifact is built *before* `semantic-release`, but `semantic-release` is what decides the version
being released. Any value available at step time is a guess at the version the release will carry.
Building the artifact *after* `semantic-release` — or having `semantic-release` invoke it — is
probably the right shape, and it is the same change that would fix C8 below.

### [C7 — MAJOR, latent] A 100-byte member path is silently truncated, which the writer says it refuses

`scripts/kit-tar-writer.cjs:36-38`:

```js
function writeString(block, value, offset, length) {
	block.write(value.slice(0, length - 1), offset, length - 1, "ascii");
}
```

`length - 1` is right for the numeric ustar fields (7 octal digits + NUL in 8 bytes), and
`header()` uses the same helper for the **name** (`:58`, 100 bytes) and **prefix** (`:71`, 155 bytes)
fields, which in ustar are not NUL-terminated when full. The guards at `:49-56` admit exactly the
boundary that then truncates:

- non-split branch: `Buffer.byteLength(name) > 100` is false at 100, so a 100-byte name is written as 99;
- split branch: `Buffer.byteLength(base) > 100` is false at 100, same outcome for the base component.

Proven, not inferred — I built a one-member archive through the real `buildTar` with a 100-byte path:

```
name bytes: 100
recorded in header: ".claude/aaa…aaa.m"      ← 99 bytes
MATCH: false
```

The `.md` became `.m`. Nothing downstream catches it, because `build-kit-artifact.cjs:83` derives the
manifest from `readTarMembers(tar)` — the truncated name is what gets hashed, listed and signed, so
verification passes and the installed project simply has one file at the wrong path and one expected
path missing. This directly contradicts `kit-tar-writer.cjs:40-44`: "a path too long for even that is
**refused rather than silently truncated to a different file**."

**Why it is Major and not Critical:** dormant today. I computed the real ship set (1247 files) — the
longest repo-relative path is **90 bytes**, and zero paths are at 100 or above. But 10 characters of
headroom is thin for a tree whose paths are `.claude/skills/<long-skill-name>/references/<long-file-name>.md`,
and the failure mode when it fires is a silently mis-installed file inside a signed artifact.

**Fix (small).** Either make the name/prefix fields write their full width —

```js
function writeField(block, value, offset, length) { block.write(value.slice(0, length), offset, length, "ascii"); }
```
used for offsets 0 and 345 while the octal fields keep `writeString` — or, if you prefer the refusal
the comment already promises, tighten the guards to `>= 100` / `> 154` and let `header()` throw. Add a
unit asserting that a 100-byte path either round-trips exactly or raises; today it does neither.

### [C8 — WARN] Nothing publishes the artifact, so the verified path is unreachable in production

The step writes three files into the runner's `dist/`, and **no step uploads them.** There is no
semantic-release config file in the tree (I looked: no `.releaserc*`, no `release.config.*`, no
`"release"` key in `package.json`), so `npx semantic-release` publishes no assets. The only path that
actually attaches an asset to a release is the human-run `scripts/release.sh:81`, which calls
`prepare-release-assets.cjs` and **never** `build-kit-artifact.cjs`. The runner then exits and `dist/`
is discarded.

Consequence, assuming C6 is fixed: `kitArtifactAssets()` (`kit/select-release-assets.ts:30-34`)
requires all three asset names to be present, so `release.kitArtifact` is `null` on every real
release, `core/github-releases.ts:138` is never reached, and every install keeps taking the legacy zip
path. The sprint's headline capability has no production delivery route.

**Three-part acknowledgement, which is why this is WARN and not part of the FAIL:**
1. *What it means:* the signed-artifact install is complete and correct but unreachable by a real
   user, because no release will ever carry the three assets it needs.
2. *Why acceptable here:* the contract scoped this out explicitly. Its pinned baseline records that
   "there is no semantic-release config file anywhere, so the release workflows publish no asset at
   all", and AC-01 asks only that "both release workflows carry the artifact step". With the keyring
   committed empty (D1), a present artifact must refuse end to end anyway — so publishing it today
   would brick installs rather than enable them. The ordering is deliberate: engine first, then key,
   then publication.
3. *What would make it FAIL:* any claim — in docs, release notes or a verdict — that users receive
   verified installs today; or the keyring gaining a key while no upload step exists, which would make
   the feature look live and still never engage.

**Follow-up, and the one I would most like taken:** add the upload in the same change that adds the
key, and wire it where the version is already known (after `semantic-release`, or inside
`release.sh` next to the zip upload). Until then, `installation.mdx`'s "Verified install" section
describes a path no release exercises.

### [C9 — WARN] The ship set publishes this repository's own plan artifacts

`.meowkit/pack-manifest.json` `base.exclude` (27 patterns — 17 carried + 10 added) excludes
`tasks/reports/*`, `tasks/reviews/*.md` and `tasks/reviews/evidence/*`, with the stated reason that
verdicts and evidence "are run output, not templates". Computing the real ship set through the shipped
matcher, the published kit still carries, under `tasks/`:

| Path | Files shipped |
|---|---|
| `tasks/contracts/` | 7 — including all six signed `meowkit-v3-lean-runtime-sprint-*.md` contracts |
| `tasks/plans/261101-meowkit-v3-lean-runtime/` | 16 phase files |

Same category as the verdicts and evidence the sprint just excluded for being run output, and
considerably larger. Every user who installs MeowKit receives MeowKit's own internal sprint contracts
and phase plans in their project tree.

**Three-part acknowledgement:**
1. *What it means:* the ship set is inconsistent with its own stated inclusion rationale; internal
   development artifacts ship as if they were templates.
2. *Why acceptable here:* pre-existing — `tasks` was archived whole at BASE with the same inclusion
   rule, so the sprint neither introduced nor widened it, and AC-09 governs *exclusions*, not
   inclusions. No secret and no vulnerability detail is exposed: `tasks/reports/*` (Security Posture
   Reports) is excluded and I confirmed it does not appear in the computed set.
3. *What would make it FAIL:* a contract or plan file carrying a credential, an internal host name, or
   unpatched vulnerability detail — none do today, but nothing enforces that, and the exclusion set is
   the only thing standing between `tasks/` and a public release asset.

**Fix (one line each):** add `tasks/contracts/*` and `tasks/plans/*` to `base.exclude`, keeping the
`.gitkeep` entries so the directories still ship with a home. Then extend
`ship-set-exclusions.test.ts` with the converse assertion the sprint already applies to reviews — that
no run-output directory under `tasks/` reaches the artifact.

### What I re-verified as correct

I reproduced the gate independently rather than reading the table. Every developer claim I checked
held, within rounding:

| Check | Claimed | Reproduced |
|---|---|---|
| `pnpm build` | exit 0 | exit 0 |
| `pnpm lint` | 0 errors / 3 pre-existing warnings | 0 errors / 3 warnings, exactly `capabilities.ts:7`, `orient.ts:8`, `validate.ts:447` — none in a file this sprint touched |
| `pnpm typecheck` | exit 0 | exit 0, 0 errors |
| `pnpm test` | 286 files / 3306 tests / 0 failed | **286 files / 3307 tests / 0 failed** (one more than claimed; harmless drift) |
| `node --test .claude/hooks/__tests__/*.test.cjs` | 36 pass / 0 fail | 36 pass / 0 fail |
| `scripts/check-kit-verbs.cjs` | PASS, 187 refs / 32 subcommands | PASS, 187 / 32 |
| `scripts/check-env-reads.cjs` | PASS, 140 reads | PASS, **138** reads (evidence nit; the check passes either way) |
| built-CLI `validate --gates` | pass | 2 passed |
| built-CLI `validate --packs` | pass | 1 passed |

Also verified directly, each against the code rather than the claim:

- **Verify-before-extract is structural.** `verifyKitArtifact` (`kit/verify-kit-artifact.ts:48-91`)
  returns contents; `extractVerifiedArchive` (`:99-113`) is the only writer; staging is `mkdtemp`-ed
  only after every check passes (`kit/resolve-kit-content.ts:56-61`). There is no path to the
  filesystem that skips the checks, and `storeArtifact` runs only after extraction succeeds (`:62`),
  so the cache can hold nothing unverified.
- **Check order is defensible.** Signature over manifest bytes → manifest shape → artifact digest →
  readability → member paths → per-file digests both ways. A lenient manifest cannot pass every file,
  because `KitManifestSchema.files` is `.min(1)` (`kit/manifest.ts:36`) and the version must match the
  request (`:58-60`).
- **Both-ways file check is real**, not a one-sided loop: `file-unexpected` for a member with no
  entry (`:79`), `file-missing` for an entry with no member (`:87`).
- **The emitter projection genuinely is the one writer.** `emit/emit-target.ts:90-136` dispatches on
  the *shape's* declared source, not the entry point, and records every passage;
  `one-emitter-path.test.ts:117-131` greps `init.ts`, `upgrade.ts` and `migrate-orchestrator.ts` for
  all three per-target writers and the whole `src/` tree for callers. I confirmed independently that
  `commands/pack.ts:168` is the only non-projection `smartUpdate(` call site in the tree.
- **The orchestrator's `meta.settings` fix is present and correct.**
  `core/legacy-manifest-migration.ts:174` carries `settings` forward alongside `scope`, `profile`,
  `packs` and `provenance`; `version` and `scope` are preserved by name and position (`:167,170`).
  The ordering at `:164-178` — write canonical record, *then* `removeLegacyManifest` — makes an
  interrupted migration leave the old baseline rather than none, which is the protective direction.
- **`baseChecksum` fallback is the right call** (`:109`): carrying `sha256` into both fields stops
  every carried path comparing as modified on the next upgrade.

## Maintainability — WARN (1)

Clean by every mechanical measure I could apply. Over the whole diff and every new source file:
**zero** `any`, `as any`, `@ts-ignore`, `@ts-expect-error` or `eslint-disable`; zero new TODO/FIXME;
zero unused imports (lint clean in every touched file); zero hardcoded secrets; **zero** private-key
matches. Kebab-case throughout. No new file exceeds 200 lines — the largest is
`kit-tamper-corpus.test.ts` at 175, and `commands/init.ts` *shrank* (1042 → 1037) while gaining two
flags, which is the shape of a genuine extraction rather than an addition.

The module comments are unusually good and worth saying so: `trusted-keys.ts:1-17` explains why the
trust root ships with the engine, `resolve-kit-content.ts:11-19` states the *cost* of the no-fallback
rule rather than only its benefit, and `safe-extract.ts:3-10` explains why there is deliberately only
one traversal guard. Each of those is the kind of comment that survives a refactor because it records
a decision, not a mechanism.

### [W4 — WARN] `upgrade.ts` took +102 lines on a file already far over the limit

`packages/mewkit/src/commands/upgrade.ts` — 470 at BASE → **572** now, against the 200-line guidance
in `development-rules.md`. It absorbed three separable new responsibilities this sprint: the
`--offline` refusal (`offlineRefusalFor`), the legacy-baseline migration call, and the
provenance re-stamp. Meanwhile `core/github-releases.ts` was correctly split when it crossed (152 →
237 → **185**, via `kit/extract-release-zip.ts` and `kit/select-release-assets.ts`), so the sprint
clearly knows how to do this — it just did not apply it to the one file that grew most.

**Three-part acknowledgement:**
1. *What it means:* the command module that orchestrates the most new behavior is now 2.9× the
   guidance, and the next sprint touching upgrade pays the reading cost.
2. *Why acceptable here:* pre-existing violation, not introduced; the file was already 2.4× over at
   BASE, and `development-rules.md` names the limit a maintainability guard explicitly "not a license
   for indirection". The added legs are each small and call out to modules that *were* extracted
   (`kit/kit-offline.ts`, `core/legacy-manifest-migration.ts`), so the growth is wiring rather than
   logic. Splitting it mid-sprint would have touched the one file three ACs depend on.
3. *What would make it FAIL:* the next sprint adding a fourth responsibility without extracting, or
   any of these three legs growing branching logic in place.

**Fix:** extract an `upgrade-preflight.ts` holding the offline refusal, the baseline migration and the
provenance re-stamp as three named functions the command calls in order. Mechanical, ~120 lines moved,
no behavior change.

### Noted, not counted

- **The `pack.ts` exception documents its reason, but in the wrong file.** The orchestrator asked
  whether the code records *why* a pack subset re-lay is not a new entry point. It does —
  `one-emitter-path.test.ts:127-132`: "`pack add|remove` writes a SUBSET of an already-laid-down
  target rather than laying the target down, so it is not one of the three install entry points whose
  agreement this projection exists to guarantee." That is exactly the ruling's reasoning, and naming
  it in `NAMED_EXCEPTIONS` rather than matching a loose pattern is the right mechanism. **But
  `commands/pack.ts` itself says nothing about it** — a reader editing `pack.ts:168` has no
  indication they are standing on a named exception to a one-writer invariant, and will find out from
  a test failure in a different directory. One comment at `pack.ts:167` pointing at the invariant and
  its reason would close this. I am treating the ruling as satisfied.

## Performance — PASS

- Verification is two sha256 passes (whole artifact, then per member) plus one `gunzipSync`, over a
  ~1250-file / single-digit-MB archive. That replaces an unzip of comparable size, so the added cost
  is roughly one extra hash of the payload per install — invisible against the network fetch that
  precedes it.
- `fetchKitArtifact` (`kit/fetch-kit-artifact.ts:21-25`) fetches the three assets with
  `Promise.all`, so the manifest and signature cost no extra round trip.
- The emitter projection adds one object push per passage (`emit/emit-target.ts:134`). `passages` is
  process-lifetime and unbounded, which is correct for a CLI that lays a target down at most a handful
  of times per run, and `resetEmitterPassages()` exists for tests.
- No N+1, no blocking work in an async path, no unbounded fetch loop. `extractVerifiedArchive`
  resolves every member path before writing any (`:104-112`), which costs one extra pass over the
  member list and buys the "a refusal has written nothing" property — a good trade.

## Security — PASS

I tried to break this and could not. Every item on the focus list checks out against the code:

| Focus | Finding |
|---|---|
| Verify-before-extract | **Structural.** `verifyKitArtifact` returns contents, `extractVerifiedArchive` is the only writer, staging is created only after all checks pass (`resolve-kit-content.ts:56-61`). No bypass path exists. |
| Path traversal — artifact | `safe-extract.ts:21-49`. Structural rejection (`""`, leading `/` or `\`, `isAbsolute`, `C:`-style, UNC, any `..` component) **and** a resolved-prefix check **and** `validateWritableTargetPath` with an explicit `boundary`, which also catches a symlink component. All members resolved before any write. |
| Path traversal — legacy zip | **Same guard, same file.** `extract-release-zip.ts:33` calls `resolveSafeMemberPath`; `.extractAllTo(` is gone from `github-releases.ts`. The whole archive is refused on the first bad entry, and every destination is resolved before any is written (`:31-39`). Hardening only the new path would have left the cheaper attack open; it did not. |
| Runtime way to add a trusted key | **None.** `TRUSTED_KIT_KEYS` is referenced only from the four kit modules, always as a `keys` **default parameter**. The sole production call site, `core/github-releases.ts:138`, passes no 4th argument — so production always uses the committed keyring. No `process.env`, no `homedir()`, no `argv` and no key-file read anywhere in `src/kit/*.ts`; the only reads there are the cache's own three files. The sole `MEOWKIT_KIT_SIGNING_KEY` reader is `scripts/kit-signing.cjs:20`, outside the shipped tree. |
| Empty keyring refuses | `kit-signature.ts:50-52` throws `no-trusted-key`, and it sits *after* well-formedness so an unsigned release still reports "unsigned" rather than "this CLI has no key" — different remedies, different messages. There is no "empty means accept anything" branch. |
| Private key material | **Zero matches** for a private-key header across the entire diff. `generate-kit-signing-key.cjs` writes to the caller's path at `0600`, refuses to overwrite, prints only the public key; `kit-signing.cjs:48-52` deliberately does not surface the underlying parse error because it can carry key bytes. |
| Workflow steps fail closed | Verified at both layers. Runnable: the script exits 1 with no output directory when the key is absent (key resolved at `:74`, before any write). Static: no `continue-on-error`, `\|\| true`, `if: always()`, `if: failure()`, `set +e`, and no `if:` at all. **This is also exactly why C6 is blocking rather than cosmetic.** |
| Nothing from the artifact executes | No `child_process`, `node:vm`, `createRequire`, `eval`, `spawn*` or `exec*` anywhere in `src/kit/` or `src/emit/` — the only matches are the two comments asserting their absence. Members are buffers that become files. |

Two further things I checked that were not on the list:

- **Archive mode cannot grant setuid.** `kit-archive-reader.ts:70` masks the recorded mode with
  `& 0o777`, so an artifact claiming `04755` cannot reach `writeFileSync`. Separately, the writer
  derives mode from content (`#!` → `0755`, else `0644`), so on-disk bits never enter the digest.
- **No TOCTOU between resolve and write.** `extractVerifiedArchive` resolves all paths, then writes —
  and `writeMember` does `mkdirSync`, so parents do not exist at resolve time. That window is closed
  by the archive being unable to contain a symlink at all: `verify-kit-artifact.ts:70-72` refuses the
  **whole archive** if any member is non-regular, rather than skipping it. That is the right call and
  the comment at `:67-69` says why.

Non-blocking security suggestions are in the Suggestions list (S19, S20).

## Coverage — WARN (2)

3307 tests pass and the adversarial work is real, not decorative. The ten-shape tamper corpus
(`kit-tamper-corpus.test.ts`) asserts, per shape, a named refusal, a **before/after content hash of
the whole destination tree required to be equal**, quarantine content asserted to be *exactly*
`verification-failure.json`, and messages carrying no stack frame, class name or temp path. The
legacy-zip test builds a zip **byte by byte** (`tests/helpers/craft-zip.ts`) specifically because
adm-zip's own writer normalizes `..` away — that is a tester who understood that the obvious fixture
would have tested nothing. And deviation 5 in the evidence self-reports that four static checks
initially matched their own explanatory comments and were rewritten to match call syntax; a team that
reports its own false-passing assertions is a team whose green I can weigh.

### [V6 — WARN] The release-wiring test asserts the step's text and never evaluates its expression

`kit-release-wiring.test.ts:34-47` asserts that each workflow `toMatch(/node scripts\/build-kit-artifact\.cjs/)`
and that the secret is referenced, then asserts the trigger blocks are unchanged. Nothing anywhere
resolves `KIT_VERSION` against a realistic GitHub context, and nothing feeds the resulting value to
`build-kit-artifact.cjs`'s own version validator. That is precisely the gap C6 walked through: the
step is present, fail-closed, correctly wired to the secret — and incapable of succeeding.

**Three-part acknowledgement:**
1. *What it means:* the workflow is covered as a string, not as a behavior. A step can satisfy every
   assertion in this file and fail on every real run.
2. *Why acceptable as WARN rather than FAIL in its own right:* the test's stated purpose — "the
   artifact step cannot fail quietly" — is genuinely achieved, and verifying it fully would mean
   evaluating GitHub expression syntax, which is out of a unit test's reach. The defect it missed is
   graded as C6 under Correctness; grading the same miss twice would double-count.
3. *What would make it FAIL:* shipping C6's fix without a test that binds the two sides together.

**Fix (small, and it has teeth).** Parse the step's `env.KIT_VERSION` expression, extract the
fallback operand, and assert the operand is not a ref-name expression — or, better, assert that each
candidate value the expression can produce satisfies the same regex `build-kit-artifact.cjs:65`
applies. The second form is ~15 lines and would have failed on this diff.

### [V7 — WARN] No test pins the ustar name-field boundary

`kit-artifact-build.test.ts` covers reproducibility across source roots, manifest/member agreement
both ways, and ship-set derivation — thoroughly. It does not cover member-path length at all, so C7
is untested in both directions: neither the round-trip at 100 bytes nor the documented refusal above
155.

**Three-part acknowledgement:**
1. *What it means:* the writer's one documented refusal ("refused rather than silently truncated") has
   no test, and the boundary it governs is currently 10 characters from being reached.
2. *Why acceptable as WARN:* the contract's AC-01 enumerates four named sources of non-determinism and
   path length is not among them, so this is outside what the sprint committed to test.
3. *What would make it FAIL:* any shipped path reaching 100 bytes, at which point the defect is live
   and silent.

**Fix:** three assertions — a 99-byte path round-trips, a 100-byte path round-trips (currently fails),
and a path too long for `prefix` + `base` raises.

### Verified adequate

- **AC→test mapping is real.** I spot-checked the mapping rather than trusting it: the 17 BASE
  exclusion patterns are enumerated and `toHaveLength(17)`-asserted at `kit-release-wiring.test.ts:78-98`,
  and I independently confirmed `base.exclude` now holds 27 (17 + 10) with all 17 present.
- **The one-writer claim is instrumented, not inferred** — `emitterPassages()` plus a tree-wide grep
  for every per-target writer, with the single exception named rather than pattern-matched. Comparing
  the three commands' outputs would have proven nothing; this proves the passage.
- **The cache is not trusted for being local** — the corrupted-cache test throws the same
  `KitVerificationError` a download would, which is the property that matters for `--offline`.
- **Provenance's closed enum is asserted both ways** (in-enum accepted, out-of-enum a Zod error), and
  a pre-provenance record reads back as `undefined` rather than erroring — so the migration is
  covered in the backward direction too.
- **Three real defects were found by running end to end** (provenance dropped on upgrade; `versions`
  blind in a provider-only project; provenance never recorded for an external target), each fixed as
  behavior rather than as a test adjustment. That is the evaluator loop working as intended, and it is
  the reason I weighted the module-level green as high as I did.
- **Skipped-test set unchanged, 19 → 19.** No assertion relaxed to reach green.

## Required Changes

Blocking. Both are in `scripts/` and `.github/workflows/`; neither touches the verification core.

- [ ] **C6** — Declare a `workflow_dispatch` input for the version and stop `KIT_VERSION` falling
      through to `github.ref_name`, in **both** `.github/workflows/release.yml:58` and
      `.github/workflows/release-beta.yml:58`. Today the step exits 1 on every run and fails the job
      before `npx semantic-release`, so neither channel can publish. Decide the ordering question
      while you are there: the artifact is built before the version is decided.
- [ ] **V6** — Add the test that binds the expression to the validator (`kit-release-wiring.test.ts`),
      so the fix cannot silently regress. ~15 lines; it would have caught C6.
- [ ] **C7** — Fix the ustar name/prefix field width in `scripts/kit-tar-writer.cjs:36-38`, or tighten
      `header()`'s guards at `:49-56` so a 100-byte path raises instead of truncating. Either way the
      code should stop contradicting its own comment at `:40-44`.
- [ ] **V7** — Add the three member-path-length assertions to `kit-artifact-build.test.ts`.

The three WARNs (C8, C9, W4) and the two coverage WARNs are for a human to accept or reject; each
carries its three-part acknowledgement above.

## Suggestions (non-blocking)

- **S19** `kit/fetch-kit-artifact.ts:16` — `Buffer.from(await response.arrayBuffer())` buffers an
  unbounded remote asset into memory before anything is verified. The manifest records
  `artifact.size`, but it is fetched in parallel so it cannot gate the artifact fetch. Exploitation
  requires control of the release assets, at which point the signature is the real control, so this is
  robustness rather than a hole — but a `content-length` sanity cap (say, 10× the largest release to
  date) would make a hostile or corrupt asset a named refusal instead of an OOM.
- **S20** `kit/kit-signature.ts:54-64` iterates the keyring and returns on first acceptance. Correct,
  and `verify()` is constant-time internally — worth a one-line comment saying the loop's early return
  leaks only *which* key matched, which is public information, so nobody later "fixes" it into a
  constant-time scan.
- **S21** `commands/pack.ts:167` — one comment naming the one-writer invariant and why a pack subset
  re-lay is exempt, so the rationale is visible where someone would violate it rather than only in the
  test that catches them. See "Noted, not counted".
- **S22** `scripts/kit-tar-writer.cjs:54-56` — once C7 is fixed, the `Buffer.byteLength(prefix) > 155`
  branch is unreachable (`cut <= 154` bounds it to 154). Either drop it or keep it with a comment
  saying it guards against a future change to the `lastIndexOf` bound.
- **S23** `kit/kit-archive-reader.ts:72-74` silently skips pax extended headers (`x`/`g`). That is the
  fail-safe direction — a pax `path=` override cannot rename a member past the path check — but the
  comment says only what pax *is*. Worth adding that ignoring it is deliberate *because* honouring it
  would reintroduce an unchecked name.
- **S24** Evidence nit: `check-env-reads.cjs` reports **138** classified reads, not the 140 in the
  evidence table, and the suite is at 3307 tests, not 3306. Both checks pass; only the prose is off.
  Noted so a future reader does not hunt for two missing rows.
- **S25** `kit/select-release-assets.ts:31` matches the artifact by `startsWith("meowkit-kit-")` +
  `endsWith(".tar.gz")` and takes the **first** match. If a release ever carried two (e.g. a stale
  asset from a re-run), the choice is asset-order-dependent. Matching the exact expected
  `meowkit-kit-<version>.tar.gz` would make it deterministic — and the version is already in hand at
  the call site.

## Gate 2 decision — pending human approval

---

