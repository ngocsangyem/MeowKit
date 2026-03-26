# Example 1: Login Flow — Manual QA Report

## Input

```
/meow:qa-manual tasks/plans/260315-auth-flow.md --report
```

Spec extract from plan:
```
## User Flow: Login
1. Navigate to /login
2. Enter email: user@example.com
3. Enter password
4. Click "Sign In"
5. Verify: dashboard loads with user's name displayed
```

## Execution

```
Step 1: meow:playwright-cli goto https://app.example.com/login
Step 2: meow:playwright-cli snapshot → finds @e1 [textbox "Email"]
Step 3: ⚠️ Authentication required at: https://app.example.com/login

  meow:qa-manual needs credentials to continue.
  Please provide:
  - Email: ___________
  - Password: ___________
  Type 'skip' to skip this flow or 'abort' to stop testing.

User enters: user@example.com / ••••••••

Step 4: meow:playwright-cli fill e1 "user@example.com"
Step 5: meow:playwright-cli fill e2 [password]
Step 6: meow:playwright-cli click e3 (Sign In button)
Step 7: meow:playwright-cli snapshot → verify dashboard content
Step 8: meow:agent-browser screenshot /tmp/dashboard-after-login.png
```

## Output

```markdown
## QA Manual Test Report

**Spec:** tasks/plans/260315-auth-flow.md
**Tested at:** 2026-03-27 14:30 UTC
**Browser:** Chromium via playwright-cli
**Base URL:** https://app.example.com

### Flow Results

| Flow | Steps | Passed | Failed | Skipped | Status |
|------|-------|--------|--------|---------|--------|
| Login | 5 | 5 | 0 | 0 | PASS |

### Summary

Total flows: 1 | Passed: 1 | Failed: 0 | Skipped: 0
**Verdict:** PASS
```
