# Step 6: Validation Interview

Critical questions to validate plan decisions with the user. Runs in hard/deep/parallel/two modes (skipped in fast).

## Instructions

### 6a. Skip Check

**Skip if:** `planning_mode = fast` → read and follow `step-07-gate.md`.

### 6b. Generate Questions

Generate 3–5 critical questions from the plan content. Load the full question framework from
`references/validation-questions.md` — it defines:

- **Detection keywords** per category (scan plan content for keyword matches → prioritize matching categories)
- **Question format rules** (2-4 concrete options, mark recommended, "Other" is automatic)
- **Section mapping** (which phase section each category's answers propagate to)
- **Recording rules** (Validation Log format)

**Categories** (prioritize by detection keyword matches):

1. **Architecture** — keywords: database, schema, API, endpoint, microservice, cache, queue, service
2. **Assumptions** — keywords: assume, expect, should be, will be, always, never, guaranteed
3. **Scope** — keywords: MVP, defer, future, nice-to-have, optional, out of scope
4. **Risk** — keywords: risk, fail, break, downtime, migration, rollback, breaking change
5. **Tradeoffs** — keywords: tradeoff, versus, vs, alternative, simpler, technical debt

Note: if red-team findings were accepted in step-05, use them to inform questions —
focus on areas where assumptions or risks were flagged.

**Verification Log integration.** If `verification_tier` is set (step-04 sub-step 4d ran), read each phase's `## Verification Log` section. For each entry with verdict `FAILED` or `UNVERIFIED`, generate one candidate question using this template:

```
Verification flagged: {claim} → {verdict}.
Plan states: {plan-cited reference}.
Codebase observation: {what verification found, or 'not found'}.
Which is correct: the plan, the codebase, or neither?
```

FAILED claims rank above keyword-detected questions (they are higher-signal). Cap total interview questions at 5 regardless of source mix.

### 6c. Present via AskUserQuestion

Present each question with 2-4 concrete options (per format rules). Mark the recommended option.

```json
{
  "questions": [{
    "question": "{generated question based on plan content}",
    "header": "Plan Validation ({N} of {total})",
    "options": [
      { "label": "{Option A} (Recommended)", "description": "{brief rationale}" },
      { "label": "{Option B}", "description": "{brief rationale}" }
    ]
  }]
}
```

Group related questions (max 4 per AskUserQuestion call).

### 6d. Propagate Answers to Phase Files

After all answers received, use the **section mapping** from `references/validation-questions.md`:

- **Architecture** answers → phase `## Architecture` section
- **Assumptions** answers → phase `## Key Insights` (with "Validated:" prefix)
- **Scope** answers → plan.md `## Constraints` (In Scope / Out of Scope)
- **Risk** answers → phase `## Risk Assessment`
- **Tradeoffs** answers → phase `## Key Insights`

Also:
- Add note: `"Validated: {answer summary}"` in phase overview
- If an answer reveals scope change, update plan.md Constraints

### 6e. Write Validation Log

Append `## Validation Log` section to plan.md (or update existing). Follow recording rules from `references/validation-questions.md`:

```markdown
### Q{N}: {full question text}
**Category:** {category}
**Options presented:** {list all options}
**Answer:** {selected option or custom text}
**Rationale:** {user's reasoning if provided, or "—"}
**Impact:** {which phase sections were updated}
```

### 6f. Whole-Plan Consistency Sweep (Gate W2)

After answer propagation has edited phase files (6d) and the Validation Log has been written (6e), the planner agent MUST run a Whole-Plan Consistency Sweep before handing off to step-07.

Algorithm: see `references/whole-plan-sweep.md` (stage-then-apply).

Inputs to this run:
- `delta_source = propagated_answers` (the list from 6d)
- `plan_dir` (from session state)

Outputs:
- `### Pending Sweep Edits` block appended to `{plan_dir}/red-team-findings.md` if present, else inline at the bottom of plan.md `## Validation Log` (staged before any write)
- `### Whole-Plan Consistency Sweep — <ISO>` block appended to each affected phase file's `## Validation Log` section (create section if missing); the orchestrator performs ONE Edit per phase file
- plan.md frontmatter updated with `consistency_sweeps.validation: { reconciled, unresolved, ran_at }`

If `unresolved > 0`, FIRE the W2 `AskUserQuestion` blocker (see decision tree in `references/whole-plan-sweep.md`). BLOCK step-07 Gate 1 until the user selects one of:

- "Apply pending edits and resolve now" — planner rewrites locally; recursion bounded at 2 attempts.
- "Accept risk: proceed with unresolved contradictions (writes Risk rows + ## Validation Log)" — write a Risk Assessment row to each affected phase file referencing the deferred contradiction count; proceed.
- "Cancel approval, restart from step-04" — drop pending edits, jump back to step-04 for re-planning.

If `unresolved = 0`, proceed silently to step-07.

### 6v. Visual Propagation + Rehash + Studio Review (gated: `html_mode == true`)

Skip when `html_mode == false`. Otherwise:

- Propagate every UX decision from the interview to BOTH the Markdown AND
  `visual-plan/plan.json`.
- Any Markdown edit in steps 5/6 staled the artifact's pinned source hashes → run
  `mewkit visual-plan rehash {plan_dir}` then re-validate. **Rehash clears prior
  visual approval** — a stale review cannot ride refreshed bytes.
- **Step 6V review:** open the studio with `mewkit visual-plan edit {plan_dir}`
  (read-only `view` if no edits are expected) so the human reviews the current
  revision; the decision still transitions via `approve` at Gate 1.

Detail: `references/visual-plan-integration.md` §6.

## Output

- Phase files updated with validated decisions
- Risk assessments updated where applicable
- plan.md frontmatter `consistency_sweeps.validation` updated
- Affected phase files have `## Validation Log` with Whole-Plan Consistency Sweep block
- Visual artifact re-validated (and rehashed if Markdown changed) when `html_mode == true`

## Next

Read and follow `step-07-gate.md`
