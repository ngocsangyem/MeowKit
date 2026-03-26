# Subagent Patterns

Standard patterns for spawning agents in cook workflows.

## Agent Tool Pattern
```
Agent(subagent_type="[type]", prompt="[task]", description="[brief]")
```

## By Phase

### Research
```
Agent(subagent_type="researcher", prompt="Research [topic]. Report concisely.", description="Research")
```

### Scout
```
Use meow:scout skill for parallel codebase exploration.
```

### Planning
```
Agent(subagent_type="planner", prompt="Create plan based on research. Save to tasks/plans/", description="Plan")
```

### Implementation
Developer agent handles implementation per plan phases.

### Testing
```
Agent(subagent_type="tester", prompt="Run test suite", description="Test")
```

### Review
```
Agent(subagent_type="reviewer", prompt="Review changes. 5-dimension audit.", description="Review")
```

### Documentation
```
Agent(subagent_type="documenter", prompt="Update docs for changes", description="Docs")
```

### Ship
```
Agent(subagent_type="shipper", prompt="Commit and create PR", description="Ship")
```

## Parallel Execution

For parallel mode, spawn multiple developer agents with file ownership:
```
Agent("developer", prompt="Implement phase-01. Files: [list]", description="Phase 1")
Agent("developer", prompt="Implement phase-02. Files: [list]", description="Phase 2")
```

Each agent gets distinct file ownership — no overlap.
