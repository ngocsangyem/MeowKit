# Five Whys Plus

Iterative "why" chain with explicit bias guards and evidenced stopping criteria. A rigorous variant of Toyota's Five Whys that avoids premature stopping, blame orientation, and speculation drift.

**Core principle:** Keep asking "why" until you reach something actionable. Guard against the technique's known failure modes.

## When to Use

- Incident post-mortems
- Bug investigations
- Recurring problems (same issue reappearing)
- Customer complaints with unclear root
- Any "why did this fail" question where stopping too early would miss the system-level fix

## Failure Modes (guard against)

| Failure            | Description                     | Guard                                  |
| ------------------ | ------------------------------- | -------------------------------------- |
| Premature stopping | Accepting first plausible cause | Minimum depth + actionability test     |
| Single-cause bias  | Assuming one root cause         | Branch on "what else?" at each step    |
| Blame orientation  | Stopping at human error         | Ask "why was the error possible?"      |
| Confirmation bias  | Finding the expected cause      | Devil's-advocate counter-analysis      |
| Circular reasoning | "Why A?" → "B" → "Why B?" → "A" | Introduce third factor; break the loop |
| Speculation depth  | Answers outrun evidence         | Evidence requirement per step          |

## Process

1. **State the problem precisely** — what observable symptom / when / where / extent / impact. Not "system was slow" but "API p99 at /checkout rose from 500ms to 2.5s between 14:00–14:45 UTC on Jan 15."
2. **Apply "Why" with evidence** — each why's answer needs evidence + confidence (High/Medium/Low). No evidence → mark as hypothesis and test first.
3. **Branch on "What else?"** — at every step, list alternate causes considered and ruled out. This kills single-cause bias.
4. **For human error, ask "Why was it possible?"** — never stop at "engineer made a typo." The system allowed the typo.
5. **Check stopping criteria** — stop only when ALL are true:
   - Actionable: can take concrete action
   - Controllable: within our control
   - Fundamental: fix prevents recurrence
   - Evidenced: supported by data
   - System-focused: not blaming individuals
6. **Counter-analysis** — ask "what evidence contradicts this? what alternative fits the evidence?" before declaring done.

## Output Template (fits sequential-thinking's hypothesis table)

```markdown
## Problem

[what / when / where / extent / impact]

## Why chain

| #   | Question     | Answer | Evidence | Confidence | What else considered (ruled out why) |
| --- | ------------ | ------ | -------- | ---------- | ------------------------------------ |
| 1   | Why did X?   |        |          |            |                                      |
| 2   | Why did [1]? |        |          |            |                                      |

## Stopping check

- [ ] Actionable - [ ] Controllable - [ ] Fundamental - [ ] Evidenced - [ ] System-focused

## Counter-analysis

Contradicting evidence / alternative explanations / confirmation-bias check
```

## Example (compressed)

Problem: payment service 500s during peak.
Why 1 — connection pool exhausted (logs: 100/100 in use). Confidence: High.
Why 2 — queries 10x slower than baseline (p99 50ms → 500ms). Confidence: High.
Why 3 — missing index on `payment_status` (EXPLAIN shows seq scan on 10M rows).
Why 4 — migration rolled back 2 weeks ago.
Why 5 — migration timed out during online deploy.
Why 6 (system) — online index creation can't handle 10M-row table in current window.
Root cause: index-migration tooling gap. Actionable ✓ Fundamental ✓.

## Gotchas

- **The Blame Stop** — "engineer didn't test properly." STOP. Ask: why was deploying without testing possible? → process/tooling gap. Root cause is almost never a person.
- **The Premature Technical Stop** — "query was inefficient." One more step: why was it in production? why didn't review catch it? why no perf testing?
- **Circular Why** — "Why A? → Because B. Why B? → Because A." Break by introducing external evidence or a third factor.
- **Speculation Dive** — answers become untethered from evidence after 4–5 whys. If you can't point to data, mark as hypothesis and test it before going deeper.
- **Single-branch myopia** — one clean why-chain with no branching. Every step should have a "what else considered" column.

## Bridge to sequential-thinking

Use the `hypothesis-testing.md` template in `mk:sequential-thinking` to track the why-chain. Each "why" becomes a hypothesis row; "evidence" fills the Evidence column; counter-analysis drives the Revision section. Five-Whys-Plus is the discipline; sequential-thinking's template is the output.
