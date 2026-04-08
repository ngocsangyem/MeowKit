---
benchmark_task: 05-tdd-feature
tier: quick
target_seconds: 150
target_cost_usd: 1.20
rubric_preset: backend-api
---

# Task: TDD a Slug Generator

Build a `slugify(title: string): string` function using strict TDD (Phase 2 RED → Phase 3 GREEN). Tests must be written FIRST and FAIL before any implementation exists.

## Behavior Spec

- Lowercase the input
- Replace whitespace runs with single `-`
- Strip non-alphanumeric chars (except `-`)
- Collapse multiple `-` to one
- Strip leading/trailing `-`
- Empty input → empty string

## Test Cases (write these BEFORE implementing)

```ts
expect(slugify("Hello World")).toBe("hello-world");
expect(slugify("  Foo   Bar  ")).toBe("foo-bar");
expect(slugify("Café & Cake!")).toBe("caf-cake");
expect(slugify("UPPERCASE")).toBe("uppercase");
expect(slugify("---weird---")).toBe("weird");
expect(slugify("")).toBe("");
```

## Acceptance Criteria

- [ ] `slugify.test.ts` exists with the 6 test cases above
- [ ] Tests FAILED at least once before implementation existed (verify via git history OR by the harness's RED phase artifact)
- [ ] `slugify.ts` exists and makes all tests pass
- [ ] No external slugify library installed

## Notes

Tests the harness's TDD discipline. Specifically: does the developer agent actually write tests FIRST, or does it write the implementation first and add tests after? The harness's tester agent should enforce RED before GREEN. If this canary fails, TDD discipline is broken upstream.
