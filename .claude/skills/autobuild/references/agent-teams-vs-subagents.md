# Agent Teams vs Subagents

Autobuild dispatches each step to a fresh subagent that reads files and writes files. That is the default and the only mode the step files describe.

## Why subagents

- **Reproducible and auditable.** Inputs are paths (plan, contract, handoff, verdict); outputs are files committed to git; the run report is the trail.
- **No coupling.** The generator and the evaluator cannot share assumptions, which is the separation the evaluator exists for.
- **Restartable.** A killed run continues from the `next_step` in `run.md`.

The costs are latency per step, no live questions between generator and evaluator, and a context reload in each subagent.

## When a live team might help

Agent Teams (long-lived teammates passing messages over the host's task list) lower latency when a build routinely needs more than about 5 rounds, or when the evaluator needs to ask the generator mid-build which of two readings a criterion means. They are a host feature, not an autobuild option: the user asks for one in the prompt, and nothing in this skill's steps enables it.

If you use one: the evaluator owns the verdict and its evidence directory, the generator owns source, and no two agents edit the same file (`.claude/skills/cook/references/parallel-execution-rules.md`). Teams change nothing about the practices: the plan is still agreed with the user, the contract still signed, the diff still reviewed before shipping. A killed team can leave shared state half-written and message order can change outcomes, so a team run is harder to reproduce.
