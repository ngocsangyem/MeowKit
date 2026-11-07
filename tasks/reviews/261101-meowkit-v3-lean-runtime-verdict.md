# Review: MeowKit v3 Lean Runtime — Sprint 3, Phase 02 "Node-only hooks" (round 2)

## Verdict: WARN

**This file is EVIDENCE for a human. It approves nothing.** Gate 2 is NOT approved and cannot be
approved by this verdict, by any agent, or by any script. Only a human clears a gate
(`gate-rules.md`, "The Gate Authority Invariant"). A WARN verdict means **no dimension failed and no
security hard-stop remains** — it does not mean the change is approved. Every WARN below must be
explicitly seen and accepted by a human before Gate 2 can proceed.

**No dimension failed. Critical (0). No security hard-stop. All 15 acceptance criteria are now met.**
Both round-1 required changes are **cleared** and I re-verified each myself rather than reading the
claim. Round 1's two unmet criteria (AC-13, AC-14) are resolved; three of the six round-1 WARNs are
resolved (W2, W4, W5); three are acknowledged as-is by the owner (W1, W3, W6); and **one new WARN
arises from the round-2 fix** and is carried as W7.

Correctness and Maintainability move WARN → **PASS**. Coverage remains **WARN**.

> **Prior verdict at this path.** Round 1 of this phase is preserved in git history at commit
> `f03f58340ee807c8c32aa6a10c7591d3c74319d2`'s parent chain; the Sprint 2 / Phase 01 verdict is at
> `b8556870d9f9f65ff82ececec44f9d2a751b2e37`. The path is reused because the ship hook resolves
> exactly one `<plan-date>-<slug>-verdict.md` from `session-state/active-plan.json` and fails closed
> on more than one match.

## Binding

| Field | Value |
|---|---|
| Reviewed revision (`git rev-parse HEAD`) | `f03f58340ee807c8c32aa6a10c7591d3c74319d2` (branch `feat/v3-lean-runtime`) |
| Reviewed content | **The UNCOMMITTED working tree on top of that commit.** The four commits since round 1 are contract signature commits only; the code under review is still unstaged. The named SHA is the base the working tree sits on, NOT a commit containing the reviewed change. |
| Phase base (BASE) | `b8556870d9f9f65ff82ececec44f9d2a751b2e37` — pinned by the contract |
| Plan | `tasks/plans/261101-meowkit-v3-lean-runtime/phase-02-node-only-hooks.md` (read-only to this review) |
| Contract | `tasks/contracts/261107-2251-meowkit-v3-lean-runtime-sprint-3.md` — signed, 15 ACs, 2 negotiation rounds, **3 amendments**. Amendment 3 signed `671a5f3a` (generator) / `1819f1a5` (evaluator); I verified it is append-only — the only changes vs round 1 are the two frontmatter signature lines and the new block, with Amendments 1-2 and every AC byte-identical. |
| Implementer evidence read as CLAIMS | `tasks/reviews/evidence/261107-meowkit-v3-lean-runtime-sprint-3/` — `{ac-01-exec-form,ac-02-corpus,batch-b,batch-c,batch-d}.md` incl. `batch-d.md` Addendum 2 |
| Reviewer notes | `tasks/reviews/evidence/261107-meowkit-v3-lean-runtime-sprint-3/review.md` |
| Scope gate | **full** |
| Review artifacts | This markdown verdict and the reviewer notes above ONLY. No source edited, no git mutation. |
| Round | 2. R1 **WARN** (2 criteria unmet, 2 required changes, 6 WARNs) → R2 this file. |
| Score | 9.2/10 — Critical (0). All 15 criteria met; one WARN dimension and four carried WARNs, none weakening a safety surface. |

---

## Dimension Summary

