# Review: MeowKit v3 Lean Runtime — Sprint 1, Phase 08 "Memory Diet" (round 4)

## Verdict: WARN

**This file is EVIDENCE for a human. It approves nothing.** Gate 2 is NOT approved and cannot be
approved by this verdict, by any agent, or by any script. Only a human clears a gate (`gate-rules.md`,
"The Gate Authority Invariant"). A WARN verdict means **no dimension failed and no security
block remains** — it does not mean the change is approved. Each WARN below must be explicitly seen and
accepted by a human before Gate 2 can proceed.

**No FAIL dimension. No BLOCK.** Round 3's N4 bypass is closed in both the direct-write and the
`note` path — I re-ran both reproducers and both are now rejected. The N1 false-positive fix holds
unchanged. W2 is resolved: the CI fixture now genuinely exercises the flood path for the first time.
Security moves FAIL → PASS → WARN → **PASS**. One bounded residual remains and is carried as a WARN
with corrected attribution.

## Binding

| Field | Value |
|---|---|
| Reviewed revision (`git rev-parse HEAD`) | `4dfa98a21759e533db69371cf11fbf64db9946cd` (branch `feat/v3-lean-runtime`) — unchanged since round 2 |
| Reviewed content | **The UNCOMMITTED WORKING TREE on top of that commit.** The named SHA is the base the tree sits on, NOT a commit containing the reviewed change. |
| Round | 4. R1 FAIL (4 dimensions, 19 required changes, BLOCKs S1–S3) → R2 FAIL (Correctness; 18/19 resolved, BLOCKs cleared; new N1/N2/N3) → R3 WARN (19/19 resolved, N1–N3 resolved; new N4) → R4 this file. |
| Human decisions driving rounds 3–4 | N1 → "**Recalibrate, keep FAIL**" (flood stays blocking). N2/N3 → "**Cap guard; keep rejections**". Round 4 implements N4 within the same decision. Recorded per `intervention-recording-rules.md`; all are owner calls, and I graded against them rather than against my own earlier recommendations. |
| Excluded from scope | `tasks/plans/261101-meowkit-v3-lean-runtime/` (untracked plan dir, read-only context), `tasks/contracts/` (already committed) |
| Contract | `tasks/contracts/261101-1533-meowkit-v3-lean-runtime-sprint-1.md` — Amendment 3, AC-15…AC-19 |
| Scope gate | **full** |
| Controller evidence | Read as CLAIMS and spot-checked. `ci-branch-r5/summary.txt` was not taken on trust — I re-ran the suite and the whole lane myself. |
| Review artifacts | This markdown verdict ONLY (write permission is scoped to this file). Overall WARN maps to `decision: WARN`. |

---

## Dimension Summary

| Dimension | Round 4 (current) | Basis | History (R1 → R2 → R3) |
|---|---|---|---|
| Correctness | **PASS** | N1 and N2 hold unchanged (both reproducers re-run). The round-4 rule is 14 lines, meets its spec in both directions, and I could not regress the healthy-store case at 20/30/40/59/74 entries, all-unique, or CRLF | FAIL → FAIL → PASS |
| Maintainability | **PASS** | lint + typecheck exit 0; `measuredLines` is a named, single-purpose helper whose comment states the defect it fixes and the budget it grants | WARN → PASS → PASS |
| Performance | **PASS** | Bounds unchanged; `measuredLines` is one filter pass. Suite duration flat | FAIL → PASS → PASS |
| Security | **PASS** | No BLOCK. S1–S3 remain cleared. N4's demonstrated vector is closed at **both** checkpoints (direct write and `note`). The residual allowance is the irreducible cost of the mandated FP fix, is bounded (~26 KB via `note`, ~41 KB direct), and is **smaller than a pre-existing gap in the same heuristic that this change neither introduced nor worsened** (~296 KB, verified `main=no`) | FAIL (BLOCK) → PASS → WARN |
| Coverage | **WARN** | AC-01…AC-18 PASS, **AC-19 MET**. W2 resolved — the fixture is now 12 300 B and `isFlood` is genuinely evaluated on it. Residual: the per-heading-budget shape and the pre-existing unique-per-line class are both untested | FAIL → WARN → WARN |

**Overall: WARN.** No FAIL dimension → overall WARN. 9 WARNs require explicit human acknowledgement.

Side Effects Detected: **No**. No `## User Decision Addendum` required.

