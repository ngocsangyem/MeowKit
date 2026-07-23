# Step 5: Red Team Review

Adversarial plan review with plan-specific personas. Runs in hard/deep/parallel/two modes (skipped in fast).

## Instructions

### 5a. Skip Check

**Skip if:** `planning_mode = fast` → read and follow `step-07-gate.md`.

### 5b. Select Personas by Phase Count

Count `phase-XX-*.md` files in `{plan_dir}`:

| Phase count | Personas to use |
|-------------|-----------------|
| 1–3 phases  | Assumption Destroyer + Scope Complexity Critic |
| 4–5 phases  | Above + Security Adversary |
| 6+ phases   | Above + Security Adversary + Failure Mode Analyst |

Load persona prompts from `.agents/skills/plan-creator/prompts/personas/`.

### 5c. Dispatch Reviewer sub-task

For each selected persona, spawn a sub-task (`subagent_type: "researcher"`) with:

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

After the findings list, emit ONE `**Cross-persona blind spot:**` line per the "Cross-Persona Blind Spot" section in your persona prompt. Use `None observed.` if you cannot identify one — do NOT fabricate.
```

### 5d. Collect and Deduplicate Findings

After all sub-task complete:

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
- **Category:** {assumption | scope | risk | architecture | timeline | cross-cutting}
```

### 5d.5 Cross-Persona Blind Spot Aggregation

Each persona was instructed to emit ONE `**Cross-persona blind spot:**` line after their findings list — naming a dimension OUTSIDE their specialty that they suspect the other reviewers may also miss. This sub-step processes those lines.

1. **Collect** each persona's `**Cross-persona blind spot:**` value (the line is OUTSIDE the findings list, not deduped in 5d).
2. **Detect convergence:** if 2+ personas independently named overlapping dimensions (matching by topic, not exact wording — e.g., "no observability story" + "no metrics/logging" converge on observability), promote to a NEW finding:
   - **Severity:** `High` (default — 2+ specialized reviewers agreeing on a gap is a stronger signal than any single-lens finding; orchestrator may downgrade only if the dimension is genuinely minor).
   - **Category:** `cross-cutting`
   - **Location:** `plan.md` if cross-cutting; or affected phase(s) by best-guess.
   - **Flaw:** paraphrased convergent blind-spot description.
   - **Failure scenario:** orchestrator-derived from the convergent text.
   - **Evidence:** `Independently noted by {persona-A}, {persona-B}: '{quote-A}', '{quote-B}'` (always include raw quotes, do not paraphrase Evidence).
   - **Suggested fix:** "Add explicit treatment in {affected section(s)}; or run a focused review on this dimension."
3. **Single-persona observations:** if only 1 persona named a unique blind spot, record it as a "noted concern" — visible in the final report (5h) but NOT pushed into phase files and NOT counted in finding totals.
4. **All-clear case:** if all personas output `None observed.`, record `Cross-persona blind spots: none` in the summary; no findings added.
5. **Re-cap if needed:** if the cross-cutting promotions push total findings past 15, re-trim the lowest-severity Medium findings first; never drop a promoted cross-cutting High.

### 5e. Agent Adjudication

For each finding, the agent evaluates and assigns:
- **Accept** — finding is valid, actionable, and worth addressing
- **Reject** — finding is noise, already addressed, out of scope, or speculative

Include a 1-line rationale for each disposition.

**Guard:** a finding that proposes cutting an item marked `locked: user-confirmed` must be escalated to the user in 5f — never auto-accepted or silently applied.

### 5f. Present to User via stop and ask the user in chat

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

### 5h. Write Red Team Findings Report File

Write the **full detailed findings** to a separate file: `{plan_dir}/red-team-findings.md`

```markdown
# Red Team Findings — {YYYY-MM-DD}

**Plan:** {plan_dir}/plan.md
**Personas used:** {list of personas}
**Findings:** {total} ({accepted} accepted, {rejected} rejected)
**Severity breakdown:** {N} Critical, {N} High, {N} Medium
**Cross-persona blind spots:** {N promoted to findings, M noted concerns, K personas reported "None observed"}

---

## Finding 1: {title}
- **Severity:** {Critical | High | Medium}
- **Location:** {Phase X, section "name"}
- **Flaw:** {full description}
- **Failure scenario:** {detailed scenario}
- **Evidence:** {quote from plan or missing element}
- **Suggested fix:** {recommendation}
- **Category:** {assumption | scope | security | reliability | architecture | cross-cutting}
- **Disposition:** {Accept | Reject} — {rationale}
- **Applied to:** {phase file path or "—"}

## Finding 2: {title}
...

---

## Cross-Persona Blind Spot Pass

**Promoted to findings:** {N convergent blind spots — see findings list above with `Category: cross-cutting`}
**Noted concerns (single-persona):** {M items — recorded for visibility, not applied to phase files}

| Persona | Blind spot |
|---------|------------|
| Assumption Destroyer | {raw text from persona, or "None observed"} |
| Scope/Complexity Critic | {raw text from persona, or "None observed"} |
| Security Adversary | {raw text from persona, or "None observed"} |
| Failure Mode Analyst | {raw text from persona, or "None observed"} |

### Noted Concerns (single-persona observations)

- **{persona}:** {blind-spot text} — _not promoted; no convergent second voice_
- ... (omit this sub-section entirely if no noted concerns)
```