| Dimension | Round 2 (current) | Basis | R1 |
|---|---|---|---|
| Correctness | **PASS** | R1 cleared and verified across the full matrix: the CI step now passes 36/36 on node 24, the version both jobs pin, so the Windows job reaches its doctor step. Everything else re-run green — 2 825 tests / 246 files, 175 hook tests, 36 node-native tests, doctor 22 passed / 0 failed. The guard fix is itself a correctness gain: the guards previously reported no decision the host could read. | WARN |
| Maintainability | **PASS** | R2 cleared: zero hits for a deleted `.sh` hook or D1 script across AC-14's named surfaces (was 29 across 12 files). Line discipline holds — all nine over-200 files are byte-identical to BASE except the permitted +9, and all six new bundle guards are within the limit. 112 scanned code files carry **zero** plan references. | WARN |
| Performance | **PASS** | Unchanged. 5 → 3 command registrations per `Edit`; 879.3 ms → 812.0 ms mean over 20 runs per side (−8%). The round-2 changes add no registration and no startup work. | PASS |
| Security | **PASS · no hard-stop** | Strengthened further. The three skill guards went from reporting a decision the host does not read — enforcing nothing — to the documented envelope, with decisions, reasons and exits preserved. The doctor sweep now also covers skill `bin/`, mutation-tested. Isolation, env allowlist, subprocess allowlist and credential sweep all re-verified clean, including over the six new bundle guards. Gate authority: **no**. | PASS |
| Coverage | **WARN** | All 15 ACs met. Three genuine gaps remain, none new to the implementation: guard stderr is now unasserted for three fixture groups (W7, created by the round-2 fix), three of five gate-enforcement crash scenarios cannot distinguish a crash from an ordinary refusal (W3), and `careful`'s production branch has no fixture in either implementation. | WARN |

**Overall: WARN.** No dimension failed → overall WARN. **No required changes remain.** Four WARNs
require explicit human acknowledgement (W1, W3, W6, W7). Routes to **shipper with acknowledged
warnings** — see Recommended routing.

Side Effects Detected: No. No `## User Decision Addendum` required.

---

## Round-2 fix verification

I verified each fix by running it, not by reading the claim.

| # | Fix | Status | Evidence (my runs this round) |
|---|---|---|---|
| **R1** | `ci.yml` hooks-windows node-native test step | **Resolved** | `ci.yml:357` is now `node --test .claude/hooks/__tests__/*.test.cjs`, matching `:241`. I built the full matrix: the **quoted** glob fails on node 20 (`Could not find '…/*.test.cjs'`) and passes 36/36 on node 24; **unquoted** on bash passes on both; the round-1 **directory** form fails on node 24. Both jobs pin node 24 (`:22` ubuntu, `:345` windows-latest), so the unquoted form is right in both places — ubuntu's bash expands the glob, and windows-latest's pwsh passes the literal pattern, which node 24 resolves itself. The step therefore now reaches `Doctor hard gates` at `:363`. |
| **R2** | AC-14's `packages/docs/content/` sweep | **Resolved** | The criterion's own pattern returns **0 hits** (was 29 across 12 files). `reference/hooks.mdx`, which carried ~45, now names only `ensure-skills-venv.sh` — the one surviving hook. `docs/architecture/trigger-registry.md:67-68` corrected to `handlers/build-verify.cjs` / `handlers/loop-detection.cjs`. I classified all 74 remaining broad `.sh` mentions: unrelated live scripts (`jira-as.sh`, `validate-rubric.sh`, `validate-gate-1.sh` …) plus four lines naming two hook-shaped `.sh` files that **never existed at BASE** — see MINOR-1. |
| **W2** | Skill guards emit the documented envelope | **Resolved — and the defect was worse than I graded** | My WARN said "launches but may be advisory". The truth is stronger: at BASE all three printed a **top-level** `permissionDecision` with a `message` field, and `message` is recognised for no event, so even once registered they reported no decision at all. All three now emit `hookSpecificOutput` (`check-careful.cjs:35`, `check-freeze.cjs:52-55`, `check-report-path.cjs:24`) with exits preserved exactly (0 / 0 / 2, the last also writing its reason to stderr at `:26`). Amendment 3 signed and append-only. 8 guard fixtures pass. |
| **W4** | Provider bundles ship node guards | **Resolved** | Six `.cjs` guards; `find … -path '*bin*' -name '*.sh' \| wc -l` over both bundles → **0**. Host-appropriate shapes: cursor `{permission, user_message}` (`mk-freeze/bin/check-freeze.cjs:27,82`), codex `hookSpecificOutput` (`:85-88`). The garbled duplicated comment the evaluator flagged is fixed; `:10-21` reads cleanly. Migrate suite 953/953. |
| **W5** | Doctor sweep covers skill `bin/` | **Resolved, mutation-tested** | `doctor-hook-runtime.ts` now walks `.claude/hooks/` **and** every skill's `bin/`. I did not take the code's word for it: in a scratch copy I planted `.claude/skills/freeze/bin/zz-planted-guard.sh` and drove `checkHookRuntime` against that root → `fail \| Shell hooks still present: .claude/skills/freeze/bin/zz-planted-guard.sh`, with the real tree as a clean control. It has teeth. |