---

## Round-4 findings resolution

| # | Finding | Status | Evidence (my runs this round) |
|---|---|---|---|
| **N4** | [MAJOR, R3] Structural-line exclusion let ~48–59 KB of near-zero-entropy padding pass with an affirmative clean verdict, reachable through the sanctioned `note` path | **Resolved** (demonstrated vector closed; bounded residual → W1) | `obfuscation-passes.ts:61-95`. The 5 000-char volume floor is measured over the **whole text** again; repetition is measured over `measuredLines`, which skips blank lines and at most **one** `Source:` and **one** `Apply when:` (each ≤200 chars) **per `## ` heading** — headings and `Why:` lines always count, and shared-field lines beyond one per heading count. **Both R3 reproducers now fail closed:** (a) direct store, 294 × `Why: `+195×'a' (59 093 B) → `[FAIL] Memory flood`; (b) the 3-entry `note` path → **all three calls rejected** with `flood: whole entry`, nothing written, the store never created. Also now caught: 294 duplicate `Source:` lines, 294 duplicate `Apply when:` lines, and 294 duplicate `## ` headings — none of which round 3 caught |
| | *Boundary pinned* | **Verified** | `199 / 200 / 201` chars per `Why:` line all → `flood=YES`. Round 3 passed at ≤200 and only caught 201; the cliff I flagged is gone |
| | *Beyond-budget padding caught* | **Verified** | 1 heading + 200 duplicate 200-char `Source:` lines (40 207 B) → YES; 50 headings + 200 duplicates (40 489 B) → YES |
| **N1** | [CRITICAL, R2] Healthy store read as padding → repo-wide `exit 2` on every commit | **Resolved, no regression** | The exact R2 reproducer (59 entries, 294 lines, shared `Source` **and** `Apply when`) → **`[PASS]`, exit 0**. Also no-flood at 20 / 30 / 40 / **74** entries, all-unique at 59, and with **CRLF** line endings. I specifically probed above the old break point and above the line cap |
| **N2** | [MAJOR, R2] `note` had no cap awareness | **Resolved, no regression** | Re-exercised this round: 60 budget-shaped appends stop the store at **299 lines** — the cap guard holds, inside the lock, using the lint's own `countLines` |
| **N3** | [MAJOR, R2] Injection-lesson and email `Source:` unwritable | **Resolved by human decision** | Rejections kept by design; the describe-don't-quote escape is documented in the kit skill, both bundles, `docs/core/memory-system.md` and the published guide. Unchanged this round |
| **W2** | [WARN, R2+R3] The CI fixture could not reach the size or flood path — two consecutive rounds of flood-class defects reached the verdict stage instead of CI | **RESOLVED** | `tests/fixtures/memory-store/.meowkit/memory/gotchas.md` is now **175 lines / 12 300 B** (was 1 645 B), with **33 headings but only 4 distinct `Apply when:` and 4 distinct `Source:` lines** — so it exercises the shared-field skip budget, not just the happy path. I confirmed the floor is cleared (`12 300 > 5 000`), `isFlood` is **genuinely evaluated** and returns `false`, `scanMemoryContent` returns `[]`, and the fixture lints **PASS** when copied to a temp project root exactly as `ci.yml:92-95` does. The CI step now covers the flood path for the first time |
| **R1 #6** | Documented bundle `mk-intake` path | Resolved (round 3) | **19 of 19 round-1 required changes resolved** |

### Prior resolution tables (carried forward)

**Round-1: 19 of 19 resolved.** Full file:line table in the round-2 verdict; summary table in the
round-3 verdict. Re-confirmed this round by re-running the whole suite and the whole validate lane:
(1) recursive scan surface · (2) Rule 8/9 defenses restored · (3) scan bounds + CI timeout ·
(4) guard reachable without `.claude/` · (5) write-time enforcement via `pre-ship.sh` exit 2 ·
(6) both bundles regenerated incl. the `mk-intake` paths · (7) AC-06 via Amendment 3 · (8) legacy
fallback scoped + security-log repointed · (9) locked CLI append · (10) dir-level fail-open fixed ·
(11) upgrade path · (12) gitignore drift · (13) trace field + key scrub · (14) `CLAUDE.md` rewrite ·
(15) docs sweep · (16) non-vacuous CI lint *(now complete — see W2 above)* · (17) `file-lock.ts`
fixed not deferred · (18) dead-weight registry rows · (19) review re-run (×3).

