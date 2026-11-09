# Review: MeowKit v3 lean runtime — kit shape and removals (sprint 8)

- **Reviewed base:** `d17cc03b` ("contract: evaluator signs sprint 8 …"), branch `feat/v3-lean-runtime`
- **Reviewed change:** working tree vs `d17cc03b` — `git diff HEAD` plus untracked files, excluding `tasks/plans/` (never committed). 539 tracked files changed (+3552/−4661), 16 untracked.
- **Spec graded against:** `tasks/contracts/261109-1402-meowkit-v3-lean-runtime-sprint-8.md` (signed, 11 acceptance criteria). The metadata budget (D7), the integration rewrite and routing specs (D10, D11) and the SubagentStart spike (D13) are deferred to sprint 9 by D15 and are **not graded here**.
- **Review round:** 1. Sprint 7's approved verdict is archived verbatim at `tasks/reviews/evidence/261109-meowkit-v3-lean-runtime-sprint-7/verdict-approved.md`.
- **Mode:** default (TDD off) — coverage gaps are WARN
- **Score:** 7.5/10

## Verdict: FAIL

The sprint's shape work is real and it measures out. The shipped kit is down to **six** `.claude/`
top-level entries against a ceiling of eight, **1155** files against 1228 at BASE; `commands/`,
`modes/`, `rubrics/`, `rules-conditional/`, `schemas/`, `scripts/`, `workflow.yaml`,
`capability-bootstrap.md`, `benchmarks/`, `harness-substrate.md` and `agent-memory/` are all absent
from the ship set and from `base.files`/`base.globs`/`base.commands`; `tasks/` is no longer an archive
root and a fresh install produces a project root holding only `.claude/` and `.meowkit/`. Both gates
behave identically with no `tasks/` directory at all, byte-for-byte. The full suite is green (298
files / 3372 tests), lint has 0 errors, typecheck passes, and the always-on rules subtotal came
*down* to 25 417 B — 183 bytes of headroom where the contract only required the 99 bytes be held.

One reproduced defect blocks. A **shipped** kit file — the mandatory `--tdd` instruction at
`.claude/skills/cook/SKILL.md:83` — still runs `mkdir -p .claude/session-state` while redirecting into
`.meowkit/state/tdd-mode`. The path rewrite changed the redirect target and left the `mkdir` behind.
On a fresh install the command exits **1**, the TDD sentinel is **never written**, and it leaves
behind `.claude/session-state/` — the precise project-root pollution AC-08 exists to remove. That is
a binary counter-example to AC-08's central clause, and a functional break of `--tdd`. The fix is one
line in one shipped file (plus its maintainer canary copy); nothing else in the change needs to move.

| Dimension | Result |
| --- | --- |
| Correctness | FAIL |
| Maintainability | WARN |
| Performance | PASS |
| Security | WARN |
| Coverage | WARN |

Side Effects Detected: No — this review wrote only this verdict and the sprint-7 archive copy. (R1's
stray directory write is a defect in the reviewed change, reported below; it is not a side effect of
the review, and it needs a developer fix rather than a user decision.)

## Gate-authority standing item (`gate-rules.md:67-73`)

This change touches `.claude/rules/`, `.claude/agents/` and
`.claude/skills/{advise,agent-detector,autobuild,cook,fix}/`, so the standing question is in scope.

> **Does any prose in this change grant approval authority to something that is not a human — in any wording?**

**No.** Answered by reading, not by lint. I swept every added prose line across `.claude/rules/`,
`.claude/agents/` and the five named skills for intent rather than phrase — auto-approval,
self-approval, "proceeds when the score is …", "runs unattended through ship", automation deciding
whether to advance past a gate. Zero matches. `validate --gates` independently reports
`[PASS] No automated gate-approval claims`, and I treated that as a floor rather than an answer.

Two gate-adjacent prose edits were checked individually and both preserve authority:

