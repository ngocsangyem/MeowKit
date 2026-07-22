# Technique: Constraint Mapping

## When to Apply
Many constraints, narrow solution space. "We need X but also Y and also Z."

## Process
1. List ALL constraints (technical, business, time, team, compliance)
2. Classify each: HARD (non-negotiable) vs SOFT (prefer but can flex)
3. Find the intersection: what solutions satisfy ALL hard constraints?
4. Score remaining solutions against soft constraints

## Output Shape
**Constraints:**
| # | Constraint | Type | Source |
|---|-----------|------|--------|
HARD = must satisfy. SOFT = prefer.

**Solutions in the intersection:**
| # | Solution | Hard constraints met | Soft constraints score |
|---|----------|---------------------|----------------------|

## Example
**Problem:** "Need a database for our startup"
| # | Constraint | Type | Source |
|---|-----------|------|--------|
| 1 | < $50/month | HARD | Budget |
| 2 | Supports JSON queries | HARD | Product |
| 3 | Managed service | SOFT | Team size |
| 4 | Open source | SOFT | Philosophy |

**Intersection:** PostgreSQL (managed on Supabase/Neon), MongoDB Atlas free tier