**Round-2: N1, N2, N3 all resolved** (table above; original evidence in the round-3 verdict).

## Security BLOCK status

**No BLOCK. S1, S2 and S3 remain CLEARED.** Round 2 re-demonstrated each independently; nothing in
the round-3 or round-4 diffs touches those mechanisms. Re-confirmed this round: `validate --memory`
passes as a standalone lane, the `pre-ship.sh` memory-lint hook test is **5/5**, and the intake
sanitizer test passes. S4–S9 remain resolved.

---

## Correctness — PASS

The round-4 rule meets its specification in both directions, verified against the real CLI and by
direct probing of the heuristic, not through the unit tests.

```
# R3 reproducer (a) — direct store
$ wc -lc .meowkit/memory/gotchas.md         # 294 x `Why: ` + 195a
     293   59093
$ mewkit validate --memory
  [FAIL] Memory flood: … large and highly repetitive        0 passed, 1 failed

# R3 reproducer (b) — the sanctioned note path
$ for i in 1 2 3; do mewkit note gotchas < padding-entry.txt; done
Rejected: 1 finding(s) — nothing was written.   flood: whole entry      (x3)
store: 0 lines, 0 bytes                                                  # never created

# N1 reproducer — healthy store
$ wc -l .meowkit/memory/gotchas.md          # 59 entries, shared Source + Apply when
     294
$ mewkit validate --memory
  [PASS] Team memory store lint                                          1 passed
```

I tried to break the new rule in six directions and it held in five:

| Probe | Result |
|---|---|
| Duplicate `## ` headings ×294 | **YES** — headings always count |
| Duplicate `Why:` ×294 at 199 / 200 / 201 chars | **YES** at all three — the round-3 cliff is gone |
| Duplicate `Source:` / `Apply when:` ×294 with **no** headings | **YES** — zero headings means zero budget (`used >= headings` is `0 >= 0`) |
| Shared-field duplicates **beyond** one per heading (1 heading + 200; 50 headings + 200) | **YES** both |
| Shared-field duplicates placed **before** the headings | no — the budget is global, not positional; same class as W1, smaller (20 689 B) |
| Per-heading budget spent on padding (100 unique headings + 100 dup `Source:` + 100 dup `Apply when:`) | no — **40 789 B passes.** This is W1 |
| CRLF line endings on the healthy store | no flood — `split("\n")` leaves a trailing `\r`, which `line.trim() === ""` still treats as blank and which does not disturb the `## ` / field prefix tests. No CRLF-specific behaviour change |

N1 and N2 are unaffected: the healthy-store case passes at every size I tried including **74
entries / 369 lines** (above the line cap, so it can only be reached transiently), and the cap guard
still stops the store at 299 lines.

Open MINORs are unchanged from rounds 2–3 and non-blocking: the `note` double-blank-line separator
edge; `--memory` last in the `else if` chain; 4 exported symbols with no external consumer; the
binary `side-effect-observer.ts`; the hardcoded path in `side-effect-oracle.sh:21`;
`workflow.yaml:80-85`'s mandatory `mk:memory` Reflect lead; the hook's display warning still
counting with `wc -l` (cosmetic only — the write path uses `countLines`).

---

## Maintainability — PASS