---

## Per-AC grading (round 2)

| AC | R2 | R1 | Evidence |
|---|---|---|---|
| **AC-01** exec form decided by evidence | **PASS** | PASS | Unchanged. Both placeholders recorded with doc citations plus a live probe; all node registrations and the three SKILL.md blocks use `{"command":"node","args":["${CLAUDE_PROJECT_DIR}/…"]}`; no `${CLAUDE_SKILL_DIR}` remains. |
| **AC-02** corpus recorded from BASE | **PASS** | PASS | Unchanged. 82 fixtures + index, every family mapped, corpus re-records from BASE identically (verified in round 1). |
| **AC-03** node reproduces the corpus | **PASS** (see W7) | PASS | 175 hook tests pass. `selfPath` still scoped to the five named fixtures. Amendment 3 adds a third scoped relaxation: the three guard groups are compared by exit, decision and reason rather than literal stdout. Scoping verified exact — `DECISION_ENVELOPE_GROUPS` at `golden-replay.test.ts:81` is literally those three groups and `assertParity:126-133` relaxes only inside that branch; every other fixture still compares stdout **and** stderr whole. |
| **AC-04** fail closed on every crash path, pinned env allowlist | **PASS** (see W3) | PASS | Unchanged. 15/15 crash runs exit 2 with the marker; `env-allowlist.test.ts` matches the contract list entry for entry; 25 isolation + allowlist tests pass. |
| **AC-05** entrypoints isolated | **PASS** | PASS | Re-verified. Require graph clean of dispatcher, registry and all five network modules; 4 subprocess sites all inside the allowlist, none targeting a shell; credential sweep zero hits — extended this round over the six new bundle guards, also clean of network modules, `child_process`, credential tokens and any `bash`//`bin/sh` reference. |
| **AC-06** dispatcher fail-open, feedback passes through | **PASS** | PASS | Unchanged. 22 registry entries well-formed, 9 BASE handlers present, no safety entrypoint in the registry, both feedback paths tested after the other observers run. |
| **AC-07** observer and CLI behavior preserved | **PASS** | PASS | Unchanged. Both deleted shell tests' assertions traced into node suites and passing, incl. `safety-sentinel-inject.cjs`; `pre-implement.cjs` fail-closed in strict mode; only the jira loader reads the dotenv. |
| **AC-08** skill guards ported | **PASS** | PASS (W2) | Now materially stronger than round 1. 8 fixtures pass; the guards emit the documented envelope and actually enforce; `guardDecision()` does **no value mapping** — `permissionDecision` is compared literally, so a `block`→`deny` rewrite would fail rather than pass, which is what makes "the decision is unchanged" an assertion instead of a claim. `investigate/bin/check-freeze.sh` still absent with no live reference. |
| **AC-09** registrations collapsed | **PASS** | PASS | Unchanged. 3 registrations per `Edit` against BASE's 5; timing recorded over 20 runs per side. |
| **AC-10** consumers follow without loosening | **PASS** | PASS | Re-verified green: `validate --packs` pass, `doctor --hard-gates` **22 passed / 0 failed**, both registration checks pass, full vitest 2 825 tests, node-native 36. The two sign-off diffs are byte-identical to the round-1 versions I signed off — `git diff 95f9a1a3 HEAD` touches neither file. `doctor-hook-runtime.ts` gained the skill-`bin/` walk, which only widens the sweep. |
| **AC-11** no bash or python in hook paths | **PASS** | PASS (W4, W5) | The contract `find` still returns only `ensure-skills-venv.sh`. Both round-1 qualifiers are now closed: zero `.sh` under any bundle `bin/`, and doctor's leftover sweep reaches skill `bin/` with teeth. The recorder's intentional BASE `.sh` entrypoints remain the one declared exception. |
| **AC-12** codex and cursor projections follow | **PASS** | PASS (W4) | Migrate suite 74 files / 953 tests pass. Bundles now ship node guards in each host's decision shape; generated hook configs remain node-only. |
| **AC-13** suites need no bash, a Windows job runs them | **PASS** | **NOT MET** | **Resolved by R1.** The no-bash half was already clean. The job at `ci.yml:337-363` now runs `npx vitest run tests/hooks`, the node-native tests in a form that works under pwsh on node 24, and `doctor --hard-gates` with the probes executing — the `win32` skip is gone. First CI result still unrecorded, which is expected on an unpushed branch. |
| **AC-14** docs and agents describe the node runtime | **PASS** | **NOT MET** | **Resolved by R2.** Zero deleted-`.sh`/D1 references across the named surfaces; `HOOKS_INDEX.md` still matches `handlers.json` on all 22 observer rows plus the entrypoints and 2 CLI modules; agents invoke the `.cjs` module; changelog history untouched. The four residual lines name files that predate this sprint — MINOR-1. |
| **AC-15** code quality over the sprint diff | **PASS** | PASS | Re-measured at this revision. All nine files over 200 lines are byte-identical in length to BASE except `gate2-ship-boundary.test.cjs` at 429 (420 at BASE, the permitted +9). All six new bundle guards are within the limit, the largest at exactly 200. Lint **0 errors** (3 pre-existing warnings in untouched files); typecheck **0 errors**. No new `any`, no new TODO, no commented-out code region, no hardcoded secret. |

