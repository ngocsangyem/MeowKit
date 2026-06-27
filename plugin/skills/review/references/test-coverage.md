# Test Coverage Diagram (Step 4.75)

100% coverage is the goal. Evaluate every codepath changed in the diff and identify test gaps. Gaps become INFORMATIONAL findings that follow the Fix-First flow.

## Contents

- [Test Framework Detection](#test-framework-detection)
- [Step 1: Trace every codepath changed](#step-1-trace-every-codepath-changed)
- [Step 2: Map user flows, interactions, and error states](#step-2-map-user-flows-interactions-and-error-states)
- [Step 3: Check each branch against existing tests](#step-3-check-each-branch-against-existing-tests)
  - [E2E Test Decision Matrix](#e2e-test-decision-matrix)
  - [REGRESSION RULE (mandatory)](#regression-rule-mandatory)
- [Step 4: Output ASCII coverage diagram](#step-4-output-ascii-coverage-diagram)
- [Step 5: Generate tests for gaps (Fix-First)](#step-5-generate-tests-for-gaps-fix-first)


## Test Framework Detection

Before analyzing coverage, detect the project's test framework:

1. **Read CLAUDE.md** — look for a `## Testing` section with test command and framework name. If found, use that as the authoritative source.
2. **If CLAUDE.md has no testing section, auto-detect:**

```bash
# Detect project runtime
[ -f Gemfile ] && echo "RUNTIME:ruby"
[ -f package.json ] && echo "RUNTIME:node"
[ -f requirements.txt ] || [ -f pyproject.toml ] && echo "RUNTIME:python"
[ -f go.mod ] && echo "RUNTIME:go"
[ -f Cargo.toml ] && echo "RUNTIME:rust"
# Check for existing test infrastructure
ls jest.config.* vitest.config.* playwright.config.* cypress.config.* .rspec pytest.ini phpunit.xml 2>/dev/null
ls -d test/ tests/ spec/ __tests__/ cypress/ e2e/ 2>/dev/null
```

3. **If no framework detected:** still produce the coverage diagram, but skip test generation.

## Step 1: Trace every codepath changed

Using `git diff origin/<base>...HEAD`:

Read every changed file. For each one, trace how data flows through the code — don't just list functions, actually follow the execution:

1. **Read the diff.** For each changed file, read the full file (not just the diff hunk) to understand context.
2. **Trace data flow.** Starting from each entry point (route handler, exported function, event listener, component render), follow the data through every branch:
   - Where does input come from? (request params, props, database, API call)
   - What transforms it? (validation, mapping, computation)
   - Where does it go? (database write, API response, rendered output, side effect)
   - What can go wrong at each step? (null/undefined, invalid input, network failure, empty collection)
3. **Diagram the execution.** For each changed file, draw an ASCII diagram showing:
   - Every function/method that was added or modified
   - Every conditional branch (if/else, switch, ternary, guard clause, early return)
   - Every error path (try/catch, rescue, error boundary, fallback)
   - Every call to another function (trace into it — does IT have untested branches?)
   - Every edge: what happens with null input? Empty array? Invalid type?

This is the critical step — you're building a map of every line of code that can execute differently based on input. Every branch in this diagram needs a test.

## Step 2: Map user flows, interactions, and error states

Code coverage isn't enough — you need to cover how real users interact with the changed code. For each changed feature, think through:

- **User flows:** What sequence of actions does a user take that touches this code? Map the full journey (e.g., "user clicks 'Pay' -> form validates -> API call -> success/failure screen"). Each step in the journey needs a test.
- **Interaction edge cases:** What happens when the user does something unexpected?
  - Double-click/rapid resubmit
  - Navigate away mid-operation (back button, close tab, click another link)
  - Submit with stale data (page sat open for 30 minutes, session expired)
  - Slow connection (API takes 10 seconds — what does the user see?)
  - Concurrent actions (two tabs, same form)
- **Error states the user can see:** For every error the code handles, what does the user actually experience?
  - Is there a clear error message or a silent failure?
  - Can the user recover (retry, go back, fix input) or are they stuck?
  - What happens with no network? With a 500 from the API? With invalid data from the server?
- **Empty/zero/boundary states:** What does the UI show with zero results? With 10,000 results? With a single character input? With maximum-length input?

Add these to your diagram alongside the code branches. A user flow with no test is just as much a gap as an untested if/else.

## Step 3: Check each branch against existing tests

Go through your diagram branch by branch — both code paths AND user flows. For each one, search for a test that exercises it:
- Function `processPayment()` -> look for `billing.test.ts`, `billing.spec.ts`, `test/billing_test.rb`
- An if/else -> look for tests covering BOTH the true AND false path
- An error handler -> look for a test that triggers that specific error condition
- A call to `helperFn()` that has its own branches -> those branches need tests too
- A user flow -> look for an integration or E2E test that walks through the journey
- An interaction edge case -> look for a test that simulates the unexpected action

Quality scoring rubric:
- Three stars: Tests behavior with edge cases AND error paths
- Two stars: Tests correct behavior, happy path only
- One star: Smoke test / existence check / trivial assertion (e.g., "it renders", "it doesn't throw")

### E2E Test Decision Matrix

When checking each branch, also determine whether a unit test or E2E/integration test is the right tool:

**RECOMMEND E2E (mark as [->E2E] in the diagram):**
- Common user flow spanning 3+ components/services (e.g., signup -> verify email -> first login)
- Integration point where mocking hides real failures (e.g., API -> queue -> worker -> DB)
- Auth/payment/data-destruction flows — too important to trust unit tests alone

**RECOMMEND EVAL (mark as [->EVAL] in the diagram):**
- Critical LLM call that needs a quality eval (e.g., prompt change -> test output still meets quality bar)
- Changes to prompt templates, system instructions, or tool definitions

**STICK WITH UNIT TESTS:**
- Pure function with clear inputs/outputs
- Internal helper with no side effects
- Edge case of a single function (null input, empty array)
- Obscure/rare flow that isn't customer-facing

### REGRESSION RULE (mandatory)

**IRON RULE:** When the coverage audit identifies a REGRESSION — code that previously worked but the diff broke — a regression test is written immediately. No AskUserQuestion. No skipping. Regressions are the highest-priority test because they prove something broke.

A regression is when:
- The diff modifies existing behavior (not new code)
- The existing test suite (if any) doesn't cover the changed path
- The change introduces a new failure mode for existing callers

When uncertain whether a change is a regression, err on the side of writing the test.

Format: commit as `test: regression test for {what broke}`

## Step 4: Output ASCII coverage diagram

Include BOTH code paths and user flows in the same diagram. Mark E2E-worthy and eval-worthy paths:

```
CODE PATH COVERAGE
===========================
[+] src/services/billing.ts
    |
    +-- processPayment()
    |   +-- [*** TESTED] Happy path + card declined + timeout — billing.test.ts:42
    |   +-- [GAP]         Network timeout — NO TEST
    |   +-- [GAP]         Invalid currency — NO TEST
    |
    +-- refundPayment()
        +-- [**  TESTED] Full refund — billing.test.ts:89
        +-- [*   TESTED] Partial refund (checks non-throw only) — billing.test.ts:101

USER FLOW COVERAGE
===========================
[+] Payment checkout flow
    |
    +-- [*** TESTED] Complete purchase — checkout.e2e.ts:15
    +-- [GAP] [->E2E] Double-click submit — needs E2E, not just unit
    +-- [GAP]         Navigate away during payment — unit test sufficient
    +-- [*   TESTED]  Form validation errors (checks render only) — checkout.test.ts:40

[+] Error states
    |
    +-- [**  TESTED] Card declined message — billing.test.ts:58
    +-- [GAP]         Network timeout UX (what does user see?) — NO TEST
    +-- [GAP]         Empty cart submission — NO TEST

[+] LLM integration
    |
    +-- [GAP] [->EVAL] Prompt template change — needs eval test

---------------------------------
COVERAGE: 5/13 paths tested (38%)
  Code paths: 3/5 (60%)
  User flows: 2/8 (25%)
QUALITY:  ***: 2  **: 2  *: 1
GAPS: 8 paths need tests (2 need E2E, 1 needs eval)
---------------------------------
```

**Fast path:** All paths covered -> "Step 4.75: All new code paths have test coverage." Continue.

## Step 5: Generate tests for gaps (Fix-First)

If test framework is detected and gaps were identified:
- Classify each gap as AUTO-FIX or ASK per the Fix-First Heuristic:
  - **AUTO-FIX:** Simple unit tests for pure functions, edge cases of existing tested functions
  - **ASK:** E2E tests, tests requiring new test infrastructure, tests for ambiguous behavior
- For AUTO-FIX gaps: generate the test, run it, commit as `test: coverage for {feature}`
- For ASK gaps: include in the Fix-First batch question with the other review findings
- For paths marked [->E2E]: always ASK (E2E tests are higher-effort and need user confirmation)
- For paths marked [->EVAL]: always ASK (eval tests need user confirmation on quality criteria)

If no test framework detected -> include gaps as INFORMATIONAL findings only, no generation.

**Diff is test-only changes:** Skip Step 4.75 entirely: "No new application code paths to audit."

This step subsumes the "Test Gaps" category from Pass 2 — do not duplicate findings between the checklist Test Gaps item and this coverage diagram. Include any coverage gaps alongside the findings from Step 4 and Step 4.5. They follow the same Fix-First flow — gaps are INFORMATIONAL findings.