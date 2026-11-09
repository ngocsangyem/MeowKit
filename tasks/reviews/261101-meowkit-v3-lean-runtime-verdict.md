# Review: MeowKit v3 Lean Runtime — Sprint 6 (round 2, focused re-review)

## Verdict: WARN

**This file is EVIDENCE for a human. It approves nothing.** Gate 2 is NOT approved and cannot be
approved by this file, by any agent, or by any script. Only a human clears a gate
(`gate-rules.md`, "The Gate Authority Invariant").

**Both Major findings are closed, verified by replay rather than by reading the claim. Both coverage
holes are closed with tests that bite. No dimension fails. Three WARNs outstanding, two of them new
and both in the release workflow.**

Round 1 returned FAIL on Correctness for C6 (both release pipelines could not publish) and C7 (a
100-byte member path silently truncated). I re-verified each fix by driving the real scripts and the
shipped verifier, not by reading the diff:

- **C6 closed, and fixed at the root rather than at the symptom.** The fix did not just declare the
  missing input — it removed the duplicate regex that made the failure possible. `scripts/kit-version.cjs`
  now exports `KIT_VERSION_PATTERN`, and `build-kit-artifact.cjs:69` tests against *that* rather than
  its own copy, so the workflow's fallback and the script's rejection cannot disagree again. I ran
  the real chain: `kit-version.cjs` → `2.15.0`; `build-kit-artifact.cjs main` → exit 1
  `Invalid version format: main`; `dev` likewise; `2.15.0` passes the version guard and stops at the
  absent signing key, which is the correct next refusal; and **no output directory is created in any
  failure case**. Both workflows declare `workflow_dispatch.inputs.version` as optional, add a
  `Resolve kit version` step with `id: kit-version`, and neither the new step nor the build step
  carries `continue-on-error`, `|| true`, `if:` or `set +e`. Beta keeps `push: [dev]` plus
  `workflow_dispatch`, stable keeps dispatch-only — so AC-01's trigger leg still holds and no merge
  path is affected.
- **C7 closed, verified through the shipped reader rather than a local parser.** `writeString` is
  split into `writeTerminated` (numeric fields, `length - 1`) and `writeName` (`name`/`prefix`, full
  width, **raises** on overflow), with `NAME_FIELD`/`PREFIX_FIELD` named and the split search bound
  corrected from 154 to 155. I built single-member archives through the real `buildTar` and read them
  back with the install's own `readKitArchive`: **99, 100 and 101-byte paths all round-trip exactly**
  (100 was the case that failed before), a 188-byte path round-trips through the prefix field, and a
  151-byte unsplittable path and a 110-byte base both **raise** instead of shortening. The writer now
  does what its comment always said.
- **The real artifact still builds, reproduces and verifies.** This is the regression check that
  matters, and it passes: built with an ephemeral key against the live ship set →
  **1226 files, 1226 manifest entries**, byte-identical digest across two builds in separate output
  directories with a 1.1 s wall-clock gap; then through the built CLI's own
  `verifyKitArtifact` → **1226 members, 0 non-regular**, extracting to `.claude .meowkit
  release-manifest.json tasks`. Adversarial probes against the same bytes: empty keyring →
  `no-trusted-key`, one flipped artifact byte → `artifact-digest`, wrong requested version →
  `manifest-malformed`. The C7 change did not weaken verification and did not perturb the digest of
  existing content (every shipped path is ≤ 90 bytes, so the new full-width write produces the same
  bytes as the old one for all of them).
- **V6 and V7 both genuinely closed.** V6's new block parses the `KIT_VERSION` expression, splits the
  operands, and rejects any operand naming `ref_name`/`ref`/`sha`/`head_ref`/`base_ref` — that
  assertion fails on the old form. It then requires operand 1 to be `inputs.version` **and the input
  to be declared optional**, which is the actual root cause, resolves operand 2 by *running the
  committed script*, feeds the result to the build script's own validator, and carries a positive
  control asserting `main` and `dev` are still rejected so the check cannot pass by the guard having
  stopped biting. That is the shape I asked for.

