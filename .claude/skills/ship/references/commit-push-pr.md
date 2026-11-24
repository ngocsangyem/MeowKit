# Commit, push and PR (`release`)

Everything here that leaves the machine (push, `gh pr create`, `gh pr edit`) needs the user's yes in this run. Commits are local; the `prepare` scope already got a yes for them.

## Commits

Group the diff into logical commits that each work alone, so `git bisect` and reviewers can follow them: infrastructure (migrations, config, routes) first, then models and services with their tests, then controllers and views with their tests, then VERSION, CHANGELOG and TODOS.md last. A small diff (under about 50 lines across fewer than 4 files) is one commit.

Message: `<type>: <summary>` (feat, fix, refactor, test, perf, ci; this repo's own conventions win), a short body, and the co-author trailer the host's attribution settings ask for, if any.

## Verify before the push

If code changed after the last test run, run the tests (and the build, if the project has one) again and use that fresh output. A claim that it works is not evidence; stale output from before the change is not evidence either. A failure here stops the run.

## Push

`git push -u origin <branch>`. Never force-push; if history was rewritten, stop and ask. Protected branches are never pushed to directly.

## Issues

Search related open issues with keywords from the branch and commit messages (`gh issue list --state open --search "<keywords>"`), and read `#N` references from `git log origin/<base>..HEAD`. Put `Closes #N` or `Relates to #N` in the PR body. Creating a tracking issue belongs to `publish` and goes through `mk:ghpm`; ship does not create one in `release`. If `gh` is unavailable, skip linking.

## Create or update the PR

Check for an existing PR: `gh pr view --json number --jq .number`. If one exists, `gh pr edit <n>`; otherwise `gh pr create --base <base> --title "<type>: <summary>" --body ...`. Body sections, each only when it has content:

- **Summary**: bullets from the CHANGELOG entry or commits.
- **Test Coverage**: tests run, uncovered changed paths worth knowing about (see `.claude/skills/review/references/test-coverage.md` for the method).
- **Review**: the verdict path and status from `tasks/reviews/`, and any pre-landing findings with what was done.
- **PR Review Comments**: fixed, dismissed or already addressed, one line each.
- **Plan Completion**: the checklist from `references/plan-completion-audit.md`.
- **Workflow Evidence**: the path of `workflow-evidence.json` if pre-flight read one. Evidence is proof, not approval.
- **Rollback**: how to undo this change (`references/rollback-protocol.md` for risky ones).
- **Test plan**: the commands run and their results, as they ran. Do not claim a result that was not run.

End the body with this line (each host's install adapts it to the runtime in use):

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Print the PR URL. Then report whether the diff touches documented behaviour and offer `/mk:document-release`; do not invoke it. Wait for CI to reach a terminal state and report it; red or pending CI is never waved through.
