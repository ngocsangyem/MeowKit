# Synthesis — Party Mode Decision Summary

After all discussion rounds complete (or user says "decide"), synthesize findings.

## Process

1. **Collect** all agent responses from all rounds
2. **Identify agreements** — points where all agents aligned
3. **Identify disagreements** — points where agents diverged, with each position
4. **Identify risks** — any risk flagged by any agent (err on the side of inclusion)
5. **Formulate recommendation** — weight by: majority position + risk severity + user's stated constraints
6. **Present for decision** — user makes the final call

## Output Template

```markdown
## Party Mode Decision Summary

**Topic:** [the original topic]
**Participants:** [agent list]
**Rounds completed:** [N of 3]

### Agreed Points
- [point] — supported by all participants

### Disagreements
| Point | Position A | Position B |
|-------|-----------|-----------|
| [topic] | [agent]: [stance] | [agent]: [stance] |

### Risks Identified
- [risk] — flagged by [agent], severity: [high/medium/low]

### Recommendation
[1-2 sentence synthesized recommendation]

**Confidence:** [high/medium/low] — based on agreement level

### Next Step
[Concrete next action if user accepts recommendation]
```

## Rules

- Never fabricate consensus — if agents disagreed, show it clearly
- Never dismiss minority positions — sometimes the dissenter is right
- Always include risks even if the recommendation is clear
- Keep the summary under 300 tokens
