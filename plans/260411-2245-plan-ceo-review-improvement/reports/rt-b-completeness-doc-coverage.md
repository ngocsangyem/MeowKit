# Red-Team B: Completeness & Documentation Coverage
**Reviewer:** RT-B (hostile completeness auditor)
**Date:** 2026-04-11
**Plan:** `plans/260411-2245-plan-ceo-review-improvement/plan.md`

---

## Check 1: Plan Completeness — Content Spec for New Reference Files

### pre-screen.md (new file)

**FAIL — placeholder patterns under-specified**

Evidence: Plan specifies these reject patterns:
```
TBD, TODO, "implement later", "similar to [X]", "add appropriate",
"handle edge cases" (without specifics), "if time permits", "pending approval"
```

Problems:
1. `TODO` is a hard-reject pattern, but `.claude/skills/meow:plan-creator/step-08-hydrate-tasks.md` exists — plan-creator legitimately outputs `TODO` task items in plan files. Pre-screen would false-positive on valid plan-creator output. No disambiguation logic specified.
2. `"handle edge cases"` has a parenthetical qualifier "without specifics" — but what counts as "specific"? A developer implementing this has no decision rule. No example of PASS vs FAIL for this pattern.
3. Coverage Mapping spec says "parse requirements from problem statement" and "parse tasks from plan phases" — but defines NO parsing logic, no format contract, no fallback if problem statement is prose rather than structured bullets. This is a ~50-line algorithm described in 2 sentences.
4. No false-positive escape hatch for behavioral enforcement (SKILL.md instruction path). If CEO calls pre-screen and it fires on a legitimate plan, what's the exact message? Not specified.
5. Structural completeness checklist has 6 items, but plan-creator template (step-03-draft-plan.md is the relevant step file) likely has different section headers. No cross-reference to verify alignment.

**Suggested fix:** Add PASS/FAIL anchor examples per pattern; define "without specifics" with a 2-sentence test; explicitly cross-reference plan-creator's template headers; specify the human-readable rejection message format.

---

### two-lens-evaluation.md (new file)

**FAIL — lens criteria ambiguous, implementation path unclear**

Evidence: Plan defines:
- Lens A (Intent Alignment): 4 bullets
- Lens B (Execution Credibility): 4 bullets

Problems:
1. "Would a user recognize this as solving their need?" — who is "a user"? The developer writing the plan? The end-user of the product? This is unmeasurable without a persona definition.
2. "Is task decomposition granular enough (no 5+ file tasks)?" — the `5+ files` rule is stated here but not in any existing reference file. Where is this threshold documented as canonical? If a developer reads two-lens-evaluation.md in isolation, this rule appears out of thin air.
3. "Are technical choices justified (not assumed)?" — PASS vs FAIL example not provided. When does "because we always use Postgres" count as justified vs assumed?
4. Each lens produces PASS/WARN/FAIL — but the plan says "Both must pass for overall approval." WARN is not defined: does WARN count as pass-through or as conditional? A WARN on Lens A + PASS on Lens B = overall what?
5. Plan says "Replace current Section 1: Architecture Review preamble with two-lens evaluation." This is a structural surgery on review-sections.md. The exact preamble text being replaced is not quoted. A developer cannot implement this without reading review-sections.md and making judgment calls about what the "preamble" is.
6. No word count / depth guidance. Is a PASS/FAIL verdict one sentence or a full paragraph? Token budget matters for SKILL.md behavioral instructions.

**Suggested fix:** Define WARN semantics explicitly; provide 1 PASS + 1 FAIL anchor per lens; quote the exact text being replaced in review-sections.md; add persona for "user recognition" criterion.

---

## Check 2: Modified File Specs — Are Exact Changes Specified?

### review-sections.md changes

**CONCERN — partially specified**

