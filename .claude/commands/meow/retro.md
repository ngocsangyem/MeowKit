# /retro — Sprint Retrospective

## Usage

```
/retro [optional: sprint name or date range]
```

## Behavior

Generates a sprint retrospective by analyzing git history, review findings, and accumulated lessons.

### Execution Steps

1. **Analyze git log for the period.** If a date range or sprint name is provided, scope to that period. Otherwise, use the last 2 weeks. Extract:
   - Commits by author
   - Branches merged
   - Files most frequently changed

2. **Summarize activity:**
   - Features shipped (from `feat:` commits)
   - Bugs fixed (from `fix:` commits)
   - PRs merged (count and titles)
   - Review findings (from verdict files in `tasks/reviews/`)
   - Security issues found and resolved

3. **Read topic files in `.claude/memory/` for patterns.** Load `fixes.md`, `review-patterns.md`, and `architecture-decisions.md`. Look for:
   - Recurring issues (same type of bug appearing multiple times)
   - Process friction points noted in lessons
   - Things that were learned and applied (or not applied)

4. **Generate retro report** with three sections:

   **What went well:**
   - Features delivered on time
   - Clean reviews (all PASS)
   - Good test coverage
   - Lessons applied from previous retros

   **What didn't go well:**
   - Bugs that escaped to production
   - Review findings that could have been caught earlier
   - Repeated issues across topic files that weren't addressed
   - Slow areas (long time between plan and ship)

   **Action items:**
   - Specific, actionable improvements
   - Assign to a person or process
   - Include deadline or trigger condition

5. **Propose process improvements.** Based on patterns observed, suggest concrete changes to the workflow, rules, or tooling.

6. **Write report to:**
   ```
   docs/retros/YYMMDD-retro.md
   ```

### Output

Retrospective report at `docs/retros/YYMMDD-retro.md` with: activity summary, what went well, what didn't, action items, and process improvement proposals.
