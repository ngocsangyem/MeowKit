# Step-File Execution Rules

These rules govern how agents execute multi-step workflow skills that use the step-file architecture.

## What Is Step-File Architecture

Some MeowKit skills decompose complex workflows into individual step files:
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

WHY: Loading multiple steps wastes context tokens and creates confusion about which instructions to follow. JIT loading keeps the context window lean. Source: BMAD-METHOD step-file pattern.

## Rule 2: Never Skip Steps

NEVER skip steps or optimize the sequence, even if a step seems unnecessary.
The step sequence is designed — each step may produce artifacts the next step needs.

WHY: "This step is unnecessary" is a rationalization. The workflow author included it for a reason. If a step truly has nothing to do, it will complete quickly. The cost of executing an empty step is near-zero. The cost of skipping a step that wasn't empty is a broken workflow.

## Rule 3: Follow Step Instructions Exactly

ALWAYS follow the exact instructions in the step file.
Do NOT improvise, add steps, or deviate from the documented procedure.

WHY: Step files are tested as a sequence. Deviating introduces untested behavior. If the step file is wrong, fix it — don't work around it.

## Rule 4: State Persistence

When a step-file workflow produces intermediate results, persist them for the next step.
Use the mechanism specified in the workflow:
- Frontmatter variables (within the session)
- `session-state/{skill-name}-progress.json` (survives context reset)

WHY: Context windows can reset mid-workflow. Persisted state enables resumption from the last completed step instead of restarting.

## Rule 5: Monolithic Skills Are Fine

Skills under 150 lines do NOT need step-file decomposition.
Only decompose when the skill has 3+ distinct phases with different context needs.

WHY: YAGNI. Step-file architecture adds file count and navigation overhead. For simple skills, a single SKILL.md is cleaner. The threshold is ~150 lines — beyond that, context efficiency gains from JIT loading outweigh the overhead.

## Rule 6: Two-Level Reference Chains Are Permitted for Step-File Skills

Step-file skills MAY chain `SKILL.md → step-NN.md → references/X.md` as an architectural exception to the "refs one level deep" rule.

REQUIREMENT: every `step-NN-*.md` file in a step-file skill MUST open with a `## Contents` Table of Contents listing its referenced files. This ensures partial-read previews (`head -100`) land on navigation, not deep content.

WHY: Step files are loaded one at a time per Rule 1. Each step only needs its own subset of references, not all of them flattened up to SKILL.md. The ToC at the step's head makes the second level of indirection navigable without reading the whole file.

INSTEAD of: flattening all step-referenced files up to SKILL.md (would bloat the entry point)
USE: step files that open with a ToC pointing to their own references

## Applicability

These rules apply ONLY to skills that have a `workflow.md` file.
Skills without `workflow.md` are monolithic and follow standard execution.

Currently step-file enabled:
- `mk:plan-creator` — 9-step planning workflow (00-08)
- `mk:review` — 5-step adversarial review workflow (includes step-02b persona passes)
- `mk:evaluate` — 5-step behavioral verification (load-rubrics → boot-app → probe → grade → feedback)
- `mk:harness` — 7-step autonomous build pipeline (tier-detection → plan → contract → generate → evaluate → iterate-or-ship → run-report)
- `mk:trace-analyze` — 6-step trace analysis (ingest → partition → scatter → gather → suggestions → HITL gate)
