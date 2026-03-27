---
name: meow:cook
description: "ALWAYS activate this skill before implementing EVERY feature, plan, or fix."
source: claudekit-engineer
version: 2.1.1
argument-hint: "[task|plan-path] [--interactive|--fast|--parallel|--auto|--no-test]"
---

# Cook - Smart Feature Implementation

End-to-end implementation with automatic workflow detection.

**Principles:** YAGNI, KISS, DRY | Token efficiency | Concise reports

## Usage

```
/cook <natural language task OR plan path>
```

**IMPORTANT:** If no flag is provided, the skill will use the `interactive` mode by default for the workflow.

**Optional flags to select the workflow mode:**

- `--interactive`: Full workflow with user input (**default**)
- `--fast`: Skip research, scout→plan→code
- `--parallel`: Multi-agent execution
- `--no-test`: Skip testing step
- `--auto`: Auto-approve all steps

**Example:**

```
/cook "Add user authentication to the app" --fast
/cook path/to/plan.md --auto
```

## Smart Intent Detection

| Input Pattern                     | Detected Mode | Behavior                       |
| --------------------------------- | ------------- | ------------------------------ |
| Path to `plan.md` or `phase-*.md` | code          | Execute existing plan          |
| Contains "fast", "quick"          | fast          | Skip research, scout→plan→code |
| Contains "trust me", "auto"       | auto          | Auto-approve all steps         |
| Lists 3+ features OR "parallel"   | parallel      | Multi-agent execution          |
| Contains "no test", "skip test"   | no-test       | Skip testing step              |
| Default                           | interactive   | Full workflow with user input  |

See `references/intent-detection.md` for detection logic.

## Plan-First Gate

For non-trivial tasks (> 2 files OR > 30 min):

1. Check for existing approved plan in `tasks/plans/`
2. If no plan → invoke `meow:plan-creator` with task description
3. Wait for Gate 1 approval before proceeding to implementation

Skip: When invoked with a plan path (`/cook path/to/plan.md`) — plan already exists.
Skip: `--fast` mode for trivial tasks (< 3 files, < 30 min).

## Workflow Overview

```
[Intent Detection] → [Research?] → [Review] → [Plan] → [Review] → [Implement] → [Review] → [Test?] → [Review] → [Finalize]
```

**Default (non-auto):** Stops at `[Review]` gates for human approval before each major step.
**Auto mode (`--auto`):** Skips human review gates, implements all phases continuously.
**Claude Tasks:** Utilize all these tools `TaskCreate`, `TaskUpdate`, `TaskGet` and `TaskList` during implementation step.

| Mode        | Research | Testing | Review Gates                   | Phase Progression      |
| ----------- | -------- | ------- | ------------------------------ | ---------------------- |
| interactive | Yes      | Yes     | **User approval at each step** | One at a time          |
| auto        | Yes      | Yes     | Auto if score>=9.5             | All at once (no stops) |
| fast        | No       | Yes     | **User approval at each step** | One at a time          |
| parallel    | Optional | Yes     | **User approval at each step** | Parallel groups        |
| no-test     | Yes      | No      | **User approval at each step** | One at a time          |
| code        | No       | Yes     | **User approval at each step** | Per plan               |

## Step Output Format

```
Step [N]: [Brief status] - [Key metrics]
```

## Blocking Gates (Non-Auto Mode)

Human review required at these checkpoints (skipped with `--auto`):

- **Post-Research:** Review findings before planning
- **Post-Plan:** Approve plan before implementation
- **Post-Implementation:** Approve code before testing
- **Post-Testing:** 100% pass + approve before finalize

**Always enforced (all modes):**

- **Testing:** 100% pass required (unless no-test mode)
- **Code Review:** User approval OR auto-approve (score>=9.5, 0 critical)
- **Finalize (MANDATORY - never skip):**
  1. `orchestrator` → run full plan sync-back (all completed tasks/steps), then update `plan.md` status/progress
  2. `documenter` agent → update `./docs` if changes warrant
  3. `TaskUpdate` → mark all Claude Tasks complete after sync-back verification
  4. Ask user if they want to commit via `shipper` agent

## Required Subagents (MANDATORY)

| Phase    | Subagent                | Requirement           |
| -------- | ----------------------- | --------------------- |
| Research | `researcher`            | Optional in fast/code |
| Scout    | `meow:scout`            | Optional in code      |
| Plan     | `planner`               | Optional in code      |
| Testing  | `tester`                | **MUST** spawn        |
| Review   | `reviewer`              | **MUST** spawn        |
| Finalize | `documenter`, `shipper` | **MUST** spawn both   |

**CRITICAL ENFORCEMENT:**

- Steps 4, 5, 6 **MUST** use Task tool to spawn subagents
- DO NOT implement testing, review, or finalization yourself - DELEGATE
- If workflow ends with 0 Task tool calls, it is INCOMPLETE
- Pattern: `Task(subagent_type="[type]", prompt="[task]", description="[brief]")`

## References

- `references/intent-detection.md` - Detection rules and routing logic
- `references/workflow-steps.md` - Detailed step definitions for all modes
- `references/review-cycle.md` - Interactive and auto review processes
- `references/subagent-patterns.md` - Subagent invocation patterns

## Gotchas

- **Skipping Gate 1 on "simple" features**: Features that seem simple grow during implementation → Always create a plan file; cancel it if truly trivial
- **Context loss between phases**: Long multi-phase workflows exceed context window → Update Agent State section after each phase; next agent reads it first
- **Spinner hiding error output**: Spinner clears the line, masking error messages beneath → Log errors to stderr before spinner.fail()
