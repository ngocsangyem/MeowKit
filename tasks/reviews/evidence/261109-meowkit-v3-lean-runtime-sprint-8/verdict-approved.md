# Review: MeowKit v3 lean runtime — kit shape and removals (sprint 8)

- **Reviewed base:** `d17cc03b` ("contract: evaluator signs sprint 8 …"), branch `feat/v3-lean-runtime`
- **Reviewed change:** working tree vs `d17cc03b` — `git diff HEAD` plus untracked files, excluding `tasks/plans/` (never committed)
- **Spec graded against:** `tasks/contracts/261109-1402-meowkit-v3-lean-runtime-sprint-8.md` (signed, 11 acceptance criteria). The metadata budget (D7), the integration rewrite and routing specs (D10, D11) and the SubagentStart spike (D13) are deferred to sprint 9 by D15 and are **not graded here**.
- **Review round:** 2. Round 1 returned a blocking Correctness result on one reproduced defect plus six WARN items; R1, its follow-up guard, W1, W2, W3, W6(a) and W6(b) are closed, and W4/W5 are left as declared follow-ups. Round 1's verdict is archived verbatim at `tasks/reviews/evidence/261109-meowkit-v3-lean-runtime-sprint-8/review-round-1.md`; sprint 7's at `…/sprint-7/verdict-approved.md`.
- **Mode:** default (TDD off) — coverage gaps are WARN
- **Score:** 9.0/10

## Verdict: WARN

The blocking defect is closed, and I reproduced the fix rather than accepting the report: the
corrected `--tdd` instruction now exits **0**, writes the sentinel, and creates no retired state root.
More importantly the fix came with the guard round 1 asked for, and I proved the guard bites by
planting the pre-fix line back into a faithful clone of the finished tree — it fails on the shipped
file *and* on the blockquoted maintainer copy, which is the drift path that let the defect through in
the first place.

The W1 coverage hole is genuinely closed, not papered over. Round 1 caught 1 of 4 planted old-path
references; I re-ran the same four probes against the finished checker and all **4 of 4** are now
caught, while a legitimate mapping line that names both the retired and the current path stays legal —
so rule (d) has teeth without being over-broad. The widened rule (a) is what finally makes the three
`citedByName` entries protective. And the new rule found a **live** stale reference on its first run
(`scripts/validate-rule-availability.sh:77`), which retires round 1's observation that the check "was
green because it was not looking".

What remains is two declared follow-ups the developer deliberately did not take (W4 projection sync,
W5 a pre-existing fail-open), one accepted deviation, and three record-only items. None blocks; all
are numbered below for explicit acknowledgement.

| Dimension | Round 1 | Now |
| --- | --- | --- |
| Correctness | blocking | PASS |
| Maintainability | WARN | PASS |
| Performance | PASS | PASS |
| Security | WARN | WARN |
| Coverage | WARN | WARN |

Side Effects Detected: No — this review wrote only this verdict file and the two archive copies.

## Gate-authority standing item (`gate-rules.md:67-73`)

Re-asked for round 2, because the fix round again touched `.claude/rules/`-adjacent safety code and
three skills in the trigger list.

> **Does any prose in this change grant approval authority to something that is not a human — in any wording?**

**No.** The fix round added prose in four places I read individually: the four-line comment in
`.claude/hooks/lib/gate2-check.cjs`, the header comment of the new guard test, the widened
`check-dangling-rule-refs.cjs` header, and the three "this repository only" qualifiers. None mentions
approval, advancement, scoring or unattended operation; the gate2 comment documents why a message
names a pre-move path, and explicitly leaves the decision with the recorded corpus rather than with
any automation. `validate --gates` reports `[PASS] No automated gate-approval claims`, treated as a
floor rather than as the answer. Round 1's two gate-adjacent findings (the reviewer path list's reach,
and the `security-rules.md` Enforcement clause keeping its meaning) are unchanged by this round and
remain satisfied.

## Fix verification — each reproduced, not accepted

**F1 — R1 closed. The shipped `--tdd` instruction no longer writes a retired state root.**

