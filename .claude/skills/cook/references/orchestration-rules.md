---
source: the toolkit
adapted: yes
adaptation_notes: >
  Extracted delegation context and parallel/sequential chaining rules.
  Added file ownership rule from team-coordination-rules.md.
  Rewritten with WHY explanations per rule-writing principle #2.
---

# Orchestration Rules

These rules apply when the agent spawns subagents or coordinates parallel work.

## Contents

- [Orchestrator Entry Point Rule](#orchestrator-entry-point-rule)
- [Delegation Context](#delegation-context)
- [Responsibilities](#responsibilities)
- [Isolation Boundaries](#isolation-boundaries)
- [Inner Harness Compatibility](#inner-harness-compatibility)
- [File Ownership](#file-ownership)
- [Sequential vs Parallel](#sequential-vs-parallel)
- [Subagent Completion Handling](#subagent-completion-handling)

## Orchestrator Entry Point Rule

Two entry skills run the lifecycle: `mk:cook` (explicit invocation, one scoped task) and `mk:workflow-orchestrator` (auto-invoked on complex-feature intent). `mk:autobuild` is the entry for a green-field product build, and `mk:orchestrate` splits a job across agent CLIs, so neither competes for the same session. To avoid running the same phases twice:

- **Explicit `/mk:cook` invocation** → `mk:cook` owns the full pipeline. `mk:workflow-orchestrator` does NOT activate for the remainder of the session.
- **Session start with complex-feature intent (no explicit invocation)** → `mk:workflow-orchestrator` activates via autoInvoke and routes through the 7-phase flow. It defers to `mk:cook` for single-task requests.
- **Never run both in the same session.** If `mk:cook` is active, `mk:workflow-orchestrator` skips its phase loop.

## Delegation Context

Every subagent prompt carries these, so it can work without your conversation:

1. **Work context path**: the git root of the files being worked on
2. **Plan reference**: path to the active plan file
3. **File ownership**: which files this subagent may modify
4. **Reports path**: `{work_context}/tasks/reports/` when the workflow needs reports
5. **Plans path**: `{work_context}/tasks/plans/` when the workflow needs plans

WHY: Explicit paths and scope prevent wrong-file edits and duplicate work.

If current working directory differs from the project being edited, use the work context paths — not CWD-derived paths.

### Delegation Prompt Template

This is the one canonical template; other files point here.

<!-- shared:delegation-prompt-template -->
```
Task: [specific task description]
Goal: [the outcome this task serves, in one sentence]
Work context: [project path]
Plan: [plan file path or "none"]
Reports: [reports path or "none"]
Plans: [plans path or "none"]
Files to modify: [glob patterns]
Files to read for context: [specific paths]
Acceptance criteria: [binary pass/fail checks]
Fixed constraints: [what must NOT change; user-set or verified]
Current approach: [how the lead expects to do it; open to challenge with file:line evidence]
Return: [the shape of the answer: file path, verdict, or list]
```
<!-- /shared:delegation-prompt-template -->

### Anti-Patterns

| Bad                                   | Good                                                           |
| ------------------------------------- | -------------------------------------------------------------- |
| "Continue from where we left off"     | "Implement X feature per spec in phase-02.md"                  |
| "Fix the issues we discussed"         | "Fix null check in auth.ts:45 (already diagnosed: missing validation; challenge it with file:line evidence)" |
| "Look at the codebase and figure out" | "Read src/api/routes.ts and add POST /users endpoint"          |
| Passing 50+ lines of conversation     | 5-line task summary with file paths                            |

### Use `mk:delegate` to Build the Prompt

For non-trivial delegations, prefer `mk:delegate` to assemble the prompt from the template above. It collects the template fields (Reports and Plans derive from the work context), runs an injection-pattern guard on each user-provided field, and emits a ≤200-token prompt block for review before you paste it into the Agent tool. Compatible with all inner harnesses via `--silent` mode.

Distinct from `mk:team-config` — that one sets up parallel agents in isolated worktrees (Conductor pattern). Use `mk:delegate` to build ONE clean prompt; use `mk:team-config` to coordinate MANY agents on non-overlapping files.

## Responsibilities

Three responsibilities, each held by a part that already exists. Stated here once.

| Responsibility | Held by | Owns | May |
|---|---|---|---|
| **supervisor** | `athena`, under `--advice` only | Cross-scope view of one run, at the checkpoints in `advice-checkpoints.md` (same folder) | Return work to its executor; escalate to the human. Approves nothing and writes nothing |
| **lead** | the session running `mk:cook` | Shared state, the file-ownership split, integration, and one accept-or-return line per subagent result | Accept a result, or return it with the reason |
| **peer** | a worker agent (`developer`, `tester`, `reviewer`, `researcher`) | One scope, the files its brief names | Use the premise exit in its agent file; never call the supervisor |

WHY: a hand-off with no named owner of the next decision loses the decision. Workers cannot reach the supervisor, so a premise that fails goes back to the lead.

## Isolation Boundaries

Five boundary types govern what context crosses between layers. Each row defines what to pass and — equally important — what NOT to pass.

| Boundary | Isolation level | What to pass | What NOT to pass |
|---|---|---|---|
| Session → Subagent | Prompt-only | Task desc + file paths + acceptance criteria + plan ref | Session history, prior conversation, CLAUDE.md contents |
| Orchestrator → Worker | Slim brief | Specific subtask + relevant files + output format | Full plan, other workers' outputs, orchestrator's reasoning chain |
| Plan → Phase | Phase file | Path to `phase-XX-*.md`, plus `plan.md` when the phase depends on cross-phase decisions | Other phases' bodies |
| Memory → Subagent | Matching entries | The entries that matched the task keywords | Entire `.meowkit/memory/` directory |
| Workflow → Step | Step file | Current step content only (JIT) | Prior step files, `workflow.md`, `SKILL.md` preamble |

Boundary violations show up as: subagent does the wrong thing despite a "clear" prompt, then re-reads your conversation to "understand what you really meant." Re-reading is the symptom — the prompt was too thin OR too thick at the boundary.

## Inner Harness Compatibility

The delegation template is inner-harness–agnostic. Inner harnesses vary along three axes that affect how prompts must be assembled:

| Capability | Question to answer per harness |
|---|---|
| Task / Agent tool surface | Can the harness start subagents at all? What is the call shape? |
| Context auto-injection | Which root file (e.g. `CLAUDE.md`, `AGENTS.md`, `gemini.md`) does the harness inject into subagent context automatically, and what is its byte cap? |
| SubagentStart hook | Is the hook surface available? It varies by harness, so check before relying on it. |

Constraints that apply when the inner harness's behavior is unknown or differs from the outer harness:

- Do NOT assume rule files are auto-loaded into subagent context. If the inner harness has a small auto-injection cap (e.g. a 32 KB `AGENTS.md`), delegated prompts must stay lean.
- Pass required rules content EXPLICITLY in the Task prompt if the inner harness will not inject it.
- Use `mk:delegate --silent` when the inner harness cannot ask the user interactively — the silent path emits the template without the wizard.

## File Ownership

Each agent or subagent MUST own distinct files — no overlapping edits.

- Define ownership via file paths in task descriptions
- If two agents need the same file: STOP and have the orchestrator restructure tasks or handle the shared file sequentially
- Tester agents own test files only; they read implementation files but NEVER edit them

WHY: Concurrent same-file edits cause conflicts and lost work.

## Sequential vs Parallel

### Use sequential chaining when:

Tasks have dependencies or require outputs from previous steps.
Pattern: Plan → Test → Implement → Review

### Use parallel execution when:

Tasks are independent with no shared files.
Pattern: Component A + Component B + Tests (separate files)

Plan integration points before starting parallel work, and never start parallel agents that modify the same files.

Subagents receive only the context they need.

Summarize decisions, provide specific paths, and never pass full session history.

### Parallel execution infrastructure

For COMPLEX tasks with independent subtasks:

1. Use `mk:worktree` for git worktree isolation per agent
2. Use `mk:task-queue` for task claiming and ownership enforcement
3. Follow `references/parallel-execution-rules.md` for constraints (max 3 agents, integration test required)
4. Agreeing the plan and reading the review verdict are never parallelized — each is one sequential step with the user

### Party Mode

For architectural discussions and trade-off analysis:

- Use `mk:party` skill for multi-agent deliberation
- Party mode is discussion-only — no code changes during party
- After party decision, resume normal sequential pipeline

## Subagent Completion Handling

Subagents MUST end with the status block defined in `agent-conduct.md` A1.

- `DONE` → proceed to the next step.
- `DONE_WITH_CONCERNS` → address correctness/security concerns before review; track observational debt separately.
- `BLOCKED` → change something before retrying: provide context, simplify the task, escalate model tier, or ask the user.
- `NEEDS_CONTEXT` → provide the missing context and re-dispatch.

For each subagent result the lead writes one line before acting on it: `accepted: {what was checked}` or `returned: {reason}`. An unread result is neither.

A `BLOCKED` or `DONE_WITH_CONCERNS` report that cites `file:line` evidence against the approach or an `[ASSUMPTION]` goes to the lead, who either changes the plan or answers the evidence. A report without evidence is returned.

Never retry the same blocked approach more than 3 times.