The two new WARNs are both in the workflow glue rather than in the engine, and neither is a
regression of anything that worked before. **N1 matters most:** the step whose own comment calls it
"deliberately fail-closed" is the one step in the chain that is not.

## Binding

| Field | Value |
|---|---|
| Reviewed revision (`git rev-parse HEAD`) | `2b93b425170216ca9fdf28f211c3a2d3d0b398f9` (branch `feat/v3-lean-runtime`) — unchanged from round 1; no commit was made |
| Reviewed content | **The UNCOMMITTED working tree on top of that commit**, excluding `tasks/plans/`. The named SHA is the base the working tree sits on, NOT a commit containing the reviewed change. |
| Sprint base (BASE) | `56488bc520f6a042472c8b4e6259d9ff0bdae863` — pinned by the contract |
| Diff shape | 42 tracked files changed (+1221 / −317; was 40 / +689 / −308), 0 tracked deletions, 50 untracked new source/script/test files. Round 2 adds 2 tracked files and 3 new files (`scripts/kit-version.cjs`, `commands/upgrade-preflight.ts`, `kit/__tests__/kit-tar-member-path.test.ts`). |
| Contract | `tasks/contracts/261108-2347-meowkit-v3-lean-runtime-sprint-6.md` — signed, Amendment 1, 14 ACs |
| Remediation claims read as CLAIMS | `tasks/reviews/evidence/261108-meowkit-v3-lean-runtime-sprint-6/evidence.md` § "Review round 3 — findings fixed" |
| Orchestrator rulings applied | `pack.ts` stays at 289 lines (over 200 at BASE) — WARN/follow-up, not FAIL; the C8 upload + version-ordering fix lands with the first real key as one later change; a workflow-side equality check between the dispatch input and root `package.json` is a follow-up |
| Scope gate | **full** (re-review scoped to the eight claimed fixes plus a regression sweep over the engine) |
| Review artifacts | This markdown section ONLY. No source edited, no git mutation, no staging. Four read-only probes written to the session scratchpad; two throwaway artifact builds and one extraction under `$TMPDIR`, never against this repository. |
| Score | **8.6/10** (was 7.4) — Major (0), Critical (0), three WARNs. 14 of 14 ACs met as written. |

## Dimension Summary

| Dimension | State | One-line basis |
|---|---|---|
| Correctness | **PASS** (was FAIL) | C6 and C7 both closed and re-verified by replay through the real scripts and the shipped reader; the real artifact builds, reproduces and verifies; three WARNs remain, all in release glue and none able to produce a wrong install |
| Maintainability | **PASS** (was WARN) | `upgrade.ts` 572 → **527** with four named functions extracted to `upgrade-preflight.ts` (96 lines) and the snapshot → carry → emit → re-stamp ordering preserved; still no `any`, no `@ts-ignore`, no `eslint-disable`, no plan-artifact reference, no new file over 200 lines |
| Performance | PASS | unchanged; the new `kit-version.cjs` reads one `package.json` at build time and `upgrade-preflight.ts` is a pure extraction |
| Security | PASS | re-verified against the freshly built artifact: empty keyring refuses, a flipped byte refuses, a version mismatch refuses, 0 non-regular members accepted; no new `process.env`, exec, or key path — `kit-version.cjs` reads only `package.json` |
| Coverage | **PASS** (was WARN (2)) | 287/287 files and **3317/3317** tests, exactly as claimed; V6's expression test and V7's boundary file both fail on the pre-fix code. One WARN item: V6's producer-step assertion matches the masked-failure form in N1 |

## Gate Authority — standing checklist item

> Does any prose in this change grant approval authority to something that is not a human — in any
> wording?

**No, and still N/A by scope.** Re-confirmed after the round-2 changes: the change set touches
**zero** files under `.claude/` at all, so nothing under `rules/`, `rules-conditional/`, `modes/`,
`agents/` or `skills/{cook,fix,autobuild}/`. `validate --gates` passes (2 passed), and the answer does
not rest on the lint.

