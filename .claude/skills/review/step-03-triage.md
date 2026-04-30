# Step 3: Triage

Categorize findings to separate signal from noise. Only current-change findings block shipping.

## Zero-Finding Check (Forced-Finding Protocol)

Before categorizing, check total findings count from all reviewers (Phase A + Phase B if applicable).

**If total findings = 0:**

1. **Re-analyze** — Re-run the highest-signal reviewer with an augmented prompt:
   - For code reviews: re-run **Edge Case Hunter** (or Blind Hunter if scope=minimal)
   - For plan reviews: re-run **Criteria Auditor**
   - Augmented prompt: *"Previous analysis found zero issues. Re-analyze with higher scrutiny. Look specifically for: boundary conditions, implicit assumptions, missing error handling, security surface, unvalidated inputs, resource leaks."*
2. **Cap at 1 re-analysis** — never re-analyze more than once. No infinite loops.
3. **If still 0:** Accept as genuinely clean. Add note to verdict: `"Zero-finding review (double-checked)"`.

**If total findings > 0:** Proceed to categorization below.

## Categories

### current-change
Finding is directly caused by or related to the current diff.
**Action:** Must be addressed before Gate 2 approval.

### incidental
Finding exists in code touched by the diff but is NOT caused by the current change.
Pre-existing tech debt, style inconsistencies, or unrelated issues.
**Action:** Log to `.claude/memory/review-backlog.md` for future addressing. Does NOT block Gate 2.
Create the file if it doesn't exist.

## Triage Rules

1. If the finding references a line ADDED in the diff → `current-change`
2. If the finding references a line MODIFIED in the diff → `current-change`
3. If the finding references unchanged code in a changed file → `incidental`
4. If the finding is about missing tests for NEW functionality → `current-change`
5. If the finding is about missing tests for EXISTING functionality → `incidental`
6. CRITICAL severity findings are ALWAYS `current-change` regardless of above rules

## Dedup

If multiple reviewers (including Phase B personas) flag the same issue (same file, same line, same category):
- Keep the highest severity version
- Note "confirmed by N reviewers" (higher confidence)
- Tag finding source: `[Phase A: reviewer-name]` or `[Phase B: persona-name]`

If a Phase B persona upgrades a Phase A WARN to FAIL:
- Keep the FAIL version with the persona's evidence
- Note: `"Upgraded from WARN by {persona}: {evidence}"`

## Output

Two lists:
1. **Current-change findings** — ordered by severity (CRITICAL first), with source tags
2. **Incidental findings** — for backlog

## Next

Read and follow `step-04-verdict.md`