- `gate-rules.md`'s reviewer path list moved from `.claude/rules/, rules-conditional/, modes/, agents/, skills/{cook,fix,autobuild}` to `.claude/rules/, agents/, skills/{advise,agent-detector,autobuild,cook,fix}/`. AC-03 requires the new list to reach every directory the old paths' content moved to. It does: `rules-conditional/` content landed in `skills/advise/references/` and `skills/agent-detector/references/`, and both are now named; `modes/` was deleted outright, so it had no content to carry. Reach is preserved, and `checkGateAuthority` scans the whole `.claude` tree regardless (`check-gate-authority.ts:385`).
- `security-rules.md:26`'s Enforcement clause had `/mk:audit` rewritten to `/mk:cso`. The disposition — WARN, document it in the verdict, do not auto-fix — is textually unchanged, and `/mk:audit` was a documented wrapper over `mk:review` + `mk:cso`, so the clause now names the underlying skill. Meaning intact.

## Correctness — FAIL

**R1 — BLOCKING. A shipped kit instruction recreates `.claude/session-state/` and fails to write the TDD sentinel.** `.claude/skills/cook/SKILL.md:83` (in the ship set):

```bash
mkdir -p .claude/session-state && echo on > .meowkit/state/tdd-mode
```

At BASE both halves agreed (`mkdir -p .claude/session-state && echo on > .claude/session-state/tdd-mode`).
The rewrite changed only the redirect, so the `mkdir` now creates the wrong directory and
`.meowkit/state/` is never created. Reproduced in a scratch project containing only `.meowkit/`:

```
$ bash -c 'mkdir -p .claude/session-state && echo on > .meowkit/state/tdd-mode'
bash: .meowkit/state/tdd-mode: No such file or directory
EXIT=1
$ find . -mindepth 1
./.claude
./.claude/session-state     <-- the pollution AC-08 removes
./.meowkit
```

Two distinct failures from one line:

1. **AC-08 violated as written.** Its Then-clause is "**no** path under the project root named `session-state` is created". The kit's own mandatory instruction creates one on every `--tdd` invocation, in a *shipped* file. On an established project where `.meowkit/state/` already exists the redirect succeeds and the only symptom is the stray directory — which is still a zero-residue violation, just a quieter one.
2. **`--tdd` breaks on a fresh install.** The sentinel is how strict mode is armed; `pre-implement.cjs` and `tdd-detect.cjs` read it. With the write failing, a user who asked for `--tdd` gets default mode, and the RED-phase gate never engages. The Bash call does surface exit 1, so this is loud rather than silent — but the feature does not work.

**Fix:** `mkdir -p .meowkit/state && echo on > .meowkit/state/tdd-mode`. The same line needs the same
fix at `.claude/benchmarks/canary/quick/05-tdd-feature-spec.md:17` (maintainer-only, excluded from the
ship set, so lower severity but the same bug). `.claude/skills/plan-creator/assets/bead-template.md:40`
still says `session-state/build-progress.json` in prose — that text was already stale at BASE, so it is
record-only, not part of this fix.

**Reproduction:** `mkdir -p /tmp/t/.meowkit && cd /tmp/t && bash -c 'mkdir -p .claude/session-state && echo on > .meowkit/state/tdd-mode'; echo $?; find . -mindepth 1`

### Correctness items that measured clean

Everything below I measured myself or had re-measured independently rather than reading from the
evidence record:

