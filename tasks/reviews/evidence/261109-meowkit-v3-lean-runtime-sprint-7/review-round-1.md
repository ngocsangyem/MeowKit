# Review: MeowKit v3 lean runtime — CLI surface (sprint 7)

- **Reviewed base:** `be3e990b` ("contract: evaluator signs sprint 7 …"), branch `feat/v3-lean-runtime`
- **Reviewed change:** working tree vs `be3e990b` — `git diff HEAD` plus untracked files, excluding `tasks/plans/` (never committed)
- **Spec graded against:** `tasks/contracts/261109-1021-meowkit-v3-lean-runtime-sprint-7.md` (signed, 13 acceptance criteria)
- **Build/simplify evidence read:** `tasks/reviews/evidence/261109-meowkit-v3-lean-runtime-sprint-7/evidence.md`
- **Mode:** default (TDD off) — coverage gaps are WARN, except where a gap conceals a reproducible defect
- **Score:** 7.5/10

## Verdict: FAIL

One reproducible defect in new code silently defeats the two acceptance criteria this sprint
exists to satisfy (AC-05, AC-06) for a common class of install paths. Everything else in the
change is sound, measured, and independently re-verified. One required change; four dimensions
clear.

| Dimension | Result |
| --- | --- |
| Correctness | FAIL |
| Maintainability | WARN |
| Performance | PASS |
| Security | WARN |
| Coverage | WARN |

Side Effects Detected: No

## Correctness

Result: FAIL

**F1 [MAJOR — required] `packages/mewkit/src/core/project-launcher.ts:129` decodes a file URL with
`new URL(moduleUrl).pathname` instead of `fileURLToPath`.**

```ts
const here = path.dirname(new URL(moduleUrl).pathname);
return realpathSync(path.join(here, "..", "index.js"));
```

`pathname` is percent-encoded and, on Windows, carries a leading slash before the drive letter.
Reproduced on this host (Node 24.22.2):

- install path containing a space → `pathname` yields `…/dir%20with%20space/…` → `realpathSync`
  throws `ENOENT`
- install path containing a non-ASCII character (e.g. `josé`) → `…/jos%C3%A9/…` → `ENOENT`
- control, plain ASCII path with no space → resolves correctly

Blast radius. `runningCliEntry` is reached from `core/smart-update.ts:536` only when
`resolveInProjectExecutable(targetDir)` is `null` — that is, when the project holds no `mewkit`
dependency of its own, which is exactly the `npx`-install case this sprint was written for. The
throw is swallowed by the surrounding `try` at `core/smart-update.ts:542`, so **both**
`writeLauncher` and `writeRuntimeDescriptor` are skipped and the only output is a non-fatal
warning. The project then lands on the literal `[orientation fallback: installed runtime
unavailable …]` line that AC-06 is defined by the absence of, and has no `.meowkit/bin/mewkit`,
which AC-05 requires to arrive. The failure is silent and fail-safe, not a crash — but the
sprint's headline mechanism is absent for every Windows install and for any POSIX user whose
install path carries a space or a non-ASCII character (non-English home directory names are not
an edge case globally).

Why the evidence did not catch it: the AC-05/AC-06 journeys ran in a single `$TMPDIR` project
whose path happened to be plain ASCII with no spaces, and `core/__tests__/project-launcher.test.ts`
exercises `LAUNCHER_REL`, `launcherPath`, `launcherPresent`, `launcherSource` and `writeLauncher`
but never `runningCliEntry`. The rest of this codebase already uses the correct API
(`fileURLToPath` in `packages/mewkit/src/index.ts`, and in every new test file in this change),
so this is an isolated lapse from the local convention, not a design choice.

Fix: `fileURLToPath(moduleUrl)`, plus one test that resolves an entry through a directory whose
name contains a space.

**F2 [MINOR] `scripts/check-kit-verbs.cjs:172` reports a command count that is not the command
count.** The new PASS line reads `all resolving against 27 commands`; the catalogue declares
**24** (verified: `CLI_CATALOGUE.commands.length === 24`, and `grep -c '^## mewkit '` on the
generated manual is also 24, which AC-11 requires them to agree on). The gap is
`scripts/check-kit-verbs.cjs:118`, which folds `CLI_CATALOGUE.aliases` into the *verb* set —
but those aliases are `{h: "help", v: "version", y: "yes"}`, i.e. short **flag** names, not
commands. Two consequences: the number a maintainer reads is wrong, and `mewkit h` / `mewkit y`
would resolve as valid verbs in kit prose (`v` and `version` happen to be caught by the
`NOT_A_VERB` prose list; `h` and `y` are not). The alias line predates this change; the
count-bearing message is new, and the extension's whole premise is that nothing silently
resolves a reference nobody can run.

