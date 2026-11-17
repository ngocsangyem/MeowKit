# Parallel Exploration

Patterns for launching multiple sub-task in parallel.

## Parallel Scouting (Explore)

Launch several read-only search sub-tasks when needing to find related files across areas:

```
read-only search sub-task: "Find auth files in src/"
read-only search sub-task: "Find API routes for users"
read-only search sub-task: "Find test files for auth"
```

Spawn ALL in a single message for parallel execution.

## Parallel Verification (Bash)

Launch several command sub-tasks to verify implementation:

```
sub-task: "Run typecheck"
sub-task: "Run lint"
sub-task: "Run build"
```

## When to Use Parallel

| Scenario | Strategy |
|----------|----------|
| Root cause unclear | 2-3 Explore agents on different areas |
| Multi-module fix | Explore each module in parallel |
| After implementation | Bash agents for typecheck + lint + build |
| Before commit | Bash agents for test + build + lint |
| 2+ independent issues | Separate task trees per issue |

## Resource Limits

- Max 6 parallel agents (per mk-scout convention)
- Each sub-task has ~200K token context
- Keep prompts concise — avoid context bloat
- Spawn all in single message, not sequentially