Plan says: "Add severity tiers, adversarial necessity." The severity tier format is defined inline in the plan (BLOCKER/HIGH-LEVERAGE/POLISH). But:
- Where exactly in review-sections.md does the severity tier definition appear? Before Section 1? After the CRITICAL RULE block? As a new top-level section?
- The adversarial necessity rule ("MUST surface ≥1 finding") — does it replace the existing "escape hatch" sentence in each section ("If a section has no issues, say so and move on") or supplement it? These are contradictory. The existing escape hatch explicitly permits zero findings; adversarial necessity forbids it. The plan doesn't resolve this contradiction.
- Evidence of contradiction: review-sections.md line 263: "If a section has no issues, say so and move on." Plan Phase 3: "Each section MUST surface ≥1 finding." One of these must change. Plan does not specify which text to remove.

**Suggested fix:** Specify the insertion point for severity tier definitions; resolve the escape-hatch vs adversarial-necessity contradiction explicitly (one must be modified or removed).

---

### required-outputs.md changes

**CONCERN — append-only format partially specified**

The plan provides a sample append block:
```markdown
## CEO Review (2026-04-11, HOLD SCOPE)
**Verdict:** APPROVED with 2 high-leverage items
...
```

But:
- Where in required-outputs.md does this go? The file has a `## Completion Summary` section already — is the CEO Review block in addition to it, or replacing it?
- The plan says "never overwrite" — but required-outputs.md currently has no instructions about writing to plan.md at all. The `post-review.md` reference handles review log writes via `meowkit-review-log`. Is the new `## CEO Review` section appended by SKILL.md behavioral instruction or by a script? Not specified.
- The "merge redundant deliverables" instruction (Error Map + Failure Registry → Failure Analysis table) — required-outputs.md currently has both as separate top-level sections. Which section headers are deleted? What is the new merged section header? Not specified.

---

### plan-creator step-08-hydrate-tasks.md changes

**FAIL — file identified incorrectly**

Plan says: "Update `meow:plan-creator/step-08-*.md` (final step)." Confirmed: `step-08-hydrate-tasks.md` exists. But the plan provides only this behavior spec:
```
If complexity == COMPLEX:
  "Plan created. Recommend running /meow:plan-ceo-review for strategic review."
If complexity == STANDARD:
  "Plan created. Optional: /meow:plan-ceo-review for strategic review."
```

Problems:
1. Where in step-08 does this appear? Beginning? End? After Gate 1 message?
2. `complexity` is a variable — where is it defined in plan-creator's workflow? Is it the same TRIVIAL/STANDARD/COMPLEX from model-selection-rules.md or a plan-creator-specific concept? No cross-reference.
3. The exact message format (quoted text above) conflicts with plan-creator's existing Gate 1 message format. Will these two messages appear sequentially or is one replacing the other?

---

### harness step-01-plan.md changes

**CONCERN — spec provided, but density terminology mismatch**

Plan specifies:
```
If density == FULL: Auto-run /meow:plan-ceo-review --mode SELECTIVE
If density == LEAN: Skip
```

But SKILL.md frontmatter for plan-ceo-review has no `--mode` flag in documented usage. The website skill page shows `--scope-expand`, `--hold-scope`, `--reduce-scope` — not `--mode SELECTIVE`. Either the plan is proposing a new flag (not documented) or using wrong flag syntax. Implementer will guess.

---

## Check 3: Documentation Coverage

### SKILLS_INDEX.md

**CONCERN**

Current entry: `meow:plan-ceo-review | planner | planning | monolithic`

The plan adds: pre-screen step, two-lens eval, severity tiers, adversarial forcing. The architecture remains monolithic. But the description column has verbose notes for skills like `meow:plan-creator` (90+ words) while `meow:plan-ceo-review` has none. If the skill gains significant new behaviors, SKILLS_INDEX.md description column should note them (like plan-creator notes `--product-level`, `--deep`, `--tdd`, etc.). Plan does not mention updating SKILLS_INDEX.md.

**Verdict:** Not mentioned in plan. Low severity — monolithic architecture doesn't change — but description field is stale post-improvement.

---

### Website skill page (`website/reference/skills/plan-ceo-review.md`)

**FAIL — plan does not mention this file**

