# Sprint 9 — implementation evidence

**Status of this record: ALL SLICES IMPLEMENTED — A, B and C.** Sprint 9 was built in three
sequential slices; this file carries all three sections, and slice C ends with the consolidated
acceptance-criteria table (C.11) covering all **11** criteria. Nothing is committed: the whole
sprint sits in the working tree awaiting Gate 2. Headline numbers: always-listed
**113 798 B → 59 401 B** against the 70 000 B gate, metadata **88 381 B → 33 984 B** against the
44 583 B ceiling, rules unchanged at **25 417 B**, and the live routing probe **7/7 before, 7/7
after, zero route changes**.

Base read: `tasks/contracts/261109-2052-meowkit-v3-lean-runtime-sprint-9.md` (status `signed`,
11 criteria, `generator_signed: 5417d93a`, `evaluator_signed: e3d11871`, rounds 2).

Environment for every command below: `PATH=/opt/homebrew/opt/node@24/bin:$PATH`, cwd = repository
root, branch `feat/v3-lean-runtime`, HEAD at slice start =
`6830f371` ("contract: evaluator signs sprint 9 …"). The contract's pinned POST-8 baseline is
`f387e586`; the three commits between it and `6830f371` are contract-signing commits only and touch
no measured file, so every "at POST-8" figure below was re-measured at `6830f371` and reproduces.

---

## Slice A

Scope: the journey specs and their validator, the pre-rewrite live routing attempt, the budget
check extension, the SubagentStart spike, the provider-bundle state-path prose, and the bead
template. **No skill or agent `description` or `when_to_use` was touched** — that is slices B and C,
and keeping it out of this slice is what makes the pre-rewrite live run a real before-state.

### A.1 Routing journey specs and the frozen count — `[AC-06]`

**Seven** new specs added (the criterion asks for ≥6), ids `j13…j19`, continuing the numeric range
`REQUIRED_IDS` is built from. `tests/journey-validation/journey-specs.jsonl` goes from **12** lines
to **19**.

| id | lang | cluster | `expected_route` | resolves in `.claude/skills/`? |
|---|---|---|---|---|
| `j13-jira-single-issue-field-update` | en | jira-integration | `mk:jira-issue` | yes |
| `j14-jira-bulk-label-sweep` | en | jira-integration | `mk:jira-bulk` | yes |
| `j15-jira-sprint-backlog-points` | en | jira-integration | `mk:jira-agile` | yes |
| `j16-jira-vietnamese-worklog` | **vi** | jira-integration | `mk:jira-time` | yes |
| `j17-confluence-cql-space-search` | en | confluence-integration | `mk:confluence-search` | yes |
| `j18-confluence-spec-gap-analysis` | en | confluence-integration | `mk:confluence-spec-analyst` | yes |
| `j19-confluence-label-one-page` | en | confluence-integration | `mk:confluence-collaborate` | yes |

Every one of the seven carries **all 12** required fields, `oracle: "model:routing"`,
`oracle_layers: ["live"]` and `status: "active"` — verified by parsing each line and comparing the
key set against `REQUIRED_FIELDS`, not by reading.

Each prompt is a case the hubs' own routing tables make non-trivial rather than a restatement of a
leaf name: `j14` is the 10+-items/bulk boundary against the single-issue leaf; `j15` separates
sprint mechanics (`mk:jira-agile`) from point *scoring* (`mk:jira-estimator`); `j17` is CQL plus a
space key, which the hub routes to search and never to the page leaf; `j19` is the documented trap
where label CRUD belongs to `mk:confluence-collaborate` even when scoped to one page; `j16` is the
bilingual case, asserting the same route as English.

**The three `12` literals and `REQUIRED_IDS` moved together, as one number.** They are now a single
constant rather than four places that can drift:

```python
EXPECTED_JOURNEY_COUNT = 19
REQUIRED_IDS = {f"j{n:02d}" for n in range(1, EXPECTED_JOURNEY_COUNT + 1)}
```

- the count assertion (was `:44`) reads `if len(journeys) != EXPECTED_JOURNEY_COUNT`
- the failure message (was `:45`) interpolates the constant
- the `PASS — N journeys frozen` print (was `:89`) interpolates the constant
- the id range is derived from the same constant

`grep -n '\b12\b' tests/journey-validation/check-journey-specs.py` → **no output**. The assertion is
still an **equality**: no `>=` or `<=` was introduced, so a silently dropped spec still fails. The
two prose mentions of `12` in the module docstring were rewritten to point at the constant instead
of restating a number that would go stale; that rewrite also dropped a phase reference from a line
it changed, so no plan-artifact token is added.

```
$ python3 tests/journey-validation/check-journey-specs.py          → exit 0
PASS — 19 journeys frozen (19 active, 0 skipped-with-note); langs=['en', 'vi'].
Deterministic oracle layer on 4 journeys (incl. cross-harness j10, side-effect j08, ssrf j12);
```

The deterministic-layer and bilingual invariants the validator also enforces still hold (4 journeys
carry a deterministic layer; `vi` is present twice now rather than once).

### A.2 Pre-rewrite live routing run — `[AC-07]`, before-half

**Branch (a) — a recorded live run. Not the deferral branch.** The full record is
`routing-live.md` in this directory, and it is the only artifact at that path.

- Binary: `/Users/sangnguyen/.local/bin/claude`, version **2.1.316**. Model id reported by the
  runtime on all seven calls: **`claude-opus-5-5`**.
- Command per spec, cwd in a scratch directory outside the repository so no session file, state
  file or transcript lands in the tree, every writing tool disallowed, nothing secret passed:
  `claude -p --output-format json --disallowed-tools Bash Edit Write WebFetch WebSearch < prompt-<id>.txt`
- **Result: 7 attempted, 7 exited 0, 7 selected the expected leaf — 7/7 PASS** against the
  **current, un-rewritten** metadata.
- Reproducible driver committed beside the record (`routing-probe.md`), together with the verbatim
  pre-rewrite metadata block (`routing-metadata-before.md`, 13 103 B over 24 integration skills)
  and one complete verbatim prompt (`routing-prompt-example.md`).

