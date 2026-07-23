# RCA Anti-Patterns

Common mistakes that produce shallow root cause analysis and allow failures to recur.

## Anti-Pattern 1: "Human Error" Is Never Root Cause

Saying "the developer made a mistake" ends the investigation too early.

**Wrong:** "Root cause: engineer deleted the wrong database table."

**Right:** Ask why the system allowed the error. Why was there no confirmation dialog? Why did the engineer have delete access in production? Why was there no backup for that table? Why was the runbook not followed?

Human error is always a symptom. The root cause is the system design that made the error possible.

## Anti-Pattern 2: "Retraining" Is the Weakest Fix

Saying "we will train the team better" produces no lasting change.

Training addresses the person, not the system. The next person who joins won't have the training. The trained person will be under pressure and skip the step anyway.

**Instead:** Change the system so the mistake is impossible, expensive, or immediately visible. Add a gate, a check, a validation, or a warning. Documentation is better than training. A linter is better than documentation. A hard constraint is better than a linter.

Fixative strength ranking (weakest → strongest):
1. Retrain person ← weakest, avoid
2. Update documentation
3. Add warning/alert
4. Add automated check
5. Redesign to make failure impossible ← strongest, aim here

## Anti-Pattern 3: Root Cause Restates the Symptom

**Wrong:** "Root cause: the login page returned a 500 error because the server had an error."

**Right:** "Root cause: database connection pool was exhausted because no connection timeout was configured."

The root cause must explain WHY the symptom occurred, not describe the symptom in different words. Apply the test: if you fix the "root cause," does the symptom stop occurring? If not, you haven't found the root cause.

## Anti-Pattern 4: Single-Cause Bias

Most production failures have 3 or more contributing causes.

Finding one cause and stopping means the other causes remain in place. The next slightly different condition will trigger a similar failure via a different path.

Good RCA identifies: primary cause (the direct trigger), enabling causes (conditions that allowed it), and latent causes (systemic gaps that made it possible).

## Anti-Pattern 5: Stopping Too Early

A root cause at depth 1-2 is usually a symptom. Root causes live at depth 4-5.

**Minimum:** Ask "why" at least 4 times before declaring root cause found.

**Signal you've found root cause:** The answer is a missing process, a system design gap, a missing constraint, or a tooling absence — not another specific event.

**Signal you've stopped too early:** You could ask "why" one more time and get a meaningful answer.
