---
title: "mk:scale-routing"
description: "mk:scale-routing"
---

## What This Skill Does

`mk:scale-routing` is an internal sub-skill of Phase 0 (Orient) that replaces subjective orchestrator judgment with deterministic, auditable domain-based routing. It scans task descriptions against `data/domain-complexity.csv` and runs additional detection layers to classify task type, complexity level, workflow intensity, model tier, and suggested skill. A fintech auth change auto-classifies as COMPLEX without human intervention.

## When to Use

Called automatically by the orchestrator at Phase 0. Not user-invocable directly. Runs on every task classification to determine routing before any agent is assigned.

## Core Capabilities

### Domain Classification (11 Built-in Domains)

| Domain | Signals | Level | Workflow | Web Searches |
|--------|---------|-------|----------|-------------|
| e_commerce | shopping, cart, checkout, payment, products, store | medium | standard | ecommerce architecture, payment processing |
| fintech | banking, payment, trading, finance, money, investment | high | enhanced | PCI compliance, fraud detection |
| healthcare | medical, diagnostic, clinical, patient, hospital | high | enhanced | HIPAA compliance, medical data security |
| social | social network, community, users, friends, posts | high | advanced | social graph, feed ranking, privacy |
| education | learning, course, student, teacher, training | medium | standard | LMS architecture, progress tracking |
| iot | IoT, sensors, devices, embedded, smart, connected | high | advanced | device communication, edge computing |
| gaming | game, gaming, multiplayer, real-time, matchmaking | high | advanced | multiplayer architecture, game engine |
| government | government, civic, public, admin, regulation | high | enhanced | accessibility, security clearance, audit trails |
| internal_tools | admin, dashboard, internal, backoffice, cms | low | standard | admin panel patterns, RBAC, data tables |
| docs | documentation, readme, changelog, wiki, guide | low | one-shot | documentation generators, static site builders |
| cli | command_line, cli, terminal, shell, script | medium | standard | CLI frameworks, argument parsing |

Extend by adding rows to `data/domain-complexity.csv`. Keep signals specific — low-signal keywords (e.g., "data", "app") create false positives.

### 4-Layer Detection System

| Layer | What It Does | Weight |
|-------|-------------|--------|
| 0 — CSV Keyword Match | Match task keywords against domain-complexity.csv (case-insensitive, first match wins for domain name) | +40 |
| 1 — Task Content Analysis | Classify task type from action keywords (bug, feature, refactor, security, devops, docs, review, intake). Extract mentioned files and modules. | +30 |
| 2 — Project Context Analysis | Check project files (package.json, go.mod, etc.), directory structure (src/auth/, src/billing/), and recent git changes (HEAD~5) | +20 +10 |
| 3 — Confidence Scoring | Synthesize all evidence into final score. HIGH >=70, MEDIUM 40-69, LOW <40 | — |

**Anti-pattern rule:** NEVER classify a task based on repository type alone. Task content (Layer 1) takes precedence over project structure (Layer 2). "Fix the login button styles" in a backend-heavy repo routes to frontend patterns.

### Task Type Classification (8 Types)

| Task Type | Signal Keywords | Suggested Skill | Priority |
|-----------|----------------|-----------------|----------|
| security | vulnerability, CVE, audit, penetration, secrets | mk:cso | 1 (always wins) |
| bug_fix | bug, error, broken, fails, regression | mk:fix or mk:investigate | 2 |
| intake | PRD, ticket, issue, analyze ticket, triage | mk:intake | 3 |
| feature | add, implement, build, create, new | mk:cook | 4 |
| refactor | refactor, clean up, extract, simplify, rename | mk:cook --fast | 4 |
| devops | deploy, CI/CD, pipeline, docker, kubernetes | mk:cook | 4 |
| docs | docs, README, changelog, API docs | mk:docs-init or mk:document-release | 4 |
| review | review, PR, pull request, check | mk:review | 4 |

Security always wins and forces COMPLEX tier — no downgrade possible. `suggested_skill` is a recommendation the orchestrator may override.

### Routing Logic

| Level | Model Tier | Gate 1 | Workflow |
|-------|-----------|--------|----------|
| low | TRIVIAL (Haiku) | Bypass eligible (one-shot) | Minimal |
| medium | STANDARD (Sonnet) | Required | Standard phases |
| high | COMPLEX (Opus) | Required | Full phases + security |

