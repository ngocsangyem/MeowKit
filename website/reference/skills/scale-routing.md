---
title: "meow:scale-routing"
description: "Domain-aware complexity routing at Phase 0. Scans task description for domain keywords, returns complexity level, workflow intensity, and model tier override."
---

# meow:scale-routing

Domain-aware complexity routing. Replaces subjective orchestrator judgment with deterministic, auditable domain-based routing at Phase 0.

## What This Skill Does

When a task arrives, meow:scale-routing scans its description against a domain keyword CSV, runs multi-layer detection, and returns a structured routing decision — complexity level, workflow intensity, model tier override, task type, and suggested skill. A fintech auth change auto-classifies as COMPLEX without manual judgment.

## Core Capabilities

- **CSV keyword matching** — `data/domain-complexity.csv` maps domain signals → complexity → workflow
- **Multi-layer detection (v2.0)** — 4 layers: CSV match → task content analysis → project context → confidence scoring
- **Task type classification** — 8 types with suggested skill per type
- **Product area config** — optional `.claude/product-areas.yaml` adds project-specific keywords and PIC suggestion
- **Confidence scoring** — HIGH ≥70, MEDIUM 40–69, LOW <40 per domain
- **Extensible** — teams add custom rows to `domain-complexity.csv` for project-specific domains

## When to Use

::: tip Automatic at Phase 0
meow:scale-routing is called by the orchestrator automatically at Phase 0 for every task. You do not invoke it directly.
:::

::: info Not user-invoked
This skill is infrastructure. The orchestrator runs it, reads the output, and routes accordingly. If no domain matches, it falls back to manual classification per `model-selection-rules.md`.
:::

## How It Works

**4-layer detection sequence:**

1. **Layer 0 — CSV match** — scan task description against `data/domain-complexity.csv` signals (case-insensitive)
2. **Layer 1 — Task content** — classify task type, extract mentioned files and modules
3. **Layer 2 — Project context** — check files present, directory structure, recent git changes
4. **Layer 3 — Confidence scoring** — score per domain; HIGH ≥70, MEDIUM 40–69, LOW <40
5. **Optional — Product area** — merge `.claude/product-areas.yaml` keywords and paths if file exists
6. **Output** — structured routing decision (see schema below)
7. **Fallback** — no match → return `unknown`, defer to manual classification

## Task Type Classification

8 task types derived from multi-layer signals:

| Task Type | Signals | Suggested Skill |
|-----------|---------|----------------|
| `bug_fix` | error, regression, broken, failing | `meow:fix` |
| `feature` | new, add, implement, build | `meow:cook` |
| `refactor` | cleanup, restructure, simplify, extract | `meow:cook` |
| `security` | auth, vulnerability, injection, CVE | `meow:cso` |
| `devops` | deploy, pipeline, docker, CI/CD | `meow:cook` |
| `docs` | documentation, readme, changelog | `meow:fix` |
| `review` | review, audit, check, inspect | `meow:review` |
| `intake` | ticket, PRD, brief, requirement | `meow:intake` |

## Product Area Config

`.claude/product-areas.yaml` is an optional project-specific config:

```yaml
areas:
  - name: payments
    keywords: [stripe, checkout, billing, invoice]
    paths: [src/payments/, src/billing/]
    pic: "@alice"
  - name: auth
    keywords: [login, oauth, session, token]
    paths: [src/auth/, src/middleware/]
    pic: "@bob"
```

When present, meow:scale-routing merges area keywords into domain matching and adds `product_area` and `pic` to the output.

## Output Schema

**Base fields (v1.0):**

| Field | Values | Description |
|-------|--------|-------------|
| `domain` | snake_case string | Matched domain or `unknown` |
| `level` | low, medium, high | Complexity classification |
| `workflow` | one-shot, standard, enhanced, advanced | Workflow intensity |
| `model_tier_override` | TRIVIAL, STANDARD, COMPLEX | Forced model tier |

**New fields (v2.0):**

| Field | Values | Description |
|-------|--------|-------------|
| `task_type` | bug_fix, feature, refactor, security, devops, docs, review, intake | Classified task type |
| `suggested_skill` | meow:fix, meow:cook, meow:cso, meow:review, meow:intake | Recommended skill |
| `confidence` | HIGH, MEDIUM, LOW | Routing confidence from Layer 3 |
| `product_area` | string | Area from `.claude/product-areas.yaml` (omitted if no YAML) |

## Gotchas

- **Multiple domain matches** — use the HIGHEST complexity match (e.g., "fintech dashboard" matches both `fintech` and `internal_tools` → use `fintech` high-complexity result)
- **Low-signal keywords** — avoid adding generic terms like "data" or "app" to CSV; they cause false positives
- **One-shot bypass** — requires BOTH CSV `workflow=one-shot` AND orchestrator zero-blast-radius confirmation; CSV alone is not sufficient to bypass Gate 1
- **Extending the CSV** — add rows to `data/domain-complexity.csv` for project-specific domains; changes are version-controlled

## Related

- [meow:intake](/reference/skills/intake) — ticket analysis that uses scale-routing for product area classification
- [meow:cook](/reference/skills/cook) — primary pipeline skill, receives routing output from orchestrator
- [meow:agent-detector](/reference/skills/agent-detector) — companion infrastructure skill for agent + model detection
- [meow:fix](/reference/skills/fix) — suggested skill for bug_fix task type