**No plan-artifact or finding-code reference in code.** I grepped every added line of the diff and
every untracked source file for phase numbers, `AC-nn`, `D-nn`, `C6`–`C9`, `V6`/`V7`, `W4`, `S19`–`S25`,
"sprint", "round" and "amendment": **zero hits in code.** Worth noting because this round was driven
by numbered findings and the temptation to write "fixes C7" in a comment is highest exactly then — the
`kit-tar-writer.cjs` and `pack.ts` comments describe the defect and the invariant in their own words
instead. The only hits anywhere are inside this verdict file, which is where they belong.

## Correctness — PASS

### Fixes verified by replay

| Finding | Claim | What I verified |
|---|---|---|
| **C6** | version source + declared input + resolve step | `kit-version.cjs` → `2.15.0`, matching root `package.json`, and I confirmed `scripts/release.sh:56-62` really does refuse a release disagreeing with it, so the "single source of truth" claim is grounded. `KIT_VERSION_PATTERN` imported at `build-kit-artifact.cjs:32` and applied at `:69` — one definition, not two. `main` → exit 1, `dev` → exit 1, `2.15.0` → past the guard, `""` → usage + exit 1. No output directory created in any failure case. **CLOSED** |
| **C7** | full-width name/prefix with raise | 99/100/101-byte paths round-trip through the shipped `readKitArchive`; 188-byte prefix split round-trips; 151-byte unsplittable and 110-byte base both raise. Split bound corrected to `PREFIX_FIELD` (155), making the longest representable path 256 bytes as the comment states. **CLOSED** |
| **C9** | contracts and plans excluded + converse test | `base.exclude` 27 → **30**; ship set 1247 → **1226**; the only survivors under those directories are `tasks/contracts/.gitkeep` and `tasks/plans/.gitkeep`; `tasks/templates/` (5 files) unaffected. The converse test (`ship-set-exclusions.test.ts:90-112`) checks five run-output shapes as a property of the computed set and positively asserts the three homes and the templates still ship. **CLOSED** |
| **W4** | `upgrade-preflight.ts` extraction | `upgrade.ts` **527**, `upgrade-preflight.ts` **96**, four named functions, each carrying its own reason. Behavior-preserving: the load-bearing ordering from round 1 is intact — snapshot (`:301-308`) → `carryBaselineForward` (`:317`) → `emitTarget` (`:334`) → `restampProvenance` (`:352`). **CLOSED** |
| **S21** | `pack.ts` invariant inline | `pack.ts:168-178` states the invariant *and* why a subset re-lay is exempt ("adds a named SUBSET to a shape that is already on disk, bounded by `allowedPaths` and with deletion off … would make a partial write look like one of those three full ones"). The reason now sits where someone would violate it, not only in the test that catches them. **CLOSED** |
| **C8** | scope-out retained, docs corrected | My stated FAIL condition for C8 was a documentation claim that users receive verified installs today. All three pages are corrected: `installation.mdx:73-75` opens with "**Not live yet.** No published release carries the signed artifact, and the CLI ships no trusted…"; `quick-start.mdx:18` and `workflows/new-project.mdx:35` both read "no release carries it yet". **Condition removed.** |

### [N1 — WARN, new] The step that calls itself fail-closed is the one step that is not

`.github/workflows/release.yml:58` and `.github/workflows/release-beta.yml:58`:

```yaml
run: echo "version=$(node scripts/kit-version.cjs)" >> "$GITHUB_OUTPUT"
```

The step's own comment (`:53-56`) says "this step is **deliberately fail-closed**". It is not. A
command substitution inside an argument does not set the command's exit status — the status is
`echo`'s — and GitHub's default `bash --noprofile --norc -e -o pipefail` does not change that.
Proven, not reasoned:

```
$ bash -e -o pipefail -c 'echo "version=$(false)"; echo "step exit=$?"'
version=
step exit=0
```

