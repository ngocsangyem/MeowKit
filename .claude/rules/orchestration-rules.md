---
source: claudekit-engineer
adapted: yes
adaptation_notes: >
  Extracted delegation context and parallel/sequential chaining rules.
  Added file ownership rule from team-coordination-rules.md.
  Rewritten with WHY explanations per rule-writing principle #2.
---

# Orchestration Rules

These rules apply when the agent spawns subagents or coordinates parallel work.

## Delegation Context

When spawning a subagent, ALWAYS include in the prompt:

1. **Work context path**: the git root of the files being worked on
2. **Plan reference**: path to the active plan file
3. **File ownership**: which files this subagent may modify

WHY: Subagents start with zero context. Without explicit paths and scope,
they read wrong files, write to wrong locations, or duplicate work.

### Pre-Delegation Checklist

Before spawning any subagent, verify you have included:

- [ ] **Work context path** — git root of the files being worked on
- [ ] **Plan reference** — path to the active plan file (or "none" if ad-hoc)
- [ ] **File ownership** — glob patterns for files this subagent may modify
- [ ] **Acceptance criteria** — how to verify the subagent's work is complete
- [ ] **Constraints** — what the subagent must NOT change or touch

### Delegation Prompt Template

```
Task: [specific task description]
Work context: [project path]
Plan: [plan file path or "none"]
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

## File Ownership

Each agent or subagent MUST own distinct files — no overlapping edits.

- Define ownership via file paths in task descriptions
- If two agents need the same file: STOP and escalate to the user
- Tester agents own test files only; they read implementation files but NEVER edit them

WHY: Concurrent edits to the same file cause merge conflicts and lost work.

## Sequential vs Parallel

### Use sequential chaining when:

Tasks have dependencies or require outputs from previous steps.
Pattern: Plan → Test → Implement → Review

### Use parallel execution when:

Tasks are independent with no shared files.
Pattern: Component A + Component B + Tests (separate files)

ALWAYS plan integration points before starting parallel work.
NEVER start parallel agents that modify the same files.

### Parallel execution infrastructure (Week 2 addition)

For COMPLEX tasks with independent subtasks:

1. Use `meow:worktree` for git worktree isolation per agent
2. Use `meow:task-queue` for task claiming and ownership enforcement
3. Follow `parallel-execution-rules.md` for constraints (max 3 agents, integration test required)
4. Gates (1 and 2) are NEVER parallelized — always sequential, always human-approved

### Party Mode (Week 2 addition)

For architectural discussions and trade-off analysis:

- Use `meow:party` skill for multi-agent deliberation
- Party mode is discussion-only — no code changes during party
- After party decision, resume normal sequential pipeline