- **AC-01.** Ship set computed from the one source: **1155** files, `.claude/` top level is exactly `{agents, hooks, rules, skills, settings.json, statusline.cjs}` — six, two under the ceiling. All eleven departing entries absent from the ship set *and* from `base.files`/`base.globs`/`base.commands`; `base.commands` is gone as a key. `validate --packs` green, no second ship-set list or archive matcher added.
- **AC-02.** `.claude/commands/` absent from repo and ship set (the two surviving `commands` dirs are test fixtures that do not ship). All 27 commands dispositioned, one disposition each, no double answers; exactly **4** promotions (`arch`, `breakdown`, `delegate`, `status`), at the cap, and each promoted SKILL.md carries real procedure (104/85/128/116 lines) rather than a delegation line. The three `SAFETY_PATHS` command entries were **renamed, not dropped** — same list length, all 15 literals resolve in the ship set (`check-packs.ts:60-62`). `pairedCommands` and `GOVERNED_DISPATCHERS` are gone from `packages/`, `scripts/` and `.claude/`, removed with their subject. `check-skill-cross-refs.sh` lost its command branch and still has teeth: a planted `/mk:nonexistent-xyz` in a scratch copy produces `PHANTOM: … (no skill dir)` and exit 1.
- **AC-03.** `.claude/modes/` absent, **no** `.claude/output-styles/` created, all eight naming places updated with a named owner. `validate --gates` green; see the standing item above for the reviewer-path-list reach check.
- **AC-04 (moves).** All four relocations exist at exactly one new path with no copy left behind (git shows renames): `rubrics/`→`skills/rubric/rubrics/` (14 files), the two advice rules→`skills/advise/references/`, the three agile rules→`skills/agent-detector/references/`, `workflow.yaml`→`skills/workflow-orchestrator/`, `capability-bootstrap.md`→`hooks/references/`. Readers verified by **running** them: `validate --workflow` green with 6 passed and "No drift"; `validate --frontmatter` green; both capability-bootstrap golden cases pass inside 87/87; `validate-rubric.sh` reports 11 rubrics valid. The canonical pointer was shortened to `<!-- Canonical source: workflow.yaml -->` and matches `check-workflow-drift.ts`'s `canonicalPointer` constant exactly in both always-on rules — and the rules subtotal came down rather than spending headroom.
- **AC-05.** All five maintainer artifacts absent from the ship set. `skill-schema.json` has exactly **one** copy, at `packages/mewkit/schemas/`, read via `fileURLToPath(new URL("../../schemas/…"))` from both `src/` and `dist/`; `npm pack --dry-run` confirms `schemas/` ships with the package, so the install-time fatal is genuinely gone (verified by validating a materialised install that has no `.claude/schemas`). Every shipped skill's own data resolves in the ship set — 699 references checked across 128 shipped SKILL.md files, the only two misses pre-existing at BASE (`preview/SKILL.md:161`). `dead-weight-audit-rules` is marked `shipped: false`.
- **AC-06.** `.claude/scripts/` and `.claude/scripts/bin/` no longer exist; the Node-only-executable property holds over all three named trees by **shebang**, not extension — zero `.py`/`.sh` and zero non-`node` shebangs under `.claude/hooks/`. The 4 zero-caller scripts are gone. `check-no-python.cjs` passes all 26 checks with no interpreter on PATH (the exit-2 I first saw is its `.meowkit/envs/` precondition, identical at BASE — a property of this machine, cleared with `--allow-existing-envs`).
- **AC-07.** `tasks/` is not in `ARCHIVE_TARGETS`, 0 `tasks/` files ship, `reinstall-empty-dirs` has 0 hits in `packages/mewkit/src`. All five templates and the workflow README located **by name** at exactly one new path each, all in the ship set; `grep -rn "tasks/templates" .claude` returns 0. Gate parity is exact: no `tasks/` at all and an empty `tasks/plans/` both give exit 2 with the same `@@GATE_BLOCK@@` and byte-identical stderr; Gate 2 fails closed at exit 2 for the missing-verdict case. Zero stack frames across every probe.
- **AC-08 (apart from R1).** Only three `session-state` survivors under `.claude/hooks/`, all legitimate: a comment, `LEGACY_STATE_RELS` (read-fallback, no writer), and the `gate2-check.cjs:70` message text. No second state resolver. A driven session landed every write under `.meowkit/state/` and `.meowkit/telemetry/`; no `session-state` path and no `.claude/cache/` appeared. `.claude/skills/.venv` absent, envs under `.meowkit/envs/`.
- **AC-09.** The two changelog pages are byte-unchanged (`git diff … -- …/changelog` is empty). `validate --docs-refs` and `link-checker.cjs` (268 files) both green. Of 1298 extracted `.claude/` paths in live docs, only **3** unresolved paths existed at BASE, and all three are deliberate (a vendored host-docs page, a "wrong path" column, a dated ADR). The generated CLI manual regenerates to a no-op (`generate-cli-manual --check` PASS) and names no removed command or path. `README.md:9`'s banner and its tree listing match the finished inventory, and `RELEASING.md`'s `modes/*` row is gone.
- **AC-10.** All five safety rules still files under `.claude/rules/`; `check-rule-survival.cjs` reports 61 pinned items OK. The new needle for the Enforcement clause is real and probed: on a scratch copy, deleting the clause gives exit 1 with `MISSING: security-rules Enforcement clause …`, and weakening "do not auto-fix" to "auto-fix it" also fails, while an entrypoint rename alone correctly does not. Golden corpus 87/87 with **no existing case re-recorded** — `git diff` over `tests/hooks/golden/` shows one modified index and one added case. Protected config namespaces still rejected (`gates.*`/`paths.*` → `forbidden-namespace`, protected `hooks.*` → `protected-hook`), and the gates ignore a hostile config.
- **AC-11.** Build PASS; lint **0 errors**, 3 warnings all pre-existing at BASE; typecheck PASS; `npm test` **298 files / 3372 tests passed**; hook node tests 47/47. No `any` and no unsafe cast in added TypeScript, no added TODO/FIXME, no secret literal, no new file over 200 lines (the two "new" 200+ files are moves already over 200 at their BASE path), no new test skips (77 markers, unchanged). Integration **descriptions** are untouched — only integration file *bodies* changed, for path and `/mk:` rewrites — and `journey-specs.jsonl` has zero diff, so sprint 9's denominator is intact. No plan-artifact token in any added comment, test name or file name (`agile-sprint-commitment.md` and `sprint-contract/` use "sprint" as the Agile domain term, not a plan reference).

