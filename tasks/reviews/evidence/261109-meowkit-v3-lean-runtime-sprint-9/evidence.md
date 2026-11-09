# Sprint 9 — implementation evidence

**Status of this record: SLICE A IMPLEMENTED.** Sprint 9 is being built in three sequential slices;
this file's slice A section is the only one written so far. Slice B (integration descriptions) and
slice C (all other metadata, the regeneration and the post-rewrite live run) follow and will append
their own sections.

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
