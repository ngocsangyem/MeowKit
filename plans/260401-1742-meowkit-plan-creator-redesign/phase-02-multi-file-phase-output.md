# Phase 2: Multi-File Phase Output

## Context Links

- [CK-Plan Phase Template](../../../docs/claudekit-engineer/.claude/skills/ck-plan/references/plan-organization.md) — 12-section template source
- [Phase 1](phase-01-foundation-step-file-and-scope-challenge.md) — Step-file foundation

## Overview

- **Priority:** P1
- **Status:** Pending
- **Effort:** ~4h
- **Depends on:** Phase 1 (step-03-draft-plan.md is the execution target)
- **Description:** Replace monolithic single-file plan output with plan.md overview + separate phase-XX files. Create the 12-section phase template. Update step-03-draft-plan.md to generate multi-file output.

## Key Insights

- CK-Plan's plan.md is ≤80 lines: YAML frontmatter + summary + phase table + key deliverables. All detail lives in phase files.
- Each phase file follows a 12-section template that enforces completeness. Developers always know where to find info.
- Phase count determined by task scope: 2-3 for simple features, 5-7 for complex systems.
- MeowKit's current template produces ~80 lines in a SINGLE file. Same budget should produce plan.md (40 lines) + 2-7 phase files (60-80 lines each).

## Requirements

### Functional
1. **plan.md template** (≤80 lines): YAML frontmatter, executive summary, phase table with status/effort/deps, key deliverables, risk assessment
2. **Phase file template** (12 sections, ≤100 lines each):
   - Context Links, Overview, Key Insights, Requirements, Architecture, Related Code Files, Implementation Steps, Todo List, Success Criteria, Risk Assessment, Security Considerations, Next Steps
3. **Phase splitting logic** in step-03:
   - Fast mode: plan.md only (no phase files)
   - Hard mode: plan.md + phase files (one per logical work unit)
   - Phase boundaries: different concerns (setup vs impl vs tests vs docs), different file ownership, different skill dependencies
4. **Cross-plan dependency detection**: Scan existing plans, detect blockedBy/blocks, update both plans

### Non-Functional
- Phase file template is a reference file (loaded JIT by step-03)
- plan.md template replaces current `assets/plan-template.md`
- Phase count auto-determined (not hardcoded)

## Architecture

### plan.md Template (Overview Only)

```yaml
---
title: "{Task Title}"
status: pending
priority: P1
effort: {estimate}
tags: [{tags}]
created: {date}
blockedBy: []
blocks: []
---
```

```markdown
# {Task Title}

## Summary
{2-3 sentences: problem, solution, approach}

## Phases

| # | Phase | Status | Effort | Depends On |
|---|-------|--------|--------|------------|
| 1 | [Phase Name](phase-01-name.md) | Pending | Xh | — |
| 2 | [Phase Name](phase-02-name.md) | Pending | Xh | Phase 1 |

## Key Deliverables
{numbered list}

## Risk Assessment
{table: risk, likelihood, impact, mitigation}
```

### Phase Splitting Rules

Step-03 determines phases by analyzing the task:

1. **Setup/infrastructure** work → own phase (env, deps, config)
2. **Each major component** → own phase (API, UI, DB, auth)
3. **Testing** → own phase (if substantial)
4. **Documentation** → own phase (if docs impact = major)
5. **Max 7 phases** (beyond that, decompose the task further)
6. **Min 2 phases** in hard mode (at least impl + validation)

## Related Code Files

### Files to Create
- `meowkit/.claude/skills/meow:plan-creator/references/phase-template.md` — 12-section template
- `meowkit/.claude/skills/meow:plan-creator/assets/plan-template.md` — REPLACE with overview template

### Files to Modify
- `meowkit/.claude/skills/meow:plan-creator/step-03-draft-plan.md` — Multi-file output logic
- `meowkit/.claude/skills/meow:plan-creator/scripts/validate-plan.py` — Validate phase files exist

## Implementation Steps

1. Create `references/phase-template.md` with 12-section template (adapt from CK-Plan)
2. Rewrite `assets/plan-template.md` as thin overview template (≤40 lines)
3. Write step-03-draft-plan.md:
   - Read research reports (from step-01)
   - Read codebase findings (from step-02)
   - Determine phase count from task scope
   - Write plan.md using overview template
   - Write phase-XX files using phase template (one per logical unit)
   - Cross-plan dependency scan
4. Update validate-plan.py: check plan.md has phase table, each linked phase file exists, each phase has 12 sections

## Todo List

- [ ] Create references/phase-template.md (12 sections)
- [ ] Rewrite assets/plan-template.md (overview only, ≤40 lines)
- [ ] Write step-03-draft-plan.md with multi-file generation logic
- [ ] Add phase splitting rules to step-03
- [ ] Add cross-plan dependency detection to step-03
- [ ] Update validate-plan.py for multi-file structure
- [ ] Test: simple task produces plan.md + 2 phase files
- [ ] Test: complex task produces plan.md + 5-7 phase files
- [ ] Test: fast mode produces plan.md only (no phase files)

## Success Criteria

1. `references/phase-template.md` exists with 12 required sections
2. step-03 generates plan.md (≤80 lines) + phase-XX files (≤100 lines each)
3. Phase files contain all 12 sections (validated by script)
4. Fast mode outputs plan.md only; hard mode outputs plan.md + phases
5. Cross-plan dependencies detected and written to frontmatter

## Risk Assessment

| Risk | L | I | Mitigation |
|------|---|---|------------|
| Phase count wrong (too many/few) | M | M | Guidelines: min 2, max 7. User can adjust. |
| Phase template too rigid | L | L | Template is a guide; sections can be "N/A" if not applicable |
| Token cost increase from multi-file | M | L | Each phase is ≤100 lines. Total < monolithic plan + research waste |
