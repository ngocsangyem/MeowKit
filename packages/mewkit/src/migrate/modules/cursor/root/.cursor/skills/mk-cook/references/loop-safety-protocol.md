# Loop Safety Protocol

Governs iterative build-test-fix cycles. Prevents runaway loops, cost drift, and circular fixes.

## Pre-Loop Checks (before iteration 1)

Verify all three before starting any iterative cycle:

- [ ] **Quality gates active** — test suite runs and produces deterministic output (not flaky)
- [ ] **Rollback path exists** — know the last known-good state (git commit SHA or branch)
- [ ] **Branch isolation** — working on a feature branch, not main/master

If any pre-check fails, stop and resolve before starting the loop.

## Checkpoint Tracking (after each iteration)

Record at every checkpoint:

```
Iteration N checkpoint:
- What changed: [specific files and lines modified]
- Tests passed: [list of passing tests]
- Tests failed: [list of failing tests with error summary]
- Cost so far: [token count or time elapsed]
- Next hypothesis: [what will be tried in iteration N+1]
```

Checkpoints are the audit trail. Without them, it's impossible to detect circular fixes (iteration 3 reverting iteration 1's change).

## Stall Detection

**Stall condition:** No measurable progress across 2 consecutive iterations.

Progress is defined as: at least one previously failing test now passes, OR the failure mode changes (different error message or different test).

If no progress after 2 iterations:
1. Pause the loop
2. Reduce scope: isolate the smallest possible failing case
3. Do not continue with the same approach — change the hypothesis

## Cost Drift Alert

If the token cost or time elapsed for iteration N is more than 2x the cost of iteration 1:

1. Alert: "Cost drift detected — iteration N cost is Xx iteration 1 cost"
2. Pause and assess: is the remaining work bounded or unbounded?
3. If unbounded → escalate to user before continuing

Cost drift usually signals the problem is larger than scoped, or the approach is wrong.

## Escalation Triggers

Stop the loop and escalate (per `tdd-rules.md` 3-strike rule) when:

- **No progress after 2 checkpoints** → reduce scope or try different approach
- **Identical failure** across 3 iterations (same test, same error, same line) → the fix hypothesis is wrong; change approach entirely
- **3+ iterations without any test passing** → escalate to user with: iteration log, current failing tests, attempted approaches, suspected root cause

On escalation, do NOT make one more attempt. Stop, document, hand off.

## Resume Protocol

Only resume the loop after:
1. A verification step passes (at least one new test green, or failure mode changed)
2. The checkpoint for the completed iteration is recorded
3. The next hypothesis is stated explicitly before coding begins

Never resume "to see what happens." Every iteration must have a stated hypothesis.
