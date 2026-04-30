---
title: QA Testing
description: Manual QA testing and Playwright E2E code generation with browser automation.
persona: B
---

# QA Testing

> Spec-driven testing with structured reports or production-ready Playwright code.

**Best for:** Pre-release testing, E2E automation  
**Time estimate:** 15-45 minutes  
**Skills used:** [mk:qa-manual](/reference/skills/qa-manual), [mk:qa](/reference/skills/qa), [mk:browse](/reference/skills/browse)  
**Browser skills:** [mk:agent-browser](/reference/skills/agent-browser), [mk:playwright-cli](/reference/skills/playwright-cli)

## Overview

MeowKit offers two QA approaches: **mk:qa** (find bugs + fix them + verify fixes) and **mk:qa-manual** (spec-driven testing with reports or E2E code generation). Both use browser automation under the hood.

## Manual QA report

### Step 1: Run from spec

```
/mk:qa-manual tasks/plans/260327-auth.md --report
```

### Step 2: Agent navigates like a human

The skill routes each action to the best browser tool:
- **DOM interaction** → [mk:playwright-cli](/reference/skills/playwright-cli) (generates PW code as side-effect)
- **Auth flows** → [mk:agent-browser](/reference/skills/agent-browser) (session persistence)
- **Visual checks** → [mk:agent-browser](/reference/skills/agent-browser) (annotated screenshots)

### Step 3: Auth handling

When the agent encounters a login page:

```
⚠️ Authentication required at: https://app.example.com/login
mk:qa-manual needs credentials to continue.
Please provide:
- Email: ___________
- Password: ___________
Type 'skip' to skip this flow or 'abort' to stop testing.
```

The agent **never** guesses credentials. You provide them, it fills the form and continues.

### Step 4: Review the report

```markdown
## QA Manual Test Report
Spec: tasks/plans/260327-auth.md
Tested at: 2026-03-27 14:30 UTC

| Flow | Steps | Passed | Failed | Status |
|------|-------|--------|--------|--------|
| Login | 5 | 5 | 0 | PASS |
| Password reset | 4 | 3 | 1 | FAIL |

### Failed: Password reset — Step 3
Expected: "Reset email sent" message
Actual: 500 Internal Server Error
Evidence: /tmp/password-reset-error.png
```

## E2E code generation

```
/mk:qa-manual tasks/plans/260327-checkout.md --generate
```

Same navigation, but outputs `.spec.ts` files with role-based locators (`getByTestId`, `getByRole`, `getByLabel`).

## Systematic QA (find + fix)

```
/mk:qa https://app.example.com
```

The [mk:qa](/reference/skills/qa) skill goes further: it finds bugs, fixes them in source code, commits each fix atomically, re-verifies, and produces a before/after health score.

## Next workflow

→ [Documentation](/workflows/documentation) — keep docs in sync
