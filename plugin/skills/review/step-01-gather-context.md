# Step 1: Gather Context

## Instructions

1. **Load the diff** — Run `git diff` against the base branch (typically `main`). If no base branch, use the last commit.
2. **Load the plan** — Find the active plan file from `tasks/plans/`. If no plan exists (e.g., `/mk:fix --simple`), note "no plan — code-only review."
3. **Extract acceptance criteria** — From the plan's "Success Criteria" or "Acceptance Criteria" section. If no plan, skip.
3a. **Load red-team findings (supplementary)** — If reviewing implementation against a plan, check for `red-team-findings.md` in the plan directory (e.g., `tasks/plans/YYMMDD-name/red-team-findings.md`). If present, load it as supplementary context: it contains plan-level adversarial findings from an earlier red-team pass (attack surfaces, design risks, scope concerns). During review, check whether the implementation addresses the flagged issues. Skip silently if the file does not exist — its absence is normal.
4. **Identify changed files** — List all files in the diff with change type (added/modified/deleted).
5. **Check for security-relevant changes** — Flag files matching: `*auth*`, `*payment*`, `*session*`, `*token*`, `*secret*`, `*password*`, `*encrypt*`, `*.env*`.
6. **Assess review scope** — Determine `review_scope` and `domain_complexity` (see Scope Assessment below).

## Scope Assessment

Determine whether this diff warrants the full adversarial review tier or a minimal pass.

### Constants (tunable)

- `SCOPE_GATE_MAX_FILES = 3`
- `SCOPE_GATE_MAX_LINES = 50`

### Logic

1. Count `file_count` (number of changed files in diff)
2. Count `line_count` (total added + removed lines in diff)
3. Check `security_file_touched` (from step 5 above)
4. Check `domain_complexity` — if `mk:scale-routing` data is available, scan the diff file paths and plan description for domain keywords. Use the highest matching complexity level. If no match or scale-routing unavailable, set to `unknown`.

### Decision

Set `review_scope = full` if ANY of the following are true:
- `file_count > SCOPE_GATE_MAX_FILES`
- `line_count > SCOPE_GATE_MAX_LINES`
- `security_file_touched == true`
- `domain_complexity == high`

Otherwise, set `review_scope = minimal`.

### Document

Print: `Scope gate: {minimal|full} — files:{N}, lines:{N}, security:{yes|no}, domain:{level}`

## Output

Store gathered context for use by reviewers:
- `diff_content` — Full git diff
- `changed_files` — List of changed files with types
- `plan_ac` — Acceptance criteria list (empty if no plan)
- `security_relevant` — Boolean, true if security files detected
- `review_scope` — `minimal` or `full` (from Scope Assessment)
- `domain_complexity` — `low`, `medium`, `high`, or `unknown` (from Scope Assessment)
- `red_team_findings` — Contents of `red-team-findings.md` if present; `null` if absent (silently skipped)

## Next

Read and follow `step-02-parallel-review.md`