`.claude/skills/cook/SKILL.md:83` and `.claude/benchmarks/canary/quick/05-tdd-feature-spec.md:17` both
now read `mkdir -p .meowkit/state && echo on > .meowkit/state/tdd-mode`. Re-run in a project
containing only `.meowkit/`:

```
$ bash -c 'mkdir -p .meowkit/state && echo on > .meowkit/state/tdd-mode'; echo "EXIT=$?"
EXIT=0
$ find . -mindepth 1 | sort
./.meowkit
./.meowkit/state
./.meowkit/state/tdd-mode
$ cat .meowkit/state/tdd-mode   ->  on
$ find . -name session-state | wc -l   ->  0
```

Exit **0** against round 1's exit 1; the sentinel exists, so `--tdd` arms strict mode on a fresh
install; and no path named `session-state` is created, which is AC-08's clause as written. I also ran
my **own** sweep for the same instruction shape across `.claude`, `docs`, `packages/docs/content`,
`README.md`, `RELEASING.md` and `CLAUDE.md` (excluding the stale worktree and the changelog) rather
than trusting the developer's: zero hits remain.

**F2 — the guard round 1 required exists and bites.** New:
`packages/mewkit/src/kit/__tests__/retired-state-write-instructions.test.ts`, 76 lines, no `any`.

I judged the design before testing it, and it is built the right way round: the detector is a pure
function carrying **both** positive controls (the exact pre-fix line, the blockquoted form, a bare
redirect, `touch`, a `tee` pipe) and **negative** controls that pin precisely the four survivors round
1 dispositioned as legitimate — `LEGACY_STATE_RELS`, the `gate2-check.cjs:70` advice line,
`bead-template.md:40`'s prose, and the corrected instruction itself. So it can neither pass by
matching nothing nor pass by matching everything. The second test scans the shipped set **union** every
tracked file under `.claude/`, and asserts the list exceeds 900 files — a phantom-pass guard against
the empty-inventory pattern D4 condemns and that round 1's W1 found reintroduced. Covering the wider
list is the right call: the two copies of that instruction drifted together, which is how R1 reached a
shipped file.

Proving it bites required planting the defect, and I would not write to the repository to do it. I
built a faithful scratch clone — `git clone` of this repo, the uncommitted working tree rsynced over
it, staged deletions applied, `git add -A` so `git ls-files` sees the finished tree, `node_modules`
symlinked — confirmed the guard passes there as a baseline, then planted the pre-fix line into each
file in turn:

| Probe (in the clone) | Guard result |
| --- | --- |
| baseline, finished tree | 2 passed |
| pre-fix line at `.claude/skills/cook/SKILL.md:83` (shipped) | 1 failed — `".claude/skills/cook/SKILL.md:83: mkdir -p .claude/session-state && echo on > .meowkit/state/tdd-mode"` |
| pre-fix line at `…/canary/quick/05-tdd-feature-spec.md:17` (maintainer-only, blockquoted) | 1 failed — reported with its `> ` prefix intact |
| both restored | 2 passed |

The blockquoted case matters: a naive redirect matcher would read the Markdown `>` as a redirect and
mis-handle that line, and the detector's shape deliberately requires a non-space character before a
redirect so it does not. The real repository was never modified.

**F3 — W1 closed. The move registry now protects all five of this sprint's moves.** Three changes, all
inside the existing registry and its checker; no second registry (`scripts/dangling-rule-refs-data.cjs`
remains the one list).

1. Rule (a) widened at `scripts/check-dangling-rule-refs.cjs:29` to `` rules(?:-conditional)?/(<names>)\.md ``. This is the change that gives the three `citedByName` agile entries any protective value: they are exempt from rule (b) on purpose, and rule (a) previously could not match their `rules-conditional/` prefix, so their net worth was nil.
2. A new `RETIRED_PATHS` export (3 entries) for the two shapes the `{name, to}` schema cannot express plus the directory form of the third: `.claude/rubrics/`, `.claude/workflow.yaml`, `.claude/rules-conditional/`, each with its current location.
3. A new rule (d): a retired location may be named only on a line that also names its current location. I checked the implementation at `:109-113` and it sits **before** the `isShippedProse` filter, so it covers every scanned file rather than shipped prose only — broader than I would have asked for.

