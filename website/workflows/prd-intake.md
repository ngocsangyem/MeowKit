---
title: PRD Intake Automation
description: Analyze incoming PRDs/tickets with MeowKit as the AI engine, powered by the mk:jira leaf family.
persona: B
---

# PRD Intake Automation

> Automated ticket analysis: product area classification, completeness scoring, root cause analysis, technical assessment, and structured recommendations — powered by MeowKit skills with the `mk:jira-*` leaf family.

**Best for:** Team leads, engineering managers, DevOps teams
**Time estimate:** ~2 min per ticket (automated)
**Skills used:** [mk:intake](/reference/skills/intake), [mk:jira-issue](/reference/skills/jira-issue), [mk:jira-evaluator](/reference/skills/jira-evaluator), [mk:jira-lifecycle](/reference/skills/jira-lifecycle), [mk:jira-relationships](/reference/skills/jira-relationships), [mk:jira-collaborate](/reference/skills/jira-collaborate), [mk:scale-routing](/reference/skills/scale-routing), [mk:scout](/reference/skills/scout), [mk:investigate](/reference/skills/investigate), [mk:decision-framework](/reference/skills/decision-framework)

## Overview

When a new PRD or ticket lands in Jira, MeowKit can analyze it automatically: classify the product area, score description completeness, run root cause analysis (for bugs), scan the codebase for technical context, and post structured results back as a Jira comment.

MeowKit talks to Jira through the `mk:jira-*` leaf family, which uses the `jira-as` CLI under the hood. `mk:intake` orchestrates the analysis pipeline; the leaves handle Jira I/O.

## Prerequisites

<!--@include: ./_jira-setup.md-->

### Define Product Areas

Create a YAML file mapping product areas to code paths and team ownership:

```yaml
# .claude/product-areas.yaml
areas:
  - name: Authentication
    paths: ["src/auth/**", "src/middleware/auth*"]
    keywords: ["login", "session", "token", "OAuth", "JWT"]
    pic: ["alice", "bob"]

  - name: Payments
    paths: ["src/billing/**", "src/stripe/**"]
    keywords: ["payment", "invoice", "subscription", "charge"]
    pic: ["charlie"]

  - name: API
    paths: ["src/api/**", "src/routes/**"]
    keywords: ["endpoint", "REST", "GraphQL", "route"]
    pic: ["alice", "dave"]
```

This feeds into `mk:scale-routing` for automatic product area detection.

### Configure Trigger

Two options:

**Option A: Jira Automation (webhook → Claude)**

```
Jira Automation Rule:
  When: Issue created, type = PRD
  Then: Send webhook to your service
  Your service: calls `claude -p` with ticket content
```

**Option B: Manual / On-demand**

```
/mk:cook analyze PRD-123 using the intake workflow
```

## Step-by-step Guide

::: tip Simplified with mk:intake (v2.0)
MeowKit v2.0 introduced `mk:intake` which orchestrates the entire intake workflow automatically. Instead of chaining skills manually, just run:
```bash
/mk:intake
```
The steps below describe what mk:intake does internally.
:::

### Step 1: Fetch the ticket

MeowKit reads the ticket via `mk:jira-issue`:

```bash
/mk:jira-issue get PRD-123
```

The leaf reads the description, acceptance criteria, comments, attachments, and linked issues via the `jira-as` wrapper. See [`mk:jira-issue`](/reference/skills/jira-issue) for the full read surface.

### Step 1.5: Evaluate ticket complexity

Optionally, assess ticket complexity before proceeding with full intake:

```bash
/mk:jira-evaluator PRD-123
```

This produces a qualitative complexity assessment (Simple/Medium/Complex), detects missing acceptance criteria, vague language, and unlinked dependencies. The evaluation feeds into estimation and sprint planning. See [Ticket Evaluation & Estimation](/workflows/ticket-evaluation) for details.

