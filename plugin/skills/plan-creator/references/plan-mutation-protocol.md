# Plan Mutation Protocol

Plans are living documents. When reality diverges from the plan, the plan must change — with discipline.

## The 5 Mutations

### 1. Split Step

Divide one step into two or more steps.

**When to use:** A step is too large to execute atomically. Mid-step, the agent realizes the work is two distinct concerns.

**Rules:**
- Both halves must have their own acceptance criteria
- Both halves must have their own verification commands
- The dependency edge between halves must be explicit (half-B depends on half-A output)
- The original step is marked split; its AC are retired

### 2. Insert Step

Add a new step between existing steps.

**When to use:** Investigation reveals a prerequisite that was not in the original plan. A risk surface is identified that needs its own step.

**Rules:**
- New step must have full acceptance criteria (not "TBD")
- Dependency edges must be updated: what does the new step depend on? What depends on it?
- Steps after the insertion retain their phase numbers; the new step takes an intermediate number (e.g., 2.5 between phase-02 and phase-03)

### 3. Skip Step

Mark a step as intentionally not executed.

**When to use:** Research reveals the step is unnecessary. The step's goal is already satisfied by prior work. Scope was formally reduced.

**Rules:**
- Must document justification (not just "not needed")
- User must be notified if the skipped step had acceptance criteria that are now unchecked
- Skipped steps are NOT deleted — they remain visible with a skip marker

### 4. Reorder Steps

Change the execution sequence of steps.

**When to use:** A dependency was identified that requires a different order. Parallelization opportunity found.

**Rules:**
- May only reorder if no dependency is violated (step B cannot move before step A if B depends on A's output)
- Draw the dependency graph before reordering to verify no cycles are created

### 5. Abandon Plan

Discard the current plan and start over.

**When to use:** The goal has changed fundamentally. Research revealed the approach is wrong. Scope changed >50%.

**Rules:**
- Requires explicit user approval — never self-authorize a plan abandonment
- The old plan is archived (not deleted) with an abandonment note
- A new plan starts at Step 0 (scope challenge)

## Audit Trail

Every mutation must be logged in `plan.md` under a `## Mutation Log` section:

```
## Mutation Log

- [YYYY-MM-DD HH:MM] SPLIT phase-03: "Implement auth" → phase-03a "Implement login" + phase-03b "Implement logout". Reason: discovered session management is a separate concern with different AC.
- [YYYY-MM-DD HH:MM] INSERT phase-02.5: "Validate DB schema". Reason: investigation revealed schema migration needed before API implementation.
- [YYYY-MM-DD HH:MM] SKIP phase-05: "Write integration tests". Reason: scope reduction approved by user — integration tests deferred to next sprint.
```

Mutations without audit trail entries are protocol violations. Every change to the plan structure is logged, no exceptions.