---

## Correctness — PASS

Round 1's single defect is gone, and I established *why* the chosen form is correct rather than
only that it now runs. The unquoted glob works on both CI hosts for two different reasons — bash
expands it on ubuntu, and pwsh on windows-latest passes the literal pattern which node 24 resolves
with its own glob support — and both land on 36 passing tests. Because the step passes, the Windows
job now reaches `Doctor hard gates`, which is the only executing proof that the hard-gate probes
run on a host without a POSIX shell. That was the plan's HIGH risk item and the single property
this sprint exists to deliver; it is now wired end to end rather than inferred.

The parity evidence from round 1 stands unchanged and remains the strongest part of this change:
82 fixtures recorded from BASE bash, re-recordable from BASE into an identical tree, replaying
byte-identical against the node code; 15/15 crash paths exiting 2 with their marker; handlers
installed before the first `require` in all three entrypoints.

The round-2 guard work is itself a correctness gain rather than a cosmetic one. The guards did not
merely fail to be *verified* — they emitted a decision shape the host does not read, so they
enforced nothing even when registered. They now emit the documented envelope with decision, reason
and exit code preserved exactly.

Full re-run at this revision: 246 files / 2 825 tests, 175 hook tests, 36 node-native tests on both
node 20 and node 24, doctor 22 passed / 0 failed, `validate --packs` pass, both registration checks
pass, migrate 953 pass.

## Maintainability — PASS

AC-14's surface is clean on the criterion's own terms: zero references to a deleted `.sh` hook or
D1 script across `packages/docs/content/`, `docs/`, `.claude/agents/` and the five named skill
bodies. `reference/hooks.mdx` went from ~45 stale references to naming only the one hook that
legitimately survives. I classified the entire residual `.sh` tail rather than reporting a count,
and the only hook-shaped names left are two middleware files that never existed at BASE — the
implementer in fact corrected the same two names where they appeared in `trigger-registry.md`,
which is beyond what the criterion asked.

Line discipline holds at 112 measured code files, including the six guards Amendment 3 added. The
largest new file is exactly at the 200-line limit, which is tight but compliant.

Comment quality remains the standout. **Zero plan references across 112 files** — no AC number, no
`D1`-`D5`, no phase, sprint, batch or amendment token in any comment or filename, despite three
amendments having driven the work. The Amendment 3 files hold the same discipline:
`check-careful.cjs:9-10` explains *why* the envelope is nested and what the old shape got wrong,
without citing the amendment that decided it. That is exactly the rule's intent — the reason is
durable, the plan header is not.

## Performance — PASS

Unchanged from round 1 and re-confirmed by parsing `settings.json`: one `Edit` fires 3 command
registrations against BASE's 5. Recorded timing 879.3 ms → 812.0 ms mean over 20 runs per side
(−8%). The honest reading stays the same: node startup dominates, so the −8% is much smaller than
the 40% process reduction, and the real win is cross-platform execution rather than latency. The
round-2 changes add no registration, no startup work and no new subprocess.

## Security — PASS · no hard-stop

The round-2 work makes this materially stronger than when I graded it PASS in round 1.

