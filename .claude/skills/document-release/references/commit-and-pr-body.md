# Commit and PR body

Nothing here runs without the user's yes in this run. The yes covers what was asked: a commit does not imply a push, and a push does not imply a PR edit.

**Empty check first.** `git status` (without `-uall`). If no doc file changed, say "All documentation is up to date" and stop.

## Health summary (before asking)

One line per doc: README, architecture, contributing, CHANGELOG, TODOS, `VERSION`, each as `Updated (what changed)`, `Current`, `Voice polished`, or `Skipped (missing)`. Then the question: commit these doc changes? Offer commit only, commit and push, or leave local.

## If the user says commit

1. Stage the changed doc files by name, never `git add -A` or `git add .`.
2. Commit with a conventional message such as `docs: update project documentation` (add the co-author trailer the host's attribution settings ask for, if any).
3. Push only if the user chose it, to the current branch.

## PR body (only if the user chose to update the PR)

1. Read the body: `gh pr view --json body -q .body`, into a file in a fresh temp directory (`mktemp -d`), not a fixed path.
2. Replace an existing `## Documentation` section, or append one. It lists, per file, what specifically changed.
3. Write it back with `gh pr edit --body-file <file>`, then delete the temp file.
4. No PR, or `gh pr edit` fails: say so and carry on; the changes are in the commit.
