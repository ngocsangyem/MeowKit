# Kepner-Tregoe Rational Process

Four integrated processes for rigorous thinking when intuition isn't enough. Most valuable one for debugging: **Problem Analysis (PA)** with the IS / IS-NOT matrix.

**Core principle:** Separate what you know from what you assume. Use structured comparison to reveal truth.

## The Four Processes

| Process                              | Purpose                | Key question           |
| ------------------------------------ | ---------------------- | ---------------------- |
| **SA** — Situation Analysis          | Clarify and prioritize | "What's going on?"     |
| **PA** — Problem Analysis            | Find root cause        | "Why did this happen?" |
| **DA** — Decision Analysis           | Evaluate alternatives  | "What should we do?"   |
| **PPA** — Potential Problem Analysis | Anticipate risks       | "What could go wrong?" |

## When to Use Which

- **Unclear priorities, multiple concerns** → SA
- **Known deviation, contested root cause** → PA (the load-bearing process for debugging)
- **Choosing among options with competing criteria** → DA
- **Pre-implementation risk audit** → PPA

For software debugging, PA is the primary value-add. SA/DA/PPA are briefly summarized below.

## Process 2 (primary): Problem Analysis via IS / IS-NOT

### Specify the problem precisely

Not "API is slow." Instead: "API p99 at `/checkout` rose from 200ms to 800ms, starting Monday 09:00 UTC, affecting ~30% of requests."

### Build the IS / IS-NOT matrix

Contrast specification reveals cause. What a problem IS NOT is as load-bearing as what it IS.

| Dimension           | IS                   | IS NOT                       | Distinction          |
| ------------------- | -------------------- | ---------------------------- | -------------------- |
| WHAT — object       | `/checkout` endpoint | `/cart`, `/product`, `/user` | only payment-related |
| WHAT — defect       | 4× latency           | 5xx errors, timeouts         | performance only     |
| WHERE — region      | US-East prod         | EU, US-West, staging         | single region        |
| WHERE — stack layer | DB query phase       | Auth, serialization          | DB layer             |
| WHEN — first seen   | Mon 09:00 UTC        | Pre-Mon, after 18:00         | business hours       |
| WHEN — lifecycle    | At checkout submit   | Browsing, cart-add           | write path           |
| EXTENT — count      | ~30% of requests     | 100% of requests             | intermittent         |
| EXTENT — severity   | 600ms degradation    | Complete failure             | partial              |

### From distinctions → possible causes

For each IS/IS-NOT row, extract a distinction. Then ask: "What changed, in or around, at the time of the distinction?"

Distinctions example: only `/checkout`, only US-East, only business hours, only ~30% of requests. Near 09:00 Mon: payment SDK updated, fraud rules enabled, index rebuild scheduled.

### Test each possible cause

A valid root cause must explain BOTH the IS side AND the IS-NOT side.

| Possible cause     | Explains IS?    | Explains IS-NOT?           | Verdict    |
| ------------------ | --------------- | -------------------------- | ---------- |
| Fraud rules (new)  | ✓ only checkout | ✓ only write path          | ✓ possible |
| Payment SDK update | ✓ only checkout | ✗ would affect all regions | ruled out  |
| Index rebuild      | ✓ DB layer      | ✗ would affect all queries | ruled out  |

A cause that explains only one side is a confounder, not the root.

### Verify

Design verification that confirms or rules out the remaining candidate. Disable fraud rules in canary → measure latency recovery. Matches? Confirmed.

## Process 1 (summary): Situation Analysis

List all concerns. For each, rate **Timing** (when must we act), **Impact** (cost of inaction), **Trend** (worsening/stable/improving). Prioritize by Timing × Impact × Trend. Route each to the right sub-process (PA / DA / PPA).

## Process 3 (summary): Decision Analysis

Define objectives. Classify each as **MUST** (binary pass/fail) or **WANT** (weighted 1–10). Generate alternatives. Screen against MUSTs (failure on any MUST eliminates). Score survivors against WANTs. Weighted-total + risk assessment = final choice.

## Process 4 (summary): Potential Problem Analysis

Before implementation: list potential problems. Rate Probability × Seriousness. For high-PS problems: identify likely causes → preventive actions (reduce probability) + contingent actions (reduce impact if it happens) + triggers (when does contingent activate).

## PA Template (primary use)

```markdown
## Problem

[what / where / when / extent with precision]

## IS / IS-NOT matrix

| Dimension | IS  | IS NOT | Distinction |
| --------- | --- | ------ | ----------- |

## Distinctions

1. ...

## Changes near distinctions

| Change | When | What changed |
| ------ | ---- | ------------ |

## Possible causes

1. (From distinctions + changes)

## Cause test

| Cause | Explains IS | Explains IS-NOT | Verdict |

## Verification plan

[test that confirms or rules out remaining candidate]

## Confirmed root cause

[cause + evidence]
```

## Gotchas

- **Vague problem statement** — "system is broken" gives you nothing to contrast. Restate with concrete what/where/when/extent before filling the matrix.
- **Missing IS-NOT dimensions** — if every IS-NOT cell is "not specified," you skipped the work. The contrast IS the insight.
- **MUST criteria set too loose** — "should be fast" is not a MUST; "p99 under 500ms" is. Loose MUSTs eliminate nothing, turning DA into a vibes exercise.
- **PPA without triggers** — a contingent action without a defined trigger is wishful thinking. Every PPA contingent needs a measurable activation signal.
- **Forcing a single cause** — both IS and IS-NOT sides may point to multiple interacting causes. Real bugs sometimes have two.

## Bridge to sequential-thinking

The PA IS/IS-NOT matrix is a structured variant of the hypothesis table in `meow:sequential-thinking/hypothesis-testing.md`. Use this reference when the bug spans multiple systems, when the cause is contested across on-call shifts, or when a hand-waved root cause would cost real money. For simpler single-layer bugs, the standard hypothesis table suffices.
