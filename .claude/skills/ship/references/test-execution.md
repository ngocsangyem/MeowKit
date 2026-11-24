# Test execution and failure triage

Run the project's own test command on the merged base (`mk:verify` finds it; the repo's `package.json` scripts, `Makefile` or README name it). Do not invent a command and do not edit the project's test setup. If the repo has no test runner, tell the user and offer to set one up as a separate task.

## Classify each failure

1. List the branch's files: `git diff origin/<base>...HEAD --name-only`.
2. A failure is **in-branch** when the failing test file changed on this branch, the output points at code the branch changed, or you can trace it to the diff. It is **likely pre-existing** when neither the test nor the code it tests changed and nothing in the branch explains it. When unsure, call it in-branch: stopping a developer costs less than shipping a broken test.

In-branch failures stop the run. Show them; the developer fixes them first.

## Pre-existing failures

Say who owns the problem: `source <(.claude/hooks/lib/workflow-repo-mode)` sets `REPO_MODE` (`solo`, `collaborative`, `unknown`). Show each failure with `file:line` and a short error, then ask:

- Fix now: root cause first, minimal fix, committed separately (`fix: pre-existing test failure in <file>`).
- Record it: add a P0 entry to `TODOS.md` (title, error, branch where it was noticed), if the repo keeps one.
- Collaborative repos only: open a GitHub issue for whoever last touched the test or the code under test (`git log --format="%an (%ae)" -1 -- <path>`; prefer the production-code author). Create it without an assignee if `gh --assignee` fails. Issue creation is an external write, so it needs the user's yes (`mk:ghpm` does the action).
- Skip and ship: note "Pre-existing test failure skipped: <test>" in the summary.

Recommend fixing now in a solo repo; in a collaborative one recommend reporting it, because someone else may own the failure. Pre-existing failures are reported and decided by the user, never treated as acceptable silently.

If code changes after the test run (review fixes, merge), run the tests again before pushing. CHANGELOG edits do not count.