`npm run lint` and `npm run typecheck` exit 0. The round-4 change is well-shaped for the risk it
carries: the measurement rule is extracted into a named `measuredLines` helper rather than inlined
into `isFlood`, so the budget logic is testable and reviewable on its own; the comment states both
the defect it fixes ("counting them made a healthy ~40-entry store read as padding and blocked every
commit at the pre-ship hook") and the invariant it preserves ("headings and `Why:` lines are meant
to be unique and always count, and shared-field lines beyond one per heading count too, so padding
built from entry-shaped lines is still measured"). That is an honest statement of exactly what the
budget does and does not buy.

Residual items are the carried MINORs above. The fixture README explains why the grown fixture must
stay clean, which is the right place for that constraint.

---

## Performance — PASS

Unchanged. `measuredLines` adds one `filter` plus one `filter().length` over the already-split lines,
all linear. The three bounds that fixed round-1 P1/P2 are intact: bounded email pattern,
`MAX_SCAN_LINE_BYTES = 4096`, `MAX_CONTENT_BYTES = 1_000_000` gated on `statSync().size` before the
string read, plus `timeout-minutes: 5` on the CI step. Full suite duration flat across rounds 2–4;
the `2MB single line is reported, not scanned, and returns fast` test passes in 666 ms.

---

## Security — PASS · no BLOCK

N4's demonstrated vector is closed at both gates. What remains is a bounded allowance, carried as
**W1**, and I am recording a **correction to my own round-3 framing** that materially changes its
weight.

### Attribution, corrected

In round 3 I measured the residual against `main`'s `isFlood` and reported shapes where
`main = YES, current = no`. That comparison is informative about the heuristic but it overstated the
regression, because **`main` never ran a flood check on the memory store at all** — on `main` the
store was gitignored JSON behind a write contract, and `isFlood` lived in the wiki scanner guarding
*fetched pages*. On the memory-store surface this change is a **net addition** of a Rule 9 defense,
not a weakening of one. I am stating this plainly because round 1 held itself to the same standard
for the `file-lock.ts` race, and the standard cuts both ways.

I also verified which residual shapes are this change's and which are inherited, by reconstructing
`main`'s function and running both:

| Padding shape | `main` | current | Attribution |
|---|---|---|---|
| Per-heading budget spent on padding (40 789 B) | YES | no | **This change** (the budget is the FP fix) → W1 |
| Same, reordered before headings (20 689 B) | YES | no | **This change**, smaller → W1 |
| Unique-per-line `Why:` padding (58 395 B) | **no** | no | **Pre-existing on `main`** → W2 |
| Unique long `## ` headings (**295 693 B**) | **no** | no | **Pre-existing on `main`** → W2 |

### W1's residual is bounded and irreducible

The budget grants one duplicate `Source:` and one duplicate `Apply when:` per heading. Spending it
on padding yields **~41 KB** by direct write, and **~26 KB** through the sanctioned path — I measured
the latter end-to-end: 60 budget-shaped `note` calls produced **299 lines / 26 381 B** passing the
lint, stopped only by N2's cap guard. Round 3's figures were 59 KB and 48 KB, so the round-4 rule
cuts the reachable residual by roughly **45 %** and now requires one unique heading per two padding
lines rather than none.

It is also **irreducible given the human's decision.** A zero budget is exactly the round-2
behaviour that blocked every commit in the repository on a healthy store; any non-zero budget creates
precisely this allowance. The residual is the price of "Recalibrate, keep FAIL", not an oversight.

And it is **dominated by the inherited class**: W2's unique-per-line padding reaches ~296 KB through
the same heuristic, ~7× W1, and closing W1 would not touch it. Fixing W1 alone would be
disproportionate effort against the dominant exposure.

Finally, the containment that applied in round 3 still applies, and I re-verified it: **payload
delivery remains blocked** — any injection phrase inside padding is caught per-line, whole-body, and
through all five Rule 8 decode passes (base64-in-HTML-comment re-confirmed); the 300-line cap (now
enforced at write time), the 1 MB byte cap and the 4 096 B per-line cap bound the volume; and 250+
lines of `Source: aaaa…` is the most conspicuous thing a Gate 2 reviewer could encounter, in a
design whose stated primary guard is the PR diff. **Nothing was pruned**, so
`dead-weight-audit-rules.md` Rule 4 is not breached.

That combination is why I grade the dimension PASS and carry the residual as a WARN for explicit
acknowledgement rather than as the dimension's verdict.

### Re-verified this round (not re-litigated)

No credential can be echoed (secret findings are a fixed string + `file:line`; `note` prints kind +
line only — the padding rejections above printed `flood: whole entry` and nothing else). Fail-closed
on unscannable path, non-directory store, oversized file, symlink and over-depth nesting. One scan
shared by both gates — confirmed again by the `note` rejections firing on the *same* flood rule the
store lint uses. Lock sidecar outside the store. AC-08's one-line safety diff.
**Gate-authority standing item** (`gate-rules.md` "Reviewer Checklist") — this change touches
`.claude/rules/`, `.claude/agents/`, `cook/`, `fix/`, `autobuild/`, so it applies. **Answer: NO** —
no prose in this change grants approval authority to anything that is not a human, in any wording;
the round-4 additions are a comment block and tests. `validate --gates` also passes, recorded as a
floor rather than the answer.

---

## Coverage — WARN

| AC | R4 result | Basis |
|---|---|---|
| AC-01 … AC-14 | PASS | Re-confirmed by the full suite + the whole validate lane this round |
| AC-15 lint evasions | PASS | Round-2 independent run; mechanism untouched since |
| AC-16 `mewkit note` | PASS | Round-2 concurrency run + round-3/4 cap-guard and flood-rejection runs |
| AC-17 pre-ship block | PASS | `pre-ship-memory-lint.test.cjs` **5/5** on my run this round |
| AC-18 bundles | PASS | Round-3 verification; both documented `mk-intake` paths resolve |
| **AC-19 re-review** | **MET** | See below |
| AC-10 whole suite | PASS | **233 test files / 2 628 tests, all passing** (R3: 2 624 — the 4 new boundary/budget tests); lint + typecheck exit 0; lock tests **15/15 × 3 consecutive runs**; whole validate lane PASS |

### AC-19 statement

> **AC-19** — Given the finished change, when the review is re-run, then the verdict names no FAIL
> dimension and no BLOCK.

**AC-19 is MET.** This round-4 verdict names no FAIL dimension and no BLOCK. Stated plainly, because
AC-19 is the criterion most likely to be over-read: **AC-19 being met is not Gate 2 approval and is
not a recommendation to ship.** It is one binary contract criterion. The verdict is WARN, and
`gate-rules.md` requires every WARN to be explicitly seen and accepted by a human before Gate 2 can
proceed. Only a human clears the gate.

### What the new tests cover, and what they still do not

The four new tests are well-targeted and close the gap I named in round 3: `it.each([199, 200, 201])`
pins the boundary that round 3's single 325-char case left open, and the beyond-budget case tests the
rule's own mechanism. The grown fixture means a flood-class defect would now be caught by CI rather
than by a reviewer — the condition I set as W2's FAIL trigger has been addressed before a third
occurrence.

Remaining gaps:

- **The per-heading-budget shape (W1) is untested** — no test asserts what the budget *permits*, so a
  future widening of it (another field added to `SHARED_FIELDS`, or the ≤200-char cap raised) would
  not be caught. A test asserting the current allowance would turn W1 from an unguarded property
  into a pinned one.
- **The pre-existing unique-per-line class (W2) is untested** — nothing records that the heuristic
  does not detect it, so a reader may over-trust a flood PASS.
- **No AC binds documented bundle commands to the shipped file layout** — the mechanism that let
  round-1 change 6 survive two rounds. Fixed in fact, still unguarded against regression.
- **Runtime write-path coverage remains partial:** `note` directly (AC-16) and `fix` end-to-end
  (AC-14); `review`, `retro`, `architect`, `party`, `plan-creator archive` and `mk:memory` are
  documented but unexercised.
- **`isFlood`'s constants still have no recorded calibration** — now five of them (5 000, 0.3, 0.05,
  200, and the budget of 1 per heading), inherited from a scanner that guarded fetched web pages.

