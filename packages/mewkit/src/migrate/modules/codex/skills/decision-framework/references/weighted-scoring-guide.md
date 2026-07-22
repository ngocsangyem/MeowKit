# Weighted Scoring Guide

Multi-factor scoring for decisions that involve trade-offs between competing criteria.
Use when a simple rule tree isn't sufficient — multiple factors influence the right outcome.

---

## When to Use Weighted Scoring

Use scoring when:
- Two case handlers regularly disagree on the same case type
- The "right" answer depends on 3+ factors simultaneously
- You need an auditable, consistent record of why a decision was made

Skip scoring when:
- A single factor is determinative (e.g., fraud detected → always reject)
- The decision is binary with a clear threshold (e.g., refund if < $50)

---

## Setup: Define Factors and Weights

### Step 1: List 3-5 Decision Factors

Identify the factors that most affect whether the decision should go one way or another.
Keep factors independent — if two factors always move together, merge them.

| Factor | Description | Weight |
|--------|-------------|--------|
| [Factor 1] | [What this measures] | [X%] |
| [Factor 2] | [What this measures] | [Y%] |
| [Factor 3] | [What this measures] | [Z%] |
| **Total** | | **100%** |

**Weights must sum to 100%.** If you can't assign weights confidently, ask the domain expert:
"If you could only use one factor to make this decision, which would it be?" That factor gets the highest weight.

### Step 2: Define Scoring Scale (1-5)

For each factor, define what 1, 3, and 5 mean. Scores 2 and 4 are interpolated.

| Score | Meaning |
|-------|---------|
| 5 | Strongly favors [positive disposition] |
| 3 | Neutral / mixed signal |
| 1 | Strongly favors [negative disposition] |

Example for a "Customer Relationship" factor:
- 5 = Long-term account, no prior disputes, high LTV
- 3 = Standard account, 1-2 minor disputes
- 1 = New account, repeat issues, negative payment history

### Step 3: Score Each Option

For each decision option (e.g., Approve / Partial Approve / Reject):

```
Score = Σ (Factor Score × Factor Weight)
```

| Factor | Weight | Option A Score | Option A Weighted | Option B Score | Option B Weighted |
|--------|--------|----------------|-------------------|----------------|-------------------|
| Factor 1 | 40% | 4 | 1.60 | 2 | 0.80 |
| Factor 2 | 35% | 3 | 1.05 | 4 | 1.40 |
| Factor 3 | 25% | 5 | 1.25 | 3 | 0.75 |
| **Total** | 100% | | **3.90** | | **2.95** |

Higher score = stronger recommendation. Proceed with the highest-scoring option unless a safety/compliance rule overrides.

---

## Calibration: Validate Weights Against History

Before deploying the scoring model, run 3 real historical cases through it.

For each case:
1. Score all options using the current weights
2. Check if the highest-scoring option matches the expert's actual decision
3. If it doesn't match: adjust the weight of the factor that caused the discrepancy

**Calibration threshold:** If scoring disagrees with expert judgment on 2 of 3 cases, the weights need significant revision. Interview the expert to understand which factor they weighted most heavily.

**Document calibration results:**

| Case ID | Expert Decision | Scoring Top Pick | Match? | Adjustment Made |
|---------|----------------|------------------|--------|-----------------|
| [ID] | [decision] | [top pick] | Yes/No | [if no: what changed] |

---

## Gotchas

- Weights drifting over time: re-calibrate quarterly against recent decisions
- Factor overlap: if two factors always score the same way, merge them or one is redundant
- Safety override: a score can never override a hard safety or compliance rule — scoring is a tiebreaker, not a bypass
