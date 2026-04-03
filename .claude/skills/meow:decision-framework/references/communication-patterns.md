# Communication Patterns

3 tones for decision communications. Select based on relationship state and stakes.

---

## Tone Selection Guide

| Situation | Tone | Key Principle |
|-----------|------|---------------|
| Routine decision, good relationship | Collaborative | Brief, data-led, assumes good faith |
| Significant decision, strained relationship | Formal | Documented, references contract/policy, no ambiguity |
| Crisis or escalation | Crisis | Lead with impact, quantify exposure, set deadline |

---

## Tone 1: Routine / Collaborative

**Use when:** Standard case within normal parameters. Relationship is positive. No prior disputes.

**Principles:** Keep it brief. Lead with the outcome, not the process. Invite dialogue.

**Template:**
```
Hi [Name],

[One sentence: what you decided and why — data first]

[If action needed from them]: [specific ask + deadline]

[Optional: what happens next]

[Name]
```

**Example:**
```
Hi Sarah,

Your return request for Order #8821 has been approved — the item arrived damaged,
which qualifies under our 30-day damage policy. Refund of $47.00 will post within 3 business days.

No action needed on your end.

— Returns Team
```

---

## Tone 2: Significant / Formal

**Use when:** High-value decision, disputed case, or prior escalation. Relationship is strained or transactional.

**Principles:** Document everything. Reference the policy/contract explicitly. No informal language.
Leave no room for "I didn't know."

**Template:**
```
Dear [Full Name],

This letter confirms our decision regarding [case reference / order / account].

Decision: [explicit statement]
Basis: [policy section, contract clause, or data point]
Effective date: [date]

[If contested]: To dispute this decision, contact [role] at [contact] within [N] business days.

Regards,
[Full Name, Title]
[Company]
```

**Example:**
```
Dear James Whitfield,

This letter confirms our decision regarding Return Request #4492 (Order #7701, placed 2024-11-03).

Decision: Denied.
Basis: Item returned 38 days after delivery, outside our 30-day return window (Section 4.2, Terms of Sale).
Effective date: 2024-12-11.

To dispute this decision, contact our Customer Relations team at relations@company.com
within 5 business days of this notice.

Regards,
Maya Osei, Returns Manager
Acme Corp
```

---

## Tone 3: Crisis / Escalation

**Use when:** Systemic failure, significant exposure, legal or reputational risk. Time-sensitive.

**Principles:** Lead with impact (not background). Quantify exposure immediately.
Set a specific deadline. Name the decision-maker.

**Template:**
```
URGENT: [Issue in 5 words]

Impact: [number of customers / dollar exposure / systems affected]
Status: [what is happening right now]
Decision needed: [specific decision required]
Deadline: [exact time]
Owner: [name of decision-maker]

Background: [2-3 sentences max]

Options:
A) [action] — [tradeoff]
B) [action] — [tradeoff]

Recommend: [A or B] because [one sentence].
```

**Example:**
```
URGENT: Payment processor outage — 847 orders blocked

Impact: 847 orders unable to complete checkout. Estimated revenue at risk: $94,000/hour.
Status: Stripe API returning 503 since 14:32 UTC. Engineering engaged, ETA unknown.
Decision needed: Switch to backup processor (PayPal) or hold orders until Stripe recovers.
Deadline: 15:00 UTC (28 minutes).
Owner: VP Engineering (Dana Kim)

Options:
A) Switch to PayPal now — orders resume in ~12 min, 0.3% higher fees, some customers see unfamiliar UI.
B) Hold orders — zero fees, but customer drop-off expected at 15+ min wait.

Recommend: A — revenue loss exceeds fee cost within 20 minutes.
```
