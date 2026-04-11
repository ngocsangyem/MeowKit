# Red-Team A: Integration Safety Review
**Plan:** `260411-2245-plan-ceo-review-improvement`
**Date:** 2026-04-11
**Reviewer role:** Hostile integration reviewer

---

## Check 1: File Existence

### Files to MODIFY

| File | Exists? | Verdict |
|------|---------|---------|
| `meow:plan-ceo-review/SKILL.md` | YES | PASS |
| `meow:plan-ceo-review/references/review-sections.md` | YES | PASS |
| `meow:plan-ceo-review/references/required-outputs.md` | YES | PASS |
| `meow:harness/step-01-plan.md` | YES | PASS |
| `meow:plan-creator/step-08-*.md` | YES — `step-08-hydrate-tasks.md` | PASS |

### Files to CREATE

| File | Parent dir exists? | Verdict |
|------|-------------------|---------|
| `meow:plan-ceo-review/references/pre-screen.md` | YES (`references/` has 11 files) | PASS |
| `meow:plan-ceo-review/references/two-lens-evaluation.md` | YES | PASS |

**Check 1 result: PASS** — all target files exist; parent dirs confirmed.

---

## Check 2: Contract Compatibility — 4-Mode System + 11-Section Flow

### 2a. 4-mode system (EXPANSION/SELECTIVE/HOLD/REDUCTION)

CONCERN. The pre-screen (Layer 0-1) is designed to "exit early if plan is unfinished." The plan states:

> "Missing section → request amendment, don't reject. Pre-screen is a quality floor, not a gate."

But Layer 0 also says:

> "Reject patterns: TBD, TODO, 'implement later'... → REJECT early if plan is unfinished."

These two statements **contradict**. "Reject early" vs "request amendment, not rejection." An implementer reading SKILL.md will not know which behavior to enforce. In EXPANSION mode especially, plans legitimately contain speculative language ("if this works, extend to X"). The pre-screen as written has no mode awareness — a REDUCTION-mode review on a lean plan could false-positive on sparse language.

**Verdict: FAIL**
- What breaks: pre-screen behavior is undefined (reject vs request amendment) and not mode-aware.
- Fix: resolve the contradiction explicitly. Define "reject" = return to planner before review starts; "request amendment" = surface gap during review. Mandate mode-awareness: REDUCTION and HOLD modes should have lower thresholds for "TBD" patterns since scope is already trimmed.

### 2b. 11-section flow

The plan says:

> "Replace current 'Section 1: Architecture Review' preamble with two-lens evaluation."

Evidence: `review-sections.md` has Section 1 starting with "Evaluate and diagram: Overall system design..." — it has no "preamble" distinct from the section body. There is no separable preamble to replace. The plan is describing a structural modification that doesn't map to any identifiable chunk in the existing file.

**Verdict: FAIL**
- What breaks: the implementer cannot mechanically identify WHAT to replace in Section 1. "Preamble" does not exist as a labeled component.
- Fix: plan must specify exact text to insert, and where relative to Section 1's existing content. Given two-lens eval is meant to run BEFORE sections 1-11 (it's Layer 3 in the pipeline), it should be inserted as a new pre-section step, not as a Section 1 replacement.

### 2c. required-outputs.md deliverables

Plan adds:

> "Append-only output: append '## CEO Review' block to plan.md"
> "Merge Error & Rescue Map + Failure Modes Registry → single Failure Analysis table"
> "Merge Data Flow Tracing + Data Flow Diagram → single Data Flow section"

Current `required-outputs.md` has both "Error & Rescue Registry (from Section 2)" AND "Failure Modes Registry" as distinct, separately-formatted deliverables. The merge is a non-trivial change — the two formats are different (one is a method/exception table, the other is a CODEPATH/FAILURE MODE table).

The plan states the merge but provides no merged format. Implementer must invent the merged schema.

**Verdict: CONCERN**
- What breaks: ambiguity. Two different table formats; no merged schema provided. Risk of losing the CODEPATH-level detail in the Failure Modes Registry when merging into the Error & Rescue format (which is method-centric).
- Fix: plan must specify the merged table schema explicitly before implementation.

### 2d. Office-hours handoff

SKILL.md line 14: `benefits-from: [office-hours]`. Post-review handoff is handled by `references/post-review.md`. The plan does NOT modify `post-review.md` — the office-hours handoff is unchanged.

Pre-screen adds a new early exit path (return to planner before review starts). This exit path has no handoff defined. If pre-screen rejects a plan, where does control go? The plan is silent.

**Verdict: CONCERN**
- No handoff defined for pre-screen rejection path. User gets a rejection with no structured next-step prompt.
- Fix: add a pre-screen rejection handoff (suggest running `/meow:plan-creator` to fix the plan, or surface specific gaps via AskUserQuestion).

---

## Check 3: Harness Integration Safety

### 3a. step-01-plan.md — what it currently does

Evidence: `step-01-plan.md` invokes `meow:plan-creator --product-level` via Task tool, captures plan path, verifies Gate 1, and appends to run report. It does NOT run CEO review. It passes control to step-02 (contract).

