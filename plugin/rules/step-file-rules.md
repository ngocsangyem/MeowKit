# Step-File Execution Rules

These rules govern how agents execute multi-step workflow skills that use the step-file architecture.

## What Is Step-File Architecture

Some skills decompose complex workflows into individual step files:
```
skills/mk:review/
├── SKILL.md           # Entrypoint (metadata only)
├── workflow.md        # Step sequence definition
├── step-01-*.md       # Step 1
├── step-02-*.md       # Step 2
└── ...
```

## Rule 1: One Step at a Time

NEVER load multiple step files simultaneously.
ALWAYS read the entire step file before executing any instructions in it.
ALWAYS complete the current step before reading the next.

WHY: JIT loading keeps context lean and prevents competing step instructions.

This is also the toolkit's implementation of host-runtime progressive disclosure: `SKILL.md` stays small, `workflow.md` declares the sequence, and step files load only when needed.

## Rule 2: Never Skip Steps

NEVER skip steps or optimize the sequence, even if a step seems unnecessary.
The step sequence is designed — each step may produce artifacts the next step needs.

WHY: Empty steps are cheap; skipped load-bearing steps break workflows.

## Rule 3: Follow Step Instructions Exactly

ALWAYS follow the exact instructions in the step file.
Do NOT improvise, add steps, or deviate from the documented procedure.

WHY: Step files are tested as a sequence; deviations are untested behavior.

## Rule 4: State Persistence

When a step-file workflow produces intermediate results, persist them for the next step.
Use the mechanism specified in the workflow:
- Frontmatter variables (within the session)
- `session-state/{skill-name}-progress.json` (survives context reset)

WHY: Persisted state enables resumption after context reset.

## Rule 5: Monolithic Skills Are Fine

Skills under 150 lines do NOT need step-file decomposition.
Only decompose when the skill has 3+ distinct phases with different context needs.

WHY: Simple skills are clearer as one file; step files add navigation overhead.

## Rule 6: Two-Level Reference Chains Are Permitted for Step-File Skills

Step-file skills MAY chain `SKILL.md → step-NN.md → references/X.md` as an architectural exception to the "refs one level deep" rule.

REQUIREMENT: every `step-NN-*.md` file in a step-file skill MUST open with a `## Contents` Table of Contents listing its referenced files. This ensures partial-read previews (`head -100`) land on navigation, not deep content.

WHY: Step-level references preserve JIT loading; a ToC keeps indirection navigable.

Open step files with a ToC pointing to their own references.

## Applicability

These rules apply ONLY to skills that have a `workflow.md` file.
Skills without `workflow.md` are monolithic and follow standard execution.

Currently step-file enabled:
- `mk:plan-creator` — 9-step planning workflow (00-08)
- `mk:review` — 5-step adversarial review workflow (includes step-02b persona passes)
- `mk:evaluate` — 5-step behavioral verification (load-rubrics → boot-app → probe → grade → feedback)
- `mk:autobuild` — 7-step autonomous build pipeline (tier-detection → plan → contract → generate → evaluate → iterate-or-ship → run-report)
- `mk:trace-analyze` — 6-step trace analysis (ingest → partition → scatter → gather → suggestions → HITL gate)