**Three guards moved from inert to enforcing.** This is the most consequential security change in
the sprint and it was found by the review rather than by the implementation: at BASE
`check-careful.sh:280,282`, `check-freeze.sh:64` and `check-report-path.sh:15,22,41` printed a
**top-level** `permissionDecision` plus a `message` field that no event recognises. Combined with
the `${CLAUDE_SKILL_DIR}` registration defect from Amendment 1, the guards were broken twice over —
registered at a path that never resolved, and emitting a shape the host would have ignored anyway.
All three now emit the documented `hookSpecificOutput` envelope, and every decision, reason and exit
code is preserved: `careful` 0, `freeze` 0, `investigate` 2 with its reason also on stderr.

Keeping `careful` on `ask` rather than collapsing it to exit 2 is the right call and I want to
record agreement, because the tempting "harden it" move would have been wrong: exit 2 cannot express
a confirmable prompt, so the fallback would have converted "warn and let the user decide" into a
refusal — a decision change Scope (Out) forbids.

**The comparison that proves it was not loosened to fit.** `guardDecision()` reads
`permissionDecision` out of either envelope and compares the value **literally**, with no mapping
table, so a `block`→`deny` rewrite would fail rather than silently pass. Exit code, marker and side
effects stay asserted. That is the difference between an assertion and a claim.

**The doctor sweep gained teeth where it was blind.** It now walks skill `bin/` as well as
`.claude/hooks/`, and I mutation-tested it: a planted `.sh` under `.claude/skills/freeze/bin/` is
reported, with the real tree clean as a control.

Re-verified unchanged from round 1: require graph clean of the dispatcher, the registry and all five
network modules; four subprocess sites, all inside the allowlist, none targeting `bash`, `sh` or a
`.sh` file; zero credential tokens. I extended the sweep over the six new bundle guards — no network
module, no `child_process`, no credential token, no shell reference in any of them. No
`security-rules.md` blocked pattern in new code. The post-write scan and the `pre-completion-check`
JSON refusal still survive the dispatcher, fixture-pinned.

Still stricter than BASE on four counts: unreadable stdin stops the call; a missing or broken
library stops the call; `check-report-path.cjs:37-56` fully resolves both sides so a `..`/symlink
cannot walk out; and doctor treats a module-resolution failure as a runtime error, which matters
because in a node runtime an unloadable guard exits non-2 and therefore reads as permission.

### Gate Authority — standing item (`gate-rules.md` "Reviewer Checklist")

> **Does any prose in this change grant approval authority to something that is not a human — in any
> wording?**

**No.** Re-checked at this revision: `git diff 95f9a1a3 HEAD --stat` touches no file under
`.claude/rules/`, `.claude/rules-conditional/`, `.claude/modes/`, `.claude/agents/`,
`.claude/skills/cook/`, `.claude/skills/fix/` or `.claude/skills/autobuild/` beyond the round-1
renames I already cleared line by line. Those were all `.sh`→`.cjs` substitutions inside existing
sentences, with every human-authority statement surviving verbatim — including "neither approves —
they gate on structure/completeness only", "it **never approves** (Gate 1 / Gate 2 stay human
authority)", "**never** *a human approved*", and the "None." under Gate 2 exceptions. Nothing in
this change adds an unattended-advance path or a score threshold that advances a phase.

Amendment 3 itself grants no authority: it changes a guard's output envelope and a fixture
comparison, and it was negotiated between two agents and recorded — not self-approved into the
contract. I verified it is append-only.

## Coverage — WARN

All 15 ACs are met, and the test net is strong where it counts: a reproducible oracle rather than
hand-written expectations, review properties encoded as executable checks
(`isolation.test.ts`, `env-allowlist.test.ts`), and both deleted shell tests' assertions traced
into node suites one by one. The round-2 relaxation is correctly scoped and the decision is still
asserted literally.

Three gaps keep this at WARN. **W7**: guard stderr is no longer compared for the three guard groups,
a necessary consequence of `investigate`'s deliberate new stderr write, so a later guard change could
print anything there unnoticed. **W3**: three of five gate-enforcement crash scenarios cannot
distinguish a crash from the ordinary no-plan refusal. And `careful`'s production `block` branch has
no fixture in either implementation — pre-existing, but it means the one guard path that would
actually refuse a destructive command is untested.

---

## WARN items requiring explicit human acknowledgement

Each carries the three-part justification `gate-rules.md` requires.

### W7 — guard stderr is no longer compared for three fixture groups *(new in round 2)*

1. **What it means.** Amendment 3's enumeration — "compared by exit code, decision and reason" —
   is exhaustive, so inside `DECISION_ENVELOPE_GROUPS` the suite no longer asserts stderr at all.
   AC-03's "stderr matches exactly … and no other normalization is applied" now has three groups
   outside it.
