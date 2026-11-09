# Review: MeowKit v3 lean runtime — metadata budget, integration descriptions, SubagentStart answer (sprint 9)

- **Revision: 3f85e7ff** — the revision under review, branch `feat/v3-lean-runtime` ("test: record pre-rewrite routing baseline for integration skills")
- **Reviewed base:** `3f85e7ff`
- **Reviewed change:** working tree vs `3f85e7ff` — `git diff HEAD` plus untracked files, excluding `tasks/plans/` (never committed). 218 tracked files changed, plus one untracked test file and two untracked evidence tables.
- **Spec graded against:** `tasks/contracts/261109-2052-meowkit-v3-lean-runtime-sprint-9.md` (signed, 11 acceptance criteria) **including `### Amendment 1 — 261109-2215`**, which overrides AC-06/AC-07's ordering proof and AC-09's occurrence count.
- **Builder evidence read:** `tasks/reviews/evidence/261109-meowkit-v3-lean-runtime-sprint-9/` — `evidence.md` (slices A/B/C), `slice-c1-table.md`, `slice-c2-table.md`, `routing-live.md`, `routing-specs-before.md`, `routing-metadata-{before,after}.md`, `routing-probe.md`, `routing-prompt-example.md`, `subagent-start-spike.md`. Every figure below was re-measured by this review, not accepted from the report.
- **Review round:** 1. Sprint 8's approved verdict is archived verbatim at `tasks/reviews/evidence/261109-meowkit-v3-lean-runtime-sprint-8/verdict-approved.md` (md5 `088bf9276f866a8bcbeea8087819a5b1`, identical to the file this verdict replaced).
- **Mode:** default (TDD off) — coverage gaps are WARN
- **Score:** 8.8/10

## Verdict: WARN

Nothing blocks. The sprint's central number holds under independent re-derivation: I re-implemented
the extractor from the contract's definition (YAML-parse each ship-set file, `Buffer.byteLength` over
the named scalars) and got **exactly** the committed check's figures — always-listed **59 401 B**
against the 70 000 ceiling, rules **25 417 B** (equal to POST-8, not merely under 25 600), metadata
half **33 984 B** against ≤44 583, a cut of **54 397 B** against the required ≥43 798. 128 skills and
42 agents, **zero** missing `name`/`description`/`when_to_use`, `skills/benchmark/SKILL.md` absent
from the ship set. No byte was bought by deleting a field or unshipping a block.

The claim I most expected to be decorative is the one that survived hardest. AC-02's probe — rules
over their own 25 600 ceiling while the combined total is comfortably under 70 000 — exits **1** on a
scratch tree and names the rules limit as the reason (`scripts/check-always-on-budget.cjs:177-180`),
so shortening an always-on safety rule to buy metadata room still fails. The inflated-description
probe exits **1** naming the file, its bytes and the overage; the removed-rules-directory probe still
exits **2**. One script, one extractor, one CI invocation (`.github/workflows/ci.yml:188`).

Amendment 1's clause (c) is proven, not asserted: the spec and validator hunks in the working tree
are **byte-identical** to the diff recorded in `routing-specs-before.md` — I extracted both and
`diff` returned empty at 9 466 B each, index lines included. Clauses (a) and (b) are post-commit
obligations and are named in item 6 below.

What remains is a real routing cost that the builder disclosed for one pair and that I measured
kit-wide (item 1), two compressed descriptions that edge toward automation-as-authority without
crossing (item 2), and a coverage hole where this sprint's new invariants are enforced only by the
aggregate byte ceiling (item 3). All are numbered for explicit acknowledgement.

