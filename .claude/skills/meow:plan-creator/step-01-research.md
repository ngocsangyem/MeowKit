# Step 1: Research (Hard Mode Only)

**Skip if:** `planning_mode = fast`. Go directly to `step-03-draft-plan.md`.

Spawn bounded researchers to investigate unknowns before planning.

## Instructions

### 1a. Determine Research Aspects

From the task description, identify 2 distinct research questions:
- Aspect A: typically technology/approach investigation
- Aspect B: typically existing codebase patterns or constraints

If only 1 aspect is unclear → spawn 1 researcher.
If task is well-understood → skip research, note "research skipped: familiar domain".

### 1b. Spawn Researchers (Max 2, Parallel)

For each researcher, use this prompt template:

```
Task: Investigate {specific aspect} for planning "{task description}"
Budget: Max 5 tool calls. Be focused, not exhaustive.
Output: Write findings to {plan-dir}/research/researcher-{N}-{topic}.md
Use meow:docs-finder for any library/API lookups.

Format (max 150 lines):
  ## Summary (3-5 bullets)
  ## Key Findings (numbered, with file:line references where applicable)
  ## Recommendations (what the planner should consider)
  ## Open Questions (uncertainties for user to clarify)
```

### 1c. Collect Report Paths

After researchers complete, collect the file paths:
- `{plan-dir}/research/researcher-01-{topic}.md`
- `{plan-dir}/research/researcher-02-{topic}.md`

Do NOT paste report content. Pass file paths to step-03.

## Constraints

- Max 2 researchers (token budget)
- Max 5 tool calls per researcher (prevents runaway exploration)
- Reports must be ≤150 lines (condensed findings, not raw exploration)
- Use `meow:docs-finder` for external docs (not raw WebSearch)

## Output

- `research_reports` — list of report file paths (0, 1, or 2)
- Print: `"Research: {N} reports saved to {plan-dir}/research/"`

## Next

Read and follow `step-02-codebase-analysis.md`