So if `kit-version.cjs` ever fails — a malformed root `package.json`, a version that does not match
`KIT_VERSION_PATTERN`, the file moved — the step **passes**, writes `version=` (empty), and the
careful diagnostic at `kit-version.cjs:47` (`Could not determine the kit version: …`) is discarded.

**Three-part acknowledgement:**
1. *What it means:* the resolve step cannot fail the job, so a version-resolution failure is reported
   one step later and in the wrong words.
2. *Why acceptable:* **the pipeline still fails closed, just not at this step.** `KIT_VERSION` then
   resolves to the empty string, and `build-kit-artifact.cjs:63-66` rejects it — I confirmed: usage
   message, exit 1, no output directory. So no unsigned or mis-versioned artifact can be produced;
   what is lost is diagnosability, not safety. And with C8 unresolved nothing is uploaded regardless.
3. *What would make it FAIL:* any future step consuming
   `steps.kit-version.outputs.version` without its own validation — the empty value would then flow
   somewhere that does not check it.

**Fix (two lines, no new concept):**

```yaml
run: |
  version="$(node scripts/kit-version.cjs)"
  echo "version=$version" >> "$GITHUB_OUTPUT"
```
With the assignment on its own line, a non-zero exit is the *command's* status and `-e` fails the
step with the script's real message. Then tighten V6's producer assertion (below) so the masked form
cannot come back.

### [N2 — WARN, new] The resolved version and the release's own tag can disagree

`kit-version.cjs:33-41` reads root `package.json` — `2.15.0` today. But `npx semantic-release`
(`release.yml:71`, `release-beta.yml:71`) runs **after** the artifact step and computes the *next*
version from the commits, tagging the release that. So the artifact is built as
`meowkit-kit-2.15.0.tar.gz` with `manifest.version = 2.15.0` while the release it belongs to is
tagged, say, `2.16.0`.

That mismatch is not benign, and the engine is strict about it by design. I proved the consequence
against the real artifact: requesting `2.15.1` against a `2.15.0` manifest gives
`manifest-malformed`, because `parseKitManifest` (`kit/kit-manifest.ts:58-60`) treats a manifest for
another version as malformed *for this attempt*. So once an upload step exists, the artifact would be
**refused on every install** until the version source and the release tag agree.

**Three-part acknowledgement:**
1. *What it means:* the version the artifact is built for is not derived from the version the release
   will carry, so a published artifact would fail verification for the wrong reason.
2. *Why acceptable now:* unreachable. Nothing uploads the three assets (C8), so
   `kitArtifactAssets()` returns `null` on every release and no user ever requests this artifact.
   The orchestrator has ruled that the upload and the ordering fix land together with the first real
   key, as one later change, and that a workflow-side equality check is a follow-up. Building for the
   *previous* version is also strictly safer than building for a guessed next one.
3. *What would make it FAIL:* an upload step landing without the ordering fixed — the feature would
   then look live and refuse every install, which is worse than today's honest "not live yet".

**Fix, to land with C8:** move the artifact build *after* `semantic-release` and read the version it
actually published (or have `semantic-release` invoke the build via a `prepare`/`publish` step), so
the artifact name, the manifest version and the release tag are one value rather than three. The
interim equality check the orchestrator deferred — assert `inputs.version` equals root
`package.json` when the input is given — is worth having regardless, because it catches a
mis-typed manual dispatch.

### [C8 — WARN, carried] Still no upload step, by scope

Unchanged and correctly scoped out. No semantic-release config exists, no step uploads
`dist/meowkit-kit-*.tar.gz`, `kit-manifest.json` or `kit-manifest.json.sig`, and `scripts/release.sh:81`
still calls only `prepare-release-assets.cjs`. So `release.kitArtifact` is `null` on every real
release and every install takes the legacy zip path.

