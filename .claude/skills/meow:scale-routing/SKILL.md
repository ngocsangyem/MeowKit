---
name: meow:scale-routing
description: >-
  Domain-aware complexity routing. Scans task description for domain keywords,
  matches against domain-complexity.csv, returns complexity level, workflow
  intensity, and model tier override. Extends Phase 0 orchestration.
triggers:
  - task classification
  - complexity routing
  - phase 0 orient
phase: 0
user-invocable: false
source: meowkit
---

# Scale-Adaptive Routing

Automatically classifies task complexity based on domain keywords.

> Internal sub-skill of Phase 0 (Orient). Not user-invocable directly — invoked by the orchestrator during task classification.

## Purpose

Replace subjective orchestrator judgment with deterministic, auditable domain-based routing. A fintech auth change should auto-classify as COMPLEX without human intervention.

## How It Works

1. **Input:** User task description (string)
2. **Layer 0:** Match keywords from `data/domain-complexity.csv`
3. **Layer 1:** Analyze task content — classify type and extract mentioned files/modules (load `references/multi-layer-detection.md`)
4. **Layer 2:** Check project context — files present, directory structure, recent git changes
5. **Layer 3:** Score confidence per domain (HIGH ≥70, MEDIUM 40–69, LOW <40)
6. **Classify task type** — map signals to bug_fix/feature/refactor/security/devops/docs/review/intake (load `references/task-type-classification.md`)
7. **Optional:** Check `.claude/product-areas.yaml` if exists — merge area keywords and paths (see `references/product-area-config.md`)
8. **Output:** `{domain, level, workflow, model_tier_override, task_type, suggested_skill, confidence, product_area?}`
9. **Fallback:** No match → return `unknown`, defer to manual classification

## CSV Schema

| Column | Values | Purpose |
|--------|--------|---------|
| domain | snake_case identifier | Domain name |
| signals | comma-separated keywords | Match against task description |
| level | low, medium, high | Complexity classification |
| workflow | one-shot, standard, enhanced, advanced | Workflow intensity |
| web_searches | comma-separated topics | Suggested research queries |

## Routing Logic

| Level | Model Tier | Gate 1 | Workflow |
|-------|-----------|--------|---------|
| low | TRIVIAL (Haiku) | Bypass eligible (one-shot) | Minimal |
| medium | STANDARD (Sonnet) | Required | Standard phases |
| high | COMPLEX (Opus) | Required | Full phases + security |

## Usage

Called automatically by orchestrator at Phase 0. Not invoked directly by users.

```
Orchestrator Phase 0:
  1. Run meow:scale-routing on task description
  2. If match found → use returned level/workflow/model_tier
  3. If no match → fall back to manual classification per model-selection-rules.md
```

## Extending

Users can add custom domains by editing `data/domain-complexity.csv`. Add a new row with domain keywords relevant to your project.

## Gotchas

- **Runtime dependency on `meow:harness/scripts/density-select.sh`** — if the harness skill is removed or renamed, density selection breaks. The script is shared intentionally (single source of truth for density policy); treat it as load-bearing infrastructure, not a private harness internal.
- Multiple domains can match a single task (e.g., "fintech dashboard" matches both fintech and internal_tools) — use the HIGHEST complexity match
- CSV keyword matching is case-insensitive but signal order matters — first match wins for domain name
- Adding too many low-signal keywords (e.g., "data", "app") creates false positives — keep signals specific to the domain
- One-shot workflow bypass requires BOTH CSV match AND orchestrator zero-blast-radius confirmation — CSV alone is not sufficient

## Output Schema (v2.0)

Base fields (v1.0):

| Field | Values | Description |
|---|---|---|
| `domain` | snake_case string | Matched domain or `unknown` |
| `level` | low, medium, high | Complexity classification |
| `workflow` | one-shot, standard, enhanced, advanced | Workflow intensity |
| `model_tier_override` | TRIVIAL, STANDARD, COMPLEX | Forced model tier |

New fields (v2.0):

| Field | Values | Description |
|---|---|---|
| `task_type` | bug_fix, feature, refactor, security, devops, docs, review, intake | Classified task type |
| `suggested_skill` | meow:fix, meow:cook, meow:cso, meow:review, meow:intake | Recommended skill for this task |
| `confidence` | HIGH, MEDIUM, LOW | Routing confidence from Layer 3 scoring |
| `product_area` | string | Area name from `.claude/product-areas.yaml` (omitted if no YAML) |

New fields (v2.1 — Phase 5 of harness plan, 260408):

| Field | Values | Description |
|---|---|---|
| `harness_density` | `MINIMAL`, `FULL`, `LEAN` | Recommended scaffolding density for `meow:harness` runs (see Adaptive Density Policy below) |

### Harness Density Selection (v2.1)

Used by `meow:harness` to choose how much scaffolding to apply per run. The decision rules:

| `level` (model_tier) | model id contains | `harness_density` |
|---|---|---|
| low (TRIVIAL/Haiku) | any | `MINIMAL` |
| medium (STANDARD/Sonnet) | any | `FULL` |
| high (COMPLEX/Opus) | `opus-4-6` or `opus-4.6` or `opus-4-7` | `LEAN` |
| high (COMPLEX/Opus) | other (e.g., `opus-4-5`, `claude-opus-4`) | `FULL` |

**Override:** `MEOWKIT_HARNESS_MODE=MINIMAL\|FULL\|LEAN` env var, when set, overrides the auto-detected value. The override is logged in the harness run report for audit.

For scriptable density selection, callers may invoke `.claude/skills/meow:harness/scripts/density-select.sh` which echoes only the density token to stdout.

## Data File

- `data/domain-complexity.csv` — Domain → complexity → workflow mapping

## Reference Files

- `references/multi-layer-detection.md` — 4-layer detection logic and confidence scoring
- `references/task-type-classification.md` — 8 task types, signals, and suggested skills
- `references/product-area-config.md` — Optional `.claude/product-areas.yaml` schema and loading rules

## Cross-Skill Dependencies

- `.claude/skills/meow:harness/scripts/density-select.sh` — Echoes `harness_density` token to stdout; used by harness when scriptable density selection is needed
