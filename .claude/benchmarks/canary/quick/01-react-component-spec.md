---
benchmark_task: 01-react-component
tier: quick
target_seconds: 90
target_cost_usd: 0.80
rubric_preset: frontend-app
---

# Task: Tiny React Counter Component

Build a single self-contained React component (`Counter.tsx`) that:

- Renders a number, an Increment button, and a Decrement button
- Initial value: 0
- Decrement floor: 0 (cannot go negative)
- Uses `useState`
- Has a single test file (`Counter.test.tsx`) with at least 3 tests:
  1. Renders initial value of 0
  2. Increment button increases the value
  3. Decrement button does NOT go below 0

## Acceptance Criteria

- [ ] `Counter.tsx` compiles without TypeScript errors
- [ ] `Counter.test.tsx` exists and has 3 passing tests
- [ ] Component renders without console errors
- [ ] Decrement floor enforced

## Notes

This is the smallest possible "build me a thing" task. If the harness can't pass this in <90 seconds and <$1, something is broken upstream. It's the canary in the coal mine.