**Three-part acknowledgement:** (1) the signed-artifact install is complete and correct but
unreachable by a real user; (2) acceptable because the contract scopes it out, the keyring is
deliberately empty so a published artifact would refuse anyway, the orchestrator has ruled it lands
with the first real key, **and the documentation no longer claims otherwise** — which was my round-1
FAIL condition and is now satisfied; (3) it would become FAIL if a key lands while no upload exists,
or if any page returns to the present tense.

### Regression sweep — nothing broke

Beyond the targeted fixes I re-checked the surfaces round 2 could plausibly have disturbed:

- **Verification engine untouched in behavior.** The round-2 diff adds no `process.env` read, no
  `child_process`/`vm`/`createRequire`/`eval`, and no new file read inside `src/kit/`. Re-ran the
  adversarial probes against a freshly built artifact — empty keyring, flipped byte, version
  mismatch — all three still refuse with the same named checks.
- **Reproducibility intact.** Two builds, separate output directories, 1.1 s apart: identical
  artifact digest `f764950e4d9481b2…`. The four pinned non-determinism sources still hold with the
  new `writeName`.
- **Digest of existing content unperturbed.** Every shipped path is ≤ 90 bytes, so full-width
  `writeName` emits the same bytes the old `length - 1` form did for all 1226 members. The C7 fix
  changes behavior only at the boundary it was broken at.
- **Workflow triggers preserved.** Stable is dispatch-only; beta keeps `push: [dev]` plus dispatch,
  now with the optional input. AC-01's "no merge path is affected" still holds.
- **Fail-closed shape preserved on the build step.** Neither workflow's artifact step nor the new
  resolve step carries `continue-on-error`, `|| true`, `if:` or `set +e` — the only matches are the
  comment prose, and the test strips comments before asserting.
- **`upgrade` ordering preserved** (see W4 row above) — the property that makes an interrupted
  migration leave the old baseline rather than none.
- **Gate re-run independently**, every number reproduced:

| Check | Claimed | Reproduced |
|---|---|---|
| `pnpm build` | exit 0 | exit 0 |
| `pnpm lint` | 0 errors / 3 pre-existing warnings | 0 errors / 3 warnings — the same `capabilities.ts:7`, `orient.ts:8`, `validate.ts:447`, none in a touched file |
| `pnpm typecheck` | exit 0 | exit 0, 0 errors |
| `pnpm test` | 287 files / 3317 tests / 0 failed | **287 / 3317 / 0** — exact |
| `node --test .claude/hooks/__tests__/*.test.cjs` | 36 / 0 | 36 pass / 0 fail |
| `check-kit-verbs.cjs` | PASS | PASS, 187 refs / 32 subcommands |
| `check-env-reads.cjs` | PASS, 138 reads | PASS, **138** — the round-1 evidence nit (S24) is corrected in the gate table |
| built-CLI `validate --gates` | pass | 2 passed |
| built-CLI `validate --packs` | pass | 1 passed |

## Maintainability — PASS

