---
title: "meow:chom"
description: "Copy-cat, replicate, or adapt features from external systems, repos, apps, or ideas into the current project. v2 adopts xia-style mode granularity and sharper boundary rules."
---

# meow:chom

Copy-cat, replicate, or adapt features from external systems, repos, apps, or ideas into the current project.

## What This Skill Does

`meow:chom` examines an external source — a GitHub repo, a live website, an app screenshot, or even a freeform idea — and produces a structured Replication Spec telling you exactly what to build, how it fits your stack, and what risks to watch for. It challenges every assumption before committing to a plan.

Works for any project: SaaS apps, mobile apps, CLI tools, design systems, or MeowKit skills themselves.

## Core Capabilities

- **Input routing** — auto-detects input type (git URL, web URL, local path, freeform text, screenshot) and routes to the right tool
- **6-phase workflow** — Recon → Map → Analyze → Challenge → Decision → Handoff
- **7 challenge questions** — Necessity, Stack Fit, Data Model, Dependency Cost, Effort vs Value, Blast Radius, Maintenance Burden
- **Hard gate** — human approval required between Challenge and Decision phases. Non-bypassable (no flag skips it, including `--lean` or `--auto`)
- **Risk scoring** — 0–2 critical = proceed, 3–4 = resolve first, 5+ = reject
- **4 user-explicit modes** — `--compare` / `--copy` / `--improve` / `--port` (no auto-derivation; user picks)
- **2 speed flags** — `--lean` / `--auto` (default off)

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
# Full 6-phase workflow, no mode declaration in handoff
/meow:chom https://github.com/shouc/agentflow

# User-explicit modes bias Phase 3 focus
/meow:chom https://linear.app "keyboard shortcuts" --improve
/meow:chom owner/repo "payment flow" --copy
/meow:chom owner/repo "state mgmt" --port

# Compare-only (phases 1–3, no decision)
/meow:chom "Supabase vs Firebase for real-time features" --compare

# Speed flags (HARD GATE still enforced)
/meow:chom owner/repo --lean       # skip Phase 1 researcher for freeform inputs
/meow:chom owner/repo --auto       # auto-approve non-gate steps