**F3 [MINOR, accepted cost] The pin's durability in the `npx` case.** When no in-project
dependency exists, `recordCliEntry` stores the running entry — for an `npx` install that is a
path under `~/.npm/_npx/<hash>/…`, which npm prunes on its own schedule. The launcher then
resolves nothing and prints its doctor hint, which is the labelled, fail-safe branch D3 chose.
So the mechanism is correct, but the "no more fallback line" outcome is only as durable as the
npx cache. Not in the contract and not blocking; recorded so the expectation is accurate.

Verified correct (independently re-measured, not taken from the evidence file):

- AC-02 exit-code invariant — `status`, `context resolve`, `explain-support`, `docs-manifest`,
  `inventory`, `nonsenseverb` all exit 2; `plan bogus` exits 2 with `` Unknown `plan` subcommand:
  bogus ``; bare `plan`/`review` exit 2 with "needs a subcommand"; bare `backups`, `task-state`,
  `trace` exit 0 and bare `doctor --hard-gates` exits 0 — unchanged from BASE, so the CI hard
  gate survives. `capabilities` bare still exits 1 (ran and failed), which is the right code.
- `requiresSubcommand` is declared only where the bare form has no meaning (7 verbs) and the six
  verbs with a real bare form — `doctor`, `budget`, `backups`, `capabilities` (defaults to
  `list`), `task-state` (defaults to `show`), `trace` (the `--friction` write is a flag) — are
  correctly left not-required. I traced each one to its dispatcher default rather than trusting
  the declaration.
- AC-03 per-subcommand help — `plan status --help`, `task new --help`, `trace score --help`,
  `review --help` all exit 0 and print catalogue usage; the working directory was byte-empty
  before and after the whole probe sweep.
- `classifyInvocation` never mistakes a positional value for a sub-verb: every verb that takes a
  slot-1 argument (`note`, `migrate`, `providers`, `verdict-gate`) declares no subcommands, so it
  short-circuits at `cli/strict-dispatch.ts:50`.
- The `pad` → `String.padEnd` substitution in `cli/render-help.ts` is genuinely behaviour-identical:
  every column width is `max(label) + 2`, so the `text.length >= width` branch of the deleted
  helper was unreachable.
- Repo-script parity and the four CI-invoked checks, run here: `check-kit-verbs` exit 0,
  `generate-cli-manual --check` exit 0, `docs-manifest.cjs --check` exit 0 (167 reference pages),
  `harness-inventory.cjs --check` exit 0, `check-env-reads` exit 0 (138 reads),
  `doctor --hard-gates` exit 0 with the retired `MEOWKIT_*` names unset.
- Test re-run on Node 24: 11 files / 154 tests pass, covering strict dispatch, node floor,
  project launcher, error messages, launcher PATH env, docs CLI resolution, caller exit codes,
  golden hook replay, orient hook, bootstrap, config migration.

## Maintainability

Result: WARN

The change is readable and the comments explain invariants rather than origins. No `any`, no
`as any`, no `as unknown as`, no `@ts-ignore`, no new TODO/FIXME, no commented-out code
(grepped over every added line of the diff plus every untracked file). No code comment, test
name, file name or script name introduced here references a plan artifact — the one grep hit is
generic prose in `.claude/skills/plan-creator/`, whose subject legitimately *is* plans. New files
are all under 200 lines; the generated manual (514) is the declared exemption.

- **F4 [MINOR] `core/project-launcher.ts:134` `launcherPresent` has no production caller** — only
  `core/__tests__/project-launcher.test.ts:50`. The simplify pass deleted `readCliEntry` for
  precisely this reason, so the file is internally inconsistent. Its doc comment says "used by
  diagnostics"; there is no such diagnostic. Either wire it into `doctor` (which would give the
  launcher's own absence a named report, and F3's degradation a place to surface) or delete it.