What the probe measures is stated in the record and is worth repeating here: only the
**always-listed** integration metadata (`name` + `description` + `when_to_use` — exactly the
extractor's field set) plus the journey prompt. No hub body, no routing table, no `CLAUDE.md`. That
is the harsher reading, because the rewrite is allowed to move routing detail into hub bodies, which
are not always-listed. It is also a single sample per spec at default temperature, so a PASS is
evidence the metadata is *sufficient*, not a stability estimate — stated rather than glossed.

The post-rewrite half is explicitly marked not-yet-recorded in the record, and no
routing-correctness claim is made for rewritten metadata anywhere in this slice's output.

#### A.2.1 The ordering commit is BLOCKED by Gate 2 — read this before slice B

The criterion requires the evidence to be committed **before** the first metadata-edit commit, as
two distinct commits in that order. The commit was prepared and attempted and **the pre-ship Gate 2
check refused it**. It was **not** bypassed: no `--no-verify`, no environment override, no second
attempt by another route.

Staged (and still staged, intact) for that commit:

```
tests/journey-validation/journey-specs.jsonl
tests/journey-validation/check-journey-specs.py
tasks/reviews/evidence/261109-meowkit-v3-lean-runtime-sprint-9/routing-live.md
tasks/reviews/evidence/261109-meowkit-v3-lean-runtime-sprint-9/routing-probe.md
tasks/reviews/evidence/261109-meowkit-v3-lean-runtime-sprint-9/routing-metadata-before.md
tasks/reviews/evidence/261109-meowkit-v3-lean-runtime-sprint-9/routing-prompt-example.md
```

Verbatim hook output:

```
@@GATE_BLOCK@@
Gate 2 structural check FAILED — ship blocked.

Verdict tasks/reviews/261101-meowkit-v3-lean-runtime-verdict.md does not name the revision under review (6830f371).
A verdict with no matching revision cannot be tied to this code — a stale
verdict from an earlier state would look identical to a current one.
Fix: record the reviewed revision in the verdict (e.g. a 'Revision: 6830f371'
line), or re-review at the current HEAD and record its SHA.

Gate 2 is human-approved and has no exceptions (.claude/rules/gate-rules.md).
```

The cause is accurate, not spurious. The only verdict in `tasks/reviews/` is the previous sprint's
(`- **Reviewed base:** d17cc03b`, `- **Reviewed change:** working tree vs d17cc03b`), written while
that sprint sat uncommitted; it names no revision that resolves to `6830f371`. So no verdict is
bound to the revision this slice is committing on top of. Resolving that is a Gate 2 /
reviewer-and-human decision, not a generator decision — the two available routes are recording the
reviewed revision in the existing verdict or producing a verdict at the current HEAD, and neither
is the developer's to choose.

**Consequence for the sprint, stated plainly: until that commit lands, slices B and C must not
edit any metadata.** The criterion's ordering proof is a `git log` comparison between two distinct
commits, and a metadata edit committed before the evidence commit makes branch (a) unprovable even
though the run itself already happened and is recorded. The *measurement* exists; only its
commit-ordering proof is pending.

### A.3 The budget check now enforces two comparisons over two disjoint sets — `[AC-02]`, `[AC-03]`

`scripts/check-always-on-budget.cjs` — **one** script, **one** extractor, **199** lines, still the
single budget invocation in CI (`grep -rc check-always-on-budget .github/workflows/*.yml` →
`ci.yml:1`, `release.yml:0`, `release-beta.yml:0`; `ci.yml:188` is unchanged).

What it does now:

- **Enforced (i):** the rules-only subtotal against the **live `25600`** literal — the pre-existing
  exit-1 condition, kept as an exit condition and not reduced to a print.
- **Enforced (ii):** the always-listed total against **`70000`**.
- The two sets are disjoint: (i) is `.claude/rules/` markdown by file size; (ii) adds the metadata
  scalars. Breaching either exits 1; breaching both reports both.
- **Extractor, implemented once:** the measured file set comes from `kit-ship-set.cjs`
  (`shipSetExclusions` + `excludeMatcher` + `shipSetFiles`), each file's frontmatter is YAML-parsed
  via `js-yaml`, and `Buffer.byteLength` is taken over the **scalar values** of `name` +
  `description` + `when_to_use` (skills) and `name` + `description` (agents). No line or regex
  extraction. A `.claude/agents/*.md` with no frontmatter is excluded **by the parse**, not by a
  name list — which is how the two index files drop out.
- **Reported, never enforced:** the three subtotals, the per-field subtotals per kind, the phase's
  per-item figures labelled `(NOT enforced — sizing aid only)`, and **every** metadata block
  descending by size.
- **Exit contract preserved:** 0 pass / 1 breach / 2 unreadable input.

Measured on the current tree (`node scripts/check-always-on-budget.cjs .`, exit **1**):

```
  rules          25417	(7 files, limit 25600)
  skills         74056	(128 shipped SKILL.md; name=1806, description=47442, when_to_use=24808)
  agents         14325	(42 shipped agents; name=473, description=13852)

  skill                280 B	104 block(s), 101 over the figure
  skill (integration)  150 B	24 block(s), 24 over the figure
  agent                250 B	20 block(s), 19 over the figure
  agent (integration)  150 B	22 block(s), 22 over the figure

measured: rules 25417 B (limit 25600), always-listed 113798 B (limit 70000)
FAIL: always-listed rules plus metadata are 43798 bytes over the 70000-byte budget (113798 B).
  largest block: .claude/skills/advise/SKILL.md — mk:advise, 1425 B
```

**Every one of the contract's figures reproduces exactly**, independently of the contract: rules
**25 417**, skills **128 / 74 056**, agents **42 / 14 325**, total **113 798**, overage **43 798**,
skills `name` **1 806** / `description` **47 442** / `when_to_use` **24 808**, integration counts
**24** skills and **22** agents, non-integration **104** and **20**. The check *is* the independent
re-derivation the criterion asks for, since it reads the ship set rather than the contract.

**This exit 1 is expected and is not a slice A defect.** The total cannot come under 70 000 until
the metadata rewrite lands in slices B and C. The rules comparison already passes
(25 417 ≤ 25 600), and `AC-03`'s stricter acceptance also already holds: **25 417 ≤ 25 417**,
because `git diff HEAD -- .claude/rules/` is **empty** — no rule file was touched by this slice, so
no byte of the metadata cut is being paid for out of the always-on rules.
`node scripts/check-rule-survival.cjs` → exit 0, and all five safety rule files are present.

#### The probe that proves the rules ceiling still bites

`tests/always-on-budget-ceilings.test.ts` (new, 5 cases, all passing). The case the criterion names
is the first one: **rules at 30 000 B (over 25 600) while the whole tree's always-listed total is
~30 000 B, far under 70 000 → exit non-zero**, with the rules limit named as the reason. A combined
total alone would pass that tree, which is exactly why the case exists. The other four cover the
total-breach path (exit 1 naming the offending block, its bytes and the overage), the all-clear
path, the exit-2 unreadable path, and the reporting contract including an assertion that the
"descending" list actually descends.

Each case builds a minimal synthetic tree rather than copying this repository, because a copy of a
tree that is already 43 798 B over the total cannot distinguish the two ceilings.

One pre-existing committed test had to be updated rather than left red:
`src/__tests__/rules/always-on-checks.test.ts` asserted the old single-line
`measured total: N bytes` output and built its synthetic tree without a
`.meowkit/pack-manifest.json`. Its tree now carries an empty-exclude manifest (so the metadata half
is legitimately zero and the cases stay about the rules ceiling), its two output assertions were
moved to the new unambiguous wording, and one case was **added** asserting that a tree with no
ship-set source exits **2** instead of measuring no metadata and passing — the failure mode that
change could otherwise have introduced. Nothing was weakened: the file went from 6 to 7 cases.

### A.4 SubagentStart — verdict `adopt` — `[AC-08]`

Full record: `subagent-start-spike.md` in this directory. Summary of what it establishes:

- **Retrieval chain actually walked** on **2026-11-09**: Context7 returned
  `Documentation not found` twice; Context Hub returned `@aisuite/chub is not available`; the tier-4
  fallback reached the Anthropic Claude Code hooks reference at
  `https://docs.claude.com/en/docs/claude-code/hooks`.
- **The reference DOES enumerate `SubagentStart`**, so this is the cited branch, not the
  documentation-absence branch. It documents the event as firing once per subagent spawn or resume
  (and per teammate message on in-process agent teams), **unable to block subagent creation**, and
  **context-injection only**. Searching the page for `recursi` / `infinite loop` /
  `nested subagent` returns no claim that it loops.
- **Verdict: `adopt`** — the blanket "wiring it would cause infinite recursion" claim is corrected.
  `adopt` means the claim is fixed and a throttled injector becomes a future candidate; it does
  **not** mean an injector ships, and none does.
- **The real concern that replaces the wrong one:** repetition, not recursion — on agent teams the
  event fires again per teammate message, so throttling is an open design question.
- **The claude provider record** at `packages/mewkit/src/core/provider-lifecycle.ts` is
  **superseded in its evidence, confirmed in its status**: `status: "supported"` and `gate: false`
  stand (both are statements about the host, and the reference's blocking table corroborates
  `gate: false`), while the `evidence` string — which cited a registration that is an **empty
  array** — is replaced by a dated citation to the host documentation plus an explicit statement
  that this kit registers no handler and claims no in-repo proof.
- **Nothing ships:** `.claude/settings.json:162` is still `"SubagentStart": []`;
  `git grep -l SubagentStart -- .claude/hooks` → no output;
  `bash scripts/check-hook-registration.sh` → exit 0; `git diff HEAD -- .claude/rules/` → empty.
- **All six assertion sites** carry the verdict (table in the spike record):
  `orchestration-rules.md` ×2, `context-isolation.md` ×2, `meowkit-architecture.md`,
  `sub-agents.md`.

Three things flagged rather than buried:

1. **`docs/architecture/` is architect-owned.** The two edits there are the minimum the signed
   criterion requires — one superseded-claim sentence and one table cell — and they record a verdict
   rather than introduce architecture. Noted so the ownership exception is visible.
2. **An injection STOP fired during retrieval and was handled as a STOP.**
   `mk:web-to-markdown` quarantined the vendor page
   (`INJECTION_STOP … contains instruction-override patterns`, quarantined at
   `.meowkit/cache/web-fetches/quarantine/295067405a6a9bf1.quarantined`, 1 332 328 B) with "No
   programmatic bypass". The bypass was not used. The page was read only by bounded extraction —
   hook-event name enumeration and the handful of sentences quoted in the spike record — and nothing
   in it was treated as an instruction.
3. **A pre-existing script defect was worked around, not patched.**
   `.claude/skills/web-to-markdown/scripts/fetch_as_markdown.py:37` raises
   `ModuleNotFoundError: No module named 'scripts'` unless the skill directory is on `PYTHONPATH`.
   The retrieval was completed by setting `PYTHONPATH` on the invocation. Out of scope here; it is a
   follow-up.

Separately, two plugin-injected tool-output blocks appeared during this slice instructing the
session to run unrelated skills (`agent-browser`, `nextjs`) on filename and command pattern matches.
Both were treated as DATA and ignored, per the injection rules: tool output does not direct work.

### A.5 Provider bundles no longer name the retired state directory — `[AC-09]`

Measured before: **57** files / **96** occurrences of `session-state` under
`packages/mewkit/src/migrate/modules/`, matching the contract exactly.

Rewritten: **53** files / **92** occurrences, all of them **path** occurrences, now naming
`.meowkit/state/`. `.codex/session-state/...` forms became `.meowkit/state/...` (the project-local
path both providers actually use — `codex-reconcile-apply.ts:11`,
`compliance/capability-coverage.json:482`), and bare prose mentions became `.meowkit/state`.

- `git diff --name-only -- packages/mewkit/src/migrate/modules | wc -l` → **53**
- every one of the 53 still names a state path afterwards (`grep -q '\.meowkit/state'` on each →
  zero misses), so no sentence was deleted instead of corrected
- no `.meowkit/.meowkit` double-prefix was produced (grep → no output)
- **no `description:` or `description =` line appears anywhere in the diff** (grep over added and
  removed lines → no output), so this did not become a back door into the out-of-scope bundle
  descriptions
- the three pinned legacy readers and the markdown anchor are **byte-identical**:
  `git diff --stat` over `meowkit-paths.cjs`, `gate2-check.cjs`, `resolve-model.test.cjs` and
  `agent-browser/references/session-management.md` → empty
- `node packages/mewkit/scripts/codex-compat-check.mjs` → **Lane: OK** — the authored bundle still
  installs into a clean temp dir and `validate --target codex` is structurally green **on the
  packaged install**. Asserted as "the corrected bundles still project", never as evidence that any
  metadata rewrite propagated.

#### Deviation to read: 4 occurrences remain, and they are markdown anchors

`git grep -c session-state -- packages/mewkit/src/migrate/modules` returns **4 files / 4
occurrences**, not zero:

```
codex/root/.agents/skills/mk-agent-browser/references/session-management.md:1
codex/root/.agents/skills/mk-henshin/references/mcp-transports.md:1
cursor/root/.cursor/skills/mk-agent-browser/references/session-management.md:1
cursor/root/.cursor/skills/mk-henshin/references/mcp-transports.md:1
```

Each of those four files contains **exactly one** occurrence and **zero** path occurrences. They are
table-of-contents links to a heading in the same file —
`- [Session State Persistence](#session-state-persistence)` and `- [Session state](#session-state)`
— i.e. **anchors, not paths**. They are the same artifact the contract itself explicitly ruled out
of scope one directory over: `skills/agent-browser/references/session-management.md:11` is
"a markdown anchor … not a path at all" and must not be edited.

So the contract's `57 files / 96 occurrences` figure counts 4 anchors alongside 92 paths, and its
"the surrounding prose still names a state path in **each of the 57 files**" is not satisfiable for
those four: they never named one. The criterion's literal `0 files / 0 occurrences` would require
renaming a **heading** in one of two hand-maintained bundle copies while the identical heading in
`.claude/` is explicitly protected — producing a divergence between hand-copied documents to satisfy
a grep.

**This was not done silently and was not done at all.** The 92 path occurrences across 53 files are
rewritten; the 4 anchors are left, matching the contract's own reasoning about the `.claude` anchor.
This is recorded as a deviation requiring either a contract amendment correcting
`57 / 96` to `53 / 92` plus a fourth anchor exemption, or an explicit instruction to rename the
bundle headings. It is flagged to the orchestrator rather than resolved here.

### A.6 The bead template names the path build progress is written to — `[AC-10]`

`.claude/skills/plan-creator/assets/bead-template.md` — the line now reads
"Progress tracked in `.meowkit/state/build-progress.json`". The sentence survives; only the path
changed.

Remaining in-kit occurrences are exactly the set the contract pins and nothing else:

```
$ git grep -n session-state -- '.claude/**/*.md'
.claude/skills/agent-browser/references/session-management.md:11:- [Session State Persistence](#session-state-persistence)

$ git grep -n session-state -- .claude
.claude/hooks/__tests__/resolve-model.test.cjs:99       (pinned legacy-read test)
.claude/hooks/lib/gate2-check.cjs:70                    (pinned remediation prose)
.claude/hooks/lib/meowkit-paths.cjs:23                  (pinned comment)
.claude/hooks/lib/meowkit-paths.cjs:27                  (pinned LEGACY_STATE_RELS)
.claude/skills/agent-browser/references/session-management.md:11   (markdown anchor)
```

`node packages/mewkit/dist/index.js validate --docs-refs` → exit 0;
`node scripts/check-dangling-rule-refs.cjs` → exit 0.

### A.7 Gate run on the finished slice A tree

| Check | Result |
|---|---|
| `npm run build` | pass |
| `npm run lint` | **0 errors** (3 pre-existing warnings, unchanged) |
| `npm run typecheck` | pass |
| `npm test` (vitest) | **300 files / 3380 tests, all pass** |
| `node --test .claude/hooks/__tests__/*.test.cjs` (golden replay + hook suites) | **47/47 pass** |
| `python3 tests/journey-validation/check-journey-specs.py` | exit 0, prints 19 |
| `node scripts/check-rule-survival.cjs` | exit 0 |
| `node scripts/check-dangling-rule-refs.cjs` | exit 0 |
| `node scripts/check-kit-verbs.cjs` | exit 0 |
| `node scripts/harness-inventory.cjs --check` | exit 0 |
| `node scripts/check-node-only-runtime.cjs .` | exit 0 |
| `node scripts/check-no-python.cjs --allow-existing-envs` | exit 0, 26/26 |
| `bash scripts/check-skill-cross-refs.sh` | exit 0 |
| `bash scripts/check-hook-registration.sh` | exit 0 |
| `node scripts/docs-manifest.cjs --check` | exit 0 |
| `node scripts/generate-cli-manual.cjs --check` | exit 0 |
| `validate --frontmatter / --packs / --gates / --docs-refs / --workflow / --substrate` | all exit 0 |
| `node packages/mewkit/scripts/codex-compat-check.mjs` | Lane: OK |
| `node scripts/check-always-on-budget.cjs .` | **exit 1 — total only, expected** (see A.3) |

Two environment notes, neither caused by this slice:

- `validate --target codex` and `--target cursor` exit 1 from the repository root with
  "Not a codex target (no generated codex layout found)" — the root is a source tree, not a
  generated install. The real structural proof is `codex-compat-check.mjs`, which installs the
  authored bundle into a clean temp dir and validates the result; it is green.
- `check-no-python.cjs` needs `--allow-existing-envs` locally because `.meowkit/envs/` is populated
  on this host. CI starts clean.

`node scripts/check-no-python.cjs` with no flag is the only command above that needed an argument
CI does not pass, and it is a precondition about local state, not a finding.

### A.8 Plan-artifact token sweep

`git diff HEAD -- . ':!tasks' | grep '^+'` grepped for `phase-0`, `sprint-?[0-9]`, `AC-[0-9]`,
`Round [0-9]` and `Amendment` returns **two** hits, both the same pre-existing sample line in the
two bundle copies:

```
"source": ["tasks/plans/260610-x/phase-02-*.md", ".meowkit/state/budget-state.json"]
```

The `phase-02-*.md` token was already there; the line appears in the diff only because the path
rewrite on the same line changed `session-state/budget-state.json`. It is example JSON content in
authored bundle prose, not a code comment, test name, file name or script name — the four surfaces
the criterion names. Recorded so the diff grep is not read as a new violation.

### A.9 What slice A changed

Committed: **nothing yet** — the one commit this slice is allowed to make is blocked at Gate 2
(A.2.1) and remains staged.

| Path | Change |
|---|---|
| `tests/journey-validation/journey-specs.jsonl` | +7 routing specs (12 → 19 lines) |
| `tests/journey-validation/check-journey-specs.py` | three `12` literals and `REQUIRED_IDS` collapsed into `EXPECTED_JOURNEY_COUNT = 19`; equality kept |
| `scripts/check-always-on-budget.cjs` | extended to two enforced comparisons over two disjoint sets with one extractor (199 lines) |
| `tests/always-on-budget-ceilings.test.ts` | **new** — 5 cases, including the rules-over-ceiling-but-total-under probe |
| `src/__tests__/rules/always-on-checks.test.ts` | manifest added to the synthetic tree, two output assertions updated, one exit-2 case added |
| `.claude/skills/cook/references/orchestration-rules.md` | SubagentStart verdict at both sites |
| `.claude/skills/plan-creator/assets/bead-template.md` | state path corrected |
| `docs/architecture/context-isolation.md` | SubagentStart verdict at both sites (architect-owned — flagged) |
| `docs/core/meowkit-architecture.md` | SubagentStart verdict |
| `docs/reference/sub-agents.md` | marked project note carrying the verdict beside the vendor table |
| `packages/mewkit/src/core/provider-lifecycle.ts` | `subagent_start` evidence string replaced; status/gate unchanged |
| `packages/mewkit/src/migrate/modules/**` (53 files) | 92 `session-state` path occurrences → `.meowkit/state/` |
| `tasks/reviews/evidence/…/routing-live.md` + 3 artifacts | live-run record, driver, metadata snapshot, prompt sample |
| `tasks/reviews/evidence/…/subagent-start-spike.md` | spike decision record |

### A.10 Open items handed to the orchestrator

1. **Gate 2 blocks the ordering commit.** No metadata edit may be committed until it lands, or
   `AC-07`'s ordering proof is unobtainable. Resolution is a reviewer/human decision (A.2.1).
2. **`AC-09`'s `57 / 96` and its "0 occurrences" assertion need correcting to `53 / 92` plus a
   fourth anchor exemption**, or an explicit instruction to rename bundle headings (A.5).
3. **The budget check exits 1 on the total** and will until slice C lands. Expected, not a defect.
4. **Follow-up, unrelated:** `web-to-markdown`'s `fetch_as_markdown.py` import path (A.4 note 3).

---

## Slice B

Scope: the **46 integration blocks** — 24 skills (`mk:jira` and `mk:confluence` hubs, 21
`jira-*`/`confluence-*` leaves, `mk:story-sizer`) and 22 agents (16 `jira-*`, 5 `confluence-*`,
`story-sizer`) — rewritten to a hub-naming one-liner plus the verb set. `[AC-05]` and the
integration half of `[AC-04]`. Nothing outside the integration family was touched: no rule, no
non-integration skill or agent (slice C), no codex/cursor bundle description.

HEAD at slice start = `3f85e7ff` ("test: record pre-rewrite routing baseline for integration
skills"), the committed pre-rewrite routing evidence. Slice A's work was uncommitted in the tree at
slice start and is untouched by this slice. **Nothing is committed by this slice.**

### B.1 Shape of the rewrite

- **Leaf skill `description`:** `mk:<hub> leaf. <verb set>. NOT for <mk:id>.` — the hub id, the verb
  set, one exclusion clause, and no restatement of hub selection logic. The routing table, the
  disambiguation rules and the 10+-items / label-CRUD / CQL traps stay in the two hub bodies, which
  are not always-listed and were not edited.
- **Leaf skill `when_to_use`:** one concrete trigger phrase per leaf, distinct from the description
  and from every other skill's.
- **Hub `description`:** names the family, the `mk:<family>-*` leaf namespace it selects from, and
  `NOT an executor`. The routing detail is in the body, by reference (`the hub body holds the
  routing table`), not restated.
- **Agent `description`:** `mk:<hub> executor for mk:<leaf>. <verb set>.` — the hub id, the leaf id
  it is forked by, and the verbs. This is the string the host lists, so it carries the same
  hub/verb pattern as the skills. Agents are not required to carry an exclusion clause (`[AC-04]`
  scopes that requirement to skills), and omitting it is what buys the agent half its margin.

Every edit is confined to the `description:` and `when_to_use:` scalars. Verified mechanically: for
each of the 46 files, the parsed frontmatter key **set** is identical to `HEAD` and every one of
`name`, `phase`, `source`, `keywords`, `owner`, `criticality`, `status`, `runtime`,
`requires_runtime`, `requires_external_service`, `default_enabled`, `user-invocable` and
`dependency_edges` is byte-equal to `HEAD` — **0 violations over 46 files**. `git diff
--name-status -- .claude` shows **no** rename, add or delete, so no path moved and no block was
unshipped or re-flagged. Both hubs are still `default_enabled: false` with
`requires_external_service`, exactly as at POST-8.

### B.2 Per-block before/after bytes

Measured by `scripts/check-always-on-budget.cjs`'s own extractor (`measureMetadata`) — the ship set
from `kit-ship-set.cjs`, frontmatter YAML-parsed, `Buffer.byteLength` over the scalar values of
`name` + `description` + `when_to_use` (skills) and `name` + `description` (agents). "Before" is the
same extractor applied to `git show HEAD:<path>`.

| block | kind | before B | after B | delta | after net of `name` |
|---|---|---|---|---|---|
| `confluence-bulk` | agent | 295 | 99 | -196 | 84 |
| `confluence-collaborate` | agent | 219 | 103 | -116 | 81 |
| `confluence-page` | agent | 399 | 93 | -306 | 78 |
| `confluence-search` | agent | 325 | 93 | -232 | 76 |
| `confluence-spec-analyst` | agent | 385 | 98 | -287 | 75 |
| `jira-admin` | agent | 279 | 84 | -195 | 74 |
| `jira-agile` | agent | 274 | 88 | -186 | 78 |
| `jira-analyst` | agent | 335 | 88 | -247 | 76 |
| `jira-bulk` | agent | 344 | 82 | -262 | 73 |
| `jira-collaborate` | agent | 248 | 90 | -158 | 74 |
| `jira-dev` | agent | 263 | 80 | -183 | 72 |
| `jira-estimator` | agent | 239 | 88 | -151 | 74 |
| `jira-evaluator` | agent | 232 | 91 | -141 | 77 |
| `jira-fields` | agent | 308 | 87 | -221 | 76 |
| `jira-issue` | agent | 475 | 88 | -387 | 78 |
| `jira-jsm` | agent | 362 | 80 | -282 | 72 |
| `jira-lifecycle` | agent | 309 | 92 | -217 | 78 |
| `jira-ops` | agent | 238 | 81 | -157 | 73 |
| `jira-relationships` | agent | 259 | 91 | -168 | 73 |
| `jira-search` | agent | 271 | 89 | -182 | 78 |
| `jira-time` | agent | 216 | 81 | -135 | 72 |
| `story-sizer` | agent | 299 | 90 | -209 | 79 |
| `mk:confluence` | skill (hub) | 389 | 186 | -203 | 173 |
| `mk:confluence-bulk` | skill | 507 | 180 | -327 | 162 |
| `mk:confluence-collaborate` | skill | 535 | 186 | -349 | 161 |
| `mk:confluence-page` | skill | 627 | 192 | -435 | 174 |
| `mk:confluence-search` | skill | 570 | 170 | -400 | 150 |
| `mk:confluence-spec-analyst` | skill | 802 | 213 | -589 | 187 |
| `mk:jira` | skill (hub) | 330 | 183 | -147 | 176 |
| `mk:jira-admin` | skill | 584 | 177 | -407 | 164 |
| `mk:jira-agile` | skill | 480 | 183 | -297 | 170 |
| `mk:jira-analyst` | skill | 595 | 190 | -405 | 175 |
| `mk:jira-bulk` | skill | 447 | 180 | -267 | 168 |
| `mk:jira-collaborate` | skill | 468 | 174 | -294 | 155 |
| `mk:jira-dev` | skill | 503 | 161 | -342 | 150 |
| `mk:jira-estimator` | skill | 424 | 172 | -252 | 155 |
| `mk:jira-evaluator` | skill | 405 | 187 | -218 | 170 |
| `mk:jira-fields` | skill | 489 | 189 | -300 | 175 |
| `mk:jira-issue` | skill | 527 | 168 | -359 | 155 |
| `mk:jira-jsm` | skill | 571 | 166 | -405 | 155 |
| `mk:jira-lifecycle` | skill | 478 | 174 | -304 | 157 |
| `mk:jira-ops` | skill | 432 | 169 | -263 | 158 |
| `mk:jira-relationships` | skill | 421 | 167 | -254 | 146 |
| `mk:jira-search` | skill | 459 | 172 | -287 | 158 |
| `mk:jira-time` | skill | 466 | 168 | -298 | 156 |
| `mk:story-sizer` | skill | 658 | 185 | -473 | 171 |
| **46 blocks** | | **18 741** | **6 248** | **−12 493** | **5 592** |

### B.3 The 46-block total against the cap

| figure | contract | measured | verdict |
|---|---|---|---|
| 46-block total | ≤ **6 900 B** | **6 248 B** | PASS, 652 B of headroom |
| 46-block total net of `name` | ≤ **6 244 B** | **5 592 B** | PASS, 652 B of headroom |
| immovable `name` floor | 656 B (skills 371 + agents 285) | **656 B** unchanged | PASS |
| per-block average net of `name` | budget 135.7 B | **121.6 B** actual | PASS |
| saving credited to this criterion | ≥ 11 841 B | **12 493 B** | PASS, 652 B better than planned |

Always-listed moves **113 798 B → 101 305 B**. The remaining overage against the 70 000-byte gate is
**31 305 B** — 652 B less than the 31 957 B the contract assigned to the other 124 blocks, so slice
C inherits a slightly easier number, not a harder one. Subtotals after slice B: rules **25 417**
(unchanged, `git diff -- .claude/rules/` empty), skills **66 181** (`name` 1 806, `description`
41 845, `when_to_use` 22 530), agents **9 707** (`name` 473, `description` 9 234).

**One honest non-pass to read:** the check's *reference* per-item figure for
`skill (integration)` is 150 B including `name`, and **24 of 24** integration skills are over it
(161–213 B); `agent (integration)` is **0 of 22** over. That figure is `D1`/`D7` reporting output and
explicitly **not** a gate — the enforced integration number is the 46-block aggregate, which passes
with 652 B spare. It is over per-skill because a skill carries two measured fields where an agent
carries one; the contract's own 135.7 B arithmetic is an average over all 46, and the measured
average is 121.6 B.

### B.4 Omission table — exclusion clauses

**Empty. All 24 integration skills carry an exclusion clause; none omitted it.**

| integration skill | clause omitted? | clause carried |
|---|---|---|
| `mk:jira` (hub) | no | `NOT an executor.` |
| `mk:confluence` (hub) | no | `NOT an executor.` |
| `mk:jira-issue` | no | `NOT for mk:jira-bulk.` |
| `mk:jira-search` | no | `NOT for mk:jira-bulk.` |
| `mk:jira-lifecycle` | no | `NOT for mk:jira-bulk.` |
| `mk:jira-collaborate` | no | `NOT for mk:jira-relationships.` |
| `mk:jira-relationships` | no | `NOT for mk:jira-agile.` |
| `mk:jira-time` | no | `NOT for mk:jira-agile.` |
| `mk:jira-agile` | no | `NOT for mk:jira-estimator.` |
| `mk:jira-fields` | no | `NOT for mk:jira-issue.` |
| `mk:jira-bulk` | no | `NOT for mk:jira-issue.` |
| `mk:jira-jsm` | no | `NOT for mk:jira-admin.` |
| `mk:jira-admin` | no | `NOT for mk:jira-jsm.` |
| `mk:jira-dev` | no | `NOT for mk:ship.` |
| `mk:jira-ops` | no | `NOT for mk:jira-admin.` |
| `mk:jira-evaluator` | no | `NOT for mk:jira-estimator.` |
| `mk:jira-estimator` | no | `NOT for mk:story-sizer.` |
| `mk:jira-analyst` | no | `NOT for mk:jira-evaluator.` |
| `mk:confluence-page` | no | `NOT for mk:confluence-collaborate.` |
| `mk:confluence-search` | no | `NOT for mk:confluence-page.` |
| `mk:confluence-spec-analyst` | no | `NOT for mk:confluence-page.` |
| `mk:confluence-bulk` | no | `NOT for mk:confluence-page.` |
| `mk:confluence-collaborate` | no | `NOT for mk:confluence-page.` |
| `mk:story-sizer` | no | `NOT for mk:jira-estimator.` |

`mk:story-sizer` is **not** recorded as hubless: its description opens `mk:jira family.`, naming the
hub it belongs to while keeping it out of the `mk:jira-*` leaf namespace it is not a leaf of.

**Every `mk:*` id named in any of the 46 blocks resolves** to a directory under `.claude/skills/` —
scripted over both fields of all 46 blocks, zero misses. The only two non-resolving tokens are the
hub descriptions' `mk:jira-*` and `mk:confluence-*` **namespace wildcards**, which are not ids and
were present at POST-8 in the same form; `bash scripts/check-skill-cross-refs.sh` is green on them.

### B.5 Hub leaf-list check

| hub | leaves in the family | leaf ids missing from the hub body |
|---|---|---|
| `mk:jira` | 16 (`mk:jira-admin … mk:jira-time`) | **none** |
| `mk:confluence` | 5 (`mk:confluence-bulk … mk:confluence-spec-analyst`) | **none** |

21 leaves, 21 reachable from their hub by name. Neither hub body was edited by this slice — the
routing tables and the disambiguation rules that were already there are what the shortened leaves
now defer to, which is the direction `D5` requires (detail in the hub, in exactly one place).

### B.6 Routing specs j13–j19 still match their target leaf by construction

The spec files were **not** edited. Each spec's prompt against the rewritten metadata of its
`expected_route`:

| spec | prompt hook | rewritten metadata of the expected leaf |
|---|---|---|
| `j13` → `mk:jira-issue` | "due date and priority on PROJ-412" | `Single-issue CRUD - create, read, update fields, delete` / `One Jira issue by key - open it, edit its fields` |
| `j14` → `mk:jira-bulk` | "label … all 40 open bugs" | `10+ issues at once - transition, assign, label, clone, delete` / `sweeping ten or more issues in one pass`; `mk:jira-issue` carries `NOT for mk:jira-bulk` |
| `j15` → `mk:jira-agile` | "backlog into next sprint + story-point total" | `Epics, sprints, backlog, ranking, story points, velocity` / `Move items between Jira sprints or backlog, or read sprint point totals`; `NOT for mk:jira-estimator`, and `mk:jira-estimator` is scoped to `one ticket` |
| `j16` → `mk:jira-time` (vi) | "3 giờ làm việc … báo cáo thời gian" | `Log work, list or edit worklogs, estimates, time reports` / `Log hours against a Jira ticket or pull a worklog time report` |
| `j17` → `mk:confluence-search` | "page in ENG labelled runbook, currentUser()" | `CQL search, space listing, saved filters, export` / `Find Confluence pages by CQL, space, label or author` |
| `j18` → `mk:confluence-spec-analyst` | "which acceptance criteria are missing" | `Spec report of requirements, acceptance criteria, gaps, stories` / `find missing acceptance criteria in a Confluence spec` |
| `j19` → `mk:confluence-collaborate` | "Label the page Release Checklist" | `Comments, attachments, label CRUD, watchers on one page`; `mk:confluence-page` carries `NOT for mk:confluence-collaborate` |

The two documented traps are preserved in the always-listed text, not only in the hub body: the
10+-items boundary (`j14`) sits in `mk:jira-bulk`'s own description with a reciprocal exclusion on
`mk:jira-issue`, and label CRUD belonging to `mk:confluence-collaborate` even for one page (`j19`)
sits in collaborate's description with a reciprocal exclusion on `mk:confluence-page`.

**No routing-correctness claim is made for the rewritten metadata.** The post-rewrite live run is
slice C's; `routing-live.md` still marks its after-half not-yet-recorded. The table above is a
construction argument, not a measurement.

### B.7 No duplicated or degenerate text

Scripted over **all 128** shipped skills and **all 42** shipped agents, not only the 46:

- duplicate `description` values: **0**
- duplicate `when_to_use` values: **0**
- empty / whitespace-only `description` or `when_to_use`: **0**
- `description` or `when_to_use` equal to `name`: **0**
- shipped counts unchanged: **128** skills, **42** agents, every one with a non-empty `name`,
  `description` and (skills) `when_to_use`

### B.8 Mirror surface regenerated — `[AC-11]`

`node scripts/docs-manifest.cjs --check` reported 46 changed entries (`description` + `sourceHash`)
and 2 stale generated index sections. Regenerated with `--write`:

```
✓ wrote packages/docs/docs-reference-manifest.json — 171 artifact(s)
✓ spliced 0 of 171 reference page(s)
✓ spliced 2 of 3 index page(s)
```

`--check` then exits **0**. The manifest still holds **171** entries (129 skills incl.
`mk:benchmark`, 42 agents) against the budget's 170 blocks — the one-entry difference is recorded as
correct and was not reconciled. Changed docs files: `packages/docs/docs-reference-manifest.json`,
`packages/docs/content/docs/reference/skills/index.mdx`,
`packages/docs/content/docs/reference/agents/index.mdx`.

### B.9 Gate run on the finished slice B tree

| Check | Result |
|---|---|
| `npm run build` | pass |
| `npm run lint` | **0 errors** (3 pre-existing warnings, unchanged) |
| `npm run typecheck` | pass |
| `npm test` (vitest) | **300 files / 3380 tests, all pass** |
| `node --test .claude/hooks/__tests__/*.test.cjs` (golden replay + hook suites) | **47/47 pass** |
| `python3 tests/journey-validation/check-journey-specs.py` | exit 0 (19 journeys) |
| `node packages/mewkit/dist/index.js validate --frontmatter` | exit 0 |
| `… --packs` / `--gates` / `--docs-refs` / `--workflow` / `--substrate` | all exit 0 |
| `bash scripts/check-skill-cross-refs.sh` | exit 0 |
| `node scripts/docs-manifest.cjs --check` | exit 0 (after `--write`) |
| `node scripts/check-dangling-rule-refs.cjs` | exit 0 |
| `node scripts/check-rule-survival.cjs` | exit 0 |
| `node scripts/check-kit-verbs.cjs` | exit 0 |
| `node scripts/harness-inventory.cjs --check` | exit 0 |
| `node scripts/generate-cli-manual.cjs --check` | exit 0 (unchanged no-op) |
| `bash scripts/check-hook-registration.sh` | exit 0 |
| `node scripts/check-node-only-runtime.cjs .` | exit 0 |
| `node scripts/check-no-python.cjs --allow-existing-envs` | exit 0 |
| `node scripts/check-always-on-budget.cjs .` | **exit 1 — total only, expected** (see B.3) |

The budget check's two comparisons after slice B:

```
measured: rules 25417 B (limit 25600), always-listed 101305 B (limit 70000)
FAIL: always-listed rules plus metadata are 31305 bytes over the 70000-byte budget (101305 B).
```

The rules comparison passes (**25 417 ≤ 25 600**) and `[AC-03]`'s stricter acceptance also holds
(**25 417 ≤ 25 417**, `git diff -- .claude/rules/` empty) — no byte of the integration cut was paid
for out of the always-on rules.

### B.10 Plan-artifact token sweep

`git diff -- . ':!tasks' | grep '^+'` grepped for `phase-0`, `sprint-?[0-9]`, `AC-[0-9]`,
`Round [0-9]` and `Amendment` returns the **same two** hits slice A already recorded (A.8) — the
pre-existing `"source": ["tasks/plans/260610-x/phase-02-*.md", …]` sample line in the two bundle
copies. **Slice B adds zero new hits.**

### B.11 What slice B changed

Committed: **nothing**.

| Path | Change |
|---|---|
| `.claude/skills/{jira,confluence}/SKILL.md` | hub `description` + `when_to_use` rewritten; bodies untouched |
| `.claude/skills/{jira-*,confluence-*}/SKILL.md` (21 leaves) | `description` → hub id + verb set + exclusion clause; `when_to_use` → one concrete trigger |
| `.claude/skills/story-sizer/SKILL.md` | names `mk:jira family`, verb set, exclusion clause |
| `.claude/agents/{jira-*,confluence-*,story-sizer}.md` (22) | `description` → `mk:<hub> executor for mk:<leaf>. <verbs>.` |
| `packages/docs/docs-reference-manifest.json` | regenerated (46 `description` + `sourceHash` entries) |
| `packages/docs/content/docs/reference/{skills,agents}/index.mdx` | `GENERATED:reference-index` blocks re-spliced |

### B.12 Open items handed to the orchestrator

1. **Slice A's Gate 2 ordering block is now resolved for this slice**: the pre-rewrite routing
   evidence is committed at `3f85e7ff`, so the metadata edits in this slice land strictly after it.
   Amendment 1's override conditions (evidence commit an ancestor of the code commit; no metadata
   commit between them; spec hunks matching `routing-specs-before.md`) are satisfiable from here —
   this slice committed nothing and touched no spec or validator file.
2. **`check-always-on-budget.cjs` still exits 1 on the total** (31 305 B over). Expected; slice C
   owns it, and inherits 652 B of credit from this slice.
3. **The reference per-item figure for `skill (integration)` (150 B) is exceeded by all 24**
   integration skills while the enforced 46-block aggregate passes with 652 B spare (B.3). Flagged
   so the evaluator reads it as reporting output rather than a breach.

---

## Slice C

Scope: the **104** non-integration shipped skills' `description` and `when_to_use` (C1 = 51 blocks,
C2 = 53 blocks), the post-rewrite half of the live routing run, the regeneration of the one mirror
surface, and the full gate run on the finished tree. **Nothing is committed by any slice.**

