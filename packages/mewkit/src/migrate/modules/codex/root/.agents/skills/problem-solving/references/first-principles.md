# First Principles

Strip to fundamentals. Rebuild from verified truths. Escape reasoning by analogy.

## Core Principle

Don't accept "that's how it's always done." Reduce to physical / mathematical / economic truths, then reconstruct from there. Championed by Aristotle through Musk — works because analogies inherit constraints that may not apply.

## When to Use

| Symptom                                | Action                                 |
| -------------------------------------- | -------------------------------------- |
| Told "impossible" or "too expensive"   | Challenge the cost floor               |
| "That's just how the industry does it" | Ask _why_ the convention exists        |
| Designing something new from scratch   | Start from physics / math constraints  |
| Incremental gains feel stuck           | Check if you're reasoning from analogy |

## Process

1. **List current assumptions** — everything "everyone knows." Constraints, costs, limitations, conventional wisdom, why-it-can't-be-done statements.
2. **Classify each** — physics / math law, vendor constraint, or convention?
   - Physics / math: actually immovable
   - Vendor: movable with effort
   - Convention: movable by deciding to
3. **Challenge conventions** — "what evidence supports this? under what conditions would it be false? who benefits from this assumption persisting?"
4. **Rebuild from verified fundamentals** — what's the simplest solution satisfying the physics constraints only? What becomes possible without the false constraints?
5. **Validate against reality** — does the rebuild violate any actual law? What's the minimum viable test to prove or disprove?

## Mental Traps

| Trap                 | Description                     | Antidote                       |
| -------------------- | ------------------------------- | ------------------------------ |
| Reasoning by Analogy | "Others do it this way"         | "Is it optimal?"               |
| Appeal to Authority  | "Experts say impossible"        | "Impossible _how_?"            |
| Sunk Cost            | "We've always done it this way" | "If we started today?"         |
| Complexity Bias      | "Complex = better"              | "Simplest version that works?" |
| False Constraints    | Accepting artificial limits     | "Physics law or convention?"   |

## Example

**Assumption:** "We need a microservices architecture because we need to scale."

**First-principles breakdown:**

- What problem are we solving? Team-independence, deployment independence, fault isolation.
- What are the physics constraints? Network hop latency (1ms LAN), serialization cost, operational complexity per service (real $).
- At _our_ current scale (10K requests/min, 4 engineers), what does the math say?
- A modular monolith with clear module boundaries satisfies team-independence (via code ownership) and deployment-independence (via feature flags) without the 10x ops burden.

**Result:** scale decision decoupled from architecture decision. Microservices when the math justifies it, not when the conference talk does.

## Red Flag

Everyone accepts the constraint without pointing to evidence for it.

## Combining

Pairs with **Inversion** — after rebuilding from first principles, invert the rebuild to find hidden assumptions you smuggled in. Pairs with **Via Negativa** — first-principles often reveals features that exist only because the analogy demanded them.

**Related:** Via Negativa (once rebuilt, what do you no longer need?) · Simplification Cascades (first-principles unifies from scratch; simplification unifies from existing instances — use whichever is cheaper).