### 3b. Plan proposes adding auto-CEO-review for FULL density

The plan states:

> "After plan-creator produces spec: If density == FULL: Auto-run /meow:plan-ceo-review --mode SELECTIVE"

**Verdict: FAIL**
- **Structural conflict**: step-01-plan.md ends with `Print: "Plan ready... Proceeding to step-02 (contract)."` and `Read and follow step-02-contract.md`. CEO review is a potentially long, interactive (AskUserQuestion-heavy) review. Inserting it between step-01 and step-02 breaks the harness's non-interactive automation contract. The harness is designed for autonomous runs; CEO review requires human interaction per the SKILL.md workflow (AskUserQuestion at every section, scope challenge requires human mode selection).
- **Budget impact**: CEO review adds ~10-15 min of execution. Harness Rule 6 warns at $30. A FULL density harness run that already includes plan + contract + generate + evaluate would push well past the $30 warn threshold on a medium-complexity task.
- **Gate conflict**: SKILL.md ends with a hard stop — "STOP after printing this block." The auto-run proposal conflicts with the explicit STOP gate in CEO review's own design. If auto-run is implemented, CEO review would need to be refactored to not hard-stop, or the harness needs to orchestrate through the hard stop.
- **Fix**: Don't modify step-01-plan.md. Instead, modify step-01 to SUGGEST CEO review (print a recommendation) but not auto-run it. This preserves the harness automation contract and avoids the interactive/non-interactive conflict. Alternatively, add a separate step-01b-ceo-review.md that's only invoked when the user sets `MEOWKIT_CEO_REVIEW=1`.

### 3c. Budget impact

Current harness already hits $30 warn on complex product builds (per Rule 6 documentation). Adding a full CEO review session (~2K tokens × 11 sections + diagrams + AskUserQuestion calls) to every FULL density run would increase per-run cost by an estimated 15-25%. This pushes medium-complexity builds over the $30 threshold routinely.

**Verdict: CONCERN** (not FAIL if the auto-run is changed to suggestion-only as recommended above)

---

## Check 4: plan-creator step-08 Handoff

### 4a. Exact filename

`step-08-hydrate-tasks.md` — confirmed via Glob.

### 4b. What step-08 currently does

Creates Claude Tasks from plan phases (TaskCreate calls), sets dependencies via `addBlockedBy`, writes `.plan-state.json` checkpoint, outputs the cook command, then **HARD STOPS**: "STOP after this step. Do not auto-proceed to implementation."

### 4c. Plan proposes adding "suggest CEO review"

The plan says: after plan-creator writes the plan, if complexity == COMPLEX → suggest running CEO review; if STANDARD → optional suggestion.

**Verdict: CONCERN**
- step-08 already hard-stops with a specific cook command output. Adding a CEO review suggestion is low-risk IF it's appended before or after the existing cook command block. But the plan does not specify placement — would the suggestion appear BEFORE or AFTER the cook command? If after, it may be missed. If before, it changes the visual hierarchy of the step's output.
- step-08 also has no access to the `complexity` variable. Plan-creator's steps read plan metadata, but `complexity` as a variable is set earlier in the workflow (step-00 reads task complexity). Whether `complexity` is available in step-08's scope is not confirmed.
- **Fix**: confirm complexity variable is in scope at step-08 (check `.plan-state.json` — it has `planning_mode` but NOT `complexity`). If not in scope, the conditional suggestion cannot be implemented as written. Alternative: always suggest CEO review for product-level plans (which is already implied by the COMPLEX use case), or read complexity from plan.md frontmatter.

---

## Check 5: Redundancy Analysis

### 5a. Two-lens evaluation vs. validate-plan's 8-dimension check

Evidence: `meow:validate-plan/SKILL.md` runs 8 dimensions:
1. Scope Clarity
2. Acceptance Criteria (binary)
3. Dependencies Resolved
4. Risks Identified
5. Architecture Documented
6. Test Strategy
7. Security Considered
8. Effort Estimated

Two-lens eval proposed:
- Lens A (Intent Alignment): problem-solution fit, measurable success criteria, scope match
- Lens B (Execution Credibility): timeline, technical choices, task granularity, dependencies

**Overlap is significant but not total:**
- Lens A #2 (measurable success criteria) ≈ validate-plan Dim 2 (binary acceptance criteria)
- Lens A #3 (scope match) ≈ validate-plan Dim 1 (Scope Clarity)
- Lens B #4 (dependencies mapped) ≈ validate-plan Dim 3 (Dependencies Resolved)
- Lens B #3 (task decomposition granularity) = NEW, not in validate-plan
- Lens B #2 (technical choices justified) ≈ validate-plan Dim 5 (Architecture Documented)

**Verdict: CONCERN** (not FAIL — some genuine novelty, but ~50% overlap with validate-plan)
- Two-lens adds: intent-solution fit check, execution credibility as a named concept, granularity check.
- Two-lens duplicates: scope clarity, binary criteria, dependencies, architecture.
- The plan does NOT call out this overlap. Users running both validate-plan AND CEO review will get redundant grading on 3-4 dimensions.
- Fix: document the non-overlapping value explicitly. Consider whether Lens A/B should SKIP dimensions already validated by validate-plan if it was run.

