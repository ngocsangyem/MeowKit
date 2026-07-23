# Step 7: Gate 1

Self-check and Gate 1 presentation for human approval.

## Instructions

### 7a. Self-Check Before Presenting

State each category explicitly:

1. **Completed:** list what was done (semantic checks, structural validation, red team, interview)
2. **Skipped:** list what was intentionally skipped with justification (e.g., "Red team — fast mode")
3. **Uncertain:** list items the agent is unsure about (empty if none)

### 7b. Present Gate 1

Load `references/gate-1-approval.md` for the exact stop and ask the user in chat format and Context Reminder block.

Present the plan for approval via `stop and ask the user in chat`. Header: "Gate 1: Plan Approval". Question text composes the self-check summary, plan path, phase count, and mode:

> Gate 1 — Plan Ready for Approval
>
> {self-check summary}
>
> Plan: {plan_dir}/plan.md
> Phases: {N} phase files
> Mode: {planning_mode}
> Autonomy Boundaries: {one-line summary of the Always / Ask-first latitude}   ← include ONLY when plan.md has an `## Autonomy Boundaries` block (long-horizon plans)
>
> All checks passed. Ready to proceed?

For long-horizon plans that carry an `## Autonomy Boundaries` block, note in the question that the user may adjust the Always / Ask-first latitude before approving; capture any adjustment into plan.md (and the Agent State / memory capture in 7c) on Approve/Modify. Omit the line entirely for fast / trivial / single-phase plans that have no block.

Single-select.

| Option | Recommend When | Why |
|--------|----------------|-----|
| Approve | Self-check has zero Uncertain items and no Skipped item flags correctness risk | Plan is good — proceeds to task hydration |
| Modify | Minor changes needed before approval | Apply changes, re-validate, present again |
| Reject | Requirements have fundamentally changed | Restart from step-00 with new requirements |

### 7v. Visual Preconditions (gated: `html_mode == true`)

When `html_mode == true`, Gate 1 additionally requires an APPROVED visual artifact:
artifact exists; schema+security valid; `uiCoverage.summary.unresolved == 0`; every
frame complete; refs resolve; source hashes fresh; current revision reviewed; no
pending feedback batch. Surface these in the 7a self-check. Full list:
`references/visual-plan-integration.md` §7.

- `html_mode == false` (the default) → no visual precondition; Gate 1 unchanged.

### 7c. Handle Decision

**On Approve:**
- Update Agent State in plan.md: `Approved by: human`, `Validation: approved`
- **Visual approval (gated: `html_mode == true`):** run
  `mewkit visual-plan approve {plan_dir} --revision <n>` (n = artifact's current
  revision). The CLI is the single writer of `review.status`. Non-zero exit ⇒ a
  precondition failed ⇒ do NOT proceed to step-08; print the failed preconditions and
  return to Modify. When `html_mode == false`, skip this call.
- **Memory capture** (lightweight, no sub-task): append the decision to the CANONICAL
  store `.meowkit/memory/architecture-decisions.json` — NOT the `.md` view (a `.md` write is
  invisible to JSON-first readers; see `.agents/skills/rule-memory-read-rules.md` → Write Rules).
  Add an entry to the `patterns` array (create the file with the v2.0.0 skeleton if absent),
  bump `metadata.last_updated`, and never touch `version`. The entry body:
  ```
  id: {plan-dir-name}
  type: decision
  pattern: {1-2 sentence summary of the architectural / scope choices}
  context: mode={planning_mode}, scope={scope_mode}, model={workflow_model}, tdd={tdd_mode}; red-team accepted {N}
  date: {YYYY-MM-DD}
  ```
  (Match the canonical entry shape `immediate-capture-handler.cjs` writes: `type` + `pattern` + `context` — the recompute/render layers scan `pattern`/`context`, not a `decision` key.)
  If the write fails, print a one-line notice (`⚠ memory capture skipped: <reason>`) — do
  NOT skip silently (Write Rules: no silent skip).
- Print Context Reminder block (from `references/gate-1-approval.md`) with absolute path to plan.md
- Proceed to step-08

**On Modify:**
- Apply requested changes inline
- Re-run semantic checks (step-04 4a)
- Re-run structural validation (step-04 4b)
- Present Gate 1 again

**On Reject:**
- Ask user for new or revised requirements
- Restart from `step-00-scope-challenge.md`

## Output

- Gate 1 verdict: approved | modified | rejected
- Context Reminder printed (on approval) with cook command and absolute path

## Next

If approved → read and follow `step-08-hydrate-tasks.md`