- **F5 [MINOR] Six per-command unknown-subcommand branches are now unreachable** for the case
  they were written for, because `classifyInvocation` intercepts first: `index.ts:194`,
  `commands/capabilities.ts:102`, `commands/task-state.ts:237`, `commands/backups.ts:110`,
  `commands/pack.ts:83`, `commands/advice.ts:563`. They are either defence-in-depth for
  programmatic callers or dead code; the change does not say which. Pre-existing code and outside
  the approved scope, so no edit is required — but one sentence at `cli/strict-dispatch.ts` saying
  which it is would stop the next reader re-deciding.
- **F6 [MINOR] `tests/docs-cli-resolution.test.ts:134` asserts less than its own name claims.**
  The case is titled "leaves the changelog pages alone, because they record what past releases
  did" and then asserts only `fs.existsSync` on both pages. It would pass on a fully rewritten
  changelog. The property AC-10 actually asks for (an empty diff against the base) does hold — I
  confirmed no `changelog/*` file appears in the diff — but the test does not establish it.
- **F7 [MINOR] `tests/cli-caller-exit-codes.test.ts:29` leaves two caller shapes uncovered.** The
  regex catches `status === 1` and `-eq 1` but not POSIX `[ "$?" = "1" ]` / `[ "$?" == 1 ]`, nor a
  truthiness branch like `if (r.status)`. The property is true today either way; the guard is
  narrower than the invariant it is advertised to hold.

Positive notes worth keeping: `requiresSubcommand` and `subcommandUsage` are declared on
`CommandSpec` and read from there, so the "which verbs require a sub-verb" question has exactly
one answer; `cli/flag-summary.ts`'s `flagText`/`flagLines` genuinely de-duplicate what
`render-help.ts` and the generated manual each carried; the two repo scripts in `scripts/` are
thin argv adapters over an unchanged implementation, which is the cheapest possible form of the
"move the verb, keep the code" decision.

## Performance

Result: PASS

No regression, and nothing in the hot path got heavier in a way that matters.

- Dispatch adds one `Array.find` over 24 entries plus one `Array.includes` over at most 10
  sub-verbs before the switch (`cli/strict-dispatch.ts:40-59`) — no I/O, no file read, constant
  for practical purposes.
- Help rendering filters the flag list once per command instead of the previous equivalent work;
  `flagLines` is called only on a help path.
- `exposeLauncherOnPath` costs two `realpathSync` calls, one `statSync` and at most one
  `appendFileSync` of a single line, once per SessionStart.
- `.claude/hooks/handlers/orientation-ritual.cjs:132` builds `[trustedExecutable(),
  containedLauncher(ROOT)]` eagerly, so the launcher's realpath pair runs even when the
  descriptor already resolved. Two extra syscalls per session — immaterial, named only so the
  review is not silent about it.
- No unbounded read, no new network call anywhere (the launcher text was re-checked for
  `https?://`, `fetch(`, `node:https`, `npx`, package-manager spawns and credential reads — none
  present), no new synchronous work inside a gate hook.

## Security

Result: WARN

Blocked-pattern scan over every added line and every untracked file: clean. No hardcoded secret
or key material, no `any`, no unsafe cast, no `eval`, no `shell: true`, no string-interpolated
SQL, no `localStorage`, no disabled certificate validation, no `CASCADE DELETE`. Both new
process spawns pass an argv array and never a shell string — `core/project-launcher.ts:105`
(`spawnSync(process.execPath, [cli, …argv])`) and `.claude/scripts/bin/setup-workflow`
(`exec "$launcher" setup "$@"`, under `set -euo pipefail`, with the launcher path quoted).

- **F8 [WARN — MAJOR shape, low realistic reach] `.claude/hooks/lib/launcher-path-env.cjs:81`
  writes an unescaped shell assignment into a file the host evaluates as shell code.**

  ```js
  fs.appendFileSync(envFile, `export PATH="${value}"\n`, 'utf8');
  ```

  `value` is assembled from the existing `PATH` entries plus the launcher directory, with no
  escaping. Inside double quotes a shell still expands `$VAR`, `${…}`, `$(…)` and backticks, and
  a `"` or trailing `\` in any entry breaks the quoting outright. So an entry containing `$` is
  re-interpolated when the host sources the line — which is the exact failure mode decision
  D2(ii)(b) was written to prevent, just reached by a different character than `$PATH` — and an
  entry containing `$(…)` or a backtick becomes command substitution evaluated before every
  later Bash command. The existing test only checks for the absence of the literal string
  `$PATH` (`tests/hooks/launcher-path-env.test.ts:59-67`).

  Threat model, traced rather than assumed: the inputs are the session's own `PATH` and
  `CLAUDE_PROJECT_DIR`. An attacker who can set a `PATH` entry already runs code, so that leg is
  not a real escalation. The leg that is real is the project directory name — a clone directory
  named from a hostile URL, or an archive extracted into a crafted directory, puts attacker-chosen
  characters into `path.dirname(launcher)`. That is a narrow and partly self-inflicted path, which
  is why this is a WARN and not a stop. Recommended fix: reject or escape any entry containing
  `"`, `$`, a backtick or a trailing backslash, and add the metacharacter case to the test.

