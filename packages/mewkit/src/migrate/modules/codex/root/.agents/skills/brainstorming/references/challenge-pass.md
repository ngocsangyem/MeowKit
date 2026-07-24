# Challenge Pass

Run once after generation and before recommendation. Keep it compact; this is not `mk:party`.

## Checks

| Check | Question | Fail behavior |
|---|---|---|
| Duplicate architecture | Are multiple ideas the same mechanism with different tools? | Merge duplicates; generate one orthogonal replacement. |
| Hard constraints | Does any recommendation violate a binding constraint? | Drop it or report empty intersection. |
| Category diversity | Are ideas clustered in 1-2 categories after pivot? | Regenerate once from a missing category. |
| Conservative drift | Do all top ideas favor familiar, low-novelty choices? | Surface one higher-upside alternative and its risk. |
| Missing failure mode | Would a stakeholder, attacker, operator, or maintainer reject this? | Add the objection and adjust recommendation. |

## Limits

- Max 5 checks.
- Max 1 regeneration pass.
- Do not run `mk:party` automatically. Offer it only for high-stakes security, performance, UX, migration, or architecture trade-offs.
- If the top deep scores are within 2 points, ask for one tie-break criterion or state that there is no clear winner.

## Recommendation Evidence

Every recommendation must cite at least one of:

- score or weighted criterion
- fit to binding constraint
- novelty category
- scout touchpoint or existing code pattern
- rejected alternative trade-off
