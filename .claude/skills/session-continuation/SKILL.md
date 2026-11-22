---
name: mk:session-continuation
description: "Saves and restores progress across resets. NOT for mk:memory."
triggers:
  - handoff
  - save state
  - resume workflow
allowed-tools: Read, Write, Bash
source: aura-frog
keywords:
  - session-continuation
  - session-handoff
  - resume-workflow
  - context-reset
  - state-persistence
when_to_use: "Auto on compaction."
user-invocable: false
owner: docs
criticality: medium
status: active
runtime: claude-code
---

# Session Continuation

Carries unfinished work across a context reset. Use it when the runtime reports the context
nearing its limit, or the user says handoff, save, pause or resume. Not for lessons worth
keeping (that is `mk:memory`).

Durable state already lives in the plan files and the `mewkit` records; this skill keeps
those current and reads them back. It adds no state file of its own.

## Save (handoff)

1. Tick the plan checkboxes for work that is actually done, then run
   `mewkit plan sync <plan-dir>` so the derived statuses match.
2. If an active durable task exists (`mewkit task-state show`), record where you are:
   `mewkit task-state update <id> --step "<what just finished>" --next "<next action>"`,
   adding `--blocker` for anything stuck.
3. Tell the user what was saved and the one-line next step.

Done when `mewkit orient` returns the next step you recorded.

## Resume

Run `mewkit orient`, then read the plan it points to (`mewkit plan status <plan-dir>`).
Treat the output as a lead, not a fact: check it against the live files and git before
acting. If a recorded path no longer exists, say so and re-plan that step rather than
guessing.

## Gotchas

- Saved state can name files that were renamed or deleted since: validate every path before resuming.
- Several active plans: ask which to resume; do not pick one.
- No `mewkit` on the PATH: update the plan checkboxes and write the next step into the plan, and say the resume will be manual.
- The runtime's checkpoint hook writes its own snapshots; do not hand-edit them.
