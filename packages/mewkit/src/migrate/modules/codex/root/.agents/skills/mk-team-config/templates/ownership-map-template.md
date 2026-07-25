# File Ownership Map

Each parallel agent declares which files it owns. No overlap allowed.

## Format

```json
{
  "agents": [
    {
      "name": "developer-1",
      "worktree": ".worktrees/developer-1",
      "branch": "parallel/developer-1",
      "owned_files": [
        "src/api/**/*.ts",
        "src/models/**/*.ts"
      ]
    },
    {
      "name": "developer-2",
      "worktree": ".worktrees/developer-2",
      "branch": "parallel/developer-2",
      "owned_files": [
        "src/ui/**/*.vue",
        "src/composables/**/*.ts"
      ]
    }
  ]
}
```

## Rules

- Glob patterns must not overlap between agents
- If overlap detected, orchestrator restructures before dispatching
- Tester agents own test files only (read impl, never edit)
- Shared files (package.json, tsconfig) → orchestrator handles after merge