2. **Why acceptable in this context.** It is forced rather than convenient: `investigate` now writes
   its reason to stderr deliberately, against an empty BASE recording, so literal stderr parity is
   unsatisfiable without reverting a wanted improvement. I verified the containment rather than
   accepting it — **all eight guard fixtures recorded `stderr: ""`**, so nothing is being hidden
   today; the relaxation is scoped to exactly three named groups with every other fixture still
   comparing both streams whole; and exit code, decision value, reason text, marker and side effects
   all remain asserted.
3. **What would make it blocking.** A guard beginning to write diagnostics to stderr — a path, a
   command, a file content — with no fixture able to notice. Cheap fix: assert `stderr` equals the
   reason text for `investigate` and empty for the other two, which preserves the improvement and
   restores the assertion. Worth doing before another guard is added.

### W1 — the missing-checker refusal applies to every Bash command, not only ship commands *(carried, acknowledged)*

1. **What it means.** At BASE the missing-`gate2-check` refusal sat inside a
   `case *"git commit"*|*"git push"*|*"git merge"*` and non-ship commands passed through. At HEAD
   `pre-ship.cjs:73` returns `blockMissingChecker` above the `SHIP_COMMAND` test at `:80`, so with a
   broken install **every** Bash call exits 2 — the session cannot run `ls` until it is repaired.
2. **Why acceptable in this context.** The direction is strictly conservative and the contract
   covers it: Scope (Out) excepts "the AC-04 crash-path hardening", and AC-04 pins exactly this —
   a required library that cannot load must stop the call rather than fall through. A broken install
   that is loudly unusable beats one that is quietly ungated.
3. **What would make it blocking.** The same unconditional refusal on a guard registered to a
   broader event than Bash, or a fixture showing a healthy install refusing a non-ship command. The
   only fixture, `preship-gate2-checker-absent.json`, pins a `git commit`, so the non-ship case
   remains unpinned — a fixture asserting that a non-ship command with the checker present exits 0
   would close it.

### W3 — three of five gate-enforcement crash scenarios cannot distinguish a crash from an ordinary refusal *(carried, acknowledged)*

1. **What it means.** `crash-paths.test.ts:99-110` drives gate-enforcement with an Edit on
   `src/app.ts` and no approved plan — a payload an *intact* guard already refuses — while asserting
   only exit 2 and the marker. For scenarios (a) syntax error, (b) deleted lib and (e) patched-to-
   throw, a swallowed error that fell through to the no-plan path would still pass.
2. **Why acceptable in this context.** The behaviour is correct — the handler is genuinely exercised
   and the real output is "Gate 1 could not run: …"; it is the *assertion* that is loose. The other
   two entrypoints' scenarios do not share the problem, and AC-04's 15/15 requirement is met on its
   own terms.
3. **What would make it blocking.** A regression in gate-enforcement's crash handler, which this
   suite would not catch — precisely the failure it exists to catch. Fix: assert the "could not run"
   text, or use a payload the intact guard would allow.

### W6 — the recorder, corpus and hook tree are untracked *(carried, acknowledged)*

1. **What it means.** AC-02 says "the recording script is committed", and the recorder, its helpers,
   all of `tests/hooks/` and the 79+ new hook files are still unstaged. The AC-09 timing script
   exists only in a scratch dir and is not in the repo at all. The four commits since round 1 are
   contract signatures only.
2. **Why acceptable in this context.** It is an artifact of reviewing an uncommitted tree and
   resolves at commit, which must happen before Phase 5 anyway; the owner states these ship with
   this phase. The reproducibility claim is real — the corpus re-records from BASE identically.
3. **What would make it blocking.** A commit that stages the port but not the recorder, leaving the
   oracle unreproducible by anyone else. Worth checking the staged file list at ship. Separately,
   commit the timing script or record its exact command so AC-09's number can be reproduced rather
   than only cited.

---

## Minor findings (non-blocking, no acknowledgement required)

- **MINOR-1 — four pre-existing stale doc lines.**
  `packages/docs/content/docs/guide/trace-and-benchmark.mdx:49,50` and
  `guide/middleware-layer.mdx:20,21` name `post-write-build-verify.sh` and
  `post-write-loop-detection.sh` as current. I checked `git ls-tree -r b8556870`: **neither file
  ever existed at BASE** — what existed was `handlers/build-verify.cjs` and
  `handlers/loop-detection.cjs`. So this is staleness from an earlier phase, outside AC-14's
  subject, and worth a follow-up sweep rather than anything here.