## Maintainability — WARN

**W1, W2 and W6 below.** The code itself is clean: the moves are real renames, the readers were
updated with their subjects, no duplicate path resolver or second registry appeared, and two
subjectless checks (`pairedCommands`, the command-inventory branch) were removed with their subject
rather than left to phantom-pass. The deductions are a regression-guard hole the sprint created, and
two record-keeping inconsistencies.

Also noted, non-blocking: `skills/help/references/cli.md` — a **generated** artifact — is now a
`SAFETY_PATHS` entry (`check-packs.ts:61`). It resolves and `validate --packs` is green, so the base
safety invariant keeps its length as D4 requires, but a generated file inside a safety list means a
generator bug becomes a safety-invariant failure. Worth a thought in sprint 9; not a defect now.

## Performance — PASS

No hot path, query or render surface in this change. The direction of travel is favourable and
measured: the shipped kit went **1228 → 1155** files, the always-on rules subtotal **25 501 → 25 417 B**
(183 bytes of headroom, where the contract only asked that the 99 be held), and the deferred metadata
denominator is unmoved. The one new per-session cost is the relocated web-fetch cache root, which is a
path change rather than extra work. `check-always-on-budget.cjs`'s 25 600 literal was not raised
(`git diff` over that file is empty).

## Security — WARN

This change's own security posture is clean, and I verified the two items the brief flagged by
execution rather than by reading:

- **Privacy regex covers both roots.** `privacy-block.cjs:48` is `/(?:\.meowkit|\.claude)\/cache\/web-fetches\/index\.jsonl$|\.quarantined$/`. Driven live through the hook, all four classes exit **2** with `@@PRIVACY_BLOCK@@`: new `index.jsonl`, new quarantine, **old** `.claude/` `index.jsonl`, **old** quarantine. Nothing blocked at BASE became readable, and the control (an ordinary `.md` in the cache dir) correctly exits 0. The new golden case asserting the new path is an addition, not a re-record.
- **Safety hooks fail closed.** `gate-enforcement.cjs`, `privacy-block.cjs` and `pre-ship.cjs` each exit 2 with their marker on malformed stdin, on empty stdin, and with the mewkit CLI made unresolvable under a stripped env — 9 of 9.
- Launcher PATH env handling (`launcher-path-env.cjs`) is **untouched** by this sprint, so sprint 7's single-quoting fix stands unmodified. No hardcoded secret, key material, or `any` in added code; `process.env` reads all classified (`check-env-reads` PASS, 138 reads).

