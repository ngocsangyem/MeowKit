# Scoring Criteria

Used in `--depth deep` mode to evaluate generated ideas.

## Criteria

| Criterion | Weight | Scale | What it measures |
|-----------|--------|-------|-----------------|
| Feasibility | 3x | 1-5 | Can we build this with current team/stack/time? |
| Impact | 3x | 1-5 | How well does this solve the stated problem? |
| Simplicity | 2x | 1-5 | How simple is the implementation? (KISS) |
| Novelty | 1x | 1-5 | Does this offer a non-obvious advantage? |

## Scoring Process

1. Score each idea on all 4 criteria (1-5)
2. Calculate weighted total: (feasibility x 3) + (impact x 3) + (simplicity x 2) + (novelty x 1)
3. Max possible: 45. Min: 9.
4. Rank by total. Top 3 are recommended for further exploration.

## Anti-Bias Rules

- Score ALL ideas before comparing any (prevents anchoring)
- Familiar solutions scoring high on feasibility must ALSO score high on impact — don't pick easy over effective
- If top 3 are all "safe" choices (novelty < 2), flag: "All recommendations are conservative. Consider exploring idea #N for higher upside."
