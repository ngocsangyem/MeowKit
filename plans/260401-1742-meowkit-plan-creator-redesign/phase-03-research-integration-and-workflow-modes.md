# Phase 3: Research Integration + Workflow Modes

## Context Links

- [CK-Plan Research Phase](../../../docs/claudekit-engineer/.claude/skills/ck-plan/references/research-phase.md)
- [CK-Plan Workflow Modes](../../../docs/claudekit-engineer/.claude/skills/ck-plan/references/workflow-modes.md)
- [MeowKit Analysis: Research Gap](../../plans/reports/researcher-260331-0910-meow-plan-creator-improvement-recommendations.md)

## Overview

- **Priority:** P1
- **Status:** Pending
- **Effort:** ~4h
- **Depends on:** Phase 1 (step-01-research.md exists)
- **Description:** Fix the research → plan disconnect. Currently research produces reports that are archived, never referenced in the plan. Also implement fast/hard workflow modes so effort matches task complexity.

## Key Insights

- Current state: 50k tokens spent on research → findings archived in `reports/` → planner drafts plan WITHOUT reading them → next agent must rediscover findings. This is the #1 token waste source.
- CK-Plan solution: planner receives researcher report FILE PATHS (not pasted content), reads them, synthesizes a "Key Insights" section per phase that cites research findings.
- CK-Plan bounds research: 2 parallel researchers, max 5 tool calls each. Prevents runaway exploration.
- MeowKit already has `meow:scout` and `meow:docs-finder` — don't reinvent, reference them.

## Requirements

### Functional
1. **Research integration pipeline:**
   - step-01 spawns researchers → researchers write reports to `{plan-dir}/research/`
   - step-03 reads research report file paths → synthesizes findings into phase "Key Insights" sections
   - Each insight cites source: `(from: research/researcher-01-report.md)`
2. **Bounded research:**
   - Max 2 parallel researchers
   - Each researcher gets focused question + max 5 tool calls budget
   - Reports must be ≤150 lines (condensed, not raw exploration dumps)
3. **Workflow modes:**
   - `fast`: Skip step-01 (research) and step-02 (codebase analysis). Go straight to step-03 draft.
   - `hard`: Full pipeline — 2 researchers + codebase scout + validation interview
   - Mode selected at step-00 scope challenge (or explicit flag)
4. **Research report template:** Structured format so planner can parse consistently

### Non-Functional
- Research overhead ≤20-30 KB tokens (bounded by researcher limits)
- Planner reads report file paths, not pasted content (token efficiency)
- Compatible with `meow:docs-finder` and `meow:scout`

## Architecture

### Research → Plan Pipeline

```
step-00: scope → mode selection (fast|hard)
    ↓
step-01 (hard mode only):
    ├── Spawn researcher-01: "Investigate {aspect A}"
    │   → writes {plan-dir}/research/researcher-01-report.md
    └── Spawn researcher-02: "Investigate {aspect B}"
        → writes {plan-dir}/research/researcher-02-report.md
    ↓
step-02 (hard mode only):
    ├── Run meow:scout on relevant directories
    └── Read project docs (docs/project-context.md, etc.)
    ↓
step-03:
    ├── Read research reports (file paths from step-01)
    ├── Read codebase findings (from step-02)
    ├── Synthesize into plan.md overview
    └── For each phase file: populate "Key Insights" from research
```

### Workflow Mode Table

| Mode | Step 0 | Step 1 | Step 2 | Step 3 | Step 4 | Step 5 |
|------|--------|--------|--------|--------|--------|--------|
| fast | Scope (auto) | SKIP | SKIP | plan.md only | Gate 1 only | Hydrate |
| hard | Scope (full) | 2 researchers | Scout + docs | plan.md + phases | Validate + Gate 1 | Hydrate |

### Researcher Prompt Template

```
Task: Investigate {specific aspect} for the planning of "{task description}"
Budget: Max 5 tool calls
Output: Write findings to {plan-dir}/research/researcher-{N}-report.md
Format:
  ## Summary (3-5 bullets)
  ## Key Findings (numbered, with file:line references)
  ## Recommendations (what the planner should consider)
  ## Open Questions (uncertainties for user to clarify)
Max: 150 lines
```

## Related Code Files

### Files to Modify
- `meowkit/.claude/skills/meow:plan-creator/step-01-research.md` — Bounded researcher spawning
- `meowkit/.claude/skills/meow:plan-creator/step-02-codebase-analysis.md` — Scout + docs integration
- `meowkit/.claude/skills/meow:plan-creator/step-03-draft-plan.md` — Read research, synthesize
- `meowkit/.claude/skills/meow:plan-creator/workflow.md` — Add mode routing

### Files to Create
- `meowkit/.claude/skills/meow:plan-creator/references/research-report-template.md` — Researcher output format

## Implementation Steps

1. Write `references/research-report-template.md` — structured format, 150-line cap
2. Rewrite step-01-research.md:
   - Read `planning_mode` from step-00 output
   - If fast → skip entirely, proceed to step-03
   - If hard → spawn 2 researchers with focused questions + budget
   - Determine research aspects from task description (what to investigate)
   - Pass report file paths to step-03
3. Write step-02-codebase-analysis.md:
   - If fast → skip entirely
   - If hard → invoke `meow:scout` on relevant directories
   - Read project context docs
   - Output: codebase findings summary for step-03
4. Update step-03-draft-plan.md:
   - Read research reports from `{plan-dir}/research/`
   - For each phase's "Key Insights" section: cite relevant research findings
   - For "Technical Approach": synthesize research recommendations
5. Update workflow.md with mode routing table

## Todo List

- [ ] Create references/research-report-template.md
- [ ] Rewrite step-01 with bounded researcher spawning (2 researchers, 5 calls each)
- [ ] Write step-02 with meow:scout + docs reading
- [ ] Update step-03 to read research reports and populate Key Insights
- [ ] Add mode routing to workflow.md
- [ ] Test: fast mode skips steps 01 and 02
- [ ] Test: hard mode produces 2 research reports ≤150 lines each
- [ ] Test: plan phase files cite research findings in Key Insights

## Success Criteria

1. Fast mode skips research entirely (0 extra tokens for research)
2. Hard mode produces 2 research reports, each ≤150 lines
3. Plan phase files cite research findings in Key Insights sections
4. Research overhead ≤20-30 KB tokens (bounded)
5. workflow.md accurately reflects mode routing

## Risk Assessment

| Risk | L | I | Mitigation |
|------|---|---|------------|
| Researchers exceed 5-call budget | M | L | Budget is instruction, not enforcement. Add to gotchas. |
| Research reports too vague to synthesize | M | M | Template enforces structure: summary + findings + recommendations |
| Fast mode plans lack depth | L | M | Fast mode is explicit user choice; they accept the tradeoff |
