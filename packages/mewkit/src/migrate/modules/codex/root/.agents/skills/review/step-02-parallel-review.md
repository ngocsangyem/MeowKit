# Step 2: Parallel Review (Phase A)

Fan out reviewers based on `review_scope` from step-01.

## Scope-Based Dispatch

### If `review_scope = minimal`

Run **Blind Hunter only**. Skip Edge Case Hunter and Criteria Auditor.
This is appropriate for trivial diffs (few files, few lines, no security files, non-high domain).
Document: `"Scope=minimal: adversarial tier skipped (diff below threshold)"`

### If `review_scope = full`

Run **all 3 reviewers** in parallel (existing behavior).

## Reviewers

### 1. Blind Hunter
**Prompt:** `prompts/blind-hunter.md`
**Receives:** ONLY the diff. No plan, no spec, no project context.
**Purpose:** Catch what's obviously wrong without bias from intent.
**Runs in:** Both `minimal` and `full` scope.

### 2. Edge Case Hunter
**Prompt:** `prompts/edge-case-hunter.md`
**Receives:** Diff + function signatures + type definitions.
**Purpose:** Exhaustively trace boundaries, nulls, error paths.
**Runs in:** `full` scope only.

### 3. Criteria Auditor
**Prompt:** `prompts/criteria-auditor.md`
**Receives:** Diff + plan acceptance criteria.
**Purpose:** Verify every AC maps to implementation and is tested.
**Runs in:** `full` scope only. Also skip if no plan exists (code-only review).

## Execution

Run the selected reviewers. Each produces a findings list in this format:

```
[SEVERITY] [FILE:LINE] [CATEGORY] [DESCRIPTION]
```

Severity: CRITICAL | MAJOR | MINOR
Category: bug | security | logic | boundary | coverage | naming | performance

## Output

Collect all findings from active reviewers into a unified findings list.
Tag each finding with its source reviewer.

Store `base_findings_summary` — a condensed version of all Phase A findings (one line per finding: severity, file:line, category, description). This summary is used by Phase B persona passes (step-02b) if `review_scope = full`.

## Next

If `review_scope = full`, read and follow `step-02b-persona-passes.md`.
If `review_scope = minimal`, skip step-02b and read `step-03-triage.md`.
