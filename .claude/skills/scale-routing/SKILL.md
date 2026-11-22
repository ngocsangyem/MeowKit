---
name: mk:scale-routing
description: "Maps task keywords to a complexity tier. NOT for mk:agent-detector."
triggers:
  - task classification
  - complexity routing
  - phase 0 orient
phase: 0
user-invocable: false
source: local
keywords:
  - scale-routing
  - domain-classification
  - complexity-routing
  - csv-routing
  - execution-tier
when_to_use: "Auto while tiering."
owner: portability
criticality: medium
status: active
runtime: claude-code
requires_runtime: [python>=3.9]
---

# Scale-Adaptive Routing

Classifies a task's complexity from domain keywords, so a fintech auth change is COMPLEX
without a judgment call. Phase 0 sub-skill: the orchestrator runs it while tiering; users do
not invoke it. The agent and risk-flag choice is `mk:agent-detector`.

## How it works

1. **Fast exit.** Match the task description against `data/domain-complexity.csv`. If the match
   is a `low` row and the task names one file, return it and stop.
2. **Otherwise add evidence.** For an ambiguous or multi-domain match, read the task content,
   the project layout and recent git changes (`references/multi-layer-detection.md`) and give
   a confidence: HIGH, MEDIUM or LOW. Task content outranks repository type.
3. **Classify the task type** as `bug_fix`, `feature`, `refactor`, `security`, `devops`, `docs`,
   `review` or `intake`, with a suggested skill (`references/task-type-classification.md`).
4. **Product areas.** If `.meowkit/product-areas.yaml` exists, merge its keywords and paths
   (`references/product-area-config.md`).
5. **Return** `{domain, level, workflow, task_type, suggested_skill, confidence, product_area?}`.
   No match, or LOW confidence: return `unknown` and defer to manual classification.

The tier each `level` maps to, and the escalation rules, are in
`.claude/skills/agent-detector/references/model-selection-rules.md`. This skill returns
complexity, not a model. `mk:autobuild` chooses its own scaffolding density: see
`.claude/skills/autobuild/references/adaptive-density-matrix.md`.

## CSV schema

| Column | Values | Purpose |
|---|---|---|
| domain | snake_case identifier | Domain name |
| signals | comma-separated keywords | Matched against the task description |
| level | low, medium, high | Complexity |
| workflow | one-shot, standard, enhanced, advanced | Workflow intensity |
| web_searches | comma-separated topics | Suggested research queries |

A `one-shot` workflow may skip the plan file only when the CSV says so and the task has zero
blast radius; the CSV alone is not enough. Teams extend routing by adding rows to the CSV.

## Gotchas

- Several domains can match ("fintech dashboard" hits fintech and internal_tools): use the highest level.
- Matching is case-insensitive and the first match names the domain.
- Low-signal keywords ("data", "app") cause false positives: keep signals specific.
- Task content beats repository type: a login-button style fix in a backend repo is frontend work.

## Files

- `data/domain-complexity.csv`: domain to complexity to workflow.
- `references/multi-layer-detection.md`: the evidence layers and confidence.
- `references/task-type-classification.md`: task types, signals and suggested skills.
- `references/product-area-config.md`: the optional `.meowkit/product-areas.yaml` schema.
