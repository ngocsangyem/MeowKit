# Validate Standalone

`/mk:plan-creator validate {plan_path}` interviews the user about an existing plan's open decisions and writes the answers into it. It is an interview, not an audit: for a completeness report on an agreed plan use `mk:validate-plan`.

1. Resolve the path: a directory means its `plan.md`; a `plan.md` path means its parent is `plan_dir`. If there is no `plan.md`, say so and stop.
2. Read `plan.md` and every `phase-*.md`. If plan.md has a `## Red Team Review`, read `red-team-findings.md` too; flagged areas make the best questions.
3. Run `step-06-validation-interview.md` in full: recap, questions, propagation, log and sweep.
4. Do not run red team, the semantic checks or the presentation.

Each run appends a `### Session - {date}` block to `## Validation Log` rather than replacing earlier answers.

Finish with the plan path, the number of questions asked and the number of phase files updated.