This file preserves the full evidence and reasoning. It can be re-read by future red-team sessions or referenced during implementation.

### 5i. Write Red Team Review Summary to plan.md

Append a **summary section** to plan.md that links to the full report:

```markdown
## Red Team Review

### Session — {YYYY-MM-DD}
**Findings:** {total} ({accepted} accepted, {rejected} rejected)
**Severity breakdown:** {N} Critical, {N} High, {N} Medium
**Cross-persona blind spots:** {N promoted, M noted}
**Full report:** [red-team-findings.md](red-team-findings.md)

| # | Finding | Severity | Disposition | Applied To | Rationale |
|---|---------|----------|-------------|------------|-----------|
| 1 | {title} | {severity} | Accept/Reject | {phase file or —} | {1-line rationale} |
```

If a `## Red Team Review` section already exists (from a previous session), append a new `### Session` subsection — don't overwrite. Similarly, if `red-team-findings.md` already exists, rename it to `red-team-findings-{YYMMDD-prev}.md` before writing the new one.

### 5j. Whole-Plan Consistency Sweep (Gate W1)

After accepted findings have been written into phase files (5g), the planner agent MUST run a Whole-Plan Consistency Sweep before handing off to step-06.

Algorithm: see `references/whole-plan-sweep.md` (stage-then-apply with read-only Pass 1, decision check, write Pass 2).

Inputs to this run:
- `delta_source = accepted_findings` (the list from 5e)
- `plan_dir` (from session state)

Outputs:
- `### Pending Sweep Edits` block appended to `{plan_dir}/red-team-findings.md` (staged before any write)
- `### Whole-Plan Consistency Sweep` summary block appended to `{plan_dir}/red-team-findings.md` (after Pass 2)
- plan.md frontmatter updated with `consistency_sweeps.red_team: { reconciled, unresolved, ran_at }`

If `unresolved > 0`, FIRE the W1 `stop and ask the user in chat` blocker (see decision tree in `references/whole-plan-sweep.md`). BLOCK step-06 until the user selects one of:

- "Apply pending edits and defer unresolved to validation interview" — proceed to step-06, mark deferred items in `## Validation Log`.
- "Apply pending edits and resolve now" — planner rewrites locally; recursion bounded at 2 attempts.
- "Skip sweep this round" — drop pending edits, proceed; record in red-team-findings.md that sweep was declined.

If `unresolved = 0`, proceed silently to step-06.

**Cancel safety.** If the user picks any "Skip" / "Cancel" option, Pass 2 does NOT execute. The "Pending Sweep Edits" block stays in red-team-findings.md as a record of what would have changed; phase files remain untouched by the sweep. Accepted-finding edits from 5g remain in place — only the sweep's reconciliations are reverted/skipped.

### 5v. Visual Coverage Challenge (gated: `html_mode == true`)

Skip when `html_mode == false`. Otherwise, in addition to the Markdown
red-team, challenge EVERY `planned`/`omitted` coverage classification in
`visual-plan/plan.json` against the step-02 `ui_evidence`: the validator guarantees
no structurally-unaccounted state but CANNOT detect a DISHONEST tag (a state marked
`omitted`/`planned` that is really a missing frame). Also challenge omitted roles /
flags / error paths that never became states. Any artifact/Markdown edit this
challenge triggers requires `mewkit visual-plan rehash` before Gate 1 (per §6v —
rehash clears prior approval). Detail: `references/visual-plan-integration.md` §5.

## Output

- `{plan_dir}/red-team-findings.md` — full detailed findings report (includes Cross-Persona Blind Spot Pass section), Pending Sweep Edits, and Whole-Plan Consistency Sweep summary
- Findings applied to phase files (Key Insights or Risk Assessment), including any promoted `cross-cutting` findings
- `## Red Team Review` summary section written to plan.md with cross-persona-blind-spot count and link to findings file
- plan.md frontmatter `consistency_sweeps.red_team` updated
- `red_team_findings` variable set: `"{N} findings, {accepted} accepted, {C} cross-persona promoted"`

## Next

Read and follow `step-06-validation-interview.md`
