# Plan Creator File Index

Every file this skill ships. The step files name the reference each step needs, so most runs never open this index. Paths are relative to the skill directory.

## Workflow and steps

| File | Purpose |
|---|---|
| `workflow.md` | Mode matrix, step table, variables |
| `step-00-scope-challenge.md` | Route, classify, pick mode; consolidate upstream artifacts |
| `step-01-research.md` | Plan directory, researchers, codebase scout |
| `step-03-draft-plan.md` | `plan.md` and phase files |
| `step-03a-product-spec.md` | Product-level spec (replaces step 3) |
| `step-04-semantic-checks.md` | Semantic and structural checks, verification, pruning |
| `step-05-red-team.md` | Adversarial review and consistency sweep |
| `step-06-validation-interview.md` | Interview and answer propagation |
| `step-07-gate.md` | Present and settle the plan |
| `step-08-hydrate-tasks.md` | Session tasks and integrity checks |
| `step-09-post-plan-handoff.md` | Record the next step, print the command |

## Assets, prompts, scripts

| File | Purpose |
|---|---|
| `assets/plan-template.md` | Fast-mode `plan.md` template |
| `assets/plan-quick.md` | Short plan format the planner agent uses |
| `assets/bead-template.md` | Bead template the planner agent uses |
| `assets/product-spec-template.md` | Product spec template |
| `assets/spike-plan-template.md` | Spike plan: investigate and findings phases |
| `prompts/personas.md` | The four red-team lenses and the shared finding format |
| `scripts/check-product-spec.sh` | Product-spec validator (feature count, user stories, forbidden patterns) |

## References

| File | Purpose |
|---|---|
| `phase-template.md` | Phase file frontmatter and 12 sections |
| `modes-and-flags.md` | What each mode flag changes; `--spike` constraints |
| `deep-mode.md`, `parallel-mode.md`, `two-approach-mode.md`, `tdd-mode.md` | Mode contracts |
| `solution-design-checklist.md` | Trade-off checklist for Architecture, Risk and Security sections |
| `verification-roles.md` | Claim verification roles and tiers (step 4) |
| `whole-plan-sweep.md` | Consistency sweep after red team and interview |
| `validation-questions.md` | Interview categories, keywords, section mapping |
| `plan-presentation.md` | Summary shown at step 7 |
| `task-management.md` | Hydration and integrity checks |
| `red-team-standalone.md`, `validate-standalone.md`, `archive-workflow.md` | The `red-team`, `validate` and `archive` aliases |
| `plan-intake-packet.md` | Packet that consolidates upstream reports |
| `design-evidence-consumption.md` | Using a design evidence packet |
| `cold-start-context-brief.md` | Self-containment test for phase files |
| `plan-mutation-protocol.md` | Split, insert, skip, reorder, abandon |
| `adr-generation.md`, `ops-metrics-design.md` | Optional guides |
| `advice-checkpoints.md` | `--advice` checkpoints |
| `anthropic-example-plan.md` | Product-level calibration example (the filename credits its source and is kept) |
| `workflow-models/*.md` | Per-task-type plan shape and agent sequence |
