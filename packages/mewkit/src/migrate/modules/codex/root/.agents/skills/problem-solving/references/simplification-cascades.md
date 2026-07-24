# Simplification Cascades

Find one insight eliminating multiple components. "If this is true, we don't need X, Y, Z."

## Core Principle

**Everything is a special case of...** collapses complexity dramatically.

One powerful abstraction > ten clever hacks.

## When to Use

| Symptom                        | Action                         |
| ------------------------------ | ------------------------------ |
| Same thing implemented 5+ ways | Abstract the common pattern    |
| Growing special case list      | Find the general case          |
| Complex rules with exceptions  | Find a rule with no exceptions |
| Excessive config options       | Find defaults working for 95%  |

## The Pattern

**Look for:**

- Multiple implementations of similar concepts
- Special case handling everywhere
- "We need to handle A, B, C, D differently..."
- Complex rules with many exceptions

**Ask:** "What if they're all the same thing underneath?"

## Examples

### Example 1: Stream Abstraction

- **Before:** Separate handlers for batch / real-time / file / network data
- **Insight:** "All inputs are streams — just different sources"
- **After:** One stream processor, multiple stream sources
- **Eliminated:** 4 separate implementations

### Example 2: Resource Governance

- **Before:** Session tracking, rate limiting, file validation, connection pooling (all separate)
- **Insight:** "All are per-entity resource limits"
- **After:** One ResourceGovernor with 4 resource types
- **Eliminated:** 4 custom enforcement systems

### Example 3: Immutability

- **Before:** Defensive copying, locking, cache invalidation, temporal coupling
- **Insight:** "Treat everything as immutable data + transformations"
- **After:** Functional programming patterns
- **Eliminated:** Entire classes of synchronization problems

## Process

1. **List variations** — what's implemented multiple ways?
2. **Find essence** — what's the same underneath?
3. **Extract abstraction** — what's the domain-independent pattern?
4. **Test fit** — do all cases fit cleanly?
5. **Measure cascade** — how many things become unnecessary?

## Red Flags

Signs you're missing a cascade:

- "Just need to add one more case..." (repeating forever)
- "These are similar but different" (maybe they're the same?)
- Refactoring feels like whack-a-mole (fix one, break another)
- Growing configuration file
- "Don't touch that, it's complicated" (complexity hiding a pattern)

## Success Metrics

- **10× wins, not 10% improvements**
- Measure in "how many things can we delete?"
- Lines of code removed > lines added
- Configuration options eliminated
- Special cases unified

## Remember

- The pattern is usually already there, just needs recognition
- Valid cascades feel obvious in retrospect
- Test with "can this handle all existing cases?"
- Document the insight for future reference

**Related:** Meta-Pattern Recognition (find the pattern across domains before collapsing) · Via Negativa (sometimes the simplest cascade is deletion).
