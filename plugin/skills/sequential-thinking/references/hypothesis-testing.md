# Hypothesis-Driven Investigation

> Part of mk:sequential-thinking. Use during debugging and root cause analysis.
> Source: open-source upstream (MIT)

## Output Template

Fill this template during diagnosis:

```markdown
## Sequential Analysis: [problem statement]

### Observations
- Expected: [what should happen]
- Actual: [what happens instead]
- Context: [when it started, what changed, reproduction steps]

### Hypotheses (generated from evidence)

| # | Hypothesis | Evidence for | Evidence against | Status |
|---|-----------|-------------|-----------------|--------|
| 1 | [hypothesis] | [evidence] | [evidence] | CONFIRMED/REFUTED/INCONCLUSIVE |
| 2 | [hypothesis] | [evidence] | [evidence] | CONFIRMED/REFUTED/INCONCLUSIVE |
| 3 | [hypothesis] | [evidence] | [evidence] | CONFIRMED/REFUTED/INCONCLUSIVE |

### Elimination Process
- Hypothesis 1: [why confirmed/refuted — specific evidence]
- Hypothesis 2: [why confirmed/refuted — specific evidence]

### Root Cause Conclusion
Confirmed: [root cause — one sentence]
Confidence: [high/medium/low]
Evidence chain: [observation → hypothesis → evidence → conclusion]

### Fix Scope
Files: [list of files that must change]
Functions: [specific functions/methods]
What to change: [description of fix addressing ROOT CAUSE, not symptoms]
What NOT to change: [explicitly scope out unrelated areas]
```

## Hypothesis Generation Rules

1. **From evidence only** — never "I think" without evidence
2. **Minimum 2 hypotheses** — prevents anchoring on first idea
3. **Each testable** — must be verifiable with Grep/Read/Bash
4. **Common categories** to consider:
   - Recent code change introduced regression (`git log --oneline -10`)
   - Data/state mismatch (wrong value at wrong time)
   - Environment difference (works locally, fails in CI)
   - Missing validation (edge case not handled)
   - Incorrect assumption (code assumes X but Y is true)

## Testing Protocol

For each hypothesis:
1. State what evidence would **confirm** it
2. State what evidence would **refute** it
3. Run the cheapest test first (Grep before Bash)
4. Mark result: CONFIRMED | REFUTED | INCONCLUSIVE

If INCONCLUSIVE → gather more evidence or refine hypothesis.
If 2+ hypotheses REFUTED → consider categories you haven't explored.

## Escalation

After 3 failed hypothesis cycles:
- **STOP** — don't generate more hypotheses
- Question assumptions: "What am I taking for granted?"
- Consider environmental factors (OS, Node version, dependency version)
- Ask user for additional context