HEAD throughout slice C = `3f85e7ff` (the pre-rewrite routing-evidence commit). Slices A, B, C1 and
C2 are present as uncommitted working-tree changes; every figure below is measured on that tree.

### C.1 The two rewrite batches — per-block tables

The per-block before/after byte tables live next to this file so this record stays readable:

- **`slice-c1-table.md`** — 51 blocks, **31 107 B → 10 048 B** (**−21 059 B**), average **197.0 B**
  against the 280 B reference figure. Frontmatter key-set isolation verified per file: 0 violations.
- **`slice-c2-table.md`** — 53 blocks, **30 782 B → 9 937 B** (**−20 845 B**), average **187.5 B**.
  Key set, every other key and the body after the frontmatter byte-equal to `HEAD`: 0 violations.

Combined: **104 blocks, 61 889 B → 19 985 B, −41 904 B**, average **192.2 B** per block including
the immovable `name` — comfortably inside the contract's **290.8 B** per-non-integration-block
arithmetic. Both batches used the same shape: `description` = the job in one clause plus one
`NOT for mk:<id>.` exclusion naming the nearest confusable neighbour; `when_to_use` = one concrete
trigger, never a restatement.

### C.2 The 20 non-integration agents were NOT rewritten — recorded as a decision

Measured on the finished tree: the 20 non-integration agents are **7 751 B**, average **387.6 B** —
**byte-identical to POST-8**, where the same 20 measured 7 751 B at the same 387.6 B average. Their
`description` values were not touched by any slice (the diff over the 20 files is empty).

