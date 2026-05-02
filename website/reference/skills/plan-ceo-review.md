---
title: "mk:plan-ceo-review"
description: "mk:plan-ceo-review"
---

## What This Skill Does
A rigorous, multi-section plan review from a CEO/founder perspective. Challenges premises, maps failure modes across 11 sections, traces error paths with severity tiers (BLOCKER/HIGH-LEVERAGE/POLISH), and ensures the plan is extraordinary -- not just adequate. Operates in four user-controlled modes: SCOPE EXPANSION (cathedral thinking), SELECTIVE EXPANSION (hold scope + cherry-pick), HOLD SCOPE (maximum rigor), and SCOPE REDUCTION (strip to essentials).

## When to Use
- User asks to "think bigger", "expand scope", "strategy review", or "rethink this"
- A plan feels under-ambitious or is questioning its own scope
- Before major implementation begins, to catch landmines early
- When the user wants a second opinion on plan quality and completeness
- NOT for idea validation before planning -- use `mk:office-hours` first
- Use AFTER a plan exists

## Core Capabilities
1. **Pre-Screen (Layer 0-1):** Placeholder scan for unfinished sections (TBD, "implement later", "if time permits"), structural completeness check (5 required plan sections), and coverage mapping (every requirement mapped to a task). Never rejects outright -- returns for amendment with actionable guidance
2. **System Audit:** Before the review, gathers full context: git history (30 commits), diff stats, stashed work, TODO/FIXME patterns, recently touched files, design docs, handoff notes, retrospective analysis, frontend scope detection, taste calibration, and landscape check (web search for industry context)
3. **Mode Selection:** Four user-controlled modes:
   - SCOPE EXPANSION: Dream big -- 10x check (10x more value for 2x effort), platonic ideal, delight opportunities, expansion opt-in ceremony where user approves each proposal individually
   - SELECTIVE EXPANSION: Hold current scope as baseline, then cherry-pick ceremonies for each expansion opportunity
   - HOLD SCOPE: Complexity check, minimum changes assessment, maximum rigor with no scope changes
   - SCOPE REDUCTION: Ruthless cut to absolute minimum viable
4. **Implementation Alternatives (MANDATORY):** Every plan gets 2-3 distinct approaches (at least: minimal viable + ideal architecture, optionally creative/lateral). User must approve before proceeding
5. **Two-Lens Evaluation:** Lens A (Intent Alignment -- is this the right problem?) and Lens B (Execution Credibility -- can an engineer deliver?). Each grades PASS/WARN/FAIL independently. Any FAIL stops the review with NEEDS REVISION
6. **Deep Review (11 Sections):** Architecture, Error & Rescue Map, Security & Threat Model, Data Flow & Interaction Edge Cases, Code Quality, Test Review, Performance, Observability & Debuggability, Deployment & Rollout, Long-Term Trajectory, Design & UX. Every section must surface at least one finding (adversarial necessity)
7. **Severity Tiers:** Every finding classified as BLOCKER (must fix), HIGH-LEVERAGE (>20% outcome improvement), or POLISH (<5%)
8. **Outside Voice:** Optional Claude subagent with fresh context for independent plan challenge -- catches structural blind spots
9. **Spec Review Loop:** Adversarial subagent reviews the CEO plan document on 5 dimensions (Completeness, Consistency, Clarity, Scope, Feasibility) with up to 3 fix-and-redispatch iterations
10. **Verdict:** Blockers > 0 -> NEEDS REVISION, else APPROVED with notes. Appended to plan.md (never overwrites). CEO plan persisted to `ceo-plans/` directory for EXPANSION/SELECTIVE modes
11. **Review Readiness Dashboard:** Shows all review statuses, staleness detection, and recommends next reviews

## Arguments
Mode is selected interactively via AskUserQuestion (not CLI arguments). Context-dependent defaults: greenfield -> EXPANSION, enhancement -> SELECTIVE EXPANSION, bug fix -> HOLD SCOPE, >15 files touched -> suggest REDUCTION.

## Workflow
```
Layer 0-1: Pre-Screen -> Step 0: Scope/Mode -> Step 0.5: Two-Lens -> Sections 1-11: Deep Review -> Outside Voice (optional) -> Layer 5: Verdict + Handoff
```

Detailed:
1. Pre-Screen: Placeholder scan, structural completeness, coverage mapping. User decides: amend or proceed
2. Initialize: Preamble, base branch detection, pre-review system audit (git history, design docs, handoff notes, TODOs, retrospective, frontend scope, taste calibration, landscape check)
3. Prerequisite Skill Offer: If no design doc found, offer `mk:office-hours` inline. If user can't articulate the problem mid-session, re-offer
4. Step 0 -- Nuclear Scope Challenge + Mode Selection: Premise challenge, existing code leverage, dream state mapping, 2-3 implementation alternatives (mandatory), mode-specific analysis with opt-in or cherry-pick ceremonies, temporal interrogation, mode selection
5. Step 0.5 -- Two-Lens Evaluation: Intent Alignment + Execution Credibility. FAIL on either -> NEEDS REVISION, stop
6. Sections 1-11 -- Deep Review: One section at a time. Each must surface >=1 finding. AskUserQuestion per issue -- never batch. Severity tiers on all findings
7. Outside Voice: Optional adversarial subagent with fresh context. Cross-pass tension analysis
8. Verdict: Blockers > 0 -> NEEDS REVISION. Append CEO Review block to plan.md
9. Post-Review: Completion summary, review readiness dashboard, plan file review report, review chaining recommendations, docs/designs promotion (EXPANSION/SELECTIVE only)

## Usage
```
/mk:plan-ceo-review
```
(plan file path provided in conversation context -- the skill detects it automatically)

## Example Prompt
"I've written a plan for our auth system refactor but I'm worried it's under-ambitious. Can you think bigger?"

The skill will: pre-screen the plan for unfinished sections, run the full system audit, walk through the scope challenge with mode selection (likely EXPANSION for this request), produce 2-3 implementation alternatives, run the two-lens evaluation, then deep-review all 11 sections with severity-tagged findings.

## Common Use Cases
- Pre-implementation plan quality assurance
- Scope expansion: "Is this ambitious enough?"
- Architecture stress-testing before committing resources
- Catching missing error paths, security gaps, and untested edge cases
- Getting an independent, adversarial second opinion on a plan
- Stripping over-engineered plans back to MVP essentials

## Pro Tips
- The pre-screen never blocks autonomously -- user always decides: amend or proceed with known gaps
- Two-lens evaluation gates the deep review: if the plan has misaligned intent or isn't executable, the review stops early to save time
- Every section requires at least one finding -- "no issues found" is valid only with documented evidence proving why the section is clean
- The outside voice subagent has independent fresh context and catches blind spots the primary reviewer is structurally blind to
- The review appends to plan.md -- it never overwrites. Both the original plan and the CEO review coexist
- For EXPANSION/SELECTIVE modes, the CEO plan is persisted to `.claude/memory/projects/ceo-plans/` and can be promoted to `docs/designs/`
- The GATE 1 HARD STOP at the end means the agent does NOT chain into implementation automatically -- the human decides

### Notes
- The doc page is approximately 5% of the source content. Nearly every reference file's content is missing from the documentation.
- The source has 13 reference files totalling ~15,000+ words of detailed process instructions. The doc has ~300 words.