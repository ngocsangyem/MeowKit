# Important Rules

These rules apply across all steps of the /meow:ship workflow. They are hard constraints.

- **Never skip tests.** If tests fail, stop.
- **Never skip the pre-landing review.** It's a hard step in the ship pipeline.
- **Never force push.** Use regular `git push` only.
- **Never ask for trivial confirmations** (e.g., "ready to push?", "create PR?"). DO stop for: version bumps (MINOR/MAJOR), pre-landing review findings (ASK items), and Claude adversarial review [P1] findings (large diffs only).
- **Always use the 4-digit version format** from the VERSION file.
- **Date format in CHANGELOG:** `YYYY-MM-DD`
- **Split commits for bisectability** — each commit = one logical change.
- **TODOS.md completion detection must be conservative.** Only mark items as completed when the diff clearly shows the work is done.
- **Every PR comment reply includes evidence** (inline diff, code references). Never post vague replies.
- **Never push without fresh verification evidence.** If code changed after Step 3 tests, re-run before pushing.
- **Step 3.4 generates coverage tests.** They must pass before committing. Never commit failing tests.
- **The goal is: user says `/meow:ship`, next thing they see is the review + PR URL + auto-synced docs.**
