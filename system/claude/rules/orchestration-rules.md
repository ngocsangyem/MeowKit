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