::: tip Evaluator vs completeness scoring
`mk:jira-evaluator` assesses **implementation complexity** for estimation. `mk:plan-creator` scope challenge assesses **structural completeness** of the ticket description. They answer different questions — use both.
:::

### Step 2: Classify product area (mk:scale-routing)

MeowKit scans the ticket description for domain keywords and matches against `.claude/product-areas.yaml`:

```
Product area: Authentication
Confidence: HIGH (keywords: "login", "session timeout", matched paths: src/auth/**)
Suggested PIC: alice, bob
```

If multiple areas match, MeowKit reports all with confidence scores.

### Step 3: Evaluate completeness (mk:plan-creator scope challenge)

MeowKit checks the PRD against required sections:

| Section                  | Status     | Notes                                        |
| ------------------------ | ---------- | -------------------------------------------- |
| Goal / Problem statement | ✅ Present | Clear: "Users get logged out after 24 hours" |
| Acceptance criteria      | ❌ Missing | No pass/fail criteria defined                |
| Scope (in/out)           | ⚠️ Partial | "In scope" listed, "out of scope" missing    |
| Steps to reproduce       | ❌ Missing | Bug ticket with no repro steps               |
| Technical constraints    | ✅ Present | "Must not break existing SSO flow"           |

**Completeness score: 55/100**

### Step 4: Scan codebase (mk:scout)

MeowKit pulls latest code and scans for relevant files:

```
Related files:
  src/auth/session-manager.ts (session timeout logic)
  src/middleware/auth-guard.ts (token validation)
  src/config/auth.ts (timeout configuration: 24h)
  tests/auth/session.test.ts (existing test coverage)

Technical considerations:
  - Session timeout is hardcoded to 86400s in auth.ts:15
  - Token refresh logic exists but only triggers on page navigation
  - No background refresh mechanism for idle sessions
```

### Step 5: Root cause analysis (mk:investigate)

For bug tickets, MeowKit runs structured RCA:

```
RCA Method: 5 Whys (single-event, simple causal chain)

Why 1: Users get logged out → session token expires
Why 2: Token expires → 24h timeout reached
Why 3: Timeout reached → no refresh during idle period
Why 4: No idle refresh → refresh only triggers on navigation
Why 5: Navigation-only refresh → design gap (no background keep-alive)

Root cause: Token refresh is tied to user navigation events.
           Idle users (reading, in meetings) get no refresh.

Suggested fix: Add background token refresh interval (e.g., every 20min)
                OR extend timeout to 7 days with sliding expiration.
```

### Step 6: Generate structured output

MeowKit posts a structured comment back to Jira via `mk:jira-collaborate`:

```markdown
## AI PRD Analysis — PRD-123

### Product Area

**Authentication** (confidence: HIGH)

### Completeness Score: 55/100

Missing:

- ❌ Acceptance criteria (add pass/fail conditions)
- ❌ Steps to reproduce (add exact repro steps)
- ⚠️ Out-of-scope section (clarify boundaries)

### Technical Considerations

- Session timeout hardcoded at 24h (`src/config/auth.ts:15`)
- Token refresh only triggers on navigation (no idle refresh)
- Existing test coverage: `tests/auth/session.test.ts` (12 tests)

### Root Cause (for bugs)

Token refresh tied to navigation events. Idle users receive no refresh.

### Suggested Breakdown

1. Add background refresh interval (src/auth/session-manager.ts)
2. Update session config to support sliding expiration (src/config/auth.ts)
3. Add integration test for idle session scenario

### Related Tickets

- PRD-098: "Session management improvements" (similar scope)
- BUG-045: "Intermittent logout" (possibly same root cause)

### Suggested PIC

**alice** (Authentication domain owner, 3 open tickets)
**bob** (Authentication domain, 5 open tickets — alice preferred for load balance)
```

### Step 7: Auto-assign and transition

If configured, MeowKit can:

- Assign the ticket to the suggested PIC via `mk:jira-lifecycle`
- Transition status (e.g., "New" → "In Analysis") via `mk:jira-lifecycle`
- Link related tickets via `mk:jira-relationships`