I re-ran round 1's four probes myself, in a scratch copy, plus a fifth to test for over-breadth:

| Planted reference | Round 1 | Now |
| --- | --- | --- |
| `.claude/capability-bootstrap.md` | caught (b) | caught (b), exit 1 |
| `.claude/rubrics/composition-presets/cli-tool.md` | missed | caught — `(d) retired location: .claude/rubrics/`, exit 1 |
| `.claude/workflow.yaml` | missed | caught — `(d) retired location: .claude/workflow.yaml`, exit 1 |
| `.claude/rules-conditional/agile-story-gates.md` | missed | caught **twice** — `(a) old rule path: rules-conditional/agile-story-gates.md` and `(d)`, exit 1 |
| mapping line naming retired **and** current path | n/a | correctly **not** flagged, exit 0 |

4 of 4, against 1 of 4. The fifth probe is the one that matters for judging rule (d): it is a
mapping-line exemption by construction, not a file-level exemption, so a canonical-path table stays
legal without blinding the check to the rest of that file. One file-level exemption was added — the
dated ADR `docs/architecture/adr/260511-agile-scrum-conditional-rule-layer.md`, whose own header says
its paths are the ones that existed then. Appropriate for a decision record.

The live finding is the strongest evidence here. Rule (d) failed on its first run against
`scripts/validate-rule-availability.sh:77`, whose comment claimed the conditional-rule tree "was
merged into `.claude/rules/` in v2.8.4"; it now names `.claude/skills/agent-detector/references/`,
where that content actually lives. `bash scripts/validate-rule-availability.sh` → `OK: 7 rule
reference(s) all resolve to files on disk`. Round 1's note that the checker "was green because it was
not looking" is retired on evidence.

**F4 — W2 closed, verified more widely than reported.** The three citations now carry the qualifier
(`adaptive-density-matrix.md:68`, `advice-supervision-rules.md:403`, and the longer form at
`harness-rules.md:60` — "this repository only — an installed kit does not carry it, and the audit is a
maintainer procedure", which is right, because that was the load-bearing one that said the thresholds
"are in" the path). Rather than check the three, I swept **every** shipped `.md`/`.mdx` in the ship set
for any mention of `skills/benchmark/` or `mk:benchmark` lacking a maintainer qualifier. One hit came
back, `adaptive-density-matrix.md:64`, and on reading it that line is qualified too — "available only
in this repository", different wording my matcher did not anticipate. So: **zero** unqualified
citations of a withheld surface anywhere in the shipped kit. Registry entry still `shipped: false`.

**F5 — the one shipped site naming a verb that does not exist.**
`.claude/skills/agent-detector/references/context-budget-rules.md:64` now reads "the substrate view
(`mewkit validate --substrate`)". Verified by running the built CLI, not by reading a catalogue:
`mewkit inventory --substrate` → `Unknown command: inventory`; `mewkit validate --substrate` → 2
passed, 1 warning, exit 0. I then grepped the whole tree: no **shipped** file names the phantom verb
any more. The survivors are all unshipped and pre-existing — `CLAUDE.md:85`, the immutable changelog,
`packages/docs/content/docs/cli/telemetry.mdx:63-65`, and a historical verdict under `docs/plans/`.
(Round 1 cited `CLAUDE.md:102` for this; measured now it is `:85`.)

**F6 — the record is corrected.** The evidence header no longer claims "PRE-IMPLEMENTATION SIZING +
BLOCKED"; it states that slices 1–6 ran and that source was edited, and it keeps §1's stop as an
explicitly-labelled historical note rather than deleting it — the right choice, since the stop and the
decision to proceed in slices are both part of the record. §4's eleven "NOT RUN" rows are replaced
with a measured result plus an evidence pointer each, and §5's "Files changed: None" is corrected in
place. `docs/operations/docs-references-inventory.md:56-57` now name `mk:document-release` and
`mk:retro`, and `:4`'s grep no longer sweeps `commands`, `scripts` or `modes`, with the re-scope dated.
`packages/docs/docs-reference-manifest.json` was regenerated for the one changed `sourceHash`, and
`docs-manifest.cjs --check` confirms 171 reference pages match the live tree.

