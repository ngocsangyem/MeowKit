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

## Orchestrator Entry Point Rule

Two orchestrators exist — `mk:cook` (explicit invocation, single-task pipeline) and `mk:workflow-orchestrator` (auto-invoked on complex-feature intent). Arbitration to avoid duplicate gate enforcement:

- **Explicit `/mk:cook` invocation** → `mk:cook` owns the full pipeline. `mk:workflow-orchestrator` does NOT activate for the remainder of the session.
- **Session start with complex-feature intent (no explicit invocation)** → `mk:workflow-orchestrator` activates via autoInvoke and routes through the 7-phase flow. It defers to `mk:cook` for single-task requests.
- **Never run both in the same session.** If `mk:cook` is active, `mk:workflow-orchestrator` skips its phase loop.

## Delegation Context

When spawning a subagent, ALWAYS include in the prompt:

1. **Work context path**: the git root of the files being worked on
2. **Plan reference**: path to the active plan file
3. **File ownership**: which files this subagent may modify
4. **Reports path**: `{work_context}/tasks/reports/` when the workflow needs reports
5. **Plans path**: `{work_context}/tasks/plans/` when the workflow needs plans

WHY: Explicit paths and scope prevent wrong-file edits and duplicate work.

If current working directory differs from the project being edited, use the work context paths — not CWD-derived paths.

### Pre-Delegation Checklist

Before spawning any subagent, verify you have included:

- [ ] **Work context path** — git root of the files being worked on
- [ ] **Plan reference** — path to the active plan file (or "none" if ad-hoc)
- [ ] **Reports path** — `tasks/reports/` under work context (or "none")
- [ ] **Plans path** — `tasks/plans/` under work context (or "none")
- [ ] **File ownership** — glob patterns for files this subagent may modify
- [ ] **Acceptance criteria** — how to verify the subagent's work is complete
- [ ] **Constraints** — what the subagent must NOT change or touch

### Delegation Prompt Template

```
Task: [specific task description]
Work context: [project path]
Plan: [plan file path or "none"]
Reports: [reports path or "none"]
Plans: [plans path or "none"]
Files to modify: [glob patterns]
Files to read for context: [specific paths]
Acceptance criteria: [binary pass/fail checks]
Constraints: [what must NOT change]
```

### Anti-Patterns

| Bad                                   | Good                                                           |
| ------------------------------------- | -------------------------------------------------------------- |
| "Continue from where we left off"     | "Implement X feature per spec in phase-02.md"                  |
| "Fix the issues we discussed"         | "Fix null check in auth.ts:45, root cause: missing validation" |
| "Look at the codebase and figure out" | "Read src/api/routes.ts and add POST /users endpoint"          |
| Passing 50+ lines of conversation     | 5-line task summary with file paths                            |

### Use `mk:delegate` to Build the Prompt

For non-trivial delegations, prefer `/mk:delegate` to assemble the prompt from the template above. The command wizards through the 7 required fields, runs an injection-pattern guard on each user-provided field, and emits a ≤200-token prompt block for review before you paste into the Task tool. Compatible with all inner harnesses via `--silent` mode.

Distinct from `mk:spawn` — that command launches parallel agents in isolated worktrees (Conductor pattern). Use `mk:delegate` to build ONE clean prompt; use `mk:spawn` to coordinate MANY agents on non-overlapping files.

## Isolation Boundaries

Five boundary types govern what context crosses between layers. Each row defines what to pass and — equally important — what NOT to pass.

| Boundary | Isolation level | What to pass | What NOT to pass |
|---|---|---|---|
| Session → Subagent | Prompt-only | Task desc + file paths + acceptance criteria + plan ref | Session history, prior conversation, CLAUDE.md contents |
| Orchestrator → Worker | Slim brief | Specific subtask + relevant files + output format | Full plan, other workers' outputs, orchestrator's reasoning chain |
| Plan → Phase | Phase file | Path to `phase-XX-*.md` | Full `plan.md` + all other phase files |
| Memory → Subagent | Named files | Specific topic file paths needed for task | Entire `.claude/memory/` directory |
| Workflow → Step | Step file | Current step content only (JIT) | Prior step files, `workflow.md`, `SKILL.md` preamble |

Boundary violations show up as: subagent does the wrong thing despite a "clear" prompt, then re-reads your conversation to "understand what you really meant." Re-reading is the symptom — the prompt was too thin OR too thick at the boundary.

## Inner Harness Compatibility

The delegation template is inner-harness–agnostic. Inner harnesses vary along three axes that affect how prompts must be assembled:

| Capability | Question to answer per harness |
|---|---|
| Task / Agent tool surface | Does the harness expose a way to spawn a subagent? What is the call shape? |
| Context auto-injection | Which root file (e.g. `CLAUDE.md`, `AGENTS.md`, `gemini.md`) does the harness inject into subagent context automatically, and what is its byte cap? |
| SubagentStart hook | Is the hook surface available? On most harnesses it is NOT, because hooks fire inside subagents and infinite-loop. |

Constraints that apply when the inner harness's behavior is unknown or differs from the outer harness:

- Do NOT assume rule files are auto-loaded into subagent context. If the inner harness has a small auto-injection cap (e.g. a 32 KB `AGENTS.md`), delegated prompts must stay lean.
- Pass required rules content EXPLICITLY in the Task prompt if the inner harness will not inject it.
- Use `mk:delegate --silent` when interactive prompts via `AskUserQuestion` are not supported by the inner harness — the silent path emits the template without the wizard.

## Rejected Patterns

Patterns deliberately NOT implemented in the toolkit, with the reason each was rejected.

| Rejected pattern | Why rejected |
|---|---|
| `SubagentStart` hook for subagent context injection | Hooks fire inside subagents → infinite-loop risk (verified in `HOOKS_INDEX.md`). |
| `PreToolUse:Task` hook validating subagent prompts | Violates outer-harness principle. Could break legitimate Task calls. Make-correct-path-easy beats block-incorrect-path. |
| Per-task memory namespaces | Over-engineering. The 5 boundary types above (Isolation Boundaries) already cover the leakage paths; namespacing memory adds complexity without measured benefit. |
| AI OS / agent runtime abstraction layer | The toolkit is the outer harness, not a runtime replacement. An abstraction layer would silently break inner-harness diversity — the harness contract is whatever the host runtime exposes, not a wrapper. |
| Vector embedding / external memory store | YAGNI. `.claude/memory/` topic files already cover the toolkit's recall needs. |

Documented here so future contributors recognize these as decided trade-offs, not gaps awaiting implementation.

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

ALWAYS plan integration points before starting parallel work.
NEVER start parallel agents that modify the same files.

Subagents receive only the context they need.

Summarize decisions, provide specific paths, and never pass full session history.

### Parallel execution infrastructure (Week 2 addition)

For COMPLEX tasks with independent subtasks:

1. Use `mk:worktree` for git worktree isolation per agent
2. Use `mk:task-queue` for task claiming and ownership enforcement
3. Follow `parallel-execution-rules.md` for constraints (max 3 agents, integration test required)
4. Gates (1 and 2) are NEVER parallelized — always sequential, always human-approved

### Party Mode (Week 2 addition)

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

Never retry the same blocked approach more than 3 times.
