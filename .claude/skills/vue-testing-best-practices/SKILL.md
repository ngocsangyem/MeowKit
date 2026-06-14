---
name: mk:vue-testing-best-practices
description: >-
  Use for Vue 3 testing best-practices review and recommendations — designing
  and auditing Vitest + Vue Test Utils tests for components, composables, Pinia
  stores, Vue Router, async/Suspense, Teleport, forms, and accessibility, plus
  Playwright E2E test-design strategy. Advisory/review only — recommends patterns
  and flags test smells; does not run tests. Complements mk:vue-best-practices
  (feature code). Invoke for "review my Vue tests", "how should I test this
  component/composable/store", or "Vue test best practices".
when_to_use: >-
  Use when the subject IS Vue 3 test-code quality — designing/auditing Vue tests
  or choosing Vue test tooling. NOT for: running tests/TDD/non-Vue/generic
  Playwright runner practices (mk:testing), diff/PR review or test-existence gaps
  (mk:review), coverage maps (mk:nyquist), QA + bug-fixing a running app (mk:qa),
  E2E spec generation/run (mk:qa-manual), browser driving
  (mk:agent-browser/mk:playwright-cli), or Vue feature code
  (mk:vue/mk:vue-best-practices).
keywords:
  [
    vue-testing,
    vitest,
    vue-test-utils,
    component-testing,
    composable-testing,
    pinia-testing,
    vue-router-testing,
    async-component-testing,
    flushpromises,
    teleport-testing,
    snapshot-policy,
    test-smells,
    e2e-strategy,
  ]
user-invocable: true
allowed-tools:
  - Read
  - Grep
  - Glob
version: 1.0.0
source: vuejs-ai (vendored, extended for toolkit)
---

# Vue Testing Best Practices

Vue-specific **test-design advisor + test-code reviewer**. Recommends how to test Vue 3
components, composables, Pinia stores, Vue Router, async/Suspense, Teleport, forms, and
accessibility — and audits existing Vitest + Vue Test Utils tests for smells, gaps, and
coverage risk. Read-only: it advises and reviews; it never runs, generates, or fixes tests.

This skill is to `mk:testing` what `mk:vue-best-practices` is to `mk:vue` — a
domain-specialized advisory that you invoke deliberately.

## When to Use

**Invoke-only** — this skill does NOT auto-activate. Activate it for:

- `/mk:vue-testing-best-practices [test file or component]` (explicit).
- "review my Vue tests", "how should I test this component/composable/store", "Vue test
  best practices", "Vitest or Jest for this Vue app?", "are my async component tests correct?".

**Do NOT invoke for** (each routes to its owner):

- Running tests / TDD red-green / non-Vue tests / generic Playwright runner protocol → `mk:testing`
- Diff/PR structural review or test-_existence_ gap detection → `mk:review`
- Coverage→requirement mapping → `mk:nyquist`
- QA of a running app + bug fixes → `mk:qa`
- Generating or running Playwright `.spec.ts` E2E → `mk:qa-manual`
- Driving a live browser → `mk:agent-browser` / `mk:playwright-cli`
- Writing Vue feature code → `mk:vue` / `mk:vue-best-practices`

## Invocation Decision Guide

| You want to…                                                   | Use                                      |
| -------------------------------------------------------------- | ---------------------------------------- |
| Write/refactor Vue feature code                                | `mk:vue`                                 |
| Review Vue _feature_ code / authoring workflow                 | `mk:vue-best-practices`                  |
| **Design or review Vue _test_ code; choose test tooling**      | **this skill**                           |
| Actually run tests / TDD loop / non-Vue tests                  | `mk:testing`                             |
| Diff/PR review or "does a test exist for this change?"         | `mk:review`                              |
| Map test coverage → requirements (which criteria are untested) | `mk:nyquist`                             |
| "does the running site work? find + fix bugs"                  | `mk:qa`                                  |
| Generate runnable Playwright E2E specs from a spec/URL         | `mk:qa-manual`                           |
| Drive a real browser                                           | `mk:agent-browser` / `mk:playwright-cli` |