The WARN is W5: a **pre-existing** Gate 2 fail-open. Per `security-rules.md`'s Enforcement clause,
existing code is flagged and documented, not auto-fixed.

## Coverage — WARN

The committed test surface is strong and was proven to have teeth rather than merely to pass: the
golden corpus replays 87/87 with no case re-recorded, the rule-survival needle fails on deletion
*and* on semantic weakening, `check-skill-cross-refs.sh` fails on a planted phantom, and the suite is
298 files / 3372 tests with no new skips. Three gaps, all WARN in default mode — W2, W3, W4.

The most instructive one is W3: the zero-residue journey drove the hooks directly and never executed
the cook skill's own `--tdd` instruction, which is exactly the path R1 lives on. The journey asserts
that *hooks* write to the right place; nothing asserts that the kit's *prose instructions* do.

## Required Changes (blocking)

- [ ] **R1** Fix `.claude/skills/cook/SKILL.md:83` to `mkdir -p .meowkit/state && echo on > .meowkit/state/tdd-mode`, and apply the same fix at `.claude/benchmarks/canary/quick/05-tdd-feature-spec.md:17`. Then re-verify AC-08's clause by running the corrected command in a project containing only `.meowkit/` and confirming exit 0, the sentinel present at `.meowkit/state/tdd-mode`, and no `.claude/session-state/` created.
- [ ] **R1-followup** Add one assertion that no shipped kit instruction writes a `session-state` path — a grep-level check over the ship set for `session-state` outside the known-legitimate fallback list would have caught this and costs little. Without it, the next path rewrite reopens the same hole.

## WARN items — each needs explicit human acknowledgement

Each carries the three-part justification: what it means, why it is acceptable here, and what would
make it blocking.

**W1 — The move registry gives five of this sprint's moves zero regression coverage, while reporting like coverage.**
*What it means:* AC-04 requires every move be appended to `scripts/dangling-rule-refs-data.cjs` and
the reference checks be "proven to have teeth by planting an old-path reference". I planted four
old-path references in a scratch copy of the finished tree. **Only one was caught.**

| Planted old-path reference | Result |
| --- | --- |
| `.claude/capability-bootstrap.md` | caught — rule (b), exit 1 |
| `.claude/rubrics/composition-presets/cli-tool.md` | **not caught** |
| `.claude/workflow.yaml` | **not caught** |
| `.claude/rules-conditional/agile-story-gates.md` | **not caught** |

Two causes. `rubrics/` (a directory) and `workflow.yaml` (not a `.md` rule) have no registry entry at
all — the builder's disclosed deviation, and accurate: the registry is keyed `{name, to}` on a rule
basename and rule (a)'s regex is literally `` rules/(<names>)\.md `` (`check-dangling-rule-refs.cjs:25`),
so neither shape fits without extending the check. The second cause is **not** covered by that
disclosure: the three agile rules *are* in the registry, added by this sprint, each with
`citedByName: true`, which makes the consumer `continue` past rule (b) (`:107`) — and rule (a)'s
regex cannot match the `rules-conditional/` prefix, because the text before `/` is `conditional`, not
`rules`. So those three entries have **nil** protective value while
`check-dangling-rule-refs` prints "OK: no dangling references; all 22 destinations are loaded".
*Why acceptable here:* no live stale reference exists — the check is genuinely green on the real tree
by my own run and an independent one, so there is no present breakage. `citedByName`'s premise is
sound (these rules are cited by bare name in legitimate prose, so rule (b) would false-positive), and
the disclosed half is a real schema limitation, not an oversight.
*What makes it blocking:* a live stale reference to any of the five paths, or a sprint-9 change that
leans on this check to prove a move landed. **Suggested fix:** widen the regex to
`rules(-conditional)?/` and add path-prefix tombstones for `.claude/rubrics/` and `.claude/workflow.yaml`.
This is precisely the pattern D4 condemns — "a check whose inventory is empty reports pass while
verifying nothing, which is worse than no check because it looks like coverage" — reintroduced at
smaller scale in the same change that removed its larger instance.

