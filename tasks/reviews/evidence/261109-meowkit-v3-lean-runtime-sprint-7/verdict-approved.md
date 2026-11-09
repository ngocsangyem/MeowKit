# Review: MeowKit v3 lean runtime — CLI surface (sprint 7)

- **Reviewed base:** `be3e990b` ("contract: evaluator signs sprint 7 …"), branch `feat/v3-lean-runtime`
- **Reviewed change:** working tree vs `be3e990b` — `git diff HEAD` plus untracked files, excluding `tasks/plans/` (never committed)
- **Spec graded against:** `tasks/contracts/261109-1021-meowkit-v3-lean-runtime-sprint-7.md` (signed, 13 acceptance criteria)
- **Review round:** 2. Round 1 returned a blocking Correctness result on one reproduced defect plus five cheap items; all six are fixed. Round 1's verdict is archived verbatim at `tasks/reviews/evidence/261109-meowkit-v3-lean-runtime-sprint-7/review-round-1.md`.
- **Mode:** default (TDD off) — coverage gaps are WARN
- **Score:** 9.0/10

## Verdict: WARN

Every round-1 item is fixed, and I reproduced the two that mattered rather than accepting the
report: the file-URL decoding defect and the shell-quoting defect were each re-triggered on the
old expression and then shown closed on the new one. The change now satisfies all 13 acceptance
criteria on measurement. What remains is three carried-forward hardening suggestions the contract
never asked for, one pre-existing dead-branch question, and three small items I found this round —
one of which is a measurable miss against an AC-13 clause introduced by the fix itself. None
blocks; all are named below for explicit acknowledgement.

| Dimension | Round 1 | Now |
| --- | --- | --- |
| Correctness | blocking | PASS |
| Maintainability | WARN | WARN |
| Performance | PASS | PASS |
| Security | WARN | WARN |
| Coverage | WARN | PASS |

Side Effects Detected: No

## Fix verification — each reproduced, not accepted

**F1 — `runningCliEntry` decoded a file URL with `new URL().pathname`. Fixed and reproduced.**

`packages/mewkit/src/core/project-launcher.ts:140` now uses `fileURLToPath(moduleUrl)`; the
`fileURLToPath` import is present at `:18` and the comment at `:131-138` states the invariant
rather than citing the review. I ran the old and new expressions side by side on three real
`dist/` layouts:

```
"dir with space"   old=ENOENT  new=ok:dir with space/dist/index.js
"josé münchen"     old=ENOENT  new=ok:josé münchen/dist/index.js
"plain"            old=ok      new=ok
```

Then end-to-end through the **real built artifact** copied under a path named `josé dir e2e`:
`runningCliEntry` returned the correct absolute entry, and `writeLauncher` wrote
`…/proj/.meowkit/bin/mewkit`, which then resolved and spawned the recorded entry. (My harness
copied `dist` without `node_modules`, so the spawned CLI failed on its own `minimist` import —
that is a property of my copy, not of the code, and it proves resolution reached the CLI.) The
four new cases in `core/__tests__/project-launcher.test.ts` (6 → 10) include the space, the
non-ASCII name, a plain control, and a module URL with no entry beside it. Confirmed the `dist/`
I probed is current: `fileURLToPath` appears in `packages/mewkit/dist/core/project-launcher.js`.

**F8 — the env-file write was an unescaped double-quoted shell assignment. Fixed, and the
vulnerability reproduced before and after.**

`.claude/hooks/lib/launcher-path-env.cjs:72-74` adds `singleQuote()` (the standard
close-reopen form, `'` → `'\''`), `:99` refuses any value containing `\n`, `\r` or NUL, and
`:102` writes `export PATH=<single-quoted>`. I built a project directory literally named
``ev$(touch PWNED)il `touch PWNED2` "q" dir``, generated both the fixed line and the round-1
line, sourced each in a real `/bin/sh`, and read back `$PATH`:

| code path | first `$PATH` entry equals launcher dir | command substitution executed |
| --- | --- | --- |
| fixed (single-quoted) | yes, byte for byte | no |
| round-1 (double-quoted) | no — entry mangled to `evil  q dir/…` | yes — both `PWNED` and `PWNED2` created |