### Disambiguation vs mk:vue-best-practices

The seam is _authoring_ vs _test-setup_:

- Review how a component **uses** Teleport (when to use it, the API, the fallback boundary)
  → `mk:vue-best-practices`.
- Review how a **test** stubs Teleport (`teleport` stub, `attachTo: document.body`, querying
  portalled content) → **this skill**.

Teleport/Suspense **authoring** (when to use, API, fallback) → `mk:vue-best-practices`;
Teleport/Suspense **test-setup** (stubs, `flushPromises`, `attachTo`, `mountSuspense`) →
this skill.

## Testing — Problem → Reference

Read one level deep from this file. Load only the reference that matches the surface.

| Problem / intent                                           | Reference                                          |
| ---------------------------------------------------------- | -------------------------------------------------- |
| Setting up test infrastructure for a Vue 3 project         | `reference/testing-vitest-recommended-for-vue.md`  |
| Tests break when refactoring component internals           | `reference/testing-component-blackbox-approach.md` |
| Flaky/intermittent tests, async DOM not updated            | `reference/testing-async-await-flushpromises.md`   |
| Composables using lifecycle hooks or `inject` fail to test | `reference/testing-composables-helper-wrapper.md`  |
| "injection Symbol(pinia) not found" errors                 | `reference/testing-pinia-store-setup.md`           |
| Components with async `setup()` won't render               | `reference/testing-suspense-async-components.md`   |
| Snapshot tests pass despite broken functionality           | `reference/testing-no-snapshot-only.md`            |
| Choosing an end-to-end framework for a Vue app             | `reference/testing-e2e-playwright-recommended.md`  |
| Need to verify computed styles or real DOM events          | `reference/testing-browser-vs-node-runners.md`     |
| `defineAsyncComponent` components fail in tests            | `reference/async-component-testing.md`             |
| Teleported content can't be found in wrapper queries       | `reference/teleport-testing-complexity.md`         |
| Testing routing: `useRoute`/`useRouter`, navigation guards | `reference/vue-router-testing.md`                  |
| Testing forms: inputs, validation, submit payloads         | `reference/form-testing.md`                        |
| Asserting accessibility in tests (roles, focus, keyboard)  | `reference/accessibility-testing.md`               |
| Reviewing tests for smells (the severity rubric)           | `reference/test-smells-rubric.md`                  |

## Workflow

Read-only advisory lifecycle. Classify the surface → load the matching reference JIT →
evaluate against the rubric → emit a bounded review.

1. **Input** — intent + the Vue test file(s) under review, or the component/composable/store
   the user wants to design tests for.
2. **Testing analysis** — classify the surface: component / composable / store / router /
   form / async / Suspense / Teleport / E2E-design. Load the matching reference(s).
3. **Best-practice evaluation** — apply `reference/test-smells-rubric.md`: blackbox vs
   implementation-coupled? async awaited (`flushPromises`/`nextTick`)? Pinia configured?
   Suspense/Teleport set up? snapshot policy? a11y queries? brittle locators?
4. **Gap detection** — missing scenarios (error/async/edge/a11y states), test smells,
   Vue-specific coverage risks.
5. **Recommendations** — concrete pattern fixes, tooling advice, and handoff notes.
6. **Output** — a bounded **Vue Testing Review** (see Output Contract).

**Entry criteria:** a Vue 3 project, and the user wants test design, test review, or test
tooling advice.

**Stop conditions (hand off, do not attempt):**

| Request                               | Hand off to                              |
| ------------------------------------- | ---------------------------------------- |
| Execute / run tests, TDD loop         | `mk:testing`                             |
| Generate runnable E2E `.spec.ts`      | `mk:qa-manual`                           |
| Drive a live browser                  | `mk:agent-browser` / `mk:playwright-cli` |
| Coverage→requirement map              | `mk:nyquist`                             |
| QA a running app + fix bugs           | `mk:qa`                                  |
| Diff/PR review or test-existence gaps | `mk:review`                              |
| Root-cause a failing test/bug         | `mk:investigate`                         |