## Controller evidence

`ci-branch-r5/summary.txt` was not taken on trust. I re-ran the suite and the lane:

- Full suite **233 files / 2 628 tests pass**; lint and typecheck exit 0; lock tests 15/15 × 3.
- `validate --workflow --gates --parity --ownership --agents --packs --substrate --plugin --memory`,
  `inventory --check`, `docs-manifest --check`, `residue`, `depedges`, `docs-refs`, hook tests,
  `pre-ship-memory-lint` (5/5), intake sanitizer and `codex-compat` — **all PASS** on the live tree.
- **`rule-availability`: plan-dir-only, verified exhaustively again.** A repo-wide grep for the full
  `.claude/rules/<name>.md` form that the scanner matches hits exactly three files, **all
  untracked**, all inside the excluded plan dir. No tracked file references the three names in the
  matched form, and **this verdict deliberately does not either** — the round-1 wording would have
  turned a committed review artifact into a CI failure.

---

## WARN items requiring explicit human acknowledgement

Overall verdict is WARN, so these are on the "WARN acknowledged → Gate 2 eligible" path. Each carries
the 3-part justification this reviewer owes. **If a human cannot articulate all three for an item,
that item becomes a FAIL.** I have stated my reasoning; the acceptance is the human's.

**W1. The per-heading budget permits ~26–41 KB of low-entropy padding (the N4 residual — read first).**
1. *What it means:* `measuredLines` skips one `Source:` and one `Apply when:` line per `## ` heading,
   so padding shaped as one unique heading plus two duplicate ≤200-char field lines is not measured.
   Measured: ~41 KB by direct write; **~26 381 B through 60 sanctioned `note` calls**, stopped only
   by N2's cap guard.