- **F9 [informational] Containment is not weakened by the new clone-case resolution, but the
  launcher is now executed on sight.** `containedLauncher`
  (`.claude/hooks/lib/launcher-path-env.cjs:44-59`) applies the same rule as the descriptor gate —
  `realpath` both sides, then require the target to stay inside the real root — and it reads a
  fixed project-relative path rather than any recorded one, so it grants no reach the descriptor
  path would not have granted. The symlink-escape case is covered
  (`tests/hooks/launcher-path-env.test.ts:115`). The honest framing of the delta: at the reviewed
  base, hook-time execution of an in-project file required a committed `.claude/runtime.json`
  naming it (which the gate accepts for any in-project absolute path); now `.meowkit/bin/mewkit`
  alone suffices, and that file is *expected* to be committed, so it is a less conspicuous place
  for a hostile change to sit. No verification of the launcher's bytes happens before execution,
  even though the CLI generates that text deterministically via `launcherSource(version)`.
  Non-blocking suggestion: compare the launcher text against the generated source and refuse on
  mismatch; that closes the new surface at near-zero cost.

- **F10 [informational] The containment guarantee is one hop deep.** The gate validates the
  launcher; the launcher then executes whatever absolute path is recorded in
  `~/.mewkit/cli/<version>.json`, which is outside the project and outside the gate. This is what
  D3 and AC-05 decided (engine bytes are not kit content, and a fresh clone must be able to
  resolve a CLI), so it is in-contract — but it means a home-directory write gives an attacker
  hook-time execution in every project on the machine. Home-directory integrity is already a
  precondition for trusting a dev machine, so this is recorded as a boundary fact rather than a
  finding.