::: tip Execute the suggested actions
After reviewing intake analysis, run the suggested Jira actions directly:
```bash
/mk:jira-lifecycle transition PRD-123 "In Analysis"
/mk:jira-relationships link PRD-123 blocks BUG-045
/mk:jira-lifecycle assign PRD-123 alice
```
:::

## Skill Graph

```
mk:intake (orchestrator)
  ├─ mk:jira-issue          → fetch ticket
  ├─ mk:scale-routing       → product-area classification
  ├─ mk:plan-creator        → completeness scoring (scope challenge)
  ├─ mk:scout               → codebase context
  ├─ mk:investigate         → RCA (bug tickets)
  ├─ mk:decision-framework  → triage rules
  ├─ mk:jira-collaborate    → post analysis comment
  ├─ mk:jira-lifecycle      → transition + assign (Step 7)
  └─ mk:jira-relationships  → link related tickets (Step 7)
```

## MeowKit Skills Used

| Step                      | Skill                                                           | What It Does                                                        |
| ------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------- |
| Ticket I/O                | [mk:jira-issue](/reference/skills/jira-issue)                 | Read issue + attachments + linked tickets via jira-as               |
| Complexity assessment     | [mk:jira-evaluator](/reference/skills/jira-evaluator)         | Read-only complexity + inconsistency analysis                       |
| Product area detection    | [mk:scale-routing](/reference/skills/scale-routing)           | Matches keywords against domain-complexity CSV / product-areas YAML |
| Completeness evaluation   | [mk:plan-creator](/reference/skills/plan-creator)             | Scope challenge validates goal, criteria, constraints, scope        |
| Codebase scanning         | [mk:scout](/reference/skills/scout)                           | Parallel file discovery + architecture fingerprint                  |
| Root cause analysis       | [mk:investigate](/reference/skills/investigate)               | 4-phase investigation with RCA method selection                     |
| Structured recommendation | [mk:decision-framework](/reference/skills/decision-framework) | Classify → rules → score → escalate                                 |
| Comment posting           | [mk:jira-collaborate](/reference/skills/jira-collaborate)     | Post AI analysis as a Jira comment                                  |
| Lifecycle (Step 7)        | [mk:jira-lifecycle](/reference/skills/jira-lifecycle)         | Transition + assign                                                 |
| Linking (Step 7)          | [mk:jira-relationships](/reference/skills/jira-relationships) | Link blockers / related issues                                      |

## What MeowKit Does NOT Do

Be honest about boundaries:

- **Team roster management** — You maintain `.claude/product-areas.yaml`. MeowKit reads it.
- **Workload balancing** — MeowKit reports open ticket count per PIC (via `mk:jira-search`). Your rules decide assignment.
- **Jira workflow rules** — MeowKit suggests transitions. Your Jira automation enforces them.
- **Duplicate detection** — MeowKit finds related tickets via keyword search. Exact dedup is your JQL.

## Gotchas

- **No `MEOW_JIRA_*` env = no Jira I/O**: The analysis skills work standalone (you can paste ticket text), but automated read/write requires the three env vars in `.claude/.env`.
- **Product areas YAML must be maintained**: Stale domain mappings = wrong classification. Update when team structure changes.
- **RCA only for bugs**: Feature PRDs get completeness scoring + breakdown, not root cause analysis.
- **PIC suggestion ≠ assignment**: MeowKit suggests based on domain + load. Human confirms. Never auto-assign without review unless your team explicitly opts in.
- **Rate limits**: If running on every Jira webhook, consider batching or filtering (e.g., only PRD type, only specific projects).

## Related

- [Adding a Feature](/workflows/add-feature) — Full implementation workflow after intake
- [Fixing a Bug](/workflows/fix-bug) — Bug-specific investigation workflow
- [Code Review](/workflows/code-review) — Review workflow for the fix
- [mk:decision-framework](/reference/skills/decision-framework) — Decision architecture for triage
