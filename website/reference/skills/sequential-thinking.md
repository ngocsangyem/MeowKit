---
title: "mk:sequential-thinking"
description: "Structured step-by-step reasoning before acting. Prevents jumping to conclusions or guessing root causes without evidence. Used by mk:fix diagnosis phase."
---

# mk:sequential-thinking

## What This Skill Does

Provides a structured reasoning framework for problems requiring step-by-step analysis before action. Generates multiple hypotheses from evidence (not guessing), tests each with concrete falsifiable criteria, eliminates refuted hypotheses, and concludes with a confidence-rated root cause and fix scope. Supports explicit revision when new evidence contradicts earlier conclusions, and branching when multiple viable approaches exist. Used internally by `mk:fix` during the diagnosis phase, but can also be invoked directly for complex reasoning tasks.

## When to Use

- Complex problem requiring multi-step reasoning
- Debugging where root cause isn't obvious
- Architecture decisions with multiple trade-offs
- Any situation where "I think it's X" needs evidence before acting
- **NOT** for trivial fixes (typo, lint, single-file changes with obvious cause)
- **NOT** for strategic stuck-ness on approach -- use `mk:problem-solving`
- **NOT** for applying fixes -- use `mk:fix` (which uses sequential-thinking internally)

## Core Capabilities

- **Evidence-based hypothesis generation:** Every hypothesis requires: what would confirm it, what would refute it
- **Minimum 2 hypotheses required:** Prevents anchoring on the first idea
- **Testing protocol:** Cheapest test first (Grep before Bash), mark each as CONFIRMED/REFUTED/INCONCLUSIVE
- **Explicit revision:** When new evidence contradicts a prior conclusion, mark `[REVISION of Hypothesis N]` with explanation
- **Branching support:** When 2+ viable approaches exist, branch evaluation with pros/cons, converge with decision
- **Dynamic adjustment:** Expand when more complex than expected, contract when insight solves early
- **Confidence rating:** High/medium/low on root cause conclusion with evidence chain
- **Fix scope definition:** What must change (files, functions, logic) to address root cause -- not symptoms

### Diagnostic Frameworks

For specific investigation types, specialized frameworks are available:

| Framework | Use When | Methodology |
|-----------|----------|-------------|
| **5-Whys Plus** | Post-mortems, recurring problems, human-error investigations | Enhanced 5-Whys with bias guards + stopping criteria |
| **Scientific Method** | A/B tests, performance investigations, production incidents | Hypothesis -> falsifiable prediction -> experiment -> revise |
| **Kepner-Tregoe** | Multi-system bugs, contested root causes, high-stakes decisions | SA/PA/DA/PPA + IS/IS-NOT matrix |

### Scripts

Two Node.js scripts support deterministic thought tracking:

- `scripts/process-thought.js` -- Validate, track history, branches, revisions (max 20 thoughts)
- `scripts/format-thought.js` -- Format output as box/simple/markdown/json for reports

## Workflow

1. **State the problem** -- What is observed vs expected, with context (when it started, what changed)
2. **Generate hypotheses** -- From evidence, NOT guessing. Each hypothesis needs confirmation and refutation criteria. Generate at least 2 hypotheses; consider common categories (recent code change, data mismatch, environment difference, missing validation, incorrect assumption)
3. **Test hypotheses** -- Use Grep/Read/Bash to find evidence for and against each. Run cheapest tests first
4. **Eliminate** -- Mark each as CONFIRMED, REFUTED, or INCONCLUSIVE with specific evidence
5. **Conclude** -- State root cause with confidence level (high/medium/low) + evidence chain
6. **Scope the fix** -- What must change to address root cause (files, functions, logic), and what NOT to change

Adjust dynamically: expand if more complex than expected, contract if simpler. Revise explicitly when new evidence contradicts.

## Output Format

```markdown
## Sequential Analysis: [problem statement]

### Observations
- Expected: [what should happen]
- Actual: [what happens instead]
- Context: [reproduction, timing, related changes]

### Hypotheses

| # | Hypothesis | Evidence for | Evidence against | Status |
|---|-----------|-------------|-----------------|--------|
| 1 | ... | ... | ... | CONFIRMED/REFUTED/INCONCLUSIVE |
| 2 | ... | ... | ... | CONFIRMED/REFUTED/INCONCLUSIVE |

### Root Cause
Confirmed: [root cause]
Confidence: [high/medium/low]
Evidence: [what confirms this]

### Fix Scope
Files: [what must change]
Functions: [specific functions/methods]
What to change: [description addressing root cause, not symptoms]
What NOT to change: [explicitly scope out unrelated areas]
```

## Usage

```bash
/mk:sequential-thinking   # Describe the problem; skill guides through the framework
```

Typically invoked indirectly by `mk:fix` during diagnosis or by `mk:investigate` during hypothesis testing. Use directly when you need structured reasoning without the full fix lifecycle.

## Example Prompt

> "The dashboard loads fine on desktop but shows blank on mobile. The console has no errors. I've been staring at the responsive CSS for an hour. /mk:sequential-thinking"

The skill generates hypotheses: (1) CSS media query issue, (2) JS rendering condition fails on mobile viewport, (3) API returns different data based on user-agent. Tests each: checks media queries (no issue found), greps for viewport-dependent rendering logic (finds `window.innerWidth < 768` guard that incorrectly hides the dashboard component on mobile), confirms root cause, scopes the fix to that single conditional.

## Common Use Cases

- **Complex bug diagnosis:** Multi-component systems where the symptom is far from the cause
- **Architecture decision reasoning:** Weighing trade-offs with evidence rather than preference
- **Production incident analysis:** Structured root cause with timeline and evidence chain
- **Pre-mortem thinking:** Generating hypotheses about what could go wrong before shipping
- **Cross-team debugging:** When the problem spans multiple services/ownership boundaries

## Pro Tips

- **Always test 2+ hypotheses** -- the first plausible theory is often wrong; testing alternatives prevents anchoring
- **Cheapest test first** -- Grep a pattern before writing a script; read a file before running a build
- **Revision is a sign of good reasoning** -- never force-fit evidence to avoid revising a prior conclusion
- **Use the right framework** -- 5-Whys for human-error investigations, scientific method for performance, Kepner-Tregoe for multi-system bugs
- **The fix scope explicitly lists what NOT to change** -- this prevents scope creep during implementation
- **INCONCLUSIVE is a valid result** -- if you can't confirm or refute, gather more evidence or refine the hypothesis
- **After 3 failed hypothesis cycles, question your assumptions** -- you may be taking something for granted that isn't true

> **Canonical source:** `.claude/skills/sequential-thinking/SKILL.md`
