---
title: "mk:sequential-thinking"
description: "Structured step-by-step reasoning — hypothesis generation, evidence-based elimination, explicit revision. Used by mk:fix diagnosis phase."
---

# mk:sequential-thinking

Structured reasoning with hypothesis generation, elimination, and explicit revision capability. Prevents jumping to conclusions or guessing root causes without evidence.

## When to use

- Complex problem requiring multi-step reasoning
- Debugging where root cause isn't obvious
- When `mk:fix` invokes diagnosis phase
- Architecture decisions with multiple trade-offs
- Any "I think it's X" that needs evidence before acting

NOT for trivial fixes (typo, lint) or single-file changes with obvious cause. NOT for strategic stuck-ness (use `mk:problem-solving`).

## Process

1. **State the problem** — observed vs expected
2. **Generate hypotheses** — from evidence, NOT guessing. Each needs: what would confirm, what would refute
3. **Test hypotheses** — use Grep/Read/Bash to find evidence
4. **Eliminate** — mark each CONFIRMED, REFUTED, or INCONCLUSIVE with evidence
5. **Conclude** — root cause with confidence level + evidence chain
6. **Scope the fix** — what must change to address root cause (not symptoms)

New evidence contradicting earlier conclusions → explicit REVISION step, not silent override.
