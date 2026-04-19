# Pre-Landing Review, Design Review, and PR Comment Resolution (Steps 3.5 and 3.75)

## Step 3.5: Pre-Landing Review

Structural review is owned by `meow:review` at Gate 2 — ship does not re-run the full adversarial pipeline. Ship's pre-landing check is a lightweight diff-based pass only.

1. Run `git diff origin/<base>` to get the full diff (scoped to feature changes against the freshly-fetched base branch).

2. Apply the two-pass review via the prompts under `meow:review/prompts/` (blind-hunter for obvious issues, criteria-auditor for plan ACs). Load them JIT when needed.

## Design Review (delegated to meow:review)

Design review is delegated to `meow:review/references/design-review.md` — rubric-based, diff-scoped. Ship does not re-implement it.

If the diff is frontend-only and Gate 2 was skipped for any reason, load `meow:review/references/design-review.md` and follow the rubric pipeline there.

## Classify findings

4. **Classify each finding as AUTO-FIX or ASK** per the Fix-First Heuristic in
   `meow:review/references/fix-first-review.md`. Critical findings lean toward ASK; informational lean toward AUTO-FIX.

5. **Auto-fix all AUTO-FIX items.** Apply each fix. Output one line per fix:
   `[AUTO-FIXED] [file:line] Problem → what you did`

6. **If ASK items remain,** present them in ONE AskUserQuestion:
   - List each with number, severity, problem, recommended fix
   - Per-item options: A) Fix  B) Skip
   - Overall RECOMMENDATION
   - If 3 or fewer ASK items, you may use individual AskUserQuestion calls instead

7. **After all fixes (auto + user-approved):**
   - If ANY fixes were applied: commit fixed files by name (`git add <fixed-files> && git commit -m "fix: pre-landing review fixes"`), then **STOP** and tell the user to run `/meow:ship` again to re-test.
   - If no fixes applied (all ASK items skipped, or no issues found): continue to Step 4.

8. Output summary: `Pre-Landing Review: N issues — M auto-fixed, K asked (J fixed, L skipped)`

   If no issues found: `Pre-Landing Review: No issues found.`

Save the review output — it goes into the PR body in Step 8.

---

## Step 3.75: Address PR review comments (if PR exists)

If a PR exists, fetch review comments from GitHub:
```bash
gh pr view --json reviewRequests,reviews,comments -q '.reviews[].body, .comments[].body' 2>/dev/null || true
```

**If no PR, no comments, or `gh` fails:** Skip silently. Continue to Step 4.

**If review comments are found:**

For each comment, classify and handle:

**VALID & ACTIONABLE:** Use AskUserQuestion:
- Show the comment with file:line reference
- Options: A) Fix now, B) Acknowledge and ship anyway, C) Dismiss as false positive
- If fixed: commit with `git commit -m "fix: address review comment — <brief>"`, log to `.claude/memory/reviews.jsonl`

**ALREADY ADDRESSED:** Note what was done and the commit SHA. No user action needed.

**FALSE POSITIVE:** Show evidence for why it's incorrect. Let user decide to dismiss or fix anyway.

**After all comments resolved:** If fixes were applied, re-run tests (Step 3) before continuing.
