---
title: PRD Intake Automation
description: Analyze incoming PRDs/tickets with MeowKit as the AI engine, powered by Jira MCP integration.
persona: B
---

# PRD Intake Automation

> Automated ticket analysis: product area classification, completeness scoring, root cause analysis, technical assessment, and structured recommendations — powered by MeowKit skills with Jira MCP.

**Best for:** Team leads, engineering managers, DevOps teams  
**Time estimate:** ~2 min per ticket (automated)  
**Skills used:** [mk:scale-routing](/reference/skills/scale-routing), [mk:scout](/reference/skills/scout), [mk:investigate](/reference/skills/investigate), [mk:decision-framework](/reference/skills/decision-framework), [mk:plan-creator](/reference/skills/plan-creator)

## Overview

When a new PRD or ticket lands in Jira, MeowKit can analyze it automatically: classify the product area, score description completeness, run root cause analysis (for bugs), scan the codebase for technical context, and post structured results back as a Jira comment.

MeowKit provides the **analysis engine**. Jira connectivity requires a **Jira MCP server** — MeowKit talks to Jira through MCP tools, the same way it talks to browsers through Playwright MCP.

## Prerequisites

### 1. Install a Jira MCP Server

MeowKit needs a Jira MCP server to read and write tickets. We recommend [mcp-atlassian](https://github.com/sooperset/mcp-atlassian) (community, 49 tools, Cloud + Server/DC):

```bash
claude mcp add -e JIRA_URL=https://your-company.atlassian.net \
  -e JIRA_USERNAME=your-email@company.com \
  -e JIRA_API_TOKEN=your-api-token \
  atlassian -- uvx mcp-atlassian
```

Get your API token at [id.atlassian.com](https://id.atlassian.com/manage-profile/security/api-tokens).

Alternatively, use the [official Atlassian Rovo server](https://github.com/atlassian/atlassian-mcp-server) (Cloud-only, OAuth, 13 tools, beta):
```bash
claude mcp add --transport http atlassian https://mcp.atlassian.com/v1/mcp
```

See [mk:jira prerequisites](/reference/skills/jira#prerequisites) for a detailed comparison of both servers.

::: warning MCP Server Required
Without a Jira MCP server, MeowKit cannot read or write Jira tickets. The analysis skills work standalone (paste ticket text manually), but automated I/O requires the MCP.
:::

::: tip Alternative: GitHub Issues
If you use GitHub Issues instead of Jira, MeowKit can use the `gh` CLI directly — no MCP needed. The analysis workflow is identical; only the I/O layer changes.
:::

### 2. Define Product Areas

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

### 3. Configure Trigger

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

MeowKit reads the ticket via Jira MCP:

```
Analyze Jira ticket PRD-123.
Read the ticket description, acceptance criteria, and linked tickets.
```

The [Atlassian MCP server](https://github.com/atlassian/atlassian-mcp-server) provides tools for reading issues, searching, adding comments, and transitioning status. Check the server's README for the exact tool names and parameters.

### Step 1.5: Evaluate ticket complexity (mk:jira evaluate)

Optionally, assess ticket complexity before proceeding with full intake:

```bash
/mk:jira evaluate PRD-123
```

This produces a qualitative complexity assessment (Simple/Medium/Complex), detects missing acceptance criteria, vague language, and unlinked dependencies. The evaluation feeds into estimation and sprint planning. See the [Ticket Evaluation & Estimation](/workflows/ticket-evaluation) workflow for details.

::: tip Evaluate vs completeness scoring
`mk:jira evaluate` assesses **implementation complexity** for estimation. `mk:plan-creator` scope challenge assesses **structural completeness** of the ticket description. They answer different questions — use both.
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

MeowKit posts a structured comment back to Jira (via MCP):

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

- Assign the ticket to the suggested PIC (via Atlassian MCP)
- Transition status (e.g., "New" → "In Analysis" via Atlassian MCP)
- Link related tickets (via Atlassian MCP search + link tools)

::: tip Execute with mk:jira
After reviewing intake analysis, run the suggested Jira actions directly:
```bash
/mk:jira transition PRD-123 "In Analysis"
/mk:jira link PRD-123 blocks BUG-045
/mk:jira assign PRD-123 alice
```
See [mk:jira](/reference/skills/jira) for the full operation reference.
:::

## MeowKit Skills Used

| Step                      | Skill                                                           | What It Does                                                        |
| ------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------- |
| Product area detection    | [mk:scale-routing](/reference/skills/scale-routing)           | Matches keywords against domain-complexity CSV / product-areas YAML |
| Completeness evaluation   | [mk:plan-creator](/reference/skills/plan-creator)             | Scope challenge validates goal, criteria, constraints, scope        |
| Codebase scanning         | [mk:scout](/reference/skills/scout)                           | Parallel file discovery + architecture fingerprint                  |
| Root cause analysis       | [mk:investigate](/reference/skills/investigate)               | 4-phase investigation with RCA method selection (v2.0)              |
| Structured recommendation | [mk:decision-framework](/reference/skills/decision-framework) | Classify → rules → score → escalate (v2.0)                          |
| Technical assessment      | [mk:verify](/reference/skills/verify)                         | Build/test status of affected code (v2.0)                           |

## What MeowKit Does NOT Do

Be honest about boundaries:

- **Team roster management** — You maintain `.claude/product-areas.yaml`. MeowKit reads it.
- **Workload balancing** — MeowKit reports open ticket count per PIC (via Jira MCP search). Your rules decide assignment.
- **Jira workflow rules** — MeowKit suggests transitions. Your Jira automation enforces them.
- **Duplicate detection** — MeowKit finds related tickets via keyword search (Jira MCP). Exact dedup is your JQL.

## Gotchas

- **No Jira MCP = no Jira I/O**: The analysis skills work standalone (you can paste ticket text), but automated read/write requires the MCP server
- **Product areas YAML must be maintained**: Stale domain mappings = wrong classification. Update when team structure changes.
- **RCA only for bugs**: Feature PRDs get completeness scoring + breakdown, not root cause analysis
- **PIC suggestion ≠ assignment**: MeowKit suggests based on domain + load. Human confirms. Never auto-assign without review unless your team explicitly opts in.
- **Rate limits**: If running on every Jira webhook, consider batching or filtering (e.g., only PRD type, only specific projects)

## Related

- [Adding a Feature](/workflows/add-feature) — Full implementation workflow after intake
- [Fixing a Bug](/workflows/fix-bug) — Bug-specific investigation workflow
- [Code Review](/workflows/code-review) — Review workflow for the fix
- [mk:decision-framework](/reference/skills/decision-framework) — Decision architecture for triage
