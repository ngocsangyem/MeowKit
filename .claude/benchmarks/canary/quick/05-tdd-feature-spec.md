---
benchmark_task: 05-tdd-feature
tier: quick
target_seconds: 150
target_cost_usd: 1.20
rubric_preset: backend-api
requires_tdd_mode: true
---

# Task: TDD a Slug Generator (TDD-mode canary)

> **Run with `--tdd`** — this canary specifically tests strict-TDD discipline.
> Without `--tdd` / `MEOWKIT_TDD=1`, MeowKit's default mode skips the RED-phase gate and this canary's premise is invalid.
>
> Manual reproduction (no automated runner exists yet):
> ```bash
> mkdir -p .claude/session-state && echo on > .claude/session-state/tdd-mode
> /meow:cook --tdd "build a slugify function per .claude/benchmarks/canary/quick/05-tdd-feature-spec.md"
> ```

Build a `slugify(title: string): string` function using strict TDD (Phase 2 RED → Phase 3 GREEN). Tests must be written FIRST and FAIL before any implementation exists.

This canary tests that the harness still enforces RED-phase discipline when TDD mode is explicitly enabled. Verifies that:
1. Sentinel file or env var triggers TDD mode
2. `pre-implement.sh` blocks if no failing test exists for the feature
3. Developer agent waits on tester before starting Phase 3
4. Anti-rationalization rules (no test minimization, no mock substitution) hold

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
