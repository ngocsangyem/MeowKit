---
name: meow:sequential-thinking
version: 1.0.0
description: |
  Use when a problem requires structured step-by-step reasoning before acting.
  Prevents jumping to conclusions or guessing root causes without evidence.
  Triggers on complex debugging, multi-step analysis, hypothesis verification,
  or when meow:fix invokes diagnosis phase.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
sources:
  - claudekit-engineer/sequential-thinking
---

# Sequential Thinking

Structured step-by-step reasoning with hypothesis generation, elimination, and revision capability.

## When to Use

- Complex problem requiring multi-step reasoning
- Debugging where root cause isn't obvious
- When meow:fix invokes diagnosis (Phase 3)
- Architecture decisions with multiple trade-offs
- Any situation where "I think it's X" needs evidence before acting

**Do NOT use for:** trivial fixes (typo, lint), single-file changes with obvious cause.

## Process

1. **State the problem** — what is observed vs expected
2. **Generate hypotheses** — from evidence, NOT guessing. Each hypothesis needs: what evidence would confirm it, what would refute it
3. **Test hypotheses** — use Grep/Read/Bash to find evidence for/against each
4. **Eliminate** — mark each CONFIRMED, REFUTED, or INCONCLUSIVE with evidence
5. **Conclude** — state root cause with confidence level + evidence chain
6. **Scope the fix** — what must change to address root cause (not symptoms)

Adjust dynamically: expand if more complex than expected, contract if simpler.

## Output Format

Use `references/hypothesis-testing.md` template. Key sections:

```markdown
## Sequential Analysis: [problem]

### Hypotheses
| # | Hypothesis | Evidence for | Evidence against | Status |
|---|-----------|-------------|-----------------|--------|

### Root Cause
Confirmed: [root cause]
Confidence: [high/medium/low]
Evidence: [what confirms this]

### Fix Scope
[what must change — files, functions, logic]
```

## Revision & Branching

When new evidence invalidates a previous conclusion:
- Mark revision explicitly: `[REVISION of Hypothesis N]: [correction + why]`
- When 2+ approaches viable: branch, evaluate each, converge with decision

Load `references/core-patterns.md` for revision/branching patterns.

## Gotchas

- **Premature conclusion**: confirming first hypothesis without testing alternatives → test at least 2 hypotheses before concluding
- **Evidence-free hypotheses**: "I think it's X" without evidence → every hypothesis needs at least one piece of evidence
- **Revision avoidance**: refusing to revise when new evidence contradicts → revise explicitly, don't force-fit

Full list: `references/gotchas.md`

## Workflow Integration

Called by `meow:fix` during diagnosis (Step 2). Receives input from `meow:investigate` or direct observation. Output feeds into fix implementation.

```
meow:investigate → symptoms + traces → meow:sequential-thinking → root cause → meow:fix
```
