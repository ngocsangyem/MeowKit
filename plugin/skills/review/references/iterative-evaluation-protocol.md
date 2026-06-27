# Iterative Evaluation Protocol

A structured multi-pass review process for high-stakes code. Use when a single review pass is insufficient given the risk surface.

## When to Use

Load this protocol when any of the following are true:

- Code touches payment or billing logic (Stripe, subscription state, invoice generation)
- Code touches authentication or authorization (session management, JWT, RBAC, OAuth)
- Code is security-critical (crypto, secrets handling, rate limiting, input sanitization)
- Code exposes a new public API endpoint or webhook receiver
- User invokes `/mk:review --iterative` explicitly

For all other diffs, the standard single-pass review (step-02 → step-03 → step-04) is sufficient.

## The 3-Pass Structure

**Maximum 3 passes. Never exceed this limit.**

### Pass 1: Full Adversarial Review

Execute the complete standard review workflow (step-01 through step-04) with all adversarial personas active regardless of diff size. The scope gate in step-01 is overridden — full review runs unconditionally.

Output: full findings list with severity ratings. Do NOT issue a verdict yet.

### Pass 2: Targeted Re-Review

Developer receives Pass 1 findings and makes changes. Reviewer re-reviews:
- All items flagged in Pass 1 (verify each was addressed or explicitly accepted)
- Any code adjacent to the changes made in response to Pass 1 (new code can introduce new bugs)
- The forced-finding protocol runs again on the new diff

Output: delta findings (new issues introduced, prior issues resolved). Do NOT issue a verdict yet.

### Pass 3: Final Verdict

Re-review only items still unresolved from Pass 1 and Pass 2. No new scope expansion.

Output: single final verdict (PASS / WARN / FAIL) across all 5 dimensions. This verdict is the Gate 2 input.

If Pass 3 still has unresolved CRITICAL items → FAIL verdict, escalate to user.

## Separation of Concerns (hard rule)

**Reviewer never implements.** If the reviewer identifies a fix, they describe what needs to change — they do not write the code.

**Developer never self-evaluates.** The developer who made the changes cannot serve as reviewer for any of the 3 passes.

Violating either rule invalidates the review. Gate 2 cannot be presented from a compromised review.

## Exit Condition

The iterative process exits when:
- All 5 verdict dimensions are PASS or WARN
- All WARN items have been explicitly acknowledged by the human

Or when Pass 3 completes (maximum — do not run Pass 4 under any circumstances).

## Gate 2 Integration

The iterative evaluation protocol produces a single final verdict, identical in format to the standard review verdict. Gate 2 receives this verdict and applies the same approval rules.

The iterative process replaces steps 02-03 of the standard workflow. Step-04 (verdict) runs once, after Pass 3, using the cumulative findings from all 3 passes.
