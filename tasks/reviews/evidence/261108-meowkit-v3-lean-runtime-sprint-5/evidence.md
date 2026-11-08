# Sprint 5 evidence — one committed project config; ownership-aware update / uninstall / backups

BASE = `085cb5bd2ee855431f68d0481958da9114ab92e5`. Contract =
`tasks/contracts/261108-0735-meowkit-v3-lean-runtime-sprint-5.md` (15 ACs, D1–D15).

**This file does not describe a passing sprint.** One batch of the contract's own two-batch seam landed
(AC-01 … AC-07, the config/env/toggle half). The ownership half (AC-08 … AC-13) is untouched, and the two
cross-cutting criteria (AC-14, AC-15) are therefore only partly measurable. Every AC below carries a verdict of
`MET`, `PARTIAL` or `PENDING (later batch)`, and a `PARTIAL` names exactly which clause is outstanding.

> **Batch B pass 1 (appended below, see "Batch B pass 1" and the cumulative table at the end).** The sections
> above record batch A as it stood at its own boundary and are left intact as history. Three of batch A's
> `PARTIAL` criteria are closed in pass 1 (AC-01, AC-04, AC-06) and one new criterion lands (AC-08); AC-02 and
> AC-09 … AC-13 are still outstanding. The cumulative verdict table at the foot of this file supersedes the
> per-section verdicts above wherever the two differ.

## Verification run at the batch boundary

| Command | Result |
|---|---|
| `npm run build` | exit 0 |
| `npm run lint` | 0 errors, 3 warnings (all pre-existing, in `commands/{capabilities,orient,validate}.ts`) |
| `npm run typecheck` | exit 0, no output |
| `npx vitest run` | **258 files / 3039 tests passed**, 0 failed |
| `npx vitest run tests/hooks tests/ports` | 11 files / 230 tests passed (82-fixture golden corpus included) |
| `node --test .claude/hooks/__tests__/*.test.cjs` | 36 pass / 0 fail |
| `node packages/mewkit/dist/index.js doctor` | 14 passed, 3 warnings (all pre-existing) |
| `node packages/mewkit/dist/index.js validate` | 40 passed, 34 warnings, 1 n/a |
| `node packages/mewkit/dist/index.js inventory --check` | `Docs match the inventory.` |
| `node scripts/check-no-python.cjs --allow-existing-envs` | `All 28 checks passed with no Python interpreter on PATH.` |
| `node scripts/check-env-reads.cjs` | `PASS: 162 environment-name reads, all classified` |
| `node scripts/generate-config-schema.cjs --check` | `PASS: packages/mewkit/schemas/config-v1.json is up to date` |

Hook behaviour is pinned: the golden corpus replays unchanged, and no fixture was relaxed.

---

## [AC-01] The env-name universe is closed, classified, and nothing is unaccounted for — **PARTIAL**

**Artifacts.** `scripts/scan-env-names.sh` is the committed definition of the universe, with AC-01's trees and
exclusions verbatim. `env-name-classification.json` is the committed table: 84 rows, one per name.

```
$ sh scripts/scan-env-names.sh | wc -l
84
$ sh scripts/scan-env-names.sh | cut -c1-8 | sort | uniq -c
  73 MEOWKIT_          (prefix MEOWKIT_)
  10 MEOW_             (prefix MEOW_)
   1 MK_               (prefix MK_)
```

84 at BASE = 73 / 10 / 1, matching the contract exactly. `universe-at-base.txt` in this directory is byte-identical
to the live scan output.

**Table placement is deliberate and is a design note the reviewer should check.** The table lives at the
repository ROOT, outside every scanned tree. Inside one, a dropped name's own table row would keep that name in
the universe forever and a deletion could never be observed. No scan exclusion was added — the pinned exclusion
list is unchanged; root files are simply not among the pinned trees.

**Classes** (`drop` 22, `skill-option` 31, `credential` 12, `toggle` 8, `safety-path` 5, `runtime-handoff` 5,
`behavior-override` 1 = 84). Every row has a non-empty class drawn from the declared set and a non-empty reader
column; no name appears twice. Asserted by `tests/config/env-universe.test.ts` (10 tests).

**One factual correction to the evidence this contract was built on.** The contract's inventory classified
`MEOWKIT_STORY_SIZER_COMMENT_TEMPLATE` as a drop. It is a LIVE read at
`.claude/skills/story-sizer/scripts/execute-auto-create.py:97`, inside an `os.environ.get(` call that spans two
lines, which a single-line grep misses. AC-01's own verification clause — "for every name the table calls
reader-less, confirm absence under the composition-aware method" — is what found it, on the first run of the
check. The row is now `skill-option` with that file and line as its reader. The inventory itself declares its
round-1 drop list superseded by "whatever the committed scan plus that reader column yields", so this is the
method producing its answer rather than a reinterpretation. **Consequence: the drop class is 22 names, not 23.**

**AC-01 ↔ AC-07 cannot contradict each other, structurally.** `scripts/check-env-reads.cjs` loads
`env-name-classification.json` as its allowlist and contains no environment name at all; the test asserts both
(`expect(source).not.toMatch(/MEOWKIT_[A-Z]/)`).

**Outstanding — the reason this is PARTIAL.** The 22 `drop` names are classified and the CI check now fails on any
READ of one (the `MEOW_PROFILE` read at `lib/tdd-detect.cjs:49` was removed; see AC-04), but their **prose
occurrences in docs, agents and skills are not yet deleted**, so the finished-tree scan still yields 84 rather
than 62. The universe test is therefore written as "every scanned name has a row" (scan ⊆ table) rather than set
equality, which is the assertion that stays true across the deletion. `.claude/settings.json`'s `env` block IS
done: it is now `{"CLAUDE_CODE_FORK_SUBAGENT": "1"}` alone, so both literal dead keys
(`MEOWKIT_TDD_FLAG_DETECTOR`, `MEOWKIT_MEMORY_BUDGET`) and all four behaviour toggles are gone from it.

## [AC-02] One committed config exists, with a schema, commented stubs, and no forbidden key surface — **PARTIAL**

**Done.** `packages/mewkit/src/config/schema.ts` is the zod schema; `packages/mewkit/schemas/config-v1.json` is
GENERATED from it by `scripts/generate-config-schema.cjs`, which walks the zod definitions. Re-running is a no-op:

```
$ node scripts/generate-config-schema.cjs --check
PASS: packages/mewkit/schemas/config-v1.json is up to date
```

The key surface is exactly `tdd`, `autobuild.mode`, `budget.{cap,warn,block}`, `buildVerify.timeoutMs`,
`projectContext.maxBytes`, `workflow.{telemetry,proactive}` and `hooks.<name>` for each of the 21 kebab-case
observer names, which are read from the registry rather than listed. `additionalProperties: false` appears 7
times — top level plus all six nested objects. `gates`, `paths` and `pm` are absent as properties, and the string
`pm.auto` does not appear in the file. Asserted by name in `tests/config/env-universe.test.ts`.

**PENDING (later batch).** `mewkit init` does not yet write `.meowkit/config.yaml` with commented stubs; the
`$schema` line, the `mewkit status` repointing, the removal of `.meowkit/config.json` from the kit source tree,
the `core/validate-install.ts:57` migration-pending check and the whole v2.15 `config.json` → `config.yaml`
`upgrade` migration (with its report of uncarried values and its snapshot) are all untouched. `KEY_DOC` in
`schema.ts` already holds the one-line comment per key the stub writer will use.

## [AC-03] The loader rejects secrets, absolute paths, protected hook keys, `gates.*`, `paths.*` and out-of-grammar YAML — **MET**

`tests/config/rejections.test.ts` (31 tests) runs one committed fixture per rejection class through the CLI
loader and asserts the error IDENTIFIER, not merely a failure:

| Class | Fixture | Identifier |
|---|---|---|
| secret in key / in value | `reject-secret-key.yaml`, `reject-secret-value.yaml` | `secret-in-config` |
| absolute path, POSIX and Windows | `reject-absolute-path-{posix,windows}.yaml` | `absolute-path` |
| each of the seven protected hooks, `gate2-check` included | `reject-protected-<name>.yaml` | `protected-hook` |
| `gates.*` | `reject-gates-namespace.yaml` | `forbidden-namespace` |
| `paths.plans: src` by name | `reject-paths-namespace.yaml` | `forbidden-namespace` |
| tab, 3-level nest, anchor, array of maps, block scalar, flow map, duplicate key, null, float | `grammar-*.yaml` | `tab-indentation`, `nesting-too-deep`, `anchor-not-supported`, `sequence-not-supported`, `block-scalar-not-supported`, `flow-collection-not-supported`, `duplicate-key`, `null-not-supported`, `float-not-supported` |

No rejection is a warning and none is partial: a failure result carries no `values` field at all, so the
applied-key count is zero by construction rather than by luck, and the test asserts that. Both readers are run
over the same corpus by `tests/config/reader-agreement.test.ts` (AC-05), which is where "the hook reader reaches
the same verdict" is proved.

`null-not-supported` and `float-not-supported` are additions to the contract's list, and are there for AC-05: the
full parser yields `null` and `1.5` where the hand reader sees the words `null` and `1.5`. Neither type is in the
D1 grammar, so both readers refuse rather than one of them guessing.

## [AC-04] Precedence is exactly env override > CLI flag > project > user > default, a malformed config degrades safely, and a removed name is loud — **PARTIAL**

**Done.** `tests/hooks/config-precedence.test.ts` (15 tests) walks the matrix cell by cell, asserting the value
AND the answering level: `default`, `user` alone, `project` over `user`, `flag` over `project`, `env` over all
four, and `autobuild.mode` plus `hooks.<name>` resolved at their own levels.

`lib/tdd-detect.cjs` keeps `MEOWKIT_TDD` at the top (the D9 reversal) and loses only the `MEOW_PROFILE` tier, so
the order is now `env > sentinel > project > user > default OFF`. The cell the contract singles out:

- a project `tdd: false` with `MEOWKIT_TDD=1` exported resolves `{enabled: true, source: 'env'}`
- and in that same cell a real `pre-implement.cjs` invocation still exits non-zero with `TDD mode is ON`, so the
  failing-test-first enforcement is demonstrably still on rather than merely configured on.

`MEOWKIT_TDD=0` is now an env-level OFF instead of an "unrecognised value" warning. Without that, a lower level
could decide while the user believed the top one had. No golden fixture exercises `=0`, so nothing was relaxed.

Malformed config: `resolveConfig` returns zero applied keys plus one error carrying `code` and `line`
(`tab-indentation`, line 2), every observer stays at its own default and still runs
(`tests/hooks/observer-toggles.test.ts` asserts all 22 registrations are still selected with a malformed config),
and the full 82-fixture golden corpus replays unchanged.

**PENDING (later batch).** The `mewkit doctor` half: the parse error reported with file and line, and one finding
per still-exported removed name (tested on `MEOWKIT_LOOP_DETECT` and one reader-less drop) with its replacement
key and a non-zero exit. The data those findings need is in place — `env-name-classification.json` carries the
class, the replacement key and the reader for all 84 names — but no `doctor` check reads it yet.

## [AC-05] The hook reader and the CLI reader cannot disagree — **MET**

`tests/config/fixtures/` holds **39** committed fixtures against the required minimum of 12: every scalar type
(boolean, integer, negative integer, bare string, quoted string), both nesting levels, an empty file, a
comments-only file, a BOM, CRLF line endings, blank lines, a trailing comment, a duplicate key, and one per
out-of-grammar construct, plus the whole AC-03 rejection set.

```
$ npx vitest run tests/config/reader-agreement.test.ts
Test Files  1 passed (1)
     Tests  41 passed (41)
```

Every fixture is fed to `.claude/hooks/lib/yaml-subset.cjs` + `config-rules.cjs` and to the `js-yaml`-backed
`load-config.ts`; the verdicts are compared, and for an accepted fixture the flat key/value maps are compared with
`toEqual` — structurally, so two shapes that print alike but differ in a value's type still fail.

The require-graph clause is asserted in the same file: walking out from `yaml-subset.cjs` and `config-rules.cjs`,
every resolved path is either a `node:` builtin or a file under `.claude/`, and the list of package requires is
empty. The kit still has zero npm dependencies on a hook path.

## [AC-06] No committed file can weaken a gate, and the one escape hatch is user-scoped and logged — **PARTIAL**

**Done.** Two independent proofs, because either alone would be a single point of failure.

*The loader rejects the hostile config.* `tests/hooks/hostile-config.test.ts` places a config carrying
`hooks.gate-enforcement: false`, `hooks.privacy-block: false`, `hooks.pre-ship: false`, `hooks.check-freeze:
false`, `gates.presenceOnly: true`, `paths.plans: src` and `autobuild.mode: LEAN`, and asserts the whole file is
rejected (`protected-hook`), plus each weakening key on its own.

*The gates never read it.* `tests/hooks/env-allowlist.test.ts` gains two clauses beside its existing closed env
set (which widened by **zero** names) and its existing dotenv clause: no file in the require graph of the three
safety entrypoints mentions `read-config`, `config-rules`, `yaml-subset` or `js-yaml`; and `config.yaml` is named
on a safety path by **exactly one** file, `.claude/hooks/lib/gate1-hatch.cjs`, asserted as a set equality so a
second way in cannot appear unnoticed.

With the hostile config in place, Gate 1 still exits **2** with `@@GATE_BLOCK@@` on a source write, and
privacy-block still emits `@@PRIVACY_BLOCK@@` on a `.env` read.

*Density is not a bypass.* `checkContractSigned` with `autobuild.mode: LEAN` in the project config returns
non-zero, while the same call with `MEOWKIT_AUTOBUILD_MODE=LEAN` in the environment returns 0 and logs the bypass.

*The hatch.* `tests/hooks/gate1-hatch.test.ts` (11 tests) covers every cell the contract names:

| Cell | Outcome |
|---|---|
| `MEOWKIT_GATE1_PRESENCE_ONLY=1` | applies; exactly one line naming the source in `.meowkit/telemetry/security-log.md` |
| `gate1PresenceOnly: true` in `~/.meowkit/config.yaml` | applies; exactly one line naming the file |
| the same key in the PROJECT config | ignored (and the general loader rejects it, `user-scope-only`) |
| project root **is** `$HOME` (one file, compared by dev+inode) | **refused**, Gate 1 strict, stderr names the pull-request exposure, refusal logged |
| `~/.meowkit` a symlink to the project's | **refused**, same |
| that layout with the env var | still applies — an env var is not pull-request editable |
| security-log append fails (file where the directory must be; read-only project dir), both hatch forms | **refused**, "could not be recorded", Gate 1 blocks |
| any other key in the user file | the reader returns `undefined`; it has no vocabulary for a second key |

**PENDING (later batch).** A replay of the `guard-careful`, `guard-freeze` and `guard-investigate` golden groups
with the hostile config physically present in the fixture tree. The guards are proved unreachable from the config
by the require-graph clause above and their own 8 golden fixtures pass unchanged, but the two have not been
combined in one run.

## [AC-07] Every observer toggle actually switches its observer off, and no non-allowlisted env read survives — **MET**

`handlers.json`'s 21 `toggleKey` values are now kebab-case and each EQUALS its handler's file base name, so the
registry entry IS the config key — no translation table, nothing to drift. The file still has its BASE **22**
entries over **21** distinct keys; `budget-tracker` is still registered twice and no registration was added or
removed.

`lib/handler-registry.cjs` `validate()` now rejects a camelCase key and a key naming another handler (both
asserted). `selectHandlers` filters on `hooks.<toggleKey>`, which is the only place the toggle needs to act: the
observer is never loaded, the switch works whether or not the handler knows about it, and one key covers both of
`budget-tracker`'s registrations.

```
$ npx vitest run tests/hooks/observer-toggles.test.ts
Test Files  1 passed (1)
     Tests  29 passed (29)
```

21 per-key tests, one per name, each asserting the observer is absent from the dispatcher's selection AND that
every other registration is untouched; `hooks.learning-observer: false` among them, as the phase success criteria
require. An end-to-end case runs the real `dispatch.cjs` and asserts the handler's own output disappears when the
key is set. `hooks.gate-enforcement: false` instead produces a loader error while Gate 1 still blocks (AC-06).

The four handlers that read a toggle from the environment now read the config key instead:
`build-verify` (`autobuild.mode`, `buildVerify.timeoutMs` — now milliseconds, as the key name says),
`budget-tracker` (`budget.{cap,warn,block}`), `model-detector` (`autobuild.mode`),
`pre-completion-check` (`autobuild.mode`), `project-context-loader` (`projectContext.maxBytes`). The three on/off
names collapsed into `hooks.<name>`, so those env checks are deleted outright rather than translated.

The committed check finds 0 violations on the finished tree, and fails on both plants:

```
$ node scripts/check-env-reads.cjs
PASS: 162 environment-name reads, all classified in env-name-classification.json

# planted literal read
.claude/hooks/lib/planted-literal.cjs:2: read of MEOWKIT_NEW_THING — not classified ...
FAIL: 1 unclassified environment-name read(s)

# planted COMPOSED suffix in the multimodal composition zone
.claude/skills/multimodal/scripts/planted_composed.py:1: composed read of MEOWKIT_BRAND_NEW_SUFFIX — not classified ...
FAIL: 1 unclassified environment-name read(s)
```

Both plants were reverted; the final run is the PASS above. The check is wired into `.github/workflows/ci.yml`
beside the schema-staleness check.

