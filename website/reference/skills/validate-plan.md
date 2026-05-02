---
title: "mk:validate-plan"
description: "mk:validate-plan"
---

## What This Skill Does
Validates a plan file against 8 dimensions to catch gaps before implementation begins. Does NOT replace Gate 1 (human approval) -- supplements it with systematic, automated checks. Every dimension has binary pass criteria; nothing is subjective.

## When to Use
- After Gate 1 approval, before Phase 2 (Test)
- When `/mk:cook` detects a COMPLEX task (auto-suggested)
- User says "validate this plan", "check my plan", "is this plan complete"
- Before committing to implementation, to stress-test plan quality
- NOT for green-field harness sprints -- use `mk:sprint-contract` instead

## Core Capabilities
1. **8-Dimension Check:** Each dimension has explicit pass criteria and common failure patterns:
   - Scope Clarity -- in/out-of-scope explicit and non-overlapping
   - Acceptance Criteria -- every criterion binary (pass/fail), not subjective
   - Dependencies Resolved -- all external dependencies identified with status (available/blocked)
   - Risks Identified -- at least 1 risk flag with mitigation strategy
   - Architecture Documented -- technical approach references existing patterns or includes ADR
   - Test Strategy -- covers acceptance criteria; edge cases identified
   - Security Considered -- auth, data access, input validation addressed or explicitly N/A
   - Effort Estimated -- time/complexity estimate with confidence level
2. **Whole-Plan Consistency Sweep:** Before emitting the report, cross-checks `plan.md` and all `phase-*.md` files for stale references, renamed entities, scope changes, and dropped features. Reconciles contradictions across files
3. **Routing:** All 8 PASS -> proceed to Phase 2. Any FAIL -> return to planner with specific revision requests. WARN (partially met) -> user decides: proceed or revise
4. **Integration with cook:** Automatic for COMPLEX tasks, optional for STANDARD, skipped for TRIVIAL

## Arguments
No CLI arguments. Takes the plan file path from conversation context (typically `tasks/plans/YYMMDD-name/plan.md`).

## Workflow
1. Load plan file from plan directory
2. Check each of 8 dimensions against pass criteria
3. Run whole-plan consistency sweep across plan.md + all phase-*.md files (skip if plan has only plan.md)
4. Produce validation report with PASS/FAIL/WARN per dimension and specific findings
5. Route result: all PASS -> proceed; any FAIL -> return for revision; WARN -> user decides

## Usage
Auto-triggered by cook workflow for COMPLEX tasks:
```
Gate 1 (plan approved) -> mk:validate-plan -> Phase 2 (Test)
```

Manual invocation:
```
/mk:validate-plan
```

## Example Prompt
"I just got my plan approved. Can you validate it before we start building?"

The skill will: load the plan file, score all 8 dimensions, run the consistency sweep across phase files, and output a validation report showing pass/fail per dimension with specific findings.

## Common Use Cases
- Gate check between plan approval and implementation
- Catching missing acceptance criteria before building tests
- Identifying unlisted dependencies that would block implementation
- Surfacing security oversights in user-data features
- Verifying all risks have mitigations documented

## Pro Tips
- The consistency sweep catches contradictions across distributed plan files -- a phase file referencing a component that plan.md renamed, or declaring scope that plan.md marks out-of-scope
- Sweep failures do NOT auto-fail the validation -- they surface inconsistencies the human must reconcile
- This skill checks content quality, not structure. The `validate-plan.py` script checks plan file *structure* (required sections exist). Both can and should run
- Three-result output: PASS = proceed, FAIL = revise that dimension, WARN = user discretion

### Notes
- The doc mentions "Offer export options for team review" which is not present in the source SKILL.md. This appears to be a doc-only addition that may need removal or source implementation.