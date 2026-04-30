## Brainstorm: [PROMPT_SUMMARY]

**Technique:** [TECHNIQUE_USED] · **Generated:** [TIMESTAMP] · **Depth:** deep (scored)

### Problem Restatement

[One paragraph confirming what was actually asked and the key constraint that bounds the solution space. Must be confirmed by the user before ideas were generated.]

**Binding constraint:** [the single thing that, if violated, makes any solution unacceptable]

### Discovery Trace

| # | Question asked | User answer (summary) |
|---|----------------|------------------------|
| 1 | [...] | [...] |

(Cap: 3 questions. Omit this section if no discovery was needed.)

### Scope Decision

- [ ] Single concern — proceeded
- [ ] Multi-concern — decomposed; this report covers: **[chosen sub-problem]**. Other concerns deferred to separate brainstorm sessions.

### Technique Selection

**Chosen:** `[technique-name].md`
**Why this over alternatives:** [one sentence — typically references the SKILL.md tiebreaker order or a problem-shape match]

### Ideas (with anti-bias pivot)

Ideas #1–#3 from one category, then pivot at #4 to an orthogonal category. Generate ALL 8 before scoring.

| Category covered before pivot | Category covered after pivot |
|------------------------------|------------------------------|
| [category-A] | [category-B] |

### Scored Ideas

Score each idea on all 4 criteria after the full set exists. See `references/scoring-criteria.md`.

| # | Idea (mnemonic) | Feasibility (×3) | Impact (×3) | Simplicity (×2) | Novelty (×1) | Total |
|---|------------------|:----------------:|:-----------:|:---------------:|:------------:|:-----:|
| 1 | [IDEA] | [1-5] | [1-5] | [1-5] | [1-5] | [9-45] |

### Top 3 Recommendations

1. **[IDEA]** (score: [N]/45) — [rationale grounded in the score, not vibes]
2. **[IDEA]** (score: [N]/45) — [rationale]
3. **[IDEA]** (score: [N]/45) — [rationale]

### Risk Note

- **Conservative drift:** [If all top 3 have novelty < 2, flag: "All recommendations are conservative. Consider exploring idea #N for higher upside."]
- **Empty intersection:** [If using `constraint-mapping` and no idea satisfies all hard constraints, flag here and recommend the user relax a constraint before planning.]
- **Tie-break needed:** [If top 3 scores are within 2 points of each other, the criteria did not separate signal. Ask user for the one criterion that breaks the tie.]

### Category Distribution

| Category | Count |
|----------|:-----:|
| [category-1] | N |
| [category-2] | N |

**Anti-bias check:** [If all ideas cluster in 1-2 categories, flag: "Pivot did not produce real divergence. Consider a focused session on [orthogonal category]."]

### Next Steps

- Create implementation plan from top idea → ask, then invoke `mk:plan-creator` with `{ idea, problem, constraints, scores, rationale }`
- Drill deeper into a specific idea → "explore idea #N"
- Re-score with different criteria → adjust `references/scoring-criteria.md` weights and re-run