## [AC-08] … [AC-13] — **PENDING (later batch)**

Not started. `.meowkit/.gitignore`, the local kit cache, `core/snapshot.ts`, `commands/uninstall.ts`,
`commands/backups.ts`, ownership metadata for the `.meowkit/` subset, the trusted-kit-source deletion gate,
`doctor --adopt`, the clone-without-init journey and `--json`/`--dry-run`/exit-3 across the seven mutating
commands are all untouched. No partial version of any of them is on disk.

## [AC-14] Code quality over the sprint diff — **PARTIAL (measured over the batch diff)**

No new file exceeds 200 lines. New files and their line counts:

| File | Lines |
|---|---|
| `env-name-classification.json` | 110 |
| `scripts/scan-env-names.sh` | 26 |
| `scripts/lib/env-read-scan.cjs` | 123 |
| `scripts/check-env-reads.cjs` | 76 |
| `scripts/generate-config-schema.cjs` | 86 |
| `.claude/hooks/lib/yaml-subset.cjs` | 127 |
| `.claude/hooks/lib/config-keys.cjs` | 102 |
| `.claude/hooks/lib/config-rules.cjs` | 123 |
| `.claude/hooks/lib/read-config.cjs` | 129 |
| `.claude/hooks/lib/gate1-hatch.cjs` | 116 |
| `packages/mewkit/src/config/schema.ts` | 119 |
| `packages/mewkit/src/config/yaml-grammar.ts` | 113 |
| `packages/mewkit/src/config/config-rules.ts` | 124 |
| `packages/mewkit/src/config/load-config.ts` | 139 |
| `packages/mewkit/src/config/precedence.ts` | 103 |
| `packages/mewkit/src/config/observer-names.ts` | 57 |

`packages/mewkit/schemas/config-v1.json` (149 lines) is generated schema output and exempt by the AC's own terms.
No changed file crossed 200 lines because of this batch. No changed TypeScript adds an `any` or an unsafe cast
(`npm run typecheck` is clean and the only assertions are `as Level` / `as T` on a value just proved present).
No new TODO/FIXME, no commented-out code block, no unused import, no hardcoded secret, and no new `child_process`
call site targeting `bash`, `sh` or a `.sh` file — the pre-existing `tests/hooks/isolation.test.ts` spawn-site
allowlist is unchanged and passes, which is what caught an early `.exec(` that read as one.

`npm run lint` reports 0 errors and 3 warnings, all pre-existing and all in files this batch did not touch.

**PARTIAL** because the measurement is over the batch diff, not the sprint diff; AC-14 is restated at the end of
the sprint by its own terms.

## [AC-15] Every rejection and every refusal tells the user what to change — **PARTIAL**

Done for the config half. Every rejection carries a `code`, the offending `key`, the `scope` it came from
(`project config` / `user config`) and a concrete `fix`; a grammar failure names the file and the line
(`grammar-tab.yaml:2`); the protected-key rejection says WHICH hook cannot be disabled and WHY — "gate2-check
cannot be disabled from the project config: it is the Gate 2 proof the ship path runs" — rather than only that
the key is unknown. A test asserts no message in any of those paths contains `at Object.<anonymous>`, a stack
frame, or `YAMLException`: the parser's own exception never reaches the user, only the line and the fix.
The hatch refusals each name the reason and the alternative.

**PENDING (later batch).** `uninstall`'s refusals (`--force`, `doctor --adopt`), `doctor`'s findings, and the
`workflow-config set telemetry off` message stating that it wrote session state and that `.meowkit/config.yaml`
is where the preference becomes durable.

---

## Deviations and open questions for the evaluator

1. **`MEOWKIT_STORY_SIZER_COMMENT_TEMPLATE` reclassified from `drop` to `skill-option`** — it has a live reader.
   AC-01's own composition-aware verification clause found it; the contract never pins this name's class, and the
   inventory declares its round-1 drop list superseded. Drop class is 22, not 23. Flagging rather than burying it.
2. **The classification table lives at the repository root, not under a scanned tree.** No pinned scan exclusion
   was changed. The reason is in the scan script's header: inside a scanned tree, a dropped name's own row would
   make the deletion unobservable.
3. **The hook-side config reader is `.claude/hooks/lib/read-config.cjs`, not an addition to
   `meowkit-paths.cjs`** as Scope (In) describes. `meowkit-paths.cjs` is required by four observers and by
   `trace-log.cjs`; bolting the loader onto it would create require edges toward the config from modules a safety
   path could later reach, and AC-06's structural clause is the thing worth protecting. No AC names the file.
4. **`null-not-supported` and `float-not-supported` are two rejection identifiers the contract does not list.**
   They exist so AC-05 can hold: those are the two constructs where the two readers would otherwise disagree.
5. **`MEOWKIT_TDD=0` is now an env-level OFF** rather than an unrecognised-value warning, so that the top
   precedence level can answer in both directions. No golden fixture covers `=0`.
6. **The universe test asserts scan ⊆ table, not set equality**, because the 22 drop names are still present in
   docs prose. When that deletion lands the assertion should tighten to equality minus the drop rows.

---

# Batch B pass 1

Pass 1 of batch B closes three of batch A's `PARTIAL` criteria (AC-01, AC-04, AC-06) and lands one new one
(AC-08). AC-02's `init`/`upgrade` half and AC-09 … AC-13 are **not started**; they are listed as `PENDING` with
nothing partial on disk, so a later pass starts from a clean boundary rather than from half an implementation.

## Verification run at the pass-1 boundary

| Command | Result |
|---|---|
| `npm run build` | exit 0 |
| `npm run lint` | 0 errors, 3 warnings (all pre-existing, in `commands/{capabilities,orient,validate}.ts`) |
| `npm run typecheck` | exit 0, no output |
| `npx vitest run` | **260 files / 3100 tests passed**, 0 failed |
| `npx vitest run tests/config tests/hooks tests/ports` | 18 files / 414 tests passed, 0 failed |
| `node --test .claude/hooks/__tests__/*.test.cjs` | 36 pass / 0 fail |
| `node packages/mewkit/dist/index.js doctor` (clean env) | exit 0 — 14 passed, 4 warnings |
| `node packages/mewkit/dist/index.js validate` | 40 passed, 34 warnings, 1 n/a |
| `node packages/mewkit/dist/index.js inventory --check` | `Docs match the inventory.` |
| `node scripts/check-no-python.cjs --allow-existing-envs` | `All 28 checks passed with no Python interpreter on PATH.` |
| `node scripts/check-env-reads.cjs` | `PASS: 162 environment-name reads, all classified` |
| `node scripts/generate-config-schema.cjs --check` | `PASS` for both derived outputs |

The doctor row carries a condition worth reading: in a shell that still exports a removed name, `doctor` now
exits **1** by design (AC-04). The clean-env run above is `env -i PATH=… HOME=…`; this session's own environment
exports seven removed names and the same command exits 1 there, naming each. That is the criterion passing, not
a regression.

## [AC-01] The env-name universe is closed, classified, and nothing is unaccounted for — **MET**

The outstanding clause was the prose deletion. The universe is now **78** names against **84** at BASE, and the
universe test asserts **equality**, not containment:

```
$ sh scripts/scan-env-names.sh | wc -l
78
$ diff <(sort .../universe-at-base.txt) <(sort <(sh scripts/scan-env-names.sh))
< MEOWKIT_ACTIVE_AGENTS
< MEOWKIT_ACTIVE_PLAN
< MEOWKIT_BUILD_VERIFY_DEBUG
< MEOWKIT_COMPLEXITY
< MEOWKIT_HARNESS_RESUME_STEP
< MEOWKIT_SUGGESTED_PLAN
```

Six names are gone from the tree outright. The other fifteen `drop` rows survive for stated reasons, and that is
the part the reviewer should check rather than take on trust, because "delete every dropped name" turns out to be
false for three distinct reasons:

1. **Four are not environment names at all** — `MEOWKIT_TOKEN` is a compiled regex at
   `.claude/scripts/check-anthropic-context.py:33`; `MEOWKIT_INTERNAL_DIRS` and `MEOWKIT_INTERNAL_FILES` are
   exported `Set` constants in `packages/mewkit/src/migrate/discovery/`; `MEOWKIT_CONFIG` appears only inside an
   assertion that the workflow-config reader does **not** consult it. Renaming live code identifiers to satisfy a
   lexical scan would be a change with no behavioural content, and deleting a negative assertion would delete the
   proof it carries.
2. **Seven live only in `packages/docs/content/docs/changelog/archive.mdx`** — an archived changelog. AC-01 puts
   `RELEASING.md` out of scope because "a changelog is an immutable historical record"; the same reason applies to
   this file, which the scan's pinned tree list happens to include. Rewriting it would falsify what a past
   release shipped.
