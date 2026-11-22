# Fast-Track Mode & Agent Teams

## Fast-Track Mode

**When:** the user gives a complete spec and wants no planning conversation. It skips Phase 1 and runs Build, Verify and Review, then stops: ask before Ship.

**Triggers:** `fasttrack: <specs>` | "just build it"

A usable spec has an overview, requirements, technical design, interfaces, data model and acceptance criteria. If a section is missing, ask the user for it, because building from a guessed spec is the failure this mode must not repeat.

Run without pausing, and stop on the conditions below. Each is a place where continuing hides a problem.

| Condition | Phase | Action | Why |
| --- | --- | --- | --- |
| Tests pass in RED (TDD mode) | 2 | Stop | the spec may be incomplete, since the tests describe nothing new |
| Tests fail after 3 attempts | 3 | Stop and ask the user | the approach, not the attempt count, is wrong |
| Critical security finding | 4 | Stop and fix first | it must not reach a ship request unread |
| Coverage below the project's own baseline | 4 | Add tests, retry twice, then ask | the project sets the bar, not a fixed figure |
| Context nearly full | any | Hand off | a half-remembered run builds the wrong thing |

Switching: a standard run becomes fast-track when the user agrees the plan and says to go on; a fast-track run falls back to standard on an error.

## Agent Teams Mode (Experimental)

Use it only for a COMPLEX task spanning 2+ domains; TRIVIAL and STANDARD tasks use a single agent or plain subagents. Each teammate owns distinct files (`.claude/skills/cook/references/parallel-execution-rules.md`).

| Phase | Lead | Teammates |
| --- | --- | --- |
| 1 Plan | `planner` | `architect`, `developer`, `tester` |
| 2 Test | `tester` | `architect` |
| 3 Build | `architect` | `developer`, `tester` |
| 4 Review | `architect` + `security` | `reviewer` |

A teammate claims an unclaimed task, works it, marks it completed and tells the lead what it did. Use the host's task list and messaging tools for this (on Claude Code: `TaskList`, `TaskUpdate`, `SendMessage`). Where the host has none, run the same phases as sequential subagents.

Each teammate's brief carries the goal, the files it owns, the acceptance criteria and the return shape, the same as any delegation (`.claude/skills/cook/references/orchestration-rules.md`). Do not use a team for small, sequential or same-file work.

## Handoff

For a run that outlives its context, use `mk:session-continuation` and the plan files; the plan's checkboxes and `mewkit plan sync` carry the state.