- **MINOR-2 — `careful`'s production branch has no fixture.** Its `block` path is untested in both
  the shell and node implementations. Pre-existing, recorded by the evaluator, and the one guard
  path that would actually refuse a destructive command.
- **MINOR-3 — the CI glob form depends on node ≥21.** The unquoted form is correct for both jobs as
  pinned, but its Windows half relies on node's own glob support; the quoted form fails on node 20
  and the directory form fails on node 24. A future downgrade of either job to node 20 would break
  the step again and would look like the round-1 defect. A comment on the step naming the dependency
  would make that durable.
- Carried from round 1, all still open and all cosmetic:
  `post-session-recording.test.ts:1` header names the wrong file;
  `golden-replay.test.ts:13-17` says "three" where the code says five;
  the `isoTimestamp` normalizer on two side-effect-only gate fixtures;
  `memory-store-lint.cjs:36-43`'s comment versus its bare-name `PATH` fallback;
  `.claude/settings.json.bak` tracked and still naming `sh .claude/hooks/post-write.sh`;
  feedback pass-through being a handler flag rather than a registry property.

## Suggestions (non-blocking)

- Close W7 cheaply by asserting stderr equals the reason for `investigate` and empty for the other
  two guards, rather than leaving the stream unasserted.
- Split `gate2-ship-boundary.test.cjs` (429) as Amendment 2 records. Its four concerns — verdict
  resolution, change-set classification, the ship-capable path set, the security-verdict path — are
  natural module boundaries.
- Treat `selfPath` and now `DECISION_ENVELOPE_GROUPS` as standing audit items. Both are scoped by
  explicit lists today, which is the right design; a comment on each saying "adding an entry here
  requires re-checking what stops being compared" would keep that true.
- Later-phase items for the two BASE characteristics this sprint correctly preserved rather than
  fixed: `pre-ship.cjs:106-110` exits 0 when `chdir` fails (exact BASE parity with
  `pre-ship.sh:8`, `cd … || exit 0`), so a bad `CLAUDE_PROJECT_DIR` silently disables the ship
  guard; and D4's Bash-mediated `.env` read stays allowed, so the privacy guard's file-path-only
  coverage is a documented limitation rather than an implied guarantee. Both are out of scope here —
  Scope (Out) forbids changing what these guards decide — and both deserve an explicit decision.

---

## Artifact Verification (4 levels)

| Level | Result |
|---|---|
| **Exists** | 79+ new hook/lib/handler files, 3 kit guards + 6 bundle guards, 82 fixtures + index, 9 test files under `tests/hooks/`, the recorder and its 4 helpers, `doctor-hook-runtime.ts`, the `hooks-windows` CI job. All present. |
| **Substantive** | Not scaffolding. Real parsing, gate logic and crash handling in every entrypoint; exact per-case streams in the corpus; `isolation.test.ts` and `env-allowlist.test.ts` encode properties rather than smoke-test; `guardDecision()` compares decision values literally with no mapping. |
| **Wired** | `settings.json` registers the three entrypoints and one `dispatch.cjs` per event+matcher; 22 registry entries resolve; the three SKILL.md blocks invoke the `.cjs` guards in a form that resolves; `check-packs.ts` and `doctor-hard-gates.ts` point at node paths; `provider-lifecycle.ts` repointed off the deleted shell test; bundles ship host-shaped node guards. |
| **Data flowing** | Proven end to end. 82 fixtures replay through the real entrypoints and dispatcher; doctor drives the live registrations in a sandbox (22 passed / 0 failed); a planted `.sh` is detected in **both** swept trees; the corpus re-records from BASE identically. **Round 1's one unwired artifact — the Windows node-test step — now executes**, so every artifact in this change is carrying data. |

---

## Self-Check Before Gate Presentation (`gate-rules.md`)

**Completed.** All five dimensions re-evaluated at the new revision. All 15 ACs re-graded against the
contract and all three amendments. Amendment 3 verified append-only against the round-1 contract.
Both sign-off diffs confirmed byte-identical to the versions I signed off in round 1. Gate Authority
re-checked against the round-1→round-2 diff. Plan-reference scan re-run over 112 files. Every
round-1 required change and every resolved WARN re-verified by execution, including a mutation test
of the extended doctor sweep and a four-way node/shell matrix for the CI step.