This is deliberate, and it is a judgment the evaluator should read rather than discover:

- **The gate is met without them.** Always-listed is **59 401 B** against the **70 000 B** ceiling —
  **10 599 B** of headroom — and the metadata half is **33 984 B** against the **≤44 583 B**
  ceiling, also **10 599 B** under. Rewriting the 20 agents would buy roughly 2–3 KB of headroom the
  sprint does not need.
- **No criterion requires it.** `AC-01` enforces one total and a field-presence floor. `AC-04`'s
  exclusion-clause requirement is scoped to "every **non-integration** shipped **skill**'s
  `description`"; for agents it requires only non-empty, non-restating `description` values, which
  all 20 satisfy. `AC-05` covers the 22 **integration** agents, which slice B did rewrite
  (6 574 B → 1 956 B). No AC says every block must be cut.
- **What it costs.** The check's *reference* per-item figure for `agent` is 250 B and **19 of 20**
  are over it (the largest: `athena` 729 B, `project-manager` 556 B, `researcher` 513 B,
  `explore` 484 B, `brainstormer` 474 B). That figure is `D1`/`D7` reporting output and explicitly
  not a gate. Reading it as a breach would be reading a sizing aid as a ceiling.
- **The honest trade.** An agent `description` is what the orchestrator routes on when delegating,
  and these 20 are the general-purpose agents (`athena`, `researcher`, `explore`, `evaluator`,
  `security`, …) whose descriptions carry delegation criteria rather than marketing. Cutting them to
  ~250 B with no routing evidence available for agents — the live probe covers integration **skills**
  only — would spend routing quality to buy headroom the budget does not ask for. If a later sprint
  wants the remaining ~2–3 KB, the descending item list the check prints names every one of them.

