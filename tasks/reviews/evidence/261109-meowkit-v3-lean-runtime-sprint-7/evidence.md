# Evidence — CLI surface sprint (contract `261109-1021-meowkit-v3-lean-runtime-sprint-7.md`)

Every command below was run in this repository at the finished tree unless it says otherwise.
BASE = `4f02804f985550599ab87a166b56516342c0144a`. Contract signed at `be3e990b`.

## Environment notes that affect three results

Read these before reading any exit code, because two of them are properties of this machine
rather than of the tree:

1. **This machine's default `node` is v20.20.2**, below the floor the sprint declares. Every
   floor-sensitive command was therefore run with Node 24 on PATH
   (`/opt/homebrew/opt/node@24/bin`, v24.22.2) — the version the CI matrix runs. The full test
   suite was run on Node 24.
2. **This shell exports seven retired `MEOWKIT_*` variables.** `mewkit doctor` reports each as
   a removed setting, so `doctor --hard-gates` exits 1 here with the shell as-is and exits
   **0** with them unset. CI exports none of them. Both measurements are recorded below.
3. `scripts/check-no-python.cjs` has a precondition that `.meowkit/envs/` be empty; this
   machine has five skill environments installed, so it was run with `--allow-existing-envs`.

## AC-01 — contract check resolves verb and subcommand, zero misses

```
$ node scripts/check-kit-verbs.cjs
PASS: 281 mewkit reference(s), verb and subcommand, all resolving against 27 commands   # exit 0
```

Teeth, in a scratch copy of the kit with three planted faults plus one control:

```
$ cd $TMPDIR/mk-check-XXXX && node scripts/check-kit-verbs.cjs
.claude/skills/fixture/fault-one.md:1:   `mewkit status` does not resolve to a known command
.claude/skills/fixture/fault-three.md:1: `mewkit versions check` does not resolve to a known subcommand of `versions`
.claude/skills/fixture/fault-two.md:1:   `mewkit plan capture` does not resolve to a known subcommand of `plan`
FAIL: 3 unresolved mewkit reference(s)                                                  # exit 1
```

- fault 1 = a verb that no longer exists; fault 2 = a real verb with an unknown sub-verb;
  fault 3 = a word after a verb that declares no sub-verbs. Each reported with file, line and
  the exact reference.
- Control: `mewkit trace --friction "note"` and `mewkit validate --packs` in the same scratch
  copy are **not** reported — a flag in the sub-verb slot is a flag.
- One check, one catalogue import. `git diff BASE --name-only -- scripts/` adds
  `docs-manifest.cjs`, `generate-cli-manual.cjs`, `harness-inventory.cjs`; none of them
  resolves kit CLI references.

**Two defects found in the committed check while extending it**, both reported rather than
quietly fixed:

- `versions` and `skill` are real commands and were listed in its `NOT_A_VERB` prose
  allowlist, so every reference to them — verb *and* sub-verb — was silently skipped. A stale
  `mewkit skill <sub>` could not have been caught at BASE.
- `memory` was listed too and is no longer a command, so a leftover reference to a removed
  verb would have been hidden instead of reported.

Both entries were removed; the call count rose from 184 to 194 as a result (280 after the
generated manual and the two new hook notices were added).

## AC-02 — one exit-code invariant

Catalogue: **14** verbs declared sub-verbs at BASE, **13** in the finished catalogue
(`context` removed). BASE behaviour on an unknown sub-verb, measured outside the repo:
`visual-plan` → 2, `task` → 0, `trace` → 0, the remaining **eleven** → 1. The eleventh,
`pack`, measured in both project shapes: exit 1 with `Unknown pack subcommand: zzbogus` plus
its usage line in this repository, exit 1 with the pack-manifest precondition message in a
project without one.

Finished tree, enumerated over the whole catalogue by
`packages/mewkit/src/cli/__tests__/strict-dispatch.test.ts` (13 tests, all passing):

| probe | result |
| --- | --- |
| unknown sub-verb, every one of the 13 verbs | exit **2**, prints the verb's valid sub-verbs from the catalogue |
| absent sub-verb, the 7 verbs declared `requiresSubcommand` | exit **2**, "needs a subcommand" |
| bare `doctor`, `budget`, `backups` | unchanged from BASE; no "needs a subcommand" |
| unknown verb | exit 2 |
| `plan check <not-a-plan>` (ran and failed) | exit 1 |
| `versions` | exit 0 |

`requiresSubcommand` is declared on `CommandSpec` (`cli/catalogue-types.ts`) and read from
there; the test asserts `doctor`, `budget` and `backups` are declared not-required, so the CI
hard gate `doctor --hard-gates` keeps working:

```
$ env -u MEOWKIT_BUDGET_BLOCK … node packages/mewkit/dist/index.js doctor --hard-gates
26 passed, 5 warnings                                                                   # exit 0
$ node packages/mewkit/dist/index.js doctor --hard-gates   # this shell's retired vars present
25 passed, 5 warnings, 8 failed                                                         # exit 1
```

No caller depends on exit 1 for an invocation error — zero `=== 1`, `== 1` or `-eq 1`
exit-code comparisons across `.claude/hooks/`, `.claude/scripts/`, `scripts/`, `tests/` and
`.github/`, now kept true by `tests/cli-caller-exit-codes.test.ts` (2 tests). The only forms
present are `!== 0`.

## AC-03 — per-subcommand help