So the round-1 finding was real and is now closed. Also verified independently: a directory named
`it's a dir` survives a real shell byte-for-byte; a `PATH` entry containing a newline returns the
doctor hint and writes **nothing**; a literal `$HOME` inside an entry stays literal; and the
pre-existing unrelated line in the env file is untouched in every case. The test file grew 11 → 14
cases and now evaluates its assertions through `/bin/sh` rather than only pattern-matching the
written text — a stronger property than the one it replaced.

**F2 — flag aliases were folded into the verb set. Fixed and reproduced.**
`scripts/check-kit-verbs.cjs` no longer adds `CLI_CATALOGUE.aliases`; the comment at `:102`
records why. The printed count now matches reality — `PASS: 281 mewkit reference(s) … resolving
against 24 commands`, against a catalogue of 24 commands and a generated manual of 24 entries. I
confirmed the teeth myself in a scratch kit copy: `mewkit h`, `mewkit y` and `mewkit status` are
each reported as unresolved commands and `mewkit plan capture` as an unresolved subcommand (exit
1, 4 findings), while the flag-shaped control `mewkit trace --friction "x"` is correctly not
reported.

**F4 — dead `launcherPresent` removed.** `grep -rn launcherPresent` over `packages`, `scripts`,
`tests` and `.claude` returns nothing, and the `statSync` import it was the only user of is gone
from the import list at `project-launcher.ts:15`. Choosing removal over wiring it into `doctor`
was the right half of the either/or: the alternative was new behaviour the contract does not ask
for.

**F6 — the changelog test now asserts immutability.** `tests/docs-cli-resolution.test.ts:153-168`
byte-compares both changelog pages against `git show be3e990b:<path>` instead of calling
`existsSync`, with a sibling case at `:143` proving the comparison would notice an appended line.
5 → 6 cases.

**F7 — the exit-code-caller guard is widened and bounded.**
`tests/cli-caller-exit-codes.test.ts:36-44` now covers the reversed JS order and both POSIX
shapes alongside the originals, and the new case at `:64` asserts six offender strings all match
**and** five legitimate strings (`!== 0`, `=== 0`, `-ne 0`, `toBe(2)`, `const retries = 1`) do
not — so the widening cannot have been achieved by making the guard fire on a clean tree. The
property still holds: zero offenders across the five committed trees.

**Control characters — confirmed clean.** I scanned all **96** changed and untracked files byte
by byte: zero control characters other than TAB and LF, and no CR anywhere. The two literal `0x08`
bytes the developer reported in `tests/cli-caller-exit-codes.test.ts` are gone. Their note is
worth keeping as a lesson: the corrupted regex still compiled and the file still passed, so a
green test was not evidence the bytes were what the author intended.

## Correctness

Result — PASS

No critical or major defect remains. The blocking defect is fixed at the root with the API the
rest of the package already uses, and the fix is covered by four tests including the exact path
class that broke.

- **F3 [MINOR, carried, accepted cost]** — in the `npx` case the pin records a path under
  `~/.npm/_npx/<hash>/…`, which npm prunes on its own schedule, so the launcher's resolution is
  only as durable as that cache. The degradation is the labelled doctor-hint branch D3 chose, and
  it is fail-safe. Unchanged by the fixes and outside the contract; recorded so the expectation
  stays accurate rather than optimistic.

Re-verified after the fixes, by direct probe rather than from the evidence file: the exit-code
invariant holds unchanged (`status`, `inventory`, `docs-manifest`, `context resolve`,
`explain-support`, `h`, `y` → 2; `plan bogus` → 2 naming the valid subcommands; bare `plan` → 2
"needs a subcommand"); the bare forms that must not change still do not (`backups`, `task-state`,
`trace` → 0); per-subcommand help still exits 0 printing catalogue usage with a byte-empty working
directory before and after the whole sweep; and `doctor --hard-gates` exits 0 in the repository
with the retired `MEOWKIT_*` names unset (26 passed, 5 warnings).

## Maintainability

Result — WARN

Three of the four round-1 items are closed and the fourth is a question rather than a defect. Three
new items, all minor, two of them introduced by the fix round.

