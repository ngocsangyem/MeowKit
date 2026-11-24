# Fix loop

For each fixable issue, in severity order. Only files directly related to the issue change.

1. **Locate** the source with Grep and Glob on the error text, component name or route.
2. **Fix minimally.** Read the code, make the smallest change that resolves the issue, and leave surrounding code alone.
3. **Commit** only the changed files, one commit per fix: `fix(qa): ISSUE-NNN short description`.
4. **Re-test** the affected page: open it, take the after screenshot, check the console, take a fresh snapshot.
5. **Classify:** verified (the re-test confirms it and no new errors appeared), best-effort (applied but not fully verifiable, for example it needs an auth state or an external service), or reverted (a regression appeared: `git revert HEAD` and defer the issue).
6. **Regression test**, only when the fix is verified, has JS or logic behavior, and the project already has a test framework (otherwise say so and skip). Copy the style of the nearest existing tests, set up the exact precondition that triggered the bug, perform the action, and assert the correct behavior (not "it renders"). Mock only what the project's own tests mock. Put an attribution comment on top (`Regression: ISSUE-NNN, found by /mk:qa on {date}`), run only the new test file, and commit it as `test(qa): regression test for ISSUE-NNN`. If it fails twice or takes more than two minutes to write, delete it and defer.

## Stop rules

- **Self-regulation:** every 5 fixes, and after any revert, estimate the risk of making things worse. Each revert adds 15 points; each fix touching more than 3 files adds 5; touching unrelated files adds 20; after fix 15, each extra fix adds 1. Above 20, stop, show the user what you have done and ask whether to continue. Test commits do not count.
- **Cap:** 50 fixes per run.
- **Regression:** if the final health score is worse than the baseline, say so prominently.