3. **`MEOWKIT_PM_AUTO` is still honored**, by agent prose rather than by code (D9: "documented prose-only with no
   schema key"). Deleting it would remove a user opt-out with nothing replacing it.
   **`MEOW_PROFILE`** survives only in the two assertions that no hook reads it any more.

Rather than leave those as prose caveats, they are **data with a test behind them**:
`env-name-classification.json` gains `retainedDropOccurrences`, one entry per surviving dropped name with the
file substring it may appear in and why, and `tests/config/env-universe.test.ts` asserts (a) the scan equals the
table minus the non-retained drops, and (b) every retained name occurs **only** in the files its reason names.
So a deletion that silently did not happen fails, and a retained occurrence that spreads to a new file also
fails — which is stricter than the equality-minus-drops the ruling asked for.

**One scan-scope addition, and the proof it does not move the BASE count.** `--exclude=removed-env-names.ts` is
added to the scan. That file is **generated from the classification table** (see AC-04) and lists every removed
name as a string literal, so without the exclusion a name's own removal record would keep it in the universe for
ever — the identical failure mode the table's root placement exists to avoid, and the identical reason the scan
already excludes `modules/`, `dist/` and `.next/`. It cannot change the BASE figure, because no such file exists
at BASE:

```
$ git ls-tree -r --name-only 085cb5bd | grep -c removed-env-names.ts
0
```

`universe-at-base.txt` is therefore still the correct BASE record, unchanged.

The copy of the scan at `tasks/reviews/evidence/.../scan-env-names.sh` is the BASE-era one that produced
`universe-at-base.txt` and is left as recorded; `scripts/scan-env-names.sh` is the live definition. They differ
only in the comment block and this one exclusion.

**One correction to batch A's own arithmetic.** The batch A section states `drop 22, skill-option 31`; the
committed table actually holds **21** `drop` and **32** `skill-option` rows (84 total, unchanged). The counted
figure in the prose was wrong, not the table. Pass 1 moves one further row: `MEOWKIT_EVAL_SLUG` goes from `drop`
to `runtime-handoff`, because `skills/evaluate/step-01-load-rubrics.md:110` **exports** it and
`step-04-grade-and-verdict.md:62,64` **reads** it to derive the verdict path, with the prose explicitly stating
that re-deriving the slug there would corrupt the evidence citations. That is a writer/reader pair — the
definition of the `runtime-handoff` class — and the same composition-aware verification clause that caught
`MEOWKIT_STORY_SIZER_COMMENT_TEMPLATE` in batch A is what caught it. Final classes: `drop` 20,
`runtime-handoff` 6, `skill-option` 32, `credential` 12, `toggle` 8, `safety-path` 5, `behavior-override` 1 = 84.

**One deletion is blocked, not skipped.** Five dropped names remain in `.meowkit/.env.example`
(`MEOWKIT_MEMORY_BUDGET`, `MEOWKIT_MEMORY_PRUNE`, `MEOWKIT_MEMORY_PRUNE_AGE_DAYS`,
`MEOWKIT_MEMORY_STALENESS_MONTHS`, `MEOWKIT_TDD_FLAG_DETECTOR`), together with the four toggle names that moved
to config keys. The edit was attempted and `privacy-block.cjs` refused it — `.env.*` is a protected pattern, and
the documented response is explicit human approval, which an agent cannot grant itself. The file is listed in
`retainedDropOccurrences` with that reason, so it is visible rather than forgotten. **This is the one AC-01
clause that needs a human: approve the edit to `.meowkit/.env.example`, or accept the file as out of scope.**

**Prose repointed rather than merely stripped.** Where a name was deleted but the mechanism survives, the prose
now names the mechanism: the four Agile-detection sites that keyed off the non-existent `MEOW_JIRA_BASE_URL` now
key off `MEOW_JIRA_SITE_URL`, which `skills/jira/scripts/jira-as.sh:35` actually requires — so a doc that could
never have been true became true. `session-continuation`'s four-variable state table became the state file that
actually carries the plan. `.claude/hooks/references/build-verify-commands.md`, `cheatsheet.mdx` and
`reference/configuration.mdx` had their env-var tables replaced by the config keys that now carry them, with the
seven protected names and the malformed-config behaviour stated beside them.

- **Verification:** `sh scripts/scan-env-names.sh | wc -l` → 78; `npx vitest run tests/config/env-universe.test.ts`
  → 12 passed, including the new equality and retained-occurrence cases; `node scripts/check-env-reads.cjs` → PASS

## [AC-04] … a removed name is loud — **MET**

The outstanding clause was the `mewkit doctor` half. Two new findings, in
`packages/mewkit/src/commands/doctor-config-checks.ts` (95 lines), wired into `doctor.ts`'s result list.

**The malformed config, with file and line:**

```
  [FAIL] Project config
         .meowkit/config.yaml:2: tabs are not allowed; indent with two spaces [tab-indentation]
         Fix: the config grammar is two levels of keys with boolean, whole-number or string values
```

and a protected key, which says WHICH hook and WHY rather than only that the key is unknown (AC-15):

```
  [FAIL] Project config
         .meowkit/config.yaml (hooks.gate-enforcement): gate-enforcement cannot be disabled from the
         project config: Gate 1 blocks source writes before the plan is approved [protected-hook]
         Fix: remove the key; a safety check is not a preference
```

**One finding per still-exported removed name**, tested on the real removed name the contract names and on a
reader-less drop:

```
$ MEOWKIT_LOOP_DETECT=off mewkit doctor
  [FAIL] Removed setting: MEOWKIT_LOOP_DETECT
         MEOWKIT_LOOP_DETECT is exported in this shell and nothing reads it. The setting moved to
         hooks.loop-detection in .meowkit/config.yaml, so the exported value is being ignored.
         Fix: set hooks.loop-detection in .meowkit/config.yaml, then unset MEOWKIT_LOOP_DETECT in your shell profile
$ echo $?
1

$ MEOWKIT_MEMORY_BUDGET=4000 mewkit doctor     # a reader-less drop
         … Nothing replaced it — the behaviour it selected is gone.
         Fix: unset MEOWKIT_MEMORY_BUDGET in your shell profile
$ echo $?
1
```

Each finding names the removed name, the config key that replaced it **or** the fact that nothing did, and the
file to edit; the exit code is non-zero for the finding class. With a clean environment the same command exits 0
and emits no such finding.

**The list is derived, not restated.** `scripts/generate-config-schema.cjs` gained a second output,
`packages/mewkit/src/config/removed-env-names.ts`, built from `env-name-classification.json`: every `toggle` row
(replacement = its config key) and every `drop` row (no replacement), minus a new `removalExempt` block for the
five names whose `drop` class means something other than "stop exporting this" — the four code identifiers and
`MEOWKIT_PM_AUTO`. `--check` now verifies **both** derived files, so the diagnostic cannot name a replacement key
the schema does not have. The two names that must NOT appear are asserted by name: `MEOWKIT_TDD` (still the
top-precedence override) and `MEOWKIT_AUTOBUILD_MODE` (the gate still reads it from the environment).

**One thing this deliberately does not do:** it reads the process environment only, not `.meowkit/.env`. The
question a user is asking is "why is my setting being ignored *in this session*", and a name a file sets but no
shell exported is not affecting this session.

- **Verification:** `npx vitest run packages/mewkit/src/commands/__tests__/doctor-config-checks.test.ts` →
  10 passed; the two shell transcripts above with their exit codes; `node scripts/generate-config-schema.cjs --check`

## [AC-06] … and the one escape hatch is user-scoped and logged — **MET**

The outstanding clause was the golden replay with the hostile config *physically present*. Done, and widened
past the three guard groups the batch A note named to all six groups the AC's verification lists:

```
$ npx vitest run tests/hooks/hostile-config.test.ts
Test Files  1 passed (1)
     Tests  44 passed (44)
```

38 of those 44 are one fixture each: 13 `gate1`, 12 `gate2-preship`, 5 `privacy`, 2 `guard-careful`,
3 `guard-freeze`, 3 `guard-investigate` — every fixture in those six recorded groups, replayed with
`.meowkit/config.yaml` carrying all seven weakenings. Exit code and marker are compared against the recording
for every fixture; for the three guard groups, which answer in a JSON envelope, the decision and its reason are
compared as well. A seventh test asserts the group list is complete, so a new recorded group cannot arrive
unreplayed.

`tests/hooks/lib/replay-harness.ts` gained one optional `seed` callback on `replay()`, called after the
fixture's own setup. The alternative — rebuilding the project tree inside the hostile test — would mean two
recipes for one tree, and a divergence between them would read as a behaviour difference in the code under test.
No fixture was relaxed and no normalizer was added.

- **Verification:** the run above; `git diff` on `tests/hooks/golden/` is empty

## [AC-08] `init` emits the config and a deny-all `.meowkit/.gitignore`, and the tracked set is exactly the allowlist — **PARTIAL**

**Done — the ignore semantics and the tracked set, asserted through real `git`.**
`packages/mewkit/src/commands/__tests__/setup-gitignore-denyall.test.ts` (173 lines, 10 tests) builds a scratch
`git init` repository with a **populated** `.meowkit/` — including `cache/.claude/hooks/dispatch.cjs` and
`cache/version`, so the cache assertion is made on a directory with real content in it rather than on an empty
one git would ignore anyway — runs the setup step, `git add -A`, and reads what git tracks:

```
.meowkit/.env.example
.meowkit/.gitignore
.meowkit/config.yaml
.meowkit/mcp.json.example
.meowkit/memory/decisions.md
```

Exactly the allowlist, and nothing else: `release-manifest.json`, `pack-manifest.json`,
`harness-inventory.json`, `metadata.json`, `.env`, `envs/`, `state/`, `telemetry/`, `backups/` and `cache/` are
all untracked. `git ls-files .meowkit/cache` is empty and `git check-ignore -v .meowkit/cache/version` names
`.meowkit/.gitignore:1:*`, which is the entire basis of the trust the uninstall half will rest on. `.claude/` is
tracked and `.claude/logs/` is not. `!release-manifest.json` is **absent, asserted by name**.

The file is the nine lines Req 8 writes and nothing else, asserted as an exact array rather than by substring.
It is shipped in the kit tree at `.meowkit/.gitignore` and is now in force in this repository
(`git check-ignore -v .meowkit/metadata.json` → `.meowkit/.gitignore:1:*`); the already-tracked
`config.json`, `pack-manifest.json` and `harness-inventory.json` keep being tracked, which is D11's stated and
accepted consequence — the deny-all bites on a fresh clone, not on an existing checkout.

**Done — the root template and the strip migration.** `.meowkit/gitignore.meowkit` lost every `.meowkit/*` line
and keeps exactly `.env`, `.env.local`, `session-state/`, `tasks/reports/`, `.claude/logs/`.
`stripSupersededMeowkitIgnores` is the sibling of the existing `stripStaleMemoryIgnore` and has the same shape:
an existing project seeded with the BASE root `.gitignore` plus a user `!.meowkit/state/keep-me.json` negation
loses the five superseded lines, keeps the negation untouched, keeps all five non-`.meowkit` entries, and is a
no-op on the second run.

**PENDING.** The `Given` is "a fresh `mewkit init`", and the assertions above are made through the `gitignore`
setup step, which is the code `init` and `setup` both reach. A real `mewkit init` fetches a release asset over
the network, which this pass had no sanctioned way to stub inside a throwaway project; the kit-copy path that
lays `.meowkit/.gitignore` down is therefore shipped and reviewable but not executed. That execution belongs
with AC-02's `init` work and the AC-09 snapshot wiring, which are the same `init`/`upgrade` touch points.

- **Verification:** `npx vitest run packages/mewkit/src/commands/__tests__/setup-gitignore-denyall.test.ts` →
  10 passed; `git check-ignore -v` per path in this repository

## [AC-02] — **PARTIAL (unchanged from batch A)**

Nothing in pass 1 advanced the `init`/`upgrade` half, with one exception that belongs to AC-04 and is noted
because it is visible in `doctor` output: a project carrying only the v2 `.meowkit/config.json` and no
`config.yaml` is now reported as **migration-pending**, naming `mewkit upgrade` as the next action, which is one
of AC-02's own clauses:

```
  [WARN] Project config
         .meowkit/config.json is the v2 descriptor and .meowkit/config.yaml does not exist yet — migration pending.
         Fix: mewkit upgrade — it snapshots the old file, carries every value that has an equivalent across,
              and names the ones that do not
```

Still outstanding: `init` writing the commented stub with its `$schema`, the `mewkit status` repointing,
`core/validate-install.ts:57`, removal of `.meowkit/config.json` from the kit source tree, and the migration
itself. The `Fix` text above promises a migration that does not exist yet — it is the named next action, and it
must land before this AC can pass.

## [AC-09] … [AC-13] — **PENDING**

Not started, and nothing partial is on disk. `core/snapshot.ts`, `commands/uninstall.ts`,
`commands/backups.ts`, the local kit cache written by `init`/`upgrade`, the extension of ownership metadata to
the kit-shipped `.meowkit/` subset, the trusted-kit-source deletion gate, `doctor --adopt`, the
clone-without-init journey and `--json`/`--dry-run`/exit-3 across the seven mutating commands are all untouched.
`.meowkit/.gitignore` (AC-08) is the one piece of the ownership half that landed, and it is the piece the rest
depends on: it is what keeps the cache untracked.

## [AC-14] Code quality over the sprint diff — **PARTIAL (measured over batch A + batch B pass 1)**

Measured over `git diff 085cb5bd` at the end of pass 1, excluding `tasks/`:
**44 tracked files changed (+427 / −233)**, plus the new files listed in the batch A section and these:

| New file | Lines |
|---|---|
| `packages/mewkit/src/commands/doctor-config-checks.ts` | 95 |
| `packages/mewkit/src/config/removed-env-names.ts` (generated) | 38 |
| `packages/mewkit/src/commands/__tests__/doctor-config-checks.test.ts` | 98 |
| `packages/mewkit/src/commands/__tests__/setup-gitignore-denyall.test.ts` | 173 |
| `.meowkit/.gitignore` | 9 |

No new file exceeds 200 lines. **Changed files already over 200 at BASE that grew**, by name with both counts,
as the AC requires:

| File | BASE | Final |
|---|---|---|
| `packages/mewkit/src/commands/doctor.ts` | 408 | 411 |
| `packages/mewkit/src/commands/setup-steps.ts` | 270 | 336 |

Neither crossed 200 because of this sprint — both were already over it — and neither grew for a reason that a
split would improve: `doctor.ts` gained three lines in its result list, and `setup-steps.ts` gained the deny-all
constant and the strip function beside the sibling strip function they mirror. The config-check logic itself went
into a new 95-line module rather than into `doctor.ts`.

No changed TypeScript adds an `any` or an unsafe cast (`npm run typecheck` clean). No new TODO/FIXME, no
commented-out code block, no unused import, no hardcoded secret, and no new `child_process` call site targeting
`bash`, `sh` or a `.sh` file — the two new `execFileSync`/`spawnSync` sites call `git` and `grep` with argument
arrays, and the pre-existing spawn-site allowlist test passes unchanged. `npm run lint`: 0 errors, 3 pre-existing
warnings.

**Still PARTIAL** by the AC's own terms: the measurement is at a pass boundary, not at the end of the sprint.

## [AC-15] Every rejection and every refusal tells the user what to change — **PARTIAL**

Pass 1 adds the two message paths AC-04 owns, both asserted: the malformed-config report names the file, the
line, the offending key and the code, carries a concrete `fix`, and contains neither a stack frame nor
`YAMLException`; the removed-name finding names the scope ("exported in this shell"), the replacement key or its
absence, and the file to edit.

**Still PENDING:** `uninstall`'s refusals, `doctor --adopt`'s refusal, and the `workflow-config set telemetry off`
message. All three belong to commands that do not exist yet.

---

## Cumulative verdict table — supersedes the per-section verdicts above

| AC | Verdict | Outstanding |
|---|---|---|
| AC-01 | **MET** | one clause needs human approval: the `.meowkit/.env.example` edit the privacy hook refused |
| AC-02 | PARTIAL | `init` stub + `$schema`, `status`, `validate-install.ts:57`, kit-tree `config.json` removal, the `upgrade` migration |
| AC-03 | MET | — |
| AC-04 | **MET** | — |
| AC-05 | MET | — |
| AC-06 | **MET** | — |
| AC-07 | MET | — |
| AC-08 | **PARTIAL** | semantics + tracked set proved through `git`; a real `mewkit init` run not executed |
| AC-09 | PENDING | `core/snapshot.ts`, `backups list/restore`, the cache exclusion |
| AC-10 | PENDING | `commands/uninstall.ts`, the eight invocations, the trusted-kit-source deletion gate |
| AC-11 | PENDING | `doctor` drift + `--adopt`, the five fixtures |
| AC-12 | PENDING | the recorded clone-without-init journey |
| AC-13 | PENDING | `--json`/`--dry-run` across the seven mutating commands, exit 3 for the four destructive ones |
| AC-14 | PARTIAL | restate at sprint end |
| AC-15 | PARTIAL | the `uninstall`/`--adopt`/`workflow-config` messages |

## Deviations and open questions added by pass 1

7. **`MEOWKIT_EVAL_SLUG` reclassified `drop` → `runtime-handoff`.** It has a real writer/reader pair across two
   evaluate steps, and the prose says re-deriving it would corrupt the evidence citations. Same precedent as
   batch A's `MEOWKIT_STORY_SIZER_COMMENT_TEMPLATE` finding; no AC pins this name's class.
8. **Fifteen of the 21 `drop` rows survive in the tree, by data rather than by prose.** Four are code
   identifiers that are not environment names, seven live only in an archived changelog, `MEOWKIT_PM_AUTO` is
   still honored by prose per D9, `MEOW_PROFILE` survives only in assertions of its own removal, and five are in
   the privacy-blocked `.env.example`. Each is a `retainedDropOccurrences` entry with its allowed files and its
   reason, and the universe test enforces both directions. **The archived-changelog call is the one worth
   disputing:** AC-01 puts `packages/docs/**` in scope and `RELEASING.md` out, and
   `packages/docs/content/docs/changelog/archive.mdx` is a changelog inside an in-scope tree. Pass 1 treats it as
   historical record on AC-01's own stated reason rather than rewriting it.
9. **`--exclude=removed-env-names.ts` added to the pinned scan.** Required, or the generated removal record
   keeps every removed name in the universe for ever. Proved not to move the BASE figure: no file of that name
   exists at BASE.
10. **Batch A's class counts were arithmetically wrong** (`drop 22 / skill-option 31` vs the table's
    `21 / 32`). The table was right; the prose was not. Corrected above.
11. **The `.meowkit/.env.example` edit was refused by `privacy-block.cjs`** and is the one AC-01 clause an agent
    cannot complete. It needs explicit human approval, and there is no sanctioned agent path around it.
12. **`MEOWKIT_GITIGNORE` was renamed `KIT_DIR_GITIGNORE`** after the universe test caught it: a new exported
    constant with that prefix enters the name universe as a phantom environment variable. Worth recording as a
    live constraint on naming in this repository, not just a one-off fix.

## Human-approved override: `.meowkit/.env.example`

`privacy-block.cjs` refused an agent edit to `.meowkit/.env.example` (protected `.env.*` pattern). The user approved the edit explicitly (2026-11-08, "Yes, approve access"); the coordinator made it and logged it to `.meowkit/telemetry/security-log`. The template carries no secret values. Removed: the four memory names (`MEOWKIT_MEMORY_BUDGET`, `MEOWKIT_MEMORY_PRUNE`, `MEOWKIT_MEMORY_PRUNE_AGE_DAYS`, `MEOWKIT_MEMORY_STALENESS_MONTHS`), `MEOWKIT_TDD_FLAG_DETECTOR`, and the seven names that moved to config keys (`budget.warn|block|cap`, `hooks.build-verify|loop-detection|pre-completion-check`, `projectContext.maxBytes`), replaced by one block pointing at `.meowkit/config.yaml`. The precedence comment now names `config.yaml` instead of the `settings.json` env block. The table's `retainedDropOccurrences` no longer lists the file, and `MEOWKIT_TDD_FLAG_DETECTOR` left it entirely (no occurrence remains). `npx vitest run tests/config` → 85 passed.

Also ruled by the coordinator under the user's "follow recommended options" directive: `packages/docs/content/docs/changelog/archive.mdx` is kept as historical record (AC-01's own reason for excluding `RELEASING.md`); `MEOWKIT_PM_AUTO` prose is kept as a documented prose-only opt-out.

---

# Batch B pass 2

Pass 2 builds the thing the previous two passes were blocked on — a harness that runs the REAL `init` and
`upgrade` inside a throwaway project with no network — and then uses it to close AC-08 and the `init`/`upgrade`
half of AC-02, and to land the snapshot module, the `backups` verb and the local kit cache. AC-10 … AC-13 are
still **PENDING**; `commands/uninstall.ts`, `doctor --adopt`, the clone journey and the `--json`/`--dry-run`
matrix over the remaining mutating commands are untouched, with nothing partial on disk.

## Verification run at the pass-2 boundary

| Command | Result |
|---|---|
| `npm run build` | exit 0 |
| `npm run lint` | 0 errors, 3 warnings (all pre-existing, in `commands/{capabilities,orient,validate}.ts`) |
| `npm run typecheck` | exit 0, no output |
| `npx vitest run` | **264 files / 3124 tests passed**, 0 failed |
| `npx vitest run tests/config tests/hooks tests/ports tests/install` | 22 files / 438 tests passed, 0 failed |
| `node --test .claude/hooks/__tests__/*.test.cjs` | 36 pass / 0 fail |
| `node packages/mewkit/dist/index.js doctor` (clean env) | exit 0 — 13 passed, 5 warnings |
| `node packages/mewkit/dist/index.js validate` | 39 passed, 35 warnings, 1 n/a |
| `node packages/mewkit/dist/index.js inventory --check` | `Docs match the inventory.` |
| `node scripts/check-no-python.cjs --allow-existing-envs` | `All 28 checks passed with no Python interpreter on PATH.` |
| `node scripts/check-env-reads.cjs` | `PASS: 163 environment-name reads, all classified` |
| `node scripts/generate-config-schema.cjs --check` | `PASS` for both derived outputs |

The doctor row carries the same condition pass 1 recorded: in a shell exporting a removed name it exits 1 by
design (AC-04). This session's shell exports `MEOWKIT_BUDGET_BLOCK` and `MEOWKIT_BUDGET_WARN`, and `doctor`
names both; the clean-env run above unsets them.

## The install harness — the thing that unlocked this pass

`tests/install/install-harness.ts` (133 lines) runs the published CLI binary in a `mkdtemp` project with its
own `HOME`, against a release asset built from this repository's own kit tree. Two code changes make that
possible, and both are small on purpose:

- `packages/mewkit/src/core/local-release-source.ts` (53 lines): when `MEOWKIT_RELEASE_SOURCE` names a
  directory, `fetchReleases()` returns one synthetic release and `downloadRelease()` copies that directory to a
  temp dir in the shape an extracted release has. Nothing downstream is aware of it — the same `smartUpdate`
  call runs. The directory is COPIED because the caller cleans up what the download produced, and a fixture has
  to survive its own use. The name is classified in `env-name-classification.json` under `skill-option`
  (D8 class (e), which covers test-only names), with the same precedent as `MEOWKIT_AFTER`.
- `init --yes`: answers every prompt with its default (newest stable, the base kit, the full profile, no API
  keys, no system deps). `--yes` already existed for `upgrade`/`pack`/`migrate`; `init` is added to that flag's
  command list, which AC-13 requires anyway.

Why this matters beyond convenience: `init` and `upgrade` were the only commands no test could execute, and they
are exactly the commands that decide what the kit laid down and therefore what it later owns. Every assertion
below is made on a tree a real `mewkit init` produced.

## [AC-02] One committed config exists, with a schema, commented stubs, and no forbidden key surface — **PARTIAL**

**Done — `init` writes the file.** `packages/mewkit/src/config/write-stub.ts` (116 lines) renders it;
`core/smart-update.ts` writes it where the `config.json` template used to be written. A real run:

```
$ mewkit init --yes          # in a scratch git repo, MEOWKIT_RELEASE_SOURCE pointed at a local asset
...
MeowKit installed!
$ head -12 .meowkit/config.yaml
# MeowKit project configuration — committed, human-owned, schema-validated.
#
# Every setting below is commented out. Uncomment only what this project
# decides, so the committed file reads as a list of choices rather than a
# copy of the defaults.
#
# Two levels of keys; values are true/false, whole numbers or plain strings.
# A gate is not a preference: there is no `gates.` or `paths.` key at any
# scope, and an unknown key is an error rather than being ignored.

$schema: https://meowkit.dev/schemas/config-v1.json

# strict test-first mode. MEOWKIT_TDD in the environment still outranks this.
#tdd: false
```

`tests/config/config-stub.test.ts` (7 tests) asserts the stub has **exactly one** live line — the `$schema`
pointer — that the set of stubbed keys **equals** `knownKeys()` (so the stub cannot drift from the schema in
either direction), that `$schema` is the `$id` the generator publishes, and that `pm.auto` appears nowhere.

**Done — the resolver and every reader.** `state/resolve-config-path.ts` now names one file,
`.meowkit/config.yaml`, with **no fallback**, and adds `legacyDescriptorPath()` / `migrationPending()`. All six
readers are repointed: `index.ts` (`status`, which now prints the keys the loader applied and has no `features`
block), `core/validate-install.ts:57` (now a `config.yaml` check that reports migration-pending instead of
failing), `commands/doctor.ts`, `commands/doctor-checks.ts` (`checkConfig` is now deliberately shallow —
presence only; the contents are the project-config check's job, and two checks parsing one file eventually
disagree about it), `commands/validate.ts` (`Project config valid`, via the real loader, with absent treated as
defaults rather than as failure) and `core/smart-update.ts:240`.