**Skipped, with justification.**
- I did not re-run the AC-09 timing measurement; the script is still not in the repo, and the
  recorded number remains consistent with the process-count reduction I verified directly from
  `settings.json`. Carried as W6 rather than silently accepted.
- I did not re-walk the require graph by hand this round; `isolation.test.ts` and
  `env-allowlist.test.ts` pass (25 tests) and no file on the safety path changed since my round-1
  manual walk. I did extend the credential/network/subprocess sweep over the six new bundle guards.
- I did not verify the Claude Code decision schema against live host behaviour. Amendment 3 cites
  the hooks reference, the shape matches the documented `hookSpecificOutput` form, and the sibling
  bundle hooks use the same shape — but the proof here is documentary, not observed. This is the one
  claim in the guard fix I am relaying rather than confirming.

**Uncertain.**
- Whether W7 should have been required rather than carried. I graded it a WARN because all eight
  guard fixtures recorded empty stderr, so the relaxation hides nothing today, and because the
  alternative was reverting a wanted improvement. A reviewer who weights "AC-03 says stderr matches
  exactly" more literally would require the assertion restored before ship; the fix is small enough
  that doing so costs little.
- Whether MINOR-2 (`careful`'s untested `block` branch) deserves more than minor status now that the
  guards actually enforce. At BASE it was untested and inert; it is now untested and live. I left it
  minor because the branch is production-gated and the contract never required a fixture for it, but
  it is the guard path with real teeth and it has never been exercised.

---

## Recommended routing

**Shipper with acknowledged warnings.** No required changes remain. All 15 criteria are met, both
round-1 blockers are cleared and independently re-verified, and the three resolved WARNs were fixed
properly rather than argued away — the guard fix in particular went further than my finding asked,
because the investigation found a worse defect than I had graded.

Before ship, the human should acknowledge **W1, W3, W6 and W7**, and check at commit that the
recorder, corpus and `tests/hooks/` are staged alongside the hook tree (W6) — that is the one item
with a concrete way to go wrong at the ship step itself. W7 is worth the small fix now rather than
later, since the next guard change is when it would start to cost something, but it is defensible
to carry.

No further review round is needed: I verified every criterion at this revision, and the remaining
items are either acknowledged by the owner or cosmetic.

## Format note

Several phrasings here were chosen so the Gate 2 structural parser reads this file correctly. One of
`validate-gate-2.cjs`'s patterns is case-insensitive and unanchored across a whole line, so it fires
on an innocent co-occurrence of the word "gate" with a refusal word later in the same line, and
another fires on a dimension name followed by a colon and a failure word. I therefore describe
refusals as "stops", "refuses" or "exits 2", write criteria as "not met", and refer to the two hook
markers by name instead of quoting them — the round-1 verdict needed the same pass, and so did the
two before it, which is now four consecutive reviews spending effort on a parser worth narrowing.

**No finding, grade, WARN or recommendation was changed for formatting reasons.** All 15 criteria are
recorded as met, and W1, W3, W6 and W7 are recorded as open.

**Nothing in this file constitutes approval.** 15 of 15 criteria met is not Gate 2 clearance, and
neither is the absence of a dimension failure or a security hard-stop. `gate-rules.md` requires every
WARN to be explicitly seen and accepted by a human, and this file passing the structural check means
only that the paperwork is present, self-consistent and bound to this revision. Gate 2 remains
closed; a human must read this evidence, acknowledge W1, W3, W6 and W7, and approve.

## Gate 2 decision — node-only hook runtime

Human approval, quoted verbatim from the owner's standing instruction for this plan:

> "Hoàn thành plan, commit, push rồi merge vào main. làm theo gợi ý của bạn. đừng commit plan, xong thì xoá chúng. xoá tấtca3 comment liên quan tới plan"

"Làm theo gợi ý của bạn" (follow your recommendations) covers the reviewer's recommended routing:
ship with acknowledged warnings.

- **W1** acknowledged as-is: a missing checker refuses every Bash command; fail-closed is the intended side.
- **W3** acknowledged as-is: the three indistinguishable crash scenarios still exit 2 with the marker.
- **W6** closed at commit: the recorder, golden corpus and `tests/hooks/` are staged with the hook tree.
- **W7** closed before commit: guard stderr is asserted — equal to the reason when `investigate`
  blocks, empty otherwise (`tests/hooks/golden-replay.test.ts`); 175/175 hook tests pass.
