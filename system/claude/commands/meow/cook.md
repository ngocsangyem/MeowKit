# /cook — 7-Phase Pipeline (Orient → Plan → Test → Build → Review → Ship → Reflect)

## Usage

```
/cook [feature description]
/cook [plan-path]
```

## Behavior

Runs MeowKit's 7-phase workflow from planning through shipping. The user intervenes at Gate 1 (plan approval) and Gate 2 (review approval). All other phases proceed automatically.

### Execution Phases

0. **Phase 0 — Orient.** Detect intent, declare model tier, read memory.
   - Print: `Phase 0: Orient — Mode [X], Tier [Y]`

1. **Phase 1 — Plan.** Run `meow:plan-creator` with the feature description.
   - Print: `Phase 1: Planning...`
   - Wait for **Gate 1 approval** from the human.
   - If rejected, revise plan and re-request approval.

2. **Phase 2 — Test (RED).** Run `meow:testing --red-only` to write failing tests.
   - Print: `Phase 2: Writing failing tests...`
   - Tests target behaviors from the approved plan's acceptance criteria.
   - Tests must run and FAIL (not compilation errors — actual test failures).

3. **Phase 3 — Build (GREEN).** Write implementation code until all tests pass.
   - Print: `Phase 3: Implementing...`
   - TDD: implement only enough to make tests pass.
   - Self-heal up to 3 attempts (per tdd-rules.md). After 3 failures, escalate to human.
   - After tests pass, optionally refactor (re-run tests after every change).

4. **Phase 4 — Review.** Run `meow:review` for 5-dimension structural audit.
   - Print: `Phase 4: Reviewing...`
   - Wait for **Gate 2 approval** from the human. No exceptions — even in auto mode.
   - If any dimension is FAIL, block shipping. Fix issues and re-review.

5. **Phase 5 — Ship.** Run `meow:ship` after Gate 2 approval.
   - Print: `Phase 5: Shipping...`
   - Conventional commit → PR → CI verification.

6. **Phase 6 — Reflect.** Update docs, sync plan, write memory.
   - Print: `Phase 6: Reflecting...`
   - Project-manager sync-back across all plan phases.
   - Docs-manager updates if changes warrant.
   - Memory write: lessons learned this session.

### Status Output

Each phase prints its status:

```
Phase 0: Orient — Mode interactive, Tier STANDARD
Phase 1: Planning...             Plan approved
Phase 2: Writing failing tests...  4 tests written, all RED
Phase 3: Implementing...           All tests GREEN
Phase 4: Reviewing...              Review 8.5/10, Gate 2 approved
Phase 5: Shipping...               PR #42 created, CI green
Phase 6: Reflecting...             Sync-back done, docs updated, memory written
```

### Human Intervention Points

- **Gate 1** (after Phase 1): Approve/reject/revise the plan.
- **Gate 2** (after Phase 4): Approve/reject the review verdict, acknowledge WARNs.

All other phases proceed automatically. Gate 2 is NEVER auto-approved.