File confirmed to exist. Current content:
- Lists 4 modes (Expand/Selective Expand/Hold/Reduce) — correct
- Lists Core Capabilities: premise challenging, 10-star product thinking, review dashboard
- Does NOT mention: pre-screen, two-lens evaluation, severity tiers, adversarial necessity, append-only output

Post-improvement, the skill has 5 materially new behaviors. The website page will be stale. Plan's "Files to Modify" table does not include this file. **Not mentioned anywhere in the plan.**

---

### website/changelog.md + website/guide/whats-new.md

**FAIL — plan does not mention either file**

MeowKit pattern: every release gets a `whats-new/vX.Y.Z.md` entry and a `changelog.md` entry. Confirmed by reviewing `whats-new.md` which lists entries through v2.3.4. The CEO review improvement is a material skill upgrade. Plan's "Files to Modify" table does not include changelog or whats-new. **Not mentioned anywhere in the plan.**

---

### CLAUDE.md (meowkit root)

**PASS — no CEO review references requiring update**

Reviewed CLAUDE.md. References to CEO review: Phase Composition Contracts table mentions `meow:plan-ceo-review` in Phase 1 (planner). The table describes it as "Gate 1" — which is unchanged. No update needed.

---

### HOOKS_INDEX.md

**PASS**

Plan explicitly states "no hook changes needed." HOOKS_INDEX.md confirmed — no CEO review hooks exist or are proposed. No update needed.

---

### AGENTS_INDEX.md

**PASS**

CEO review is skill-driven, not agent-driven. Planner agent entry unchanged. No update needed.

---

### meowkit-rules.md Section 3

**PASS**

Section 3 covers hook registration convention. No hooks added. No update needed.

---

## Check 4: Cross-Reference Updates to Existing Reference Files

### shared-protocols.md

**CONCERN**

`shared-protocols.md` is loaded by 5+ skills (referenced in SKILL.md as a dependency). It contains `## Completion Status Protocol`. The pre-screen gate introduces a new termination state: "plan rejected at pre-screen — returned to planner." This is not DONE, DONE_WITH_CONCERNS, BLOCKED, or NEEDS_CONTEXT. The plan does not address whether a pre-screen rejection maps to BLOCKED or a new status. shared-protocols.md is not mentioned in the plan's modification list.

---

### post-review.md

**CONCERN — Phase 4c creates an undocumented behavior**

Plan Phase 4c: "all modes write the `## CEO Review` section to plan.md." Currently, `post-review.md` handles all post-review writes (review log, dashboard, plan file review report). Adding a new `## CEO Review` section write to plan.md is a new post-review behavior. Where does this instruction live? SKILL.md? required-outputs.md? post-review.md? The plan does not specify. Risk: implementer adds it to SKILL.md, but post-review.md already handles plan file writes — duplication or conflict.

---

### office-hours handoff (prerequisite-skill-offer.md)

**PASS**

Reviewed prerequisite-skill-offer.md path. The plan does not change the office-hours integration. No update needed.

---

## Check 5: Spec Quality — Verdict Logic and Severity Tiers

### Where are severity tiers defined?

**FAIL — definition location unspecified**

Plan states: "Verdict uses blockers: `blockers > 0 → NEEDS REVISION`, `blockers = 0 → APPROVED (with notes)`." But:
1. Where does this verdict logic live in SKILL.md? The current SKILL.md has no verdict section — it ends with a handoff block. Is the verdict new content in SKILL.md step 4 (Output)?
2. The completion summary format in required-outputs.md has no blocker/severity count fields. The plan shows a new append-only `## CEO Review` block with `**Blockers:** 0` — but required-outputs.md's Completion Summary table has no corresponding row. Two formats now exist for the same review result. Which is canonical?
3. "APPROVED with notes" — what are the "notes"? The high-leverage items? POLISH items? All of the above? Not defined.

---

### Append-only output — exact markdown format

**CONCERN — format defined but placement not specified**