- **F13 [MINOR, new — a measurable AC-13 clause miss] `tests/hooks/launcher-path-env.test.ts` is
  now 224 lines, over the 200-line limit.** AC-13 requires that no new file exceed 200 lines, with
  only the generated manual exempt (`.claude/skills/help/references/cli.md`, 514). The file was 163
  lines at round 1 and grew 61 lines from the three F8 cases. I measured every new file: this is
  the only non-exempt one over the limit, and no *changed* file crossed 200 because of this sprint
  (`scripts/check-kit-verbs.cjs` 114 → 182, `orientation-ritual.cjs` 113 → 152, and the seven files
  already over 200 at the base grew only as previously recorded). The evidence's "Review fixes"
  section does not re-measure line counts, which is how this got through. Not blocking, and the
  project's own rule says the limit is a maintainability guard rather than a licence for mechanical
  splitting — but the file does have a natural seam: it is already two `describe` blocks, the
  library's six properties and the handler integration, and moving the second to its own file would
  reduce it without inventing indirection. Dropping a shell-evaluated injection test to get under
  the number would be strictly worse, so if the human prefers the overshoot, that is a reasonable
  call to make explicitly rather than silently.
- **F12 [MINOR, new] `core/__tests__/project-launcher.test.ts` writes into the developer's real
  home directory.** `writeLauncher` calls `recordCliEntry`, which resolves
  `path.join(homedir(), ".mewkit", "cli", …)` at `project-launcher.ts:30-31` with no injectable
  seam, so the four `writeLauncher` calls in the test leave real files outside any temp directory.
  Observed on this host: `~/.mewkit/cli/9.9.9-test.json`, whose `entry` names a `$TMPDIR` path that
  no longer exists. Harm is low — the launcher's `usableFile` check rejects a stale entry, so it
  degrades to the doctor hint — but the tests are not hermetic, which is a flake and
  cross-contamination risk, and it sits against the spirit of D11 (journeys assert inside a
  throwaway directory). Cheap fix: give `recordCliEntry` an optional store root, or read one from
  the environment. The read side needs no change, since the generated launcher inlines its own
  reader. I removed the one record my own verification wrote (`9.9.9-review.json`) and left the
  others, since deleting another run's residue is not mine to do.
- **F14 [MINOR, new] F6's fix pins a literal commit SHA.**
  `tests/docs-cli-resolution.test.ts:33` hardcodes `REVIEWED_REVISION = "be3e990b"`. That is
  correct today and is what makes the assertion meaningful, but it errors rather than fails
  informatively once the commit becomes unreachable — a squash, rebase or amended history would do
  it. Pinning to the merge-base against the default branch, or to the base branch tip, keeps the
  same property without the expiry.
- **F5 [MINOR, carried] six per-command unknown-subcommand branches are now unreachable** for the
  case they were written for, because `classifyInvocation` intercepts first (`index.ts:194`,
  `commands/capabilities.ts:102`, `commands/task-state.ts:237`, `commands/backups.ts:110`,
  `commands/pack.ts:83`, `commands/advice.ts:563`). Still six, still pre-existing, still outside
  the approved scope. One sentence saying whether they are defence-in-depth for programmatic
  callers would stop the next reader re-deciding.

Hygiene re-checked on the updated diff, excluding my own review prose from the scan: no `any`, no
`as any`, no `as unknown as`, no `@ts-ignore`, no new TODO or FIXME, no commented-out code, and no
code comment, test name, file name or script name referencing a plan artifact. Build, typecheck and
lint all exit 0, with the same three pre-existing unused-symbol warnings in `commands/capabilities.ts`,
`commands/orient.ts` and `commands/validate.ts:447` and zero errors.

## Performance

Result — PASS

Nothing in the fixes touches a hot path. `singleQuote` adds one `split`/`join` over a string of
PATH length and the control-character guard one regex test, both once per SessionStart.
`fileURLToPath` is cheaper than constructing a `URL`. The widened exit-code regex and the
byte-compare changelog assertion run only in tests. The two observations carried from round 1
stand and remain immaterial: the orientation handler evaluates `containedLauncher(ROOT)` eagerly
even when the descriptor already resolved (one extra realpath pair per session), and dispatch adds
one `find` over 24 commands plus one `includes` over at most ten sub-verbs before the switch.

## Security

Result — WARN

The one real defect is closed, demonstrated above with a shell that executed the payload on the
old code and treated it as data on the new. Blocked-pattern scan over the updated diff is clean:
no hardcoded secret or key material, no `any` or unsafe cast, no `eval`, no `shell: true`, no
string-interpolated SQL, no `localStorage`, no disabled certificate validation. Both process
spawns still pass an argv array and never a shell string. What remains are the three
trust-boundary items recorded in round 1, all unchanged and all still non-blocking.