`strict-dispatch.test.ts` enumerates every verb/sub-verb pair and runs `<cmd> <sub> --help` in
an empty temp directory with no `.claude/`: every pair exits **0**, prints that sub-verb's own
usage, and the directory listing is byte-identical before and after. The four measured BASE
cases now read:

```
$ mewkit plan status --help        → exit 0  mewkit plan status <plan-dir>
$ mewkit task new --help           → exit 0  mewkit task new "<description>" [--type <type>] [--priority <priority>]
$ mewkit review prepare --help     → exit 0  mewkit review prepare <pr-url|number> [--remote <remote>]
$ mewkit trace score --help        → exit 0  mewkit trace score [--id <run>]
```

(At BASE these were exit 1 "missing <plan-dir>", exit 1 "Description is required", exit 1 with
an `npx mewkit init` hint, and exit 0 "Could not find .claude/ directory." respectively.)

**One contract premise was wrong and is recorded rather than worked around.** AC-03 says
`mewkit <cmd> --help` "still prints the verb's help as it does at BASE". At BASE it did not
print help at all — it ran the command (`review --help` exited 1 with "Unknown review
subcommand"). The implementation satisfies the requirement as written (`<cmd> --help` prints
the verb's help, exit 0) and therefore *changes* `review --help` from exit 1 to exit 0. For
`plan`, whose BASE output was genuine usage text, behaviour is preserved.

## AC-04 — one Node floor

ADR: `docs/architecture/adr/261109-node-floor.md` — names the floor (24), the measurement that
`node:sqlite` has zero references left, the rejected option (lower to 20 and lazy-import,
rejected because it has no subject left and because 20 is untested), and the cost.

`packages/mewkit/src/core/node-floor.ts` holds the single constant.
`packages/mewkit/src/core/__tests__/node-floor.test.ts` (7 tests) extracts every statement and
requires one distinct value: both `package.json` manifests (`>=24`), `README.md`
(`- Node.js 24+`), `cli/commands.mdx` and `cli/project-setup.mdx`, the `doctor` check **and its
label**, and all four `node-version:` entries in `ci.yml`. It also asserts no second literal
floor comparison exists anywhere in `packages/mewkit/src`.

Diagnostic behaviour (asserted on injected versions, not on the host):

```
checkNodeVersion("24.0.0")  → pass  "Node.js >= 24"  detail v24.0.0
checkNodeVersion("26.4.1")  → pass
checkNodeVersion("20.20.2") → fail  "Node.js >= 24"  detail "v20.20.2 — need 24 or newer"
                                     fix "Install Node.js 24+ (the version this project's test matrix runs)"
```

This change is what surfaced environment note 1: on this machine's default Node 20 the check
now correctly fails, which is the intended behaviour and the reason the sweep was re-run on 24.

## AC-05 — the launcher

Fresh `$TMPDIR` project, installed from a local release directory (`MEOWKIT_RELEASE_SOURCE`),
never against this repository:

```
$ ls -l .meowkit/bin/mewkit         → -rwxr-xr-x  1935 bytes
$ grep 'const VERSION' …/mewkit     → const VERSION = "2.3.1"
$ git ls-files .meowkit/bin/mewkit  → .meowkit/bin/mewkit          (tracked)
$ git check-ignore -v …             → (not ignored)
$ git ls-files .meowkit             → .env.example  .gitignore  bin/mewkit  config.yaml  mcp.json.example
```

Resolution order, each target removed in turn:

| state | result |
| --- | --- |
| project `node_modules/mewkit/dist/index.js` present | runs it (`resolved-via-project-dependency`), exit 0 |
| project dependency absent, machine record present | runs the recorded entry, exit 0 (`2.3.1`) |
| both absent | exit **1**, `mewkit 2.3.1 is not available to this project.` + `Run \`mewkit doctor\` …` |

Network-free on every branch, asserted on the launcher text and in
`core/__tests__/project-launcher.test.ts` (6 tests): zero matches for `https?://`, `fetch(`,
`node:https`, `npx`, `npm`/`pnpm`/`yarn`, `curl`/`wget`, `.npmrc`/credential/keychain/NPM_TOKEN.
The launcher is 1935 bytes and vendors no CLI — `git diff BASE` adds no bundle.

Containment is the **existing** gate, not a second implementation:

```
executableIsTrusted("<project>/.meowkit/bin/mewkit", project) → true
executableIsTrusted("<outside>/mewkit",              project) → false
```

and a descriptor pointed at an out-of-project copy made the SessionStart handler fall back
instead of executing it.

## AC-06 — fresh init runs orientation through the launcher

Same `$TMPDIR` project; `CLAUDE_ENV_FILE` pre-seeded with another hook's line.

```
$ cat .claude/runtime.json
{ "schemaVersion": "1.0",
  "executable": "…/project/.meowkit/bin/mewkit", … }        # accepted by the trust gate

$ handler({source:"resume"})
[durable task state — untrusted; verify against live sources before acting]
orientation: none

grep -c 'orientation fallback: installed runtime unavailable' → 0
```

The fallback line that prints in **this** repository at BASE is gone in a fresh init project.

D2's six properties, each probed:

| property | measurement |
| --- | --- |
| append, never truncate | env file has 2 lines; `UNRELATED_FROM_ANOTHER_HOOK` still present; exactly 1 `export PATH=` added |
| fully expanded value | 0 occurrences of a literal `$PATH`; `/usr/bin`, `/bin` and the rest present verbatim |
| resolves to the committed launcher | `command -v mewkit` → `…/project/.meowkit/bin/mewkit`; `mewkit --version` → 2.3.1 |
| prepended, wins over a global copy | with a decoy `mewkit` earlier on PATH, resolution still picked the project launcher |
| single-binary directory | `ls -A .meowkit/bin` → `mewkit`; `git` → `/opt/homebrew/bin/git`, `node` unchanged |
| fails closed | `CLAUDE_ENV_FILE` unset → prints `Run \`mewkit doctor\` …`, exits cleanly, orientation still works; write suppressed (unwritable path) → same |

Launcher made untrusted (moved outside the project), checkpoint present:

```
[orientation fallback: installed runtime unavailable — checkpoint cache, verify live before acting]
Resuming session (checkpoint #7)
```

— the labelled fallback is repaired, not removed. Restored launcher → real orientation again.

`tests/hooks/launcher-path-env.test.ts` (11 tests) covers the same six properties plus a
symlinked launcher escaping the project (refused by containment).

## AC-07 — clone without init

Installed `$TMPDIR` project committed, then cloned; the clone has no `node_modules`, no
`.meowkit/cache/`, and no install step was run in it.

```
clone: launcher tracked=.meowkit/bin/mewkit   cache absent=YES   node_modules absent=YES
```

| case | observers | Gate 1 on a source edit |
| --- | --- | --- |
| pinned CLI resolvable | real orientation through the committed launcher | exit **2**, `@@GATE_BLOCK@@` |
| pinned CLI not resolvable (machine record hidden) | launcher: `mewkit 2.3.1 is not available to this project.` + doctor hint; handler: `[orientation unavailable: the installed runtime did not answer — run \`mewkit doctor\`]` | exit **2**, `@@GATE_BLOCK@@` |

**A gap this journey found, and the change it forced.** The runtime descriptor records an
**absolute** path, so the committed copy a teammate clones names the directory the kit was
installed in; containment correctly refuses it, and the clone fell back even though the
launcher was sitting right there. The handler now resolves the committed launcher at its known
project-relative path when the descriptor cannot apply — subject to the same containment rule,
so it grants no reach the descriptor would not have. Without this, AC-07's "it is the path the
clone uses" was false.

A second gap: with no checkpoint and an executable that did not answer, the handler printed
nothing, which reads as "nothing to resume" rather than "the CLI could not be reached". It now
prints the labelled unreachable-runtime line above.

No network was reached in either case (the clone has no path that fetches; the launcher text
carries no network form).

## AC-08 — the kit calls the bare form

```
$ grep -rno "npx mewkit" .claude --exclude-dir=worktrees | wc -l
0
```

41 occurrences across 28 files at BASE → 0. 40 were a mechanical rewrite; the 41st,
`.claude/scripts/bin/setup-workflow`, was `exec npx mewkit setup "$@"` and now prefers the
committed launcher and falls back to the bare name — a shim that fetched a package to run the
project's own setup was the same defect one layer down.

Invocation multiset, extracted before and after (excluding the generated manual):

```
before total: 202   after total: 198
inventory: before=5  after=0     ← the verb AC-09 moved
doctor:    before=7  after=8     ← added references, attributed below
```

No rewritten site changed its verb or sub-verb. The `doctor` delta is **added text, not a
changed instruction**, attributed per file with git rather than with the extractor:
`git grep -o "mewkit doctor" 4f02804f -- .claude | wc -l` = **6** at BASE
(`HOOKS_INDEX.md` 2, `config-get.cjs` 1, `read-config.cjs` 1, `session-context-report.cjs` 1,
`tdd-detect.cjs` 1), and **8** at the finished tree — the same six plus two new sites this
sprint created: the PATH fail-closed hint in `.claude/hooks/lib/launcher-path-env.cjs` and the
unreachable-runtime notice in `.claude/hooks/handlers/orientation-ritual.cjs`. (The extractor
reports 7 for BASE where git reports 6; the one-reference difference is its own tokenization of
a `--hard-gates` line, not a change in the tree.) No rewritten site names an absolute path or
`node …/dist`. `git diff BASE --
packages/docs/content/docs/changelog` is empty.

## AC-09 — three verbs gone, two moved

```
$ mewkit status            → exit 2  Unknown command: status
$ mewkit context resolve   → exit 2  Unknown command: context
$ mewkit explain-support   → exit 2  Unknown command: explain-support
$ mewkit docs-manifest     → exit 2  Unknown command: docs-manifest
$ mewkit inventory         → exit 2  Unknown command: inventory
```

Neighbours intact: `providers`, `budget`, `budget context`, `orient`, `versions`, `validate`
all still run (exit 0). `packages/mewkit/src/commands/context.ts` is deleted;
`printStatus` is gone from the tree (asserted by a grep test); the `explain-support` case was
removed from the dispatcher while `providers` kept its own.

Maintainer verbs, moved to `src/maintainer/` and reached from repo scripts. `files` in
`packages/mewkit/package.json` now carries `!dist/maintainer`, so they leave the **published**
package rather than merely the catalogue:

```
$ node scripts/docs-manifest.cjs --check     → exit 0  ✓ manifest and 167 reference page(s) match
$ node scripts/harness-inventory.cjs --check → exit 0  Docs match the inventory.
$ ci.yml:213  node scripts/harness-inventory.cjs --check     (was: dist/index.js inventory --check)
$ ci.yml:296  node scripts/docs-manifest.cjs --check         (was: dist/index.js docs-manifest --check)
```

`docs-manifest --check` was **already failing at BASE** (167 reference pages stale from the
previous sprint); it was regenerated with `--write` and now passes.

All five kit references to `mewkit inventory` updated: three prose sites now name
`scripts/harness-inventory.cjs`; `.claude/harness-substrate.md`'s banner was **regenerated**
by the script itself; `.claude/agents/AGENTS_INDEX.md`'s banner is **hand-written prose inside
a generated marker** (`--emit-counts` rewrites the numbers, not the banner), so its text was
edited directly and `--emit-counts` re-run as a no-op. Recorded because AC-09 says "regenerated
rather than hand-edited" and only one of the two is actually emitted by code.

The two surfaces round 1 of the contract missed: `packages/mewkit/README.md:30`'s
`mewkit status` row is removed, and `scripts/terminology-linter.cjs:29`'s comment now names
`scripts/harness-inventory.cjs --check`.

`--mode` corrected at both declaration sites (`command-catalogue.ts`): usage reads
`validate [--mode authoring|flat-copy] (--mode is a maintainer override)` and the summary reads
`Maintainer override: force the authoring or flat-copy run profile instead of auto-detecting it`.

Four further callers of a removed verb were found and fixed, each outside the five surfaces the
contract enumerates: `scripts/lib/no-python-checks.cjs` probed `status`, `inventory --check`
and `context resolve`; `tests/install/config-migration.test.ts` asserted through `status`
twice. The no-python harness also learned the new usage wording (`needs a subcommand`).

## AC-10 — the docs

Eight pages named a removed or moved verb at BASE. Six updated — `cli/commands.mdx`,
`cli/index.mdx`, `cli/knowledge.mdx`, `cli/portability.mdx`, `cli/project-setup.mdx`,
`cli/telemetry.mdx` — and the two changelog pages left untouched
(`git diff BASE -- …/changelog` is empty).

`tests/docs-cli-resolution.test.ts` (5 tests) extracts every `mewkit` command and flag from all
eight and **resolves** them against the catalogue — nothing is executed. Zero unresolved verbs,
sub-verbs or flags. Teeth: a planted `mewkit doctor --no-such-flag` and a planted
`mewkit plan capture` both fail the resolver. Its prose allowlist has three entries, each a
real occurrence ("Update mewkit **to** the latest version", "mewkit **tracks** every
installation", "The mewkit **command** line").

101 post-install invocations on those pages were rewritten to the bare form; `npx mewkit init`
and `npx mewkit upgrade` were deliberately kept, because before an install there is no launcher
to resolve the bare name. `cli/index.mdx` gained two sections — how `mewkit` resolves after the
install (launcher, pin, `runtime.json`, PATH, no network, PowerShell non-target, doctor hint)
and the exit-code table plus the help forms — and states the Node 24 floor. No page documents a
global install.

## AC-11 — the generated CLI manual

```
$ node scripts/generate-cli-manual.cjs          → wrote .claude/skills/help/references/cli.md
$ node scripts/generate-cli-manual.cjs --check  → PASS (exit 0)
$ grep -c '^## mewkit ' .claude/skills/help/references/cli.md   → 24
$ catalogue commands                                            → 24
$ grep -cE '^## mewkit (status|context|explain-support|docs-manifest|inventory)$'  → 0
```

Staleness has teeth: changing the catalogue in a scratch copy makes `--check` fail. The manual
presents the maintainer mode verbatim from the corrected declaration:

```
  --mode <value>    Maintainer override: force the authoring or flat-copy run profile instead of auto-detecting it
```

CI runs the check (`ci.yml`, "Generated CLI reference matches the command catalogue"). The
manual lives under a skill's `references/`, so `check-always-on-budget.cjs` stays green (99
bytes of headroom, unchanged by this sprint).

## AC-12 — error paths

```
$ cd $TMPDIR/empty && mewkit budget
No cost log found. Looked for /…/empty/.meowkit/telemetry/cost-log.json and in each parent directory.
Run a MeowKit agent command first; the cost log is written as sessions record usage.
```

The path is produced by `costLogCandidate()`, the same function the search walks with, and
`packages/mewkit/src/commands/__tests__/error-messages.test.ts` (5 tests) compares the message
against that function rather than against a literal — so prose cannot drift from behaviour
again. BASE named `.claude/memory/cost-log.json`, which the reader has never read.

`doctor`'s Node check: label and failure text both name the floor and the version found (see
AC-04). `mewkit status` exits 2 and `printStatus` is gone, so `[object Object]` is unreachable
— asserted by searching the tree, not by formatting it, because the contract scopes that fix to
"if kept" and D7 does not keep it.

