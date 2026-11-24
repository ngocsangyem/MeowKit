# Red Team Standalone

`/mk:plan-creator red-team {plan_path}` attacks an existing plan with reviewers and applies what the user approves, without running the rest of the pipeline.

1. Resolve the path: a directory means its `plan.md`; a `plan.md` path means its parent is `plan_dir`. If there is no `plan.md`, say so and stop.
2. Count the `phase-*.md` files for lens selection.
3. Run `step-05-red-team.md` in full: lenses, reviewers, collection, adjudication, user decision, apply, report and consistency sweep. The fast-mode skip does not apply here; a plan with no phase files still gets the lenses that fit one phase.
4. Do not run the semantic checks, the interview or the presentation.

Reruns are fine: the earlier `red-team-findings.md` is renamed with a date suffix and a new `### Session` is appended to plan.md.

Finish with the report path, the finding counts (accepted, rejected) and the severity split.
