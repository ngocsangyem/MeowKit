# Pre-flight: Base Branch Detection and Review Readiness


## Contents

- [Step 0: Detect base branch](#step-0-detect-base-branch)
- [Step 0.5: Ship Mode Detection](#step-05-ship-mode-detection)
- [Step 0.8: Unified Verification](#step-08-unified-verification)
- [Step 1: Pre-flight](#step-1-pre-flight)
- [Review Readiness Dashboard](#review-readiness-dashboard)

## Step 0: Detect base branch

Determine which branch this PR targets. Use the result as "the base branch" in all subsequent steps.

1. Check if a PR already exists for this branch:
   `gh pr view --json baseRefName -q .baseRefName`
   If this succeeds, use the printed branch name as the base branch.

2. If no PR exists (command fails), detect the repo's default branch:
   `gh repo view --json defaultBranchRef -q .defaultBranchRef.name`

3. If both commands fail, fall back to `main`.

Print the detected base branch name. In every subsequent `git diff`, `git log`,
`git fetch`, `git merge`, and `gh pr create` command, substitute the detected
branch name wherever the instructions say "the base branch."

---

## Step 0.5: Ship Mode Detection

Determine ship mode from arguments:

```
If argument = "official" → target = default branch (main/master from Step 0)
If argument = "beta"     → target = auto-detect dev branch:
                           for b in dev beta develop; do
                             git rev-parse --verify origin/$b 2>/dev/null && echo "$b" && break
                           done
If no argument           → infer from branch name:
  - feature/* hotfix/* bugfix/* fix/* → official (target main)
  - dev/* beta/* experiment/*         → beta (target dev)
  - unclear                           → AskUserQuestion: "Ship to main (official) or dev (beta)?"
If --dry-run             → print mode + plan for each step, then stop
```

---

## Step 0.8: Unified Verification

Before any pre-flight checks, run `mk:verify` to confirm everything is green.

If `mk:verify` returns FAIL:
- Display the failing step and errors
- **Abort ship** with message: "Verification failed — fix issues before shipping. Run `/mk:verify` to re-check."
- Do not proceed to Step 1

If `mk:verify` returns PASS: continue to Step 1.

> Skip this step only if `--skip-verify` flag is passed explicitly by the user.

---

## Step 1: Pre-flight

1. Check the current branch. If on the base branch or the repo's default branch, **abort**: "You're on the base branch. Ship from a feature branch."

2. Run `git status` (never use `-uall`). Uncommitted changes are always included — no need to ask.

3. Run `git diff <base>...HEAD --stat` and `git log <base>..HEAD --oneline` to understand what's being shipped.

4. **If `--dry-run`:** Output what each step would do (mode, target branch, test command, version bump prediction) and **stop here**.

5. Check review readiness:

## Review Readiness Dashboard

After completing the review, read the review log and config to display the dashboard.

```bash
.claude/scripts/bin/meowkit-review-log
```

Parse the output. Match entries by `skill` field for real skills (`plan-ceo-review`, `review`, `adversarial-review`) and by `source` field for inline ship steps (`ship-design-check`). Ignore entries with timestamps older than 7 days. For the Eng Review row, show whichever is more recent between `review` (diff-scoped pre-landing review) and `plan-ceo-review` (plan-stage architecture review). Append "(DIFF)" or "(PLAN)" to the status to distinguish. For the Adversarial row, use `adversarial-review` (auto-scaled). For Design Review, use `ship-design-check` (inline lite check produced during pre-landing review). Display:

```
+====================================================================+
|                    REVIEW READINESS DASHBOARD                       |
+====================================================================+
| Review          | Runs | Last Run            | Status    | Required |
|-----------------|------|---------------------|-----------|----------|
| Eng Review      |  1   | 2026-03-16 15:00    | CLEAR     | YES      |
| CEO Review      |  0   | —                   | —         | no       |
| Design Review   |  0   | —                   | —         | no       |
| Adversarial     |  0   | —                   | —         | no       |
| Outside Voice   |  0   | —                   | —         | no       |
+--------------------------------------------------------------------+
| VERDICT: CLEARED — Eng Review passed                                |
+====================================================================+
```

**Review tiers:**

- **Eng Review (required by default):** The only review that gates shipping. Covers architecture, code quality, tests, performance. Can be disabled globally with `meowkit-config set skip_eng_review true` (the "don't bother me" setting).
- **CEO Review (optional):** Use your judgment. Recommend it for big product/business changes, new user-facing features, or scope decisions. Skip for bug fixes, refactors, infra, and cleanup.
- **Design Review (optional):** Use your judgment. Recommend it for UI/UX changes. Skip for backend-only, infra, or prompt-only changes.
- **Adversarial Review (automatic):** Auto-scales by diff size. Small diffs (<50 lines) skip adversarial. Medium diffs (50–199) get Claude adversarial subagent. Large diffs (200+) get 2 passes: Claude structured (from pre-landing review) + Claude adversarial subagent. No configuration needed.
- **Outside Voice (optional):** Independent plan review via Claude adversarial subagent. Offered after all review sections complete in /mk:plan-ceo-review. Never gates shipping.

**Verdict logic:**

- **CLEARED**: Eng Review has >= 1 entry within 7 days from either `review` or `plan-ceo-review` with status "clean" (or `skip_eng_review` is `true`)
- **NOT CLEARED**: Eng Review missing, stale (>7 days), or has open issues
- CEO and Design reviews are shown for context but never block shipping
- If `skip_eng_review` config is `true`, Eng Review shows "SKIPPED (global)" and verdict is CLEARED

**Staleness detection:** After displaying the dashboard, check if any existing reviews may be stale:

- Parse the `---HEAD---` section from the bash output to get the current HEAD commit hash
- For each review entry that has a `commit` field: compare it against the current HEAD. If different, count elapsed commits: `git rev-list --count STORED_COMMIT..HEAD`. Display: "Note: {skill} review from {date} may be stale — {N} commits since review"
- For entries without a `commit` field (legacy entries): display "Note: {skill} review from {date} has no commit tracking — consider re-running for accurate staleness detection"
- If all reviews match the current HEAD, do not display any staleness notes

If the Eng Review is NOT "CLEAR":

1. **Check for a prior override on this branch:**

   ```bash
   eval "$(.claude/scripts/bin/meowkit-slug 2>/dev/null)"
   grep '"skill":"ship-review-override"' .claude/memory/projects/$BRANCH-reviews.jsonl 2>/dev/null || echo "NO_OVERRIDE"
   ```

   If an override exists, display the dashboard and note "Review gate previously accepted — continuing." Do NOT ask again.

2. **If no override exists,** use AskUserQuestion:
   - Show that Eng Review is missing or has open issues
   - RECOMMENDATION: Choose C if the change is obviously trivial (< 20 lines, typo fix, config-only); Choose B for larger changes
   - Options: A) Ship anyway B) Abort — run /mk:review first C) Change is too small to need eng review
   - If CEO Review is missing, mention as informational ("CEO Review not run — recommended for product changes") but do NOT block
   - For Design Review: run `source <(.claude/scripts/bin/meowkit-diff-scope <base> 2>/dev/null)`. If `SCOPE_FRONTEND=true` and no `ship-design-check` entry exists in the dashboard, mention: "Design Review not run — this PR changes frontend code. The inline lite design check runs automatically during pre-landing review." Still never block.

3. **If the user chooses A or C,** persist the decision so future `/mk:ship` runs on this branch skip the gate:
   ```bash
   eval "$(.claude/scripts/bin/meowkit-slug 2>/dev/null)"
   echo '{"skill":"ship-review-override","timestamp":"'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'","decision":"USER_CHOICE"}' >> .claude/memory/projects/$BRANCH-reviews.jsonl
   ```
   Substitute USER_CHOICE with "ship_anyway" or "not_relevant".