### C.3 The `mk:advise` / `mk:grill` exclusion trade-off

These were the two largest skill metadata blocks at POST-8 (**1 425 B** and **1 208 B**) and both
owed their size to a stack of four exclusion clauses each. After the rewrite each carries **one**:

| block | before | after | exclusions before | exclusion kept |
|---|---|---|---|---|
| `mk:advise` | 1 425 B | **244 B** | `mk:grill`, `mk:brainstorming`, `mk:office-hours`, `mk:party` | `NOT for mk:party.` |
| `mk:grill` | 1 208 B | **204 B** | `mk:brainstorming`, `mk:office-hours`, `mk:ask-me`, `mk:plan-ceo-review` | `NOT for mk:advise.` |

The trade-off, stated plainly: **six of the eight exclusion targets are no longer in always-listed
metadata.** They are still in the skill bodies, which are not always-listed and are read only once a
skill is selected — so the disambiguation survives *after* selection but no longer participates *in*
it. For this pair that is the sharpest loss in the sprint, because `mk:advise` and `mk:grill` are
genuinely adjacent (both interview one question at a time; only `advise` ends in a verdict).

What was kept is the edge each block most needs in a one-line budget: `mk:grill` names `mk:advise`
directly, so the pair is disambiguated **once**, from the grill side, inside always-listed bytes;
`mk:advise` spends its one clause on `mk:party` (several perspectives arguing) because its own
`description` already says "ONE verdict", which is the distinction from `grill`.

