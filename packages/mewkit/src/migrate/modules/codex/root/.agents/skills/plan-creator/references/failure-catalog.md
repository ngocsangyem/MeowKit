# Planning Failure Catalog

Common failure modes when creating plans. Read before starting any planning work.

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "This is too simple to plan" | Simple tasks have hidden complexity. A 2-line plan is fine — no plan is not. |
| "I'll figure it out as I go" | That's how you end up with tangled mess and rework. 10 minutes of planning saves hours. |
| "The tasks are obvious" | Write them down anyway. Explicit tasks surface hidden dependencies and forgotten edge cases. |
| "Planning is overhead" | Planning IS the task. Implementation without a plan is just typing. |
| "I can hold it all in my head" | Context windows are finite. Written plans survive session boundaries and compaction. |
| "I'll write the spec after I code it" | That's documentation, not specification. Spec forces clarity BEFORE code. |
| "The user knows what they want" | Even clear requests have implicit assumptions. The plan surfaces those assumptions. |

## Red Flags

Observable patterns that indicate you're off-track:

- Planning without reading the existing codebase first
- All tasks are XL-sized (>5 files each) — break them down
- No acceptance criteria on tasks — just descriptions
- No verification steps or checkpoints in the plan
- Task dependency order not considered (building UI before API exists)
- Starting implementation without a written task list
- Assumptions not surfaced explicitly (Behavior 1 violation)
