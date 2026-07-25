# Code Review Failure Catalog

Common failure modes during code review. Read before starting any review work.

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "LGTM" (without evidence of review) | Rubber-stamp reviews are theater. They catch nothing and provide false confidence. |
| "The tests pass, so it's good" | Tests are necessary but not sufficient. Passing tests don't prove security, performance, or readability. |
| "We'll clean it up later" | Later never comes. Require cleanup before merge. Deferred cleanup rarely happens. |
| "This is too simple to review carefully" | Simple changes are where unexamined assumptions waste the most time. |
| "I don't want to be the blocker" | Fast bad merges cost more than slow good reviews. Shipping bugs is worse than blocking a PR. |
| "AI-generated code is probably fine" | AI code needs MORE scrutiny, not less. Common failure modes: hallucinated APIs, subtle logic errors, over-engineering. |

## Red Flags

Observable patterns that indicate you're off-track:

- Self-grading as PASS without concrete evidence (build output, test results, runtime data)
- Ignoring the security dimension because "it's just a UI change"
- Reviewing implementation before reviewing tests (tests reveal intent — read them first)
- All findings marked as "Nit" — if nothing is Critical or Important, you aren't looking hard enough
- Approving a change you wouldn't confidently explain to another engineer
- Skipping the architecture dimension for "small" changes (small changes create large precedents)
