# Step 8b: HTML Export (conditional)

Conditional step. Runs ONLY when `html_mode = true` — which means the structured
visual pipeline already ran and produced a Gate-1-approved `visual-plan/plan.json`.
This step exports that approved artifact to a single shareable `{plan_dir}/plan.html`
via `mewkit visual-plan export --format html` — no independent prose re-inference,
no separate renderer. Fail-open: an export failure never strands the session; it
always proceeds to step-09.

## Contents

- This step delegates to: the `mewkit visual-plan export` CLI (the canonical `plan.html`).
- It reads the durable Gate-1 record from: `{plan_dir}/plan.md` frontmatter.
- Next step: `step-09-post-plan-handoff.md`.

## Inputs

- `html_mode` (from step-00 composable-flag detection)
- `plan_dir` (absolute path, from step-03)

## Instructions

### 8b-a. Mode Guard

If `html_mode != true` → skip this step entirely; read and follow
`step-09-post-plan-handoff.md`. Do nothing else.

### 8b-b. Gate-1 Durable Re-Check

Render only an APPROVED plan. Do NOT trust an in-session "approved" variable — a
context reset between Gate 1 and this step would lose it. Read the durable Gate-1
record that step-07 wrote to `{plan_dir}/plan.md` frontmatter:

- `approved_by: human` AND `validation: approved` → Gate 1 is approved; proceed to 8b-c.
- Either field missing or not approved → do NOT render. Print
  `Skipping HTML render — plan is not Gate-1 approved.` and read and follow
  `step-09-post-plan-handoff.md`.

Never resolve the plan from `session-state/active-plan`; always use the explicit
absolute `plan_dir` passed from step-03.

### 8b-c. Export from the approved artifact

Export with the explicit absolute plan directory:

```
mewkit visual-plan export {plan_dir} --format html
```

Pass `{plan_dir}` verbatim (absolute). This writes `{plan_dir}/plan.html` from the
approved `visual-plan/plan.json` — self-contained, escaped, and re-sanitized. Do not
auto-open it for the user.

### 8b-d. Self-Check (path equality)

Confirm the export landed exactly where expected:

- Assert `{plan_dir}/plan.html` exists and is non-empty.
- The path MUST equal `{plan_dir}/plan.html` — not a `visuals/` subpath, not the
  active-plan default.

On success, print `✓ Exported {plan_dir}/plan.html`.

### 8b-e. Fail-Open

If the export command errors, times out, or `{plan_dir}/plan.html` is absent after it
returns:

- Do NOT retry in a loop and do NOT block the session.
- Write a marker file `{plan_dir}/.html-failed` containing a one-line reason.
- Print `HTML export failed (continuing) — see {plan_dir}/.html-failed`.
- Proceed to step-09 unchanged.

The handoff in step-09 is never gated on this export. Full contract:
`references/visual-plan-integration.md` §9.

## Output

- On success: `{plan_dir}/plan.html` exists; success line printed.
- On skip: advisory line printed; no file written.
- On failure: `{plan_dir}/.html-failed` marker written; advisory line printed.

## Next

Read and follow `step-09-post-plan-handoff.md`.
