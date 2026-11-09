---
contract_schema_version: 1.0.0
task: meowkit-v3-lean-runtime
sprint: 9
plan_ref: tasks/plans/261101-meowkit-v3-lean-runtime/plan.md
rubric_preset: cli-tool
status: negotiating
generator_signed: null
evaluator_signed: null
rounds: 2
created: 261109-2052
---

# Sprint 9 Contract — Metadata budget, integration descriptions and the SubagentStart answer

Testable translation of the three requirements `phase-07-kit-shape.md` kept and sprint 8 deferred —
**Requirement 7** (metadata budget), **Requirement 6** with its routing-case Success Criterion (integration
descriptions) and **Requirement 8** (the SubagentStart spike) — bounded by `plan.md` Decisions 1–7 and
Constraints, and by sprint 8's `D7`, `D10`, `D11`, `D13` and `D15`, which recorded each position and moved
only the criteria that test it. Two cheap in-kit leftovers from sprint 8's Gate 2 reading are added as small
criteria so the prose they affect does not outlive the move that made it wrong. **Every number below was
re-measured on the POST-8 tree, not copied from sprint 8** — and nine of sprint 8's figures have already
moved, because sprint 8 promoted commands to skills and shortened rules. Where sprint 8's contract and the
tree disagree, the tree wins and the disagreement is recorded here. **Round 2** addresses six evaluator
clarifications, corrects three line citations (two of them the evaluator's own) and records one new
denominator finding; decision numbers are stable, round 2 replaces text in place and deletes nothing.

## Pinned baseline

**POST-8** = commit **`f387e586`** — "feat(kit): ship one lean tree and keep runtime state under
`.meowkit`", the sprint-8 delivery commit and the current `HEAD` of `feat/v3-lean-runtime`. Every "at
POST-8" claim and every `git diff POST-8` resolves against that commit. **Round 2 supersedes round 1's
baseline wording:** round 1 was drafted while sprint 8 sat uncommitted awaiting human Gate 2 approval, so it
pinned `d17cc03b` plus a working tree and carried a re-measure-and-amend risk. Sprint 8 is now committed,
every figure below was re-measured against `f387e586` and reproduces, so **the baseline is a commit and the
risk is withdrawn**.

Measured at POST-8 (Node 24):

- **The shipped kit after sprint 8.** `scripts/kit-ship-set.cjs` yields **1155** files (sprint 8's BASE:
  1228) over **three** archive roots — `.claude`, two named `.meowkit` files and `release-manifest.json`
  (`tasks/` is gone) — with **6** `.claude/` top-level entries: `agents/`, `hooks/`, `rules/`, `skills/`,
  `settings.json`, `statusline.cjs`. Sprint 8's shape criteria landed; this sprint changes the **contents**
  of two of those six directories and nothing about the shape.
- **Always-listed at POST-8 = 113 798 B, which is 2 206 B HIGHER than sprint 8's BASE of 111 592 B.**
  Measured with the extractor sprint 8's Definitions named — each ship-set file's frontmatter YAML-parsed,
  `Buffer.byteLength` over the **scalar values**, never a line or regex match:
  **rules** 7 files **25 417 B** (`check-always-on-budget.cjs`, **183 B** of headroom under its 25 600-byte
  literal — sprint 8 spent 84 of the 99 bytes it had); **128** shipped `SKILL.md` → **74 056 B**
  (avg **579**); **42** shipped agents → **14 325 B** (avg **341**). The rise is the expected consequence of
  sprint 8's own work: skills went **125 → 128** (D3's promotion cap, exercised) at **+2 276 B**, agents
  **+14 B**, rules **−84 B**. So the cut this sprint owns got **larger**, not smaller, after the sprint that
  was split off to settle the denominator — which is the measurement D15 predicted and the reason the number
  is restated here rather than inherited.
- **The cut, arithmetically.** Metadata-only (skills plus agents) is **88 381 B**. With the total gate at
  **70 000 B decimal** (D7) and the rules subtotal pinned at **≤25 417 B**, metadata must come down to
  **≤44 583 B** — a cut of **43 798 B**, **49.6 %** of all metadata and **38.5 %** of the always-listed
  total, across all **170** blocks (128 skills + 42 agents). Not a trim of the worst offenders: a rewrite of
  essentially every block.
- **The per-block budget, net of `name` values — added in round 2 because the evaluator's achievability
  arithmetic is the number the generator actually has to hit.** `name` is a measured field and is not
  rewritable (it is the routing id), so it is a fixed floor. Integration blocks carry **656 B** of `name`
  values (24 skills **371 B** + 22 agents **285 B**), leaving **6 244 B** of the **6 900 B** cap for
  `description` plus `when_to_use` — **135.7 B per block**. Non-integration blocks carry **1 623 B** of
  `name` values (104 skills **1 435 B** + 20 agents **188 B**) against a remaining budget of
  **37 683 B** (44 583 − 6 900), leaving **36 060 B** over **124** blocks — **290.8 B per block**, against
  a measured **595.1 B** average for non-integration skills and **387.6 B** for non-integration agents.
  Tight but arithmetically real, exactly as the evaluator computed.
- **The phase's per-item caps re-derived at POST-8 counts still fit, with less slack than before.**
  25 417 (rules) + 104 non-integration skills × 280 (29 120) + 24 integration skills × 150 (3 600) +
  20 non-integration agents × 250 (5 000) + 22 integration agents × 150 (3 300) = **66 437 B** — **3 563 B**
  under the gate. The gate is achievable; the caps are the arithmetic that proves it, and D7's decision that
  they are **reported, never enforced**, stands.
- **Field subtotals, so no extractor ambiguity survives into the gate.** Over the 128 shipped skills:
  `name` **1 806**, `description` **47 442**, `when_to_use` **24 808**, all three **74 056**. **Every** one
  of the 128 has a `when_to_use`, so no total is explainable as a missing field. Agents: `name` plus
  `description` = **14 325** over **42** files — the two `.md` files under `.claude/agents/` with no
  frontmatter at all (`AGENTS_INDEX.md`, `SKILLS_INDEX.md`) are indexes, not agents, and are excluded by the
  parse rather than by a name list.
- **Where the bytes are.** Largest skill metadata blocks: `advise` **1 425**, `grill` **1 208**,
  `visual-plan` **1 160**, `vue-testing-best-practices` **1 012**, `context-engineering` **929**,
  `ask-me` **925**, `orchestrate` **911**, `vue-best-practices` **907**,
  `improve-codebase-architecture` **871**, `figma` **857**. Largest agents: `athena` **729**,
  `project-manager` **556**, `researcher` **513**, `explore` **484**, `jira-issue` **475**. The ten largest
  skills total **10 205 B** — **23 %** of the required cut, which is why the top of the list cannot carry it.
- **Integrations, measured by the same extractor.** **24** integration skills = **12 167 B** and **22**
  integration agents = **6 574 B**, **18 741 B** together (the phase said "19.4 KB"). The 24 skills are
  **2 hubs** (`mk:jira`, `mk:confluence`) plus **21** `jira-*`/`confluence-*` leaves plus `story-sizer`; the
  22 agents are 16 `jira-*`, 5 `confluence-*` and `story-sizer`, with **no hub agent**. At the phase's
  150-byte figure the 46 blocks come to **6 900 B**, saving **11 841 B** — **27.0 %** of the required cut
  from **27 %** of the blocks. Both hubs are already `default_enabled: false` with
  `requires_external_service`, **and their metadata ships and is listed anyway** — so disabling buys nothing
  here and the budget counts them.
- **Journeys, with the literal count corrected in round 2.** `tests/journey-validation/journey-specs.jsonl`
  holds exactly **12** specs, `j01-typo-build-error … j12-ssrf-poisoned-url`, and **zero** naming Jira or
  Confluence. The freeze lives in the validator, in **three enforcing or reported places**:
  `check-journey-specs.py:44` (`if len(journeys) != 12`), `:45` (the failure message
  `expected 12 journeys …`) and **`:89`** (the success print `PASS — 12 journeys frozen …`). **The
  evaluator's and the orchestrator's `:88` is off by one — the print is at `:89`**; `:90` also contains
  `j12`, but as a journey **id** in a prose list, not as a count, so it is not a fourth literal. Two further
  mentions of `12` sit in the module docstring at `:5` and `:7`. `REQUIRED_IDS` is built at `:30` as
  `{f"j{n:02d}" for n in range(1, 13)}` and compared against id **prefixes**, so it is a numeric range, not
  a literal id list. Each spec carries **12** required fields including `oracle_layers`, constrained to
  `{deterministic, live}`. **5** of the 12 already use a `model:routing` oracle, so a routing spec is an
  established shape here, not an invention.
- **The live-run branch is prima facie available on this host.** `claude` resolves to
  `/Users/sangnguyen/.local/bin/claude`, version **2.1.316**. That makes the `claude -p` branch of D11
  **feasible to attempt** and therefore the branch AC-07 expects — but availability of a binary is not a
  successful run, so AC-07 is written as a binary one-of-two, names the literal evidence path, and imposes
  the ordering branch (a) physically requires.
- **The budget check that exists.** `scripts/check-always-on-budget.cjs` measures **only**
  `.claude/rules/` markdown against a `LIMIT_BYTES = 25600` literal, prints each file's size, and exits
  0/1/2 (2 = rules dir unreadable). It is wired at `ci.yml:188` as
  `node scripts/check-always-on-budget.cjs .`. It has **no** skill or agent term today, so this sprint
  extends one committed check rather than adding a second answer to one question — and, per round 2, the
  extension **adds** a comparison rather than **replacing** the one that is there.
- **The surface that actually mirrors the metadata — corrected in round 2, and the correction changes
  AC-11's subject.** Round 1's Given was wrong on both surfaces it named and silent on the one that
  matters. The generated CLI manual is rendered from `packages/mewkit/dist/cli/command-catalogue.js` and
  carries **no** skill-metadata term, so `generate-cli-manual.cjs --check` (`ci.yml:216`) is a **no-op** for
  a metadata rewrite. The codex and cursor bundles are **hand-authored verbatim copies**
  (`codex-authored-bundle.ts` "no runtime transform", `modules/codex/manifest.json`
  `generatedFrom: "hand-authored + porter"`) whose descriptions are **already independently short** — codex
  `mk-grill` is **185 B** against `.claude` `mk:grill`'s **1 208 B** — and
  `validate/targets/codex-target.ts:10-12` states the validator "does NOT read the source `.claude/`", so
  no projection regeneration and no target validator can observe this rewrite. The surface that **does**
  carry the verbatim text is `packages/docs/docs-reference-manifest.json` — **171** entries, each with a
  `description` and a `sourceHash` — together with the `GENERATED:reference-index` block at
  `packages/docs/content/docs/reference/skills/index.mdx:197-335`, drift-checked by
  `scripts/docs-manifest.cjs --check` at **`ci.yml:305`**. A 170-block rewrite fails that check until the
  manifest and the block are regenerated.
