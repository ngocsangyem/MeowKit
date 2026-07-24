# Via Negativa

Improve by removing. Subtraction before addition. What's dangerous is easier to know than what's optimal.

## Core Principle

From Taleb's _Antifragile_: omission does less harm than commission. Every addition has unknown side effects. Removal of a recent addition reverts to a known-good state. When in doubt, subtract.

## When to Use

| Symptom                                  | Action                                   |
| ---------------------------------------- | ---------------------------------------- |
| Bloated system with accumulated features | Identify what no one actually uses       |
| "Just add one more feature" instinct     | Invert: what can we remove instead?      |
| Codebase feels fragile                   | Remove abstractions before adding guards |
| Process has ceremony without outcome     | Strip a step, measure impact, repeat     |

## Process

1. **Inventory what exists** — feature, file, step, dependency, config, meeting, abstraction layer.
2. **For each item, ask:** does removing it measurably harm a user or block a real use case?
3. **If uncertain, remove behind a flag / dark launch** — 10% cohort, then 50%, then full. Monitor.
4. **Keep only what earns its place.** If the item survives the removal test, it was load-bearing. If not, it was cost-with-no-return.

## Where Via Negativa Works Best

- Feature flags cemented by inertia (still there after the experiment shipped)
- Config options no one tunes (defaults are what everyone uses)
- Middleware layers that only forward
- Fallback paths that haven't fired in a year
- Documentation duplicating code behavior
- Retry wrappers hiding real intermittent bugs

## Counter-Principle (the honest version)

Via negativa is NOT an excuse to delete things you don't understand. Investigate before removing:

- `git blame` to see who/when/why the line exists
- Telemetry to see if it's actually used
- Grep for callers / integrations
- Remove behind a flag; monitor for the behavior you're trying to avoid surfacing

Delete when certain, not because the line looks suspicious. A line you don't understand may be load-bearing.

## Example

**Symptom:** payment flow has intermittent failures. Added a retry-with-backoff wrapper 6 months ago. Failure rate dropped from 2% to 0.3%, so it shipped.

**Via negativa move:** remove the retry wrapper. Immediately, the 2% failure rate reappears — but now the log lines contain the _real_ error (a race condition in the DB connection pool when two payments land in the same ms). The retry was hiding the bug; removing it surfaced the fix. Net: cut a 400-line module AND fixed the actual defect.

## Red Flag

"Adding X to fix the problem caused by adding Y." Addition stacking is the tell.

## Combining

Pairs with **Scale Game** — extremes reveal what to cut at normal scale. Pairs with **First Principles** — first-principles builds from zero; via-negativa removes what the analogy smuggled in.

**Related:** Simplification Cascades (via-negativa _removes_; simplification _unifies_) · First Principles (via-negativa strips; first-principles rebuilds).
