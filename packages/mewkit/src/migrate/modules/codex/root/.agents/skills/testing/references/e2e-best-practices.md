# E2E Best Practices

Standards for writing reliable, maintainable end-to-end tests.

## Tool Preference

1. **Agent Browser** (first choice) — use for exploratory QA and visual verification via `mk:agent-browser`
2. **Playwright** (second choice) — use for automated regression suites requiring code-level control
3. **Puppeteer** (last resort) — use only if Playwright is unavailable in the project

## Locator Strategy (in priority order)

1. `data-testid="submit-button"` — stable, explicit, unaffected by style or content changes
2. Semantic selectors: `getByRole('button', { name: 'Submit' })`, `getByLabel('Email')` — tests accessibility too
3. CSS selectors: `.submit-btn` — acceptable if testid is not available and semantics don't apply
4. XPath: avoid — brittle, hard to read, breaks on minor DOM changes

Never select by position (`nth-child(3)`) or by text content that is likely to change.

## Wait Strategy

**Always wait for conditions, never for time.**

```typescript
// Correct: wait for network response
await page.waitForResponse(resp => resp.url().includes('/api/users') && resp.status() === 200)

// Correct: wait for element state
await page.waitForSelector('[data-testid="success-toast"]', { state: 'visible' })

// Wrong: arbitrary sleep
await page.waitForTimeout(2000) // Never do this
```

`waitForTimeout` is banned in CI. It causes flaky tests and masks real timing issues.

## Test Isolation

Each test must be independent. No test may depend on state left by another test.

- Create all required data in `beforeEach` or within the test itself
- Clean up in `afterEach` or use isolated test accounts
- Never share browser storage, cookies, or DB state between tests
- Tests must pass in any order, including when run individually

## Flaky Test Protocol

A flaky test is one that passes and fails without code changes.

1. Run the test 3-5 times locally in isolation to confirm flakiness
2. Mark as `test.fixme()` with a linked issue: `test.fixme(true, 'Flaky: #234 — race condition on nav')`
3. Investigate root cause: most flakiness comes from race conditions, animation timing, or network variability
4. Fix the root cause, then remove the `fixme` marker

Never delete a flaky test. Never merge code that makes a previously-stable test flaky.

## Artifact Collection

Collect evidence at key moments:

- Screenshot at the start of every critical journey
- Screenshot immediately after every critical action (form submit, payment, auth)
- On test failure: automatic screenshot + trace (configure in `playwright.config.ts`)
- In CI: enable video recording on retry (`video: 'on-first-retry'`)

## Page Object Model

Extract repeated interactions into reusable classes. Reduces duplication and makes tests readable.

```typescript
// page-objects/login-page.ts
export class LoginPage {
  constructor(private page: Page) {}

  async login(email: string, password: string) {
    await this.page.getByLabel('Email').fill(email)
    await this.page.getByLabel('Password').fill(password)
    await this.page.getByRole('button', { name: 'Sign in' }).click()
    await this.page.waitForURL('/dashboard')
  }
}
```

Use POM for: login, navigation, form submission, and any flow used in 3+ tests.

## Success Metrics

| Metric | Target | Alert Threshold |
|---|---|---|
| Critical journey coverage | 100% | Any gap blocks ship |
| Overall E2E pass rate | >95% | <90% blocks ship |
| Flaky test rate | <5% of suite | >10% requires triage sprint |
| CI suite duration | <10 minutes | >15 min requires parallelization |
