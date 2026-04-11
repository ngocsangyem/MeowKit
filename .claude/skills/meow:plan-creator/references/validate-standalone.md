# Validate Standalone Subcommand

Subcommand: `/meow:plan validate {plan_path}`

Run a validation interview on an existing plan without going through the full planning pipeline.

## Trigger

Activated when argument starts with `validate` followed by a path to a plan directory or plan.md file.

Examples:
- `/meow:plan validate tasks/plans/260411-my-feature/`
- `/meow:plan validate tasks/plans/260411-my-feature/plan.md`

## Workflow

### V1. Resolve Plan Path

1. If path points to a directory, look for `plan.md` inside it
2. If path points to `plan.md`, use its parent as `plan_dir`
3. If plan.md doesn't exist at resolved path: print error → STOP
4. Set `plan_dir` to the absolute path of the plan directory

### V2. Read Plan Files

1. Read `plan.md` from `plan_dir`
2. Glob for `phase-*.md` files in `plan_dir`
3. Read all phase files
4. Check if `## Red Team Review` section exists in plan.md — if so, load findings to inform questions

### V3. Execute Step-06 Validation Interview

Follow the exact instructions in `step-06-validation-interview.md`, starting from section **6b** (skip the fast-mode check in 6a — standalone always runs):

- 6b: Generate 3-5 critical questions using `references/validation-questions.md` framework
  - Use detection keywords to identify relevant categories
  - If red-team findings exist, prioritize questions about flagged areas
- 6c: Present each question via AskUserQuestion (2-4 options, mark recommended)
- 6d: Propagate answers to phase files via section mapping
- 6e: Write Validation Log section to plan.md

### V4. Write Validation Log

Append `## Validation Log` section to plan.md (or update existing):

```markdown
## Validation Log

### Session — {YYYY-MM-DD}

### Q1: {full question text}
**Category:** {category}
**Options presented:** {list}
**Answer:** {selected option or custom text}
**Impact:** {which phase sections were updated}
```

### V5. Summary

Print:
```
Validation complete: {plan_dir}/plan.md
{N} questions asked, {M} phase files updated
```

## Rules

- This subcommand does NOT run red-team, semantic checks, or Gate 1
- It ONLY runs the validation interview (step-06)
- Answers are propagated directly to existing plan files
- Can be run multiple times on the same plan (new sessions append to Validation Log)
- Uses the enhanced validation question framework with detection keywords and section mapping