| Dimension | Result | One-line basis |
| --- | --- | --- |
| Correctness | PASS | 11/11 criteria re-measured; 9 fully met, AC-06/AC-07 content-met with Amendment 1's ordering proof pending the code commit, clause (c) proven byte-identical |
| Maintainability | PASS | one script, one extractor, comments corrected to match what is measured; no `any`, no unsafe cast, lint 0 errors (3 pre-existing warnings), typecheck clean |
| Performance | PASS | 54 397 B removed from the always-listed context; the integration routing surface shrank 13 103 B → 5 228 B (60.1 %) with 7/7 → 7/7 live leaf selection unchanged |
| Security | PASS | no secret in any evidence artifact; injection STOP honoured with no bypass; `SubagentStart` registration still empty and no handler; `.claude/rules/` byte-unchanged; launcher, privacy and `settings.json` untouched |
| Coverage | WARN | AC-02's ceilings are pinned by committed tests; AC-01/AC-04/AC-05's metadata invariants are not (item 3) |

Side Effects Detected: No — this review wrote only this verdict file and the sprint 8 archive copy.

## Correctness

Re-measured, not accepted. Commands re-run under `PATH=/opt/homebrew/opt/node@24/bin:$PATH`.

- **AC-01 met.** `node scripts/check-always-on-budget.cjs .` exits 0; my independent extractor agrees
  to the byte on all five figures. Per-field subtotals print (`scripts/check-always-on-budget.cjs:146-158`),
  so the total is reproducible without guessing the extractor.
- **AC-02 met.** Two enforced comparisons, both exiting non-zero on breach
  (`scripts/check-always-on-budget.cjs:25-26`, `:177-187`). All three scratch probes reproduced
  (rules-over-but-total-under → exit 1 naming rules; inflated description → exit 1 naming
  `.claude/skills/verify/SKILL.md — mk:verify, 20069 B` with a 9 313 B overage; rules directory
  removed → exit 2). No second budget script and no second extractor in the diff. See item 8 on the
  contract's "disjoint sets" wording.
- **AC-03 met.** `git diff f387e586 -- .claude/rules/` is **empty**; rules subtotal 25 417 B = POST-8;
  all five always-on safety files present; `scripts/check-rule-survival.cjs` exit 0.
- **AC-04 met.** 104/104 non-integration skills carry an exclusion clause; **zero** unresolved `mk:*`
  ids inside any clause; **zero** duplicate `description` and **zero** duplicate `when_to_use` across
  the 128 skills and 42 agents pooled; zero empty, whitespace-only or `name`-restating fields;
  `validate --frontmatter` and `scripts/check-skill-cross-refs.sh` exit 0. Routing quality is graded
  in items 1, 2, 4 and 5.
- **AC-05 met.** 46 integration blocks measure **6 248 B** ≤ 6 900 and **5 592 B** net of `name`
  ≤ 6 244. All 21 leaves name their hub by id and a verb set; both hub bodies still name every leaf
  (16/16 and 5/5); `mk:story-sizer` opens `mk:jira family.`; `default_enabled`,
  `requires_external_service`, `dependency_edges` and paths unchanged for all 46; `validate --packs`
  exit 0. The omission table at `evidence.md:568-606` is honest about what the hubs carry — the two
  hubs use `NOT an executor.` rather than a `NOT for <id>` clause, which is the one block type where
  naming a single leaf would mislead, and the table prints the exact clause text for all 24.
- **AC-06 met on content.** 7 specs `j13`–`j19` (≥6), each with all 12 required fields,
  `oracle: model:routing`, `oracle_layers: ["live"]`, `status: active`; every `expected_route`
  resolves to a shipped leaf. The three `12` literals and `REQUIRED_IDS` collapsed into one raised
  constant (`tests/journey-validation/check-journey-specs.py:33`, `:36`, `:50`, `:99`) — stronger than
  moving three literals in step, since there is now one number to move. Equality kept, not loosened.
  `python3 tests/journey-validation/check-journey-specs.py` exits 0 and prints 19.
- **AC-07 met on content, branch (a).** Exactly one artifact at the literal path; command, model id
  (`claude-opus-5-5`), verbatim before and after output per spec, 7/7 → 7/7, zero route changes.
  Scope of that evidence is item 4.
