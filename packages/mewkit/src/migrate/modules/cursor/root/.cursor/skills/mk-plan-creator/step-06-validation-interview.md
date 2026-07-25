# Step 6: Validation Interview

Critical questions to validate plan decisions with the user. Runs in hard/deep/parallel/two modes (skipped in fast).

## Instructions

### 6a. Skip Check

**Skip if:** `planning_mode = fast` → read and follow `step-07-gate.md`.

### 6b. Present Before Asking (recap — required)

**Present the plan back BEFORE the first question.** The user is about to make
decisions that rewrite phase files they may not have read since drafting. Asking
cold makes them reconstruct the plan from memory, and an answer given against a
misremembered plan silently propagates into the real one.

Emit this recap once, before any question:

```
Plan:     {plan_dir}/plan.md
Objective: {one sentence — what this plan delivers}
Scope:     {in scope} · NOT in scope: {out of scope}
Phases:    {N} ({phase-01 name} → {phase-0N name})
Top risks: {2-3 highest-severity items from the Risk Assessment / red-team findings}

I have {M} questions. Each one changes a specific section:
  1. {question topic} → {phase-XX §section}
  2. …
```

Naming the section each answer may change is the point of the recap, not
decoration: it is how the user knows what a "yes" costs before they say it.

**Every question must be self-contained.** Restate the decision, the plan's
current position, and the options inside the question itself. Do not write "as
discussed above" or "per the earlier question" — the user may answer after a
context reset, or days later, and a question that only makes sense in sequence is
unanswerable out of sequence.

**Ownership:** this step PRESENTS and RECORDS. The planner owns plan mutation
(6e propagates; 6f logs). The interviewer never edits a phase file directly —
one writer per artifact, per `orchestration-rules.md` file ownership.

### 6c. Generate Questions

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

### 6d. Present via stop and ask the user in chat

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

Group related questions (max 4 per stop and ask the user in chat call).

### 6e. Propagate Answers to Phase Files

After all answers received, use the **section mapping** from `references/validation-questions.md`:

- **Architecture** answers → phase `## Architecture` section
- **Assumptions** answers → phase `## Key Insights` (with "Validated:" prefix)
- **Scope** answers → plan.md `## Constraints` (In Scope / Out of Scope)
- **Risk** answers → phase `## Risk Assessment`
- **Tradeoffs** answers → phase `## Key Insights`

Also:
- Add note: `"Validated: {answer summary}"` in phase overview
- If an answer reveals scope change, update plan.md Constraints

### 6f. Write Validation Log

Append `## Validation Log` section to plan.md (or update existing). Follow recording rules from `references/validation-questions.md`:

```markdown
### Q{N}: {full question text}
**Category:** {category}
**Options presented:** {list all options}
**Answer:** {selected option or custom text}
**Rationale:** {user's reasoning if provided, or "—"}
**Impact:** {which phase sections were updated}
```

### 6g. Whole-Plan Consistency Sweep (Gate W2)

After answer propagation has edited phase files (6e) and the Validation Log has been written (6f), the planner agent MUST run a Whole-Plan Consistency Sweep before handing off to step-07.

Algorithm: see `references/whole-plan-sweep.md` (stage-then-apply).

Inputs to this run:
- `delta_source = propagated_answers` (the list from 6e)
- `plan_dir` (from session state)

Outputs:
- `### Pending Sweep Edits` block appended to `{plan_dir}/red-team-findings.md` if present, else inline at the bottom of plan.md `## Validation Log` (staged before any write)
- `### Whole-Plan Consistency Sweep — <ISO>` block appended to each affected phase file's `## Validation Log` section (create section if missing); the orchestrator performs ONE Edit per phase file
- plan.md frontmatter updated with `consistency_sweeps.validation: { reconciled, unresolved, ran_at }`

If `unresolved > 0`, FIRE the W2 `stop and ask the user in chat` blocker (see decision tree in `references/whole-plan-sweep.md`). BLOCK step-07 Gate 1 until the user selects one of:

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
