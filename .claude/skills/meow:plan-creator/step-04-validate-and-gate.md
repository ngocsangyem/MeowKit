# Step 4: Validate + Gate 1

Semantic quality checks, validation interview (hard mode), and Gate 1 presentation.

## Instructions

### 4a. Semantic Content Checks (All Modes)

Check the plan.md and fix inline if any fail:

| Check | Pass | Fail (fix it) |
|-------|------|---------------|
| Goal is outcome | "Users can log in with OAuth" | "Implement OAuth flow" → rewrite |
| ACs are binary | `- [ ] Login returns JWT token` | "Code is clean" → make specific |
| Constraints non-empty | Has ≥1 constraint | Empty → add "MUST preserve existing tests" |
| ≥1 risk identified | Risk table has entries | Empty → add at least 1 risk |
| plan.md ≤80 lines | Under limit | Over → move detail to phase files |

### 4b. Structural Validation

Run the validation script:
```bash
.claude/skills/.venv/bin/python3 .claude/skills/meow:plan-creator/scripts/validate-plan.py {plan_dir}/plan.md
```

Must output `PLAN_COMPLETE`. Fix reported issues before proceeding.

### 4c. Plan Red Team (Hard Mode Only)

**Skip if:** `planning_mode = fast`.

Adversarial review of the plan using v1.3.1 personas. Runs BEFORE validation interview (find flaws first, then confirm decisions).

**Persona selection:** 2 personas most relevant for plan quality:
- **Assumption Destroyer** — finds unstated assumptions, unvalidated inputs, fragile dependencies
- **Scope Complexity Critic** — finds over-engineering, YAGNI violations, scope creep

**Dispatch each persona as a subagent with this context:**

```
# Adversarial Plan Review: {Persona Name}

## Your Role
{load from meow:review/prompts/personas/{persona}.md}

## Plan Under Review
{plan.md content + all phase-XX file contents}

## Semantic Check Results
{results from step 4a}

## Your Mission (Plan-Specific)
1. Find architectural flaws, unstated assumptions, scope issues in the PLAN
2. Output format: [SEVERITY] [SECTION] [CATEGORY] [DESCRIPTION]
   - SECTION = "plan.md" or "phase-XX-name.md: {section name}"
3. Max 5 findings per persona (10 total)
4. Focus on: Will this plan SUCCEED? What breaks at implementation time?
```

**After findings collected (max 10):**
1. Present findings to user via AskUserQuestion: "Accept" or "Reject" each finding
2. Accepted findings → update affected phase file's Key Insights or Risk Assessment
3. Document: `"Red team: {N} findings, {M} accepted"`

### 4d. Validation Interview (Hard Mode Only)

**Skip if:** `planning_mode = fast`. Note: validation interview now runs AFTER red team — questions are informed by red-team findings.

Generate 3-5 critical questions from the plan content. Question categories:

1. **Architecture** — "Why {approach} instead of {alternative}?"
2. **Assumptions** — "The plan assumes {X}. Is this correct?"
3. **Scope** — "Phase {N} includes {Y}. Is this in scope or should it be deferred?"
4. **Risk** — "What happens if {risk} materializes?"
5. **Tradeoffs** — "This approach trades {A} for {B}. Is that acceptable?"

Present via AskUserQuestion:
```json
{
  "questions": [{
    "question": "{generated question}",
    "header": "Plan Validation ({N} of {total})"
  }]
}
```

After answers: propagate to affected phase files:
- Update "Key Insights" with user's clarification
- Update "Risk Assessment" if risk tolerance changed
- Note: `"Validated: {answer summary}" in phase overview`

### 4e. Gate 1 Presentation

Self-check before presenting:
1. **Completed:** list what's done
2. **Skipped:** list what was intentionally skipped (with justification)
3. **Uncertain:** list items the agent is unsure about

Present plan for approval. Load `references/gate-1-approval.md` for the exact AskUserQuestion format and Context Reminder block.

**On Approve:** Update Agent State, print cook command with absolute path → STOP.
**On Modify:** Apply changes, re-validate, present again.
**On Reject:** Ask for new requirements, restart from step-00.

## Output

- Gate 1 verdict: approved | modified | rejected
- Print Context Reminder with cook command (on approval)

## Next

If approved → read and follow `step-05-hydrate-tasks.md`