- **AC-08 met.** Verdict `adopt` with a dated vendor citation and a recorded retrieval chain
  (`subagent-start-spike.md:3-24`). All six assertion sites carry it:
  `.claude/skills/cook/references/orchestration-rules.md:99`, `:113`,
  `docs/architecture/context-isolation.md:21`, `:112`, `docs/core/meowkit-architecture.md:246-248`,
  `docs/reference/sub-agents.md:527-531`. `.claude/settings.json:162` is still `[]`;
  `git grep -l SubagentStart -- .claude/hooks` returns nothing; `scripts/check-hook-registration.sh`
  exit 0. The claude provider record keeps `status`/`gate` and replaces its `evidence` string with the
  dated host-documentation citation plus an explicit "this kit registers NO handler"
  (`packages/mewkit/src/core/provider-lifecycle.ts:82-92`) — the empty-array-as-evidence defect the
  criterion existed to catch is closed.
- **AC-09 met under Amendment 1 §2.** `git grep -c session-state -- packages/mewkit/src/migrate/modules`
  returns 4 files at 1 occurrence each, and all four are same-file markdown anchors
  (`.../mk-agent-browser/references/session-management.md:11`, `.../mk-henshin/references/mcp-transports.md:11`
  in both the codex and cursor copies) — exactly the artifact Amendment 1 §2 exempts. 121 files now
  name `.meowkit/state`; **no** hunk in that tree touches a `description:` line; the three pinned
  legacy readers and the anchor file are byte-identical to POST-8.
- **AC-10 met.** `.claude/skills/plan-creator/assets/bead-template.md:40` names
  `.meowkit/state/build-progress.json` with the sentence intact. The only `session-state` hits left
  under `.claude` are the three pinned readers plus the anchor at
  `.claude/skills/agent-browser/references/session-management.md:11`. `validate --docs-refs` and
  `scripts/check-dangling-rule-refs.cjs` exit 0.
- **AC-11 met on content.** `node scripts/docs-manifest.cjs --check` exit 0 with no drift; manifest
  holds 171 entries / 129 skills / 42 agents with `mk:benchmark` present and recorded as correct
  rather than reconciled; `generate-cli-manual.cjs --check` exit 0 as a no-op. Independent re-runs:
  `npm run build` 0, `npm run lint` 0 errors / 3 pre-existing warnings, `npm run typecheck` 0,
  `npm test` **300 files / 3 380 tests pass**, `node --test .claude/hooks/__tests__/*.test.cjs` 0 fail,
  `validate --frontmatter|--packs|--gates|--docs-refs|--workflow|--memory` 0 each,
  `check-rule-survival`, `check-dangling-rule-refs`, `check-kit-verbs`, `check-node-only-runtime`,
  `harness-inventory --check`, `check-skill-cross-refs.sh`, `check-hook-registration.sh` all 0. My own
  plan-artifact token sweep over added lines outside `tasks/` returns the same two pre-existing bundle
  sample lines the builder disclosed and nothing new; the one new file name,
  `tests/always-on-budget-ceilings.test.ts`, is domain-named.

Implementation-vs-plan fit: the change matches the signed contract's shape — one check with two
comparisons, descriptions cut to one job plus one exclusion, routing detail pushed into hub bodies,
nothing moved or disabled. The two deliberate non-moves (20 non-integration agents left byte-identical,
hub bodies left unedited) are recorded as decisions at `evidence.md:764-791` and `:607-617` and are
consistent with the criteria as written.

## Maintainability

The budget check is one file with one extractor and an explicit usage/exit contract
(`scripts/check-always-on-budget.cjs:1-19`). The simplifier's correction to those comments is right:
the header now says "those rules PLUS shipped skill/agent metadata" (`:5-6`) rather than claiming the
two measured sets are disjoint, which they are not — the always-listed total contains the rules
subtotal. See item 8. Reference per-item figures are printed and labelled "NOT enforced"
(`:28-31`, `:160-165`), and the descending per-item list gives a maintainer a place to look.