- **A denominator mismatch the clarification did not name, found while verifying it.** The docs manifest
  holds **129** skill entries and **42** agent entries (**171**), while the ship set holds **128** skills
  and **42** agents (**170**). The extra entry is **`skills/benchmark/SKILL.md`**, which left the **shipped
  kit** by `base.exclude` in sprint 8 (its D5) but is still a **tracked skill in the repository** and still
  has a manifest entry. So the budget's set and the manifest's set legitimately differ by one, and
  `mk:benchmark`'s description is **not** in the 44 583-byte budget while it **is** in the regenerate-to-no-
  diff set. AC-11 names the mismatch so an evaluator does not read it as a drift failure, and AC-01 keeps
  its denominator at the ship set.
- **SubagentStart, as the tree currently asserts it — the record corrected in round 2.** The contradiction
  to reconcile is the **claude** record at `core/provider-lifecycle.ts:82-86`: `subagent_start` with
  `status: "supported"`, `gate: false`, `evidence: "SubagentStart hook in shipped settings.json (observe)"`
  — and the registration that evidence cites, `.claude/settings.json:162`, is an **empty array**, so the
  record's own evidence is a hook that injects nothing. Round 1 named the **codex** record at `:116`; that
  is a different harness and is secondary. Against the claude record stand **five** in-tree assertions of
  the blanket loop claim: `skills/cook/references/orchestration-rules.md:99` and `:113`,
  `docs/architecture/context-isolation.md:21` ("wiring them would cause infinite recursion inside
  subagents") and `:112`, and `docs/core/meowkit-architecture.md:246` ("intentionally empty") — plus
  `docs/reference/sub-agents.md:523,531`, which **documents how to register the hook** and so reads as a
  sixth, contradicting site. A spike scoped to `orchestration-rules.md` alone would leave the tree still
  holding two answers.
- **The two Gate 2 leftovers, exactly scoped.** `session-state` appears in **106** git-tracked files /
  **208** occurrences repo-wide. The share this sprint owns is the **provider bundles**:
  **57 files / 96 occurrences** under `packages/mewkit/src/migrate/modules/` — codex **34 files / 56
  occurrences**, cursor **23 files / 40 occurrences**, **54** `.md` and **3** `.toml`
  (`advisor.toml`, `confluence-spec-analyst.toml`, `developer.toml`). These are **authored** bundle sources
  (`modules/{codex,cursor}/root/`), not generated output, so the prose is editable at its own path. The
  second leftover is one line: `.claude/skills/plan-creator/assets/bead-template.md:40` —
  "Progress tracked in `session-state/build-progress.json`".
- **What must NOT change, measured so it cannot be swept up.** Three `.claude` files name `session-state`
  deliberately: `hooks/lib/meowkit-paths.cjs:23,27` (`LEGACY_STATE_RELS` — the legacy-read path that lets a
  pre-move project still be understood), `hooks/lib/gate2-check.cjs:70` (remediation prose that
  `meowkit-paths.cjs:23`'s comment explicitly keeps true for that legacy path), and
  `hooks/__tests__/resolve-model.test.cjs:99` (the test that proves the legacy read works). A fourth,
  `skills/agent-browser/references/session-management.md:11`, is a markdown anchor
  (`#session-state-persistence`), not a path.

## Decisions (user standing directive 261101: take the recommended option)

Twelve points. The user's standing instruction for this plan is to take the recommended option, so D1–D12
are DECIDED, not proposed. **D2, D5, D6, D8 and D10 are marked `[CHALLENGE]`** — each narrows a phase
requirement, contradicts an in-tree assertion, or rests on a measurement taken after the phase was written.
Decision numbers here are local to sprint 9; where a sprint-8 decision is carried forward it is cited by its
own number (`sprint 8 D7`, etc.). Round 2 corrections are marked in place; no number is deleted.

- **D1 One check, and — corrected in round 2 — TWO enforced comparisons over two disjoint sets.** Carrying
  forward `sprint 8 D7`: the metadata gate is an always-listed total of **70 000 bytes decimal**, enforced
  by extending `scripts/check-always-on-budget.cjs`, with the phase's per-item caps **printed, never
  enforced**. The decimal reading is confirmed, not assumed — the phase's own 25 600 B is written "25.6 KB",
  so 70 KB reads as 70 000 and no rounding to 71 680 is available. **Round 2 correction, on the
  orchestrator's decision:** round 1 said "one enforced number", which would have made the existing
  rules-only comparison against **25 600** decorative. The extended check now enforces **both** — the
  rules-only subtotal against **25 600** (the existing exit-1 condition, kept live) **and** the always-listed
  total against **70 000**. These are **two questions over two disjoint sets**, not two answers to one
  question: the rules set is `.claude/rules/` markdown, the total set is rules plus metadata, and the
  anti-pattern D1 forbids is two checks answering *the same* question. What remains forbidden is a **second
  script**, a **second extractor** and **per-item caps as gates**. No ceiling is removed.
- **D2 `[CHALLENGE]` The 25 600-byte rules literal stays LIVE, and the rules subtotal is pinned at its
  measured 25 417 B — the metadata cut may not be paid for out of rules headroom.** Sprint 8 spent 84 of
  the 99 bytes it inherited and left **183**. **Round 2 correction:** round 1 made the rules subtotal
  *reported*, which the evaluator correctly read as removing CI's only always-on-rules ceiling — rules could
  grow to 40 000 B and pass on the total while metadata absorbed the loss, precisely the trade this decision
  exists to forbid, with AC-03's ≤25 417 B binding this sprint's evaluator and nothing after it. DECIDED:
  the 25 600 comparison stays an **enforcing** exit-1 condition that outlives this sprint, AC-03 adds the
  stricter ≤25 417 B acceptance for this sprint, and the literal is **not** raised and **not** removed. This
  is a `[CHALLENGE]` because it makes one of the two summands immovable, which is strictly harder than the
  phase's single-total wording requires.
- **D3 The extractor is the one sprint 8's Definitions named, and it is implemented once.** YAML-parse the
  frontmatter of every **ship-set** file; `Buffer.byteLength` over the scalar values of `name` plus
  `description` plus `when_to_use` for skills and `name` plus `description` for agents. No line-based or
  regex extraction, and the check reads the ship set from `kit-ship-set.cjs` rather than globbing `.claude`,
  so the budget and the published artifact cannot disagree — which is also why `mk:benchmark`, excluded from
  the ship set in sprint 8, is outside the budget while remaining a tracked skill. Sprint 8's round-1 figure
  (54 168 B) was reproduced by no field subset and was an extraction artefact; three plausible extractors
  give three totals, so the implementation is the definition.
- **D4 The cut comes from rewriting descriptions, never from deleting a field, a skill or an agent.** Every
  shipped skill keeps a `name`, a `description` and a `when_to_use`; every shipped agent keeps a `name` and
  a `description`. Dropping `when_to_use` would move **24 808 B** out of the measured set in one edit while
  making the routing decision worse — a gate you pass by deleting the thing it measures. The shape is the
  phase's: one job, and one "NOT for" clause. `name` is the routing id and is a fixed floor, which is why
  the real per-block budgets are **135.7 B** and **290.8 B** net of names.
- **D5 `[CHALLENGE]` Integrations shrink by rewriting only, and the hub carries the routing detail — no
  pack move, no `default_enabled` flip, no deletion.** `plan.md` Decision 6 is user-confirmed, and sprint 8
  D10 recorded the position. The challenge is to the tempting shortcut the measurement exposes: both hubs are
  **already** `default_enabled: false`, so an agent could "save" 18 741 B by arguing the integrations are not
  really always-listed. They are — the extractor counts them because the kit ships them and the harness lists
  them. DECIDED: the 46 integration blocks are rewritten to a hub-naming one-liner plus the verb set at the
  phase's 150-byte figure, saving **11 841 B** of the required 43 798; the remaining **31 957 B** comes from
  the other 124 blocks. No integration skill or agent is moved, deleted or re-flagged. **Round 2 addition,
  on the orchestrator's decision:** a `NOT for <id>` exclusion clause is **not** the routing rule this
  decision forbids — what is forbidden is a leaf restating the hub's selection logic. A leaf **may** omit the
  exclusion clause when **135.7 B** cannot fit it, and the sprint must **state which leaves omitted it and
  why**, so the omission is a recorded decision rather than an unexplained gap.
- **D6 `[CHALLENGE]` The routing specs are added, the frozen count and id set are raised visibly in the
  validator, and the specs go in BEFORE the rewrite.** Carrying forward sprint 8 D11.
  `check-journey-specs.py` hardcodes the count and the id range and runs in CI, so adding specs without
  editing the validator fails CI and adding them by loosening the assertion to "≥12" silently ends the
  freeze. DECIDED: the count literal and the `REQUIRED_IDS` range are both raised to the new figure in the
  **same change** that adds the specs, keeping the set frozen at a new number rather than unfrozen. The
  phase's Success Criterion says the cases "all pass before and after", so the specs are committed and
  recorded passing **before** AC-05's rewrite lands — otherwise "before" has no measurement and the
  criterion is unfalsifiable. **Round 2 addition:** the new ids are **`j13…`**, continuing the numeric range
  `REQUIRED_IDS` is built from, and **all three** `12` literals move together (`:44`, `:45` and **`:89`** —
  not `:88`), because a run that raises only the assertion goes green while still printing the old count.
  This is a `[CHALLENGE]` because it imposes an ordering the phase only implies.
- **D7 The new specs' oracle is `model:routing` with `oracle_layers: ["live"]`.** The deterministic layer
  checks structural parity and cannot select a route, and **5** of the 12 existing specs already carry
  `model:routing`, so the shape is established. The deterministic CI check (`check-journey-specs.py`) proves
  the specs are well-formed, complete and unfrozen-by-declaration; it does not and may not claim the route
  was correct.
- **D8 `[CHALLENGE]` The live routing run is a binary one-of-two with its branch named, its evidence path
  literal, and its attempt ordered before the rewrite.** Sprint 8 D11 recorded that an unqualified "run
  live" verification line is the one thing a contract cannot be graded on. `claude` **is** on this host at
  version 2.1.316, so the attempt is expected — but a non-interactive `claude -p` run inside an agent session
  can fail for reasons unrelated to routing (auth, nesting, rate limit), and "it was available" is not
  evidence. DECIDED: AC-07 passes iff **exactly one** of two artifacts exists at the literal path — a
  recorded run, or an **explicit deferral record**. **Round 2 additions, on the orchestrator's decision:**
  the path is `tasks/reviews/evidence/<date>-meowkit-v3-lean-runtime-sprint-9/routing-live.md`, matching the
  convention sprints 4–8 already use; the **pre-rewrite attempt must run before any AC-04 or AC-05 metadata
  edit**, because branch (a) needs verbatim before-rewrite output and a generator that rewrites first makes
  (a) physically impossible and (b) the only reachable branch — a self-fulfilling deferral; and branch (b)
  is available **only** for a **recorded failed attempt**. "No before-state available" is **not** an accepted
  failure mode.
- **D9 The SubagentStart spike registers nothing and ships no injector.** Carrying forward sprint 8 D13.
  `settings.json`'s `"SubagentStart": []` stays empty, no handler is added, and no always-on rule is
  shortened on the strength of the answer — a hook written in the same sprint as its own feasibility study
  has no independent check. The **single** host observation from sprint 8's drafting (a third-party
  SubagentStart hook firing once into a sub-agent context) is **existence evidence only, not throttling
  evidence**, and the spike record must carry that qualification so it cannot be read as a green light.
- **D10 `[CHALLENGE]` The spike's deliverable is a decision that resolves a contradiction already in the
  tree; `adopt` is a permitted outcome that still ships nothing; and documentation absence is not a FAIL.**
  The phase frames the spike as "does it loop?". Measured, the tree holds **two incompatible answers**, and
  **round 2 corrects which records they are**: the claim to reconcile is the **claude** record at
  `core/provider-lifecycle.ts:82-86` — `subagent_start` `status: "supported"` on the evidence of a shipped
  registration that is an **empty array** — against **six** assertion sites of the blanket loop claim
  (`orchestration-rules.md:99,113`, `context-isolation.md:21,112`, `meowkit-architecture.md:246`, and
  `sub-agents.md:523,531`, which documents how to register it). Round 1 named the **codex** record at
  `:116`; that is a different harness and is secondary. DECIDED: the spike writes **one** answer, with a
  dated citation, into every site that asserts the loop, and states whether the claude provider record
  agrees or is superseded. **`adopt` and `reject` are both passing outcomes** — `adopt` means "the blanket
  claim is corrected and a throttled injector becomes a future candidate", not "an injector ships", because
  D9 forbids shipping one this sprint. **Round 2 addition, on the orchestrator's decision:** "current
  official documentation" means the **Anthropic Claude Code hooks reference**, retrieved via
  `mk:docs-finder` (Context7 → Context Hub → WebSearch), cited with its retrieval date. **If that reference
  does not enumerate `SubagentStart`**, the record states that absence with the date and the chain
  attempted, and the decision then rests on **in-repo evidence** — the six assertion sites, the empty array,
  codex's capability table 0.142 and the one qualified host observation — and is **recorded as resting on
  it**. A spike that FAILs because a vendor page is silent would contradict this decision's own "both
  outcomes pass".
- **D11 The two Gate 2 leftovers are prose-only and bounded by their measured counts.** The **57 files /
  96 occurrences** in the provider bundles and the one line at `bead-template.md:40` are documentation that
  describes a path sprint 8 moved. They are in scope because they are cheap, in-kit and already measured.
  **The three deliberate `.claude` readers are explicitly not in scope**: `meowkit-paths.cjs`'s
  `LEGACY_STATE_RELS`, `gate2-check.cjs:70`'s remediation prose and `resolve-model.test.cjs:99` are the
  legacy-compatibility surface sprint 8 kept on purpose, and the anchor link in
  `agent-browser/references/session-management.md:11` is not a path at all. **Round 2 clarification:** the
  bundles are in scope for their `session-state` **prose** only — their `SKILL.md`-equivalent
  **descriptions** are hand-authored, already short and read by nothing in `.claude/`, and are out of scope
  entirely (Scope Out).
- **D12 Eleven ACs, and the Gate 2 git fail-open is not one of them.** The three deferred requirements plus
  the two leftovers plus a repo-green criterion fit in eleven, four under the ceiling. The Gate 2 git
  fail-open raised in sprint 8's review is **deliberately excluded**: it is a safety-hook behaviour change
  with its own blast radius, it has no relationship to metadata bytes or routing descriptions, and bundling
  it would put a safety fix behind a budget rewrite's schedule. It gets its own follow-up.

## Definitions

- **Shipped kit:** the file set `scripts/kit-ship-set.cjs` produces from the archive roots minus
  `base.exclude` — the published artifact, not this repository's working tree. **1155** files at POST-8.
- **Always-listed:** bytes a session loads or lists before any skill runs — every `.md` under
  `.claude/rules/`, plus `name` plus `description` plus `when_to_use` from every shipped `SKILL.md`, plus
  `name` plus `description` from every shipped agent. **Extraction method, named because three plausible
  extractors give three different totals:** each ship-set file's frontmatter is YAML-parsed and
  `Buffer.byteLength` is taken over the **scalar values** of those fields — never a line-based or regex
  extraction. A `.md` under `.claude/agents/` with no frontmatter is not an agent and is excluded by the
  parse. Measured that way, POST-8 is **113 798 B** (rules 25 417 + 128 skills 74 056 + 42 agents 14 325).
- **Metadata (the half this sprint cuts):** always-listed minus the rules subtotal — **88 381 B** at POST-8,
  with a ceiling of **≤44 583 B**.
- **The two gates (round 2):** **(i)** the rules-only subtotal against **25 600 B**, the existing exit-1
  condition, kept live and enforcing; **(ii)** the always-listed total against **70 000 B decimal**. Two
  disjoint measured sets, two enforced comparisons, **one** committed check and **one** extractor. Per-item
  caps are printed output, not gates (D1).
- **Mirror surface:** `packages/docs/docs-reference-manifest.json` (171 entries, each with `description` and
  `sourceHash`) plus the `GENERATED:reference-index` block at
  `packages/docs/content/docs/reference/skills/index.mdx:197-335`, drift-checked by
  `scripts/docs-manifest.cjs --check` (`ci.yml:305`). It is the **only** committed surface that carries the
  metadata text verbatim; the generated CLI manual and the codex/cursor bundles do not (round 2).
- **Integration block:** the metadata of one of the 24 integration skills or 22 integration agents measured
  above — `mk:jira`, `mk:confluence`, their `jira-*`/`confluence-*` leaves, and `story-sizer`.
- **Hub / leaf:** `mk:jira` and `mk:confluence` are hubs: they carry the routing detail and name no
  operation. Every other integration skill is a leaf: it names its hub and its verb set.
- **Exclusion clause (round 2):** a negative phrase in a `description` naming what the skill is **not** for
  — "NOT for", "not for", "NOT an executor" or equivalent. A `NOT for <skill-id>` form is permitted and is
  **not** the hub routing rule D5 forbids. Any skill id it names must resolve in the finished inventory.
- **Routing spec:** one line in `tests/journey-validation/journey-specs.jsonl` carrying all **12** required
  fields `check-journey-specs.py:22-27` names, with `oracle: "model:routing"` and
  `oracle_layers: ["live"]`, and an id in the **`j13…`** range.
- **Recorded live run:** the file
  `tasks/reviews/evidence/<date>-meowkit-v3-lean-runtime-sprint-9/routing-live.md` naming the exact command
  invoked, the model id, the verbatim before-rewrite and after-rewrite outputs, and a per-spec pass/fail.
  Anything less is not a run.
- **Explicit deferral record:** the same path, naming a **recorded failed attempt** — the command tried, the
  observed failure mode, the date — and the statement that the specs plus the deterministic CI check stand
  without a live result. A silence is not a deferral record, and "no before-state available" is not an
  accepted failure mode (D8).
- **Spike decision record:** a committed statement of `adopt` or `reject`, its reasoning, and either a dated
  citation to the Anthropic Claude Code hooks reference retrieved via `mk:docs-finder`, or a dated record of
  that reference not enumerating the event plus the in-repo evidence the decision rests on instead (D10).
- **Safety hook:** `gate-enforcement.cjs`, `privacy-block.cjs`, `pre-ship.cjs` and the Gate 2 libraries they
  call. Their observable contract is exit 2 with `@@GATE_BLOCK@@` or `@@PRIVACY_BLOCK@@`. Unchanged by this
  sprint.

## Scope (In)

- Rewriting the metadata of all **170** always-listed blocks (128 shipped skills, 42 shipped agents) so the
  always-listed total is **≤70 000 B decimal**, down from **113 798 B**, with every field retained (D1, D3,
  D4)
- Extending `scripts/check-always-on-budget.cjs` into the one committed check that enforces **both** the
  rules-only subtotal against the live **25 600** literal and the always-listed total against **70 000**
  over two disjoint sets, and reports every item descending by size — with the rules subtotal held at
  **≤25 417 B** this sprint (D1, D2)
- Rewriting the **46** integration blocks (24 skills, 22 agents) to a hub-naming one-liner plus the verb set
  within **135.7 B** per block net of names, with the routing detail carried by `mk:jira` and
  `mk:confluence`, and no pack move, deletion or `default_enabled` change (D5)
- Adding **≥6** Jira/Confluence routing specs with **`j13…`** ids, `oracle: "model:routing"` and
  `oracle_layers: ["live"]`, raising all three `12` literals (`:44`, `:45`, `:89`) and the `REQUIRED_IDS`
  range in the same change, and committing them before the rewrite lands (D6, D7)
- Attempting the live routing run **before** any metadata edit and leaving exactly one artifact at
  `tasks/reviews/evidence/<date>-meowkit-v3-lean-runtime-sprint-9/routing-live.md` (D8)
- Recording the SubagentStart answer as a dated `adopt`/`reject` decision, written into **all six**
  assertion sites, stating whether `core/provider-lifecycle.ts:82-86`'s claude record agrees or is
  superseded, and registering no handler (D9, D10)
- Correcting the **57 files / 96 occurrences** of `session-state/` prose in the codex and cursor authored
  bundles, and the one line at `.claude/skills/plan-creator/assets/bead-template.md:40` (D11)
- Regenerating `packages/docs/docs-reference-manifest.json` and the `GENERATED:reference-index` block so
  `scripts/docs-manifest.cjs --check` is green, and keeping every other committed validator, test and golden
  case green

## Scope (Out)

- **The codex and cursor bundle skill descriptions.** They are hand-authored verbatim copies, already
  independently short (codex `mk-grill` **185 B** against `.claude` `mk:grill`'s **1 208 B**), and
  `validate/targets/codex-target.ts:10-12` states the target validator "does NOT read the source
  `.claude/`" — so they neither mirror this rewrite nor can observe it. No parity between bundle
  descriptions and `.claude` descriptions is asserted, and rewriting them is not in this sprint (D11,
  round 2)
- **The generated CLI manual as a parity surface.** It is rendered from
  `packages/mewkit/dist/cli/command-catalogue.js` and carries no skill-metadata term, so
  `generate-cli-manual.cjs --check` (`ci.yml:216`) is a no-op for this rewrite. It is asserted only as
  "still green", never as evidence the rewrite propagated (round 2)
- **The Gate 2 git fail-open.** A safety-hook behaviour change with its own blast radius and no relation to
  metadata bytes or routing descriptions. It gets its own follow-up and is not amended into this contract
  (D12)
- Raising, removing, or reducing to a report the **25 600-byte** rules comparison, and paying for the
  metadata cut by shortening any `.claude/rules/` file. Both comparisons stay enforced and the rules
  subtotal may not exceed **25 417 B** (D1, D2)
- Deleting `when_to_use` from any skill, `description` from any agent, or any other measured field, and
  deleting or unshipping a skill or agent to reduce the measured set (D4)
- A second budget script, a second extractor, or per-item caps enforced as gates (D1, D3)
- Moving any integration skill or agent to a pack, deleting one, or changing `default_enabled` or
  `requires_external_service`. `plan.md` Decision 6 is user-confirmed (D5)
- Loosening `check-journey-specs.py`'s count assertion to an inequality, raising only one of its three
  literals, or adding specs without raising the `REQUIRED_IDS` range in the same change (D6)
- Registering a `SubagentStart` handler, populating `settings.json`'s empty array, shipping a
  subagent-context injector, or shortening any always-on rule on the strength of the spike (D9, D10)
- Bringing `mk:benchmark` back into the shipped kit, or removing its docs-manifest entry, to make the two
  denominators match. The one-entry difference is correct and is recorded, not reconciled (round 2)
- Changing `hooks/lib/meowkit-paths.cjs`'s `LEGACY_STATE_RELS`, `hooks/lib/gate2-check.cjs:70`'s remediation
  prose, or `hooks/__tests__/resolve-model.test.cjs:99` — the legacy-read surface sprint 8 kept on purpose —
  and editing the markdown anchor at `skills/agent-browser/references/session-management.md:11`, which is
  not a path (D11)
- Reopening sprint 8's shape work: the six `.claude/` top-level entries, the three archive roots, the
  command dispositions, the move registry and the Node-only-executable property are settled and are not
  re-litigated here
- Moving any of the five always-on safety rules out of `.claude/rules/`, or changing what a safety hook
  blocks, its exit code or its marker (`plan.md` Constraints)
- Adding any `gates.*`, `paths.*` or protected `hooks.*` key to project config, or any committed file that
  can redirect a safety hook (`plan.md` Constraints)
- Running `init`, `upgrade` or `uninstall` in or against this repository, including with `--help`
  (sprint 7 D11, still binding)
- Editing `packages/docs/content/docs/changelog/*` (sprint 7 D10, still binding)
- Referencing a plan artifact — phase number, sprint number, criterion identifier, decision number, round or
  amendment — in a code comment, test name, file name or script name. This contract may use those tokens;
  nothing it produces may

## Acceptance Criteria

### [AC-01] Always-listed is ≤70 000 bytes decimal, measured by the named extractor over the shipped kit

**Given** the POST-8 always-listed total of **113 798 B** — rules **25 417 B** over 7 files, **128** shipped
`SKILL.md` at **74 056 B** (avg **579**) and **42** shipped agents at **14 325 B** (avg **341**) — measured
by YAML-parsing each ship-set file's frontmatter and taking `Buffer.byteLength` over the scalar values of
`name`, `description` and `when_to_use` (skills) and `name` and `description` (agents); given that this is
**2 206 B higher** than sprint 8's BASE of 111 592 B because sprint 8 promoted three commands to skills
(125 → 128, +2 276 B) while shortening rules by 84 B, so the required cut **grew**; and given that `name`
is the routing id and therefore a fixed floor, leaving **135.7 B** per integration block and **290.8 B** per
non-integration block for `description` plus `when_to_use`
**When** the extractor is run over the finished tree's ship set, each field subtotal is printed, and the
total is compared against **70 000**
**Then** the always-listed total is **≤70 000 B**; the metadata half (skills plus agents) is **≤44 583 B**,
down from **88 381 B**, a cut of **≥43 798 B**; **every** one of the **128** shipped skills still has a
non-empty `name`, `description` **and** `when_to_use`, and **every** one of the **42** shipped agents still
has a non-empty `name` and `description`, so no byte was saved by deleting a measured field; the shipped
skill count is **≥128** and the shipped agent count is **≥42**, so no byte was saved by unshipping a block —
and `mk:benchmark`, excluded from the ship set in sprint 8, is **outside** this denominator by design and
its absence is not counted as a saving; the measured set is read from `kit-ship-set.cjs` and not from a glob
of `.claude`, so the budget and the published artifact cannot disagree; and the per-field subtotals are
printed alongside the total, so a future reader can reproduce the number without guessing which extractor
produced it

- **Verification:** run the committed budget check on the finished tree with
  `PATH=/opt/homebrew/opt/node@24/bin:$PATH node scripts/check-always-on-budget.cjs .`, assert exit 0 and
  read the printed total, the rules subtotal, the skills subtotal, the agents subtotal and the per-field
  subtotals; independently re-derive the same total with a throwaway script that YAML-parses the ship set,
  and assert the two agree exactly; count non-empty `name`/`description`/`when_to_use` across the ship-set
  skills and `name`/`description` across the ship-set agents and assert zero missing; assert the shipped
  skill and agent counts against 128 and 42, and assert `skills/benchmark/SKILL.md` is absent from the
  ship set
- **Rubric tie-in:** functionality (weight 0.40)

### [AC-02] One committed check enforces two comparisons over two disjoint sets, and says what to do on failure

**Given** `scripts/check-always-on-budget.cjs` at POST-8 — it measures **only** `.claude/rules/` markdown
against a `LIMIT_BYTES = 25600` literal, prints each file's size, exits 0 on pass, **1** on overage and 2
when the rules directory is unreadable, and is wired at `ci.yml:188` as
`node scripts/check-always-on-budget.cjs .`; and given that round 1's "exactly one enforced number" would
have reduced that 25 600 comparison to a report, leaving CI with **no** always-on-rules ceiling after this
sprint — rules could reach 40 000 B and pass on the total while metadata absorbed the loss
**When** the extended check is run on the finished tree; on a scratch copy with one skill description
inflated past the **70 000** total; on a scratch copy with `.claude/rules/` inflated past **25 600** while
the always-listed total stays **under 70 000**; and on a scratch copy with the `.claude/rules/` directory
removed
**Then** the check enforces **two** comparisons over **two disjoint measured sets** — the rules-only
subtotal against the **live 25 600** literal, and the always-listed total against **70 000** — and both
exit non-zero on breach; the rules-over-25 600-but-total-under-70 000 copy exits **non-zero**, which is the
probe that proves the ceiling is enforcing and not decorative, and a check that passes that copy is a FAIL
of this criterion; the inflated-description copy exits **1** and names the offending file, its byte count
and the overage in bytes; the missing-rules-directory copy still exits **2**, so the existing
unreadable-input contract is not degraded into a pass; the finished tree exits **0**; `git diff` adds **no
second budget script and no second extractor**, because two disjoint questions in one check is not two
answers to one question; the check **also reports, without enforcing**, the rules subtotal, the skills
subtotal, the agents subtotal, the phase's per-item caps as reference figures, and **every item descending
by size**, so a maintainer who has to find 43 798 B is told where the bytes are; and CI runs the extended
check with no second invocation added

- **Verification:** run the check on the finished tree and assert exit 0; read its stdout and assert it
  contains both limits, the three subtotals, a descending per-item list and the caps marked as reference;
  inflate one skill `description` in a scratch copy, run, assert exit 1 naming the file, its bytes and the
  overage; inflate `.claude/rules/` past 25 600 in a scratch copy while keeping the total under 70 000, run,
  assert non-zero exit and that the rules limit is the stated reason; remove `.claude/rules/` in a scratch
  copy, run, assert exit 2; grep the check source for the 25 600 and 70 000 literals; grep `git diff` for a
  second budget script and a second frontmatter extractor; grep `.github/workflows/` and assert exactly one
  budget invocation
- **Rubric tie-in:** ux-usability (weight 0.20)

### [AC-03] The metadata cut is not paid for out of the always-on rules, this sprint or after it

**Given** the rules subtotal at POST-8 of **25 417 B** over 7 files with **183 B** of headroom under the
25 600-byte literal (sprint 8 spent 84 of the 99 bytes it inherited); and given that a combined total alone
would make shortening an always-on safety rule a *passing* edit — the exact trade `plan.md` Constraints
forbid — with this criterion binding only this sprint's evaluator and nothing after it
**When** the extended check is run on the finished tree, the rules subtotal is compared against POST-8, each
of the five always-on safety rule files is diffed against POST-8, and `scripts/check-rule-survival.cjs` is
run
**Then** the rules subtotal is **≤25 417 B** — no larger than at POST-8, not merely under 25 600; the
**25 600** comparison survives this sprint as an **enforcing exit-non-zero condition**, not a printed
figure, so the ceiling outlives the evaluator who is reading this criterion — asserted by AC-02's
rules-over-25 600 probe, not by reading the source alone; all five always-on safety rules
(`security-rules.md`, `injection-rules.md`, `gate-rules.md`, `core-behaviors.md`, `development-rules.md`)
are still files under `.claude/rules/` and `scripts/check-rule-survival.cjs` is green, so every needle in
`scripts/rule-survival-oracle.cjs` still resolves; and `git diff` shows **zero** deletions of enforcement
prose in any of the five — the only permitted rule-file edits this sprint are none at all, so a non-empty
diff on any of the five files is a finding the evaluator must read before this criterion can pass

- **Verification:** run `node scripts/check-always-on-budget.cjs .`, read the rules subtotal and assert
  ≤25 417; run AC-02's rules-over-25 600 scratch probe and assert non-zero exit; grep the check for the
  25 600 literal and assert it guards an exit, not only a print; `git diff` POST-8 → finished over
  `.claude/rules/` and assert the file set is empty or every hunk is justified in the sprint handoff; run
  `node scripts/check-rule-survival.cjs` and assert exit 0; `ls .claude/rules/` and assert all five safety
  files present
- **Rubric tie-in:** functionality (weight 0.40)

### [AC-04] Shorter metadata still routes: one job, one real exclusion, and every named id resolves

**Given** the rewrite required by AC-01 — **170** blocks cut from **88 381 B** to **≤44 583 B**, leaving
**290.8 B** per non-integration block and **135.7 B** per integration block net of `name` values, against
measured averages of **595.1 B** (non-integration skills) and **387.6 B** (non-integration agents); given
the phase's required shape (one job plus one "NOT for" line); given that the ten largest skill blocks total
only **10 205 B** (**23 %** of the cut), so the rewrite reaches blocks that are already short; and given
that round 1 collided with AC-05 by requiring an exclusion clause in **every** description while AC-05
forbade a leaf from carrying a routing rule inside 135.7 B
**When** every shipped `SKILL.md` `description` and `when_to_use` and every shipped agent `description` is
read on the finished tree, every skill id named in an exclusion clause is resolved against the finished
inventory, and `mewkit validate --frontmatter` and `scripts/check-skill-cross-refs.sh` are run
**Then** **every non-integration** shipped skill's `description` states what the skill does **and** carries
an exclusion clause naming what it is not for; any of the **24 integration skills** — the 21 leaves, both
hubs and `mk:story-sizer`, so no block is left neither required nor recorded — may omit the clause when
**135.7 B** cannot fit it, and each omission is named with its reason in the sprint handoff, so the
exemption is a recorded decision and not an unexplained gap; a `NOT for <skill-id>` clause **is permitted and is not** the
hub routing rule AC-05 forbids, so the two criteria no longer collide; **every skill id named in any
exclusion clause resolves to a skill directory in the finished inventory** — `NOT for mk:nonexistent` is a
**FAIL**, exactly as AC-06 resolves `expected_route`, because without it the sprint could cut **49.6 %** of
the routing metadata and produce no routing evidence at all; **every** shipped skill's `when_to_use` names a
concrete trigger rather than restating the skill name; **no two** shipped skills have identical
`description` text and **no two** have identical `when_to_use` text, so the cut was not achieved by
collapsing distinct skills onto one boilerplate string that routes to whichever is listed first; **no**
`description` or `when_to_use` is empty, whitespace-only, or a bare restatement of `name`;
`mewkit validate --frontmatter` is green, so every rewritten block still satisfies `skill-schema.json`; and
`scripts/check-skill-cross-refs.sh` is green, so no rewrite dropped a `mk:*` reference the kit relies on

- **Verification:** script over the ship set — for each non-integration skill assert `description` non-empty,
  not equal to `name`, and matching a negative-clause pattern; for each of the 24 integration skills
  without a clause assert it is listed in the handoff's omission table; extract every `mk:*` id inside any exclusion clause
  and resolve each against `.claude/skills/*/SKILL.md`, asserting zero misses; assert `when_to_use`
  non-empty and not a restatement of `name`; build the multiset of `description` values and of
  `when_to_use` values and assert zero duplicates; repeat the non-empty and non-restatement assertions over
  the 42 agents; run `mewkit validate --frontmatter` and `scripts/check-skill-cross-refs.sh` and assert both
  exit 0
- **Rubric tie-in:** ux-usability (weight 0.20)

### [AC-05] Integration leaves name their hub and verbs; the hubs carry the routing; nothing moves or disables

**Given** the **46** integration blocks at POST-8 — **24** skills at **12 167 B** (2 hubs `mk:jira` and
`mk:confluence`, 21 `jira-*`/`confluence-*` leaves, and `story-sizer`) and **22** agents at **6 574 B**
(16 `jira-*`, 5 `confluence-*`, `story-sizer`; no hub agent) — totalling **18 741 B**, which at the phase's
150-byte figure becomes **6 900 B** and saves **11 841 B**, **27.0 %** of the required cut; given that
**656 B** of that cap is immovable `name` values (skills **371 B**, agents **285 B**), leaving **6 244 B**,
i.e. **135.7 B** per block for `description` plus `when_to_use`; and given that both hubs are **already**
`default_enabled: false` with `requires_external_service`, so disabling them saves nothing and the extractor
counts them regardless
**When** each of the 46 blocks is read on the finished tree, the two hub skills are read in full, and
`mewkit validate --frontmatter`, `scripts/check-skill-cross-refs.sh` and `mewkit validate --packs` are run
**Then** each of the **21** leaf skills' `description` names its hub by id (`mk:jira` or `mk:confluence`)
**and** names its verb set, and restates **no hub selection logic** — the routing detail lives in the hub
and in exactly one place, while a `NOT for <id>` exclusion clause is **explicitly permitted** and is not
that selection logic; a leaf **may** omit the exclusion clause where **135.7 B** cannot carry hub, verbs and
clause together, and the sprint handoff **names which leaves omitted it and why**; both hub skills still
name every leaf they route to, so **every** one of the 21 leaves is reachable from its hub by name and no
leaf became unroutable by being shortened; `story-sizer` names the hub it belongs to or is explicitly
recorded as hubless with a reason; the **46** blocks together measure **≤6 900 B**, so this criterion's
share of the cut is met and not quietly reassigned to the other 124 blocks; **no** integration skill or
agent changed path, was deleted, or had `default_enabled`, `requires_external_service` or
`dependency_edges` altered — asserted by diffing those keys across all 46 against POST-8, so the
user-confirmed decision to keep integrations in the default install is verified and not just intended; and
`validate --frontmatter`, `check-skill-cross-refs.sh` and `validate --packs` are all green

- **Verification:** script over the 46 blocks — assert each leaf `description` contains its hub id and a
  verb list, measure the 46-block total and assert ≤6 900, and measure the non-`name` bytes and assert
  ≤6 244; read both hub `SKILL.md` files and assert each of the 21 leaf ids appears; cross-check the
  handoff's omission table against the integration skills carrying no exclusion clause (leaves, both hubs
  and `mk:story-sizer`) and assert the two sets match;
  diff `default_enabled`, `requires_external_service`, `dependency_edges` and file paths for all 46 against
  POST-8 and assert no change; run `mewkit validate --frontmatter`, `scripts/check-skill-cross-refs.sh` and
  `mewkit validate --packs` and assert exit 0
- **Rubric tie-in:** product-depth (weight 0.25)

### [AC-06] Six or more `j13…` routing specs exist, all three count literals move, and they land first

**Given** `tests/journey-validation/journey-specs.jsonl` holding exactly **12** specs
(`j01-typo-build-error … j12-ssrf-poisoned-url`) and **zero** naming Jira or Confluence; the freeze held in
the validator in **three** places — `check-journey-specs.py:44` (`if len(journeys) != 12`), `:45` (the
failure message) and **`:89`** (the `PASS — 12 journeys frozen` print; **the clarification's `:88` is off by
one**, and `:90`'s `j12` is a journey id in prose, not a count) — run by CI at `ci.yml:141`; `REQUIRED_IDS`
built at `:30` as a numeric `range(1, 13)` of `jNN` strings compared against id **prefixes**; the **12**
required fields at `:22-27` including `oracle_layers` constrained to `{deterministic, live}`; and **5** of
the 12 existing specs already carrying a `model:routing` oracle
**When** the new specs are added, all three `12` literals and the `REQUIRED_IDS` range are raised in the
same change, `python3 tests/journey-validation/check-journey-specs.py` is run, and the commit history for
the specs file and for the integration descriptions is read
**Then** **≥6** new specs name a Jira or Confluence routing case, each with an id in the **`j13…`** range so
the prefix comparison keeps working, and each carrying **all 12** required fields,
`oracle: "model:routing"`, `oracle_layers: ["live"]` and `status: "active"`; **all three** `12` literals
move together to the new figure and the `REQUIRED_IDS` range is extended, so CI cannot go green while still
**printing** the old count; the assertion stays an **equality** and is **not** loosened to `>=` or `<=`, so
the set stays frozen at a new number and a silently dropped spec still fails;
`check-journey-specs.py` exits **0** and reports the new count; the specs were committed **before** the
commit that rewrites any integration `description`, proven from `git log` ordering, so the phase's "all pass
before and after" has a real "before"; and each new spec's `expected_route` names one leaf skill id that
exists in the finished inventory, so no spec expects a route to a skill that is not shipped

- **Verification:** `wc -l tests/journey-validation/journey-specs.jsonl` and parse each line; assert ≥6 new
  Jira/Confluence specs with `j13…` ids, the 12 fields, `model:routing`, `["live"]` and `active`; grep
  `check-journey-specs.py` for the raised literal at `:44`, `:45` and `:89` and for the raised
  `REQUIRED_IDS` range, and assert no `>=` or `<=` replaced the equality; run
  `python3 tests/journey-validation/check-journey-specs.py` and assert exit 0 and that the printed count is
  the new figure; `git log --oneline --` the specs file and the rewritten integration files and assert the
  specs commit is the earlier one; resolve every new `expected_route` leaf id against
  `.claude/skills/*/SKILL.md`
- **Rubric tie-in:** functionality (weight 0.40)

### [AC-07] The live routing run is attempted before the rewrite and leaves exactly one named artifact

**Given** sprint 8 D11's requirement that the live run's grading branch be **named**, never left as an
unqualified "run live"; given that `claude` resolves on this host to `/Users/sangnguyen/.local/bin/claude`
at version **2.1.316**, so the attempt is expected; given that a non-interactive `claude -p` run from inside
an agent session can fail for reasons unrelated to routing (auth, nesting, rate limit), so availability of
the binary is not evidence of a run; and given that branch (a) needs **verbatim before-rewrite** output,
which a generator who rewrites first makes physically unobtainable — turning (b) into a self-fulfilling
deferral
**When** `tasks/reviews/evidence/<date>-meowkit-v3-lean-runtime-sprint-9/routing-live.md` is read, and
`git log` is read for the ordering of the live-run attempt against the first metadata-edit commit
**Then** **exactly one** of the following exists at that literal path, and the other does not: **(a)** a
recorded live run naming the exact command invoked, the model id used, the **verbatim** before-rewrite and
after-rewrite outputs for each of the ≥6 new specs, and a per-spec pass/fail in which the hub selects the
same leaf before and after the rewrite; or **(b)** an explicit deferral record naming a **recorded failed
attempt** — the command tried, the observed failure mode, the date — and the statement that the specs plus
the deterministic CI check stand without a live result. Two artifacts is a FAIL and zero artifacts is a
FAIL, because "we meant to" is the outcome this criterion exists to prevent; **the pre-rewrite attempt is
recorded before the first commit that edits any metadata for AC-04 or AC-05**, proven from `git log`
ordering, and the two are **distinct commits in that order** — one commit carrying both the evidence and a
metadata edit cannot prove the attempt preceded the rewrite and is a FAIL — so branch (a) was physically
reachable when the branch was chosen; **"no before-state available"
is NOT an accepted failure mode for (b)** — a deferral claimed without a recorded pre-rewrite attempt is a
FAIL, not a deferral; the chosen branch is **named in the sprint handoff** rather than inferable only from
which file happens to exist; and on branch (b) **no claim of routing correctness appears anywhere in the
sprint's output** — not in the handoff, not in the descriptions, not in a docs page — since the
deterministic check proves well-formedness and cannot select a route

- **Verification:** `ls tasks/reviews/evidence/<date>-meowkit-v3-lean-runtime-sprint-9/` and assert exactly
  one of the two artifacts at `routing-live.md`; on (a) read it and assert the command, the model id, two
  verbatim outputs per spec and a per-spec verdict are present, and that before and after select the same
  leaf; on (b) read it and assert a command tried, a failure mode and a date are present, and that the
  reason is not "no before-state"; `git log --format='%h %ad %s' --` the evidence file and the first
  metadata-edit commit and assert they are two different SHAs with the evidence commit the earlier one; grep the handoff for the named
  branch; on (b) grep the sprint's full diff and handoff for any routing-correctness claim and assert zero
- **Rubric tie-in:** product-depth (weight 0.25)

### [AC-08] The SubagentStart question has one cited answer at every assertion site — and nothing is registered

**Given** the **claude** provider record at `core/provider-lifecycle.ts:82-86` — `subagent_start` with
`status: "supported"`, `gate: false`, `evidence: "SubagentStart hook in shipped settings.json (observe)"` —
whose cited registration, `.claude/settings.json:162`, is an **empty array**, so the record's evidence is a
hook that injects nothing (round 1 named the **codex** record at `:116`; that is a different harness and is
secondary); given **six** in-tree sites asserting the blanket loop claim, all of which would survive a spike
scoped to one file: `skills/cook/references/orchestration-rules.md:99` and `:113`,
`docs/architecture/context-isolation.md:21` and `:112`, `docs/core/meowkit-architecture.md:246`, and
`docs/reference/sub-agents.md:523,531`, which **documents how to register the hook**; and given sprint 8's
single host observation of a third-party SubagentStart hook firing once into a sub-agent context
**When** the spike decision record is read, all six assertion sites are read, and the finished tree is
searched for a SubagentStart registration or handler
**Then** the record states **`adopt` or `reject`** — a binary verdict, not a summary of considerations —
with its reasoning and a **dated** citation to the **Anthropic Claude Code hooks reference** retrieved via
`mk:docs-finder` (Context7 → Context Hub → WebSearch); **if that reference does not enumerate
`SubagentStart`**, the record states that absence with the date and the chain attempted, and the verdict
then rests on **in-repo evidence** — the six sites, the empty array, codex's capability table 0.142 and the
one host observation — and **says so explicitly**, so **documentation absence is not a FAIL**; `adopt` and
`reject` are **both passing outcomes**, since a spike whose only passing answer is `reject` is not a spike;
**all six** assertion sites carry the verdict after the change, so the tree holds **one** answer and not
two — a spike that edits only `orchestration-rules.md` is a FAIL of this criterion; the record **states
explicitly** whether `provider-lifecycle.ts:82-86`'s claude record agrees with the verdict or is superseded,
and if superseded the record says what replaces its `evidence` string, since an empty array is not evidence
of support; sprint 8's host observation, if cited at all, is qualified as **existence evidence only, not
throttling evidence**; `.claude/settings.json`'s `"SubagentStart"` array is **still empty**, **no**
SubagentStart handler file exists anywhere in `.claude/hooks/`, and `scripts/check-hook-registration.sh` is
green — so an `adopt` verdict ships no injector; and **no** file under `.claude/rules/` was shortened on the
strength of the answer, asserted by AC-03's empty rules diff

- **Verification:** read the spike decision record and assert a binary verdict, reasoning, a dated citation
  or a dated absence-plus-in-repo-evidence statement, and an explicit statement about
  `provider-lifecycle.ts:82-86`; read all six sites before and after and assert each carries the verdict and
  none still states the unqualified blanket claim; grep `.claude/settings.json` for `"SubagentStart"` and
  assert the array is empty; `git grep -l SubagentStart -- .claude/hooks` and assert no handler; run
  `scripts/check-hook-registration.sh` and assert exit 0
- **Rubric tie-in:** product-depth (weight 0.25)

### [AC-09] The provider bundles no longer name a directory the kit stopped writing

**Given** **57** authored bundle files carrying **96** occurrences of `session-state` under
`packages/mewkit/src/migrate/modules/` — codex **34 files / 56 occurrences**, cursor **23 files / 40
occurrences**, **54** `.md` and **3** `.toml` (`advisor.toml`, `confluence-spec-analyst.toml`,
`developer.toml`) — all of it **prose**, in **authored** sources under `modules/{codex,cursor}/root/`
and not generated output; given that those bundles' **descriptions** are out of scope entirely, since they
are hand-authored, already short, and `validate/targets/codex-target.ts:10-12` states the validator "does
NOT read the source `.claude/`"; and given the **three deliberate `.claude` readers** that must survive
untouched: `hooks/lib/meowkit-paths.cjs:23,27` (`LEGACY_STATE_RELS`), `hooks/lib/gate2-check.cjs:70`
(remediation prose `meowkit-paths.cjs:23` explicitly keeps true for the legacy path) and
`hooks/__tests__/resolve-model.test.cjs:99`
**When** the bundles are searched on the finished tree, the three retained readers are diffed against
POST-8, and the migrate test suite and the projection validators are run
**Then** `git grep -c session-state` over `packages/mewkit/src/migrate/modules/` returns **0 files and 0
occurrences**, each of the 96 having been rewritten to the `.meowkit/state/` path the kit actually writes —
not deleted, so no bundle loses the instruction it was giving; the surrounding prose still names a state
path in each of the 57 files, so a rewrite that removed the sentence instead of correcting it is caught;
**no bundle `description` changed**, so this criterion cannot be used as a back door into the out-of-scope
description parity; `meowkit-paths.cjs`, `gate2-check.cjs` and `resolve-model.test.cjs` are
**byte-identical** to POST-8, so the legacy-read surface sprint 8 kept on purpose was not swept up;
`skills/agent-browser/references/session-management.md:11` is unchanged, since `#session-state-persistence`
is a markdown anchor and not a path; and the migrate test suite plus `mewkit validate --target codex` and
`mewkit validate --target cursor` are green — asserted as "the corrected bundles still project", never as
evidence that the metadata rewrite propagated

- **Verification:** `git grep -c session-state -- packages/mewkit/src/migrate/modules` and assert no output;
  `git grep -c '\.meowkit/state' -- packages/mewkit/src/migrate/modules` and assert ≥57 files; `git diff`
  POST-8 → finished over `packages/mewkit/src/migrate/modules` and assert no hunk touches a `description:`
  line; `git diff` POST-8 → finished for `.claude/hooks/lib/meowkit-paths.cjs`,
  `.claude/hooks/lib/gate2-check.cjs`, `.claude/hooks/__tests__/resolve-model.test.cjs` and
  `.claude/skills/agent-browser/references/session-management.md` and assert all four empty; run the migrate
  test suite and `mewkit validate --target codex|cursor` and assert exit 0
- **Rubric tie-in:** code-quality (weight 0.15)

### [AC-10] The bead template names the path build progress is actually written to

**Given** `.claude/skills/plan-creator/assets/bead-template.md:40` — "Progress tracked in
`session-state/build-progress.json`" — the one remaining in-kit prose line naming the project-root state
directory sprint 8 removed, in a template a planner copies into a plan file
**When** the finished template is read and the kit is searched for the old path in authored prose
**Then** that line names the `.meowkit/state/` path the kit writes, and the sentence still tells the reader
where build progress is tracked rather than dropping the statement; **no** authored markdown file under
`.claude/skills/` names a project-root `session-state/` path — the only in-kit `session-state` occurrences
left are the three deliberate readers AC-09 pins and the markdown anchor in
`agent-browser/references/session-management.md:11`; and `mewkit validate --docs-refs` and
`scripts/check-dangling-rule-refs.cjs` are green, so the corrected path resolves

- **Verification:** read `.claude/skills/plan-creator/assets/bead-template.md:40` and assert the
  `.meowkit/state/` path and a surviving sentence; `git grep -n session-state -- '.claude/**/*.md'` and
  assert the only hit is the `session-management.md` anchor; `git grep -n session-state -- .claude` and
  assert the remaining hits are exactly the three pinned readers plus that anchor; run
  `mewkit validate --docs-refs` and `node scripts/check-dangling-rule-refs.cjs` and assert exit 0
- **Rubric tie-in:** code-quality (weight 0.15)

### [AC-11] The one surface that mirrors the metadata is regenerated, and the repository is green

**Given** — **corrected in round 2, because round 1's Given was false on both surfaces it named** — that the
generated CLI manual is rendered from `packages/mewkit/dist/cli/command-catalogue.js` and carries **no**
skill-metadata term, so `generate-cli-manual.cjs --check` (`ci.yml:216`) is a **no-op** for this rewrite;
that the codex and cursor bundles are hand-authored verbatim copies whose descriptions are already
independently short (codex `mk-grill` **185 B** against `.claude` `mk:grill`'s **1 208 B**) and whose
validator "does NOT read the source `.claude/`" (`validate/targets/codex-target.ts:10-12`), so no projection
regeneration can observe the rewrite; and that the **only** committed surface carrying the metadata text
verbatim is `packages/docs/docs-reference-manifest.json` — **171** entries (**129** skills, **42** agents),
each with a `description` and a `sourceHash` — together with the `GENERATED:reference-index` block at
`packages/docs/content/docs/reference/skills/index.mdx:197-335`, drift-checked by
`scripts/docs-manifest.cjs --check` at **`ci.yml:305`**; and given that the manifest's **129** skills exceed
the ship set's **128** by exactly `skills/benchmark/SKILL.md`, which left the shipped kit in sprint 8 but
remains a tracked skill
**When** the metadata rewrite is complete, the manifest and the generated index block are regenerated, and
the full committed check set is run on the finished tree
**Then** `scripts/docs-manifest.cjs --check` exits **0**, and regenerating the manifest and the
`GENERATED:reference-index` block leaves `git status --porcelain` **empty**, so the one mirroring surface
carries the rewritten text and its `sourceHash` values match the rewritten sources; the manifest still
holds **171** entries including `mk:benchmark`'s, and that **one-entry difference from the budget's 170
blocks is recorded as correct, not reconciled** — removing the entry or re-shipping the skill to make the
numbers match is a FAIL; `generate-cli-manual.cjs --check` exits **0** as an unchanged no-op, asserted as
"still green" and **not** as evidence the rewrite propagated; no bundle-vs-`.claude` description parity is
asserted anywhere in the sprint's output; every other committed validator and test is green —
`mewkit validate --packs`, `--frontmatter`, `--gates`, `--docs-refs`, `--workflow`, `--target codex`,
`--target cursor`, `mewkit doctor` hard gates, `npm test`, the hook golden corpus,
`scripts/check-always-on-budget.cjs`, `check-rule-survival.cjs`, `check-skill-cross-refs.sh`,
`check-dangling-rule-refs.cjs`, `check-kit-verbs.cjs`, `check-no-python.cjs`,
`check-node-only-runtime.cjs`, `harness-inventory.cjs --check` and `check-journey-specs.py`; the security
scan reports **no** BLOCK; and **no** plan-artifact token — phase number, sprint number, criterion
identifier, decision number, round or amendment — appears in any code comment, test name, file name or
script name added or changed by this sprint, asserted by grepping the diff rather than by inspection

- **Verification:** regenerate the docs manifest and the index block, then
  `node scripts/docs-manifest.cjs --check` and `git status --porcelain` and assert exit 0 and empty output;
  parse the manifest and assert 171 entries, 129 skills, 42 agents, and that `mk:benchmark` is present while
  absent from the ship set; run `node scripts/generate-cli-manual.cjs --check` and assert exit 0; run each
  other named validator and test and assert exit 0; run the security scan and assert no BLOCK; `git diff`
  POST-8 → finished and grep the added lines for `phase-0`, `sprint-?[0-9]`, `AC-[0-9]`, `Round [0-9]` and
  `Amendment` outside `tasks/` and assert zero matches
- **Rubric tie-in:** functionality (weight 0.40)

## Out-of-Scope Clarifications

Things the generator MUST NOT add even if tempted:

- **A second budget script or a second extractor.** Two disjoint comparisons in one check is fine and is now
  required; two scripts answering the same question is not. A pattern fixed in one and forgotten in the
  other looks complete read on its own (D1, D3)
- **Reducing the 25 600 rules comparison to a printed figure.** It is CI's only always-on-rules ceiling and
  it must still exit non-zero on breach after this sprint (D1, D2, AC-02)
- **Deleting `when_to_use`.** It is **24 808 B** of the measured set and the single largest one-edit
  "saving" available. Removing it passes the gate by deleting what the gate measures, and makes routing
  strictly worse (D4, AC-01)
- **An exclusion clause naming a skill id that does not exist.** "NOT for mk:nonexistent" satisfies a regex
  and nothing else; with AC-07's deferral branch also available it would let the sprint cut half the routing
  metadata with no routing evidence at all (AC-04)
- **Rewriting metadata before the pre-rewrite live-run attempt.** It makes branch (a) physically
  unobtainable and turns the deferral into a self-fulfilling one (D8, AC-07)
- **Collapsing distinct skills onto one boilerplate `description`.** It is the cheapest way to hit an average
  and it destroys the routing decision the description exists to make (D4, AC-04)
- **Flipping `default_enabled`, moving an integration to a pack, or deleting one** to "save" the 18 741 B.
  `plan.md` Decision 6 is user-confirmed and the metadata ships either way (D5)
- **Raising only `check-journey-specs.py:44`.** The run goes green while `:89` still prints the old frozen
  count, and loosening the equality to `>=` ends the freeze while looking like it raised it (D6, AC-06)
- **Scoping the SubagentStart verdict to `orchestration-rules.md`.** Five other sites repeat the claim and
  one of them documents how to register the hook, so the tree would still hold two answers (D10, AC-08)
- **Registering a SubagentStart handler, or populating the empty array,** even if the spike returns `adopt`.
  A hook written in the same sprint as its own feasibility study has no independent check (D9, D10)
- **Rewriting the codex/cursor bundle descriptions, or asserting parity with `.claude`.** They are
  hand-authored, already short, and read by nothing in `.claude/` (Scope Out, AC-09, AC-11)
- **Touching `LEGACY_STATE_RELS`, `gate2-check.cjs:70` or `resolve-model.test.cjs:99`** while cleaning up
  `session-state` prose. They are the legacy-read surface, kept on purpose (D11, AC-09)
- **Fixing the Gate 2 git fail-open.** It is a safety-hook change with its own blast radius and belongs to
  its own follow-up, not behind a budget rewrite's schedule (D12)
- **Re-litigating sprint 8's shape work** — the six top-level entries, three archive roots, command
  dispositions, move registry and Node-only-executable property are settled

## Rubric Bindings

Active preset `cli-tool`: functionality 0.40, product-depth 0.25, ux-usability 0.20, code-quality 0.15.
Every rubric in the preset has at least one AC binding.

- functionality (0.40): covered by AC-01, AC-03, AC-06, AC-11
- product-depth (0.25): covered by AC-05, AC-07, AC-08
- ux-usability (0.20): covered by AC-02, AC-04
- code-quality (0.15): covered by AC-09, AC-10

## Negotiation Log

- Round 1 (proposer/generator): initial draft of the three requirements sprint 8 deferred —
  `phase-07-kit-shape.md` Requirement 7 (metadata budget), Requirement 6 plus its routing-case Success
  Criterion (integration descriptions) and Requirement 8 (SubagentStart spike) — carried forward from sprint
  8's `D7`, `D10`, `D11`, `D13` and `D15`, bounded by `plan.md` Decisions 1–7 and Constraints, and bound to
  the `cli-tool` preset (functionality 0.40, product-depth 0.25, ux-usability 0.20, code-quality 0.15 —
  `.claude/skills/rubric/rubrics/composition-presets/cli-tool.md`; note the preset moved out of
  `.claude/rubrics/` in sprint 8, so sprint 8's own citation of that path is already stale). Eleven ACs,
  four under the ceiling. Twelve Decisions recorded rather than left open per the user's standing directive;
  five marked `[CHALLENGE]`. **Every figure was re-measured on the POST-8 tree with Node 24, and nine of
  sprint 8's numbers have already moved:**
  (a) the ship set is **1155** files over **three** roots with **6** `.claude/` top-level entries, not
  1228 / four / 17 — sprint 8's shape work landed, so every "shipped kit" subject here is the new one;
  (b) **always-listed is 113 798 B, not 111 592 B — the cut GREW by 2 206 B** after the sprint that was
  split off to settle the denominator, because D3's promotion cap was exercised (125 → 128 skills,
  **+2 276 B**) while rules fell 84 B. This is the single most important correction in the draft: a contract
  that inherited 111 592 would gate against a number that was never true (D1, AC-01);
  (c) rules are **25 417 B** with **183 B** of headroom, not 25 501 / 99 — so D2's pin is restated at the
  measured figure rather than sprint 8's;
  (d) skills are **128 → 74 056 B** (avg **579**), agents **42 → 14 325 B** (avg **341**), so metadata is
  **88 381 B** and the ceiling is **≤44 583 B** — a **49.6 %** metadata cut across **170** blocks, worse
  than sprint 8's projected 44 499 / 124 / 308-per-skill arithmetic;
  (e) the phase's per-item caps re-derived at POST-8 counts sum to **66 437 B**, **3 563 B** under the gate —
  still achievable, with less slack than sprint 8 computed (D1);
  (f) integrations measure **18 741 B** over 46 blocks and the 150-byte figure saves **11 841 B**, **27.0 %**
  of the cut — and **both hubs are already `default_enabled: false`**, which sprint 8 did not record and
  which is exactly the shortcut D5 forecloses;
  (g) the **ten largest** skill blocks total only **10 205 B**, **23 %** of the cut, so AC-04 states that the
  rewrite reaches already-short blocks and must not get there by boilerplate;
  (h) `claude` **is** present on this host (`2.1.316`), so D8 expects the attempt — but writes AC-07 as a
  binary one-of-two anyway, because a binary on `PATH` is not a run and sprint 8 D11 forbade an unqualified
  "run live" line;
  (i) the tree holds **two incompatible SubagentStart answers** — `orchestration-rules.md:99,113` asserts
  the infinite loop while `core/provider-lifecycle.ts` records `subagent_start` as
  `supported, gate: false`. The phase framed Requirement 8 as an open question; measured, it is a
  contradiction, so D10 makes the deliverable "resolve it with a citation and say which record is
  superseded" and makes **`adopt` a passing outcome that still ships nothing**, because a spike whose only
  passing answer is `reject` is not a spike.
  Also decided: the extractor is implemented once and reads the ship set rather than a glob, so the budget
  and the published artifact cannot disagree (D3); the cut comes only from rewriting, never from deleting a
  field or unshipping a block, with AC-01 asserting field presence and block counts so the cheapest cheat is
  a FAIL (D4); the routing specs land **before** the rewrite with the validator's frozen count and id range
  raised in the same change and the equality **not** loosened (D6, D7); the spike registers nothing and
  sprint 8's single host observation stays qualified as existence evidence (D9); and the two Gate 2
  leftovers are scoped to **exactly** the 57 provider-bundle files / 96 occurrences and the one
  `bead-template.md:40` line, with the three deliberate legacy readers and one markdown anchor pinned
  byte-identical so a bulk rewrite cannot sweep them up (D11).
  Three things round 1 does **not** do, and says so. **First, the baseline is not a commit.** POST-8 is
  `d17cc03b` plus sprint 8's **uncommitted** working tree, which is awaiting human Gate 2 approval.
  Measuring against the pre-sprint-8 commit would reproduce the moving-denominator defect sprint 8's split
  existed to remove, so the working tree is the honest subject — but if Gate 2 changes it, **every figure
  here is re-measured and this contract is amended before signing**. **Second, it does not pre-assign where
  the remaining 31 957 B comes from** after AC-05's integration share: naming the per-skill cuts needs each
  description read against its skill's actual job, which is implementation judgment. It is bounded instead by
  one enforced total, a field-presence floor, a no-duplicate-text clause, a no-boilerplate clause and a
  reported descending item list. **Third, it does not include the Gate 2 git fail-open** raised in sprint 8's
  review (D12) — a safety-hook behaviour change with its own blast radius, which should not wait behind a
  metadata rewrite.
- Round 1 (reviewer/evaluator): **every figure in the draft was independently re-measured on the POST-8
  tree with Node 24 and all of them reproduce exactly** — ship set **1155** files; rules **7 files /
  25 417 B**; **128** shipped skills **74 056 B** (`name` 1 806 + `description` 47 442 + `when_to_use`
  24 808, avg **579**, zero missing `when_to_use`); **42** shipped agents **14 325 B** (avg **341**, the two
  index files correctly excluded by the parse); always-listed **113 798 B**; metadata **88 381 B**; ceiling
  **≤44 583 B**; integrations **24 skills 12 167 B + 22 agents 6 574 B = 18 741 B**; ten largest skills
  **10 205 B**; per-item caps **66 437 B** (**3 563 B** under the gate); **57 files / 96 occurrences** of
  `session-state` under `migrate/modules/`; `claude` **2.1.316** on PATH; `check-journey-specs.py:30,44` and
  `.claude/settings.json:162` as cited. Achievability is accepted as a disclosed risk, not a blocker: the
  124 non-integration blocks get ~**291 B** each for `description` plus `when_to_use` against **579 B**
  today, and the 46 integration blocks have **135.7 B** each after their **656 B** of `name` values — tight
  but arithmetically real. Six clarifications, all of them about a criterion that cannot be graded as written
  rather than about scope:
  AC-02/AC-03 the extended check must say whether the rules-only comparison against **25 600** stays an
  **enforcing** exit-1 condition. As written AC-02 enforces "exactly one number" and D2 only *reports* the
  rules subtotal, so the 25 600 literal becomes decorative and CI loses the only always-on-rules ceiling it
  has today: rules could grow to 40 000 B and pass while metadata absorbs the loss, which is precisely the
  trade D2 says it forbids, with AC-03's ≤25 417 B binding this sprint's evaluator and nothing after it.
  Either state that the check keeps **two** enforced comparisons over two disjoint sets (not two answers to
  one question — two questions), or record that the rules ceiling is being removed and by whose decision.
  AC-11 the Given is false on both surfaces it names, and the surface that does mirror is unnamed. The CLI
  manual is rendered from `packages/mewkit/dist/cli/command-catalogue.js` and carries no skill-metadata term,
  so `generate-cli-manual.cjs --check` (`ci.yml:216`) is a no-op for this rewrite; the codex and cursor
  bundles are hand-authored verbatim copies (`codex-authored-bundle.ts` "no runtime transform",
  `modules/codex/manifest.json` `generatedFrom: "hand-authored + porter"`, every entry `active`) whose
  descriptions are already independently short (codex `mk-grill` **185 B** vs `.claude` `mk:grill`
  **1 208 B**), and `validate/targets/codex-target.ts:10-12` states it "does NOT read the source `.claude/`"
  — so no projection regeneration and no target validator can observe the rewrite. The surface that **does**
  carry the verbatim text is `packages/docs/docs-reference-manifest.json` (per-skill `description` plus
  `sourceHash`) together with the `GENERATED:reference-index` block at
  `packages/docs/content/docs/reference/skills/index.mdx:197-335`, drift-checked by
  `scripts/docs-manifest.cjs --check` at `ci.yml:305` — a 170-block rewrite fails that check, and AC-11
  neither lists it in the check set nor regenerates it before `git status --porcelain`. Name it, and replace
  the parity claim with the honest one: the codex/cursor bundles are authored and deliberately divergent, so
  either no parity is asserted or rewriting them is its own criterion.
  AC-07 name the evidence path as a literal (`tasks/reports/…` or similar) — "the sprint evidence directory"
  has no subject to list, so "exactly one of two artifacts exists" is not probeable — and impose the ordering
  branch (a) needs. Branch (a) requires **verbatim before-rewrite** output, obtainable only if the live run
  is attempted before AC-05's rewrite commit; D6 imposes that ordering on the specs but nothing imposes it on
  the run, so a generator that rewrites first makes (a) physically impossible and (b) the only reachable
  branch — a self-fulfilling deferral. Require the pre-rewrite attempt and state that "no before-state
  available" is **not** an accepted failure mode for (b).
  AC-04/AC-05 resolve the collision and make AC-04 probe routing rather than shape. AC-04 requires **every**
  shipped skill `description` to carry an exclusion clause while AC-05 requires each of the 21 leaves to name
  "no routing rule" inside 135.7 B — say explicitly that a "NOT for" clause is not the routing rule AC-05
  forbids (or exempt the leaves from AC-04). And add the one assertion that makes AC-04 more than a regex:
  where an exclusion clause names a skill id, that id must resolve in the finished inventory, exactly as
  AC-06 resolves `expected_route`. Today "NOT for mk:nonexistent" passes AC-04, and with AC-07's deferral
  branch also passing, the sprint can cut **49.6 %** of the routing metadata with no routing evidence at all.
  AC-08 three gaps. (i) The same-harness contradiction is `core/provider-lifecycle.ts:82-86` — the **claude**
  record, `subagent_start` `status: "supported"` on the evidence of the shipped `settings.json` registration,
  which is an **empty array** — not the codex record at `:116`; the contract's own `:85` citation sits inside
  that claude block, so the AC names the wrong record as the one to reconcile. (ii) Three further in-tree
  assertions repeat the blanket loop claim and would survive a spike scoped to `orchestration-rules.md`,
  leaving the tree still holding two answers: `docs/architecture/context-isolation.md:21,112` and
  `docs/core/meowkit-architecture.md:246` — plus `docs/reference/sub-agents.md:523,531`, which documents how
  to register the hook. Name them in the Then, or narrow the claim from "the tree stops holding two answers"
  to the one file. (iii) Name what counts as "current official documentation" per harness and a dated
  fallback if the official hooks reference does not enumerate `SubagentStart` — the only citations in-repo
  today are codex's capability table 0.142 and one host observation — otherwise the spike FAILs on
  documentation absence rather than on its answer, contradicting D10's "`adopt` and `reject` are both
  passing outcomes".
  AC-06 two literals the AC implies but does not name: `12` occurs three times in the validator (`:44`
  assertion, `:45` failure message, `:88` `PASS — 12 journeys frozen` print) and `REQUIRED_IDS` is built as
  a numeric `jNN` range matched by id **prefix**, so require the new specs to use `j13…` ids and all three
  literals to move together — otherwise CI goes green while still printing the old count.
- Round 2 (proposer/generator): **all six clarifications addressed in place; nothing deleted; three line
  citations corrected and one new finding recorded.** The orchestrator's decisions were applied as given.
  **Baseline:** sprint 8 is now committed as **`f387e586`**, so POST-8 is that commit, every figure was
  re-measured against it and reproduces, and round 1's uncommitted-tree risk is **withdrawn** rather than
  carried.
  **(1) AC-02/AC-03 — rules ceiling kept live.** The evaluator is right that round 1's "exactly one enforced
  number" would have made the 25 600 literal decorative and left CI with no always-on-rules ceiling after
  this sprint. Per the orchestrator: the extended check now enforces **both** comparisons over **two
  disjoint sets** — rules-only against the live **25 600** and always-listed against **70 000** — stated in
  D1, D2, the Definitions, Scope In/Out, AC-02 and AC-03. These are two questions, not two answers to one;
  what stays forbidden is a second script, a second extractor and per-item caps as gates. **No ceiling is
  removed.** AC-02 gains the probe that makes the distinction testable: a scratch copy with rules **over
  25 600** while the total is **under 70 000** must exit non-zero, and a check that passes it FAILs AC-02.
  **(2) AC-11 — subject replaced with the surface that actually mirrors.** Verified every claim: the CLI
  manual is rendered from `command-catalogue.js` and `generate-cli-manual.cjs --check` sits at
  **`ci.yml:216`**; `scripts/docs-manifest.cjs --check` sits at **`ci.yml:305`**;
  `docs-reference-manifest.json` has **171** entries each carrying `description` **and** `sourceHash`; the
  `GENERATED:reference-index` block is `index.mdx:197-335`. AC-11's Given now names the manifest and the
  block as the mirror, requires regeneration to an empty `git status --porcelain`, keeps
  `generate-cli-manual.cjs --check` only as "still green, a no-op", drops the codex/cursor parity claim
  entirely, and adds `harness-inventory.cjs --check` to the check set.
  **New finding, not in the clarification, found while verifying it:** the manifest holds **129** skill
  entries against the ship set's **128**, the difference being exactly **`skills/benchmark/SKILL.md`**,
  which left the shipped kit by `base.exclude` in sprint 8 but is still a tracked skill. So the budget's
  denominator (**170** blocks) and the mirror's (**171** entries) legitimately differ by one. AC-11 records
  it as correct and **forbids reconciling it** by removing the entry or re-shipping the skill; AC-01 asserts
  `benchmark` is absent from the ship set so its exclusion is not counted as a saving. Without this, an
  evaluator comparing 170 against 171 would read a drift failure.
  **(3) Codex/cursor descriptions — out of scope, stated.** Scope (Out) now names them explicitly with the
  evidence (hand-authored verbatim copies; codex `mk-grill` **185 B** against `mk:grill`'s **1 208 B**;
  `codex-target.ts:10-12` "does NOT read the source `.claude/`"), and AC-09 gains a clause asserting **no
  bundle `description` changed**, so the session-state prose fix cannot become a back door into the
  out-of-scope rewrite.
  **(4) AC-07 — literal path and enforced ordering.** The artifact path is now
  `tasks/reviews/evidence/<date>-meowkit-v3-lean-runtime-sprint-9/routing-live.md`, matching the convention
  sprints 4–8 already use (`tasks/reviews/evidence/<date>-<slug>-sprint-N/`) rather than `tasks/reports/`.
  The pre-rewrite attempt must be **recorded before the first commit that edits metadata for AC-04 or
  AC-05**, proven from `git log` ordering, and **"no before-state available" is explicitly not an accepted
  failure mode** — branch (b) requires a **recorded failed attempt**, and a deferral claimed without one is
  a FAIL. D8 carries the same three additions.
  **(5) AC-04/AC-05 — collision resolved, and AC-04 now probes routing.** Per the orchestrator: a
  `NOT for <id>` clause **is** permitted and **is not** the hub routing rule AC-05 forbids (what is forbidden
  is a leaf restating hub selection logic); an integration leaf **may omit** the clause when **135.7 B**
  cannot fit it, and the handoff must **name which leaves omitted it and why**, cross-checked by AC-05's
  verification. AC-04's exclusion requirement is now scoped to **non-integration** skills, and it gains the
  assertion that makes it more than a regex: **every skill id named in any exclusion clause must resolve in
  the finished inventory**, with `NOT for mk:nonexistent` an explicit FAIL. The per-block arithmetic net of
  `name` values — **135.7 B** (656 B of names over 46 blocks) and **290.8 B** (1 623 B over 124) — is
  measured and now carried in the baseline, D4, AC-01, AC-04 and AC-05 rather than left implicit.
  **(6) AC-08 — right record, all sites, and a documentation fallback.** The evaluator is correct that the
  record to reconcile is the **claude** block at `core/provider-lifecycle.ts:82-86`, whose `evidence` string
  cites a registration that is an **empty array**; round 1 named the codex record at `:116`, which is a
  different harness. Verified all four cited sites plus the two already named, so the Then now requires the
  verdict at **all six**: `orchestration-rules.md:99,113`, `context-isolation.md:21,112`,
  `meowkit-architecture.md:246` and `sub-agents.md:523,531` — a spike that edits only `orchestration-rules.md`
  now FAILs. "Current official documentation" is defined as the **Anthropic Claude Code hooks reference**
  via `mk:docs-finder` (Context7 → Context Hub → WebSearch) with a retrieval date, and the **dated fallback**
  is explicit: if it does not enumerate `SubagentStart`, the record states that absence with the date and the
  chain, and the verdict rests on **in-repo evidence** and says so — **documentation absence is not a FAIL**,
  which is what D10's "both outcomes pass" requires. AC-08 also now asks what replaces the claude record's
  `evidence` string if it is superseded, since an empty array is not evidence of support.
  **(7) AC-06 — `j13…` ids, three literals, and a line correction.** New ids are **`j13…`**, continuing the
  numeric `range(1, 13)` at `:30` that `REQUIRED_IDS` is built from and compared by prefix; all three `12`
  literals move together; the equality is not loosened. **Correction to the clarification and to the
  orchestrator's restatement of it: the success print is at `:89`, not `:88`** — `:90` also contains `j12`
  but as a journey **id** in a prose list, not as a count, and `:5`/`:7` carry `12` in the module docstring,
  named in the baseline so the generator decides about them consciously. The three enforcing-or-reported
  literals are **`:44`, `:45`, `:89`**.
  Round 2 adds **no** new AC and removes none — still **11**, and every rubric still bound. Two things round
  2 still does **not** do: it does not pre-assign the per-skill cuts for the remaining **31 957 B** (same
  reasoning as round 1 — it is implementation judgment, bounded here by two enforced comparisons, a
  field-presence floor, a resolvable-id assertion, a no-duplicate-text clause and a descending item report),
  and it does not include the Gate 2 git fail-open (D12).
- Round 2 (reviewer): **accepted.** All six clarifications are addressed, and every round-2 figure was
  re-measured independently against `f387e586` and reproduces: non-integration `name` floors **1 435 B**
  (104 skills) and **188 B** (20 agents) = **1 623 B**, giving **290.8 B** per block against measured
  averages **595.1 B** and **387.6 B**; integration `name` floors **371 B** + **285 B** = **656 B**, leaving
  **6 244 B** and **135.7 B** per block; the docs manifest holds **171** entries (**129** skills, **42**
  agents) and the one extra is `mk:benchmark`, excluded from the ship set by `.meowkit/pack-manifest.json`
  `base.exclude` (`".claude/skills/benchmark/*"`) while still tracked — recorded-not-reconciled is the right
  call; `ci.yml:141/188/216/305` all resolve as cited; `check-journey-specs.py` carries `12` at **`:44`,
  `:45`, `:89`** with `j12` at `:90` as an id — **the generator is right and my `:88` was off by one.**
  Three things I checked for a round-2 regression and found clean: (i) AC-02's rules-over-25 600-with-
  total-under-70 000 scratch probe is the right falsification test — it is what makes "enforcing, not
  decorative" gradeable from behaviour instead of from source reading, and it closes the ceiling-removal
  finding completely; (ii) AC-09's new "no hunk touches a `description:` line" is satisfiable, not a
  contradiction with the 0-occurrence rule — **zero** of the 96 `session-state` occurrences sit on a
  `description:`, `name:` or `when_to_use:` line, so the two clauses cannot collide; (iii) **14** of the 96
  are `.codex/session-state/…` rather than bare `session-state/`, and rewriting them to `.meowkit/state/` is
  correct, not over-reach: `hooks/lib/meowkit-paths.cjs:26`'s `LEGACY_STATE_RELS` is `['session-state',
  '.claude/session-state']`, so `.codex/session-state` resolves for **no** reader and **no** writer and that
  prose was already naming a dead path before this sprint.
  Two **wording** tightenings applied inline, neither changing scope: **AC-07** now requires the live-run
  evidence commit and the first metadata-edit commit to be **two distinct SHAs in that order** (one commit
  carrying both cannot prove the attempt preceded the rewrite — this was already implied by "the earlier
  one", and is now gradeable); and **AC-04/AC-05**'s exclusion-clause exemption and omission table now cover
  all **24** integration skills — the 21 leaves, both hubs and `mk:story-sizer` — because AC-04 required the
  clause only of *non-integration* skills while the exemption named only *leaves*, leaving the two hubs and
  `mk:story-sizer` in a gap where a block was neither required to carry a clause nor recorded as omitting
  one.
  One residual risk recorded, not blocking, because it is bounded and disclosed: the exclusion-clause
  exemption is the only judgment-graded pass condition left in AC-04, so the evaluator must read the
  omission table against the measured 135.7 B rather than accept "it did not fit" — a 21-of-24 omission
  table is a FAIL of the criterion's intent even if every entry carries a reason. The achievability of a
  49.6 % cut across 170 blocks stays a disclosed delivery risk, not a contract defect.
- Signed by generator: pending
- Signed by evaluator: pending

## Amendments (if any)

None yet — round 2 is a pre-signature negotiation round, not an amendment. Format: append a new subsection
per amendment; both sides re-sign.
