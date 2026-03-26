---
title: Writing Tests
description: Write unit tests and E2E tests following TDD methodology.
persona: B
---

# Writing Tests

> Add meaningful test coverage with TDD enforcement.

**Best for:** Improving coverage, TDD practice  
**Time estimate:** 10-30 minutes  
**Skills used:** [meow:qa-manual](/reference/skills/qa-manual) (E2E), [meow:review](/reference/skills/review) (coverage audit)  
**Agents involved:** tester, developer (if implementation needed)

## Overview

MeowKit enforces TDD — tests must exist and fail BEFORE implementation. This workflow covers both adding unit tests to existing code and generating E2E tests from user flows.

## Unit tests (TDD)

### Step 1: Write failing tests first

The **tester** writes tests that define expected behavior:

```
/meow:cook add input validation to user registration
```

The tester writes tests BEFORE the developer touches implementation:

```typescript
// tests/user-registration.test.ts (tester creates this)
test('rejects email without @ symbol', () => {
  expect(validateEmail('invalid')).toBe(false);
});

test('rejects password shorter than 8 characters', () => {
  expect(validatePassword('short')).toBe(false);
});
```

These tests **fail** — the validation functions don't exist yet.

### Step 2: Developer implements to pass

The **developer** writes the minimum code to make tests green.

### Step 3: Refactor

Both tester and developer refine — tests still pass after each change.

## E2E tests (Playwright)

### Step 1: Generate from spec

```
/meow:qa-manual tasks/plans/260327-checkout.md --generate
```

The [meow:qa-manual](/reference/skills/qa-manual) skill:
1. Navigates the app like a human tester
2. Records every interaction as Playwright TypeScript code
3. Detects test ID convention (`data-testid` or `data-cy`)
4. Generates feature folder structure:

```
tests/e2e/checkout-flow/
├── common/
│   ├── checkoutSelectors.ts      # All locators centralized
│   ├── checkoutAssertions.ts     # Reusable assertions
│   └── checkoutIntercepts.ts     # API mocks
└── checkout-flow.spec.ts         # One describe block
```

### Step 2: Verify selectors exist

The skill greps the source to verify each `getByTestId()` actually exists:

```bash
grep -rn 'data-testid="checkout-btn"' src/ → Found ✓
grep -rn 'data-testid="place-order"' src/ → Found ✓
```

Missing selectors get a warning comment and fallback locator.

### Step 3: Run the generated tests

```bash
npx playwright test tests/e2e/checkout-flow/
```

## Coverage audit

The [meow:review](/reference/skills/review) skill includes a test coverage audit (Step 4.75) that:
1. Traces code paths through your changes
2. Maps user flows to test scenarios
3. Identifies untested paths
4. Auto-generates tests for gaps

## Next workflow

→ [QA Testing](/workflows/qa-testing) — manual QA with structured reports