The plan provides the markdown format clearly (the `## CEO Review` block). PASS on format. FAIL on:
- Does this section go into the plan file itself (plan.md) or the CEO plan document (which lives in `.claude/memory/projects/`)?
- The plan says "Append `## CEO Review` to plan.md (never overwrite)" but post-review.md currently writes a `## MEOWKIT REVIEW REPORT` section to plan.md. Now there will be TWO review-related sections in plan.md. How do they coexist? Which comes first?

---

## Check 6: YAGNI Check

**CONCERN — Coverage Mapping (Layer 1) is over-engineered for behavioral enforcement**

The plan describes Coverage Mapping as: "Parse requirements from problem statement. Parse tasks from plan phases. Map each requirement to ≥1 task." This is an NLP parsing problem being solved by SKILL.md behavioral instructions. Plans are freeform prose. A CEO-persona LLM can approximate this, but the plan presents it as a mechanical layer when it's actually judgment-based. The plan then raises this as Unresolved Question #2 (automated vs manual).

If it stays behavioral (the simpler path), the "Layer 1" framing is misleading — it implies mechanical execution. The plan should either: (a) commit to behavioral and drop the "mechanical" framing, or (b) commit to a script (adds hook complexity, flagged as out-of-scope in What This Does NOT Do). Currently it promises mechanical precision while delivering behavioral approximation. YAGNI risk: the framing creates expectations the implementation cannot meet.

**CONCERN — Two competing formats for review output**

Phase 4b proposes a new `## CEO Review` block in plan.md. `post-review.md` already writes `## MEOWKIT REVIEW REPORT` to plan.md. These are two different summary formats for the same review event. YAGNI: one canonical section should exist. Plan creates a second without reconciling the first.

**PASS — Core architectural decisions are not over-engineered**

The 5-layer pipeline is well-reasoned. Fast-fail principle is sound. Adversarial necessity is a concrete, measurable rule. Severity tiers replace a non-system with a minimal 3-tier system. None of these feel like YAGNI violations.

---

## Summary

| Check | Status | Critical? |
|-------|--------|-----------|
| pre-screen.md content spec | FAIL | Yes — false-positive risk + unparseable coverage mapping |
| two-lens-evaluation.md content spec | FAIL | Yes — WARN undefined, anchor examples absent |
| review-sections.md exact changes | CONCERN | Yes — escape hatch vs adversarial necessity contradiction unresolved |
| required-outputs.md exact changes | CONCERN | Medium — merge surgery not specified |
| step-08 change spec | FAIL | Medium — complexity variable undefined, insertion point missing |
| harness step-01 change spec | CONCERN | Medium — `--mode` flag doesn't match documented syntax |
| SKILLS_INDEX.md update | CONCERN | Low — description field will be stale |
| Website skill page update | FAIL | Medium — not in plan at all, will be stale post-ship |
| changelog / whats-new update | FAIL | Medium — not in plan at all |
| shared-protocols.md pre-screen status | CONCERN | Low — new termination state unmapped |
| post-review.md behavior conflict | CONCERN | Medium — two plan.md write paths not reconciled |
| Verdict logic location | FAIL | Yes — undefined where in SKILL.md this lives |
| Append-only vs MEOWKIT REVIEW REPORT coexistence | CONCERN | Medium — two competing plan.md sections |
| YAGNI: coverage mapping framing | CONCERN | Low — misleading but not blocking |

---

## Unresolved Questions

1. Does pre-screen's `TODO` rejection pattern exclude plan-creator's legitimate `## TODO` task sections? If yes, how does the behavioral instruction distinguish them?
2. What is WARN semantics in two-lens evaluation — does it block overall approval or not?
3. The `--mode SELECTIVE` flag in harness step-01 spec — does this flag exist or is it being proposed as new? If new, it needs to be added to SKILL.md's frontmatter/usage and the website page.
4. Where exactly does the `## CEO Review` append block live in plan.md relative to the existing `## MEOWKIT REVIEW REPORT` section? Which is canonical going forward?
5. The escape hatch in review-sections.md ("If a section has no issues, say so and move on") directly contradicts adversarial necessity. One must be removed or qualified. Which?