One-shot bypass requires BOTH CSV match AND orchestrator zero-blast-radius confirmation.

### Product Area Configuration (Optional)

Add `.claude/product-areas.yaml` to your project root for team-specific routing:

```yaml
areas:
  - name: Authentication
    paths:
      - "src/auth/**"
      - "src/middleware/auth*"
    keywords:
      - "login"
      - "session"
      - "token"
      - "OAuth"
    pic:                    # optional
      - "alice"
      - "bob"
```

When the YAML exists, output includes `product_area` and `pic` fields. When absent, CSV-only mode — no degradation.

### Harness Density (v2.1)

| Level (Model) | Model ID contains | Density |
|---------------|-------------------|---------|
| low (TRIVIAL/Haiku) | any | MINIMAL |
| medium (STANDARD/Sonnet) | any | FULL |
| high (COMPLEX/Opus) | opus-4-6, opus-4.6, opus-4-7 | LEAN |
| high (COMPLEX/Opus) | other (opus-4-5, claude-opus-4) | FULL |

Override: `MEOWKIT_HARNESS_MODE=MINIMAL|FULL|LEAN` env var.

### Output Schema

Full output includes:

| Field | Values | Version |
|-------|--------|---------|
| domain | snake_case string or "unknown" | v1.0 |
| level | low, medium, high | v1.0 |
| workflow | one-shot, standard, enhanced, advanced | v1.0 |
| model_tier_override | TRIVIAL, STANDARD, COMPLEX | v1.0 |
| task_type | bug_fix, feature, refactor, security, devops, docs, review, intake | v2.0 |
| suggested_skill | mk:fix, mk:cook, mk:cso, mk:review, mk:intake, etc. | v2.0 |
| confidence | HIGH, MEDIUM, LOW | v2.0 |
| product_area | string (omitted if no YAML) | v2.0 |
| pic | string[] (omitted if no YAML or no PIC) | v2.0 |
| harness_density | MINIMAL, FULL, LEAN | v2.1 |

## Workflow

1. **Layer 0** — Match keywords from `data/domain-complexity.csv` against task description. Case-insensitive, first domain match wins. Multiple matches use HIGHEST complexity.
2. **Layer 1** — Analyze task content. Classify task type. Extract mentioned files/modules.
3. **Layer 2** — Check project context: files present, directory structure, recent git changes (HEAD~5).
4. **Layer 3** — Score confidence per domain using weighted evidence. HIGH >=70, MEDIUM 40-69, LOW <40.
5. **Classify task type** — Map signals to one of 8 task types. Security always wins.
6. **Optional** — Check `.claude/product-areas.yaml`. If exists, merge area keywords and paths.
7. **Output** — Structured result with all fields. Fallback: no match returns `unknown`, defer to manual classification.

## Example Prompt

```
Task: "Add OAuth2 support to the login page"

Layer 0: "OAuth" → fintech domain match
Layer 1: "add" → feature task type, "login" → auth module
Layer 2: package.json present, src/auth/ directory exists
Layer 3: CSV match +40, task content +30, project files +20 = 90 → HIGH confidence

Output:
{
  "domain": "fintech",
  "level": "high",
  "workflow": "enhanced",
  "model_tier_override": "COMPLEX",
  "task_type": "feature",
  "suggested_skill": "mk:cook",
  "confidence": "HIGH",
  "harness_density": "FULL"
}
```

## Common Use Cases

- **Every Phase 0 task classification** — invoked automatically by orchestrator
- **Domain-specific routing** — fintech, healthcare, gaming tasks get appropriate complexity and model tier
- **Team-specific customization** — add `.claude/product-areas.yaml` for path-based routing with PIC suggestions
- **Harness integration** — harness_density field feeds `mk:harness` for scaffolding decisions

## Pro Tips

- Multiple domains can match a single task — the HIGHEST complexity match wins.
- One-shot workflow bypass requires BOTH CSV match AND orchestrator zero-blast-radius confirmation. CSV alone is not sufficient.
- Adding too many low-signal keywords ("data", "app") creates false positives. Keep signals specific to the domain.
- The harness density script at `.claude/skills/harness/scripts/density-select.sh` is load-bearing infrastructure — do not remove or rename it.