# Example: Billing Operations Decision Framework

Domain: SaaS billing operations
Decision: How to handle billing exceptions, failures, and disputes
Volume: ~50 exceptions/day

---

## Classification Taxonomy

| Case Type | Definition | Example |
|-----------|------------|---------|
| Payment Failure | Charge attempt failed (card declined, expired, insufficient funds) | Stripe returns `card_declined` on renewal |
| Refund Request | Customer requests money back for a charge already processed | Customer disputes last month's invoice |
| Churn Risk | Billing issue is a signal the customer may cancel | Downgrade request + payment failure in same week |
| Billing Error | Company made the error (wrong amount, duplicate charge, wrong plan) | Customer charged for cancelled add-on |

Priority: Billing Error > Churn Risk > Refund Request > Payment Failure

---

## Decision Rules per Type

### Payment Failure — Auto-Retry then Escalate

1. **Safety:** Is account in good standing (no fraud flag, no legal hold)?
2. **Auto-retry logic:**
   - Day 0: Failure → retry after 3 days
   - Day 3: Retry → if fails again, send payment update email
   - Day 7: Second retry → if fails, downgrade to free or suspend
   - Day 14: Final notice → account suspension if no payment method update
3. **Escalation:** If customer is on annual plan or MRR > $500/mo → skip auto-retry, go to manual outreach (L1 specialist) at Day 0.
4. **Disposition:** Recover payment | Downgrade | Suspend | Write off (< $10 after 14 days)

### Refund Request — Evaluate and Decide

1. **Compliance:** Is refund within money-back guarantee window (30 days for monthly, 14 days for annual)?
2. **Economics:** Refund amount vs. customer LTV.
   - LTV > 5× refund amount → approve, no questions
   - LTV 1-5× refund amount → approve with note, flag for retention outreach
   - LTV < 1× refund amount → review reason; deny if no product defect
3. **Disposition:** Full refund | Partial refund (prorated) | Credit to account | Deny with explanation

### Churn Risk — Retention First

1. Pause billing action (do not suspend while churn risk is open).
2. Route to retention specialist within 24h.
3. Retention toolkit: offer plan change, pause subscription, apply loyalty discount (max 20%).
4. If retention fails → process original billing action (failure/downgrade) with standard rules.

### Billing Error — Fix First, Apologize Second

1. **Verify error:** Confirm the charge was incorrect before issuing remedy.
2. **Fix immediately:** Issue corrected invoice + refund/credit within same business day.
3. **Communicate:** Proactive email before customer contacts support (Tone 1 if first error, Tone 2 if repeat).
4. **Escalate:** If billing error affected > 10 customers → L3 (director) notified. Root cause analysis required.

---

## Escalation Triggers

| Trigger | Level | Timeline |
|---------|-------|----------|
| Annual plan payment failure | L1 specialist | Same day (no auto-retry) |
| Refund request > $1,000 | L2 manager | Review within 4h |
| Billing error affecting > 10 accounts | L3 director | Same business day |
| Disputed charge → credit card chargeback filed | L2 + Legal | Immediate |
| Customer threatens regulatory complaint | L3 | Within 2h |

---

## Edge Cases

**Annual plan customer requests refund at month 11**
Situation: Customer paid $1,200 annual upfront, requests full refund in month 11.
Why obvious approach fails: 30-day refund window has long passed → auto-deny.
Correct approach: Offer prorated refund for unused month ($100). Escalate to manager if customer disputes. Never deny with no remedy on annual plans.

**Duplicate charge from payment processor error**
Situation: Stripe fires webhook twice; customer charged twice in same minute.
Why obvious approach fails: System sees two valid charges; no internal error flag.
Correct approach: Idempotency check on charge timestamp + amount. If gap < 60 seconds and amount identical, auto-refund second charge and log as processor error. Alert engineering.
