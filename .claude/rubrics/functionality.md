---
name: functionality
version: 1.0.0
weight_default: 0.25
applies_to: [frontend, backend, fullstack, cli, library, data-pipeline]
hard_fail_threshold: FAIL
---

# Functionality

## Intent

Measures whether the build **actually works** when exercised against real input — not just whether code compiles or tests pass. The evaluator must run the build (browser, curl, CLI) and verify behavior matches spec acceptance criteria. Anthropic's harness research found that test pass != working software; agents can write tests that pass against broken implementations.

## Criteria

- All spec acceptance criteria pass when verified by the evaluator using **active verification** (browser navigation, curl, CLI invocation)
- Happy paths work end-to-end on representative real input
- Error states render gracefully (no white-screen, no unhandled exceptions, no 500s)
- No console errors / no unhandled promise rejections / no warnings about missing keys
- Build artifacts (binary, bundle, image) are produced and runnable

## Grading

| Level | Definition |
|---|---|
| PASS | All spec ACs verified working via active verification + zero console errors + happy paths exercised on real input |
| WARN | All spec ACs pass BUT minor console warnings present OR 1 non-critical edge case fails |
| FAIL | Any spec AC fails active verification OR build artifact missing OR happy path crashes on real input |

## Anti-patterns

- Claiming "tests pass" without running the build itself
- Mocking the verification step ("the API would return X")
- Whitelisting console errors as "expected"
- Demoing only on synthetic / hardcoded input
- Skipping browser verification because "the code looks right"

## Few-Shot Examples

### Example 1 — PASS

**Artifact:** Spec AC: "User can submit form and see confirmation". Evaluator opens browser, fills form with real data, submits, sees confirmation page with submitted values echoed. Console clean. Network tab shows 201. No JavaScript errors.
**Verdict:** PASS
**Reasoning:** Active verification confirmed happy path. Console clean. Real input used.

### Example 2 — FAIL

**Artifact:** Spec AC: "API returns user list at GET /users". Evaluator runs `curl localhost:3000/users` → 500 Internal Server Error. Server logs show `TypeError: Cannot read property 'map' of undefined`. Unit tests pass because they mock the database.
**Verdict:** FAIL
**Reasoning:** Active verification (curl) failed. Tests mocked the failure away. Hard FAIL — no claim of working software survives a 500 on the happy path.

## References

- Anthropic harness article §6 (active verification beats test-pass claims)
- research/researcher-01-harness-patterns.md §11
