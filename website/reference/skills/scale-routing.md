---
title: "mk:scale-routing"
description: "Domain-aware complexity routing. Matches task keywords against domain-complexity.csv for deterministic model tier and workflow selection."
---

# mk:scale-routing

Internal sub-skill of Phase 0 (Orient). Scans task descriptions for domain keywords, matches against `data/domain-complexity.csv`, returns complexity level, workflow intensity, model tier override, and (v2.0+) task type with suggested skill. Not user-invocable directly.

## Core purpose

Replace subjective orchestrator judgment with deterministic, auditable domain-based routing. A fintech auth change auto-classifies as COMPLEX without human intervention.

## Process

1. Match keywords from `data/domain-complexity.csv` against task description
2. Analyze task content — classify type, extract mentioned files/modules
3. Check project context — files present, directory structure, recent git changes
4. Score confidence per domain (HIGH ≥70, MEDIUM 40–69, LOW <40)
5. Classify task type — bug_fix, feature, refactor, security, devops, docs, review, intake
6. Optional: check `.claude/product-areas.yaml` — merge area keywords and paths
7. Output structured result; fallback to `unknown` → defer to manual classification

## CSV schema

| Column | Values | Purpose |
|--------|--------|---------|
| domain | snake_case | Domain name |
| signals | comma-separated keywords | Match against task (case-insensitive, first match wins) |
| level | low, medium, high | Complexity classification |
| workflow | one-shot, standard, enhanced, advanced | Workflow intensity |
| web_searches | comma-separated topics | Suggested research queries |

## Routing logic

| Level | Model | Gate 1 | Workflow |
|-------|-------|--------|----------|
| low | TRIVIAL (Haiku) | Bypass eligible (one-shot) | Minimal |
| medium | STANDARD (Sonnet) | Required | Standard phases |
| high | COMPLEX (Opus) | Required | Full phases + security |

One-shot bypass requires BOTH CSV match AND orchestrator zero-blast-radius confirmation.

## Harness density (v2.1)

| Level (Model) | Model ID contains | Density |
|---|---|---|
| low (TRIVIAL/Haiku) | any | MINIMAL |
| medium (STANDARD/Sonnet) | any | FULL |
| high (COMPLEX/Opus) | opus-4-6, opus-4.6, opus-4-7 | LEAN |
| high (COMPLEX/Opus) | other | FULL |

Override: `MEOWKIT_HARNESS_MODE` env var.

## Extending

Add rows to `data/domain-complexity.csv` with project-specific domains. Keep signals specific — low-signal keywords (e.g., "data", "app") create false positives.

## Gotchas

- Multiple domains match → use HIGHEST complexity
- Runtime dependency on `.claude/skills/harness/scripts/density-select.sh` — load-bearing infrastructure
- One-shot bypass requires BOTH CSV match AND zero-blast-radius confirmation
