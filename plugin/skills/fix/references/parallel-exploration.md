# Parallel Exploration

Patterns for launching multiple subagents in parallel.

## Parallel Scouting (Explore)

Launch multiple Explore subagents when needing to find related files across areas:

```
Agent(subagent_type="Explore", prompt="Find auth files in src/", description="Scout auth")
Agent(subagent_type="Explore", prompt="Find API routes for users", description="Scout API")
Agent(subagent_type="Explore", prompt="Find test files for auth", description="Scout tests")
```

Spawn ALL in a single message for parallel execution.

## Parallel Verification (Bash)

Launch multiple Bash subagents to verify implementation:

```
Agent(subagent_type="Bash", prompt="Run typecheck", description="Verify types")
Agent(subagent_type="Bash", prompt="Run lint", description="Verify lint")
Agent(subagent_type="Bash", prompt="Run build", description="Verify build")
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

- Max 6 parallel agents (per mk:scout convention)
- Each subagent has ~200K token context
- Keep prompts concise — avoid context bloat
- Spawn all in single message, not sequentially