2. *Why acceptable as WARN:* it is **irreducible given the human's "Recalibrate, keep FAIL"
   decision** — a zero budget is the round-2 behaviour that blocked every commit on a healthy store.
   It is **45 % smaller** than round 3's reachable residual and now requires interleaved unique
   headings. Payload *delivery* is still blocked by the injection scan and all five decode passes, so
   this permits context exhaustion only. Volume is bounded by three hard caps. Nothing was pruned, so
   Rule 4 is not breached. And it is **dominated ~7× by the inherited class in W2**, which closing
   W1 would not touch.
3. *What would make it FAIL:* evidence that padding can carry a payload past the injection scan; any
   shape escaping the ~41 KB bound; `SHARED_FIELDS` or the ≤200-char cap widening without a test
   pinning the allowance; or a decision that a never-prune Rule 9 defense must have no known
   allowance at all — a legitimate reading of Rule 4, and the human's to make.

**W2. A larger flood evasion is inherited from `main` and is NOT fixed by this change.**
1. *What it means:* the duplicate-line ratio cannot see padding made **unique per line**. I measured
   **295 693 B** of near-zero-entropy content in 74 unique long `## ` headings passing the lint, and
   58 395 B in indexed `Why:` lines. I verified both return `false` on `main`'s own implementation
   too — `main = no, current = no`.
2. *Why acceptable as WARN rather than a blocker for this change:* it is **pre-existing**, not
   introduced or worsened here; on the memory-store surface this change is a net *addition* of a
   Rule 9 defense (`main` had none for this store). Per the triage rule, a pre-existing MAJOR is
   incidental to the current change. It is bounded by the same three caps and the diff remains the
   primary guard.
3. *What would make it FAIL (for a future change):* promoting it to current-change scope — i.e.
   deciding the store's flood defense must be effective rather than best-effort, which would require
   an entropy- or compression-based signal rather than a duplicate-line ratio. **Recording it so a
   human does not read a flood PASS as "not padding."**

**W3. The pre-ship memory lint SKIPs visibly when no `mewkit` CLI resolves.** *(carried)*
1. *What it means:* `pre-ship.sh:88-89` prints a named SKIP and allows the ship rather than blocking.
2. *Why acceptable:* a bare `npx mewkit` would hit the registry at a commit boundary and exit
   non-zero when the package is merely absent, which the check would read as "poisoned store" — a
   false block on every consumer without the package. The SKIP is named and visible, matching the
   hook's existing degradation for a missing test script; CI and `note`'s write-time scan remain; and
   it is documented in the skill and both bundles.
3. *What would make it FAIL:* a silent skip, an advisory `exit 1` on a real finding, or evidence that
   consumers routinely ship with no resolvable CLI.

**W4. `isFlood`'s five constants have no recorded calibration.** *(carried, broadened)*
1. *What it means:* 5 000, 0.3, 0.05, 200 and the budget of 1-per-heading are unexplained magic
   numbers in a never-prune control, inherited from a scanner that guarded fetched web pages.
2. *Why acceptable as WARN:* each is now commented with the failure it addresses, the boundary
   constants are pinned by the 199/200/201 tests, and the heuristic sits behind three hard caps that
   bound a wrong constant in either direction.
3. *What would make it FAIL:* a third miscalibration, or a constant changed without a test pinning
   the boundary. Round-2 N1 and round-3 N4 both trace to this; round 4 added the first boundary
   tests, which is the right trajectory.

**W5. AC-14's journey generalisation rests on n=1.** *(carried)*
1. *What it means:* "a fresh agent session appends exactly one entry" rests on a single passing
   session; an earlier session fixed a bug correctly and wrote nothing.
2. *Why acceptable:* the fixture was verified undoctored in round 1, and the write path is now a CLI
   command with unit tests, an exercised concurrency path, a cap guard and a content gate, rather
   than an unserialized agent `Edit`.
3. *What would make it FAIL:* a fresh session against the current kit that again writes nothing.

**W6. `core/file-lock.ts` is 286 lines against the 200-line guideline.** *(carried)*
1. *What it means:* exceeds the `development-rules.md` file-size guard.
2. *Why acceptable:* it holds async and sync twins of one algorithm that must stay in lockstep;
   splitting them is how a future fix lands in one and not the other — the exact class of bug round 1
   found. The rule itself calls the limit "a maintainability guard, not a license for needless
   indirection."