**Escalation:** non-Vue test code → `mk:testing`; running-app bugs → `mk:qa`; root-cause
debugging → `mk:investigate`; coverage map → `mk:nyquist`.

## Output Contract

Emit a single **Vue Testing Review**. Omit any empty section rather than padding it. Do not
restate Vue basics (defer to `mk:vue`), dump whole files, or recite generic testing theory.

1. **Verdict** — one line: `PASS` / `NEEDS-WORK` + a one-sentence why.
2. **Test Smells** — one row each: `[severity] · file:line · smell · fix`. Severity vocab:
   `critical | high | medium | low`. (e.g. implementation-coupling, snapshot-only, missing
   `await flushPromises`, missing Pinia setup, brittle CSS locator.)
3. **Missing Scenarios** — untested behaviors: error states, async/loading, edge inputs,
   a11y states.
4. **Coverage Risks** — Vue-specific blind spots: Teleported content, Suspense fallback,
   store actions, router guards. Note: _existence-level_ diff coverage gaps are produced
   automatically by `mk:review` `references/test-coverage.md` during a full review — this
   section audits test _quality_, not existence.
5. **Tooling Recommendations** — Vitest / runner (happy-dom vs Browser Mode) / library
   (`@vue/test-utils` vs `@testing-library/vue`) / Playwright-vs-Cypress choices, each with a
   one-line rationale.
6. **Handoffs** — explicit next-skill pointers when applicable (execute → `mk:testing`,
   E2E gen → `mk:qa-manual`, coverage map → `mk:nyquist`).

### Worked example — design request

> "How should I test this Pinia-backed `UserProfile` component?"

```
Verdict: NEEDS-WORK — no Pinia provided, so the component will throw on mount.
Tooling: Vitest + happy-dom; @vue/test-utils + createTestingPinia({ createSpy: vi.fn }).
Missing Scenarios: loading state, fetch error, empty profile.
Handoffs: write + run the suite → mk:testing.
```

### Worked example — review request

> "Review `tests/SearchBar.spec.ts`."

```
Verdict: NEEDS-WORK — assertions race ahead of async DOM updates.
Test Smells:
  [high] · SearchBar.spec.ts:21 · setValue not awaited · `await wrapper.find('input').setValue(...)`
  [medium] · SearchBar.spec.ts:30 · brittle `.btn-primary` locator · query by role/text or data-testid
Missing Scenarios: empty-query, no-results, API error.
```

## Gotchas

- **Missing `await flushPromises()` after an API call** — `await nextTick()` only flushes
  reactive DOM updates, not pending promises; an API-driven assertion runs against stale state
  and the test flakes. Use `flushPromises()` (sometimes twice for chained async).
- **Snapshot-only tests pass while behavior breaks** — a snapshot asserts markup shape, not
  behavior; pair every snapshot with behavioral assertions (text/role/emitted), or it gives
  false confidence.
- **"injection Symbol(pinia) not found"** — mounting a store-backed component without
  `createTestingPinia` (component tests) or `setActivePinia(createPinia())` (store unit tests)
  throws on mount. Provide Pinia before asserting.
- **Teleported content isn't in the wrapper** — `<Teleport>` moves DOM out of the component
  subtree, so `wrapper.find()` misses it; stub Teleport or `attachTo: document.body` and query
  the document.

## Reference

- [Vue.js Testing Guide](https://vuejs.org/guide/scaling-up/testing)
- [Vue Test Utils](https://test-utils.vuejs.org/)
- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)

## Provenance

Ported and extended from an upstream Vue testing skill — see [SYNC.md](SYNC.md) for the
upstream path, pinned commit, and which references are vendored-verbatim vs toolkit.
