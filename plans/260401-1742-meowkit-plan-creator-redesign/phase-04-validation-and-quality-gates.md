# Phase 4: Validation + Quality Gates

## Context Links

- [CK-Plan Validate Workflow](../../../docs/claudekit-engineer/.claude/skills/ck-plan/references/validate-workflow.md)
- [CK-Plan Question Framework](../../../docs/claudekit-engineer/.claude/skills/ck-plan/references/validate-question-framework.md)
- [MeowKit Gate Rules](../../.claude/rules/gate-rules.md)

## Overview

- **Priority:** P2
- **Status:** Pending
- **Effort:** ~2h
- **Depends on:** Phase 2, Phase 3
- **Description:** Add validation interview (critical questions before Gate 1) and semantic content validation (catch quality issues before human review). This catches "I assumed X but user wanted Y" before coding starts.

## Key Insights

- Current meow:plan-creator validates STRUCTURE only (sections exist). Doesn't catch: goal describes activity not outcome, missing constraints, vague ACs.
- CK-Plan has a validation interview (5 categories: architecture, assumptions, tradeoffs, risks, scope) with answers propagated back to affected phases.
- MeowKit already has `meow:validate-plan` skill (8-dimension validation). Don't duplicate — integrate it into step-04.
- Validation only runs in hard mode. Fast mode goes straight to Gate 1.

## Requirements

### Functional
1. **Validation interview** (hard mode only, step-04):
   - Generate 3-5 critical questions based on plan content
   - Categories: architecture choices, unstated assumptions, scope boundaries, risk tolerance, tradeoffs
   - Present via AskUserQuestion
   - Propagate answers back to affected phase files (update Key Insights, Risk Assessment)
2. **Semantic content checks** (all modes, step-04):
   - Goal must describe OUTCOME not ACTIVITY ("Users can log in" not "Implement auth")
   - ACs must be binary pass/fail (no "should be fast enough")
   - Constraints section must exist and be non-empty
   - At least one risk identified
3. **Gate 1 presentation:**
   - Include: completed items, skipped items (with justification), uncertain items
   - Self-check before presenting (per gate-rules.md)
4. **Integration with meow:validate-plan:** Call existing skill for 8-dimension validation if available

### Non-Functional
- Validation adds ≤5 KB tokens (questions + answers + propagation)
- Questions budget: 3-5 (from hook injection or default)

## Architecture

### step-04 Flow

```
step-04-validate-and-gate.md
    ↓
├── Semantic Content Checks (all modes)
│   ├── Goal = outcome? (not activity)
│   ├── ACs = binary? (pass/fail)
│   ├── Constraints non-empty?
│   └── ≥1 risk identified?
│   → If any fail: fix inline, note what was corrected
    ↓
├── Validation Interview (hard mode only)
│   ├── Generate 3-5 critical questions from plan content
│   ├── Present via AskUserQuestion
│   ├── Record answers in validation log
│   └── Propagate answers to affected phase files
    ↓
├── meow:validate-plan (if available, hard mode)
│   └── Run 8-dimension validation, append results
    ↓
└── Gate 1 Presentation
    ├── Self-check: completed / skipped / uncertain
    ├── Present plan for human approval
    └── If approved → step-05 (hydrate tasks)
```

## Related Code Files

### Files to Modify
- `meowkit/.claude/skills/meow:plan-creator/step-04-validate-and-gate.md`

### Files to Create
- `meowkit/.claude/skills/meow:plan-creator/references/validation-questions.md` — Question categories + examples

### Files to Read
- `meowkit/.claude/skills/meow:validate-plan/SKILL.md` — Existing validation skill
- `meowkit/.claude/rules/gate-rules.md` — Gate 1 requirements

## Implementation Steps

1. Create `references/validation-questions.md`:
   - 5 categories with 2-3 example questions each
   - Instructions for generating questions from plan content
2. Write step-04-validate-and-gate.md:
   - Semantic content checks (goal/ACs/constraints/risks)
   - Conditional validation interview (hard mode)
   - meow:validate-plan integration
   - Gate 1 self-check and presentation
3. Test with a real plan to verify question quality

## Todo List

- [ ] Create references/validation-questions.md
- [ ] Write step-04-validate-and-gate.md
- [ ] Semantic checks: goal outcome, AC binary, constraints, risks
- [ ] Validation interview: 3-5 questions, AskUserQuestion
- [ ] Answer propagation to phase files
- [ ] meow:validate-plan integration
- [ ] Gate 1 self-check (completed/skipped/uncertain)
- [ ] Test: fast mode skips interview, runs semantic checks only
- [ ] Test: hard mode runs full validation + interview

## Success Criteria

1. Semantic checks catch "activity goals" and "vague ACs" before Gate 1
2. Hard mode generates 3-5 relevant questions from plan content
3. Answers propagated to affected phase files (traceable updates)
4. Gate 1 presentation includes self-check (completed/skipped/uncertain)
5. Fast mode runs semantic checks only (≤1 KB overhead)

## Risk Assessment

| Risk | L | I | Mitigation |
|------|---|---|------------|
| Questions too generic | M | M | Template with category-specific examples; test on 3 real plans |
| Answer propagation breaks phase files | L | M | Only update Key Insights and Risk Assessment sections |
| meow:validate-plan unavailable | L | L | Graceful skip if skill not found |
