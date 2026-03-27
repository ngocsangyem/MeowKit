# /cook — Full Pipeline (Plan → Test → Build → Review → Ship)

## Usage

```
/cook [feature description]
```

## Behavior

Runs the complete MeowKit workflow from planning through shipping. This is the "one command does everything" UX. The user only intervenes at Gate 1 (plan approval) and Gate 2 (review approval).

### Execution Steps

1. **Phase 1 — Plan.** Run `/plan` internally with the feature description.
   - Print: `🐱 Phase 1/5: Planning...`
   - Wait for **Gate 1 approval** from the human.
   - If rejected, stop. If changes requested, revise plan and re-request approval.

2. **Phase 2 — Test (RED).** Run `/test --red-only` to write failing tests for the planned feature.
   - Print: `🐱 Phase 2/5: Writing failing tests...`
   - Tests must target the behaviors defined in the approved plan's Success Criteria.
   - Confirm tests run and FAIL (not compilation errors — actual test failures).

3. **Phase 3 — Implement (GREEN).** Write implementation code until all tests pass.
   - Print: `🐱 Phase 3/5: Implementing...`
   - Follow TDD rules: implement only enough to make tests pass.
   - If tests fail after implementation, self-heal up to 3 attempts (per tdd-rules).
   - After 3 failures, escalate to human with: failing output, attempted fixes, suspected root cause.
   - After tests pass, optionally refactor (re-run tests after every refactor change).

4. **Phase 4 — Review.** Run `/review` to trigger the 5-dimension structural audit.
   - Print: `🐱 Phase 4/5: Reviewing...`
   - Wait for **Gate 2 approval** from the human.
   - If any dimension is FAIL, block shipping. Fix issues and re-review.
   - All WARN items must be acknowledged by the human.

5. **Phase 5 — Ship.** Run `/ship` to commit, create PR, and verify CI.
   - Print: `🐱 Phase 5/5: Shipping...`
   - Will not execute if Gate 2 has not passed.
   - Follows ship-pipeline skill: conventional commit → PR → CI verification → rollback plan documented.

### Status Output

Each phase prints its status so the user can track progress:
```
🐱 Phase 1/5: Planning...          ✅ Plan approved
🐱 Phase 2/5: Writing failing tests... ✅ 4 tests written, all RED
🐱 Phase 3/5: Implementing...      ✅ All tests GREEN
🐱 Phase 4/5: Reviewing...         ✅ Review passed (3 PASS, 2 WARN — acknowledged)
🐱 Phase 5/5: Shipping...          ✅ PR #42 created, CI green
```

### Human Intervention Points

- **Gate 1** (after Phase 1): Approve/reject/revise the plan.
- **Gate 2** (after Phase 4): Approve/reject the review verdict, acknowledge WARNs.

All other phases proceed automatically.
