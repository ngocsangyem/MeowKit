# Step 1: Gather Context

## Instructions

1. **Load the diff** — Run `git diff` against the base branch (typically `main`). If no base branch, use the last commit.
2. **Load the plan** — Find the active plan file from `tasks/plans/`. If no plan exists (e.g., `/meow:fix --simple`), note "no plan — code-only review."
3. **Extract acceptance criteria** — From the plan's "Success Criteria" or "Acceptance Criteria" section. If no plan, skip.
4. **Identify changed files** — List all files in the diff with change type (added/modified/deleted).
5. **Check for security-relevant changes** — Flag files matching: `*auth*`, `*payment*`, `*session*`, `*token*`, `*secret*`, `*password*`, `*encrypt*`, `*.env*`.

## Output

Store gathered context for use by reviewers:
- `diff_content` — Full git diff
- `changed_files` — List of changed files with types
- `plan_ac` — Acceptance criteria list (empty if no plan)
- `security_relevant` — Boolean, true if security files detected

## Next

Read and follow `step-02-parallel-review.md`