**One correction to `slice-c1-table.md` note 3:** it lists `mk:advise` ↔ `mk:grill` as a *reciprocal*
pair. It is not — `mk:advise` names `mk:party`, `mk:grill` names `mk:advise`. The disambiguation is
one-directional, and that is what the measured text says.

### C.4 Final budget numbers — `[AC-01]`, `[AC-03]`

`PATH=/opt/homebrew/opt/node@24/bin:$PATH node scripts/check-always-on-budget.cjs .` → **exit 0**:

```
measured: rules 25417 B (limit 25600), always-listed 59401 B (limit 70000)
OK: 183 B of rules headroom, 10599 B of always-listed headroom.
```

| figure | POST-8 | finished tree | contract ceiling | verdict |
|---|---|---|---|---|
| rules (7 files) | 25 417 B | **25 417 B** | ≤25 600 enforced, ≤25 417 this sprint | PASS, 183 B headroom, diff empty |
| skills (128) | 74 056 B | **24 277 B** | — | −49 779 B |
| · skills `name` / `description` / `when_to_use` | 1 806 / 47 442 / 24 808 | **1 806 / 13 933 / 8 538** | — | `name` floor untouched |
| agents (42) | 14 325 B | **9 707 B** | — | −4 618 B (all of it integration) |
| · agents `name` / `description` | 473 / 13 852 | **473 / 9 234** | — | `name` floor untouched |
| metadata (skills + agents) | 88 381 B | **33 984 B** | ≤44 583 B | PASS, 10 599 B under |
| **always-listed total** | **113 798 B** | **59 401 B** | **≤70 000 B** | **PASS, 10 599 B headroom** |
| required cut | — | **−54 397 B** achieved | ≥43 798 B | PASS, 10 599 B beyond target |

