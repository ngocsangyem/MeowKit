# Technique: Perspective Shift

## When to Apply
Solution looks correct technically but might fail on a non-technical axis (operations, support, security, user). Adapted from Six Thinking Hats, narrowed to dev contexts.

## Process
Walk the candidate solution through 4-6 perspectives. Each perspective is a stakeholder with different success criteria.

| Perspective | What they care about | Question they'd ask |
|-------------|---------------------|--------------------|
| Future-you (6 mo) | Maintainability | "Will I curse past-me when I have to debug this at 3am?" |
| On-call SRE | Observability, runbooks | "What does this look like when it's broken?" |
| Security | Threat model | "What's the worst thing an attacker could do with this?" |
| New hire | Discoverability | "Could a new dev figure this out from the code alone?" |
| Product / PM | Iteration speed | "How long until we can change our minds about this?" |
| End user | UX, latency, trust | "What does the user experience when this fails?" |

## Process
1. Pick the candidate solution (already on the table from another technique)
2. For each relevant perspective, write one concrete concern + one mitigation idea
3. The mitigations are the new ideas to add to the brainstorm pool

## Output Shape
| Perspective | Concern | Mitigation idea |
|-------------|---------|----------------|

## Example
**Candidate solution:** "Cache user sessions in Redis with 24h TTL"

| Perspective | Concern | Mitigation |
|-------------|---------|------------|
| On-call SRE | Redis goes down → all users logged out at once | Stampede control + signed JWT fallback path |
| Security | 24h is a long blast radius for a stolen token | Rotate refresh token on every use; access token TTL = 15min |
| Future-you | "Why 24h?" — no one will remember the rationale | Comment in config + ADR explaining the trade-off |
| End user | Logging out at midnight is a bad UX | Sliding TTL: extend on activity instead of fixed 24h |

## Anti-pattern
Treating this as a critique-only pass. The output is *new ideas*, not just risks. Every concern must produce a mitigation that goes into the idea pool.
