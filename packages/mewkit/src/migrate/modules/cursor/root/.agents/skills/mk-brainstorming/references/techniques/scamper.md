# Technique: SCAMPER

## When to Apply
Improving or iterating an existing thing — feature, API, workflow, schema. NOT for greenfield design (use `multi-alternative.md` or `first-principles.md` instead).

## Process
Walk the existing thing through 7 lenses. Generate at most 1-2 ideas per lens; you do not need to find an idea for every lens.

| Lens | Question |
|------|----------|
| **S**ubstitute | What component could be swapped for a different one? |
| **C**ombine | What two parts could be merged into one? |
| **A**dapt | What pattern from elsewhere could be borrowed? |
| **M**odify | What attribute could be amplified or shrunk (size, frequency, scope)? |
| **P**ut to other use | What new job could the existing thing do? |
| **E**liminate | What could be removed entirely? |
| **R**everse | What if the order, direction, or polarity were inverted? |

## Output Shape
| Lens | Idea | Why interesting | Cost to validate |
|------|------|-----------------|------------------|

## Example
**Existing thing:** "Our login flow uses email + password + email-OTP for MFA"

| Lens | Idea | Why interesting | Cost to validate |
|------|------|-----------------|------------------|
| Substitute | Swap email-OTP for TOTP app | Faster, no email-deliverability risk | 1 day spike |
| Eliminate | Drop password, keep magic-link only | Removes password-reset surface | A/B test on 1% of signups |
| Reverse | Verify device first, then identity | Matches mobile-app patterns | Requires device-binding library |

## Anti-pattern
Forcing all 7 lenses. SCAMPER is a checklist, not a quota. If a lens produces a weak idea, skip it.