3. *What would make it FAIL:* a third responsibility moving in, or the twins diverging.

**W7. The shell trace-lock twin diverges from the TS one on an unparseable pid.** *(carried)*
1. *What it means:* `append-trace.sh:130-148` treats an empty pid as dead and takes a reclaim branch
   that skips the timeout check and the sleep; the TS twin treats it as HELD.
2. *Why acceptable:* content-verified reclaim prevents stealing a different lock, and I could not
   break it — 24 concurrent shell-only appends produced 24 valid JSON lines, no loss, no stray locks,
   and the parity test passes. Blast radius is the advisory telemetry log, not the memory store.
3. *What would make it FAIL:* any observed interleaved or truncated trace line, or the same
   divergence in a writer that touches `decisions.md` / `gotchas.md`.

**W8. The AC-04 residue oracle's roots are narrower than the repo, and the dead-weight registry rows
carry no measured delta.** *(carried, merged)*
1. *What it means:* `0 hits` is scoped to `.claude/` + `packages/mewkit/src`; and every
   removed-component registry row reads `not measured (benchmark baseline deferred by owner)`.
2. *Why acceptable:* the round-1 reason the oracle could not be trusted is gone (`CLAUDE.md` matched
   its own pattern then and matches 0 now), and I verified the broader sweep independently. The
   registry rows exist — Rule 6's actual requirement — are marked **provisional PRUNE / Rule 5
   re-audit pending** rather than asserting a measurement nobody took, and the two security rows are
   correctly **KEEP / NEVER-PRUNE**. An honest "not measured" is the right artifact.
3. *What would make it FAIL:* leaning on `0 hits` as the proxy for trusting ~19 000 deletions —
   **Gate 2 must not** — or a fabricated delta, a PRUNE recorded as final, or a security component
   pruned on a "never catches anything" argument.

**W9. Scope breadth vs reviewability (recorded, not graded).** *(carried)* The diff is beyond what a
human reads at Gate 2. The width is earned — overwhelmingly deletions, most of the file count being
machine projections of kit edits, and the coupling means a partial landing would leave the kit
calling half-deleted verbs. I do not recommend splitting it. Lean on the per-finding evidence here,
not on file count and not on any single oracle.

---

## Suggestions (non-blocking)

- **Add a test asserting what the per-heading budget permits** (W1) — turns an unguarded property
  into a pinned one and would catch a future widening of `SHARED_FIELDS` or the ≤200-char cap.
- **Record in the `isFlood` comment that unique-per-line padding is not detected** (W2) — the
  heuristic is best-effort and a reader should not infer "not padding" from a flood PASS. If the
  class is ever worth closing, an entropy or compression-ratio signal is the shape, not a line ratio.
- Record the rationale for the five constants next to them, and consider different values for
  authored entries than for fetched content (W4).
- Add an AC (or a test) binding each documented bundle command to the shipped file layout, so
  round-1 change 6's class cannot regress.
- Bring the shell lock twin to parity: treat an empty/unparseable pid as HELD, and move the timeout
  check above the reclaim `continue` (W7).
- Mention the bare-email rejection in the `Source:` guidance, or report the pattern **name** (never
  the match) so an author can tell a false positive from a real leak.
- Carried and still open: `/mk:memory --retract` and a "contradicted by current behaviour" prune
  reason; drop or instrument the unevaluable "180 days with no recent hit" clause; make `mk:memory`
  a conditional Reflect lead in `.claude/workflow.yaml:80-85`; de-export the 4 unconsumed symbols;
  write `"\u0000"` as an escape in `side-effect-observer.ts`; route `side-effect-oracle.sh:21`
  through `meowkit_state_dir`; fix the `note` double-blank separator edge; cite the TS line-cap
  constant from the hook's display warning instead of re-typing `300`.
- Record a gotcha that `tasks/reviews/` is swept by the rule-availability scanner, so a future
  verdict naming a deleted rule by full path does not turn the review artifact into a CI failure.

---

## Artifact Verification

- **Level 1 (Exists):** PASS — lint and typecheck exit 0; full suite 233 files / 2 628 tests pass.
- **Level 2 (Substantive):** PASS — no stub patterns in the round-4 diff; the new logic is a named
  helper plus a comment that states both the defect it fixes and the allowance it grants.
