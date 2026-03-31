# Party Mode Decision Synthesis

After all rounds complete, synthesize the discussion into a structured decision.

## Template

```markdown
## Decision: [Topic]
**Date:** YYYY-MM-DD
**Participants:** [agent1], [agent2], [agent3]
**Rounds:** N

### Consensus
[What was agreed upon — 2-3 sentences]

### Key Arguments
- **For:** [strongest argument supporting the decision]
- **Against:** [strongest counterargument and why it was outweighed]

### Decision
[Clear, actionable statement of what to do]

### Next Steps
- [ ] [First concrete action]
- [ ] [Second concrete action]

### Dissent (if any)
[Agent] disagreed because: [reason]. Acknowledged but overruled because: [reason].
```

## Rules
- Synthesis must be factual — do not invent consensus that didn't emerge
- If no consensus reached, state "No consensus" and list the options with their advocates
- Persist to `.claude/memory/decisions.md` if decision affects future sessions
