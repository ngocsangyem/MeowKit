# /spawn — Parallel Agent Sessions

## Usage

```
/spawn [agent-role] [task]
```

## Behavior

Launch a specialist agent in an isolated workspace to handle a specific task in parallel. Based on the Conductor pattern.

### Execution Steps

1. **Validate prerequisites.**
   - An approved plan must exist (agents inherit the plan).
   - The task must be scoped to non-overlapping files (no two agents work on the same file).
   - Ownership boundaries from team-protocol are enforced.

2. **Launch specialist agent.** Create an isolated session with:
   - The agent role (e.g., `backend`, `frontend`, `tester`, `documenter`)
   - The specific task to complete
   - The approved plan for context
   - File ownership boundaries (which files this agent may touch)

3. **Agent execution.** The spawned agent:
   - Works within its assigned file boundaries
   - Follows the same rules (TDD, security, naming conventions)
   - Cannot modify files outside its ownership boundary
   - Produces output that will be reviewed before merging

4. **Review results.** When the spawned agent completes:
   - Review its output against the plan
   - Check for conflicts with other agents' work
   - Merge results back into the main workspace

### Common Patterns

```
# Backend + frontend in parallel
/spawn backend "Implement user avatar API endpoint"
/spawn frontend "Build avatar upload component"

# Tests + docs in parallel
/spawn tester "Write integration tests for avatar feature"
/spawn documenter "Update API docs for avatar endpoint"
```

### Rules

- Spawned agents inherit the approved plan — they do not create their own plans.
- Each agent works on non-overlapping files. If two agents need the same file, one must wait.
- Ownership boundaries from team-protocol are strictly enforced.
- All spawned agent output is reviewed before merging back to the main workspace.
- If an agent encounters an issue outside its boundary, it flags it and stops (does not fix it).

### Output

- Spawned agent session with role, task, and file boundaries
- Agent progress updates
- Final output for review before merge