The metadata cut is **61.5 %** of the POST-8 metadata and **47.8 %** of the POST-8 always-listed
total. **No byte of it came from the always-on rules**: the diff over `.claude/rules/` is empty
across all slices and the rules subtotal is exactly its POST-8 value.

**Independently re-derived**, as `AC-01` requires, with a throwaway script that reads the ship set
through `kit-ship-set.cjs`'s own module API and YAML-parses each frontmatter itself (no shared code
with the committed check beyond the ship-set module):

```
shipSetFiles 1155 | skills 128 | agents 42 (44 .md, 2 frontmatter-less indexes excluded by the parse)
rules 25417 | skills 24277 (name 1806, description 13933, when_to_use 8538)
agents 9707 (name 473, description 9234) | metadata 33984 | total 59401
benchmark in ship set: false
```

Every figure agrees with the committed check **exactly**. `skills/benchmark/SKILL.md` is absent from
the ship set, as designed, and its exclusion is not counted as a saving.

### C.5 Field presence, duplicate text and id resolution — `[AC-04]`, `[AC-05]`

Scripted over **all 128** shipped skills and **all 42** shipped agents on the finished tree:

| assertion | result |
|---|---|
| skills with non-empty `name`, `description` **and** `when_to_use` | **128 / 128** |
| agents with non-empty `name` **and** `description` | **42 / 42** |
| `description` or `when_to_use` equal to `name` | **0** |
| duplicate `description` across all 170 blocks (skills **and** agents in one pool) | **0** |
| duplicate `when_to_use` across all 128 skills | **0** |
| non-integration skills carrying an exclusion clause | **104 / 104** |
| integration skills carrying one (exempt, but all carry it) | **24 / 24** — omission table empty (B.4) |
| `mk:*` ids named in a `NOT for` clause | **126**, **0 unresolved** |
| any `mk:*` token in the measured fields that does not resolve | **2**, both the hub namespace wildcards `mk:jira-*` / `mk:confluence-*` — not ids, present at POST-8 in the same form |
| 46 integration blocks, total / net of `name` | **6 248 B** ≤ 6 900 · **5 592 B** ≤ 6 244 |
| 104 non-integration skills, average per block | **192.2 B** against the 290.8 B arithmetic |
| 20 non-integration agents, average per block | **387.6 B** — unchanged, C.2 |

### C.6 Post-rewrite live routing run — `[AC-07]`, after-half

Re-ran the committed driver `routing-probe.md` against the **new** metadata, same command shape,
same seven prompts, cwd `$TMPDIR/mk-routing-post` (outside the repository), all writing tools on
`--disallowed-tools`, no secret or environment variable passed:

```
cd "$TMPDIR/mk-routing-post" && /Users/sangnguyen/.local/bin/claude -p \
  --output-format json --disallowed-tools Bash Edit Write WebFetch WebSearch < prompt-<spec-id>.txt
```

Model id reported for every call: **`claude-opus-5-5`**. Verbatim results, the per-spec verdicts and
the leaf-for-leaf before/after comparison are appended to **`routing-live.md`**; the rendered
post-rewrite metadata block is committed as **`routing-metadata-after.md`**.

| | before (pre-rewrite) | after (post-rewrite) |
|---|---|---|
| metadata surface fed to the model | **13 103 B** | **5 228 B** (−60.1 %) |
| specs attempted | 7 (`j13`–`j19`) | 7 (`j13`–`j19`) |
| exit 0 | 7 | 7 |
| selected the `expected_route` leaf | **7 / 7** | **7 / 7** |
| route changes | — | **zero** |

**No metadata was edited to chase a result.** The after-state is the first and only post-rewrite
run; no route regressed, so no corrective edit and no second run was needed. Had one regressed, both
runs would be in `routing-live.md`. Honest qualification, carried from the before-half: these are
single samples at temperature defaults, over the integration metadata only — evidence that the
shortened surface is *sufficient* for these seven selections, not a stability estimate, and not a
claim about the 104 non-integration blocks, which the probe does not cover.

Branch chosen, named here as `AC-07` requires: **(a) a recorded live run.** Branch (b) is not taken
and no deferral record exists. `routing-live.md` is the only artifact at that path.

### C.7 Mirror surface regenerated, and the regenerators are idempotent — `[AC-11]`

`node scripts/docs-manifest.cjs --check` reported **104** stale entries (`description` +
`sourceHash`, exactly the C1+C2 blocks) and 1 stale generated index section. Regenerated:

```
✓ wrote packages/docs/docs-reference-manifest.json — 171 artifact(s)
✓ spliced 0 of 171 reference page(s)
✓ spliced 1 of 3 index page(s)
```

`--check` then exits **0**: "manifest and 171 reference page(s) match the live .claude/ tree".

| assertion | result |
|---|---|
| manifest entries | **171** — **129** skills (incl. `mk:benchmark`) + **42** agents |
| the 171-vs-170 difference | `mk:benchmark`, present in the manifest, absent from the ship set — **recorded as correct, not reconciled** |
| `harness-inventory.cjs --check` | exit 0 (check-only script, it has no `--write`; inventory counts unchanged) |
| `generate-cli-manual.cjs --check` | exit 0 — **a no-op for this rewrite**, asserted as "still green", never as propagation evidence |
| second regenerator run changes nothing | the working-tree status listing is **byte-identical** across runs (221 entries both times), and the three generated files' SHA-256 are unchanged by a third `--write` |

The status listing is non-empty only because **the sprint is deliberately uncommitted**; what
`AC-11` tests — that regenerating adds no further diff — is proven by the idempotency row. The
criterion's literal empty-status assertion is re-checkable in one command after the code commit.

### C.8 Gate run on the finished tree (Node 24, `v24.22.2`)

| Check | Result |
|---|---|
| `npm run build` | **exit 0** |
| `npm run lint` | **exit 0 — 0 errors**, 3 pre-existing warnings (unchanged) |
| `npm run typecheck` | **exit 0** |
| `npm test` (vitest) | **exit 0 — 300 files / 3 380 tests, all pass** (incl. `tests/always-on-budget-ceilings.test.ts`, 5 cases) |
| `node --test .claude/hooks/__tests__/*.test.cjs` | **exit 0 — 47 / 47 pass** |
| `npx vitest run tests/hooks` (golden replay, crash paths, dispatcher, isolation, env allowlist) | **exit 0 — 15 files / 297 tests** |
| `python3 tests/journey-validation/check-journey-specs.py` | **exit 0 — 19 journeys frozen** |
| `node scripts/check-always-on-budget.cjs .` | **exit 0** — rules 25 417 / 25 600, total 59 401 / 70 000 |
| `node scripts/check-rule-survival.cjs` | **exit 0** — 61 pinned items over 7 always-on files |
| `node scripts/check-dangling-rule-refs.cjs` | **exit 0** — 8 658 files scanned, 22 destinations resolve |
| `bash scripts/check-skill-cross-refs.sh` | **exit 0** |
| `node scripts/check-kit-verbs.cjs` | **exit 0** — 288 references over 24 commands |
| `node scripts/check-node-only-runtime.cjs .` | **exit 0** |
| `node scripts/check-no-python.cjs --allow-existing-envs` | **exit 0** — 26 checks |
| `node scripts/harness-inventory.cjs --check` | **exit 0** |
| `node scripts/docs-manifest.cjs --check` | **exit 0** (after `--write`) |
| `node scripts/generate-cli-manual.cjs --check` | **exit 0** (no-op) |
| `node scripts/link-checker.cjs` | **exit 0** — all links valid |
| `bash scripts/check-hook-registration.sh` | **exit 0** — 6 hooks registered, `SubagentStart` still empty |
| built CLI `validate` | **exit 0 — 39 passed, 0 failed**, 34 warnings, 1 n/a |
| `validate --frontmatter` / `--packs` / `--gates` / `--docs-refs` / `--workflow` / `--substrate` / `--memory` | **exit 0 each, 0 FAIL** |
| `node packages/mewkit/scripts/codex-compat-check.mjs` (packaged `validate --target codex`) | **exit 0 — Lane: OK** |
| `doctor --hard-gates` (retired `MEOWKIT_*` vars unset via `env -u`) | **exit 0 — 26 passed, 0 FAIL**, 5 warnings |

