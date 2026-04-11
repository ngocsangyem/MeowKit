# Step 3: Draft Plan

Write plan.md overview + phase files. Integrate research findings into plan content.

## Instructions

### 3a. Create Plan Directory

```
tasks/plans/YYMMDD-{slug}/
├── plan.md
├── research/          (if research reports exist)
└── phase-XX-name.md   (hard/deep/parallel/two mode)
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

### 3b'. Solution Design Checklist (Hard Mode Only)

Before writing phase files, read `references/solution-design-checklist.md`. Use it as a checklist when writing Architecture, Risk Assessment, and Security Considerations sections. Not every item applies — skip irrelevant items, but explicitly consider each dimension.

### 3c. Write Phase Files (Hard/Deep/Parallel/Two Mode)

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

### 3c'. TDD Sections (Conditional: `tdd_mode = true`)

If `tdd_mode = true`, append these 4 sections after "Implementation Steps" in each phase file:

13. **Tests Before** — what failing tests to write BEFORE implementation (test names, assertions, expected failures)
14. **Refactor Opportunities** — what to clean up after tests pass (extract helpers, rename, simplify)
15. **Tests After** — integration/regression tests to add after refactoring (cross-component, edge cases)
16. **Regression Gate** — specific test commands to verify no regressions (`npm test`, `pytest -x`, etc.)

These sections are ONLY added when `--tdd` flag is set or `MEOWKIT_TDD=1` env var is active. Phase files without TDD mode retain the standard 12-section template.

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
3. If ambiguous: note for user in step-06 validation interview

### 3g. Research Link Verification (Hard Mode Only)

After writing phase files, verify research integration:

For each phase file:
1. Check: does `## Context Links` contain at least one `research/` link?
2. If `{plan-dir}/research/` has reports but Context Links is missing them:
   - Add link to most relevant report (match by keyword)
   - Print: `"Fixed: {phase-file} now links to research/{report}"`
3. If no research reports exist (fast mode): skip this check.

### 3h. Per-Phase Scouting (Conditional: `planning_mode = deep`)

After writing all phase files (section 3c), run targeted scouting for each phase:

1. For each phase file, read its `## Related Code Files` section
2. Identify unique directories from the file paths listed
3. Invoke `meow:scout` on each directory set (max 3 tool calls per phase, max 7 phases)
4. Inject scout results into the phase file:
   - Add **File Inventory** subsection under Key Insights: list files found, their size, last modified
   - Add **Dependency Map** subsection under Architecture: which files import/depend on which
5. Print: `"Deep scan: {N} phases scouted, {M} files inventoried"`

**Bounds:** max 3 tool calls per phase scout, max 7 phases scouted total. If scout exceeds bounds, prioritize phases with highest risk or most file overlap.

**Skip if:** `planning_mode` is not `deep`.

### 3i. Parallel Mode (conditional: `planning_mode = parallel`)

After writing all phase files (section 3c), analyze ownership boundaries:

1. For each phase file, identify which files/dirs it modifies → assign `ownership` globs.
2. Group phases with zero file overlap into parallel groups (max 3 groups).
3. Setup/infrastructure phase → Group 0 (always sequential, runs first).
4. Integration/test/docs phase → final group (always sequential, runs last).
5. Add `ownership` and `parallel_group` fields to each phase file's YAML frontmatter.
6. Append `## Execution Strategy` section to plan.md after the Phases table:

```markdown
## Execution Strategy

| Group | Phases | Parallel? | Ownership |
|-------|--------|-----------|-----------|
| Setup | 1 | Sequential (first) | {infra globs} |
| A | 2, 3 | Yes | {phase globs} |
| B | 4 | Sequential (after A) | tests/*, docs/* |
```

See `references/parallel-mode.md` for full rules and templates.

### 3j. Two-Approach Mode (conditional: `planning_mode = two`)

Instead of writing plan.md and phase files directly:

1. Generate `{plan_dir}/plan-approach-a.md` and `{plan_dir}/plan-approach-b.md` using the approach template from `references/two-approach-mode.md`.
2. Generate `{plan_dir}/trade-off-matrix.md` comparing both approaches.
3. **Do NOT generate plan.md or phase-XX files yet** — deferred until user selects approach at step-04.
4. Create `{plan_dir}/archived/` directory (empty, ready for non-selected approach).

Print: `"Two approaches drafted. User selects at step-04 before red-team."`

## Output

- `plan_dir` — absolute path to the created plan directory
- Print: `"Plan: {plan_dir}/plan.md ({N} phases)"` (parallel/hard mode)
- Print: `"Two approaches drafted. User selects at step-04 before red-team."` (two mode)

## Next

Read and follow `step-04-semantic-checks.md`