Across `budget`, the invocation errors, the launcher refusals and `status`: no stack frame, no
internal class name (`TypeError`/`ZodError`/…), no `[object Object]`, no `.claude/memory/` path.

## AC-13 — repository green, diff inside limits

Full suite, Node 24:

```
$ npm test
Test Files  294 passed (294)
Tests  3366 passed (3366)        skipped 0        # exit 0, 325s
```

No flaky failures: the `withFileLock` family (file-lock, trace-append concurrency,
athena-supervision-wiring) passed in both full runs. No skip was introduced — `git diff BASE`
adds no `it.skip`, `describe.skip`, `test.skip`, `.todo` or `xit(`.

```
$ npm run build      → exit 0
$ npm run lint       → exit 0   (3 pre-existing warnings, 0 errors)
$ npm run typecheck  → exit 0
```

The three lint warnings are unused symbols in `commands/capabilities.ts`, `commands/orient.ts`
and `commands/validate.ts:447` — the first two are untouched by this sprint
(`git diff --stat` is empty for them) and the third is a pre-existing unused function in a file
where only a comment changed.

Validators and committed checks (Node 24, retired env vars unset) — all exit 0:

```
validate --packs --frontmatter --docs-refs --gates --memory --substrate --plugin --agents --workflow --ownership
codex-compat-check.mjs   (this is how `validate --target codex` is run: against a packaged install)
check-kit-verbs  check-env-reads  check-always-on-budget  check-dangling-rule-refs  check-memory-wiki-residue
check-no-python --allow-existing-envs    generate-cli-manual --check
docs-manifest.cjs --check                harness-inventory.cjs --check
doctor --hard-gates
```

