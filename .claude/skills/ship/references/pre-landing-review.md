# Pre-landing check and PR comments

Review is `mk:review`'s job; ship does not re-run the adversarial pipeline. Before a release, check only what is cheap:

- A frontend-only diff with no `mk:review` pass: follow `mk:review`'s design-review rubric (the files are named in the ship SKILL.md). Findings are classified AUTO-FIX or ASK by `mk:review`'s fix-first method; critical ones lean to ASK.
- If fixes were applied, commit them by file name (`fix: pre-landing review fixes`), then tell the user to run `/mk:ship` again so the tests run on the new state.

## PR review comments (only when a PR exists)

Fetch them: `gh pr view --json reviewRequests,reviews,comments -q '.reviews[].body, .comments[].body'`. If there is no PR, no comments, or `gh` fails, skip.

For each comment:

- **Valid and actionable**: show the comment with `file:line`; the user chooses fix now, acknowledge and ship, or dismiss as a false positive. A fix is committed as `fix: address review comment - <brief>`.
- **Already addressed**: note what was done and the commit SHA.
- **False positive**: show the evidence; the user decides to dismiss or fix anyway.

Every reply on the PR carries evidence (a diff hunk or a code reference). Posting replies is an external write and needs the user's yes. After fixes, run the tests again.