**Done — the v2.15 migration.** `config/migrate-descriptor.ts` (104 lines) plans it purely;
`commands/migrate-config-descriptor.ts` (61 lines) performs and reports it; `upgrade` snapshots first, then
calls it. `tests/install/config-migration.test.ts` builds the fixture the AC describes — an installed project
put back into the v2 shape with `.meowkit/config.json` **tracked and committed** carrying non-default
`features` — and asserts the whole journey:

```
Migrating .meowkit/config.json → .meowkit/config.yaml
  carried features.costTracking → hooks.budget-tracker: false
  carried features.memory → hooks.learning-observer: false
  not carried $schema — a pointer to the old descriptor's own schema; the new file carries its own
  not carried version — the installed version is recorded in .meowkit/metadata.json, which is where it belongs
  not carried project.description — a project description is not a setting; keep it in the project's README
  .meowkit/config.json removed; its contents are in the snapshot this run took
```

The carried values appear **uncommented** (`hooks:` with two keys under it), everything nobody chose stays a
commented stub, `$schema` survives, and the subsequent `mewkit status` reads the carried values back through the
loader. The snapshot the run took is asserted to contain `.meowkit/config.json` by path. `doctor` and `status`
both report the pre-upgrade project as migration-pending and name `mewkit upgrade`.

**One grammar change this forced, in both readers.** `$schema` failed the key pattern
(`/^[A-Za-z][A-Za-z0-9_.-]*$/`) in `config/yaml-grammar.ts` AND `.claude/hooks/lib/yaml-subset.cjs`, so a config
carrying a live `$schema` line was **rejected by the loader** — which the earlier passes did not catch because
no accepted fixture had one. Both readers now admit exactly `$schema` and both rule sets skip it;
`tests/config/fixtures/accept-schema-pointer.yaml` is added to the shared corpus so AC-05 proves the two agree
on it. This was a real defect, found by running the product rather than by reading it.

**Outstanding — three clauses, and the first is the one that keeps this PARTIAL rather than MET.**

1. `.claude/scripts/lib/workflow-config-core.cjs:28` still resolves `.meowkit/config.json`. AC-02's clause is
   "no file in `packages/mewkit/src` or `.claude/` ships or reads it", and that file does. Repointing it is
   **D10's** work — `workflow-config get|has` resolving session state → project → user → default and
   `set` writing only `.meowkit/state/workflow-state.json` — which is also the outstanding AC-15 message. It is
   pinned by `tests/ports/golden`, so it is a port rather than an edit, and pass 2 did not start it.
2. This repository's own tracked `.meowkit/config.json` is still present. The only path that removes it is the
   `upgrade` migration, and running `mewkit upgrade` against this repository is forbidden. `mewkit status` here
   correctly prints `Config: migration pending`.
3. "in no path does `uninstall` delete that user-committed file" cannot be asserted until `uninstall` exists.

- **Verification:** `npx vitest run tests/install/config-migration.test.ts` → 4 passed;
  `npx vitest run tests/config/config-stub.test.ts` → 7 passed; the `init --yes` transcript above

## [AC-08] `init` emits the config and a deny-all `.meowkit/.gitignore`, and the tracked set is exactly the allowlist — **MET**

The outstanding clause was "a real `mewkit init` run not executed". Executed.
`core/install-meowkit-dir.ts` (86 lines) now owns `KIT_DIR_GITIGNORE` and the kit-shipped `.meowkit/` member
list, and `smart-update` lays both down — so the ignore file arrives with the INSTALL rather than only with
`mewkit setup`. That was a real gap: a project that ran `init` alone had no `.meowkit/.gitignore` at all, which
is the single guarantee the deletion path rests on.

```
$ mewkit init --yes && git add -A && git ls-files .meowkit
.meowkit/.env.example
.meowkit/.gitignore
.meowkit/config.yaml
.meowkit/mcp.json.example
```

Exactly the allowlist. `.meowkit/.gitignore` is the nine lines Req 8 writes, asserted as an exact array;
`!release-manifest.json` is absent. `cache/`, `metadata.json`, `state/`, `telemetry/`, `backups/` and `envs/`
are untracked. `setup-steps.ts` re-exports the constant it used to own, so the setup path is unchanged.

- **Verification:** `npx vitest run tests/install/init-offline.test.ts` → 4 passed, on a tree a real `init` built

## Local kit cache (D12 user decision) — **landed**

`packages/mewkit/src/core/kit-cache.ts` (90 lines). `init` and `upgrade` write `.meowkit/cache/` — the release's
`.claude/` tree, the kit-shipped `.meowkit/` members, and `cache/version` — **before** `cleanupDownload` removes
the temp directory, which is the only place the kit's own bytes ever exist. The version is written LAST and the
previous one removed FIRST, so an interrupted run leaves a cache with no version rather than new content
labelled with the old version. `agreesWithKit()` is the deletion predicate the uninstall half will use; a path
the cache does not hold is **not** agreement, so the caller must refuse rather than fall back to the baseline.

```
$ cat .meowkit/cache/version
9.9.9-fixture
$ git ls-files .meowkit/cache          # empty
$ git check-ignore -v .meowkit/cache/version
.meowkit/.gitignore:1:*	.meowkit/cache/version
```

The cached `dispatch.cjs` is asserted byte-identical to the installed one. A `--dry-run` install writes no cache
at all, because it installed nothing.

## [AC-09] Nothing mutates without a snapshot, and restore is checksum-equal — **PARTIAL**

`core/snapshot.ts` (161 lines) + `core/snapshot-restore.ts` (73) + `commands/backups.ts` (105), wired into
`init` and `upgrade` before their first write.

**Done.** One snapshot per run under `.meowkit/backups/<id>/`, `files/<relpath>` plus a `manifest.json` of path +
pre-mutation checksum; the manifest is written LAST, so an interrupted run leaves a directory without one and
`backups list` shows an incomplete snapshot as absent rather than as a manifest promising files that are not
there. `.meowkit/cache/` is excluded by prefix. `backups list` reports id, timestamp, originating command and
file count and supports `--json`. `restore <id>` is checksum-equal (asserted by reading the file back after a
real upgrade overwrote it), snapshots the pre-restore state first — so the restore is itself undoable, and the
message says so — and a bad id exits non-zero naming the id and pointing at `backups list`. A `--dry-run`
install creates no `backups/` entry.

**One design decision worth the reviewer's attention.** A snapshot records only files that EXIST at the moment
it is taken. An earlier draft recorded a not-yet-existing target as "was absent" so a restore could delete it;
that is wrong twice over — a restore has no mandate to delete, and a directory target that does not exist cannot
be enumerated into the files the run will create. The visible consequence is that **a fresh install snapshots
nothing**, which is correct: it overwrites nothing. An `init` in update mode and every `upgrade` do snapshot.

**Outstanding.** The `uninstall` snapshot (the command does not exist); the mid-mutation interruption case is
designed for (manifest-last) but not exercised by a test; and the `--dry-run` clause is proved for `init`, not
yet for `upgrade`, which does not accept the flag.

- **Verification:** `npx vitest run tests/install/snapshot-and-cache.test.ts` → 8 passed, including the
  cache-byte-identical-across-a-restore comparison and the no-cache-path-in-any-manifest assertion

## [AC-10] … [AC-12] — **PENDING**

Not started, nothing partial on disk. `commands/uninstall.ts`, the eight invocations, the tampered-baseline and
three cache-degraded fixtures, `doctor`'s drift report and `--adopt`, and the clone-without-init journey are all
untouched. The two things they depend on — the deny-all ignore file in force from `init`, and the local kit
cache — both exist now, which is what the previous pass named as the blocker.

## [AC-13] Mutating commands preview and emit JSON; destructive ones refuse to run blind — **PARTIAL**

Landed: `backups` is declared in `cli/command-catalogue.ts` with `--json` and `--dry-run`, both implemented;
`init` gains `--yes`; the generated CLI flag reference was regenerated so help and the catalogue agree
(`MEOWKIT_WRITE_SYNOPSIS=1 npx vitest run packages/mewkit/src/cli`). Two verbs are planned for this sprint and
one of them (`backups`) now resolves.

Deliberately NOT done, and recorded because the opposite would be worse: `--dry-run` was briefly declared for
`setup` and `upgrade` and then **withdrawn**, because neither command honours it yet and a declared flag that
does nothing is a lie in `--help`. The flag goes in with the behaviour.

Outstanding: `--json` and `--dry-run` on `init`, `upgrade`, `setup`, `uninstall`, `pack add|remove`, `migrate`;
the byte-identical-tree assertion per dry run; exit 3 in a non-TTY without `--yes` for the four destructive
commands; and the kit-verb resolution validator over the finished tree.

## [AC-14] Code quality over the sprint diff — **PARTIAL (measured over batch A + batch B passes 1–2)**

`git diff --stat 085cb5bd` excluding `tasks/`: **57 files changed (+673 / −371)**; over `.claude` and
`packages/mewkit/src` alone, 34 files (+478 / −235).

New source files in pass 2, all under 200 lines:

| File | Lines |
|---|---|
| `packages/mewkit/src/core/snapshot.ts` | 161 |
| `packages/mewkit/src/config/write-stub.ts` | 116 |
| `packages/mewkit/src/commands/backups.ts` | 105 |
| `packages/mewkit/src/config/migrate-descriptor.ts` | 104 |
| `packages/mewkit/src/core/kit-cache.ts` | 90 |
| `packages/mewkit/src/core/install-meowkit-dir.ts` | 86 |
| `packages/mewkit/src/core/snapshot-restore.ts` | 73 |
| `packages/mewkit/src/commands/migrate-config-descriptor.ts` | 61 |
| `packages/mewkit/src/core/local-release-source.ts` | 53 |
| `tests/install/install-harness.ts` | 133 |
| `tests/install/snapshot-and-cache.test.ts` | 125 |
| `tests/install/config-migration.test.ts` | 98 |
| `tests/config/config-stub.test.ts` | 97 |
| `tests/install/init-offline.test.ts` | 59 |

**Changed files already over 200 lines at BASE that grew**, by name with both counts, as the AC requires:

| File | BASE | Final |
|---|---|---|
| `packages/mewkit/src/commands/init.ts` | 968 | 999 |
| `packages/mewkit/src/commands/validate.ts` | 951 | 956 |
| `packages/mewkit/src/core/smart-update.ts` | 621 | 624 |
| `packages/mewkit/src/index.ts` | 469 | 497 |
| `packages/mewkit/src/commands/doctor.ts` | 408 | 411 |
| `packages/mewkit/src/commands/upgrade.ts` | 387 | 412 |
| `packages/mewkit/src/commands/doctor-checks.ts` | 395 | 402 |
| `packages/mewkit/src/commands/setup-steps.ts` | 270 | 304 |
| `packages/mewkit/src/cli/command-catalogue.ts` | 301 | 308 |
| `.github/workflows/ci.yml` | 364 | 374 |
| `packages/docs/content/docs/cli/index.mdx` | 409 | 423 |
| `packages/docs/content/docs/reference/configuration.mdx` | 243 | 264 |
| `packages/docs/content/docs/cheatsheet.mdx` | 213 | 220 |

None crossed 200 because of this sprint — all were already over — and every growth is a wiring line or a call
into a new module rather than new logic in a large file: `setup-steps.ts` net-shrank its own content by handing
the ignore constant to `core/install-meowkit-dir.ts`, and `smart-update.ts` grew three lines while replacing a
20-line inline template with two function calls. `.mdx` and `.yml` are exempt from the line rule by the AC's own
terms; both `cli/index.mdx` and the `ci.yml` row are generated or declarative.

No changed TypeScript adds an `any` or an unsafe cast (`npm run typecheck` clean; the only matches for `any` in
the added lines are the words "if any" in two comments). No new TODO/FIXME, no commented-out code block (the
commented key stubs the renderer emits are data, exempt by name), no unused import, no hardcoded secret, and no
new `child_process` call site targeting `bash`, `sh` or a `.sh` file — the new spawn sites call `git`, `node`,
`find`/`shasum` and `sh scripts/scan-env-names.sh` from tests, and the pre-existing spawn-site allowlist test
passes unchanged. `npm run lint`: 0 errors, 3 pre-existing warnings.

## [AC-15] Every rejection and every refusal tells the user what to change — **PARTIAL**

Pass 2 adds three message paths, all asserted: the migration report names each carried key with the key it
became and each uncarried key with WHY it could not come across; `backups restore` with an unknown id names the
id, lists the available ones and points at `backups list`; an unreadable descriptor is left in place with the
file named and `mewkit upgrade` as the retry. A failed cache write says so and states the consequence
(`uninstall` will refuse until `mewkit upgrade` writes it).

**Still PENDING:** `uninstall`'s refusals, `doctor --adopt`'s refusal, and the `workflow-config set telemetry
off` message — the first two belong to commands that do not exist, the third to D10.

## Cumulative verdict table — supersedes every per-section verdict above

| AC | Verdict | Outstanding |
|---|---|---|
| AC-01 | MET | — (the `.env.example` clause was closed by the human-approved override recorded above) |
| AC-02 | **PARTIAL** | `workflow-config-core.cjs:28` still reads `.meowkit/config.json` (D10); this repo's own tracked descriptor; the `uninstall` survival clause |
| AC-03 | MET | — |
| AC-04 | MET | — |
| AC-05 | MET | — (corpus gained the `$schema` fixture) |
| AC-06 | MET | — |
| AC-07 | MET | — |
| AC-08 | **MET** | — |
| AC-09 | **PARTIAL** | the `uninstall` snapshot; `upgrade --dry-run`; the mid-mutation interruption test |
| AC-10 | PENDING | `commands/uninstall.ts` and its eight invocations |
| AC-11 | PENDING | `doctor` drift + `--adopt`, the five fixtures |
| AC-12 | PENDING | the recorded clone-without-init journey |
| AC-13 | **PARTIAL** | `--json`/`--dry-run` on the other six mutating commands; exit 3 for the four destructive ones |
| AC-14 | PARTIAL | restate at sprint end |
| AC-15 | PARTIAL | the `uninstall`/`--adopt`/`workflow-config` messages |

## Deviations and open questions added by pass 2

13. **`$schema` is the one UNCOMMENTED line in the stub.** AC-02's `Then` requires the config to "carry a
    `$schema` pointing at the published JSON Schema" while its `Verification` says "assert every line is
    commented". Those two cannot both hold literally: a commented pointer is inert — no editor validates against
    it — so it would not be carried in any sense that matters. The reading taken is that "every line is
    commented" governs the KEY STUBS, whose stated reason is "so an uncommented file is the user's own choices,
    not the kit's defaults", and `$schema` is neither a choice nor a default. The test asserts the live-line set
    is **exactly** `["$schema: …"]`, so the exception cannot quietly widen.
14. **Both YAML readers were changed to admit `$schema`.** It failed the key pattern in each, which means the
    file the installer was about to write would have been rejected by the loader. Found by running `mewkit
    status` on a migrated fixture. A corpus fixture now covers it on both readers.
15. **A new environment name enters the universe: `MEOWKIT_RELEASE_SOURCE`**, classified `skill-option`. It is
    the local-release injection that makes `init`/`upgrade` testable offline. The alternative designs were worse:
    a second code path for "local install" would mean the tested path is not the shipped one, and a local HTTP
    server still needs an override to point the CLI at it. Precedent for a test-harness name in this class:
    `MEOWKIT_AFTER`.
16. **`init --yes` is new behaviour, not just a flag.** Before it, `init` could only be driven by a human, so no
    test executed the install. It picks the newest stable release, the base kit, the full profile, no API keys
    and no system dependencies. AC-13 requires `--yes` on `init` anyway, and `b("yes", …)` already listed three
    other commands.
17. **A snapshot records only files that exist**, so a fresh install snapshots nothing. Reasoning in the AC-09
    section; the alternative recorded "was absent" entries and gave `restore` a deletion mandate it should not
    have.
18. **`--dry-run` was declared for `setup` and `upgrade` and then withdrawn** because neither honours it yet.
    Recorded so the next pass adds flag and behaviour together rather than finding a stale declaration.
19. **`doctor-checks.checkConfig` is now deliberately shallow** (presence only). The file's contents are reported
    by `checkProjectConfig`, which owns the grammar, the line number and the protected-key wording. Two checks
    parsing one file is two things to keep in step.
20. **The generated CLI flag reference was regenerated** (`packages/docs/content/docs/cli/index.mdx`) via the
    repo's own `MEOWKIT_WRITE_SYNOPSIS=1` path, because `backups` and `init --yes` changed the catalogue.

---

# Batch B pass 3

Pass 3 lands the ownership half: `uninstall` with the eight invocations, `doctor`'s drift/cache/disclosure rows
and `--adopt`, the exit-3 rule for all four destructive commands, `upgrade --dry-run`/`--force`, the kit-verb
resolution validator, and D10's `workflow-config` repointing — which was AC-02's last `.claude/` reader and
AC-15's last message. This repository's own tracked `.meowkit/config.json` is migrated and deleted.
**AC-12 (the recorded clone-without-init journey) is the one criterion still `PENDING`**, and AC-13 keeps one
outstanding clause (`--json`/`--dry-run` on `setup`, `pack add|remove`, `migrate`, and `--json` on `init`).

## Verification run at the pass-3 boundary