- **Level 3 (Wired):** PASS — `measuredLines` → `isFlood` → `scanMemoryContent:85` → **both** gates
  (confirmed by the `note` rejections firing on the same rule as the store lint); the grown fixture →
  `ci.yml:92-95`. 4 symbols remain exported with no external consumer (MINOR, carried).
- **Level 4 (Data Flowing):** PASS — **the carried caveat is now closed.** The CI fixture is 12 300 B,
  clears the 5 000-char floor, and `isFlood` is genuinely evaluated on it (`false`, findings `[]`), so
  the step exercises the flood path rather than short-circuiting. `pre-ship.sh` consumes the exit code.

## Self-Check Before Gate Presentation (`gate-rules.md`)

**Completed:** all 5 dimensions re-evaluated against the human's decisions rather than my own earlier
recommendations; both round-3 N4 reproducers re-run end-to-end (direct store **and** the `note`
path); the N1 reproducer re-run plus regression probes at 20/30/40/59/74 entries, all-unique, and
CRLF; the 199/200/201 boundary re-measured; **six independent new-bypass probes** against the new
rule (duplicate headings, no-heading shared fields, beyond-budget, reordered, per-heading budget,
unique-per-line); residual attribution established by reconstructing and running `main`'s own
`isFlood`; W1's residual measured end-to-end through 60 sanctioned `note` calls; W2 verified by
confirming the fixture clears the floor and `isFlood` is actually evaluated; full suite, whole
validate lane and lock tests ×3 re-run; the controller's `ci-branch-r5` reading independently
confirmed including an exhaustive repo-wide rule-availability source check; gate-authority standing
item answered; 4-level artifact verification.

**Skipped, with justification:**
- The JSON proof bundle and `tasks/backlog/review-backlog.md` — write permission is scoped to this
  file. Incidental findings (notably W2's pre-existing class) are inlined rather than dropped.
- End-to-end execution of `pre-ship.sh` against a failing store — this repo's own pre-ship hook
  intercepts the test invocation (correct behaviour). The chain is established without it: the hook's
  5/5 test proves it blocks on a non-zero `validate --memory`, and the exit codes are shown above.
- Re-litigating S1–S3, the 19 round-1 changes and N1–N3 — the round-4 diff touches only `isFlood`,
  its tests and the fixture; I re-ran the suite and lane that cover the rest, and re-ran the N1/N2
  reproducers specifically to check for regression.
- `mewkit review coverage` / `compose` — branch-diff mode, not an assured-PR session; no
  `evidenceLevel` is claimed and none should be inferred.

**Uncertain — flagged for the human, not resolved by me:**
- Whether W1's bounded allowance is acceptable, given Rule 4's never-prune status for Rule 9
  defenses. I grade it PASS-with-WARN because nothing was pruned, the allowance is the irreducible
  cost of the mandated FP fix, and it is dominated ~7× by the pre-existing class in W2. A stricter
  reading of Rule 4 is defensible. **This is the one decision that belongs to the owner.**
- Whether W2's pre-existing ~296 KB class should be opened as its own tracked task rather than left
  as an inherited limitation of the heuristic.
- Whether `isFlood` should use different constants for authored memory entries than for fetched web
  content — three rounds of findings now trace to the inherited values.

**Nothing in this file constitutes approval.** AC-19 being met is a contract criterion, not a gate
clearance. Gate 2 remains closed; a human must read this evidence, acknowledge W1–W9, and decide.

## Gate 2 — human decision

- Date: 2026-11-01
- Human response (verbatim): "Approve, ack all WARNs"
- Scope: round-4 verdict above, bound to HEAD 4dfa98a2; W1–W9 each acknowledged.
- Recorded by the controller agent; this entry records a human decision and grants nothing beyond it. Shipping still requires an explicit ship request.

## Format note (post-approval)

- 2026-11-01: the Dimension Summary table was reordered so the round-4 result is the first data
  column and the round 1–3 results sit in a trailing history column; one prose sentence ("no
  dimension failed and no security block remains") and the Security row's "both gates" (now
  "both checkpoints") were reworded. Reason: the Gate 2 structural parser read the round-1 history
  cells and those phrases as current FAILs. No finding, grade, WARN or decision changed. Done at the
  human's request ("Reformat and commit").
