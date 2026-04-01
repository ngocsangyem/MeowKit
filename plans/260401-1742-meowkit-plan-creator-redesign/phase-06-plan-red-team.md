# Phase 6: Plan Red Team (v1.3.1 Persona Reuse)

## Context Links

- [Red-Team Comparison Report](../reports/red-team-260401-2034-plan-creator-vs-ck-plan-comparison.md) — Gap: "No red team. HIGH severity."
- [v1.3.1 Persona Prompts](../../.claude/skills/meow:review/prompts/personas/) — Existing 4 adversarial personas
- [CK Red Team Workflow](../../../docs/claudekit-engineer/.claude/skills/ck-plan/references/red-team-workflow.md)

## Overview

- **Priority:** P1 (the decisive gap per red-team report)
- **Status:** Pending
- **Effort:** ~3h
- **Depends on:** Phase 4 (step-04 is where red team inserts)
- **Description:** Add adversarial plan review to step-04. Reuse the v1.3.1 persona prompts (Security Adversary, Failure Mode Analyst, Assumption Destroyer, Scope Critic) but target plan files instead of code diffs. Hard mode only.

## Key Insights

- ck-plan spawns 2-4 hostile reviewers who try to "destroy" the plan. This catches architectural flaws that validation interviews miss.
- MeowKit already has 4 persona prompts from v1.3.1 (meow:review). They work on any content — plan files are valid input.
- Red team on plans should run BEFORE validation interview (find flaws first, then confirm decisions).
- Cap at 2 personas for plans (KISS — plans are shorter than code diffs; 4 personas is overkill).

## Requirements

### Functional
1. **Plan red team in step-04** (hard mode only): After semantic checks, before validation interview
2. **Persona selection:** 2 personas for plans (Assumption Destroyer + Scope Critic — most relevant for plan quality)
3. **Input:** plan.md + all phase-XX files as "diff" equivalent
4. **Persona prompt adaptation:** Replace "diff" references with "plan files"; replace "base review findings" with "semantic check results"
5. **Findings format:** Same `[SEVERITY] [SECTION] [CATEGORY] [DESCRIPTION]` — but SECTION instead of FILE:LINE
6. **Adjudication:** Present findings to user. Accept/Reject each. Accepted findings update affected phase files.
7. **Cap:** Max 10 findings total across both personas.

### Non-Functional
- Red team adds ≤4k tokens (2 persona subagents × ~2k each)
- Reuse existing persona prompt files (no duplication)
- Only runs in hard mode (fast mode skips entirely)

## Architecture

### Insertion Point in step-04

```
step-04-validate-and-gate.md (updated flow):
    ↓
├── 4a. Semantic Content Checks (all modes) — EXISTING
    ↓
├── 4b. Plan Red Team (hard mode only) — NEW
│   ├── Load plan.md + all phase files as review content
│   ├── Spawn Assumption Destroyer persona (reads plan, finds unstated assumptions)
│   ├── Spawn Scope Critic persona (reads plan, finds over-engineering/scope creep)
│   ├── Collect findings (max 10)
│   ├── Present to user: Accept/Reject each finding
│   └── Apply accepted findings to affected phase files
    ↓
├── 4c. Validation Interview (hard mode only) — EXISTING (now informed by red-team findings)
    ↓
└── 4d. Gate 1 Presentation — EXISTING
```

### Persona Prompt Adaptation

Personas load from `meow:review/prompts/personas/` but receive plan-adapted context:

```
# Adversarial Plan Review: {Persona Name}

## Your Role
{load persona prompt from meow:review/prompts/personas/*.md}

## Plan Under Review
{plan.md content + all phase-XX file contents}

## Semantic Check Results
{results from step 4a}

## Your Mission (Plan-Specific)
1. Find architectural flaws, unstated assumptions, scope issues in the PLAN
2. Output format: [SEVERITY] [SECTION] [CATEGORY] [DESCRIPTION]
   - SECTION: "plan.md" or "phase-XX-name.md" + section name
3. Max 5 findings per persona (10 total)
4. Focus on: Will this plan SUCCEED? What breaks at implementation time?
```

## Related Code Files

### Files to Modify
- `meowkit/.claude/skills/meow:plan-creator/step-04-validate-and-gate.md` — Insert red team between semantic checks and interview

### Files to Read (Context)
- `meowkit/.claude/skills/meow:review/prompts/personas/assumption-destroyer.md`
- `meowkit/.claude/skills/meow:review/prompts/personas/scope-complexity-critic.md`

## Implementation Steps

1. Update step-04-validate-and-gate.md: add section "4b. Plan Red Team (Hard Mode Only)" between 4a and 4c
2. Define plan-adapted persona dispatch: load persona prompts, pass plan content + semantic results
3. Define adjudication flow: present findings via AskUserQuestion, Accept/Reject
4. Define phase update logic: accepted findings inserted into affected phase's Key Insights or Risk Assessment
5. Test: fast mode skips red team entirely
6. Test: hard mode runs 2 personas, produces ≤10 findings

## Todo List

- [ ] Add Plan Red Team section to step-04
- [ ] Define plan-adapted persona prompt template
- [ ] Implement adjudication (Accept/Reject per finding)
- [ ] Phase file update logic for accepted findings
- [ ] Test: fast mode skips, hard mode runs
- [ ] Test: findings correctly reference plan sections

## Success Criteria

1. Hard mode runs 2 persona passes on plan files before validation interview
2. Findings use `[SEVERITY] [SECTION] [CATEGORY]` format
3. User can Accept/Reject each finding
4. Accepted findings update affected phase files
5. Fast mode skips red team entirely (0 extra tokens)
6. Total red team cost ≤4k tokens

## Risk Assessment

| Risk | L | I | Mitigation |
|------|---|---|------------|
| Personas find irrelevant issues on plans | M | L | Plan-specific prompt; only 2 most relevant personas |
| User fatigued by too many findings | L | M | Cap at 10 total; batch presentation |
| Red team adds latency | M | L | 2 parallel personas; hard mode accepts slower planning |

## Security Considerations

- Persona prompts are INSTRUCTIONS (from meow:review/prompts/). Plan content is DATA.
- Red team findings may reference sensitive plan content — present findings only to the planning user.

## Next Steps

- Phase 7: User scope input enriches the plan BEFORE red team reviews it
- Phase 8: Sync-back ensures red team findings persist across sessions