**F7 — one safety library changed, and I inspected it rather than trusting the claim.**
`.claude/hooks/lib/gate2-check.cjs` shows **+4 lines against BASE, all comment**; the advice string is
byte-identical, so the recorded corpus stays green and the no-re-record rule holds. The comment states
the invariant — the message names a pre-move location because the corpus pins it and the lookup accepts
the pointer in both classes — without referencing a plan artifact, review round or finding code, which
is the convention this contract requires. `.claude/hooks/lib/gate2-change-set.cjs` has **zero** diff,
confirming W5 was left alone as declared.

**F8 — gates re-run by me, Node 24, on the finished tree.**

| Gate | Result |
| --- | --- |
| `npm run build` | PASS |
| `npm run lint` | PASS — **0 errors**, 3 warnings, all three pre-existing at BASE |
| `npm run typecheck` | PASS |
| `npm test` | PASS — **299 files / 3374 tests** (298 / 3372 in round 1; +1 file / +2 tests is exactly the new guard) |
| `node --test .claude/hooks/__tests__/*.test.cjs` | PASS — 47/47 |
| golden replay | PASS — 87/87, and `git diff` over `tests/hooks/golden/` is still one modified index plus one added case: **no fixture re-recorded** |
| `check-dangling-rule-refs` | PASS — 22 destinations loaded, 3 retired locations unreferenced |
| `check-always-on-budget` | PASS — **25 417 B** of 25 600, 183 B headroom, inside the ≤25 501 B pin |
| `check-rule-survival` | PASS — every pinned safety item survives |
| `validate --packs / --gates / --workflow / --frontmatter / --docs-refs / --memory` | PASS — 1 / 1 / 6 (no drift) / 1 / 1 / 1 |
| `check-kit-verbs` · `check-env-reads` · `check-memory-wiki-residue` | PASS — 293 refs / 138 classified reads / 0 hits |
| `check-no-python --allow-existing-envs` · `check-skill-cross-refs.sh` | PASS — 26 checks, no interpreter on PATH / all refs resolve |
| `validate-rule-availability.sh` · `docs-manifest --check` · `generate-cli-manual --check` · `link-checker` | PASS — 7 refs / 171 pages / manual matches catalogue / 268 files |
| `check-journey-specs.py` | PASS — 12 journeys frozen, unchanged |

Fix-round hygiene re-checked: no `any` or unsafe cast anywhere in the change, no new file over 200
lines (the guard is 76; the two touched scripts are 184 and 168), and no plan-artifact token — phase,
sprint, criterion, decision, round — in any added comment, test name or file name.

## Required Changes

None. Round 1's blocking item is closed and independently reproduced.

## WARN items — each needs explicit human acknowledgement

Renumbered for this round. Each carries the three-part justification: what it means, why it is
acceptable here, and what would make it blocking.

