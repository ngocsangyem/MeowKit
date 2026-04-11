---
title: "meow:chom"
description: "Copy-cat, replicate, or adapt features from external systems, repos, apps, or ideas into the current project."
---

# meow:chom

Copy-cat, replicate, or adapt features from external systems, repos, apps, or ideas into the current project.

## What This Skill Does

`meow:chom` is a general-purpose analysis skill that examines an external source — a GitHub repo, a live website, an app screenshot, or even a freeform idea — and produces a structured Replication Spec telling you exactly what to build, how it fits your stack, and what risks to watch for. It challenges every assumption before committing to a plan.

Not limited to MeowKit. Works for any project: SaaS apps, mobile apps, CLI tools, design systems, or MeowKit skills themselves.

## Core Capabilities

- **Input routing** — auto-detects input type (git URL, web URL, local path, freeform text, screenshot) and routes to the right tool
- **6-phase workflow** — Recon → Map → Analyze → Challenge → Decision → Handoff
- **7 challenge questions** — Necessity, Stack Fit, Data Model, Dependency Cost, Effort vs Value, Blast Radius, Maintenance Burden
- **Hard gate** — human approval required between Challenge and Decision phases
- **Risk scoring** — 0-2 critical = proceed, 3-4 = resolve first, 5+ = reject
- **Two modes** — `--analyze` (full workflow) and `--compare` (analysis only, no decision)

## When to Use This

::: tip Use meow:chom when...
- You want to replicate a feature from another app ("build Stripe's checkout for us")
- You found a repo with a pattern worth copying ("port auth from this repo")
- You're deciding between approaches ("compare Supabase vs Firebase")
- You want to clone a UI design ("1:1 copy this landing page")
- You want to understand how a system works before building something similar
:::

## Usage

```bash
# Analyze a GitHub repo for replicable features
/meow:chom https://github.com/shouc/agentflow

# Replicate a specific feature from a website
/meow:chom https://linear.app "keyboard shortcuts"

# Compare two approaches
/meow:chom "Supabase vs Firebase for real-time features" --compare

# Analyze a local project
/meow:chom ../other-project "authentication flow"

# Analyze a screenshot
/meow:chom screenshot.png "replicate this UI"
```

## Input Routing

| Input | Detection | Tool Used |
|-------|-----------|-----------|
| Git URL (`github.com/*`, `gitlab.com/*`) | URL contains git host | `git clone --depth 1` → `meow:scout` |
| Web URL (`https://...`) | URL, not git host | `meow:web-to-markdown` or `meow:browse` |
| Local path (`./`, `../`, `/`) | Starts with `.` or `/` | Direct Read/Glob |
| Freeform text | No URL or path | `researcher` agent (WebSearch) |
| Image/screenshot | Image file extension | `meow:multimodal` (Gemini vision) |

## Quick Workflow

```
[1. Recon] → [2. Map] → [3. Analyze] → [4. Challenge] ══ GATE ══ [5. Decision] → [6. Handoff]
```

| Phase | What Happens |
|-------|-------------|
| 1. Recon | Fetch/clone source + read local project context |
| 2. Map | Build dependency matrix: source → local (EXISTS / NEW / CONFLICT) |
| 3. Analyze | Trace execution flow, data model, UX. Understand WHY, not just HOW |
| 4. Challenge | 7 questions + risk scoring + decision matrix. **Human approval required** |
| 5. Decision | Go/no-go based on challenge results |
| 6. Handoff | Replication Spec + next step for user |

::: warning Hard Gate
Phase 4 (Challenge) must complete and get human approval before Phase 5 (Decision).
No exceptions. No bypass mode.
:::

## Output: Replication Spec

```markdown
# Replication Spec: [Feature/System Name]
## 1. Source — name, URL, tech stack, what we're replicating
## 2. What to Build — specific features/patterns to replicate
## 3. Stack Fit — maps to our stack (exists / new / conflicts)
## 4. Risks & Effort — what's hard, estimated complexity
## 5. Recommendation — replicate / adapt / reject + next step
```

After receiving the spec, run:
```bash
/meow:plan-creator "Replicate [feature] from [source]"
```

::: info Skill Details
**Phase:** Pre-Phase-0 (standalone)
**Type:** research
**Modes:** `--analyze` (default), `--compare`
:::

## Gotchas

- **No local context = generic advice**: always reads `docs/project-context.md` first — without it, recommendations won't fit your stack
- **"Obvious" copies hide complexity**: auth flows, data models, API contracts often have hidden dependencies. Challenge phase is never skipped
- **Skills can't call skills**: chom delegates to agents via Task(). USER invokes `meow:plan-creator` or `meow:cook` based on chom's output
- **Spec is analysis, not code**: Replication Spec describes WHAT and WHY, never HOW. No code blocks in specs

## Related

- [`meow:scout`](/reference/skills/scout) — Used during Recon for local project architecture mapping
- [`meow:plan-creator`](/reference/skills/plan-creator) — Downstream: converts Replication Spec into implementation plan
- [`meow:brainstorming`](/reference/skills/brainstorming) — Used during Challenge if 2+ viable approaches
- [`meow:web-to-markdown`](/reference/skills/web-to-markdown) — Used for fetching web URLs during Recon
