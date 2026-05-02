---
title: "mk:testing"
description: "Test writing toolkit — TDD red-green-refactor, validation scripts, visual QA, and E2E best practices. Used by the tester agent during Phase 2-3."
---

# mk:testing — Testing Toolkit

## What This Skill Does

Provides a complete testing reference suite for the `tester` agent, covering the full testing lifecycle: TDD red-green-refactor, deterministic validation scripts, browser-based visual QA, and end-to-end test best practices.

## When to Use

- **Phase 2 (Test):** Writing tests. In TDD mode (`--tdd` / `MEOWKIT_TDD=1`), failing tests MUST be written first. In default mode (TDD off), tests may be written in any order.
- **Phase 3 (Build):** Verifying implementation passes all tests.
- When the `tester` agent needs testing patterns and tool-specific guidance.
- For visual QA testing of web applications after UI changes.

**NOT for:** coverage gap mapping (use `mk:nyquist`), sprint contract negotiation (use `mk:sprint-contract`).

## Core Capabilities

### TDD Red-Green-Refactor Cycle (`references/red-green-refactor.md`)

**In TDD mode (`--tdd` / `MEOWKIT_TDD=1`):**
- **RED:** Write a failing test before implementation. The test must compile, execute, and fail because behavior is missing — not from syntax errors, import errors, or runtime crashes.
- **GREEN:** Write the MINIMUM code to pass. No optimization, no extra features.
- **REFACTOR:** Improve structure without changing behavior. Run tests after EACH refactor step. Safe: extract functions, rename, remove duplication. Unsafe: adding behavior, changing signatures.

**In default mode (TDD off):** The cycle is opt-in guidance. Tests may be written before, alongside, or after implementation.

**Unit vs Integration TDD differences:**

| Aspect | Unit Tests | Integration Tests |
|--------|-----------|------------------|
| RED | Mock dependencies, test logic | Set up test environment, test flow |
| GREEN | Implement single unit | Implement and wire up components |
| REFACTOR | Refactor unit internals | Refactor wiring and interfaces |
| Run frequency | After every change | After completing a feature unit |

### Deterministic Validation Scripts (`references/validation-scripts.md`)

Two scripts provide ground-truth validation independent of LLM judgment. Must pass (exit 0) before shipping.

**`.claude/scripts/validate.py`** — checks: type errors, lint violations, test suite passes, build succeeds, no TODO/FIXME/HACK without linked issue, no debug statements (`console.log`, `print`, `debugger`).

**`.claude/scripts/security-scan.py`** — checks: no secrets in code, no raw SQL with string interpolation, no `eval()`, no known critical dependency vulnerabilities, safe env var access, auth guards on protected routes.

Run at two mandatory gates: Phase 4 (Review) and Pre-Ship.

### Visual QA (`references/visual-qa.md`)

6-step browser-based UI verification:

1. Start browser session (Playwright headless)
2. Navigate to target URL (dev server must be running)
3. Screenshot at 3 breakpoints: 375px (mobile), 768px (tablet), 1280px (desktop)
4. Compare layout: content visibility, layout integrity, responsive behavior, interactive states
5. Check runtime: console errors, failed network requests (4xx/5xx), unhandled rejections, missing assets
6. Generate report at `qa/reports/visual-qa-[date].md`

**Verdict:** PASS = no console errors, no failed requests, no layout issues at any breakpoint. FAIL = any check fails.

### E2E Best Practices (`references/e2e-best-practices.md`)

**Tool preference:** Agent Browser (`mk:agent-browser`) > Playwright > Puppeteer (last resort).

**Locator strategy (priority):**
1. `data-testid="submit-button"` — stable, unaffected by style/content changes
2. Semantic: `getByRole('button', { name: 'Submit' })`, `getByLabel('Email')` — tests accessibility too
3. CSS: `.submit-btn` — acceptable if testid unavailable
4. XPath: **avoid** — brittle, breaks on minor DOM changes

**Wait strategy:** Always wait for conditions, never for time. `waitForTimeout` is BANNED in CI.

**Flaky test protocol:** Confirm flakiness (3-5 isolated runs) → mark as `test.fixme()` with linked issue → investigate root cause → fix root cause → remove fixme marker. Never delete a flaky test.

**Success metrics:**

| Metric | Target | Alert Threshold |
|---|---|---|
| Critical journey coverage | 100% | Any gap blocks ship |
| Overall E2E pass rate | >95% | <90% blocks ship |
| Flaky test rate | <5% of suite | >10% requires triage |
| CI suite duration | <10 minutes | >15 min requires parallelization |

## Gotchas

- **Mocks hiding integration failures:** All mocked tests pass but real service calls fail. Use integration tests for critical paths; mock only external third-party services.
- **Test coverage gamed by trivial assertions:** 100% coverage with `expect(true).toBe(true)`. Measure mutation testing score alongside coverage; flag tests with zero assertions.

## Example Prompts

- "Write a test for the user login endpoint using red-green-refactor"
- "Run validation scripts after the latest changes"
- "Do a visual QA check on the dashboard at all three breakpoints"
- "Add E2E tests for the checkout flow following best practices"

## Pro Tips

- The `e2e-best-practices.md` reference is essential reading before writing any E2E test — its locator and wait strategies prevent the most common flaky test patterns.
- Run `validate.py` and `security-scan.py` as a pair — both must exit 0 before shipping, no exceptions.
- Visual QA catches issues tests miss: overlapping elements at mobile breakpoints, missing assets, console errors.