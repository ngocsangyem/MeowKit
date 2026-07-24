# Complexity Assessment

Classify issue complexity before routing to workflow.

## Classification Criteria

### Simple (→ workflow-quick.md) — No Task Tracking

**Indicators:**
- Single file affected
- Clear error message (type error, syntax, lint)
- Keywords: `type`, `typescript`, `tsc`, `lint`, `eslint`, `syntax`
- Obvious fix location
- No investigation needed

**Examples:** "Fix type error in auth.ts", "ESLint errors after upgrade"

### Moderate (→ workflow-standard.md) — Use Task Tracking

**Indicators:**
- 2-5 files affected
- Root cause unclear but localized
- Needs debugging investigation
- Keywords: `bug`, `broken`, `not working`, `fails sometimes`

**Examples:** "Login sometimes fails", "API returns wrong data"

### Complex (→ workflow-deep.md) — Use Task Tracking with Dependencies

**Indicators:**
- System-wide impact (5+ files)
- Architecture decision needed
- Research required for solution
- Keywords: `architecture`, `refactor`, `system-wide`, `design issue`
- Performance/security vulnerabilities

**Examples:** "Memory leak in production", "Security vulnerability in auth flow"

### Parallel — Use Separate Task Trees

**Triggers:**
- `--parallel` flag explicitly passed
- 2+ independent issues in different areas
- No dependencies between issues

**Examples:** "Fix type errors AND update UI styling", "Auth bug + payment issue"
