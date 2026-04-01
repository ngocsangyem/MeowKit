# Step 3: Draft Plan

Write plan.md overview + phase files. Integrate research findings into plan content.

## Instructions

### 3a. Create Plan Directory

```
tasks/plans/YYMMDD-{slug}/
├── plan.md
├── research/          (if research reports exist)
└── phase-XX-name.md   (hard mode only)
```

### 3b. Write plan.md (Overview, ≤80 Lines)

Use this structure:

```yaml
---
title: "{Outcome-focused title}"
type: {feature | bug-fix | refactor | security}
status: draft
priority: {critical | high | medium | low}
effort: {xs | s | m | l | xl}
created: {YYMMDD}
model: {workflow_model from step-00}
blockedBy: []
blocks: []
---
```

```markdown
# {Title}

## Goal
{One sentence: what done looks like, not what to do}

## Context
{2-5 bullets: current state, problem, why this task exists}
{Include "Prior learnings:" if memory had relevant patterns}

## Phases

| # | Phase | Status | Effort | Depends On |
|---|-------|--------|--------|------------|
| 1 | [Name](phase-01-name.md) | Pending | Xh | — |
| 2 | [Name](phase-02-name.md) | Pending | Xh | Phase 1 |

## Key Deliverables
{numbered list}

## Constraints
{imperative: "Do NOT...", "MUST preserve..."}

## Risk Assessment
| Risk | L | I | Mitigation |
```

**Fast mode:** Write plan.md with Goal, Context, Scope, Constraints, Technical Approach, ACs, Agent State. NO phase files. Use `assets/plan-template.md` format.

### 3c. Write Phase Files (Hard Mode Only)

Each phase file MUST have these 12 sections:

1. **Context Links** — links to research reports, related files, docs
2. **Overview** — priority, status, effort, description
3. **Key Insights** — findings from research (cite source: `from: research/researcher-01-report.md`)
4. **Requirements** — functional + non-functional
5. **Architecture** — design, data flow, component interaction
6. **Related Code Files** — files to create, modify, read
7. **Implementation Steps** — numbered, specific, file-referenced
8. **Todo List** — checkboxes for tracking
9. **Success Criteria** — binary pass/fail checks
10. **Risk Assessment** — table: risk, likelihood, impact, mitigation
11. **Security Considerations** — auth, data protection, injection
12. **Next Steps** — dependencies, follow-up tasks

See `references/phase-template.md` for the full template.

### 3d. Phase Splitting Rules

Determine phases by analyzing the task:
- **Setup/infrastructure** → own phase (env, deps, config)
- **Each major component** → own phase (API, UI, DB, auth)
- **Testing** → own phase (if substantial test work)
- **Documentation** → own phase (if docs impact = major)
- **Min 2 phases** in hard mode
- **Max 7 phases** (beyond that, decompose the task)

### 3e. Research Integration

For each phase file, populate "Key Insights" from research reports:
1. Read research report file paths from step-01
2. For each insight relevant to this phase, cite: `(from: research/researcher-01-topic.md)`
3. For "Technical Approach" in plan.md: synthesize researcher recommendations

### 3f. Cross-Plan Dependency Detection

If step-02 found existing plans with overlapping scope:
1. Classify: new plan blocks existing? new plan needs existing? mutual?
2. Set `blockedBy` / `blocks` in both plan.md frontmatter
3. If ambiguous: note for user in step-04 validation

### 3g. Research Link Verification (Hard Mode Only)

After writing phase files, verify research integration:

For each phase file:
1. Check: does `## Context Links` contain at least one `research/` link?
2. If `{plan-dir}/research/` has reports but Context Links is missing them:
   - Add link to most relevant report (match by keyword)
   - Print: `"Fixed: {phase-file} now links to research/{report}"`
3. If no research reports exist (fast mode): skip this check.

## Output

- `plan_dir` — absolute path to the created plan directory
- Print: `"Plan: {plan_dir}/plan.md ({N} phases)"`

## Next

Read and follow `step-04-validate-and-gate.md`