**W2 — Three shipped files cite an unshipped path as if it were present.**
`.claude/skills/advise/references/advice-supervision-rules.md:403`,
`.claude/skills/autobuild/references/adaptive-density-matrix.md:68` and
`.claude/skills/cook/references/harness-rules.md:60` each name
`.claude/skills/benchmark/references/dead-weight-audit-rules.md` with no qualifier — `harness-rules.md:60`
says the procedure and thresholds "are in" that path. AC-05 requires that no shipped kit file present
a now-unshipped surface as available in an installed project.
*What it means:* a reader in an installed project follows the pointer and finds nothing.
*Why acceptable here:* the registry entry is correctly `shipped: false`, line 83 of the same
`adaptive-density-matrix.md` *is* qualified ("this repository only"), and `SKILLS_INDEX.md:145` labels
the skill maintainer-only — so the kit does disclose the fact, just not at these three sites. No
runtime failure; prose only.
*What makes it blocking:* any of the three being load-bearing for a procedure an installed project is
told it must run. **Suggested fix:** append "(this repository only)" to each, matching line 83.

**W3 — No committed check asserts that shipped kit *instructions* write to the right place.**
*What it means:* the zero-residue journey drives hooks and asserts hook writes; R1 lives in skill
prose, so it passed every committed gate. The same blind spot covers the remaining stale narration:
`bead-template.md:40` (shipped asset, stale at BASE) and ~57 provider-bundle files.
*Why acceptable here:* the gap is now named, R1-followup proposes the cheap guard, and no other
instance currently breaks anything — I checked the surviving `session-state` mentions individually.
*What makes it blocking:* a second instruction-level path defect reaching a shipped file after R1 is
fixed, which would make this a pattern rather than a miss.

**W4 — No committed test asserts the codex/cursor projections are in sync with the reduced `.claude/` surface, and the cursor target has no meaningful validator run.**
*What it means:* AC-09 asks the projections to regenerate to a no-op. There is no generator — the
bundles are hand-authored — and the 521 passing bundle tests compare the authored bundle to its
*packaged copy*, not to `.claude/`. From the repo root `validate --target codex` and `--target cursor`
both report "not a … target" and exit 0: vacuous. Only codex has a CI lane
(`packages/mewkit/scripts/codex-compat-check.mjs`, `ci.yml:171`); cursor has none.
*Why acceptable here:* measured directly, the bundles carry **no** `commands/`, `modes/`, `rubrics/`,
`rules-conditional/` or `.claude/scripts/` directory, and their stale narration counts are *identical*
to BASE (rubrics 6=6, workflow.yaml 7=7, rules-conditional 2=2) — so this sprint introduced no
projection drift, and pointing `validate --target codex` at the bundle root passes 16 checks. The
~57-file `session-state` narration is prose and `.toml`/`.md` only; **zero** `.cjs`/`.ts`/`.js`
executable hits, and no bundle hook reads a state directory at all, so nothing computes a stale path
at runtime. A disclosed sprint-9 deferral.
*What makes it blocking:* an executable bundle file computing a `session-state` path, or a projection
carrying a removed directory.

**W5 — Pre-existing: Gate 2 fails *open* when `git` cannot run.**
`gate2-change-set.cjs:23-27` returns `''` on any spawn error or non-zero status; an empty change set
then means `changed.length === 0`, which takes the `allow()` branch in `gate2-check.cjs:46`. Driven in
a throwaway project with a staged ship-capable file, `pre-ship.cjs` printed "PRE-SHIP PASS" and exited
**0** both under a stripped PATH and with a corrupted `.git/index`.
*What it means:* a gate whose whole contract is to fail closed does the opposite in one error class.
*Why acceptable here:* **not caused by this change** — `gate2-change-set.cjs` has zero diff against
BASE — and the blast radius is narrow, since the `git commit` being gated would itself fail under the
same conditions. `security-rules.md`'s Enforcement clause is explicit that existing code is flagged
and documented, not auto-fixed, because it may carry context I lack.
*What makes it blocking:* this sprint touching that file, or any error class where the commit succeeds
while the gate is bypassed. **Suggested fix:** block on spawn error or non-zero status rather than
returning `''`. Related, same file family: when the CLI is absent `pre-ship` prints
`SKIP: mewkit CLI not found — team memory store not linted` and continues.