- **F11 [WARN] Decision D2(ii)(f) — "safety hooks MUST NOT resolve any executable through this
  PATH entry" — is prose with no test, and one gate path literally resolves a bare name.**
  Verified good: Gate 1 (`.claude/hooks/gate-enforcement.cjs`) spawns nothing; the Gate 2
  structural check (`.claude/hooks/lib/gate2-structural-checks.cjs:47`) spawns
  `process.execPath` with an explicit repo-relative validator path; the privacy/post-write scans
  spawn no CLI. The exception is `.claude/hooks/lib/memory-store-lint.cjs:45`, whose `resolveCli`
  falls back to the bare string `'mewkit'` for `spawnSync` — pre-existing, and harmless at the
  base because the bare name resolved to nothing and the lint degraded to SKIP. If the host
  propagates the env-file `PATH` to hook processes, that pre-ship guard would now resolve through
  the new entry. The direction of effect is fail-safe (a skipped lint becomes a real one, through
  the project's own pinned launcher), so this is not a weakening — but an invariant stated this
  firmly should be asserted, not reasoned about. AC-07's fail-safe direction *is* asserted: with
  the CLI unresolvable, Gate 1 still refuses the source edit with its existing exit code and
  marker.

No injection-shaped content was found in the reviewed diff. No `.env`, credential or key file was
read for this review.

## Coverage

Result: WARN

All 13 acceptance criteria are implemented, and I re-measured rather than accepted the ones that
could be measured here. AC-01, AC-02, AC-03, AC-04, AC-08, AC-09, AC-10, AC-11, AC-12 and AC-13
each hold on the finished tree by direct probe. Highlights of what I checked independently:

- **AC-09 published-package exclusion, which the evidence asserted but did not demonstrate:**
  `npm pack --dry-run -w packages/mewkit` lists 3698 files and **zero** paths containing
  `maintainer`. So `"files": ["dist", "!dist/maintainer", …]` does exclude the directory's
  contents — the `/**` suffix a reader might expect is not required here.
- **AC-09 shipped-kit prose:** all three agent-facing references to the moved verb are explicitly
  qualified as maintainer-only (`.claude/skills/benchmark/references/dead-weight-audit-rules.md:95`,
  `.claude/skills/context-audit/SKILL.md:47`,
  `.claude/schemas/harness-metadata-schema.json:84`), so the shipped kit does not instruct a
  downstream agent to run a script that exists only in this repository. That was the obvious way
  for this decision to go wrong and it did not.
- **AC-08:** `grep -rn "npx mewkit" .claude --exclude-dir=worktrees` → 0. No removed or moved verb
  survives as runnable in `.claude/`, either README, `scripts/`, `tests/`, `.github/`, or the docs
  site outside the two changelog pages.
- **AC-04:** the ADR (`docs/architecture/adr/261109-node-floor.md`) names the floor, the
  `node:sqlite` measurement, the rejected option *and why rejecting it is not merely convenient*,
  and the accepted cost. `core/node-floor.ts` is the single constant.
- **AC-11:** generated manual entry count (24) equals the catalogue command count (24), and
  `--check` passes.

Gaps, all of which are WARN in default mode:

1. **The AC-05/AC-06 install journey was measured on one path shape.** The path class F1 breaks on
   was never probed, and `runningCliEntry` — the function that breaks — has no test at all. This
   gap is the reason F1 shipped, and it is scored under Correctness rather than here.
2. **No test for a `PATH` entry or project directory carrying shell metacharacters** (F8). The
   properties that *are* tested are the six D2 properties, thoroughly: append-only with another
   hook's line intact, no literal `$PATH`, prepended, single-binary directory, idempotent when
   already first, and three distinct fail-closed branches.
3. **A per-session idempotence hole.** `exposeLauncherOnPath` decides "already first" from the
   *hook process's* own `PATH` (`.claude/hooks/lib/launcher-path-env.cjs:76-77`), which cannot
   contain the directory the env-file line adds, because that line is applied to Bash tool
   commands and not to the hook. So the guard only fires when the user added the directory
   manually, and if the host reuses one env file across sessions the file gains a line per
   session. Cheap hardening: also scan the env file for an identical existing line.
4. **F6 and F7** above are coverage weaknesses as much as maintainability ones.

No test was skipped, deleted, weakened or given a new normalizer anywhere in this change.

## Rulings on the six flagged items

1. **Golden-corpus edit — legitimate expectation update, not a weakened assertion.** Both fixtures
   keep a byte-exact `expect.stderr`; `expect.exit` (2) and `expect.marker` are untouched, and no
   normalizer or substring match was introduced. The only semantic change is the `npx ` prefix
   AC-08 removes. `tests/hooks/golden/gate1-plan-stale-hash.json` additionally re-encodes two
   characters as `—`/`⇒` escapes — identical JSON, cosmetic. Declining to re-record was
   the right call for the stated reason: the recorder replays the pre-port hooks at a fixed base
   and would have restored the old text. `golden-replay.test.ts` re-run here: 86 tests pass.
2. **`review --help` exit 1 → 0 — accept.** AC-03's *requirement* ("`<cmd> --help` prints the
   verb's help") is satisfied; the BASE *premise* it cited ("as it does at BASE") was false, since
   at BASE `review --help` ran the command and errored. Printing help instead of running something
   is strictly the better behaviour, and the discrepancy was recorded rather than engineered
   around, which is what the contract asks for when the tree and the spec disagree. No caller
   depends on it (`tests/cli-caller-exit-codes.test.ts` keeps that measured).
3. **Loss of an effective-config printout — real gap, acceptable, and the contract's reason for it
   is inaccurate.** D7 justifies removing `status` by saying its two jobs are "already served by
   `doctor` and by the `versions` verb". `doctor` reports the config file's *path, validity and
   key count* (`commands/doctor-config-checks.ts:54`), never the key/value pairs, and `versions`
   reports versions — so after this change no CLI surface prints the settings in force. The
   removal itself stands: the verb had zero kit references, printed `[object Object]`, and D7 is a
   decided point under the user's standing directive. `cat .meowkit/config.yaml` is the substitute,
   and the file is small and human-readable. Recorded so the capability loss is on the record
   rather than hidden inside a justification that does not quite hold. If it is ever missed, the
   natural home is a `doctor` line, not a restored verb.
4. **Containment is not weakened; the gates do not depend on the new PATH entry.** See F9, F10 and
   F11 for the full reasoning, including the one bare-name resolution that exists in a pre-ship
   guard and why its direction of effect is fail-safe.
5. **CI works.** Both relocated verbs are invoked from jobs that already build
   `packages/mewkit/dist` before the step (the same precondition the previous `dist/index.js`
   invocations had), and the two scripts fail with a clear "dist is not built" message rather than
   a stack trace if that ever changes. I ran all four CI-invoked checks in this tree: all exit 0.
   The npm exclusion is demonstrated in Coverage above.
6. **`launcherPresent` has no production caller — confirmed.** See F4.

## Required changes

- [ ] **F1** — `packages/mewkit/src/core/project-launcher.ts:129`: replace
  `new URL(moduleUrl).pathname` with `fileURLToPath(moduleUrl)` (the API the rest of this package
  already uses), and add one case to `core/__tests__/project-launcher.test.ts` that resolves an
  entry through a directory whose name contains a space, so the regression cannot return silently.

Nothing else blocks. Re-run `npm run build`, the launcher tests and the install suite after the
fix; no other dimension needs re-review.

## Suggestions (non-blocking)

- **F2** — count commands and aliases separately in `scripts/check-kit-verbs.cjs`, and stop
  folding flag aliases into the verb set, so `mewkit h` cannot resolve.
- **F8** — escape or reject shell metacharacters in the `PATH` value before appending, and add the
  case to `tests/hooks/launcher-path-env.test.ts`.
- **F9** — verify the launcher's bytes against `launcherSource(version)` before the SessionStart
  handler executes it.
- **F11** — assert that no gate hook resolves its executable by bare name.
- **F4** — give `launcherPresent` a caller in `doctor` or delete it.
- **F6** — make the changelog-immutability test assert immutability.
- **F7** — extend the exit-code-caller regex to the POSIX `[ "$?" = "1" ]` shape.
- **F5** — state, once, whether the per-command unknown-subcommand branches are retained as
  defence-in-depth for programmatic callers.
- **Coverage gap 3** — detect an already-written PATH line by reading the env file, not the hook's
  own environment.
- Operational note, not a defect: this repository has no `.meowkit/bin/mewkit` (an install writes
  it, and D11 rightly forbids running `init` here), so sessions in *this* repo print the doctor
  hint and the labelled checkpoint fallback. Confirmed by running the handler. Expected, and
  distinct from the fresh-init behaviour AC-06 governs.

## WARN acknowledgements

Each WARN carries the three parts the review contract requires.

**Maintainability — WARN.** *What it means:* four small, localised quality items — one dead export,
one undocumented dead branch set, and two tests that assert less than their names promise. *Why
acceptable here:* none changes runtime behaviour, none is in the gate or launcher path, two are
pre-existing code the approved scope does not cover, and the properties the weak tests are named
for were independently confirmed to hold. *What would make it a stop:* a weak assertion standing
in for an acceptance criterion with no other evidence, or dead code inside a trust boundary.

**Security — WARN.** *What it means:* the kit writes an unescaped shell assignment into a
host-evaluated file (F8), and one firmly stated trust invariant is carried by prose rather than by
a test (F11). *Why acceptable here:* F8's only realistic input channel is the project directory's
own name, so it is not reachable from repository content or any remote attacker in the normal
case, and the broken-quoting outcome is a failed PATH rather than a privilege gain; F11's one
contradicting code path pre-dates this change and moves a safety check from skipped to performed,
which is the safe direction. *What would make it a stop:* an injection channel reachable from
repository content, tool output or network data; a gate or privacy hook whose *decision* depends
on the PATH entry; or any evidence that a hook process does resolve `mewkit` through it in a way
that could relax a block.

**Coverage — WARN.** *What it means:* the journeys that prove AC-05 and AC-06 were measured on a
single path shape, `runningCliEntry` is untested, and three narrower guards are thinner than the
invariants they are named for. *Why acceptable here:* this is default mode, where coverage gaps are
WARN by policy; the 13 criteria are otherwise covered by 49 new tests plus the full suite, and
every claim I could re-measure here held. *What would make it a stop:* a criterion with no test
and no reproducible evidence, a deleted or weakened existing test, or a skipped test introduced by
this change — none of which is present.

## Gate 2 decision — pending human approval
