---
title: Vue Test-Smells Review Rubric — Severity-Tagged Checklist
impact: HIGH
impactDescription: A shared rubric makes test reviews consistent and keeps the review output bounded and actionable
type: rubric
tags: [vue3, testing, review, test-smells, rubric, severity, vitest, vue-test-utils]
---

# Vue Test-Smells Review Rubric — Severity-Tagged Checklist

**Impact: HIGH** - This rubric backs the skill's **Vue Testing Review** output. Walk each row
against the test code; emit one finding per real smell as
`[severity] · file:line · smell · fix`. Severity vocabulary: `critical | high | medium | low`.
Omit rows that don't apply — do not pad.

## Severity Meaning

- **critical** — the test cannot prove correctness (always passes, or passes while behavior is broken).
- **high** — the test flakes or misses a likely-regressing path.
- **medium** — brittle or implementation-coupled; breaks on safe refactors.
- **low** — style/clarity; no correctness impact.

## Rubric

| # | Smell | Severity | Detection | Fix |
| --- | --- | --- | --- | --- |
| 1 | Snapshot-only assertion | critical | A test whose only assertion is `toMatchSnapshot()` | Pair with behavioral asserts (text/role/emitted) — `testing-no-snapshot-only.md` |
| 2 | Tautological / no-assertion test | critical | `expect(true).toBe(true)`, or no `expect` at all | Assert observable output, emitted events, or visible state |
| 3 | Missing `await` on async update | high | `setValue`/`trigger`/state change not awaited before assert | `await` the interaction; `flushPromises()` for API calls — `testing-async-await-flushpromises.md` |
| 4 | Missing Pinia setup | high | Store-backed mount without `createTestingPinia` / `setActivePinia` | Provide Pinia before mount — `testing-pinia-store-setup.md` |
| 5 | Missing Suspense/async-setup wrapper | high | `async setup()` component mounted without `<Suspense>`/`mountSuspense` | Wrap in Suspense or use the helper — `testing-suspense-async-components.md` |
| 6 | Untested error/loading state | high | Only the happy path asserted for async/data flows | Add error, loading, and empty-state cases |
| 7 | Implementation-coupling | medium | Reads `wrapper.vm.<internal>`, calls private methods, asserts child internals | Test behavior via output/events — `testing-component-blackbox-approach.md` |
| 8 | Brittle locator | medium | `find('.css-class')` / deep selectors / XPath | Query by role/label/text or `data-testid` |
| 9 | Teleport content queried in subtree | medium | `wrapper.find()` for portalled/modal content | Stub Teleport or `attachTo: document.body` — `teleport-testing-complexity.md` |
| 10 | Router-dependent test without router | medium | `useRoute`/`useRouter` component mounted without mock/real router | Mock the composables or install a memory-history router — `vue-router-testing.md` |
| 11 | Composable lifecycle/inject tested without host | medium | `onMounted`/`inject` composable called outside a component | Use a `withSetup` host wrapper — `testing-composables-helper-wrapper.md` |
| 12 | Missing accessible-name coverage | low | Queries by index/class where a role/label exists | Switch to `getByRole`/`getByLabelText` — `accessibility-testing.md` |
| 13 | Over-mocking | low | Internal modules mocked away until the test asserts the mock | Mock only external boundaries (network, time) |

## Coverage Risks (Vue-specific blind spots)

Flag these even when present tests pass: Teleported content, Suspense fallback branch, store
*actions* (not just state), router navigation guards, watchers with async cleanup. For
*existence-level* diff coverage gaps ("is there any test for this changed path?"), that is
produced automatically by `mk:review`; this rubric audits the *quality* of tests that exist.

## Reference
- [Vue.js Testing Guide](https://vuejs.org/guide/scaling-up/testing)
- [Vue Test Utils](https://test-utils.vuejs.org/)
