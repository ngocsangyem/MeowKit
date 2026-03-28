---
title: "meow:qa-manual"
description: "Spec-driven manual QA testing and Playwright E2E code generation with human-like browser interaction and auth prompting."
---

# meow:qa-manual

Spec-driven manual QA testing and Playwright E2E code generation with human-like browser interaction and auth prompting.

## What This Skill Does

`meow:qa-manual` serves two use cases with one interaction model. The agent navigates your app like a real human tester — reading the page, clicking elements, filling forms, handling unexpected states. This same human-like navigation powers both: (A) structured QA reports with pass/fail per step, and (B) production-ready Playwright `.spec.ts` files that mirror exactly what a human would do.

The skill orchestrates three browser tools, routing each action to the best one: `playwright-cli` for DOM interaction (because it generates Playwright code as a side-effect), `agent-browser` for auth flows (session persistence), and `browse` for visual verification.

## Core Capabilities

- **Dual output** — QA test report or Playwright E2E code from the same exploration
- **Dynamic skill routing** — Each action uses the best browser tool automatically
- **Auth protocol** — Always prompts for credentials. Never guesses, stores, or skips authentication.
- **Test ID detection** — Scans source for `data-testid`, `data-cy`, `data-test` before generating code
- **Selector verification** — Verifies each `getByTestId()` exists in source, warns if missing
- **Feature folder structure** — Generated code follows: one `test.describe` per file + `common/` folder with Selectors, Assertions, Intercepts

## When to Use This

::: tip Use meow:qa-manual when...
- You have a spec/plan and want to test it like a human would
- You need to generate Playwright E2E tests from a described flow
- You want to explore an app from a URL and discover testable flows
- You need to test an authenticated flow (login, MFA, dashboard access)
:::

## Usage

```bash
# Manual QA from spec — produce pass/fail report
/meow:qa-manual tasks/plans/260315-auth-flow.md --report

# E2E code generation — produce Playwright .spec.ts
/meow:qa-manual tasks/plans/260315-checkout.md --generate

# Auto-detect use case from spec content
/meow:qa-manual tasks/plans/260315-feature.md

# Explore from URL — discover and test flows
/meow:qa-manual https://app.example.com
```

## Example Prompts

| Prompt | Use case | Output |
|--------|----------|--------|
| `/meow:qa-manual tasks/plans/auth.md --report` | Manual QA | Pass/fail report per flow step |
| `/meow:qa-manual tasks/plans/checkout.md --generate` | E2E gen | `tests/e2e/checkout-flow/checkout-flow.spec.ts` + `common/` |
| `/meow:qa-manual https://app.example.com` | Exploration | Discovered flows → QA report |
| `/meow:qa-manual login flow with MFA` | Natural language | Navigates, prompts for MFA code, reports result |

## Quick Workflow

**Use Case A — QA Report:**
```
Spec → Extract flows → Navigate each step
  → Auth encountered? STOP → Prompt user → Continue
  → Verify expected outcomes → Capture evidence on failure
  → Aggregate: pass/fail/skipped per flow
```

**Use Case B — E2E Code:**
```
Same navigation as A, but also:
  → Detect test ID convention (data-testid / data-cy)
  → Record every interaction as Playwright action
  → Generate feature folder: spec.ts + common/ (Selectors, Assertions, Intercepts)
  → Verify selectors exist in source
  → Run: npx playwright test
```

::: info Skill Details
**Phase:** 2–4  
**Used by:** tester agent
:::

## Gotchas

- **Testing against stale deployment**: Running E2E tests against yesterday's build → Verify deployment version matches expected before starting test run
- **Credentials hardcoded in generated spec files**: Auto-generated .spec.ts contains login credentials → Always use environment variables for credentials; never inline in test code

## Related

- [`meow:browse`](/reference/skills/browse) — The headless browser used for QA patterns
- [`meow:qa`](/reference/skills/qa) — Systematic QA with health scoring
- [`meow:review`](/reference/skills/review) — Code review complements QA testing