No `any`, no `as any`, no `@ts-ignore`, no new `eslint-disable` in any changed TypeScript. The 3 lint
warnings are pre-existing unused-symbol warnings, unchanged in count and location. Measured-set
sourcing stays on `kit-ship-set.cjs` rather than a `.claude` glob, so the budget and the published kit
cannot disagree, and `src/__tests__/rules/always-on-checks.test.ts:87-92` now pins the
missing-ship-set case to exit 2 rather than "measure no metadata and pass" — a fail-closed choice
worth keeping.

## Performance

This sprint *is* the performance change. 54 397 B left the always-listed context (113 798 → 59 401),
of which 49 779 B came from skill metadata and 4 618 B from agents. The surface a model must read
before any skill runs is now 15 % under the ceiling with 10 599 B of headroom. The integration
routing block the live probe renders went 13 103 B → 5 228 B (60.1 %) with identical leaf selection
on all seven specs, which is the only direct measurement available that the cut did not cost routing.
No runtime hot path, query pattern or render path is touched.

## Security

- **No secret anywhere in the evidence.** My sweep over the evidence directory for `sk-ant`, `api_key`,
  `bearer`, `ANTHROPIC_`, `token=`, `password`, `secret` returns only the record's own statements that
  no secret, token or environment variable was passed (`routing-live.md:48`, `:152`). The probe ran
  with every writing tool on `--disallowed-tools`, cwd outside the repository, and
  `permission_denials` empty on all seven calls.
- **The injection STOP was handled as a STOP.** `mk:web-to-markdown` refused the vendor hooks page and
  quarantined it (`subagent-start-spike.md:28-37`); no bypass was used, no `--force`, no second route.
  The spike then read the quarantine by bounded extraction and the record cites **facts** — event
  enumeration, the blocking-table cell, the output-capability grouping — and converts none of them into
  an instruction. I checked the derived verdict for instruction-shaped carry-over and found none: the
  one behavioural consequence drawn is a *refusal* to register anything. Rule 7 extraction, correctly
  applied.
- **Nothing registered.** `SubagentStart` stays `[]` at `.claude/settings.json:162`, no handler exists,
  `check-hook-registration.sh` is green — so an `adopt` verdict ships no injector, which is the
  property the criterion asked for.
- **Blocked-pattern sweep clean** over the changed surface: no hardcoded secret, no string-interpolated
  SQL, no `localStorage` auth, no disabled certificate validation, no `any`. `.claude/rules/` is
  byte-identical to POST-8, so no safety rule was shortened to pay for the metadata cut — the exact
  trade the rules ceiling exists to forbid, and it is now provably enforcing rather than reported.
- **No security-agent escalation is warranted.** The change edits prose metadata, one check script, one
  test, journey specs, provider prose and a docs manifest. It touches no auth, payment, user-data or
  network path; the launcher, the privacy guard and the hook registration surface are untouched.

## Coverage — WARN

`tests/always-on-budget-ceilings.test.ts` is the right test for the right reason: it asserts exit
codes and operator-visible output on synthetic trees rather than grepping the source for literals, and
its first case is precisely the probe a combined-total-only check would hide (`:65-71`). Five cases,
green in `npm test`. `src/__tests__/rules/always-on-checks.test.ts` was updated in step rather than
weakened, and gained a fail-closed case.

The hole is item 3: the invariants this sprint newly relies on — every shipped skill having a
non-empty `when_to_use`, every non-integration description carrying a clause, every clause id
resolving, no duplicate description text, the 46-block integration cap — were each verified once, by
throwaway scripts, and are pinned by no committed check. `packages/mewkit/schemas/skill-schema.json:6`
requires only `name` and `description`; `when_to_use` is optional with `minLength: 10`. So a future
edit can drop a `when_to_use`, collapse two descriptions onto one string, or name a non-existent skill
in a clause, and every committed check stays green as long as the byte total holds.