- **F9 [informational, carried] the launcher is executed on sight, with no check of its bytes.**
  `containedLauncher` applies the same realpath-both-sides containment rule as the descriptor gate
  to a fixed project-relative path, so it grants no reach the descriptor path would not have, and
  the symlink-escape case is tested. Confirmed still true: nothing in
  `.claude/hooks/lib/launcher-path-env.cjs` or `.claude/hooks/handlers/orientation-ritual.cjs`
  compares the launcher against `launcherSource(version)`. The delta from the base remains that a
  committed `.meowkit/bin/mewkit` now suffices on its own, and that file is *expected* to be
  committed, so it is a less conspicuous place for a hostile change to sit. The CLI generates that
  text deterministically, so comparing it before execution is close to free.
- **F10 [informational, carried] containment is one hop deep.** The gate validates the launcher;
  the launcher then executes whatever absolute path `~/.mewkit/cli/<version>.json` names, outside
  the project and outside the gate. In-contract per D3 and AC-05 (engine bytes are not kit content,
  and a fresh clone must be able to resolve a CLI), and home-directory integrity is already a
  precondition for trusting a dev machine. Recorded as a boundary fact. F12 above is the same
  directory being written by the test suite, which is why the two are worth reading together.
- **F11 [WARN, carried] decision D2(ii)(f) is prose with no test, and one path contradicts it
  literally.** Re-confirmed: Gate 1 (`.claude/hooks/gate-enforcement.cjs`) spawns nothing, the
  Gate 2 structural check spawns `process.execPath` with an explicit repo-relative validator path,
  and the privacy and post-write scans spawn no CLI — so no gate decision depends on the PATH
  entry. The exception is still `.claude/hooks/lib/memory-store-lint.cjs:45`, whose `resolveCli`
  returns the bare string `'mewkit'` as its last resort. Pre-existing, and the direction of effect
  is safe (a skipped lint becomes a real one, through the project's own pinned launcher), but an
  invariant stated this firmly should be asserted rather than reasoned about.

## Coverage

Result — PASS

All 13 acceptance criteria are implemented and tested, and the round-1 coverage gaps that mattered
are closed by tests rather than by argument: the path class F1 broke on now has four cases
including a non-ASCII directory, the metacharacter case F8 needed now has three including a real
shell evaluation, and the two guards that asserted less than their names promised (F6, F7) now
assert the stated property with negative controls.

Full suite on Node 24: **294 files / 3375 tests passed, 0 skipped**, exit 0 — nine more tests than
round 1's 3366, matching the nine cases the six fixes added. The `FAIL:` strings in the suite
output are the intentional negative-control output of checks proving they have teeth, not
failures. No test was skipped, deleted or weakened; the three retargeted assertions each assert
the same or a stronger property.

Every validator and committed check re-run here, all exit 0: `validate` with `--packs`,
`--frontmatter`, `--docs-refs`, `--gates`, `--memory`, `--substrate`, `--plugin`, `--agents`,
`--workflow`, `--ownership`, `--parity`; `check-kit-verbs`, `check-env-reads`,
`check-dangling-rule-refs`, `check-memory-wiki-residue`, `check-always-on-budget`,
`check-rule-survival`, `check-no-python --allow-existing-envs`, `terminology-linter`,
`generate-cli-manual --check`, `docs-manifest.cjs --check`, `harness-inventory.cjs --check`,
`codex-compat-check.mjs`, and `doctor --hard-gates` with the retired environment names unset.

- **Coverage gap 3 [MINOR, carried]** — `exposeLauncherOnPath` still decides "already first" from
  the *hook process's* own `PATH` (`.claude/hooks/lib/launcher-path-env.cjs:91-92`), which cannot
  contain the directory the env-file line adds, because that line is applied to Bash tool commands
  and not to the hook. So the guard only fires when the user added the directory by hand, and if
  the host reuses one env file across sessions the file gains a line per session. Reading the env
  file for an identical existing line would close it. A hardening suggestion, not an AC gap.
- F12 and F14 above are test-hygiene items as much as maintainability ones.

## Required changes

None. Nothing in this round blocks.

## Suggestions (non-blocking, in the order I would do them)

- **F13** — split the handler-integration `describe` out of
  `tests/hooks/launcher-path-env.test.ts` to bring it back under 200 lines, or record an explicit
  decision to accept 224 for a test file.
- **F12** — give `recordCliEntry` an injectable store root so the launcher tests stop writing into
  the real `$HOME`.
- **F14** — resolve `REVIEWED_REVISION` from the merge-base rather than hardcoding a SHA.
- **F11** — assert that no gate hook resolves its executable by bare name.
- **F9** — compare the launcher's bytes against `launcherSource(version)` before the SessionStart
  handler executes it.
- **Coverage gap 3** — detect an already-written PATH line by reading the env file.
- **F5** — state once whether the per-command unknown-subcommand branches are retained
  deliberately.
- **F3 / F10** — no action proposed; recorded so the pin's durability and the one-hop containment
  boundary are known rather than assumed.
- Operational note, unchanged and not a defect: this repository has no `.meowkit/bin/mewkit` (an
  install writes it, and D11 rightly forbids running `init` here), so sessions in *this* repo print
  the doctor hint and the labelled checkpoint fallback. Distinct from the fresh-init behaviour
  AC-06 governs.

## WARN acknowledgements

**Maintainability — WARN.** *What it means:* one new test file overshoots the 200-line limit AC-13
sets (224), the launcher tests write into the real home directory, one new assertion pins a literal
commit SHA that will expire, and six pre-existing unknown-subcommand branches are undocumented as
to intent. *Why acceptable here:* none changes runtime behaviour or sits inside a trust boundary;
the line overshoot is 12% in a test file and was caused by a security test this review asked for,
where the project's own rule warns against mechanical splitting; the home-directory writes degrade
safely because the launcher validates the entry it reads; and the SHA pin is correct today and is
what gives the assertion its meaning. *What would make it a stop:* a line-limit miss in shipped
source rather than a test, a non-hermetic test that can change another test's result, or an
assertion that is already unreliable rather than merely perishable.

**Security — WARN.** *What it means:* the launcher is executed on sight without a byte check (F9),
the containment guarantee stops at the launcher rather than at what it runs (F10), and the "no
safety hook resolves through this PATH entry" invariant is prose with one literal counter-example
(F11). *Why acceptable here:* the injection channel found in round 1 is closed and demonstrated
closed against a real shell; F9 grants no reach the previous descriptor path did not already grant;
F10 is a decided, recorded consequence of D3 whose precondition (home-directory integrity) is
already required to trust the machine; and F11's one contradicting path pre-dates this change and
moves a check from skipped to performed, which is the safe direction. *What would make it a stop:*
an injection channel reachable from repository content, tool output or network data; a gate or
privacy hook whose *decision* depends on the PATH entry; or evidence that a hook process resolves
`mewkit` through it in a way that could relax a block.

## Post-review changes (orchestrator)

- **F13 closed:** the PATH-line suite is split into `tests/hooks/launcher-path-env-library.test.ts` (157) and
  `tests/hooks/launcher-path-env-handler.test.ts` (52) with shared builders in `tests/hooks/lib/launcher-path-fixtures.ts`;
  14 cases before and after.
- **F12 closed:** `recordCliEntry`/`writeLauncher` take an optional store home (production default unchanged);
  the launcher tests use a temporary store, and a new case exercises the machine-record branch. The stray
  `~/.mewkit/cli/9.9.9-test.json` was removed.
- **F14 closed:** the changelog comparison base is resolved from the merge base with `main`, not a literal SHA.
- Two files these fixes pushed past 200 lines were split at real seams (`project-launcher-module-url.test.ts`,
  `docs-changelog-immutability.test.ts`). Orchestrator re-ran the six affected suites on Node 24: 33/33 pass;
  developer full run 297 files / 3378 tests passed.

## Gate 2 decision — CLI surface, project launcher and strict dispatch

Human approval, typed by the owner in response to the Gate 2 prompt for this review:

> "Approve, ack WARNs"

- **Maintainability WARN** acknowledged: unreachable per-command unknown-subcommand branches (F5); the
  npx-install launcher pin lasts only as long as npm's cache (F3); no verb prints effective config values
  after `status` was removed. F12, F13, F14 closed before commit (see "Post-review changes").
- **Security WARN** acknowledged: the committed launcher's bytes are not compared against the generated
  source before a hook runs it (F9); containment is one hop deep (F10); `memory-store-lint.cjs` still
  resolves bare `mewkit`, fail-safe and not gate-deciding (F11). F8 closed before commit.
- `review --help` now prints help and exits 0 (previously ran the command and exited 1): accepted.
