# Skill: Token Usage and Cost Tracking

**Purpose:** Track token usage per task to provide visibility into AI costs and enable budget management.

## When to Use

- **Before every task:** Log the estimated complexity tier and model.
- **After every task:** Append actual usage to the cost log.
- **On `/budget` command:** Display cost summary.

---

## Before Task: Estimate Complexity

At the start of each task, assess the complexity tier:

| Tier | Description | Estimated Tokens |
|------|-------------|-----------------|
| `trivial` | Single file read/edit, simple question | 1K-5K |
| `standard` | Multi-file change, moderate reasoning | 5K-20K |
| `complex` | Architecture work, large refactor, multi-step research | 20K-100K |
| `intensive` | Full codebase analysis, complex debugging, plan generation | 100K+ |

Print the estimate:
```
Task tier: [standard] | Model: [claude-opus-4-6]
```

## After Task: Log Usage

Append an entry to `memory/cost-log.json` (create if it does not exist).

**Schema:**
```json
{
  "entries": [
    {
      "date": "YYYY-MM-DD",
      "time": "HH:MM",
      "command": "description of what was asked",
      "tier": "trivial | standard | complex | intensive",
      "estimated_tokens": 10000,
      "task_summary": "brief summary of what was done"
    }
  ]
}
```

**Rules:**
- Always append, never overwrite existing entries.
- Keep command descriptions concise (under 50 characters).
- Task summary should be 1 sentence.
- If the task was abandoned or failed, still log it (add `"status": "failed"` or `"status": "abandoned"`).

## `/budget` Command

When the user invokes `/budget`, read `memory/cost-log.json` and display:

### Last N Entries (default: 10)

```
Date       | Command                  | Tier     | Est. Tokens | Summary
-----------+--------------------------+----------+-------------+---------------------------
2026-03-25 | implement auth module    | complex  | 50,000      | Added JWT auth with guards
2026-03-25 | fix login bug            | standard | 10,000      | Fixed token refresh logic
2026-03-24 | review PR #42            | standard | 15,000      | Reviewed payment module PR
```

### Monthly Aggregation

```
Month      | Tasks | Trivial | Standard | Complex | Intensive | Est. Total Tokens
-----------+-------+---------+----------+---------+-----------+------------------
2026-03    | 45    | 10      | 25       | 8       | 2         | 850,000
2026-02    | 38    | 12      | 20       | 5       | 1         | 620,000
```

### All-Time Total

```
Total tasks: 83
Total estimated tokens: 1,470,000
Average tokens per task: 17,711
Most common tier: standard (54%)
```

---

## Example cost-log.json

```json
{
  "entries": [
    {
      "date": "2026-03-25",
      "time": "14:30",
      "command": "implement auth module",
      "tier": "complex",
      "estimated_tokens": 50000,
      "task_summary": "Added JWT authentication with guards and role-based access control"
    },
    {
      "date": "2026-03-25",
      "time": "16:00",
      "command": "fix login bug",
      "tier": "standard",
      "estimated_tokens": 10000,
      "task_summary": "Fixed token refresh logic that caused logout on page reload"
    }
  ]
}
```

## Validation

- [ ] cost-log.json is valid JSON after every append
- [ ] Every task has an entry (including failed/abandoned tasks)
- [ ] Tier assessment is reasonable for the task complexity
- [ ] `/budget` output is formatted as a readable table