# Analyze a screenshot
/meow:chom screenshot.png "replicate this UI"
```

## Modes

All modes are user-explicit. chom does NOT auto-derive adaptation depth.

| Mode        | Intent                                | Phase 3 focus                            |
| ----------- | ------------------------------------- | ---------------------------------------- |
| `--compare` | Analysis only, no decision            | Architectural differences and trade-offs |
| `--copy`    | Transplant with minimal changes       | Compatibility gaps                       |
| `--improve` | Adapt anti-patterns during port       | Anti-pattern detection                   |
| `--port`    | Rewrite idiomatically for local stack | Idiom translation                        |
| no flag     | Full workflow, no mode declaration    | Architectural differences                |

## Intent Detection

If the user provides natural-language mode hints, chom maps them:

| User says                                           | Suggested flag |
| --------------------------------------------------- | -------------- |
| "compare", "vs", "how does X do Y"                  | `--compare`    |
| "copy", "1:1", "exact", "as-is"                     | `--copy`       |
| "adapt", "improve", "like how X does it"            | `--improve`    |
| "port", "rewrite", "convert", "steal", "bring from" | `--port`       |

## Input Routing

| Input                                    | Detection              | Tool Used                               |
| ---------------------------------------- | ---------------------- | --------------------------------------- |
| Git URL (`github.com/*`, `gitlab.com/*`) | URL contains git host  | `git clone --depth 1` → `meow:scout`    |
| Web URL (`https://...`)                  | URL, not git host      | `meow:web-to-markdown` or `meow:browse` |
| Local path (`./`, `../`, `/`)            | Starts with `.` or `/` | Direct Read/Glob                        |
| Freeform text                            | No URL or path         | `researcher` agent (WebSearch)          |
| Image/screenshot                         | Image file extension   | `meow:multimodal` (Gemini vision)       |

## Workflow

```
[1. Recon] → [2. Map] → [3. Analyze] → [4. Challenge] ══ HARD GATE ══ [5. Decision] → [6. Handoff]
```

| Phase        | What Happens                                                                                                                                                                   |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1. Recon     | Fetch/clone source + read local `docs/project-context.md`. `--lean` skips researcher-agent for freeform inputs only.                                                           |
| 2. Map       | Build dependency matrix: source → local (EXISTS / NEW / CONFLICT)                                                                                                              |
| 3. Analyze   | Trace execution flow, data model, UX. Mode-specific focus applied here. For 3+ layers or stateful workflows → emit handoff text directing user to `/meow:sequential-thinking`. |
| 4. Challenge | 7 questions + risk scoring + decision matrix. **Human approval required.**                                                                                                     |
| 5. Decision  | Go/no-go based on challenge results                                                                                                                                            |
| 6. Handoff   | Replication Spec + challenge summary + next step for user                                                                                                                      |

::: warning Hard Gate
Phase 4 (Challenge) must complete and get human approval before Phase 5 (Decision).
Non-bypassable — no flag, including `--lean` or `--auto`, skips this step.
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

Handoff text enriches the spec with challenge-reds summary + risk score. Example:

```
Replication Spec ready.

Challenge summary: 2 stack-fit reds, 1 data-model red, 0 blast-radius reds.
Risk level: medium.

To implement, run:
  /meow:plan-creator "Replicate [feature] from [source]"

To bias future chom analysis toward a specific adaptation depth, re-invoke with:
  /meow:chom [source] --copy | --improve | --port
```

::: info Skill Details
**Phase:** Pre-Phase-0 (standalone)
**Type:** research
**Modes:** 4 user-explicit + no-flag default
**Speed:** `--lean`, `--auto` (default off)
:::

## Boundary Rules

chom emits handoff text. It does NOT invoke any other MeowKit skill mid-flow — including `/meow:plan-creator`, `/meow:brainstorming`, `/meow:cook`, or `/meow:sequential-thinking`.

This is chom's design choice, not a MeowKit platform rule. Skills _can_ reference other skills and the model may invoke them; chom opts out because mid-flow invocations of other orchestration skills would break phase ownership — each has its own multi-phase workflow that would interleave with chom's HARD GATE discipline.

chom's job ends at Phase 6 Handoff; the user invokes the next skill.

## Gotchas

- **chom never declares adaptation depth.** Pick `--copy` / `--improve` / `--port` explicitly to bias the analysis.
- **3+ architectural layers trigger a sequential-thinking handoff**, not auto-invocation. Trace the flow via `/meow:sequential-thinking`, then return to chom.
- **HARD GATE applies in all modes**, including `--lean` and `--auto`.
- **No local context = generic advice** — always reads `docs/project-context.md` first.
- **"Obvious" copies hide complexity** — auth flows, data models, API contracts. Challenge phase is never skipped.
- **API-surface queries use [`/meow:pack --compress`](/reference/skills/pack)**, not chom. pack's Tree-sitter signature extraction is the right tool when the question is "what's the public API of library X" rather than "should we replicate it."
- **Spec ≠ code** — Replication Spec describes WHAT and WHY, never HOW.

## Migration (v1 → v2)

| v1                                               | v2                                                                   |
| ------------------------------------------------ | -------------------------------------------------------------------- |
| `--analyze` (default)                            | No-flag default (or explicit `--analyze` — deprecated, removed v1.2) |
| 2 modes                                          | 4 user-explicit modes + no-flag default                              |
| No speed flags                                   | `--lean`, `--auto`                                                   |
| Implicit phase ownership                         | Explicit Boundary Rules section                                      |
| "Skills cannot call skills (MeowKit convention)" | Honest "chom's design choice" framing                                |

## Related

- [`meow:pack`](/reference/skills/pack) — for API-surface queries (`--compress`) or exporting source for external review
- [`meow:scout`](/reference/skills/scout) — used during Recon for local project architecture mapping
- [`meow:plan-creator`](/reference/skills/plan-creator) — downstream: converts Replication Spec into implementation plan
- [`meow:sequential-thinking`](/reference/skills/sequential-thinking) — invoked via handoff for 3+ layer complexity
- [`meow:web-to-markdown`](/reference/skills/web-to-markdown) — used for fetching web URLs during Recon
- [What's New in v2.3.12](/guide/whats-new/v2.3.12)
