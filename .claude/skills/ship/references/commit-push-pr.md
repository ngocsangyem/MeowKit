# Commit, Push, PR Creation, and Post-Ship (Steps 6, 6.5, 7, 8, 8.5, 8.75)


## Contents

- [Step 6: Commit (bisectable chunks)](#step-6-commit-bisectable-chunks)
- [Step 6.5: Verification Gate](#step-65-verification-gate)
- [Step 7: Push](#step-7-push)
- [Step 7.5: Link Issues](#step-75-link-issues)
- [Step 8: Create PR](#step-8-create-pr)
- [Summary](#summary)
- [Test Coverage](#test-coverage)
- [Pre-Landing Review](#pre-landing-review)
- [Design Review](#design-review)
- [Eval Results](#eval-results)
- [PR Review Comments](#pr-review-comments)
- [Plan Completion](#plan-completion)
- [Verification Results](#verification-results)
- [TODOS](#todos)
- [Test plan](#test-plan)
- [Step 8.5: Auto-invoke /document-release](#step-85-auto-invoke-document-release)
- [Step 8.75: Persist ship metrics](#step-875-persist-ship-metrics)

## Step 6: Commit (bisectable chunks)

**Goal:** Create small, logical commits that work well with `git bisect` and help LLMs understand what changed.

1. Analyze the diff and group changes into logical commits. Each commit should represent **one coherent change** — not one file, but one logical unit.

2. **Commit ordering** (earlier commits first):
   - **Infrastructure:** migrations, config changes, route additions
   - **Models & services:** new models, services, concerns (with their tests)
   - **Controllers & views:** controllers, views, JS/React components (with their tests)
   - **VERSION + CHANGELOG + TODOS.md:** always in the final commit

3. **Rules for splitting:**
   - A model and its test file go in the same commit
   - A service and its test file go in the same commit
   - A controller, its views, and its test go in the same commit
   - Migrations are their own commit (or grouped with the model they support)
   - Config/route changes can group with the feature they enable
   - If the total diff is small (< 50 lines across < 4 files), a single commit is fine

4. **Each commit must be independently valid** — no broken imports, no references to code that doesn't exist yet. Order commits so dependencies come first.

5. Compose each commit message:
   - First line: `<type>: <summary>` (type = feat/fix/chore/refactor/docs)
   - Body: brief description of what this commit contains
   - Only the **final commit** (VERSION + CHANGELOG) gets the version tag and co-author trailer:

```bash
git commit -m "$(cat <<'EOF'
chore: bump version and changelog (vX.Y.Z.W)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Step 6.5: Verification Gate

**IRON LAW: NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE.**

Before pushing, re-verify if code changed during Steps 4-6:

1. **Test verification:** If ANY code changed after Step 3's test run (fixes from review findings, CHANGELOG edits don't count), re-run the test suite. Paste fresh output. Stale output from Step 3 is NOT acceptable.

2. **Build verification:** If the project has a build step, run it. Paste output.

3. **Rationalization prevention:**
   - "Should work now" → RUN IT.
   - "I'm confident" → Confidence is not evidence.
   - "I already tested earlier" → Code changed since then. Test again.
   - "It's a trivial change" → Trivial changes break production.

**If tests fail here:** STOP. Do not push. Fix the issue and return to Step 3.

Claiming work is complete without verification is dishonesty, not efficiency.

---

## Step 7: Push

Push to the remote with upstream tracking:

```bash
git push -u origin <branch-name>
```

---

## Step 7.5: Link Issues

Find or create related GitHub issues before creating the PR:

1. **Search related issues** by keywords from branch name and commit messages:

   ```bash
   BRANCH=$(git branch --show-current)
   KEYWORDS=$(echo "$BRANCH" | sed 's/[^a-zA-Z0-9]/ /g' | tr '[:upper:]' '[:lower:]')
   gh issue list --state open --limit 10 --search "$KEYWORDS" 2>/dev/null || true
   ```

2. **Check commit messages** for issue references:

   ```bash
   git log origin/<base>..HEAD --oneline | grep -oE '#[0-9]+' | sort -u
   ```

3. **If related issues found:** Store numbers for PR body (e.g., `Closes #42, Relates to #43`).
4. **If NO issues found and change is significant (>50 lines):** Create a tracking issue:
   ```bash
   gh issue create --title "<type>: <summary>" --body "Tracking issue for PR. Details in the PR description."
   ```
5. **If `gh` unavailable:** Skip silently — issue linking is best-effort.

---

## Step 8: Create PR

**Check if PR already exists for this branch:**

```bash
EXISTING_PR=$(gh pr view --json number --jq '.number' 2>/dev/null || true)
```

If existing PR found → edit it. If not → create new.

Create a pull request using `gh`:

```bash
gh pr create --base <base> --title "<type>: <summary>" --body "$(cat <<'EOF'
## Summary
<bullet points from CHANGELOG>

## Test Coverage
<coverage diagram from Step 3.4, or "All new code paths have test coverage.">
<If Step 3.4 ran: "Tests: {before} → {after} (+{delta} new)">

## Pre-Landing Review
<findings from Step 3.5 code review, or "No issues found.">

## Design Review
<If design review ran: "Design Review (lite): N findings — M auto-fixed, K skipped. AI Slop: clean/N issues.">
<If no frontend files changed: "No frontend files changed — design review skipped.">

## Eval Results
<If evals ran: suite names, pass/fail counts, cost dashboard summary. If skipped: "No prompt-related files changed — evals skipped.">

## PR Review Comments
<If PR comments were resolved: bullet list with [FIXED] / [DISMISSED] / [ALREADY ADDRESSED] tag + one-line summary per comment>
<If no PR comments found: "No PR review comments.">
<If no PR existed during Step 3.75: omit this section entirely>

## Plan Completion
<If plan file found: completion checklist summary from Step 3.45>
<If no plan file: "No plan file detected.">
<If plan items deferred: list deferred items>

## Verification Results
<If verification ran: summary from Step 3.47 (N PASS, M FAIL, K SKIPPED)>
<If skipped: reason (no plan, no server, no verification section)>
<If not applicable: omit this section>

## TODOS
<If items marked complete: bullet list of completed items with version>
<If no items completed: "No TODO items completed in this PR.">
<If TODOS.md created or reorganized: note that>
<If TODOS.md doesn't exist and user skipped: omit this section>

## Test plan
- [x] All Rails tests pass (N runs, 0 failures)
- [x] All Vitest tests pass (N tests)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

**If `EXISTING_PR` was set:** Update the existing PR instead of creating a new one:

```bash
gh pr edit "$EXISTING_PR" --title "<type>: <summary>" --body "<same body as above>"
```

**Include linked issues** in PR body: add `Closes #N` or `Relates to #N` lines from Step 7.5.

**Output the PR URL** — then proceed to Step 8.5.

---

## Step 8.5: Auto-invoke /document-release

After the PR is created, automatically sync project documentation. Read the
`document-release/SKILL.md` skill file (adjacent to this skill's directory) and
execute its full workflow:

1. Read the `/document-release` skill: `cat ${CLAUDE_SKILL_DIR}/../document-release/SKILL.md`
2. Follow its instructions — it reads all .md files in the project, cross-references
   the diff, and updates anything that drifted (README, ARCHITECTURE, CONTRIBUTING,
   CLAUDE.md, TODOS, etc.)
3. If any docs were updated, commit the changes and push to the same branch:
   ```bash
   git add -A && git commit -m "docs: sync documentation with shipped changes" && git push
   ```
4. If no docs needed updating, say "Documentation is current — no updates needed."

This step is automatic. Do not ask the user for confirmation. The goal is zero-friction
doc updates — the user runs `/mk:ship` and documentation stays current without a separate command.

---

## Step 8.75: Persist ship metrics

Log coverage and plan completion data so `/mk:retro` can track trends:

```bash
eval "$(.claude/scripts/bin/meowkit-slug 2>/dev/null)" && mkdir -p .claude/memory/projects
```

Append to `.claude/memory/projects/$BRANCH-reviews.jsonl`:

```bash
echo '{"skill":"ship","timestamp":"'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'","coverage_pct":COVERAGE_PCT,"plan_items_total":PLAN_TOTAL,"plan_items_done":PLAN_DONE,"verification_result":"VERIFY_RESULT","version":"VERSION","branch":"BRANCH"}' >> .claude/memory/projects/$BRANCH-reviews.jsonl
```

Substitute from earlier steps:

- **COVERAGE_PCT**: coverage percentage from Step 3.4 diagram (integer, or -1 if undetermined)
- **PLAN_TOTAL**: total plan items extracted in Step 3.45 (0 if no plan file)
- **PLAN_DONE**: count of DONE + CHANGED items from Step 3.45 (0 if no plan file)
- **VERIFY_RESULT**: "pass", "fail", or "skipped" from Step 3.47
- **VERSION**: from the VERSION file
- **BRANCH**: current branch name

This step is automatic — never skip it, never ask for confirmation.