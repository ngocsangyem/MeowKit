# Step 3: Triage

Categorize findings to separate signal from noise. Only current-change findings block shipping.

## Categories

### current-change
Finding is directly caused by or related to the current diff.
**Action:** Must be addressed before Gate 2 approval.

### incidental
Finding exists in code touched by the diff but is NOT caused by the current change.
Pre-existing tech debt, style inconsistencies, or unrelated issues.
**Action:** Log to `memory/review-backlog.md` for future addressing. Does NOT block Gate 2.
Create the file if it doesn't exist.

## Triage Rules

1. If the finding references a line ADDED in the diff → `current-change`
2. If the finding references a line MODIFIED in the diff → `current-change`
3. If the finding references unchanged code in a changed file → `incidental`
4. If the finding is about missing tests for NEW functionality → `current-change`
5. If the finding is about missing tests for EXISTING functionality → `incidental`
6. CRITICAL severity findings are ALWAYS `current-change` regardless of above rules

## Dedup

If multiple reviewers flag the same issue (same file, same line, same category):
- Keep the highest severity version
- Note "confirmed by N reviewers" (higher confidence)

## Output

Two lists:
1. **Current-change findings** — ordered by severity (CRITICAL first)
2. **Incidental findings** — for backlog

## Next

Read and follow `step-04-verdict.md`