**1 — No committed test asserts the codex/cursor projections are in sync with the reduced `.claude/` surface, and the cursor target has no meaningful validator run.** (Round 1's W4, deliberately left.)
*What it means:* AC-09 asks the projections to regenerate to a no-op. There is no generator — the
bundles are hand-authored — and the passing bundle tests compare the authored bundle to its *packaged
copy*, not to `.claude/`. From the repo root `validate --target codex` and `--target cursor` both
report "not a … target" and exit 0: vacuous. Only codex has a CI lane
(`packages/mewkit/scripts/codex-compat-check.mjs`, `ci.yml:171`); cursor has none. The same gap covers
the bundles' ~57 files of `session-state` narration.
*Why acceptable here:* measured directly, the bundles carry **no** `commands/`, `modes/`, `rubrics/`,
`rules-conditional/` or `.claude/scripts/` directory; their stale-narration counts are *identical* to
BASE, so this sprint introduced no projection drift; the narration is `.md`/`.toml` only with **zero**
executable hits, and no bundle hook reads a state directory at all, so nothing computes a stale path at
runtime. Pointing `validate --target codex` at the bundle root passes 16 checks. A declared sprint-9
deferral, not a regression.
*What makes it blocking:* an executable bundle file computing a retired path, or a projection carrying
a removed directory.

**2 — Pre-existing: Gate 2 fails *open* when `git` cannot run.** (Round 1's W5, deliberately left.)
*What it means:* `.claude/hooks/lib/gate2-change-set.cjs:23-27` returns `''` on any spawn error or
non-zero status; an empty change set then means `changed.length === 0`, which takes the `allow()`
branch in `gate2-check.cjs:46`. Driven in a throwaway project with a staged ship-capable file,
`pre-ship.cjs` printed "PRE-SHIP PASS" and exited **0** both under a stripped PATH and with a corrupted
`.git/index`. A check whose whole contract is to fail closed does the opposite in one error class.
*Why acceptable here:* **not caused by this change** — I re-confirmed `gate2-change-set.cjs` has zero
diff against BASE this round — and the blast radius is narrow, since the `git commit` being gated would
itself fail under the same conditions. `security-rules.md`'s Enforcement clause is explicit that
existing code is flagged and documented, never auto-fixed, because it may carry context I lack.
*What makes it blocking:* a future sprint touching that file without fixing it, or any error class
where the commit succeeds while the gate is bypassed. **Suggested fix:** treat a spawn error or
non-zero status as unknown-and-therefore-blocked rather than returning `''`.

**3 — `release-manifest.json` still names 56 removed paths.** (Round 1's W6(c); accepted deviation 6.)
*What it means:* a committed artifact describes a kit shape that no longer exists.
*Why acceptable here:* verified in round 1 that it does **not** reach an installed project — the
installer reads it from the release directory and does not copy it to the project root — and the
release pipeline regenerates it. So no user sees the stale list.
*What makes it blocking:* it being consumed by an installed project, or by `validate --packs` (neither
is true today).

**4 — The Gate 2 advice line and the gate rule disagree about where the active-plan pointer lives.**
*What it means:* `gate2-check.cjs:70` advises `session-state/active-plan.json` while
`.claude/rules/gate-rules.md` now names `.meowkit/state/active-plan.json`. A user following the hook's
advice writes to the legacy location.
*Why acceptable here:* the message is pinned byte-for-byte by the recorded corpus, and the no-re-record
rule outranks message polish — re-recording a fixture to tidy prose is exactly what the contract
forbids. The lookup accepts the pointer in both classes, so the advice still *works*, and this round
added a comment stating that invariant in place, which is a real improvement on round 1 where the
divergence was undocumented.
*What makes it blocking:* the read fallback being removed while the message still names the legacy
path, which would make the advice actively wrong.

**5 — Pre-existing stale references outside the shipped kit.**
`CLAUDE.md:85` and `packages/docs/content/docs/cli/telemetry.mdx:63-65` name the nonexistent
`mewkit inventory --substrate`; `.claude/skills/plan-creator/assets/bead-template.md:40` narrates
`session-state/build-progress.json` in prose; the brand linter is red at BASE and less red now.
*What it means:* a reader of the root instructions or the docs site can be sent to a verb that does not
exist.
*Why acceptable here:* all were stale at BASE, none is in the shipped kit (the one shipped instance was
fixed this round — F5), and `bead-template.md:40` is prose that the new guard's negative controls
deliberately keep legal, since naming a retired path is not writing to one.
*What makes it blocking:* nothing in this sprint; these belong in a docs pass. Worth folding into
sprint 9 since it already touches descriptions.

**6 — The new guard's scope is bounded, by design.**
*What it means:* `retired-state-write-instructions.test.ts` covers three retired roots
(`session-state`, `.claude/cache/`, `.claude/hooks/.logs`) and shell write shapes (`mkdir`, `touch`,
`tee`, `>`/`>>`). A write expressed another way — a Python `open(..., "w")` or an `fs.writeFileSync`
inside prose — would not be caught, nor would a fourth retired root nobody adds to the list.
*What it means in practice:* the guard closes the defect class that actually occurred and the shapes
one rewrite away from it, which is the right scope for a regression guard; over-generalising it would
cost false positives on the many legitimate mentions of these paths.
*Why acceptable here:* the kit's instructions are shell, the three roots are the three the state move
retired, and the detector's negative controls make the boundary explicit and reviewable.
*What makes it blocking:* a retired-root write reaching a shipped file through an idiom the detector
does not model — at which point the shape list grows rather than the approach changing.

## Items closed this round

| Round 1 item | Status | How I confirmed |
| --- | --- | --- |
| R1 — `--tdd` instruction wrote a retired root | closed | corrected line run in a clean project: exit 0, sentinel present, no retired path; own tree-wide sweep clean |
| R1-followup / W3 — no instruction-level guard | closed | new 76-line guard; pre-fix line planted in a faithful clone fails it on both the shipped and the maintainer copy |
| W1 — registry gave 5 moves no coverage | closed | my four probes now 4/4; mapping-line control still legal; the new rule found a live stale reference |
| W2 — three unqualified citations of a withheld path | closed | all three qualified; whole-ship-set sweep finds zero unqualified mentions |
| W6(a) — evidence header contradicted its body | closed | header, §4 and §5 read correctly, with §1's stop kept as a labelled historical note |
| W6(b) — stale emitters in the docs inventory | closed | `:4`, `:56`, `:57` current; `docs-manifest --check` green |

## Builder deviations

Round 1's eleven deviations stand as recorded there; none was revisited this round, and I re-confirmed
the two that the fix round could have disturbed — `release-manifest.json` untouched (item 3 above) and
`gate2-check.cjs`'s message byte-identical (F7). The fix round introduced no new deviation: every
change in its F8 table is inside the contract's scope, and the one judgement call — covering tracked
`.claude/` files as well as the ship set in the new guard — widens a check rather than narrowing one.

## Process disclosure (carried forward, per Rule 1 — No Silent Override)

During slice 4 the developer ran `mewkit init --help` **once from the repository root**. The contract
forbids this without qualification, including `--help` (sprint 7 D11, still binding). The orchestrator
verified no residue — no `.meowkit/bin`, no `.claude/runtime.json`, no new untracked files — and I
found nothing in the working tree inconsistent with that, this round included. **Recorded, not
excused.** No dimension impact. No further occurrence in the fix round; my own verification of the
install journey ran against a throwaway project, and the guard probes against a scratch clone, never
against this repository.

## Suggestions (non-blocking)

- Fold item 5's docs pass into sprint 9, which already opens the description surface.
- When the corpus can next be legitimately re-recorded, reconcile the Gate 2 advice line with the rule text (item 4) so there is one answer rather than a documented two.
- Consider whether `validate --agents`' count rule should accept the shipped count, so `README.md:9` can state the number a user actually receives rather than the repository number with a clarification elsewhere.
- Item 2's fix is small and worth taking before it is inherited again.

## Gate 2 decision — kit shape: one shipped tree, runtime state under .meowkit

Human approval, typed by the owner in response to the Gate 2 prompt for this review:

> "Approve, ack WARNs"

- **WARN 1** acknowledged: no test asserts the Codex/Cursor projections are in sync with the reduced
  surface, and Cursor has no CI lane; stale counts are identical to BASE and nothing executable is affected.
- **WARN 2** acknowledged: pre-existing Gate 2 fail-open when `git` errors (`gate2-change-set.cjs:23-27`);
  zero diff vs BASE, documented not auto-fixed; to be fixed in its own follow-up.
- **WARN 3** acknowledged: `release-manifest.json` still names removed paths; the release pipeline regenerates it
  and it never reaches an installed project.
- **WARN 4** acknowledged: the Gate 2 advice line names the pre-move pointer location; kept byte-identical to its
  recorded golden body, and the read fallback keeps it true.
- **WARN 5** acknowledged: pre-existing stale references outside the shipped kit (`CLAUDE.md`, `telemetry.mdx`,
  `bead-template.md:40` prose, brand linter).
- **WARN 6** acknowledged: the retired-path write guard covers shell write shapes into three retired roots only.
- Process disclosure (`mewkit init --help` run once from the repo root during the build, no residue) noted.
