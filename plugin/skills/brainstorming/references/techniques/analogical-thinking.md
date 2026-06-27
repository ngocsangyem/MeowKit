# Technique: Analogical Thinking

## When to Apply
The problem looks novel but probably isn't. Cross-domain transfer often surfaces patterns the user hasn't considered.

## Process
1. State the problem in domain-neutral language (no jargon, no tech names)
2. Ask: "What other industry/system has solved a structurally similar problem?"
3. Pick 3 analogues from distinct domains (e.g., logistics, biology, finance, gaming)
4. For each: extract the *mechanism*, not the *implementation*
5. Translate the mechanism back into the user's tech context

## Output Shape
| # | Analogue domain | Mechanism | Translation to local stack | Risk in translation |
|---|-----------------|-----------|---------------------------|---------------------|

## Example
**Problem:** "How to handle bursty load on our API?"
**Domain-neutral:** "How to absorb sudden demand spikes without dropping requests?"

| # | Analogue | Mechanism | Translation | Risk |
|---|----------|-----------|-------------|------|
| 1 | Highway on-ramp metering | Rate-limit at ingress, smooth flow downstream | API gateway with token bucket per client | Tuning the bucket size requires real traffic data |
| 2 | Hospital triage | Classify, queue by priority, drop low-priority gracefully | Priority queue + 503 with Retry-After for low-tier | Defining priority correctly is product work, not infra |
| 3 | Reservoir / dam | Buffer the burst, release at sustainable rate | SQS / Kafka in front of compute layer | Adds eventual consistency — not all endpoints can defer |

## Anti-pattern
Picking analogues from the *same* domain (e.g., "how does Stripe rate-limit?"). That's reference research, not analogical thinking. Force the analogue to come from a non-software domain.