| Command | Result |
|---|---|
| `npm run build` | exit 0, 0 TS errors |
| `npm run lint` | 0 errors, 3 warnings (all pre-existing, in `commands/{capabilities,orient,validate}.ts`) |
| `npm run typecheck` | exit 0, no output |
| `npx vitest run` | **268 files / 3162 tests passed**, 0 failed |
| `npx vitest run tests/hooks tests/ports tests/config tests/install` | 28 files / 476 tests passed, 0 failed |
| `node --test .claude/hooks/__tests__/*.test.cjs` | 36 pass / 0 fail |
| `node packages/mewkit/dist/index.js doctor` (clean env) | exit 0 — 15 passed, 5 warnings |
| `node packages/mewkit/dist/index.js validate` | 40 passed, 34 warnings, 1 n/a |
| `node packages/mewkit/dist/index.js inventory --check` | `Docs match the inventory.` |
| `node scripts/check-no-python.cjs --allow-existing-envs` | `All 28 checks passed with no Python interpreter on PATH.` |
| `node scripts/check-env-reads.cjs` | `PASS: 163 environment-name reads, all classified` |
| `node scripts/generate-config-schema.cjs --check` | `PASS` for both derived outputs |
| `node scripts/check-kit-verbs.cjs` (new) | `PASS: 185 mewkit verb reference(s), all resolving to one of 31 subcommands` |
| `sh scripts/scan-env-names.sh | wc -l` | 78 (unchanged; one retention record's file name moved, see deviation 27) |

The clean-env doctor run is `env -i PATH=… HOME=…`: this session's shell exports removed names, and `doctor`
exits 1 there by design (AC-04). Both `validate --target codex` and `--target cursor` report "not a <target>
target" against this repository, as they did at BASE — the repository is the kit source, not a generated target.

## [AC-02] One committed config exists … — **MET**

Pass 2 left three clauses. All three are closed.

**1. `workflow-config` no longer reads the v2 descriptor (D10).** `.claude/scripts/lib/workflow-config-core.cjs`
is repointed: `get|has` resolve **session state → project config → user config → default**, and `set` writes
**only** `.meowkit/state/workflow-state.json`. The committed config is never written by an agent.

```
$ node .claude/scripts/bin/workflow-config set telemetry off
Set telemetry for this project in .meowkit/state/workflow-state.json (session state).
To make it durable for everyone, set it in .meowkit/config.yaml instead — state is not committed.
$ echo $?
0
$ node .claude/scripts/bin/workflow-config get telemetry
off
```

`skip_eng_review` is **refused as a config key** by both readers, with the name, the reason and the state
command in the message rather than a bare `unknown-key`:

```
code: state-only-key
message: skip_eng_review is not a config key in the project config: it suppresses the review step that gates
         shipping, so it is a per-project choice rather than a committed one
fix:     remove the key and run .claude/scripts/bin/workflow-config set skip_eng_review true, which records it
         in .meowkit/state/
```

`STATE_ONLY_KEYS` is declared in `config/schema.ts` and `.claude/hooks/lib/config-keys.cjs`, and
`tests/config/fixtures/reject-state-only-key.yaml` is in the shared corpus, so `reader-agreement` proves the
hook reader reaches the same identifier (AC-03/AC-05 cover it automatically).

**Golden parity, and the divergences, by name.** All 23 `tests/ports/golden/config-*` fixtures replay. stdout,
stderr, exit and signal are compared whole except where a decision changed the answer, and each exception is
named in the test header rather than normalized away:

| Divergence | Fixtures | What changed |
|---|---|---|
| 1. the seed moved | every fixture whose setup writes one | The committed config is a CLOSED key surface — a file carrying `retries` or `features.costTracking` is rejected outright, so the recorded data cannot be seeded there at all. It is seeded into session state, the highest level of the new chain and the open-keyed one. stdout/stderr/exit are **unchanged**; the recorded side-effect path is asserted **absent** and the state file asserted instead. |
| 2. `set` writes session state | the six `config-set-*` | Values, types, nesting, the two-space indentation and the missing trailing newline are all compared against the recording; only the file differs. Plus the two AC-15 stderr lines. |
| 3. `config-set-no-config` exits 0, not 1 | one | The recorded refusal existed so recording telemetry could not conjure a config the user never chose. State is kit-owned and creating it IS the write; refusing would leave `set` with nothing it could ever do on a fresh project. |

One behaviour is preserved that a naive port loses: `get` with **no source at all** prints nothing (so the
caller's `|| echo "true"` answers), while a present source with an unset key prints an **empty line**. The
fixture `config-get-no-config-without-default` is what pins it; `resolveKey` reports `sourcePresent` separately
from the value for exactly that reason.

Two bare keys the eleven preambles ask for — `telemetry`, `proactive` — are aliased to the config keys they
became (`workflow.*`), so no call site changed. A test asserts each alias target is a real config key, so an
alias cannot outlive its key.

**2. This repository's own descriptor is migrated and gone.** Run through the migration **LIBRARY**
(`config/migrate-descriptor.ts`) from a one-off script, never `mewkit upgrade` against this repo:

```
carried  features.costTracking → hooks.budget-tracker: true
carried  features.memory       → hooks.learning-observer: true
carried  features.tdd          → tdd: false
not carried version                      — recorded in .meowkit/metadata.json, which is where it belongs
not carried name                         — the project's own name is not a kit setting
not carried description                  — not a setting; keep it in the project's README
not carried buildDate                    — when the kit was built is recorded in .meowkit/metadata.json
not carried repository.type / .url       — the remote is git's to know, not a kit setting
not carried features.harness             — selected per run by the autobuild density, not by a stored switch
not carried features.conversationSummary — no observer reads it; the behaviour it named is gone
```

`.meowkit/config.yaml` now carries three uncommented lines plus `$schema`; `.meowkit/config.json` is deleted
(single-file `rm`, left unstaged for the human). `mewkit status` reads the carried values back through the
loader:

```
$ node packages/mewkit/dist/index.js status
Config: .meowkit/config.yaml
  tdd: false
  hooks.budget-tracker: true
  hooks.learning-observer: true
```

`features.tdd → tdd` is a mapping pass 3 ADDED: it is the one descriptor switch whose meaning survived exactly,
and AC-02 requires every value with an equivalent to be carried.

**3. `uninstall` leaves a user-committed descriptor alone** — asserted under `--yes --force` in
`tests/install/uninstall-guarantees.test.ts`.

## [AC-09] Nothing mutates without a snapshot … — **MET**

Pass 2's three outstanding clauses are closed.

- **The `uninstall` snapshot.** One snapshot per run, taken before the first delete, holding every file the run
  removes with its pre-deletion checksum; `backups restore <id> --yes` puts all of them back byte-identically
  (asserted by checksum per file, not by count). No manifest lists a `.meowkit/cache/` path.
- **`upgrade --dry-run`.** `--dry-run` and `--force` are wired through `performUpgrade` into `smartUpdate`,
  whose `dryRun`/`force` parameters were hardcoded `false` at BASE (`upgrade.ts:290`, the defect Scope (In)
  names). A dry run takes **no** snapshot, writes no file and does **not** rewrite the cache; a recursive
  checksum manifest of the whole project is byte-identical before and after.
- **The interruption case.** Already designed for (manifest written LAST) and now exercised: the
  `uninstall` snapshot test reads the manifest and the `files/` payload separately, and `backups list` reports a
  manifest-less directory as absent.

## [AC-10] `uninstall` classifies correctly, is dry-run by default, and cannot destroy user data — **MET**

`commands/uninstall.ts` (138) on `core/ownership-classify.ts` (146) and `core/kit-cache-trust.ts` (79).
`tests/install/uninstall-ownership.test.ts` runs the eight invocations the AC names on trees a **real
`mewkit init`** built, each with a populated `.meowkit/cache/`, with the network unreachable (the harness points
`HTTPS_PROXY` at a closed port). After each one a recursive checksum manifest is diffed against the expected set.

| # | Invocation | Outcome |
|---|---|---|
| 1 | no flags | changes nothing; prints every class with a count and the file list |
| 2 | `--yes` | deletes exactly the `clean` set (1227 files — a non-empty `clean` class exists only because the cache is populated), refuses every `modified` file by name, reports every `orphan` without deleting, skips `missing` |
| 3 | `--yes --force` | additionally deletes the `modified` kit file, and nothing more (`deleted` equals the planned set exactly) |
| 4 | no baseline | exits 1, deletes nothing, names `mewkit doctor --adopt` |
| 5 | hand-edited baseline claiming a user file (`owner: meowkit`, `checksum` AND `baseChecksum` matching the file's real content — the shape the BASE gate at `smart-update.ts:339-345` would pass) | the file **survives `--yes --force`**, is in the `refused` class, and the refusal says the claim "was **not corroborated**" |
| 6 | cache absent | zero deletions, per-path refusal naming `mewkit upgrade` |
| 7 | cache recording another version | zero deletions; detected from the version the cache **records** (`0.0.0-other`) against the one `metadata.json` reports, not from content |
| 8 | cache path `git add -f`-tracked | zero deletions; distrusted because `git ls-files` reports it, re-checked **per run** rather than trusting `.meowkit/.gitignore` to still be there |

In every one of the eight, `.meowkit/{memory,telemetry,state,cache,envs,backups}` and `.meowkit/.env` are
byte-identical — so the uninstall that consults the trusted kit source cannot destroy it — and the user-authored
file under `.claude/skills/` is classified `orphan` and survives. `--json` class lists match the human output
item for item. `--dry-run` leaves the whole project byte-identical.

The deletion predicate is the D12 one, and it is two facts rather than one: `clean` requires the baseline's claim
(`owner`, `baseChecksum`) **and** byte agreement with `.meowkit/cache/` for that path. `--force` widens to
`modified`, which still requires the path to be **present in the cache** — so a user-authored file the baseline
lies about is refused even under `--force`, because the kit ships no such path.

## [AC-11] `doctor` reports config validity, drift, and adopts a baseline only when it is authentic — **MET**

`commands/doctor-ownership-checks.ts` (88) adds three rows; `commands/doctor-adopt.ts` (142) is `--adopt`.
`tests/install/doctor-adopt.test.ts` covers the five fixtures plus the three tampered plants, offline throughout.

- **Valid project:** `Project config … valid`, `Install drift … clean N, modified 0, orphan 0, missing 0,
  refused 0`, `Local kit cache … holds kit 9.9.9-fixture, which is what this install records`.
- **Malformed config:** `.meowkit/config.yaml:2: … [tab-indentation]`, no `YAMLException` anywhere in the output.
- **Drifted:** per-class counts move with a modified kit file and an orphan.
- **`autobuild.mode: LEAN` present:** an explicit row — "It sets DENSITY only: the sprint-contract gate reads the
  environment, so a committed value — LEAN included — does not bypass it" (D3), so the block is never discovered
  unexplained.
- **Cache missing or version-mismatched:** a finding naming `mewkit upgrade` as the re-fetch.
- **Fixture 4 (cache, no baseline):** `--adopt` rebuilds `.meowkit/metadata.json` by comparing on-disk files
  against `.meowkit/cache/` **and nothing else**. The user's own file is recorded `owner: user`, never `meowkit`.
  Afterwards `uninstall --json` class lists are **identical** to a normally installed twin's, and a forced
  uninstall still leaves the user's file in place.
- **Fixture 5 (no baseline, no cache — i.e. every clone):** `--adopt` exits 1, writes **no** metadata at all,
  names `mewkit upgrade`.
- **Tampered plants:** a hand-edited `release-manifest.json`, a hand-edited `metadata.json` and a `git add -f`
  cache path each gain nothing — the first two are ignored as sources (the file is still recorded `user`), the
  third makes `--adopt` refuse; the follow-on `uninstall --yes --force` leaves the claimed file in place in all
  three.

Adoption shares the installer's enumerator (`collectFiles`) and its `classifyLayer` "user layer" rule, which is
what makes an adopted baseline classify identically to an installed one rather than approximately.

## [AC-13] Mutating commands preview and emit JSON; destructive ones refuse to run blind — **PARTIAL**

**Done — the exit-3 rule, for all four destructive commands, with the behaviour and the flag together.**
`core/destructive-guard.ts` (33) is the single rule; `tests/install/destructive-exit3.test.ts` drives it.

| Command | Non-TTY without `--yes` |
|---|---|
| `uninstall` | prints the four classes, exits **3**, project byte-identical |
| `backups restore <id>` | prints the restore plan, exits **3**, the target file is untouched; with `--yes` it acts |
| `upgrade --force` | prints the upgrade plan ("nothing was written"), exits **3**, project byte-identical |
| `init --force` | degrades to the dry run, exits **3**, project byte-identical |
| `init` / `setup` without `--yes` | still exit **0** — the D13 narrowing, asserted rather than assumed |

Exit 3 is distinct from success (0) and from failure (1), which is the whole point: a script can tell "needs
your confirmation" from "failed".

**Done — flags with behaviour.** `uninstall` (`--json`, `--dry-run`, `--yes`, `--force`), `upgrade`
(`--dry-run`, `--force`), `backups` (`--json`, `--dry-run`, `--yes`), all declared in
`cli/command-catalogue.ts`, all implemented, and the generated CLI reference regenerated
(`MEOWKIT_WRITE_SYNOPSIS=1 npx vitest run packages/mewkit/src/cli`). `--dry-run` on `uninstall` and `upgrade` is
asserted by a recursive checksum manifest of the whole project, including no snapshot and no cache write.

**Done — the kit-verb resolution validator.** `scripts/check-kit-verbs.cjs` (114) loads the CLI's own catalogue
from `dist` — so adding a command cannot leave it stale — and scans the **shipped kit** (`.claude/**`) for
`mewkit <verb>`:

```
$ node scripts/check-kit-verbs.cjs
PASS: 185 mewkit verb reference(s), all resolving to one of 31 subcommands
# with a planted stale verb
.claude/skills/careful/references/planted-verb.md:1: `mewkit frobnicate` does not resolve to a subcommand
FAIL: 1 unresolved mewkit verb(s)
```

`uninstall` and `backups` resolve; `audit` is asserted **absent** (D14 — no alias). The check is wired into
`.github/workflows/ci.yml` beside the schema and env-read checks, and `tests/install/kit-verbs.test.ts` asserts
both the clean tree and the plant. Scope note: `docs/**` and `packages/docs/**` are deliberately **out** — they
carry changelogs and review records naming verbs that existed when they were written, and AC-01's own reason for
excluding `RELEASING.md` applies. A stale verb there misleads a reader; a stale verb in a skill breaks a session.

**Outstanding — one clause.** `--json` on `init`, and `--json`/`--dry-run` on `setup`, `pack add|remove` and
`migrate` (`migrate` already has `--dry-run`). Not declared, deliberately: pass 2's deviation 18 recorded that a
declared flag without behaviour is a lie in `--help`, and that rule is kept.

## [AC-12] Clone-without-init — **PENDING**

Not started; nothing partial on disk. The hook halves it depends on are all in place and independently proved —
the gates never read the config (AC-06's require-graph clause), the hostile-config replay covers all six golden
groups, and `uninstall`/`--adopt` already refuse offline without a cache (AC-10 invocation 6, AC-11 fixture 5),
which is the clone's state by construction. What is missing is the **recorded transcript**: a real `git clone`
into a scratch dir with a stripped `PATH`, the five events driven through the hooks, the capture grepped for
`Traceback|MODULE_NOT_FOUND|ENOTFOUND`, and the doctor-hint occurrence count.

## [AC-15] Every rejection and every refusal tells the user what to change — **MET**

Pass 2's three outstanding messages all exist now and are asserted:

- `uninstall`'s `modified` refusal names each file and the `--force` flag; its baseline-less refusal names
  `mewkit doctor --adopt`; its cache refusals name `mewkit upgrade` **per affected path**; its tampered-baseline
  refusal says the claim was not corroborated.
- `doctor --adopt`'s refusal names the cache state and `mewkit upgrade` as what would produce one.
- `workflow-config set telemetry off` states that it wrote session state **and** that `.meowkit/config.yaml` is
  where the preference becomes durable — the transcript is in the AC-02 section above.
- The new `state-only-key` rejection names which setting cannot be committed, why, and the command that records
  it instead.

No message in any of these paths prints a stack frame or a parser class name; the `uninstall`/`doctor` paths are
asserted for content in their own tests, and the config paths keep the pass-1 assertion.

## [AC-14] Code quality over the sprint diff — **MET (measured over the whole sprint diff vs BASE)**

`git diff --stat 085cb5bd` excluding `tasks/`: **69 files changed (+1046 / −567)**; over `.claude` and
`packages/mewkit/src` alone, 42 files (+709 / −315).

**No new file exceeds 200 lines.** Pass 3's new files:

| File | Lines |
|---|---|
| `packages/mewkit/src/core/ownership-classify.ts` | 146 |
| `packages/mewkit/src/commands/doctor-adopt.ts` | 142 |
| `packages/mewkit/src/commands/uninstall.ts` | 138 |
| `scripts/check-kit-verbs.cjs` | 114 |
| `packages/mewkit/src/commands/doctor-ownership-checks.ts` | 88 |
| `packages/mewkit/src/core/kit-cache-trust.ts` | 79 |
| `packages/mewkit/src/core/destructive-guard.ts` | 33 |
| `tests/install/uninstall-ownership.test.ts` | 152 |
| `tests/install/doctor-adopt.test.ts` | 162 |
| `tests/ports/workflow-config-resolution.test.ts` | 108 |
| `tests/install/destructive-exit3.test.ts` | 106 |
| `tests/install/uninstall-guarantees.test.ts` | 83 |
| `tests/install/lib/uninstall-fixture.ts` | 73 |
| `tests/install/kit-verbs.test.ts` | 38 |

Three splits were made **because of this rule**, and each has a reason beyond the count: cache trust left
`ownership-classify.ts` (208 → 146 + 79) because "is the cache usable" and "what class is this path" are
different questions with different evidence; the uninstall tests split at the "eight invocations" / "everything
else" seam (277 → 152 + 83) over one shared fixture module, so two files cannot build two different trees; and
`tests/ports/workflow-config-parity.test.ts` split (214 → 118 + 108) because the recorded fixtures and the
levels no fixture can reach are two different kinds of claim — and because **it was the one changed file this
sprint would otherwise have pushed across 200** (114 at BASE).

**Changed files already over 200 at BASE that grew**, by name with both counts:

| File | BASE | Final |
|---|---|---|
| `packages/mewkit/src/commands/init.ts` | 968 | 1012 |
| `packages/mewkit/src/commands/validate.ts` | 951 | 956 |
| `packages/mewkit/src/core/smart-update.ts` | 621 | 624 |
| `packages/mewkit/src/index.ts` | 469 | 519 |
| `packages/mewkit/src/commands/upgrade.ts` | 387 | 439 |
| `packages/mewkit/src/commands/doctor.ts` | 408 | 422 |
| `packages/mewkit/src/commands/doctor-checks.ts` | 395 | 402 |
| `packages/mewkit/src/cli/command-catalogue.ts` | 301 | 316 |
| `packages/mewkit/src/commands/setup-steps.ts` | 270 | 304 |
| `.github/workflows/ci.yml` | 364 | 380 |
| `packages/docs/content/docs/cli/index.mdx` | 409 | 451 |
| `packages/docs/content/docs/reference/configuration.mdx` | 243 | 264 |
| `packages/docs/content/docs/cheatsheet.mdx` | 213 | 220 |

None crossed 200 because of this sprint — every one was already over — and every growth is a wiring line or a
call into a new module rather than new logic in a large file: `doctor.ts` gained the `--adopt` branch and three
result rows, `index.ts` the `uninstall` case and four flag passes, `upgrade.ts` the two flag parameters and the
destructive branch. `.mdx` and `.yml` are exempt from the line rule by the AC's own terms, and both `.mdx` rows
are generated.

**One file over 200 that is neither new code nor generated, named rather than buried:**
`env-name-classification.json` is **633** lines (110 at the batch A boundary, grown by the
`retainedDropOccurrences` records and the reader columns). It is the AC-01 classification **table** — data, one
row per name — and AC-07 requires `check-env-reads.cjs` to load exactly one such file as its allowlist, so
splitting it would create the two-lists-in-sync problem that clause exists to remove. Flagged for the evaluator
rather than split.

No changed TypeScript adds an `any` or an unsafe cast (`npm run typecheck` clean). No new TODO/FIXME, no
commented-out code block (the commented key stubs the renderer emits are data, exempt by name), no unused
import, no hardcoded secret, and no new `child_process` call site targeting `bash`, `sh` or a `.sh` file — the
new spawn sites call `git` with argument arrays, and the pre-existing spawn-site allowlist test passes
unchanged. `npm run lint`: 0 errors, 3 pre-existing warnings.

## Cumulative verdict table — supersedes every per-section verdict above

| AC | Verdict | Outstanding |
|---|---|---|
| AC-01 | MET | — |
| AC-02 | **MET** | — |
| AC-03 | MET | — (corpus gained the `state-only-key` fixture) |
| AC-04 | MET | — |
| AC-05 | MET | — |
| AC-06 | MET | — |
| AC-07 | MET | — |
| AC-08 | MET | — |
| AC-09 | **MET** | — |
| AC-10 | **MET** | — |
| AC-11 | **MET** | — |
| AC-12 | **PENDING** | the recorded clone-without-init journey (its hook-side halves are proved; the transcript is not) |
| AC-13 | **PARTIAL** | `--json` on `init`; `--json`/`--dry-run` on `setup`, `pack add|remove`, `migrate` |
| AC-14 | **MET** | — (measured over the whole sprint diff; one named data-file exception) |
| AC-15 | **MET** | — |

## Deviations and open questions added by pass 3

21. **The `workflow-config` golden seed moved from the v2 descriptor to session state.** The committed config is
    a closed key surface, so the recorded data (`retries`, `mode.default`, `features.*`) cannot be seeded there —
    a config carrying them is rejected outright. Session state is the open-keyed level D10 puts first, so the
    fixtures ask the same questions of the same data and expect the same answers. stdout/stderr/exit are
    compared whole; only the file moved. Named in the test header as divergence 1.
22. **`config-set-no-config` now exits 0 instead of 1.** The recorded refusal protected a user-owned config from
    being conjured by a telemetry write. Session state is kit-owned and creating it IS the write, so refusing
    would leave `set` unable to do anything on a fresh project. This is the only fixture whose decision changed.
23. **Two bare keys are aliased (`telemetry` → `workflow.telemetry`, `proactive` → `workflow.proactive`).** The
    alternative was editing eleven preambles × five call sites. A test asserts every alias target is a real
    config key, so the two-entry table cannot drift into naming a key that no longer exists.
24. **`features.tdd → tdd` added to the migration mapping.** It is the one v2 switch whose meaning survived
    exactly, and AC-02 requires every value with an equivalent to be carried. Visible in this repository's own
    migration above.
25. **`skip_eng_review` is refused with a new identifier, `state-only-key`**, rather than as an unknown key, and
    the two skill references that document it now say "opted out per project … recorded in `.meowkit/state/`"
    instead of "disabled globally". The codex and cursor mirrors of both files were updated in the same edit.
26. **The install harness asset now carries a generated `release-manifest.json`.** Pass 2's asset had none, so
    the install recorded `version: "unknown"` and every deletion was refused — correct behaviour, but it made
    the fixture unable to exercise the thing under test. An EMPTY `files[]` is worse than none: it makes every
    installed file look like an orphan the release dropped, which silently deleted `handlers.json` in a first
    attempt and made the config migration carry nothing. It is therefore generated from the asset's own tree,
    the way the release pipeline generates it. **This was a real finding about the fixture, not about the
    product**, but it is the reason the AC-02 migration test began failing mid-pass and is recorded so the next
    reader does not rediscover it.
27. **A metadata version of `unknown` is treated as "cannot be checked", not as a match.** A baseline that does
    not record which release it came from gives the cache nothing to be compared against, so `uninstall` refuses
    per path and names `mewkit upgrade`. Refusing is the safe direction, and it is what surfaced deviation 26.
28. **`.claude/worktrees/` and `.claude/logs/` are excluded from the ownership walk.** Without that, `doctor`
    reported **355,229** orphans on this repository (a sibling session checkout with its own `node_modules`).
    The release asset excludes both for the same reason. The exclusion is shared by the classifier and
    `doctor --adopt`, so the two cannot disagree about what is installed.
29. **`check-kit-verbs.cjs` scans the shipped kit only.** `docs/**` and `packages/docs/**` name verbs that
    existed when their changelogs and verdicts were written. AC-01's reason for excluding `RELEASING.md` applies;
    the same scan over those trees reports 40-odd historical verbs (`wiki`, `index`, `query`, `orchviz`,
    `build-plugin`). **Worth the evaluator's attention** — it is a scope call, not a measurement.
30. **The retention record for `MEOWKIT_CONFIG` moved file.** The assertion that the reader does not consult it
    now lives in `tests/ports/workflow-config-resolution.test.ts` after the AC-14 split, so the
    `retainedDropOccurrences` entry names that file. The universe stays at 78; the test enforces both directions,
    which is what caught the move.
31. **A plugin validator in this environment reports `require() is not available in workflow sandbox scope` for
    every `.cjs` file whose name contains "workflow".** It is a Vercel-plugin heuristic matching on the filename;
    `.claude/**` `.cjs` files are CommonJS by contract (zero npm on a hook path, D1). Treated as tool output,
    i.e. data, and ignored — recorded here because it will fire again for the next editor of
    `workflow-config-core.cjs`.

---

# Batch B pass 4 — the last two open criteria

Pass 4 closes the two the cumulative table still carried: AC-13's remaining flag clause and AC-12, which had
not been started. Rulings taken into this pass as given, recorded as deviations 32–34 below, were not re-opened,
and nothing in AC-01…AC-11, AC-14, AC-15 was re-litigated.

## Verification run at the pass-4 boundary

| Command | Result |
|---|---|
| `npm run build` | exit 0 |
| `npm run lint` | 0 errors, 3 warnings (the same three pre-existing ones, in `commands/{capabilities,orient,validate}.ts`) |
| `npm run typecheck` | exit 0, no output |
| `npx vitest run` | **271 files / 3174 tests passed**, 0 failed (268/3162 at pass 3) |
| `node --test .claude/hooks/__tests__/*.test.cjs` | 36 pass / 0 fail |
| `node scripts/check-env-reads.cjs` | `PASS: 163 environment-name reads, all classified in env-name-classification.json` |
| `node scripts/generate-config-schema.cjs --check` | `PASS` for both derived outputs |
| `node scripts/check-kit-verbs.cjs` | `PASS: 186 mewkit verb reference(s), all resolving to one of 31 subcommands` (185 at pass 3; the new verb reference is the `mewkit doctor` hint of AC-12) |
| `node packages/mewkit/dist/index.js inventory --check` | `Docs match the inventory.` |

## [AC-13] Mutating commands preview and emit JSON — **MET**

Pass 3's outstanding clause is closed, and one thing pass 3 believed closed was not: **`upgrade` had no
`--json` at all** — it was listed in pass 3 with `--dry-run`/`--force` only, and the AC requires both flags on
all seven. It has both now, so the closed mutating set is complete:

| Command | `--json` | `--dry-run` |
|---|---|---|
| `init` | envelope; narration on stderr | existed; now also asserted to write **nothing** |
| `upgrade` | envelope (new this pass) | existed (pass 3) |
| `setup` | envelope (new) | new — every step plans instead of writing |
| `uninstall` | pass 3 | pass 3 |
| `backups` (incl. `restore`) | pass 3 | pass 3 |
| `pack add` / `pack remove` | envelope (new) | new |
| `migrate` | envelope (new) | existed; now asserted to write nothing |

`node dist/index.js --help` shows both flags in each of the seven commands' own sections, and
`tests/install/mutating-flags.test.ts` asserts that by parsing the help output rather than by reading the
catalogue — the user-visible surface is the claim. The generated CLI reference was regenerated from the
catalogue (`MEOWKIT_WRITE_SYNOPSIS=1 npx vitest run packages/mewkit/src/cli`), which also picked up three rows
pass 3 added to the catalogue without regenerating (`upgrade --dry-run/--force`, `doctor --adopt`).

**One envelope, one shape.** `core/mutation-report.ts` (107) holds the shape `uninstall`/`backups` already
print — `{ ok, command, dryRun, planned[], applied[], notes[], error?, fix? }` — plus the one mechanism that
keeps stdout clean. `--dry-run` is proved by `applied: []` *and* by a recursive checksum manifest of the whole
project before and after, the same comparison the uninstall tests use:

```
$ node dist/index.js setup --dry-run --json          # in a scratch install
{ "ok": true, "command": "setup", "dryRun": true,
  "planned": [ { "action": "copy", "path": ".mcp.json", "detail": "from .meowkit/mcp.json.example" }, … ],
  "applied": [], "notes": [ "mcp: pass — Created .mcp.json — edit API keys inside.", … ] }
```

and then the plan is checked against the act: `paths(real.applied) === paths(dry.planned)` for `setup`,
`pack add` and `pack remove`. That equality is the point of the design — `core/change-recorder.ts` (55) is a
filesystem facade the setup steps write *through*, so the recorded item IS the write. A step cannot report a
change it did not make, or make one it did not report, and there is no second "planning" branch to go stale.

**Keeping prose out of stdout.** `init` and `migrate` narrate through `@clack/prompts`, which writes to
`process.stdout` from ~60 call sites. For the duration of a `--json` run stdout is pointed at stderr and the
envelope is written through the captured real stdout, so the user still sees the narration and a pipe receives
one parseable document. The test asserts both directions: `JSON.parse(run.stdout)` of the WHOLE stream
succeeds, and `run.stderr` contains `MeowKit installed` while `run.stdout` does not.
`Object.defineProperty` is used for the swap rather than an assignment, because the stream's `write` is an
overload set and an assignment would need a cast (AC-14 forbids one).

**Commands that can end in several places print exactly one envelope.** `jsonEmitted()` guards the fallback, so
`migrate not-a-provider --json` yields `{ ok: false, error: … , fix: … }` rather than an empty stdout, and
`init`, which validates as it goes and exits from a dozen places, registers an exit-time envelope. The report is
built lazily (`emit(() => …)`) — building it eagerly made `upgrade` evaluate a stats mapper on a path where the
test harness supplies a partial stats object, which is how `upgrade-cursor-toolkit.test.ts` caught it.

Tests: `tests/install/mutating-flags.test.ts` (169) — 10 cases over `init`, `setup`, `pack add`, `pack remove`,
`upgrade`, `migrate` and the help surface. `setup` without `--yes` in a non-TTY is asserted to still exit **0**,
which is D13's narrowing restated at the one place it is observable.

## [AC-12] Clone-without-init: gates still block, observers point at doctor, nothing crashes — **MET**

Recorded in `ac-12-clone-journey.md`, with the runnable script (`ac-12-clone-journey.sh`, 177) and the full
capture (`ac-12-clone-journey-transcript.txt`, 193) beside it. Summary of the capture:

- **A real clone, and nothing committed here.** A throwaway source repository is built in `$TMPDIR` from a copy
  of the working tree's kit content, committed *there*, and `git clone`d. 1273 tracked files; `node_modules`,
  `.meowkit/cache`, `.meowkit/metadata.json` and `tasks/plans` all absent. The source repo tracks exactly four
  `.meowkit/` members — the deny-all ignore file doing its job.
- **The environment capture.** `PATH` is one directory holding only `node` and `git`; `command -v mewkit` and
  `command -v npx` are both `(not found)`; `fetch` and a raw socket to `github.com:443` both report
  `unreachable: EOFFLINE`. A closed-port proxy is NOT enough on this Node (v20.20.2 ignores
  `NODE_USE_ENV_PROXY` for `fetch` — verified directly), so the refusal is installed in-process and inherited
  through `NODE_OPTIONS`. The code is deliberately not one of the three the grep looks for, so a hook that did
  reach the network would surface as its own string: **0 occurrences**.
- **The five events, through the real entrypoints.** Gate 1 blocks the edit at **exit 2** with `@@GATE_BLOCK@@`;
  privacy-block blocks the `.env` read with `@@PRIVACY_BLOCK@@`; `pre-ship` is run twice because the clause has
  two halves — with nothing ship-capable staged the ship is N/A and the memory-store lint degrades to its
  existing `SKIP: mewkit CLI not found` line, and with `src/app.ts` staged Gate 2 **blocks** at exit 2; the
  observers and the dispatcher all exit 0; `Stop` writes its checkpoint and telemetry. The three guards answer
  as their golden fixtures record (careful `ask`, freeze `{}`, investigate `deny` at exit 2).
- **The grep and the count.** `Traceback|MODULE_NOT_FOUND|ENOTFOUND`: **0**. Non-zero exits: 4, every one a
  deliberate block. `mewkit doctor` hint occurrences: **1**.

**The journey found a real defect, and it is fixed in product code with a test.** The first run counted **0**
`mewkit doctor` hints: the clone degraded correctly and *silently*. D14 commits this sprint to the no-CLI
degradation **and** the hint, so:

- `.claude/hooks/lib/session-context-report.cjs` (133 → 172) gains `resolveCli(root, env)` — resolution only,
  nothing spawned: the phase-06 launcher `.meowkit/bin/mewkit`, then `node_modules/.bin/mewkit`, then each
  `PATH` entry — and `installBlock`, which returns the hint only when all three come up empty.
- `.claude/hooks/handlers/project-context-loader.cjs` (136 → 144) emits it under the **same new-session
  condition as the config block**, so "once per session, not once per event" holds by construction: a resume or
  a compaction re-runs the handler under the same session id and prints nothing.
- `tests/hooks/session-start-context.test.ts` (90 → 118) asserts the hint appears with `mewkit doctor` in it
  exactly once, that the second call under the same session id is silent, and that a project with a resolvable
  CLI gets no hint at all.

No new observer and no new `handlers.json` entry — the registry still holds its BASE 22 entries over 21 keys, so
AC-02's 21 config stubs and AC-07's 21 toggles are untouched. The hint is the only reason
`check-kit-verbs.cjs` now counts 186 references instead of 185.

## [AC-14] Code quality over the pass-4 diff — **MET**

New files this pass, all under 200: `core/mutation-report.ts` 107, `commands/install-report.ts` 72,
`core/change-recorder.ts` 55, `tests/install/mutating-flags.test.ts` 169.
`install-report.ts` is shared by `init` and `upgrade` (it was written as `init-report.ts` and renamed when
`upgrade` needed the same mapping — one mapper, so the two cannot describe the same stats differently).

Changed files that were **already over 200 at BASE** and grew, named with both counts:

| File | BASE | Final |
|---|---|---|
| `packages/mewkit/src/commands/init.ts` | 968 | 1051 |
| `packages/mewkit/src/index.ts` | 469 | 525 |
| `packages/mewkit/src/commands/upgrade.ts` | 387 | 479 |
| `packages/mewkit/src/commands/setup-steps.ts` | 270 | 333 |
| `packages/mewkit/src/commands/pack.ts` | 225 | 279 |
| `packages/mewkit/src/cli/command-catalogue.ts` | 301 | 320 |
| `packages/mewkit/src/migrate/migrate-orchestrator.ts` | 749 | 755 |
| `packages/docs/content/docs/cli/index.mdx` (generated) | 409 | 443 |

Changed files that stayed **under** 200: `commands/setup.ts` 67 → 114, `commands/migrate.ts` 71 → 97,
`migrate/migrate-ui-summary.ts` 158 → 193, `migrate/types.ts` 148 → 150,
`.claude/hooks/lib/session-context-report.cjs` 133 → 172,
`.claude/hooks/handlers/project-context-loader.cjs` 136 → 144.
**No file crossed 200 because of this pass.** No new `any`, no cast (the one place that would have needed one
uses `Object.defineProperty` instead), no TODO/FIXME, no commented-out code, no unused import, no hardcoded
secret, and no new `child_process` call site targeting `bash`, `sh` or a `.sh` file.

## Cumulative verdict table — supersedes every per-section verdict above

| AC | Verdict | Outstanding |
|---|---|---|
| AC-01 | MET | — |
| AC-02 | MET | — |
| AC-03 | MET | — |
| AC-04 | MET | — |
| AC-05 | MET | — |
| AC-06 | MET | — |
| AC-07 | MET | — |
| AC-08 | MET | — |
| AC-09 | MET | — |
| AC-10 | MET | — |
| AC-11 | MET | — |
| AC-12 | **MET** | — (journey recorded; the defect it found is fixed with a test) |
| AC-13 | **MET** | — (`upgrade --json` was missing too and is included) |
| AC-14 | MET | — (one named data-file exception, deviation 32) |
| AC-15 | MET | — |

## Deviations and open questions added by pass 4

Deviations 32–34 are rulings taken as given at the start of this pass and recorded here, not re-argued:

32. **`env-name-classification.json` (633 lines) is an accepted, named AC-14 data-file exception.** AC-07
    requires `check-env-reads.cjs` to load exactly one allowlist file, and that file is the AC-01 table itself;
    splitting it would recreate the two-lists-in-sync problem the clause exists to remove.
33. **`check-kit-verbs.cjs` scanning `.claude/**` only is accepted.** `docs/**` and `packages/docs/**` name
    verbs that existed when their changelogs and verdicts were written — an immutable historical record, the
    same reason AC-01 excludes `RELEASING.md`.
34. **AC-13's remaining clause was IMPLEMENTED, not narrowed.** Pass 2's rule stands: a flag ships only with
    real behaviour behind it, so the four commands gained behaviour rather than a declaration.

New with this pass:

35. **`upgrade` had no `--json`.** Pass 3's AC-13 section listed `upgrade` with `--dry-run`/`--force` and did
    not name `--json` as outstanding, but the AC's closed set is seven commands × two flags. It is implemented
    here. Worth the evaluator's attention as a *reporting* miss in pass 3 rather than a decision.
36. **`--json` moves narration to stderr rather than suppressing it.** Nothing is lost and stdout is clean,
    which is what the AC asks for. The mechanism is a stdout→stderr redirect for the duration of the run,
    installed with `Object.defineProperty`. Known boundary, stated rather than discovered: a child process that
    inherits fd 1 would bypass it. None of the seven does on a `--json` path — the dependency installer pipes
    every child, and `init --json` deliberately does not reach the interactive system-dependency prompt (the
    only `stdio: "inherit"` site), because a `--json` run has no one to answer it.
37. **`setup --dry-run --system-deps` prints a refusal instead of a plan.** The installers are package managers
    writing outside the project; a per-package preview is a list this command cannot honestly produce, so it
    says what it did not do and names the way to do it. Preferred over printing a plan it could not keep.
38. **`pack add --dry-run` still fetches the release.** Which files a pack consists of is recorded in the
    release's own manifest, so a plan that did not read it would be a guess. The fetch lands in a tmpdir; the
    project-wide checksum manifest before and after is identical, which is the assertion the AC asks for.
39. **The AC-12 offline sandbox had to be built, because the existing one does not work on this Node.** The
    install harness relies on `HTTPS_PROXY` + `NODE_USE_ENV_PROXY`; Node v20.20.2 ignores both for `fetch`
    (verified: `fetch("https://github.com")` returned 200 through a closed-port proxy). The journey therefore
    blocks DNS and socket connect in-process. **Worth the evaluator's attention beyond AC-12**: the
    `tests/install` harness's "no subcommand may reach GitHub" guarantee rests on the same ineffective
    mechanism, so an offline regression there would be caught only by `MEOWKIT_RELEASE_SOURCE` being honoured,
    not by the proxy. Nothing in this sprint depends on it, so it is reported rather than changed.
40. **`pre-ship` is driven twice in the journey.** The AC asks for both "pre-ship blocks the ship" and "the
    memory-store lint degrades to its SKIP line", and those are two different repository states: with nothing
    ship-capable staged the ship is correctly N/A (so the lint is what shows), and with a source file staged
    Gate 2 blocks before the lint runs. One invocation can only ever show one of the two.
41. **`uninstall` and `backups` keep the payloads pass 3 shipped; they were not refactored onto the named
    envelope.** The common core is shared and parseable the same way — `ok`, `dryRun`, a planned list and a list
    of what was actually done — but those two carry domain keys the others do not (`classes`, `refusals`,
    `cache`, `snapshots`) and do not carry `command`/`notes`. Rewriting two MET criteria's output shape to add
    two fields would have changed assertions in `uninstall-ownership`, `uninstall-guarantees` and
    `destructive-exit3` for no behavioural gain, so the new commands adopted the existing shape rather than the
    reverse. Stated so the evaluator does not read the envelope type as a claim that all seven are byte-identical
    in structure.

---

# Gate 2 remediation — the verdict's required changes and accepted suggestions

Worked from `tasks/reviews/261101-meowkit-v3-lean-runtime-verdict.md` (FAIL, Critical 2). Scope: C1, C2, C3,
V3 (required) and S1, S2/M1, S3/M2, S4, S5/V2, S9 (accepted suggestions). S6, S7, S8 and S10 were not taken —
S10 is a prose reconciliation left to a separate change, the other three are cosmetic and untouched here. The
verdict file itself was not edited: it is the reviewer's artifact.

## C1 — the `budget.*` stub documented the wrong unit — FIXED

`packages/mewkit/src/config/schema.ts:61-63` now reads in USD (`"overrides the hard block, in USD — lower or
higher than budget.block."`, `"estimated session cost in USD at which a warning is printed."`, `"… at which
work is blocked."`), and `config/write-stub.ts:41-43` ships `cap: 50`, `warn: 30`, `block: 100` — the warn and
block numbers being the budget tracker's own defaults, and the cap below the block so an uncommented stub can
only tighten the brake, never remove it.

`tests/config/config-stub.test.ts` now parses `.claude/hooks/handlers/budget-tracker.cjs` for the literal
defaults and asserts the stub equals them, that `cap <= block`, and that each of the three key docs says USD and
says neither "token" nor "percent". The two cannot drift again without a red test rather than a reader noticing.

**Regeneration was a no-op, for a reason worth stating:** `scripts/generate-config-schema.cjs --check` passes
untouched because the published `config-v1.json` carries no `description` for any key — `KEY_DOC` reaches the
committed stub and nothing else. So an editor validating against the schema shows the type, not the unit. Left
as it is (adding descriptions is a change to the generator and its golden output, outside this pass), and
flagged here because "regenerate the schema" would otherwise look skipped.

## C2 — the two readers disagreed on scalar spelling — FIXED

The grammar guard on both sides now refuses every out-of-subset spelling by name instead of leaving resolution
to js-yaml on one side and a hand reader on the other. `packages/mewkit/src/config/yaml-grammar.ts:34-72`
(`outOfSubsetScalar`) and `.claude/hooks/lib/yaml-subset.cjs:29-74` carry the same checks in the same order with
the same identifiers:

| Spelling | Code |
|---|---|
| `True`, `TRUE`, `False`, `FALSE` | `bad-boolean-spelling` |
| `+5`, `0x1f`, `0o17`, `0b1`, `007`, `1_000` | `non-decimal-integer` |
| a `\` escape in a double-quoted scalar | `escape-not-supported` |
| a quote that never closes | `unterminated-quote` |
| content after the closing quote, including a `''` doubling | `trailing-content-after-quote` |
| a dotted key at any depth (`budget.cap: 5`) | `dotted-key` |

Each message names what to write instead ("write true or false in lower case", "write decimal digits with no
sign, no underscores and no 0x/0o/0b prefix", `"budget:" on its own line, then "  cap: …" indented under it`).
The float guard was broadened in the same place to the signed, leading-dot and `.inf`/`.nan` forms, which were
the same class of divergence one spelling away from the reported ones.

**The dotted flat key is refused rather than resolved on one side.** Picking either reader's resolution would
make one spelling of a nested key legal and silently equivalent to another; refusing it keeps one spelling for
one meaning, and the message shows the nested form.

Corpus: 41 → **50** fixtures. The nine new ones are the verdict's eight rows plus `grammar-trailing-after-quote`
(`tests/config/fixtures/grammar-{boolean-titlecase,boolean-uppercase,signed-integer,hex-integer,octal-integer,double-quote-escape,unterminated-quote,trailing-after-quote,dotted-key}.yaml`),
each also bound to its expected identifier in `tests/config/rejections.test.ts:43-54` so agreement and
correctness are asserted separately.

End to end, because the consequence was an enforcement mode:
`tests/config/reader-agreement.test.ts:100-122` writes `tdd: True` into a scratch project and asserts
`.claude/hooks/lib/tdd-detect.cjs` answers `{enabled: false, source: "default"}` **and** the CLI's
`resolveConfig` reports no `tdd` value and exactly one error, `bad-boolean-spelling`. Before this change the
same file had the CLI reporting `tdd: true` with zero errors while the gate enforced OFF.

## C3 — stale env names in the Codex and Cursor projections — FIXED

**The tree is hand-maintained, not generated.** No generator produces `packages/mewkit/src/migrate/modules/**`
(searched the `migrate/` sources and `scripts/`); the "generated projections" label in
`scripts/scan-env-names.sh` was wrong and now says mirrors maintained by hand, with the reason the scan still
excludes it (a mirror's own copy of a name would keep that name in the universe for ever).

Mirrored the `.claude/` edits:
- `modules/codex/root/.agents/skills/mk-session-continuation/SKILL.md:20-24` and
  `modules/cursor/root/.cursor/skills/mk-session-continuation/SKILL.md:20-24` — the four-row `state_vars` toon
  block is replaced by the "Plan State" paragraph the `.claude/` source now carries, pointed at each provider's
  own log directory.
- `modules/codex/root/.codex/agents/confluence-spec-analyst.toml:114` — reads
  `session-state/active-plan.json`, matching `.claude/agents/confluence-spec-analyst.md:124`.

Drift check: `tests/config/projection-drift.test.ts` (new, 77 lines) holds every `drop`-class name to the same
`retainedDropOccurrences` list inside the projections tree that the universe test enforces outside it, with a
positive control (a name the table retains there must be found by the same grep) so a zero result is evidence
of absence rather than of a mis-rooted search. Proved it bites: a one-line file naming a deleted variable under
the projections failed both of its assertions; removing the file returned it to green. It is a separate file
rather than a case in `env-universe.test.ts` because that file is at 184 lines and the ceiling is 200.

`MEOWKIT_PM_AUTO`'s retention list gains `packages/mewkit/src/migrate/modules/`: it is live prose there for the
same reason it is live under `.claude/` — an opt-out an agent reads for itself. **`MEOWKIT_BUDGET_{CAP,WARN,BLOCK}`
were left alone**: they are class `toggle`, not `drop`, still read by shipped scripts, and the projections match
`.claude/` on them, so they are not drift.

## V3 — AC-14's oversize-growth disclosure — CORRECTED

Re-measured against BASE `085cb5bd` **after** the edits in this pass, over every changed or new
`.ts/.tsx/.cjs/.mjs/.js/.sh/.py/.json/.mdx/.yml` file. Every file already over 200 at BASE that grew, complete:

| File | BASE | Now |
|---|---|---|
| `packages/mewkit/src/commands/init.ts` | 968 | 1042 |
| `packages/mewkit/src/commands/validate.ts` | 951 | 956 |
| `packages/mewkit/src/migrate/migrate-orchestrator.ts` | 749 | 755 |
| `packages/mewkit/src/core/smart-update.ts` | 621 | 624 |
| `packages/mewkit/src/index.ts` | 469 | 525 |
| `packages/mewkit/src/commands/doctor.ts` | 408 | 420 |
| `packages/mewkit/src/commands/upgrade.ts` | 387 | 470 |
| `packages/mewkit/src/cli/command-catalogue.ts` | 301 | 320 |
| `packages/mewkit/src/commands/setup-steps.ts` | 270 | 333 |
| `packages/mewkit/src/commands/pack.ts` | 225 | 279 |
| `.github/workflows/ci.yml` (exempt from the line rule) | 364 | 380 |
| `packages/docs/content/docs/cli/index.mdx` (generated) | 409 | 443 |
| `packages/docs/content/docs/reference/configuration.mdx` | 243 | 264 |
| `packages/docs/content/docs/cheatsheet.mdx` | 213 | 220 |

What the earlier pass-4 table got wrong: `init.ts` and `upgrade.ts` were overstated (1051/479 against 1042/470),
and `validate.ts`, `smart-update.ts`, `doctor.ts` and `doctor-checks.ts` were absent. `doctor-checks.ts` is no
longer on the list at all — deleting `checkConfig` took it from 395 at BASE to **377**, below where it started.
`env-name-classification.json` remains the one named data-file exception (634 lines, deviation 32).

No new file in this pass exceeds 200: `tests/config/projection-drift.test.ts` 77,
`tests/install/lib/offline-refusal.cjs` 34. No changed file crossed 200 because of it — the largest changed test
is `tests/install/uninstall-ownership.test.ts` at 190.

## Accepted suggestions

- **S1 containment on the deletion path.** `core/ownership-classify.ts:74-79` exports `insideKitTree` and the
  classifier refuses any baseline entry whose path is not under `.claude/` after `join` has collapsed it
  (`ownership-classify.ts:107-115`, reason "the baseline named a path outside the kit tree");
  `core/kit-cache.ts:74-88` returns `null` for a cache lookup that resolves outside `kitCacheDir(root)`; and
  `commands/uninstall.ts:122-132` asserts the target is inside this project's `.claude/` immediately before
  `rmSync`, recording a per-path failure instead of deleting if it is not. `tests/install/uninstall-ownership.test.ts`
  gains a case that hand-edits `.meowkit/metadata.json` with a `../` entry and an absolute entry, both with
  matching checksums: the `..` entry is refused by containment, the absolute one is re-rooted under `.claude/`
  by `join` and lands in `missing`, both files survive `--yes --force`, and nothing outside `.claude/` is even
  planned.
- **S2 / M1.** `checkConfig` is deleted from `commands/doctor-checks.ts` and from `doctor.ts`'s row list;
  `checkProjectConfig` owns the row, and `doctor-config-checks.ts` imports `LEGACY_DESCRIPTOR_REL` from
  `state/resolve-config-path.ts` instead of re-declaring it. `doctor` prints one config row instead of two
  contradictory ones. No test or doc counted the rows.
- **S3 / M2.** The PATH-walking resolver is `locateCliOnPath` (`.claude/hooks/lib/session-context-report.cjs:121-145`),
  named for its `path | null` return, and consults `MEOWKIT_CLI` first — so a project that points the kit at a
  CLI no longer gets the "CLI not available" hint while the memory-store lint happily uses it. Its one caller is
  updated and it is exported under the new name only. `memory-store-lint.cjs`'s `resolveCli` keeps its name,
  which is now unambiguous in that directory. `MEOWKIT_CLI`'s reader column in the classification table names
  both files; `check-env-reads` goes 163 → **165** reads, both the new ones classified.
- **S4.** `resolveConfigPath` is deleted; `configWritePath` is the one name, repointed at five call sites
  (`index.ts`, `core/validate-install.ts`, `commands/doctor.ts`, `commands/validate.ts`, and the state test).
- **S5 / V2.** `tests/install/install-harness.ts` no longer claims an offline guarantee it did not have. The
  proxy variables are gone; `tests/install/lib/offline-refusal.cjs` is preloaded into every spawned command
  through `NODE_OPTIONS`, refusing DNS and socket connect in-process the way the recorded clone journey proved
  works. `tests/install/init-offline.test.ts` now runs `fetch` and a raw socket **inside the harness
  environment** and asserts both are refused, so the negative guarantee is tested rather than asserted in a
  comment. This closes the standing concern in deviation 39.
- **S9.** `tests/install/uninstall-ownership.test.ts:1-4` names the scenarios instead of pointing at a plan
  artifact; the describe title and the sibling file's header line follow.

## Deviations added by this pass

42. **C1's schema regeneration is a no-op because the published schema has no key descriptions.** Fixed the
    stub and the key docs, which are what `init` writes into a project; `generate-config-schema.cjs --check`
    passes unchanged. Whether the schema should carry the unit so an editor shows it is a separate change to the
    generator, and is not made here.
43. **Every out-of-subset scalar spelling is REFUSED on both sides rather than resolved on one.** Including the
    flat dotted key, where the verdict left the choice open: one spelling for one meaning, with the nested form
    named in the message. Two identifiers beyond the verdict's list were needed —
    `trailing-content-after-quote` (a `''` doubling and a trailing-junk quote) and `dotted-key` — and the float
    guard was broadened to the signed, leading-dot and `.inf`/`.nan` forms, which diverge the same way one
    spelling away from the reported ones.
44. **The provider projections are hand-maintained; the "generated" label was wrong and is corrected.** No
    generator exists. `MEOWKIT_BUDGET_{CAP,WARN,BLOCK}` in that tree are `toggle`-class names still read by
    shipped scripts and consistent with `.claude/`, so they are not part of this fix; `MEOWKIT_PM_AUTO`'s
    retention list is extended to the projections path rather than the name being deleted, because it is live
    prose there for the same reason it is live under `.claude/`.
45. **An absolute path in the ownership baseline never escapes, which the new test asserts rather than hides.**
    `join(".claude", "/abs/path")` re-roots it under `.claude/`, so it is reported `missing`, not `refused`;
    the containment refusal is what catches the `..` form. Both are proved in one case, and neither file is
    deleted.
46. **`doctor` has one fewer row.** Deleting `checkConfig` removes the `Config` row entirely; the `Project
    config` row reports presence, migration-pending and validity, which is a superset of what the deleted row
    said and never contradicts itself about the absent case.
47. **The hook-side CLI resolvers were not both renamed.** Only the PATH-walking one needed a name saying what
    it returns; with `locateCliOnPath` in place there is no longer a same-name, same-signature pair in that
    directory, so `memory-store-lint.cjs:resolveCli` is left as it is rather than churning a pre-ship path.
48. **S6, S7 and S8 are not taken, and S10 is deferred.** S6 (this repo's own config header), S7 (the
    security-log extension) and S8 (`Object.create(null)`) are cosmetic and out of this pass's scope; S10's
    `autobuild.mode` / `MEOWKIT_AUTOBUILD_MODE` wording spans `CLAUDE.md`, the published configuration
    reference and `.meowkit/config.yaml`, and reconciling the three is a documentation change on its own.
49. **AC-05's corpus is now 50 fixtures and asserts resolution as well as grammar**, which is the gap V1 named.
    The property it proves is unchanged; what changed is that "every scalar type" is now read as every scalar
    *spelling*.

---

# Gate 2 remediation, round 2 — C4, C5, V5

Worked from the re-review verdict at `tasks/reviews/261101-meowkit-v3-lean-runtime-verdict.md` (FAIL, Major 2:
C4, C5; WARN: V4, V5). Orchestrator rulings applied: C4 as specified; **`.meowkit/config.yaml` is the single
source for `budget.*`**, so the shipped shell scripts resolve it through the hook reader rather than keeping the
environment names supported; V5 closed by the converse check; V4 left as an acknowledged WARN with no change
beyond C4's fixtures. The verdict file was not edited — it is the reviewer's artifact.

## C4 — a YAML tag split the two readers — FIXED

A leading `!` is refused by name in both guards, in the list that already held `&`/`*`:
`.claude/hooks/lib/yaml-subset.cjs:95-97` and `packages/mewkit/src/config/yaml-grammar.ts:137`, both
`tag-not-supported`, both saying to drop the tag and write the plain value. The guard fires before any type is
resolved, so every tag family goes the same way — `!!bool`, `!!int`, `!!str`, the verbatim
`!<tag:yaml.org,2002:bool>` form and a custom `!x`.

All eight inputs the verdict tabulated are committed as fixtures bound to that identifier in
`tests/config/rejections.test.ts` (`grammar-tag.yaml`, `grammar-tag-boolean-false.yaml`,
`grammar-verbatim-tag.yaml`, `grammar-tag-custom.yaml`, `grammar-tag-integer.yaml`,
`grammar-tag-nested-integer.yaml`, `grammar-tag-nested-boolean.yaml`, `grammar-tag-string.yaml`), so the parity
corpus is 58 fixtures and `reader-agreement.test.ts` feeds every one of them to both real readers. The
end-to-end case sits next to the existing one, now a two-row table in `reader-agreement.test.ts`: with
`.meowkit/config.yaml` containing exactly `tdd: !!bool true`, the gate's reader reports
`{enabled:false,source:"default"}` and the CLI resolver reports no `tdd` value and exactly one
`tag-not-supported` error whose message names the plain value — the two now agree the file is invalid, which was
the half that was missing.

## C5 — the session-start block reported the inverse of the effective config — FIXED

**Product decision applied (orchestrator ruling): `.meowkit/config.yaml` is the single source.** The migrated
environment names are not re-supported; the readers that still read them were moved onto the config.

1. **A reader a shell can call.** `.claude/hooks/lib/config-get.cjs` (36 lines) prints one resolved value
   through `read-config.cjs` and always exits 0 with one line — an absent file, an absent key and an invalid
   config all print the caller's fallback, because the callers are cost brakes and one that failed shut on a
   comment typo would be worse than one that kept its default.
2. **The two shipped shell scripts resolve `budget.*` through it.**
   `.claude/skills/autobuild/scripts/budget-tracker.sh:25-40` takes `budget.warn`, `budget.block` and
   `budget.cap` from the config; `.claude/skills/benchmark/scripts/run-canary.sh:22-43,48-49,68-69` takes
   `budget.cap` for both the `check-cap` subcommand and the tier/flag override. The reader is located relative
   to the script, and which PROJECT it answers for is `CLAUDE_PROJECT_DIR` or the working directory, so a kit
   invoked from outside its own tree still reads the right file. Without `node` the documented defaults apply.
3. **A third reader the scan could not see.** `packages/mewkit/src/journey-validation/cost-ledger.ts:33` read
   `MEOWKIT_BUDGET_CAP` as `(opts.env ?? process.env).MEOWKIT_BUDGET_CAP` — a spelling the read scanner's
   `env.NAME` pattern walked straight past, which is why it was in neither the verdict's list nor the sprint's.
   `resolveCapUsd` now takes `configCapUsd` from its caller and reads no environment at all; the scanner gained
   a pattern for the parenthesised form (`scripts/lib/env-read-scan.cjs:31-32`), proved below.
4. **The block itself.** `.claude/hooks/handlers/project-context-loader.cjs:94-138` builds every row from the
   same resolution the handlers use — `isTddEnabled` for strict mode (so the legitimate `MEOWKIT_TDD` override
   still answers first and is labelled as such), `hooks.build-verify`, `hooks.loop-detection`, `autobuild.mode`
   and `budget.cap` through `configValue` — and labels each row with the level that answered
   (`environment override`, `.meowkit/config.yaml`, `~/.meowkit/config.yaml`, `session flag`, `default`). The
   `budget.cap` row is new: it is now the only place that cap is set. The footer states the real precedence and
   no longer names the `settings.json` `env` defaults this sprint deleted.
5. **The metadata.** The reader column is corrected for all eight `toggle` rows, not only the two the verdict
   named: each says the name has no reader and names the config key and the file that resolves it instead. With
   the three readers above moved, `removed-env-names.ts`'s "is not read anywhere now" is true of all 23 entries,
   and `doctor`'s `fail` row is no longer false — exporting `MEOWKIT_BUDGET_WARN` or `MEOWKIT_BUILD_VERIFY` now
   produces a finding whose advice ("set the key, then unset the name") is accurate rather than destructive.
   Verified by running `doctor` in a shell exporting both.
6. **The stale prose.** The `MEOWKIT_*=off` headers are gone from `handlers/build-verify.cjs:5-8` and
   `handlers/loop-detection.cjs:6`, both now naming the config key. The same false instruction was still live in
   six other places and is corrected with them: `reference/hooks.mdx` (three opt-out lines and the bypass
   table), `guide/middleware-layer.mdx`'s opt-out matrix, both autonomous-build pages' `export` advice,
   `skills/benchmark/SKILL.md`, `skills/cook/references/harness-rules.md` Rule 6, and the three
   "not linked to `MEOWKIT_BUDGET_*`" sentences in `skills/context-audit/**` and
   `docs/architecture/system-architecture.md`.

### Tests

- `tests/hooks/session-start-context.test.ts` — three cases. The verdict's own scenario (`tdd: true`,
  `hooks.build-verify: false`, `hooks.loop-detection: false`, plus `budget.cap: 20`) asserts all four rows and
  then asserts the block AGREES with `read-config.cjs` and `tdd-detect.cjs` row for row, so a future divergence
  fails rather than printing a plausible string; an empty config asserts the default rows, the absence of
  `settings.json` from the footer and the real precedence order; and an exported `MEOWKIT_TDD=1` over a project
  `tdd: false` asserts the override is honoured AND labelled.
- `tests/config/shell-config-reads.test.ts` (new, 104 lines) — runs the two real scripts in a scratch project
  with no inherited environment: a configured cap, hard block and warn each produce their own exit code (3, 2,
  1) and message; no config at all keeps the documented defaults; an unparseable config keeps them too rather
  than failing shut; and the canary prefers the configured cap over the one passed on the command line.

## V5 — nothing bound a classified reader to what the code reads — FIXED

`scripts/lib/env-table-audit.cjs` (new, 128 lines) adds the converse, and `scripts/check-env-reads.cjs` runs it
in the same invocation: a **live** name must be read somewhere AND at least one file its reader column names
must be one of the files that read it; a **replaced** name (class `toggle` or `drop`) must be read nowhere in
`.claude/**` or `packages/mewkit/src/**`. A composed read is attributed to the file spelling the suffix rather
than the file making the call, so for those the composition zone is the unit — which is the unit the table
documents anyway. Two reads no syntactic scan can see are declared by name in a new `readerUnverifiable` block
with a reason (an f-string index suffix; a name exported and read back by a markdown skill step), and their
reader file is still required to exist, so a renamed or deleted reader is still caught.

It bit on nine rows the first time it ran, four of them wrong in substance rather than in formatting:
`MEOWKIT_GATE1_PRESENCE_ONLY` named `gate-enforcement.cjs` where the read is in `lib/gate1-hatch.cjs`,
`MEOWKIT_WEB_FETCH_RESPECT_ROBOTS` named `robots_cache.py` where the read is in `fetch_as_markdown.py`,
`MEOWKIT_EVAL_SLUG` named a bare filename that resolves to nothing, and `MEOWKIT_SKIP_SAFETY_SENTINEL` named its
three readers in a brace-expansion that names no file. All nine are corrected.

`tests/config/table-reader-binding.test.ts` (new, 88 lines) asserts the audit is empty and carries four positive
controls — a reader column moved to a real file that does not read the name, a replaced name read again, an
empty reader column, and a reader column naming a file that does not exist — so an empty result is evidence of
agreement rather than of a check that looks at nothing.

**Three probes against the committed script, each reverted immediately** (the tree is back to the state the
`PASS` line below describes):

- reader column of a live name pointed at a real file that does not read it → `FAIL … its reader column names
  hooks/lib/read-config.cjs, but the read is at .claude/skills/autobuild/scripts/budget-tracker.sh`, exit 1.
- one `config_get` call in `budget-tracker.sh` reverted to `${MEOWKIT_BUDGET_WARN:-30}` → `FAIL … recorded as no
  longer read (its replacement is budget.warn), yet read at …budget-tracker.sh:38`, exit 1.
- the `(opts.env ?? process.env).MEOWKIT_BUDGET_CAP` read re-planted in `cost-ledger.ts` → `FAIL … recorded as
  no longer read (its replacement is budget.cap), yet read at …cost-ledger.ts:39`, exit 1. The same probe passed
  silently before the scanner pattern was added, which is the blind spot that let the third reader hide.

## V4 — acknowledged WARN, no change

Accepted as stated, per ruling: the two-reader agreement property is still tested by example. C4's eight
fixtures close the construct the verdict found; a bounded property test over the grammar's alphabet is not added
in this pass.

## Deviations added by this pass

50. **The `budget.*` decision is "config only", and that makes the environment names genuinely dead.** The
    ruling's other option — keep the names supported and stop advertising them as removed — was not taken, so
    `MEOWKIT_BUDGET_{CAP,WARN,BLOCK}` are now read by nothing in the shipped kit and `doctor`'s advice to unset
    them is correct. The user-visible cost, stated plainly: a shell exporting `MEOWKIT_BUDGET_CAP=20` no longer
    caps anything, and the cap must move into `.meowkit/config.yaml`. `doctor` says so by name.
51. **A third reader of a migrated name existed and was invisible to the read scan.**
    `cost-ledger.ts`'s `(opts.env ?? process.env).NAME` spelling matched no pattern in
    `scripts/lib/env-read-scan.cjs`. The pattern set now covers a property access off any parenthesised
    expression, which is deliberately broader than an `env`-anchored match: the prefix filter already bounds it
    to kit names, and the narrow version failed the probe. Read count 165 → **137** — the drop is the deleted
    self-check (next deviation) plus the moved reads, not a weakened scan; the broadened pattern finds no new
    read in the tree and the planted probe proves it would.
52. **`.claude/scripts/verify-env-loading.sh` is deleted, which takes S14.** It was the last reader of
    `MEOWKIT_BUILD_VERIFY` outside the handler headers, so V5's "a replaced name is read nowhere" could not hold
    while it existed. Updating it was considered and rejected: it sources a `.cjs` file with `sh`, never creates
    the `.meowkit/` directory it writes into, asserts a `settings.json` `env` block this sprint correctly
    deleted and greps for a heading the handler no longer emits — 7 of its 8 tests fail, it has zero callers in
    the kit, CLI or CI, and every property it meant to check is covered by `tests/hooks/**`. Consequence
    recorded in the table: `MEOWKIT_ROOT`, `MEOWKIT_VALID` and `MEOWKIT_AFTER` occur nowhere else and their rows
    are removed (82 rows, from 85); `MEOWKIT_API_KEY` survives only in an archived changelog, so it becomes a
    `drop` with a retention entry naming that file and a `removalExempt` entry — it was never a shipped setting,
    so a `doctor` row telling a user to unset it would be the same class of false advice this finding is about.
53. **The universe test's equality rule is split by direction, because a replaced name is a migration record.**
    It asserted that every non-`drop` row appears in the scan. That held only by accident: four `toggle` rows
    were in the universe solely because of the stale prose this pass deleted, and removing it would have failed
    the test for being correct. The rule is now "every LIVE row appears in a scanned tree" plus "no dropped row
    does, unless its retention reason names the file" — and what must be true of a replaced toggle, that nothing
    READS it, is asserted directly by the V5 audit instead of inferred from an occurrence count. A changelog or
    a test may name a migrated variable; nothing may read one.
54. **The provider projections are deliberately not updated, reversing nothing but worth naming.** Deviation 44
    read `MEOWKIT_BUDGET_*` in `src/migrate/modules/**` as consistent with `.claude/`; after this pass it is not
    — those hand-maintained mirrors still ship a `budget-tracker.sh` reading the environment names. They are
    excluded from the scan by design and the drift test covers `drop`-class names only, so nothing fails. The
    projections have no `hooks/lib/config-get.cjs` to call, so pointing them at the config is a projection-shape
    change (where the reader lives under `.cursor/` and `.agents/`) rather than a line edit, and it is left to
    the phase that owns that tree. Flagged rather than silently inherited.
55. **The two docs pages' opt-out tables changed shape, not only content.** `reference/hooks.mdx`'s "Env Var
    Bypasses" is now "Bypasses" and mixes config keys with the two names that stay environment-only
    (`MEOWKIT_HOOK_PROFILE`, read by a safety entrypoint that may not read a config file), with one sentence
    saying why. The heading rename is deliberate: a table of config keys under a heading saying "Env Var" is how
    the next reader learns the wrong mechanism.

## Verification run at this boundary

Run at the finished tree, after the probes were reverted:

- `npm run build` — exit 0
- `npm run lint` — **0 errors**, 3 warnings (all pre-existing, all unused-symbol in files this pass did not
  touch)
- `npm run typecheck` — exit 0
- `npx vitest run` — **274 files / 3231 tests passed, 0 failed** (from 272/3200: the two new files are
  `tests/config/shell-config-reads.test.ts` and `tests/config/table-reader-binding.test.ts` — the latter holds
  the V5 cases rather than `env-universe.test.ts`, which was already 196 lines and would have crossed 200)
- `node --test .claude/hooks/__tests__/*.test.cjs` — **36 pass / 0 fail**
- `node scripts/check-env-reads.cjs` — `PASS: 137 environment-name reads, all classified …; every row agrees
  with the code`
- `node scripts/generate-config-schema.cjs --check` — PASS on both outputs (regenerated after the table edits,
  so the committed `removed-env-names.ts` and `config-v1.json` are the generator's own output)
- `node scripts/check-kit-verbs.cjs` — `PASS: 187 mewkit verb reference(s) … 31 subcommands`
- `mewkit inventory --check` — `Docs match the inventory.`
- `bash scripts/scan-env-names.sh | wc -l` — **71**, against **82** table rows: the 11 absent rows are 7
  `drop`-class names whose deletion landed and 4 `toggle`-class names whose last stale mention this pass
  removed; all **53** live rows are present and no scanned name is unclassified, which is the relationship
  `env-universe.test.ts` asserts.
