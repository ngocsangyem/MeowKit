# Decision Tree Template

Domain-agnostic template for building a classify → rules → score → escalate decision system.
Fill in your domain below. See `examples/` for worked instances.

---

## Step 1: Domain Header

**Domain:** [e.g., Returns Processing / Billing Ops / Incident Response]
**Decision being made:** [One sentence: what is decided, for whom, how often]
**Decision owner:** [Role or team responsible]
**Volume:** [Approximate decisions per day/week]

---

## Step 2: Classification Taxonomy

Define 3-7 mutually exclusive case types. Every incoming case must map to exactly one.

| Case Type | Definition | Example |
|-----------|------------|---------|
| [Type A]  | [Criteria that make a case Type A] | [Concrete example] |
| [Type B]  | [Criteria that make a case Type B] | [Concrete example] |
| [Type C]  | [Criteria that make a case Type C] | [Concrete example] |
| [Unknown] | Does not match A-C | Escalate immediately for classification |

**Classification rule:** If a case matches multiple types, the higher-priority type wins.
Priority order: [list types by priority, highest first]

---

## Step 3: Decision Rules per Case Type

Order rules within each type by: **Safety → Compliance → Economics → Speed**

### [Type A] Rules
1. Safety check: [what safety condition must be verified first]
2. Compliance check: [regulatory or policy gate]
3. Economic threshold: [cost/value threshold that changes the decision]
4. Standard disposition: [what happens when all checks pass]

### [Type B] Rules
1. Safety check: [...]
2. Compliance check: [...]
3. Economic threshold: [...]
4. Standard disposition: [...]

### [Type C] Rules
1. [...]

---

## Step 4: Decision Matrix (Quick Reference)

| Case Type | Safety OK? | Compliant? | Value > Threshold? | Disposition |
|-----------|------------|------------|-------------------|-------------|
| Type A    | Yes        | Yes        | Yes               | [Action]    |
| Type A    | Yes        | Yes        | No                | [Action]    |
| Type A    | No         | —          | —                 | Escalate L2 |
| Type B    | Yes        | Yes        | —                 | [Action]    |
| [...]     | [...]      | [...]      | [...]             | [...]       |

---

## Calibration Check

Before deploying this taxonomy, run 5 real historical cases through it.
If more than 1 case doesn't fit cleanly → revise the taxonomy.
If expert judgment disagrees with the matrix output → adjust thresholds, not the case.
