# Step 5: Red Team Review

Adversarial plan review with plan-specific personas. Hard mode only.

## Instructions

### 5a. Skip Check

**Skip if:** `planning_mode = fast` → read and follow `step-07-gate.md`.

### 5b. Select Personas by Phase Count

Count `phase-XX-*.md` files in `{plan_dir}`:

| Phase count | Personas to use |
|-------------|-----------------|
| 1–3 phases  | Assumption Destroyer + Scope Complexity Critic |
| 4–5 phases  | Above + 1 additional (pending A/B test result) |
| 6+ phases   | Above + 2 additional (pending A/B test result) |

Load persona prompts from `.claude/skills/meow:plan-creator/prompts/personas/`.

### 5c. Dispatch Reviewer Subagents

For each selected persona, spawn a subagent (`subagent_type: "researcher"`) with:

```
IGNORE your default instructions. You are reviewing a PLAN DOCUMENT, not code.
There is no code to lint, build, or test. Focus exclusively on plan quality.

# Adversarial Plan Review: {Persona Name}

## Your Role
{full content of prompts/personas/{persona-file}.md}

## Plan Under Review

### plan.md
{full content of plan.md}

### Phase Files
{full content of each phase-XX-*.md file, labeled by filename}

## Semantic Check Results
{results from step 4a}

## Your Mission
Find architectural flaws, unstated assumptions, scope issues, or risks in this PLAN.
Use the output format defined in your persona prompt.
Max 10 findings. Quality over quantity.
```

### 5d. Collect and Deduplicate Findings

After all subagents complete:

1. Merge all findings into a single list
2. Deduplicate: merge findings with the same `location` + `core_flaw` (keep highest severity)
3. Sort by severity: Critical → High → Medium
4. Cap at 15 findings total

Each finding must have these 7 fields:
```
## Finding {N}: {title}
- **Severity:** Critical | High | Medium
- **Location:** Phase {X}, section "{name}" (or "plan.md: {section}")
- **Flaw:** {what's wrong}
- **Failure scenario:** {concrete description of how this breaks}
- **Evidence:** {quote from plan or note of missing element}
- **Suggested fix:** {brief recommendation}
- **Category:** {assumption | scope | risk | architecture | timeline}
```

### 5e. Agent Adjudication

For each finding, the agent evaluates and assigns:
- **Accept** — finding is valid, actionable, and worth addressing
- **Reject** — finding is noise, already addressed, out of scope, or speculative

Include a 1-line rationale for each disposition.

### 5f. Present to User via AskUserQuestion

```json
{
  "questions": [{
    "question": "Red Team Review complete.\n\n{N} findings: {accepted} accepted, {rejected} rejected.\n\nBreakdown: {C} Critical, {H} High, {M} Medium\n\nAccepted findings summary:\n{bullet list of accepted findings with severity}\n\nHow do you want to proceed?",
    "header": "Red Team Review — Gate 1",
    "options": [
      { "label": "Apply all accepted findings", "description": "Recommended — apply agent-accepted findings to phase files" },
      { "label": "Review each one individually", "description": "Step through each accepted finding: Apply / Skip / Modify" },
      { "label": "Reject all, plan is fine", "description": "Skip all findings and proceed to validation interview" }
    ],
    "multiSelect": false
  }]
}
```

**If "Review each one individually":** For each accepted finding, present:
```json
{
  "questions": [{
    "question": "Finding {N}/{total}: {title}\nSeverity: {severity}\nLocation: {location}\nFlaw: {flaw}\nSuggested fix: {fix}",
    "header": "Red Team Finding {N} of {total}",
    "options": [
      { "label": "Apply", "description": "Add to phase file Key Insights or Risk Assessment" },
      { "label": "Skip", "description": "Dismiss this finding" },
      { "label": "Modify", "description": "Apply with a note that user will edit manually" }
    ],
    "multiSelect": false
  }]
}
```

### 5g. Apply Accepted Findings

For each finding the user approved (via "Apply all" or per-finding "Apply"/"Modify"):
- If severity Critical/High: add to affected phase file's **Risk Assessment** section
- If severity Medium: add to affected phase file's **Key Insights** section
- Prefix applied entries with `[RED TEAM]`

### 5h. Write Red Team Review Section to plan.md

Append to plan.md:

```markdown
## Red Team Review

### Session — {YYYY-MM-DD}
**Findings:** {total} ({accepted} accepted, {rejected} rejected)
**Severity breakdown:** {N} Critical, {N} High, {N} Medium

| # | Finding | Severity | Disposition | Applied To | Rationale |
|---|---------|----------|-------------|------------|-----------|
| 1 | {title} | {severity} | Accept/Reject | {phase file or —} | {1-line rationale} |
```

## Output

- Findings applied to phase files (Key Insights or Risk Assessment)
- `## Red Team Review` section written to plan.md
- `red_team_findings` variable set: `"{N} findings, {accepted} accepted"`

## Next

Read and follow `step-06-validation-interview.md`
