# Moves by symptom type

Short additions to the process in `SKILL.md`. The diagnosis and the six-field proof still apply to every type.

## Failing test

Classify first, because the fix differs:

- **True failure**: the code regressed and the test caught it. Fix the code (`git bisect` finds the commit).
- **Stale test**: the implementation changed on purpose. Confirm that in the plan or PR, then update the expectation. Never change a test to pass without knowing why it failed.
- **Flaky**: find the source (timing, ordering, shared state, external dependency), fix it. Run test 5x to confirm stability.
- **Environment**: passes locally, fails in CI. Compare versions, env vars, OS and timezone; fix the setup or add a skip condition.

Read the exact assertion and the expected versus actual values; several failures often share one cause. This skill repairs broken tests; writing new ones is the `tester` agent's job.

## CI or deploy failure

Read the logs (`gh run view`), name the failed job and step, and classify: config, dependency, test, build or deploy. Reproduce the failing command locally and compare Node or Python versions, env vars and OS. Config errors are workflow YAML fixes; dependency issues are lockfile or pin fixes; the log names missing secrets and cache problems. Run the failing command locally before pushing.

## Logs and error tracking

Filter to the relevant time window, grep for ERROR, FATAL and stack traces, and match entries to code paths. Note whether the error is one-off or recurring and whether several errors share a cause. Follow stack traces to source; `mk:investigate` handles the evidence. Fix the reported failure only; adding logging or alerts is a separate request.

## UI bug

Reproduce with `mk:agent-browser` on the affected page: a screenshot of the problem and the console errors. Check the usual causes (CSS specificity, missing breakpoints, state or async ordering) in the component source. Verify with an after-screenshot at each affected viewport and a clean console, and attach before and after to the report.

## Lint or type error

If the project's build or type-check command fails, route to `mk:build-fix`. Lint repair stays here: group errors by root cause, fix the deepest dependency first, and re-run after each fix. Typing rules are in `.claude/rules/security-rules.md`; when a type is wrong, fix the type instead of casting around it.
