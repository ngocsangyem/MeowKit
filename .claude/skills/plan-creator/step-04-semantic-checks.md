# Step 4: Semantic Checks

Semantic quality checks and structural validation. Runs in all modes.

## Instructions

### 4a. Semantic Content Checks (All Modes Except product-level)

Check the plan.md and fix inline if any fail:

| Check | Pass | Fail (fix it) |
|-------|------|---------------|
| Goal is outcome | "Users can log in with OAuth" | "Implement OAuth flow" → rewrite |
| ACs are binary | `- [ ] Login returns JWT token` | "Code is clean" → make specific |
| Constraints non-empty | Has ≥1 constraint | Empty → add "MUST preserve existing tests" |
| ≥1 risk identified | Risk table has entries | Empty → add at least 1 risk |
| plan.md ≤80 lines | Under limit | Over → move detail to phase files |

### 4a'. Product-Level Semantic Checks (conditional: `planning_mode = product-level`)

Product-level plans use a different schema (product spec, not phase plan). Run these checks instead of 4a:

| Check | Pass | Fail (fix it) |
|-------|------|---------------|
| Product Vision populated | 3-5 sentences, ambitious | Empty / single sentence → rewrite |
| Feature count ≥8 | `grep -c '^### [0-9]' plan.md` ≥ 8 | < 8 → expand feature set |
| Each feature has ≥2 user stories | "As a X, I want Y, so that Z" format, 2+ per feature | Missing → add |
| Each feature has ≥2 ACs | Binary, behavior-facing | Missing → add |
| No forbidden patterns | POSIX greps from step-03a §3a.5 return zero matches | Any match → rewrite feature at user-story level |
| Out-of-Scope populated | ≥2 anti-features with rationale | Empty → add |

Run the dedicated product-spec validator (same script invoked at step-03a §3a.5; running it twice is cheap and catches edits made between steps):

```bash
.claude/skills/plan-creator/scripts/check-product-spec.sh "{plan_dir}/plan.md"
```

Must exit 0 with `PRODUCT_SPEC_COMPLETE: N features, M user stories`. Fix any reported issues before proceeding to step-07.

### 4b. Structural Validation

Run the validation script:
```bash
.claude/skills/.venv/bin/python3 .claude/skills/plan-creator/scripts/validate-plan.py {plan_dir}/plan.md
```

Must output `PLAN_COMPLETE`. Fix reported issues before proceeding.

**Skip if:** `planning_mode = fast` — go directly to step-07-gate.md.

**Skip if:** `planning_mode = product-level` — the `validate-plan.py` script expects phase files and per-phase schema. Product-level plans have a different schema (product spec). Section 4a' above replaces 4b for this mode. Go directly to step-07-gate.md (step-05 red-team and step-06 validation interview are also skipped for product-level v1 — the spec is the deliverable, phase decomposition happens in `mk:harness`).

### 4c. Two-Approach Selection (conditional: `planning_mode = two`)

Run 4a and 4b semantic checks on BOTH `plan-approach-a.md` and `plan-approach-b.md`. Fix issues in each file independently. Then:

1. Read the `## Goal` line from each approach file for the summary.
2. Present via AskUserQuestion:

```json
{
  "questions": [{
    "question": "Select the implementation approach to proceed with",
    "header": "Approach Selection",
    "options": [
      { "label": "Approach A: {name from file}", "description": "{Goal line from plan-approach-a.md}" },
      { "label": "Approach B: {name from file}", "description": "{Goal line from plan-approach-b.md}" }
    ],
    "multiSelect": false
  }]
}
```

3. Based on user selection:
   - **Selected approach**: generate `plan.md` + `phase-XX-*.md` files from it (using templates in 3b/3c).
   - **Non-selected approach**: move file to `{plan_dir}/archived/`.
4. Set `selected_approach = "a"` or `"b"` in session state.
5. Print: `"Approach {X} selected. Archived non-selected. Proceeding to red-team."`

**Important:** Step-05 red-team reviews ONLY the selected approach's phase files.

## Output

- Semantic check results (pass/fail per row)
- `PLAN_COMPLETE` from validation script
- `selected_approach` set (two mode only)

## Next

If `planning_mode = fast` → read and follow `step-07-gate.md`
If `planning_mode = product-level` → read and follow `step-07-gate.md` (skip red-team + validation interview; phase decomposition is the harness's job)
Otherwise → read and follow `step-05-red-team.md`