**W6 — Record-keeping inconsistencies in this sprint's own artifacts.**
(a) The evidence record's header still reads "**PRE-IMPLEMENTATION SIZING + BLOCKED.** No source file
was edited", and its §4 per-AC table marks all eleven "**NOT RUN**", while slices 1–6 of the same file
document the completed work — the header and §5 "Files changed: None" are stale leftovers from the
sizing round and now contradict the body.
(b) `docs/operations/docs-references-inventory.md:56-57` still attributes emission to
`commands/mk/docs-sync.md` and `commands/mk/retro.md`, and its `:4` header still greps
`commands,scripts,modes` — the sprint removed `rules-conditional` from that same line and left the
other three.
(c) `release-manifest.json` is unchanged and still names **56** removed paths — the disclosed "left
stale for the release pipeline" deviation.
*What it means:* a reader of the sprint record cannot tell from its header what was done, and two
shipped-adjacent artifacts describe a tree that no longer exists.
*Why acceptable here:* none is a code defect; the evidence body is complete and accurate where it
counts, `docs-references-inventory.md` is a dated working artifact that does not ship, and
`release-manifest.json` is regenerated by the release pipeline rather than read by an installed
project.
*What makes it blocking:* `release-manifest.json` being consumed by an installed project or by
`validate --packs` (it is not today), or the evidence header surviving into the committed sprint
record, where it would misinform sprint 9's baseline.

## Builder deviations — confirmed or rejected

