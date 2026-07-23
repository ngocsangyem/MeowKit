# Log Analysis Fix Workflow

For issues discovered through log analysis (server logs, application logs, error tracking).

## Steps

### Step 1: Collect Logs
- Identify log source (server, application, CI/CD, monitoring)
- Filter to relevant timeframe
- Extract error patterns (grep for ERROR, FATAL, exception, stack trace)

### Step 2: Correlate
- Match log entries to code paths
- Identify frequency and pattern (one-time vs recurring)
- Check if multiple errors are related (same root cause)

### Step 3: Trace to Root Cause
- Follow stack traces to source files
- Use `mk:investigate` for systematic debugging
- Check for: race conditions, resource exhaustion, external service failures

### Step 4: Fix
Route to appropriate workflow based on complexity:
- Single file → `references/workflow-quick.md`
- Multi-file → `references/workflow-standard.md`
- System-wide → `references/workflow-deep.md`

### Step 5: Add Monitoring
- Add structured logging at the failure point
- Add alerts/checks to prevent silent recurrence
