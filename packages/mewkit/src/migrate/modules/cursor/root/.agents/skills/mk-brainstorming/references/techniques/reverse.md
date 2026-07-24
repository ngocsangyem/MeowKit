# Technique: Reverse Brainstorming

## When to Apply
Debugging mindset. "How could this fail?" or "What should we prevent?"

## Process
1. Invert the problem: "How could we guarantee this FAILS?"
2. Generate 5-8 failure modes (be creative — think adversarially)
3. For each failure mode: what prevention mechanism blocks it?
4. The prevention mechanisms ARE the solution ideas

## Output Shape
| # | Failure Mode | Prevention | Idea (inverse) |
|---|-------------|-----------|-----------------|

## Example
**Problem:** "How to make our auth system secure?"
**Inverted:** "How to guarantee auth is broken?"
| # | Failure Mode | Prevention | Idea |
|---|-------------|-----------|------|
| 1 | Store passwords in plaintext | bcrypt/argon2 hashing | Use argon2id with salt |
| 2 | Never expire sessions | Session TTL + refresh rotation | 24h access + 7d refresh tokens |
| 3 | No rate limiting on login | Rate limit by IP + account | 5 attempts/min per IP, exponential backoff |
