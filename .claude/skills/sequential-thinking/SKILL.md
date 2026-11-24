---
name: mk:sequential-thinking
version: 1.0.0
description: "Step-by-step hypothesis reasoning. NOT for mk:problem-solving."
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
source: local
keywords:
  - sequential-thinking
  - step-by-step-reasoning
  - mcp-sequentialthinking
  - evidence-based
  - incremental-analysis
  - chain-of-thought
when_to_use: "Multi-step analysis."
user-invocable: true
owner: research
criticality: medium
status: active
runtime: claude-code
---

# Sequential Thinking

Evidence-first reasoning for a question whose cause or answer is not obvious: state what is observed, form hypotheses from evidence, test the cheapest first, and conclude only on a test that could have failed. Use it for diagnosis where the root cause is unclear, and for decisions where "I think it's X" needs evidence before acting. Skip it for a trivial fix (typo, lint) or a single-file change with an obvious cause.

| Situation | Use |
|---|---|
| Something is broken and needs fixing | `mk:fix` (it calls this skill when it diagnoses) |
| Unknown symptoms, nothing reproduced yet | `mk:investigate` first, then this skill |
| Stuck on an approach, not a cause | `mk:problem-solving` |
| A decision between known options | `mk:advise` or `mk:party` |

## Process

1. **State the problem**: observed against expected.
2. **Hypothesise from evidence**, never from a guess. Each hypothesis says what would confirm it and what would refute it.
3. **Test** with Grep, Read or Bash, cheapest test first (grep for the string before a full build). Search for evidence against your favourite hypothesis too.
4. **Mark** each CONFIRMED, REFUTED or INCONCLUSIVE with its evidence.
5. **Conclude** when a test that could have failed confirms a hypothesis; otherwise test the next one. A cause confirmed that way needs no second hypothesis for its own sake.
6. **Scope the fix**: what must change to address the root cause, not the symptom.

Expand if the problem is bigger than expected and contract if it is simpler.

## Output

For diagnosis, use the table in `references/hypothesis-testing.md`:

```markdown
## Sequential Analysis: [problem]
| # | Hypothesis | Evidence for | Evidence against | Status |
### Root Cause
Confirmed: [cause] | Confidence: high/medium/low | Evidence: [what confirms it]
### Fix Scope
[what must change: files, functions, logic]
```

For a decision (not a diagnosis), give: the options, the evidence for each, the chosen option, and what would change it.

## Revision and branching

When new evidence invalidates a conclusion, mark it (`[REVISION of Hypothesis N]: correction and why`). When two or more approaches are viable, branch, evaluate each and converge on one. Patterns: `references/core-patterns.md`; spiral refinement and multi-branch convergence: `references/advanced-techniques.md`; uncertainty and revision cascades: `references/advanced-strategies.md`; worked examples: `references/examples-debug.md`, `examples-api.md`, `examples-architecture.md`.

## Diagnostic frameworks

Load one only when a method fits:

- `references/five-whys-plus.md`: post-mortems, recurring problems, human-error investigations.
- `references/scientific-method.md`: A/B tests, performance work, production incidents.
- `references/kepner-tregoe.md`: multi-system bugs, contested root causes, high-stakes decisions.

## Scripts (optional)

Use only to hand a long chain of thoughts to another session; they are not part of the process. `scripts/process-thought.js` validates and tracks thought history (max 20 thoughts; `--summary` gives a compact handoff to `mk:fix`); `scripts/format-thought.js` formats a thought as box, simple, markdown or json. Run them as `node ${CLAUDE_SKILL_DIR}/scripts/...`.

## Gotchas

- **Premature conclusion**: confirming a hypothesis with a test that could not have failed. Pick a test that would have refuted it.
- **Evidence-free hypotheses**: "I think it's X" without at least one piece of verifiable evidence.
- **Revision avoidance**: when new evidence contradicts the conclusion, revise explicitly; being wrong early costs less than being wrong at the end.

More in `references/gotchas.md`.

## Workflow

`mk:fix` calls this skill during diagnosis; input comes from `mk:investigate` or direct observation, and the output feeds the fix.

```
mk:investigate -> symptoms and traces -> mk:sequential-thinking -> root cause -> mk:fix
```
