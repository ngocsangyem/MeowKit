# Shared Protocols

Two conventions shared by the skills that load this file: how to ask the user a question, and how to report when the work ends.

## Asking the user

Ask one decision per question, so each answer is unambiguous. For each question:

1. **Re-ground** in one or two sentences: the project, the current branch (the `BRANCH` value from the preamble) and the task. The user may not have looked at this window for a while.
2. **Explain the problem plainly**: what happens, with a concrete example, rather than function names or internal jargon.
3. **Recommend** one option and give the reason in a line: `RECOMMENDATION: Choose [X] because [reason]`. Recommend the option that meets the goal at the lowest risk, and say what the cheaper option would leave out (edge cases, tests, error paths) so the user can weigh it.
4. **List the options** as `A) … B) … C) …`. When an option has a real cost in time or risk, say so.

Several questions may be asked one after another. A final "approve / revise / reject" question comes only after the individual decisions are settled. A skill may add its own formatting on top of this.

## Completion status

End the workflow with one of these statuses, because the caller decides its next step from it:

- **DONE** — all steps completed; give the evidence for each claim.
- **DONE_WITH_CONCERNS** — completed, with issues the user should know about; list each one.
- **BLOCKED** — cannot proceed; say what blocks it and what was tried.
- **NEEDS_CONTEXT** — information is missing; say exactly what is needed.

### Escalation

Stopping is always acceptable. A wrong result costs more than an honest "I could not do this", so:

- after three failed attempts at the same thing, stop and escalate;
- if a security-sensitive change is uncertain, stop and escalate;
- if the work grows beyond what you can verify, stop and escalate;
- if the task's premise turns out to be wrong (the bug is elsewhere, the plan cannot meet its goal), stop and say so rather than working around it.

Escalation format:

```
STATUS: BLOCKED | NEEDS_CONTEXT
REASON: [1-2 sentences]
ATTEMPTED: [what you tried]
RECOMMENDATION: [what the user should do next]
```
