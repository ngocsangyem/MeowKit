# Refactor Template

> Use when restructuring code without changing behavior.

**Primary agent:** developer → reviewer
**Workflow phases:** Phase 1 (Plan) → Phase 3 (Implement) → Phase 4 (Review)
**Create with:** `npx mewkit task new --type refactor "description"`

## When to use

- Reducing complexity or duplication
- Improving test coverage
- Extracting reusable modules
- Migrating to new patterns

## Key sections

### Current State / Target State
Describes before and after — keeps the goal concrete.

### Refactor Strategy
Choose: strangler fig, incremental, or big-bang. Must be safe at each intermediate step.

### Backward Compatibility
Explicit: public APIs preserved? Breaking changes listed?

### Verification
Must include: all existing tests still pass after every change.
