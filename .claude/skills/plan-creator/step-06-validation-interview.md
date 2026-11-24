# Step 6: Validation Interview

Hard family only. Ask the user the few questions whose answers change the plan, and write the answers into it. Done when every answer is recorded in `## Validation Log`, propagated to the section it affects, and the consistency sweep has run.

## 6a. Recap first

Before the first question, show: the plan path, the objective in one sentence, what is in and out of scope, the phase count and names, the top two or three risks, and for each question the section its answer may change. The user is about to rewrite phase files they may not have read since drafting; an answer given against a misremembered plan propagates silently.

Make every question self-contained: restate the decision, the plan's current position and the options inside the question. The user may answer after a context reset.

This step presents and records; you own plan mutation. A subagent or the interview never edits a phase file.

## 6b. Choose the questions

Pick the questions that would change the plan, using the categories, detection keywords, format rules and section mapping in `references/validation-questions.md`. Normally 3-5; ask fewer when the plan is clear, and say so. Each has 2-4 concrete options with the recommended one marked.

Sources, in priority order: claims the verification log marked FAILED or UNVERIFIED (state the claim, what the plan says, what the repo shows, and ask which is right); accepted red-team findings that flag an assumption or risk; then keyword-matched categories (architecture, assumptions, scope, risk, trade-offs). Group related questions, at most four per ask. Ask in plain words if the runtime has no structured question tool.

## 6c. Propagate and log

Write each answer to its section: architecture to the phase `## Architecture`, assumptions and trade-offs to `## Key Insights` prefixed "Validated:", scope to plan.md `## Constraints`, risk to the phase `## Risk Assessment`. Update plan.md Constraints if an answer changes scope.

Append to plan.md `## Validation Log`, one block per question: question, category, options presented, answer, rationale ("-" if none), sections changed.

If an answer shows the plan's premise is wrong, stop and tell the user rather than editing around it; offer to return to step 3 or step 0.

## 6d. Sweep

Run the consistency sweep in `references/whole-plan-sweep.md` with `delta_source = propagated_answers`. Do not present the plan until unresolved contradictions are settled by the user's choice.

## Next

`step-07-gate.md`