`upgrade.ts` 572 → **527**, and the extraction is the right one: `offlineRefusal`,
`carryBaselineForward`, `readInstalledShape` and `restampProvenance` are four decisions with four
reasons, and `upgrade-preflight.ts:1-10` states why they do not belong in the command ("a reader
looking for 'why did my offline upgrade refuse' has to scan past the release-selection, snapshot,
pack-resolution and reporting legs"). That is a motivated split, not a line-count split.

Round-2 additions are clean by every mechanical measure: zero `any`, `as any`, `@ts-ignore`,
`@ts-expect-error` or `eslint-disable`; no new file over 200 lines; kebab-case throughout; lint clean
in every touched file.

Two things worth crediting specifically. First, the C6 fix removed a **duplicated regex** rather than
only adding the missing input — the class of defect, not the instance. Second, `kit-version.cjs:12-15`
records *why* the module exists ("a release workflow derived the version from `github.ref_name`, which
is a branch name… The step is deliberately fail-closed, so every release run failed before it could
publish anything") without naming a finding code. That is exactly the standing naming rule applied
correctly: the reason is durable, the label is not.

### Noted, not counted

- **`pack.ts` is 289 lines**, over the 200-line guidance, and grew by the ~11-line S21 comment I
  asked for. Ruled a WARN/follow-up by the orchestrator; it was already over at BASE, and grading the
  growth would penalise the fix. Recorded so the next sprint touching it has the number.
- **`kit-artifact-build.test.ts` stayed at 150** by putting the V7 assertions in their own file
  rather than pushing it to 220. The right call, and the evidence says so explicitly.

## Performance — PASS

Unchanged from round 1. `kit-version.cjs` reads and parses one `package.json` at build time only —
never on an install path. `upgrade-preflight.ts` is a pure extraction with no added work. The one
measurable round-2 cost is the V6 test spawning the build script three times per workflow
(`execFileSync`), which is test-time and bounded.

## Security — PASS

Re-verified end to end against a freshly built artifact rather than re-reading round 1's conclusions:

| Property | Re-verified |
|---|---|
| Genuine artifact verifies | 1226 members, 0 non-regular, manifest and archive agree both ways, extraction yields the four expected top-level entries |
| Empty keyring refuses | `no-trusted-key` |
| Tampered artifact refuses | one flipped byte → `artifact-digest` |
| Wrong version refuses | `manifest-malformed` (this is also the mechanism behind N2) |
| No runtime key injection | unchanged: `TRUSTED_KIT_KEYS` still only a default parameter, production call site `core/github-releases.ts:138` still passes no override, still zero `process.env`/`homedir()`/`argv` reads in `src/kit/*.ts` |
| No private key material | 0 matches across the diff; `MEOWKIT_KIT_SIGNING_KEY` still read only by `scripts/kit-signing.cjs`, outside the shipped tree |
| Nothing executes | no `child_process`/`node:vm`/`createRequire`/`eval`/`spawn*`/`exec*` in `src/kit/` or `src/emit/`; round 2 adds none |
| Both extract paths guarded | unchanged single guard; `writeName` touches header construction only, never a destination path |

`kit-version.cjs` is the only new build-time reader and it reads exactly one path
(`path.join(__dirname, "..", "package.json")`), with no interpolation and no env input. Nothing
new to flag.

## Coverage — PASS

287/287 files and **3317/3317** tests, reproduced exactly (up from 286/3307: +1 file, +10 tests). Both
round-1 coverage holes are closed with tests that would fail on the pre-fix code:

- **V6 closed.** `kit-release-wiring.test.ts` — operand parsing, a ref-expression ban that fails on
  the old form, the *declared-and-optional* input assertion that names the actual root cause, the
  producer step resolved by **running the committed script**, the result fed to the build script's own
  validator, and a positive control asserting `main`/`dev` are still rejected so the check cannot pass
  by the guard having stopped biting. This is the rare case of a test that encodes the failure
  mechanism rather than the symptom.
- **V7 closed.** `kit/__tests__/kit-tar-member-path.test.ts` (90 lines) pins 99/100/101-byte
  round-trips, a prefix split, and two refusals — all through the shipped `readKitArchive`, so a
  round-trip means writer and install reader *agree*, not merely that the writer is self-consistent.
- **C9's converse assertion closed.** `ship-set-exclusions.test.ts:90-112` checks run-output shapes as
  a property of the computed ship set, with the reason stated ("`tasks/` is archived WHOLE for its
  templates — so anything new dropped under it ships by default").

### [WARN item] V6's producer assertion matches the masked form

`kit-release-wiring.test.ts` asserts the producer step with
`expect(producer).toMatch(/version=.*>> "\$GITHUB_OUTPUT"/)`, which the N1 form
(`echo "version=$(node …)"`) satisfies. So the one thing in the chain that is not fail-closed is the
one thing this otherwise-excellent block does not check.

*What it means:* N1 can regress silently. *Why acceptable:* the test's stated purpose — binding the
expression to the validator — is fully achieved, and the pipeline still fails closed downstream.
*What would make it FAIL:* fixing N1 without extending this assertion. **Fix:** assert the step
assigns to a shell variable on its own line before echoing (e.g. `/version="\$\(/` must NOT match,
or positively require `/^\s*version="\$\(node scripts\/kit-version\.cjs\)"$/m`).

## Required Changes

**None.** No dimension fails. Both Major findings are closed and re-verified by replay, both coverage
holes are closed with tests that bite, and nothing here blocks on the reviewer's account.

The three WARNs (N1, N2, C8) and the one coverage WARN are for a human to accept or reject; each
carries its three-part acknowledgement above. **N1 is the only one I would ask to be fixed before
commit** — it is two lines, it restores a property the step's own comment claims, and it is the
cheapest item in this review.

## Suggestions (non-blocking)

- **N1 fix** (repeated here because it is the one worth taking now) — assign to a shell variable on
  its own line in both workflows' `Resolve kit version` step, and extend V6's producer assertion so
  the masked form cannot return.
- **N3** `base.exclude` still ships a **depth-1 non-`.md`** file under the two newly excluded
  directories: `tasks/plans/*.md` + `tasks/plans/*/*` and `tasks/contracts/*.md` leave
  `tasks/plans/notes.txt` and `tasks/contracts/c.json` shipping, and the converse test's regexes
  (`^tasks/contracts/[^/]+\.md$`, `^tasks/plans/.+/`) do not cover them either. Verified by running
  the real matcher over synthetic paths. Nothing matches today — only `.gitkeep`, which *should*
  ship — so this is a residual rather than a defect. The clean fix is to allowlist `.gitkeep` at
  depth 1 instead of filtering by extension, which also removes the asymmetry between the two
  patterns.
- **S19** (carried) `kit/fetch-kit-artifact.ts:16` — no size cap before `arrayBuffer()`; a
  `content-length` sanity bound would turn a hostile or corrupt asset into a named refusal rather
  than an OOM.
- **S20** (carried) `kit/kit-signature.ts:54-64` — one line saying the loop's early return leaks only
  *which* key matched, which is public, so nobody later "fixes" it into a constant-time scan.
- **S23** (carried) `kit/kit-archive-reader.ts:72-74` — say that ignoring pax extended headers is
  *deliberate* because honouring them would reintroduce an unchecked member name.
- **S25** (carried) `kit/select-release-assets.ts:31` — match the exact expected
  `meowkit-kit-<version>.tar.gz` rather than the first prefix/suffix hit; the version is already in
  hand at the call site, and this becomes load-bearing the moment N2's ordering is fixed.
- **S26** `scripts/kit-tar-writer.cjs:95` — with the split bound corrected to `PREFIX_FIELD`, the
  `Buffer.byteLength(prefix) > PREFIX_FIELD` half of the guard now fires only for non-ASCII paths,
  which the comment at `:91-94` says. Good as-is; noting that the round-1 S22 suggestion is
  satisfied.

## Post-review changes (orchestrator)

- The superseded round-1 review of this sprint is archived verbatim at
  `tasks/reviews/evidence/261108-meowkit-v3-lean-runtime-sprint-6/review-round-1.md`; the sprint-5 review stays
  in git history. This file holds only the current verdict, as for earlier sprints.
- **N1 closed after this review:** both release workflows now assign the resolved version on its own line
  before writing it to `$GITHUB_OUTPUT`, so a resolution failure fails the step; `kit-release-wiring.test.ts`
  asserts that form and rejects a substitution inside `echo` (the coverage WARN item). Test file: 7/7 pass.

## Gate 2 decision — signed kit artifact and one emitter path

Human approval, typed by the owner in response to the Gate 2 prompt for this review:

> "Approve, ack WARNs"

- **C8** acknowledged: the release workflows build and sign the artifact but do not upload it, and no
  semantic-release asset config exists yet. Lands with the first real signing key.
- **N2** acknowledged: the artifact version is read from package.json before semantic-release picks the
  next version; it would refuse once uploads exist. Closes with C8 plus an equality check.
- **N1** closed before commit: see "Post-review changes" above.
