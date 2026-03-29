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
source: meowkit
---

# Scale-Adaptive Routing

Automatically classifies task complexity based on domain keywords.

## Purpose

Replace subjective orchestrator judgment with deterministic, auditable domain-based routing. A fintech auth change should auto-classify as COMPLEX without human intervention.

## How It Works

1. **Input:** User task description (string)
2. **Scan:** Match keywords from `data/domain-complexity.csv`
3. **Output:** `{domain, level, workflow, model_tier_override}`
4. **Fallback:** No match → return `unknown`, defer to manual classification

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

- Multiple domains can match a single task (e.g., "fintech dashboard" matches both fintech and internal_tools) — use the HIGHEST complexity match
- CSV keyword matching is case-insensitive but signal order matters — first match wins for domain name
- Adding too many low-signal keywords (e.g., "data", "app") creates false positives — keep signals specific to the domain
- One-shot workflow bypass requires BOTH CSV match AND orchestrator zero-blast-radius confirmation — CSV alone is not sufficient

## Data File

- `data/domain-complexity.csv` — Domain → complexity → workflow mapping