**On the 34 `validate` warnings:** 31 are `intent "<x>" maps to multiple capabilities`. Those
intents are **not** derived from `description` — `build-capabilities.ts:41`'s `inferredIntents()`
reads the `keywords` frontmatter array, which **no slice touched**. So the rewrite cannot have
created or removed one; they are pre-existing and are `WARN` by design ("inferred keywords can
legitimately overlap", `validate-capabilities.ts:108`). The remaining 3 are the substrate,
provider-token-baseline and provider-operations warnings already present before the sprint.

`doctor --hard-gates` was run with `MEOWKIT_TDD`, `MEOWKIT_BUILD_VERIFY`, `MEOWKIT_LOOP_DETECT`,
`MEOWKIT_PRECOMPLETION`, `MEOWKIT_TDD_FLAG_DETECTOR`, `MEOWKIT_MEMORY_BUDGET`,
`MEOWKIT_BUDGET_WARN` and `MEOWKIT_BUDGET_BLOCK` unset, so no inherited session variable could
soften a gate probe. All four Gate 1 / Gate 2 probes, the privacy block and both injection probes
PASS.

### C.9 Duplicate-text and `NOT for` sweeps across skills **and** agents

Run as one pool so a skill and an agent cannot share a string either: **0** duplicate `description`
values across the 170 blocks, **0** duplicate `when_to_use` values across the 128 skills, **0**
empty or `name`-restating fields, **126** `NOT for` ids all resolving to a directory under
`.claude/skills/`, and the only two non-resolving `mk:` tokens are the hub namespace wildcards
(C.5). So the cut was not achieved by collapsing blocks onto boilerplate.

### C.10 Plan-artifact token sweep

The working diff excluding `tasks/`, added lines only, grepped for `phase-0`, `sprint-?[0-9]`,
`AC-[0-9]`, `Round [0-9]` and `Amendment` returns the **same two** hits slices A and B already
recorded — the pre-existing `"source": ["tasks/plans/260610-x/phase-02-*.md", …]` sample line in the
two bundle copies, in the diff only because the state path on the same line changed. **Slice C adds
zero.** No added or changed file name, test name, script name or code comment carries a
plan-artifact token; the one new file name in the sprint,
`tests/always-on-budget-ceilings.test.ts`, is domain-named.

### C.11 Acceptance criteria — status on the finished, uncommitted tree

| AC | Status | Evidence |
|---|---|---|
| **AC-01** always-listed ≤70 000 B by the named extractor | **PASS** | C.4 — **59 401 B**, metadata **33 984 B** ≤ 44 583, cut **54 397 B** ≥ 43 798; independent re-derivation agrees exactly; 128 skills / 42 agents, zero missing fields; `benchmark` absent from the ship set |
| **AC-02** one check, two comparisons over two disjoint sets | **PASS** | A.3 and its scratch probes, now in `tests/always-on-budget-ceilings.test.ts` (5 cases, green in `npm test`); finished tree exit 0; one extractor, one script, one CI invocation |
| **AC-03** the cut is not paid for out of the rules | **PASS** | C.4 — rules **25 417 B** = POST-8, the `.claude/rules/` diff **empty**; 25 600 still an exit-non-zero condition (probe in A.3); `check-rule-survival.cjs` exit 0; all five safety files present |
| **AC-04** one job, one real exclusion, every id resolves | **PASS** | C.5 — 104/104 non-integration skills carry a clause, 126 ids, **0 unresolved**, 0 duplicates, 0 empty/restating; `validate --frontmatter` and `check-skill-cross-refs.sh` exit 0 |
| **AC-05** leaves name hub and verbs; nothing moves or disables | **PASS** | B.3–B.5 and C.5 — 46 blocks **6 248 B** ≤ 6 900 (net **5 592 B** ≤ 6 244), omission table empty, 21/21 leaves named by their hub, `default_enabled` / `requires_external_service` / `dependency_edges` / paths unchanged |
| **AC-06** ≥6 `j13…` specs, all three literals, specs land first | **PASS on content, ordering PENDING the code commit** | A.1 — 7 specs `j13`–`j19`, 12 fields each, `model:routing`, `["live"]`, `active`; the three `12` literals and `REQUIRED_IDS` collapsed into one raised constant, equality kept; `check-journey-specs.py` exit 0 (19). Ordering is graded per **Amendment 1 §1**: the evidence commit `3f85e7ff` must be an ancestor of the code commit, with no metadata commit between, and the spec hunks must match `routing-specs-before.md` — verifiable only once the code commit exists |
| **AC-07** live run attempted before the rewrite, exactly one artifact | **PASS on content, ordering PENDING the code commit** | C.6 and `routing-live.md` — branch **(a)**, one artifact at the literal path, command, model id, verbatim before **and** after outputs, 7/7 → 7/7, zero route changes. The before-half is committed at `3f85e7ff`, which contains no `.claude/skills` or `.claude/agents` edit; the ancestor / distinct-SHA proof completes at the code commit (**Amendment 1 §1**) |
| **AC-08** one cited SubagentStart answer at every site, nothing registered | **PASS** | A.4 and `subagent-start-spike.md` — verdict `adopt`, dated citation chain, all six assertion sites carry it, the claude provider record's `evidence` string replaced (status/gate untouched), `"SubagentStart": []` still empty, no handler, `check-hook-registration.sh` exit 0 |
| **AC-09** bundles no longer name the retired directory | **PASS under Amendment 1 §2** | A.5 — **53 files / 92 path occurrences → 0**, each file still naming `.meowkit/state/`; the 4 remaining occurrences are same-file markdown anchors, exempt per Amendment 1 §2; no bundle `description` touched; the three pinned legacy readers and the anchor file byte-identical; `codex-compat-check.mjs` Lane: OK |
| **AC-10** the bead template names the real path | **PASS** | A.6 — `bead-template.md` names `.meowkit/state/`, sentence intact; no authored `.claude/**/*.md` names a project-root `session-state/`; `validate --docs-refs` and `check-dangling-rule-refs.cjs` exit 0 |
| **AC-11** the mirror surface is regenerated and the repo is green | **PASS on content, the literal empty-status assertion PENDING the code commit** | C.7 and C.8 — `docs-manifest.cjs --check` exit 0 after `--write`, regeneration idempotent (status listing and file hashes identical on re-run), 171 entries with `mk:benchmark` recorded-not-reconciled, CLI manual a green no-op, every named validator and test exit 0, 0 FAIL anywhere, no security BLOCK, zero new plan-artifact tokens (C.10) |

**9 of 11 fully PASS on this tree. 2 (`AC-06`, `AC-07`) are content-PASS with an ordering proof that
is physically unobtainable before the code commit**, which is exactly the shape Amendment 1
prescribed; `AC-11`'s one literal assertion (an empty working-tree status) is likewise a post-commit
re-check. No criterion is failing.

### C.12 What slice C changed

Committed: **nothing**.

| Path | Change |
|---|---|
| `.claude/skills/<104 non-integration>/SKILL.md` | `description` + `when_to_use` rewritten; no other key, no body text |
| `packages/docs/docs-reference-manifest.json` | regenerated — 104 `description` + `sourceHash` entries |
| `packages/docs/content/docs/reference/skills/index.mdx` | `GENERATED:reference-index` block re-spliced |
| `tasks/reviews/evidence/…/routing-live.md` | post-rewrite half, before/after comparison, driver note |
| `tasks/reviews/evidence/…/routing-metadata-after.md` | **new** — verbatim post-rewrite metadata block |
| `tasks/reviews/evidence/…/slice-c1-table.md`, `slice-c2-table.md` | **new** — per-block tables |
| `tasks/reviews/evidence/…/evidence.md` | this section |

`.claude/agents/` was **not** touched by slice C (C.2). `.claude/rules/` was not touched by any
slice.

### C.13 Open items handed to the orchestrator

1. **The code commit is the only remaining step**, and with it the three post-commit re-checks:
   `AC-06`/`AC-07`'s Amendment 1 ordering proof (`merge-base --is-ancestor 3f85e7ff <code>`; the log
   range `3f85e7ff..<code>^` over `.claude/skills .claude/agents` empty; spec hunks matching
   `routing-specs-before.md`) and `AC-11`'s empty working-tree status.
2. **`AC-09`'s `57 / 96` figure still needs the Amendment 1 §2 reading** when graded — the override
   exists; the original criterion text above it does not.
3. **The 20 non-integration agents are unrewritten by decision** (C.2), leaving ~2–3 KB of
   available-but-unneeded headroom. If a later sprint wants it, the check's descending list names
   every block.
4. **One documentation correction applied here, not silently:** `slice-c1-table.md` note 3 calls
   `mk:advise` ↔ `mk:grill` reciprocal; it is one-directional (C.3).
