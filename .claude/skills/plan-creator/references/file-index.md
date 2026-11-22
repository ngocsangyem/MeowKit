# Plan Creator File Index

Every file this skill ships, with its purpose. Use it to find the file for a mode, step or task; the step files name the reference each step needs, so most runs never open this index.

## Step files, assets, prompts and scripts

Paths are relative to the skill directory.

| File | Purpose |
| --- | --- |
| `workflow.md` | Step sequence, variable table, flow diagram (hard mode) |
| `workflow-fast.md` | Compact step sequence for `--fast` mode (00→03→04→07→08) |
| `step-03a-product-spec.md` | Product-level spec drafter: user stories, features, design language. Replaces step-03 when `planning_mode = product-level`. |
| `assets/product-spec-template.md` | Product spec template (Vision, Features, Design Language, AI Integration, Out-of-Scope) |
| `assets/spike-plan-template.md` | Spike plan template (used when `planning_mode = spike`). Two phases: investigate + findings. Required frontmatter: `spike: true`, `timebox:`, `findings_doc:`. NOT compatible with `mk:autobuild` FULL. |
| `step-00-5-intake-packet.md` | Conditional intake packet builder: consolidates ≥2 pre-existing external artifacts before research/drafting |
| `step-05-red-team.md` | Red team review: persona scaling, subagent dispatch, adjudication |
| `step-06-validation-interview.md` | Critical question generation and answer propagation |
| `step-07-gate.md` | Self-check and the question that presents the plan to the user |
| `step-09-post-plan-handoff.md` | Deterministic post-plan handoff: mode-pruned user question (cook \ | validate \ | red-team \ | autobuild \ | end), live risk re-scan, writes `handoff.next` to plan.md frontmatter, prints command + STOPs. |
| `prompts/personas/plan-assumption-destroyer.md` | Plan-specific assumption skeptic persona |
| `prompts/personas/plan-scope-complexity-critic.md` | Plan-specific YAGNI/scope minimalist persona |
| `prompts/personas/plan-security-adversary.md` | Plan-specific security adversary (auth bypass, injection, data exposure). Used at 4+ phases. |
| `prompts/personas/plan-failure-mode-analyst.md` | Plan-specific failure mode analyst (race conditions, cascading failures, recovery). Used at 6+ phases. |
| `scripts/check-product-spec.sh` | Product-spec structural validator (POSIX bash). Enforces feature count, user stories, forbidden patterns. Used by step-03a and step-04 for `--product-level` mode. |

## References

Files in this `references/` directory.

| File | Purpose |
| --- | --- |
| `anthropic-example-plan.md` | RetroForge few-shot calibration example for product-level mode (ambition + feature density reference) |
| `plan-intake-packet.md` | Plan Intake Packet contract: purpose, activation, 6-block schema, quality rules, boundaries |
| `design-evidence-consumption.md` | Consuming a design evidence packet (e.g. Figma): do/don't, adjudication precedence, decision-ledger, flow→validation-matrix, `blocked_on:` phase blocking. Never re-analyzes the design source. |
| `whole-plan-sweep.md` | Whole-Plan Consistency Sweep algorithm (checks W1 + W2). Stage-then-apply: read-only Pass 1 stages Pending Sweep Edits; decision check blocks on unresolved contradictions; write Pass 2 applies edits and logs. |
| `deep-mode.md` | Deep mode contract: when to use/avoid, scout budgets, phase-map appendix, context rules. |
| `tdd-mode.md` | TDD flag contract: phase sections, optional frontmatter, cook handoff propagation, RED-task hydration. |
| `verification-roles.md` | Verification Roles for step-04 sub-step 4d (Fact Checker / Flow Tracer / Scope Auditor / Contract Verifier) with tier selection by phase count. Subagents are READ-ONLY; orchestrator writes the `## Verification Log`. |
| `phase-template.md` | 12-section phase file template |
| `ops-metrics-design.md` | If task involves metrics/KPIs/dashboards, load for metric philosophy, templates, and domain fallbacks |
| `cold-start-context-brief.md` | When writing phase files, follow this template for self-contained, cold-start-safe phase files |
| `plan-mutation-protocol.md` | When modifying an existing plan (split/insert/skip/reorder/abandon), follow this protocol |
| `worked-example-stripe-billing.md` | For plan detail level reference, see this complete worked example (the 7-phase model) |
| `scope-challenge.md` | Scope modes (HOLD/EXPANSION/REDUCTION) |
| `research-phase.md` | Researcher spawning protocol |
| `plan-organization.md` | Directory structure, naming, size rules |
| `output-standards.md` | YAML frontmatter, required sections |
| `validation-questions.md` | Critical question categories for interview |
| `plan-presentation.md` | the question that presents the plan + Context Reminder |
| `task-management.md` | Hydration, cross-session resume, sync-back |
| `solution-evaluation.md` | Trade-off scoring criteria |
| `gotchas.md` | Full gotchas list |
| `solution-design-checklist.md` | Trade-off analysis checklist for Architecture/Risk/Security sections (5 dimensions) |
| `adr-generation.md` | Architecture Decision Record generation |
| `parallel-mode.md` | Ownership matrix template, parallel group rules |
| `two-approach-mode.md` | Approach file template, trade-off matrix, selection flow |
| `workflow-models/feature-model.md` | Workflow template for feature tasks (loaded JIT by step-00) |
| `workflow-models/bugfix-model.md` | Workflow template for bug fix tasks (loaded JIT by step-00) |
| `workflow-models/refactor-model.md` | Workflow template for refactor tasks (loaded JIT by step-00) |
| `workflow-models/security-model.md` | Workflow template for security tasks (loaded JIT by step-00) |
| `advice-checkpoints.md` | `--advice` checkpoint boundaries, caps, and what supervision may not touch |

## Known Exceptions

- `anthropic-example-plan.md` — filename retained as the source-provenance attribution for the few-shot calibration example. The file content is the appendix of a published harness-design article (Prithvi Rajasekaran, Labs); renaming would obscure the research origin. Future brand-prose audits skip this filename per this documented exception.