`validate --target codex` and `--target cursor` run from the repository root exit 1 with "Not a
codex target (no generated codex layout found)" — that is their BASE behaviour and the reason
CI validates a packaged install instead; `codex-compat-check.mjs` reports
`[PASS] validate --target codex — structural validation green on the packaged install`.

The codex and cursor bundles under `src/migrate/modules/` are **authored**, not generated —
there is no regeneration script, so "regenerate to a no-op" is satisfied by the compatibility
lane plus the brand and structural tests. Two files in them named a removed verb and were
updated (`mk-context-audit/SKILL.md` in both bundles, and codex
`compliance/capability-coverage.json`); the first edit initially leaked the word "MeowKit" into
brand-free Codex output and was caught by `migrate-codex-e2e.test.ts`, then reworded.

Line counts. New files, none over 200 except the generated manual (exempt):

```
strict-dispatch.ts 117   project-launcher.ts 146   node-floor.ts 24
launcher-path-env.cjs 99   generate-cli-manual.cjs 105   docs-manifest.cjs 33   harness-inventory.cjs 43
strict-dispatch.test.ts 169   project-launcher.test.ts 114   node-floor.test.ts 100
error-messages.test.ts 103   launcher-path-env.test.ts 163   docs-cli-resolution.test.ts 143
cli-caller-exit-codes.test.ts 73   adr/261109-node-floor.md 58
(moved, unchanged in size: maintainer/inventory.ts 172, maintainer/docs-manifest.ts 139;
 orientation-ritual.cjs 113 -> 162)
.claude/skills/help/references/cli.md 514   (generated — exempt)
```

