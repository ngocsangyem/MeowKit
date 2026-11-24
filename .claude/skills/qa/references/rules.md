# QA rules

1. Every issue has at least one screenshot, and you retry it once to confirm it reproduces.
2. Credentials never go in repro steps or the report; write `[REDACTED]`. Never ask for a password in chat.
3. Write each issue to the report when you find it, not in a batch.
4. Test as a user. Read source code only to fix a defect you have confirmed.
5. Check the console after every interaction: JS errors that never surface visually are still bugs.
6. Use realistic data and walk complete workflows end to end.
7. Use `snapshot -C` for UIs where the accessibility tree misses clickable divs.
8. Never delete output files; screenshots and reports accumulate on purpose.
9. When you take a screenshot, give the user its path, and view it yourself if you can see images.
10. The user asked for browser testing, so open the browser even when the diff looks backend-only; backend changes change app behavior.
11. A clean working tree is required; if it is dirty, ask the user to commit, stash or abort.
12. One commit per fix. Only add new test files; never change CI configuration or existing tests.
13. Revert a fix that makes things worse (`git revert HEAD`).
14. Follow the stop rules in `fix-loop.md`; when in doubt, stop and ask.

Output structure: `tasks/reports/qa/` holds the report, `screenshots/` (initial, per-issue steps, before and after) and `baseline.json`.