## WARN items (numbered for acknowledgement)

**1. The exclusion graph lost most of its fan-out, and 84 edges now have no always-listed signal in
either direction.**
*What it means:* at POST-8 many descriptions carried three or four `NOT for` targets. The one-clause
shape drops **97** of those targets. For **84** of them the named skill does not name the dropping
skill back, so neither side of that confusion pair carries a discriminator in always-listed bytes.
Discounting the two hub namespace wildcards and the ~17 intra-family Jira/Confluence leaf pairs (whose
routing lives in the hub body one hop away, by AC-05's design) leaves roughly **65** non-integration
one-way losses — e.g. `mk:verify` → `mk:nyquist`, `mk:workflow-orchestrator` → `mk:fix`,
`mk:party` → `mk:elicit`/`mk:office-hours`/`mk:retro`, `mk:research` → four targets,
`mk:grill` → five. 38 new targets were added, and most high-traffic pairs were deliberately made
reciprocal (`mk:fix`↔`mk:build-fix`, `mk:verify`↔`mk:lint-and-validate`, `mk:cook`↔`mk:autobuild`,
`mk:help`↔`mk:status`, `mk:simplify`↔`mk:clean-code`, `mk:grill`→`mk:advise`), which is why this is a
WARN and not a defect.
*Why acceptable here:* AC-04 requires *one* real exclusion per block, and 290.8 B cannot hold four.
The disambiguation survives in skill bodies, which are read after selection. The builder disclosed the
sharpest case itself (`evidence.md:792-816`, `mk:advise`/`mk:grill`, 6 of 8 targets dropped) including
a self-correction that the pair is one-directional, not reciprocal.
*What would make it a failure:* a measured mis-route on any of those pairs, or a pair where **both**
sides also lack a distinguishing job statement. I checked the named pairs' one-job clauses and each is
distinct on its face; no mis-route is measured because no probe covers them (item 4).

**2. Two rewritten descriptions compress gate language in a direction the standing item exists to
watch.**
*What it means:* the standing gate-authority question — does any prose grant approval authority to
something that is not a human, in any wording — is answered **no**. I scanned every added line under
`.claude/rules/`, `.claude/agents/` and `.claude/skills/{advise,agent-detector,autobuild,cook,fix}/`
for auto-approval, self-approval and "proceeds when" patterns and found none; `validate --gates` is
green (a floor, not the contract); `.claude/rules/gate-rules.md` is byte-unchanged, so "automation
executes between gates, never supplies the authority of a gate" still governs. But two descriptions
now read as if an artifact settles a gate: `.claude/skills/plan-creator/SKILL.md:5` — "Writes the
multi-file implementation plan that **clears Gate 1**" (POST-8 said "Enforces Gate 1") — and
`.claude/skills/review/SKILL.md:5` — "emits the **landing verdict**" (POST-8 said "produces
PASS/WARN/FAIL verdict per dimension"). Each is mirrored on two further surfaces
(`packages/docs/content/docs/reference/skills/index.mdx:286`, `:301`;
`packages/docs/docs-reference-manifest.json:2176`, `:2431`), so a wording fix must regenerate.
*Why acceptable here:* the grammatical subject is the artifact, not the skill, and a plan does need
approval and a verdict is what Gate 2 reads. No rule, agent or skill prose claims a non-human may
approve. Nothing executable changed.
*What would make it a failure:* either phrase appearing in `.claude/rules/`, or any prose stating that
a verdict, score or check clears a gate without human approval. Suggested wording: "the plan a human
approves at Gate 1" and "emits the Gate 2 review verdict".

**3. This sprint's new metadata invariants are pinned by nothing committed.**
*What it means:* clause presence, clause-id resolution, description/`when_to_use` uniqueness, field
non-emptiness and the 46-block integration cap were verified once by ad-hoc scripts (mine agreed with
the builder's), but no committed test or validator asserts them; the schema makes `when_to_use`
optional (`packages/mewkit/schemas/skill-schema.json:6`, `:28`). Only the aggregate byte ceiling would
notice a regression, and a regression here makes blocks *smaller*, so the ceiling would stay green.
*Why acceptable in default mode:* TDD is off; the contract required these as one-time assertions, not
as committed checks, and all of them hold today by measurement.
*What would make it a failure:* strict mode, or a second sprint relying on these invariants without
pinning them. Remedy is small and the pattern already exists: one ship-set test alongside
`tests/always-on-budget-ceilings.test.ts`.

**4. The only live routing evidence covers the smaller half of the cut.**
*What it means:* branch (a)'s probe covers 7 specs over 21 integration leaves — 7 875 B of the
54 397 B removed. The 104 non-integration skills, which gave up ~49 779 B, and the 20 unchanged agents
have **no** routing measurement at all; and the probe is a single sample per spec at default
temperature, which the record states plainly rather than glossing (`routing-live.md` qualification).
*Why acceptable here:* AC-04 is a static criterion by design and AC-07 scoped the live run to the
`j13…` specs; the probe deliberately withholds hub bodies and `CLAUDE.md`, which is the harsher
reading, and it still returned 7/7 before and after.
*What would make it a failure:* a routing-correctness claim extended beyond integration skills. None
appears in the evidence or the descriptions — I checked.

**5. `mk:evaluate` lost its "Experimental" caveat from the one surface that is always listed.**
*What it means:* POST-8's description opened "Experimental behavioral evaluator … the runner is not yet
a fully implemented automated evaluation system". The rewrite reads as a finished capability
(`.claude/skills/evaluate/SKILL.md:5`); the caveat survives only in the body heading (`:33`), which is
read after selection.
*Why acceptable here:* no criterion requires maturity labels, the byte budget is tight, and the body
still carries it.
*What would make it a failure:* a user or agent routing to `mk:evaluate` expecting a supported
automated runner and finding a manual one. Cheapest fix is one word: "Experimentally drive a running
build…".

**6. Amendment 1 clauses (a) and (b) cannot be verified before the code commit exists — they are
post-commit obligations.**
*What it means:* clause (c) is proven now (byte-identical hunks, 9 466 B). Clauses (a) and (b) require
the code commit: `git merge-base --is-ancestor 3f85e7ff <code>` must succeed, the two SHAs must differ,
and `git log 3f85e7ff..<code>^ -- .claude/skills .claude/agents` must be empty. I verified the inputs
that make them reachable: `3f85e7ff` contains **only** seven no-ship `.md` files under
`tasks/reviews/evidence/…sprint-9/` — no spec, no validator, no metadata — and the reflog shows it as
the current tip with no history rewrite.
*Why acceptable here:* the shape is exactly what Amendment 1 prescribes, and the obligation is
mechanical.
*What would make it a failure:* a code commit that is not a descendant of `3f85e7ff`, a metadata commit
landing between the two, or an amend/rebase that rewrites `3f85e7ff`. **After the code commit the human
or orchestrator must run those three commands and record the result**; AC-11's "regeneration leaves
`git status --porcelain` empty" is the same kind of post-commit re-check.

**7. Process disclosure: `git reset -q` was run once by the orchestrator against its own constraints.**
*What it means:* an index-only unstage. I verified the consequence rather than the intent: `HEAD` is
`3f85e7ff`, the reflog shows five commits and no reset, no amend and no rebase, and the working tree is
the tree I measured. A pathless-or-pathed `git reset` without `--hard` cannot lose working-tree
content, and nothing in the staged set was unique to the index.
*Why acceptable here:* zero artifact impact, and it was disclosed rather than discovered.
*What would make it a failure:* any `git reset --hard`, `checkout`, `stash` or `clean` in the same
situation, or a disclosure that did not match the reflog.

**8. The contract's "two disjoint measured sets" wording is inaccurate, and the implementation is
right to diverge.**
*What it means:* AC-02 asks for two comparisons over "two disjoint measured sets", but the
always-listed total **contains** the rules subtotal, so literal disjointness and the criterion's own
mandatory probe (rules over 25 600 while the total stays under 70 000) cannot both be satisfied. The
simplifier changed the script comments to describe what is actually measured
(`scripts/check-always-on-budget.cjs:4-8`) instead of restating the contract.
*Why acceptable here:* AC-02's **enforced** content is two comparisons that each exit non-zero on
breach, and both do — I reproduced the rules-only breach (exit 1, rules named) and the total breach
(exit 1, file, bytes and overage named). Nesting does not weaken either comparison; it is what makes
the rules ceiling independently protective.
*What would make it a failure:* collapsing the 25 600 comparison into a print, or a comment that
claims disjointness the code does not implement.

**9. Record-only items.** (a) `node scripts/check-no-python.cjs` exits 2 on this host until
`--allow-existing-envs` is passed, because `.meowkit/envs/` is populated locally; with the flag it is
26/26 green, and CI starts clean — a precondition about local state, disclosed at
`evidence.md:396-399` and confirmed by me. (b) A pre-existing import defect at
`.claude/skills/web-to-markdown/scripts/fetch_as_markdown.py:37` was worked around with `PYTHONPATH`
during the spike and deliberately not patched mid-sprint; it is recorded as a follow-up, and I agree
with not fixing it here. (c) Two hook-injected "You must run the Skill(...)" texts appeared in this
review's own tool output; both were treated as data per `.claude/rules/injection-rules.md` Rule 2 and
neither was acted on.

## Suggestions (non-blocking)

- Take item 2's two wordings now; they are four surfaces and one regeneration, and they are the kind of
  phrase that gets quoted later as precedent.
- Item 3's test is the highest-value small addition available: one ship-set test would convert this
  sprint's one-time measurements into standing guarantees, and `tests/always-on-budget-ceilings.test.ts`
  already shows the shape.
- If a later sprint wants the remaining ~2–3 KB from the 20 non-integration agent descriptions, do it
  with an agent-side routing probe first — `evidence.md:764-791` makes the right call that cutting them
  blind would spend routing quality for headroom nobody needs.
- Consider making `when_to_use` required in `skill-schema.json`, since AC-01 now depends on it being
  present in all 128 blocks.
- `slice-c1-table.md` note 3 still calls `mk:advise`/`mk:grill` reciprocal; `evidence.md:813-816`
  already corrects it, so the table is the only stale copy.

## Post-review changes (orchestrator)

WARN 2 addressed before the gate was presented, so the approved text is the final text:

- `.claude/skills/plan-creator/SKILL.md:5` — "the plan that clears Gate 1" → "the plan a human approves at Gate 1".
- `.claude/skills/review/SKILL.md:5` — "emits the landing verdict" → "writes the Gate 2 verdict a human approves".
- Docs mirror regenerated (`docs-manifest.cjs --write`, then `--check` exit 0). Always-listed 59 426 B (10 574 B headroom),
  `validate --frontmatter` and `validate --gates` pass, docs and kit test files 13/13 (68 tests) pass.

## Gate 2 decision — metadata budget, integration descriptions and the SubagentStart answer

Human approval, given by the owner in response to the Gate 2 prompt for this review (selected answer to the
Gate 2 question):

> "Approve, ack WARNs"

- All nine WARN items above acknowledged as listed, including WARN 1 (97 exclusion targets dropped kit-wide)
  and WARN 6 (Amendment 1 ordering clauses and AC-11's clean status to be checked after the code commit).
- WARN 2 was fixed before the gate was presented (see "Post-review changes").