| # | Deviation | Verdict |
| --- | --- | --- |
| 1 | Move registry cannot express `rubrics/` and `workflow.yaml` moves | **Confirmed as accurate, consequence under-stated.** The schema limitation is real (rule (a) is literally `rules/<name>.md`). But leaving them unexpressed costs real coverage — W1. |
| 2 | `citedByName` flag in `dangling-rule-refs-data.cjs` | **Confirmed as reasonable, implementation incomplete.** The premise is sound; the effect is that three new entries protect nothing, because rule (a) cannot match `rules-conditional/`. W1. |
| 3 | 40/20 rather than the contract's 39/21 reference split | **Confirmed — the builder is right and the contract is wrong.** Re-measured at BASE by exact token: 60 files, 20 docs / 40 non-docs. The contract figure is off by one. The union is still the measured 60 and every live reference resolves. |
| 4 | `cli.md` is now a `SAFETY_PATH` | **Accepted.** D4 forbids dropping an entry, the list keeps its length, the path resolves and `validate --packs` is green. Noted under Maintainability that it is a generated file. |
| 5 | `deletions.json` carries retirements (benchmarks/** + harness-substrate.md added, `agent-memory/` deliberately not) | **Accepted, and the omission is the right call.** Verified: no `agent-memory` entry. An installed project's `.claude/agent-memory/` may hold the *user's* own content; retiring it on upgrade would be data loss. Correct judgment, not an oversight. |
| 6 | `release-manifest.json` left stale for the release pipeline | **Accepted with a WARN** — W6(c). |
| 7 | README skills count 129 (repo) with "128 ship" noted, because writing 128 fails `validate --agents` | **Accepted.** Verified: 129 repo / 128 shipped, the delta being maintainer-only `benchmark`. Both numbers are true; the banner alone is mildly misleading and the tree line carries the clarification. A validator that forces the less useful number is the real defect — a sprint-9 candidate, not this sprint's. |
| 8 | Provider bundles still narrate `session-state/` in 55 files (prose only) — deferred | **Confirmed, count corrected.** Measured **57** files / 96 occurrences, not 55; all `.md`/`.toml`, **zero** executable hits. W4. |
| 9 | `gate2-check.cjs:70` message text kept byte-identical to its golden fixture though it names the pre-move pointer path | **Accepted, narrowly.** The read fallback keeps the advice functional, and the no-re-record rule outranks message polish. But `gate-rules.md` now says `.meowkit/state/active-plan.json` while the hook advises `session-state/active-plan.json`: the two disagree, and a user following the hook writes to a legacy path. Fix when the fixture can be legitimately re-recorded. |
| 10 | Golden corpus gained an `authoredAfterBase` case | **Accepted.** Read it: it replays `Read .meowkit/cache/web-fetches/index.jsonl` expecting exit 2 + marker + full stderr, registered `base:null` with the reason "BASE matched only the pre-move cache root". A new case, not a re-record — and the harness change (`tests/hooks/lib/state-relocation.ts`) translates seeded side-effect paths while a write at the old path still yields a failing sentinel. Defensible and guarded. |
| 11 | Doctor's "Autobuild run ledger" check removed | **Accepted.** Its subject (the `tasks/autobuild-runs` scaffold) left with the `tasks/` archive root; a check reading an absent inventory is the phantom-pass pattern D4 removes. Consistent with the `pairedCommands` removal. |

## Process disclosure (recorded, per Rule 1 — No Silent Override)

During slice 4 the developer ran `mewkit init --help` **once from the repository root**. The contract
forbids this without qualification: "Do not run `init`, `upgrade` or `uninstall` in or against this
repository, not even with `--help`" (sprint 7 D11, still binding). The orchestrator verified no
residue — no `.meowkit/bin`, no `.claude/runtime.json`, no new untracked files — and I found nothing
in the working tree inconsistent with that. **Recorded, not excused:** the prohibition is absolute
precisely because `--help` looks harmless, and `init`'s help path is one refactor away from touching
disk. No impact on this verdict's dimensions.

## Pre-existing follow-ups (record only — not this sprint's scope)

1. `ArtifactType` still lists `"command"` as a variant although no command artifact remains.
2. `packages/mewkit/src/commands/validate.ts:447` — `countFiles` defined but never used (one of the 3 pre-existing lint warnings; the other two are `buildCapabilities` at `capabilities.ts:7` and `path` at `orient.ts:8`).
3. `CLAUDE.md:102` names `mewkit inventory --substrate`; there is **no** `inventory` command (`mewkit inventory` prints "Unknown command"). The real verbs are `mewkit validate --substrate` and `scripts/harness-inventory.cjs --substrate`. Also stale at `packages/docs/content/docs/cli/telemetry.mdx:63-65` and — more importantly — in the **shipped** `.claude/skills/agent-detector/references/context-budget-rules.md:64`. All pre-existing at BASE.
4. `CLAUDE.md:108` still documents `.claude/skills/.venv/bin/python3`; envs moved to `.meowkit/envs/` in phase 05.
5. `.claude/settings.json.bak` is tracked in git but correctly excluded from the ship set.

## Suggestions (non-blocking)

- Fold R1-followup's grep guard into the ship-set assertions added in slice 4 — it is the same kind of check and the same file.
- Extend `PREFIXED_RE` to `rules(-conditional)?/` and add directory tombstones; W1's fix is a few characters and closes five moves' worth of exposure.
- Reconcile `gate2-check.cjs:70` with `gate-rules.md` when the fixture can next be re-recorded, so the hook and the rule stop disagreeing about where the pointer lives.
- Consider whether `validate --agents`' count rule should accept the shipped count, so `README.md:9` can state the number a user actually gets.
- Refresh the evidence record's header and §4 before the sprint record is committed, so sprint 9 inherits an accurate baseline.

## Gate 2 decision — pending human approval

This verdict records a **FAIL** on Correctness for R1, a reproduced defect with a one-line fix, plus
six WARN items requiring explicit acknowledgement. Under `gate-rules.md`, Gate 2 requires no FAIL
dimension, so **Gate 2 is not satisfied** and Phase 5 does not open.

I hold no gate authority. This document is evidence for the human at the gate, not the decision
itself: a FAIL verdict routes back to the developer for R1, and only a human can approve the gate once
R1 is fixed and the six WARN items are each seen and accepted. Recommended routing: **developer** for
R1 + R1-followup, then a round-2 review limited to R1's verification and any WARN item the human
elects to close.
