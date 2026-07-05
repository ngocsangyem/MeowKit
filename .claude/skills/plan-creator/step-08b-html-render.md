# Step 8b: HTML Render (conditional)

Conditional step. Runs ONLY when `html_mode = true`. Renders the approved, hydrated
plan into a single shareable `plan.html` by delegating to `mk:visual-plan`. No new
renderer lives here — this step only gates and delegates. Fail-open: a render failure
never strands the session; it always proceeds to step-09.

## Contents

- This step delegates to: `mk:visual-plan` (the `plan.html` owner).
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

### 8b-c. Delegate to mk:visual-plan

Invoke the render with the explicit absolute plan directory:

```
mk:visual-plan {plan_dir}
```

Pass `{plan_dir}` verbatim (absolute). This produces `{plan_dir}/plan.html`.

`--html` is opt-in; the rendered page pulls Mermaid from a pinned CDN. Do not
auto-open it for the user.

### 8b-d. Self-Check (path equality)

Confirm the render landed exactly where expected:

- Assert `{plan_dir}/plan.html` exists and is non-empty.
- The rendered path MUST equal `{plan_dir}/plan.html` — not a `visuals/` subpath,
  not the active-plan default.

On success, print `✓ Rendered {plan_dir}/plan.html`.

If `{plan_dir}/research/prototype-flow.json` exists, `mk:visual-plan` also writes a companion
`{plan_dir}/prototype-flow.html` (interactive flow explorer). When present, report BOTH paths
in the handoff so the reviewer sees the flow explorer alongside the plan.

### 8b-e. Fail-Open

If `mk:visual-plan` errors, times out, or `{plan_dir}/plan.html` is absent after it
returns:

- Do NOT retry in a loop and do NOT block the session.
- Write a marker file `{plan_dir}/.html-failed` containing a one-line reason.
- Print `HTML render failed (continuing) — see {plan_dir}/.html-failed`.
- Proceed to step-09 unchanged.

The handoff in step-09 is never gated on this render.

## Output

- On success: `{plan_dir}/plan.html` exists; success line printed.
- On skip: advisory line printed; no file written.
- On failure: `{plan_dir}/.html-failed` marker written; advisory line printed.

## Next

Read and follow `step-09-post-plan-handoff.md`.
