# Example: Returns Triage Decision Framework

Domain: E-commerce returns processing
Decision: How to disposition each returned item
Volume: ~200 returns/day

---

## Classification Taxonomy

| Case Type | Definition | Example |
|-----------|------------|---------|
| Eligible | Within return window, item condition acceptable | Customer returns unused item within 30 days |
| Ineligible | Outside return window or excluded category | Return requested 45 days after delivery |
| Fraud Suspect | Patterns consistent with return abuse | 5th return this month, high-value item, no receipt |

Priority: Fraud Suspect > Ineligible > Eligible (if multiple signals, higher type wins)

---

## Decision Rules per Type

### Eligible — Inspect and Grade

1. **Safety:** Is item safe to handle and restock? (chemical damage, biohazard → scrap immediately)
2. **Compliance:** Does item have required tags/seals intact for category (food, cosmetics → strict)?
3. **Grading:**
   - Grade A: Like new, original packaging → Restock at full price
   - Grade B: Minor wear, box damaged → Restock at discount or sell on secondary channel
   - Grade C: Functional but cosmetically damaged → Liquidate or refurbish
   - Grade D: Non-functional or heavily damaged → Scrap or parts

### Ineligible — Standard Denial

1. Verify return window from order date (not ship date).
2. Check for exceptions: carrier delay caused late arrival → treat as Eligible.
3. Deny with formal communication (Tone 2). Offer store credit as goodwill if customer LTV > $500.

### Fraud Suspect — Escalate Before Action

1. Do NOT process return until reviewed.
2. Flag account in system.
3. Escalate to L2 (manager) with: order history, return frequency, item value, pattern description.
4. L2 disposition: deny + warn, deny + ban, or approve with documentation.

---

## Escalation Triggers

| Trigger | Level | Action |
|---------|-------|--------|
| Item value > $500 | L2 | Manager review before disposition |
| Fraud suspect flag | L2 | Manager reviews before any action |
| Regulatory item (electronics with data, medical) | L2 | Compliance check required |
| Customer threatens legal action | L3 | Director notified same day |

---

## Edge Cases

**"Wardrobing" — item used then returned as new**
Situation: Item appears unused but shows signs of wear (perfume smell, stretched fabric, missing security tag).
Why obvious approach fails: Grades as B or A on visual inspection alone; would be restocked.
Correct approach: Grade C minimum if security tag missing. Flag account if pattern repeats (2+ incidents).

**Carrier-damaged item returned late**
Situation: Customer returns 35 days out because carrier took 6 days to deliver, then they needed 30 days to notice damage.
Why obvious approach fails: 35 days > 30-day window → auto-deny.
Correct approach: Adjust return window by carrier delay days. Approve if within adjusted window; request carrier claim documentation.
