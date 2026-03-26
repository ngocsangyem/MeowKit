# /budget — Cost Tracking

## Usage

```
/budget
/budget --monthly
/budget --reset
```

## Behavior

Tracks and reports AI model usage costs. Reads from `memory/cost-log.json`.

### Execution Steps

#### Default (no flags)

1. Read `memory/cost-log.json`.
2. Show the last 10 tasks with: task name, complexity tier, model used, estimated token count, estimated cost.
3. Print as a table:
   ```
   🐱 Recent Cost Summary (last 10 tasks):
   ┌──────────────────────┬──────────┬───────────┬────────┬────────┐
   │ Task                 │ Tier     │ Model     │ Tokens │ Cost   │
   ├──────────────────────┼──────────┼───────────┼────────┼────────┤
   │ Add avatar upload    │ Standard │ claude-4  │ 12.4k  │ $0.18  │
   │ Fix login typo       │ Simple   │ haiku     │ 1.2k   │ $0.01  │
   │ Migrate auth service │ Complex  │ claude-4  │ 45.8k  │ $0.68  │
   └──────────────────────┴──────────┴───────────┴────────┴────────┘
   Total (last 10): $1.23
   ```

#### --monthly

1. Read `memory/cost-log.json`.
2. Aggregate entries by month.
3. Print monthly totals:
   ```
   🐱 Monthly Cost Summary:
   ┌────────────┬───────┬────────────┬──────────┐
   │ Month      │ Tasks │ Tokens     │ Cost     │
   ├────────────┼───────┼────────────┼──────────┤
   │ 2026-03    │ 24    │ 156.2k     │ $12.45   │
   │ 2026-02    │ 31    │ 203.8k     │ $16.72   │
   └────────────┴───────┴────────────┴──────────┘
   ```

#### --reset

1. Confirm with human: "This will clear all cost tracking history. Type 'yes' to confirm."
2. If confirmed: clear `memory/cost-log.json` (reset to empty array).
3. If not confirmed: abort.

### Output

Formatted table of cost data from `memory/cost-log.json`. No files are modified (except `--reset`).