No changed file **crossed** 200 because of this sprint. Files already over 200 at BASE that
grew, by name, with BASE and final counts:

| file | BASE | final |
| --- | --- | --- |
| `.github/workflows/ci.yml` | 380 | 386 |
| `packages/mewkit/src/cli/command-catalogue.ts` | 328 | 392 |
| `packages/mewkit/src/commands/budget.ts` | 303 | 306 |
| `packages/mewkit/src/commands/doctor-checks.ts` | 377 | 383 |
| `packages/mewkit/src/commands/init.ts` | 1037 | 1040 |
| `packages/mewkit/src/commands/upgrade.ts` | 527 | 534 |
| `packages/mewkit/src/core/smart-update.ts` | 605 | 614 |

`packages/mewkit/src/index.ts` **shrank**, 534 → 493. (`init.ts` measures 1037 at BASE, not the
1042 the sprint-6 contract recorded; it grew by 3 lines — the `cliVersion` field, its comment
and the value passed to the projection. Sprint 7's AC-13 carries no init no-growth clause.)

`git diff BASE` adds no `any`, no `as any`, no `as unknown as`, no `@ts-ignore`, no new TODO or
FIXME, no secret or key encoding. No code comment, test name, file name or script name
introduced this sprint references a plan artifact (`AC-NN`, sprint, phase, `D<n>`, round,
amendment) — grepped over the added lines of every `.ts`, `.cjs`, `.js`, `.mjs`, `.sh` and
`.yml`.

## Golden hook corpus — one deliberate expectation change

Two fixtures pinned hook output containing `npx mewkit plan approve`, which AC-08 rewrites:

```
tests/hooks/golden/gate1-plan-without-receipt.json
  - After the human approves, stamp it: npx mewkit plan approve …
  + After the human approves, stamp it: mewkit plan approve …
tests/hooks/golden/gate1-plan-stale-hash.json
  - Re-approve after the human confirms: npx mewkit plan approve …
  + Re-approve after the human confirms: mewkit plan approve …
```

Only that substring moved. `expect.exit` (2) and `expect.marker` (`@@GATE_BLOCK@@`) are
unchanged and were asserted unchanged by the patch script, and the other lines are
byte-identical — the gate semantics the corpus exists to protect are untouched, while the hint
text changed on purpose. Re-recording was **not** used: the recorder replays the pre-port bash
hooks at a fixed base, which would have re-recorded the old `npx` text. `golden-replay.test.ts`
passes: 86 tests. No assertion was relaxed and no normalizer was added.

## Files changed

78 files, +1647/−684. New: `cli/strict-dispatch.ts`, `core/node-floor.ts`,
`core/project-launcher.ts`, `.claude/hooks/lib/launcher-path-env.cjs`,
`.claude/skills/help/references/cli.md`, `scripts/{docs-manifest,harness-inventory,generate-cli-manual}.cjs`,
`docs/architecture/adr/261109-node-floor.md`, five test files. Deleted:
`packages/mewkit/src/commands/context.ts`. Moved: `commands/{docs-manifest,inventory}.ts` →
`maintainer/`.

## Simplify pass

Behavior-preserving cleanup over the same change surface, after the suite was green. No
acceptance-criterion behavior was altered; the full suite, both committed checks, build, lint
and typecheck were re-run before and after and are byte-identical in outcome (294 test files /
3366 tests pass; lint 0 errors, the same 3 pre-existing warnings in files outside this diff).

- `cli/flag-summary.ts` — added `flagText(flag, command)`, the printed-summary formula
  (per-command text plus the `(repeatable)` marker) that `render-help.ts` and `flagLines` each
  carried a copy of.
- `cli/render-help.ts` — deleted its private `flagLabel` (a duplicate of the exported one),
  its `flagSummary`, and its `pad` helper; labels and names now use `String.padEnd`, which is
  identical here because every column width is `max(length) + 2` and so always exceeds the
  text it pads. 82 → 68 lines.
- `cli/strict-dispatch.ts` — dropped the `commandFlagLines` pass-through wrapper and the
  exported single-caller `findCommand`; collapsed the two three-line branches of
  `renderInvocationError` into one headline plus the shared tail; trimmed the header comment.
  117 → 96 lines.
- `core/project-launcher.ts` — removed `readCliEntry`, an exported function with no caller
  anywhere (the launcher reads the record with its own inlined reader), and the `readFileSync`
  import it was the only user of.
- `.claude/hooks/lib/launcher-path-env.cjs` — `containedLauncher` is now the single
  containment check and returns the real launcher path; `containedLauncherDir`, which held the
  logic while `containedLauncher` re-joined its result, is gone and callers take
  `path.dirname`. 99 → 88 lines.
- `.claude/hooks/handlers/orientation-ritual.cjs` — removed `trustedLauncher`, which re-ran the
  `isFile` check `containedLauncher` already performs; the resolution list now names
  `containedLauncher(ROOT)` directly and keeps its rationale as a comment at that site.
- `scripts/check-kit-verbs.cjs` — the 44 prose words that appeared in both `NOT_A_VERB` and
  `NOT_A_SUBCOMMAND` are declared once as `PROSE_EITHER_SLOT`; each set now adds only its
  slot-specific words. Both resolved sets were diffed against their previous contents and are
  element-for-element identical (91 and 68 entries), and every exception stays visible in the
  file.
- `index.ts` — removed the `relative` import, dead since `printStatus` was deleted.
- `maintainer/docs-manifest.ts` — reworded one comment that referred to "this phase"; code
  comments must be self-contained rather than point at plan artifacts.

Considered and deliberately not done: the realpath-containment check is still written twice
inside `.claude/` (the descriptor gate in `orientation-ritual.cjs` and `containedLauncher`),
because that handler's gate is required to mirror `core/hook-runtime.ts` line for line and
unifying it would move a trust boundary; and the "dist is not built" import preamble is shared
by only two of the three repo scripts, which is below the threshold for extracting a helper.

## Review fixes

Gate 2 returned FAIL on one reproduced defect (F1) plus five cheap WARN items. All six are
fixed below; nothing outside the signed contract was added. Re-run on Node 24
(`/opt/homebrew/opt/node@24/bin`, v24.22.2) against the current tree, which includes the
simplify pass recorded above.

### F1 [was MAJOR, blocking] — `runningCliEntry` decoded a file URL with `new URL().pathname`

`packages/mewkit/src/core/project-launcher.ts` now uses `fileURLToPath(moduleUrl)`, the API the
rest of the package already uses. Reproduced first, on the same three inputs, with the old and
the new expression side by side:

```
dir with space   old=ENOENT new=ok
josé münchen     old=ENOENT new=ok
plain            old=ok     new=ok
```

The failure mattered because the throw was swallowed by the caller's `try`, so an install under
such a path silently wrote **neither** the launcher nor `.claude/runtime.json` — the two things
AC-05 and AC-06 are defined by — and reported only a non-fatal warning.

Four cases added to `core/__tests__/project-launcher.test.ts` (6 → 10 tests), each building a
real `dist/` layout under `os.tmpdir()`: a directory name with a space, one with non-ASCII
characters (`josé münchen`), a plain-ASCII control, and a module URL with no entry beside it
(still throws rather than inventing a path).

End-to-end re-run of the install journey under the path shape that used to break it
(`$TMPDIR/mk-fix-XXXX/josé dir/project`):

```
init exit=0
launcher present: YES          runtime.json present: YES
"Could not write the project launcher" warnings: 0
handler output: [durable task state — untrusted; …]
'orientation fallback: installed runtime unavailable' count: 0
```

### F8 [WARN] — unescaped shell assignment in the env-file write

`.claude/hooks/lib/launcher-path-env.cjs` now writes `export PATH=<single-quoted>` through a
`singleQuote()` helper that closes and re-opens the quote around any `'`
(`/it's/c` → `'/it'\''s/c'`). Single quotes and not double, because inside double quotes a
shell still expands `$VAR`, `${…}`, `$(…)` and backticks. A value containing a newline, CR or
NUL cannot be one assignment at all, so that case **refuses** and falls closed to the doctor
hint rather than appending a line whose tail the shell would read as a command.

Three cases added to `tests/hooks/launcher-path-env.test.ts` (11 → 14 tests):

- a project directory literally named `ev$(touch PWNED)il "quoted" `id` dir` — the written line
  is asserted to be single-quoted, then handed to `/bin/sh` to evaluate, and the resulting
  `$PATH` entry equals the launcher directory byte for byte while no `PWNED` file exists
  anywhere (so the `$(…)` and the backticks were data, not code);
- a directory named `it's a dir`, evaluated by a real shell, for the one byte single quotes
  cannot hold;
- a `PATH` entry containing a newline → returns the hint and writes nothing.

The D2(ii)(b) property is strengthened rather than changed: the line now cannot interpolate
anything, so "fully expanded, no `$PATH`" holds by construction. The existing assertions were
retargeted from `/^export PATH="/` to `/^export PATH='/` and read the value through a shared
`pathValue()` that unquotes it the way a shell would.

### F2 [MINOR] — flag aliases were folded into the verb set

`scripts/check-kit-verbs.cjs` no longer adds `CLI_CATALOGUE.aliases` (`{h, v, y}` — short
**flag** names) to the verb set. The printed count now equals the catalogue's:

```
PASS: 281 mewkit reference(s), verb and subcommand, all resolving against 24 commands
catalogue commands: 24      generated manual entries: 24
```

And the aliases no longer resolve as verbs, proven on a planted fixture:

```
.claude/skills/fixture/alias-as-verb.md:1: `mewkit h` does not resolve to a known command
.claude/skills/fixture/alias-as-verb.md:1: `mewkit y` does not resolve to a known command
FAIL: 2 unresolved mewkit reference(s)                                            # exit 1
```

### F4 [MINOR] — dead `launcherPresent` removed

Deleted from `core/project-launcher.ts` together with the `statSync` import it was the only
user of, and the test-only assertion at `core/__tests__/project-launcher.test.ts` is gone.
`grep -rn launcherPresent` over `packages`, `scripts`, `tests` and `.claude` returns nothing.
Wiring it into `doctor` would have been new behaviour the contract does not ask for, so removal
was the in-scope half of the reviewer's either/or.

### F6 [MINOR] — the changelog test now asserts immutability

`tests/docs-cli-resolution.test.ts` compares both changelog pages byte-for-byte against the
reviewed revision (`git show be3e990b:<path>`) instead of calling `fs.existsSync`, and a
sibling case proves the comparison has teeth by showing that an appended line would make it
differ. 5 → 6 tests.

### F7 [MINOR] — exit-code-caller guard widened

`tests/cli-caller-exit-codes.test.ts` now also catches the reversed JS order
(`1 === result.status`) and the POSIX shapes `[ "$?" = "1" ]` and `[ $? == 1 ]` alongside the
original `status === 1` and `-eq 1`. A new case runs six offender strings (all must match) and
five allowed strings (`!== 0`, `=== 0`, `-ne 0`, `toBe(2)`, `const retries = 1`) that must not,
so the guard cannot be widened into something that fires on a clean tree. 2 → 3 tests. The
property itself still holds: zero matches across `.claude/hooks/`, `.claude/scripts/`,
`scripts/`, `tests/` and `.github/`.

### An incident worth recording

One of the scripted edits wrote two literal backspace bytes (`0x08`) into
`tests/cli-caller-exit-codes.test.ts` where `\b` was intended, which is why the widened regex
silently failed to match at first. The line was rewritten and **every** file changed by this
sprint was then scanned for control characters: none remain. Worth knowing that a passing test
is not proof a file is clean — the corrupted regex still compiled.

### Left as recorded follow-ups, per the review

- **F3** — the `npx` pin records a path under `~/.npm/_npx/<hash>/…`, so the pin is only as
  durable as npm's cache; the degradation is the labelled doctor-hint branch D3 chose.
- **F5** — six per-command unknown-subcommand branches are now unreachable for the case they
  were written for; pre-existing code, outside the approved scope.
- **F11** — D2(ii)(f) ("no safety hook resolves through this PATH entry") is prose with no
  test; the one contradicting path (`memory-store-lint.cjs`'s bare-name fallback) pre-dates
  this change and moves a check from skipped to performed.
- **F9 / F10 / coverage gap 3** — verifying the launcher's bytes before execution, the one-hop
  containment boundary, and reading the env file (rather than the hook's own `PATH`) to detect
  an already-written line. All non-blocking suggestions; each would add behaviour the contract
  does not cover.

### Verification after the fixes

```
npm run build                         → exit 0
npm run lint                          → exit 0   (3 pre-existing warnings, 0 errors)
npm run typecheck                     → exit 0
npm test                              → exit 0   294 files / 3375 tests passed (was 3366; +9 new)
node scripts/check-kit-verbs.cjs      → exit 0   281 references, 24 commands
node scripts/generate-cli-manual.cjs --check → exit 0
node scripts/docs-manifest.cjs --check       → exit 0
node scripts/harness-inventory.cjs --check   → exit 0
node scripts/check-env-reads.cjs             → exit 0
node scripts/check-always-on-budget.cjs      → exit 0
node scripts/check-dangling-rule-refs.cjs    → exit 0
node scripts/check-memory-wiki-residue.cjs   → exit 0
node scripts/check-no-python.cjs --allow-existing-envs → exit 0
node packages/mewkit/scripts/codex-compat-check.mjs    → exit 0
mewkit doctor --hard-gates (retired MEOWKIT_* unset)   → exit 0
```

No test was skipped, deleted or weakened; the three retargeted assertions (two quoting
assertions in the PATH test, one changelog case) each assert the same or a stronger property.

### Second review round — F12, F13, F14 (test-only)

Re-review returned WARN 9.0 with three new minor items, all in the tests the fix round added.
No source behavior changed; the one source edit is an optional parameter whose default is the
previous behavior.

**F13 — a test file over the 200-line limit.** `tests/hooks/launcher-path-env.test.ts` had
reached 224 lines, which is the AC-13 clause it was measured against. Split at the seam the
reviewer identified — the library's own properties versus the handler that calls it — into:

```
tests/hooks/launcher-path-env-library.test.ts    157   (12 cases: the library's properties)
tests/hooks/launcher-path-env-handler.test.ts     52   (2 cases: handler integration)
tests/hooks/lib/launcher-path-fixtures.ts         57   (shared builders, not a suite)
```

14 cases before, 14 after — nothing dropped, and no shell-evaluated injection test traded away
for a line count. The fixtures went to `tests/hooks/lib/`, the directory this repository already
uses for exactly that (`handler-fixtures.ts`, `replay-harness.ts`, `corpus-cases.ts`), rather
than being copied into both files where they could drift.

Fixing F12 and F14 then pushed two more files just over the limit, so both were split at a real
seam as well rather than trimmed to hit a number:

```
packages/mewkit/src/core/__tests__/project-launcher.test.ts            202 → 155  (launcher file + resolution)
packages/mewkit/src/core/__tests__/project-launcher-module-url.test.ts        53  (module-URL decoding)
tests/docs-cli-resolution.test.ts                                      201 → 135  (documented CLI resolves)
tests/docs-changelog-immutability.test.ts                                      83  (changelog unchanged)
```

Every file added by this sprint now measures under 200 except the generated manual (514), which
is the declared exemption — audited by listing all 20 of them.

**F12 — tests wrote into the developer's real home directory.** `writeLauncher` → `recordCliEntry`
resolved `path.join(homedir(), ".mewkit", "cli", …)` with no seam, so four test calls left real
files outside any temp directory. `cliRecordPath`, `recordCliEntry` and `writeLauncher` now take
an optional `storeHome`; **the production default is unchanged** (`homedir()`), and the read side
needed no change because the generated launcher resolves the same path from its own process.

All four test calls now pass a `mkdtemp` store, and two cases were added rather than only
retargeting the old ones:

- the record branch is now exercised for the first time — the `npx` case where the project has
  no dependency, run with `HOME`/`USERPROFILE` pointed at the disposable store, asserting the
  launcher resolves `from-record`. The reviewer noted this branch had no test at all;
- a guard that the same version does **not** appear under the real home, which is the property
  that keeps the suite from leaving residue.

The stray record the earlier run left (`~/.mewkit/cli/9.9.9-test.json`, naming a `$TMPDIR` path
that no longer existed) was deleted with a single-file `rm`. After a full suite run the real
store holds only `2.3.1.json`, which a journey install legitimately wrote and which still names
an existing entry.

**F14 — the changelog comparison pinned a literal SHA.** `REVIEWED_REVISION = "be3e990b"` is
replaced by `resolveComparisonBase()`, which tries `git merge-base HEAD origin/main`, then
`main`, then `HEAD`, and reports which one it used in the assertion message. Every fallback
still asserts something true: the merge-base means "unchanged since this work began", `HEAD`
means "unchanged by the working tree". A new case asserts the resolved base is a full SHA and
that its description names which rule produced it, so a silent degradation to the weakest
fallback is visible. The teeth case is kept, and it now also asserts the fetched page is
non-empty — a missing object would otherwise look like an empty file rather than an error.
`grep -rn be3e990b tests/ packages/mewkit/src` is empty.

**An incident worth recording, again.** The widened regex from F7 had been corrupted by two
literal backspace bytes written by a scripted edit; the file still compiled and the test still
passed, which is why it went unnoticed until the assertion failed for the wrong reason. Every
file this sprint changed was re-scanned for control characters after each round: none remain.

#### Verification after F12, F13 and F14

```
npm run build                                → exit 0
npm run lint                                 → exit 0   0 errors, 3 pre-existing warnings
npm run typecheck                            → exit 0
npm test                                     → exit 0   297 files / 3378 tests passed
node scripts/check-kit-verbs.cjs             → exit 0   281 references, 24 commands
node scripts/generate-cli-manual.cjs --check → exit 0
node scripts/docs-manifest.cjs --check       → exit 0
node scripts/harness-inventory.cjs --check   → exit 0
node scripts/check-env-reads.cjs             → exit 0
node scripts/check-always-on-budget.cjs      → exit 0
node scripts/check-dangling-rule-refs.cjs    → exit 0
node scripts/check-memory-wiki-residue.cjs   → exit 0
mewkit doctor --hard-gates                   → exit 0   (retired MEOWKIT_* unset)
~/.mewkit/cli/ after the suite              → 2.3.1.json only
```

Test counts across the three rounds: 3366 (build) → 3375 (fix round, +9) → 3378 (this round,
+3: the record branch, the no-residue guard, and the resolved-base assertion). File count 294 →
297 as the three splits landed. No test was skipped, deleted or weakened in any round.
