# Time Tracking & Work Logging

Patterns for tracking time spent and estimates in Jira via Atlassian MCP.

## Log Work (Worklog)

Add time entry to an issue:
```
Issue: PROJ-123
Time spent: 2h 30m
Started: 2026-04-04T09:00:00.000+0700
Comment: "Implemented auth middleware + unit tests"
```

**Formats:** `1w` (week), `1d` (day), `4h` (hours), `30m` (minutes)

## Original Estimate

Set when creating or updating an issue:
```
Original estimate: 8h
```

Set early — once work is logged, original estimate becomes read-only in some workflows.

## Remaining Estimate

Update as work progresses:
```
Remaining: 2h (auto-calculated if time tracking mode = "automatic")
```

**Modes:**
- Automatic: remaining = original - logged (Jira calculates)
- Manual: set remaining explicitly on each worklog

## Common Patterns

### Sprint velocity from time
```jql
project = PROJ AND sprint in closedSprints() AND timeSpent > 0
ORDER BY timespent DESC
```

### Over-estimate detection
```jql
project = PROJ AND timeSpent > originalEstimate AND status = Done
```

### Unestimated work
```jql
project = PROJ AND sprint in openSprints() AND originalEstimate is EMPTY
```

### Time logged today
```jql
project = PROJ AND worklogDate = startOfDay()
```

## Safety

- Log work: **Low risk** (additive, reversible via delete)
- Modify estimate: **Medium risk** (show old vs new before confirming)
- Delete worklog: **Medium risk** (requires confirmation)

## Gotchas

- Time tracking must be enabled in Jira project settings (admin)
- Original estimate becomes read-only after first worklog in some schemes
- Worklog visibility: may be restricted to certain roles (check project permissions)
- Time format depends on Jira config: `1d` may = 8h or 6h depending on settings
