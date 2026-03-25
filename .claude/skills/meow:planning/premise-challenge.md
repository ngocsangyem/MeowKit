# Skill: Premise Challenge

**Purpose:** Challenge all assumptions in a request before accepting requirements and proceeding to planning.

## When to Use

Invoke this skill at the very start of any planning or feature request, before writing a plan or design document.

## Steps

### Step 1: List All Assumptions

Read the request carefully. Extract every implicit and explicit assumption. Write them as a numbered list. Common assumption categories:

- **User assumptions** — who the user is, what they want, how they behave
- **Technical assumptions** — what stack is used, what constraints exist, what scale is expected
- **Business assumptions** — why this matters, what success looks like, what the timeline is
- **Dependency assumptions** — what already exists, what APIs are available, what teams are involved

### Step 2: Inversion Test

For each assumption, ask: **"What if the opposite were true?"**

| Assumption | Opposite | Impact if opposite is true |
|---|---|---|
| Users want feature X | Users actively avoid X | Wasted effort, negative UX |
| System handles 1K req/s | System must handle 100K req/s | Architecture redesign needed |

If the opposite being true would fundamentally change the approach, the assumption is **risky**.

### Step 3: Identify the Riskiest Assumption

Rank assumptions by: (1) likelihood of being wrong, (2) cost of being wrong. The assumption with the highest combined score is the **riskiest assumption**. Flag it explicitly.

### Step 4: Propose Alternative Framing

If one or more assumptions are weak (high risk, low evidence), propose an alternative framing of the request that does not depend on those assumptions. Present both framings to the human for decision.

### Step 5: Validate Before Proceeding

Do NOT proceed to planning until:
- [ ] All assumptions are listed
- [ ] Riskiest assumption is identified
- [ ] Human has confirmed or corrected the assumptions

## Output Format

Prepend a **Premises** section to the plan file:

```markdown
## Premises

### Assumptions
1. [Assumption] — **Confidence:** high/medium/low — **Risk if wrong:** [impact]
2. ...

### Riskiest Assumption
[Which one and why]

### Alternative Framing
[If applicable — a different way to approach the problem if key assumptions are wrong]

### Validation
- [ ] Premises reviewed by human
- [ ] Riskiest assumption addressed
```

Only after this section is completed and validated should the rest of the plan be written.