### 5b. Pre-screen vs. gate-enforcement.sh

`gate-enforcement.sh` enforces Gate 1 (plan file existence + required sections before code writes). The pre-screen checks for placeholder patterns and structural completeness.

These are NOT redundant — gate-enforcement.sh is a hook that runs on file writes; pre-screen is a behavioral check WITHIN the CEO review skill before review starts. Different trigger points, different mechanisms.

**Verdict: PASS** — no redundancy.

### 5c. Adversarial necessity vs. plan-creator's red-team step

`meow:plan-creator/step-05-red-team.md` runs adversarial review during plan creation. CEO review's adversarial necessity forcing requires ≥1 finding per section during the post-creation review.

These serve different functions: step-05 challenges the plan's assumptions and strategy during creation; adversarial necessity ensures the CEO reviewer doesn't rubber-stamp during evaluation. Different timing, different scope.

**Verdict: PASS** — not redundant.

---

## Check 6: Missing Updates

The plan explicitly says "Files NOT Modified: Agents, Hooks, Commands, Rules — no changes needed."

Missing updates the plan should have flagged:

| File | Why it needs updating | Severity |
|------|-----------------------|---------|
| `SKILL.md` — References section | Two new reference files (`pre-screen.md`, `two-lens-evaluation.md`) must be listed in the `## References` block; currently lists 11 files | HIGH — agents use the References section to discover what to load |
| `SKILL.md` — Workflow section | Step 1 of the workflow references preamble + Step 0D + sections; with pre-screen added as a new Layer 0 step, the workflow description needs updating | HIGH |
| `meow:validate-plan/SKILL.md` | Should note that CEO review's two-lens eval overlaps 3-4 of its dimensions | LOW — informational only |
| `SKILLS_INDEX.md` | Line 30 references `meow:plan-ceo-review` — description may need updating if the skill's behavior changes significantly | LOW |

**Verdict: FAIL** (for SKILL.md References + Workflow sections)
- SKILL.md currently has explicit `## References` and `## Workflow` sections. Adding two new reference files without updating these sections means agents loading SKILL.md will not know to load `pre-screen.md` or `two-lens-evaluation.md`. The new layers become dead files.
- Fix: plan must explicitly list SKILL.md's `## References` and `## Workflow` sections in the files-to-modify table.

---

## Summary

| Check | Verdict | Critical? |
|-------|---------|-----------|
| 1. File existence | PASS | — |
| 2a. 4-mode system (pre-screen mode-awareness) | FAIL | YES |
| 2b. 11-section flow (Section 1 "preamble" target) | FAIL | YES |
| 2c. Required-outputs merge schema | CONCERN | Medium |
| 2d. Office-hours handoff for pre-screen rejection | CONCERN | Medium |
| 3. Harness auto-run conflicts | FAIL | YES |
| 3c. Budget impact | CONCERN | Medium |
| 4. step-08 complexity variable in scope | CONCERN | Medium |
| 5a. Two-lens vs validate-plan redundancy | CONCERN | Low |
| 5b. Pre-screen vs gate-enforcement | PASS | — |
| 5c. Adversarial necessity vs red-team | PASS | — |
| 6. SKILL.md References + Workflow not listed | FAIL | YES |

### Hard FAILs (must fix before implementation)

1. **Pre-screen contradiction + no mode-awareness**: "reject early" vs "request amendment" is undefined. EXPANSION mode plans will false-positive. Resolve the contradiction and add mode-conditional thresholds.

2. **Section 1 "preamble" does not exist**: the plan's instruction to "replace the Section 1 preamble with two-lens eval" has no concrete target. Two-lens eval should be inserted as a new pre-section step before Section 1, not as a Section 1 replacement.

3. **Harness auto-run breaks non-interactive contract**: CEO review is AskUserQuestion-heavy; harness is autonomous. Auto-running CEO review inside step-01 will hang the harness waiting for human input. Change to a printed suggestion, or a separate opt-in step.

4. **SKILL.md References + Workflow sections not listed in files-to-modify**: new reference files become unreachable dead files unless SKILL.md's `## References` section is updated.

---

## Unresolved Questions

1. Is `complexity` in scope at step-08? `.plan-state.json` has `planning_mode` but not `complexity`. If not in scope, the conditional CEO review suggestion in step-08 cannot be implemented as written.
2. The plan says "never overwrite plan.md sections" — but what if `## CEO Review` section already exists from a prior review? Append-only would create duplicate headers. The append format needs a de-duplication rule.
3. Phase 4c says "all modes write `## CEO Review` to plan.md" — but HOLD and REDUCTION currently produce no CEO plan document. If they now write to plan.md, does the completion summary still say "CEO plan: skipped (HOLD/REDUCTION)"? Contradiction in `required-outputs.md` completion table.
